"use client";

import { useEffect, useRef, type RefObject } from "react";
import Plane, { type PlaneView } from "./Plane";
import "./Cultura.css";

/** The fields' exports, for the browser to pick from. */
const GROUND = [1920, 2560].map((w) => `/cultura/ground-${w}.webp ${w}w`).join(", ");

/**
 * CULTURA, in the air. The plane makes the cut: its shadow crosses the gap
 * in the forest canopy, then it tears across the lens, and behind it the
 * forest is gone and you are in the evening sky over the farmlands. It
 * comes round beside you, then flies off toward the low sun, and CULTURA
 * lights the sky. Dive.tsx drives it with --cultura-word and the plane's
 * own view (Plane.tsx). The sky is revealed behind it as it crosses
 * (--wipe-x), as the camera looks up after it (--sky-tilt).
 */
export default function Cultura({ plane }: { plane: RefObject<PlaneView> }) {
  const ground = useRef<HTMLImageElement>(null);
  // Mounted early: decode the fields now, not when they first show.
  useEffect(() => {
    ground.current?.decode().catch(() => {});
  }, []);

  return (
    <div className="cultura" aria-hidden="true">
      <div className="cultura-scene">
        {/* The fields and cloud, pulled back from; the plane and word aren't. */}
        <div className="cultura-zoom">
          <div className="cultura-ground">
            {/* Plain img: a pre-optimised WebP placed by CSS. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={ground}
              sizes="(max-aspect-ratio: 16/9) 200vh, 112vw"
              srcSet={GROUND}
              src="/cultura/ground-1920.webp"
              alt=""
              decoding="async"
            />
          </div>
          <div className="cultura-clouds">
            <i />
            <i />
          </div>
        </div>
        <p className="cultura-word">CULTURA</p>
      </div>
      <div className="cultura-shadow" />
      {/* The plane's goodbye: a twinkle where it was, then nothing. */}
      <svg className="cultura-twinkle" viewBox="-1 -1 2 2" aria-hidden="true">
        <path d="M0-1C.07-.07.07-.07 1 0C.07.07.07.07 0 1C-.07.07-.07.07-1 0C-.07-.07-.07-.07 0-1Z" />
        <path
          className="is-small"
          d="M0-1C.07-.07.07-.07 1 0C.07.07.07.07 0 1C-.07.07-.07.07-1 0C-.07-.07-.07-.07 0-1Z"
        />
      </svg>
      {/* Over everything: it goes over low, out of the forest. */}
      <Plane view={plane} className="cultura-plane" />
      {/* Motion blur for the pass: across only, as a camera panning with it. */}
      <svg className="cultura-defs" aria-hidden="true">
        <filter id="cultura-blur" x="-10%" y="0" width="120%" height="100%">
          <feGaussianBlur stdDeviation="12 1" />
        </filter>
      </svg>
    </div>
  );
}
