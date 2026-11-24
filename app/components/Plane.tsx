"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/** Read each frame: whether it shows, and how far it has flown off (0–1). */
export interface PlaneView {
  on: boolean;
  /** sweeping in from behind you, 0–1 */
  arrive: number;
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
    renderer.toneMappingExposure = 0.95;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.25;
    // The sun low ahead and to the left; the fields throw green-gold light up.
    const sun = new THREE.DirectionalLight(0xffbf80, 3);
    sun.position.set(-40, 14, -60);
    scene.add(sun, new THREE.HemisphereLight(0xffd6a0, 0x4a5a2a, 0.45));

    const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 2000);
    const plane = new THREE.Group();
    // Nose along the heading.
    plane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), HEADING);
    const attitude = plane.quaternion.clone();
    scene.add(plane);
    const props: THREE.Mesh[] = [];
    const disposables: { dispose(): void }[] = [env, pmrem];

    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(MODEL, (gltf) => {
      const model = gltf.scene;
      // Back to the model's own units, whatever scale it was exported at.
      const box = new THREE.Box3().setFromObject(model);
      model.scale.multiplyScalar(SPAN / (box.max.x - box.min.x));
      plane.add(model);
      model.updateMatrixWorld(true);
      const local = new THREE.Matrix4().copy(plane.matrixWorld).invert();

      // Plain warm white paint: the model's livery carries an agency's
      // insignia and a real registration, neither of which is ours to show.
      model.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const m = mesh.material as THREE.MeshStandardMaterial;
        if (m.name !== "PaintM" && m.name !== "PaintPM") return;
        m.map?.dispose();
        m.map = null;
        m.color.set(0xf2ede4);
        m.needsUpdate = true;
      });

      // The propellers are their own material: hide the still blades and
      // put a turning blur in front of each engine instead.
      const tex = propTexture();
      disposables.push(tex);
      model.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || (mesh.material as THREE.Material).name !== "PlasticM") return;
        mesh.visible = false;
        const pos = mesh.geometry.getAttribute("position");
        const v = new THREE.Vector3();
        for (const side of [-1, 1]) {
          const hub = new THREE.Box3();
          for (let i = 0; i < pos.count; i++) {
            // In the plane's own frame, so its heading doesn't matter.
            v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(local);
            if (Math.sign(v.x) === side) hub.expandByPoint(v);
          }
          if (hub.isEmpty()) continue;
          const size = hub.getSize(new THREE.Vector3());
          const disc = new THREE.Mesh(
            new THREE.CircleGeometry(Math.max(size.x, size.y) / 2, 48),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
          );
          disc.position.copy(hub.getCenter(new THREE.Vector3()));
          disposables.push(disc.geometry, disc.material as THREE.Material);
          plane.add(disc);
          props.push(disc);
        }
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

      camera.position.set(mx * 0.4, 0.6 + my * -0.3, 0);
      camera.lookAt(mx * 0.2, -1.2, -30);
      for (const p of props) p.rotation.z = t * 9;
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    return () => {
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
