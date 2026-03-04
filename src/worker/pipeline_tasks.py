"""
Unified Video Pipeline Tasks
─────────────────────────────
Celery chain: merge → strim → broll → remotion
Mỗi task chạy độc lập trong worker, cập nhật DB pipeline_status sau mỗi step.
Nếu bất kỳ step nào fail → pipeline_error_handler cập nhật DB + lưu lý do lỗi.
"""

import os
import asyncio
import traceback
import structlog

from src.worker.celery_app import celery_app
from src.shared.database.session import async_session_maker
from src.modules.video_upload.infrastructure.repositories import VideoRepository
from src.modules.video_processing.infrastructure.storage.s3_storage import S3StorageService
from src.modules.video_processing.infrastructure.adapters.video_editor_adapter import AutoEditorAdapter

logger = structlog.get_logger()

# ── Helpers ──────────────────────────────────────────────────────────────────

TEMP_DIR = "/tmp/pipeline"


def _ensure_temp_dir():
    os.makedirs(TEMP_DIR, exist_ok=True)


def _run_async(coro):
    """Run async function from synchronous Celery task context."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _get_repo():
    """Create a fresh DB session + repository for worker context."""
    session = async_session_maker()
    return VideoRepository(session), session


# ── Task 1: Merge Videos ────────────────────────────────────────────────────

@celery_app.task(name="pipeline.merge_videos", bind=True, max_retries=2)
def merge_videos_task(self, video_id: str) -> str:
    """
    Download raw file from S3 → (future: merge multiple files) → upload merged → update DB.
    Currently handles single file pass-through for the pipeline prototype.
    Returns video_id for next task in chain.
    """
    logger.info("Pipeline: Starting MERGE step", video_id=video_id)

    async def _execute():
        repo, session = await _get_repo()
        storage = S3StorageService()
        _ensure_temp_dir()

        try:
            # Update status to MERGING
            await repo.update_pipeline_status(video_id, "merging")

            video = await repo.get_by_id(video_id)
            if not video:
                raise ValueError(f"Video {video_id} not found in DB")

            # Download original file from S3
            local_input = os.path.join(TEMP_DIR, f"{video_id}_raw.mp4")
            await storage.download_file(video.s3_key, local_input)

            # TODO: When multi-file upload is ready, merge multiple files here with FFmpeg
            # For now, the "merged" output IS the single raw file
            merged_s3_key = f"pipeline/{video_id}/merged.mp4"
            await storage.upload_file(local_input, merged_s3_key)

            # Update DB: mark merge complete, save intermediate S3 key
            await repo.update_pipeline_status(
                video_id, "strimming",
                merged_s3_key=merged_s3_key
            )

            # Cleanup temp
            if os.path.exists(local_input):
                os.remove(local_input)

            logger.info("Pipeline: MERGE complete", video_id=video_id, merged_key=merged_s3_key)
            return video_id

        except Exception as e:
            await repo.mark_pipeline_failed(video_id, f"MERGE failed: {str(e)}")
            raise
        finally:
            await session.close()

    return _run_async(_execute())


# ── Task 2: Strimming (Silence Removal) ─────────────────────────────────────

@celery_app.task(name="pipeline.strim_video", bind=True, max_retries=2)
def strim_video_task(self, video_id: str) -> str:
    """
    Download merged file → run auto-editor silence removal → upload strimmed → update DB.
    """
    logger.info("Pipeline: Starting STRIM step", video_id=video_id)

    async def _execute():
        repo, session = await _get_repo()
        storage = S3StorageService()
        editor = AutoEditorAdapter(temp_dir=TEMP_DIR)
        _ensure_temp_dir()

        try:
            video = await repo.get_by_id(video_id)
            if not video or not video.merged_s3_key:
                raise ValueError(f"Video {video_id}: merged_s3_key not found (merge step incomplete?)")

            # Download merged file
            local_merged = os.path.join(TEMP_DIR, f"{video_id}_merged.mp4")
            await storage.download_file(video.merged_s3_key, local_merged)

            # Run auto-editor silence removal
            local_strimmed = os.path.join(TEMP_DIR, f"{video_id}_strimmed.mp4")
            await editor.remove_silence(local_merged, local_strimmed)

            # Upload strimmed result
            strimmed_s3_key = f"pipeline/{video_id}/strimmed.mp4"
            await storage.upload_file(local_strimmed, strimmed_s3_key)

            # Update DB
            await repo.update_pipeline_status(
                video_id, "inserting_broll",
                strimmed_s3_key=strimmed_s3_key
            )

            # Cleanup
            for f in [local_merged, local_strimmed]:
                if os.path.exists(f):
                    os.remove(f)

            logger.info("Pipeline: STRIM complete", video_id=video_id, strimmed_key=strimmed_s3_key)
            return video_id

        except Exception as e:
            await repo.mark_pipeline_failed(video_id, f"STRIM failed: {str(e)}")
            raise
        finally:
            await session.close()

    return _run_async(_execute())


# ── Task 3: B-Roll Insertion ─────────────────────────────────────────────────

@celery_app.task(name="pipeline.insert_broll", bind=True, max_retries=2)
def insert_broll_task(self, video_id: str) -> str:
    """
    Download strimmed file → analyze transcript → fetch B-Roll from Pexels → overlay → upload → update DB.
    NOTE: Full B-Roll logic depends on Gemini keyword extraction + Pexels API.
    This task provides the structural skeleton; detailed insertion logic is a future enhancement.
    """
    logger.info("Pipeline: Starting BROLL step", video_id=video_id)

    async def _execute():
        repo, session = await _get_repo()
        storage = S3StorageService()
        _ensure_temp_dir()

        try:
            video = await repo.get_by_id(video_id)
            if not video or not video.strimmed_s3_key:
                raise ValueError(f"Video {video_id}: strimmed_s3_key not found (strim step incomplete?)")

            # Download strimmed file
            local_strimmed = os.path.join(TEMP_DIR, f"{video_id}_strimmed.mp4")
            await storage.download_file(video.strimmed_s3_key, local_strimmed)

            # TODO: Full B-roll logic:
            # 1. Transcribe audio (Whisper/Gemini)
            # 2. Extract keywords via GeminiKeywordExtractor
            # 3. Fetch B-roll clips from Pexels using search_query
            # 4. Overlay B-roll clips at specified timestamps using FFmpeg
            #
            # For now: pass-through (strimmed → broll output unchanged)
            broll_s3_key = f"pipeline/{video_id}/broll.mp4"
            await storage.upload_file(local_strimmed, broll_s3_key)

            # Update DB
            await repo.update_pipeline_status(
                video_id, "rendering_remotion",
                broll_s3_key=broll_s3_key
            )

            # Cleanup
            if os.path.exists(local_strimmed):
                os.remove(local_strimmed)

            logger.info("Pipeline: BROLL complete", video_id=video_id, broll_key=broll_s3_key)
            return video_id

        except Exception as e:
            await repo.mark_pipeline_failed(video_id, f"BROLL failed: {str(e)}")
            raise
        finally:
            await session.close()

    return _run_async(_execute())


# ── Task 4: Remotion Render (Text Highlight) ────────────────────────────────

@celery_app.task(name="pipeline.render_remotion", bind=True, max_retries=1)
def render_remotion_task(self, video_id: str) -> str:
    """
    Download B-roll file → render with Remotion (text overlays) → upload final → update DB to completed.
    """
    logger.info("Pipeline: Starting REMOTION step", video_id=video_id)

    async def _execute():
        repo, session = await _get_repo()
        storage = S3StorageService()
        _ensure_temp_dir()

        try:
            video = await repo.get_by_id(video_id)
            if not video or not video.broll_s3_key:
                raise ValueError(f"Video {video_id}: broll_s3_key not found (broll step incomplete?)")

            # Download broll file
            local_broll = os.path.join(TEMP_DIR, f"{video_id}_broll.mp4")
            await storage.download_file(video.broll_s3_key, local_broll)

            # TODO: Full Remotion render logic:
            # 1. Build Remotion props from video.render_config.text_overlays
            # 2. Call RemotionRenderer.render(video_id, layers)
            # 3. Upload rendered output to S3
            #
            # For now: pass-through (broll → final output unchanged)
            final_s3_key = f"pipeline/{video_id}/final.mp4"
            await storage.upload_file(local_broll, final_s3_key)

            # Update DB: mark pipeline as COMPLETED
            await repo.update_pipeline_status(
                video_id, "completed",
                final_s3_key=final_s3_key
            )

            # Cleanup
            if os.path.exists(local_broll):
                os.remove(local_broll)

            logger.info("Pipeline: REMOTION complete — PIPELINE DONE", video_id=video_id, final_key=final_s3_key)
            return video_id

        except Exception as e:
            await repo.mark_pipeline_failed(video_id, f"REMOTION failed: {str(e)}")
            raise
        finally:
            await session.close()

    return _run_async(_execute())


# ── Error Handler ────────────────────────────────────────────────────────────

@celery_app.task(name="pipeline.error_handler")
def pipeline_error_handler(request, exc, tb, video_id: str = None):
    """
    Global error callback cho Celery chain.
    Nếu bất kỳ task nào trong chain fail, task này sẽ được gọi
    để cập nhật DB status = FAILED + lưu error message.
    """
    error_msg = f"{exc.__class__.__name__}: {str(exc)}"
    logger.error(
        "Pipeline: CHAIN FAILED",
        video_id=video_id,
        task_id=request.id,
        error=error_msg,
    )

    if video_id:
        async def _mark_failed():
            repo, session = await _get_repo()
            try:
                await repo.mark_pipeline_failed(video_id, error_msg)
            finally:
                await session.close()

        _run_async(_mark_failed())
