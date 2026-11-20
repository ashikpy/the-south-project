"use client";

import { useEffect, useState } from "react";
import LightRays from "./LightRays";

// Seconds from first paint: as the loader finishes writing the wordmark,
// so light starts falling through the dark while the name is still on
// screen, ahead of the video coming up at 3.2s.
const START_AT = 2;

/**
 * Sunlight from the surface at the top of the hero (React Bits LightRays),
 * laid over the ocean video and under the type. Mounted on cue so its
 * built-in intro is seen, not spent behind the loader.
 */
export default function HeroRays() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setOn(true),
      Math.max(0, START_AT * 1000 - performance.now()),
    );
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="hero-rays" aria-hidden="true">
      {on && (
        <LightRays
          raysOrigin="top-center"
          raysColor="#7FE3FF"
          raysSpeed={0.5}
          lightSpread={1}
          rayLength={3}
          glow={0.6}
          haze={0.5}
          followMouse
          mouseInfluence={0.1}
          rayDensity={1.6}
          raySharpness={0.5}
          atmosphere={0.7}
          distortion={0.12}
        />
      )}
    </div>
  );
}
