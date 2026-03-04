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
                            />
                        )}
                        {overlay.mode === "BOTTOM_TITLE" && (
                            <BottomTitle
                                text={overlay.text}
                                durationInFrames={durationInFrames}
                            />
                        )}
                        {overlay.mode === "B_ROLL_VIDEO" && overlay.url && (
                            <BRollOverlay
                                url={overlay.url}
                                durationInFrames={durationInFrames}
                                text={overlay.text}
                                highlightWord={overlay.highlight_word}
                            />
                        )}
                        {overlay.mode === "CINEMATIC_CALLOUT" && (
                            <CinematicCallout
                                text={overlay.text}
                                durationInFrames={durationInFrames}
                                position={overlay.position}
                            />
                        )}
                    </Sequence>
                );
            })}
        </>
    );
};
