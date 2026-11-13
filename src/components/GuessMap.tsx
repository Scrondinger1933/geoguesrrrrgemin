import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import L from 'leaflet';
import {
  Flag,
  Send,
  Navigation,
  Expand,
  Shrink,
  Crosshair,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { LatLng } from '../game/rules';
import { sound } from '../utils/audio';

interface GuessMapProps {
  apiKey?: string;
  onGuessSubmit: (guess: LatLng) => void;
  disabled?: boolean;
  isQuotaExceeded?: boolean;
}

type GoogleMapType = 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
type MapSizeState = 'compact' | 'expanded' | 'fullscreen';

const QUICK_REGIONS = [
  { name: 'Europe', coords: { lat: 48, lng: 15 }, zoom: 4 },
  { name: 'Am. Nord', coords: { lat: 42, lng: -98 }, zoom: 3 },
  { name: 'Am. Sud', coords: { lat: -15, lng: -60 }, zoom: 3 },
  { name: 'Asie', coords: { lat: 35, lng: 105 }, zoom: 3 },
  { name: 'Afrique', coords: { lat: 5, lng: 20 }, zoom: 3 },
  { name: 'Océanie', coords: { lat: -25, lng: 135 }, zoom: 4 },
];

const FLAG_SVG_HTML = `
  <div class="geo-flag-pin-root" style="position: relative; width: 44px; height: 48px; pointer-events: auto; cursor: grab;">
    <div class="geo-flag-ripple" style="position: absolute; left: 22px; top: 45px; width: 16px; height: 16px; border-radius: 9999px; border: 2px solid #F43F5E; background: rgba(244, 63, 94, 0.25);"></div>
    <div style="position: absolute; left: 17px; top: 43px; width: 10px; height: 5px; border-radius: 9999px; background: rgba(0,0,0,0.55); filter: blur(1px);"></div>
    <div class="geo-flag-drop" style="position: relative; width: 44px; height: 48px;">
      <svg viewBox="0 0 44 48" width="44" height="48" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 8px rgba(0,0,0,0.65)); overflow: visible;">
        <circle cx="22" cy="45" r="3.2" fill="#F43F5E" stroke="#FFFFFF" stroke-width="1.5"/>
        <rect x="20.5" y="7" width="3" height="38" rx="1.5" fill="#F8FAFC" stroke="#0F172A" stroke-width="0.8"/>
        <circle cx="22" cy="6.5" r="2.8" fill="#F59E0B" stroke="#0F172A" stroke-width="0.9"/>
        <g class="geo-flag-wave" style="transform-origin: 22px 14px;">
          <path d="M23.5 8.5C28.5 6.5 34 11 40 8.5C41.8 7.7 43 8.2 43.8 9L41 14.5L43.8 20C42.2 21 39.8 20.8 37.5 19.8C32 17.4 28 21.6 23.5 19.8V8.5Z" fill="#F43F5E" stroke="#FFFFFF" stroke-width="1.4" stroke-linejoin="round"/>
          <circle cx="31.5" cy="14.2" r="2.4" fill="#FFFFFF"/>
          <circle cx="31.5" cy="14.2" r="1.1" fill="#F43F5E"/>
        </g>
      </svg>
    </div>
  </div>
`;

const createAdvancedFlagElement = (): HTMLDivElement => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = FLAG_SVG_HTML.trim();
  const node = wrapper.firstElementChild as HTMLDivElement;
  return node || wrapper;
};

const triggerFlagDropAnimation = (el: HTMLElement | null) => {
  if (!el) return;
  const dropEl = el.querySelector('.geo-flag-drop') as HTMLElement | null;
  if (!dropEl) return;
  dropEl.classList.remove('geo-flag-drop');
  void dropEl.offsetWidth;
  dropEl.classList.add('geo-flag-drop');
};

const createLeafletFlagIcon = () => {
  return L.divIcon({
    className: 'custom-geoapex-flag-pin',
    html: `
      <div style="position: relative; width: 44px; height: 48px;">
        <div class="geo-flag-ripple" style="position: absolute; left: 22px; top: 45px; width: 16px; height: 16px; border-radius: 9999px; border: 2px solid #F43F5E; background: rgba(244, 63, 94, 0.25);"></div>
        <div class="geo-flag-drop" style="position: relative; width: 44px; height: 48px;">
          <svg viewBox="0 0 44 48" width="44" height="48" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 8px rgba(0,0,0,0.65)); overflow: visible;">
            <circle cx="22" cy="45" r="3.2" fill="#F43F5E" stroke="#FFFFFF" stroke-width="1.5"/>
            <rect x="20.5" y="7" width="3" height="38" rx="1.5" fill="#F8FAFC" stroke="#0F172A" stroke-width="0.8"/>
            <circle cx="22" cy="6.5" r="2.8" fill="#F59E0B" stroke="#0F172A" stroke-width="0.9"/>
            <g class="geo-flag-wave" style="transform-origin: 22px 14px;">
              <path d="M23.5 8.5C28.5 6.5 34 11 40 8.5C41.8 7.7 43 8.2 43.8 9L41 14.5L43.8 20C42.2 21 39.8 20.8 37.5 19.8C32 17.4 28 21.6 23.5 19.8V8.5Z" fill="#F43F5E" stroke="#FFFFFF" stroke-width="1.4" stroke-linejoin="round"/>
              <circle cx="31.5" cy="14.2" r="2.4" fill="#FFFFFF"/>
              <circle cx="31.5" cy="14.2" r="1.1" fill="#F43F5E"/>
            </g>
          </svg>
        </div>
      </div>
    `,
    iconSize: [44, 48],
    iconAnchor: [22, 45],
  });
};

function readLatLngLiteral(pos: google.maps.LatLng | google.maps.LatLngLiteral | null | undefined): LatLng | null {
  if (!pos) return null;
  const lat = typeof pos.lat === 'function' ? pos.lat() : pos.lat;
  const lng = typeof pos.lng === 'function' ? pos.lng() : pos.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return { lat, lng };
}

export function GuessMap({
  apiKey = '',
  onGuessSubmit,
  disabled = false,
  isQuotaExceeded = false,
}: GuessMapProps) {
  const mapsLib = useMapsLibrary('maps');
  const markerLib = useMapsLibrary('marker');

  const [sizeState, setSizeState] = useState<MapSizeState>('compact');
  const [selectedPoint, setSelectedPoint] = useState<LatLng | null>(null);
  const [mapType, setMapType] = useState<GoogleMapType>('roadmap');
  const [allowFallback, setAllowFallback] = useState(!apiKey || isQuotaExceeded);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const googleMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const googleMarkerElRef = useRef<HTMLDivElement | null>(null);
  const googleCirclesRef = useRef<google.maps.Circle[]>([]);

  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletMarkerRef = useRef<L.Marker | null>(null);
  const leafletCirclesRef = useRef<L.Circle[]>([]);

  useEffect(() => {
    if (!apiKey || isQuotaExceeded) {
      setAllowFallback(true);
      return;
    }
    if (mapsLib && markerLib) {
      setAllowFallback(false);
      return;
    }
    const timeout = window.setTimeout(() => {
      setAllowFallback(true);
    }, 2800);
    return () => window.clearTimeout(timeout);
  }, [apiKey, isQuotaExceeded, mapsLib, markerLib]);

  const clearDistanceCircles = useCallback(() => {
    googleCirclesRef.current.forEach((c) => c.setMap(null));
    googleCirclesRef.current = [];
    if (leafletMapRef.current) {
      leafletCirclesRef.current.forEach((c) => leafletMapRef.current?.removeLayer(c));
    }
    leafletCirclesRef.current = [];
  }, []);

  const updateDistanceCircles = useCallback(
    (lat: number, lng: number) => {
      clearDistanceCircles();

      if (googleMapRef.current && mapsLib) {
        const c1 = new mapsLib.Circle({
          map: googleMapRef.current,
          center: { lat, lng },
          radius: 500000,
          strokeColor: '#F43F5E',
          strokeOpacity: 0.85,
          strokeWeight: 1.5,
          fillColor: '#F43F5E',
          fillOpacity: 0.05,
          clickable: false,
        });

        const c2 = new mapsLib.Circle({
          map: googleMapRef.current,
          center: { lat, lng },
          radius: 1500000,
          strokeColor: '#22D3EE',
          strokeOpacity: 0.75,
          strokeWeight: 1.2,
          fillColor: '#22D3EE',
          fillOpacity: 0.03,
          clickable: false,
        });

        googleCirclesRef.current = [c1, c2];
      }

      if (leafletMapRef.current) {
        const c1 = L.circle([lat, lng], {
          radius: 500000,
          color: '#F43F5E',
          weight: 1.5,
          dashArray: '5, 5',
          fill: true,
          fillColor: '#F43F5E',
          fillOpacity: 0.04,
        }).addTo(leafletMapRef.current);

        const c2 = L.circle([lat, lng], {
          radius: 1500000,
          color: '#22D3EE',
          weight: 1.2,
          dashArray: '6, 6',
          fill: false,
        }).addTo(leafletMapRef.current);

        leafletCirclesRef.current = [c1, c2];
      }
    },
    [clearDistanceCircles, mapsLib]
  );

  // Initialize Genuine Google Maps (preferred)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (isQuotaExceeded || !apiKey || !mapsLib || !markerLib) return;
    if (googleMapRef.current) return;

    // Tear down temporary Leaflet instance if Google Maps finished loading
    if (leafletMapRef.current) {
      leafletCirclesRef.current.forEach((c) => leafletMapRef.current?.removeLayer(c));
      leafletCirclesRef.current = [];
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
      leafletMarkerRef.current = null;
      mapContainerRef.current.innerHTML = '';
    }

    try {
      const mapOptions: google.maps.MapOptions & {
        internalUsageAttributionIds?: string[];
      } = {
        center: { lat: 25, lng: 10 },
        zoom: 2,
        minZoom: 1,
        maxZoom: 21,
        mapId: 'DEMO_MAP_ID',
        mapTypeId: mapsLib.MapTypeId.ROADMAP,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        zoomControl: false,
        clickableIcons: false,
        gestureHandling: 'greedy',
        draggableCursor: 'crosshair',
        draggingCursor: 'grabbing',
        backgroundColor: '#070B14',
        internalUsageAttributionIds: ['gmp_git_agentskills_v1'],
      };

      const gMap = new mapsLib.Map(mapContainerRef.current, mapOptions);

      gMap.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        const lat = parseFloat(e.latLng.lat().toFixed(6));
        const lng = parseFloat(e.latLng.lng().toFixed(6));

        sound.playPinDrop();
        setSelectedPoint({ lat, lng });
        updateDistanceCircles(lat, lng);

        if (googleMarkerRef.current) {
          googleMarkerRef.current.position = { lat, lng };
          triggerFlagDropAnimation(googleMarkerElRef.current);
        } else {
          const flagEl = createAdvancedFlagElement();
          googleMarkerElRef.current = flagEl;
          const marker = new markerLib.AdvancedMarkerElement({
            position: { lat, lng },
            map: gMap,
            content: flagEl,
            gmpDraggable: true,
            title: 'Votre drapeau',
          });

          marker.addEventListener('gmp-drag', () => {
            const pos = readLatLngLiteral(marker.position);
            if (pos) updateDistanceCircles(pos.lat, pos.lng);
          });

          marker.addEventListener('gmp-dragend', () => {
            const pos = readLatLngLiteral(marker.position);
            if (pos) {
              sound.playPinDrop();
              const newPt = {
                lat: parseFloat(pos.lat.toFixed(6)),
                lng: parseFloat(pos.lng.toFixed(6)),
              };
              setSelectedPoint(newPt);
              updateDistanceCircles(newPt.lat, newPt.lng);
              triggerFlagDropAnimation(googleMarkerElRef.current);
            }
          });

          googleMarkerRef.current = marker;
        }
      });

      googleMapRef.current = gMap;

      return () => {
        clearDistanceCircles();
        if (googleMarkerRef.current) {
          googleMarkerRef.current.map = null;
          googleMarkerRef.current = null;
        }
        googleMarkerElRef.current = null;
        googleMapRef.current = null;
      };
    } catch {
      setAllowFallback(true);
    }
  }, [apiKey, isQuotaExceeded, mapsLib, markerLib, clearDistanceCircles, updateDistanceCircles]);

  // Fallback Leaflet map ONLY if Google Maps is unavailable or quota exceeded
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (googleMapRef.current || leafletMapRef.current) return;
    if (!allowFallback) return;

    const map = L.map(mapContainerRef.current, {
      center: [25, 10],
      zoom: 2,
      minZoom: 1,
      maxZoom: 19,
      zoomControl: false,
      attributionControl: true,
      worldCopyJump: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      subdomains: ['a', 'b', 'c'],
      maxZoom: 19,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      const lat = parseFloat(e.latlng.lat.toFixed(6));
      const lng = parseFloat(e.latlng.lng.toFixed(6));

      sound.playPinDrop();
      setSelectedPoint({ lat, lng });
      updateDistanceCircles(lat, lng);

      if (leafletMarkerRef.current) {
        leafletMarkerRef.current.setLatLng([lat, lng]);
        leafletMarkerRef.current.setIcon(createLeafletFlagIcon());
      } else {
        const marker = L.marker([lat, lng], {
          icon: createLeafletFlagIcon(),
          draggable: true,
        }).addTo(map);

        marker.on('drag', () => {
          const pos = marker.getLatLng();
          updateDistanceCircles(pos.lat, pos.lng);
        });

        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          sound.playPinDrop();
          const newPt = {
            lat: parseFloat(pos.lat.toFixed(6)),
            lng: parseFloat(pos.lng.toFixed(6)),
          };
          setSelectedPoint(newPt);
          updateDistanceCircles(newPt.lat, newPt.lng);
        });

        leafletMarkerRef.current = marker;
      }
    });

    leafletMapRef.current = map;

    return () => {
      clearDistanceCircles();
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        leafletMarkerRef.current = null;
      }
    };
  }, [allowFallback, clearDistanceCircles, updateDistanceCircles]);

  const handleMapTypeChange = (type: GoogleMapType) => {
    sound.playClick();
    setMapType(type);
    if (googleMapRef.current && mapsLib) {
      if (type === 'roadmap') googleMapRef.current.setMapTypeId(mapsLib.MapTypeId.ROADMAP);
      if (type === 'satellite') googleMapRef.current.setMapTypeId(mapsLib.MapTypeId.SATELLITE);
      if (type === 'hybrid') googleMapRef.current.setMapTypeId(mapsLib.MapTypeId.HYBRID);
      if (type === 'terrain') googleMapRef.current.setMapTypeId(mapsLib.MapTypeId.TERRAIN);
    }
  };

  const handleFlyToRegion = (coords: { lat: number; lng: number }, zoom: number) => {
    sound.playClick();
    if (googleMapRef.current) {
      googleMapRef.current.panTo(coords);
      googleMapRef.current.setZoom(zoom);
    } else if (leafletMapRef.current) {
      leafletMapRef.current.flyTo([coords.lat, coords.lng], zoom, { duration: 1.0 });
    }
  };

  const handleZoom = (delta: number) => {
    sound.playClick();
    if (googleMapRef.current) {
      const curZoom = googleMapRef.current.getZoom() || 2;
      googleMapRef.current.setZoom(curZoom + delta);
    } else if (leafletMapRef.current) {
      leafletMapRef.current.setZoom(leafletMapRef.current.getZoom() + delta);
    }
  };

  const handleCenterOnPin = () => {
    sound.playClick();
    if (selectedPoint) {
      if (googleMapRef.current) {
        googleMapRef.current.panTo(selectedPoint);
        googleMapRef.current.setZoom(Math.max(googleMapRef.current.getZoom() || 2, 7));
      } else if (leafletMapRef.current) {
        leafletMapRef.current.flyTo([selectedPoint.lat, selectedPoint.lng], 7);
      }
    } else {
      handleFlyToRegion({ lat: 25, lng: 10 }, 2);
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (googleMapRef.current && window.google?.maps) {
        window.google.maps.event.trigger(googleMapRef.current, 'resize');
      }
      if (leafletMapRef.current) {
        leafletMapRef.current.invalidateSize();
      }
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (googleMapRef.current && window.google?.maps) {
        window.google.maps.event.trigger(googleMapRef.current, 'resize');
      }
      if (leafletMapRef.current) {
        leafletMapRef.current.invalidateSize();
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [sizeState]);

  const handleSubmit = useCallback(() => {
    if (!selectedPoint || disabled) return;
    sound.playGuessSubmit();
    onGuessSubmit(selectedPoint);

    if (googleMarkerRef.current) {
      googleMarkerRef.current.map = null;
      googleMarkerRef.current = null;
    }
    googleMarkerElRef.current = null;
    if (leafletMarkerRef.current && leafletMapRef.current) {
      leafletMapRef.current.removeLayer(leafletMarkerRef.current);
      leafletMarkerRef.current = null;
    }
    clearDistanceCircles();
    setSelectedPoint(null);
  }, [selectedPoint, disabled, onGuessSubmit, clearDistanceCircles]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space' && selectedPoint && !disabled) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        sound.playClick();
        setSizeState((prev) => (prev === 'fullscreen' ? 'expanded' : 'fullscreen'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPoint, disabled, handleSubmit]);

  const isFullscreen = sizeState === 'fullscreen';

  return (
    <div
      onMouseEnter={() => {
        if (sizeState === 'compact') setSizeState('expanded');
      }}
      onMouseLeave={() => {
        if (sizeState === 'expanded') setSizeState('compact');
      }}
      className={`fixed z-30 transition-all duration-200 ease-out origin-bottom-right rounded-2xl overflow-hidden shadow-2xl border border-white/12 bg-[#0E131D] flex flex-col ${
        isFullscreen
          ? 'inset-4 w-auto h-auto'
          : sizeState === 'expanded'
          ? 'bottom-5 right-5 w-[520px] h-[390px] sm:w-[660px] sm:h-[460px]'
          : 'bottom-5 right-5 w-[330px] h-[230px]'
      }`}
    >
      {/* Top Map Header */}
      <div className="px-3.5 py-2 bg-[#07090F] border-b border-white/10 flex items-center justify-between text-xs text-slate-300 select-none gap-2">
        <div className="flex items-center gap-2 font-bold shrink-0">
          <Flag className="w-3.5 h-3.5 text-rose-500" />
          <span className="text-white">Google Maps</span>
        </div>

        {sizeState !== 'compact' && (
          <div className="hidden sm:flex items-center gap-1 text-[11px]">
            {QUICK_REGIONS.map((reg) => (
              <button
                key={reg.name}
                type="button"
                onClick={() => handleFlyToRegion(reg.coords, reg.zoom)}
                className="px-2 py-0.5 rounded-md bg-[#0E131D] hover:bg-cyan-400/15 hover:text-cyan-300 text-slate-300 transition-colors cursor-pointer border border-white/10 whitespace-nowrap"
              >
                {reg.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center bg-[#0E131D] rounded-lg p-0.5 border border-white/10 text-[10px] font-bold">
            {(
              [
                { id: 'roadmap', label: 'Plan' },
                { id: 'satellite', label: 'Sat' },
                { id: 'hybrid', label: 'Hybride' },
                { id: 'terrain', label: 'Relief' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleMapTypeChange(t.id)}
                className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  mapType === t.id ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setSizeState((prev) => (prev === 'fullscreen' ? 'expanded' : 'fullscreen'));
            }}
            aria-label={isFullscreen ? 'Réduire la carte' : 'Agrandir la carte'}
            title={isFullscreen ? 'Quitter Plein Écran [F]' : 'Carte Plein Écran [F]'}
            className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            {isFullscreen ? <Shrink className="w-4 h-4 text-cyan-400" /> : <Expand className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Map Canvas */}
      <div className="relative flex-1 w-full h-full bg-[#070B14] overflow-hidden">
        <div ref={mapContainerRef} className="w-full h-full cursor-crosshair" data-testid="google-guess-map" />

        <div className="absolute top-3 left-3 z-[500] flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => handleZoom(1)}
            aria-label="Zoom avant sur la carte"
            className="w-8 h-8 rounded-lg bg-[#0E131D] hover:bg-[#161F30] border border-white/15 text-white flex items-center justify-center shadow-lg cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleZoom(-1)}
            aria-label="Zoom arrière sur la carte"
            className="w-8 h-8 rounded-lg bg-[#0E131D] hover:bg-[#161F30] border border-white/15 text-white flex items-center justify-center shadow-lg cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleCenterOnPin}
            aria-label="Centrer sur le drapeau"
            className="w-8 h-8 rounded-lg bg-[#0E131D] hover:bg-[#161F30] border border-white/15 text-cyan-300 flex items-center justify-center shadow-lg cursor-pointer"
          >
            <Crosshair className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom Submit Bar */}
      <div className="p-3 bg-[#07090F] border-t border-white/10 flex items-center justify-between gap-3 z-10">
        <div className="text-xs text-slate-300 flex items-center gap-2 min-w-0">
          {selectedPoint ? (
            <div className="flex items-center gap-1.5 font-mono-numbers text-xs text-cyan-300 font-bold truncate">
              <Navigation className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>
                {selectedPoint.lat.toFixed(4)}°, {selectedPoint.lng.toFixed(4)}°
              </span>
            </div>
          ) : (
            <span className="text-slate-400 text-xs truncate">Cliquez pour planter votre drapeau</span>
          )}
        </div>

        <button
          type="button"
          data-testid="guess-submit-btn"
          onClick={handleSubmit}
          disabled={!selectedPoint || disabled}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-display font-extrabold text-xs tracking-wide transition-colors shrink-0 ${
            selectedPoint && !disabled
              ? 'bg-rose-500 hover:bg-rose-400 text-white cursor-pointer'
              : 'bg-white/10 text-slate-500 cursor-not-allowed'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>DEVINER</span>
        </button>
      </div>
    </div>
  );
}
