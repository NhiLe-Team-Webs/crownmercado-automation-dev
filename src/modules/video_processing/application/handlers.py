from uuid import UUID
from typing import Optional
import structlog

from src.modules.video_processing.domain.entities import VideoJob
from src.modules.video_processing.domain.ports import (
    IVideoRepository,
    IKeywordExtractorPort,
)

logger = structlog.get_logger()


class ProcessVideoJobUseCase:
    def __init__(
        self,
        video_repo: IVideoRepository,
        keyword_extractor: Optional[IKeywordExtractorPort] = None,
    ):
        self.video_repo = video_repo
        self.keyword_extractor = keyword_extractor

    async def execute(self, job_id: UUID) -> Optional[VideoJob]:
        job = await self.video_repo.get_by_id(job_id)
        if not job:
            return None

        job.mark_as_processing()
        await self.video_repo.save(job)

        # ── Pipeline steps ────────────────────────────────────────────────────
        # Step 1: Silence removal (TODO: implement)
        # Step 2: ASR / Transcription (TODO: implement)

        # Step 3: Keyword extraction → text overlays
        if self.keyword_extractor and job.transcript:
            try:
                logger.info("Running keyword extraction", job_id=str(job_id))
                overlays = await self.keyword_extractor.extract(job.transcript)
                job.render_config.text_overlays = overlays
                await self.video_repo.save(job)
                logger.info(
                    "Keyword extraction completed",
                    job_id=str(job_id),
                    overlay_count=len(overlays),
                )
            except Exception as exc:
                # Không fail toàn bộ job nếu extraction lỗi
                logger.warning(
                    "Keyword extraction failed, continuing without overlays",
                    job_id=str(job_id),
                    error=str(exc),
                )

        # Step 4: Render (TODO: inject IRenderEnginePort)

        return job


class CreateVideoJobUseCase:
    def __init__(self, video_repo: IVideoRepository):
        self.video_repo = video_repo

    async def execute(self, user_id: int, input_file_path: str) -> VideoJob:
        job = VideoJob(user_id=user_id, input_file_path=input_file_path)
        await self.video_repo.save(job)
        return job
