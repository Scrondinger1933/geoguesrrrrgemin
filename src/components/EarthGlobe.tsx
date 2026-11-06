import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { LatLng } from '../game/rules';

interface EarthGlobeProps {
  targetLocation?: LatLng;
  guessLocation?: LatLng;
  showArc?: boolean;
  interactive?: boolean;
  className?: string;
}

export function EarthGlobe({
  targetLocation,
  guessLocation,
  showArc = false,
  interactive = true,
  className = 'w-full h-full',
}: EarthGlobeProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || 300;
    let height = container.clientHeight || 300;

    // Three.js Scene, Camera & Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 2.8;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Earth Sphere with Procedural Continents Canvas Texture
    const radius = 1.0;
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0f172a'; // Deep Ocean
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Continent base style
      ctx.fillStyle = '#10b981'; // Vivid emerald landmasses
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 3;

      // Draw recognizable continental landmass blobs
      // Africa & Europe
      ctx.beginPath();
      ctx.ellipse(1080, 480, 140, 240, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(1060, 280, 160, 120, -0.1, 0, Math.PI * 2);
      ctx.fill();

      // Asia
      ctx.beginPath();
      ctx.ellipse(1450, 320, 280, 180, 0.15, 0, Math.PI * 2);
      ctx.fill();

      // North America
      ctx.beginPath();
      ctx.ellipse(520, 310, 220, 160, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // South America
      ctx.beginPath();
      ctx.ellipse(680, 680, 130, 220, 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Australia
      ctx.beginPath();
      ctx.ellipse(1680, 720, 120, 90, 0.1, 0, Math.PI * 2);
      ctx.fill();

      // Latitude and Longitude Grid lines
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= canvas.width; x += 128) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y <= canvas.height; y += 128) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    }

    const earthTexture = new THREE.CanvasTexture(canvas);
    const sphereGeo = new THREE.SphereGeometry(radius, 64, 64);
    const sphereMat = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.65,
      metalness: 0.15,
    });
    const earthMesh = new THREE.Mesh(sphereGeo, sphereMat);
    scene.add(earthMesh);

    // Glowing Atmospheric Outer Rim
    const glowGeo = new THREE.SphereGeometry(radius * 1.05, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.18,
      side: THREE.BackSide,
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    scene.add(glowMesh);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(5, 3, 5);
    scene.add(dirLight);

    // LatLng to 3D Cartesian coordinates converter
    const latLngToVector3 = (lat: number, lng: number, r: number) => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lng + 180) * (Math.PI / 180);
      const x = -(r * Math.sin(phi) * Math.cos(theta));
      const z = r * Math.sin(phi) * Math.sin(theta);
      const y = r * Math.cos(phi);
      return new THREE.Vector3(x, y, z);
    };

    // Target Pin (Emerald)
    if (targetLocation) {
      const targetPos = latLngToVector3(targetLocation.lat, targetLocation.lng, radius * 1.02);
      const pinGeo = new THREE.SphereGeometry(0.035, 16, 16);
      const pinMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
      const pin = new THREE.Mesh(pinGeo, pinMat);
      pin.position.copy(targetPos);
      earthMesh.add(pin);
    }

    // Guess Pin (Crimson)
    if (guessLocation) {
      const guessPos = latLngToVector3(guessLocation.lat, guessLocation.lng, radius * 1.02);
      const pinGeo = new THREE.SphereGeometry(0.035, 16, 16);
      const pinMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
      const pin = new THREE.Mesh(pinGeo, pinMat);
      pin.position.copy(guessPos);
      earthMesh.add(pin);
    }

    // Trajectory Geodesic Flight Arc between Target and Guess
    if (showArc && targetLocation && guessLocation) {
      const v1 = latLngToVector3(targetLocation.lat, targetLocation.lng, radius * 1.01);
      const v2 = latLngToVector3(guessLocation.lat, guessLocation.lng, radius * 1.01);
      const points: THREE.Vector3[] = [];

      for (let i = 0; i <= 30; i++) {
        const t = i / 30;
        const p = new THREE.Vector3().lerpVectors(v1, v2, t);
        // Elevate middle points to create a parabolic geodesic trajectory
        const arcElevation = Math.sin(t * Math.PI) * 0.35;
        p.normalize().multiplyScalar(radius * 1.01 + arcElevation);
        points.push(p);
      }

      const arcGeo = new THREE.BufferGeometry().setFromPoints(points);
      const arcMat = new THREE.LineBasicMaterial({
        color: 0xfbbf24,
        linewidth: 2,
        transparent: true,
        opacity: 0.9,
      });
      const arcLine = new THREE.Line(arcGeo, arcMat);
      earthMesh.add(arcLine);
    }

    // Auto-focus camera on target location if provided
    if (targetLocation) {
      const phi = (90 - targetLocation.lat) * (Math.PI / 180);
      const theta = (targetLocation.lng + 180) * (Math.PI / 180);
      earthMesh.rotation.y = -theta + Math.PI / 2;
      earthMesh.rotation.x = phi - Math.PI / 2;
    }

    // Mouse / Touch Interaction for Free Rotation
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const handlePointerDown = (e: PointerEvent) => {
      if (!interactive) return;
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging || !interactive) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      earthMesh.rotation.y += deltaX * 0.006;
      earthMesh.rotation.x += deltaY * 0.006;

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = () => {
      isDragging = false;
    };

    container.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth || 300;
      height = container.clientHeight || 300;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop with delta timing
    let animId = 0;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const delta = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      // Slow gentle ambient rotation when idle
      if (!isDragging) {
        earthMesh.rotation.y += 0.12 * delta;
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('resize', handleResize);

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      sphereGeo.dispose();
      sphereMat.dispose();
      glowGeo.dispose();
      glowMat.dispose();
      earthTexture.dispose();
    };
  }, [targetLocation, guessLocation, showArc, interactive]);

  return <div ref={mountRef} className={`${className} cursor-grab active:cursor-grabbing`} />;
}
