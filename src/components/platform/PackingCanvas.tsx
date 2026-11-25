import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface PackingCanvasProps {
  /** 0 to 1. The suitcase opens wider as this grows. */
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
 * A hard-shell suitcase that opens like a book as you scroll, showing the
 * folded layers, kit and straps packed inside.
 */
export const PackingCanvas: React.FC<PackingCanvasProps> = ({ scrollProgressRef, className }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const toggleLidRef = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);
  const [lidClosed, setLidClosed] = useState(false);
  const [touched, setTouched] = useState(false);

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
    setReady(true);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0.25, 0.5, 7.4);
    camera.lookAt(0, 0.05, 0);

    scene.add(new THREE.HemisphereLight(0xdff3f2, 0x0b3b40, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(2.5, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fd3d6, 1.4);
    rim.position.set(-4, 1.5, -2);
    scene.add(rim);
    const fill = new THREE.PointLight(0xfbfaf8, 0.9, 12);
    fill.position.set(-2.5, 0.5, 4);
    scene.add(fill);

    const disposables: Array<{ dispose: () => void }> = [];
    const track = <T extends { dispose: () => void }>(item: T): T => {
      disposables.push(item);
      return item;
    };
    const mat = (color: number, rough = 0.5, metal = 0.05) =>
      track(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
    const gloss = (color: number) =>
      track(new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0.15, clearcoat: 0.7, clearcoatRoughness: 0.25 }));
    const add = (
      parent: THREE.Object3D,
      geo: THREE.BufferGeometry,
      material: THREE.Material,
      x = 0,
      y = 0,
      z = 0
    ) => {
      track(geo);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };

    // Soft contact shadow on the floor.
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = shadowCanvas.height = 128;
    const sctx = shadowCanvas.getContext('2d');
    if (sctx) {
      const g = sctx.createRadialGradient(64, 64, 4, 64, 64, 62);
      g.addColorStop(0, 'rgba(0,0,0,0.55)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      sctx.fillStyle = g;
      sctx.fillRect(0, 0, 128, 128);
    }
    const shadowTex = track(new THREE.CanvasTexture(shadowCanvas));
    const shadow = new THREE.Mesh(
      track(new THREE.PlaneGeometry(4.6, 2.2)),
      track(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }))
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0.1, -1.36, 0.2);
    scene.add(shadow);

    const rig = new THREE.Group();
    scene.add(rig);

    const W = 1.5;
    const H = 2.3;
    const edgeMat = track(new THREE.LineBasicMaterial({ color: PEARL, transparent: true, opacity: 0.28 }));
    const outline = (parent: THREE.Object3D, geo: THREE.BufferGeometry) => {
      const lines = new THREE.LineSegments(track(new THREE.EdgesGeometry(geo, 35)), edgeMat);
      parent.add(lines);
    };

    // ---- Back shell: the half that holds everything.
    const back = new THREE.Group();
    rig.add(back);
    const backGeo = slab(W, H, 0.3, 0.2, 0.05);
    add(back, backGeo, gloss(JET));
    outline(back, backGeo);
    // Inner lining the items rest on.
    add(back, slab(W * 0.9, H * 0.92, 0.03, 0.14, 0.01), mat(TEAL_DEEP, 0.9), 0, 0, 0.16);

    const handleMat = mat(PEARL_DIM, 0.3, 0.5);
    add(back, slab(0.62, 0.07, 0.07, 0.03, 0.02), handleMat, 0, H / 2 + 0.2, -0.05);
    add(back, slab(0.06, 0.2, 0.07, 0.025, 0.015), handleMat, -0.28, H / 2 + 0.1, -0.05);
    add(back, slab(0.06, 0.2, 0.07, 0.025, 0.015), handleMat, 0.28, H / 2 + 0.1, -0.05);
    const wheelGeo = track(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 24));
    const wheelMat = mat(PEARL_DIM, 0.35, 0.4);
    [-0.5, 0.5].forEach((px) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(px, -H / 2 - 0.05, -0.05);
      back.add(wheel);
    });

    // ---- Packed items. Each lifts a little as the case opens.
    const base = 0.175;
    const items: Array<{ group: THREE.Group; lift: number }> = [];
    const item = (x: number, y: number, lift: number) => {
      const g = new THREE.Group();
      g.position.set(x, y, base);
      back.add(g);
      items.push({ group: g, lift });
      return g;
    };
    const folded = (g: THREE.Group, w: number, h: number, t: number, color: number) => {
      add(g, slab(w, h, t, 0.05, 0.022), mat(color, 0.88), 0, 0, t / 2);
      [-0.2, 0.2].forEach((f) => add(g, slab(w * 0.98, 0.016, t + 0.012, 0.004, 0.003), mat(JET, 0.9), 0, h * f, t / 2));
    };
    folded(item(-0.31, 0.62, 0.05), 0.56, 0.62, 0.14, PEARL);
    folded(item(0.31, 0.62, 0.07), 0.56, 0.62, 0.14, TEAL);
    folded(item(0, 0.02, 0.04), 1.2, 0.5, 0.17, PEARL_DIM);

    const pouch = item(-0.33, -0.64, 0.08);
    add(pouch, slab(0.5, 0.44, 0.2, 0.09, 0.04), mat(PEARL, 0.6), 0, 0, 0.1);
    add(pouch, slab(0.5, 0.03, 0.215, 0.01, 0.006), mat(TEAL_DEEP, 0.6), 0, 0.12, 0.1);
    add(pouch, slab(0.07, 0.07, 0.03, 0.02, 0.008), mat(TEAL, 0.4, 0.3), 0.14, 0.12, 0.215);

    const roll = item(0.3, -0.64, 0.09);
    const rollMesh = add(roll, new THREE.CylinderGeometry(0.15, 0.15, 0.62, 32), mat(TEAL_DEEP, 0.8), 0, 0, 0.15);
    rollMesh.rotation.z = Math.PI / 2;
    const rollEnd = add(roll, new THREE.CircleGeometry(0.15, 32), mat(PEARL, 0.8), 0.311, 0, 0.15);
    rollEnd.rotation.y = Math.PI / 2;

    // Two straps across the load, with buckles.
    const strapMat = mat(PEARL, 0.5, 0.1);
    const strap = (y: number) => {
      const g = item(0, y, 0.1);
      add(g, slab(1.3, 0.05, 0.03, 0.01, 0.006), strapMat, 0, 0, 0.2);
      add(g, slab(0.1, 0.1, 0.045, 0.02, 0.01), mat(JET, 0.3, 0.6), 0.5, 0, 0.215);
    };
    strap(0.34);
    strap(-0.3);

    // ---- Lid: hinged on the left edge, swings toward the viewer.
    const hinge = new THREE.Group();
    hinge.position.set(-W / 2, 0, 0.36);
    rig.add(hinge);
    const lidGeo = slab(W, H, 0.3, 0.2, 0.05);
    add(hinge, lidGeo, gloss(TEAL), W / 2, 0, 0);
    const lidLines = new THREE.LineSegments(track(new THREE.EdgesGeometry(lidGeo, 35)), edgeMat);
    lidLines.position.set(W / 2, 0, 0);
    hinge.add(lidLines);
    const ribMat = mat(TEAL_DEEP, 0.5, 0.2);
    for (let i = -2; i <= 2; i++) {
      add(hinge, slab(0.045, H * 0.8, 0.03, 0.02, 0.008), ribMat, W / 2 + i * 0.27, 0, 0.17);
    }
    add(hinge, slab(0.34, 0.08, 0.03, 0.03, 0.01), mat(PEARL, 0.3, 0.5), W / 2, 0.98, 0.17);
    // Inside of the lid: lining and a mesh pocket.
    add(hinge, slab(W * 0.9, H * 0.92, 0.03, 0.14, 0.01), mat(TEAL_DEEP, 0.9), W / 2, 0, -0.16);
    add(hinge, slab(W * 0.72, H * 0.5, 0.04, 0.08, 0.012), mat(0x103f45, 0.85), W / 2, -0.35, -0.19);
    add(hinge, slab(W * 0.72, 0.03, 0.05, 0.01, 0.006), strapMat, W / 2, -0.1, -0.2);
    const pin = track(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 16));
    [-0.75, 0.75].forEach((py) => add(hinge, pin, handleMat, 0, py, 0.02));

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
      request();
    };

    const TAU = Math.PI * 2;
    const smooth = (v: number) => v * v * (3 - 2 * v);
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

    // Interaction state: drag to turn the case (with inertia), tap to open or close the lid.
    let spin = 0; // extra yaw from dragging, radians
    let spinX = 0; // extra pitch from dragging, radians
    let vel = 0; // yaw velocity, radians per second
    let dragging = false;
    let pid = -1;
    let sx = 0;
    let sy = 0;
    let lx = 0;
    let ly = 0;
    let downAt = 0;
    let lastMoveAt = 0;
    let moved = false;
    let lastInteract = -1e9;
    let closedGoal = 0; // 1 = lid shut
    let closedAmt = 0;
    let closedScroll = 0;
    let idleTimer = 0;
    let raf = 0;
    let disposed = false;

    const setClosed = (goal: 0 | 1) => {
      closedGoal = goal;
      closedScroll = scrollProgressRef.current;
      setLidClosed(goal === 1);
      request();
    };
    toggleLidRef.current = () => {
      setTouched(true);
      setClosed(closedGoal === 1 ? 0 : 1);
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      moved = false;
      pid = e.pointerId;
      sx = lx = e.clientX;
      sy = ly = e.clientY;
      downAt = lastMoveAt = performance.now();
      vel = 0;
      window.clearTimeout(idleTimer);
      try {
        host.setPointerCapture(e.pointerId);
      } catch {
        /* capture is a nicety */
      }
      host.style.cursor = 'grabbing';
      request();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== pid) return;
      const now = performance.now();
      let dx = e.clientX - lx;
      let dy = e.clientY - ly;
      if (!moved) {
        if (Math.hypot(e.clientX - sx, e.clientY - sy) < 6) return;
        moved = true;
        setTouched(true);
        dx = e.clientX - sx;
        dy = e.clientY - sy;
      }
      spin += dx * 0.012;
      spinX = clamp(spinX + dy * 0.006, -0.5, 0.5);
      const dt = Math.max(0.001, (now - lastMoveAt) / 1000);
      vel += (dx * 0.012 / dt - vel) * 0.4;
      lastMoveAt = now;
      lastInteract = now;
      lx = e.clientX;
      ly = e.clientY;
      request();
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== pid) return;
      dragging = false;
      try {
        host.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      host.style.cursor = 'grab';
      const now = performance.now();
      lastInteract = now;
      if (!moved && e.type === 'pointerup' && now - downAt < 500) {
        toggleLidRef.current();
      }
      if (reduced || now - lastMoveAt > 80) vel = 0;
      vel = clamp(vel, -9, 9);
      if (reduced && moved) {
        // No inertia or easing for reduced motion: settle back to the front view after a pause.
        window.clearTimeout(idleTimer);
        idleTimer = window.setTimeout(() => {
          spin = Math.round(spin / TAU) * TAU;
          spinX = 0;
          request();
        }, 2500);
      }
      request();
    };
    host.style.cursor = 'grab';
    host.style.touchAction = 'pan-y';
    host.addEventListener('pointerdown', onDown);
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerup', onUp);
    host.addEventListener('pointercancel', onUp);

    const start = performance.now();
    let open = 0.3;
    let lastT = start;
    const frame = (now: number) => {
      raf = 0;
      if (disposed) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000));
      lastT = now;
      const t = reduced ? 2 : (now - start) / 1000;
      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;

      if (!dragging && !reduced) {
        // Inertia, then a gentle return to the front view once left alone.
        spin += vel * dt;
        vel *= Math.pow(0.03, dt);
        if (Math.abs(vel) < 0.03) vel = 0;
        if (vel === 0 && now - lastInteract > 2500) {
          const k = Math.min(1, dt * 2.5);
          spin += (Math.round(spin / TAU) * TAU - spin) * k;
          spinX += (0 - spinX) * k;
        }
      }

      // Scrolling away from where you shut the lid opens it again.
      if (closedGoal === 1 && Math.abs(scrollProgressRef.current - closedScroll) > 0.12) {
        closedGoal = 0;
        setLidClosed(false);
      }
      closedAmt += (closedGoal - closedAmt) * (reduced ? 1 : Math.min(1, dt * 6));
      if (Math.abs(closedGoal - closedAmt) < 0.002) closedAmt = closedGoal;
      const shut = smooth(closedAmt);

      // Rests half open on load; scrolling swings the lid wide.
      const breathe = reduced ? 0 : 0.03 * Math.sin(t * 0.8);
      const target = Math.min(1, 0.45 + 0.55 * scrollProgressRef.current + breathe);
      open += (target - open) * (reduced ? 1 : 0.07);

      const angle = THREE.MathUtils.degToRad(38 + 92 * smooth(open)) * (1 - shut);
      hinge.rotation.y = -angle;
      items.forEach((it) => {
        it.group.position.z = base + it.lift * smooth(open) * (1 - shut);
      });

      const follow = dragging ? 0.4 : 1;
      rig.rotation.y = 0.2 - scrollProgressRef.current * 0.3 + pointer.x * 0.22 * follow + spin;
      rig.rotation.x = 0.04 + pointer.y * 0.08 * follow + spinX;
      rig.position.y = reduced ? 0 : Math.sin(t * 0.7) * 0.035;

      renderer.render(scene, camera);
      if (!reduced) raf = requestAnimationFrame(frame);
    };
    function request() {
      if (disposed || raf) return;
      raf = requestAnimationFrame(frame);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    request();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(idleTimer);
      toggleLidRef.current = () => {};
      ro.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerup', onUp);
      host.removeEventListener('pointercancel', onUp);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [scrollProgressRef]);

  return (
    <div className={`relative ${className || 'w-full h-full'}`}>
      <div ref={hostRef} className="absolute inset-0 select-none" aria-hidden="true" />
      {ready && (
        <>
          <button
            type="button"
            onClick={() => toggleLidRef.current()}
            aria-pressed={lidClosed}
            className="absolute right-2 top-2 z-10 h-8 px-3.5 rounded-full border border-[#FBFAF8]/35 bg-[#0B3B40]/70 text-xs font-semibold text-[#FBFAF8] hover:bg-[#FBFAF8]/15 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FBFAF8]"
          >
            {lidClosed ? 'Open the case' : 'Close the case'}
          </button>
          <p
            aria-hidden="true"
            className={`pointer-events-none absolute left-2 top-3 z-10 text-xs font-medium text-[#FBFAF8]/70 transition-opacity duration-500 ${
              touched ? 'opacity-0' : 'opacity-100'
            }`}
          >
            Drag to turn it. Tap to open or close.
          </p>
        </>
      )}
    </div>
  );
};
