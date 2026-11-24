"use client";

import { useEffect, useRef, type RefObject } from "react";
import Plane, { type PlaneView } from "./Plane";
import "./Cultura.css";

/** The fields' exports, for the browser to pick from. */
const GROUND = [1920, 2560].map((w) => `/cultura/ground-${w}.webp ${w}w`).join(", ");

/**
 * CULTURA, in the air. The water carries you there: the camera pushes into
 * the forest stream until it is all light, and pulls back out of the same
 * light on the farmland river, seen from high up. A King Air sweeps in
 * beside you, then flies off toward the low sun, and CULTURA lights the sky.
 * Dive.tsx drives it with --river-in, --river-out, --sheen, --cultura-word
 * and the plane's own view (Plane.tsx).
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
        <Plane view={plane} className="cultura-plane" />
      </div>
      {/* Light on the water, between the forest stream and the river below. */}
      <div className="cultura-sheen" />
    </div>
  );
}
