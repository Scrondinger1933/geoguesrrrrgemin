import React, { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import L from 'leaflet';
import { LatLng } from '../game/rules';

interface DetailedResultMapProps {
  actual: LatLng;
  guess: LatLng;
  opponentGuess?: LatLng;
  className?: string;
}

function buildTargetFlagHtml(): string {
  return `
    <div style="position: relative; width: 46px; height: 50px;">
      <div class="geo-flag-ripple" style="position: absolute; left: 23px; top: 47px; width: 18px; height: 18px; border-radius: 9999px; border: 2px solid #10B981; background: rgba(16, 185, 129, 0.28);"></div>
      <div class="geo-flag-drop" style="position: relative; width: 46px; height: 50px;">
        <svg viewBox="0 0 46 50" width="46" height="50" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 8px rgba(0,0,0,0.65)); overflow: visible;">
          <circle cx="23" cy="47" r="3.4" fill="#10B981" stroke="#FFFFFF" stroke-width="1.5"/>
          <rect x="21.5" y="7" width="3" height="40" rx="1.5" fill="#F8FAFC" stroke="#0F172A" stroke-width="0.9"/>
          <circle cx="23" cy="6.5" r="2.8" fill="#F59E0B" stroke="#0F172A" stroke-width="0.9"/>
          <g class="geo-flag-wave" style="transform-origin: 23px 14px;">
            <path d="M24.5 8.5H45L42 15L45 21.5H24.5V8.5Z" fill="#0F172A" stroke="#10B981" stroke-width="1.6" stroke-linejoin="round"/>
            <rect x="25" y="9" width="5" height="6" fill="#FFFFFF"/>
            <rect x="35" y="9" width="5" height="6" fill="#FFFFFF"/>
            <rect x="30" y="15" width="5" height="6" fill="#FFFFFF"/>
            <rect x="40" y="15" width="4.5" height="6" fill="#FFFFFF"/>
          </g>
        </svg>
      </div>
    </div>
  `;
}

function buildGuessFlagHtml(color: string, labelColor: string): string {
  return `
    <div style="position: relative; width: 42px; height: 46px;">
      <div class="geo-flag-drop" style="position: relative; width: 42px; height: 46px;">
        <svg viewBox="0 0 42 46" width="42" height="46" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 8px rgba(0,0,0,0.65)); overflow: visible;">
          <circle cx="21" cy="43" r="3" fill="${color}" stroke="#FFFFFF" stroke-width="1.5"/>
          <rect x="19.6" y="7" width="2.8" height="36" rx="1.4" fill="#F8FAFC" stroke="#0F172A" stroke-width="0.8"/>
          <circle cx="21" cy="6.5" r="2.5" fill="${labelColor}" stroke="#0F172A" stroke-width="0.8"/>
          <g class="geo-flag-wave" style="transform-origin: 21px 14px;">
            <path d="M22.4 8.5C27.5 6.5 32.5 10.5 38.5 8.5L41.5 9L39 14.5L41.5 20C39.2 21 36.8 20.8 34.5 19.8C29.5 17.4 26 21.6 22.4 19.8V8.5Z" fill="${color}" stroke="#FFFFFF" stroke-width="1.4" stroke-linejoin="round"/>
            <circle cx="30" cy="14.2" r="2.3" fill="#FFFFFF"/>
          </g>
        </svg>
      </div>
    </div>
  `;
}

function createHtmlElement(html: string): HTMLDivElement {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return (container.firstElementChild as HTMLDivElement) || container;
}

export function DetailedResultMap({
  actual,
  guess,
  opponentGuess,
  className = '',
}: DetailedResultMapProps) {
  const mapsLib = useMapsLibrary('maps');
  const markerLib = useMapsLibrary('marker');
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const googleActiveRef = useRef(false);
  const [allowFallback, setAllowFallback] = useState(false);

  useEffect(() => {
    if (mapsLib && markerLib) {
      setAllowFallback(false);
      return;
    }
    const timer = window.setTimeout(() => setAllowFallback(true), 2400);
    return () => window.clearTimeout(timer);
  }, [mapsLib, markerLib]);

  // 1. Genuine Google Maps JavaScript API with AdvancedMarkerElement Flag Pins
  useEffect(() => {
    if (!containerRef.current || !mapsLib || !markerLib) return;

    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
      containerRef.current.innerHTML = '';
    }

    try {
      const mapOptions: google.maps.MapOptions & {
        internalUsageAttributionIds?: string[];
      } = {
        center: { lat: actual.lat, lng: actual.lng },
        zoom: 4,
        mapId: 'DEMO_MAP_ID',
        mapTypeId: mapsLib.MapTypeId.ROADMAP,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: true,
        fullscreenControl: false,
        clickableIcons: false,
        internalUsageAttributionIds: ['gmp_git_agentskills_v1'],
      };

      const map = new mapsLib.Map(containerRef.current, mapOptions);
      googleActiveRef.current = true;

      const markers: google.maps.marker.AdvancedMarkerElement[] = [];
      const polylines: google.maps.Polyline[] = [];

      // Actual target marker (animated checkered victory flag)
      markers.push(
        new markerLib.AdvancedMarkerElement({
          position: { lat: actual.lat, lng: actual.lng },
          map,
          title: `Emplacement réel (${actual.lat.toFixed(4)}°, ${actual.lng.toFixed(4)}°)`,
          content: createHtmlElement(buildTargetFlagHtml()),
          zIndex: 1000,
        })
      );

      // Player guess marker (animated rose flag)
      markers.push(
        new markerLib.AdvancedMarkerElement({
          position: { lat: guess.lat, lng: guess.lng },
          map,
          title: `Votre drapeau (${guess.lat.toFixed(4)}°, ${guess.lng.toFixed(4)}°)`,
          content: createHtmlElement(buildGuessFlagHtml('#F43F5E', '#F59E0B')),
          zIndex: 900,
        })
      );

      // Connecting dashed geodesic line
      polylines.push(
        new mapsLib.Polyline({
          path: [
            { lat: guess.lat, lng: guess.lng },
            { lat: actual.lat, lng: actual.lng },
          ],
          geodesic: true,
          strokeColor: '#0F172A',
          strokeOpacity: 0,
          icons: [
            {
              icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.95, scale: 3 },
              offset: '0',
              repeat: '14px',
            },
          ],
          map,
        })
      );

      // Opponent marker if duel
      if (opponentGuess) {
        markers.push(
          new markerLib.AdvancedMarkerElement({
            position: { lat: opponentGuess.lat, lng: opponentGuess.lng },
            map,
            title: 'Drapeau Adversaire',
            content: createHtmlElement(buildGuessFlagHtml('#9333EA', '#22D3EE')),
            zIndex: 800,
          })
        );

        polylines.push(
          new mapsLib.Polyline({
            path: [
              { lat: opponentGuess.lat, lng: opponentGuess.lng },
              { lat: actual.lat, lng: actual.lng },
            ],
            geodesic: true,
            strokeColor: '#9333EA',
            strokeOpacity: 0.75,
            strokeWeight: 2.5,
            map,
          })
        );
      }

      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend({ lat: actual.lat, lng: actual.lng });
      bounds.extend({ lat: guess.lat, lng: guess.lng });
      if (opponentGuess) bounds.extend({ lat: opponentGuess.lat, lng: opponentGuess.lng });
      map.fitBounds(bounds, 55);

      return () => {
        googleActiveRef.current = false;
        markers.forEach((m) => {
          m.map = null;
        });
        polylines.forEach((p) => p.setMap(null));
      };
    } catch {
      googleActiveRef.current = false;
      setAllowFallback(true);
    }
  }, [actual, guess, opponentGuess, mapsLib, markerLib]);

  // 2. Leaflet Fallback when Google Maps isn't available
  useEffect(() => {
    if (!containerRef.current || googleActiveRef.current || !allowFallback) return;
    if (leafletMapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [actual.lat, actual.lng],
      zoom: 4,
      zoomControl: true,
      attributionControl: true,
      worldCopyJump: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      subdomains: ['a', 'b', 'c'],
      maxZoom: 19,
    }).addTo(map);

    const targetIcon = L.divIcon({
      className: 'custom-result-target-flag',
      html: buildTargetFlagHtml(),
      iconSize: [46, 50],
      iconAnchor: [23, 47],
    });

    const playerIcon = L.divIcon({
      className: 'custom-result-player-flag',
      html: buildGuessFlagHtml('#F43F5E', '#F59E0B'),
      iconSize: [42, 46],
      iconAnchor: [21, 43],
    });

    L.marker([actual.lat, actual.lng], { icon: targetIcon, zIndexOffset: 1000 }).addTo(map);
    L.marker([guess.lat, guess.lng], { icon: playerIcon, zIndexOffset: 900 }).addTo(map);

    if (opponentGuess) {
      const oppIcon = L.divIcon({
        className: 'custom-result-opp-flag',
        html: buildGuessFlagHtml('#9333EA', '#22D3EE'),
        iconSize: [42, 46],
        iconAnchor: [21, 43],
      });
      L.marker([opponentGuess.lat, opponentGuess.lng], { icon: oppIcon, zIndexOffset: 800 }).addTo(map);
      L.polyline(
        [
          [opponentGuess.lat, opponentGuess.lng],
          [actual.lat, actual.lng],
        ],
        { color: '#9333EA', weight: 2.5, opacity: 0.75 }
      ).addTo(map);
    }

    L.polyline(
      [
        [guess.lat, guess.lng],
        [actual.lat, actual.lng],
      ],
      {
        color: '#0F172A',
        weight: 3.5,
        dashArray: '6, 6',
        opacity: 0.9,
      }
    ).addTo(map);

    const bounds = L.latLngBounds([
      [actual.lat, actual.lng],
      [guess.lat, guess.lng],
    ]);
    if (opponentGuess) bounds.extend([opponentGuess.lat, opponentGuess.lng]);
    map.fitBounds(bounds, { padding: [45, 45] });
    leafletMapRef.current = map;

    return () => {
      map.remove();
      leafletMapRef.current = null;
    };
  }, [actual, guess, opponentGuess, allowFallback]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full min-h-[300px] rounded-2xl overflow-hidden shadow-inner ${className}`}
      data-testid="result-map"
    />
  );
}
