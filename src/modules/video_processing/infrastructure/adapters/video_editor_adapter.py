import subprocess
import os
import asyncio
from src.modules.video_processing.domain.ports import IVideoEditorPort
import structlog

logger = structlog.get_logger(__name__)

class AutoEditorAdapter(IVideoEditorPort):
    def __init__(self, temp_dir: str = "/tmp"):
        self.temp_dir = temp_dir
        if not os.path.exists(temp_dir):
            os.makedirs(temp_dir)

    async def remove_silence(self, input_path: str, output_path: str) -> str:
        """
        Calls auto-editor CLI to remove silent parts from the video.
        Command example: auto-editor input.mp4 --output output.mp4 --silent-threshold 0.03
        """
        logger.info("Starting silence removal", input_path=input_path, output_path=output_path)
        
        # Build the command
        # --silent-threshold: 0.03 is a common baseline (3%)
        # --margin: add 0.2s margin around cuts for better flow
        cmd = [
            "auto-editor",
            input_path,
            "--output", output_path,
            "--silent-threshold", "0.03",
            "--margin", "0.2sec",
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
