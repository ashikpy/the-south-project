"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Scroll state shared by Dive.tsx (written there, read here each frame). */
export interface DiveState {
  /** 0–1 position on the whole track */
  track: number;
  /** 0–1: how deep we are (particles fade in with it) */
  deep: number;
  /** 0–1 and beyond: distance travelled forward through the deep */
  forward: number;
}

const COUNT = 520;
const SPREAD = 1.6; // half-width of the particle field in world units
const FOCAL = 0.55; // projection scale, as a fraction of the shorter side

/**
 * Marine snow as a 3D field on a canvas. While sinking, the specks rise past
 * you; once you start moving forward they rush toward you, stretching into
 * short streaks with speed, like swimming through the deep.
 * Idle, they drift very slowly so the water never freezes.
 */
export default function DeepParticles({
  state,
}: {
  state: RefObject<DiveState>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Seeded so the field is the same on every visit.
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const points = Array.from({ length: COUNT }, () => ({
      x: (rand() * 2 - 1) * SPREAD,
      y: (rand() * 2 - 1) * SPREAD,
      z: rand(),
      size: 0.6 + rand() * 1.1,
      glow: 0.45 + rand() * 0.55,
    }));

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = el.clientWidth;
      h = el.clientHeight;
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let last = performance.now();
    let drift = 0;
    let prevCam = 0;
    let speed = 0;

    let drawn = false;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const s = state.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!s || s.deep <= 0.001 || document.hidden) {
        // Cleared once: an untouched canvas costs nothing to show.
        if (drawn) ctx.clearRect(0, 0, el.width, el.height);
        drawn = false;
        return;
      }
      drawn = true;

      drift += dt * 0.012;
      const cam = s.forward * 2.6 + drift;
      // Smoothed forward speed drives the streak length.
      const v = (cam - prevCam) / Math.max(dt, 1e-3);
      prevCam = cam;
      speed += (Math.min(v, 6) - speed) * 0.15;

      const rise = s.track * 3.2 + drift * 0.6;
      const f = Math.min(w, h) * FOCAL;
      const cx = w / 2;
      const cy = h / 2;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";

      for (const p of points) {
        // Depth wraps so the field is endless in front of you.
        let z = (p.z - cam) % 1;
        if (z < 0) z += 1;
        z = 0.03 + z * 0.97;
        let y = ((p.y + rise + SPREAD) % (SPREAD * 2)) - SPREAD;
        if (y < -SPREAD) y += SPREAD * 2;

        const sx = cx + (p.x / z) * f;
        const sy = cy + (y / z) * f;
        if (sx < -40 || sx > w + 40 || sy < -40 || sy > h + 40) continue;

        // Far specks are faint; the nearest fade out before they hit you.
        const alpha =
          s.deep * p.glow * Math.min(1, (1 - z) * 1.6) * Math.min(1, z * 9);
        if (alpha < 0.01) continue;

        const r = Math.min(3.2, (p.size * 0.35) / z);
        // Streak back toward where the speck was a moment ago.
        const tail = Math.min(0.25, speed * 0.02);
        const zb = Math.min(1, z + tail);
        const bx = cx + (p.x / zb) * f;
        const by = cy + (y / zb) * f;

        ctx.strokeStyle = `rgba(214, 232, 236, ${alpha.toFixed(3)})`;
        ctx.lineWidth = r * 2;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(sx + 0.01, sy);
        ctx.stroke();
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [state]);

  return <canvas ref={canvas} className="deep-particles" aria-hidden="true" />;
}
