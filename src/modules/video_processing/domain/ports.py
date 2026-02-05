from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID
from .entities import VideoJob
from .value_objects import Transcript

class IVideoRepository(ABC):
    @abstractmethod
    async def save(self, job: VideoJob) -> None:
        pass

    @abstractmethod
    async def get_by_id(self, job_id: UUID) -> Optional[VideoJob]:
        pass

    @abstractmethod
    async def get_by_user_id(self, user_id: int) -> List[VideoJob]:
        pass

    @abstractmethod
    async def delete(self, job_id: UUID) -> None:
        pass

    @abstractmethod
    async def find_by_status(self, status: str) -> List[VideoJob]:
        pass

class ITranscriptionPort(ABC):
    @abstractmethod
    async def transcribe(self, audio_path: str) -> Transcript:
        pass

class IRenderEnginePort(ABC):
    @abstractmethod
    async def render(self, job_id: UUID, layers: list) -> str:
        """Trả về output file path"""
        pass

class IStoragePort(ABC):
    @abstractmethod
    async def upload_file(self, local_path: str, remote_path: str) -> str:
        """Upload file và trả về public/internal URL"""
        pass

    @abstractmethod
    async def download_file(self, remote_path: str, local_path: str) -> None:
        """Download file từ storage về local"""
        pass

    @abstractmethod
    async def generate_presigned_url(self, remote_path: str, expiration: int = 3600) -> str:
        """Tạo URL tạm thời để upload/download trực tiếp"""
        pass

    @abstractmethod
    async def delete_file(self, remote_path: str) -> None:
        """Xóa file khỏi storage"""
        pass
