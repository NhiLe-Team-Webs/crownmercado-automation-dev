import os
import json
import urllib.request
import urllib.parse
import ssl
import re
import structlog
from typing import Optional, List, Tuple
from src.modules.video_processing.domain.ports import IBrollFetcher
from src.modules.video_processing.domain.value_objects import TextOverlay
from src.modules.video_processing.infrastructure.adapters.broll_scoring_utils import (
    semantic_similarity_score,
    anchor_subject_match,
    context_tone_score,
    build_clip_description,
)
from src.modules.video_processing.infrastructure.adapters.clip_reranker import ClipReranker

logger = structlog.get_logger()


def _build_ssl_context() -> ssl.SSLContext | None:
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return None

class BrollFetcher(IBrollFetcher):
    """
    Adapter cho Pexels API với cơ chế chấm điểm (Scoring) cao cấp.
    Hạn chế clip rác bằng cách verify metadata và lọc theo luật editorial.
    """

    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get("PEXELS_API_KEY")
        if not self.api_key:
            logger.warning("PEXELS_API_KEY không được set. B-roll fetching sẽ bị skip.")
        
        self.used_ids = set() # Tránh lặp clip trong một session
        self.ssl_context = _build_ssl_context()

    async def fetch_best_match(self, overlay: TextOverlay) -> Optional[str]:
        if not self.api_key:
            logger.info("Skipping B-roll fetch due to missing API key or query candidates.")
            return None

        query_candidates = list(getattr(overlay, "query_candidates", []) or [])
        if not query_candidates:
            query_candidates = self._build_fallback_queries(overlay)
            if query_candidates:
                logger.info("Using fallback B-roll queries", text=overlay.text, queries=query_candidates)

        if not query_candidates:
            logger.info("Skipping B-roll fetch due to missing API key or query candidates.")
            return None

        all_candidates = []
        # Thử từng query candidate từ literal đến thematic
        for query in query_candidates[:3]: # Thử 3 cái đầu tiên để tiết kiệm API
            logger.info("Searching Pexels", query=query, text=overlay.text)
            try:
                results = await self._search_pexels(query)
                logger.info("Pexels search results", query=query, count=len(results))
                for clip in results:
                    clip["_source_query"] = query
                all_candidates.extend(results)
                if len(all_candidates) >= 5: # Collect at least 5 candidates before scoring
                    break
            except Exception as e:
                logger.error("Error searching Pexels", query=query, error=str(e))
        
        if not all_candidates:
            logger.info("No candidates found for any query", text=overlay.text)
            return None

        # Chấm điểm toàn bộ candidates
        scored_candidates = []
        for clip in all_candidates:
            if not self._passes_context_gate(clip, overlay):
                logger.debug(
                    "Candidate rejected by context gate",
                    clip_id=clip.get("id"),
                    text=overlay.text,
                )
                continue

            score = self._calculate_score(clip, overlay)
            if score > 0.55: # Ngưỡng tối thiểu để được coi là "premium" - Increased from 0.4 for higher quality
                scored_candidates.append((score, clip))
                logger.debug(
                    "Candidate scored above threshold", 
                    clip_id=clip.get('id'), 
                    score=round(score, 2)
                )
            else:
                logger.debug(
                    "Candidate scored below threshold", 
                    clip_id=clip.get('id'), 
                    score=round(score, 2)
                )

        if not scored_candidates:
            logger.info("Không tìm thấy clip đạt ngưỡng chất lượng", text=overlay.text)
            return None

        # Sắp xếp theo điểm cao nhất
        scored_candidates.sort(key=lambda x: x[0], reverse=True)

        # ✅ TIER 1: Keep top 3 candidates for optional LLM re-ranking
        top_3 = scored_candidates[:3]
        best_score, best_clip = top_3[0]

        # ✅ TIER 2: LLM Re-ranking (if confidence is high and we have multiple candidates)
        if len(top_3) >= 2 and overlay.relevance_confidence >= 0.8:
            try:
                reranker = ClipReranker()
                llu_url, gemini_confidence = await reranker.rerank_clips(overlay, top_3)
                if llu_url:
                    # LLM found a better match
                    self.used_ids.add(best_clip['id'])
                    return llu_url
                else:
                    # LLM re-ranking failed, fall back to tier-1
                    logger.debug("LLM re-ranking returned no URL, using tier-1 result")
            except Exception as e:
                logger.warning(f"LLM re-ranking failed, falling back to tier-1: {e}")

        # Tier-1 fallback: return best from semantic scoring
        logger.info(
            "B-roll selected via semantic scoring (tier-1)",
            text=overlay.text,
            score=round(best_score, 2),
            id=best_clip['id']
        )

        self.used_ids.add(best_clip['id'])
        return self._extract_best_url(best_clip)

    async def _search_pexels(self, query: str) -> List[dict]:
        """Gửi request tới Pexels API"""
        url = f"https://api.pexels.com/videos/search?query={urllib.parse.quote(query)}&per_page=5&orientation=landscape"
        req = urllib.request.Request(url, headers={"Authorization": self.api_key, "User-Agent": "Mozilla/5.0"})
        
        try:
            # Dùng thread pool vì urllib là block
            import asyncio
            def _do_req():
                with urllib.request.urlopen(req, context=self.ssl_context) as res:
                    return json.loads(res.read().decode())
            
            data = await asyncio.to_thread(_do_req)
            return data.get("videos", [])
        except Exception as e:
            logger.error("Pexels API Error", query=query, error=str(e))
            return []

    def _calculate_score(self, clip: dict, overlay: TextOverlay) -> float:
        """
        UPGRADED Scoring Engine v2: Semantic Awareness

        Scoring components:
        1. Base relevance (weighted by confidence)
        2. ✅ Semantic similarity (visual_intent vs clip metadata)
        3. ✅ Anchor subject match (person/object/scene filtering)
        4. ✅ Context tone evaluation (emotional mood keywords)
        5. Keyword matching (existing logic, now weighted)
        6. Must-have/must-not-have constraints
        7. Technical quality (resolution, duration)
        8. Penalties (generic, used)
        """
        # ── QUALITY FILTERS: Reject low-quality clips immediately ──────────────
        duration = clip.get("duration", 0)
        if duration < 3 or duration > 60:
            logger.debug(f"Clip {clip.get('id')} rejected: duration out of range ({duration}s)")
            return 0.0

        # ── BASE SCORE ───────────────────────────────────────────────────────
        # Reweight relevance_confidence: reduced from 0.5 to 0.4 to make room for semantic scoring
        relevance = overlay.relevance_confidence
        base_score = relevance * 0.4

        # ── SEMANTIC SIMILARITY SCORING (NEW) ────────────────────────────
        clip_description = build_clip_description(clip)

        # visual_intent is most important for context awareness
        if overlay.visual_intent:
            visual_sim = semantic_similarity_score(overlay.visual_intent, clip_description)
            base_score += visual_sim * 0.2  # 20% weight for visual intent match
            logger.debug(
                "Visual intent match",
                clip_id=clip.get('id'),
                visual_intent=overlay.visual_intent[:50],
                score=round(visual_sim, 2)
            )

        # spoken_context provides emotional tone hints for better mood matching
        if overlay.spoken_context:
            context_tone = context_tone_score(overlay.spoken_context, clip)
            base_score += context_tone * 0.15  # 15% weight for mood match
            logger.debug(
                "Context tone match",
                clip_id=clip.get('id'),
                tone_score=round(context_tone, 2)
            )

        # ── ANCHOR SUBJECT FILTERING (NEW) ──────────────────────────────
        if overlay.anchor_subject:
            subject_score = anchor_subject_match(overlay.anchor_subject, clip)
            base_score *= subject_score  # Multiply as filter (penalize wrong subject)
            logger.debug(
                "Anchor subject match",
                clip_id=clip.get('id'),
                anchor_subject=overlay.anchor_subject,
                score=round(subject_score, 2)
            )

        # ── KEYWORD MATCHING (EXISTING, IMPROVED) ────────────────────────
        context_hits = self._context_match_count(clip, overlay)
        if context_hits > 0:
            context_bonus = min(0.25, context_hits * 0.05)
            base_score += context_bonus
            logger.debug(
                "Context keyword hits",
                clip_id=clip.get('id'),
                hits=context_hits,
                bonus=round(context_bonus, 2)
            )
        else:
            base_score -= 0.10  # Reduced penalty (was 0.15, now we factor in semantic match)

        # ── QUALITY METRICS (EXISTING) ───────────────────────────────────
        tags = [t.get("name", "").lower() for t in clip.get("video_tags", [])]

        # Must-not-have (hard disqualify)
        for bad in overlay.must_not_have:
            if bad.lower() in tags or bad.lower() in str(clip).lower():
                logger.debug(
                    "Clip rejected by must-not-have",
                    clip_id=clip.get('id'),
                    bad_keyword=bad
                )
                return 0.0

        # Generic content penalty
        if not tags or len(tags) < 2:
            logger.debug(f"Clip {clip.get('id')} penalized: generic (insufficient tags)")
            base_score -= 0.15

        # Must-have (bonus)
        for good in overlay.must_have:
            if good.lower() in tags:
                base_score += 0.1
                logger.debug(
                    "Must-have keyword match",
                    clip_id=clip.get('id'),
                    keyword=good
                )

        # Technical quality
        if clip.get("width", 0) >= 3840:  # 4K
            base_score += 0.1
        elif clip.get("width", 0) >= 1920:  # HD
            base_score += 0.05

        # Repetition penalty
        if clip['id'] in self.used_ids:
            base_score -= 0.5

        final_score = max(0.0, min(1.0, base_score))

        logger.debug(
            "Clip score calculated",
            clip_id=clip.get('id'),
            final_score=round(final_score, 2),
            duration=duration
        )

        return final_score

    def _build_fallback_queries(self, overlay: TextOverlay) -> list[str]:
        seeds = [
            getattr(overlay, "search_query", "") or "",
            getattr(overlay, "visual_intent", "") or "",
            getattr(overlay, "text", "") or "",
        ]
        result: list[str] = []
        for seed in seeds:
            cleaned = " ".join(self._tokenize_terms(seed))
            if cleaned and cleaned not in result:
                result.append(cleaned)
        return result

    def _tokenize_terms(self, text: str) -> set[str]:
        if not text:
            return set()
        stop_words = {
            "the", "and", "with", "this", "that", "from", "your", "into", "about", "when",
            "what", "where", "there", "have", "has", "been", "will", "just", "they", "them",
            "their", "while", "over", "under", "more", "than", "into", "using", "used", "make",
            "video", "people", "person", "talk", "talking", "speaker",
        }
        words = re.findall(r"[a-zA-Z]{3,}", text.lower())
        return {w for w in words if w not in stop_words}

    def _build_context_terms(self, overlay: TextOverlay) -> set[str]:
        blobs = [
            getattr(overlay, "text", "") or "",
            getattr(overlay, "spoken_context", "") or "",
            getattr(overlay, "visual_intent", "") or "",
            " ".join(getattr(overlay, "must_have", []) or []),
        ]
        merged = " ".join(blobs)
        return self._tokenize_terms(merged)

    def _context_match_count(self, clip: dict, overlay: TextOverlay) -> int:
        clip_payload = dict(clip)
        clip_payload.pop("_source_query", None)
        clip_blob = json.dumps(clip_payload, ensure_ascii=False).lower()
        clip_terms = self._tokenize_terms(clip_blob)
        terms = self._build_context_terms(overlay)
        return len(terms.intersection(clip_terms))

    def _passes_context_gate(self, clip: dict, overlay: TextOverlay) -> bool:
        """
        UPGRADED: Stricter context matching to reduce weak/generic matches.
        Require meaningful alignment with clip metadata.
        """
        terms = self._build_context_terms(overlay)
        if not terms:
            return True

        hits = self._context_match_count(clip, overlay)
        must_have = [m.lower() for m in (getattr(overlay, "must_have", []) or [])]
        clip_payload = dict(clip)
        clip_payload.pop("_source_query", None)
        clip_blob = json.dumps(clip_payload, ensure_ascii=False).lower()
        clip_terms = self._tokenize_terms(clip_blob)
        must_have_hits = sum(
            1
            for m in must_have
            if m and len(self._tokenize_terms(m).intersection(clip_terms)) > 0
        )

        # UPGRADED: Stricter gate - require hits >= 2 OR must_have match
        # This prevents weak matches from passing through.
        return hits >= 2 or must_have_hits >= 1

    def _extract_best_url(self, clip: dict) -> Optional[str]:
        """Lấy URL mp4 chất lượng HD/4K tốt nhất"""
        files = clip.get("video_files", [])
        # Ưu tiên HD mp4
        for f in files:
            if f.get("file_type") == "video/mp4" and f.get("quality") == "hd":
                return f.get("link")
        # Fallback to any mp4
        for f in files:
            if f.get("file_type") == "video/mp4":
                return f.get("link")
        return None
