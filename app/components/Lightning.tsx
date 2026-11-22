"use client";

import { useEffect, useRef, type RefObject } from "react";

/*
 * Flash safety (WCAG 2.3.1 allows no more than three flashes in any second):
 * a strike is two pulses, and strikes never start less than MIN_GAP apart,
 * however fast you scroll back and forth over the storm.
 */
const MIN_GAP = 3500; // ms between strikes
const EXTRA_GAP = 2000; // ...plus up to this, so it isn't regular
const STRIKE: Keyframe[] = [
  { opacity: 0, offset: 0 },
  { opacity: 1, offset: 0.05 },
  { opacity: 0.25, offset: 0.17 },
  { opacity: 0.8, offset: 0.27 },
  { opacity: 0.3, offset: 0.5 },
  { opacity: 0, offset: 1 },
];
const DURATION = 950; // ms

type Point = readonly [number, number];

/** A jagged path between two points, by repeatedly nudging the midpoints. */
function jagged(from: Point, to: Point): Point[] {
  let points = [from, to];
  let offset = Math.hypot(to[0] - from[0], to[1] - from[1]) * 0.17;
  for (let i = 0; i < 6; i++) {
    const next: Point[] = [points[0]];
    for (let j = 1; j < points.length; j++) {
      const [ax, ay] = points[j - 1];
      const [bx, by] = points[j];
      next.push(
        [(ax + bx) / 2 + (Math.random() - 0.5) * offset, (ay + by) / 2 + (Math.random() - 0.5) * offset * 0.35],
        points[j],
      );
    }
    points = next;
    offset *= 0.56;
  }
  return points;
}

/** The glow, as wide faint strokes (no blur to compute), then the hot core. */
function stroke(ctx: CanvasRenderingContext2D, points: Point[], width: number, alpha: number) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  for (const [w, a, colour] of [
    [22, 0.035, "150,180,255"],
    [10, 0.09, "160,195,255"],
    [4, 0.28, "200,220,255"],
    [1.4, 1, "250,252,255"],
  ] as const) {
    ctx.strokeStyle = `rgba(${colour},${a * alpha})`;
    ctx.lineWidth = w * width;
    ctx.stroke();
  }
}

/**
 * Lightning over ORIGO, drawn in the scene behind the mountain, so each bolt
 * lands beyond the ridge. A bolt is drawn once per strike; the flicker, and
 * the light it throws on the land (`flash`), are opacity animations.
 * `amount` is the rain (0–1). Nothing runs under reduced motion.
 */
export default function Lightning({
  amount,
  flash,
  className,
}: {
  amount: RefObject<number>;
  flash: RefObject<HTMLDivElement | null>;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let next = 0;
    let onLeft = Math.random() < 0.5;
    let running: Animation[] = [];

    const strike = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      el.width = w; // also clears the last bolt
      el.height = h;
      const box = el.getBoundingClientRect();
      const view = document.documentElement.clientWidth;

      // Either side of the peak, in the part of the scene that's on screen.
      onLeft = !onLeft;
      const at = view * (onLeft ? 0.12 + Math.random() * 0.14 : 0.74 + Math.random() * 0.14);
      const x = at - box.left;
      const top = Math.max(0, -box.top) - 12;
      const main = jagged([x + (Math.random() - 0.5) * h * 0.15, top], [x, h * 0.56]);

      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      stroke(ctx, main, 1.35, 1);
      for (let i = 0; i < 5; i++) {
        const from = main[Math.floor(main.length * (0.08 + Math.random() * 0.6))];
        const side = Math.random() < 0.5 ? -1 : 1;
        const reach = h * (0.06 + Math.random() * 0.12);
        stroke(ctx, jagged(from, [from[0] + side * reach * 0.7, from[1] + reach]), 0.6, 0.6);
      }

      const land = flash.current;
      land?.style.setProperty("--flash-x", `${(at / view) * 100}%`);
      running = [el, land].flatMap((node) =>
        node ? [node.animate(STRIKE, { duration: DURATION, easing: "linear" })] : [],
      );
    };

    const timer = window.setInterval(() => {
      const storm = amount.current ?? 0;
      if (storm < 0.2) {
        running.forEach((a) => a.cancel());
        running = [];
        return;
      }
      const now = performance.now();
      if (storm < 0.6 || now < next || document.hidden) return;
      strike();
      next = now + MIN_GAP + Math.random() * EXTRA_GAP;
    }, 120);

    return () => {
      window.clearInterval(timer);
      running.forEach((a) => a.cancel());
    };
  }, [amount, flash]);

  return <canvas ref={canvas} className={className} aria-hidden="true" />;
}
