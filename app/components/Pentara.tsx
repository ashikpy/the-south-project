import type { CSSProperties } from "react";
import { WORDMARK_PATH, WORDMARK_VIEWBOX } from "./wordmark";

const vars = (v: Record<string, number | string>) => v as CSSProperties;

/** Statement words; the brand name is set as the wordmark itself (last token). */
const WORDS =
  "One brand. Five expressions. Pentara is the five-landscape philosophy behind".split(
    " ",
  );
export const STATEMENT_TOKENS = WORDS.length + 1;

function Wordmark() {
  return (
    <svg
      className="pentara-wordmark"
      viewBox={WORDMARK_VIEWBOX}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={WORDMARK_PATH} />
    </svg>
  );
}

/**
 * Pentara, revealed in the dive (Dive.tsx): the statement lights up word by
 * word and ends on the wordmark; then you swim through it, out into space.
 */
export default function Pentara() {
  return (
    <section className="pentara" id="pentara" aria-labelledby="pentara-label">
      <div className="pentara-intro">
        <p className="pentara-label" id="pentara-label">
          <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
            <path
              d="M6 1v10M1.7 3.5l8.6 5M1.7 8.5l8.6-5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Pentara
        </p>

        <p className="pentara-statement">
          <span className="sr-only">{WORDS.join(" ")} The South Project.</span>
          <span aria-hidden="true">
            {WORDS.map((word, i) => (
              <span key={i}>
                <span className="pentara-word" style={vars({ "--w": i })}>
                  {word}
                </span>{" "}
              </span>
            ))}
            <span
              className="pentara-word pentara-brand"
              style={vars({ "--w": WORDS.length })}
            >
              <Wordmark />.
            </span>
          </span>
        </p>
      </div>
    </section>
  );
}
