import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { LatLng } from '../game/rules';

interface EarthGlobeProps {
  targetLocation?: LatLng;
  guessLocation?: LatLng;
  showArc?: boolean;
  interactive?: boolean;
  className?: string;
}

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
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

function paintEarthCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  const oceanGrad = ctx.createLinearGradient(0, 0, 0, h);
  oceanGrad.addColorStop(0, '#050A14');
  oceanGrad.addColorStop(0.5, '#091428');
  oceanGrad.addColorStop(1, '#050912');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, w, h);

  // Subtle equirectangular graticule
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.11)';
  ctx.lineWidth = 1.2;
  for (let lon = -180; lon <= 180; lon += 15) {
    const x = ((lon + 180) / 360) * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    const y = ((90 - lat) / 180) * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Equator highlight
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();

  const toXY = (lon: number, lat: number): [number, number] => [
    ((lon + 180) / 360) * w,
    ((90 - lat) / 180) * h,
  ];

  const drawLandmass = (coords: Array<[number, number]>) => {
    if (coords.length < 3) return;
    ctx.beginPath();
    const [x0, y0] = toXY(coords[0][0], coords[0][1]);
    ctx.moveTo(x0, y0);
    for (let i = 1; i < coords.length; i++) {
      const [xi, yi] = toXY(coords[i][0], coords[i][1]);
      ctx.lineTo(xi, yi);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  // Coastal bathymetry outer stroke
  ctx.fillStyle = '#133547';
  ctx.strokeStyle = '#22D3EE';
  ctx.lineWidth = 2.6;

  // North America
  drawLandmass([
    [-168, 65], [-152, 70], [-130, 70], [-95, 72], [-78, 63], [-60, 52],
    [-68, 44], [-80, 26], [-88, 21], [-97, 19], [-85, 10], [-78, 8],
    [-92, 14], [-105, 20], [-115, 31], [-125, 42], [-136, 57], [-156, 58],
  ]);
  drawLandmass([[-55, 60], [-42, 60], [-22, 71], [-20, 81], [-52, 82], [-66, 76]]);
  // South America
  drawLandmass([
    [-78, 9], [-62, 10], [-50, 1], [-35, -6], [-40, -21], [-53, -33],
    [-65, -43], [-68, -55], [-74, -52], [-72, -35], [-71, -18], [-81, -5],
  ]);
  // Europe + UK
  drawLandmass([
    [-9, 37], [-9, 43], [-2, 43], [-4, 48], [2, 51], [8, 55], [10, 59],
    [18, 69], [30, 70], [42, 66], [40, 50], [32, 46], [24, 38], [16, 40],
    [12, 44], [5, 43], [0, 38],
  ]);
  drawLandmass([[-6, 50], [1, 51], [-2, 58], [-6, 57]]);
  // Africa + Madagascar
  drawLandmass([
    [-17, 15], [-16, 28], [-6, 36], [10, 37], [24, 32], [33, 31],
    [43, 12], [51, 11], [40, -5], [35, -24], [26, -34], [18, -34],
    [14, -20], [10, 4], [2, 6], [-8, 5],
  ]);
  drawLandmass([[44, -25], [47, -25], [50, -13], [46, -15]]);
  // Asia + Japan + SE islands + Australia
  drawLandmass([
    [30, 42], [44, 42], [55, 65], [80, 72], [115, 73], [150, 70], [176, 66],
    [160, 58], [142, 52], [132, 42], [122, 37], [121, 24], [108, 20],
    [104, 2], [98, 16], [88, 22], [78, 8], [68, 23], [56, 26], [48, 30],
    [36, 33],
  ]);
  drawLandmass([[130, 32], [136, 34], [141, 41], [145, 44], [140, 39], [134, 35]]);
  drawLandmass([[96, 5], [105, -6], [115, -8], [118, 1], [107, 1]]);
  drawLandmass([[132, -2], [148, -6], [144, -9], [132, -6]]);
  drawLandmass([
    [114, -22], [128, -14], [142, -11], [153, -26], [149, -37],
    [138, -35], [125, -33], [115, -34],
  ]);

  // Luminous world city network nodes
  const hubs: Array<[number, number]> = [
    [2.35, 48.85], [-74.0, 40.7], [139.69, 35.68], [151.2, -33.86],
    [-46.63, -23.55], [31.23, 30.04], [103.8, 1.35], [-0.12, 51.5],
    [-122.4, 37.77], [12.49, 41.9], [77.2, 28.6], [18.42, -33.92],
  ];
  hubs.forEach(([lon, lat]) => {
    const [cx, cy] = toXY(lon, lat);
    const glow = ctx.createRadialGradient(cx, cy, 1, cx, cy, 16);
    glow.addColorStop(0, 'rgba(245, 158, 11, 0.95)');
    glow.addColorStop(0.5, 'rgba(34, 211, 238, 0.45)');
    glow.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function EarthGlobe({
  targetLocation,
  guessLocation,
  showArc = false,
  interactive = true,
  className = 'w-full h-full',
}: EarthGlobeProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || 360;
    let height = container.clientHeight || 360;
    const isSoftwareGl = detectSoftwareGl();

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

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0.04, 3.12);

    const disposables: Array<{ dispose: () => void }> = [];

    // Subtle 3D Starfield
    const starCount = 260;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 6 + Math.random() * 6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starsGeo = new THREE.BufferGeometry();
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starsMat = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 0.032,
      transparent: true,
      opacity: 0.65,
    });
    const starField = new THREE.Points(starsGeo, starsMat);
    scene.add(starField);
    disposables.push(starsGeo, starsMat);

    // Earth Texture & Mesh
    const radius = 1.0;
    const texCanvas = document.createElement('canvas');
    texCanvas.width = 2048;
    texCanvas.height = 1024;
    paintEarthCanvas(texCanvas);

    const earthTexture = new THREE.CanvasTexture(texCanvas);
    earthTexture.colorSpace = THREE.SRGBColorSpace;
    earthTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

    const sphereGeo = new THREE.SphereGeometry(radius, 48, 48);
    const sphereMat = new THREE.MeshStandardMaterial({
      map: earthTexture,
      color: 0xffffff,
      roughness: 0.52,
      metalness: 0.22,
    });
    const earthMesh = new THREE.Mesh(sphereGeo, sphereMat);
    scene.add(earthMesh);

    // Atmospheric Outer Rim Shell
    const glowGeo = new THREE.SphereGeometry(radius * 1.04, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    scene.add(glowMesh);

    // Dual Orbital Meridian Rings
    const orbitGeo = new THREE.TorusGeometry(radius * 1.24, 0.0055, 8, 96);
    const orbitMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.45,
    });
    const orbitRing = new THREE.Mesh(orbitGeo, orbitMat);
    orbitRing.rotation.x = Math.PI * 0.42;
    orbitRing.rotation.y = Math.PI * 0.14;
    scene.add(orbitRing);

    const orbitRing2Geo = new THREE.TorusGeometry(radius * 1.35, 0.0035, 8, 96);
    const orbitRing2Mat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.3,
    });
    const orbitRing2 = new THREE.Mesh(orbitRing2Geo, orbitRing2Mat);
    orbitRing2.rotation.x = -Math.PI * 0.34;
    orbitRing2.rotation.z = Math.PI * 0.2;
    scene.add(orbitRing2);

    // Three-Point Studio Lighting
    scene.add(new THREE.HemisphereLight(0x7dd3fc, 0x090d16, 1.4));
    const keyLight = new THREE.DirectionalLight(0xfef3c7, 2.2);
    keyLight.position.set(4.5, 2.5, 4.5);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x22d3ee, 1.25);
    rimLight.position.set(-4.0, -1.5, -3.5);
    scene.add(rimLight);

    disposables.push(
      sphereGeo,
      sphereMat,
      glowGeo,
      glowMat,
      orbitGeo,
      orbitMat,
      orbitRing2Geo,
      orbitRing2Mat,
      earthTexture
    );

    const latLngToVector3 = (lat: number, lng: number, r: number) => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lng + 180) * (Math.PI / 180);
      return new THREE.Vector3(
        -(r * Math.sin(phi) * Math.cos(theta)),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );
    };

    const animatedPulseRings: THREE.Mesh[] = [];
    const animatedFlags: THREE.Mesh[] = [];

    // Helper: 3D Flag Marker perpendicular to the sphere surface
    const add3DFlagMarker = (lat: number, lng: number, flagColor: number, ringColor: number) => {
      const pos = latLngToVector3(lat, lng, radius);
      const normal = pos.clone().normalize();
      const group = new THREE.Group();
      group.position.copy(pos);
      group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

      // Flagpole mast
      const poleGeo = new THREE.CylinderGeometry(0.007, 0.009, 0.16, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.25 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 0.08;
      group.add(pole);

      // Finial orb
      const topGeo = new THREE.SphereGeometry(0.016, 12, 12);
      const topMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
      const top = new THREE.Mesh(topGeo, topMat);
      top.position.y = 0.165;
      group.add(top);

      // Pennant banner
      const bannerGeo = new THREE.PlaneGeometry(0.11, 0.065);
      const bannerMat = new THREE.MeshBasicMaterial({ color: flagColor, side: THREE.DoubleSide });
      const banner = new THREE.Mesh(bannerGeo, bannerMat);
      banner.position.set(0.055, 0.125, 0);
      group.add(banner);
      animatedFlags.push(banner);

      // Pulsing ground beacon ring
      const ringGeo = new THREE.RingGeometry(0.025, 0.042, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: ringColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.006;
      group.add(ring);
      animatedPulseRings.push(ring);

      earthMesh.add(group);
      disposables.push(poleGeo, poleMat, topGeo, topMat, bannerGeo, bannerMat, ringGeo, ringMat);
    };

    if (targetLocation) {
      add3DFlagMarker(targetLocation.lat, targetLocation.lng, 0x10b981, 0x34d399);
    } else {
      // Showcase iconic world flag pins on title globe
      add3DFlagMarker(48.8566, 2.3522, 0x22d3ee, 0x22d3ee); // Paris
      add3DFlagMarker(35.6762, 139.6503, 0xf59e0b, 0xf59e0b); // Tokyo
      add3DFlagMarker(-22.9068, -43.1729, 0x10b981, 0x10b981); // Rio
    }

    if (guessLocation) {
      add3DFlagMarker(guessLocation.lat, guessLocation.lng, 0xf43f5e, 0xf43f5e);
    }

    let arcPoints: THREE.Vector3[] = [];
    let arcOrb: THREE.Mesh | null = null;

    if (showArc && targetLocation && guessLocation) {
      const v1 = latLngToVector3(guessLocation.lat, guessLocation.lng, radius * 1.015);
      const v2 = latLngToVector3(targetLocation.lat, targetLocation.lng, radius * 1.015);
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const p = new THREE.Vector3().lerpVectors(v1, v2, t);
        const arcElevation = Math.sin(t * Math.PI) * 0.36;
        p.normalize().multiplyScalar(radius * 1.015 + arcElevation);
        arcPoints.push(p);
      }

      const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPoints);
      const arcMat = new THREE.LineBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.95,
      });
      earthMesh.add(new THREE.Line(arcGeo, arcMat));

      const orbGeo = new THREE.SphereGeometry(0.024, 14, 14);
      const orbMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
      arcOrb = new THREE.Mesh(orbGeo, orbMat);
      earthMesh.add(arcOrb);
      disposables.push(arcGeo, arcMat, orbGeo, orbMat);
    }

    earthMesh.rotation.order = 'YXZ';
    if (targetLocation) {
      const targetVec = latLngToVector3(targetLocation.lat, targetLocation.lng, 1);
      const focusVec = targetVec.clone();
      if (guessLocation) {
        const guessVec = latLngToVector3(guessLocation.lat, guessLocation.lng, 1);
        const mid = targetVec.clone().add(guessVec);
        if (mid.lengthSq() > 0.001) {
          focusVec.copy(mid.normalize());
        }
      }
      const horizLen = Math.hypot(focusVec.x, focusVec.z);
      earthMesh.rotation.y = Math.atan2(-focusVec.x, focusVec.z);
      earthMesh.rotation.x = Math.max(-0.95, Math.min(0.95, Math.atan2(focusVec.y, horizLen)));
    } else {
      const showcaseVec = latLngToVector3(28, 12, 1);
      earthMesh.rotation.y = Math.atan2(-showcaseVec.x, showcaseVec.z);
      earthMesh.rotation.x = Math.atan2(showcaseVec.y, Math.hypot(showcaseVec.x, showcaseVec.z));
    }

    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let velX = 0;
    let velY = 0;

    const handlePointerDown = (e: PointerEvent) => {
      if (!interactive) return;
      isDragging = true;
      velX = 0;
      velY = 0;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging || !interactive) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;
      velY = deltaX * 0.006;
      velX = deltaY * 0.006;
      earthMesh.rotation.y += velY;
      earthMesh.rotation.x = Math.max(-1.1, Math.min(1.1, earthMesh.rotation.x + velX));
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = () => {
      isDragging = false;
    };

    container.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      width = container.clientWidth || 360;
      height = container.clientHeight || 360;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(container);

    let frameId = 0;
    let isDisposed = false;
    let lastTime = performance.now();
    let elapsed = 0;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const afterDraw = (cb: () => void) => {
      try {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        if (typeof gl.fenceSync === 'function') {
          const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
          gl.flush();
          const poll = () => {
            if (isDisposed) return;
            const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
            if (status === gl.UNSIGNALED) {
              frameId = window.setTimeout(poll, 5);
            } else {
              if (sync) gl.deleteSync(sync);
              frameId = window.setTimeout(cb, 80);
            }
          };
          frameId = window.setTimeout(poll, 5);
          return;
        }
      } catch {}
      frameId = window.setTimeout(cb, 80);
    };

    const tick = () => {
      if (isDisposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      elapsed += dt;

      if (!isDragging && !prefersReducedMotion) {
        if (Math.abs(velY) > 0.0002 || Math.abs(velX) > 0.0002) {
          earthMesh.rotation.y += velY;
          earthMesh.rotation.x = Math.max(-1.1, Math.min(1.1, earthMesh.rotation.x + velX));
          velX *= 0.92;
          velY *= 0.92;
        } else {
          const rotSpeed = showArc ? 0.035 : 0.14;
          earthMesh.rotation.y += rotSpeed * dt;
        }
        orbitRing.rotation.z += 0.09 * dt;
        orbitRing2.rotation.y -= 0.07 * dt;
        starField.rotation.y += 0.015 * dt;

        // Pulse flag base rings & flutter banners
        animatedPulseRings.forEach((ring, idx) => {
          const phase = (elapsed * 1.1 + idx * 0.35) % 1;
          const s = 0.9 + phase * 1.45;
          ring.scale.set(s, s, 1);
          const mat = ring.material as THREE.MeshBasicMaterial;
          mat.opacity = (1 - phase) * 0.85;
        });
        animatedFlags.forEach((flag, idx) => {
          flag.rotation.y = Math.sin(elapsed * 4 + idx) * 0.18;
        });

        // Animate light orb traveling along great-circle arc
        if (arcOrb && arcPoints.length > 1) {
          const progress = (elapsed * 0.45) % 1;
          const idxF = progress * (arcPoints.length - 1);
          const i0 = Math.floor(idxF);
          const i1 = Math.min(arcPoints.length - 1, i0 + 1);
          arcOrb.position.lerpVectors(arcPoints[i0], arcPoints[i1], idxF - i0);
        }
      }

      renderer.render(scene, camera);
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      container.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    };
  }, [targetLocation, guessLocation, showArc, interactive]);

  if (webglUnavailable) {
    return (
      <div
        data-testid="earth-globe-fallback"
        className={`${className} flex items-center justify-center rounded-full border border-cyan-500/20 bg-radial from-cyan-950/60 via-[#0A1324] to-[#07090F]`}
      >
        <div className="w-40 h-40 rounded-full border border-amber-400/30 flex items-center justify-center text-xs font-mono text-cyan-300">
          3D ATLAS
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      data-testid="earth-globe-canvas"
      aria-label="Globe terrestre 3D interactif"
      className={`${className} cursor-grab active:cursor-grabbing`}
    />
  );
}
