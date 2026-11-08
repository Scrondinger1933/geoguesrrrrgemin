import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRandomWorldLocation, generateRandomMatchLocations, STREET_VIEW_ZONES } from './worldGenerator';

test('Worldwide Dynamic Generator generates valid and diverse locations', () => {
  // Test zone count covers extensive global geography
  assert.ok(STREET_VIEW_ZONES.length >= 25, 'Should have at least 25 global coverage zones');

  // Test single random location generation
  const loc1 = generateRandomWorldLocation('world');
  assert.ok(loc1.id.startsWith('loc_'), 'Location should have unique generated ID');
  assert.ok(loc1.lat >= -90 && loc1.lat <= 90, 'Latitude must be valid');
  assert.ok(loc1.lng >= -180 && loc1.lng <= 180, 'Longitude must be valid');
  assert.ok(loc1.country.length > 0, 'Country name must be present');
  assert.ok(['Droite', 'Gauche'].includes(loc1.clues.drivingSide), 'Driving side must be valid');

  // Test uniqueness across 20 iterations
  const locations = Array.from({ length: 20 }, () => generateRandomWorldLocation('world'));
  const uniqueCoords = new Set(locations.map((l) => `${l.lat},${l.lng}`));
  assert.strictEqual(uniqueCoords.size, 20, 'All 20 generated locations must have unique coordinates');

  // Test match generator for multiplayer (5 distinct rounds)
  const matchLocs = generateRandomMatchLocations(5, 'world');
  assert.strictEqual(matchLocs.length, 5, 'Match should contain exactly 5 locations');
  const matchCountries = new Set(matchLocs.map((l) => l.country));
  assert.ok(matchCountries.size >= 4, 'Match rounds should span diverse countries');

  // Test France filter
  const franceLoc = generateRandomWorldLocation('france');
  assert.strictEqual(franceLoc.countryCode, 'FR', 'France filter must only generate French coordinates');
});
