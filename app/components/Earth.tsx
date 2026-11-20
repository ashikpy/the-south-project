"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

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
    // Backlit (the sun behind the planet): light scattered forward through
    // the air makes the whole rim glow, brightest towards the sun.
    float forward = pow(max(dot(view, uSun), 0.0), 5.0);
    // A thin bright edge, not a thick ring: confined close to the planet.
    float edge = pow(clamp(d / LIMB, 0.0, 1.0), 9.0);
    vec3 col = atmo * a * strength + vec3(1.0, 0.82, 0.62) * edge * forward * 0.9;
    float alpha = clamp(a * strength + edge * forward * 0.9, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Southern India (Kerala and Tamil Nadu), where the zoom lands. */
const TARGET = { lat: 10.5, lon: 77.5 };
/** Height above the surface (planet radius = 1) at zoom 0 and zoom 1. */
const ALT_FAR = 6;
const ALT_NEAR = 0.16;
/** Earth radius, for the altitude readout. */
const EARTH_KM = 6371;
/**
 * Earthrise: at rise 0 the camera looks this far above the planet (world
 * units), so only its edge shows at the bottom of the frame; it settles on
 * the planet as rise goes to 1.
 */
const RISE_LOOK = 2.6;
/**
 * The sun starts just hidden behind the planet's edge, then swings round
 * to light southern India: it breaks over the rim on the way.
 */
const SUN_START = new THREE.Vector3(-0.07, 0.11, -1).normalize();
/** Final camera pitch from straight down (radians), and the zoom it starts at. */
const PITCH = 1.0;
const TILT_FROM = 0.6;

/** Scroll-driven view, written by the page and read here each frame. */
export interface EarthView {
  /** 0 = far out in space, 1 = just above southern India */
  zoom: number;
  /** false while hidden: skip drawing */
  on: boolean;
  /** 0–1 earthrise: the planet rises into frame and the sun breaks over it */
  rise: number;
  /** 0–1 the space station's fly-past across the foreground (hidden outside) */
  station?: number;
}

/**
 * The ISS (NASA's model, optimised by scripts/optimize-model.mjs) drifts
 * across the foreground on the approach: this far in front of the camera,
 * this long, entering at one side and leaving at the other.
 */
const STATION = { file: "/models/iss.glb", length: 0.2, far: 3.2, near: 0.2 };

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};
const altitudeAt = (zoom: number) =>
  Math.exp(Math.log(ALT_FAR) + (Math.log(ALT_NEAR) - Math.log(ALT_FAR)) * zoom);
/** How far (radians) the globe is still turned away from TARGET. */
const turnAt = (zoom: number) => Math.pow(1 - zoom, 2.5) * 1.5 * (1 - zoom);

/** Altitude and the point below, for the travel readout on the page. */
export function earthReadout(zoom: number) {
  const z = Math.min(1, Math.max(0, zoom));
  return {
    km: altitudeAt(z) * EARTH_KM,
    lat: TARGET.lat * Math.pow(z, 0.6),
    lon: TARGET.lon - THREE.MathUtils.radToDeg(turnAt(z)),
  };
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
    // 1.5x is sharp on retina screens at ~half the pixels of 2x.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
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
    // Scroll-driven: draw only when something changed (scroll, a texture
    // arriving, a resize), not 60 times a second while the page is still.
    let dirty = true;

    const loader = new THREE.TextureLoader();
    const anisotropy = renderer.capabilities.getMaxAnisotropy();
    const load = (name: string, srgb: boolean) => {
      const t = loader.load(TEX + name, () => {
        dirty = true;
        renderer.render(scene, camera);
      });
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
          dirty = true;
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

    // Stars: sharp points drawn at screen resolution on a sphere that
    // travels with the camera (so infinitely far away). Seeded, so the sky
    // is the same on every visit; most are faint, a few bright.
    const STARS = 18000; // the narrow lens sees ~2% of the sky: ~350 on screen
    let seed = 11;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const starPos = new Float32Array(STARS * 3);
    const starSize = new Float32Array(STARS);
    const starCol = new Float32Array(STARS * 3);
    for (let i = 0; i < STARS; i++) {
      const u = rand() * 2 - 1;
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      starPos.set([r * Math.cos(a) * 80, u * 80, r * Math.sin(a) * 80], i * 3);
      const b = Math.pow(rand(), 7); // brightness: mostly faint
      starSize[i] = 1.1 + b * 2.6;
      const warm = rand();
      const tint = warm < 0.15 ? [1, 0.86, 0.72] : warm > 0.8 ? [0.8, 0.88, 1] : [1, 1, 1];
      const k = 0.32 + 0.68 * b;
      starCol.set(tint.map((c) => c * k), i * 3);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute("aSize", new THREE.BufferAttribute(starSize, 1));
    starGeo.setAttribute("aColor", new THREE.BufferAttribute(starCol, 3));
    const uDpr = { value: renderer.getPixelRatio() };
    const sky = new THREE.Points(
      starGeo,
      new THREE.ShaderMaterial({
        uniforms: { uDpr },
        vertexShader: /* glsl */ `
          attribute float aSize;
          attribute vec3 aColor;
          uniform float uDpr;
          varying vec3 vColor;
          void main() {
            vColor = aColor;
            gl_PointSize = aSize * uDpr;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vColor;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.1, d);
            gl_FragColor = vec4(vColor * a, a);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    sky.renderOrder = -1;
    scene.add(sky);

    // Sun flare: a soft glow, a hot core and a thin horizontal streak, drawn
    // over everything while the sun is in view and not behind the planet.
    const glowTexture = (draw: (g: CanvasRenderingContext2D, s: number) => void) => {
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const g = c.getContext("2d")!;
      draw(g, 256);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const radial = (stops: [number, string][]) =>
      glowTexture((g, n) => {
        const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
        stops.forEach(([o, col]) => r.addColorStop(o, col));
        g.fillStyle = r;
        g.fillRect(0, 0, n, n);
      });
    const flareTex = [
      radial([[0, "rgba(255,238,215,0.35)"], [0.3, "rgba(255,215,175,0.08)"], [1, "rgba(255,200,160,0)"]]),
      radial([[0, "rgba(255,255,255,1)"], [0.18, "rgba(255,252,245,0.85)"], [0.45, "rgba(255,240,220,0.1)"], [1, "rgba(255,230,200,0)"]]),
    ];
    const flares = flareTex.map((map) => {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map,
          blending: THREE.AdditiveBlending,
          depthTest: false,
          depthWrite: false,
          transparent: true,
          toneMapped: false,
          opacity: 0,
        }),
      );
      sprite.renderOrder = 10;
      scene.add(sprite);
      return sprite;
    });
    const flareScale: [number, number][] = [[9, 9], [1.6, 1.6]];
    const sunEnd = new THREE.Vector3(...sun).normalize();

    // The station flies past on its own layer (a second canvas over the
    // planet, same camera), so it can go out of focus as it nears while the
    // Earth stays sharp, like a foreground object through a real lens.
    // Lit by the sun, a little blue earthshine and a dim reflection.
    const stationGL = view
      ? new THREE.WebGLRenderer({ antialias: true, alpha: true })
      : null;
    const stationScene = new THREE.Scene();
    const station = new THREE.Group();
    station.visible = false;
    stationScene.add(station);
    const sunLight = new THREE.DirectionalLight(0xfff2e2, 3.4);
    stationScene.add(sunLight, sunLight.target, new THREE.AmbientLight(0x6f8fb0, 0.25));
    let pmrem: THREE.PMREMGenerator | null = null;
    let envTex: THREE.Texture | null = null;
    let stationReady = false;
    let stationShown = false;
    if (stationGL) {
      stationGL.setPixelRatio(renderer.getPixelRatio());
      stationGL.toneMapping = THREE.ACESFilmicToneMapping;
      stationGL.toneMappingExposure = 1.1;
      stationGL.setClearColor(0x000000, 0);
      const c = stationGL.domElement;
      c.style.cssText =
        "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0;will-change:filter,opacity";
      el.appendChild(c);
      pmrem = new THREE.PMREMGenerator(stationGL);
      envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      stationScene.environment = envTex;
      stationScene.environmentIntensity = 0.35;
      new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(STATION.file, (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        model.position.sub(box.getCenter(new THREE.Vector3()));
        const holder = new THREE.Group();
        holder.add(model);
        holder.scale.setScalar(STATION.length / Math.max(size.x, size.y, size.z));
        station.add(holder);
        stationReady = true;
        dirty = true;
      });
    }
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    const ahead = new THREE.Vector3();
    const spinQ = new THREE.Quaternion();
    const spinE = new THREE.Euler();
    const toCenter = new THREE.Vector3();

    let fit = 1; // extra distance on portrait boxes so the globe fits
    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      stationGL?.setSize(w, h, false);
      camera.aspect = w / h;
      // Keep the whole globe in frame on narrow boxes too.
      fit = w < h ? h / w : 1;
      camera.position.z = DIST * fit;
      camera.updateProjectionMatrix();
      dirty = true;
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
    let last = performance.now();
    let lastKey = "";
    const spin = ((Math.PI * 2) / 180) * speed;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible) return;
      if (view) {
        const v = view.current;
        if (!v?.on) return;
        const key = `${v.zoom}|${v.rise}|${v.station}`;
        const fading = arrived.some((at, i) => at >= 0 && uLevelOn.value[i] < 1);
        if (key === lastKey && !dirty && !fading) return;
        lastKey = key;
        dirty = false;
        const z = Math.min(1, Math.max(0, v.zoom));
        // Turn into place while descending: Africa first, then across the
        // Arabian Sea until southern India comes round to meet you.
        surface.rotation.y = FACE_Y + turnAt(z);
        clouds.rotation.y = surface.rotation.y + 0.03;
        globe.rotation.x = FACE_X * Math.pow(z, 0.6);
        globe.rotation.z = TILT * (1 - Math.pow(z, 0.6));
        // Descend on a log scale: the speed feels even all the way down.
        const alt = altitudeAt(z);
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
        // Earthrise: look above the planet at first, settle on it.
        const rise = Math.min(1, Math.max(0, v.rise ?? 1));
        camera.lookAt(0, RISE_LOOK * (1 - smooth(rise)), 1);
        // The sun swings out from behind the planet to light India.
        uSun.value.copy(SUN_START).lerp(sunEnd, smooth((rise - 0.4) / 0.6)).normalize();
        // The global cloud map is too coarse up close: clear it on the way
        // down (the page's own cloud layer takes over at the bottom).
        uCloudFade.value = 1 - Math.min(1, Math.max(0, (z - 0.45) / 0.3));
        requestLevels(z);
      } else {
        surface.rotation.y += spin * dt;
        clouds.rotation.y += spin * 1.15 * dt;
      }
      // The station's fly-by, placed relative to the camera: it appears
      // small and far ahead, comes at you growing in perspective and turning
      // to show its sides, and passes just beside the camera, low and left.
      const f = view?.current?.station ?? 0;
      station.visible = stationReady && f > 0 && f < 1;
      if (station.visible && stationGL) {
        camera.updateMatrixWorld();
        right.setFromMatrixColumn(camera.matrixWorld, 0);
        up.setFromMatrixColumn(camera.matrixWorld, 1);
        ahead.setFromMatrixColumn(camera.matrixWorld, 2).negate();
        // Distance shrinks on a log scale, so the approach accelerates.
        const depth = STATION.far * Math.pow(STATION.near / STATION.far, f);
        // Where on screen it sits (fractions of the half-frame), drifting
        // from upper right of centre out past the lower left edge.
        const halfV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const halfH = halfV * camera.aspect;
        // In the last stretch it whips out past the lower-left corner: it
        // rushes past the viewer rather than hanging in front of them.
        const late = Math.max(0, f - 0.6);
        const sx = 0.34 - 0.8 * f - 9 * late * late;
        const sy = 0.14 - 0.45 * f - 4.5 * late * late;
        station.position
          .copy(camera.position)
          .addScaledVector(ahead, depth)
          .addScaledVector(right, sx * depth * halfH)
          .addScaledVector(up, sy * depth * halfV);
        // Turning as it comes: from nearly edge-on to its broad face.
        spinQ.setFromEuler(spinE.set(0.55 - 0.35 * f, 1.25 - 1.5 * f, 0.25 + 0.2 * f));
        station.quaternion.copy(camera.quaternion).multiply(spinQ);
        // Focus is on the Earth: the station blurs as it gets close, and
        // fades in out of the distance.
        const near = Math.min(1, Math.max(0, (0.5 - depth) / 0.38));
        const c = stationGL.domElement;
        c.style.filter = `blur(${(near * near * 9).toFixed(1)}px)`;
        c.style.opacity = (smooth(f / 0.12) * (1 - smooth((f - 0.9) / 0.1))).toFixed(3);
        sunLight.position.copy(uSun.value).multiplyScalar(10);
        stationGL.render(stationScene, camera);
        stationShown = true;
      } else if (stationShown && stationGL) {
        stationGL.domElement.style.opacity = "0";
        stationShown = false;
      }
      // Stars stay put as you travel; the flare follows the sun.
      sky.position.copy(camera.position);
      const s = uSun.value;
      toCenter.copy(camera.position).negate();
      const camDist = toCenter.length();
      const angle = s.angleTo(toCenter.normalize());
      const limb = Math.asin(Math.min(1, 1 / camDist));
      const clear = smooth((angle - limb + 0.004) / 0.016);
      const burst = Math.exp(-Math.max(0, angle - limb) / 0.05);
      const shine = clear * (0.55 + 0.6 * burst);
      flares.forEach((f, i) => {
        f.position.copy(camera.position).addScaledVector(s, 60);
        const k = 1 + burst * 0.35;
        f.scale.set(flareScale[i][0] * k, flareScale[i][1] * k, 1);
        f.material.opacity = shine;
      });

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
      starGeo.dispose();
      envTex?.dispose();
      pmrem?.dispose();
      stationGL?.dispose();
      stationGL?.domElement.remove();
      station.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            Object.values(m).forEach((v) => v instanceof THREE.Texture && v.dispose());
            m.dispose();
          });
        }
      });
      [surface, clouds, halo, sky, ...flares].forEach((m) => (m.material as THREE.Material).dispose());
      [day, night, maps, blank, ...levelTex, ...flareTex].forEach((t) => t.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
    // sun is read once at mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed, view]);

  return <div ref={host} className={className} aria-hidden="true" />;
}
