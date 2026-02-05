from datetime import datetime
from typing import List, Optional
from uuid import UUID, uuid4
from pydantic import BaseModel, Field
from .value_objects import JobStatus, Transcript, RenderConfig

class VideoJob(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    user_id: int
    input_file_path: str
    status: JobStatus = JobStatus.UPLOADED
    transcript: Optional[Transcript] = None
    render_config: RenderConfig = RenderConfig()
    output_file_paths: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def mark_as_queued(self):
        self.status = JobStatus.QUEUED
        self.updated_at = datetime.utcnow()

    def mark_as_processing(self):
        self.status = JobStatus.PROCESSING
        self.updated_at = datetime.utcnow()

    def mark_as_completed(self, output_paths: List[str]):
        self.status = JobStatus.COMPLETED
        self.output_file_paths = output_paths
        self.updated_at = datetime.utcnow()

    def mark_as_failed(self):
        self.status = JobStatus.FAILED
        self.updated_at = datetime.utcnow()
