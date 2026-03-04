import React from "react";
import { AbsoluteFill, OffthreadVideo, interpolate, useCurrentFrame, spring, useVideoConfig } from "remotion";

export const BRollOverlay: React.FC<{
    url: string;
    durationInFrames: number;
    text?: string;
    highlightWord?: string;
}> = ({ url, durationInFrames, text, highlightWord }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Fade in 15 frames, Fade out 15 frames
    const FADE_DUR = 15;

    const opacity = interpolate(
        frame,
        [0, FADE_DUR, durationInFrames - FADE_DUR, durationInFrames],
        [0, 1, 1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

    const words = text ? text.split(" ") : [];
    const WORD_DELAY = 4; // frames between each word

    // total time for words to appear securely
    const wordsFinishFrame = words.length * WORD_DELAY + 10;

    return (
        <AbsoluteFill style={{ opacity, backgroundColor: "black" }}>
            <OffthreadVideo
                src={url}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />

            {/* Overlay Gradient for text readability */}
            {text && (
                <AbsoluteFill style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)" }} />
            )}

            {/* Text Layer */}
            {text && (
                <AbsoluteFill
                    style={{
                        justifyContent: "flex-end",
                        alignItems: "center",
                        paddingBottom: "120px",
                    }}
                >
                    <div style={{
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "center",
                        maxWidth: "80%",
                        gap: "16px", // space between words
                        fontFamily: "'Inter', sans-serif",
                        fontWeight: 900,
                        fontSize: "72px",
                        lineHeight: 1.2,
                        color: "white",
                        textShadow: "0px 4px 12px rgba(0,0,0,0.5)",
                    }}>
                        {words.map((w, i) => {
                            const delay = i * WORD_DELAY;

                            const wordSpring = spring({
                                fps,
                                frame: frame - delay,
                                config: { damping: 16, stiffness: 120 },
                            });

                            const wordTranslateY = interpolate(wordSpring, [0, 1], [40, 0]);

                            const wordOpacity = interpolate(
                                frame - delay,
                                [0, 5],
                                [0, 1],
                                { extrapolateRight: "clamp" }
                            );

                            const isHighlight = highlightWord && w.toLowerCase().includes(highlightWord.toLowerCase());

                            // Alternate between Cyan and Red depending on text length & word index
                            const useRed = (i + (text?.length || 0)) % 2 === 0;
                            const colorTheme = useRed ?
                                { text: "#ff3333", glow: "rgba(255, 51, 51, 0.8)", bg: "linear-gradient(90deg, #ff3333 0%, #ff6666 100%)" } :
                                { text: "#00d2ff", glow: "rgba(0, 210, 255, 0.8)", bg: "linear-gradient(90deg, #00d2ff 0%, #3a7bd5 100%)" };

                            return (
                                <span key={i} style={{
                                    position: "relative",
                                    opacity: wordOpacity,
                                    transform: `translateY(${wordTranslateY}px)`,
                                    display: "inline-block",
                                    color: isHighlight ? colorTheme.text : "white",
                                    textShadow: isHighlight
                                        ? `0 0 20px ${colorTheme.glow}, 0px 4px 12px rgba(0,0,0,0.5)`
                                        : "0px 4px 12px rgba(0,0,0,0.5)",
                                    textTransform: isHighlight ? "uppercase" : "none",
                                    paddingRight: isHighlight ? "4px" : "0px", // prevent clipping of intense glow
                                }}>
                                    {w}
                                    {isHighlight && (
                                        <div
                                            style={{
                                                position: "absolute",
                                                bottom: "-8px",
                                                left: 0,
                                                right: 0,
                                                height: "8px",
                                                borderRadius: "4px",
                                                background: colorTheme.bg,
                                                boxShadow: `0 0 15px ${colorTheme.glow}`,
                                                transformOrigin: "left center",
                                                transform: `scaleX(${spring({
                                                    fps,
                                                    frame: frame - wordsFinishFrame,
                                                    config: { damping: 18, stiffness: 100 },
                                                })})`,
                                            }}
                                        />
                                    )}
                                </span>
                            );
                        })}
                    </div>
                </AbsoluteFill>
            )}
        </AbsoluteFill>
    );
};
