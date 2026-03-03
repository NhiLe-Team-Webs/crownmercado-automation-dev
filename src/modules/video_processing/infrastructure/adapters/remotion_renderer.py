"""
Remotion Renderer Adapter
Implements IRenderEnginePort — gọi Remotion CLI để render video với text overlays.
"""

import asyncio
import json
import os
import structlog
from pathlib import Path
from uuid import UUID

from src.modules.video_processing.domain.ports import IRenderEnginePort
from src.modules.video_processing.domain.value_objects import TextOverlay

logger = structlog.get_logger()

# Đường dẫn tới thư mục Remotion (relative từ project root)
REMOTION_DIR = Path(__file__).parents[5] / "remotion"
COMPOSITION_ID = "VideoWithOverlays"


class RemotionRenderer(IRenderEnginePort):
    """
    Gọi Remotion CLI headless để render video với text overlays.
    Pass props qua JSON string để sync với TextOverlay[] từ Python.
    """

    def __init__(self, output_dir: str = "/tmp/rendered") -> None:
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    async def render(self, job_id: UUID, layers: list) -> str:
        """
        Render video với text overlays.
        - layers[0]: dict với keys 'video_src', 'duration_seconds', 'fps', 'overlays'
        Returns: output file path (str)
        """
        if not layers:
            raise ValueError("layers không được rỗng — cần ít nhất 1 layer config")

        config = layers[0]
        output_path = self.output_dir / f"{job_id}.mp4"

        # Serialize props sang JSON để truyền vào Remotion CLI
        props = {
            "videoSrc": config.get("video_src", ""),
            "durationInSeconds": config.get("duration_seconds", 30),
            "fps": config.get("fps", 30),
            "overlays": [
                self._overlay_to_dict(o)
                for o in config.get("overlays", [])
            ],
        }

        props_json = json.dumps(props, ensure_ascii=False)

        cmd = [
            "npx", "remotion", "render",
            str(REMOTION_DIR),
            COMPOSITION_ID,
            str(output_path),
            "--props", props_json,
            "--log", "error",
        ]

        logger.info(
            "Bắt đầu Remotion render",
            job_id=str(job_id),
            output=str(output_path),
            overlay_count=len(props["overlays"]),
        )

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=str(REMOTION_DIR),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()

        if proc.returncode != 0:
            error_msg = stderr.decode(errors="replace")
            logger.error("Remotion render thất bại", job_id=str(job_id), error=error_msg)
            raise RuntimeError(f"Remotion render failed: {error_msg}")

        logger.info("Remotion render thành công", job_id=str(job_id), output=str(output_path))
        return str(output_path)

    @staticmethod
    def _overlay_to_dict(overlay: TextOverlay | dict) -> dict:
        """Convert TextOverlay → plain dict tương thích với Remotion TypeScript types"""
        if isinstance(overlay, dict):
            return overlay
        return {
            "text": overlay.text,
            "start": overlay.start,
            "end": overlay.end,
            "mode": overlay.mode.value,
            "position": overlay.position.value,
        }
