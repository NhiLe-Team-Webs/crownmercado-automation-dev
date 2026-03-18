/**
 * Shared types cho Remotion composition
 * Mirror với Python TextOverlay value object
 */

export type TextOverlayMode = "SIDE_PANEL" | "CINEMATIC_CALLOUT" | "BOTTOM_TITLE" | "B_ROLL_VIDEO";

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
  url?: string;
  search_query?: string;
  highlight_word?: string;
  focal_point?: { x: number; y: number };
  animation_preset?: "default" | "cascade" | "pulse" | "emphasis" | "reveal" | "color-shift";
}

export interface VideoCompositionProps {
  videoSrc: string;
  durationInSeconds: number;
  fps: number;
  overlays: TextOverlay[];
}
