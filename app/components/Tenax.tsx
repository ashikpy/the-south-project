"use client";

import { useEffect, useRef } from "react";
import "./Tenax.css";

/** The desert's layers (public/tenax), on one tall 3:4 canvas. */
const dunes = (layer: "sky" | "land") =>
  (layer === "sky" ? [1440, 2160] : [1440, 2160, 3000])
    .map((w) => `/tenax/${layer}-${w}.webp ${w}w`)
    .join(", ");
/* The canvas is as wide as the screen, or wider on narrow ones (it covers). */
const SIZES = "(max-aspect-ratio: 3/4) 113vh, 100vw";

/*
 * The crests the wind takes sand from, traced from the photograph (% of the
 * canvas): the big dune's ridge, from its foot up to the skyline, and the far
 * peak. Each point: x, y, how much sand it gives.
 */
const CRESTS = [
  [44, 78.2, 0.35], [50, 75.6, 0.45], [56, 73.2, 0.55], [62, 71.2, 0.7], [67, 69.8, 0.85],
  [72.5, 69.0, 1], [80, 68.1, 1], [87.5, 67.45, 1], [95, 66.7, 0.9], [100, 66.4, 0.8],
  [19, 66.6, 0.3], [22.5, 65.5, 0.45], [26, 66.2, 0.3],
] as const;
/** Where the sun is, behind the big dune (% across): sand near it glows. */
const SUN_X = 78;
/** The band of the canvas the sand is drawn in (% of its height). */
const BAND = [58, 92] as const;

const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

/*
 * Sand blown off the crests, seen from a distance: not grains but a veil, a
 * thin shimmer lifted just above the ridge against the sky and trailing down
 * the shadowed lee face, streaming with the wind and coming and going in
 * gusts. Worked out per pixel from how far it is above or below the crest.
 */
const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_crest[${CRESTS.length}];

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(3.1, 1.7);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  // In the photograph's own terms: % across, % down.
  float px = uv.x * 100.0;
  float py = ${BAND[0].toFixed(1)} + (1.0 - uv.y) * ${(BAND[1] - BAND[0]).toFixed(1)};

  // The crest here, and how much sand it gives.
  float cy = 0.0;
  float k = 0.0;
  for (int i = 0; i < ${CRESTS.length - 1}; i++) {
    vec3 a = u_crest[i];
    vec3 b = u_crest[i + 1];
    if (b.x > a.x && b.x - a.x < 10.0 && px >= a.x && px <= b.x) {
      float f = (px - a.x) / (b.x - a.x);
      cy = mix(a.y, b.y, f);
      k = mix(a.z, b.z, f);
    }
  }
  if (k <= 0.0) {
    gl_FragColor = vec4(0.0);
    return;
  }

  float t = u_time;
  float rel = py - cy; // below the crest, in %
  // A thin lift above it, a longer trail down the lee face.
  float shape = rel < 0.0 ? exp(rel / 0.8) : exp(-rel / 2.6) * 0.8;
  // Streaming to the left with the wind, drawn out along it, falling as it goes.
  vec2 q = vec2(px * 0.32 + t * 1.6, rel * 1.4 - px * 0.05);
  float n = fbm(q * vec2(1.0, 2.6));
  float wisps = smoothstep(0.36, 0.72, n);
  // Gusts along the ridge: it comes and goes.
  float gust = smoothstep(0.3, 0.7, fbm(vec2(px * 0.06 + t * 0.25, t * 0.08)));
  float sun = exp(-pow((px - ${SUN_X.toFixed(1)}) / 16.0, 2.0));
  float a = wisps * shape * k * (0.35 + 0.65 * gust) * (0.4 + 0.55 * sun);
  vec3 c = mix(vec3(1.0, 0.76, 0.52), vec3(1.0, 0.93, 0.8), sun);
  gl_FragColor = vec4(c * a, a);
}
`;

/**
 * The veil of sand off the crests (FRAG), on the photograph's own canvas so
 * it moves with it; drawn at half resolution, as it is soft. Runs only while
 * the stage says you are in the desert.
 */
function Spindrift() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const gl = el.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return;
    const stage = el.closest(".dive-stage");

    const program = gl.createProgram();
    if (!program) return;
    const shaders = [
      [gl.VERTEX_SHADER, VERT],
      [gl.FRAGMENT_SHADER, FRAG],
    ].map(([type, source]) => {
      const shader = gl.createShader(type as number)!;
      gl.shaderSource(shader, source as string);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(shader));
      gl.attachShader(program, shader);
      return shader;
    });
    gl.bindAttribLocation(program, 0, "a_pos");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.uniform3fv(gl.getUniformLocation(program, "u_crest"), CRESTS.flat());
    const uRes = gl.getUniformLocation(program, "u_res");
    const uTime = gl.getUniformLocation(program, "u_time");

    const resize = () => {
      const scale = Math.min(0.6, 900 / Math.max(1, el.clientWidth));
      el.width = Math.max(1, Math.round(el.clientWidth * scale));
      el.height = Math.max(1, Math.round(el.clientHeight * scale));
      gl.viewport(0, 0, el.width, el.height);
      gl.uniform2f(uRes, el.width, el.height);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const start = performance.now();
    let raf = 0;
    let drawn = true;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!stage?.classList.contains("is-tenax") || stage.classList.contains("is-portal") || document.hidden) {
        if (drawn) gl.clear(gl.COLOR_BUFFER_BIT);
        drawn = false;
        return;
      }
      drawn = true;
      gl.uniform1f(uTime, ((now - start) / 1000) % 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      shaders.forEach((shader) => gl.deleteShader(shader));
    };
  }, []);

  return <canvas ref={canvas} className="tenax-spindrift" aria-hidden="true" />;
}

/**
 * TENAX, the arid lands. Out of the dust storm (Dust.tsx), the camera looks
 * up at the evening sky, then tilts down the tall frame to the dunes, the sun
 * just gone behind the big one, its light in shafts through the dusty air and
 * the wind taking sand off the crests. Dive.tsx drives it with --tilt (sky to
 * sand), --tenax-word (TENAX in the sky) and --sand (a slow push toward the
 * dune, as the sun goes down).
 */
export default function Tenax() {
  return (
    <div className="tenax" aria-hidden="true">
      <div className="tenax-canvas">
        {/* Plain img: pre-optimised WebP layers placed by CSS. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="tenax-sky" sizes={SIZES} srcSet={dunes("sky")} src="/tenax/sky-1440.webp" alt="" decoding="async" />
        <div className="tenax-sun" />
        {/* Shafts of light from behind the big dune, into the dusty air. */}
        <div className="tenax-rays">
          <i />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="tenax-land" sizes={SIZES} srcSet={dunes("land")} src="/tenax/land-1440.webp" alt="" decoding="async" />
        {/* The sun going down as you read. */}
        <div className="tenax-dusk" />
        <Spindrift />
      </div>
      <p className="tenax-word">TENAX</p>
    </div>
  );
}

/**
 * TENAX's story, told on the sand. Set like ORIGO's, SILVA's and CULTURA's
 * (Origo.css); Dive.tsx brings each line up in turn.
 */
export function TenaxStory() {
  return (
    <section className="origo-story tenax-story" aria-labelledby="tenax-story-title">
      <p className="origo-line tenax-line-out">Out here, the river runs out.</p>
      <p className="origo-line tenax-line-lasts">What lasts here, lasts on very little.</p>
      <div className="origo-meaning">
        {/* A dune's crest under a low sun, drawn as by a pen: what holds its shape. */}
        <svg className="tenax-dune" viewBox="0 0 64 40" aria-hidden="true">
          <path d="M2 34 C14 30 20 18 34 16 C44 15 52 22 62 30" pathLength={1} />
          <path d="M4 38 C20 36 40 36 60 37" pathLength={1} />
          <circle cx="46" cy="8" r="4.5" pathLength={1} />
        </svg>
        <h2 className="origo-meaning-title" id="tenax-story-title">
          TENAX — Resilience
        </h2>
        <div className="origo-meaning-lines">
          <p className="origo-line tenax-line-person">The wind reshapes the dunes every night. They are still here.</p>
          <p className="origo-line tenax-line-people">
            The South Project is made to last the same way: by adapting, by enduring, and together.
          </p>
        </div>
      </div>
      <p className="origo-line tenax-line-onward">Five landscapes. One way across them.</p>
    </section>
  );
}
