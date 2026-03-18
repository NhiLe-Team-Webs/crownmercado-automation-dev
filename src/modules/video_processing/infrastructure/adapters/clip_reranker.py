"""
LLM-based re-ranking for B-roll clip selection.

Evaluates top 3 candidate clips using Gemini to pick the best match
based on emotional tone, visual intent, and overall narrative fit.
"""

import asyncio
import json
import os
import structlog
from typing import Optional, Tuple
from google import genai
from google.genai import types as genai_types
from src.modules.video_processing.domain.value_objects import TextOverlay

logger = structlog.get_logger()

RERANK_SYSTEM_PROMPT = """You are a professional film/video editor evaluating B-roll clips for a premium video narrative.

Your task is to evaluate 3 candidate video clips from Pexels and pick the BEST one that:
1. Matches the emotional tone described in spoken_context
2. Aligns with the visual_intent (what the video SHOULD look like)
3. Works coherently with the text overlay and overall narrative moment

EVALUATION CRITERIA (0-10 scale per dimension):
- Tone Match: Does the clip's mood/emotion match the spoken context?
  * "heartfelt moment" needs intimate close-up with emotional expression, NOT generic stock footage
  * "energetic celebration" needs DYNAMIC action/movement, NOT static people sitting
  * "corporate meeting" needs professional setting, NOT casual hangout

- Visual Alignment: Does the clip match the described visual intent?
  * "Coca-Cola branding" should have visible red, bottle, product features
  * "digital art generation" should show digital interface, creative tools in use
  * Look for CONCRETE visual elements, not abstract concepts

- Overall Coherence: Does this clip feel RIGHT for this narrative moment?
  * Considers duration, quality, style consistency
  * Would a professional video editor choose this clip?
  * Does it advance the story/message?

Return ONLY a valid JSON object with NO markdown, NO explanations, NO code blocks."""

RERANK_USER_PROMPT_TEMPLATE = """
NARRATIVE MOMENT:
Text Overlay: "{text}"
Visual Intent: "{visual_intent}"
Spoken Context: "{spoken_context}"
Anchor Subject: "{anchor_subject}"
Must-Have Elements: {must_have}
Must-NOT-Have Elements: {must_not_have}

--- CANDIDATE CLIPS ---

{clips_json}

Evaluate each clip (0-10 scale) on Tone Match, Visual Alignment, and Coherence.
Output the scores and pick the BEST candidate.

RESPONSE FORMAT (JSON ONLY, NO MARKDOWN):
{{
  "clip_1_tone_score": 8,
  "clip_1_visual_score": 7,
  "clip_1_coherence_score": 8,
  "clip_1_summary": "Close-up emotional expression matches heartfelt tone",

  "clip_2_tone_score": 5,
  "clip_2_visual_score": 4,
  "clip_2_coherence_score": 3,
  "clip_2_summary": "Generic business footage, wrong mood for emotional moment",

  "clip_3_tone_score": 9,
  "clip_3_visual_score": 8,
  "clip_3_coherence_score": 9,
  "clip_3_summary": "Perfect emotional resonance, warm lighting, intimate framing",

  "best_clip_index": 2,
  "best_clip_average_score": 8.67,
  "confidence": 0.95,
  "override_reason": "Significantly better emotional match than tier-1 scoring"
}}
"""


class ClipReranker:
    """
    LLM-based re-ranking of B-roll candidates using Gemini.

    Evaluates top 3 clips for semantic/emotional fit beyond keyword matching.
    """

    def __init__(self, api_key: str = None):
        """Initialize Gemini client for re-ranking."""
        if api_key:
            self.api_key = api_key
        else:
            self.api_key = os.environ.get("GEMINI_API_KEY")

        if not self.api_key:
            logger.warning("GEMINI_API_KEY not set, LLM re-ranking disabled")
            self.client = None
        else:
            self.client = genai.Client(api_key=self.api_key)

    async def rerank_clips(
        self,
        overlay: TextOverlay,
        top_3_clips: list[Tuple[float, dict]],
    ) -> Tuple[Optional[str], float]:
        """
        Re-rank top 3 clips using Gemini LLM.

        Args:
            overlay: TextOverlay with visual intent, spoken context
            top_3_clips: List of (score, clip_dict) tuples from tier-1 scoring

        Returns:
            (best_clip_url, gemini_confidence_score)
            Returns (None, 0.0) if re-ranking fails
        """
        if not self.client:
            logger.warning("LLM re-ranking disabled (no API key)")
            return None, 0.0

        if not top_3_clips or len(top_3_clips) < 1:
            return None, 0.0

        try:
            # Build clip descriptions for LLM evaluation
            clips_data = []
            for idx, (tier1_score, clip) in enumerate(top_3_clips):
                clip_info = {
                    "clip_number": idx + 1,
                    "tier_1_score": round(tier1_score, 2),
                    "duration_seconds": clip.get("duration", 0),
                    "resolution": f"{clip.get('width', 0)}x{clip.get('height', 0)}",
                    "tags": [
                        t.get("name") if isinstance(t, dict) else str(t)
                        for t in clip.get("video_tags", [])
                    ][:10],  # Limit to 10 tags for clarity
                    "publisher": clip.get("user", {}).get("name", "Unknown") if isinstance(clip.get("user"), dict) else "Unknown",
                    "url_id": clip.get("id"),
                }
                clips_data.append(clip_info)

            clips_json = json.dumps(clips_data, indent=2)

            # Build user prompt
            user_prompt = RERANK_USER_PROMPT_TEMPLATE.format(
                text=overlay.text or "N/A",
                visual_intent=overlay.visual_intent or "Not specified",
                spoken_context=overlay.spoken_context or "Not specified",
                anchor_subject=overlay.anchor_subject or "Any",
                must_have=", ".join(overlay.must_have) if overlay.must_have else "None",
                must_not_have=", ".join(overlay.must_not_have) if overlay.must_not_have else "None",
                clips_json=clips_json,
            )

            logger.info(
                "Calling Gemini for B-roll re-ranking",
                overlay_text=overlay.text,
                num_clips=len(clips_data),
            )

            # Call Gemini async
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model="gemini-2.5-flash",
                contents=user_prompt,
                config=genai_types.GenerateContentConfig(
                    system_instruction=RERANK_SYSTEM_PROMPT,
                    temperature=0.3,
                ),
            )

            raw_response = response.text.strip()
            logger.debug("Gemini rerank response received", length=len(raw_response))

            # Parse JSON response (handle markdown code fences)
            result_json = raw_response
            if result_json.startswith("```"):
                lines = result_json.split("\n")
                lines = [l for l in lines if not l.startswith("```")]
                result_json = "\n".join(lines).strip()
                if result_json.startswith("json"):
                    result_json = result_json[4:].strip()

            decision = json.loads(result_json)

            best_idx = decision.get("best_clip_index", 0)
            confidence = float(decision.get("confidence", 0.5))

            # Validate and extract best clip
            if 0 <= best_idx < len(top_3_clips):
                _, winning_clip = top_3_clips[best_idx]
                best_url = self._extract_best_url(winning_clip)

                logger.info(
                    "B-roll selected via LLM re-rank",
                    overlay_text=overlay.text,
                    best_clip_index=best_idx + 1,
                    confidence=round(confidence, 2),
                    url_id=winning_clip.get("id"),
                    reason=decision.get("override_reason", ""),
                )

                return best_url, confidence
            else:
                logger.warning(
                    "Invalid best_clip_index from Gemini",
                    best_idx=best_idx,
                    num_clips=len(top_3_clips),
                )
                return None, 0.0

        except json.JSONDecodeError as e:
            logger.error("Failed to parse Gemini JSON response", error=str(e))
            return None, 0.0
        except Exception as e:
            logger.error("LLM re-ranking failed, will fallback", error=str(e))
            return None, 0.0

    def _extract_best_url(self, clip: dict) -> Optional[str]:
        """
        Extract best mp4 URL from Pexels clip.

        Prefers HD quality, falls back to any mp4.
        """
        files = clip.get("video_files", [])

        # Prefer HD mp4
        for f in files:
            if f.get("file_type") == "video/mp4" and f.get("quality") == "hd":
                return f.get("link")

        # Fallback to any mp4
        for f in files:
            if f.get("file_type") == "video/mp4":
                return f.get("link")

        return None
