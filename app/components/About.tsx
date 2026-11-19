"use client";

import Image from "next/image";
import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";
import "./About.css";

/*
 * DRAFT COPY — placeholder brand lines, not facts. Replace with the real
 * story and real figures of The South Project before launch.
 */
const STATEMENT =
  "The South Project {chips} is a quiet collection of places by the southern sea, made for slow mornings, long light and rooms that let you breathe, for people who would rather stay than pass through.";

const STATS = [
  { value: 365, suffix: "", label: "Sunsets a year" },
  { value: 7, suffix: "", label: "Days to slow down" },
  { value: 1, suffix: "", label: "Sea to wake up to" },
];

// Crops of the hero photograph, shown as small tiles inside the sentence.
const CHIPS = ["74% 70%", "20% 85%", "96% 80%"];

// Scroll progress (0–1 through the pinned stretch) at which things happen.
const WORDS_FROM = 0.04;
const WORDS_TO = 0.72;
const STATS_AT = 0.8;

const vars = (v: Record<string, number | string>) => v as CSSProperties;

function Chips() {
  return (
    <span className="about-chips" aria-hidden="true">
      {CHIPS.map((position, i) => (
        <span key={position} className="about-chip" style={vars({ "--c": i })}>
          <Image
            src="/hero/beach.png"
            alt=""
            fill
            sizes="64px"
            style={{ objectFit: "cover", objectPosition: position }}
          />
        </span>
      ))}
    </span>
  );
}

/** Counts up from zero once `active`, easing out like it is settling. */
function Stat({ value, suffix, label, active, index }: {
  value: number;
  suffix: string;
  label: string;
  active: boolean;
  index: number;
}) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!active) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reduced ? 0 : index * 120;
    const duration = reduced ? 0 : 1600;
    let start = 0;
    let frame = requestAnimationFrame(function tick(now) {
      if (!start) start = now + delay;
      const t = duration ? Math.min(1, Math.max(0, (now - start) / duration)) : 1;
      setShown(Math.round(value * (1 - Math.pow(2, -10 * t))));
      if (t < 1) frame = requestAnimationFrame(tick);
      else setShown(value);
    });
    return () => cancelAnimationFrame(frame);
  }, [active, value, index]);

  return (
    <div className={`about-stat${active ? " is-in" : ""}`} style={vars({ "--i": index })}>
      <p className="about-stat-value">
        <span aria-hidden="true">
          {shown}
          {suffix}
        </span>
        <span className="sr-only">
          {value}
          {suffix}
        </span>
      </p>
      <p className="about-stat-label">{label}</p>
    </div>
  );
}

/**
 * About: the section pins while the statement lights up word by word with
 * the scroll, then the three figures count in beneath it.
 */
export default function About() {
  const section = useRef<HTMLElement>(null);
  const statement = useRef<HTMLParagraphElement>(null);
  const [statsIn, setStatsIn] = useState(false);

  const words = STATEMENT.split(" ");
  const wordCount = words.filter((w) => w !== "{chips}").length;

  useEffect(() => {
    const el = section.current;
    const text = statement.current;
    if (!el || !text) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      text.style.setProperty("--p", String(wordCount + 1));
      const frame = requestAnimationFrame(() => setStatsIn(true));
      return () => cancelAnimationFrame(frame);
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      const p = Math.min(1, Math.max(0, -rect.top / travel));
      const words = ((p - WORDS_FROM) / (WORDS_TO - WORDS_FROM)) * (wordCount + 1);
      text.style.setProperty("--p", words.toFixed(3));
      if (p >= STATS_AT) setStatsIn(true);
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
  }, [wordCount]);

  let index = 0;

  return (
    <section ref={section} className="about" id="story" aria-labelledby="about-label">
      <div className="about-pin">
        <p className="about-label" id="about-label">
          <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
            <path
              d="M6 1v10M1.7 3.5l8.6 5M1.7 8.5l8.6-5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          About us
        </p>

        <p className="about-statement" ref={statement}>
          <span className="sr-only">{STATEMENT.replace(" {chips}", "")}</span>
          <span aria-hidden="true">
            {words.map((word, i) => (
              <Fragment key={i}>
                {word === "{chips}" ? (
                  <Chips />
                ) : (
                  <span className="about-word" style={vars({ "--w": index++ })}>
                    {word}
                  </span>
                )}{" "}
              </Fragment>
            ))}
          </span>
        </p>

        <div className="about-stats">
          {STATS.map((stat, i) => (
            <Stat key={stat.label} {...stat} index={i} active={statsIn} />
          ))}
        </div>
      </div>
    </section>
  );
}
