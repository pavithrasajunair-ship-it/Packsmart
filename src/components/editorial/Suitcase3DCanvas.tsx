import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

export type SuitcaseFinish = 'noir' | 'powder' | 'lavender' | 'peach';

export const SUITCASE_FINISHES: Record<
  SuitcaseFinish,
  { label: string; shellHex: string; frameHex: string; tagHex: string; rough: number; metal: number }
> = {
  noir: {
    label: 'Obsidian Matte',
    shellHex: '#0A0A0A',
    frameHex: '#FBFAF8',
    tagHex: '#E6DFD2',
    rough: 0.34,
    metal: 0.45,
  },
  powder: {
    label: 'Powder Blue',
    shellHex: '#BCD2CF',
    frameHex: '#0A0A0A',
    tagHex: '#0A0A0A',
    rough: 0.28,
    metal: 0.22,
  },
  lavender: {
    label: 'Soft Lavender',
    shellHex: '#D5DCD9',
    frameHex: '#0A0A0A',
    tagHex: '#0A0A0A',
    rough: 0.28,
    metal: 0.22,
  },
  peach: {
    label: 'Sunset Peach',
    shellHex: '#E6DFD2',
    frameHex: '#0A0A0A',
    tagHex: '#0A0A0A',
    rough: 0.3,
    metal: 0.2,
  },
};

interface Suitcase3DCanvasProps {
  finish: SuitcaseFinish;
  scrollProgressRef: React.MutableRefObject<number>;
  className?: string;
}

function createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
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

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 124);
    grad.addColorStop(0, 'rgba(16, 16, 16, 0.44)');
    grad.addColorStop(0.5, 'rgba(16, 16, 16, 0.18)');
    grad.addColorStop(1, 'rgba(16, 16, 16, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createLuggageTagTexture(bgHex: string, textHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, 256, 384);
    ctx.strokeStyle = textHex;
    ctx.lineWidth = 5;
    ctx.strokeRect(18, 18, 220, 348);

    ctx.fillStyle = textHex;
    ctx.beginPath();
    ctx.arc(128, 56, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '700 26px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PACKSMART', 128, 178);

    ctx.font = '500 16px "JetBrains Mono", monospace';
    ctx.fillText('40L · CARRY-ON', 128, 218);
    ctx.fillText('EDITION 01', 128, 248);

    ctx.fillRect(62, 290, 132, 3);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function detectSoftwareWebGL(): boolean {
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
}

export const Suitcase3DCanvas: React.FC<Suitcase3DCanvasProps> = ({
  finish,
  scrollProgressRef,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  // Refs for live material finish updates without recreating WebGL context
  const shellMatRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const frameMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const tagMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Sync finish changes live
  useEffect(() => {
    const spec = SUITCASE_FINISHES[finish];
    if (shellMatRef.current) {
      shellMatRef.current.color.set(spec.shellHex);
      shellMatRef.current.roughness = spec.rough;
      shellMatRef.current.metalness = spec.metal;
      shellMatRef.current.needsUpdate = true;
    }
    if (frameMatRef.current) {
      frameMatRef.current.color.set(spec.frameHex);
      frameMatRef.current.needsUpdate = true;
    }
    if (tagMatRef.current) {
      const oldMap = tagMatRef.current.map;
      const nextMap = createLuggageTagTexture(
        spec.tagHex,
        spec.tagHex === '#0A0A0A' ? '#FBFAF8' : '#0A0A0A'
      );
      if (rendererRef.current) {
        nextMap.anisotropy = rendererRef.current.capabilities.getMaxAnisotropy();
      }
      tagMatRef.current.map = nextMap;
      tagMatRef.current.needsUpdate = true;
      oldMap?.dispose();
    }
  }, [finish]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isSoftwareGl = detectSoftwareWebGL();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    rendererRef.current = renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);

    const width = Math.max(container.clientWidth, 300);
    const height = Math.max(container.clientHeight, 360);
    renderer.setSize(width, height);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // Studio RoomEnvironment IBL reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 40);
    camera.position.set(0, 1.48, 5.15);
    camera.lookAt(0, 1.24, 0);

    // 3-Point Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x101010, 0.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(3.8, 5.6, 4.4);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 16;
    const d = 2.6;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xd9c9f2, 1.35);
    rimLight.position.set(-4.0, 3.2, -3.5);
    scene.add(rimLight);

    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const softbox = new THREE.RectAreaLight(0xffffff, 2.2, 3.2, 4.0);
      softbox.position.set(-2.6, 2.2, 2.6);
      softbox.lookAt(0, 1.2, 0);
      scene.add(softbox);
    }

    // ==================== COMPOSITE 12-PART LUXURY 3D SUITCASE ====================
    const suitcaseRoot = new THREE.Group();
    scene.add(suitcaseRoot);

    const initSpec = SUITCASE_FINISHES[finish];

    // Materials (varied roughness & metalness >= 0.25 between adjacent parts)
    const shellMaterial = new THREE.MeshPhysicalMaterial({
      color: initSpec.shellHex,
      roughness: initSpec.rough,
      metalness: initSpec.metal,
      clearcoat: 0.72,
      clearcoatRoughness: 0.22,
      envMapIntensity: 1.15,
    });
    shellMatRef.current = shellMaterial;

    const frameMaterial = new THREE.MeshStandardMaterial({
      color: initSpec.frameHex,
      roughness: 0.16,
      metalness: 0.92,
      envMapIntensity: 1.3,
    });
    frameMatRef.current = frameMaterial;

    const brushedSteelMaterial = new THREE.MeshStandardMaterial({
      color: '#FBFAF8',
      roughness: 0.18,
      metalness: 0.94,
      envMapIntensity: 1.35,
    });

    const rubberMaterial = new THREE.MeshStandardMaterial({
      color: '#0A0A0A',
      roughness: 0.84,
      metalness: 0.05,
    });

    const gripMaterial = new THREE.MeshStandardMaterial({
      color: '#0A0A0A',
      roughness: 0.68,
      metalness: 0.1,
    });

    const tagTexture = createLuggageTagTexture(
      initSpec.tagHex,
      initSpec.tagHex === '#0A0A0A' ? '#FBFAF8' : '#0A0A0A'
    );
    tagTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const tagMaterial = new THREE.MeshStandardMaterial({
      map: tagTexture,
      roughness: 0.62,
      metalness: 0.04,
    });
    tagMatRef.current = tagMaterial;

    const bodyWidth = 1.36;
    const bodyHeight = 1.94;
    const bodyDepth = 0.68;
    const wheelHeight = 0.21;
    const bodyCenterY = wheelHeight + bodyHeight / 2;

    const geometriesToDispose: THREE.BufferGeometry[] = [];
    const registerGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      geometriesToDispose.push(g);
      return g;
    };

    // Part 1: Sculpted Beveled Shell Body (ExtrudeGeometry)
    const shellShape = createRoundedRectShape(bodyWidth, bodyHeight, 0.16);
    const shellGeo = registerGeo(
      new THREE.ExtrudeGeometry(shellShape, {
        depth: bodyDepth,
        bevelEnabled: true,
        bevelSegments: 6,
        steps: 1,
        bevelSize: 0.055,
        bevelThickness: 0.055,
        curveSegments: 16,
      })
    );
    shellGeo.center();
    const shellMesh = new THREE.Mesh(shellGeo, shellMaterial);
    shellMesh.position.y = bodyCenterY;
    shellMesh.castShadow = true;
    shellMesh.receiveShadow = true;
    suitcaseRoot.add(shellMesh);

    // Part 2: Architectural Vertical Grooves / Ribs (front & back luxury aluminum styling)
    const ribCount = 7;
    const ribGeo = registerGeo(new THREE.CapsuleGeometry(0.018, bodyHeight - 0.34, 4, 8));
    for (let i = 0; i < ribCount; i++) {
      const x = -0.48 + (i * 0.96) / (ribCount - 1);
      const frontRib = new THREE.Mesh(ribGeo, shellMaterial);
      frontRib.position.set(x, bodyCenterY, bodyDepth / 2 + 0.05);
      frontRib.scale.set(1.1, 1, 0.55);
      frontRib.castShadow = true;
      suitcaseRoot.add(frontRib);

      const backRib = new THREE.Mesh(ribGeo, shellMaterial);
      backRib.position.set(x, bodyCenterY, -(bodyDepth / 2 + 0.05));
      backRib.scale.set(1.1, 1, 0.55);
      backRib.castShadow = true;
      suitcaseRoot.add(backRib);
    }

    // Part 3: Anodized Aluminum Center Frame Seal Ring
    const frameShape = createRoundedRectShape(bodyWidth + 0.135, bodyHeight + 0.135, 0.21);
    const holePath = createRoundedRectShape(bodyWidth + 0.05, bodyHeight + 0.05, 0.17);
    frameShape.holes.push(holePath);
    const frameGeo = registerGeo(
      new THREE.ExtrudeGeometry(frameShape, {
        depth: 0.08,
        bevelEnabled: true,
        bevelSize: 0.01,
        bevelThickness: 0.01,
        bevelSegments: 3,
      })
    );
    frameGeo.center();
    const frameMesh = new THREE.Mesh(frameGeo, frameMaterial);
    frameMesh.position.y = bodyCenterY;
    frameMesh.castShadow = true;
    suitcaseRoot.add(frameMesh);

    // Part 4: Four Metallic Corner Bumper Guards
    const cornerGeo = registerGeo(new THREE.BoxGeometry(0.24, 0.24, bodyDepth + 0.145));
    const cornerOffsets: Array<[number, number]> = [
      [-bodyWidth / 2 + 0.02, bodyCenterY + bodyHeight / 2 - 0.02],
      [bodyWidth / 2 - 0.02, bodyCenterY + bodyHeight / 2 - 0.02],
      [-bodyWidth / 2 + 0.02, bodyCenterY - bodyHeight / 2 + 0.02],
      [bodyWidth / 2 - 0.02, bodyCenterY - bodyHeight / 2 + 0.02],
    ];
    cornerOffsets.forEach(([cx, cy]) => {
      const cap = new THREE.Mesh(cornerGeo, frameMaterial);
      cap.position.set(cx, cy, 0);
      cap.scale.set(0.95, 0.95, 0.96);
      cap.castShadow = true;
      suitcaseRoot.add(cap);
    });

    // Part 5: Dual Side Recessed TSA Locks
    const lockPlateGeo = registerGeo(new THREE.BoxGeometry(0.055, 0.24, 0.14));
    const lockLatchGeo = registerGeo(new THREE.BoxGeometry(0.072, 0.08, 0.065));
    [bodyCenterY + 0.45, bodyCenterY - 0.45].forEach((ly) => {
      const plate = new THREE.Mesh(lockPlateGeo, frameMaterial);
      plate.position.set(bodyWidth / 2 + 0.068, ly, 0);
      suitcaseRoot.add(plate);

      const latch = new THREE.Mesh(lockLatchGeo, gripMaterial);
      latch.position.set(bodyWidth / 2 + 0.072, ly, 0);
      suitcaseRoot.add(latch);
    });

    // Part 6: Side Carry Handle
    const sideHandleMountGeo = registerGeo(new THREE.BoxGeometry(0.07, 0.09, 0.08));
    const sideHandleBarGeo = registerGeo(new THREE.CapsuleGeometry(0.028, 0.34, 4, 10));
    [-0.19, 0.19].forEach((dy) => {
      const m = new THREE.Mesh(sideHandleMountGeo, frameMaterial);
      m.position.set(bodyWidth / 2 + 0.065, bodyCenterY + dy, 0);
      suitcaseRoot.add(m);
    });
    const sideBar = new THREE.Mesh(sideHandleBarGeo, gripMaterial);
    sideBar.position.set(bodyWidth / 2 + 0.115, bodyCenterY, 0);
    suitcaseRoot.add(sideBar);

    // Part 7: Top Carry Handle
    const topMountGeo = registerGeo(new THREE.BoxGeometry(0.08, 0.07, 0.08));
    const topBarGeo = registerGeo(new THREE.CapsuleGeometry(0.028, 0.38, 4, 10));
    topBarGeo.rotateZ(Math.PI / 2);
    [-0.21, 0.21].forEach((dx) => {
      const m = new THREE.Mesh(topMountGeo, frameMaterial);
      m.position.set(dx, bodyCenterY + bodyHeight / 2 + 0.068, 0.04);
      suitcaseRoot.add(m);
    });
    const topBar = new THREE.Mesh(topBarGeo, gripMaterial);
    topBar.position.set(0, bodyCenterY + bodyHeight / 2 + 0.115, 0.04);
    suitcaseRoot.add(topBar);

    // Part 8: Telescoping Twin-Rod Pull Handle Group (animated smoothly with scroll!)
    const handleGroup = new THREE.Group();
    const rodGeo = registerGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.92, 16));
    const leftRod = new THREE.Mesh(rodGeo, brushedSteelMaterial);
    leftRod.position.set(-0.24, bodyCenterY + bodyHeight / 2 + 0.34, -0.14);
    const rightRod = new THREE.Mesh(rodGeo, brushedSteelMaterial);
    rightRod.position.set(0.24, bodyCenterY + bodyHeight / 2 + 0.34, -0.14);
    handleGroup.add(leftRod, rightRod);

    const crossbarGeo = registerGeo(new THREE.CapsuleGeometry(0.036, 0.52, 6, 12));
    crossbarGeo.rotateZ(Math.PI / 2);
    const crossbar = new THREE.Mesh(crossbarGeo, gripMaterial);
    crossbar.position.set(0, bodyCenterY + bodyHeight / 2 + 0.8, -0.14);
    crossbar.castShadow = true;
    handleGroup.add(crossbar);

    const buttonGeo = registerGeo(new THREE.BoxGeometry(0.14, 0.024, 0.036));
    const releaseBtn = new THREE.Mesh(buttonGeo, brushedSteelMaterial);
    releaseBtn.position.set(0, bodyCenterY + bodyHeight / 2 + 0.835, -0.14);
    handleGroup.add(releaseBtn);
    suitcaseRoot.add(handleGroup);

    // Part 9: Hinged Leather Luggage Tag with Procedural PackSmart CanvasTexture
    const tagPivot = new THREE.Group();
    tagPivot.position.set(0.32, bodyCenterY + bodyHeight / 2 + 0.08, 0.09);
    const strapGeo = registerGeo(new THREE.TorusGeometry(0.055, 0.012, 8, 18));
    const strap = new THREE.Mesh(strapGeo, gripMaterial);
    strap.rotation.y = Math.PI / 2;
    tagPivot.add(strap);

    const tagCardGeo = registerGeo(new THREE.BoxGeometry(0.21, 0.31, 0.02));
    const tagCard = new THREE.Mesh(tagCardGeo, tagMaterial);
    tagCard.position.set(0, -0.19, 0.04);
    tagCard.rotation.x = -0.18;
    tagCard.rotation.z = 0.08;
    tagCard.castShadow = true;
    tagPivot.add(tagCard);
    suitcaseRoot.add(tagPivot);

    // Part 10: Four Articulated 360° Dual-Spinner Caster Wheels resting flush on y = 0
    const wheelHousingGeo = registerGeo(new THREE.CylinderGeometry(0.068, 0.058, 0.11, 14));
    const tireGeo = registerGeo(new THREE.CylinderGeometry(0.072, 0.072, 0.034, 18));
    tireGeo.rotateZ(Math.PI / 2);
    const hubGeo = registerGeo(new THREE.CylinderGeometry(0.036, 0.036, 0.038, 14));
    hubGeo.rotateZ(Math.PI / 2);

    const wheelCoords: Array<[number, number]> = [
      [-bodyWidth / 2 + 0.2, bodyDepth / 2 - 0.14],
      [bodyWidth / 2 - 0.2, bodyDepth / 2 - 0.14],
      [-bodyWidth / 2 + 0.2, -bodyDepth / 2 + 0.14],
      [bodyWidth / 2 - 0.2, -bodyDepth / 2 + 0.14],
    ];
    wheelCoords.forEach(([wx, wz]) => {
      const caster = new THREE.Group();
      caster.position.set(wx, 0, wz);

      const housing = new THREE.Mesh(wheelHousingGeo, gripMaterial);
      housing.position.y = 0.155;
      caster.add(housing);

      [-0.034, 0.034].forEach((offsetX) => {
        const tire = new THREE.Mesh(tireGeo, rubberMaterial);
        tire.position.set(offsetX, 0.072, 0);
        tire.castShadow = true;
        caster.add(tire);

        const hub = new THREE.Mesh(hubGeo, brushedSteelMaterial);
        hub.position.set(offsetX, 0.072, 0);
        caster.add(hub);
      });

      suitcaseRoot.add(caster);
    });

    // Part 11: Front Embossed Brand Plaque
    const plaqueGeo = registerGeo(new THREE.BoxGeometry(0.32, 0.075, 0.022));
    const plaque = new THREE.Mesh(plaqueGeo, frameMaterial);
    plaque.position.set(0, bodyCenterY + 0.54, bodyDepth / 2 + 0.056);
    suitcaseRoot.add(plaque);

    // Part 12: Grounded Contact Shadow Plane (flush at y = 0.002)
    const contactShadowTex = createContactShadowTexture();
    const shadowPlaneGeo = registerGeo(new THREE.PlaneGeometry(3.2, 2.3));
    shadowPlaneGeo.rotateX(-Math.PI / 2);
    const shadowPlaneMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.72,
    });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.position.y = 0.002;
    scene.add(shadowPlane);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Interaction state (module/closure scalars — zero GC in loop)
    let pointerX = 0;
    let pointerY = 0;
    let curRotY = -0.42;
    let curRotX = 0.06;
    let curHandleY = -0.26;
    let curFloatY = 0;
    let contextLost = false;
    let frameId = 0;
    let isDisposed = false;

    const onPointerMove = (e: PointerEvent) => {
      if (reducedMotion) return;
      const nx = (e.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
      const ny = (e.clientY / Math.max(window.innerHeight, 1)) * 2 - 1;
      pointerX = THREE.MathUtils.clamp(nx, -1, 1);
      pointerY = THREE.MathUtils.clamp(ny, -1, 1);
    };

    const onResize = () => {
      if (!container || isDisposed) return;
      const w = Math.max(container.clientWidth, 280);
      const h = Math.max(container.clientHeight, 320);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const onContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
    };
    const onContextRestored = () => {
      contextLost = false;
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      if (isDisposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (isDisposed) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (status === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 6);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 6);
      } else {
        frameId = window.setTimeout(cb, 85);
      }
    }

    function tick() {
      if (isDisposed) return;
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      if (!contextLost) {
        const scrollP = THREE.MathUtils.clamp(scrollProgressRef.current || 0, 0, 1);
        const idleSpin = reducedMotion ? 0 : Math.sin(elapsed * 0.45) * 0.14;
        const targetRotY = -0.45 + scrollP * Math.PI * 1.65 + pointerX * 0.32 + idleSpin;
        const targetRotX = 0.05 + pointerY * 0.12 - scrollP * 0.08;
        const targetHandleY = THREE.MathUtils.lerp(-0.28, 0.16, Math.min(1, scrollP * 1.8));
        const targetFloatY = reducedMotion ? 0 : Math.sin(elapsed * 1.15) * 0.035;

        curRotY = THREE.MathUtils.damp(curRotY, targetRotY, 5.2, delta);
        curRotX = THREE.MathUtils.damp(curRotX, targetRotX, 5.2, delta);
        curHandleY = THREE.MathUtils.damp(curHandleY, targetHandleY, 6.0, delta);
        curFloatY = THREE.MathUtils.damp(curFloatY, targetFloatY, 4.0, delta);

        suitcaseRoot.rotation.y = curRotY;
        suitcaseRoot.rotation.x = curRotX;
        suitcaseRoot.position.y = curFloatY;
        handleGroup.position.y = curHandleY;
        tagPivot.rotation.z = reducedMotion ? 0.04 : Math.sin(elapsed * 1.6) * 0.07;

        renderer.render(scene, camera);
      }

      if (reducedMotion) return; // Render crisp initial frame only when reduced motion requested
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      geometriesToDispose.forEach((g) => g.dispose());
      shellMaterial.dispose();
      frameMaterial.dispose();
      brushedSteelMaterial.dispose();
      rubberMaterial.dispose();
      gripMaterial.dispose();
      tagMaterial.dispose();
      tagTexture.dispose();
      shadowPlaneMat.dispose();
      contactShadowTex.dispose();
      envRT.dispose();

      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      shellMatRef.current = null;
      frameMatRef.current = null;
      tagMatRef.current = null;
      rendererRef.current = null;
    };
  }, []);

  if (webglUnavailable) {
    const spec = SUITCASE_FINISHES[finish];
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <svg
          viewBox="0 0 280 380"
          className="w-full max-w-[280px] h-auto drop-shadow-2xl"
          role="img"
          aria-label={`PackSmart ${spec.label} carry-on suitcase`}
        >
          <rect x="98" y="24" width="12" height="72" rx="4" fill="#0A0A0A" />
          <rect x="170" y="24" width="12" height="72" rx="4" fill="#0A0A0A" />
          <rect x="88" y="18" width="104" height="18" rx="9" fill="#0A0A0A" />
          <rect
            x="48"
            y="84"
            width="184"
            height="248"
            rx="24"
            fill={spec.shellHex}
            stroke="#0A0A0A"
            strokeWidth="4"
          />
          {[78, 102, 126, 150, 174, 198].map((rx) => (
            <line
              key={rx}
              x1={rx}
              y1="108"
              x2={rx}
              y2="308"
              stroke={spec.shellHex === '#0A0A0A' ? 'rgba(255,255,255,0.16)' : 'rgba(16,16,16,0.16)'}
              strokeWidth="3"
              strokeLinecap="round"
            />
          ))}
          <rect x="108" y="128" width="64" height="16" rx="2" fill={spec.frameHex} />
          <circle cx="82" cy="346" r="14" fill="#0A0A0A" />
          <circle cx="198" cy="346" r="14" fill="#0A0A0A" />
        </svg>
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      data-cursor="3D"
      className={`w-full h-full select-none ${className}`}
      aria-label="Interactive 3D PackSmart Carry-On Suitcase"
    />
  );
};
