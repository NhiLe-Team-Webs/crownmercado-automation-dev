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
from pathlib import Path

# ── Load env ──────────────────────────────────────────────────────────────────
from dotenv import load_dotenv
load_dotenv()

ROOT = Path(__file__).parent
VIDEO_PATH = ROOT / "src" / "remotion" / "public" / "video test.mp4"
ROOT_TSX_PATH = ROOT / "src" / "remotion" / "src" / "Root.tsx"
OVERLAY_JSON_PATH = ROOT / "tmp_overlays.json"
TRANSCRIPT_CACHE_PATH = ROOT / "tmp_transcript.json"

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
        result.append({
            "text": o.text,
            "start": o.start,
            "end": o.end,
            "mode": o.mode.value,
            "position": o.position.value,
            "reason": o.reason or "",
            "search_query": o.search_query or "",
            "highlight_word": o.highlight_word or "",
        })

    print(f"      OK: Found {len(result)} overlays:")
    for o in result:
        print(f"         [{o['mode']}] \"{o['text']}\" @ {o['start']:.1f}s - {o['end']:.1f}s ({o['position']})")
        if o.get("reason"):
            print(f"                  -> {o['reason']}")

    return result


# ── Step 2.5: Pexels API Integration ─────────────────────────────────────────

def fetch_pexels_video(query: str, api_key: str) -> str | None:
    """Goi Pexels API lay link HD mp4 video dua tren search_query"""
    if not query:
        return None
        
    print(f"      [PEXELS] Searching for: '{query}'...")
    url = f"https://api.pexels.com/videos/search?query={urllib.parse.quote(query)}&per_page=3&orientation=landscape"
    req = urllib.request.Request(url, headers={"Authorization": api_key, "User-Agent": "Mozilla/5.0"})
    
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            if not data.get("videos"):
                print("      [PEXELS] No videos found.")
                return None
                
            # Lay video dau tien
            video = data["videos"][0]
            # Tim file HD tot nhat (.mp4)
            best_file = None
            for f in video.get("video_files", []):
                if f.get("file_type") == "video/mp4" and f.get("quality") == "hd":
                    best_file = f
                    break
            
            # Neu khong co HD, lay cai dau tien la mp4
            if not best_file:
                for f in video.get("video_files", []):
                    if f.get("file_type") == "video/mp4":
                        best_file = f
                        break
                        
            if best_file and best_file.get("link"):
                link = best_file.get("link")
                print(f"      [PEXELS] Found HD video: {link[:60]}...")
                return link
                
    except Exception as e:
        print(f"      [PEXELS] API Error: {str(e)}")
        
    return None


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
        component={{MyComposition}}
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
    overlays = await extract_overlays(transcript_data)

    if not overlays:
        print("\nWARNING: Gemini khong tim thay overlay phu hop.")
        print("   Transcript co the qua ngan hoac khong ro noi dung.")
        sys.exit(0)
        
    # Inject Pexels videos
    pexels_key = os.environ.get("PEXELS_API_KEY")
    if pexels_key:
        print(f"\n[2.5/3] FETCHING B-ROLL FROM PEXELS...")
        for o in overlays:
            if o["mode"] == "B_ROLL_VIDEO" and o.get("search_query"):
                url = fetch_pexels_video(o["search_query"], api_key=pexels_key)
                if url:
                    o["url"] = url
    else:
        print("\nWARNING: PEXELS_API_KEY khong co trong .env, bo qua get B-Roll video.")

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
