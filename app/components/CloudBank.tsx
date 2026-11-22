"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * A heavy cloud bank you fly into. Layers of thick cloud come at the camera
 * as `progress` (read each frame, 0–1) rises: far layers fade in small and
 * soft, grow as they near and fade before they would pop past you. Density
 * builds until the frame is a soft white-out (the curtain before the next
 * scene). Tops are sunlit and warm, undersides cool grey. Clouds drift
 * slowly even when the page is still.
 *
 * One fragment shader on WebGL1, rendered at a reduced scale (it is soft).
 */

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
varying vec2 v_uv;
uniform vec2 u_res;
uniform float u_time;
uniform float u_p;

const int LAYERS = 7;
const mat2 R = mat2(0.8, 0.6, -0.6, 0.8);

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
// Billowy noise: soft rounded heaps, like cumulus.
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * noise(p);
    p = R * p * 2.02 + 7.3;
    a *= 0.5;
  }
  return s;
}

void main() {
  float aspect = u_res.x / u_res.y;
  vec2 uv = (v_uv - 0.5) * vec2(aspect, 1.0);
  float p = clamp(u_p, 0.0, 1.0);
  float t = u_time;

  vec3 col = vec3(0.0);
  float acc = 0.0;

  // Front to back: nearest layer first.
  for (int i = 0; i < LAYERS; i++) {
    float fi = float(i);
    // Depth 1 = far, 0 = at the camera; layers flow toward you with scroll.
    float z = 1.0 - fract(fi / float(LAYERS) + p * 2.2 + t * 0.004);
    float w = smoothstep(1.0, 0.72, z) * smoothstep(0.02, 0.16, z);
    if (w <= 0.0) continue;

    float scale = 1.0 / (z * 1.6 + 0.12);
    vec2 q = uv * scale + vec2(fi * 3.7, fi * 1.9) + vec2(t * 0.015, 0.0);
    float n = fbm(q * 1.3);
    // More of each layer is cloud as you go deeper into the bank.
    float thresh = mix(0.68, 0.34, smoothstep(0.0, 0.85, p));
    float d = smoothstep(thresh, thresh + 0.22, n);
    float a = d * w * mix(0.55, 0.95, p);

    // Sunlit heaps, cool shade beneath; nearer layers a touch brighter.
    float top = smoothstep(0.35, 0.85, fbm(q * 1.3 + vec2(0.0, 0.18)) - n + 0.6);
    vec3 shade = mix(vec3(0.70, 0.76, 0.84), vec3(1.0, 0.985, 0.96), top);
    shade = mix(shade, vec3(0.93, 0.95, 0.97), 1.0 - z);

    col += (1.0 - acc) * a * shade;
    acc += (1.0 - acc) * a;
    if (acc > 0.995) break;
  }

  // Deep inside: everything goes to soft white, with faint structure left.
  float fog = smoothstep(0.55, 1.0, p);
  float veil = 0.94 + 0.05 * fbm(uv * 2.0 + t * 0.02);
  vec3 white = vec3(veil, veil + 0.005, veil + 0.012);
  col = mix(col, white * max(acc, fog), fog);
  acc = max(acc, fog);

  gl_FragColor = vec4(col, acc);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

export default function CloudBank({
  progress,
  className,
  quality = 0.45,
}: {
  progress: RefObject<number>;
  className?: string;
  /** Render scale of the screen's pixels (capped at 2x). */
  quality?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const gl = el?.getContext("webgl", { alpha: true, premultipliedAlpha: true });
    if (!el || !gl) return;

    const vert = compile(gl, gl.VERTEX_SHADER, VERT);
    const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    if (!vert || !frag || !program) return;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
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
    const uP = gl.getUniformLocation(program, "u_p");

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2) * quality;
      const w = Math.max(1, Math.round(el.clientWidth * ratio));
      const h = Math.max(1, Math.round(el.clientHeight * ratio));
      if (el.width !== w || el.height !== h) {
        el.width = w;
        el.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const p = progress.current ?? 0;
      // Nothing to draw before the bank: skip the shader entirely.
      if (p <= 0) {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return;
      }
      gl.uniform1f(uTime, reduced ? 0 : (now - start) / 1000);
      gl.uniform1f(uP, p);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
    };
  }, [progress, quality]);

  return <canvas ref={canvas} className={className} aria-hidden="true" />;
}
