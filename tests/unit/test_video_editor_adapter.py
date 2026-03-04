import pytest
from unittest.mock import MagicMock, patch
from src.modules.video_processing.infrastructure.adapters.video_editor_adapter import AutoEditorAdapter
import asyncio

@pytest.mark.asyncio
async def test_auto_editor_adapter_success():
    adapter = AutoEditorAdapter(temp_dir="/tmp/test")
    
    # Mock asyncio.create_subprocess_exec
    mock_process = MagicMock()
    mock_process.communicate.return_value = (b"output", b"error")
    mock_process.returncode = 0
    
    with patch("asyncio.create_subprocess_exec", return_value=mock_process) as mock_exec:
        result = await adapter.remove_silence("input.mp4", "output.mp4")
        
        assert result == "output.mp4"
        mock_exec.assert_called_once()
        args = mock_exec.call_args[0]
        assert "auto-editor" in args
        assert "input.mp4" in args
        assert "output.mp4" in args

@pytest.mark.asyncio
async def test_auto_editor_adapter_failure():
    adapter = AutoEditorAdapter(temp_dir="/tmp/test")
    
    mock_process = MagicMock()
    mock_process.communicate.return_value = (b"", b"Some error")
    mock_process.returncode = 1
    
    with patch("asyncio.create_subprocess_exec", return_value=mock_process):
        with pytest.raises(Exception) as excinfo:
            await adapter.remove_silence("input.mp4", "output.mp4")
        
        assert "Auto-editor failed" in str(excinfo.value)
