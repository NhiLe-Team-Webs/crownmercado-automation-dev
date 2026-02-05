from sqlalchemy import Column, String, Integer, JSON, DateTime, Enum as SQLEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID, ARRAY
from src.shared.database.base import Base
from src.modules.video_processing.domain.value_objects import JobStatus
import uuid

class VideoJobModel(Base):
    __tablename__ = "video_jobs"

    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Integer, nullable=False)
    input_file_path = Column(String, nullable=False)
    status = Column(SQLEnum(JobStatus), default=JobStatus.UPLOADED)
    transcript = Column(JSON, nullable=True)
    render_config = Column(JSON, nullable=True)
    output_file_paths = Column(ARRAY(String), default=[])
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
