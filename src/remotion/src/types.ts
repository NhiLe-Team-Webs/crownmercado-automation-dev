/**
 * Shared types cho Remotion composition
 * Mirror với Python TextOverlay value object
 */

export type TextOverlayMode = "SIDE_PANEL" | "CINEMATIC_CALLOUT";

export type TextOverlayPosition =
  | "left"
  | "right"
  | "bottom_left"
  | "bottom_right"
  | "bottom_center";

export interface TextOverlay {
  text: string;
  start: number; // seconds
  end: number; // seconds
  mode: TextOverlayMode;
  position: TextOverlayPosition;
  reason?: string;
}

export interface VideoCompositionProps {
  videoSrc: string;
  durationInSeconds: number;
  fps: number;
  overlays: TextOverlay[];
}
