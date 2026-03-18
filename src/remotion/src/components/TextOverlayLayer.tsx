import React from "react";
import { Sequence } from "remotion";
import type { TextOverlay } from "../types";
import { SidePanelOverlay } from "./SidePanelOverlay";
import { CinematicCallout } from "./CinematicCallout";
import { BottomTitle } from "./BottomTitle";
import { BRollOverlay } from "./BRollOverlay";

interface TextOverlayLayerProps {
    overlays: TextOverlay[];
    fps: number;
}

/**
 * TextOverlayLayer
 *
 * Nhận danh sách TextOverlay và render mỗi overlay bằng <Sequence>
 * đúng thời điểm theo start/end (seconds → frames).
 */
export const TextOverlayLayer: React.FC<TextOverlayLayerProps> = ({
    overlays,
    fps,
}) => {
    return (
        <>
            {overlays.map((overlay, index) => {
                const fromFrame = Math.round(overlay.start * fps);
                const durationInFrames = Math.max(
                    Math.round((overlay.end - overlay.start) * fps),
                    1
                );
                const sidePanelPosition = "left";

                return (
                    <Sequence
                        key={`overlay-${index}-${overlay.start}`}
                        from={fromFrame}
                        durationInFrames={durationInFrames}
                        layout="none"
                    >
                        {overlay.mode === "SIDE_PANEL" && (
                            <SidePanelOverlay
                                text={overlay.text}
                                durationInFrames={durationInFrames}
                                position={sidePanelPosition}
                            />
                        )}
                        {overlay.mode === "BOTTOM_TITLE" && (
                            <BottomTitle
                                text={overlay.text}
                                durationInFrames={durationInFrames}
                            />
                        )}
                        {overlay.mode === "B_ROLL_VIDEO" && (
                            <BRollOverlay
                                url={overlay.url || ""}
                                durationInFrames={durationInFrames}
                                text={overlay.text}
                                highlightWord={overlay.highlight_word}
                                focalPoint={overlay.focal_point}
                                animationPreset={overlay.animation_preset}
                            />
                        )}
                        {overlay.mode === "CINEMATIC_CALLOUT" && (
                            <CinematicCallout
                                text={overlay.text}
                                durationInFrames={durationInFrames}
                                position={(() => {
                                    const isCta = /subscribe|follow|like|share|comment|đăng ký/i.test(
                                        overlay.text
                                    );
                                    if (isCta) {
                                        return "bottom_center";
                                    }

                                    const upcomingHighlights = overlays.slice(index + 1).filter(
                                        (next) => next.mode !== "B_ROLL_VIDEO"
                                    );
                                    const hasFutureRightCallout = upcomingHighlights.some(
                                        (next) =>
                                            next.mode === "CINEMATIC_CALLOUT" && next.position === "right"
                                    );
                                    const isLastHighlight = upcomingHighlights.length === 0;

                                    if (
                                        isLastHighlight &&
                                        overlay.position !== "right" &&
                                        !hasFutureRightCallout
                                    ) {
                                        return "bottom_center";
                                    }

                                    return overlay.position;
                                })()}
                            />
                        )}
                    </Sequence>
                );
            })}
        </>
    );
};
