"use client";

import { useEffect, useRef, type RefObject } from "react";

/** The dust, read each frame. */
export interface DustView {
  /** the storm coming: 0 clear air, 1 overhead, a white-out */
  rise: number;
  /** ...and passing on: 1 it has gone, the dust left blowing low over the sand */
  clear: number;
  /** the low sun behind it, across and up the screen (0–1, from bottom left) */
  sun: [number, number];
}

const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

/*
 * A dust storm, a wall of it, backlit by a low sun. It rises off the horizon
 * and grows as it comes, dark at its foot and gold along its billowing top;
 * the air hazes before it arrives, and then it is overhead. Three ranks of
 * domain-warped noise make it, lit on the side toward the sun. Fine grit
 * streaks past the lens. It moves on clearing from the top down, and leaves
 * dust blowing low over the sand.
 */
const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_rise;
uniform float u_clear;
uniform vec2 u_sun;

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
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p + vec2(3.1, 1.7);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = u_time;

  // Light scattered forward toward the sun: the dust glows around it.
  float toSun = length((uv - u_sun) * vec2(aspect, 1.0));
  float glow = exp(-toSun * 2.0);
  vec3 dark = vec3(0.36, 0.22, 0.14);
  vec3 body = vec3(0.74, 0.52, 0.34);
  vec3 lit = vec3(1.0, 0.79, 0.54);
  vec3 hot = vec3(1.0, 0.92, 0.76);

  // Coming, the wall rises off the horizon and grows as it nears, until it
  // is overhead. Going, it moves on, clearing from the top down.
  float near = u_rise * u_rise;
  // Slow at first, so it stands on the horizon a while, then on you.
  float top = mix(0.25, 1.65, pow(u_rise, 1.6)) - u_clear * 1.8;

  // The air thickens before it arrives; at its height a veil under it all,
  // so the cut beneath is never seen. The billows move over both.
  float haze = smoothstep(0.0, 0.7, u_rise) * 0.3 * (1.0 - u_clear);
  float veil = smoothstep(0.86, 1.0, u_rise) * (1.0 - smoothstep(0.0, 0.18, u_clear));
  float under = max(haze, veil);
  vec3 col = mix(vec3(0.84, 0.6, 0.4), hot, glow * 0.6) * under;
  float alpha = under;

  // Toward the sun, for lighting the billows: lit on the side facing it.
  // (It fades out right at the sun, where the direction turns about.)
  vec2 toward = normalize((u_sun - uv) * vec2(aspect, 1.0) + 1e-4) * 0.06 * smoothstep(0.0, 0.25, toSun);

  // Three ranks of it, far to near, each laid over the last.
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    // Nearer, the billows are bigger.
    float scale = (0.9 + fi * 0.8) * (1.3 - 0.65 * near);
    float speed = 0.04 + fi * 0.07;
    // Rolling along the wind, and slowly up, as a storm front boils.
    vec2 q = p * scale * vec2(0.55, 1.0) + vec2(-t * speed, fi * 7.3 - t * 0.05 * (1.0 + fi));
    vec2 w = vec2(fbm(q + vec2(0.0, t * 0.06)), fbm(q + vec2(5.2, 1.3) - t * 0.05));
    float d = fbm(q + 1.3 * w);
    // Lit where it thins toward the sun, shaded where it thickens.
    float ahead = fbm(q + 1.3 * w + toward * scale * 1.5);
    float light = clamp(1.0 + (d - ahead) * 2.4, 0.72, 1.2);
    // Gusts: long streaks along the wind.
    float streak = fbm(vec2(q.x * 0.28, q.y * 5.0) + w * 1.5);
    d = d * 0.75 + streak * 0.3;

    // The wall's top: great rounded billows, the far rank lowest.
    float crest = top - (2.0 - fi) * 0.08
      + (fbm(vec2(uv.x * aspect * (1.3 - 0.6 * near) + fi * 3.0 - t * 0.02, t * 0.04 + fi)) - 0.5) * 0.5;
    float inside = crest - uv.y;
    float wall = smoothstep(-0.02, 0.09, inside + (d - 0.5) * 0.16);
    // Left behind it: dust blowing low over the sand.
    float settled = u_clear * (1.0 - smoothstep(0.0, 0.55 - (2.0 - fi) * 0.09, uv.y));

    float presence = max(wall, settled);
    float amount = clamp(max(wall * (0.72 + 0.3 * u_rise), settled * 0.3), 0.0, 1.0);
    float th = mix(0.88, -0.02, amount);
    float layer = smoothstep(th, th + 0.45, d) * presence;
    float thick = smoothstep(th + 0.08, th + 0.6, d);

    // Dark at its foot, in its own shadow; gold along its top, where the low
    // sun catches it; the low dust after it, lighter.
    float rim = 1.0 - smoothstep(0.0, 0.18, inside);
    vec3 c = mix(body, dark, thick * 0.5);
    c = mix(c, dark, (1.0 - smoothstep(0.0, 0.55, uv.y)) * 0.4 * wall * (1.0 - veil));
    c = mix(c, mix(lit, hot, glow), rim * 0.9 * wall);
    c = mix(c, lit, settled * (1.0 - wall) * 0.45);
    c = mix(c, hot, glow * (1.0 - thick) * 0.7);
    c *= light;
    c *= 0.84 + fi * 0.08;
    col = c * layer + col * (1.0 - layer);
    alpha = layer + alpha * (1.0 - layer);
  }

  // Sand snakes: once it has passed, fine streams of sand racing low over
  // the ground, in long ribbons that twist as they go.
  float ground = u_clear * (1.0 - smoothstep(0.02, 0.42, uv.y));
  if (ground > 0.001) {
    vec2 s = vec2(p.x * 1.4 + t * 1.1, p.y * 26.0);
    s.y += fbm(vec2(p.x * 0.8 + t * 0.3, p.y * 3.0)) * 6.0;
    float ribbon = fbm(s) * 0.6 + fbm(s * vec2(2.3, 1.7) + 4.0) * 0.4;
    float snake = smoothstep(0.56, 0.78, ribbon) * ground;
    snake *= 0.55 + 0.45 * fbm(vec2(p.x * 0.6 + t * 0.5, t * 0.2));
    vec3 sc = mix(lit, hot, glow * 0.8) * 0.95;
    col = sc * snake * 0.55 + col * (1.0 - snake * 0.55);
    alpha = snake * 0.55 + alpha * (1.0 - snake * 0.55);
  }

  // Grit blown past the lens: a few short, faint streaks, fastest of all,
  // each there only for a moment, and most of it low down.
  vec2 g = vec2(p.x * 18.0 - t * 7.0, p.y * 90.0 + p.x * 4.0);
  vec2 cell = floor(g);
  vec2 f = fract(g) - 0.5;
  float h = hash(cell);
  float blink = step(0.6, hash(cell + floor(t * 2.0 + h * 7.0)));
  f.y += (hash(cell + 3.1) - 0.5) * 0.6;
  float speck = step(0.992, h) * blink * (1.0 - smoothstep(0.05, 0.5, length(f * vec2(0.45, 1.6))));
  float gritAmount = near * (1.0 - u_clear) * (1.0 - veil) * 0.35 * (0.4 + 0.6 * (1.0 - smoothstep(0.2, 0.9, uv.y)))
    + u_clear * 0.45 * (1.0 - smoothstep(0.0, 0.4, uv.y));
  float grit = speck * gritAmount * (0.4 + 0.6 * hash(cell + 9.0));
  col += hot * grit * 0.9;
  alpha = max(alpha, grit * 0.9);

  gl_FragColor = vec4(col, alpha);
}
`;

/**
 * The dust storm between CULTURA and TENAX (Dive.tsx drives it), drawn at
 * half resolution: it is soft, and the GPU has the photographs to draw too.
 * It runs only while there is dust.
 */
export default function Dust({ view, className }: { view: RefObject<DustView>; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const gl = el.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return;

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

    const uRes = gl.getUniformLocation(program, "u_res");
    const uTime = gl.getUniformLocation(program, "u_time");
    const uRise = gl.getUniformLocation(program, "u_rise");
    const uClear = gl.getUniformLocation(program, "u_clear");
    const uSun = gl.getUniformLocation(program, "u_sun");

    const resize = () => {
      // Half resolution, and never more than 960 across: dust is soft.
      const scale = Math.min(0.5, 960 / Math.max(1, el.clientWidth));
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
      const v = view.current;
      if (v.rise < 0.002 || document.hidden) {
        // Cleared once, then nothing: an untouched canvas costs nothing.
        if (drawn) gl.clear(gl.COLOR_BUFFER_BIT);
        drawn = false;
        return;
      }
      drawn = true;
      gl.uniform1f(uTime, ((now - start) / 1000) % 1000);
      gl.uniform1f(uRise, v.rise);
      gl.uniform1f(uClear, v.clear);
      gl.uniform2f(uSun, v.sun[0], v.sun[1]);
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
  }, [view]);

  return <canvas ref={canvas} className={className} aria-hidden="true" />;
}
