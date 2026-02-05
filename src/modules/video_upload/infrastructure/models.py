from sqlalchemy import Column, String, Integer, BigInteger, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from src.shared.database.base import Base
import uuid

class VideoModel(Base):
    __tablename__ = "videos"

    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Integer, nullable=True)
    original_filename = Column(String(255), nullable=False)
    s3_key = Column(String(500), nullable=False)
    status = Column(String(20), server_default="uploading")
    file_size_bytes = Column(BigInteger, nullable=True)
    duration_sec = Column(Float, nullable=True)
    thumbnail_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
