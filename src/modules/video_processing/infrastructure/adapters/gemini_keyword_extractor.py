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

SYSTEM_PROMPT = """You are a Senior AI Video Editor and Editorial Director specializing in high-end "talking head" content (think Ali Abdaal, GaryVee, or premium Masterclass style).
Your mission is to elevate the video transcript by identifying moments where visual overlays or B-Roll footage drastically improve the viewer's understanding, emotional engagement, or the overall "premium" feel.

PHILOSOPHY: QUALITY WITH BALANCED COVERAGE.
- Suggest B-roll for high-impact moments. Better to have fewer high-quality B-rolls than many generic ones.
- The speaker is the anchor. Keep the focus on the speaker unless the visual adds significant value.
- ENCOURAGED MOMENTS:
  * Iconic brand stories (e.g. Coca-Cola, Heinz) - MUST use B-roll for brand mentions
  * Visual comparisons (e.g. Old vs. New, Before/After)
  * Product demonstrations or interactions
  * Emotional/human moments (people, expressions, reactions)
  * Environmental/contextual shots (offices, nature, technology)
  * Metaphors representing concepts (for AI, innovation, etc.)
- SPECIAL BRAND TARGETING: If the transcript mentions "Coca-Cola", "Heinz", or "Create Real Magic", you MUST suggest a B_ROLL_VIDEO segment. This is top priority.
- TIMELINE DISTRIBUTION: For 4-6 minute videos, spread B-rolls evenly across timeline (~every 40-50 seconds). Avoid clustering multiple B-rolls within 20 seconds of each other (except iconic paired moments).
YOUR TASK:
Identify key moments in the video for:
1. "SIDE_PANEL": Very short topic titles (1-4 words). Position: 'left'. Concise & minimal.
2. "CINEMATIC_CALLOUT": 1-3 words max. Massive impact. Position: 'left' or 'right'.
3. "BOTTOM_TITLE": 2-5 words. Horizontal summary at the bottom.
4. "B_ROLL_VIDEO": Fullscreen stock video. Use for high-impact brand mentions, technical demos, or visual metaphors. Duration: 5-10s.

B-ROLL SELECTION RULES (STRICT):
- DISCOURAGED MOMENTS: Generic statements like "business is hard" or "we work together". Use text overlays for these instead.
- ABSTRACT CONCEPTS: If the moment involves abstract concepts (e.g., "Emotional Storytelling", "Trust", "Innovation"), PREFER literal, cinematic visual metaphors but allow metaphor queries if they're specific enough (must include concrete sensory details):
  * Example for "Emotional Storytelling": "Cinematic close up of person crying with joy", "Mother hugging child warm light", "Heartfelt reunion at airport"
  * Can also search: "emotional storytelling cinematic human moment" (if specific enough with adjectives)
  * Avoid: "innovation", "trust", "future" alone - always add scene/action/mood descriptors
  * Example for "Innovation": "engineer hand interacting with holographic interface dark room neon sci-fi" or "person typing rapidly modern tech startup office"
- For a 4-6 minute video, target 6-8 high-quality B-rolls if relevant moments exist.
- RELEVANCE: Visual must match the "visual_intent" and "spoken_context" perfectly.
- INTENT: Define the "visual_intent" (e.g., 'red soda can close up', 'vintage glass bottle', 'digital art generation').
- CAVEATS: Define "must_have" (e.g., 'natural lighting', 'diverse team') and "must_not_have" (e.g., 'cheesy smiles', 'white background stock').
- QUERY STRATEGY: **CRITICAL** - ALL query_candidates MUST be cinematically specific. Each query must describe what a camera would literally capture:
  * COMPONENT STRUCTURE: [Subject] + [Action] + [Environment] + [Visual Style]
  * BAD ❌: "business success", "innovation", "teamwork"
  * GOOD ✅: "confident entrepreneur presenting strategy in modern glass office with natural lighting cinematic professional"
  * GOOD ✅: "engineer hand interacting with futuristic blue holographic interface dark room neon lighting sci-fi"
  * GOOD ✅: "close up person crying tears of joy warm golden lighting emotional intimate"
  * GOOD ✅: "diverse team collaborating at table modern office bright natural light professional documentary style"
  * Provide 4-6 English query candidates ranging from literal (exact visual description) to action-oriented to thematic/symbolic.
  * Every query MUST include concrete sensory details: lighting, subject action, location, mood.

TEXT OVERLAY DENSITY TARGET:
- For a 4-6 minute video, target 18-26 total segments (increased from 14-24 to accommodate more B-rolls)
- Composition: 6-8 B-rolls + 10-18 text overlays (SIDE_PANEL, CINEMATIC_CALLOUT, BOTTOM_TITLE)
- Distribution: Balance B-roll and text for visual rhythm (e.g., text moment → B-roll moment → text moment)
- Text overlay roles: SIDE_PANEL (short topic, 1-4 words), CINEMATIC_CALLOUT (impact, 1-3 words), BOTTOM_TITLE (lists/summaries, 2-5 words)

JSON SCHEMA (Return ONLY a valid JSON array):
[
  {
    "text": "string (Display text. 1-4 words max for ALL modes.)",
    "start": number,
    "end": number,
    "mode": "SIDE_PANEL" | "CINEMATIC_CALLOUT" | "BOTTOM_TITLE" | "B_ROLL_VIDEO",
    "position": "left" | "right" | "bottom_center",
    "reason": "string",
    "spoken_context": "string",
    "visual_intent": "string",
    "must_have": ["string1", "string2"],
    "must_not_have": ["string1"],
    "query_candidates": ["query1", "query2"],
    "anchor_subject": "person" | "object" | "scene" | "none",
    "relevance_confidence": number (float 0.0 to 1.0),
    "fallback_visual": "symbolic_clip" | "branded_text_scene" | "speaker_zoom" | "side_visual_card",
    "highlight_word": "string (optional)"
  }
]

CONSTRAINTS:
- No Overlaps: B-roll and Text Overlays MUST be mutually exclusive.
- Spacing: Min 1.2s gap between any two segments.
- B-roll Duration: 5-10 seconds.
- Formatting: Return ONLY the JSON array. No preamble."""

USER_PROMPT_TEMPLATE = """Video transcript:
\"\"\"
{full_text}
\"\"\"

Word-level timestamps:
{words_json}

Analyze this transcript and return the text overlay callouts as JSON."""

# ── Constants ─────────────────────────────────────────────────────────────────

MAX_RETRIES = 2
MIN_GAP_SECONDS = 1.2
GEMINI_MODEL = "gemini-2.5-flash"


# ── Adapter ───────────────────────────────────────────────────────────────────

class GeminiKeywordExtractor(IKeywordExtractorPort):
    """
    Gọi Gemini Flash để extract keyword từ transcript.
    Validate JSON output với Pydantic, retry nếu parse lỗi.
    Enforce min-gap 1.2s giữa các overlay.
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
                logger.info("Raw Gemini response received", length=len(raw))
                # Log a snippet of the raw response for debugging
                logger.debug("Raw response snippet", raw=raw[:500])
                
                overlays = self._parse_and_validate(raw, transcript)
                overlays = self._enforce_min_gap(overlays)
                overlays = self._balance_overlay_types(overlays)
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
                def safe_float(val: Any, default: float = 0.0) -> float:
                    if val is None: return default
                    try:
                        # Extract first number from string if needed (e.g. "0.8 (high)" -> 0.8)
                        if isinstance(val, str):
                            import re
                            match = re.search(r"[-+]?\d*\.\d+|\d+", val)
                            if match:
                                return float(match.group())
                        return float(val)
                    except:
                        return default

                # Snap to word algorithm
                llm_start = safe_float(item.get("start"), 0.0)
                # Tim word gan start nhat (sai so < 2s)
                snapped_start = llm_start
                min_diff = 2.0
                for w in transcript.words:
                    diff = abs(w.start - llm_start)
                    if diff < min_diff:
                        min_diff = diff
                        snapped_start = w.start
                
                start_time = snapped_start
                end_time = safe_float(item.get("end"), start_time + 5.0)
                
                # Dam bao thoi gian B-Roll theo luat
                mode_str = item.get("mode", "CINEMATIC_CALLOUT")
                if mode_str == "B_ROLL_VIDEO":
                    end_time = max(start_time + 5.0, min(start_time + 10.0, end_time))
                else:
                    # Keep short text callouts readable: minimum visible time is 4 seconds.
                    end_time = max(end_time, start_time + 4.0)

                position_raw = item.get("position", "bottom_left")
                if mode_str == "B_ROLL_VIDEO" and position_raw not in {"left", "right", "bottom_center"}:
                    # Gemini sometimes emits "none" for B-roll. Default to left so the item is still usable.
                    position_raw = "left"

                overlay = TextOverlay(
                    text=str(item.get("text", "")),
                    start=start_time,
                    end=end_time,
                    mode=TextOverlayMode(mode_str),
                    position=TextOverlayPosition(position_raw),
                    reason=item.get("reason"),
                    search_query=item.get("search_query"), 
                    highlight_word=item.get("highlight_word"),
                    visual_intent=item.get("visual_intent"),
                    spoken_context=item.get("spoken_context"),
                    must_have=item.get("must_have") if isinstance(item.get("must_have"), list) else [],
                    must_not_have=item.get("must_not_have") if isinstance(item.get("must_not_have"), list) else [],
                    query_candidates=item.get("query_candidates") if isinstance(item.get("query_candidates"), list) else [],
                    anchor_subject=item.get("anchor_subject"),
                    relevance_confidence=safe_float(item.get("relevance_confidence"), 1.0),
                    fallback_visual=item.get("fallback_visual"),
                )
                overlays.append(overlay)
            except Exception as exc:
                logger.warning("Skipping invalid overlay", item=item, error=str(exc))

        return overlays

    def _enforce_min_gap(self, overlays: list[TextOverlay]) -> list[TextOverlay]:
        """
        Loại bỏ overlay vi phạm min-gap 1.2s.
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

    def _balance_overlay_types(self, overlays: list[TextOverlay]) -> list[TextOverlay]:
        """
        Cân bằng distribution của SIDE_PANEL, CINEMATIC_CALLOUT, BOTTOM_TITLE.
        Ngăn chặn 3+ SIDE_PANEL liên tiếp bằng cách chuyển đổi sang các loại khác.
        """
        if len(overlays) < 3:
            return overlays

        result = []
        consecutive_side_panel = 0

        for idx, overlay in enumerate(overlays):
            if overlay.mode == TextOverlayMode.SIDE_PANEL:
                consecutive_side_panel += 1
                
                # Nếu đã có 3 SIDE_PANEL liên tiếp, chuyển cái này thành CINEMATIC_CALLOUT
                if consecutive_side_panel >= 3:
                    logger.debug(
                        "Converting SIDE_PANEL to CINEMATIC_CALLOUT to balance overlay types",
                        text=overlay.text,
                        position=overlay.position,
                    )
                    # Tạo overlay mới với mode khác
                    converted = TextOverlay(
                        text=overlay.text,
                        start=overlay.start,
                        end=overlay.end,
                        mode=TextOverlayMode.CINEMATIC_CALLOUT,
                        position=TextOverlayPosition.LEFT if overlay.position == TextOverlayPosition.RIGHT else TextOverlayPosition.RIGHT,
                        reason=overlay.reason,
                        search_query=overlay.search_query,
                        highlight_word=overlay.highlight_word,
                        visual_intent=overlay.visual_intent,
                        spoken_context=overlay.spoken_context,
                        must_have=overlay.must_have,
                        must_not_have=overlay.must_not_have,
                        query_candidates=overlay.query_candidates,
                        anchor_subject=overlay.anchor_subject,
                        relevance_confidence=overlay.relevance_confidence,
                        fallback_visual=overlay.fallback_visual,
                    )
                    result.append(converted)
                    consecutive_side_panel = 0  # Reset counter
                else:
                    result.append(overlay)
            else:
                result.append(overlay)
                consecutive_side_panel = 0  # Reset counter khi gặp loại khác

        return result
