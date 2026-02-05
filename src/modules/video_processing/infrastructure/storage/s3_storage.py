import aioboto3
from botocore.exceptions import ClientError
from typing import Optional
from ...domain.ports import IStoragePort
from src.shared.config.settings import settings

class S3StorageService(IStoragePort):
    def __init__(self):
        self.session = aioboto3.Session()
        self.bucket_name = settings.S3_BUCKET_NAME
        self.region = settings.AWS_REGION

    async def upload_file(self, local_path: str, remote_path: str) -> str:
        """Upload file và trả về public/internal URL"""
        async with self.session.client(
            "s3",
            region_name=self.region,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
        ) as s3:
            try:
                await s3.upload_file(local_path, self.bucket_name, remote_path)
                return f"s3://{self.bucket_name}/{remote_path}"
            except ClientError as e:
                # Log error here if you have a logger
                raise e

    async def download_file(self, remote_path: str, local_path: str) -> None:
        """Download file từ storage về local"""
        async with self.session.client(
            "s3",
            region_name=self.region,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
        ) as s3:
            try:
                await s3.download_file(self.bucket_name, remote_path, local_path)
            except ClientError as e:
                raise e

    async def generate_presigned_url(self, remote_path: str, expiration: int = 3600) -> str:
        """Tạo URL tạm thời để upload/download trực tiếp"""
        async with self.session.client(
            "s3",
            region_name=self.region,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
        ) as s3:
            try:
                # Mặc định là 'put_object' để upload, nếu cần download thì đổi thành 'get_object'
                # Trong bài toán của mình, thường dùng để upload trực tiếp từ client.
                url = await s3.generate_presigned_url(
                    ClientMethod='put_object',
                    Params={'Bucket': self.bucket_name, 'Key': remote_path},
                    ExpiresIn=expiration
                )
                return url
            except ClientError as e:
                raise e

    async def delete_file(self, remote_path: str) -> None:
        """Xóa file khỏi storage"""
        async with self.session.client(
            "s3",
            region_name=self.region,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
        ) as s3:
            try:
                await s3.delete_object(Bucket=self.bucket_name, Key=remote_path)
            except ClientError as e:
                raise e
