import React from "react";
import { AbsoluteFill, Video, useVideoConfig, useCurrentFrame, interpolate, Easing } from "remotion";
import type { VideoCompositionProps } from "./types";
import { TextOverlayLayer } from "./components/TextOverlayLayer";

/**
 * Main Composition
 * Render video source + text overlay layer.
 * Includes dynamic zoom and shifting logic to make room for overlays.
 */
export const MyComposition: React.FC<VideoCompositionProps> = ({
  videoSrc,
  overlays,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Flexible Orchestrator ───────────────────────────────────────────────
  const EASE_OUT_FRAMES = 10;
  
  // 1. Find the single most dominant active overlay
  const activeOverlays = overlays.filter(o => {
    const startFrame = Math.round(o.start * fps);
    const endFrame = Math.round(o.end * fps);
    return frame >= startFrame && frame < endFrame;
  });

  const getPriority = (mode: string) => {
    if (mode === "SIDE_PANEL") return 3;
    if (mode === "CINEMATIC_CALLOUT") return 2;
    if (mode === "BOTTOM_TITLE") return 1;
    return 0;
  };

  const topOverlay = activeOverlays.sort((a,b) => getPriority(b.mode) - getPriority(a.mode) || a.start - b.start)[0];

  let scale = 1.0;
  let translateX = 0;

  if (topOverlay) {
    const startFrame = Math.round(topOverlay.start * fps);
    const endFrame = Math.round(topOverlay.end * fps);

    // Dynamic ease-in duration: Side Panel should be slower (premium), others snappy
    const easeInFrames = topOverlay.mode === "SIDE_PANEL" ? 20 : 10;

    // ✅ EASED entry: fast push → gentle settle (ends exactly at easeInFrames)
    const enterProgress = interpolate(
      frame,
      [startFrame, startFrame + easeInFrames],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
    );

    // ✅ EASED exit: gentle start → smooth finish
    const exitProgress = interpolate(
      frame,
      [endFrame - EASE_OUT_FRAMES, endFrame - 1],
      [1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
    );

    const weight = Math.min(enterProgress, exitProgress);

    // Transformation targets
    let targetS = 1.0;
    let targetT = 0;

    if (topOverlay.mode === "SIDE_PANEL") {
      targetS = 1.15;
      targetT = 7;
    } else if (topOverlay.mode === "CINEMATIC_CALLOUT") {
      targetS = 1.12;
      targetT = topOverlay.position === "left" ? 5 : -5;
    } else if (topOverlay.mode === "BOTTOM_TITLE") {
      targetS = 1.12;
      targetT = 0;
    }

    scale = 1.0 + (targetS - 1.0) * weight;
    translateX = targetT * weight;
  }

  // ── BORDER SAFETY CLAMP ─────────────────────────────────────────────────
  const maxSafeShift = Math.max(0, (scale - 1) / (2 * scale) * 100);
  const clampedX = Math.max(-maxSafeShift, Math.min(maxSafeShift, translateX));

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Video 
        src={videoSrc} 
        style={{ 
          width: "100%", 
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translateX(${clampedX}%)`,
        }} 
      />

      {/* Text overlay layer — sync theo word-level timestamps */}
      <AbsoluteFill>
        <TextOverlayLayer overlays={overlays} fps={fps} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
