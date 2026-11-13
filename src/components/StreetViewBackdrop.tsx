import React, { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import atlasBackdrop from '../assets/images/title_atlas_backdrop_1794506273363.jpg';

const SCENIC_SHOWCASE_SPOTS = [
  { name: 'Tour Eiffel · Paris', lat: 48.8584, lng: 2.2945, heading: 35, pitch: 8 },
  { name: 'Shibuya · Tokyo', lat: 35.6595, lng: 139.7004, heading: 120, pitch: 4 },
  { name: 'Pont du Golden Gate · San Francisco', lat: 37.8078, lng: -122.475, heading: 335, pitch: 5 },
  { name: 'Colisée · Rome', lat: 41.8902, lng: 12.4922, heading: 215, pitch: 6 },
  { name: 'Fjords · Norvège', lat: 62.1049, lng: 7.0942, heading: 95, pitch: 3 },
];

export function StreetViewBackdrop() {
  const streetViewLib = useMapsLibrary('streetView');
  const panoContainerRef = useRef<HTMLDivElement>(null);
  const panoInstanceRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const [isGoogleActive, setIsGoogleActive] = useState(false);
  const [spotIndex, setSpotIndex] = useState(0);
  const [backdropFallbackError, setBackdropFallbackError] = useState(false);

  // Cycle iconic Street View landmarks gently every 18s
  useEffect(() => {
    const timer = window.setInterval(() => {
      setSpotIndex((prev) => (prev + 1) % SCENIC_SHOWCASE_SPOTS.length);
    }, 18000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!streetViewLib || !panoContainerRef.current) return;
    let disposed = false;

    const spot = SCENIC_SHOWCASE_SPOTS[spotIndex];
    const svService = new streetViewLib.StreetViewService();

    if (!panoInstanceRef.current) {
      try {
        panoInstanceRef.current = new streetViewLib.StreetViewPanorama(panoContainerRef.current, {
          position: { lat: spot.lat, lng: spot.lng },
          pov: { heading: spot.heading, pitch: spot.pitch },
          zoom: 1,
          disableDefaultUI: true,
          linksControl: false,
          addressControl: false,
          showRoadLabels: false,
          clickToGo: false,
          scrollwheel: false,
          motionTracking: false,
          motionTrackingControl: false,
          enableCloseButton: false,
        });

        panoInstanceRef.current.addListener('status_changed', () => {
          if (disposed) return;
          const st = panoInstanceRef.current?.getStatus();
          if (st === streetViewLib.StreetViewStatus.OK) {
            setIsGoogleActive(true);
          }
        });
      } catch {
        setIsGoogleActive(false);
        return;
      }
    }

    svService.getPanorama(
      {
        location: { lat: spot.lat, lng: spot.lng },
        radius: 25000,
        source: streetViewLib.StreetViewSource.OUTDOOR,
        preference: streetViewLib.StreetViewPreference.NEAREST,
      },
      (data, status) => {
        if (disposed || !panoInstanceRef.current) return;
        if (status === streetViewLib.StreetViewStatus.OK && data?.location?.pano) {
          panoInstanceRef.current.setPano(data.location.pano);
          panoInstanceRef.current.setPov({ heading: spot.heading, pitch: spot.pitch });
          panoInstanceRef.current.setVisible(true);
          setIsGoogleActive(true);
        }
      }
    );

    const handleQuota = () => setIsGoogleActive(false);
    window.addEventListener('gmp-quota-exceeded', handleQuota);

    return () => {
      disposed = true;
      window.removeEventListener('gmp-quota-exceeded', handleQuota);
    };
  }, [streetViewLib, spotIndex]);

  // Smooth cinematic camera orbit while active
  useEffect(() => {
    if (!isGoogleActive || !panoInstanceRef.current) return;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let rafId = 0;
    let last = performance.now();

    const orbit = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const pano = panoInstanceRef.current;
      if (pano && document.visibilityState === 'visible') {
        const pov = pano.getPov();
        if (pov) {
          pano.setPov({
            heading: (pov.heading + 4.5 * dt) % 360,
            pitch: pov.pitch,
          });
        }
      }
      rafId = requestAnimationFrame(orbit);
    };

    rafId = requestAnimationFrame(orbit);
    return () => cancelAnimationFrame(rafId);
  }, [isGoogleActive]);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#07090F]">
      {/* Fallback orbital cartography art when Street View is loading or unavailable */}
      {!backdropFallbackError && (
        <img
          src={atlasBackdrop}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          onError={() => setBackdropFallbackError(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
            isGoogleActive ? 'opacity-0' : 'opacity-40'
          }`}
        />
      )}

      {/* Live Google Street View 360 Panoramic Backdrop */}
      <div
        ref={panoContainerRef}
        aria-hidden="true"
        className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ${
          isGoogleActive ? 'opacity-65' : 'opacity-0'
        }`}
      />

      {/* Editorial Meridian Noir Legibility Scrims (zero backdrop-blur) */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#07090F] via-[#07090F]/78 to-[#07090F]/35" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#07090F]/75 via-transparent to-[#07090F]" />
    </div>
  );
}
