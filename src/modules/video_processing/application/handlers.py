import os
from uuid import UUID
from typing import Optional
from src.modules.video_processing.domain.entities import VideoJob
from src.modules.video_processing.domain.ports import IVideoRepository, IVideoEditorPort

class ProcessVideoJobUseCase:
    def __init__(self, video_repo: IVideoRepository, editor_port: IVideoEditorPort):
        self.video_repo = video_repo
        self.editor_port = editor_port

    async def execute(self, job_id: UUID) -> Optional[VideoJob]:
        job = await self.video_repo.get_by_id(job_id)
        if not job:
            return None
        
        job.mark_as_processing()
        await self.video_repo.save(job)

        try:
            # 1. Silence removal (Phase 1.1)
            # Assuming input_file_path is a local path for now or downloaded from storage
            # In a real scenario, we'd download from S3 first.
            output_dir = os.path.dirname(job.input_file_path)
            output_filename = f"edited_{os.path.basename(job.input_file_path)}"
            output_path = os.path.join(output_dir, output_filename)
            
            edited_path = await self.editor_port.remove_silence(job.input_file_path, output_path)
            
            # Update job with edited path (simplified for demo)
            job.mark_as_completed(output_paths=[edited_path])
            await self.video_repo.save(job)
            
        except Exception as e:
            job.mark_as_failed()
            await self.video_repo.save(job)
            raise
        
        return job

class CreateVideoJobUseCase:
    def __init__(self, video_repo: IVideoRepository):
        self.video_repo = video_repo

    async def execute(self, user_id: int, input_file_path: str) -> VideoJob:
        job = VideoJob(user_id=user_id, input_file_path=input_file_path)
        await self.video_repo.save(job)
        return job
