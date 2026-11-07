import React, { useState, useRef, useCallback, useEffect } from 'react';
import L from 'leaflet';
import { Maximize2, Minimize2, MapPin, Send, Navigation, Expand, Shrink, Compass, Search } from 'lucide-react';
import { LatLng } from '../game/rules';
import { sound } from '../utils/audio';

interface GuessMapProps {
  apiKey?: string;
  onGuessSubmit: (guess: LatLng) => void;
  disabled?: boolean;
  isQuotaExceeded?: boolean;
}

// Custom Red Marker Pin matching OpenGuessr (image_f6366ad4.png)
const createOpenGuessrPinIcon = () => {
  return L.divIcon({
    className: 'custom-openguessr-pin',
    html: `
      <div style="position: relative; width: 32px; height: 42px; transform: translate(-50%, -100%);">
        <svg viewBox="0 0 32 42" width="32" height="42" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.5));">
          <path d="M16 0C7.163 0 0 7.163 0 16c0 11.2 14.5 24.8 15.1 25.4.5.5 1.3.5 1.8 0C17.5 40.8 32 27.2 32 16 32 7.163 24.837 0 16 0z" fill="#ef4444"/>
          <path d="M16 1.5C8.047 1.5 1.6 7.947 1.6 15.9c0 10.3 13.1 23.1 14.4 24.3.4.4.8.4 1.2 0 1.3-1.2 14.4-14 14.4-24.3 0-7.953-6.447-14.4-14.4-14.4z" stroke="#b91c1c" stroke-width="1.2"/>
          <circle cx="16" cy="16" r="6" fill="#ffffff" stroke="#991b1b" stroke-width="1.5"/>
        </svg>
      </div>
    `,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
  });
};

type MapLayerType = 'osm' | 'esri' | 'satellite';
type MapSizeState = 'compact' | 'expanded' | 'fullscreen';

const QUICK_REGIONS = [
  { name: 'Europe', coords: [48, 15] as [number, number], zoom: 4 },
  { name: 'Am. Nord', coords: [42, -98] as [number, number], zoom: 3 },
  { name: 'Am. Sud', coords: [-15, -60] as [number, number], zoom: 3 },
  { name: 'Asie', coords: [35, 105] as [number, number], zoom: 3 },
  { name: 'Afrique', coords: [5, 20] as [number, number], zoom: 3 },
  { name: 'Océanie', coords: [-25, 135] as [number, number], zoom: 4 },
];

export function GuessMap({ onGuessSubmit, disabled = false }: GuessMapProps) {
  const [sizeState, setSizeState] = useState<MapSizeState>('compact');
  const [selectedPoint, setSelectedPoint] = useState<LatLng | null>(null);
  const [layerType, setLayerType] = useState<MapLayerType>('osm');
  const [searchQuery, setSearchQuery] = useState('');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleLayersRef = useRef<L.Circle[]>([]);
  const activeTileLayerRef = useRef<L.TileLayer | null>(null);

  // Clear radius measurement circles
  const clearCircles = useCallback(() => {
    if (mapInstanceRef.current) {
      circleLayersRef.current.forEach((c) => mapInstanceRef.current?.removeLayer(c));
    }
    circleLayersRef.current = [];
  }, []);

  // Update distance measurement circles around pin
  const updateCircles = useCallback(
    (lat: number, lng: number) => {
      const map = mapInstanceRef.current;
      if (!map) return;
      clearCircles();

      // 500 km radius
      const c1 = L.circle([lat, lng], {
        radius: 500000,
        color: '#ef4444',
        weight: 1.5,
        dashArray: '5, 5',
        fill: true,
        fillColor: '#ef4444',
        fillOpacity: 0.04,
      }).addTo(map);

      // 1500 km radius
      const c2 = L.circle([lat, lng], {
        radius: 1500000,
        color: '#38bdf8',
        weight: 1.2,
        dashArray: '6, 6',
        fill: false,
      }).addTo(map);

      circleLayersRef.current = [c1, c2];
    },
    [clearCircles]
  );

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [25, 10],
      zoom: 2,
      minZoom: 1,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: true,
      worldCopyJump: true,
    });

    const osmTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains: ['a', 'b', 'c'],
      maxZoom: 19,
    });

    osmTiles.addTo(map);
    activeTileLayerRef.current = osmTiles;

    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    // Map click handler to drop/move pin
    map.on('click', (e: L.LeafletMouseEvent) => {
      const lat = Math.round(e.latlng.lat * 1000) / 1000;
      const lng = Math.round(e.latlng.lng * 1000) / 1000;

      sound.playPinDrop();
      setSelectedPoint({ lat, lng });
      updateCircles(lat, lng);

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const marker = L.marker([lat, lng], {
          icon: createOpenGuessrPinIcon(),
          draggable: true,
        }).addTo(map);

        marker.on('drag', () => {
          const pos = marker.getLatLng();
          updateCircles(pos.lat, pos.lng);
        });

        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          sound.playPinDrop();
          const newPt = {
            lat: Math.round(pos.lat * 1000) / 1000,
            lng: Math.round(pos.lng * 1000) / 1000,
          };
          setSelectedPoint(newPt);
          updateCircles(newPt.lat, newPt.lng);
        });

        markerRef.current = marker;
      }
    });

    mapInstanceRef.current = map;

    return () => {
      clearCircles();
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, [clearCircles, updateCircles]);

  // Switch map tile layer
  const switchLayer = (type: MapLayerType) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (activeTileLayerRef.current) {
      map.removeLayer(activeTileLayerRef.current);
    }

    let url = '';
    let attr = '';
    let subdomains: string[] | string = 'abc';

    if (type === 'osm') {
      url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      attr = '&copy; OpenStreetMap contributors';
      subdomains = ['a', 'b', 'c'];
    } else if (type === 'esri') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
      attr = 'Tiles &copy; Esri';
    } else if (type === 'satellite') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attr = '&copy; Esri &copy; Earthstar Geographics';
    }

    const newLayer = L.tileLayer(url, { attribution: attr, subdomains, maxZoom: 19 });
    newLayer.addTo(map);
    activeTileLayerRef.current = newLayer;
    setLayerType(type);
    sound.playClick();
  };

  // Fly to region preset
  const handleFlyTo = (coords: [number, number], zoom: number) => {
    sound.playClick();
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(coords, zoom, { duration: 1.2 });
    }
  };

  // ResizeObserver for instant tile adjustment
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Update map layout on sizeState change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [sizeState]);

  // Submit guess
  const handleSubmit = useCallback(() => {
    if (!selectedPoint || disabled) return;
    sound.playGuessSubmit();
    onGuessSubmit(selectedPoint);

    if (markerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    clearCircles();
    setSelectedPoint(null);
  }, [selectedPoint, disabled, onGuessSubmit, clearCircles]);

  // Keyboard shortcuts: Space to guess, F for fullscreen toggle
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
      className={`fixed z-30 transition-all duration-300 ease-out origin-bottom-right rounded-2xl overflow-hidden shadow-2xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md flex flex-col ${
        isFullscreen
          ? 'inset-4 sm:inset-8 w-auto h-auto scale-100'
          : sizeState === 'expanded'
          ? 'bottom-5 right-5 w-[480px] h-[360px] sm:w-[640px] sm:h-[460px] scale-100'
          : 'bottom-5 right-5 w-[320px] h-[220px] opacity-95 hover:opacity-100 scale-95'
      }`}
    >
      {/* Top Map Bar with OpenGuessr-style controls & Quick Jump bar */}
      <div className="px-3 py-2 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300 select-none z-10 gap-2">
        <div className="flex items-center gap-2 font-bold shrink-0">
          <MapPin className="w-4 h-4 text-red-500 fill-red-500/20" />
          <span className="text-white tracking-wide">Carte Tactique</span>
          {selectedPoint && (
            <span className="text-[10px] text-cyan-300 font-mono bg-cyan-500/10 border border-cyan-500/30 px-1.5 py-0.5 rounded">
              Rayons 500 & 1500 km
            </span>
          )}
        </div>

        {/* Quick Region Jump Buttons (Visible when expanded or fullscreen) */}
        {sizeState !== 'compact' && (
          <div className="hidden sm:flex items-center gap-1 text-[10px]">
            {QUICK_REGIONS.map((reg) => (
              <button
                key={reg.name}
                onClick={() => handleFlyTo(reg.coords, reg.zoom)}
                className="px-1.5 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                {reg.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Layer switcher pill */}
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700/60 text-[10px]">
            <button
              onClick={() => switchLayer('osm')}
              className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                layerType === 'osm' ? 'bg-cyan-500 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Plan
            </button>
            <button
              onClick={() => switchLayer('esri')}
              className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                layerType === 'esri' ? 'bg-cyan-500 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Relief
            </button>
            <button
              onClick={() => switchLayer('satellite')}
              className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                layerType === 'satellite' ? 'bg-cyan-500 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Satellite
            </button>
          </div>

          {/* Fullscreen Toggle [F] */}
          <button
            onClick={() => {
              sound.playClick();
              setSizeState((prev) => (prev === 'fullscreen' ? 'expanded' : 'fullscreen'));
            }}
            title={isFullscreen ? 'Quitter Plein Écran [F]' : 'Carte Plein Écran [F]'}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            {isFullscreen ? <Shrink className="w-4 h-4 text-cyan-400" /> : <Expand className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Real High-Detail Interactive Geographic Map Container */}
      <div className="relative flex-1 w-full h-full bg-[#a5bfdd] overflow-hidden">
        <div ref={mapContainerRef} className="w-full h-full cursor-crosshair" data-testid="leaflet-guess-map" />

        {/* Prompt overlay when no pin is placed */}
        {!selectedPoint && (
          <div className="absolute top-2.5 inset-x-2 text-center pointer-events-none z-[400]">
            <span className="bg-slate-900/90 text-cyan-300 border border-cyan-500/40 text-[11px] font-semibold px-3 py-1 rounded-full shadow-lg backdrop-blur-md">
              Cliquez pour placer votre repère (Raccourci [F] : Plein Écran)
            </span>
          </div>
        )}
      </div>

      {/* Bottom Bar: Coordinates, Scale & Big Red Guess Button */}
      <div className="p-3 bg-slate-900/95 border-t border-slate-800 flex items-center justify-between gap-3 z-10">
        <div className="text-xs text-slate-300 flex items-center gap-3">
          {selectedPoint ? (
            <div className="flex items-center gap-2 font-mono text-[11px] text-cyan-300">
              <Navigation className="w-3.5 h-3.5 text-red-400" />
              <span>
                {selectedPoint.lat > 0 ? `${selectedPoint.lat.toFixed(2)}°N` : `${Math.abs(selectedPoint.lat).toFixed(2)}°S`},{' '}
                {selectedPoint.lng > 0 ? `${selectedPoint.lng.toFixed(2)}°E` : `${Math.abs(selectedPoint.lng).toFixed(2)}°O`}
              </span>
            </div>
          ) : (
            <span className="text-slate-400 text-[11px]">Aucun repère placé</span>
          )}
        </div>

        {/* Big Red "DEVINER / GUESS" Button */}
        <button
          onClick={handleSubmit}
          disabled={!selectedPoint || disabled}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm tracking-wide transition-all shadow-xl ${
            selectedPoint && !disabled
              ? 'bg-red-600 hover:bg-red-500 active:scale-95 text-white shadow-red-600/40 cursor-pointer animate-pulse'
              : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-60'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>DEVINER</span>
          <span className="text-[10px] font-mono opacity-80">[Espace]</span>
        </button>
      </div>
    </div>
  );
}
