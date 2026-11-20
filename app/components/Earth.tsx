"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";

/*
 * A realistic Earth in plain three.js (WebGL).
 *
 * Textures (public/earth/, from the three.js examples; NASA Blue Marble and
 * Black Marble imagery):
 *   earth_day_4096.jpg                    day colour
 *   earth_night_4096.jpg                  city lights
 *   earth_bump_roughness_clouds_4096.jpg  R bump · G roughness (oceans low) · B clouds
 *
 * Layers: the surface (day lit by the sun, city lights on the night side,
 * sun glint on the oceans), a cloud shell turning a little faster than the
 * ground and an atmosphere: blue on the day side, orange at the terminator,
 * as a rim over the surface and a halo past the limb.
 */

const TEX = "/earth/";
const TILT = THREE.MathUtils.degToRad(23.4);
/** Atmosphere halo radius (planet = 1), and where the planet's limb falls on it. */
const HALO = 1.07;
const LIMB = Math.sqrt(1 - 1 / (HALO * HALO)).toFixed(4);
/** Camera distance: the globe fills about 70% of the box's height. */
const DIST = 5.8;

const ATMO_DAY = "vec3(0.30, 0.70, 1.00)";
const ATMO_TWILIGHT = "vec3(0.74, 0.29, 0.04)";

/*
 * Detail levels, streamed in as you descend, like a map loading sharper
 * tiles as you zoom. Because the flight always ends on southern India, the
 * tiles along its path are cut ahead of time (NASA Blue Marble, shaded relief
 * + bathymetry, via GIBS) and served from public/earth/. Each level is a
 * lon/lat box (west, south, east, north), loads once the zoom reaches
 * \`loadAt\` and fades in over the global map when it arrives.
 */
const LEVELS = [
  // Africa to Asia, ~3 km per pixel: the whole hemisphere on the way in.
  { file: "detail_1_afro_asia.jpg", box: [0, -40, 110, 45], px: 4096, loadAt: 0 },
  // Arabia to the Bay of Bengal, ~1 km per pixel.
  { file: "detail_2_region.jpg", box: [55, -5, 100, 35], px: 4096, loadAt: 0.2 },
  // Southern India, ~500 m per pixel: the source's full detail.
  { file: "detail_3_south.jpg", box: [70, 4, 86, 20], px: 3584, loadAt: 0.45 },
] as const;

/*
 * Each level's colour is matched to the global map's over ~1.4 degrees, so
 * no level shows an edge: that is mip 4 of the global map (0.088 deg/px) and
 * the mip of each level at its own resolution.
 */
const BROAD_DEG = 1.4;
const GLOBAL_LOD = Math.log2(BROAD_DEG / (360 / 4096));
const glslLevels = LEVELS.map((l, i) => {
  const lod = Math.log2(BROAD_DEG / ((l.box[2] - l.box[0]) / l.px));
  const box = `vec4(${l.box.map((n) => n.toFixed(1)).join(", ")})`;
  return `day = detail(day, broad, uLevel${i}, ${box}, ll, ${lod.toFixed(2)}, uLevelOn[${i}]);`;
}).join("\n    ");
const glslSamplers = LEVELS.map((_, i) => `uniform sampler2D uLevel${i};`).join("\n  ");

const vertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const surfaceFragment = /* glsl */ `
  uniform sampler2D uDay;
  uniform sampler2D uNight;
  uniform sampler2D uMaps;
  ${glslSamplers}
  uniform float uLevelOn[${LEVELS.length}];
  uniform vec3 uSun;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPos;

  // Shows a high-res patch covering a lon/lat box (degrees) over the global
  // map, its broad colour matched to the global map's: both are compared
  // blurred to the same ~1.4 degrees (\`lod\` = the patch's mip level for
  // that), so the patch has no visible edge. It also fades at its borders.
  vec3 detail(vec3 base, vec3 globalBroad, sampler2D tex, vec4 box, vec2 ll, float lod, float on) {
    if (on <= 0.0) return base;
    vec2 uv = (ll - box.xy) / (box.zw - box.xy);
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return base;
    vec2 edge = smoothstep(0.0, 0.08, uv) * smoothstep(1.0, 0.92, uv);
    vec3 matched = texture2D(tex, uv).rgb + globalBroad - textureLod(tex, uv, lod).rgb;
    return mix(base, max(matched, 0.0), edge.x * edge.y * on);
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(cameraPosition - vPos);
    float ndl = dot(n, uSun);
    float lit = smoothstep(-0.25, 0.5, ndl);

    vec3 day = texture2D(uDay, vUv).rgb;
    vec2 ll = vec2(vUv.x * 360.0 - 180.0, vUv.y * 180.0 - 90.0);
    // ~1.4 degrees is mip 4 of the global map (0.088 deg/px), mip 7 of the
    // region (0.011 deg/px) and mip 8.3 of the south (0.0045 deg/px).
    vec3 broad = textureLod(uDay, vUv, ${GLOBAL_LOD.toFixed(2)}).rgb;
    ${glslLevels}
    vec3 night = texture2D(uNight, vUv).rgb;
    vec3 maps = texture2D(uMaps, vUv).rgb;
    float roughness = maps.g;

    // Soft terminator, a little ambient so the night side is not pure black.
    vec3 col = day * (max(ndl, 0.0) * 1.15 + 0.012);

    // Sun glint on the water.
    vec3 h = normalize(uSun + v);
    float shininess = mix(90.0, 12.0, roughness);
    float spec = pow(max(dot(n, h), 0.0), shininess) * (1.0 - roughness) * max(ndl, 0.0);
    col += vec3(1.0, 0.9, 0.78) * spec * 0.22;

    // City lights where the sun has gone.
    col += night * vec3(1.0, 0.82, 0.55) * (1.0 - lit) * 1.6;

    // Atmosphere seen through, strongest at the rim.
    float fresnel = pow(1.0 - max(dot(n, v), 0.0), 2.4);
    vec3 atmo = mix(${ATMO_TWILIGHT}, ${ATMO_DAY}, smoothstep(-0.25, 0.75, ndl));
    col = mix(col, atmo, fresnel * smoothstep(-0.5, 1.0, ndl) * 0.85);

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const cloudFragment = /* glsl */ `
  uniform sampler2D uMaps;
  uniform vec3 uSun;
  uniform float uCloudFade;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPos;

  void main() {
    vec3 n = normalize(vNormal);
    float ndl = dot(n, uSun);
    float clouds = smoothstep(0.2, 1.0, texture2D(uMaps, vUv).b) * uCloudFade;
    float light = max(ndl, 0.0) * 1.1 + 0.01;
    // Warm edge on clouds at sunset.
    vec3 tint = mix(vec3(1.0, 0.6, 0.35), vec3(1.0), smoothstep(0.0, 0.35, ndl));
    gl_FragColor = vec4(tint * light, clouds * 0.92);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const haloFragment = /* glsl */ `
  #define LIMB ${LIMB}
  uniform vec3 uSun;
  varying vec3 vNormal;
  varying vec3 vPos;

  void main() {
    // Drawn on the back faces of a larger shell; past the limb, d runs from
    // 0 at the shell's edge to LIMB at the planet's edge: glow brightest at
    // the planet, fading out into space.
    vec3 n = normalize(vNormal);
    vec3 view = normalize(vPos - cameraPosition);
    float d = dot(view, n);
    float a = pow(clamp(d / LIMB, 0.0, 1.0), 2.6);
    float ndl = dot(n, uSun);
    vec3 atmo = mix(${ATMO_TWILIGHT}, ${ATMO_DAY}, smoothstep(-0.25, 0.75, ndl));
    float strength = smoothstep(-0.5, 1.0, ndl);
    gl_FragColor = vec4(atmo * a * strength, a * strength);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Southern India (Kerala and Tamil Nadu), where the zoom lands. */
const TARGET = { lat: 10.5, lon: 77.5 };
/** Height above the surface (planet radius = 1) at zoom 0 and zoom 1. */
const ALT_FAR = 12;
const ALT_NEAR = 0.16;
/** Final camera pitch from straight down (radians), and the zoom it starts at. */
const PITCH = 1.0;
const TILT_FROM = 0.6;

/** Scroll-driven view, written by the page and read here each frame. */
export interface EarthView {
  /** 0 = far out in space, 1 = just above southern India */
  zoom: number;
  /** false while hidden: skip drawing */
  on: boolean;
}

// Spin of the sphere that brings TARGET's longitude to face the camera
// (three.js SphereGeometry: u = 0 at longitude -180, running east).
const phi = THREE.MathUtils.degToRad(TARGET.lon + 180);


const FACE_Y = -Math.atan2(-Math.cos(phi), Math.sin(phi));
const FACE_X = THREE.MathUtils.degToRad(TARGET.lat);

export default function Earth({
  className,
  sun = [-1, 0.35, 0.75],
  speed = 1,
  view,
}: {
  className?: string;
  /**
   * When given, scroll drives the globe: it turns to southern India and the
   * camera descends to it as zoom goes 0 to 1. Otherwise it spins freely.
   */
  view?: RefObject<EarthView>;
  /** Direction the sunlight comes from (world space). */
  sun?: [number, number, number];
  /** Spin speed; 1 ≈ one turn every 3 minutes. */
  speed?: number;
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
    camera.position.set(0, 0, DIST);

    const loader = new THREE.TextureLoader();
    const anisotropy = renderer.capabilities.getMaxAnisotropy();
    const load = (name: string, srgb: boolean) => {
      const t = loader.load(TEX + name, () => renderer.render(scene, camera));
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = anisotropy;
      return t;
    };
    const day = load("earth_day_4096.jpg", true);
    const night = load("earth_night_4096.jpg", true);
    const maps = load("earth_bump_roughness_clouds_4096.jpg", false);

    // Detail levels: a 1px stand-in until each arrives, then a short fade.
    const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    blank.needsUpdate = true;
    const levelUniforms = LEVELS.map(() => ({ value: blank as THREE.Texture }));
    const uLevelOn = { value: LEVELS.map(() => 0) };
    const levelTex: THREE.Texture[] = [];
    const arrived: number[] = LEVELS.map(() => -1);
    const requested = LEVELS.map(() => false);
    const requestLevels = (zoom: number) => {
      LEVELS.forEach((l, i) => {
        if (requested[i] || zoom < l.loadAt) return;
        requested[i] = true;
        const t = loader.load(TEX + l.file, () => {
          levelUniforms[i].value = t;
          arrived[i] = performance.now();
          if (reduced) uLevelOn.value[i] = 1;
          renderer.render(scene, camera);
        });
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = anisotropy;
        levelTex.push(t);
      });
    };
    const uCloudFade = { value: 1 };

    const uSun = { value: new THREE.Vector3(...sun).normalize() };

    const globe = new THREE.Group();
    globe.rotation.z = TILT;
    scene.add(globe);

    const sphere = new THREE.SphereGeometry(1, 128, 128);

    const surface = new THREE.Mesh(
      sphere,
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: surfaceFragment,
        uniforms: {
          uDay: { value: day },
          uNight: { value: night },
          uMaps: { value: maps },
          ...Object.fromEntries(levelUniforms.map((u, i) => [`uLevel${i}`, u])),
          uLevelOn,
          uSun,
        },
      }),
    );
    globe.add(surface);

    const clouds = new THREE.Mesh(
      sphere,
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: cloudFragment,
        uniforms: { uMaps: { value: maps }, uSun, uCloudFade },
        transparent: true,
        depthWrite: false,
      }),
    );
    clouds.scale.setScalar(1.006);
    globe.add(clouds);

    const halo = new THREE.Mesh(
      sphere,
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: haloFragment,
        uniforms: { uSun },
        side: THREE.BackSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    halo.scale.setScalar(HALO);
    scene.add(halo);

    let fit = 1; // extra distance on portrait boxes so the globe fits
    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Keep the whole globe in frame on narrow boxes too.
      fit = w < h ? h / w : 1;
      camera.position.z = DIST * fit;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    // Only animate while on screen.
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);

    let raf = 0;
    let drift = 0;
    let last = performance.now();
    const spin = ((Math.PI * 2) / 180) * speed;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible) return;
      if (view) {
        const v = view.current;
        if (!v?.on) return;
        const z = Math.min(1, Math.max(0, v.zoom));
        drift += dt * 0.02 * (1 - z);
        // Turn into place while descending: Africa first, then across the
        // Arabian Sea until southern India comes round to meet you.
        surface.rotation.y = FACE_Y + (Math.pow(1 - z, 2.5) * 1.5 + drift) * (1 - z);
        clouds.rotation.y = surface.rotation.y + 0.03 + drift * 0.3;
        globe.rotation.x = FACE_X * Math.pow(z, 0.6);
        globe.rotation.z = TILT * (1 - Math.pow(z, 0.6));
        // Descend on a log scale: the speed feels even all the way down.
        const alt = Math.exp(
          Math.log(ALT_FAR) + (Math.log(ALT_NEAR) - Math.log(ALT_FAR)) * z,
        );
        const dist = alt * (fit + (1 - fit) * z);
        // Near the end the camera pitches up from straight down toward the
        // horizon, like tilting a map view: the land gets depth and the
        // planet's curve glows at the top as you go in.
        const t = Math.min(1, Math.max(0, (z - TILT_FROM) / (1 - TILT_FROM)));
        const pitch = PITCH * t * t * (3 - 2 * t);
        camera.position.set(
          0,
          -Math.sin(pitch) * dist,
          1 + Math.cos(pitch) * dist,
        );
        camera.lookAt(0, 0, 1);
        // The global cloud map is too coarse up close: clear it on the way
        // down (the page's own cloud layer takes over at the bottom).
        uCloudFade.value = 1 - Math.min(1, Math.max(0, (z - 0.45) / 0.3));
        requestLevels(z);
      } else {
        surface.rotation.y += spin * dt;
        clouds.rotation.y += spin * 1.15 * dt;
      }
      arrived.forEach((at, i) => {
        if (at >= 0) uLevelOn.value[i] = Math.min(1, (now - at) / 700);
      });
      renderer.render(scene, camera);
    };
    surface.rotation.y = clouds.rotation.y = -1.2; // open on Africa and the Atlantic
    // Free-spinning, any level may be seen: load them all.
    requestLevels(view ? 0 : 1);
    if (!reduced) raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      sphere.dispose();
      [surface, clouds, halo].forEach((m) => (m.material as THREE.Material).dispose());
      [day, night, maps, blank, ...levelTex].forEach((t) => t.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
    // sun is read once at mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed, view]);

  return <div ref={host} className={className} aria-hidden="true" />;
}
