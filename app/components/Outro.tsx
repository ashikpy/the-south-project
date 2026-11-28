"use client";

import { useEffect, useRef } from "react";
import "./Outro.css";

/*
 * The end of the journey, and the foot of the page. Dive.tsx sets:
 *   --outro-in     the About page's paper, its name cut out of it (0–1)
 *   --outro-zoom   the camera diving through a letter, into the sea (0–1)
 *   --outro-words  the last words, over the sea (0–1)
 *
 * You came into The South Project through a keyhole; you leave through its
 * name: "the south / project", set as the hero sets it, cut out of the page,
 * the open sea moving in the letters ("Ocean Surface Water Background Loop
 * 4K", Free Stock Footage 4K, CC BY: credit due; one 6 s cycle, so it loops
 * without a seam). The camera dives into the stem of
 * the h until the sea is all there is: water at the start, water at the end.
 *
 * The words are placeholders, to be rewritten. The page's footer follows
 * the journey (Footer.tsx).
 */

const LINES = ["the south", "project"];
// The letter dived into: the h of "south", the last of the first line.
const TARGET = { line: 0, char: 8 };

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * The cut-out page and the dive through it. The type is laid out in screen
 * pixels (an SVG mask over the page's paper); each frame only the group's
 * transform and the letters' shade change.
 */
function Cut() {
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = svg.current;
    const stage = el?.closest<HTMLElement>(".dive-stage");
    if (!el || !stage) return;
    const group = el.querySelector<SVGGElement>(".outro-type")!;
    const texts = [...el.querySelectorAll<SVGTextElement>(".outro-type text")];
    const chars = [...el.querySelectorAll<SVGTSpanElement>(".outro-type tspan")];
    const paper = el.querySelector<SVGRectElement>(".outro-paper")!;
    // The stem alone, as a rectangle: text this large is not drawn at all
    // (glyphs have a size limit), so close in, the stem takes over from it.
    const stem = el.querySelector<SVGRectElement>(".outro-stem")!;

    // Where the h's stem is, and how wide, in screen pixels.
    const target = { x: 0, y: 0, w: 1 };
    const shades: number[] = [];
    let last = "";
    let w = 0;
    let h = 0;

    const layout = () => {
      w = el.clientWidth;
      h = el.clientHeight;
      if (!w || !h) return;
      el.setAttribute("viewBox", `0 0 ${w} ${h}`);
      // As the hero sets it: as wide as the screen allows, two lines.
      const portrait = w / h < 0.8;
      texts.forEach((t) => t.setAttribute("font-size", "100"));
      const widest = Math.max(...texts.map((t) => t.getComputedTextLength()));
      const size = (100 * w * (portrait ? 0.94 : 0.9)) / widest;
      const lead = size * 0.86;
      const top = h / 2 - lead / 2 + size * 0.33;
      texts.forEach((t, i) => {
        t.setAttribute("font-size", size.toFixed(2));
        t.setAttribute("x", (w / 2).toFixed(1));
        t.setAttribute("y", (top + i * lead).toFixed(1));
      });

      // The stem of the target letter: its box from the text, its stroke
      // found by drawing the letter alone and reading a row of ink.
      const line = texts[TARGET.line];
      const start = line.getStartPositionOfChar(TARGET.char);
      const family = getComputedStyle(line).fontFamily;
      const canvas = document.createElement("canvas");
      const fs = 200;
      canvas.width = fs;
      canvas.height = fs;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      // In ems from the letter's origin: its stem, above the arch.
      let stemX = 0.12;
      let stemW = 0.1;
      let stemTop = 0.72;
      if (ctx) {
        ctx.font = `600 ${fs}px ${family}`;
        ctx.textBaseline = "alphabetic";
        ctx.fillText(line.textContent![TARGET.char], 0, fs * 0.9);
        const row = ctx.getImageData(0, Math.round(fs * 0.9 - fs * 0.62), fs, 1).data;
        let best = [0, 0];
        let run = -1;
        for (let x = 0; x <= fs; x++) {
          const ink = x < fs && row[x * 4 + 3] > 128;
          if (ink && run < 0) run = x;
          if (!ink && run >= 0) {
            if (x - run > best[1] - best[0]) best = [run, x];
            run = -1;
          }
        }
        if (best[1] > best[0]) {
          stemX = (best[0] + best[1]) / 2 / fs;
          stemW = (best[1] - best[0]) / fs;
          // Up the stem's middle to its top.
          const col = ctx.getImageData(Math.round(stemX * fs), 0, 1, fs).data;
          for (let y = 0; y < fs; y++) {
            if (col[y * 4 + 3] > 128) {
              stemTop = (fs * 0.9 - y) / fs;
              break;
            }
          }
        }
      }
      const fontSize = parseFloat(line.getAttribute("font-size")!);
      target.x = start.x + fontSize * stemX;
      target.y = start.y - fontSize * 0.62;
      target.w = Math.max(2, stemW * fontSize);
      stem.setAttribute("x", (target.x - target.w / 2).toFixed(2));
      stem.setAttribute("width", target.w.toFixed(2));
      stem.setAttribute("y", (start.y - stemTop * fontSize).toFixed(2));
      stem.setAttribute("height", (stemTop * fontSize).toFixed(2));
      last = "";
    };

    const ro = new ResizeObserver(layout);
    ro.observe(el);
    document.fonts?.ready.then(layout);
    layout();

    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!stage.classList.contains("is-outro") || !w) return;
      const inline = stage.style;
      const open = parseFloat(inline.getPropertyValue("--outro-in")) || 0;
      const zoom = parseFloat(inline.getPropertyValue("--outro-zoom")) || 0;
      const key = `${open.toFixed(4)}|${zoom.toFixed(4)}|${w}|${h}`;
      if (key === last) return;
      last = key;

      // The letters open one after another, left to right: windows onto the
      // sea, the page their frame.
      // (In steps, and only those that changed: each change redraws the mask.)
      chars.forEach((c, i) => {
        const t = clamp01(open * 1.6 - (i / chars.length) * 0.6);
        const v = Math.round((255 * (1 - ease(t))) / 8) * 8;
        if (shades[i] === v) return;
        shades[i] = v;
        c.setAttribute("fill", `rgb(${v},${v},${v})`);
      });

      // The dive: steadily closer, as things come toward you, the h's stem
      // swinging to the middle of the screen as it grows to fill it.
      const z = ease(zoom);
      const end = (1.3 * Math.max(w, h)) / target.w;
      const s = Math.pow(end, z);
      const ax = target.x + (w / 2 - target.x) * z;
      const ay = target.y + (h / 2 - target.y) * z;
      group.setAttribute(
        "transform",
        `translate(${ax.toFixed(2)} ${ay.toFixed(2)}) scale(${s.toFixed(4)}) translate(${(-target.x).toFixed(2)} ${(-target.y).toFixed(2)})`,
      );
      const near = s > 9;
      texts.forEach((t) => t.setAttribute("visibility", near ? "hidden" : "visible"));
      stem.setAttribute("visibility", near ? "visible" : "hidden");
      // Should the stem not quite cover the screen, the page lets go.
      paper.setAttribute("opacity", (1 - clamp01((zoom - 0.86) / 0.14)).toFixed(3));
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <svg ref={svg} className="outro-cut" aria-hidden="true">
      <defs>
        <mask id="outro-mask" maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000">
          <rect x="-100000" y="-100000" width="200000" height="200000" fill="#fff" />
          <g className="outro-type">
            <rect className="outro-stem" fill="#000" visibility="hidden" />
            {LINES.map((line) => (
              <text key={line} textAnchor="middle">
                {[...line].map((ch, i) => (
                  <tspan key={i} fill="#fff">
                    {ch}
                  </tspan>
                ))}
              </text>
            ))}
          </g>
        </mask>
      </defs>
      <rect className="outro-paper" x="-100000" y="-100000" width="200000" height="200000" mask="url(#outro-mask)" />
    </svg>
  );
}

/** The sea, playing only while it can be seen; loaded once you reach About. */
function Sea() {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = video.current;
    const stage = el?.closest<HTMLElement>(".dive-stage");
    if (!el || !stage) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let loading = false;
    const check = () => {
      if (!loading && stage.classList.contains("is-about")) {
        loading = true;
        el.preload = "auto";
        el.load();
      }
      const on = stage.classList.contains("is-outro") && !document.hidden && !reduced;
      if (on && el.paused) el.play().catch(() => {});
      if (!on && !el.paused) el.pause();
    };
    const mo = new MutationObserver(check);
    mo.observe(stage, { attributes: true, attributeFilter: ["class"] });
    document.addEventListener("visibilitychange", check);
    check();
    return () => {
      mo.disconnect();
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  return (
    <video
      ref={video}
      className="outro-sea"
      muted
      loop
      playsInline
      preload="none"
      disablePictureInPicture
      poster="/footer/sea-1080.webp"
    >
      <source src="/footer/sea-portrait.mp4" type="video/mp4" media="(max-aspect-ratio: 4/5)" />
      <source src="/footer/sea-1080.mp4" type="video/mp4" />
    </video>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Out through the name, to the open sea, and the last words. Pinned on the journey's stage, after About (Keyhole.tsx).
 */
export default function Outro() {
  return (
    <div className="outro">
      <Sea />
      <div className="outro-shade" />
      <Cut />

      <section className="outro-words" aria-labelledby="outro-title">
        <h2 className="outro-title" id="outro-title">
          Let’s make something together.
        </h2>
        <a className="outro-button" href="#join">
          <span>Join us</span>
          <span className="outro-button-chip">
            <Arrow />
          </span>
        </a>
      </section>

    </div>
  );
}
