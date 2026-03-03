import React from "react";
import { AbsoluteFill, Video, useVideoConfig } from "remotion";
import type { VideoCompositionProps } from "./types";
import { TextOverlayLayer } from "./components/TextOverlayLayer";

/**
 * Main Composition
 * Render video source + text overlay layer.
 */
export const MyComposition: React.FC<VideoCompositionProps> = ({
  videoSrc,
  overlays,
}) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* Base video */}
      <Video src={videoSrc} style={{ width: "100%", height: "100%" }} />

      {/* Text overlay layer — sync theo word-level timestamps */}
      <AbsoluteFill>
        <TextOverlayLayer overlays={overlays} fps={fps} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
