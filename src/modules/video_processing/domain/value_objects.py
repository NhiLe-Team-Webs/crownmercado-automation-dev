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

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("text không được rỗng")
        return v.strip()

    @field_validator("text", mode='before')
    @classmethod
    def uppercase_text_for_specific_modes(cls, v: str, info) -> str:
        # Convert text to uppercase for certain modes (like CINEMATIC_CALLOUT and SIDE_PANEL)
        if "mode" in info.data:
            mode = info.data["mode"]
            if mode in [TextOverlayMode.CINEMATIC_CALLOUT, TextOverlayMode.SIDE_PANEL]:
                return v.upper()
        return v

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

