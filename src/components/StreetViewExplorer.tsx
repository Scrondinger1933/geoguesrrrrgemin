import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Compass,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Dices,
  HelpCircle,
  Eye,
  EyeOff,
  Sparkles,
  Navigation,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Move,
  Wind,
} from 'lucide-react';
import { GeoLocation } from '../game/locations';
import { sound } from '../utils/audio';

interface StreetViewExplorerProps {
  location: GeoLocation;
  onRandomTeleport?: () => void;
  onLocationUpdate?: (actualLat: number, actualLng: number) => void;
}

export function StreetViewExplorer({
  location,
  onRandomTeleport,
  onLocationUpdate,
}: StreetViewExplorerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const googlePanoRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const isPanoReady = useRef(false);

  // View state
  const [heading, setHeading] = useState(location.heading);
  const [pitch, setPitch] = useState(location.pitch);
  const [fov, setFov] = useState(80);
  const [stepOffset, setStepOffset] = useState(0);
  const [showClue, setShowClue] = useState(false);
  const [isUsingGooglePano, setIsUsingGooglePano] = useState(false);
  const [isTeleporting, setIsTeleporting] = useState(false);
  const [isAmbienceOn, setIsAmbienceOn] = useState(false);
  const [isStepping, setIsStepping] = useState(false);

  // Toggle ambient wind audio
  const handleToggleAmbience = () => {
    const active = sound.toggleAmbience();
    setIsAmbienceOn(active);
  };

  // Drag state for canvas fallback
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Handle teleport click with fluid warp animation and audio
  const handleTeleportClick = useCallback(() => {
    sound.playTeleport();
    setIsTeleporting(true);
    if (onRandomTeleport) {
      onRandomTeleport();
    }
    setTimeout(() => {
      setIsTeleporting(false);
    }, 450);
  }, [onRandomTeleport]);

  // Reset to initial spawn position
  const resetToSpawn = useCallback(() => {
    sound.playClick();
    setHeading(location.heading);
    setPitch(location.pitch);
    setFov(80);
    setStepOffset(0);
    if (googlePanoRef.current) {
      googlePanoRef.current.setPov({ heading: location.heading, pitch: location.pitch });
      googlePanoRef.current.setZoom(1);
      googlePanoRef.current.setPosition({ lat: location.lat, lng: location.lng });
    }
  }, [location.heading, location.pitch, location.lat, location.lng]);

  // Point to true North
  const resetToNorth = useCallback(() => {
    sound.playClick();
    setHeading(0);
    if (googlePanoRef.current) {
      const currentPov = googlePanoRef.current.getPov();
      googlePanoRef.current.setPov({ heading: 0, pitch: currentPov.pitch });
    }
  }, []);

  // Zoom controls
  const handleZoom = useCallback((delta: number) => {
    sound.playClick();
    if (googlePanoRef.current) {
      const curZoom = googlePanoRef.current.getZoom() || 1;
      const nextZoom = Math.max(0, Math.min(4, curZoom + (delta < 0 ? 1 : -1)));
      googlePanoRef.current.setZoom(nextZoom);
    } else {
      setFov((prev) => Math.max(40, Math.min(110, prev + delta)));
    }
  }, []);

  // Move Forward along current road heading
  const moveForward = useCallback(() => {
    sound.playStep();
    setIsStepping(true);
    setTimeout(() => setIsStepping(false), 240);

    if (googlePanoRef.current && isUsingGooglePano) {
      const pano = googlePanoRef.current;
      const links = pano.getLinks() || [];
      if (links.length > 0) {
        let bestLink = links[0];
        let minDiff = 360;
        links.forEach((l) => {
          if (l.heading !== null && l.heading !== undefined) {
            const diff = Math.abs(((l.heading - heading + 180 + 360) % 360) - 180);
            if (diff < minDiff) {
              minDiff = diff;
              bestLink = l;
            }
          }
        });
        if (bestLink.pano) {
          pano.setPano(bestLink.pano);
          return;
        }
      }
    }

    setStepOffset((prev) => prev + 1);
    const rad = (heading * Math.PI) / 180;
    const stepMeters = 25;
    const dLat = (Math.cos(rad) * stepMeters) / 111320;
    const dLng = (Math.sin(rad) * stepMeters) / (111320 * Math.cos((location.lat * Math.PI) / 180));
    if (onLocationUpdate) {
      onLocationUpdate(location.lat + dLat, location.lng + dLng);
    }
    if (googlePanoRef.current) {
      try {
        googlePanoRef.current.setPosition({ lat: location.lat + dLat, lng: location.lng + dLng });
      } catch {}
    }
  }, [heading, location.lat, location.lng, isUsingGooglePano, onLocationUpdate]);

  // Move Backward along current road heading
  const moveBackward = useCallback(() => {
    sound.playStep();
    setIsStepping(true);
    setTimeout(() => setIsStepping(false), 240);
    setStepOffset((prev) => prev - 1);
    const rad = ((heading + 180) * Math.PI) / 180;
    const stepMeters = 20;
    const dLat = (Math.cos(rad) * stepMeters) / 111320;
    const dLng = (Math.sin(rad) * stepMeters) / (111320 * Math.cos((location.lat * Math.PI) / 180));
    if (onLocationUpdate) {
      onLocationUpdate(location.lat + dLat, location.lng + dLng);
    }
    if (googlePanoRef.current) {
      try {
        googlePanoRef.current.setPosition({ lat: location.lat + dLat, lng: location.lng + dLng });
      } catch {}
    }
  }, [heading, location.lat, location.lng, onLocationUpdate]);

  // Turn Left / Right
  const turnLeft = useCallback((deg = 30) => {
    sound.playClick();
    const newHeading = (heading - deg + 360) % 360;
    setHeading(newHeading);
    if (googlePanoRef.current) {
      const p = googlePanoRef.current.getPov();
      googlePanoRef.current.setPov({ heading: newHeading, pitch: p.pitch });
    }
  }, [heading]);

  const turnRight = useCallback((deg = 30) => {
    sound.playClick();
    const newHeading = (heading + deg) % 360;
    setHeading(newHeading);
    if (googlePanoRef.current) {
      const p = googlePanoRef.current.getPov();
      googlePanoRef.current.setPov({ heading: newHeading, pitch: p.pitch });
    }
  }, [heading]);

  // 1. Mount StreetViewPanorama ONCE when Google Maps API is available
  useEffect(() => {
    let mounted = true;

    const initStreetView = () => {
      if (!mounted || !containerRef.current) return;

      if (typeof window !== 'undefined' && window.google?.maps) {
        if (!googlePanoRef.current) {
          try {
            const pano = new window.google.maps.StreetViewPanorama(containerRef.current, {
              position: { lat: location.lat, lng: location.lng },
              pov: { heading: location.heading, pitch: location.pitch },
              zoom: 1,
              addressControl: false,
              showRoadLabels: false,
              linksControl: true, // Navigation arrows to walk down roads
              panControl: false,
              zoomControl: false,
              enableCloseButton: false,
              motionTracking: false,
              motionTrackingControl: false,
              fullscreenControl: false,
              clickToGo: true,
            });

            pano.addListener('pov_changed', () => {
              const p = pano.getPov();
              if (p) {
                setHeading(Math.round(p.heading) % 360);
                setPitch(Math.round(p.pitch));
              }
            });

            pano.addListener('position_changed', () => {
              const pos = pano.getPosition();
              if (pos && onLocationUpdate) {
                onLocationUpdate(pos.lat(), pos.lng());
              }
            });

            pano.addListener('status_changed', () => {
              const status = pano.getStatus();
              if (status === window.google.maps.StreetViewStatus.OK) {
                isPanoReady.current = true;
                setIsUsingGooglePano(true);
              } else {
                // If quota is exhausted or zero results, seamlessly switch to 360 photosphere
                setIsUsingGooglePano(false);
              }
            });

            googlePanoRef.current = pano;
            isPanoReady.current = true;
          } catch {
            setIsUsingGooglePano(false);
          }
        }
      } else {
        // Polling retry while script injects
        setTimeout(initStreetView, 120);
      }
    };

    const handleQuota = () => {
      setIsUsingGooglePano(false);
    };
    window.addEventListener('gmp-quota-exceeded', handleQuota);

    initStreetView();

    return () => {
      mounted = false;
      window.removeEventListener('gmp-quota-exceeded', handleQuota);
    };
  }, []); // Run ONCE on mount to prevent recreation loops!

  // 2. When location.id changes (new round or random teleport), smoothly update position without recreating the DOM!
  useEffect(() => {
    setHeading(location.heading);
    setPitch(location.pitch);
    setFov(80);
    setStepOffset(0);

    if (googlePanoRef.current && isPanoReady.current) {
      try {
        googlePanoRef.current.setPosition({ lat: location.lat, lng: location.lng });
        googlePanoRef.current.setPov({ heading: location.heading, pitch: location.pitch });
        googlePanoRef.current.setZoom(1);
        googlePanoRef.current.setVisible(true);
        setIsUsingGooglePano(true);
      } catch {
        // fallback active
      }
    }
  }, [location.id]); // ONLY trigger when location ID changes, not on sub-pixel lat/lng ticks!

  // Fallback 360° Photosphere Canvas Renderer (Active when WebGL hardware is initializing or offline)
  useEffect(() => {
    if (isUsingGooglePano) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;

    const renderPhotosphere = () => {
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const horizonY = h / 2 + (pitch * h) / 100;

      // 1. Sky Dome gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
      skyGrad.addColorStop(0, location.theme.skyTop);
      skyGrad.addColorStop(1, location.theme.skyBottom);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, horizonY);

      // 2. Distant Sun / Atmospheric Glow
      const sunScreenX =
        (((location.theme.sunAngle - heading + 360) % 360) / 360) * w * (100 / fov);
      if (sunScreenX > -200 && sunScreenX < w + 200) {
        const sunGrad = ctx.createRadialGradient(
          sunScreenX,
          horizonY * 0.45,
          10,
          sunScreenX,
          horizonY * 0.45,
          180
        );
        sunGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        sunGrad.addColorStop(0.3, 'rgba(254, 240, 138, 0.4)');
        sunGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = sunGrad;
        ctx.fillRect(0, 0, w, horizonY);
      }

      // 3. Distant Treeline & Rolling Hills
      const numPeaks = 36;
      ctx.fillStyle = '#1e3a1e';
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      for (let i = 0; i <= numPeaks; i++) {
        const peakAngle = (i / numPeaks) * 360;
        const screenX = (((peakAngle - heading + 360) % 360) / 360) * w * (100 / fov);
        const peakHeight = Math.sin(i * 1.5) * 25 + Math.cos(i * 3.2) * 15 + 20;
        ctx.lineTo(screenX, horizonY - peakHeight);
      }
      ctx.lineTo(w, horizonY);
      ctx.closePath();
      ctx.fill();

      // 4. Ground: Countryside Green Field & Pastures (matching image_f6366ad4.png)
      const fieldGrad = ctx.createLinearGradient(0, horizonY, 0, h);
      fieldGrad.addColorStop(0, '#3f6212'); // olive/deep green
      fieldGrad.addColorStop(0.35, '#4d7c0f'); // lush grass
      fieldGrad.addColorStop(1, '#15803d');
      ctx.fillStyle = fieldGrad;
      ctx.fillRect(0, horizonY, w, h - horizonY);

      // Furrows in the field (agricultural lines)
      ctx.strokeStyle = 'rgba(25, 45, 10, 0.25)';
      ctx.lineWidth = 2;
      for (let f = -10; f <= 10; f++) {
        const furrowScreenX = (w / 2) + f * (w * 0.15) - (((heading - location.heading) % 360) * w) / (fov * 4);
        ctx.beginPath();
        ctx.moveTo(w / 2, horizonY);
        ctx.lineTo(furrowScreenX * 1.8, h);
        ctx.stroke();
      }

      // 5. Road with Gravel Shoulder converging at horizon (matching image_f6366ad4.png)
      const roadCenterX = w / 2 - (((heading - location.heading) % 360) * w) / (fov * 3);
      
      // Gravel shoulder (light stone/beige texture)
      ctx.fillStyle = '#a8a29e';
      ctx.beginPath();
      ctx.moveTo(roadCenterX - 18, horizonY);
      ctx.lineTo(roadCenterX + 18, horizonY);
      ctx.lineTo(roadCenterX + w * 0.72, h);
      ctx.lineTo(roadCenterX - w * 0.72, h);
      ctx.closePath();
      ctx.fill();

      // Asphalt roadway
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(roadCenterX - 12, horizonY);
      ctx.lineTo(roadCenterX + 12, horizonY);
      ctx.lineTo(roadCenterX + w * 0.55, h);
      ctx.lineTo(roadCenterX - w * 0.55, h);
      ctx.closePath();
      ctx.fill();

      // White solid edge lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(roadCenterX - 12, horizonY);
      ctx.lineTo(roadCenterX - w * 0.52, h);
      ctx.moveTo(roadCenterX + 12, horizonY);
      ctx.lineTo(roadCenterX + w * 0.52, h);
      ctx.stroke();

      // Dashed center line (animated with stepOffset)
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 4;
      ctx.setLineDash([24, 18]);
      ctx.lineDashOffset = -stepOffset * 30;
      ctx.beginPath();
      ctx.moveTo(roadCenterX, horizonY);
      ctx.lineTo(roadCenterX, h);
      ctx.stroke();
      ctx.setLineDash([]);

      // Roadside Utility / Telegraph Poles (iconic GeoGuessr clues)
      for (let p = 1; p <= 5; p++) {
        const poleDistFactor = p / 5;
        const poleY = horizonY + (h - horizonY) * poleDistFactor;
        const poleX = roadCenterX + (w * 0.58) * poleDistFactor;
        const poleH = (h * 0.35) * poleDistFactor;
        
        ctx.fillStyle = '#78350f';
        ctx.fillRect(poleX - 3, poleY - poleH, 6, poleH);
        // crossbeam
        ctx.fillRect(poleX - 16, poleY - poleH + 10, 32, 4);
      }

      // 6. Ambient 3D Landmark Billboards
      location.theme.ambientFeatures.forEach((feat, idx) => {
        const featAngle = (idx * 90 + 45) % 360;
        const screenX = (((featAngle - heading + 360) % 360) / 360) * w;
        if (screenX > 50 && screenX < w - 50) {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
          ctx.lineWidth = 1;

          const cardW = 180;
          const cardH = 34;
          const cardY = horizonY - 60 - (idx % 2) * 30;

          ctx.beginPath();
          ctx.roundRect(screenX - cardW / 2, cardY, cardW, cardH, 8);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#f8fafc';
          ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(feat, screenX, cardY + 21);
        }
      });
    };

    const loop = () => {
      renderPhotosphere();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [heading, pitch, fov, stepOffset, isUsingGooglePano, location]);

  // Pointer dragging on fallback canvas
  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;

    setHeading((prev) => (prev - dx * 0.2 + 360) % 360);
    setPitch((prev) => Math.max(-50, Math.min(50, prev + dy * 0.2)));
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Keyboard navigation shortcuts (Arrow keys & WASD / ZQSD for movement)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        moveForward();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        moveBackward();
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        turnLeft(25);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        turnRight(25);
      } else if (e.key === 'r' || e.key === 'R') {
        resetToSpawn();
      } else if (e.key === 'n' || e.key === 'N') {
        resetToNorth();
      } else if (e.key === 't' || e.key === 'T') {
        handleTeleportClick();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveForward, moveBackward, turnLeft, turnRight, resetToSpawn, resetToNorth, handleTeleportClick]);

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none bg-slate-950 transition-transform duration-200 ${
        isStepping ? 'scale-[1.012]' : 'scale-100'
      }`}
    >
      {/* 1. Official Google Maps Street View Panorama Container (Always active, no re-mount flickers) */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full z-10"
        data-testid="google-street-view-container"
      />

      {/* 2. Instant Photosphere Canvas (Renders smoothly behind Street View tiles) */}
      {!isUsingGooglePano && (
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing touch-none z-0"
        />
      )}

      {/* 3. Hyperspace Warp / Teleport Transition Animation */}
      {isTeleporting && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md pointer-events-none text-white animate-in fade-in zoom-in-95 duration-200">
          <div className="relative flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full border-4 border-cyan-400 border-t-purple-500 animate-spin" />
            <Sparkles className="w-6 h-6 text-amber-300 absolute animate-ping" />
          </div>
          <span className="text-sm font-black tracking-widest uppercase bg-gradient-to-r from-cyan-400 via-purple-300 to-emerald-400 bg-clip-text text-transparent">
            Téléportation Street View...
          </span>
        </div>
      )}

      {/* 4. Floating HUD Controls (Top Left & Left Flank) */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-auto">
        {/* Compass Rose */}
        <button
          onClick={resetToNorth}
          title="Réaligner vers le Nord (0°) [N]"
          className="flex items-center gap-2 bg-slate-900/85 hover:bg-slate-800 text-slate-200 border border-slate-700/60 rounded-full px-3 py-2 shadow-lg backdrop-blur-md transition-all active:scale-95 group cursor-pointer"
        >
          <div
            className="w-6 h-6 flex items-center justify-center transition-transform duration-300"
            style={{ transform: `rotate(${-heading}deg)` }}
          >
            <Compass className="w-5 h-5 text-rose-500 group-hover:text-rose-400" />
          </div>
          <span className="text-xs font-mono font-bold tracking-wider text-slate-300">
            {Math.round(heading)}° {heading > 315 || heading <= 45 ? 'N' : heading <= 135 ? 'E' : heading <= 225 ? 'S' : 'O'}
          </span>
        </button>

        {/* Reset to Spawn button */}
        <button
          onClick={resetToSpawn}
          title="Retour au point de départ [R]"
          className="flex items-center gap-2 bg-slate-900/85 hover:bg-slate-800 text-slate-200 border border-slate-700/60 rounded-full px-3 py-2 shadow-lg backdrop-blur-md transition-all active:scale-95 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold">Départ [R]</span>
        </button>

        {/* Random Teleport Button (Il m'envoie au hasard !) */}
        {onRandomTeleport && (
          <button
            onClick={handleTeleportClick}
            title="Sauter vers un nouvel endroit aléatoire dans le monde [T]"
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600/90 to-indigo-600/90 hover:from-purple-500 hover:to-indigo-500 text-white border border-purple-400/50 rounded-full px-3 py-2 shadow-lg backdrop-blur-md transition-all active:scale-95 cursor-pointer"
          >
            <Dices className="w-4 h-4 text-amber-300" />
            <span className="text-xs font-bold">Spot Aléatoire [T]</span>
          </button>
        )}
      </div>

      {/* Zoom and ambience buttons in top-right */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2 pointer-events-auto">
        {/* Ambient Wind Audio Synthesizer */}
        <button
          onClick={handleToggleAmbience}
          title={isAmbienceOn ? "Désactiver le vent d'ambiance" : "Activer le vent sonore d'ambiance"}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold shadow-lg backdrop-blur-md transition-all cursor-pointer ${
            isAmbienceOn
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
              : 'bg-slate-900/85 border-slate-700/60 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Wind className={`w-4 h-4 ${isAmbienceOn ? 'animate-pulse text-cyan-300' : ''}`} />
          <span className="hidden sm:inline">Ambiance</span>
        </button>

        <button
          onClick={() => handleZoom(-1)}
          title="Zoom avant"
          className="w-9 h-9 rounded-lg bg-slate-900/85 hover:bg-slate-800 text-slate-200 border border-slate-700/60 flex items-center justify-center shadow-lg backdrop-blur-md transition-all active:scale-95 cursor-pointer"
        >
          <ZoomIn className="w-4 h-4 text-cyan-400" />
        </button>
        <button
          onClick={() => handleZoom(1)}
          title="Zoom arrière"
          className="w-9 h-9 rounded-lg bg-slate-900/85 hover:bg-slate-800 text-slate-200 border border-slate-700/60 flex items-center justify-center shadow-lg backdrop-blur-md transition-all active:scale-95 cursor-pointer"
        >
          <ZoomOut className="w-4 h-4 text-cyan-400" />
        </button>

        {/* Practice Clue Toggle */}
        <button
          onClick={() => {
            sound.playClick();
            setShowClue(!showClue);
          }}
          title="Afficher/Masquer les indices géographiques"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold shadow-lg backdrop-blur-md transition-all cursor-pointer ${
            showClue
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
              : 'bg-slate-900/85 border-slate-700/60 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>Indice</span>
          {showClue ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Clues Floating Drawer */}
      {showClue && (
        <div className="absolute top-16 right-4 z-20 max-w-xs bg-slate-900/95 border border-amber-500/40 rounded-xl p-3.5 shadow-2xl backdrop-blur-md text-xs text-slate-200 pointer-events-auto space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="font-bold text-amber-400 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            <span>Indices Géographiques</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
            <div className="bg-slate-800/80 p-2 rounded">
              <span className="text-slate-400 block text-[10px]">Côté de conduite :</span>
              <span className="font-bold text-white">{location.clues.drivingSide}</span>
            </div>
            <div className="bg-slate-800/80 p-2 rounded">
              <span className="text-slate-400 block text-[10px]">Continent :</span>
              <span className="font-bold text-white">{location.clues.continent}</span>
            </div>
          </div>
          <div className="bg-slate-800/80 p-2 rounded text-[11px]">
            <span className="text-slate-400 block text-[10px]">Paysage & Végétation :</span>
            <span className="text-slate-200">{location.clues.landscape}</span>
          </div>
        </div>
      )}

      {/* 5. On-Screen Navigation Arrows Pad (Flèches pour avancer dans le monde) */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 pointer-events-auto select-none">
        {/* Forward Arrow (Avancer sur la route) */}
        <button
          onClick={moveForward}
          title="Avancer dans le monde [Flèche Haut / Z / W]"
          className="group flex flex-col items-center justify-center px-4 py-2 rounded-2xl bg-slate-900/90 hover:bg-cyan-600 active:scale-95 text-white border-2 border-cyan-400/60 shadow-2xl backdrop-blur-md transition-all cursor-pointer"
        >
          <ChevronUp className="w-6 h-6 text-cyan-300 group-hover:text-white group-hover:-translate-y-0.5 transition-transform" />
          <span className="text-[10px] font-black tracking-wider text-cyan-200 group-hover:text-white -mt-0.5">
            AVANCER [▲]
          </span>
        </button>

        {/* Turn Left, Backward, Turn Right Row */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => turnLeft(25)}
            title="Pivoter à gauche [Flèche Gauche / Q / A]"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900/85 hover:bg-slate-800 active:scale-95 text-slate-300 hover:text-white border border-slate-700/60 shadow-lg backdrop-blur-md transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] font-semibold">[◄]</span>
          </button>

          <button
            onClick={moveBackward}
            title="Reculer sur la route [Flèche Bas / S]"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900/85 hover:bg-slate-800 active:scale-95 text-slate-300 hover:text-white border border-slate-700/60 shadow-lg backdrop-blur-md transition-all cursor-pointer"
          >
            <ChevronDown className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] font-semibold">RECULER [▼]</span>
          </button>

          <button
            onClick={() => turnRight(25)}
            title="Pivoter à droite [Flèche Droite / D]"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900/85 hover:bg-slate-800 active:scale-95 text-slate-300 hover:text-white border border-slate-700/60 shadow-lg backdrop-blur-md transition-all cursor-pointer"
          >
            <span className="text-[10px] font-semibold">[►]</span>
            <ChevronRight className="w-4 h-4 text-cyan-400" />
          </button>
        </div>
      </div>

      {/* Street View Status Pill & Stepping Odometer */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 pointer-events-none">
        <div className="bg-slate-900/85 border border-slate-700/50 px-3 py-1.5 rounded-full text-[11px] text-slate-300 font-medium flex items-center gap-2 backdrop-blur-md shadow-md">
          <span className={`w-2 h-2 rounded-full ${isUsingGooglePano ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'}`} />
          <span>{isUsingGooglePano ? 'Google Street View 360° Actif' : 'Street View 360°'}</span>
        </div>
        {Math.abs(stepOffset) > 0 && (
          <div className="bg-cyan-950/85 border border-cyan-500/40 text-cyan-300 px-3 py-1.5 rounded-full text-[11px] font-mono font-bold tracking-wider backdrop-blur-md shadow-md flex items-center gap-1.5 animate-in fade-in duration-200">
            <Move className="w-3.5 h-3.5 text-cyan-400" />
            <span>{Math.abs(stepOffset) * 25} m parcourus</span>
          </div>
        )}
      </div>
    </div>
  );
}
