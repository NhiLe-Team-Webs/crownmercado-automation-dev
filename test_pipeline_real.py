#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_pipeline_real.py
Full pipeline test voi video that:
1. Transcribe video bang Whisper (word-level timestamps)
2. Gui transcript len Gemini Flash de extract keyword overlays
3. Cap nhat Root.tsx voi overlays that
4. Mo Remotion Studio xem preview

Usage:
    py -3 test_pipeline_real.py

Requirements:
    pip install openai-whisper python-dotenv

Video path mac dinh:
    src/remotion/public/video test.mp4
"""

import asyncio
import json
import os
import subprocess
import sys
import urllib.request
import urllib.parse
import ssl
import re
import hashlib
from pathlib import Path

# ── Configuration ─────────────────────────────────────────────────────────────
from dotenv import load_dotenv
load_dotenv()

ROOT = Path(__file__).parent
DEFAULT_VIDEO = "video test.mp4"

# Get video name from command line or use default
video_name = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_VIDEO
VIDEO_PATH = ROOT / "src" / "remotion" / "public" / video_name

ROOT_TSX_PATH = ROOT / "src" / "remotion" / "src" / "Root.tsx"
OVERLAY_JSON_PATH = ROOT / "tmp_overlays.json"
TRANSCRIPT_CACHE_PATH = ROOT / "tmp_transcript.json"
BROLL_PUBLIC_DIR = ROOT / "src" / "remotion" / "public" / "generated-broll"


def _build_ssl_context() -> ssl.SSLContext | None:
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return None


SSL_CONTEXT = _build_ssl_context()


def _pick_highlight_word(text: str) -> str:
    words = re.findall(r"[A-Za-z0-9]+", text or "")
    words = [w for w in words if len(w) > 3]
    if not words:
        return ""
    return max(words, key=len)


def _build_query_candidates(text: str, spoken_context: str) -> list[str]:
    base = (spoken_context or text or "business strategy").strip()
    tokens = [w.lower() for w in re.findall(r"[A-Za-z]{4,}", base)]
    compact = " ".join(tokens[:4]) if tokens else "business strategy"
    return [
        compact,
        f"{compact} office",
        f"{compact} people working",
        "professional corporate meeting",
    ]


def ensure_min_broll_segments(overlays: list, min_broll: int = 2) -> list:
    """If Gemini returns zero B-roll, promote selected explanatory overlays into B-roll candidates."""
    current_broll = sum(1 for o in overlays if o.get("mode") == "B_ROLL_VIDEO")
    if current_broll >= min_broll:
        return overlays

    promoted = 0
    protected_terms = ("subscribe", "follow", "comment", "like", "share", "đăng ký")
    for o in overlays:
        if promoted + current_broll >= min_broll:
            break
        if o.get("mode") == "B_ROLL_VIDEO":
            continue

        text = (o.get("text") or "").lower()
        if any(term in text for term in protected_terms):
            continue

        spoken_context = o.get("spoken_context") or o.get("text") or ""
        if len(spoken_context.strip()) < 6:
            continue

        o["mode"] = "B_ROLL_VIDEO"
        o["position"] = "left"
        duration = max(5.0, min(8.0, float(o.get("end", 0)) - float(o.get("start", 0))))
        o["end"] = round(float(o.get("start", 0)) + duration, 3)
        o["query_candidates"] = o.get("query_candidates") or _build_query_candidates(o.get("text", ""), spoken_context)
        o["highlight_word"] = o.get("highlight_word") or _pick_highlight_word(o.get("text", ""))
        o["fallback_visual"] = o.get("fallback_visual") or "speaker_zoom"
        promoted += 1

    if promoted:
        print(f"      [B-ROLL] Promoted {promoted} overlay(s) to B_ROLL_VIDEO to ensure preview has B-roll.")
    return overlays


def _promote_to_broll(overlay: dict) -> None:
    spoken_context = overlay.get("spoken_context") or overlay.get("text") or ""
    overlay["mode"] = "B_ROLL_VIDEO"
    overlay["position"] = "left"
    duration = max(5.0, min(8.0, float(overlay.get("end", 0)) - float(overlay.get("start", 0))))
    overlay["end"] = round(float(overlay.get("start", 0)) + duration, 3)
    overlay["query_candidates"] = overlay.get("query_candidates") or _build_query_candidates(
        overlay.get("text", ""), spoken_context
    )
    overlay["highlight_word"] = overlay.get("highlight_word") or _pick_highlight_word(overlay.get("text", ""))
    overlay["fallback_visual"] = overlay.get("fallback_visual") or "speaker_zoom"


def ensure_broll_timeline_coverage(overlays: list, duration: float) -> list:
    """Ensure B-roll appears at both beginning and end of the video timeline."""
    if not overlays or duration <= 0:
        return overlays

    protected_terms = ("subscribe", "follow", "comment", "like", "share", "đăng ký")
    used_indexes: set[int] = set()
    windows = [
        ("start", 0.0, 0.30),
        ("end", 0.70, 1.0),
    ]

    def center_ratio(item: dict) -> float:
        center = (float(item.get("start", 0)) + float(item.get("end", 0))) / 2.0
        return center / duration

    def has_broll_in_window(min_ratio: float, max_ratio: float) -> bool:
        for item in overlays:
            if item.get("mode") != "B_ROLL_VIDEO":
                continue
            ratio = center_ratio(item)
            if min_ratio <= ratio <= max_ratio:
                return True
        return False

    promoted_labels: list[str] = []
    for label, min_ratio, max_ratio in windows:
        if has_broll_in_window(min_ratio, max_ratio):
            continue

        candidates: list[tuple[int, float, float]] = []
        window_center = (min_ratio + max_ratio) / 2.0
        for idx, item in enumerate(overlays):
            if idx in used_indexes:
                continue
            if item.get("mode") == "B_ROLL_VIDEO":
                continue

            text = (item.get("text") or "").lower()
            if any(term in text for term in protected_terms):
                continue

            ratio = center_ratio(item)
            if ratio < min_ratio or ratio > max_ratio:
                continue

            spoken = (item.get("spoken_context") or item.get("text") or "").strip()
            quality = 1.0 if len(spoken) >= 6 else 0.0
            proximity = 1.0 - abs(ratio - window_center)
            candidates.append((idx, quality, proximity))

        if not candidates:
            for idx, item in enumerate(overlays):
                if idx in used_indexes:
                    continue
                if item.get("mode") == "B_ROLL_VIDEO":
                    continue

                text = (item.get("text") or "").lower()
                if any(term in text for term in protected_terms):
                    continue

                ratio = center_ratio(item)
                spoken = (item.get("spoken_context") or item.get("text") or "").strip()
                quality = 1.0 if len(spoken) >= 6 else 0.0
                proximity = 1.0 - abs(ratio - window_center)
                candidates.append((idx, quality, proximity))

        if not candidates:
            continue

        candidates.sort(key=lambda x: (x[1], x[2]), reverse=True)
        selected_idx = candidates[0][0]
        _promote_to_broll(overlays[selected_idx])
        used_indexes.add(selected_idx)
        promoted_labels.append(label)

    if promoted_labels:
        print(f"      [B-ROLL] Enforced timeline coverage for: {', '.join(promoted_labels)}.")

    return overlays


def fetch_pexels_direct(query: str, api_key: str) -> str | None:
    if not query or not api_key:
        return None
    url = f"https://api.pexels.com/videos/search?query={urllib.parse.quote(query)}&per_page=3&orientation=landscape"
    req = urllib.request.Request(url, headers={"Authorization": api_key, "User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, context=SSL_CONTEXT) as response:
            data = json.loads(response.read().decode())
            videos = data.get("videos", [])
            if not videos:
                return None
            for f in videos[0].get("video_files", []):
                if f.get("file_type") == "video/mp4" and f.get("quality") == "hd" and f.get("link"):
                    return f.get("link")
            for f in videos[0].get("video_files", []):
                if f.get("file_type") == "video/mp4" and f.get("link"):
                    return f.get("link")
    except Exception:
        return None
    return None


def download_broll_to_public(url: str, label: str = "broll") -> str | None:
    """Download remote B-roll video and return a remotion public-relative path."""
    if not url:
        return None

    try:
        BROLL_PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
        digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]
        safe_label = re.sub(r"[^a-z0-9]+", "-", (label or "broll").lower()).strip("-")[:24] or "broll"
        filename = f"{safe_label}-{digest}.mp4"
        target_path = BROLL_PUBLIC_DIR / filename

        if not target_path.exists() or target_path.stat().st_size < 2048:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, context=SSL_CONTEXT) as response:
                payload = response.read()
            if len(payload) < 2048:
                return None
            target_path.write_bytes(payload)

        rel_path = target_path.relative_to(ROOT / "src" / "remotion" / "public").as_posix()
        return rel_path
    except Exception as e:
        print(f"      [WARNING] Download B-roll failed for '{label}': {e}")
        return None

# Check if we should clear cache (if video name changed)
cache_info_path = ROOT / "tmp_cache_info.json"
current_video_info = {"video": video_name}

def should_clear_cache():
    if not cache_info_path.exists():
        return True
    try:
        old_info = json.loads(cache_info_path.read_text())
        return old_info.get("video") != video_name
    except:
        return True

if should_clear_cache():
    if TRANSCRIPT_CACHE_PATH.exists():
        print(f"--- Clearing old transcript cache for {video_name} ---")
        TRANSCRIPT_CACHE_PATH.unlink()
    cache_info_path.write_text(json.dumps(current_video_info))

# ── Step 1: Transcribe with Whisper ──────────────────────────────────────────

def get_video_duration(video_path: Path) -> float:
    """Lay duration video bang ffprobe"""
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json",
             "-show_format", str(video_path)],
            capture_output=True, text=True
        )
        info = json.loads(result.stdout)
        return float(info["format"]["duration"])
    except Exception:
        return 60.0


def transcribe_video(video_path: Path, force_retranscribe: bool = False) -> dict:
    """
    Transcribe video bang AssemblyAI.
    Tra ve dict voi full_text va word-level timestamps.
    """
    if not force_retranscribe and TRANSCRIPT_CACHE_PATH.exists():
        print(f"\n[1/3] TRANSCRIBING: Load tu cache {TRANSCRIPT_CACHE_PATH.name}")
        return json.loads(TRANSCRIPT_CACHE_PATH.read_text(encoding="utf-8"))

    print("\n[1/3] TRANSCRIBING: " + str(video_path.name))
    print("      Uploading & Transcribing via AssemblyAI...")

    try:
        import assemblyai as aai
    except ImportError:
        print("\nERROR: Chua install assemblyai. Chay:")
        print("   py -3 -m pip install assemblyai")
        sys.exit(1)

    aai.settings.api_key = os.environ.get("ASSEMBLYAI_API_KEY")
    if not aai.settings.api_key:
        print("\nERROR: ASSEMBLYAI_API_KEY chua set trong .env")
        sys.exit(1)

    transcriber = aai.Transcriber()
    transcript = transcriber.transcribe(str(video_path))

    if transcript.status == aai.TranscriptStatus.error:
        print(f"\nERROR: AssemblyAI failed - {transcript.error}")
        sys.exit(1)

    words = []
    for word_data in transcript.words:
        words.append({
            "word": word_data.text.strip(),
            "start": round(word_data.start / 1000.0, 3), # ms to seconds
            "end": round(word_data.end / 1000.0, 3),     # ms to seconds
            "confidence": round(word_data.confidence, 3),
        })

    full_text = transcript.text.strip()
    print(f"      OK: Transcribed {len(words)} words")
    preview = full_text[:120] + "..." if len(full_text) > 120 else full_text
    print(f"      Preview: \"{preview}\"")

    res = {
        "full_text": full_text,
        "words": words,
    }

    # Cache result
    TRANSCRIPT_CACHE_PATH.write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"      OK: Saved transcript to {TRANSCRIPT_CACHE_PATH.name}")

    return res


# ── Step 2: Gemini Keyword Extraction ────────────────────────────────────────

async def extract_overlays(transcript_data: dict) -> list:
    """Goi Gemini de extract keyword overlays tu transcript"""
    print("\n[2/3] GEMINI KEYWORD EXTRACTION...")

    sys.path.insert(0, str(ROOT / "src"))

    from modules.video_processing.domain.value_objects import (
        Transcript, WordSegment
    )
    from modules.video_processing.infrastructure.adapters.gemini_keyword_extractor import (
        GeminiKeywordExtractor
    )

    words = [
        WordSegment(
            word=w["word"],
            start=w["start"],
            end=w["end"],
            confidence=w.get("confidence", 0.9),
        )
        for w in transcript_data["words"]
    ]

    transcript = Transcript(
        full_text=transcript_data["full_text"],
        words=words,
    )

    extractor = GeminiKeywordExtractor()
    overlays = await extractor.extract(transcript)

    result = []
    for o in overlays:
        safe_highlight = o.highlight_word or _pick_highlight_word(o.text)
        item = {
            "text": o.text,
            "start": o.start,
            "end": o.end,
            "mode": o.mode.value,
            "position": o.position.value,
            "reason": o.reason or "",
            "search_query": o.search_query or "",
            "highlight_word": safe_highlight,
            # ── New Premium Fields ──
            "visual_intent": o.visual_intent,
            "spoken_context": o.spoken_context,
            "must_have": o.must_have,
            "must_not_have": o.must_not_have,
            "query_candidates": o.query_candidates,
            "anchor_subject": o.anchor_subject,
            "relevance_confidence": o.relevance_confidence,
            "fallback_visual": o.fallback_visual
        }
        result.append(item)

    print(f"      OK: Found {len(result)} overlays:")
    for o in result:
        print(f"         [{o['mode']}] \"{o['text']}\" @ {o['start']:.1f}s - {o['end']:.1f}s ({o['position']})")
        if o.get("reason"):
            print(f"                  -> {o['reason']}")

    return result


# ── Step 2.5: Pexels API Integration ─────────────────────────────────────────




# ── Step 3: Update Root.tsx ───────────────────────────────────────────────────

def update_root_tsx(overlays: list, duration: float, video_filename: str):
    """Cap nhat Root.tsx voi overlays that"""
    print(f"\n[3/3] UPDATING Root.tsx...")

    fps = 30

    # Build overlays array as TS
    overlay_lines = []
    for o in overlays:
        url_line = f',\n      url: "{o["url"]}"' if o.get("url") else ""
        search_query_line = f',\n      search_query: "{o["search_query"]}"' if o.get("search_query") else ""
        highlight_word_line = f',\n      highlight_word: "{o["highlight_word"]}"' if o.get("highlight_word") else ""
        overlay_lines.append(
            f'    {{\n'
            f'      text: "{o["text"]}",\n'
            f'      start: {o["start"]},\n'
            f'      end: {o["end"]},\n'
            f'      mode: "{o["mode"]}",\n'
            f'      position: "{o["position"]}"{url_line}{search_query_line}{highlight_word_line}\n'
            f'    }}'
        )
    overlays_ts = ",\n".join(overlay_lines)

    new_root = f'''import React from "react";
import "./index.css";
import {{ Composition, staticFile }} from "remotion";
import {{ MyComposition }} from "./Composition";
import type {{ VideoCompositionProps }} from "./types";

const FPS = {fps};
const WIDTH = 1920;
const HEIGHT = 1080;

/** Auto-generated by test_pipeline_real.py */
const defaultProps: VideoCompositionProps = {{
  videoSrc: staticFile("{video_filename}"),
  durationInSeconds: {round(duration, 2)},
  fps: FPS,
  overlays: [
{overlays_ts}
  ],
}};

export const RemotionRoot: React.FC = () => {{
  return (
    <>
      <Composition
        id="VideoWithOverlays"
                component={{MyComposition as unknown as React.ComponentType<Record<string, unknown>>}}
        durationInFrames={{Math.round(defaultProps.durationInSeconds * FPS)}}
        fps={{FPS}}
        width={{WIDTH}}
        height={{HEIGHT}}
        defaultProps={{defaultProps}}
      />
    </>
  );
}};
'''

    ROOT_TSX_PATH.write_text(new_root, encoding="utf-8")
    print(f"      OK: Root.tsx updated with {len(overlays)} real overlays")

    OVERLAY_JSON_PATH.write_text(
        json.dumps(overlays, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"      Saved: tmp_overlays.json")


# ── Main ──────────────────────────────────────────────────────────────────────

async def main():
    print("=" * 60)
    print("  TEXT HIGHLIGHT PIPELINE TEST")
    print(f"  Video: {VIDEO_PATH.name}")
    print("=" * 60)

    if not VIDEO_PATH.exists():
        print(f"\nERROR: Video not found: {VIDEO_PATH}")
        print("   Hay dat video vao: src/remotion/public/")
        sys.exit(1)

    api_keys = os.environ.get("GEMINI_API_KEYS", os.environ.get("GEMINI_API_KEY", ""))
    if not api_keys:
        print("\nERROR: GEMINI_API_KEYS chua set trong .env")
        sys.exit(1)

    duration = get_video_duration(VIDEO_PATH)
    print(f"\nVideo duration: {duration:.1f}s ({duration/60:.1f} min)")

    transcript_data = transcribe_video(VIDEO_PATH, force_retranscribe=False)
    overlays = []
    try:
        overlays = await extract_overlays(transcript_data)
    except ModuleNotFoundError as e:
        print(f"\n[WARNING] Extractor dependency missing: {e}")
        if OVERLAY_JSON_PATH.exists():
            print("      [FALLBACK] Loading overlays from cache tmp_overlays.json")
            overlays = json.loads(OVERLAY_JSON_PATH.read_text(encoding="utf-8"))
        else:
            raise
    overlays = ensure_min_broll_segments(overlays, min_broll=2)
    overlays = ensure_broll_timeline_coverage(overlays, duration)

    # ── NEW: Temporal distribution for even B-roll spacing ───────────────────
    try:
        from src.modules.video_processing.infrastructure.adapters.broll_distribution_utils import (
            promote_for_distribution,
            validate_distribution,
        )
        overlays = promote_for_distribution(overlays, duration, target_broll_count=7)
        metrics = validate_distribution(overlays, duration, target_broll_count=7)
        print(f"      [DISTRIBUTION] B-roll count: {metrics['broll_count']}/{metrics['target_count']}")
        print(f"      [DISTRIBUTION] Avg gap: {metrics['avg_gap_seconds']}s (target: {metrics['target_spacing']}s)")
        print(f"      [DISTRIBUTION] Variance: {metrics['variance_seconds']}s")
        if metrics['issues']:
            for issue in metrics['issues']:
                print(f"      [DISTRIBUTION] Issue: {issue}")
    except Exception as e:
        print(f"      [WARNING] Distribution optimization failed: {e}")
    # ──────────────────────────────────────────────────────────────────────────

    if not overlays:
        print("\nWARNING: Gemini khong tim thay overlay phu hop.")
        print("   Transcript co the qua ngan hoac khong ro noi dung.")
        sys.exit(0)
        
    # ── Step 2.5: Premium B-Roll Fetching & Quality Gate ──────────────────────
    pexels_key = os.environ.get("PEXELS_API_KEY")
    if pexels_key:
        print(f"\n[2.5/3] FETCHING B-ROLL WITH SCORING ENGINE...")
        fetcher = None
        strict_fetch_available = True
        try:
            from src.modules.video_processing.infrastructure.adapters.broll_fetcher import BrollFetcher
            fetcher = BrollFetcher(api_key=pexels_key)
        except Exception as e:
            strict_fetch_available = False
            print(f"      [WARNING] Strict fetcher unavailable: {e}")
            print("      [INFO] Using direct Pexels fallback mode.")
        
        final_overlays = []
        for o in overlays:
            if o["mode"] == "B_ROLL_VIDEO":
                url = None
                if strict_fetch_available and fetcher is not None:
                    from types import SimpleNamespace
                    overlay_obj = SimpleNamespace(
                        mode=o.get("mode", "B_ROLL_VIDEO"),
                        text=o.get("text", ""),
                        query_candidates=o.get("query_candidates") or _build_query_candidates(
                            o.get("text", ""), o.get("spoken_context", "")
                        ),
                        search_query=o.get("search_query"),
                        spoken_context=o.get("spoken_context") or "",
                        visual_intent=o.get("visual_intent") or "",
                        literalness=o.get("literalness") or "semi_literal",
                        must_have=o.get("must_have") or [],
                        must_not_have=o.get("must_not_have") or [],
                        anchor_subject=o.get("anchor_subject") or "",
                        relevance_confidence=float(o.get("relevance_confidence") or 0.7),
                    )
                    try:
                        url = await fetcher.fetch_best_match(overlay_obj)
                    except Exception as e:
                        print(f"      [WARNING] Strict fetch failed for '{o.get('text', '')}': {e}")
                
                if url:
                    local_path = download_broll_to_public(url, o.get("text", "broll"))
                    if local_path:
                        o["url"] = local_path
                        final_overlays.append(o)
                        print(f"      [B-ROLL] Downloaded '{o.get('text', '')}' -> {local_path}")
                    else:
                        print(f"      [WARNING] Could not download strict-match B-roll for '{o.get('text', '')}'.")
                else:
                    # Relaxed direct fetch fallback to keep B-roll presence in preview when scorer is strict.
                    query_pool = o.get("query_candidates") or _build_query_candidates(
                        o.get("text", ""), o.get("spoken_context", "")
                    )
                    relaxed_url = None
                    for q in query_pool[:2]:
                        relaxed_url = fetch_pexels_direct(q, pexels_key)
                        if relaxed_url:
                            break

                    if relaxed_url:
                        local_path = download_broll_to_public(relaxed_url, o.get("text", "broll"))
                        if local_path:
                            o["url"] = local_path
                            final_overlays.append(o)
                            print(f"      [B-ROLL] Relaxed fallback downloaded for '{o['text']}' -> {local_path}.")
                            continue
                        print(f"      [WARNING] Relaxed URL found but download failed for '{o['text']}'.")

                    # ── QUALITY GATE: Fallback hierarchy ──
                    fb = o.get("fallback_visual", "speaker_zoom")
                    print(f"      [GATE] No high-quality B-roll for '{o['text']}'. Falling back to: {fb}")
                    
                    if fb == "side_visual_card":
                        o["mode"] = "SIDE_PANEL"
                        o["position"] = "left"
                        final_overlays.append(o)
                    elif fb == "branded_text_scene" or fb == "speaker_zoom":
                        # Convert to BOTTOM_TITLE for impact if B-roll fails
                        o["mode"] = "BOTTOM_TITLE"
                        o["position"] = "bottom_center"
                        final_overlays.append(o)
                    else:
                        # Skip this moment entirely if no good fallback
                        pass
            else:
                final_overlays.append(o)
        
        overlays = final_overlays
    # Save for debug (with full metadata)
    with open(OVERLAY_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(overlays, f, indent=2, ensure_ascii=False)
    
    update_root_tsx(overlays, duration, VIDEO_PATH.name)

    print("\n" + "=" * 60)
    print("  PIPELINE HOAN THANH!")
    print("=" * 60)
    print("\n  De xem preview, mo terminal moi va chay:")
    remotion_dir = str(ROOT / "src" / "remotion").replace("\\", "/")
    print(f"     cd \"{remotion_dir}\"")
    print("     npm run dev")
    print("\n  Roi mo trinh duyet: http://localhost:3000")
    print("  Chon composition: VideoWithOverlays")
    print()


if __name__ == "__main__":
    asyncio.run(main())
