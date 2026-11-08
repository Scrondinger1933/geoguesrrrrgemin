/**
 * GeoApex Location System
 * Dynamic worldwide location generator backed by real Street View road coverage zones.
 * No longer uses a rigid 24 hardcoded coordinates list.
 */

import {
  generateRandomWorldLocation,
  generateRandomMatchLocations,
  STREET_VIEW_ZONES,
} from './worldGenerator';

export interface GeoLocation {
  id: string;
  name: string;
  city: string;
  country: string;
  countryCode: string; // ISO 2-letter
  lat: number;
  lng: number;
  heading: number;
  pitch: number;
  zoom: number;
  clues: {
    drivingSide: 'Droite' | 'Gauche';
    continent: string;
    alphabet: string;
    landscape: string;
    funFact: string;
  };
  theme: {
    skyTop: string;
    skyBottom: string;
    groundColor: string;
    ambientFeatures: string[];
    sunAngle: number;
  };
}

// Initial dynamic pool generated on load for instant display
export const WORLD_LOCATIONS: GeoLocation[] = Array.from({ length: 30 }, () =>
  generateRandomWorldLocation('world')
);

// Covered countries list for streaks and quizzes
export const COVERED_COUNTRIES = Array.from(
  new Set(STREET_VIEW_ZONES.map((z) => z.country))
).sort();

/**
 * Returns a brand new, randomly generated worldwide location.
 * Every call generates fresh, unpredictable coordinates.
 */
export function getRandomLocation(_excludeIds: string[] = [], filter: 'world' | 'france' | 'capitals' | 'rural' = 'world'): GeoLocation {
  return generateRandomWorldLocation(filter);
}

/**
 * Returns a random coordinate anywhere across covered road networks.
 */
export function getRandomWorldCoordinates(): { lat: number; lng: number } {
  const loc = generateRandomWorldLocation('world');
  return { lat: loc.lat, lng: loc.lng };
}

/**
 * Re-exports the match location generator for multi-round games and duels.
 */
export { generateRandomMatchLocations, generateRandomWorldLocation };
