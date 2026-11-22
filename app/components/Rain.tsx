"use client";

import { useEffect, useRef, type RefObject } from "react";

const DROPS = 260;

/**
 * Light rain over ORIGO's hills: thin pale streaks at three depths, blown a
 * little from the sunny side. `amount` (0–1) is read each frame; at 0 the
 * canvas is cleared once and the loop idles. Drawn at 1x, as rain is soft.
 * Nothing runs under reduced motion.
 */
export default function Rain({
  amount,
  className,
}: {
  amount: RefObject<number>;
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
    const resize = () => {
      w = el.width = el.clientWidth;
      h = el.height = el.clientHeight;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const drops = Array.from({ length: DROPS }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      depth: i % 3, // 0 far, 2 near
    }));

    let raf = 0;
    let drawn = false;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const a = amount.current ?? 0;
      if (a < 0.01) {
        if (drawn) ctx.clearRect(0, 0, w, h);
        drawn = false;
        return;
      }
      drawn = true;
      ctx.clearRect(0, 0, w, h);

      // Fewer drops on narrow screens, so it stays light.
      const count = DROPS * Math.min(1, Math.max(0.4, w / 1400)) * a;
      for (let depth = 0; depth < 3; depth++) {
        const length = 14 + depth * 14;
        const speed = 0.5 + depth * 0.28; // screens a second
        ctx.strokeStyle = `rgba(232, 242, 250, ${a * (0.2 + depth * 0.1)})`;
        ctx.lineWidth = 0.7 + depth * 0.35;
        ctx.beginPath();
        for (let i = depth; i < count; i += 3) {
          const d = drops[i];
          const fall = (d.y + (now / 1000) * speed) % 1;
          const y = fall * (h + length) - length;
          const x = (((d.x * w + y * 0.16) % w) + w) % w;
          ctx.moveTo(x, y);
          ctx.lineTo(x + length * 0.16, y + length);
        }
        ctx.stroke();
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [amount]);

  return <canvas ref={canvas} className={className} aria-hidden="true" />;
}
