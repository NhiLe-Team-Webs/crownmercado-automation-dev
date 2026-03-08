"""
Remotion Lambda Renderer Adapter
Implements IRenderEnginePort — gọi Remotion Lambda CLI để render video trên cloud.
"""

import asyncio
import json
import os
import tempfile
import structlog
from pathlib import Path
from uuid import UUID

from src.modules.video_processing.domain.ports import IRenderEnginePort
from src.modules.video_processing.domain.value_objects import TextOverlay
from src.shared.config.settings import settings

logger = structlog.get_logger()

# Đường dẫn tới thư mục Remotion (relative từ project root)
REMOTION_DIR = Path(__file__).parents[4] / "remotion"
COMPOSITION_ID = "VideoWithOverlays"

class RemotionLambdaRenderer(IRenderEnginePort):
    """
    Gọi Remotion CLI để offload rendering lên AWS Lambda.
    """

    def __init__(self, output_dir: str = "/tmp/rendered") -> None:
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    async def render(self, job_id: UUID, layers: list) -> str:
        """
        Gửi yêu cầu render lên AWS Lambda và tải file về output_dir khi hoàn tất.
        """
        if not layers:
            raise ValueError("layers không được rỗng")

        config = layers[0]
        output_path = self.output_dir / f"{job_id}.mp4"

        props = {
            "videoSrc": config.get("video_src", ""),
            "durationInSeconds": config.get("duration_seconds", 30),
            "fps": config.get("fps", 30),
            "overlays": [
                self._overlay_to_dict(o)
                for o in config.get("overlays", [])
            ],
        }

        # Write props to a temp file
        props_file = Path(tempfile.mktemp(suffix=".json"))
        props_file.write_text(json.dumps(props, ensure_ascii=False), encoding="utf-8")

        serve_url = settings.REMOTION_LAMBDA_SERVE_URL
        function_name = settings.REMOTION_LAMBDA_FUNCTION_NAME
        
        if not serve_url:
            raise ValueError("REMOTION_LAMBDA_SERVE_URL chưa được cấu hình! Vui lòng làm theo hướng dẫn deploy Site lên AWS.")

        cmd = [
            "npx", "remotion", "lambda", "render",
            serve_url,
            COMPOSITION_ID,
            str(output_path),
            "--props", str(props_file),
            "--function-name", function_name,
            "--log", "verbose",
            "--jpeg-quality", "80", 
        ]

        logger.info(
            "Bắt đầu AWS Lambda render (Cloud)",
            job_id=str(job_id),
            serve_url=serve_url,
            function=function_name
        )

        env = os.environ.copy()
        if settings.REMOTION_AWS_ACCESS_KEY_ID:
            env["AWS_ACCESS_KEY_ID"] = settings.REMOTION_AWS_ACCESS_KEY_ID
        if settings.REMOTION_AWS_SECRET_ACCESS_KEY:
            env["AWS_SECRET_ACCESS_KEY"] = settings.REMOTION_AWS_SECRET_ACCESS_KEY
        if settings.REMOTION_LAMBDA_REGION:
            env["AWS_REGION"] = settings.REMOTION_LAMBDA_REGION
            env["AWS_DEFAULT_REGION"] = settings.REMOTION_LAMBDA_REGION

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=str(REMOTION_DIR),
                env=env,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=3600)  # Cloud render is expected to be quick but give it an hour

            if proc.returncode != 0:
                error_msg = stderr.decode(errors="replace")
                stdout_msg = stdout.decode(errors="replace")
                logger.error("AWS Lambda render thất bại", job_id=str(job_id), error=error_msg, stdout=stdout_msg)
                raise RuntimeError(f"Remotion Lambda render failed: {error_msg}")

        except asyncio.TimeoutError:
            logger.error("AWS Lambda render timeout", job_id=str(job_id))
            raise RuntimeError(f"Remotion Lambda render timed out after 60 minutes for job {job_id}")
        finally:
            props_file.unlink(missing_ok=True)

        if not output_path.exists():
            raise RuntimeError(f"Lệnh thành công nhưng không tìm thấy file output ở {output_path}")

        logger.info("AWS Lambda render thành công", job_id=str(job_id), output=str(output_path))
        return str(output_path)

    @staticmethod
    def _overlay_to_dict(overlay: TextOverlay | dict) -> dict:
        if isinstance(overlay, dict):
            return overlay
        return {
            "text": overlay.text,
            "start": overlay.start,
            "end": overlay.end,
            "mode": overlay.mode.value,
            "position": overlay.position.value,
        }
