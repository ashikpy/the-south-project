"use client";

import { useEffect, useRef, type CSSProperties, type RefObject } from "react";
import LightRays from "./LightRays";
import River, { type RiverPlace, type RiverView } from "./River";
import "./SilvaForest.css";

/*
 * Inside SILVA: the camera comes down from the canopy to stand in the forest,
 * by the stream that began on ORIGO's mountain. Two layers share one 16:9
 * canvas (public/silva/forest): the forest behind, and the ferns and rocks at
 * the lens. Each comes sharp and soft, so the focus can pull from near to far.
 */

/** A layer's exports, for the browser to pick from. */
const srcSet = (layer: "back" | "front") =>
  [1920, 2560, 3840].map((w) => `/silva/forest/${layer}-${w}.webp ${w}w`).join(", ");
/* The canvas covers the screen, so on all but wide screens its width follows the height. */
const SIZES =
  "(max-width: 600px) and (max-resolution: 2.5dppx) 150vh, (max-width: 600px) 110vh, (max-aspect-ratio: 16/9) 185vh, 104vw";

/** Where the sun comes through, on the canvas (% of its width and height). */
const SUN = [36, -2] as const;
/** Where its shafts fall, for lighting the dust: [degrees from straight down, width]. */
const BEAMS = [
  [-20, 5],
  [-9, 7],
  [1, 4],
  [10, 6],
  [21, 4.5],
] as const;

/* The stream, in the back layer's 3840x2160 canvas (stream-mask.webp). */
const STREAM: RiverPlace = {
  crop: [1028, 1444, 2152, 716],
  horizon: 1400,
  centre: 1300,
  far: [1480, 2000],
};
const STREAM_SIZE = [1076, 358] as const;

/*
 * Leaves rushing up past the lens as you drop through the canopy, dark
 * against the glare: [image, x (vw), degrees, length (vmax), when (0–0.45)].
 */
const SINK = [
  ["banana-near", 16, -28, 72, 0],
  ["taro-near", 80, 204, 62, 0.08],
  ["leaf-lens", 46, 84, 58, 0.17],
  ["palm-near", 6, 18, 66, 0.26],
  ["fern-near", 90, 160, 60, 0.33],
  ["banana-near", 58, 120, 68, 0.42],
] as const;

/** Points on the water (% of the canvas), found in the image, where light glints. */
const GLINTS = [[46.77,86.3], [64.06,68.33], [38.44,77.96], [60.83,97.96], [72.5,93.33], [69.69,91.11], [56.15,90.74], [41.35,80.93], [32.6,73.33], [37.71,77.41], [57.29,87.41], [52.81,91.67], [47.71,82.96], [79.58,73.7], [32.4,73.33], [44.17,83.33], [46.25,84.63], [56.88,91.3], [40.21,76.48], [41.46,66.3], [36.25,77.59], [54.69,87.78], [39.27,77.96], [39.38,80.19], [69.17,73.89], [41.15,81.3], [30.52,72.41], [40.1,76.3], [42.92,75.56], [40.31,77.04], [45.21,85.0], [48.33,91.48], [46.98,85.56], [34.17,73.52], [84.17,88.15], [52.6,82.41], [83.44,88.33], [38.75,80.37], [33.54,71.67], [57.71,88.7], [48.65,83.52], [28.65,72.41], [29.06,71.85], [45.52,85.56], [40.21,75.93], [53.65,85.37], [72.08,91.3], [77.5,72.04], [39.48,78.33], [49.9,86.11], [42.4,91.11], [66.35,96.3], [40.62,77.22], [36.67,74.81], [40.42,79.44], [77.6,71.85], [57.19,93.7], [55.73,88.89], [47.19,70.0], [78.12,70.74], [56.88,82.22], [42.08,74.26], [73.23,90.74], [72.29,92.59], [52.4,89.07], [41.04,81.3], [46.15,80.93], [54.27,90.0], [30.63,73.52], [31.56,72.78], [49.48,88.33], [41.35,76.67], [51.56,80.74], [28.85,72.41], [44.69,83.33], [58.02,89.81], [40.52,81.85], [43.33,82.59], [39.69,82.04], [71.46,94.07], [47.5,93.89], [62.29,94.44], [50.1,87.04], [42.4,91.67], [71.77,93.52], [55.73,87.41], [38.65,80.93], [84.48,87.78], [56.56,74.44], [28.02,90.19]] as const;

/**
 * Dust and spores in the air, lit only where they cross a shaft of light,
 * and glints on the stream. Drawn on the forest's canvas, so they stay put
 * on the image; runs only while the stage says you are in the forest.
 */
function Motes() {
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
      // Never more than 1600 across: they are small and soft.
      const scale = Math.min(1, 1600 / Math.max(1, el.clientWidth));
      w = el.width = Math.round(el.clientWidth * scale);
      h = el.height = Math.round(el.clientHeight * scale);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const motes = Array.from({ length: 140 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.85,
      r: 0.6 + Math.random() * 1.8,
      drift: (Math.random() - 0.5) * 0.004,
      rise: -0.002 - Math.random() * 0.006,
      phase: Math.random() * Math.PI * 2,
    }));
    const glints = GLINTS.map(() => Math.random() * Math.PI * 2);
    const beamAt = (x: number, y: number) => {
      // Light along the shafts: brightest on their line, fading with depth.
      const dx = (x - SUN[0] / 100) * (w / h);
      const dy = y - SUN[1] / 100;
      const deg = (Math.atan2(dx, dy) * 180) / Math.PI;
      let lit = 0;
      for (const [angle, width] of BEAMS) {
        const d = (deg - angle) / (width * 0.9);
        lit = Math.max(lit, Math.exp(-d * d));
      }
      return lit * Math.max(0, 1 - y * 1.05);
    };

    let raf = 0;
    let last = performance.now();
    let drawn = false;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!stage?.classList.contains("is-forest") || document.hidden) {
        if (drawn) ctx.clearRect(0, 0, w, h);
        drawn = false;
        last = now;
        return;
      }
      drawn = true;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgb(236 255 214)";
      for (const m of motes) {
        m.x += (m.drift + Math.sin(t * 0.4 + m.phase) * 0.002) * dt;
        m.y += m.rise * dt;
        if (m.y < -0.02) m.y = 0.85;
        if (m.x < 0) m.x += 1;
        if (m.x > 1) m.x -= 1;
        const a = 0.08 + beamAt(m.x, m.y) * 0.85;
        ctx.globalAlpha = a * (0.6 + 0.4 * Math.sin(t * 1.3 + m.phase));
        ctx.beginPath();
        ctx.arc(m.x * w, m.y * h, m.r * (w / 1600), 0, Math.PI * 2);
        ctx.fill();
      }
      // Glints: each catches the light now and then, briefly.
      ctx.fillStyle = "rgb(255 255 240)";
      GLINTS.forEach(([x, y], i) => {
        const s = Math.sin(t * 2.1 + glints[i]);
        if (s < 0.8) return;
        ctx.globalAlpha = (s - 0.8) * 4;
        ctx.beginPath();
        ctx.arc((x / 100) * w, (y / 100) * h, 1.4 * (w / 1600), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvas} className="forest-motes" />;
}

/**
 * The forest, reached through the sun's glare: Dive.tsx drives it with
 * --glare and --glare-back (it fills the lens, then draws back into the
 * beams), --sink (leaves rush up past you), --level (the forest rises to eye
 * level), --focus (near to far), --walk (on along the stream) and --gold
 * (the light warms, toward the farmlands).
 */
export default function SilvaForest({
  river,
  lit,
}: {
  /** the stream's light; flow is 0 while out of the forest */
  river: RefObject<RiverView>;
  /** in the forest: the shafts of light show, and run, only then */
  lit: boolean;
}) {
  return (
    <div className="forest">
      <div className="forest-scene">
        <div className="forest-canvas forest-back">
          {/* Plain img: pre-optimised WebP layers sharing one canvas, placed by CSS. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img sizes={SIZES} srcSet={srcSet("back")} src="/silva/forest/back-2560.webp" alt="" decoding="async" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="forest-soft" src="/silva/forest/back-soft.webp" alt="" decoding="async" />
          {/* The water's moving light, cut to the stream (River.tsx, as on ORIGO). */}
          <div className="forest-stream">
            <River view={river} mask="/silva/forest/stream-mask.webp" place={STREAM} size={STREAM_SIZE} />
          </div>
          {/* Shafts of light through the gap, as at the hero (LightRays). */}
          {/* Built with the forest, ahead of time, so nothing compiles at the
              cut; hidden (and so paused) until you are in it. */}
          <div className={`forest-beams${lit ? " is-lit" : ""}`}>
            <LightRays
              raysOrigin="top-center"
              raysColor="#dcffc8"
              raysSpeed={0.45}
              lightSpread={0.85}
              rayLength={1.7}
              glow={0.5}
              haze={0.45}
              followMouse
              mouseInfluence={0.08}
              rayDensity={1.4}
              raySharpness={0.45}
              atmosphere={0.6}
              distortion={0.22}
              cursorShadow={false}
              clickPulse={false}
              intro={false}
              maxDevicePixelRatio={1}
            />
          </div>
          <Motes />
          {/* Something passing over the canopy: its shadow crosses the gap. */}
          <div className="forest-flyover" />
        </div>
        <div className="forest-mist">
          <i />
          <i />
        </div>
        <div className="forest-canvas forest-near">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="forest-soft" src="/silva/forest/front-soft.webp" alt="" decoding="async" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="forest-sharp"
            sizes={SIZES}
            srcSet={srcSet("front")}
            src="/silva/forest/front-2560.webp"
            alt=""
            decoding="async"
          />
        </div>
      </div>
      <div className="forest-gold" />
      {/* The sun's glare: it fills the lens, the cut happens under it, and it
          draws back into the gap in the canopy the beams come through. */}
      <div className="forest-glare" />
      <div className="forest-sink">
        {SINK.map(([image, x, angle, length, when], i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={`/silva/${image}.webp`}
            alt=""
            decoding="async"
            style={
              {
                left: `${x}vw`,
                width: `calc(${length} * var(--su))`,
                "--a": `${angle}deg`,
                "--when": when,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
