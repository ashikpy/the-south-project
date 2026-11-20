"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CloudShader } from "@/components/ui/cloud-shader";
import DeepParticles, { type DiveState } from "./DeepParticles";
import Earth, { type EarthView } from "./Earth";
import Pentara, { STATEMENT_TOKENS } from "./Pentara";
import "./Dive.css";

/*
 * Scroll phases, as fractions of the pinned track (0 = hero, 1 = end).
 * Each becomes a CSS variable on the stage that styles read.
 */
const PHASES = {
  dive: [0, 0.17], // --dive: zoom down into the water, hero type leaves
  deep: [0.07, 0.21], // --deep: light fades to ink; particles appear
  words: [0.19, 0.38], // --words: statement lights up word by word
  pass: [0.4, 0.48], // --pass: you swim through the statement
  forward: [0.4, 1], // the specks rush past: now stars, as you fly
  space: [0.44, 0.54], // --space: out in space, the Earth far ahead
  zoom: [0.5, 0.88], // the descent to southern India (Earth.tsx)
  mist: [0.8, 0.95], // --mist: into the cloud tops, a white-out
  sky: [0.85, 0.93], // --sky: under the clouds, the sky (CloudShader)
} as const;

type Range = readonly [number, number];
const range = (p: number, [from, to]: Range) =>
  Math.min(1, Math.max(0, (p - from) / (to - from)));
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeIn = (t: number) => t * t * t;

/**
 * The dive: the hero pins while you scroll, the ocean zooms toward the deep
 * and goes to ink, Pentara is introduced, then you swim through it out into
 * space. The Earth turns to meet you and you descend to southern India,
 * through the cloud tops, into the sky.
 *
 * One scroll listener turns the position on the track into a few 0–1
 * variables; the DOM motion is transform and opacity, driven from CSS. The
 * particle canvas and the Earth read the same scroll state each frame.
 * Under reduced motion nothing pins: everything simply follows the hero.
 */
export default function Dive({ children }: { children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const state = useRef<DiveState>({ track: 0, deep: 0, forward: 0 });
  const earth = useRef<EarthView>({ zoom: 0, on: false });
  // Heavy layers start ahead of their turn and stop when far away.
  const [earthOn, setEarthOn] = useState(false);
  const [skyOn, setSkyOn] = useState(false);

  useEffect(() => {
    const el = track.current;
    const st = stage.current;
    if (!el || !st) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const show = requestAnimationFrame(() => {
        earth.current = { zoom: 0, on: true };
        setEarthOn(true);
      });
      return () => cancelAnimationFrame(show);
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      const p = travel > 0 ? Math.min(1, Math.max(0, -rect.top / travel)) : 0;
      const set = (name: string, v: number) =>
        st.style.setProperty(name, v.toFixed(4));

      const deep = easeInOut(range(p, PHASES.deep));
      const sky = easeInOut(range(p, PHASES.sky));
      set("--dive", easeInOut(range(p, PHASES.dive)));
      set("--deep", deep);
      set("--words", range(p, PHASES.words) * (STATEMENT_TOKENS + 1));
      set("--pass", easeIn(range(p, PHASES.pass)));
      set("--space", easeInOut(range(p, PHASES.space)));
      set("--mist", Math.sin(Math.PI * range(p, PHASES.mist)));
      set("--sky", sky);
      set("--track", p);

      // Mount the Earth once the statement begins (textures load in time),
      // the sky shortly before the clouds.
      if (p >= PHASES.words[0]) setEarthOn(true);
      setSkyOn(p >= PHASES.zoom[0] + 0.15);

      earth.current.zoom = easeInOut(range(p, PHASES.zoom));
      earth.current.on = p > PHASES.space[0] - 0.02 && sky < 1;

      state.current.track = p;
      // The specks become stars in space and are lost in the sky.
      state.current.deep = deep * (1 - sky);
      state.current.forward = range(p, PHASES.forward) * 1.6;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="dive" ref={track}>
      <div className="dive-stage" ref={stage}>
        {children}
        <DeepParticles state={state} />
        <div className="descent" aria-hidden="true">
          {earthOn && <Earth className="descent-earth" view={earth} />}
          <div className="descent-sky">
            {skyOn && <CloudShader className="h-full min-h-0" />}
          </div>
          <div className="descent-mist" />
        </div>
        <Pentara />
      </div>
    </div>
  );
}
