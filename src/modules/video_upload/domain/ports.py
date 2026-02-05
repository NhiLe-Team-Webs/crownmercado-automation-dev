from abc import ABC, abstractmethod
from typing import List, Dict, Any
from pydantic import BaseModel

class InitiateResponse(BaseModel):
    upload_id: str
    key: str

class CompletedPart(BaseModel):
    part_number: int
    etag: str

class IMultipartStoragePort(ABC):
    @abstractmethod
    async def initiate_multipart_upload(self, remote_path: str, content_type: str) -> InitiateResponse:
        pass

    @abstractmethod
    async def generate_presigned_url_for_part(
        self, 
        remote_path: str, 
        upload_id: str, 
        part_number: int,
        expiration: int = 3600
    ) -> str:
        pass

    @abstractmethod
    async def complete_multipart_upload(
        self, 
        remote_path: str, 
        upload_id: str, 
        parts: List[CompletedPart]
    ) -> str:
        pass

    @abstractmethod
    async def abort_multipart_upload(
        self, 
        remote_path: str, 
        upload_id: str
    ) -> None:
        pass

    @abstractmethod
    async def generate_download_url(self, remote_path: str, expiration: int = 3600, filename: str = None) -> str:
        pass

    @abstractmethod
    async def get_object_info(self, remote_path: str) -> Dict[str, Any]:
        pass
