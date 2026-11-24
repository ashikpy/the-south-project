"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import "./Silva.css";

/*
 * SILVA's canopy, seen from below: seven plants (banana, tree fern,
 * jackfruit branch, fig bough, fishtail palm, elephant ear, mossy vine)
 * placed by hand at three depths round an opening of sky.
 *
 * Every image lies flat, stem at the middle of its left end, tip to the
 * right, so a plant is placed by its stem and turned to point inward.
 */

/** Height of the stem in each plant's image, as a share of the image's height. */
const STEM = {
  banana: 56,
  fern: 51.2,
  branch: 45.7,
  fig: 51.9,
  palm: 56.1,
  taro: 51.2,
  vine: 51.3,
} as const;
type Plant = keyof typeof STEM;
type Depth = "far" | "mid" | "near";

/*
 * [stem x %, stem y %, degrees (0 points right, 90 down), length].
 * Length is in canopy units (--u in Silva.css): about 1% of the height on
 * landscape screens, 1% of the width on portrait ones.
 */
type Spot = readonly [number, number, number, number];
interface Leaf {
  plant: Plant;
  depth: Depth;
  wide: Spot;
  tall: Spot;
  /** When it sets off, 0–0.375 of the growing */
  delay: number;
  /** -1 mirrors it about its spine */
  flip?: -1;
}

const LEAVES: Leaf[] = [
  // Far: dark shapes against the sky, behind the word.
  { plant: "branch", depth: "far", wide: [12, -8, 62, 48], tall: [14, -4, 70, 72], delay: 0 },
  { plant: "fern", depth: "far", wide: [30, -9, 80, 36], tall: [46, -4, 96, 54], delay: 0.05, flip: -1 },
  { plant: "branch", depth: "far", wide: [49, -9, 98, 30], tall: [72, -4, 108, 62], delay: 0.1 },
  { plant: "banana", depth: "far", wide: [66, -8, 100, 37], tall: [103, -4, 124, 72], delay: 0.02 },
  { plant: "branch", depth: "far", wide: [89, -7, 122, 55], tall: [108, 22, 168, 48], delay: 0.08, flip: -1 },
  { plant: "banana", depth: "far", wide: [105, 25, 163, 44], tall: [108, 43, 186, 34], delay: 0.12 },
  { plant: "branch", depth: "far", wide: [105, 55, 184, 40], tall: [108, 66, 200, 46], delay: 0.04 },
  { plant: "fern", depth: "far", wide: [102, 86, 208, 55], tall: [104, 90, 222, 70], delay: 0.1 },
  { plant: "branch", depth: "far", wide: [72, 109, 258, 38], tall: [76, 104, 262, 60], delay: 0.06 },
  { plant: "banana", depth: "far", wide: [52, 110, 266, 26], tall: [48, 104, 276, 44], delay: 0.14, flip: -1 },
  { plant: "fern", depth: "far", wide: [30, 109, 288, 40], tall: [12, 103, 296, 70], delay: 0.03 },
  { plant: "branch", depth: "far", wide: [-3, 92, 326, 54], tall: [-8, 80, 338, 48], delay: 0.09 },
  { plant: "banana", depth: "far", wide: [-5, 62, 350, 40], tall: [-8, 56, 356, 34], delay: 0.07 },
  { plant: "branch", depth: "far", wide: [-5, 34, 16, 42], tall: [-8, 30, 14, 46], delay: 0.11, flip: -1 },
  // Dense fig boughs fill the ring behind, so only the opening shows sky.
  { plant: "fig", depth: "far", wide: [-6, -6, 35, 55], tall: [-8, -3, 60, 70], delay: 0.01 },
  { plant: "fig", depth: "far", wide: [106, -6, 145, 55], tall: [108, -3, 120, 70], delay: 0.06, flip: -1 },
  { plant: "fig", depth: "far", wide: [50, -10, 90, 34], tall: [50, -6, 90, 50], delay: 0.03 },
  { plant: "fig", depth: "far", wide: [106, 50, 180, 30], tall: [108, 50, 180, 30], delay: 0.09, flip: -1 },
  { plant: "fig", depth: "far", wide: [106, 106, 215, 55], tall: [108, 103, 240, 70], delay: 0.05 },
  { plant: "fig", depth: "far", wide: [55, 110, 270, 32], tall: [50, 106, 270, 50], delay: 0.11, flip: -1 },
  { plant: "fig", depth: "far", wide: [-6, 106, 325, 55], tall: [-8, 103, 300, 70], delay: 0.07 },
  { plant: "fig", depth: "far", wide: [-6, 50, 0, 30], tall: [-8, 50, 0, 30], delay: 0.13 },
  { plant: "fig", depth: "far", wide: [38, -10, 82, 36], tall: [32, -6, 80, 46], delay: 0.04, flip: -1 },
  { plant: "vine", depth: "far", wide: [72, -8, 100, 30], tall: [78, -5, 100, 40], delay: 0.08 },
  { plant: "palm", depth: "far", wide: [8, 110, 300, 40], tall: [8, 106, 290, 50], delay: 0.1 },
  { plant: "fig", depth: "far", wide: [66, 110, 282, 40], tall: [66, 106, 282, 46], delay: 0.06, flip: -1 },
  { plant: "palm", depth: "far", wide: [52, 112, 262, 44], tall: [52, 108, 262, 50], delay: 0.12 },

  // Middle: sun through them. A few tips cross the edge of the word.
  { plant: "banana", depth: "mid", wide: [-4, 4, 28, 58], tall: [-8, 8, 48, 64], delay: 0.12 },
  { plant: "fern", depth: "mid", wide: [-4, 27, 9, 52], tall: [-10, 36, 18, 40], delay: 0.22 },
  { plant: "banana", depth: "mid", wide: [-4, 74, 340, 48], tall: [-10, 72, 326, 48], delay: 0.17, flip: -1 },
  { plant: "fern", depth: "mid", wide: [17, 111, 300, 52], tall: [22, 105, 282, 56], delay: 0.26 },
  { plant: "branch", depth: "mid", wide: [40, 112, 277, 30], tall: [60, 106, 268, 46], delay: 0.3 },
  { plant: "banana", depth: "mid", wide: [80, 112, 242, 55], tall: [98, 102, 240, 62], delay: 0.14 },
  { plant: "fern", depth: "mid", wide: [105, 76, 197, 52], tall: [110, 76, 206, 46], delay: 0.24, flip: -1 },
  { plant: "banana", depth: "mid", wide: [105, 42, 174, 42], tall: [110, 51, 176, 34], delay: 0.2 },
  { plant: "branch", depth: "mid", wide: [104, 12, 150, 54], tall: [108, 14, 148, 56], delay: 0.28 },
  { plant: "banana", depth: "mid", wide: [78, -11, 108, 50], tall: [84, -5, 104, 60], delay: 0.16, flip: -1 },
  { plant: "fern", depth: "mid", wide: [21, -11, 70, 46], tall: [28, -5, 78, 56], delay: 0.21 },
  { plant: "palm", depth: "mid", wide: [-4, 50, 352, 36], tall: [-10, 30, 20, 50], delay: 0.18 },
  { plant: "vine", depth: "mid", wide: [30, -10, 60, 42], tall: [20, -5, 70, 60], delay: 0.25, flip: -1 },
  { plant: "palm", depth: "mid", wide: [96, -10, 120, 44], tall: [100, -4, 115, 58], delay: 0.19, flip: -1 },
  { plant: "vine", depth: "mid", wide: [104, 62, 200, 34], tall: [110, 78, 215, 44], delay: 0.29 },
  { plant: "taro", depth: "mid", wide: [104, 94, 215, 38], tall: [110, 88, 220, 50], delay: 0.15 },
  { plant: "palm", depth: "mid", wide: [62, 110, 255, 36], tall: [66, 106, 262, 56], delay: 0.27 },
  { plant: "taro", depth: "mid", wide: [-4, 104, 318, 36], tall: [-10, 96, 320, 50], delay: 0.23, flip: -1 },
  // More in the gaps: overhead, and down the left side.
  { plant: "fig", depth: "mid", wide: [60, -10, 95, 40], tall: [60, -6, 95, 44], delay: 0.17 },
  { plant: "fig", depth: "mid", wide: [-6, 40, 10, 40], tall: [-10, 34, 10, 36], delay: 0.2, flip: -1 },
  { plant: "fig", depth: "mid", wide: [-6, 64, 348, 38], tall: [-10, 62, 345, 40], delay: 0.26 },
  { plant: "taro", depth: "mid", wide: [-6, 86, 330, 42], tall: [-10, 86, 325, 46], delay: 0.22 },
  // ...and along the bottom, stopping short of the word.
  { plant: "fig", depth: "mid", wide: [44, 110, 265, 36], tall: [44, 106, 265, 40], delay: 0.21 },
  { plant: "taro", depth: "mid", wide: [34, 112, 282, 32], tall: [34, 108, 282, 40], delay: 0.28, flip: -1 },

  // Near: big, dark and out of focus, in the corners.
  { plant: "banana", depth: "near", wide: [-9, -8, 33, 58], tall: [-18, -4, 44, 62], delay: 0.3, flip: -1 },
  { plant: "fern", depth: "near", wide: [109, -8, 148, 56], tall: [118, -3, 132, 62], delay: 0.34 },
  { plant: "banana", depth: "near", wide: [109, 108, 214, 68], tall: [120, 102, 226, 70], delay: 0.32 },
  { plant: "fern", depth: "near", wide: [-9, 106, 322, 62], tall: [-20, 100, 316, 64], delay: 0.36, flip: -1 },
  { plant: "taro", depth: "near", wide: [-10, 40, 345, 60], tall: [-18, 26, 20, 60], delay: 0.33 },
  { plant: "palm", depth: "near", wide: [110, 50, 200, 48], tall: [118, 24, 148, 56], delay: 0.35, flip: -1 },
  { plant: "vine", depth: "near", wide: [40, 112, 300, 40], tall: [40, 108, 290, 60], delay: 0.31 },

];

const IMAGE = { far: "shade", mid: "lit", near: "near" } as const;

/*
 * Leaves whipping past the lens on the climb, in true perspective:
 * [plant, stem's x vw and y svh from the middle, degrees, length in vmin,
 * when (0–0.5)]. Stems start off screen, so no cut end ever shows.
 */
const PASSING = [
  ["banana", -82, -44, 24, 84, 0.08],
  ["fern", 82, -36, 160, 84, 0.16],
  ["banana", 34, -98, 100, 78, 0.24],
  ["palm", -84, 26, -14, 80, 0.32],
  ["taro", 84, 30, 198, 88, 0.4],
  ["fern", -30, -96, 74, 72, 0.48],
] as const;

/** Reflections inside the lens: [along the sun-to-centre line, size in vmin, kind]. */
const GHOSTS = [
  [0.62, 1.6, "gold"],
  [0.3, 3.4, "iris"],
  [-0.22, 1.1, "teal"],
  [-0.5, 6, "iris"],
  [-0.78, 2.4, "gold"],
  [-1.15, 10, "halo"],
] as const;

/*
 * Leaves right at the lens, far out of focus, framing the corners:
 * [x %, y %, degrees, length, -1 mirrors, way out (x, y in vmax), delay].
 * They drift on their own, and are the first to rush past as the canopy shuts.
 */
const LENS = [
  [-4, 6, 28, 56, 1, -18, -14, 0],
  [104, 12, 158, 50, -1, 18, -12, 0.08],
  [101, 94, 206, 54, 1, 18, 14, 0.04],
  [-2, 90, 334, 46, -1, -18, 14, 0.12],
] as const;

/*
 * Leaves loose in the air, floating through between you and the canopy:
 * [from x, y, to x, y (vw, svh from the middle), turn (deg), size (vmin), seconds, offset].
 */
const DRIFT = [
  [-62, -30, 58, 18, 220, 18, 26, 0],
  [56, -44, -30, 40, -160, 13, 31, -11],
  [-20, 52, 40, -46, 140, 15, 23, -17],
] as const;

/** Drops still falling from the leaves: where each starts, and drifts to. */
const DROPS = [
  [44, 36, -22, -24],
  [58, 42, 26, -18],
  [38, 58, -28, 20],
  [63, 62, 22, 28],
  [52, 30, 6, -30],
  [47, 66, -6, 30],
  [67, 50, 32, 4],
] as const;

function placed({ plant, wide, tall, delay, flip }: Leaf, i: number) {
  return {
    "--stem": `${STEM[plant]}%`,
    "--wx": `${wide[0]}%`,
    "--wy": `${wide[1]}%`,
    "--wa": `${wide[2]}deg`,
    "--wl": wide[3],
    "--tx": `${tall[0]}%`,
    "--ty": `${tall[1]}%`,
    "--ta": `${tall[2]}deg`,
    "--tl": tall[3],
    "--delay": delay,
    "--flip": flip ?? 1,
    // Never in step with each other.
    "--breeze": `${4.2 + ((i * 7) % 11) * 0.31}s`,
    "--gust": `${-((i * 13) % 17) * 0.4}s`,
  } as CSSProperties;
}

/*
 * A depth comes in two halves. The upper hangs overhead, so it swings down
 * as the camera pitches up. The lower stays in the screen's plane and grows
 * in late, once the valley has gone: swung, its cut stems would float by.
 */
function Layer({ depth }: { depth: Depth }) {
  return (["over", "under"] as const).map((half) => (
    <div key={half} className={`silva-layer silva-${depth} is-${half}`}>
      {/* Flies apart from the sun as the camera pushes up into its glare. */}
      <div className="silva-burst">
        {LEAVES.map(
          (leaf, i) =>
            leaf.depth === depth &&
            (leaf.wide[1] < 50) === (half === "over") && (
              <div className="silva-leaf" key={i} style={placed(leaf, i)}>
                {/* Plain img: small pre-baked layers, turned and scaled by CSS. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/silva/${leaf.plant}-${IMAGE[depth]}.webp`} alt="" decoding="async" />
              </div>
            ),
        )}
      </div>
    </div>
  ));
}

/** The sky you look up into. It sits behind ORIGO's mountain as that drops away. */
export function SilvaSky() {
  return (
    <div className="silva-sky">
      <div className="silva-clouds" />
      <div className="silva-sun" />
    </div>
  );
}

/**
 * The end of the drone shot into SILVA: the canopy swings down from overhead
 * as the camera pitches up, leaves whip past, the word comes out of the depth
 * in the opening, then the leaves close over you into deep green.
 */
export default function Silva() {
  const root = useRef<HTMLDivElement>(null);

  // The canopy shifts with the pointer, each depth by its own amount, so it
  // reads as space. Eased toward the pointer, and idle once it arrives.
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // On the stage, so the forest after the canopy moves with it too.
    const stage = el.closest<HTMLElement>(".dive-stage");
    if (!stage) return;
    let x = 0;
    let y = 0;
    let tx = 0;
    let ty = 0;
    let raf = 0;
    const step = () => {
      x += (tx - x) * 0.07;
      y += (ty - y) * 0.07;
      stage.style.setProperty("--mx", x.toFixed(4));
      stage.style.setProperty("--my", y.toFixed(4));
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.002 ? requestAnimationFrame(step) : 0;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || !stage.classList.contains("is-canopy")) return;
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(step);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="silva" aria-hidden="true" ref={root}>
      <Layer depth="far" />
      <p className="silva-word">
        {Array.from("SILVA", (letter, i) => (
          <span key={i} style={{ "--i": i, "--turn": i - 2 } as CSSProperties}>
            {letter}
          </span>
        ))}
      </p>
      <Layer depth="mid" />
      <div className="silva-sunlight" />
      <Layer depth="near" />
      <div className="silva-passing">
        {PASSING.map(([plant, x, y, angle, length, when], i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={`/silva/${plant}-near.webp`}
            alt=""
            decoding="async"
            style={
              {
                "--x": `${x}vw`,
                "--y": `${y}svh`,
                "--a": `${angle}deg`,
                "--length": `${length}vmin`,
                "--stem": `${STEM[plant]}%`,
                "--when": when,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="silva-flare">
        <i className="silva-flare-core" />
        {GHOSTS.map(([along, size, kind]) => (
          <i
            key={along}
            className={`silva-ghost is-${kind}`}
            style={{ "--along": along, "--ghost": `${size}vmin` } as CSSProperties}
          />
        ))}
      </div>
      <div className="silva-drops">
        {DROPS.map(([x, y, dx, dy], i) => (
          <span
            key={i}
            style={
              {
                left: `${x}%`,
                top: `${y}%`,
                "--dx": `${dx}vw`,
                "--dy": `${dy}svh`,
                animationDelay: `${i * -1.1}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="silva-drift">
        {DRIFT.map(([x0, y0, x1, y1, turn, size, seconds, offset], i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src="/silva/leaf-drift.webp"
            alt=""
            decoding="async"
            style={
              {
                "--x0": `${x0}vw`,
                "--y0": `${y0}svh`,
                "--x1": `${x1}vw`,
                "--y1": `${y1}svh`,
                "--turn": `${turn}deg`,
                width: `${size}vmin`,
                animationDuration: `${seconds}s`,
                animationDelay: `${offset}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="silva-lens">
        {LENS.map(([x, y, angle, length, flip, outX, outY, delay], i) => (
          <i
            key={i}
            style={
              {
                left: `${x}%`,
                top: `${y}%`,
                "--a": `${angle}deg`,
                "--w": length,
                "--f": flip,
                "--ox": `${outX}vmax`,
                "--oy": `${outY}vmax`,
                "--delay": delay,
              } as CSSProperties
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/silva/leaf-lens.webp"
              alt=""
              decoding="async"
              style={{ animationDelay: `${i * -3.7}s` }}
            />
          </i>
        ))}
      </div>
    </div>
  );
}

/*
 * A fern frond, drawn as by a pen with --unfurl: the stem rises and its tip
 * curls into a crozier, then the leaflets open in pairs, lowest first.
 */
const FERN_STEM = (() => {
  let d = "M30 118 C31 96 29 70 27 46";
  for (let i = 1; i <= 40; i++) {
    const t = i / 40;
    const turn = Math.PI + t * Math.PI * 2.6;
    const r = 9 * (1 - t * 0.82);
    d += ` L${(36 + r * Math.cos(turn)).toFixed(2)} ${(46 + r * Math.sin(turn)).toFixed(2)}`;
  }
  return d;
})();
/** [where on the stem (y), reach]: each a pair, shorter toward the tip. */
const FERN_LEAVES = [
  [108, 22],
  [96, 20],
  [84, 17],
  [72, 14],
  [61, 10],
] as const;
/** The stem leans a little: where it is at a height. */
const stemX = (y: number) => 27 + (y - 46) / 24;

/**
 * SILVA's story, one thought to a screen, told like ORIGO's: the place, the
 * water, what SILVA means, what The South Project does with it, then on to
 * the farmlands. Outside the decorative scene, so screen readers and reduced
 * motion get it as plain text. Dive.tsx fades each line (SILVA_BEATS there).
 */
export function SilvaStory() {
  return (
    <section className="origo-story silva-story" aria-labelledby="silva-story-title">
      <p className="origo-line silva-line-slow">Down here, the river slows.</p>
      <p className="origo-line silva-line-feeds">
        <span>Everything the mountain sent down,</span> <span>the forest turns into life.</span>
      </p>
      <div className="origo-meaning">
        <svg className="silva-fern" viewBox="0 0 64 122" aria-hidden="true">
          <path d={FERN_STEM} pathLength={1} />
          {FERN_LEAVES.map(([y, reach], i) =>
            [-1, 1].map((side) => {
              const x = stemX(y);
              return (
                <path
                  key={`${i}${side}`}
                  className="silva-fern-leaf"
                  style={{ "--i": i } as CSSProperties}
                  d={`M${x} ${y} Q${x + side * reach * 0.55} ${y - reach * 0.2} ${x + side * reach} ${y - reach * 0.55}`}
                  pathLength={1}
                />
              );
            }),
          )}
        </svg>
        <h2 className="origo-meaning-title" id="silva-story-title">
          SILVA — Growth
        </h2>
        <div className="origo-meaning-lines">
          <p className="origo-line silva-line-person">Nothing in a forest grows alone.</p>
          <p className="origo-line silva-line-people">
            The South Project gives ideas the same: shelter, patience, and each other.
          </p>
        </div>
      </div>
      <p className="origo-line silva-line-onward">What grows here is ready to be made real.</p>
    </section>
  );
}
