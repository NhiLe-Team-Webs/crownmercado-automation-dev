import React from "react";
import {
    useCurrentFrame,
    interpolate,
    Easing
} from "remotion";
import { preventOrphanLines } from "../utils/smart-text-wrapper";

interface SidePanelOverlayProps {
    text: string;
    /** Số frames overlay tồn tại */
    durationInFrames: number;
    position?: "left" | "right";
}

/**
 * Side Panel Overlay
 *
 * Panel trắng slide in từ bên trái hoặc phải, text fade-up nhẹ.
 * Chiếm ~38% chiều ngang, dọc center.
 */
export const SidePanelOverlay: React.FC<SidePanelOverlayProps> = ({
    text,
    durationInFrames,
    position = "left",
}) => {
    const frame = useCurrentFrame();
    const exitFrame = durationInFrames - 10;

    // ── Enter: Trượt chậm hơn để mượt (20 frames) ───────────────────────────
    const enterProgress = interpolate(
        frame,
        [0, 20],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
    );

    // ── Exit: Trượt ra hoặc fade (đồng bộ 10 frames) ─────────────────────────
    const exitOpacity = interpolate(
        frame,
        [exitFrame, durationInFrames - 1],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
    );

    // Slide in from off-screen (-100%) to neutral (0%)
    const translateX = interpolate(enterProgress, [0, 1], [position === "left" ? -100 : 100, 0]);
    
    // Panel appearance: Slide is primary, but we use exitOpacity for clean departure
    const panelOpacity = exitOpacity;

    // Text fade-up (slightly delayed, follow the slower panel)
    const textProgress = interpolate(
        frame,
        [8, 22],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
    );

    const textTranslateY = interpolate(textProgress, [0, 1], [10, 0]);
    const textOpacity = Math.min(textProgress, exitOpacity);
    const panelText = text.toUpperCase();
    const processedPanelText = preventOrphanLines(panelText);
    const totalChars = panelText.replace(/\s+/g, "").length;
    const longestToken = panelText
        .split(/\s+/)
        .reduce((max, token) => Math.max(max, token.length), 0);
    const adaptiveFontSize = longestToken > 15
        ? 42
        : longestToken > 12
            ? 48
            : totalChars > 20
                ? 54
                : 60;

    const underlineScaleX = interpolate(textProgress, [0, 1], [0, 1]);

    return (
        <div
            style={{
                position: "absolute",
                top: 0,
                [position]: 0,
                width: "33%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: panelOpacity,
                transform: `translateX(${translateX}%)`,
                background: "rgba(255, 255, 255, 1.0)",
                backdropFilter: "blur(8px)",
                boxShadow: position === "left"
                    ? "4px 0 24px rgba(0,0,0,0.08)"
                    : "-4px 0 24px rgba(0,0,0,0.08)",
                padding: "0 48px",
                boxSizing: "border-box",
            }}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: "82%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    gap: 18,
                    opacity: textOpacity,
                    transform: `translateY(${textTranslateY}px)`,
                }}
            >
                <p
                    style={{
                        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                        fontWeight: 800,
                        fontSize: adaptiveFontSize,
                        lineHeight: 1.08,
                        color: "#1a1a1a",
                        textTransform: "uppercase",
                        textAlign: "left",
                        margin: 0,
                        letterSpacing: "-0.03em",
                        whiteSpace: "pre-line",
                        wordBreak: "keep-all",
                        overflowWrap: "break-word",
                        overflow: "hidden",
                    }}
                >
                    {processedPanelText}
                </p>

                <div
                    style={{
                        width: 124,
                        height: 7,
                        borderRadius: 4,
                        background: "#111111",
                        transformOrigin: "left center",
                        transform: `scaleX(${underlineScaleX})`,
                    }}
                />
            </div>
        </div>
    );
};
