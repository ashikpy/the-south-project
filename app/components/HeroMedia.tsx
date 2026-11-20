"use client";

import { useEffect, useRef } from "react";

// Frame shown instead of playback under reduced motion.
const STILL_AT = 9;
// Seconds from first paint: just after the loader's wordmark lifts away.
const START_AT = 3.2;

/**
 * Hero backdrop: the deep ocean (NEXIO, the brief's opening image).
 *
 * It plays once from black, so it rises straight out of the loader, then
 * holds on its last frame (no loop attribute, so the browser keeps it).
 *
 * Also a gentle pointer response: the scene shifts a few pixels against
 * the cursor, eased so it feels like looking through a window.
 * Pointer and playback are off under reduced motion (a still of the rays
 * stays). No poster: the clip's black first frame is the intro's backdrop.
 */
export default function HeroMedia() {
  const ref = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  // Plays once, then rests on its final frame.
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.currentTime = STILL_AT;
      return;
    }

    // Start as the loader lifts, so the clip's own rise from black is seen.
    const startIn = Math.max(0, START_AT * 1000 - performance.now());
    const start = window.setTimeout(() => el.play().catch(() => {}), startIn);

    return () => window.clearTimeout(start);
  }, []);

  // Pointer response.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!finePointer || reduced) return;

    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let raf = 0;

    const tick = () => {
      x += (targetX - x) * 0.06;
      y += (targetY - y) * 0.06;
      el.style.setProperty("--mx", x.toFixed(4));
      el.style.setProperty("--my", y.toFixed(4));
      raf =
        Math.abs(targetX - x) > 0.0005 || Math.abs(targetY - y) > 0.0005
          ? requestAnimationFrame(tick)
          : 0;
    };

    const onMove = (e: PointerEvent) => {
      targetX = e.clientX / window.innerWidth - 0.5;
      targetY = e.clientY / window.innerHeight - 0.5;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="hero-media" aria-hidden="true">
      {/* Scroll dive (Dive.tsx): zooms the whole scene toward the deep. */}
      <div className="hero-media-dive">
        <div className="hero-media-pointer" ref={ref}>
          <div className="hero-media-drift">
            <video
              ref={video}
              className="hero-bg"
              muted
              playsInline
              preload="auto"
              disablePictureInPicture
            >
              <source
                src="/hero/ocean-720.mp4"
                type="video/mp4"
                media="(max-width: 900px)"
              />
              <source src="/hero/ocean-1080.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
      </div>
      <div className="hero-grade" />
      {/* Darkness of depth; the particles live in DeepParticles.tsx. */}
      <div className="hero-deep" />
    </div>
  );
}
