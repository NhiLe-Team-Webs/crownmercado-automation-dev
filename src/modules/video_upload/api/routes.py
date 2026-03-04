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


# ── Pipeline Endpoints ───────────────────────────────────────────────────────

@router.post("/start-pipeline")
async def start_pipeline(
    request: StartPipelineRequest,
    db: DatabaseSession,
):
    """
    Trigger the full video processing pipeline as a Celery chain.
    Chain: merge → strim → broll → remotion
    Each step runs in worker (background), not in API process.
    """
    from src.worker.pipeline_tasks import (
        merge_videos_task, strim_video_task,
        insert_broll_task, render_remotion_task,
        pipeline_error_handler,
    )

    repo = VideoRepository(db)
    video = await repo.get_by_id(request.video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if video.pipeline_status not in ("idle", "failed"):
        raise HTTPException(
            status_code=409,
            detail=f"Pipeline already in progress (status: {video.pipeline_status})"
        )

    # Reset pipeline state before starting
    await repo.update_pipeline_status(request.video_id, "merging")

    # Build Celery chain — each task returns video_id to the next
    video_id_str = str(request.video_id)
    pipeline = chain(
        merge_videos_task.s(video_id_str),
        strim_video_task.s(),
        insert_broll_task.s(),
        render_remotion_task.s(),
    )
    pipeline.apply_async(link_error=pipeline_error_handler.s(video_id=video_id_str))

    return {
        "status": "started",
        "video_id": str(request.video_id),
        "message": "Pipeline triggered — poll /pipeline-status for progress",
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
