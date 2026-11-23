import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface PackingCanvasProps {
  /** 0 to 1. The suitcase comes further apart as this grows. */
  scrollProgressRef: React.MutableRefObject<number>;
  className?: string;
}

const TEAL = 0x14646b;
const TEAL_DEEP = 0x0b3b40;
const PEARL = 0xfbfaf8;
const PEARL_DIM = 0xdfe7e4;
const JET = 0x0a0a0a;

/** A rounded, bevelled slab centred on the origin: w wide, h tall, d deep. */
function slab(w: number, h: number, d: number, radius: number, bevel: number): THREE.BufferGeometry {
  const iw = Math.max(0.01, w - bevel * 2);
  const ih = Math.max(0.01, h - bevel * 2);
  const r = Math.min(radius, iw / 2, ih / 2);
  const x = -iw / 2;
  const y = -ih / 2;
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + iw - r, y);
  s.absarc(x + iw - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + iw, y + ih - r);
  s.absarc(x + iw - r, y + ih - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + ih);
  s.absarc(x + r, y + ih - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.005, d - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 10,
  });
  geo.center();
  return geo;
}

/**
 * An exploded view of a packed suitcase: the shell, the folded layers inside and
 * the lid separate along one axis as you scroll, then settle back together.
 */
export const PackingCanvas: React.FC<PackingCanvasProps> = ({ scrollProgressRef, className }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // No WebGL: the layout around it still reads fine.
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 0.15, 6.4);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(2.5, 3.5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fd3d6, 1.1);
    rim.position.set(-3, 1, -2);
    scene.add(rim);

    const disposables: Array<{ dispose: () => void }> = [];
    const track = <T extends { dispose: () => void }>(item: T): T => {
      disposables.push(item);
      return item;
    };
    const mat = (color: number, rough = 0.5, metal = 0.05) =>
      track(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));

    const rig = new THREE.Group();
    scene.add(rig);

    interface Layer {
      group: THREE.Group;
      baseZ: number; // resting position along the depth axis
      spreadZ: number; // extra distance when fully exploded
      drift: [number, number]; // sideways drift when exploded
    }
    const layers: Layer[] = [];
    const edgeMat = track(new THREE.LineBasicMaterial({ color: PEARL, transparent: true, opacity: 0.35 }));

    const addPart = (
      geo: THREE.BufferGeometry,
      material: THREE.Material,
      layer: Layer,
      position: [number, number, number] = [0, 0, 0],
      edges = false
    ) => {
      track(geo);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(...position);
      layer.group.add(mesh);
      if (edges) {
        const eg = track(new THREE.EdgesGeometry(geo, 35));
        const lines = new THREE.LineSegments(eg, edgeMat);
        lines.position.set(...position);
        layer.group.add(lines);
      }
      return mesh;
    };
    const newLayer = (baseZ: number, spreadZ: number, drift: [number, number] = [0, 0]): Layer => {
      const layer: Layer = { group: new THREE.Group(), baseZ, spreadZ, drift };
      rig.add(layer.group);
      layers.push(layer);
      return layer;
    };

    const W = 1.5;
    const H = 2.3;

    // 1. Back shell with handle and wheels.
    const back = newLayer(-0.3, 0);
    addPart(slab(W, H, 0.3, 0.2, 0.05), mat(JET, 0.4, 0.2), back, [0, 0, 0], true);
    addPart(slab(W * 0.7, H * 0.72, 0.04, 0.12, 0.015), mat(0x161a1b, 0.7), back, [0, 0.02, 0.17]);
    const handleMat = mat(PEARL_DIM, 0.35, 0.3);
    addPart(slab(0.62, 0.07, 0.07, 0.03, 0.02), handleMat, back, [0, H / 2 + 0.2, -0.05]);
    addPart(slab(0.06, 0.2, 0.07, 0.025, 0.015), handleMat, back, [-0.28, H / 2 + 0.1, -0.05]);
    addPart(slab(0.06, 0.2, 0.07, 0.025, 0.015), handleMat, back, [0.28, H / 2 + 0.1, -0.05]);
    const wheelGeo = track(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 20));
    const wheelMat = mat(PEARL_DIM, 0.4, 0.2);
    [-0.5, 0.5].forEach((px) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(px, -H / 2 - 0.05, -0.05);
      back.group.add(wheel);
    });

    // 2. Folded stacks (clothing layers).
    const stack = (z: number, spread: number, color: number, h: number, offset: [number, number], drift: [number, number]) => {
      const layer = newLayer(z, spread, drift);
      addPart(slab(W * 0.78, h, 0.16, 0.05, 0.025), mat(color, 0.85), layer, [offset[0], offset[1], 0]);
      // The visible folds: two thin lines of contrast.
      addPart(slab(W * 0.78, 0.02, 0.17, 0.005, 0.004), mat(JET, 0.9), layer, [offset[0], offset[1] + h * 0.18, 0]);
      addPart(slab(W * 0.78, 0.02, 0.17, 0.005, 0.004), mat(JET, 0.9), layer, [offset[0], offset[1] - h * 0.18, 0]);
      return layer;
    };
    stack(-0.08, 0.5, PEARL, 0.78, [0, -0.52], [-0.18, 0]);
    stack(0.12, 0.95, TEAL, 0.7, [0, 0.38], [0.2, 0]);

    // 3. Small kit: toiletry pouch and a rolled item.
    const kit = newLayer(0.3, 1.45, [0.12, 0.05]);
    addPart(slab(0.52, 0.34, 0.2, 0.08, 0.035), mat(PEARL_DIM, 0.6), kit, [0.32, -0.78, 0]);
    addPart(slab(0.52, 0.03, 0.21, 0.01, 0.006), mat(TEAL_DEEP, 0.6), kit, [0.32, -0.7, 0]);
    const rollGeo = track(new THREE.CylinderGeometry(0.15, 0.15, 0.62, 28));
    const roll = new THREE.Mesh(rollGeo, mat(TEAL_DEEP, 0.8));
    roll.rotation.z = Math.PI / 2;
    roll.position.set(-0.28, -0.78, 0);
    kit.group.add(roll);
    const rollEnd = new THREE.Mesh(track(new THREE.CircleGeometry(0.15, 28)), mat(PEARL, 0.8));
    rollEnd.position.set(-0.28 + 0.311, -0.78, 0);
    rollEnd.rotation.y = Math.PI / 2;
    kit.group.add(rollEnd);

    // 4. Front shell (lid): teal, with vertical ribs.
    const front = newLayer(0.5, 2.2);
    addPart(slab(W, H, 0.3, 0.2, 0.05), mat(TEAL, 0.38, 0.25), front, [0, 0, 0], true);
    const ribMat = mat(TEAL_DEEP, 0.5, 0.15);
    for (let i = -2; i <= 2; i++) {
      addPart(slab(0.045, H * 0.8, 0.03, 0.02, 0.008), ribMat, front, [i * 0.27, 0, 0.17]);
    }
    addPart(slab(0.34, 0.08, 0.03, 0.03, 0.01), mat(PEARL, 0.3, 0.4), front, [0, 0.98, 0.17]);

    // Pointer follow.
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onPointerMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      pointer.tx = ((e.clientX - r.left) / Math.max(1, r.width) - 0.5) * 2;
      pointer.ty = ((e.clientY - r.top) / Math.max(1, r.height) - 0.5) * 2;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const resize = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let raf = 0;
    let explode = 0.4;
    const start = performance.now();
    const frame = (now: number) => {
      const t = reduced ? 2 : (now - start) / 1000;
      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;

      // Resting state is partly open; scrolling pulls it fully apart.
      const breathe = reduced ? 0 : 0.06 * Math.sin(t * 0.9);
      const target = 0.38 + 0.62 * scrollProgressRef.current + breathe;
      explode += (target - explode) * (reduced ? 1 : 0.08);

      layers.forEach((l) => {
        l.group.position.z = l.baseZ + l.spreadZ * explode * 0.55;
        l.group.position.x = l.drift[0] * explode;
        l.group.position.y = l.drift[1] * explode;
      });

      rig.rotation.y = -0.62 + pointer.x * 0.28 + scrollProgressRef.current * 0.5;
      rig.rotation.x = 0.1 + pointer.y * 0.1;
      rig.position.y = reduced ? 0 : Math.sin(t * 0.7) * 0.04;

      renderer.render(scene, camera);
      if (!reduced) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [scrollProgressRef]);

  return <div ref={hostRef} className={className || 'w-full h-full'} aria-hidden="true" />;
};
