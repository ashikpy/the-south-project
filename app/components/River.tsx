"use client";

import { useEffect, useRef, type RefObject } from "react";

/** The weather on the water, read each frame (each 0–1). */
export interface RiverView {
  /** how far the river has run down the valley */
  flow: number;
  /** sunrise: the glints turn gold */
  dawn: number;
  /** storm: duller, rougher water */
  rain: number;
}

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

/** Where the water lies in its scene's image, in that image's pixels. */
export interface RiverPlace {
  /** the stream's box: x, y, width, height */
  crop: readonly [number, number, number, number];
  /** height of the horizon the ground plane runs to */
  horizon: number;
  /** across: where the water comes from, far off */
  centre: number;
  /** heights between which it is seen edge-on, far to near (sunrise sheen) */
  far: readonly [number, number];
}

/*
 * ORIGO's, in the back layer's 3840x2162 canvas: the braided river on the
 * valley floor, x 451-2365, y 1119-1594. Ripples lie on a ground plane with
 * its horizon at y 1080, so they are tiny far off, up the valley, long and
 * low nearer, and come toward you.
 */
const ORIGO: RiverPlace = {
  crop: [451, 1119, 1914, 475],
  horizon: 1080,
  centre: 2200,
  far: [1120, 1480],
};

const FRAG = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_mask;
uniform float u_time;
uniform float u_dawn;
uniform float u_rain;
uniform vec4 u_crop;
uniform float u_horizon;
uniform float u_centre;
uniform vec2 u_far;

float hash(vec2 p) {
  p = fract(p * vec2(0.1031, 0.1030));
  p += dot(p, p.yx + 33.33);
  return fract((p.x + p.y) * p.x);
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

void main() {
  float water = texture2D(u_mask, v_uv).r;
  if (water < 0.01) discard;

  vec2 p = u_crop.xy + v_uv * u_crop.zw;
  float depth = max(p.y - u_horizon, 12.0);
  vec2 ground = vec2((p.x - u_centre) / depth * 7.0, 15000.0 / depth);
  float t = u_time * (1.0 + u_rain * 0.6);

  // Broad swells, and fine ripples running a little faster over them.
  float swell = noise(ground * vec2(0.9, 0.8) + vec2(0.0, t * 1.5));
  float ripple = noise(ground * vec2(2.6, 1.9) + vec2(sin(t * 0.7) * 0.4, t * 4.2));
  float n = swell * 0.55 + ripple * 0.45;

  float glint = smoothstep(0.72, 0.84, n) * (1.0 - u_rain * 0.6);
  float trough = (1.0 - smoothstep(0.22, 0.4, n)) * 0.3;
  // At sunrise the water mirrors the bright sky: strongest far off, where
  // you see it edge-on, broken by the swell nearer you.
  float far = 1.0 - smoothstep(u_far.x, u_far.y, p.y);
  float path = smoothstep(0.56, 0.68, n) * (0.55 + far * 0.3);
  float sheen = u_dawn * max(far * far * 0.85, path);

  vec3 light = mix(vec3(0.93, 0.98, 1.0), vec3(1.0, 0.93, 0.62), u_dawn);
  vec3 colour = light * glint * 0.85;
  float alpha = glint * 0.85;
  colour += vec3(0.02, 0.17, 0.21) * trough * (1.0 - alpha);
  alpha += trough * (1.0 - alpha);
  colour += vec3(1.0, 0.8, 0.36) * sheen * (1.0 - alpha);
  alpha += sheen * (1.0 - alpha);

  gl_FragColor = vec4(colour, alpha) * water;
}
`;

const FRAME = 1000 / 30; // water needs no more

/**
 * The river's moving light, over the water in its scene's image and only
 * where the mask says there is open water. It draws only while the river
 * shows, at 30fps; under reduced motion the image is all there is.
 * ORIGO's is the default; SILVA's forest stream passes its own.
 */
export default function River({
  view,
  className,
  mask: maskSrc = "/mountain/stream-mask.webp",
  place = ORIGO,
  size = [957, 237],
}: {
  view: RefObject<RiverView>;
  className?: string;
  mask?: string;
  place?: RiverPlace;
  /** drawing size, in pixels */
  size?: readonly [number, number];
}) {
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
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
      }
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

    const texture = gl.createTexture();
    const mask = new Image();
    let ready = false;
    mask.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mask);
      ready = true;
    };
    mask.src = maskSrc;

    const uTime = gl.getUniformLocation(program, "u_time");
    const uDawn = gl.getUniformLocation(program, "u_dawn");
    const uRain = gl.getUniformLocation(program, "u_rain");
    gl.uniform4f(gl.getUniformLocation(program, "u_crop"), ...place.crop);
    gl.uniform1f(gl.getUniformLocation(program, "u_horizon"), place.horizon);
    gl.uniform1f(gl.getUniformLocation(program, "u_centre"), place.centre);
    gl.uniform2f(gl.getUniformLocation(program, "u_far"), ...place.far);
    gl.viewport(0, 0, el.width, el.height);

    const start = performance.now();
    let last = 0;
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const { flow, dawn, rain } = view.current;
      if (!ready || flow <= 0 || now - last < FRAME - 2) return;
      last = now;
      gl.uniform1f(uTime, ((now - start) / 1000) % 600);
      gl.uniform1f(uDawn, dawn);
      gl.uniform1f(uRain, rain);
      gl.clear(gl.COLOR_BUFFER_BIT); // discarded pixels stay clear
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      mask.onload = null;
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      shaders.forEach((shader) => gl.deleteShader(shader));
    };
  }, [view, maskSrc, place]);

  return <canvas ref={canvas} className={className} width={size[0]} height={size[1]} aria-hidden="true" />;
}
