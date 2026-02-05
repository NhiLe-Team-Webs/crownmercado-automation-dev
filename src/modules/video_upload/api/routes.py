from fastapi import APIRouter, HTTPException, Depends
from uuid import uuid4, UUID
from datetime import datetime
from typing import List

from src.shared.database.dependencies import DatabaseSession
from ..infrastructure.repositories import VideoRepository
from ..infrastructure.adapters.s3_multipart import S3MultipartStorageAdapter
from ..domain.ports import CompletedPart
from .schemas import (
    InitiateUploadRequest, InitiateUploadResponse,
    GetPresignedUrlRequest, GetPresignedUrlResponse,
    CompleteUploadRequest, VideoResponse
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
    s3_response = await storage.initiate_multipart_upload(s3_key)
    
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
    
    # Update DB status
    await repo.update_status(
        video_id=video.id,
        status="completed",
        completed_at=datetime.utcnow()
    )
    
    return {"status": "success", "video_id": video.id}

@router.get("/{video_id}/download")
async def get_download_url(
    video_id: UUID,
    db: DatabaseSession,
    storage: S3MultipartStorageAdapter = Depends(get_storage)
):
    repo = VideoRepository(db)
    video = await repo.get_by_id(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # We can reuse generate_presigned_url if we modify it to support GET
    # Or add a specific method to storage adapter.
    # For now, let's assume generate_presigned_url in S3StorageService (from Step 1) 
    # but we are using S3MultipartStorageAdapter here. Let's add it to the adapter.
    
    url = await storage.generate_download_url(video.s3_key)
    return {"url": url}
