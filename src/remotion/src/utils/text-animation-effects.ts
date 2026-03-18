import {
  spring,
  interpolate,
} from "remotion";

export type AnimationPreset =
  | "default"
  | "cascade"
  | "pulse"
  | "emphasis"
  | "reveal"
  | "color-shift";

interface AnimationEffectConfig {
  frame: number;
  wordIndex: number;
  totalWords: number;
  durationInFrames: number;
  wordDelay: number;
  highlightWord?: string;
}

interface AnimationEffect {
  transform: string;
  opacity: number;
  filter: string;
  color: string;
}

/**
 * Apply default animation effect (word-by-word spring entry)
 * Current behavior - baseline animation
 */
function applyDefaultEffect(config: AnimationEffectConfig): AnimationEffect {
  const { frame, wordIndex, wordDelay } = config;
  const displayFrame = frame - wordIndex * wordDelay;

  const wordSpringValue = spring({
    fps: 30,
    frame: Math.max(0, displayFrame),
    config: { damping: 16, stiffness: 120 },
  });

  const wordTranslateY = interpolate(wordSpringValue, [0, 1], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const wordOpacity = displayFrame < 0 ? 0 : 1;

  return {
    transform: `translateY(${wordTranslateY}px)`,
    opacity: wordOpacity,
    filter: "none",
    color: "white",
  };
}

/**
 * Cascade effect: Slower, staggered reveal (8-frame delay vs 4)
 * Reads as more deliberate and emphatic
 */
function applyCascadeEffect(config: AnimationEffectConfig): AnimationEffect {
  const CASCADE_DELAY = 8;
  const { frame, wordIndex } = config;
  const displayFrame = frame - wordIndex * CASCADE_DELAY;

  const wordSpringValue = spring({
    fps: 30,
    frame: Math.max(0, displayFrame),
    config: { damping: 14, stiffness: 140 }, // bouncier spring
  });

  const wordTranslateY = interpolate(wordSpringValue, [0, 1], [60, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const wordOpacity = displayFrame < 0 ? 0 : 1;

  return {
    transform: `translateY(${wordTranslateY}px)`,
    opacity: wordOpacity,
    filter: "none",
    color: "white",
  };
}

/**
 * Pulse effect: Standard entry, then words pulse 3 times
 * Draws attention to certain moments
 */
function applyPulseEffect(config: AnimationEffectConfig): AnimationEffect {
  const { frame, wordIndex, wordDelay } = config;
  const displayFrame = frame - wordIndex * wordDelay;

  const entryDuration = 15;
  const entrySpring = spring({
    fps: 30,
    frame: Math.max(0, displayFrame),
    config: { damping: 16, stiffness: 120 },
  });

  let wordTranslateY = 40;
  let wordScale = 1;

  if (displayFrame >= 0) {
    wordTranslateY = interpolate(entrySpring, [0, 1], [40, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    // Pulse after entry finishes
    if (displayFrame > entryDuration) {
      const pulseFrame = (displayFrame - entryDuration) % 30;
      const pulseCycle = (displayFrame - entryDuration) / 30;
      if (pulseCycle < 3) {
        // Pulse 3 times
        wordScale = interpolate(pulseFrame, [0, 15, 30], [1, 1.08, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
      }
    }
  }

  const wordOpacity = displayFrame < 0 ? 0 : 1;

  return {
    transform: `translateY(${wordTranslateY}px) scale(${wordScale})`,
    opacity: wordOpacity,
    filter: "none",
    color: "white",
  };
}

/**
 * Emphasis effect: Highlight word becomes extra large with glow
 * Perfect for hero moments and key phrases
 */
function applyEmphasisEffect(config: AnimationEffectConfig): AnimationEffect {
  const { frame, wordIndex, wordDelay, highlightWord } = config;
  const displayFrame = frame - wordIndex * wordDelay;

  const entrySpring = spring({
    fps: 30,
    frame: Math.max(0, displayFrame),
    config: { damping: 12, stiffness: 150 }, // Snappier
  });

  const baseScale = highlightWord ? 1.15 : 1;
  const wordScale = interpolate(entrySpring, [0, 1], [0.8, baseScale], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const wordTranslateY = interpolate(entrySpring, [0, 1], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const wordOpacity = displayFrame < 0 ? 0 : 1;
  const glowIntensity = highlightWord ? 2 : 0.5;

  return {
    transform: `scale(${wordScale}) translateY(${wordTranslateY}px)`,
    opacity: wordOpacity,
    filter: `drop-shadow(0 0 ${10 * glowIntensity}px rgba(0, 210, 255, 0.8))`,
    color: "white",
  };
}

/**
 * Reveal effect: Fade in with blur removing progressively
 * Elegant, cinematic entrance
 */
function applyRevealEffect(config: AnimationEffectConfig): AnimationEffect {
  const { frame, wordIndex, wordDelay } = config;
  const displayFrame = frame - wordIndex * wordDelay;

  const revealProgress = Math.max(0, Math.min(1, displayFrame / 15));

  const wordBlur = interpolate(revealProgress, [0, 1], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const wordOpacity = interpolate(revealProgress, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return {
    transform: "translateY(0px)",
    opacity: wordOpacity,
    filter: `blur(${wordBlur}px)`,
    color: "white",
  };
}

/**
 * Color shift effect: Fade from dim to bright white
 * Builds momentum as text becomes more visible
 */
function applyColorShiftEffect(config: AnimationEffectConfig): AnimationEffect {
  const { frame, wordIndex, wordDelay } = config;
  const displayFrame = frame - wordIndex * wordDelay;

  const colorProgress = Math.max(0, Math.min(1, displayFrame / 12));

  const brightness = interpolate(colorProgress, [0, 1], [0.4, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const wordOpacity = displayFrame < 0 ? 0 : 1;

  return {
    transform: "translateY(0px)",
    opacity: wordOpacity * brightness,
    filter: "none",
    color: `rgba(255, 255, 255, ${brightness})`,
  };
}

/**
 * Apply animation effect based on preset type
 * Returns CSS-ready transform, opacity, filter, color values
 */
export function applyAnimationEffect(
  preset: AnimationPreset,
  config: AnimationEffectConfig
): AnimationEffect {
  switch (preset) {
    case "cascade":
      return applyCascadeEffect(config);
    case "pulse":
      return applyPulseEffect(config);
    case "emphasis":
      return applyEmphasisEffect(config);
    case "reveal":
      return applyRevealEffect(config);
    case "color-shift":
      return applyColorShiftEffect(config);
    case "default":
    default:
      return applyDefaultEffect(config);
  }
}
