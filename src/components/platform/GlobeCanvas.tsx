import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface GlobeCanvasProps {
  /** 0 to 1. The globe turns further as this grows. */
  scrollProgressRef: React.MutableRefObject<number>;
  className?: string;
}

const PEARL = 0xfbfaf8;
const GLOBE_FILL = 0x0e4a50;

/** A few well-known destinations, as [latitude, longitude]. */
const CITIES: Array<[number, number]> = [
  [9.93, 76.27], // Kochi
  [1.35, 103.82], // Singapore
  [35.01, 135.77], // Kyoto
  [40.63, 14.6], // Amalfi
  [38.72, -9.14], // Lisbon
  [40.71, -74.0], // New York
];

function toVector(lat: number, lon: number, radius = 1): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

/** A great-circle arc that rises above the surface in the middle. */
function arcPoints(a: THREE.Vector3, b: THREE.Vector3, segments: number, lift: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  const na = a.clone().normalize();
  const nb = b.clone().normalize();
  const angle = na.angleTo(nb);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const sinAngle = Math.sin(angle) || 1;
    const p = na
      .clone()
      .multiplyScalar(Math.sin((1 - t) * angle) / sinAngle)
      .add(nb.clone().multiplyScalar(Math.sin(t * angle) / sinAngle));
    p.normalize().multiplyScalar(1.004 + Math.sin(Math.PI * t) * lift);
    out.push(p);
  }
  return out;
}

/**
 * A quiet 3D globe: fine graticule, a field of points and glowing flight arcs
 * between real destinations. It turns slowly, follows the pointer and the scroll.
 */
export const GlobeCanvas: React.FC<GlobeCanvasProps> = ({ scrollProgressRef, className }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // No WebGL: the surrounding layout still reads fine without the globe.
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    camera.position.set(0, 0, 3.6);

    const globe = new THREE.Group();
    scene.add(globe);

    const disposables: Array<{ dispose: () => void }> = [];
    const track = <T extends { dispose: () => void }>(item: T): T => {
      disposables.push(item);
      return item;
    };

    // Solid core hides the far side so the graticule reads as a real sphere.
    const core = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.992, 64, 48)),
      track(new THREE.MeshBasicMaterial({ color: GLOBE_FILL }))
    );
    globe.add(core);

    // Graticule: parallels and meridians.
    const lineMat = track(new THREE.LineBasicMaterial({ color: PEARL, transparent: true, opacity: 0.2 }));
    const ringPoints = (fn: (t: number) => THREE.Vector3, steps = 96) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= steps; i++) pts.push(fn((i / steps) * Math.PI * 2));
      return pts;
    };
    for (let lat = -60; lat <= 60; lat += 20) {
      const r = Math.cos((lat * Math.PI) / 180);
      const y = Math.sin((lat * Math.PI) / 180);
      const geo = track(new THREE.BufferGeometry().setFromPoints(ringPoints((a) => new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)).map((v) => v.multiplyScalar(1.001))));
      globe.add(new THREE.Line(geo, lineMat));
    }
    for (let lon = 0; lon < 180; lon += 20) {
      const rot = (lon * Math.PI) / 180;
      const geo = track(
        new THREE.BufferGeometry().setFromPoints(
          ringPoints((a) => new THREE.Vector3(Math.cos(a) * Math.cos(rot), Math.sin(a), Math.cos(a) * Math.sin(rot))).map((v) => v.multiplyScalar(1.001))
        )
      );
      globe.add(new THREE.Line(geo, lineMat));
    }

    // Field of points (Fibonacci sphere).
    const count = 1100;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const rr = Math.sqrt(1 - y * y);
      const th = Math.PI * (3 - Math.sqrt(5)) * i;
      pos[i * 3] = Math.cos(th) * rr * 1.003;
      pos[i * 3 + 1] = y * 1.003;
      pos[i * 3 + 2] = Math.sin(th) * rr * 1.003;
    }
    const pointsGeo = track(new THREE.BufferGeometry());
    pointsGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pointsMat = track(new THREE.PointsMaterial({ color: PEARL, size: 0.011, transparent: true, opacity: 0.55, sizeAttenuation: true }));
    globe.add(new THREE.Points(pointsGeo, pointsMat));

    // City markers.
    const markerGeo = track(new THREE.SphereGeometry(0.018, 16, 16));
    const markerMat = track(new THREE.MeshBasicMaterial({ color: PEARL }));
    const haloGeo = track(new THREE.RingGeometry(0.03, 0.036, 40));
    const haloMat = track(new THREE.MeshBasicMaterial({ color: PEARL, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    const halos: THREE.Mesh[] = [];
    CITIES.forEach(([lat, lon]) => {
      const p = toVector(lat, lon, 1.005);
      const dot = new THREE.Mesh(markerGeo, markerMat);
      dot.position.copy(p);
      globe.add(dot);
      const halo = new THREE.Mesh(haloGeo, haloMat.clone());
      track(halo.material as THREE.MeshBasicMaterial);
      halo.position.copy(p);
      halo.lookAt(p.clone().multiplyScalar(2));
      globe.add(halo);
      halos.push(halo);
    });

    // Flight arcs between consecutive cities, drawn progressively.
    const arcs: Array<{ line: THREE.Line; total: number }> = [];
    const arcMat = track(new THREE.LineBasicMaterial({ color: PEARL, transparent: true, opacity: 0.95 }));
    for (let i = 0; i < CITIES.length; i++) {
      const a = toVector(CITIES[i][0], CITIES[i][1]);
      const b = toVector(CITIES[(i + 1) % CITIES.length][0], CITIES[(i + 1) % CITIES.length][1]);
      const pts = arcPoints(a, b, 64, 0.22);
      const geo = track(new THREE.BufferGeometry().setFromPoints(pts));
      const line = new THREE.Line(geo, arcMat);
      globe.add(line);
      arcs.push({ line, total: pts.length });
    }

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
    const start = performance.now();
    const frame = (now: number) => {
      const t = reduced ? 3 : (now - start) / 1000;
      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;

      globe.rotation.y = 0.9 + t * 0.12 + scrollProgressRef.current * Math.PI * 1.2 + pointer.x * 0.35;
      globe.rotation.x = 0.28 + pointer.y * 0.18;

      // Each arc draws, holds, then fades back in sequence.
      const cycle = 10;
      arcs.forEach((arc, i) => {
        const local = ((t + i * (cycle / arcs.length)) % cycle) / cycle;
        const grow = Math.min(1, local / 0.45);
        arc.line.geometry.setDrawRange(0, Math.max(2, Math.floor(arc.total * grow)));
        (arc.line.material as THREE.LineBasicMaterial).opacity = 0.95;
      });
      halos.forEach((h, i) => {
        const s = 1 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.6 + i));
        h.scale.setScalar(s);
        (h.material as THREE.MeshBasicMaterial).opacity = 0.8 - 0.5 * (s - 1);
      });

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
