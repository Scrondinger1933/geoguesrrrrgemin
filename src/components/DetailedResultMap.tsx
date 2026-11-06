import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { LatLng } from '../game/rules';

interface DetailedResultMapProps {
  actual: LatLng;
  guess: LatLng;
  opponentGuess?: LatLng;
  className?: string;
}

// Red pin for player's guess matching OpenGuessr (image_24da0ebb.png)
const createPlayerPinIcon = () => {
  return L.divIcon({
    className: 'player-guess-pin',
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

// Target flag marker matching OpenGuessr (image_24da0ebb.png)
const createTargetFlagIcon = () => {
  return L.divIcon({
    className: 'target-flag-pin',
    html: `
      <div style="position: relative; width: 32px; height: 40px; transform: translate(-20%, -100%);">
        <svg viewBox="0 0 32 40" width="32" height="40" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.6));">
          <!-- Flag pole -->
          <rect x="4" y="2" width="3" height="38" rx="1.5" fill="#1e293b"/>
          <!-- Flag pennant with checkered pattern -->
          <path d="M7 4h18l-3 7 3 7H7V4z" fill="#0f172a" stroke="#ffffff" stroke-width="1.5"/>
          <rect x="10" y="6" width="4" height="4" fill="#ffffff"/>
          <rect x="16" y="6" width="4" height="4" fill="#ffffff"/>
          <rect x="7" y="10" width="4" height="4" fill="#ffffff"/>
          <rect x="13" y="10" width="4" height="4" fill="#ffffff"/>
          <circle cx="5.5" cy="3" r="2.5" fill="#f59e0b"/>
        </svg>
      </div>
    `,
    iconSize: [32, 40],
    iconAnchor: [5, 40],
  });
};

// Opponent marker (in duel mode)
const createOpponentPinIcon = () => {
  return L.divIcon({
    className: 'opponent-guess-pin',
    html: `
      <div style="position: relative; width: 28px; height: 36px; transform: translate(-50%, -100%);">
        <svg viewBox="0 0 32 42" width="28" height="36" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.5));">
          <path d="M16 0C7.163 0 0 7.163 0 16c0 11.2 14.5 24.8 15.1 25.4.5.5 1.3.5 1.8 0C17.5 40.8 32 27.2 32 16 32 7.163 24.837 0 16 0z" fill="#a855f7"/>
          <circle cx="16" cy="16" r="6" fill="#ffffff" stroke="#6b21a8" stroke-width="1.5"/>
        </svg>
      </div>
    `,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
  });
};

export function DetailedResultMap({
  actual,
  guess,
  opponentGuess,
  className = '',
}: DetailedResultMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    // Create Leaflet Map
    const map = L.map(containerRef.current, {
      center: [actual.lat, actual.lng],
      zoom: 4,
      zoomControl: true,
      attributionControl: true,
      worldCopyJump: true,
    });

    // OpenStreetMap high-detail tiles (complete map with countries, borders, and cities, no key needed)
    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        subdomains: ['a', 'b', 'c'],
        maxZoom: 19,
      }
    ).addTo(map);

    // 1. Target Location Flag Marker
    L.marker([actual.lat, actual.lng], {
      icon: createTargetFlagIcon(),
      zIndexOffset: 1000,
    })
      .addTo(map)
      .bindPopup(
        `<div style="font-size: 11px; font-weight: bold; color: #0f172a;">Point Exact (${actual.lat.toFixed(2)}°, ${actual.lng.toFixed(2)}°)</div>`
      );

    // 2. Player Guess Marker
    L.marker([guess.lat, guess.lng], {
      icon: createPlayerPinIcon(),
      zIndexOffset: 900,
    })
      .addTo(map)
      .bindPopup(
        `<div style="font-size: 11px; font-weight: bold; color: #ef4444;">Votre Repère</div>`
      );

    // 3. Connecting Polyline between Guess and Actual (Dark dashed line as in image_24da0ebb.png)
    const polyline = L.polyline(
      [
        [guess.lat, guess.lng],
        [actual.lat, actual.lng],
      ],
      {
        color: '#0f172a',
        weight: 3.5,
        dashArray: '6, 6',
        opacity: 0.9,
      }
    ).addTo(map);

    // 4. Opponent Marker & line (if duel mode)
    if (opponentGuess) {
      L.marker([opponentGuess.lat, opponentGuess.lng], {
        icon: createOpponentPinIcon(),
        zIndexOffset: 800,
      }).addTo(map);

      L.polyline(
        [
          [opponentGuess.lat, opponentGuess.lng],
          [actual.lat, actual.lng],
        ],
        {
          color: '#9333ea',
          weight: 2.5,
          dashArray: '4, 6',
          opacity: 0.7,
        }
      ).addTo(map);
    }

    // Auto-fit bounds with padding so both markers and line are clearly visible
    const points: [number, number][] = [
      [actual.lat, actual.lng],
      [guess.lat, guess.lng],
    ];
    if (opponentGuess) {
      points.push([opponentGuess.lat, opponentGuess.lng]);
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });

    mapRef.current = map;

    // Invalidate size once rendered and on container resize
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
    };
  }, [actual, guess, opponentGuess]);

  return (
    <div className={`relative w-full h-full overflow-hidden rounded-2xl ${className}`}>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
