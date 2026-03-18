import React from "react";
import { AbsoluteFill, OffthreadVideo, interpolate, useCurrentFrame, spring, useVideoConfig, staticFile } from "remotion";
import { smartWrapText } from "../utils/smart-text-wrapper";

export const BRollOverlay: React.FC<{
    url?: string;
    durationInFrames: number;
    text?: string;
    highlightWord?: string;
    focalPoint?: { x: number; y: number };
}> = ({ url, durationInFrames, text, highlightWord, focalPoint }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const normalizedSrc = !url
        ? ""
        : (url.startsWith("http://") || url.startsWith("https://")
            ? url
            : staticFile(url.replace(/^\/+/, "")));
    const effectiveHighlightWord = highlightWord || (() => {
        const candidates = (text || "").split(/\s+/).filter(Boolean);
        if (!candidates.length) {
            return "";
        }
        return candidates.reduce((a, b) => (b.length > a.length ? b : a));
    })();

    // No transitions: Appear instantly as requested
    const opacity = 1;

    const words = text ? text.split(" ") : [];
    const WORD_DELAY = 4; // frames between each word

    // Smart wrap to prevent orphaned words
    const wrappedLines = text ? smartWrapText(text) : [];
    const smartWords: string[] = [];
    wrappedLines.forEach((line, lineIdx) => {
        const lineWords = line.split(" ");
        lineWords.forEach((w, wordIdx) => {
            smartWords.push(w);
        });
    });

    // Use smart words if available, otherwise fallback to original words
    const displayWords = smartWords.length > 0 ? smartWords : words;

    // total time for words to appear securely
    const wordsFinishFrame = displayWords.length * WORD_DELAY + 10;

    const zoomScale = interpolate(
        frame,
        [0, durationInFrames],
        [1.08, 1.15], // Reduced zoom intensity to avoid "jumpy" feel at the end
        { extrapolateRight: "clamp" }
    );

    // Dynamic Subject Correction (Semantic Auto-Framing from Gemini Vision)
    const focalX = focalPoint?.x ?? 50;
    const focalY = focalPoint?.y ?? 50;

    return (
        <AbsoluteFill style={{ opacity }}>
            {normalizedSrc ? (
                <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
                    <OffthreadVideo
                        src={normalizedSrc}
                        muted
                        style={{ 
                            width: "100%", 
                            height: "100%", 
                            objectFit: "cover",
                            objectPosition: `${focalX}% ${focalY}%`,
                            transform: `scale(${zoomScale})`,
                            transformOrigin: `${focalX}% ${focalY}%`,
                        }}
                    />
                </div>
            ) : (
                <AbsoluteFill style={{ background: "radial-gradient(circle at 20% 20%, #2a2a2a 0%, #111 55%, #000 100%)" }} />
            )}



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
                        wordBreak: "keep-all",
                    }}>
                        {displayWords.map((w, i) => {
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

                            const normalizedWord = w.toLowerCase().replace(/[^a-z0-9]/g, '');
                            const normalizedHighlight = effectiveHighlightWord ? effectiveHighlightWord.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
                            const isHighlight = !!effectiveHighlightWord && normalizedWord.length > 2 && normalizedHighlight.length > 2 &&
                                (normalizedWord.includes(normalizedHighlight) || normalizedHighlight.includes(normalizedWord));

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
