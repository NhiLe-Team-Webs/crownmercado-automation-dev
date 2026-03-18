import React from "react";
import {
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring,
} from "remotion";

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
    const { fps } = useVideoConfig();

    const exitFrame = durationInFrames - 15;

    // ── Enter: slide-in từ trái ─────────────────────────────────────────────
    const enterProgress = spring({
        frame: frame,
        fps,
        config: { damping: 18, stiffness: 120, mass: 1 },
        durationInFrames: 30,
    });


    // ── Exit: fade out ───────────────────────────────────────────────────────
    const exitOpacity = interpolate(
        frame,
        [exitFrame, exitFrame + 12],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

    const translateX = interpolate(enterProgress, [0, 1], [position === "left" ? -40 : 40, 0]);
    const panelOpacity = Math.min(
        interpolate(enterProgress, [0, 1], [0, 1]),
        exitOpacity
    );

    // Text fade-up (delayed slightly)
    const textProgress = spring({
        frame: Math.max(0, frame - 4),
        fps,
        config: { damping: 20, stiffness: 130, mass: 0.9 },
        durationInFrames: 25,
    });

    const textTranslateY = interpolate(textProgress, [0, 1], [10, 0]);
    const textOpacity = Math.min(
        interpolate(textProgress, [0, 1], [0, 1]),
        exitOpacity
    );
    const panelText = text.toUpperCase();
    const totalChars = panelText.replace(/\s+/g, "").length;
    const longestToken = panelText
        .split(/\s+/)
        .reduce((max, token) => Math.max(max, token.length), 0);
    const adaptiveFontSize = longestToken > 15
        ? 50
        : longestToken > 12
            ? 56
            : totalChars > 20
                ? 60
                : 68;

    const underlineSpring = spring({
        frame: Math.max(0, frame - 8),
        fps,
        config: { damping: 16, stiffness: 110, mass: 1 },
        durationInFrames: 20,
    });
    const underlineScaleX = interpolate(underlineSpring, [0, 1], [0, 1]);

    return (
        <div
            style={{
                position: "absolute",
                top: 0,
                [position]: 0,
                width: "38%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: panelOpacity,
                transform: `translateX(${translateX}px)`,
                background: "rgba(255, 255, 255, 0.96)",
                backdropFilter: "blur(2px)",
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
                        whiteSpace: "normal",
                        wordBreak: "keep-all",
                        overflowWrap: "normal",
                        hyphens: "none",
                    }}
                >
                    {panelText}
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
