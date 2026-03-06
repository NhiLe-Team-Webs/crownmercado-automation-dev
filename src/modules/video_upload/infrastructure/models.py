from sqlalchemy import Column, String, Integer, BigInteger, Float, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from src.shared.database.base import Base
import uuid
import enum


class PipelineStatus(str, enum.Enum):
    """Pipeline state machine — mỗi video đi qua các trạng thái này tuần tự."""
    IDLE = "idle"                           # Chưa bắt đầu pipeline
    MERGING = "merging"                     # Đang gộp raw files
    STRIMMING = "strimming"                 # Đang cắt silence
    INSERTING_BROLL = "inserting_broll"      # Đang chèn B-roll
    RENDERING_REMOTION = "rendering_remotion"  # Đang render text overlay (Remotion)
    COMPLETED = "completed"                 # Pipeline hoàn tất
    FAILED = "failed"                       # Pipeline lỗi (có thể retry từ step cuối)


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

    # ── Pipeline tracking columns ────────────────────────────────────────────
    pipeline_status = Column(String(30), server_default=PipelineStatus.IDLE.value)
    raw_s3_keys_json = Column(Text, nullable=True)          # JSON array of all raw uploaded S3 keys
    merged_s3_key = Column(String(500), nullable=True)      # S3 key sau khi merge xong
    strimmed_s3_key = Column(String(500), nullable=True)    # S3 key sau khi strim xong
    broll_s3_key = Column(String(500), nullable=True)       # S3 key sau khi chèn B-roll xong
    final_s3_key = Column(String(500), nullable=True)       # S3 key video cuối cùng (sau Remotion)
    pipeline_error = Column(Text, nullable=True)            # Lý do lỗi nếu pipeline fail
    overlays_json = Column(Text, nullable=True)             # JSON array of TextOverlay metadata for Remotion
