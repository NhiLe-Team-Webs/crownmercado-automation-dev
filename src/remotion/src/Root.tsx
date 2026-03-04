import React from "react";
import "./index.css";
import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import type { VideoCompositionProps } from "./types";

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

/** Mock defaultProps để xem preview trong Remotion Studio */
const defaultProps: VideoCompositionProps = {
  videoSrc: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  durationInSeconds: 10,
  fps: FPS,
  overlays: [
    {
      text: "STRATEGY VS TACTICS",
      start: 1,
      end: 4.5,
      mode: "SIDE_PANEL",
      position: "left",
    },
    {
      text: "LASER FOCUSED",
      start: 6,
      end: 9,
      mode: "CINEMATIC_CALLOUT",
      position: "bottom_left",
    },
  ],
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VideoWithOverlays"
        component={MyComposition}
        durationInFrames={defaultProps.durationInSeconds * FPS}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={defaultProps}
      />
    </>
  );
};
