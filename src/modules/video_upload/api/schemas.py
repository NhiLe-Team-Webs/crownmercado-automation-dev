from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from datetime import datetime

class InitiateUploadRequest(BaseModel):
    filename: str
    content_type: str

class InitiateUploadResponse(BaseModel):
    upload_id: str
    video_id: UUID
    key: str

class GetPresignedUrlRequest(BaseModel):
    video_id: UUID
    upload_id: str
    part_number: int

class GetPresignedUrlResponse(BaseModel):
    url: str

class PartItem(BaseModel):
    part_number: int = Field(alias="PartNumber")
    etag: str = Field(alias="ETag")

class CompleteUploadRequest(BaseModel):
    video_id: UUID
    upload_id: str
    parts: List[PartItem]

class VideoResponse(BaseModel):
    id: UUID
    original_filename: str
    status: str
    file_size_bytes: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True
