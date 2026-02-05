from enum import Enum
from typing import List, Optional
from pydantic import BaseModel

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
    
class RenderConfig(BaseModel):
    resolution: str = "1920x1080"
    format: str = "mp4"

class TimestampRange(BaseModel):
    """Value Object cho khoảng thời gian"""
    start: float
    end: float
