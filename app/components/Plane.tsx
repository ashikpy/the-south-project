"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

/** Read each frame (each 0–1 but `on`). */
export interface PlaneView {
  on: boolean;
  /** tearing across the lens out of the forest; the sky is revealed behind it */
  pass: number;
  /** sweeping in from behind you, to fly beside you */
  arrive: number;
  /** pulling ahead and away */
  away: number;
}

/*
 * A King Air flying beside you in the evening light, then pulling ahead and
 * away toward the low sun until it is a speck over the fields
 * (public/models/king-air.glb: a Beechcraft King Air B200 model,
 * "B200_LARC_AIR", shrunk with scripts/optimize-model.mjs; the original is
 * in media-source/models. Its source and licence are to be confirmed).
 *
 * The model's own units: nose toward +z, up +y, 16.7 across.
 * The camera looks down -z; the plane heads away, left and a little up,
 * toward where the sun sits in the fields image.
 */
const MODEL = "/models/king-air.glb";
const SPAN = 16.66;
const START = new THREE.Vector3(2.2, -1.6, -19); // close beside you
const HEADING = new THREE.Vector3(-0.5, 0.1, -1).normalize();
const DISTANCE = 650; // how far it flies off, in the model's units
const BEHIND = new THREE.Vector3(16, -5, 26); // where it comes from: behind you, right
/* The pass: low overhead, left to right, seen from below as the camera
   looks up after it: a dark shape against the bright sky. */
const PASS_FROM = new THREE.Vector3(-44, 13, -22);
const PASS_TO = new THREE.Vector3(46, 15, -24);
const PASS_LOOK = new THREE.Vector3(0, 11, -20);

/**
 * What the paint reflects: the evening around it, as in the fields image,
 * a warm sky over a bright gold horizon, green-brown fields below.
 */
function eveningScene() {
  const scene = new THREE.Scene();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(50, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: `varying vec3 v; void main() { v = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 v;
        void main() {
          float y = v.y;
          vec3 above = mix(vec3(1.0, 0.72, 0.42), vec3(0.72, 0.52, 0.42), smoothstep(0.05, 0.8, y));
          vec3 below = mix(vec3(0.62, 0.52, 0.28), vec3(0.2, 0.26, 0.12), smoothstep(0.0, -0.5, y));
          vec3 c = y > 0.0 ? above : below;
          // The sun's glow, low ahead and to the left.
          float sun = max(0.0, dot(v, normalize(vec3(-0.55, 0.18, -0.8))));
          c += vec3(1.0, 0.6, 0.25) * pow(sun, 24.0) * 3.0;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  scene.add(sky);
  return { scene, dispose: () => (sky.geometry.dispose(), (sky.material as THREE.Material).dispose()) };
}

/** A propeller at speed: a faint disc, darker at the tips, with a soft hub. */
function propTexture() {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const r = size / 2;
  const disc = g.createRadialGradient(r, r, r * 0.12, r, r, r);
  disc.addColorStop(0, "rgba(30,30,28,0.55)");
  disc.addColorStop(0.2, "rgba(40,40,38,0.2)");
  disc.addColorStop(0.85, "rgba(50,48,44,0.18)");
  disc.addColorStop(0.95, "rgba(30,28,26,0.3)");
  disc.addColorStop(1, "rgba(30,28,26,0)");
  g.fillStyle = disc;
  g.fillRect(0, 0, size, size);
  // Faint blade arcs, as a camera half-catches them.
  g.strokeStyle = "rgba(20,20,18,0.16)";
  g.lineWidth = 10;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    g.beginPath();
    g.arc(r, r, r * 0.6, a, a + 0.55);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Renders only while `view.on`; nothing under reduced motion. */
export default function Plane({ view, className }: { view: RefObject<PlaneView>; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const stage = el.closest<HTMLElement>(".dive-stage");

    const renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const evening = eveningScene();
    const env = pmrem.fromScene(evening.scene, 0.02).texture;
    evening.dispose();
    scene.environment = env;
    scene.environmentIntensity = 0.32;
    // The sun low ahead and to the left, as in the image: it rims the plane
    // and casts the wing's shadow on it. It follows the plane, so its shadow
    // map only ever covers the plane.
    const sun = new THREE.DirectionalLight(0xffa85a, 4.6);
    const SUN_FROM = new THREE.Vector3(-30, 14, -40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 120 });
    // Warm sky above, the fields' green-brown bouncing up from below.
    const fill = new THREE.HemisphereLight(0xffc489, 0x3e4a24, 0.2);
    scene.add(sun, sun.target, fill);

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 2000);
    const plane = new THREE.Group();
    // Nose along the heading.
    plane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), HEADING);
    const attitude = plane.quaternion.clone();
    const across = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0));
    const screen = new THREE.Vector3();
    scene.add(plane);
    const props: THREE.Mesh[] = [];
    const disposables: { dispose(): void }[] = [env, pmrem];
    let disposed = false;

    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(MODEL, (gltf) => {
      const model = gltf.scene;
      // Back to the model's own units, whatever scale it was exported at.
      const box = new THREE.Box3().setFromObject(model);
      model.scale.multiplyScalar(SPAN / (box.max.x - box.min.x));
      plane.add(model);
      model.updateMatrixWorld(true);
      const local = new THREE.Matrix4().copy(plane.matrixWorld).invert();

      // The model's materials, merged by the optimiser: paint, metal, trim.
      // The paint gets a clear coat, as a real aircraft's, and its own
      // texture with the livery painted out (king-air-paint.webp): it
      // carried an agency's insignia and a real registration, neither ours
      // to show. Windows and panel lines stay.
      const livery = new THREE.TextureLoader().load("/models/king-air-paint.webp");
      livery.colorSpace = THREE.SRGBColorSpace;
      livery.flipY = false; // glTF's convention
      livery.anisotropy = 4;
      const paint = new THREE.MeshPhysicalMaterial({
        map: livery,
        color: 0xf3ede2,
        roughness: 0.38,
        metalness: 0,
        clearcoat: 0.6,
        clearcoatRoughness: 0.18,
      });
      disposables.push(paint, livery);
      const v = new THREE.Vector3();
      const tex = propTexture();
      disposables.push(tex);
      model.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        // The propellers lie in a thin slice at the very front of both
        // engines (found by place: their material is merged with the paint).
        // They turn too fast to see: hide them, and put a turning blur in
        // front of each engine instead.
        const pos = mesh.geometry.getAttribute("position");
        const box = new THREE.Box3();
        for (let i = 0; i < pos.count; i++) {
          // In the plane's own frame, so its heading doesn't matter.
          box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(local));
        }
        if (box.min.z > 2.6 && box.max.z - box.min.z < 1.8 && box.max.x - box.min.x > 4) {
          mesh.visible = false;
          for (const side of [-1, 1]) {
            const hub = new THREE.Box3();
            for (let i = 0; i < pos.count; i++) {
              v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(local);
              if (Math.sign(v.x) === side) hub.expandByPoint(v);
            }
            if (hub.isEmpty()) continue;
            const size = hub.getSize(new THREE.Vector3());
            const disc = new THREE.Mesh(
              new THREE.CircleGeometry(Math.max(size.x, size.y) / 2, 64),
              new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
            );
            disc.position.copy(hub.getCenter(new THREE.Vector3()));
            disposables.push(disc.geometry, disc.material as THREE.Material);
            plane.add(disc);
            props.push(disc);
          }
          return;
        }
        const m = mesh.material as THREE.MeshStandardMaterial;
        if (m.name === "PaintM") {
          m.map?.dispose();
          mesh.material = paint;
        }
      });
      // Warm up now, long before it shows: compile its shaders off the main
      // thread where the GPU allows, then draw it once, unseen, so textures
      // and the shadow pass are ready. Otherwise the first frame it appears
      // in stalls.
      renderer
        .compileAsync(scene, camera)
        .catch(() => {})
        .then(() => {
          if (disposed || view.current.on) return;
          plane.position.copy(START);
          camera.position.set(0, 0.6, 0);
          camera.lookAt(0, -1.2, -30);
          sun.target.position.copy(plane.position);
          sun.position.copy(plane.position).add(SUN_FROM);
          renderer.render(scene, camera);
          renderer.clear();
        });
    });

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      // Portrait screens: a wider lens, so the close-up still fits.
      camera.fov = camera.aspect < 1 ? 58 : 36;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const bank = new THREE.Quaternion();
    const forward = new THREE.Vector3(0, 0, 1);
    let raf = 0;
    let drawn = false;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const pass = view.current.pass;
      const passing = pass > 0 && pass < 1;
      // Where the sky is revealed up to, across the screen (Cultura.css).
      if (!view.current.on || document.hidden) {
        // Off: leave nothing behind, not the last frame.
        if (drawn) renderer.clear();
        drawn = false;
        return;
      }
      drawn = true;
      const t = now / 1000;
      const away = view.current.away;
      // Set inline on the stage by Silva.tsx's pointer handler.
      const inline = stage?.style;
      const mx = parseFloat(inline?.getPropertyValue("--mx") ?? "") || 0;
      const my = parseFloat(inline?.getPropertyValue("--my") ?? "") || 0;

      camera.position.set(mx * 0.4, 0.6 + my * -0.3, 0);
      el.classList.toggle("is-passing", passing);

      if (passing) {
        // Looking up after it as it goes over, backlit: almost black below,
        // the low sun catching its edges.
        camera.lookAt(PASS_LOOK.x + (pass - 0.5) * 6, PASS_LOOK.y, PASS_LOOK.z);
        renderer.toneMappingExposure = 0.5;
        fill.intensity = 0.12;
        scene.environmentIntensity = 0.08;
        plane.position.lerpVectors(PASS_FROM, PASS_TO, pass);
        bank.setFromAxisAngle(forward, 0.18);
        plane.quaternion.copy(across).multiply(bank);
      } else {
        camera.lookAt(mx * 0.2, -1.2, -30);
        renderer.toneMappingExposure = 0.82;
        fill.intensity = 0.2;
        scene.environmentIntensity = 0.32;
        // It eases ahead, then goes: slow at first, quicker as it leaves.
        const go = away * away * (0.4 + 0.6 * away);
        const arrive = view.current.arrive;
        plane.position
          .copy(START)
          .addScaledVector(BEHIND, (1 - arrive) * (1 - arrive))
          .addScaledVector(HEADING, go * DISTANCE);
        // Bobbing in the air beside you; a lean as it banks away, then level.
        plane.position.y += Math.sin(t * 1.3) * 0.12 * (1 - away) + Math.sin(t * 0.7) * 0.08;
        const lean = Math.sin(Math.PI * Math.min(1, away * 1.4)) * 0.3 + Math.sin(t * 0.9) * 0.015;
        bank.setFromAxisAngle(forward, -lean);
        plane.quaternion.copy(attitude).multiply(bank);
        // Where it is on screen, for the twinkle it leaves (Cultura.css);
        // a speck by then, it is gone with it.
        screen.copy(plane.position).project(camera);
        stage?.style.setProperty("--plane-x", `${((screen.x + 1) / 2) * 100}%`);
        stage?.style.setProperty("--plane-y", `${((1 - screen.y) / 2) * 100}%`);
      }
      plane.visible = passing || away < 0.9;
      sun.target.position.copy(plane.position);
      sun.position.copy(plane.position).add(SUN_FROM);
      for (const p of props) p.rotation.z = t * 9;
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const m = mesh.material as THREE.MeshStandardMaterial;
        for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap"] as const) m[key]?.dispose();
        m.dispose();
      });
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    };
  }, [view]);

  return <canvas ref={canvas} className={className} aria-hidden="true" />;
}
