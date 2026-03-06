"""
Unit tests cho TextOverlay value objects và GeminiKeywordExtractor
"""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.modules.video_processing.domain.value_objects import (
    TextOverlay,
    TextOverlayMode,
    TextOverlayPosition,
    RenderConfig,
    Transcript,
    WordSegment,
)


# ── TextOverlay validation ────────────────────────────────────────────────────

class TestTextOverlay:
    def test_valid_cinematic_overlay(self):
        overlay = TextOverlay(
            text="laser focused",
            start=5.0,
            end=8.0,
            mode=TextOverlayMode.CINEMATIC_CALLOUT,
            position=TextOverlayPosition.BOTTOM_LEFT,
        )
        assert overlay.text == "LASER FOCUSED"  # uppercase enforced
        assert overlay.mode == TextOverlayMode.CINEMATIC_CALLOUT

    def test_valid_side_panel_overlay(self):
        overlay = TextOverlay(
            text="Strategy vs Tactics",
            start=1.0,
            end=4.5,
            mode=TextOverlayMode.SIDE_PANEL,
            position=TextOverlayPosition.LEFT,
        )
        assert overlay.text == "STRATEGY VS TACTICS"

    def test_text_cannot_be_empty(self):
        with pytest.raises(ValueError, match="text không được rỗng"):
            TextOverlay(
                text="   ",
                start=1.0,
                end=3.0,
                mode=TextOverlayMode.CINEMATIC_CALLOUT,
                position=TextOverlayPosition.BOTTOM_LEFT,
            )

    def test_end_must_be_after_start(self):
        with pytest.raises(ValueError, match="end phải lớn hơn start"):
            TextOverlay(
                text="test",
                start=5.0,
                end=3.0,  # end < start
                mode=TextOverlayMode.CINEMATIC_CALLOUT,
                position=TextOverlayPosition.BOTTOM_LEFT,
            )

    def test_end_equal_start_is_invalid(self):
        with pytest.raises(ValueError):
            TextOverlay(
                text="test",
                start=5.0,
                end=5.0,
                mode=TextOverlayMode.CINEMATIC_CALLOUT,
                position=TextOverlayPosition.BOTTOM_LEFT,
            )

    def test_default_position(self):
        overlay = TextOverlay(
            text="hello",
            start=1.0,
            end=3.0,
            mode=TextOverlayMode.CINEMATIC_CALLOUT,
        )
        assert overlay.position == TextOverlayPosition.BOTTOM_LEFT


class TestRenderConfig:
    def test_default_render_config_has_empty_overlays(self):
        config = RenderConfig()
        assert config.text_overlays == []
        assert config.resolution == "1920x1080"

    def test_render_config_accepts_overlays(self):
        overlay = TextOverlay(
            text="test overlay",
            start=1.0,
            end=3.0,
            mode=TextOverlayMode.CINEMATIC_CALLOUT,
            position=TextOverlayPosition.BOTTOM_LEFT,
        )
        config = RenderConfig(text_overlays=[overlay])
        assert len(config.text_overlays) == 1
        assert config.text_overlays[0].text == "TEST OVERLAY"


# ── GeminiKeywordExtractor mock test ─────────────────────────────────────────

class TestGeminiKeywordExtractor:
    """Test extractor với mock Gemini API — không cần API key thật"""

    def _make_transcript(self) -> Transcript:
        return Transcript(
            full_text="Strategy is the long-term plan. Tactics are the short-term actions.",
            words=[
                WordSegment(word="Strategy", start=0.5, end=1.0, confidence=0.99),
                WordSegment(word="is", start=1.0, end=1.2, confidence=0.98),
                WordSegment(word="long-term", start=1.5, end=2.0, confidence=0.97),
                WordSegment(word="Tactics", start=5.0, end=5.5, confidence=0.99),
                WordSegment(word="short-term", start=6.0, end=6.5, confidence=0.97),
            ],
        )

    def _make_mock_response(self) -> str:
        overlays = [
            {
                "text": "STRATEGY",
                "start": 0.5,
                "end": 3.5,
                "mode": "CINEMATIC_CALLOUT",
                "position": "bottom_left",
                "reason": "Opening power word sets topic",
            },
            {
                "text": "TACTICS",
                "start": 7.5,  # gap = 7.5 - 3.5 = 4.0s > min_gap 3.0s ✓
                "end": 10.5,
                "mode": "CINEMATIC_CALLOUT",
                "position": "bottom_right",
                "reason": "Contrast with strategy",
            },
        ]
        return json.dumps(overlays)

    @pytest.mark.asyncio
    async def test_extract_returns_valid_overlays(self):
        from src.modules.video_processing.infrastructure.adapters.gemini_keyword_extractor import (
            GeminiKeywordExtractor,
        )

        with patch(
            "src.modules.video_processing.infrastructure.adapters.gemini_keyword_extractor.genai.GenerativeModel"
        ) as mock_model_cls:
            mock_model = MagicMock()
            mock_model_cls.return_value = mock_model
            mock_model.generate_content.return_value = MagicMock(
                text=self._make_mock_response()
            )

            extractor = GeminiKeywordExtractor(api_keys=["test-key"])
            result = await extractor.extract(self._make_transcript())

        assert len(result) == 2
        assert result[0].text == "STRATEGY"
        assert result[0].mode == TextOverlayMode.CINEMATIC_CALLOUT
        assert result[1].text == "TACTICS"

    @pytest.mark.asyncio
    async def test_empty_transcript_returns_empty_list(self):
        from src.modules.video_processing.infrastructure.adapters.gemini_keyword_extractor import (
            GeminiKeywordExtractor,
        )

        with patch(
            "src.modules.video_processing.infrastructure.adapters.gemini_keyword_extractor.genai.GenerativeModel"
        ):
            extractor = GeminiKeywordExtractor(api_keys=["test-key"])
            result = await extractor.extract(Transcript(full_text="   "))

        assert result == []

    @pytest.mark.asyncio
    async def test_min_gap_enforcement(self):
        """Overlays quá gần nhau (< 3s gap) phải bị loại bỏ"""
        from src.modules.video_processing.infrastructure.adapters.gemini_keyword_extractor import (
            GeminiKeywordExtractor,
        )

        overlapping_response = json.dumps([
            {"text": "FIRST", "start": 1.0, "end": 3.0, "mode": "CINEMATIC_CALLOUT", "position": "bottom_left"},
            {"text": "TOO CLOSE", "start": 3.5, "end": 5.5, "mode": "CINEMATIC_CALLOUT", "position": "bottom_right"},  # gap = 0.5s < 3s
            {"text": "VALID", "start": 10.0, "end": 12.0, "mode": "CINEMATIC_CALLOUT", "position": "bottom_left"},
        ])

        with patch(
            "src.modules.video_processing.infrastructure.adapters.gemini_keyword_extractor.genai.GenerativeModel"
        ) as mock_model_cls:
            mock_model = MagicMock()
            mock_model_cls.return_value = mock_model
            mock_model.generate_content.return_value = MagicMock(text=overlapping_response)

            extractor = GeminiKeywordExtractor(api_keys=["test-key"])
            transcript = Transcript(
                full_text="First word. Too close. Valid word.",
                words=[
                    WordSegment(word="First", start=1.0, end=1.3, confidence=0.9),
                    WordSegment(word="Valid", start=10.0, end=10.3, confidence=0.9),
                ],
            )
            result = await extractor.extract(transcript)

        assert len(result) == 2  # "TOO CLOSE" bị loại
        assert result[0].text == "FIRST"
        assert result[1].text == "VALID"
