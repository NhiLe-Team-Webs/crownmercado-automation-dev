from fastapi import APIRouter, HTTPException, Depends
from uuid import uuid4, UUID
from datetime import datetime
from typing import List
from celery import chain

from src.shared.database.dependencies import DatabaseSession
from ..infrastructure.repositories import VideoRepository
from ..infrastructure.adapters.s3_multipart import S3MultipartStorageAdapter
from ..domain.ports import CompletedPart
from .schemas import (
    InitiateUploadRequest, InitiateUploadResponse,
    GetPresignedUrlRequest, GetPresignedUrlResponse,
    CompleteUploadRequest, VideoResponse,
    StartPipelineRequest, PipelineStatusResponse
)

router = APIRouter(prefix="/uploads", tags=["Video Upload"])

# Dependency to get storage adapter
def get_storage():
    return S3MultipartStorageAdapter()

@router.post("/initiate", response_model=InitiateUploadResponse)
async def initiate_upload(
    request: InitiateUploadRequest,
    db: DatabaseSession,
    storage: S3MultipartStorageAdapter = Depends(get_storage)
):
    # Create video record in DB first
    repo = VideoRepository(db)
    
    # Generate S3 key: uploads/{uuid}/{filename}
    video_id = uuid4()
    s3_key = f"uploads/{video_id}/{request.filename}"
    
    # Initiate S3 Multipart
    content_type = request.content_type or "video/mp4"
    s3_response = await storage.initiate_multipart_upload(s3_key, content_type)
    
    # Save to DB
    await repo.create({
        "id": video_id,
        "original_filename": request.filename,
        "s3_key": s3_key,
        "status": "uploading",
        "created_at": datetime.utcnow()
    })
    
    return InitiateUploadResponse(
        upload_id=s3_response.upload_id,
        video_id=video_id,
        key=s3_key
    )

@router.post("/presigned-url", response_model=GetPresignedUrlResponse)
async def get_presigned_url(
    request: GetPresignedUrlRequest,
    db: DatabaseSession,
    storage: S3MultipartStorageAdapter = Depends(get_storage)
):
    repo = VideoRepository(db)
    video = await repo.get_by_id(request.video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    url = await storage.generate_presigned_url_for_part(
        remote_path=video.s3_key,
        upload_id=request.upload_id,
        part_number=request.part_number
    )
    return GetPresignedUrlResponse(url=url)

@router.post("/complete")
async def complete_upload(
    request: CompleteUploadRequest,
    db: DatabaseSession,
    storage: S3MultipartStorageAdapter = Depends(get_storage)
):
    repo = VideoRepository(db)
    video = await repo.get_by_id(request.video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Convert parts to domain model
    domain_parts = [
        CompletedPart(part_number=p.part_number, etag=p.etag)
        for p in request.parts
    ]
    
    # Complete S3
    await storage.complete_multipart_upload(
        remote_path=video.s3_key,
        upload_id=request.upload_id,
        parts=domain_parts
    )
    
    # Get file info from S3
    try:
        info = await storage.get_object_info(video.s3_key)
        file_size = info.get("size")
    except Exception as e:
        print(f"Failed to get object info: {e}")
        file_size = None

    # Update DB status
    await repo.update_status(
        video_id=video.id,
        status="completed",
        file_size_bytes=file_size,
        completed_at=datetime.utcnow()
    )
    
    return {"status": "success", "video_id": video.id}

@router.get("/{video_id}/download")
async def get_download_url(
    video_id: UUID,
    db: DatabaseSession,
    disposition: str = "inline",
    storage: S3MultipartStorageAdapter = Depends(get_storage)
):
    repo = VideoRepository(db)
    video = await repo.get_by_id(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    filename = video.original_filename if disposition == "attachment" else None
    url = await storage.generate_download_url(video.s3_key, filename=filename)
    return {"url": url}

@router.delete("/{video_id}")
async def delete_video(
    video_id: UUID,
    db: DatabaseSession,
    storage: S3MultipartStorageAdapter = Depends(get_storage)
):
    repo = VideoRepository(db)
    video = await repo.get_by_id(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Delete from S3
    try:
        await storage.delete_object(video.s3_key)
    except Exception as e:
        print(f"Failed to delete from S3: {e}")
    
    # Delete from DB
    await repo.delete(video_id)
    
    return {"status": "success", "message": "Video purged"}

@router.get("/my-videos", response_model=List[VideoResponse])
async def list_videos(db: DatabaseSession):
    repo = VideoRepository(db)
    videos = await repo.get_by_user_id(user_id=None)
    return videos


# ── Pipeline Helper Functions ────────────────────────────────────────────────────

def _get_resume_point(pipeline_status: str) -> tuple[int, bool]:
    """
    Determine the starting point in the pipeline chain based on current status.
    Returns (index in the chain: 0=merge, 1=strim, 2=broll, 3=render, should_validate_files)
    """
    if pipeline_status in ("idle", "failed"):
        return 0, False  # Start from beginning (merge step), no validation needed
    elif pipeline_status == "merging":
        return 0, False  # Resume from merge step (was interrupted during merging), no validation needed
    elif pipeline_status == "strimming":
        return 1, True  # Resume from strim step, validate merged file exists
    elif pipeline_status == "inserting_broll":
        return 2, True  # Resume from broll step, validate strimmed file exists
    elif pipeline_status == "rendering_remotion":
        return 3, True  # Resume from render step, validate broll file exists
    else:
        # For any unknown status, start from the beginning
        return 0, False

# ── Pipeline Endpoints ───────────────────────────────────────────────────────

@router.post("/start-pipeline")
async def start_pipeline(
    request: StartPipelineRequest,
    db: DatabaseSession,
):
    """
    Trigger the full video processing pipeline as a Celery chain.
    Accepts multiple video_ids → merges into one → strim → broll → remotion.
    Uses the FIRST video_id as the primary pipeline record.
    Supports resuming from the last completed step if pipeline failed previously.
    """
    from src.worker.pipeline_tasks import (
        merge_videos_task, strim_video_task,
        insert_broll_task, render_remotion_task,
        pipeline_error_handler,
    )

    if not request.video_ids:
        raise HTTPException(status_code=400, detail="video_ids cannot be empty")

    repo = VideoRepository(db)

    # Validate all videos exist and collect their S3 keys
    raw_s3_keys = []
    for vid in request.video_ids:
        video = await repo.get_by_id(vid)
        if not video:
            raise HTTPException(status_code=404, detail=f"Video {vid} not found")
        raw_s3_keys.append(video.s3_key)

    # Use the first video as the primary pipeline record
    primary_id = request.video_ids[0]
    primary = await repo.get_by_id(primary_id)

    # Determine if this is a new pipeline or a resume request
    resume_point, should_validate = _get_resume_point(primary.pipeline_status)

    # Initialize storage service for file validation
    from src.modules.video_processing.infrastructure.storage.s3_storage import S3StorageService
    storage_service = S3StorageService()

    # If resuming and we need to validate files exist
    if should_validate:
        # Define required S3 key based on resume point
        required_key = None
        if resume_point == 1 and hasattr(primary, 'merged_s3_key') and primary.merged_s3_key:
            required_key = primary.merged_s3_key
        elif resume_point == 2 and hasattr(primary, 'strimmed_s3_key') and primary.strimmed_s3_key:
            required_key = primary.strimmed_s3_key
        elif resume_point == 3 and hasattr(primary, 'broll_s3_key') and primary.broll_s3_key:
            required_key = primary.broll_s3_key

        if required_key:
            try:
                await storage_service.get_object_info(required_key)
            except Exception:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot resume pipeline from {primary.pipeline_status} - required intermediate file ({required_key}) is missing"
                )

        # Return a message indicating resuming
        resume_messages = {
            1: f"Resuming pipeline from strim step (was at: {primary.pipeline_status})",
            2: f"Resuming pipeline from broll step (was at: {primary.pipeline_status})",
            3: f"Resuming pipeline from render step (was at: {primary.pipeline_status})"
        }
        resume_message = resume_messages.get(resume_point, f"Resuming pipeline from step {resume_point}")
    else:
        # For new pipeline or failed at start, set the raw_s3_keys_json
        import json
        await repo.update_pipeline_status(
            primary_id, "merging",
            raw_s3_keys_json=json.dumps(raw_s3_keys)
        )
        resume_message = "Pipeline triggered — poll /pipeline-status for progress"

    # Build the appropriate chain based on resume point
    video_id_str = str(primary_id)

    if resume_point == 0:  # Start from beginning
        pipeline = chain(
            merge_videos_task.s(video_id_str),
            strim_video_task.s(),
            insert_broll_task.s(),
            render_remotion_task.s(),
        )
    elif resume_point == 1:  # Resume from strim step
        pipeline = chain(
            strim_video_task.s(video_id_str),
            insert_broll_task.s(),
            render_remotion_task.s(),
        )
    elif resume_point == 2:  # Resume from broll step
        pipeline = chain(
            insert_broll_task.s(video_id_str),
            render_remotion_task.s(),
        )
    elif resume_point == 3:  # Resume from render step
        pipeline = chain(
            render_remotion_task.s(video_id_str),
        )
    else:
        # Fallback to starting from the beginning
        await repo.update_pipeline_status(
            primary_id, "merging",
            raw_s3_keys_json=json.dumps(raw_s3_keys)
        )
        pipeline = chain(
            merge_videos_task.s(video_id_str),
            strim_video_task.s(),
            insert_broll_task.s(),
            render_remotion_task.s(),
        )

    pipeline.apply_async(link_error=pipeline_error_handler.s(video_id=video_id_str))

    return {
        "status": "started",
        "video_id": str(primary_id),
        "message": resume_message,
    }


@router.get("/{video_id}/pipeline-status", response_model=PipelineStatusResponse)
async def get_pipeline_status(
    video_id: UUID,
    db: DatabaseSession,
):
    """
    Lightweight endpoint for frontend polling.
    Returns current pipeline step + error info if failed.
    """
    repo = VideoRepository(db)
    result = await repo.get_pipeline_status(video_id)
    if not result:
        raise HTTPException(status_code=404, detail="Video not found")
    return result
