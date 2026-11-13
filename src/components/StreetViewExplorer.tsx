import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  Compass,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Dices,
  HelpCircle,
  Eye,
  EyeOff,
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
  const streetViewLib = useMapsLibrary('streetView');

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const googlePanoRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const onLocationUpdateRef = useRef(onLocationUpdate);
  onLocationUpdateRef.current = onLocationUpdate;

  const [heading, setHeading] = useState(location.heading);
  const [pitch, setPitch] = useState(location.pitch);
  const [fov, setFov] = useState(80);
  const [stepOffset, setStepOffset] = useState(0);
  const [showClue, setShowClue] = useState(false);
  const [isUsingGooglePano, setIsUsingGooglePano] = useState(false);
  const [isTeleporting, setIsTeleporting] = useState(false);
  const [isAmbienceOn, setIsAmbienceOn] = useState(false);

  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const handleToggleAmbience = () => {
    const active = sound.toggleAmbience();
    setIsAmbienceOn(active);
  };

  const handleTeleportClick = useCallback(() => {
    sound.playTeleport();
    setIsTeleporting(true);
    if (onRandomTeleport) onRandomTeleport();
    setTimeout(() => setIsTeleporting(false), 350);
  }, [onRandomTeleport]);

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

  const resetToNorth = useCallback(() => {
    sound.playClick();
    setHeading(0);
    if (googlePanoRef.current) {
      const currentPov = googlePanoRef.current.getPov();
      googlePanoRef.current.setPov({ heading: 0, pitch: currentPov.pitch });
    }
  }, []);

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

  const moveForward = useCallback(() => {
    sound.playStep();
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
    onLocationUpdateRef.current?.(location.lat + dLat, location.lng + dLng);
    if (googlePanoRef.current) {
      try {
        googlePanoRef.current.setPosition({ lat: location.lat + dLat, lng: location.lng + dLng });
      } catch {}
    }
  }, [heading, location.lat, location.lng, isUsingGooglePano]);

  const moveBackward = useCallback(() => {
    sound.playStep();
    setStepOffset((prev) => prev - 1);
    const rad = ((heading + 180) * Math.PI) / 180;
    const stepMeters = 20;
    const dLat = (Math.cos(rad) * stepMeters) / 111320;
    const dLng = (Math.sin(rad) * stepMeters) / (111320 * Math.cos((location.lat * Math.PI) / 180));
    onLocationUpdateRef.current?.(location.lat + dLat, location.lng + dLng);
    if (googlePanoRef.current) {
      try {
        googlePanoRef.current.setPosition({ lat: location.lat + dLat, lng: location.lng + dLng });
      } catch {}
    }
  }, [heading, location.lat, location.lng]);

  const turnLeft = useCallback(
    (deg = 30) => {
      sound.playClick();
      const newHeading = (heading - deg + 360) % 360;
      setHeading(newHeading);
      if (googlePanoRef.current) {
        const p = googlePanoRef.current.getPov();
        googlePanoRef.current.setPov({ heading: newHeading, pitch: p.pitch });
      }
    },
    [heading]
  );

  const turnRight = useCallback(
    (deg = 30) => {
      sound.playClick();
      const newHeading = (heading + deg) % 360;
      setHeading(newHeading);
      if (googlePanoRef.current) {
        const p = googlePanoRef.current.getPov();
        googlePanoRef.current.setPov({ heading: newHeading, pitch: p.pitch });
      }
    },
    [heading]
  );

  // Initialize and update Google Street View Panorama cleanly as soon as streetView library loads OR location changes
  useEffect(() => {
    setHeading(location.heading);
    setPitch(location.pitch);
    setFov(80);
    setStepOffset(0);

    if (!streetViewLib || !containerRef.current) return;
    let cancelled = false;

    if (!googlePanoRef.current) {
      try {
        const pano = new streetViewLib.StreetViewPanorama(containerRef.current, {
          position: { lat: location.lat, lng: location.lng },
          pov: { heading: location.heading, pitch: location.pitch },
          zoom: 1,
          addressControl: false,
          showRoadLabels: false,
          linksControl: true,
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
          if (pos) {
            onLocationUpdateRef.current?.(pos.lat(), pos.lng());
          }
        });

        pano.addListener('status_changed', () => {
          const status = pano.getStatus();
          if (status === streetViewLib.StreetViewStatus.OK) {
            setIsUsingGooglePano(true);
          } else {
            setIsUsingGooglePano(false);
          }
        });

        googlePanoRef.current = pano;
      } catch {
        setIsUsingGooglePano(false);
        return;
      }
    }

    try {
      const svService = new streetViewLib.StreetViewService();
      svService.getPanorama(
        {
          location: { lat: location.lat, lng: location.lng },
          radius: 50000,
          source: streetViewLib.StreetViewSource.OUTDOOR,
          preference: streetViewLib.StreetViewPreference.NEAREST,
        },
        (data, status) => {
          if (cancelled || !googlePanoRef.current) return;
          if (status === streetViewLib.StreetViewStatus.OK && data?.location?.latLng) {
            const actualLat = data.location.latLng.lat();
            const actualLng = data.location.latLng.lng();
            if (data.location.pano) {
              googlePanoRef.current.setPano(data.location.pano);
            } else {
              googlePanoRef.current.setPosition({ lat: actualLat, lng: actualLng });
            }
            googlePanoRef.current.setPov({ heading: location.heading, pitch: location.pitch });
            googlePanoRef.current.setZoom(1);
            googlePanoRef.current.setVisible(true);
            setIsUsingGooglePano(true);
            onLocationUpdateRef.current?.(actualLat, actualLng);
          } else {
            googlePanoRef.current.setPosition({ lat: location.lat, lng: location.lng });
            googlePanoRef.current.setPov({ heading: location.heading, pitch: location.pitch });
            googlePanoRef.current.setZoom(1);
            googlePanoRef.current.setVisible(true);
          }
        }
      );
    } catch {}

    const handleQuota = () => setIsUsingGooglePano(false);
    window.addEventListener('gmp-quota-exceeded', handleQuota);

    return () => {
      cancelled = true;
      window.removeEventListener('gmp-quota-exceeded', handleQuota);
    };
  }, [streetViewLib, location.id, location.lat, location.lng, location.heading, location.pitch]);

  // Fallback 360 Photosphere Canvas
  useEffect(() => {
    if (isUsingGooglePano) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderPhotosphere = () => {
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const horizonY = h / 2 + (pitch * h) / 100;
      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
      skyGrad.addColorStop(0, location.theme.skyTop);
      skyGrad.addColorStop(1, location.theme.skyBottom);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, horizonY);

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

      const fieldGrad = ctx.createLinearGradient(0, horizonY, 0, h);
      fieldGrad.addColorStop(0, '#3f6212');
      fieldGrad.addColorStop(0.35, '#4d7c0f');
      fieldGrad.addColorStop(1, '#15803d');
      ctx.fillStyle = fieldGrad;
      ctx.fillRect(0, horizonY, w, h - horizonY);

      const roadCenterX = w / 2 - (((heading - location.heading) % 360) * w) / (fov * 3);

      ctx.fillStyle = '#a8a29e';
      ctx.beginPath();
      ctx.moveTo(roadCenterX - 18, horizonY);
      ctx.lineTo(roadCenterX + 18, horizonY);
      ctx.lineTo(roadCenterX + w * 0.72, h);
      ctx.lineTo(roadCenterX - w * 0.72, h);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(roadCenterX - 12, horizonY);
      ctx.lineTo(roadCenterX + 12, horizonY);
      ctx.lineTo(roadCenterX + w * 0.55, h);
      ctx.lineTo(roadCenterX - w * 0.55, h);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(roadCenterX - 12, horizonY);
      ctx.lineTo(roadCenterX - w * 0.52, h);
      ctx.moveTo(roadCenterX + 12, horizonY);
      ctx.lineTo(roadCenterX + w * 0.52, h);
      ctx.stroke();

      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 4;
      ctx.setLineDash([24, 18]);
      ctx.lineDashOffset = -stepOffset * 30;
      ctx.beginPath();
      ctx.moveTo(roadCenterX, horizonY);
      ctx.lineTo(roadCenterX, h);
      ctx.stroke();
      ctx.setLineDash([]);

      for (let p = 1; p <= 5; p++) {
        const poleDistFactor = p / 5;
        const poleY = horizonY + (h - horizonY) * poleDistFactor;
        const poleX = roadCenterX + w * 0.58 * poleDistFactor;
        const poleH = h * 0.35 * poleDistFactor;
        ctx.fillStyle = '#78350f';
        ctx.fillRect(poleX - 3, poleY - poleH, 6, poleH);
        ctx.fillRect(poleX - 16, poleY - poleH + 10, 32, 4);
      }
    };

    const rafId = requestAnimationFrame(renderPhotosphere);
    const onResize = () => requestAnimationFrame(renderPhotosphere);
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
    };
  }, [heading, pitch, fov, stepOffset, isUsingGooglePano, location]);

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
    <div className="relative w-full h-full overflow-hidden select-none bg-[#07090F]">
      <div
        ref={containerRef}
        className={`absolute inset-0 w-full h-full ${isUsingGooglePano ? 'z-10' : 'z-0 opacity-0 pointer-events-none'}`}
        data-testid="google-street-view-container"
      />

      {!isUsingGooglePano && (
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing touch-none z-5"
        />
      )}

      {isTeleporting && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#07090F]/85 pointer-events-none text-white">
          <div className="w-12 h-12 rounded-full border-4 border-cyan-400 border-t-amber-400 animate-spin mb-3" />
          <span className="text-xs font-bold tracking-wider uppercase text-cyan-300">
            Téléportation en cours...
          </span>
        </div>
      )}

      {/* Left Flank Street View Controls */}
      <div className="absolute top-20 left-4 z-20 flex flex-col gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={resetToNorth}
          title="Réaligner vers le Nord [N]"
          className="flex items-center gap-2 bg-[#0E131D]/92 hover:bg-[#151D2B] text-slate-200 border border-white/12 rounded-xl px-3 py-2 shadow-xl transition-colors cursor-pointer"
        >
          <div
            className="w-5 h-5 flex items-center justify-center transition-transform duration-200"
            style={{ transform: `rotate(${-heading}deg)` }}
          >
            <Compass className="w-4 h-4 text-rose-400" />
          </div>
          <span className="text-xs font-mono-numbers font-bold text-slate-200">
            {Math.round(heading)}° {heading > 315 || heading <= 45 ? 'N' : heading <= 135 ? 'E' : heading <= 225 ? 'S' : 'O'}
          </span>
        </button>

        <button
          type="button"
          onClick={resetToSpawn}
          title="Retour au point de départ [R]"
          className="flex items-center gap-2 bg-[#0E131D]/92 hover:bg-[#151D2B] text-slate-200 border border-white/12 rounded-xl px-3 py-2 shadow-xl transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold">Départ [R]</span>
        </button>

        {onRandomTeleport && (
          <button
            type="button"
            onClick={handleTeleportClick}
            title="Sauter vers un nouvel endroit aléatoire [T]"
            className="flex items-center gap-2 bg-[#0E131D]/92 hover:bg-[#151D2B] text-amber-300 border border-amber-400/35 rounded-xl px-3 py-2 shadow-xl transition-colors cursor-pointer"
          >
            <Dices className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold">Spot Aléatoire [T]</span>
          </button>
        )}
      </div>

      {/* Top Right Street View Tools */}
      <div className="absolute top-20 right-4 z-20 flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={handleToggleAmbience}
          aria-label="Activer ou couper le vent d’ambiance"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold shadow-xl transition-colors cursor-pointer ${
            isAmbienceOn
              ? 'bg-cyan-400/20 border-cyan-400 text-cyan-300'
              : 'bg-[#0E131D]/92 border-white/12 text-slate-200 hover:bg-[#151D2B]'
          }`}
        >
          <Wind className="w-4 h-4" />
          <span className="hidden sm:inline">Ambiance</span>
        </button>

        <button
          type="button"
          onClick={() => handleZoom(-1)}
          aria-label="Zoom avant Street View"
          className="w-9 h-9 rounded-xl bg-[#0E131D]/92 hover:bg-[#151D2B] text-cyan-400 border border-white/12 flex items-center justify-center shadow-xl cursor-pointer"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => handleZoom(1)}
          aria-label="Zoom arrière Street View"
          className="w-9 h-9 rounded-xl bg-[#0E131D]/92 hover:bg-[#151D2B] text-cyan-400 border border-white/12 flex items-center justify-center shadow-xl cursor-pointer"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            sound.playClick();
            setShowClue(!showClue);
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold shadow-xl transition-colors cursor-pointer ${
            showClue
              ? 'bg-amber-400/20 border-amber-400/50 text-amber-300'
              : 'bg-[#0E131D]/92 border-white/12 text-slate-200 hover:bg-[#151D2B]'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>Indice</span>
          {showClue ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>

      {showClue && (
        <div className="absolute top-32 right-4 z-20 max-w-xs bg-[#0E131D] border border-amber-400/40 rounded-xl p-3.5 shadow-2xl text-xs text-slate-200 pointer-events-auto space-y-2">
          <div className="font-bold text-amber-300">Indices Géographiques</div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-[#07090F] p-2 rounded-lg border border-white/10">
              <span className="text-slate-400 block">Conduite</span>
              <span className="font-bold text-white">{location.clues.drivingSide}</span>
            </div>
            <div className="bg-[#07090F] p-2 rounded-lg border border-white/10">
              <span className="text-slate-400 block">Continent</span>
              <span className="font-bold text-white">{location.clues.continent}</span>
            </div>
          </div>
          <div className="bg-[#07090F] p-2 rounded-lg border border-white/10 text-[11px]">
            <span className="text-slate-400 block">Paysage</span>
            <span className="text-slate-200">{location.clues.landscape}</span>
          </div>
        </div>
      )}

      {/* Navigation Directional Controls */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 pointer-events-auto select-none">
        <button
          type="button"
          onClick={moveForward}
          aria-label="Avancer sur la route"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0E131D]/92 hover:bg-cyan-400 hover:text-slate-950 text-cyan-300 border border-cyan-400/50 shadow-xl transition-colors cursor-pointer text-xs font-bold"
        >
          <ChevronUp className="w-4 h-4" />
          <span>AVANCER</span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => turnLeft(25)}
            aria-label="Pivoter à gauche"
            className="px-3 py-1.5 rounded-xl bg-[#0E131D]/92 hover:bg-[#151D2B] text-slate-200 border border-white/12 shadow-xl cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 text-cyan-400" />
          </button>

          <button
            type="button"
            onClick={moveBackward}
            aria-label="Reculer sur la route"
            className="px-3 py-1.5 rounded-xl bg-[#0E131D]/92 hover:bg-[#151D2B] text-slate-200 border border-white/12 shadow-xl cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
          >
            <ChevronDown className="w-4 h-4 text-cyan-400" />
            <span>RECULER</span>
          </button>

          <button
            type="button"
            onClick={() => turnRight(25)}
            aria-label="Pivoter à droite"
            className="px-3 py-1.5 rounded-xl bg-[#0E131D]/92 hover:bg-[#151D2B] text-slate-200 border border-white/12 shadow-xl cursor-pointer"
          >
            <ChevronRight className="w-4 h-4 text-cyan-400" />
          </button>
        </div>
      </div>

      {/* Bottom-left Street View Engine Indicator & Odometer */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 pointer-events-none">
        <div className="bg-[#0E131D]/92 border border-white/12 px-3 py-1.5 rounded-xl text-[11px] text-slate-300 font-medium shadow-xl">
          {isUsingGooglePano ? 'Google Street View 360°' : 'Panorama 360°'}
        </div>
        {Math.abs(stepOffset) > 0 && (
          <div className="bg-[#0E131D]/92 border border-cyan-400/40 text-cyan-300 px-3 py-1.5 rounded-xl text-[11px] font-mono-numbers font-bold shadow-xl flex items-center gap-1.5">
            <Move className="w-3.5 h-3.5 text-cyan-400" />
            <span>{Math.abs(stepOffset) * 25} m</span>
          </div>
        )}
      </div>
    </div>
  );
}
