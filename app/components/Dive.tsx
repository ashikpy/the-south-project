"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CloudShader } from "@/components/ui/cloud-shader";
import FluidOrb from "@/components/ui/fluid-orb";
import DeepParticles, { type DiveState } from "./DeepParticles";
import Earth, { earthReadout, type EarthView } from "./Earth";
import ShootingStars from "./ShootingStars";
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
  space: [0.43, 0.5], // --space: out in space, among the stars
  rise: [0.46, 0.6], // earthrise: the planet rises, the sun breaks over it
  meteors: [0.45, 0.66], // shooting stars cross the sky while in space
  station: [0.55, 0.7], // the space station flies by, from far ahead to beside you
  zoom: [0.54, 0.88], // the descent to southern India (Earth.tsx)
  mist: [0.8, 0.95], // --mist: into the cloud tops, a white-out
  sky: [0.85, 0.93], // --sky: under the clouds, the sky (CloudShader)
  origo: [0.885, 0.935], // --origo: ORIGO, the mountains ahead, and its orb
} as const;

/** The five expressions, in the order they are met. */
const PENTARA = [
  { name: "NEXIO", tone: "#24566A" },
  { name: "ORIGO", tone: "#8B7968" },
  { name: "SILVA", tone: "#536B50" },
  { name: "CULTURA", tone: "#B49355" },
  { name: "TENAX", tone: "#A65F45" },
];
/** Met so far by the end of the dive: NEXIO (the ocean) and ORIGO. */
const UNLOCKED = 2;

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
  const earth = useRef<EarthView>({ zoom: 0, on: false, rise: 0 });
  // Shooting stars start only while out in space, before the descent.
  const meteors = useRef(false);
  const altitude = useRef<HTMLElement>(null);
  const position = useRef<HTMLElement>(null);
  // Heavy layers start ahead of their turn and stop when far away.
  const [earthOn, setEarthOn] = useState(false);
  const [skyOn, setSkyOn] = useState(false);

  useEffect(() => {
    const el = track.current;
    const st = stage.current;
    if (!el || !st) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const show = requestAnimationFrame(() => {
        earth.current = { zoom: 0, on: true, rise: 1 };
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
      set("--space-black", easeInOut(range(p, PHASES.space)));
      set("--sky", sky);
      set("--origo", easeInOut(range(p, PHASES.origo)));
      set("--track", p);
      // Layers fully covered or faded out stop drawing (see Dive.css).
      st.classList.toggle("is-rays-off", p > 0.13);
      st.classList.toggle("is-past-surface", p > PHASES.deep[1] + 0.01);
      st.classList.toggle("is-past-words", p > PHASES.pass[1]);
      st.classList.toggle("is-in-sky", p > PHASES.sky[1]);

      // Mount the Earth once the statement begins (textures load in time),
      // the sky shortly before the clouds.
      if (p >= PHASES.words[0]) setEarthOn(true);
      // The sky shader is the heaviest layer: start it just before it shows.
      setSkyOn(p >= PHASES.sky[0] - 0.04);

      const zoom = easeInOut(range(p, PHASES.zoom));
      earth.current.zoom = zoom;
      earth.current.rise = range(p, PHASES.rise);
      earth.current.station = range(p, PHASES.station);
      meteors.current = p > PHASES.meteors[0] && p < PHASES.meteors[1];

      // Travel readout: altitude and the point below, closing in.
      const mist = Math.sin(Math.PI * range(p, PHASES.mist));
      set("--hud", easeInOut(range(p, PHASES.rise)) * (1 - Math.min(1, mist * 2 + sky)));
      if (p > PHASES.space[0] && altitude.current && position.current) {
        const r = earthReadout(zoom);
        altitude.current.textContent = `${Math.round(r.km).toLocaleString("en-US")} km`;
        position.current.textContent = `${Math.abs(r.lat).toFixed(2)}° ${r.lat < 0 ? "S" : "N"}  ${Math.abs(r.lon).toFixed(2)}° ${r.lon < 0 ? "W" : "E"}`;
      }
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
          <div className="descent-space" />
          <ShootingStars className="descent-meteors" active={meteors} />
          {earthOn && <Earth className="descent-earth" view={earth} />}
          <div className="descent-sky">
            {skyOn && <CloudShader className="h-full min-h-0" quality={0.45} />}
          </div>
          <div className="descent-mist" />
          {/* ORIGO: the word lights the sky (soft light). */}
          <div className="origo">
            <p className="origo-word">ORIGO</p>
            <p className="origo-idea">Origin · Mountains</p>
          </div>

          {/* The five expressions: those met so far shine, the rest wait,
              faded, until you reach them. */}
          <div className="collect">
            <ol className="collect-slots">
              {PENTARA.map((x, i) => (
                <li
                  key={x.name}
                  className={`collect-slot${i < UNLOCKED ? " is-unlocked" : ""}`}
                  title={x.name}
                >
                  {skyOn && (
                    <FluidOrb
                      size={48}
                      color={x.tone}
                      animate={false}
                      style={{ width: "100%", height: "100%" }}
                    />
                  )}
                </li>
              ))}
            </ol>
          </div>
          <div className="descent-hud">
            <p className="descent-hud-title">Approaching southern India</p>
            <p className="descent-hud-item">
              <span>Altitude</span>
              <span ref={altitude}>38,226 km</span>
            </p>
            <p className="descent-hud-item descent-hud-end">
              <span>Position</span>
              <span ref={position}>8.41° W  0.00° N</span>
            </p>
          </div>
        </div>
        <Pentara />
      </div>
    </div>
  );
}
