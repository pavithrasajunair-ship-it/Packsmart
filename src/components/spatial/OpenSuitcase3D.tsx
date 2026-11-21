import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { PackingItem } from '../../types';
import { prefersReducedMotion } from '../editorial/MotionPrimitives';

export type SuitcaseCameraView = 'editorial' | 'flatlay' | 'low';

interface OpenSuitcase3DProps {
  items: PackingItem[];
  highlightedItemId?: string | null;
  cameraView: SuitcaseCameraView;
  onToggleItem?: (itemId: string) => void;
  className?: string;
}

interface AnimatedItemEntry {
  id: string;
  mesh: THREE.Group;
  packed: boolean;
  progress: number; // 0 = floating outside, 1 = seated inside suitcase
  slotPos: THREE.Vector3;
  floatPos: THREE.Vector3;
  baseColor: number;
}

const _vecTarget = new THREE.Vector3();

function createRoundedRect(width: number, height: number, radius: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  s.moveTo(x + radius, y);
  s.lineTo(x + width - radius, y);
  s.quadraticCurveTo(x + width, y, x + width, y + radius);
  s.lineTo(x + width, y + height - radius);
  s.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  s.lineTo(x + radius, y + height);
  s.quadraticCurveTo(x, y + height, x, y + height - radius);
  s.lineTo(x, y + radius);
  s.quadraticCurveTo(x, y, x + radius, y);
  return s;
}

function createCategoryColorHex(category: string, index: number): number {
  const palette = [0xb8d9f2, 0xd9c9f2, 0xffc5a8, 0xffffff, 0x262626];
  if (category === 'Clothing') return index % 2 === 0 ? 0xd9c9f2 : 0xffffff;
  if (category === 'Footwear') return 0x101010;
  if (category === 'Electronics') return 0xb8d9f2;
  if (category === 'Documents') return 0xffc5a8;
  if (category === 'Toiletries') return 0xffffff;
  if (category === 'Accessories') return 0xffc5a8;
  return palette[index % palette.length];
}

function buildItemMesh(item: PackingItem, index: number): { group: THREE.Group; colorHex: number } {
  const g = new THREE.Group();
  const colorHex = createCategoryColorHex(item.category, index);
  const mainMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: item.category === 'Electronics' ? 0.25 : 0.68,
    metalness: item.category === 'Electronics' ? 0.72 : 0.05,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: colorHex === 0x101010 ? 0xffc5a8 : 0x101010,
    roughness: 0.4,
    metalness: 0.25,
  });

  if (item.category === 'Clothing') {
    // Sculpted Folded Garment Block with Ribbon Strap
    const shape = createRoundedRect(0.56, 0.42, 0.07);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.12,
      bevelEnabled: true,
      bevelSize: 0.024,
      bevelThickness: 0.024,
      bevelSegments: 2,
    });
    geo.rotateX(Math.PI / 2);
    geo.center();
    const cloth = new THREE.Mesh(geo, mainMat);
    g.add(cloth);

    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.175, 0.44), trimMat);
    g.add(strap);
  } else if (item.category === 'Footwear') {
    // Pair of Minimalist Shoes
    [-0.12, 0.12].forEach((offsetX) => {
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.46), mainMat);
      shoe.position.set(offsetX, 0, 0);
      g.add(shoe);
      const sole = new THREE.Mesh(
        new THREE.BoxGeometry(0.19, 0.035, 0.47),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 })
      );
      sole.position.set(offsetX, -0.07, 0);
      g.add(sole);
    });
  } else if (item.category === 'Electronics') {
    // Sleek Tech Case / Laptop Slab
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.075, 0.36), mainMat);
    g.add(slab);
    const detail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.082, 0.04), trimMat);
    detail.position.set(0, 0, 0.12);
    g.add(detail);
  } else if (item.category === 'Toiletries') {
    // Minimalist Travel Grooming Pouch + Bottle
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.28), mainMat);
    g.add(pouch);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.18, 14), trimMat);
    cap.position.set(0.24, 0, 0);
    g.add(cap);
  } else if (item.category === 'Documents') {
    // Passport Folio
    const folio = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.44), mainMat);
    g.add(folio);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.058, 0.06), trimMat);
    band.position.z = 0.08;
    g.add(band);
  } else {
    // Accessory Cube / Sunglasses Case
    const caseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.13, 0.24), mainMat);
    g.add(caseMesh);
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.25), trimMat);
    g.add(clasp);
  }

  g.userData.itemId = item.id;
  g.traverse((c) => {
    c.userData.itemId = item.id;
  });

  return { group: g, colorHex };
}

function computeSlotPosition(item: PackingItem, index: number): THREE.Vector3 {
  // Left shell (x in [-1.55, -0.25]): Clothing & Dresses
  // Right shell (x in [0.25, 1.55]): Footwear, Electronics, Toiletries, Documents, Accessories
  const isLeft = item.category === 'Clothing';
  const sideIdx = index % 6;
  const col = sideIdx % 2;
  const row = Math.floor(sideIdx / 2);
  const stackLevel = Math.floor(index / 6);

  const xBase = isLeft ? -1.16 : 0.64;
  const x = xBase + col * 0.58;
  const z = -0.68 + row * 0.66;
  const y = 0.21 + stackLevel * 0.18;
  return new THREE.Vector3(x, y, z);
}

function computeFloatPosition(index: number): THREE.Vector3 {
  const cols = 4;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const x = -1.65 + col * 1.1;
  const y = 1.48 + (row % 2) * 0.36;
  const z = -1.1 + row * 0.62;
  return new THREE.Vector3(x, y, z);
}

export const OpenSuitcase3D: React.FC<OpenSuitcase3DProps> = ({
  items,
  highlightedItemId,
  cameraView,
  onToggleItem,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  const itemsRef = useRef<PackingItem[]>(items);
  const highlightRef = useRef<string | null | undefined>(highlightedItemId);
  const viewRef = useRef<SuitcaseCameraView>(cameraView);
  const onToggleRef = useRef(onToggleItem);

  itemsRef.current = items;
  highlightRef.current = highlightedItemId;
  viewRef.current = cameraView;
  onToggleRef.current = onToggleItem;

  const syncItemsFnRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    syncItemsFnRef.current?.();
  }, [items]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas');
        const gl = probe.getContext('webgl2') || probe.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param) || '');
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const w0 = Math.max(300, container.clientWidth);
    const h0 = Math.max(300, container.clientHeight);
    renderer.setSize(w0, h0);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, w0 / h0, 0.1, 50);
    camera.position.set(0, 4.4, 4.3);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmrem.dispose();

    const hemi = new THREE.HemisphereLight(0xb8d9f2, 0xd9c9f2, 1.0);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 1.75);
    key.position.set(3.5, 6.5, 4.2);
    if (!isSoftwareGl) {
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.bias = -0.0005;
      key.shadow.normalBias = 0.02;
    }
    scene.add(key);

    const rimPeach = new THREE.DirectionalLight(0xffc5a8, 1.15);
    rimPeach.position.set(-4.5, 3.0, -3.5);
    scene.add(rimPeach);

    // ==================== OPEN CLAMSHELL LUXURY SUITCASE ====================
    const suitcaseGroup = new THREE.Group();
    scene.add(suitcaseGroup);

    const outerMat = new THREE.MeshPhysicalMaterial({
      color: 0x101010,
      roughness: 0.24,
      metalness: 0.18,
      clearcoat: 0.65,
    });
    const innerLiningMat = new THREE.MeshStandardMaterial({
      color: 0xd9c9f2,
      roughness: 0.85,
      metalness: 0.02,
    });
    const rightLiningMat = new THREE.MeshStandardMaterial({
      color: 0xb8d9f2,
      roughness: 0.85,
      metalness: 0.02,
    });
    const frameAlumMat = new THREE.MeshStandardMaterial({
      color: 0xb8d9f2,
      roughness: 0.24,
      metalness: 0.82,
    });
    const strapPeachMat = new THREE.MeshStandardMaterial({
      color: 0xffc5a8,
      roughness: 0.55,
      metalness: 0.08,
    });

    const buildOpenShell = (side: -1 | 1, lining: THREE.Material) => {
      const shell = new THREE.Group();
      const shellW = 1.66;
      const shellD = 2.34;
      const wallH = 0.34;
      const wallT = 0.09;

      // Floor slab
      const floor = new THREE.Mesh(new THREE.BoxGeometry(shellW, 0.08, shellD), outerMat);
      floor.position.y = 0.04;
      floor.receiveShadow = !isSoftwareGl;
      shell.add(floor);

      // Soft interior fabric floor
      const liner = new THREE.Mesh(
        new THREE.BoxGeometry(shellW - wallT * 2.1, 0.02, shellD - wallT * 2.1),
        lining
      );
      liner.position.y = 0.092;
      liner.receiveShadow = !isSoftwareGl;
      shell.add(liner);

      // Four outer walls
      const longWallGeo = new THREE.BoxGeometry(wallT, wallH, shellD);
      const shortWallGeo = new THREE.BoxGeometry(shellW, wallH, wallT);

      const leftW = new THREE.Mesh(longWallGeo, outerMat);
      leftW.position.set(-shellW / 2 + wallT / 2, wallH / 2 + 0.04, 0);
      shell.add(leftW);

      const rightW = new THREE.Mesh(longWallGeo, outerMat);
      rightW.position.set(shellW / 2 - wallT / 2, wallH / 2 + 0.04, 0);
      shell.add(rightW);

      const frontW = new THREE.Mesh(shortWallGeo, outerMat);
      frontW.position.set(0, wallH / 2 + 0.04, shellD / 2 - wallT / 2);
      shell.add(frontW);

      const backW = new THREE.Mesh(shortWallGeo, outerMat);
      backW.position.set(0, wallH / 2 + 0.04, -shellD / 2 + wallT / 2);
      shell.add(backW);

      // Brushed Aluminum Rim Lip
      const rimFront = new THREE.Mesh(new THREE.BoxGeometry(shellW + 0.03, 0.035, 0.04), frameAlumMat);
      rimFront.position.set(0, wallH + 0.05, shellD / 2 - 0.03);
      shell.add(rimFront);

      const rimBack = new THREE.Mesh(new THREE.BoxGeometry(shellW + 0.03, 0.035, 0.04), frameAlumMat);
      rimBack.position.set(0, wallH + 0.05, -shellD / 2 + 0.03);
      shell.add(rimBack);

      const rimOuter = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, shellD + 0.03), frameAlumMat);
      rimOuter.position.set(side * (shellW / 2 - 0.03), wallH + 0.05, 0);
      shell.add(rimOuter);

      // Compression Cross Straps on Left Compartment
      if (side === -1) {
        const strapA = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.014, 0.075), strapPeachMat);
        strapA.position.set(0, 0.11, 0);
        strapA.rotation.y = 0.68;
        shell.add(strapA);

        const strapB = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.014, 0.075), strapPeachMat);
        strapB.position.set(0, 0.115, 0);
        strapB.rotation.y = -0.68;
        shell.add(strapB);

        const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.18), outerMat);
        buckle.position.set(0, 0.125, 0);
        shell.add(buckle);
      } else {
        // Right side subtle organizational divider grid bars
        const divH = new THREE.Mesh(new THREE.BoxGeometry(shellW - 0.24, 0.04, 0.025), outerMat);
        divH.position.set(0, 0.11, -0.34);
        shell.add(divH);
        const divH2 = new THREE.Mesh(new THREE.BoxGeometry(shellW - 0.24, 0.04, 0.025), outerMat);
        divH2.position.set(0, 0.11, 0.34);
        shell.add(divH2);
      }

      // External Side Carry Handle
      const sideHandle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.56), outerMat);
      sideHandle.position.set(side * (shellW / 2 + 0.09), 0.22, 0);
      shell.add(sideHandle);

      shell.position.x = side * (shellW / 2 + 0.07);
      return shell;
    };

    suitcaseGroup.add(buildOpenShell(-1, innerLiningMat));
    suitcaseGroup.add(buildOpenShell(1, rightLiningMat));

    // Central Aluminum Spine Hinge
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 2.26), frameAlumMat);
    spine.position.set(0, 0.09, 0);
    suitcaseGroup.add(spine);

    // Subtle Ground Pedestal Shadow
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 0.08, 3.1),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
        metalness: 0.02,
      })
    );
    plinth.position.y = -0.045;
    plinth.receiveShadow = !isSoftwareGl;
    suitcaseGroup.add(plinth);

    // ==================== DYNAMIC 3D PACKING ITEMS ====================
    const itemsLayer = new THREE.Group();
    suitcaseGroup.add(itemsLayer);
    const entryMap = new Map<string, AnimatedItemEntry>();

    const syncItems = () => {
      const current = itemsRef.current.slice(0, 18); // render up to 18 visible 3D pieces cleanly
      const activeIds = new Set(current.map((i) => i.id));

      // Remove deleted items
      for (const [id, entry] of entryMap.entries()) {
        if (!activeIds.has(id)) {
          itemsLayer.remove(entry.mesh);
          entry.mesh.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const m = child as THREE.Mesh;
              m.geometry?.dispose();
              const mats = Array.isArray(m.material) ? m.material : [m.material];
              mats.forEach((mat) => mat?.dispose());
            }
          });
          entryMap.delete(id);
        }
      }

      // Add or update items
      let leftCount = 0;
      let rightCount = 0;
      current.forEach((item, idx) => {
        const sideIdx = item.category === 'Clothing' ? leftCount++ : rightCount++;
        const existing = entryMap.get(item.id);
        const slotPos = computeSlotPosition(item, sideIdx);
        const floatPos = computeFloatPosition(idx);

        if (existing) {
          existing.packed = item.packed;
          existing.slotPos.copy(slotPos);
          existing.floatPos.copy(floatPos);
        } else {
          const { group, colorHex } = buildItemMesh(item, idx);
          const initProg = item.packed ? 1 : 0;
          group.position.copy(initProg === 1 ? slotPos : floatPos);
          itemsLayer.add(group);
          entryMap.set(item.id, {
            id: item.id,
            mesh: group,
            packed: item.packed,
            progress: initProg,
            slotPos,
            floatPos,
            baseColor: colorHex,
          });
        }
      });
    };

    syncItemsFnRef.current = syncItems;
    syncItems();

    // Pointer drag orbit + click raycast to pack/unpack directly in 3D
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragMoved = false;
    let userYaw = 0;
    let userPitch = 0;

    const raycaster = new THREE.Raycaster();
    const mouseNdc = new THREE.Vector2();

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      dragMoved = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMoved = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      userYaw = THREE.MathUtils.clamp(userYaw + dx * 0.008, -0.9, 0.9);
      userPitch = THREE.MathUtils.clamp(userPitch + dy * 0.005, -0.25, 0.35);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;
      if (!dragMoved && onToggleRef.current) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouseNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouseNdc, camera);
        const hits = raycaster.intersectObjects(itemsLayer.children, true);
        if (hits.length > 0) {
          const itemId = hits[0].object.userData.itemId as string | undefined;
          if (itemId) onToggleRef.current(itemId);
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    const onResize = () => {
      const w = Math.max(300, container.clientWidth);
      const h = Math.max(300, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    let contextLost = false;
    const onLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
    };
    const onRestored = () => {
      contextLost = false;
    };
    renderer.domElement.addEventListener('webglcontextlost', onLost);
    renderer.domElement.addEventListener('webglcontextrestored', onRestored);

    if (!isSoftwareGl) renderer.compile(scene, camera);

    const reduced = prefersReducedMotion();
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      // Camera view presets with exponential damping
      const view = viewRef.current;
      const narrow = container.clientWidth < 560;
      const distMul = narrow ? 1.28 : 1.0;

      if (view === 'flatlay') {
        _vecTarget.set(0, 6.2 * distMul, 0.75 * distMul);
      } else if (view === 'low') {
        _vecTarget.set(1.2 * distMul, 2.55 * distMul, 4.9 * distMul);
      } else {
        _vecTarget.set(0.35 * distMul, 4.35 * distMul, 4.35 * distMul);
      }

      camera.position.lerp(_vecTarget, 1 - Math.exp(-4.5 * dt));
      camera.lookAt(0, 0.35, 0);

      suitcaseGroup.rotation.y = THREE.MathUtils.damp(suitcaseGroup.rotation.y, userYaw, 6, dt);
      suitcaseGroup.rotation.x = THREE.MathUtils.damp(suitcaseGroup.rotation.x, userPitch, 6, dt);

      // Animate every item smoothly along a parabolic arc between floating tray and suitcase slot
      let idx = 0;
      for (const entry of entryMap.values()) {
        const targetP = entry.packed ? 1 : 0;
        entry.progress = reduced
          ? targetP
          : THREE.MathUtils.damp(entry.progress, targetP, 5.8, dt);

        const p = entry.progress;
        const arcLift = Math.sin(p * Math.PI) * 1.15;
        const floatBob = !entry.packed && !reduced ? Math.sin(t * 1.9 + idx * 0.8) * 0.07 : 0;

        entry.mesh.position.lerpVectors(entry.floatPos, entry.slotPos, p);
        entry.mesh.position.y += arcLift + floatBob;

        const isHighlighted = highlightRef.current === entry.id;
        const targetScale = isHighlighted ? 1.18 : 1.0;
        const s = THREE.MathUtils.damp(entry.mesh.scale.x, targetScale, 8, dt);
        entry.mesh.scale.setScalar(s);

        // Rotate unpacked items playfully while floating; align cleanly inside suitcase
        const targetRotY = entry.packed ? 0 : Math.sin(t * 0.9 + idx) * 0.35;
        const targetRotZ = entry.packed ? 0 : Math.cos(t * 1.1 + idx) * 0.14;
        entry.mesh.rotation.y = THREE.MathUtils.damp(entry.mesh.rotation.y, targetRotY, 6, dt);
        entry.mesh.rotation.z = THREE.MathUtils.damp(entry.mesh.rotation.z, targetRotZ, 6, dt);

        idx++;
      }

      if (!contextLost) {
        renderer.render(scene, camera);
      }

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onRestored);

      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((mat) => mat?.dispose());
        }
      });
      envRT.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  if (webglFailed) {
    const packedCount = items.filter((i) => i.packed).length;
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center bg-[#B8D9F2]/40 p-6 ${className}`}>
        <div className="w-full max-w-md border-2 border-[#101010] bg-[#FFFFFF] p-5 grid grid-cols-2 gap-4">
          <div className="bg-[#D9C9F2] p-4 min-h-[160px] flex flex-col justify-between">
            <span className="font-mono text-[11px] text-[#101010]/70">LEFT SHELL · APPAREL</span>
            <p className="font-editorial text-2xl">{packedCount} packed</p>
          </div>
          <div className="bg-[#B8D9F2] p-4 min-h-[160px] flex flex-col justify-between">
            <span className="font-mono text-[11px] text-[#101010]/70">RIGHT SHELL · GEAR</span>
            <p className="font-editorial text-2xl">{items.length - packedCount} remaining</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      className={`w-full h-full cursor-grab active:cursor-grabbing select-none ${className}`}
      aria-label="Interactive 3D open suitcase visualizer — click items to pack or unpack"
    />
  );
};
