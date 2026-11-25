"use client";

import { useEffect, useRef, type CSSProperties, type RefObject } from "react";
import Plane, { type PlaneView } from "./Plane";
import "./Cultura.css";

/** The fields' exports, for the browser to pick from. */
const GROUND = [1920, 2560]
  .map((w) => `/cultura/ground-${w}.webp ${w}w`)
  .join(", ");
/** The vineyard's layers (public/cultura/vineyard), on one 3:2 canvas. */
const vines = (layer: "sky" | "land" | "near") =>
  (layer === "sky" ? [1920, 2560] : [1920, 2560, 3840])
    .map((w) => `/cultura/vineyard/${layer}-${w}.webp ${w}w`)
    .join(", ");
/* The canvas covers the screen: on all but wide screens its width follows the height. */
const VINE_SIZES = "(max-aspect-ratio: 3/2) 150vh, 100vw";

/**
 * Pollen and dust over the vines, lit gold where the low sun from the left
 * catches it. Runs only while the stage says you are among the vines.
 */
function Pollen() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const stage = el.closest(".dive-stage");

    let w = 0;
    let h = 0;
    const resize = () => {
      const scale = Math.min(1, 1600 / Math.max(1, el.clientWidth));
      w = el.width = Math.round(el.clientWidth * scale);
      h = el.height = Math.round(el.clientHeight * scale);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const motes = Array.from({ length: 110 }, () => ({
      x: Math.random(),
      y: 0.25 + Math.random() * 0.75,
      r: 0.5 + Math.random() * 1.6,
      drift: 0.004 + Math.random() * 0.01,
      rise: -0.002 - Math.random() * 0.004,
      phase: Math.random() * Math.PI * 2,
    }));

    let raf = 0;
    let last = performance.now();
    let drawn = false;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!stage?.classList.contains("is-vineyard") || document.hidden) {
        if (drawn) ctx.clearRect(0, 0, w, h);
        drawn = false;
        last = now;
        return;
      }
      drawn = true;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (const m of motes) {
        // Carried on a light breeze, away from the sun.
        m.x += m.drift * dt * 6;
        m.y += (m.rise + Math.sin(now / 1300 + m.phase) * 0.003) * dt * 6;
        if (m.x > 1.02) m.x = -0.02;
        if (m.y < 0.2) m.y = 1;
        // Lit by the sun on the left, lost in the shade on the right.
        const lit =
          Math.max(0, 1 - m.x * 0.9) *
          (0.55 + 0.45 * Math.sin(now / 700 + m.phase));
        if (lit < 0.04) continue;
        const r = m.r * (w / 1600) * 2.2;
        const g = ctx.createRadialGradient(
          m.x * w,
          m.y * h,
          0,
          m.x * w,
          m.y * h,
          r * 3,
        );
        g.addColorStop(0, `rgba(255, 226, 160, ${0.7 * lit})`);
        g.addColorStop(1, "rgba(255, 200, 120, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(m.x * w, m.y * h, r * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvas} className="vineyard-pollen" aria-hidden="true" />;
}

/**
 * CULTURA, in the air. The plane makes the cut: its shadow crosses the gap
 * in the forest canopy, then it tears across the lens, and behind it the
 * forest is gone and you are in the evening sky over the farmlands. It
 * comes round beside you, then flies off toward the low sun, and CULTURA
 * lights the sky. Dive.tsx drives it with --cultura-word and the plane's
 * own view (Plane.tsx). The sky is revealed behind it as it crosses
 * (--wipe-x), as the camera looks up after it (--sky-tilt).
 *
 * Then down: the camera drops toward the fields (--drop), through the low
 * cloud (--haze), and under it is a vineyard at the height of a drone,
 * settling (--land), then moving on along the rows (--rows): the near rows
 * rush toward you, the far ones less, the trees and sky barely.
 */
export default function Cultura({ plane }: { plane: RefObject<PlaneView> }) {
  const ground = useRef<HTMLImageElement>(null);
  // Mounted early: decode the fields now, not when they first show.
  useEffect(() => {
    ground.current?.decode().catch(() => {});
  }, []);

  return (
    <div className="cultura" aria-hidden="true">
      <div className="cultura-scene">
        {/* The fields and cloud, pulled back from; the plane and word aren't. */}
        <div className="cultura-zoom">
          <div className="cultura-ground">
            {/* Plain img: a pre-optimised WebP placed by CSS. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={ground}
              sizes="(max-aspect-ratio: 16/9) 200vh, 112vw"
              srcSet={GROUND}
              src="/cultura/ground-1920.webp"
              alt=""
              decoding="async"
            />
          </div>
          <div className="cultura-clouds">
            <i />
            <i />
          </div>
        </div>
        <p className="cultura-word">CULTURA</p>
      </div>
      {/* Among the vines: sky, land and the near rows, each at its own depth. */}
      <div className="vineyard">
        <div className="vineyard-canvas">
          {/* Plain img: pre-optimised WebP layers placed by CSS. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="vineyard-sky"
            sizes={VINE_SIZES}
            srcSet={vines("sky")}
            src="/cultura/vineyard/sky-1920.webp"
            alt=""
            decoding="async"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="vineyard-land"
            sizes={VINE_SIZES}
            srcSet={vines("land")}
            src="/cultura/vineyard/land-1920.webp"
            alt=""
            decoding="async"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="vineyard-near"
            sizes={VINE_SIZES}
            srcSet={vines("near")}
            src="/cultura/vineyard/near-1920.webp"
            alt=""
            decoding="async"
          />
        </div>
        <div className="vineyard-sun" />
        <Pollen />
      </div>
      {/* The low cloud between the sky and the vines: the cut is under it. */}
      <div className="cultura-haze" />
      <div className="cultura-shadow" />
      {/* The plane's goodbye: a twinkle where it was, then nothing. */}
      <svg className="cultura-twinkle" viewBox="-1 -1 2 2" aria-hidden="true">
        <path d="M0-1C.07-.07.07-.07 1 0C.07.07.07.07 0 1C-.07.07-.07.07-1 0C-.07-.07-.07-.07 0-1Z" />
        <path
          className="is-small"
          d="M0-1C.07-.07.07-.07 1 0C.07.07.07.07 0 1C-.07.07-.07.07-1 0C-.07-.07-.07-.07 0-1Z"
        />
      </svg>
      {/* Over everything: it goes over low, out of the forest. */}
      <Plane view={plane} className="cultura-plane" />
      {/* Motion blur for the pass: across only, as a camera panning with it. */}
      <svg className="cultura-defs" aria-hidden="true">
        <filter id="cultura-blur" x="-10%" y="0" width="120%" height="100%">
          <feGaussianBlur stdDeviation="12 1" />
        </filter>
      </svg>
    </div>
  );
}

/**
 * CULTURA's story, told among the vines as you move along the rows. Set like
 * ORIGO's and SILVA's (Origo.css); Dive.tsx brings each line up in turn.
 */
export function CulturaStory() {
  return (
    <section
      className="origo-story cultura-story"
      aria-labelledby="cultura-story-title"
    >
      <p className="origo-line cultura-line-shared">
        <span>Here the river is shared out,</span> <span>row by row.</span>
      </p>
      <p className="origo-line cultura-line-makes">
        What the forest grew, the fields make.
      </p>
      <div className="origo-meaning">
        {/* Rows running to the horizon, drawn as by a pen: making, in lines. */}
        <svg className="cultura-rows" viewBox="0 0 64 40" aria-hidden="true">
          {[-28, -16, -5, 5, 16, 28].map((x, i) => (
            <path
              key={x}
              d={`M${32 + x} 40 L${32 + x * 0.12} 4`}
              pathLength={1}
              style={{ "--i": i } as CSSProperties}
            />
          ))}
        </svg>
        <h2 className="origo-meaning-title" id="cultura-story-title">
          CULTURA — Creation
        </h2>
        <div className="origo-meaning-lines">
          <p className="origo-line cultura-line-person">
            An idea is ground until someone works it.
          </p>
          <p className="origo-line cultura-line-people">
            At The South Project, people bring their ideas to life together:
            tended, made, and shared.
          </p>
        </div>
      </div>
      <p className="origo-line cultura-line-onward">
        Further on, the ground grows harder.
      </p>
    </section>
  );
}
