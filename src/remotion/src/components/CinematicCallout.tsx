import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import type { TextOverlayPosition } from "../types";

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
    const { fps } = useVideoConfig();

    const exitFrame = durationInFrames - 12;

    // ── Enter: scale spring + fade ───────────────────────────────────────────
    const enterSpring = spring({
        frame: frame,
        fps,
        config: { damping: 18, stiffness: 115, mass: 1 },
        durationInFrames: 22,
    });


    // ── Exit: fade out ────────────────────────────────────────────────────────
    const exitOpacity = interpolate(
        frame,
        [exitFrame, exitFrame + 10],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );


    const scale = interpolate(enterSpring, [0, 1], [0.88, 1.0]);
    const enterOpacity = interpolate(enterSpring, [0, 0.3], [0, 1], {
        extrapolateRight: "clamp",
    });
    const opacity = Math.min(enterOpacity, exitOpacity);

    // ── Position mapping ──────────────────────────────────────────────────────
    const positionStyle = POSITION_MAP[position] ?? POSITION_MAP["bottom_left"];
    const baseTransform = positionStyle.transform ?? "";
    const transform = `${baseTransform} scale(${scale})`.trim();

    return (
        <div
            style={{
                position: "absolute",
                ...positionStyle,
                padding: "0 48px",
                opacity,
                transform,
                transformOrigin: TRANSFORM_ORIGIN[position] ?? "bottom left",
                pointerEvents: "none",
            }}
        >
            <span
                style={{
                    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                    fontWeight: 900,
                    fontSize: 72,
                    lineHeight: 1.05,
                    color: "#FFFFFF",
                    textTransform: "uppercase",
                    letterSpacing: "-0.01em",
                    textShadow: [
                        "3px 3px 0px rgba(0,0,0,0.9)",
                        "-1px -1px 0px rgba(0,0,0,0.7)",
                        "2px -1px 0px rgba(0,0,0,0.7)",
                        "-2px 2px 0px rgba(0,0,0,0.7)",
                        "0px 4px 12px rgba(0,0,0,0.5)",
                    ].join(", "),
                    display: "block",
                    maxWidth: 500,
                }}
            >
                {text}
            </span>
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
    left: { top: "50%", left: 80, transform: "translateY(-50%)" } as any,
    right: { top: "50%", right: 80, transform: "translateY(-50%)" } as any,
    bottom_left: { bottom: 60, left: 80 },
    bottom_right: { bottom: 60, right: 80 },
    bottom_center: { bottom: 60, left: "50%", transform: "translateX(-50%)" } as any,
};

const TRANSFORM_ORIGIN: Record<TextOverlayPosition, string> = {
    left: "left center",
    right: "right center",
    bottom_left: "bottom left",
    bottom_right: "bottom right",
    bottom_center: "bottom center",
};
