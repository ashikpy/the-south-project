import type { ReactNode } from "react";
import "./About.css";

/*
 * What The South Project is, out of Pentara and into the real world: seen
 * through the keyhole the five orbs make at the end of the journey, then
 * told in five chapters, one for each landscape you came through. A large
 * photograph on the left changes with each; the words are on the right.
 * Dive.tsx brings each chapter up in turn (--about-0 to --about-4).
 *
 * The words are drafts from the Pentara brief, to be rewritten: nothing
 * here claims more than the brief does.
 */

const CHAPTERS = [
  {
    land: "NEXIO — Connection",
    image: "/hero/ocean-frame-1920.webp",
    title: "A landscape of ideas, people and possibilities.",
    text: "The South Project is a creative collective: people from different places and disciplines, meeting to bring ideas to life.",
  },
  {
    land: "ORIGO — Origin",
    image: "/mountain/back-1920.webp",
    title: "It starts with you.",
    text: "Every project begins with a person, and the place they come from. Bring yours.",
  },
  {
    land: "SILVA — Growth",
    image: "/silva/forest/back-1920.webp",
    title: "Nothing grows alone.",
    text: "Here an idea finds the people it needs, and the patience to grow.",
  },
  {
    land: "CULTURA — Creation",
    image: "/cultura/ground-1920.webp",
    title: "Made real, together.",
    text: "From a first conversation to a finished project, worked on side by side.",
  },
  {
    land: "TENAX — Resilience",
    image: "/tenax/frame-1600.webp",
    title: "Your idea starts here.",
    text: "It doesn’t need permission. It needs people, and a place to begin.",
  },
] as const;

/**
 * The section, pinned on the journey's stage. `children` lies between the
 * paper and the frame: the keyhole's ocean (Keyhole.tsx), which becomes the
 * first chapter's photograph.
 */
export default function About({ children }: { children?: ReactNode }) {
  return (
    <section className="about" aria-labelledby="about-title">
      <div className="about-paper" />
      {children}
      <div className="about-frame">
        {CHAPTERS.map((c, i) => (
          // Plain img: pre-optimised WebP from the journey, placed by CSS.
          // eslint-disable-next-line @next/next/no-img-element
          <img key={c.image} className={`about-image about-${i}`} src={c.image} alt="" decoding="async" />
        ))}
        {CHAPTERS.map((c, i) => (
          <p key={c.land} className={`about-land about-${i}`} aria-hidden="true">
            {c.land}
          </p>
        ))}
      </div>
      {/* Where you are among the five. */}
      <ol className="about-progress" aria-hidden="true">
        {CHAPTERS.map((c, i) => (
          <li key={c.land} className={`about-${i}`} />
        ))}
      </ol>
      <div className="about-words">
        {CHAPTERS.map((c, i) => (
          <div key={c.title} className={`about-chapter about-${i}`}>
            {i === 0 ? (
              <h2 className="about-title" id="about-title">
                {c.title}
              </h2>
            ) : (
              <h3 className="about-title">{c.title}</h3>
            )}
            <div className="about-foot">
              <p>{c.text}</p>
              {i === CHAPTERS.length - 1 && (
                <a className="about-button" href="#join">
                  Join us
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
