import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { prefersReducedMotion } from '../editorial/MotionPrimitives';

export type SpatialDestinationId =
  | 'smart-packing'
  | 'ai-outfit-studio'
  | 'trip-planner'
  | 'digital-wardrobe';

export type SpatialSuitcaseFinish = 'noir' | 'powder' | 'lavender' | 'peach';

export const SPATIAL_FINISHES: Record<
  SpatialSuitcaseFinish,
  { label: string; shellHex: string; frameHex: string; tagHex: string }
> = {
  noir: {
    label: 'Obsidian',
    shellHex: '#0A0A0A',
    frameHex: '#BCD2CF',
    tagHex: '#E6DFD2',
  },
  powder: {
    label: 'Powder Blue',
    shellHex: '#BCD2CF',
    frameHex: '#0A0A0A',
    tagHex: '#E6DFD2',
  },
  lavender: {
    label: 'Lavender',
    shellHex: '#D5DCD9',
    frameHex: '#0A0A0A',
    tagHex: '#E6DFD2',
  },
  peach: {
    label: 'Sunset Peach',
    shellHex: '#E6DFD2',
    frameHex: '#0A0A0A',
    tagHex: '#D5DCD9',
  },
};

interface SpatialWorld3DProps {
  mode: 'hero' | 'hub' | 'zooming';
  hoveredDestination: SpatialDestinationId | null;
  finish: SpatialSuitcaseFinish;
  onSelectObject?: (dest: SpatialDestinationId) => void;
  className?: string;
}

const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _colorTarget = new THREE.Color();

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

function createMonogramTexture(bgHex: string, fgHex: string, title: string, subtitle: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = fgHex;
    ctx.lineWidth = 4;
    ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

    ctx.fillStyle = fgHex;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, 54, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '600 64px "Cormorant Garamond", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, canvas.width / 2, 186);

    ctx.font = '600 18px "JetBrains Mono", monospace';
    ctx.fillText(subtitle, canvas.width / 2, 244);

    ctx.fillRect(58, 280, canvas.width - 116, 2);
    ctx.font = '500 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('ATELIER EDITION', canvas.width / 2, 316);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 14, 128, 128, 122);
    grad.addColorStop(0, 'rgba(16, 16, 16, 0.34)');
    grad.addColorStop(0.55, 'rgba(16, 16, 16, 0.12)');
    grad.addColorStop(1, 'rgba(16, 16, 16, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Build Procedural Floating Sunglasses (Designer Editorial Silhouette)
function buildFloatingSunglasses(): THREE.Group {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshPhysicalMaterial({
    color: 0x101010,
    roughness: 0.14,
    metalness: 0.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });
  const lensMat = new THREE.MeshPhysicalMaterial({
    color: 0x101010,
    roughness: 0.06,
    metalness: 0.72,
    clearcoat: 1.0,
    envMapIntensity: 1.8,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0xffc5a8,
    roughness: 0.24,
    metalness: 0.88,
  });

  const rimShape = createRoundedRectShape(0.42, 0.28, 0.09);
  const rimHole = createRoundedRectShape(0.35, 0.21, 0.06);
  rimShape.holes.push(rimHole);
  const rimGeo = new THREE.ExtrudeGeometry(rimShape, {
    depth: 0.035,
    bevelEnabled: true,
    bevelSize: 0.012,
    bevelThickness: 0.012,
    bevelSegments: 2,
  });
  rimGeo.center();

  const lensGeo = new THREE.ExtrudeGeometry(createRoundedRectShape(0.36, 0.22, 0.06), {
    depth: 0.014,
    bevelEnabled: false,
  });
  lensGeo.center();

  [-0.25, 0.25].forEach((xPos) => {
    const rim = new THREE.Mesh(rimGeo, frameMat);
    rim.position.set(xPos, 0, 0);
    g.add(rim);

    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.set(xPos, 0, 0.004);
    g.add(lens);
  });

  // Sculpted Peach Gold Bridge
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.024, 0.028), metalMat);
  bridge.position.set(0, 0.04, 0.008);
  g.add(bridge);

  // Temple Arms
  const armGeo = new THREE.BoxGeometry(0.025, 0.036, 0.56);
  [-0.45, 0.45].forEach((xPos) => {
    const arm = new THREE.Mesh(armGeo, frameMat);
    arm.position.set(xPos, 0.04, -0.28);
    g.add(arm);

    const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.028, 0.032), metalMat);
    hinge.position.set(xPos, 0.04, -0.01);
    g.add(hinge);
  });

  g.scale.setScalar(1.05);
  return g;
}

// Build Procedural Folded Cashmere Garment Stack (Wardrobe Object)
function buildFloatingGarmentStack(): THREE.Group {
  const g = new THREE.Group();
  const knitMat = new THREE.MeshStandardMaterial({
    color: 0xd9c9f2,
    roughness: 0.86,
    metalness: 0.02,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0.02,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x101010,
    roughness: 0.5,
    metalness: 0.15,
  });
  const ribbonMat = new THREE.MeshStandardMaterial({
    color: 0xffc5a8,
    roughness: 0.4,
    metalness: 0.1,
  });

  // Base Folded White Linen Shirt
  const baseGeo = new THREE.ExtrudeGeometry(createRoundedRectShape(0.68, 0.52, 0.07), {
    depth: 0.09,
    bevelEnabled: true,
    bevelSize: 0.025,
    bevelThickness: 0.025,
    bevelSegments: 3,
  });
  baseGeo.rotateX(Math.PI / 2);
  baseGeo.center();
  const baseShirt = new THREE.Mesh(baseGeo, shirtMat);
  baseShirt.position.y = -0.08;
  g.add(baseShirt);

  // Top Folded Lavender Cashmere Sweater
  const topGeo = new THREE.ExtrudeGeometry(createRoundedRectShape(0.62, 0.46, 0.08), {
    depth: 0.11,
    bevelEnabled: true,
    bevelSize: 0.03,
    bevelThickness: 0.03,
    bevelSegments: 3,
  });
  topGeo.rotateX(Math.PI / 2);
  topGeo.center();
  const topKnit = new THREE.Mesh(topGeo, knitMat);
  topKnit.position.set(0.02, 0.06, 0);
  topKnit.rotation.y = 0.08;
  g.add(topKnit);

  // Ribbed Collar Ring
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.024, 12, 24, Math.PI), knitMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0.02, 0.135, -0.15);
  g.add(collar);

  // Editorial Atelier Band wrapping the stack
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.31, 0.58), ribbonMat);
  band.position.set(0.01, -0.01, 0);
  g.add(band);

  // Black Label Tag
  const label = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.015, 0.07), trimMat);
  label.position.set(0.01, 0.15, 0.06);
  g.add(label);

  g.scale.setScalar(0.95);
  return g;
}

// Build Procedural Minimalist Architectural Loafer / Travel Shoe
function buildFloatingShoe(): THREE.Group {
  const g = new THREE.Group();
  const leatherMat = new THREE.MeshPhysicalMaterial({
    color: 0x101010,
    roughness: 0.24,
    metalness: 0.08,
    clearcoat: 0.45,
    clearcoatRoughness: 0.3,
  });
  const soleMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.65,
    metalness: 0.05,
  });
  const buckleMat = new THREE.MeshStandardMaterial({
    color: 0xb8d9f2,
    roughness: 0.22,
    metalness: 0.85,
  });

  // Sculpted Sole Profile
  const soleShape = createRoundedRectShape(0.28, 0.72, 0.11);
  const soleGeo = new THREE.ExtrudeGeometry(soleShape, {
    depth: 0.065,
    bevelEnabled: true,
    bevelSize: 0.014,
    bevelThickness: 0.014,
    bevelSegments: 2,
  });
  soleGeo.rotateX(Math.PI / 2);
  soleGeo.center();
  const sole = new THREE.Mesh(soleGeo, soleMat);
  sole.position.y = -0.11;
  g.add(sole);

  // Upper Body
  const upperGeo = new THREE.ExtrudeGeometry(createRoundedRectShape(0.25, 0.66, 0.1), {
    depth: 0.13,
    bevelEnabled: true,
    bevelSize: 0.03,
    bevelThickness: 0.03,
    bevelSegments: 3,
  });
  upperGeo.rotateX(Math.PI / 2);
  upperGeo.center();
  const upper = new THREE.Mesh(upperGeo, leatherMat);
  upper.position.set(0, -0.01, 0.01);
  g.add(upper);

  // Heel Counter Collar
  const heel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.125, 0.16, 20, 1, false, Math.PI * 0.15, Math.PI * 1.7),
    leatherMat
  );
  heel.position.set(0, 0.09, -0.17);
  g.add(heel);

  // Penny Saddle Strap + Metallic Accent Bar
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.04, 0.12), leatherMat);
  strap.position.set(0, 0.085, 0.08);
  g.add(strap);

  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.018, 0.03), buckleMat);
  bar.position.set(0, 0.11, 0.08);
  g.add(bar);

  g.scale.setScalar(1.0);
  return g;
}

// Build Procedural Passport & Boarding Pass Folio (Trip Planner Object)
function buildFloatingPassportFolio(maxAniso: number): { group: THREE.Group; tex: THREE.CanvasTexture } {
  const g = new THREE.Group();
  const tex = createMonogramTexture('#0A0A0A', '#E6DFD2', 'PS', 'PASSPORT');
  tex.anisotropy = maxAniso;

  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x101010,
    roughness: 0.55,
    metalness: 0.08,
  });
  const coverMat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.48,
    metalness: 0.1,
  });
  const passMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.55,
    metalness: 0.02,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xb8d9f2,
    roughness: 0.4,
    metalness: 0.1,
  });

  // Folio Book
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.64, 0.055), [
    leatherMat,
    leatherMat,
    leatherMat,
    leatherMat,
    coverMat,
    leatherMat,
  ]);
  g.add(book);

  // Protruding Boarding Pass
  const pass = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.52, 0.012), passMat);
  pass.position.set(0.12, 0.11, -0.02);
  pass.rotation.z = -0.14;
  g.add(pass);

  // Powder Blue Boarding Stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.09, 0.015), accentMat);
  stripe.position.set(0.14, 0.27, -0.018);
  stripe.rotation.z = -0.14;
  g.add(stripe);

  return { group: g, tex };
}

export const SpatialWorld3D: React.FC<SpatialWorld3DProps> = ({
  mode,
  hoveredDestination,
  finish,
  onSelectObject,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  const modeRef = useRef(mode);
  const hoveredRef = useRef(hoveredDestination);
  const finishRef = useRef(finish);
  const onSelectRef = useRef(onSelectObject);

  modeRef.current = mode;
  hoveredRef.current = hoveredDestination;
  finishRef.current = finish;
  onSelectRef.current = onSelectObject;

  const shellMatRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const frameMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const tagMatRef = useRef<THREE.MeshStandardMaterial | null>(null);

  useEffect(() => {
    const spec = SPATIAL_FINISHES[finish];
    if (shellMatRef.current) shellMatRef.current.color.set(spec.shellHex);
    if (frameMatRef.current) frameMatRef.current.color.set(spec.frameHex);
    if (tagMatRef.current) tagMatRef.current.color.set(spec.tagHex);
  }, [finish]);

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
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initW = Math.max(320, container.clientWidth);
    const initH = Math.max(320, container.clientHeight);
    renderer.setSize(initW, initH);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(34, initW / initH, 0.1, 60);
    camera.position.set(0, 1.55, 7.2);

    // Procedural Studio IBL
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    // Three-point Atelier Lighting in Strict Palette
    const hemiLight = new THREE.HemisphereLight(0xb8d9f2, 0xd9c9f2, 0.95);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.75);
    keyLight.position.set(4.5, 6.8, 5.2);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 20;
      keyLight.shadow.camera.left = -4;
      keyLight.shadow.camera.right = 4;
      keyLight.shadow.camera.top = 4;
      keyLight.shadow.camera.bottom = -4;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const peachRim = new THREE.DirectionalLight(0xffc5a8, 1.35);
    peachRim.position.set(-5.2, 3.2, -3.6);
    scene.add(peachRim);

    const lavenderFill = new THREE.DirectionalLight(0xd9c9f2, 1.05);
    lavenderFill.position.set(3.8, -1.0, -4.0);
    scene.add(lavenderFill);

    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const softbox = new THREE.RectAreaLight(0xffffff, 2.2, 4.2, 5.4);
      softbox.position.set(-3.2, 3.5, 4.2);
      softbox.lookAt(0, 1.2, 0);
      scene.add(softbox);
    }

    // ==================== CENTRAL 12-PART LUXURY 3D SUITCASE ====================
    const suitcaseRoot = new THREE.Group();
    scene.add(suitcaseRoot);

    const spec = SPATIAL_FINISHES[finishRef.current];
    const shellMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(spec.shellHex),
      roughness: 0.24,
      metalness: 0.14,
      clearcoat: 0.72,
      clearcoatRoughness: 0.22,
    });
    const frameMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(spec.frameHex),
      roughness: 0.2,
      metalness: 0.85,
    });
    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x101010,
      roughness: 0.28,
      metalness: 0.78,
    });
    const rubberMat = new THREE.MeshStandardMaterial({
      color: 0x101010,
      roughness: 0.84,
      metalness: 0.05,
    });
    const tagMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(spec.tagHex),
      roughness: 0.62,
      metalness: 0.06,
    });

    shellMatRef.current = shellMat;
    frameMatRef.current = frameMat;
    tagMatRef.current = tagMat;

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const tagTex = createMonogramTexture('#E6DFD2', '#0A0A0A', 'PS', 'PACKSMART');
    tagTex.anisotropy = maxAniso;
    const tagFaceMat = new THREE.MeshStandardMaterial({
      map: tagTex,
      roughness: 0.56,
      metalness: 0.06,
    });

    const bodyW = 1.62;
    const bodyH = 2.28;
    const wheelClearance = 0.24;
    const bodyCenterY = wheelClearance + bodyH / 2;

    const shellShape = createRoundedRectShape(bodyW, bodyH, 0.19);
    const shellGeo = new THREE.ExtrudeGeometry(shellShape, {
      depth: 0.34,
      bevelEnabled: true,
      bevelSegments: 5,
      steps: 1,
      bevelSize: 0.075,
      bevelThickness: 0.075,
    });
    shellGeo.center();

    const frontShell = new THREE.Mesh(shellGeo, shellMat);
    frontShell.position.set(0, bodyCenterY, 0.21);
    frontShell.castShadow = !isSoftwareGl;
    frontShell.receiveShadow = !isSoftwareGl;
    suitcaseRoot.add(frontShell);

    const backShell = new THREE.Mesh(shellGeo, shellMat);
    backShell.position.set(0, bodyCenterY, -0.21);
    backShell.castShadow = !isSoftwareGl;
    backShell.receiveShadow = !isSoftwareGl;
    suitcaseRoot.add(backShell);

    // Metallic Perimeter Frame
    const frameGeo = new THREE.ExtrudeGeometry(createRoundedRectShape(bodyW + 0.08, bodyH + 0.08, 0.21), {
      depth: 0.12,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.015,
      bevelThickness: 0.015,
    });
    frameGeo.center();
    const centerFrame = new THREE.Mesh(frameGeo, frameMat);
    centerFrame.position.set(0, bodyCenterY, 0);
    suitcaseRoot.add(centerFrame);

    // Signature Architectural Grooves
    const ribGeo = new THREE.BoxGeometry(bodyW - 0.3, 0.042, 0.032);
    for (let i = -3; i <= 3; i++) {
      const y = bodyCenterY + i * 0.255;
      const fRib = new THREE.Mesh(ribGeo, frameMat);
      fRib.position.set(0, y, 0.458);
      suitcaseRoot.add(fRib);

      const bRib = new THREE.Mesh(ribGeo, frameMat);
      bRib.position.set(0, y, -0.458);
      suitcaseRoot.add(bRib);
    }

    // 4 Corner Protective Bumpers
    const cornerGeo = new THREE.BoxGeometry(0.24, 0.24, 0.88);
    [
      [-bodyW / 2 + 0.04, bodyCenterY + bodyH / 2 - 0.04],
      [bodyW / 2 - 0.04, bodyCenterY + bodyH / 2 - 0.04],
      [-bodyW / 2 + 0.04, bodyCenterY - bodyH / 2 + 0.04],
      [bodyW / 2 - 0.04, bodyCenterY - bodyH / 2 + 0.04],
    ].forEach(([cx, cy]) => {
      const bumper = new THREE.Mesh(cornerGeo, frameMat);
      bumper.position.set(cx, cy, 0);
      suitcaseRoot.add(bumper);
    });

    // Dual TSA Locks
    const lockGeo = new THREE.BoxGeometry(0.08, 0.24, 0.19);
    [bodyCenterY + 0.44, bodyCenterY - 0.44].forEach((ly) => {
      const lock = new THREE.Mesh(lockGeo, darkMetalMat);
      lock.position.set(bodyW / 2 + 0.095, ly, 0);
      suitcaseRoot.add(lock);
    });

    // Top Carry Handle
    const topHandleGroup = new THREE.Group();
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.08, 0.14), darkMetalMat);
    grip.position.set(0, bodyCenterY + bodyH / 2 + 0.19, 0);
    topHandleGroup.add(grip);
    [-0.27, 0.27].forEach((px) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.16, 0.12), frameMat);
      post.position.set(px, bodyCenterY + bodyH / 2 + 0.1, 0);
      topHandleGroup.add(post);
    });
    suitcaseRoot.add(topHandleGroup);

    // Telescoping Twin-Rod Handle
    const telescopeGroup = new THREE.Group();
    const rodGeo = new THREE.CylinderGeometry(0.026, 0.026, 1.15, 14);
    [-0.25, 0.25].forEach((rx) => {
      const rod = new THREE.Mesh(rodGeo, frameMat);
      rod.position.set(rx, bodyCenterY + bodyH / 2 + 0.46, -0.14);
      telescopeGroup.add(rod);
    });
    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.075, 0.1), darkMetalMat);
    crossbar.position.set(0, bodyCenterY + bodyH / 2 + 1.03, -0.14);
    telescopeGroup.add(crossbar);
    suitcaseRoot.add(telescopeGroup);

    // 4 Dual-Spinner Wheels
    const wheelHousingGeo = new THREE.CylinderGeometry(0.068, 0.085, 0.11, 14);
    const tireGeo = new THREE.CylinderGeometry(0.095, 0.095, 0.055, 18);
    tireGeo.rotateZ(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.062, 12);
    hubGeo.rotateZ(Math.PI / 2);

    [
      [-0.56, 0.26],
      [0.56, 0.26],
      [-0.56, -0.26],
      [0.56, -0.26],
    ].forEach(([wx, wz]) => {
      const wg = new THREE.Group();
      const housing = new THREE.Mesh(wheelHousingGeo, darkMetalMat);
      housing.position.y = 0.18;
      wg.add(housing);
      [-0.042, 0.042].forEach((ox) => {
        const tire = new THREE.Mesh(tireGeo, rubberMat);
        tire.position.set(ox, 0.095, 0);
        wg.add(tire);
        const hub = new THREE.Mesh(hubGeo, frameMat);
        hub.position.set(ox, 0.095, 0);
        wg.add(hub);
      });
      wg.position.set(wx, 0, wz);
      suitcaseRoot.add(wg);
    });

    // Hanging Leather Tag
    const tagGroup = new THREE.Group();
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.18, 0.02), darkMetalMat);
    strap.position.set(0, -0.09, 0);
    tagGroup.add(strap);
    const tagBody = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.36, 0.025), [
      tagMat,
      tagMat,
      tagMat,
      tagMat,
      tagFaceMat,
      tagMat,
    ]);
    tagBody.position.set(0, -0.34, 0);
    tagGroup.add(tagBody);
    tagGroup.position.set(0.32, bodyCenterY + bodyH / 2 + 0.12, 0.08);
    tagGroup.rotation.z = -0.1;
    suitcaseRoot.add(tagGroup);

    // Subtle Architectural Plinth Ring + Ground Contact Shadow
    const shadowTex = createContactShadowTexture();
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 2.5),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.72,
      })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.01;
    scene.add(shadowPlane);

    // Subtle Editorial Orbit Halo Ring beneath suitcase
    const haloRing = new THREE.Mesh(
      new THREE.RingGeometry(1.72, 1.745, 72),
      new THREE.MeshBasicMaterial({
        color: 0x101010,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    haloRing.rotation.x = -Math.PI / 2;
    haloRing.position.y = 0.015;
    scene.add(haloRing);

    // ==================== FLOATING 3D FASHION & TRAVEL OBJECTS ====================
    const floatingShoes = buildFloatingShoe();
    const floatingSunglasses = buildFloatingSunglasses();
    const { group: floatingPassport, tex: passportTex } = buildFloatingPassportFolio(maxAniso);
    const floatingGarment = buildFloatingGarmentStack();

    const orbitObjects: Array<{
      id: SpatialDestinationId;
      mesh: THREE.Group;
      heroPos: THREE.Vector3;
      hubPos: THREE.Vector3;
      baseRot: THREE.Euler;
      phase: number;
    }> = [
      {
        id: 'smart-packing',
        mesh: floatingShoes,
        heroPos: new THREE.Vector3(-2.35, 0.95, 0.7),
        hubPos: new THREE.Vector3(-2.15, 1.95, 0.45),
        baseRot: new THREE.Euler(0.24, 0.75, -0.18),
        phase: 0.4,
      },
      {
        id: 'ai-outfit-studio',
        mesh: floatingSunglasses,
        heroPos: new THREE.Vector3(2.25, 2.35, 0.85),
        hubPos: new THREE.Vector3(2.15, 2.05, 0.65),
        baseRot: new THREE.Euler(0.18, -0.42, 0.14),
        phase: 1.8,
      },
      {
        id: 'trip-planner',
        mesh: floatingPassport,
        heroPos: new THREE.Vector3(2.15, 0.95, 0.55),
        hubPos: new THREE.Vector3(2.05, 0.65, 0.55),
        baseRot: new THREE.Euler(-0.12, -0.5, -0.18),
        phase: 3.1,
      },
      {
        id: 'digital-wardrobe',
        mesh: floatingGarment,
        heroPos: new THREE.Vector3(-2.2, 2.35, 0.45),
        hubPos: new THREE.Vector3(-2.15, 0.65, 0.55),
        baseRot: new THREE.Euler(0.32, 0.45, 0.1),
        phase: 4.6,
      },
    ];

    orbitObjects.forEach((o) => {
      o.mesh.position.copy(o.heroPos);
      o.mesh.rotation.copy(o.baseRot);
      o.mesh.userData.destinationId = o.id;
      o.mesh.traverse((child) => {
        child.userData.destinationId = o.id;
      });
      scene.add(o.mesh);
    });

    // Pointer tracking + Click Raycasting on floating 3D objects
    const pointer = { x: 0, y: 0 };
    const raycaster = new THREE.Raycaster();
    const mouseNdc = new THREE.Vector2();

    const onPointerMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };

    const onCanvasClick = (e: MouseEvent) => {
      if (!onSelectRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouseNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouseNdc, camera);
      const hits = raycaster.intersectObjects(
        orbitObjects.map((o) => o.mesh),
        true
      );
      if (hits.length > 0) {
        const destId = hits[0].object.userData.destinationId as SpatialDestinationId | undefined;
        if (destId) onSelectRef.current(destId);
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    renderer.domElement.addEventListener('click', onCanvasClick);

    const onResize = () => {
      const w = Math.max(320, container.clientWidth);
      const h = Math.max(320, container.clientHeight);
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

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

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

    let currentRotY = -0.32;
    let currentRotX = 0.04;
    let currentHandleY = 0.08;
    let currentCamX = 0;
    let currentCamY = 1.52;
    let currentCamZ = 7.1;

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      const curMode = modeRef.current;
      const hovered = hoveredRef.current;
      const isNarrow = container.clientWidth < 768;

      // Camera & Suitcase Choreography per Mode & Hovered Destination
      let targetCamX = pointer.x * 0.28;
      let targetCamY = 1.52 - pointer.y * 0.18;
      let targetCamZ = isNarrow ? 8.6 : 6.7;
      let targetRotY = -0.32 + pointer.x * 0.36 + (reduced ? 0 : Math.sin(t * 0.45) * 0.14);
      let targetRotX = 0.04 + pointer.y * 0.12;
      let targetHandleY = 0.08;

      if (curMode === 'hero') {
        targetCamX = (isNarrow ? 0 : -0.55) + pointer.x * 0.24;
        targetCamZ = isNarrow ? 8.4 : 6.45;
        targetHandleY = 0.16;
      } else if (curMode === 'hub') {
        targetCamX = pointer.x * 0.22;
        targetCamZ = isNarrow ? 9.1 : 7.5;
        targetHandleY = 0.32;
        if (hovered === 'smart-packing') {
          targetRotY = 0.42;
          targetCamX -= 0.35;
          targetCamZ -= 0.45;
          targetHandleY = 0.52;
        } else if (hovered === 'ai-outfit-studio') {
          targetRotY = -0.58;
          targetCamX += 0.35;
          targetCamZ -= 0.45;
        } else if (hovered === 'trip-planner') {
          targetRotY = -0.25;
          targetRotX = -0.06;
          targetCamY -= 0.18;
          targetCamZ -= 0.35;
        } else if (hovered === 'digital-wardrobe') {
          targetRotY = 0.62;
          targetCamX -= 0.3;
          targetCamY -= 0.14;
          targetCamZ -= 0.45;
        }
      } else if (curMode === 'zooming') {
        targetCamZ = 4.2;
        targetRotY += 0.65;
      }

      currentCamX = THREE.MathUtils.damp(currentCamX, targetCamX, 4.2, dt);
      currentCamY = THREE.MathUtils.damp(currentCamY, targetCamY, 4.2, dt);
      currentCamZ = THREE.MathUtils.damp(currentCamZ, targetCamZ, 4.2, dt);
      camera.position.set(currentCamX, currentCamY, currentCamZ);
      camera.lookAt(0, 1.38, 0);

      currentRotY = THREE.MathUtils.damp(currentRotY, targetRotY, 4.5, dt);
      currentRotX = THREE.MathUtils.damp(currentRotX, targetRotX, 4.5, dt);
      currentHandleY = THREE.MathUtils.damp(currentHandleY, targetHandleY, 4.5, dt);

      suitcaseRoot.rotation.y = currentRotY;
      suitcaseRoot.rotation.x = currentRotX;
      suitcaseRoot.position.y = reduced ? 0.05 : 0.06 + Math.sin(t * 1.1) * 0.045;
      telescopeGroup.position.y = currentHandleY;
      tagGroup.rotation.z = -0.1 + (reduced ? 0 : Math.sin(t * 1.6) * 0.06);

      // Subtle atmospheric light temperature shift on hover (strict 5-color palette)
      if (hovered === 'smart-packing') _colorTarget.set('#BCD2CF');
      else if (hovered === 'ai-outfit-studio') _colorTarget.set('#D5DCD9');
      else if (hovered === 'trip-planner') _colorTarget.set('#E6DFD2');
      else if (hovered === 'digital-wardrobe') _colorTarget.set('#D5DCD9');
      else _colorTarget.set('#E6DFD2');
      peachRim.color.lerp(_colorTarget, 1 - Math.exp(-4 * dt));

      // Animate Floating 3D Fashion Objects with Depth & Hover Focus
      const spreadScale = isNarrow ? 0.68 : 1.0;
      for (const obj of orbitObjects) {
        const isSpotlit = hovered === obj.id;
        const base = curMode === 'hero' ? obj.heroPos : obj.hubPos;
        _vec3A.set(base.x * spreadScale, base.y, base.z);

        if (isSpotlit) {
          // Bring hovered companion object closer & higher contrast
          _vec3A.x *= 0.84;
          _vec3A.z += 0.9;
        } else if (hovered && curMode === 'hub') {
          _vec3A.z -= 0.45;
        }

        if (!reduced) {
          _vec3A.y += Math.sin(t * 1.25 + obj.phase) * 0.11;
          _vec3A.x += pointer.x * (isSpotlit ? 0.25 : 0.14);
          _vec3A.y -= pointer.y * (isSpotlit ? 0.18 : 0.1);
        }

        obj.mesh.position.lerp(_vec3A, 1 - Math.exp(-5.0 * dt));

        const targetScale = isSpotlit ? 1.24 : hovered ? 0.88 : 1.0;
        const s = THREE.MathUtils.damp(obj.mesh.scale.x, targetScale, 5.5, dt);
        obj.mesh.scale.setScalar(s);

        const spinOffset = reduced ? 0 : Math.sin(t * 0.8 + obj.phase) * 0.24;
        obj.mesh.rotation.y = THREE.MathUtils.damp(
          obj.mesh.rotation.y,
          obj.baseRot.y + spinOffset + (isSpotlit ? 0.45 : 0) + pointer.x * 0.22,
          5.0,
          dt
        );
        obj.mesh.rotation.x = THREE.MathUtils.damp(
          obj.mesh.rotation.x,
          obj.baseRot.x + pointer.y * 0.14,
          5.0,
          dt
        );
      }

      // Subtle halo ring counter-rotation
      _vec3B.set(1, 1, 1);
      haloRing.rotation.z = reduced ? 0 : t * 0.12;

      if (!contextLost) {
        renderer.render(scene, camera);
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('click', onCanvasClick);
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onRestored);

      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => m?.dispose());
        }
      });
      tagTex.dispose();
      passportTex.dispose();
      shadowTex.dispose();
      envRT.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  if (webglFailed) {
    const spec = SPATIAL_FINISHES[finish];
    return (
      <div className={`w-full h-full flex items-center justify-center ${className}`}>
        <svg viewBox="0 0 360 440" className="w-[260px] h-auto" aria-label="PackSmart Luxury Carry-On">
          <rect x="148" y="28" width="64" height="82" rx="10" fill="none" stroke={spec.frameHex} strokeWidth="6" />
          <rect x="134" y="20" width="92" height="16" rx="8" fill="#0A0A0A" />
          <rect x="86" y="102" width="188" height="270" rx="28" fill={spec.shellHex} stroke={spec.frameHex} strokeWidth="6" />
          {[148, 184, 220, 256, 292, 328].map((y) => (
            <line key={y} x1="112" y1={y} x2="248" y2={y} stroke={spec.frameHex} strokeWidth="3.5" strokeLinecap="round" />
          ))}
          <rect x="224" y="114" width="28" height="46" rx="4" fill={spec.tagHex} />
          <circle cx="122" cy="390" r="14" fill="#0A0A0A" />
          <circle cx="238" cy="390" r="14" fill="#0A0A0A" />
        </svg>
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      className={`w-full h-full select-none ${className}`}
      aria-label="Interactive 3D PackSmart spatial suitcase and floating fashion accessories"
    />
  );
};
