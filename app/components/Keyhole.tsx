"use client";

import { useEffect, useRef, type ReactNode } from "react";
import About from "./About";
import "./Keyhole.css";

const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

/*
 * The portal, all of it in one pass, in CSS pixels:
 *  - the desert as it is at dusk (portal-desert.webp), laid exactly where the
 *    page lays it (Tenax.css), so taking over from it shows no seam; then
 *    gone dark, and bent round the black hole as light is round a mass;
 *  - the five orbs, in their own colours, with trails along their orbit;
 *  - the black hole they become: its shadow, a thin photon ring, and an
 *    accretion disk tilted toward you, its far side lensed up over the top;
 *  - the keyhole it opens into, the ocean (ocean-frame) blazing beyond it,
 *    light breaking out round it in rays.
 */
const FRAG = `
precision highp float;
uniform vec2 u_res;      // css px
uniform float u_dpr;
uniform float u_time;
uniform sampler2D u_desert;
uniform sampler2D u_ocean;
uniform vec4 u_rect;     // the desert's photograph on screen: x, y, w, h
uniform float u_zoom;    // pushing in toward it
uniform float u_dim;     // the desert gone dark
uniform vec4 u_orbs[5];  // each orb: x, y, radius, brightness
uniform vec4 u_ring;     // their orbit: radius, tilt, phase, trail length (radians)
uniform float u_trail;   // how bright the trails are
uniform vec4 u_hole;     // shadow radius (px), bending (0-1), the flash it forms in, its shockwave (0-1)
uniform vec2 u_disk;     // accretion disk: brightness, scale
uniform vec4 u_key;      // keyhole: how far its stem has grown, the light in it, box size, open
uniform vec3 u_cam;      // the camera: distance (in Schwarzschild radii), elevation above the disk, roll

const float TAU = 6.2831853;
// The shadow's edge: rays passing closer than this fall in.
const float CRIT = 2.598;

vec3 tone(float i) {
  // Pentara's five, lifted to glow: NEXIO, ORIGO, SILVA, CULTURA, TENAX.
  if (i < 0.5) return vec3(0.36, 0.78, 0.98);
  if (i < 1.5) return vec3(0.98, 0.82, 0.7);
  if (i < 2.5) return vec3(0.56, 0.95, 0.52);
  if (i < 3.5) return vec3(1.0, 0.8, 0.38);
  return vec3(1.0, 0.48, 0.3);
}

vec3 palette(float a) {
  float f = fract(a / TAU) * 5.0;
  float i = floor(f);
  return mix(tone(i), tone(mod(i + 1.0, 5.0)), smoothstep(0.0, 1.0, f - i));
}

// The keyhole, round its head's centre, in px: the head is the hole's shadow
// (radius 15 of its 100-unit box); the stem grows down out of it.
float keyhole(vec2 d, float box, float grow) {
  vec2 q = d / box * 100.0 + vec2(50.0, 36.0);
  float head = length(q - vec2(50.0, 36.0)) - 15.0;
  float bottom = mix(44.0, 79.0, grow);
  float hw = (8.6 + (q.y - 48.3) / 30.7 * 3.4) * smoothstep(0.0, 0.25, grow);
  float stem = max(abs(q.x - 50.0) - hw, max(44.0 - q.y, q.y - bottom));
  return min(head, stem) * box / 100.0;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Value noise wrapping every per cells along x: seamless round the disk.
float pnoise(vec2 p, float per) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float x0 = mod(i.x, per);
  float x1 = mod(i.x + 1.0, per);
  return mix(mix(hash(vec2(x0, i.y)), hash(vec2(x1, i.y)), f.x),
             mix(hash(vec2(x0, i.y + 1.0)), hash(vec2(x1, i.y + 1.0)), f.x), f.y);
}

float fbm(vec2 p, float per) {
  float s = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    s += amp * pnoise(p, per);
    p *= 2.0;
    per *= 2.0;
    amp *= 0.5;
  }
  return s;
}

// The gas, turning: closer in, faster round. Two copies a half-cycle apart,
// each reset as the other is full, so it never winds itself into rings.
float gas(float r, float a) {
  float om = 2.2 * pow(3.0 / r, 1.5);
  float t1 = fract(u_time / 7.0);
  float t2 = fract(u_time / 7.0 + 0.5);
  float u1 = fract((a - om * t1 * 7.0) / TAU) * 44.0;
  float u2 = fract((a - om * t2 * 7.0) / TAU + 0.37) * 44.0;
  float v = r * 3.2;
  float n1 = fbm(vec2(u1, v), 44.0);
  float n2 = fbm(vec2(u2, v + 7.3), 44.0);
  float w = 1.0 - abs(2.0 * t1 - 1.0);
  return mix(n2, n1, w);
}

// The disk's light where a ray crosses it, and how much it hides behind.
vec4 diskAt(vec3 hit, vec3 dir, float rin, float rout) {
  float r = length(hit.xz);
  float x = (r - rin) / (rout - rin);
  if (x < 0.0 || x > 1.0) return vec4(0.0);
  float a = atan(hit.z, hit.x);
  float n = gas(r / u_disk.y, a);
  float dens = smoothstep(0.0, 0.05, x) * (1.0 - smoothstep(0.35, 1.0, x)) * (0.15 + 2.0 * n * n * n);
  float heat = pow(rin / r, 2.2);
  // Beamed: gas coming toward you brighter and bluer, going away dimmer
  // and redder; all of it reddened climbing out of the well.
  float v = sqrt(0.5 / r);
  vec3 vel = normalize(vec3(-hit.z, 0.0, hit.x)) * v;
  float g = sqrt(1.0 - v * v) / (1.0 - dot(vel, -normalize(dir)));
  g *= sqrt(max(0.0, 1.0 - 1.0 / r));
  vec3 warm = mix(vec3(1.0, 0.42, 0.14), vec3(1.0, 0.86, 0.62), heat);
  vec3 col = mix(warm, mix(warm, palette(a), 0.35), smoothstep(0.2, 0.8, x));
  col = mix(col, vec3(0.82, 0.9, 1.0), clamp((g - 1.0) * 1.4, 0.0, 0.7));
  col = mix(col, vec3(0.8, 0.25, 0.08), clamp((0.85 - g) * 1.5, 0.0, 0.6));
  vec3 light = col * heat * dens * pow(g, 3.5) * 4.0;
  return vec4(light, clamp(dens * 0.9, 0.0, 0.92));
}

// Stars, in the photograph's sky: so they are bent as it is.
float starLayer(vec2 s, float cell, float dens) {
  vec2 g = s / cell;
  vec2 id = floor(g);
  float h = hash(id);
  if (h > dens) return 0.0;
  vec2 o = vec2(hash(id + 1.7), hash(id + 9.2)) * 0.8 + 0.1;
  vec2 dd = (fract(g) - o) * cell;
  float b = pow(hash(id + 4.1), 4.0);
  float tw = 0.75 + 0.25 * sin(u_time * (1.5 + 3.0 * h) + h * 60.0);
  return (0.2 + 2.4 * b) * tw * exp(-dot(dd, dd) / 0.8);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, u_res.y * u_dpr - gl_FragCoord.y) / u_dpr;
  vec2 c = u_res * 0.5;
  vec2 d = p - c;
  float rho = max(length(d), 0.001);
  float m = min(u_res.x, u_res.y);
  float rs = u_hole.x;
  float bend = u_hole.y;
  float grow = u_key.x;
  float light = u_key.y;
  float box = u_key.z;
  float open = u_key.w;

  // ---- Light round the black hole, traced ----
  // Units of the Schwarzschild radius; the disk lies in y = 0. A ray from
  // the camera through this pixel, bent at each step as light is by a mass.
  // Far out the bending is slight: worked out there, not traced.
  vec2 src = p;
  vec3 disk = vec3(0.0);
  float hidden = 0.0;
  bool fell = false;
  float minr = 1e3; // how close the ray came
  if (rs > 0.5) {
    float D = u_cam.x;
    // Focal length, px, so the shadow is exactly rs in radius, as the
    // keyhole's head is. Seen from 26 radii out, not infinitely far, it is
    // 1.62% smaller than CRIT alone gives (measured by tracing).
    float F = rs * D / (CRIT * 0.9838);
    float far = rs * 6.0;
    float fade = smoothstep(far * 0.8, far, rho);
    // Weakly bent: by 2/b over the stretch of path the tracing covers.
    float b = rho * D / F;
    float span = 0.5 * (D / sqrt(D * D + b * b) + 1.3 * D / sqrt(1.69 * D * D + b * b));
    vec2 weak = d * (1.0 - 2.0 * span * F * F / (D * rho * rho));
    vec2 traced = weak;
    if (rho < far) {
      float e = u_cam.y;
      // The camera rolled a little, as a hand would hold it.
      float cr = cos(u_cam.z);
      float sr0 = sin(u_cam.z);
      vec2 dl = vec2(cr * d.x - sr0 * d.y, sr0 * d.x + cr * d.y);
      vec3 pos = vec3(0.0, D * sin(e), -D * cos(e));
      vec3 fwd = normalize(-pos);
      vec3 right = vec3(1.0, 0.0, 0.0);
      vec3 up = cross(fwd, right);
      vec3 dir = normalize(fwd * F + right * dl.x - up * dl.y);
      vec3 h = cross(pos, dir);
      float h2 = dot(h, h);
      float rin = 3.0 * u_disk.y;
      float rout = 11.0 * u_disk.y;
      for (int i = 0; i < 110; i++) {
        float r2 = dot(pos, pos);
        float r = sqrt(r2);
        minr = min(minr, r);
        if (r < 1.0) { fell = true; break; }
        if (r > D * 1.3 && dot(pos, dir) > 0.0) break;
        if (hidden > 0.97) break;
        float dt = clamp(0.09 * r, 0.03, 3.0);
        vec3 prev = pos;
        dir += -1.5 * h2 * pos / (r2 * r2 * r) * dt;
        pos += dir * dt;
        if (u_disk.x > 0.001 && prev.y * pos.y < 0.0) {
          vec3 hit = mix(prev, pos, prev.y / (prev.y - pos.y));
          vec4 e4 = diskAt(hit, dir, rin, rout);
          disk += e4.rgb * (1.0 - hidden);
          hidden += e4.a * (1.0 - hidden);
        }
      }
      // Where the ray ends up looking, as a point on the screen.
      vec3 nd = normalize(dir);
      float z = max(dot(nd, fwd), 0.05);
      vec2 tl = F * vec2(dot(nd, right), -dot(nd, up)) / z;
      traced = vec2(cr * tl.x + sr0 * tl.y, -sr0 * tl.x + cr * tl.y);
    }
    src = c + mix(d, mix(traced, weak, fade), bend);
    disk *= u_disk.x;
    hidden *= u_disk.x;
  }

  // The shockwave it forms with, running out across the sand.
  float shock = u_hole.w;
  float sr = shock * length(u_res) * 0.75;
  float wave = step(0.001, shock) * (1.0 - shock) * exp(-pow((rho - sr) / (40.0 + 60.0 * shock), 2.0));
  src += d / rho * 34.0 * wave;

  // ---- The desert, gone dark ----
  vec2 s = c + (src - c) / u_zoom;
  vec2 uv = (s - u_rect.xy) / u_rect.zw;
  vec3 base = texture2D(u_desert, clamp(uv, 0.001, 0.999)).rgb;
  // Which is sky: bluer than the sand, and above the dunes.
  float sky = smoothstep(0.56, 0.66, base.g / max(base.r, 0.01)) * smoothstep(0.74, 0.62, uv.y);
  // Night: moonlit blue, the sky deepening upward into space.
  float lum = dot(base, vec3(0.3, 0.59, 0.11));
  vec3 night = pow(lum, 1.5) * vec3(0.38, 0.5, 1.0) * 0.3;
  night *= mix(1.0, 0.35, sky * smoothstep(0.6, 0.05, uv.y));
  vec3 col = mix(base, night, u_dim);
  float vig = 1.0 - smoothstep(0.25, 0.95, length(d / u_res) * 1.3);
  col *= mix(1.0, 0.3 + 0.7 * vig, u_dim);
  // The stars come out.
  float st = 0.8 * starLayer(s, 8.0, 0.1) + 1.3 * starLayer(s + 31.0, 21.0, 0.3);
  col += mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.9, 0.78), hash(floor(s / 7.0) + 3.3)) * st * sky * u_dim;
  // The disk's light, warm on the dunes below it.
  col += base * vec3(1.0, 0.62, 0.32) * (1.0 - sky) * u_disk.x * 0.5 * exp(-length(d - vec2(0.0, rs * 0.6)) / (m * 0.22));
  // Near it, the dark it draws in.
  if (rs > 0.5) col *= 0.5 + 0.5 * smoothstep(rs * 1.2, rs * 5.0, rho);
  if (fell) col = vec3(0.0);

  // ---- The orbs' trails, round their orbit ----
  if (u_trail > 0.001) {
    float tilt = u_ring.y;
    vec2 q = vec2(d.x, d.y / tilt);
    float rq = max(length(q), 0.001);
    float aq = atan(q.y, q.x);
    float w = 1.6 + u_ring.x * 0.012;
    float band = exp(-pow((rq - u_ring.x) / w, 2.0)) + 0.35 * exp(-pow((rq - u_ring.x) / (w * 5.0), 2.0));
    for (int i = 0; i < 5; i++) {
      float ai = u_ring.z + float(i) * TAU / 5.0;
      float behind = mod(ai - aq, TAU);
      float t = pow(max(0.0, 1.0 - behind / u_ring.w), 1.8);
      col += tone(float(i)) * band * t * u_trail * (0.7 + 0.3 * q.y / rq);
    }
  }

  // The disk over what is behind it; filmic, so the hottest gas goes white
  // rather than flat; and a soft bloom about it.
  vec3 hdr = disk;
  if (rs > 0.5) {
    float out1 = fell ? 0.0 : 1.0;
    // The photon ring: light that went once round it, gathered into a
    // thin bright line at the shadow's edge.
    hdr += vec3(1.0, 0.86, 0.66) * exp(-max(minr - 1.5, 0.0) * 9.0) * 1.1 * u_disk.x * out1;
    // Bloom about it.
    hdr += vec3(1.0, 0.68, 0.38) * (exp(-rho / (rs * 1.6)) * 0.3 + exp(-rho / (rs * 5.0)) * 0.08) * u_disk.x * out1;
  }
  col = col * (1.0 - hidden) + (vec3(1.0) - exp(-hdr * 1.8));

  // ---- The keyhole, and the ocean through it ----
  // The shadow becomes a keyhole: a key of pure darkness, back-lit, the
  // disk still turning round it. Flying in, it fills the screen; then, at
  // its far end, the ocean opens from the middle out.
  float sd = rs > 0.5 ? keyhole(d, box, grow) : 1e5;
  float inside = (1.0 - smoothstep(-1.0, 1.0, sd)) * smoothstep(0.0, 0.12, grow);
  float aspect = u_res.x / u_res.y;
  vec2 ouv = p / u_res;
  float imgAspect = 16.0 / 9.0;
  if (aspect > imgAspect) ouv.y = 0.5 + (ouv.y - 0.5) * imgAspect / aspect;
  else ouv.x = 0.5 + (ouv.x - 0.5) * aspect / imgAspect;
  // Coming toward you out of the dark: from far, then settling.
  float arrive = smoothstep(0.62, 1.0, open);
  ouv = 0.5 + (ouv - 0.5) / (1.6 - 0.6 * arrive);
  vec3 ocean = texture2D(u_ocean, ouv).rgb;
  float endR = arrive * length(u_res) * 0.62;
  float opening = 1.0 - smoothstep(endR * 0.82, endR + 1.0, rho);
  // Its leading edge white-hot, as light breaking in.
  float edge = exp(-pow((rho - endR * 0.97) / (m * 0.006 + endR * 0.03 + 1.0), 2.0)) * (1.0 - arrive) * step(0.001, arrive);
  vec3 beyond = ocean * opening + vec3(0.85, 0.96, 1.0) * edge * 0.9;
  col = mix(col, beyond, inside);

  // Back-lit: light from behind it spilling round its edge, a thin hot line
  // fading into a warm glow; strongest as it opens, gone once you are in.
  float lit = light * (1.0 - clamp((open - 0.3) * 2.6, 0.0, 1.0));
  float out0 = max(sd, 0.0);
  float rimW = 0.9 + box * 0.0025;
  float back = max(grow * (1.0 - clamp(open * 3.0, 0.0, 1.0)), 0.0) * step(0.001, grow);
  col += vec3(1.0, 0.93, 0.8) * exp(-out0 / rimW) * back * (1.0 - inside) * 1.1;
  col += vec3(1.0, 0.74, 0.45) * exp(-out0 / (box * 0.035 + 1.0)) * back * 0.45 * (1.0 - inside);
  col += vec3(0.95, 0.85, 0.75) * exp(-out0 / (rs * 1.2 + 1.0)) * lit * 0.22 * (1.0 - inside);
  // Shafts of light through the dark: many, fine and uneven, each its own
  // length, drifting; dust caught in them.
  float ang = atan(d.y, d.x) / TAU + 0.5;
  float sh = fbm(vec2(ang * 90.0, u_time * 0.12), 90.0);
  float len = m * (0.12 + 0.55 * pnoise(vec2(ang * 36.0, 4.0), 36.0));
  float rays = pow(sh, 3.2) * 3.0 * exp(-out0 / len) * smoothstep(0.0, rs * 0.25, out0) / (1.0 + out0 / (rs * 3.0));
  vec3 rayCol = mix(vec3(0.75, 0.86, 1.0), vec3(1.0, 0.86, 0.66), pnoise(vec2(ang * 12.0, 1.0), 12.0));
  float mote = starLayer(p + vec2(0.0, -u_time * 9.0), 11.0, 0.12);
  col += rayCol * (rays * (1.0 + mote * 2.0)) * lit * 0.55;
  // Flying in: the stars stream past.
  float lane = ang * 720.0;
  float hl = hash(vec2(floor(lane), 2.0));
  float pos = fract(hl * 13.7 + open * 2.2);
  float streak = step(0.93, hl) * exp(-pow((rho / (m * 0.9) - pos) / (0.03 + 0.12 * open), 2.0))
    * (1.0 - smoothstep(0.0, 0.5, abs(fract(lane) - 0.5) * 2.0)) * step(0.0, sd);
  col += vec3(0.8, 0.9, 1.0) * streak * smoothstep(0.0, 0.15, open) * (1.0 - smoothstep(0.75, 1.0, open)) * 0.8;

  // ---- The orbs ----
  for (int i = 0; i < 5; i++) {
    vec4 o = u_orbs[i];
    if (o.w < 0.001) continue;
    vec2 od = p - o.xy;
    float dd = dot(od, od);
    float s2 = o.z * o.z;
    float core = exp(-dd / s2);
    float halo = 1.0 / (1.0 + dd / (s2 * 6.0));
    col += (tone(float(i)) * (halo * 0.45 + core * 0.7) + vec3(1.0) * core * 0.6) * o.w;
  }

  // The flash it forms in.
  float burst = u_hole.z;
  col += vec3(1.0, 0.96, 0.88) * (exp(-rho / (m * 0.06)) * 2.0 + exp(-rho / (m * 0.35)) * 0.5) * burst;

  // A soft shoulder, so bright light rolls off instead of clipping flat.
  vec3 over = max(col - 0.82, 0.0);
  col = min(col, 0.82) + 0.18 * (1.0 - exp(-over * 4.0));
  // A little grain, so the dark has no bands.
  col += (hash(p + fract(u_time)) - 0.5) / 128.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

/** Where the page lays the desert's photograph (Tenax.css), in css px. */
function desertRect(w: number, h: number) {
  const portrait = w / h <= 3 / 4;
  const width = portrait ? 1.125 * h : Math.max(w, 0.75 * h);
  const height = (width * 4) / 3;
  const left = (portrait ? 0.26 * w : 0.5 * w) - width / 2;
  // Tilted all the way down to the sand.
  const top = h - height;
  // Pushed in toward the big dune (--sand, all the way): 1.05 about 62% 85%.
  const ox = left + width * 0.62;
  const oy = top + height * 0.85;
  return [ox + (left - ox) * 1.05, oy + (top - oy) * 1.05, width * 1.05, height * 1.05] as const;
}

const TAU = Math.PI * 2;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
// Past its mark and back: a thing snapping into being.
const backOut = (x: number) => (x <= 0 ? 0 : 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2);

/**
 * The portal (FRAG), drawn from the moment the desert begins to go dark; it
 * takes over from the page's desert (which then stops drawing) once it has
 * faded in over it. It moves on its own (the orbs orbit, the disk turns), so
 * it draws every frame while it is up, and not at all otherwise.
 */
function Portal() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const stage = el.closest<HTMLElement>(".dive-stage");
    const gl = el.getContext("webgl", { alpha: false, antialias: false });
    if (!gl || !stage) return;

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
    const u = (name: string) => gl.getUniformLocation(program, name);
    const uRes = u("u_res");
    const uDpr = u("u_dpr");
    const uTime = u("u_time");
    const uRect = u("u_rect");
    const uZoom = u("u_zoom");
    const uDim = u("u_dim");
    const uOrbs = u("u_orbs");
    const uRing = u("u_ring");
    const uTrail = u("u_trail");
    const uHole = u("u_hole");
    const uDisk = u("u_disk");
    const uKey = u("u_key");
    const uCam = u("u_cam");

    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    // The two photographs, decoded off the main thread.
    let loaded = 0;
    const textures = ["/tenax/portal-desert.webp", "/hero/ocean-frame-1920.webp"].map((src, i) => {
      const tex = gl.createTexture();
      fetch(src)
        .then((r) => r.blob())
        .then((b) => createImageBitmap(b))
        .then((bitmap) => {
          gl.activeTexture(gl.TEXTURE0 + i);
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, bitmap);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          bitmap.close();
          loaded++;
          // Both in: draw once now, unseen, so the shader is compiled and the
          // textures are on the GPU before it is first needed.
          if (loaded === 2) {
            gl.uniform2f(uRes, el.clientWidth || 1, el.clientHeight || 1);
            gl.uniform1f(uDpr, dpr);
            gl.uniform1f(uZoom, 1);
            gl.uniform4f(uRing, 0, 1, 0, 0);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
          }
        })
        .catch(() => {});
      return tex;
    });
    gl.uniform1i(u("u_desert"), 0);
    gl.uniform1i(u("u_ocean"), 1);

    // Where the orbs sit on their bar, measured as they leave it.
    const bar: [number, number][] = [];
    const measure = () => {
      bar.length = 0;
      const box = el.getBoundingClientRect();
      stage.querySelectorAll(".collect-slot").forEach((slot) => {
        const b = slot.getBoundingClientRect();
        bar.push([b.left + b.width / 2 - box.left, b.top + b.height / 2 - box.top]);
      });
    };

    const resize = () => {
      // Sharp enough on a fine screen, without the cost of every pixel.
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      el.width = Math.round(el.clientWidth * dpr);
      el.height = Math.round(el.clientHeight * dpr);
      gl.viewport(0, 0, el.width, el.height);
      bar.length = 0;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const born = performance.now();
    const orbs = new Float32Array(20);
    let phase = 0;
    let lastOrbit = 0;
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const on = stage.classList.contains("is-void") && !stage.classList.contains("is-about");
      if (!on || loaded < 2 || document.hidden) {
        if (!on) {
          stage.classList.remove("is-portal");
          bar.length = 0;
        }
        return;
      }
      // Set inline on the stage by Dive.tsx: read there, not computed.
      const inline = stage.style;
      const v = (name: string) => parseFloat(inline.getPropertyValue(name)) || 0;
      const dim = v("--kh-dim");
      const rise = v("--kh-rise");
      const orbit = v("--kh-orbit");
      const collapse = v("--kh-collapse");
      const distort = v("--kh-distort");
      const reveal = v("--kh-reveal");
      const openRaw = v("--kh-open");
      const open = v("--keyhole");
      // Once it has faded in over the page's desert, that can stop drawing.
      stage.classList.toggle("is-portal", dim > 0.13);
      if (!bar.length) measure();

      const w = el.clientWidth;
      const h = el.clientHeight;
      const m = Math.min(w, h);
      const cx = w / 2;
      const cy = h / 2;

      // The orbit: wide and nearly face on, closing in and tilting away as
      // they speed up, then falling in.
      const R0 = m * 0.3;
      const holeR = m * 0.1;
      const fall = smooth(0, 0.5, collapse);
      const ringR = (R0 + (holeR * 2.6 - R0) * ease(orbit)) * (1 - 0.85 * fall);
      const omega = Math.min(9, 0.8 * (R0 / Math.max(ringR, 1)) ** 1.5);
      phase += dt * omega + Math.max(0, orbit - lastOrbit) * 8;
      lastOrbit = orbit;
      const tilt = 0.85 - 0.66 * smooth(0, 0.8, orbit);
      const trailLen = 0.25 + (TAU / 5 - 0.25) * smooth(0.15, 0.9, orbit) + (TAU - TAU / 5) * fall;
      const trail = smooth(0.3, 1, rise) * (1 - smooth(0.5, 0.9, collapse)) * 0.9;
      const risen = ease(rise);
      const gone = 1 - smooth(0.4, 0.6, collapse);
      for (let i = 0; i < 5; i++) {
        const a = phase + (i * TAU) / 5;
        const [bx, by] = bar[i] ?? [cx, h - 40];
        const rx = cx + Math.cos(a) * ringR;
        const ry = cy + Math.sin(a) * ringR * tilt;
        const depth = Math.sin(a) * (1 - tilt);
        orbs[i * 4] = bx + (rx - bx) * risen;
        orbs[i * 4 + 1] = by + (ry - by) * risen;
        orbs[i * 4 + 2] = (5 + 7 * risen) * (1 + 0.35 * depth);
        orbs[i * 4 + 3] = (0.6 + 0.4 * risen) * (0.75 + 0.25 * depth) * (1 + 1.5 * fall) * gone * smooth(0, 0.05, rise);
      }

      // The black hole: snapping into being in a flash, a shockwave running
      // out from it; bending the desert round it; opening as a keyhole.
      const formed = smooth(0.42, 1, collapse);
      const rs = holeR * backOut(formed) * (1 + 0.12 * ease(distort) + 0.15 * smooth(0, 1, reveal));
      const lens = 1 - Math.max(0, (open - 0.82) / 0.18);
      const burst = Math.exp(-(((collapse - 0.47) / 0.07) ** 2)) + 0.35 * Math.exp(-(((reveal - 0.38) / 0.1) ** 2));
      const shock = collapse > 0.47 ? (collapse - 0.47) / 0.53 : 0;
      const diskOn = smooth(0.35, 0.85, collapse) * (1 - smooth(0, 0.45, open));
      const diskScale = 1 + 0.25 * ease(reveal);
      const grow = ease(smooth(0, 0.6, reveal));
      const light = smooth(0.35, 0.9, reveal);
      // From the size of the hole, growing steadily, to far past the screen.
      const box0 = Math.max(rs, 0.001) / 0.15;
      const box = box0 * ((6 * Math.max(w, h)) / box0) ** openRaw;

      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uDpr, dpr);
      gl.uniform1f(uTime, ((now - born) / 1000) % 1000);
      gl.uniform4f(uRect, ...desertRect(w, h));
      gl.uniform1f(uZoom, 1 + 0.08 * ease(distort) + 0.85 * open);
      gl.uniform1f(uDim, smooth(0, 1, dim));
      gl.uniform4fv(uOrbs, orbs);
      gl.uniform4f(uRing, ringR, tilt, phase, trailLen);
      gl.uniform1f(uTrail, trail);
      gl.uniform4f(uHole, rs, lens, burst, shock);
      gl.uniform2f(uDisk, diskOn, diskScale);
      gl.uniform4f(uKey, grow, light, box, open);
      // Just above the disk's plane, as it is seen at its most striking.
      // Looking down on the disk as it forms, sinking toward its plane, and
      // levelling, as the camera drifts in.
      gl.uniform3f(uCam, 26, 0.26 - 0.14 * ease(distort), -0.2 + 0.12 * ease(distort));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      stage.classList.remove("is-portal");
      textures.forEach((t) => gl.deleteTexture(t));
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      shaders.forEach((sh) => gl.deleteShader(sh));
    };
  }, []);

  return <canvas ref={canvas} className="keyhole-portal" aria-hidden="true" />;
}

/**
 * Out of Pentara, through a keyhole. The desert goes dark; the five orbs
 * rise off their bar and orbit, closing in, until they fall into one another
 * and a black hole forms, bending the desert round it. It opens as a keyhole,
 * the ocean's light breaking through; you fly at it, pass through in a flash,
 * and the camera pulls back: the ocean you came through to is a photograph
 * on the page about The South Project (About.tsx). The portal draws all of
 * it; Dive.tsx drives it (--kh-*, --keyhole, --flash, --pullback).
 */
export default function Keyhole({ children }: { children?: ReactNode }) {
  return (
    <div className="keyhole">
      {/* The dark desert, the orbs, the black hole, the keyhole, the ocean beyond. */}
      <Portal />
      <div className="keyhole-view">
        <About>
          {/* The other side: the ocean, which becomes the page's first photograph. */}
          <div className="keyhole-world">
            {/* Plain img: a pre-optimised WebP placed by CSS. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero/ocean-frame-1920.webp" alt="" decoding="async" />
          </div>
        </About>
      </div>
      <div className="keyhole-flash" />
      {children}
    </div>
  );
}
