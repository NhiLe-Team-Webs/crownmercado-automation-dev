"""
Unified Video Pipeline Tasks
─────────────────────────────
Celery chain: merge → strim → broll_metadata → remotion_render
Mỗi task chạy độc lập trong worker, cập nhật DB pipeline_status sau mỗi step.
Nếu bất kỳ step nào fail → pipeline_error_handler cập nhật DB + lưu lý do lỗi.
"""

import os
import json
import asyncio
import subprocess
import traceback
import structlog

from uuid import UUID
from celery import chain

from src.worker.celery_app import celery_app
from src.shared.database.session import async_session_maker
from src.modules.video_upload.infrastructure.repositories import VideoRepository
from src.modules.video_processing.infrastructure.storage.s3_storage import S3StorageService
from src.modules.video_processing.infrastructure.adapters.video_editor_adapter import AutoEditorAdapter
from src.modules.video_processing.infrastructure.adapters.gemini_keyword_extractor import GeminiKeywordExtractor
from src.modules.video_processing.infrastructure.adapters.remotion_renderer import RemotionRenderer
from src.modules.video_processing.infrastructure.adapters.remotion_lambda_renderer import RemotionLambdaRenderer
from src.modules.video_processing.domain.value_objects import Transcript, WordSegment

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


from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from src.shared.config.settings import settings

async def _get_repo():
    """Create a fresh DB engine + session + repository scoped specifically to this celery task's event loop.
    Avoids asyncpg 'another operation is in progress' errors caused by sharing connection pools across loops."""
    engine = create_async_engine(settings.DATABASE_URL, future=True, pool_pre_ping=True)
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False, autoflush=False)
    session = session_maker()
    return VideoRepository(session), session, engine


def _get_video_duration(file_path: str) -> float:
    """Get video duration in seconds using ffprobe."""
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", file_path],
            capture_output=True, text=True, check=True
        )
        return float(result.stdout.strip())
    except Exception:
        return 30.0  # fallback


# ── Task 1: Merge Videos ────────────────────────────────────────────────────

@celery_app.task(name="pipeline.merge_videos", bind=True, max_retries=2)
def merge_videos_task(self, video_id: str) -> str:
    """
    Download all raw files from S3 → merge with FFmpeg concat demuxer → upload merged → update DB.
    Supports single file (pass-through) and multi-file (concat).
    Returns video_id for next task in chain.
    """
    logger.info("Pipeline: Starting MERGE step", video_id=video_id)

    async def _execute():
        repo, session, engine = await _get_repo()
        storage = S3StorageService()
        _ensure_temp_dir()

        try:
            await repo.update_pipeline_status(video_id, "merging")

            video = await repo.get_by_id(video_id)
            if not video:
                raise ValueError(f"Video {video_id} not found in DB")

            # Parse raw S3 keys — may be a JSON array (multi-file) or None (single file)
            raw_s3_keys = []
            if video.raw_s3_keys_json:
                raw_s3_keys = json.loads(video.raw_s3_keys_json)
            if not raw_s3_keys:
                # Fallback: single file mode
                raw_s3_keys = [video.s3_key]

            # Download all raw files
            local_files = []
            for i, s3_key in enumerate(raw_s3_keys):
                local_path = os.path.join(TEMP_DIR, f"{video_id}_raw_{i}.mp4")
                await storage.download_file(s3_key, local_path)
                local_files.append(local_path)
                logger.info("Downloaded raw file", index=i, s3_key=s3_key)

            merged_path = os.path.join(TEMP_DIR, f"{video_id}_merged.mp4")

            if len(local_files) == 1:
                # Single file — just rename, no FFmpeg needed
                os.rename(local_files[0], merged_path)
                logger.info("Single file — skipping FFmpeg merge")
            else:
                # Multi-file: create FFmpeg concat demuxer file
                concat_list_path = os.path.join(TEMP_DIR, f"{video_id}_concat.txt")
                with open(concat_list_path, "w") as f:
                    for lf in local_files:
                        f.write(f"file '{lf}'\n")

                # Run FFmpeg concat
                cmd = [
                    "ffmpeg", "-y", "-f", "concat", "-safe", "0",
                    "-i", concat_list_path,
                    "-c", "copy",  # Stream copy (fast, no re-encode)
                    "-movflags", "+faststart",
                    merged_path
                ]
                logger.info("Running FFmpeg merge", cmd=" ".join(cmd))
                proc = subprocess.run(cmd, capture_output=True, text=True)
                if proc.returncode != 0:
                    raise RuntimeError(f"FFmpeg merge failed: {proc.stderr}")

                # Cleanup concat list and raw files
                os.remove(concat_list_path)
                for lf in local_files:
                    if os.path.exists(lf):
                        os.remove(lf)

            # Upload merged result to S3
            merged_s3_key = f"pipeline/{video_id}/merged.mp4"
            await storage.upload_file(merged_path, merged_s3_key)

            # Update DB: mark merge complete
            await repo.update_pipeline_status(
                video_id, "strimming",
                merged_s3_key=merged_s3_key
            )

            # Cleanup local merged
            if os.path.exists(merged_path):
                os.remove(merged_path)

            logger.info("Pipeline: MERGE complete", video_id=video_id, merged_key=merged_s3_key)
            return video_id

        except Exception as e:
            await repo.mark_pipeline_failed(video_id, f"MERGE failed: {str(e)}")
            raise
        finally:
            await session.close()
            await engine.dispose()

    return _run_async(_execute())


# ── Task 2: Strimming (Silence Removal) ─────────────────────────────────────

@celery_app.task(name="pipeline.strim_video", bind=True, max_retries=2)
def strim_video_task(self, video_id: str) -> str:
    """
    Download merged file → run auto-editor silence removal → upload strimmed → update DB.
    """
    logger.info("Pipeline: Starting STRIM step", video_id=video_id)

    async def _execute():
        repo, session, engine = await _get_repo()
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
            await engine.dispose()

    return _run_async(_execute())


# ── Task 3: B-Roll Metadata Generation ──────────────────────────────────────

@celery_app.task(name="pipeline.insert_broll", bind=True, max_retries=2)
def insert_broll_task(self, video_id: str) -> str:
    """
    Download strimmed file → transcribe with AssemblyAI → extract keywords via Gemini →
    fetch B-Roll URLs from Pexels → save overlay metadata JSON to DB → update status.

    NOTE: This task does NOT burn B-Roll into the video with FFmpeg.
    It generates the metadata payload that Remotion will use to composite overlays.
    """
    logger.info("Pipeline: Starting BROLL METADATA step", video_id=video_id)

    async def _execute():
        repo, session, engine = await _get_repo()
        storage = S3StorageService()
        _ensure_temp_dir()

        try:
            video = await repo.get_by_id(video_id)
            if not video or not video.strimmed_s3_key:
                raise ValueError(f"Video {video_id}: strimmed_s3_key not found (strim step incomplete?)")

            # Download strimmed file for transcription
            local_strimmed = os.path.join(TEMP_DIR, f"{video_id}_strimmed.mp4")
            await storage.download_file(video.strimmed_s3_key, local_strimmed)

            # ── Step 1: Transcribe with AssemblyAI ───────────────────────────
            import assemblyai as aai
            aai.settings.api_key = os.environ.get("ASSEMBLYAI_API_KEY", "")

            logger.info("Transcribing video with AssemblyAI", video_id=video_id)
            transcriber = aai.Transcriber()
            aai_transcript = transcriber.transcribe(local_strimmed)

            if not aai_transcript or not aai_transcript.text:
                raise ValueError("AssemblyAI returned empty transcript")

            # Build domain Transcript object from AssemblyAI response
            word_segments = []
            if aai_transcript.words:
                for w in aai_transcript.words:
                    word_segments.append(WordSegment(
                        word=w.text,
                        start=w.start / 1000.0,  # ms → seconds
                        end=w.end / 1000.0,
                        confidence=w.confidence or 0.0,
                    ))

            transcript = Transcript(
                full_text=aai_transcript.text,
                words=word_segments,
            )

            # ── Step 2: Extract keywords & overlay metadata via Gemini ───────
            extractor = GeminiKeywordExtractor()
            overlays = await extractor.extract(transcript)
            logger.info("Gemini extracted overlays", count=len(overlays), video_id=video_id)

            # ── Step 3: Fetch B-Roll video URLs from Pexels ──────────────────
            pexels_api_key = os.environ.get("PEXELS_API_KEY", "")
            if pexels_api_key:
                import httpx
                async with httpx.AsyncClient() as client:
                    for overlay in overlays:
                        if overlay.mode.value == "B_ROLL_VIDEO" and overlay.search_query and not overlay.url:
                            try:
                                resp = await client.get(
                                    "https://api.pexels.com/videos/search",
                                    params={"query": overlay.search_query, "per_page": 1, "orientation": "landscape"},
                                    headers={"Authorization": pexels_api_key},
                                    timeout=10.0,
                                )
                                if resp.status_code == 200:
                                    data = resp.json()
                                    videos = data.get("videos", [])
                                    if videos:
                                        # Pick the best HD file
                                        files = videos[0].get("video_files", [])
                                        hd_files = [f for f in files if f.get("height", 0) >= 720]
                                        if hd_files:
                                            overlay.url = hd_files[0]["link"]
                                        elif files:
                                            overlay.url = files[0]["link"]
                                logger.info("Pexels fetched", query=overlay.search_query, url=overlay.url)
                            except Exception as e:
                                logger.warning("Pexels fetch failed", query=overlay.search_query, error=str(e))

            # ── Step 4: Save overlay metadata to DB as JSON ──────────────────
            overlays_data = [o.model_dump(mode="json") for o in overlays]
            overlays_json = json.dumps(overlays_data, ensure_ascii=False)

            # We don't need to upload a separate broll video file anymore.
            # The strimmed video stays as the base video for Remotion.
            # Pass strimmed_s3_key forward as the "broll_s3_key" for compatibility.
            await repo.update_pipeline_status(
                video_id, "rendering_remotion",
                broll_s3_key=video.strimmed_s3_key,  # Remotion uses the strimmed video as base
                overlays_json=overlays_json,
            )

            # Cleanup
            if os.path.exists(local_strimmed):
                os.remove(local_strimmed)

            logger.info("Pipeline: BROLL METADATA complete", video_id=video_id, overlay_count=len(overlays))
            return video_id

        except Exception as e:
            await repo.mark_pipeline_failed(video_id, f"BROLL failed: {str(e)}")
            raise
        finally:
            await session.close()
            await engine.dispose()

    return _run_async(_execute())


# ── Task 4: Remotion Render (Text Highlight + B-Roll Compositing) ────────────

@celery_app.task(name="pipeline.render_remotion", bind=True, max_retries=2)
def render_remotion_task(self, video_id: str) -> str:
    """
    Download strimmed/broll base video → render with Remotion using existing components
    (BRollOverlay.tsx, TextOverlayLayer.tsx, etc.) → upload final → cleanup intermediates → complete.

    CRITICAL: Uses existing Remotion architecture from docs/text-highlight-remotion.md.
    Does NOT write new animation logic — only generates the metadata JSON payload
    and passes it to RemotionRenderer.
    """
    logger.info("Pipeline: Starting REMOTION step", video_id=video_id)

    async def _execute():
        repo, session, engine = await _get_repo()
        storage = S3StorageService()
        _ensure_temp_dir()

        try:
            video = await repo.get_by_id(video_id)
            if not video or not video.broll_s3_key:
                raise ValueError(f"Video {video_id}: broll_s3_key not found (broll step incomplete?)")

            # Download base video (strimmed)
            local_base = os.path.join(TEMP_DIR, f"{video_id}_base.mp4")
            await storage.download_file(video.broll_s3_key, local_base)

            # Get video duration
            duration = _get_video_duration(local_base)

            # Parse overlay metadata from DB
            overlays_data = []
            if video.overlays_json:
                overlays_data = json.loads(video.overlays_json)

            # Copy the base video to Remotion's public folder so it can be accessed via staticFile()
            from pathlib import Path
            remotion_public = Path(__file__).parents[1] / "remotion" / "public"
            remotion_public.mkdir(parents=True, exist_ok=True)
            remotion_video_name = f"{video_id}_pipeline.mp4"
            remotion_video_path = remotion_public / remotion_video_name

            import shutil
            shutil.copy2(local_base, str(remotion_video_path))

            # Build the Remotion render config using selected renderer
            if settings.REMOTION_LAMBDA_SERVE_URL:
                renderer = RemotionLambdaRenderer(output_dir=TEMP_DIR)
                # MUST use S3 presigned URL for cloud render since it can't read local files
                # Use broll_s3_key if it exists, otherwise fallback to strimmed or merged
                base_s3_key = video.broll_s3_key or video.strimmed_s3_key or video.merged_s3_key
                video_src = await storage.generate_presigned_url(base_s3_key, expiration=3600)
                logger.info("Using RemotionLambdaRenderer (AWS Lambda) with presigned URL")
            else:
                renderer = RemotionRenderer(output_dir=TEMP_DIR)
                video_src = remotion_video_name
                logger.info("Using RemotionRenderer (Local Docker) with local file")

            render_config = {
                "video_src": video_src,  # Presigned URL (Lambda) OR local filename (Docker)

                "duration_seconds": duration,
                "fps": 30,
                "overlays": overlays_data,
            }

            # Render using the existing RemotionRenderer adapter
            # This calls `npx remotion render` with the composition + props
            rendered_path = await renderer.render(
                job_id=UUID(video_id),
                layers=[render_config],
            )

            # Upload final rendered video to S3
            final_s3_key = f"pipeline/{video_id}/final.mp4"
            await storage.upload_file(rendered_path, final_s3_key)

            # ── CLEANUP: Delete all intermediate files from S3 ───────────────
            # Only keep the final video in the library
            s3_keys_to_delete = []

            # Delete raw uploaded files
            if video.raw_s3_keys_json:
                raw_keys = json.loads(video.raw_s3_keys_json)
                s3_keys_to_delete.extend(raw_keys)

            # Delete intermediate pipeline files
            if video.merged_s3_key:
                s3_keys_to_delete.append(video.merged_s3_key)
            if video.strimmed_s3_key:
                s3_keys_to_delete.append(video.strimmed_s3_key)
            if video.broll_s3_key and video.broll_s3_key != video.strimmed_s3_key:
                s3_keys_to_delete.append(video.broll_s3_key)

            for key in s3_keys_to_delete:
                try:
                    await storage.delete_file(key)
                    logger.info("Deleted intermediate S3 file", key=key)
                except Exception as e:
                    logger.warning("Failed to delete S3 file", key=key, error=str(e))

            # Update DB: mark pipeline as COMPLETED, update s3_key to final
            await repo.update_pipeline_status(
                video_id, "completed",
                final_s3_key=final_s3_key,
                s3_key=final_s3_key,  # Update the main s3_key to point to final video
            )

            # Cleanup local temp files
            for f in [local_base, rendered_path]:
                if os.path.exists(f):
                    os.remove(f)
            # Remove remotion public copy
            if remotion_video_path.exists():
                remotion_video_path.unlink()

            logger.info("Pipeline: REMOTION complete — PIPELINE DONE", video_id=video_id, final_key=final_s3_key)
            return video_id

        except Exception as e:
            await repo.mark_pipeline_failed(video_id, f"REMOTION failed: {str(e)}")
            raise
        finally:
            await session.close()
            await engine.dispose()

    return _run_async(_execute())


# ── Task 5: Notifications ────────────────────────────────────────────────────

@celery_app.task(name="pipeline.send_notification", bind=True, max_retries=2)
def send_notification_task(self, video_id: str) -> str:
    """
    Tạo presigned URL cho video hoàn tất và gửi qua Telegram.
    """
    logger.info("Pipeline: Starting NOTIFICATION step", video_id=video_id)

    async def _execute():
        repo, session, engine = await _get_repo()
        storage = S3StorageService()
        
        try:
            video = await repo.get_by_id(video_id)
            if not video or not video.s3_key:
                raise ValueError(f"Video {video_id} not found or no final s3_key")
            
            from src.modules.notifications.infrastructure.adapters.telegram_adapter import TelegramAdapter
            notifier = TelegramAdapter()

            if notifier.bot_token and notifier.chat_id:
                # Tạo presigned url 24h
                url = await storage.generate_presigned_url(video.s3_key, expiration=86400)
                file_name = video.original_filename or "Video_Rendered.mp4"
                await notifier.send_video_link(video_id, file_name, url)
                logger.info("Gửi Telegram thành công", video_id=video_id)
            else:
                logger.info("Bỏ qua thông báo Telegram (chưa cấu hình)")

            return video_id
        except Exception as e:
            logger.error("Send notification failed", error=str(e), video_id=video_id)
            # Notification error doesn't fail the pipeline (already marked completed)
            return video_id
        finally:
            await session.close()
            await engine.dispose()

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
            repo, session, engine = await _get_repo()
            try:
                await repo.mark_pipeline_failed(video_id, error_msg)
            finally:
                await session.close()
                await engine.dispose()

        _run_async(_mark_failed())
