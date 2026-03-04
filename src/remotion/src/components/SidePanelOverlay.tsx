import React from "react";
import {
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring,
} from "remotion";

interface SidePanelOverlayProps {
    text: string;
    /** Absolute frame khi overlay bắt đầu xuất hiện */
    fromFrame: number;
    /** Số frames overlay tồn tại */
    durationInFrames: number;
}

/**
 * Side Panel Overlay
 *
 * Panel trắng slide in từ bên trái, text fade-up nhẹ.
 * Chiếm ~38% chiều ngang, dọc center.
 * Singapore-style: clean, minimal, elegant.
 */
export const SidePanelOverlay: React.FC<SidePanelOverlayProps> = ({
    text,
    fromFrame,
    durationInFrames,
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const relativeFrame = frame - fromFrame;
    const exitFrame = durationInFrames - 15;

    // ── Enter: slide-in từ trái ─────────────────────────────────────────────
    const enterProgress = spring({
        frame: relativeFrame,
        fps,
        config: { damping: 18, stiffness: 120, mass: 1 },
        durationInFrames: 30,
    });

    // ── Exit: fade out ───────────────────────────────────────────────────────
    const exitOpacity = interpolate(
        relativeFrame,
        [exitFrame, exitFrame + 12],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

    const translateX = interpolate(enterProgress, [0, 1], [-40, 0]);
    const panelOpacity = Math.min(
        interpolate(enterProgress, [0, 1], [0, 1]),
        exitOpacity
    );

    // Text fade-up (delayed slightly)
    const textProgress = spring({
        frame: Math.max(0, relativeFrame - 4),
        fps,
        config: { damping: 20, stiffness: 130, mass: 0.9 },
        durationInFrames: 25,
    });
    const textTranslateY = interpolate(textProgress, [0, 1], [10, 0]);
    const textOpacity = Math.min(
        interpolate(textProgress, [0, 1], [0, 1]),
        exitOpacity
    );

    return (
        <div
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "38%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: panelOpacity,
                transform: `translateX(${translateX}px)`,
                background: "rgba(255, 255, 255, 0.96)",
                backdropFilter: "blur(2px)",
                boxShadow: "4px 0 24px rgba(0,0,0,0.08)",
                padding: "0 48px",
                boxSizing: "border-box",
            }}
        >
            {/* Accent bar */}
            <div
                style={{
                    position: "absolute",
                    left: 0,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 5,
                    height: "28%",
                    background: "#1a1a1a",
                    borderRadius: "0 3px 3px 0",
                    opacity: enterProgress,
                }}
            />

            <p
                style={{
                    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                    fontWeight: 800,
                    fontSize: 52,
                    lineHeight: 1.15,
                    color: "#1a1a1a",
                    textAlign: "center",
                    margin: 0,
                    letterSpacing: "-0.02em",
                    opacity: textOpacity,
                    transform: `translateY(${textTranslateY}px)`,
                }}
            >
                {text}
            </p>
        </div>
    );
};
