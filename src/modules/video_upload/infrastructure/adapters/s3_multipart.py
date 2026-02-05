import aioboto3
from botocore.exceptions import ClientError
from typing import List
from src.modules.video_upload.domain.ports import IMultipartStoragePort, InitiateResponse, CompletedPart
from src.shared.config.settings import settings

class S3MultipartStorageAdapter(IMultipartStoragePort):
    def __init__(self):
        self.session = aioboto3.Session()
        self.bucket_name = settings.S3_BUCKET_NAME
        self.region = settings.AWS_REGION

    async def initiate_multipart_upload(self, remote_path: str) -> InitiateResponse:
        async with self.session.client(
            "s3",
            region_name=self.region,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            endpoint_url=settings.S3_ENDPOINT_URL if settings.S3_ENDPOINT_URL else None
        ) as s3:
            try:
                response = await s3.create_multipart_upload(
                    Bucket=self.bucket_name,
                    Key=remote_path
                )
                return InitiateResponse(
                    upload_id=response['UploadId'],
                    key=remote_path
                )
            except ClientError as e:
                raise e

    async def generate_presigned_url_for_part(
        self, 
        remote_path: str, 
        upload_id: str, 
        part_number: int,
        expiration: int = 3600
    ) -> str:
        async with self.session.client(
            "s3",
            region_name=self.region,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            endpoint_url=settings.S3_ENDPOINT_URL if settings.S3_ENDPOINT_URL else None
        ) as s3:
            try:
                url = await s3.generate_presigned_url(
                    ClientMethod='upload_part',
                    Params={
                        'Bucket': self.bucket_name,
                        'Key': remote_path,
                        'UploadId': upload_id,
                        'PartNumber': part_number
                    },
                    ExpiresIn=expiration
                )
                return url
            except ClientError as e:
                raise e

    async def complete_multipart_upload(
        self, 
        remote_path: str, 
        upload_id: str, 
        parts: List[CompletedPart]
    ) -> str:
        async with self.session.client(
            "s3",
            region_name=self.region,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            endpoint_url=settings.S3_ENDPOINT_URL if settings.S3_ENDPOINT_URL else None
        ) as s3:
            try:
                # S3 requires parts to be sorted by PartNumber
                sorted_parts = sorted([
                    {'PartNumber': p.part_number, 'ETag': p.etag}
                    for p in parts
                ], key=lambda x: x['PartNumber'])

                await s3.complete_multipart_upload(
                    Bucket=self.bucket_name,
                    Key=remote_path,
                    UploadId=upload_id,
                    MultipartUpload={'Parts': sorted_parts}
                )
                return f"s3://{self.bucket_name}/{remote_path}"
            except ClientError as e:
                raise e

    async def abort_multipart_upload(
        self, 
        remote_path: str, 
        upload_id: str
    ) -> None:
        async with self.session.client(
            "s3",
            region_name=self.region,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            endpoint_url=settings.S3_ENDPOINT_URL if settings.S3_ENDPOINT_URL else None
        ) as s3:
            try:
                await s3.abort_multipart_upload(
                    Bucket=self.bucket_name,
                    Key=remote_path,
                    UploadId=upload_id
                )
            except ClientError as e:
                raise e

    async def generate_download_url(self, remote_path: str, expiration: int = 3600) -> str:
        async with self.session.client(
            "s3",
            region_name=self.region,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            endpoint_url=settings.S3_ENDPOINT_URL if settings.S3_ENDPOINT_URL else None
        ) as s3:
            try:
                url = await s3.generate_presigned_url(
                    ClientMethod='get_object',
                    Params={'Bucket': self.bucket_name, 'Key': remote_path},
                    ExpiresIn=expiration
                )
                return url
            except ClientError as e:
                raise e
