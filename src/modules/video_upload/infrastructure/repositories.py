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
