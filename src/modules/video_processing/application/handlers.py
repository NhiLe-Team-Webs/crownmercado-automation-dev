from uuid import UUID
from typing import Optional
from src.modules.video_processing.domain.entities import VideoJob
from src.modules.video_processing.domain.ports import IVideoRepository

class ProcessVideoJobUseCase:
    def __init__(self, video_repo: IVideoRepository):
        self.video_repo = video_repo

    async def execute(self, job_id: UUID) -> Optional[VideoJob]:
        job = await self.video_repo.get_by_id(job_id)
        if not job:
            return None
        
        # Placeholder for complex pipeline logic
        # orchestration steps (Phase 1.1):
        # 1. Silence removal
        # 2. ASR
        # 3. B-roll generation
        # 4. Render
        
        job.mark_as_processing()
        await self.video_repo.save(job)
        
        return job

class CreateVideoJobUseCase:
    def __init__(self, video_repo: IVideoRepository):
        self.video_repo = video_repo

    async def execute(self, user_id: int, input_file_path: str) -> VideoJob:
        job = VideoJob(user_id=user_id, input_file_path=input_file_path)
        await self.video_repo.save(job)
        return job
