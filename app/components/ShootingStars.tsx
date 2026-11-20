"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Shooting stars for the space section: every few seconds one long streak
 * crosses the sky with a bright head and a tapering trail; now and then a
 * rarer, brighter, warmer one, like a fireball. Drawn on a canvas behind the
 * Earth (the planet hides any that pass behind it).
 *
 * `active` is read each frame: streaks only start while it is true, and the
 * loop idles otherwise. Nothing runs under reduced motion.
 */

interface Streak {
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  length: number;
  width: number;
  age: number;
  life: number;
  warm: boolean;
}

export default function ShootingStars({
  active,
  className,
}: {
  active: RefObject<boolean>;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

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

    const streaks: Streak[] = [];
    // The first comes soon after you arrive in space; then every few seconds.
    let next = 1.2;
    const spawn = () => {
      const warm = Math.random() < 0.18;
      // Mostly down and to the right, at slightly different slopes;
      // sometimes the other way.
      const flip = Math.random() < 0.3 ? -1 : 1;
      const angle = ((22 + Math.random() * 22) * Math.PI) / 180;
      const dx = Math.cos(angle) * flip;
      const dy = Math.sin(angle);
      streaks.push({
        x: flip > 0 ? Math.random() * w * 0.6 : w * (0.4 + Math.random() * 0.6),
        y: Math.random() * h * 0.45,
        dx,
        dy,
        speed: (warm ? 520 : 760) + Math.random() * 420,
        length: (warm ? 320 : 200) + Math.random() * 160,
        width: warm ? 2.4 : 1.4 + Math.random() * 0.5,
        age: 0,
        life: (warm ? 1.5 : 0.9) + Math.random() * 0.4,
        warm,
      });
    };

    let raf = 0;
    let last = performance.now();
    let drawn = false;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const on = active.current;

      if (on) {
        next -= dt;
        if (next <= 0) {
          spawn();
          next = 2.6 + Math.random() * 3.2;
        }
      }
      if (!streaks.length) {
        if (drawn) {
          ctx.clearRect(0, 0, el.width, el.height);
          drawn = false;
        }
        return;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";
      drawn = true;

      for (let i = streaks.length - 1; i >= 0; i--) {
        const s = streaks[i];
        s.age += dt;
        if (s.age >= s.life) {
          streaks.splice(i, 1);
          continue;
        }
        const t = s.age / s.life;
        // Fades in fast, out slowly; the trail grows to full length.
        const alpha = Math.min(1, t / 0.12) * (1 - Math.max(0, (t - 0.55) / 0.45));
        const travelled = s.age * s.speed;
        const hx = s.x + s.dx * travelled;
        const hy = s.y + s.dy * travelled;
        const len = Math.min(s.length, travelled);
        const tx = hx - s.dx * len;
        const ty = hy - s.dy * len;

        const head = s.warm ? "255, 226, 188" : "236, 242, 255";
        const tail = s.warm ? "255, 170, 110" : "150, 200, 255";
        // Tapering trail: a few strokes, wide and faint to thin and bright.
        for (const [k, a] of [
          [1, 0.35],
          [0.55, 0.8],
        ] as const) {
          const g = ctx.createLinearGradient(hx, hy, tx, ty);
          g.addColorStop(0, `rgba(${head}, ${(alpha * a).toFixed(3)})`);
          g.addColorStop(0.25, `rgba(${tail}, ${(alpha * a * 0.45).toFixed(3)})`);
          g.addColorStop(1, `rgba(${tail}, 0)`);
          ctx.strokeStyle = g;
          ctx.lineWidth = s.width * k;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(hx, hy);
          ctx.stroke();
        }
        // Bright head with a small glow.
        const r = s.width * (s.warm ? 4 : 3);
        const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, r);
        glow.addColorStop(0, `rgba(255, 255, 255, ${alpha.toFixed(3)})`);
        glow.addColorStop(0.3, `rgba(${head}, ${(alpha * 0.5).toFixed(3)})`);
        glow.addColorStop(1, `rgba(${head}, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(hx, hy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [active]);

  return <canvas ref={canvas} className={className} aria-hidden="true" />;
}
