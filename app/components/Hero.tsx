import type { CSSProperties } from "react";
import HeroMedia from "./HeroMedia";
import HeroRays from "./HeroRays";
import "./Hero.css";

/*
 * Copy from the Pentara concept brief. The hero sets the mood only;
 * the five landscapes are revealed further down as visitors scroll.
 */
const COPY = {
  meta: ["the south project", "pentara — five landscapes", "© 2026"],
  intro: ["a landscape", "of ideas, people", "and possibilities"],
  note: ["one collective,", "five expressions —", "begin at the ocean"],
  cue: "[ to see more — keep scrolling ]",
};

const vars = (v: Record<string, number>) => v as CSSProperties;

/** A word set letter by letter: each rises out of its rule and lifts on hover. */
function Letters({ text }: { text: string }) {
  return (
    <span className="hero-word" aria-hidden="true">
      {[...text].map((char, i) => (
        <span key={i} className="hero-char" style={vars({ "--i": i })}>
          <span className="hero-char-inner">{char === " " ? " " : char}</span>
        </span>
      ))}
    </span>
  );
}

/** Lines of small text that slide up out of their own masks, one after another. */
function Lines({ lines, start = 0 }: { lines: string[]; start?: number }) {
  return lines.map((line, i) => (
    <span key={line} className="hero-mask">
      <span style={vars({ "--i": start + i })}>{line}</span>
    </span>
  ));
}

/**
 * Landing hero. Composition from Figma (TSP / "MacBook Air - 1", node 1:4),
 * typographic treatment after an editorial reference: crisp display type
 * cropped on hairline rules, with a quiet layer of small uppercase notes.
 *
 * Entrance is timed in CSS to begin as the loader's curtain lifts.
 */
export default function Hero() {
  return (
    <section className="hero" aria-label="The South Project">
      <HeroMedia />
      <HeroRays />

      <p className="hero-intro">
        <Lines lines={COPY.intro} />
      </p>

      <h1 className="hero-title">
        <span className="sr-only">the south project</span>
        <span className="hero-row hero-row--top">
          <Letters text="the south" />
        </span>
        <span className="hero-row hero-row--bottom">
          <Letters text="project" />
        </span>
      </h1>

      <p className="hero-note">
        <Lines lines={COPY.note} start={2} />
      </p>

      <footer className="hero-meta hero-small">
        <Lines lines={[COPY.cue, ...COPY.meta]} start={4} />
      </footer>
    </section>
  );
}
