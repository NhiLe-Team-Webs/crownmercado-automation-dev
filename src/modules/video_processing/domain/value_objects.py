from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class JobStatus(str, Enum):
    UPLOADED = "Uploaded"
    QUEUED = "Queued"
    PROCESSING = "Processing"
    COMPLETED = "Completed"
    FAILED = "Failed"


class WordSegment(BaseModel):
    word: str
    start: float
    end: float
    confidence: float


class Transcript(BaseModel):
    full_text: str
    words: list[WordSegment] = []


# ── Text Overlay Value Objects ───────────────────────────────────────────────

class TextOverlayMode(str, Enum):
    """Phân loại hiển thị"""
    SIDE_PANEL = "SIDE_PANEL"
    CINEMATIC_CALLOUT = "CINEMATIC_CALLOUT"
    BOTTOM_TITLE = "BOTTOM_TITLE"
    B_ROLL_VIDEO = "B_ROLL_VIDEO"


class TextOverlayPosition(str, Enum):
    LEFT = "left"
    RIGHT = "right"
    BOTTOM_LEFT = "bottom_left"
    BOTTOM_RIGHT = "bottom_right"
    BOTTOM_CENTER = "bottom_center"


class TextOverlay(BaseModel):
    text: str = Field(..., description="Text hiển thị lên video")
    start: float = Field(..., description="Thời điểm bắt đầu (giây)")
    end: float = Field(..., description="Thời điểm kết thúc (giây)")
    mode: TextOverlayMode
    position: TextOverlayPosition = TextOverlayPosition.BOTTOM_LEFT
    reason: Optional[str] = Field(None, description="Lý do LLM chọn moment này")
    search_query: Optional[str] = Field(None, description="Từ khoá tìm kiếm video B-Roll tiếng Anh (chỉ dùng cho mode B_ROLL_VIDEO)")
    highlight_word: Optional[str] = Field(None, description="Từ trọng tâm để gắn underline (chỉ dùng cho mode B_ROLL_VIDEO)")
    url: Optional[str] = Field(None, description="URL video B-Roll thực tế từ Pexels (Được gán sau)")
    
    # ── Premium B-Roll Metadata ──────────────────────────────────────────────
    visual_intent: Optional[str] = Field(None, description="Ý đồ hình ảnh (vdu: 'corporate environment', 'high-tech lab')")
    spoken_context: Optional[str] = Field(None, description="Ngữ cảnh lời nói xung quanh moment này")
    must_have: List[str] = Field(default_factory=list, description="Yếu tố bắt buộc có trong clip (2-3 mục)")
    must_not_have: List[str] = Field(default_factory=list, description="Yếu tố tuyệt đối không có (1-2 mục)")
    query_candidates: List[str] = Field(default_factory=list, description="4-6 query tìm kiếm từ literal đến thematic")
    anchor_subject: Optional[str] = Field(None, description="Đối tượng chính trong khung hình (vdu: 'person', 'object', 'none')")
    relevance_confidence: float = Field(1.0, description="Độ tự tin về sự liên quan (0-1)")
    fallback_visual: Optional[str] = Field(None, description="Hình ảnh thay thế nếu không tìm được clip stock phù hợp")

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("text không được rỗng")
        return v.strip()

    @field_validator("end")
    @classmethod
    def end_after_start(cls, v: float, info) -> float:
        if "start" in info.data and v <= info.data["start"]:
            raise ValueError("end phải lớn hơn start")
        return v


class RenderConfig(BaseModel):
    resolution: str = "1920x1080"
    format: str = "mp4"
    text_overlays: list[TextOverlay] = Field(
        default_factory=list,
        description="Danh sách text overlay được LLM extract"
    )


class TimestampRange(BaseModel):
    """Value Object cho khoảng thời gian"""
    start: float
    end: float

