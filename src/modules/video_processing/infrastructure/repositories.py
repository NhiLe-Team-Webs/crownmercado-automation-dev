from typing import List, Optional
from uuid import UUID
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from src.modules.video_processing.domain.entities import VideoJob
from src.modules.video_processing.domain.value_objects import JobStatus, Transcript, RenderConfig
from src.modules.video_processing.domain.ports import IVideoRepository
from .models import VideoJobModel

class PostgresVideoRepository(IVideoRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def save(self, job: VideoJob) -> None:
        model_data = job.dict()
        if job.transcript:
            model_data['transcript'] = job.transcript.dict()
        if job.render_config:
            model_data['render_config'] = job.render_config.dict()
        
        stmt = select(VideoJobModel).where(VideoJobModel.id == job.id)
        result = await self.session.execute(stmt)
        existing_model = result.scalar_one_or_none()

        if existing_model:
            for key, value in model_data.items():
                setattr(existing_model, key, value)
        else:
            new_model = VideoJobModel(**model_data)
            self.session.add(new_model)
        
        await self.session.commit()

    async def get_by_id(self, job_id: UUID) -> Optional[VideoJob]:
        stmt = select(VideoJobModel).where(VideoJobModel.id == job_id)
        result = await self.session.execute(stmt)
        model = result.scalar_one_or_none()
        if not model:
            return None
        
        return self._to_domain(model)

    async def get_by_user_id(self, user_id: int) -> List[VideoJob]:
        stmt = select(VideoJobModel).where(VideoJobModel.user_id == user_id)
        result = await self.session.execute(stmt)
        models = result.scalars().all()
        return [self._to_domain(m) for m in models]

    async def delete(self, job_id: UUID) -> None:
        stmt = delete(VideoJobModel).where(VideoJobModel.id == job_id)
        await self.session.execute(stmt)
        await self.session.commit()

    async def find_by_status(self, status: str) -> List[VideoJob]:
        stmt = select(VideoJobModel).where(VideoJobModel.status == status)
        result = await self.session.execute(stmt)
        models = result.scalars().all()
        return [self._to_domain(m) for m in models]

    def _to_domain(self, model: VideoJobModel) -> VideoJob:
        return VideoJob(
            id=model.id,
            user_id=model.user_id,
            input_file_path=model.input_file_path,
            status=model.status,
            transcript=Transcript(**model.transcript) if model.transcript else None,
            render_config=RenderConfig(**model.render_config) if model.render_config else RenderConfig(),
            output_file_paths=model.output_file_paths,
            created_at=model.created_at,
            updated_at=model.updated_at
        )
