from typing import Annotated
from fastapi import Depends
from .s3_storage import S3StorageService
from ...domain.ports import IStoragePort

def get_storage_service() -> IStoragePort:
    return S3StorageService()

StorageService = Annotated[IStoragePort, Depends(get_storage_service)]
