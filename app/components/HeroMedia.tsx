"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

/**
 * Hero photograph with a gentle pointer response: the scene shifts a few
 * pixels against the cursor, eased so it feels like looking through a window
 * rather than dragging a picture. Off on touch screens and reduced motion.
 *
 * Also carries the sun's light: a slow warm glow on the sun and a faint
 * anamorphic streak along the horizon, both placed in image coordinates.
 */
export default function HeroMedia() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!finePointer || reduced) return;

    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let frame = 0;

    const tick = () => {
      x += (targetX - x) * 0.06;
      y += (targetY - y) * 0.06;
      el.style.setProperty("--mx", x.toFixed(4));
      el.style.setProperty("--my", y.toFixed(4));
      frame =
        Math.abs(targetX - x) > 0.0005 || Math.abs(targetY - y) > 0.0005
          ? requestAnimationFrame(tick)
          : 0;
    };

    const onMove = (e: PointerEvent) => {
      targetX = e.clientX / window.innerWidth - 0.5;
      targetY = e.clientY / window.innerHeight - 0.5;
      if (!frame) frame = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="hero-media" aria-hidden="true">
      <div className="hero-media-pointer" ref={ref}>
        <div className="hero-media-drift">
          <Image
            src="/hero/beach.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="hero-bg"
          />
          <div className="hero-sun" />
          <div className="hero-flare" />
        </div>
      </div>
      <div className="hero-grade" />
    </div>
  );
}
