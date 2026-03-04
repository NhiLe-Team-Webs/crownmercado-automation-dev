import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

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
    const { fps } = useVideoConfig();

    const exitFrame = durationInFrames - 15;

    // ── Enter: Trượt nhẹ từ dưới lên + fade in ──────────────────────────────
    const enterSpring = spring({
        frame: frame,
        fps,
        config: { damping: 14, stiffness: 100, mass: 1 },
        durationInFrames: 25,
    });

    const translateY = interpolate(enterSpring, [0, 1], [40, 0]);

    // ── Exit: fade out ────────────────────────────────────────────────────────
    const exitOpacity = interpolate(
        frame,
        [exitFrame, exitFrame + 12],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

    const enterOpacity = interpolate(enterSpring, [0, 0.5], [0, 1], {
        extrapolateRight: "clamp",
    });
    const opacity = Math.min(enterOpacity, exitOpacity);

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
                    fontSize: 80, // Điều chỉnh xuống từ 100px
                    lineHeight: 1.1,
                    color: "#FFFFFF",
                    textTransform: "uppercase",
                    letterSpacing: "-0.01em",
                    whiteSpace: "pre-wrap",
                    wordBreak: "keep-all",
                    textAlign: "center",
                    maxWidth: "85vw", // Gần full màn hình ngang
                    WebkitTextStroke: "2px rgba(0,0,0,0.6)",
                    textShadow: "6px 6px 0px rgba(0,0,0,0.8), 0px 8px 16px rgba(0,0,0,0.6)",
                }}
            >
                {text}
            </span>
        </div>
    );
};
