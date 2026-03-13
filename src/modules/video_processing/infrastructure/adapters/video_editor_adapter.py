import subprocess
import os
import asyncio
from typing import Optional
from src.modules.video_processing.domain.ports import IVideoEditorPort
from src.modules.video_processing.domain.value_objects import EditorConfig
import structlog

logger = structlog.get_logger(__name__)

class AutoEditorAdapter(IVideoEditorPort):
    def __init__(self, temp_dir: str = "/tmp"):
        self.temp_dir = temp_dir
        if not os.path.exists(temp_dir):
            os.makedirs(temp_dir)

    async def remove_silence(
        self, 
        input_path: str, 
        output_path: str, 
        config: Optional[EditorConfig] = None
    ) -> str:
        """
        Calls auto-editor CLI to remove silent parts from the video.
        Command example: auto-editor input.mp4 --output output.mp4 --silent-threshold 0.03
        """
        logger.info("Starting silence removal", input_path=input_path, output_path=output_path)
        
        # Build the command with advanced parameters
        threshold = str(config.silent_threshold) if config else "0.08"
        margin = config.margin if config else "0.1sec"
        min_cut = config.min_cut_length if config else "0.2sec"
        min_clip = config.min_clip_length if config else "0.2sec"

        cmd = [
            "auto-editor",
            input_path,
            "--output", output_path,
            "--silent-threshold", threshold,
            "--margin", margin,
            "--min-cut-length", min_cut,
            "--min-clip-length", min_clip,
            "--no-open"
        ]

        try:
            # Run the command asynchronously
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                error_msg = stderr.decode().strip()
                logger.error("auto-editor failed", returncode=process.returncode, error=error_msg)
                raise Exception(f"Auto-editor failed with return code {process.returncode}: {error_msg}")

            logger.info("Silence removal completed successfully", output_path=output_path)
            return output_path

        except Exception as e:
            logger.exception("Error during silence removal", error=str(e))
            raise
