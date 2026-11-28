"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CloudShader } from "@/components/ui/cloud-shader";
import FluidOrb from "@/components/ui/fluid-orb";
import DeepParticles, { type DiveState } from "./DeepParticles";
import Earth, { earthReadout, type EarthView } from "./Earth";
import ShootingStars from "./ShootingStars";
import CloudBank from "./CloudBank";
import Pentara, { STATEMENT_TOKENS } from "./Pentara";
import OrigoStory from "./OrigoStory";
import Lightning from "./Lightning";
import Rain from "./Rain";
import River, { type RiverView } from "./River";
import Silva, { SilvaSky, SilvaStory } from "./Silva";
import SilvaForest from "./SilvaForest";
import Cultura, { CulturaStory } from "./Cultura";
import Dust, { type DustView } from "./Dust";
import Tenax, { TenaxStory } from "./Tenax";
import Keyhole from "./Keyhole";
import type { PlaneView } from "./Plane";
import "./Dive.css";
import "./Origo.css";

/*
 * Scroll phases, in screens of scroll from the top of the dive (the track is
 * TRACK screens long; Dive.css sets its height to match). span() turns them
 * into fractions of the track. Each becomes a CSS variable on the stage.
 */
const TRACK = 49;
const span = (from: number, to: number) => [from / TRACK, to / TRACK] as const;
const screens = (n: number) => n / TRACK;

const PHASES = {
  dive: span(0, 1.36), // --dive: zoom down into the water, hero type leaves
  deep: span(0.56, 1.68), // --deep: light fades to ink; particles appear
  words: span(1.52, 3.04), // --words: statement lights up word by word
  pass: span(3.2, 3.84), // --pass: you swim through the statement
  forward: span(3.2, 8), // the specks rush past: now stars, as you fly
  space: span(3.44, 4), // --space: out in space, among the stars
  rise: span(3.68, 4.8), // earthrise: the planet rises, the sun breaks over it
  meteors: span(3.6, 5.28), // shooting stars cross the sky while in space
  station: span(4.4, 5.6), // the space station flies by, from far ahead to beside you
  zoom: span(4.32, 7.04), // the descent to southern India (Earth.tsx)
  mist: span(6.4, 7.6), // --mist: into the cloud tops, a white-out
  sky: span(6.8, 7.44), // --sky: under the clouds, the sky (CloudShader)
  origo: span(7.08, 7.48), // --origo: ORIGO, the mountains ahead, and its orb
  cloud: span(7.8, 9.4), // --cloud: into a heavy cloud bank, a white-out
  reveal: span(9.2, 10.2), // --reveal: out of the cloud, the mountain appears
  settle: span(9.2, 10.6), // --settle: its layers settle at different speeds
  push: span(10.4, 11.5), // --push: a slow push-in toward the peak
  // ORIGO's story, told through water (Origo.css)
  wordOut: span(11, 11.35), // --word-out: the big word leaves
  rainIn: span(11, 11.4), // --rain: cloud over the slopes, light rain
  rainOut: span(11.75, 12.1), // ...and the sun comes back
  shadow: span(11, 12.1), // --shadow: the cloud's shadow crosses
  descend: span(11.6, 12.5), // --descend: down between the front hills
  stream: span(11.35, 12.3), // --stream: the rain becomes a river, down the valley
  dawnIn: span(11.8, 12.1), // --dawn: the storm breaks on a sunrise
  dawnOut: span(12.6, 13.15), // ...which clears to blue, a little gold left
  sunrise: span(11.85, 13), // --sunrise: the sun climbs from behind the ridge
  rainbow: span(12.7, 13.2), // --rainbow: then a rainbow, down into the valley
  onward: span(13.3, 14), // --onward: it pulls you on, into the trees
  // Into SILVA, one drone shot (Silva.css)
  fly: span(14, 15.1), // --fly: forward, low over the river
  bank: span(14.2, 15.8), // --bank: it leans into the climb, and levels (0–1–0)
  look: span(14.5, 15.6), // --look: it pitches up, from the valley to the canopy
  rush: span(14.65, 15.75), // --rush: it climbs, leaves whipping past the lens
  grow: span(14.8, 15.85), // --grow: leaves grow in from every edge
  silvaWord: span(15.5, 16.15), // --silva-word: SILVA out of the depth, its orb lights
  close: span(16.3, 16.9), // --close: the camera pushes up into the sun
  // Inside SILVA, by the stream (SilvaForest.css)
  glare: span(16.3, 16.9), // --glare: the sun's glare fills the lens; the cut is under it
  glareBack: span(16.9, 17.6), // --glare-back: it draws back into the gap the beams come through
  sink: span(16.88, 17.75), // --sink: leaves rush up past you as you drop through the canopy
  level: span(16.9, 17.85), // --level: the forest rises to eye level
  focus: span(17.5, 18.7), // --focus: focus pulls from the ferns to the forest
  walk: span(17.4, 21.8), // --walk: on along the stream
  unfurl: span(19.4, 20.3), // --unfurl: the fern by SILVA's meaning unfurls
  gold: span(21.1, 22), // --gold: the light warms, toward the farmlands
  // CULTURA, in the air (Cultura.css): the plane makes the cut
  flyover: span(21.2, 21.75), // --flyover: its shadow crosses the gap in the canopy
  wingPass: span(21.85, 22.4), // it tears across the lens; the sky behind it (Plane.tsx)
  arrive: span(22.6, 23.25), // it comes round beside you
  flyOff: span(23.25, 24.7), // ...then pulls ahead and flies off
  culturaWord: span(23.9, 24.6), // --cultura-word: CULTURA in the sky; its orb lights
  drop: span(24.85, 25.9), // --drop: the camera drops toward the fields
  haze: span(25.15, 25.95), // --haze: through the low cloud, a golden white-out; the cut under it
  land: span(25.5, 26.6), // --land: down to the vines, at the height of a drone
  rows: span(25.6, 30.8), // --rows: on, low along the rows, toward the trees
  dustIn: span(29.9, 31.15), // a wall of dust rises off the horizon and comes over the vines
  dustOut: span(31.3, 32.5), // ...the cut under it; it thins, and sinks to the sand
  tilt: span(31.5, 33.7), // --tilt: TENAX's evening sky, then down to the dunes
  tenaxWord: span(32.2, 32.9), // --tenax-word: TENAX in the sky; its orb lights
  sand: span(33.6, 37.9), // --sand: a slow push toward the big dune
  khDim: span(37.85, 38.5), // --kh-dim: the desert goes dark
  khRise: span(38.15, 38.85), // --kh-rise: the five orbs rise off their bar into an orbit
  khOrbit: span(38.5, 40.4), // --kh-orbit: round and round, closing in, their trails becoming a ring
  khCollapse: span(40.3, 40.85), // --kh-collapse: they fall into one another; a black hole forms
  khDistort: span(40.7, 41.4), // --kh-distort: it bends the desert round it
  khReveal: span(41.25, 42), // --kh-reveal: it opens as a keyhole, the ocean's light breaking through
  keyhole: span(41.8, 43.45), // you fly at it
  flash: span(43.15, 43.8), // --flash: through it, in a flash of the light beyond
  pullBack: span(43.5, 44.45), // --pullback: the camera pulls back; the ocean is a photograph on the page
};

/*
 * SILVA's story, in the forest, as BEATS above. Apart from them, as it has
 * its own shade (--silva-reading).
 */
const SILVA_BEATS = {
  slow: span(17.8, 18.55),
  feeds: span(18.55, 19.35),
  meaning: span(19.35, 21),
  person: span(19.35, 20.15),
  people: span(20.15, 21), // the longest line gets the most room
  onward: span(20.95, 21.75), // as the light turns gold
};

/* CULTURA's story, among the vines, as SILVA's, with its own shade. */
const CULTURA_BEATS = {
  shared: span(26.1, 26.9),
  makes: span(26.9, 27.7),
  meaning: span(27.7, 29.5),
  person: span(27.7, 28.55),
  people: span(28.55, 29.5),
  onward: span(29.45, 30.4), // toward the arid lands
};

/* TENAX's story, on the sand, as CULTURA's, with its own shade. */
const TENAX_BEATS = {
  out: span(33.9, 34.7),
  lasts: span(34.7, 35.5),
  meaning: span(35.5, 37.2),
  person: span(35.5, 36.35),
  people: span(36.35, 37.2),
  onward: span(37.15, 37.95),
};

/*
 * What The South Project is (About.tsx), chapter by chapter, one for each
 * landscape. The first is up through the keyhole; the last stays.
 */
const ABOUT_BEATS = [
  span(44.0, 45.4),
  span(45.2, 46.5),
  span(46.3, 47.6),
  span(47.4, 48.7),
  span(48.5, 50),
];

/*
 * When each line of the story is up, fades included. They don't overlap, as
 * they share one place on the slope. The meaning's title spans its two lines.
 */
const BEATS = {
  river: span(10.2, 11.15),
  rain: span(11.15, 11.95),
  meaning: span(12, 13.55),
  person: span(12, 12.9), // the longest line gets the most room
  people: span(12.9, 13.55),
  grows: span(13.55, 14.35), // leaves as the drone moves off
};

/** A mountain layer's exports (public/mountain), for the browser to pick from. */
const mountainSrcSet = (layer: "back" | "front") =>
  [1920, 2560, 3840].map((w) => `/mountain/${layer}-${w}.webp ${w}w`).join(", ");
/*
 * How wide a layer is drawn: the scene covers the screen, so on all but wide
 * screens its width follows the height (178vh, plus the final push-in). On
 * portrait screens most of it is off screen, so ask for less.
 */
const MOUNTAIN_SIZES =
  "(max-width: 600px) and (max-resolution: 2.5dppx) 140vh, (max-width: 600px) 100vh, (max-width: 1100px) and (orientation: portrait) 130vh, (max-aspect-ratio: 16/9) 183vh, 103vw";

/** The five expressions, in the order they are met. */
const PENTARA = [
  { name: "NEXIO", tone: "#24566A" },
  { name: "ORIGO", tone: "#8B7968" },
  { name: "SILVA", tone: "#536B50" },
  { name: "CULTURA", tone: "#B49355" },
  { name: "TENAX", tone: "#A65F45" },
];
/** Met on arriving at ORIGO: NEXIO (the ocean) and ORIGO. SILVA's lights later. */
const UNLOCKED = 2;

type Range = readonly [number, number];
const range = (p: number, [from, to]: Range) =>
  Math.min(1, Math.max(0, (p - from) / (to - from)));
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeSine = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;
const easeIn = (t: number) => t * t * t;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Up over the first 0.18 screens of a beat, down over the last. */
const beat = (p: number, [from, to]: Range) =>
  easeInOut(Math.min(range(p, [from, from + screens(0.18)]), 1 - range(p, [to - screens(0.18), to])));

/**
 * The dive: the hero pins while you scroll, the ocean zooms toward the deep
 * and goes to ink, Pentara is introduced, then you swim through it out into
 * space. The Earth turns to meet you and you descend to southern India,
 * through the cloud tops, into the sky, and out of a cloud bank onto ORIGO's
 * mountain, whose story is told through water. Then a drone shot carries
 * you over the river and up into SILVA's canopy, which closes over you, and
 * you come down inside the forest, by the same stream.
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
  // The cloud bank after ORIGO: progress read by its shader each frame.
  const cloudP = useRef(0);
  const [cloudOn, setCloudOn] = useState(false);
  const [mountainOn, setMountainOn] = useState(false);
  const [canopyOn, setCanopyOn] = useState(false);
  const [forestOn, setForestOn] = useState(false);
  const [inForest, setInForest] = useState(false);
  const forestRiver = useRef<RiverView>({ flow: 0, dawn: 0, rain: 0 });
  const [culturaOn, setCulturaOn] = useState(false);
  const [tenaxOn, setTenaxOn] = useState(false);
  const dust = useRef<DustView>({ rise: 0, clear: 0, sun: [0.06, 0.62] });
  const plane = useRef<PlaneView>({ on: false, pass: 0, arrive: 0, away: 0 });
  const rainAmount = useRef(0);
  const river = useRef<RiverView>({ flow: 0, dawn: 0, rain: 0 });
  const flash = useRef<HTMLDivElement>(null); // lightning's light on the land

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
    // What each property was last set to: unchanged ones are not written,
    // so the stage's styles are recalculated only when something moved.
    const written = new Map<string, string>();
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      const p = travel > 0 ? Math.min(1, Math.max(0, -rect.top / travel)) : 0;
      const set = (name: string, v: number) => {
        const value = v.toFixed(4);
        if (written.get(name) === value) return;
        written.set(name, value);
        st.style.setProperty(name, value);
      };

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
      const cloud = range(p, PHASES.cloud);
      cloudP.current = cloud;
      set("--cloud", easeInOut(cloud));
      setCloudOn(p >= PHASES.cloud[0] - screens(0.3) && p < PHASES.reveal[1]);
      set("--reveal", easeInOut(range(p, PHASES.reveal)));
      set("--settle", easeOut(range(p, PHASES.settle)));
      set("--push", easeInOut(range(p, PHASES.push)));
      if (p >= PHASES.origo[0]) setMountainOn(true);

      const rain = easeInOut(range(p, PHASES.rainIn)) * (1 - easeInOut(range(p, PHASES.rainOut)));
      rainAmount.current = rain;
      set("--rain", rain);
      const dawn = easeInOut(range(p, PHASES.dawnIn)) * (1 - easeInOut(range(p, PHASES.dawnOut)));
      set("--dawn", dawn);
      set("--sunrise", easeOut(range(p, PHASES.sunrise)));
      set("--rainbow", easeInOut(range(p, PHASES.rainbow)));
      set("--shadow", range(p, PHASES.shadow));
      set("--word-out", easeInOut(range(p, PHASES.wordOut)));
      set("--descend", easeInOut(range(p, PHASES.descend)));
      const flow = range(p, PHASES.stream);
      set("--stream", flow);
      const lookedUp = p >= PHASES.look[1];
      river.current.flow = lookedUp ? 0 : flow; // out of sight: stop drawing
      river.current.dawn = dawn;
      river.current.rain = rain;
      set("--onward", easeInOut(range(p, PHASES.onward)));
      let reading = 0;
      for (const [name, when] of Object.entries(BEATS)) {
        const shown = beat(p, when);
        reading = Math.max(reading, shown);
        set(`--beat-${name}`, shown);
      }
      set("--reading", reading);

      // SILVA's images start loading during ORIGO's rain.
      if (p >= PHASES.rainIn[0]) setCanopyOn(true);
      set("--fly", easeInOut(range(p, PHASES.fly)));
      set("--bank", Math.sin(Math.PI * easeSine(range(p, PHASES.bank))));
      set("--look", easeSine(range(p, PHASES.look)));
      set("--rush", range(p, PHASES.rush));
      set("--grow", range(p, PHASES.grow));
      set("--silva-word", easeInOut(range(p, PHASES.silvaWord)));
      set("--close", easeSine(range(p, PHASES.close)));
      const back = easeOut(range(p, PHASES.glareBack));
      set("--glare", easeIn(range(p, PHASES.glare)) * (1 - back));
      set("--glare-back", back);
      set("--sink", range(p, PHASES.sink));
      st.classList.toggle("is-looking-up", lookedUp);
      st.classList.toggle("is-canopy", p > PHASES.look[0]);
      if (p >= PHASES.grow[0]) setForestOn(true);
      set("--level", easeOut(range(p, PHASES.level)));
      set("--focus", easeInOut(range(p, PHASES.focus)));
      set("--walk", easeInOut(range(p, PHASES.walk)));
      set("--unfurl", easeInOut(range(p, PHASES.unfurl)));
      set("--gold", easeSine(range(p, PHASES.gold)));
      let silvaReading = 0;
      for (const [name, when] of Object.entries(SILVA_BEATS)) {
        const shown = beat(p, when);
        silvaReading = Math.max(silvaReading, shown);
        set(`--beat-silva-${name}`, shown);
      }
      set("--silva-reading", silvaReading);
      let culturaReading = 0;
      for (const [name, when] of Object.entries(CULTURA_BEATS)) {
        const shown = beat(p, when);
        culturaReading = Math.max(culturaReading, shown);
        set(`--beat-cultura-${name}`, shown);
      }
      set("--cultura-reading", culturaReading);
      let tenaxReading = 0;
      for (const [name, when] of Object.entries(TENAX_BEATS)) {
        const shown = beat(p, when);
        tenaxReading = Math.max(tenaxReading, shown);
        set(`--beat-tenax-${name}`, shown);
      }
      set("--tenax-reading", tenaxReading);
      st.classList.toggle("is-forest", p > PHASES.glare[0]);
      // The cut, at the glare's height: the canopy goes, the forest is there.
      // Once the plane has crossed, the forest is behind you.
      const cultura = p >= PHASES.wingPass[1];
      const forest = p >= PHASES.glareBack[0] && !cultura;
      st.classList.toggle("is-in-forest", forest);
      setInForest(forest);
      forestRiver.current.flow = forest ? 1 : 0;
      if (p >= PHASES.walk[0]) setCulturaOn(true);
      const flyover = range(p, PHASES.flyover);
      set("--flyover", flyover);
      set("--flyover-dip", Math.sin(Math.PI * flyover));
      const pass = range(p, PHASES.wingPass);
      plane.current.pass = pass;
      // Where the reveal has got to, following the plane across: set here
      // only, so the edge and the shadow over it always move together.
      st.style.setProperty("--wipe-x", pass <= 0 ? "-50%" : pass >= 1 ? "150%" : `${-30 + pass * 160}%`);
      set("--overhead", Math.sin(Math.PI * pass));
      // The camera looks up after it, then back down over the fields.
      set(
        "--sky-tilt",
        pass < 1
          ? easeInOut(Math.min(1, pass * 2.5))
          : 1 - easeInOut(range(p, [PHASES.wingPass[1], PHASES.arrive[0] + screens(0.15)])),
      );
      plane.current.on = (pass > 0 && pass < 1) || (p > PHASES.arrive[0] && p < PHASES.drop[0]);
      plane.current.arrive = easeOut(range(p, PHASES.arrive));
      const away = range(p, PHASES.flyOff);
      plane.current.away = away;
      // As it becomes a speck: a twinkle, and it's gone.
      set("--twinkle", range(away, [0.84, 1]));
      set("--cultura-word", easeInOut(range(p, PHASES.culturaWord)));
      // Down out of the sky, through the low cloud, to the vines.
      const drop = range(p, PHASES.drop);
      set("--drop", drop * drop);
      set("--haze", Math.sin(Math.PI * range(p, PHASES.haze)));
      set("--land", easeOut(range(p, PHASES.land)));
      set("--rows", easeInOut(range(p, PHASES.rows)));
      st.classList.toggle("is-vineyard", p >= (PHASES.haze[0] + PHASES.haze[1]) / 2);
      // The dust storm: a wall rising over the vines and on overhead, the
      // cut to the desert under it, then moving on, leaving dust on the sand. The sun behind
      // it moves from the vineyard's, on the left, to the desert's.
      if (p >= PHASES.rows[0]) setTenaxOn(true);
      const dustIn = range(p, PHASES.dustIn);
      const dustOut = range(p, PHASES.dustOut);
      dust.current.rise = Math.pow(dustIn, 1.3);
      dust.current.clear = easeInOut(dustOut);
      dust.current.sun[0] = 0.06 + 0.72 * dustOut;
      dust.current.sun[1] = 0.62 - 0.27 * dustOut;
      st.classList.toggle("is-tenax", p >= (PHASES.dustIn[1] + PHASES.dustOut[0]) / 2);
      set("--tilt", easeInOut(range(p, PHASES.tilt)));
      set("--tenax-word", easeInOut(range(p, PHASES.tenaxWord)));
      set("--sand", easeInOut(range(p, PHASES.sand)));
      // Out of Pentara: the desert goes dark, the orbs rise and orbit, fall
      // into one another as a black hole, which opens as a keyhole onto what
      // The South Project is (About.tsx). The portal (Keyhole.tsx) draws it
      // all, from these.
      const dim = range(p, PHASES.khDim);
      set("--kh-dim", dim);
      set("--kh-rise", range(p, PHASES.khRise));
      set("--kh-orbit", range(p, PHASES.khOrbit));
      set("--kh-collapse", range(p, PHASES.khCollapse));
      set("--kh-distort", range(p, PHASES.khDistort));
      set("--kh-reveal", range(p, PHASES.khReveal));
      const open = range(p, PHASES.keyhole);
      set("--kh-open", open);
      set("--keyhole", easeInOut(open));
      st.classList.toggle("is-void", dim > 0);
      st.classList.toggle("is-keyhole", open > 0);
      st.classList.toggle("is-about", open >= 1);
      set("--flash", Math.sin(Math.PI * range(p, PHASES.flash)));
      const pullBack = easeInOut(range(p, PHASES.pullBack));
      set("--pullback", pullBack);
      document.documentElement.classList.toggle("is-light", pullBack > 0.5);
      ABOUT_BEATS.forEach((when, i) => set(`--about-${i}`, beat(p, when)));
      st.classList.toggle("is-cultura", p > PHASES.wingPass[0]);
      st.classList.toggle("is-in-cultura", cultura);
      set("--track", p);
      // Layers fully covered or faded out stop drawing (see Dive.css).
      st.classList.toggle("is-rays-off", p > screens(1.04));
      st.classList.toggle("is-past-surface", p > PHASES.deep[1] + screens(0.08));
      st.classList.toggle("is-past-words", p > PHASES.pass[1]);
      st.classList.toggle("is-in-sky", p > PHASES.sky[1]);

      // Mount the Earth once the statement begins (textures load in time),
      // the sky shortly before the clouds.
      if (p >= PHASES.words[0]) setEarthOn(true);
      // The sky shader is the heaviest layer: start it just before it shows.
      setSkyOn(p >= PHASES.sky[0] - screens(0.32) && p < PHASES.cloud[1]);

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
      earth.current.on = p > PHASES.space[0] - screens(0.16) && sky < 1;

      // In screens, scaled: the specks rise at one speed however long the track.
      state.current.track = (p * TRACK) / 11.5;
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

  // The globe's maps are the heaviest thing on the page to get ready: start
  // it once the page has loaded and gone quiet, while you are still on the
  // hero, rather than when the statement begins.
  useEffect(() => {
    let id = 0;
    const start = () => {
      id = window.setTimeout(() => {
        if ("requestIdleCallback" in window) requestIdleCallback(() => setEarthOn(true), { timeout: 3000 });
        else setEarthOn(true);
      }, 600);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("load", start);
    };
  }, []);

  // Where the page's photograph sits (About.tsx), measured by layout (not
  // its transforms), for the ocean to settle into it after the keyhole.
  useEffect(() => {
    const st = stage.current;
    if (!st || !tenaxOn) return;
    const measure = () => {
      const frame = st.querySelector<HTMLElement>(".about-frame");
      const page = frame?.offsetParent as HTMLElement | null;
      if (!frame || !page) return;
      const t = frame.offsetTop;
      const l = frame.offsetLeft;
      const r = page.clientWidth - l - frame.offsetWidth;
      const b = page.clientHeight - t - frame.offsetHeight;
      st.style.setProperty("--frame-t", `${t}px`);
      st.style.setProperty("--frame-l", `${l}px`);
      st.style.setProperty("--frame-r", `${r}px`);
      st.style.setProperty("--frame-b", `${b}px`);
      st.style.setProperty("--frame-cx", `${l + frame.offsetWidth / 2 - page.clientWidth / 2}px`);
      st.style.setProperty("--frame-cy", `${t + frame.offsetHeight / 2 - page.clientHeight / 2}px`);
      st.style.setProperty("--frame-radius", getComputedStyle(frame).borderTopLeftRadius);
    };
    const id = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", measure);
    };
  }, [tenaxOn]);

  // Each scene's photographs are decoded as soon as it mounts, a screen or
  // more before it shows, one at a time when the browser is idle. Otherwise
  // they are decoded on the frame they first appear, and that frame stalls.
  useEffect(() => {
    const st = stage.current;
    if (!st) return;
    const idle = (fn: () => void) =>
      "requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 500 }) : setTimeout(fn, 50);
    let stopped = false;
    const queue = [...st.querySelectorAll<HTMLImageElement>("img:not([data-decoded])")];
    const next = () => {
      if (stopped) return;
      const img = queue.shift();
      if (!img) return;
      img.dataset.decoded = "";
      img.decode().catch(() => {}).finally(() => idle(next));
    };
    idle(next);
    return () => {
      stopped = true;
    };
  }, [mountainOn, canopyOn, forestOn, culturaOn, tenaxOn]);

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
          </div>

          {/* ORIGO's mountain, behind the cloud bank: two layers set to the
              original photo's composition, settling at different speeds. */}
          {mountainOn && (
            <div className="mountain">
              {canopyOn && <SilvaSky />}
              <div className="mountain-scene">
                {/* The far layer: the photograph, river, weather and haze,
                    moving together. */}
                <div className="mountain-far">
                  {/* Plain img: pre-optimised WebP layers sharing one canvas,
                      placed by CSS; next/image adds nothing. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="mountain-back"
                    sizes={MOUNTAIN_SIZES}
                    srcSet={mountainSrcSet("back")}
                    src="/mountain/back-2560.webp"
                    alt=""
                    decoding="async"
                  />
                  {/* The storm's light on everything: the photograph's own
                      cloud too turns grey, and the range goes dark. */}
                  <div className="origo-gloom" />
                  {/* Alpenglow: at sunrise the range turns rose and gold. */}
                  <div className="origo-alpenglow" />
                  {/* The river: the real one on the valley floor, swollen by
                      the rain, and the current moving on it (River.tsx). */}
                  <div className="origo-stream">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/mountain/stream.webp" alt="" decoding="async" />
                    <River className="origo-river" view={river} />
                  </div>
                  {/* The sky's weather, fading out above the peaks so the
                      photograph's own low cloud lies between: storm,
                      lightning, and the sunrise. */}
                  <div className="origo-sky">
                    <div className="origo-overcast" />
                    <div className="origo-storm" />
                    <Lightning className="origo-lightning" amount={rainAmount} flash={flash} />
                    <div className="origo-dawn" />
                    <div className="origo-sun" />
                  </div>
                  <p className="mountain-word">ORIGO</p>
                  <div className="mountain-haze" />
                  <div className="mountain-mist" />
                </div>
                <div className="origo-sunlight" />
                {/* In the rain between you and the mountain, so it crosses
                    the slopes and lands behind the trees. */}
                <div className="origo-rainbow" />
                <div className="origo-valley-mist" />
                {/* The near layer: the forested ridge and the trees. */}
                <div className="mountain-near">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="mountain-front"
                    sizes={MOUNTAIN_SIZES}
                    srcSet={mountainSrcSet("front")}
                    src="/mountain/front-2560.webp"
                    alt=""
                    decoding="async"
                  />
                </div>
              </div>
              <div className="mountain-light" />
              <div className="origo-shadow" />
              <div className="origo-warmth" />
              <div className="origo-flash" ref={flash} />
              <Rain className="origo-rain" amount={rainAmount} />
            </div>
          )}

          {/* Into a heavy cloud bank: the curtain before the mountains. */}
          {cloudOn && <CloudBank className="descent-cloud" progress={cloudP} />}

          {canopyOn && <Silva />}
          {forestOn && <SilvaForest river={forestRiver} lit={inForest} />}
          {culturaOn && <Cultura plane={plane} />}
          {tenaxOn && <Tenax />}
          {tenaxOn && <Dust className="descent-dust" view={dust} />}
          {/* Out of Pentara, through a keyhole, into the real world. */}
          {tenaxOn && <Keyhole />}

          {/* The five expressions: those met so far shine, the rest wait,
              faded, until you reach them. */}
          <div className="collect">
            <ol className="collect-slots">
              {PENTARA.map((x, i) => (
                <li
                  key={x.name}
                  className={`collect-slot${i < UNLOCKED ? " is-unlocked" : ""}${x.name === "SILVA" ? " is-silva" : ""}${x.name === "CULTURA" ? " is-cultura" : ""}${x.name === "TENAX" ? " is-tenax" : ""}`}
                  title={x.name}
                  style={{ "--i": i } as CSSProperties}
                >
                  {(skyOn || cloudOn || mountainOn) && (
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
        <OrigoStory />
        <SilvaStory />
        <CulturaStory />
        <TenaxStory />
      </div>
    </div>
  );
}
