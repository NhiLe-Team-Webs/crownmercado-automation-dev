import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";
import { preventOrphanLines } from "../utils/smart-text-wrapper";

interface BottomTitleProps {
    text: string;
    durationInFrames: number;
}

/**
 * Bottom Title Overlay
 *
 * Text bự, kéo dài ngang màn hình ở phía dưới (như title slide).
 * Phù hợp cho việc nói chuyển chủ đề hoặc highlight khái niệm chính.
 */
export const BottomTitle: React.FC<BottomTitleProps> = ({
    text,
    durationInFrames,
}) => {
    const frame = useCurrentFrame();

    const exitFrame = durationInFrames - 10;

    // ── Enter: Trượt nhẹ từ dưới lên + fade in (đồng bộ 10 frames với zoom) ──
    const enterProgress = interpolate(
        frame,
        [0, 10],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
    );

    const translateY = interpolate(enterProgress, [0, 1], [40, 0]);

    // ── Exit: fade out ────────────────────────────────────────────────────────
    const exitOpacity = interpolate(
        frame,
        [exitFrame, durationInFrames - 1],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
    );

    const opacity = Math.min(enterProgress, exitOpacity);
    const titleText = text.toUpperCase();
    const titleLength = titleText.length;
    const adaptiveFontSize = titleLength > 30 ? 58 : titleLength > 22 ? 66 : 80;
    const processedText = preventOrphanLines(titleText);

    return (
        <div
            style={{
                position: "absolute",
                bottom: "8%", // Cách đáy một chút
                left: 0,
                width: "100%",
                display: "flex",
                justifyContent: "center",
                opacity,
                transform: `translateY(${translateY}px)`,
                pointerEvents: "none",
            }}
        >
            <span
                style={{
                    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                    fontWeight: 900,
                    fontSize: adaptiveFontSize,
                    lineHeight: 1.1,
                    color: "#FFFFFF",
                    textTransform: "uppercase",
                    letterSpacing: "-0.01em",
                    whiteSpace: "pre-line",
                    wordBreak: "keep-all",
                    overflowWrap: "break-word",
                    textAlign: "center",
                    maxWidth: "92vw",
                    WebkitTextStroke: "2px rgba(0,0,0,0.6)",
                    textShadow: "6px 6px 0px rgba(0,0,0,0.8), 0px 8px 16px rgba(0,0,0,0.6)",
                }}
            >
                {processedText}
            </span>
        </div>
    );
};
