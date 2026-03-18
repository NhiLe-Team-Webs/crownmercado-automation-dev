import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";
import type { TextOverlayPosition } from "../types";
import { preventOrphanLines } from "../utils/smart-text-wrapper";

interface CinematicCalloutProps {
    text: string;
    durationInFrames: number;
    position: TextOverlayPosition;
}

/**
 * Cinematic Callout Overlay
 *
 * Text lớn, bold, overlay trực tiếp lên video.
 * Scale spring 0.92 → 1.0 + opacity fade.
 * Hỗ trợ 5 vị trí: left, right, bottom_left, bottom_right, bottom_center.
 */
export const CinematicCallout: React.FC<CinematicCalloutProps> = ({
    text,
    durationInFrames,
    position,
}) => {
    const frame = useCurrentFrame();

    const exitFrame = durationInFrames - 10;

    // ── Enter: smooth scale + fade (đồng bộ 10 frames với zoom) ──────────────
    const enterProgress = interpolate(
        frame,
        [0, 10],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
    );

    // ── Exit: fade out ────────────────────────────────────────────────────────
    const exitOpacity = interpolate(
        frame,
        [exitFrame, durationInFrames - 1],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
    );

    const scale = interpolate(enterProgress, [0, 1], [0.92, 1.0]);
    const opacity = Math.min(enterProgress, exitOpacity);

    // Prevent orphaned text
    const processedText = preventOrphanLines(text);

    // ── Position mapping ──────────────────────────────────────────────────────
    const positionStyle = POSITION_MAP[position] ?? POSITION_MAP["bottom_left"];
    const baseTransform = positionStyle.transform ?? "";
    const transform = `${baseTransform} scale(${scale})`.trim();

    return (
        <div
            style={{
                position: "absolute",
                ...positionStyle,
                padding: "0 80px",
                opacity,
                transform,
                transformOrigin: TRANSFORM_ORIGIN[position] ?? "center center",
                pointerEvents: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: position === "left" || position === "bottom_left" 
                    ? "flex-start" 
                    : position === "right" || position === "bottom_right" 
                        ? "flex-end" 
                        : "center",
                width: "100%",
                maxWidth: "100%",
                boxSizing: "border-box",
            }}
        >
            <div
                style={{
                    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                    fontWeight: 900,
                    fontSize: 72,
                    lineHeight: 1.0,
                    color: "#FFFFFF",
                    textTransform: "uppercase",
                    letterSpacing: "-0.01em",
                    textAlign: position === "left" || position === "bottom_left"
                        ? "left"
                        : position === "right" || position === "bottom_right"
                            ? "right"
                            : "center",
                    whiteSpace: "pre-line",
                    wordBreak: "keep-all",
                    overflowWrap: "break-word",
                    maxWidth: 700,
                    textShadow: [
                        "3px 3px 0px rgba(0,0,0,0.9)",
                        "-1px -1px 0px rgba(0,0,0,0.7)",
                        "2px -1px 0px rgba(0,0,0,0.7)",
                        "-2px 2px 0px rgba(0,0,0,0.7)",
                        "0px 4px 12px rgba(0,0,0,0.5)",
                    ].join(", "),
                    display: "inline-block",
                }}
            >
                {processedText}
            </div>
        </div>
    );
};

// ── Layout helpers ────────────────────────────────────────────────────────────

type PositionCSS = {
    top?: number | string;
    bottom?: number | string;
    left?: number | string;
    right?: number | string;
    transform?: string;
};

const POSITION_MAP: Record<TextOverlayPosition, PositionCSS> = {
    left: { top: "50%", left: 0, transform: "translateY(-50%)" },
    right: { top: "50%", right: 0, transform: "translateY(-50%)" },
    bottom_left: { bottom: 60, left: 0 },
    bottom_right: { bottom: 60, right: 0 },
    bottom_center: { bottom: 60, left: 0, right: 0 },
};

const TRANSFORM_ORIGIN: Record<TextOverlayPosition, string> = {
    left: "center center",
    right: "center center",
    bottom_left: "bottom left",
    bottom_right: "bottom right",
    bottom_center: "bottom center",
};
