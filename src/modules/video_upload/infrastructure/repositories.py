from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List, Optional
from uuid import UUID
from .models import VideoModel

class VideoRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, video_data: dict) -> VideoModel:
        video = VideoModel(**video_data)
        self.session.add(video)
        await self.session.commit()
        await self.session.refresh(video)
        return video

    async def get_by_id(self, video_id: UUID) -> Optional[VideoModel]:
        result = await self.session.execute(
            select(VideoModel).where(VideoModel.id == video_id)
        )
        return result.scalar_one_or_none()

    async def get_by_user_id(self, user_id: int) -> List[VideoModel]:
        result = await self.session.execute(
            select(VideoModel)
            .where(VideoModel.user_id == user_id)
            .order_by(VideoModel.created_at.desc())
        )
        return list(result.scalars().all())

    async def update_status(self, video_id: UUID, status: str, **kwargs) -> Optional[VideoModel]:
        query = (
            update(VideoModel)
            .where(VideoModel.id == video_id)
            .values(status=status, **kwargs)
            .returning(VideoModel)
        )
        result = await self.session.execute(query)
        await self.session.commit()
        return result.scalar_one_or_none()

    async def delete(self, video_id: UUID) -> bool:
        video = await self.get_by_id(video_id)
        if video:
            await self.session.delete(video)
            await self.session.commit()
            return True
        return False

    # ── Pipeline-specific methods ────────────────────────────────────────────

    async def update_pipeline_status(
        self, video_id: UUID, pipeline_status: str, **kwargs
    ) -> Optional[VideoModel]:
        """
        Atomically update pipeline_status and any intermediate S3 key columns.
        Usage: repo.update_pipeline_status(id, "strimming", merged_s3_key="uploads/xxx/merged.mp4")
        """
        values = {"pipeline_status": pipeline_status, "pipeline_error": None, **kwargs}
        query = (
            update(VideoModel)
            .where(VideoModel.id == video_id)
            .values(**values)
            .returning(VideoModel)
        )
        result = await self.session.execute(query)
        await self.session.commit()
        return result.scalar_one_or_none()

    async def mark_pipeline_failed(self, video_id: UUID, error: str) -> Optional[VideoModel]:
        """Mark pipeline as failed with error message for debugging/retry."""
        query = (
            update(VideoModel)
            .where(VideoModel.id == video_id)
            .values(pipeline_status="failed", pipeline_error=error)
            .returning(VideoModel)
        )
        result = await self.session.execute(query)
        await self.session.commit()
        return result.scalar_one_or_none()

    async def get_pipeline_status(self, video_id: UUID) -> Optional[dict]:
        """Lightweight query returning only pipeline-related fields for frontend polling."""
        video = await self.get_by_id(video_id)
        if not video:
            return None
        return {
            "video_id": str(video.id),
            "pipeline_status": video.pipeline_status,
            "pipeline_error": video.pipeline_error,
            "original_filename": video.original_filename,
        }
