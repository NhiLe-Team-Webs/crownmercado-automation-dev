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
Your task:
Select 15–30 key moments in the video that deserve a visual callout or a B-Roll video insertion. These should be:
- High-impact moments: surprising facts, strong claims, key takeaways, emotional peaks
- Natural pauses or topic shifts where a visual anchor or B-Roll helps the viewer
- NOT every important word — only ones that add value when shown visually

For each callout, choose ONE of four display modes:
1. "SIDE_PANEL": Very short topic titles (1-4 words MAXIMUM). Position: 'left'. MUST be extremely concise.
2. "CINEMATIC_CALLOUT": 1-3 words MAXIMUM. Massive impact. Position: 'left' or 'right'. Use for punchy numbers, shocking facts. MUST be extremely short.
3. "BOTTOM_TITLE": 2-5 words MAXIMUM. Large horizontal text placed at the bottom. Position: 'bottom_center'. Summarize core arguments briefly.
4. "B_ROLL_VIDEO": Fullscreen stock video covering the speaker. Use when the speaker mentions vivid imagery (e.g., "office", "working computer", "nature", "crowd", "technology", "abstract data"). Do NOT use text. You MUST provide a "search_query" in English (1-3 words) to search for stock video. Duration must be between 5.0 and 10.0 seconds.

Distribution & Overlap rules (CRITICAL):
- YOU MUST INCLUDE AT LEAST 5 TO 7 'B_ROLL_VIDEO' elements in your output.
- B-Roll videos MUST be spread across the ENTIRE duration of the video (e.g., beginning, middle, end). Do NOT group them all in one section.
- DISTRIBUTE EVENLY: Spread your chosen Text Overlays and B-Rolls evenly throughout the entire video to keep the viewer constantly engaged. Do not cluster them all together.
- NO OVERLAP (MUTUALLY EXCLUSIVE): A B-Roll video and a Text Overlay must NEVER happen at the same time. If a segment has B_ROLL_VIDEO, it cannot have any text overlay.
- MIX THEM UP: Alternate between Text Overlays and B-Roll videos to provide visual variety.

Positioning rules:
- For CINEMATIC_CALLOUT, you MUST ONLY use 'left' or 'right' position. Alternate between 'left' and 'right' for consecutive callouts to balance the visual space framing the speaker's face. DO NOT use bottom_center, bottom_left, or bottom_right.
- For SIDE_PANEL, always use "left" position.
- Never place two overlays within 5 seconds of each other.

Video type detection — adapt your selection based on content:
- Educational/Tutorial → favor concept names, step labels, statistics
- Marketing/Sales → favor benefit statements, pain points, CTAs
- Interview/Podcast → favor surprising quotes, opinion shifts, key claims
- Motivational/Storytelling → favor emotional peaks, turning points, power words
- Product demo → favor feature names, comparison words, outcome phrases

Return ONLY a valid JSON array, no explanation, no markdown. Schema:
[
  {
    "text": "string (what to display. For B_ROLL_VIDEO, it MUST be a punchy 5-10 word statement. MUST USE SENTENCE CASE (e.g. 'This is a test'). Do not use all caps. For OTHER modes, you MUST summarize into EXTREMELY SHORT phrases (1-4 words max). Do not copy long sentences verbatim.)",
    "start": number (seconds, align to the exact word that triggers display),
    "end": number (seconds, typically start + MINIMUM 5.0 seconds. It MUST be at least 5 seconds long),
    "mode": "SIDE_PANEL" | "CINEMATIC_CALLOUT" | "BOTTOM_TITLE" | "B_ROLL_VIDEO",
    "position": "left" | "right" | "bottom_center",
    "search_query": "string (English keyword for searching Pexels, e.g. 'businessman typing'. ONLY set if mode is B_ROLL_VIDEO)",
    "highlight_word": "string (A single impactful word contained within 'text' that should be highlighted. ONLY set if mode is B_ROLL_VIDEO)",
    "reason": "one sentence why this moment deserves a callout or b-roll"
  }
]

Constraints:
- Max 30 callouts per video
- Min gap between end of one and start of next: 3.0 seconds
- Duration of each callout MUST be at least 5.0 seconds. Ensure `end - start >= 5.0`
- text max words: SIDE_PANEL <= 4 words, CINEMATIC_CALLOUT <= 3 words, BOTTOM_TITLE <= 5 words. Do NOT exceed these word limits.
- Only use key words/phrases that actually appear near that timestamp in the transcript. Summarize heavily if needed.
- For CINEMATIC_CALLOUT, STRICTLY alternate positions (left, right, left, right).
- For B_ROLL_VIDEO, duration must be 5-10 seconds. Provide a highly descriptive English 'search_query'.
- Do NOT output anything outside the JSON array."""

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
GEMINI_MODEL = "gemini-2.5-flash"


# ── Adapter ───────────────────────────────────────────────────────────────────

class GeminiKeywordExtractor(IKeywordExtractorPort):
    """
    Gọi Gemini Flash để extract keyword từ transcript.
    Validate JSON output với Pydantic, retry nếu parse lỗi.
    Enforce min-gap 3s giữa các overlay.
    """

    def __init__(self, api_keys: list[str] | None = None) -> None:
        if api_keys:
            self.api_keys = api_keys
        else:
            keys_str = os.environ.get("GEMINI_API_KEYS", os.environ.get("GEMINI_API_KEY", ""))
            self.api_keys = [k.strip() for k in keys_str.split(",") if k.strip()]
            
        if not self.api_keys:
            raise ValueError("GEMINI_API_KEYS chưa được set trong environment")
        
        # Initialize default client with the first key
        self._keys_index = 0
        self._client = genai.Client(api_key=self.api_keys[0])

    async def extract(self, transcript: Transcript) -> list[TextOverlay]:
        """Phân tích transcript → TextOverlay[] với word-level sync"""
        if not transcript.full_text.strip():
            logger.warning("Empty transcript, skipping keyword extraction")
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
                logger.info("Calling Gemini keyword extraction", attempt=attempt)
                raw = await asyncio.to_thread(
                    self._call_gemini, user_prompt
                )
                overlays = self._parse_and_validate(raw, transcript)
                overlays = self._enforce_min_gap(overlays)
                logger.info(
                    "Keyword extraction successful",
                    count=len(overlays),
                )
                return overlays

            except (json.JSONDecodeError, ValueError) as exc:
                logger.warning(
                    "Parse error, retrying",
                    attempt=attempt,
                    error=str(exc),
                )
                if attempt > MAX_RETRIES:
                    logger.error("Keyword extraction failed after all retries")
                    return []

        return []

    # ── Private ───────────────────────────────────────────────────────────────

    def _call_gemini(self, user_prompt: str) -> str:
        """Gọi Gemini API (có cơ chế xoay trần API keys nếu dính lỗi Quota 429/503)"""
        attempts = 0
        max_attempts = len(self.api_keys)
        
        while attempts < max_attempts:
            try:
                response = self._client.models.generate_content(
                    model=GEMINI_MODEL,
                    contents=user_prompt,
                    config=genai_types.GenerateContentConfig(
                        system_instruction=SYSTEM_PROMPT,
                        temperature=0.3,
                    ),
                )
                return response.text
            except Exception as e:
                error_msg = str(e).lower()
                if "429" in error_msg or "503" in error_msg or "quota" in error_msg or "exhausted" in error_msg:
                    logger.warning(f"Key {self.api_keys[self._keys_index][:10]}... gặp lỗi {e}. Đang xoay vòng Key mới.")
                    self._keys_index = (self._keys_index + 1) % len(self.api_keys)
                    self._client = genai.Client(api_key=self.api_keys[self._keys_index])
                    attempts += 1
                else:
                    raise e
                    
        raise Exception("Toàn bộ Gemini API Keys đều đã cạn kiệt Quota hoặc gặp lỗi kết nối.")

    def _parse_and_validate(self, raw: str, transcript: Transcript) -> list[TextOverlay]:
        """Parse JSON response → list[TextOverlay] với Pydantic validation và Snap-to-word"""
        # Xóa markdown code fences nếu model trả về
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines = cleaned.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()

        data: list[dict[str, Any]] = json.loads(cleaned)
        if not isinstance(data, list):
            raise ValueError(f"Expected JSON array, got {type(data)}")

        overlays: list[TextOverlay] = []
        for item in data:
            try:
                # Snap to word algorithm
                llm_start = float(item["start"])
                # Tim word gan start nhat (sai so < 2s)
                snapped_start = llm_start
                min_diff = 2.0
                for w in transcript.words:
                    diff = abs(w.start - llm_start)
                    if diff < min_diff:
                        min_diff = diff
                        snapped_start = w.start
                
                start_time = snapped_start
                end_time = float(item["end"])
                
                # Dam bao thoi gian B-Roll theo luat
                mode_str = item.get("mode", "CINEMATIC_CALLOUT")
                if mode_str == "B_ROLL_VIDEO":
                    end_time = max(start_time + 5.0, min(start_time + 10.0, end_time))

                overlay = TextOverlay(
                    text=item.get("text", ""),
                    start=start_time,
                    end=end_time,
                    mode=TextOverlayMode(mode_str),
                    position=TextOverlayPosition(
                        item.get("position", "bottom_left")
                    ),
                    reason=item.get("reason"),
                    search_query=item.get("search_query"),
                    highlight_word=item.get("highlight_word"),
                )
                overlays.append(overlay)
            except Exception as exc:
                logger.warning("Skipping invalid overlay", item=item, error=str(exc))

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
                    "Dropping overlay due to min-gap violation",
                    text=overlay.text,
                    start=overlay.start,
                )

        return result
