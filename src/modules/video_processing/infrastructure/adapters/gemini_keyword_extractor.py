"""
Gemini Flash Keyword Extractor
Implements IKeywordExtractorPort — phân tích transcript và trả về TextOverlay[]
"""

import json
import os
import asyncio
import structlog
from typing import Any

from google import genai
from google.genai import types as genai_types

from src.modules.video_processing.domain.ports import IKeywordExtractorPort
from src.modules.video_processing.domain.value_objects import (
    Transcript,
    TextOverlay,
    TextOverlayMode,
    TextOverlayPosition,
)

logger = structlog.get_logger()

# ── Prompt ────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a professional video editor and content strategist specializing in YouTube and social media video production.
Your job is to analyze a video transcript and identify the most impactful keywords and phrases to display as visual text overlays — similar to what top educational and marketing YouTube channels use.

You will receive:
- full_text: the complete spoken transcript
- words: an array of word-level segments with start/end timestamps (seconds)

Your task:
Select 4–10 key moments in the video that deserve a visual callout. These should be:
- High-impact moments: surprising facts, strong claims, key takeaways, emotional peaks
- Natural pauses or topic shifts where a visual anchor helps the viewer
- NOT every important word — only ones that add value when shown visually

For each callout, choose ONE of two display modes:
- SIDE_PANEL: Use for section headers or multi-word topic titles (3–6 words). The text appears on a clean panel beside the speaker. Best for: introducing a new concept, transitioning to a new section, named frameworks or models.
- CINEMATIC_CALLOUT: Use for single impactful words or very short phrases (1–3 words). The text overlays directly on the video, large and bold. Best for: power words, statistics, emotional hooks, action words.

Positioning rules:
- Avoid bottom_center unless text is very short (1–2 words)
- For SIDE_PANEL, always use "left" position
- Alternate positions across consecutive callouts to avoid visual fatigue
- Never place two overlays within 3 seconds of each other

Video type detection — adapt your selection based on content:
- Educational/Tutorial → favor concept names, step labels, statistics
- Marketing/Sales → favor benefit statements, pain points, CTAs
- Interview/Podcast → favor surprising quotes, opinion shifts, key claims
- Motivational/Storytelling → favor emotional peaks, turning points, power words
- Product demo → favor feature names, comparison words, outcome phrases

Return ONLY a valid JSON array, no explanation, no markdown. Schema:
[
  {
    "text": "string (what to display, concise)",
    "start": number (seconds, align to the word that triggers display),
    "end": number (seconds, typically start + 2.5 to 4.0),
    "mode": "SIDE_PANEL" or "CINEMATIC_CALLOUT",
    "position": "left" or "right" or "bottom_left" or "bottom_right" or "bottom_center",
    "reason": "one sentence why this moment deserves a callout"
  }
]

Constraints:
- Max 10 callouts per video
- Min gap between end of one and start of next: 3.0 seconds
- text max length: SIDE_PANEL <= 40 chars, CINEMATIC_CALLOUT <= 20 chars
- Only use words/phrases that actually appear near that timestamp in the transcript
- Do NOT output anything outside the JSON array"""

USER_PROMPT_TEMPLATE = """Video transcript:
\"\"\"
{full_text}
\"\"\"

Word-level timestamps:
{words_json}

Analyze this transcript and return the text overlay callouts as JSON."""

# ── Constants ─────────────────────────────────────────────────────────────────

MAX_RETRIES = 2
MIN_GAP_SECONDS = 3.0
GEMINI_MODEL = "gemini-1.5-flash"


# ── Adapter ───────────────────────────────────────────────────────────────────

class GeminiKeywordExtractor(IKeywordExtractorPort):
    """
    Gọi Gemini Flash để extract keyword từ transcript.
    Validate JSON output với Pydantic, retry nếu parse lỗi.
    Enforce min-gap 3s giữa các overlay.
    """

    def __init__(self, api_key: str | None = None) -> None:
        key = api_key or os.environ.get("GEMINI_API_KEY")
        if not key:
            raise ValueError("GEMINI_API_KEY chưa được set trong environment")
        self._client = genai.Client(api_key=key)

    async def extract(self, transcript: Transcript) -> list[TextOverlay]:
        """Phân tích transcript → TextOverlay[] với word-level sync"""
        if not transcript.full_text.strip():
            logger.warning("transcript rỗng, bỏ qua keyword extraction")
            return []

        words_json = json.dumps(
            [w.model_dump() for w in transcript.words], ensure_ascii=False
        )
        user_prompt = USER_PROMPT_TEMPLATE.format(
            full_text=transcript.full_text,
            words_json=words_json,
        )

        for attempt in range(1, MAX_RETRIES + 2):
            try:
                logger.info("Gọi Gemini keyword extraction", attempt=attempt)
                raw = await asyncio.to_thread(
                    self._call_gemini, user_prompt
                )
                overlays = self._parse_and_validate(raw)
                overlays = self._enforce_min_gap(overlays)
                logger.info(
                    "Keyword extraction thành công",
                    count=len(overlays),
                )
                return overlays

            except (json.JSONDecodeError, ValueError) as exc:
                logger.warning(
                    "Parse lỗi, retry",
                    attempt=attempt,
                    error=str(exc),
                )
                if attempt > MAX_RETRIES:
                    logger.error("Keyword extraction thất bại sau tất cả retry")
                    return []

        return []

    # ── Private ───────────────────────────────────────────────────────────────

    def _call_gemini(self, user_prompt: str) -> str:
        """Gọi Gemini API (synchronous, chạy trong thread)"""
        response = self._client.models.generate_content(
            model=GEMINI_MODEL,
            contents=user_prompt,
            config=genai_types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.3,
            ),
        )
        return response.text

    def _parse_and_validate(self, raw: str) -> list[TextOverlay]:
        """Parse JSON response → list[TextOverlay] với Pydantic validation"""
        # Xóa markdown code fences nếu model trả về
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines = cleaned.splitlines()
            cleaned = "\n".join(lines[1:-1])

        data: list[dict[str, Any]] = json.loads(cleaned)
        if not isinstance(data, list):
            raise ValueError(f"Expected JSON array, got {type(data)}")

        overlays: list[TextOverlay] = []
        for item in data:
            try:
                overlay = TextOverlay(
                    text=item["text"],
                    start=float(item["start"]),
                    end=float(item["end"]),
                    mode=TextOverlayMode(item["mode"]),
                    position=TextOverlayPosition(
                        item.get("position", "bottom_left")
                    ),
                    reason=item.get("reason"),
                )
                overlays.append(overlay)
            except Exception as exc:
                logger.warning("Bỏ qua overlay không hợp lệ", item=item, error=str(exc))

        return overlays

    def _enforce_min_gap(self, overlays: list[TextOverlay]) -> list[TextOverlay]:
        """
        Loại bỏ overlay vi phạm min-gap 3s.
        Giữ overlay đầu tiên của mỗi nhóm overlap.
        """
        if not overlays:
            return []

        sorted_overlays = sorted(overlays, key=lambda o: o.start)
        result: list[TextOverlay] = [sorted_overlays[0]]

        for overlay in sorted_overlays[1:]:
            last = result[-1]
            if overlay.start >= last.end + MIN_GAP_SECONDS:
                result.append(overlay)
            else:
                logger.debug(
                    "Bỏ overlay do vi phạm min-gap",
                    text=overlay.text,
                    start=overlay.start,
                )

        return result
