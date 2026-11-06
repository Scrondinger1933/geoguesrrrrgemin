import test from 'node:test';
import assert from 'node:assert';
import {
  calculateHaversineDistance,
  calculateScore,
  calculateDuelDamage,
  evaluateCountryStreak,
  formatDistance,
  getRankTier,
} from './rules';

test('haversine distance calculates accurately between known coordinates', () => {
  // Paris (48.8566, 2.3522) to London (51.5074, -0.1278) ~343 km
  const d = calculateHaversineDistance(
    { lat: 48.8566, lng: 2.3522 },
    { lat: 51.5074, lng: -0.1278 }
  );
  assert.ok(d > 330 && d < 360, `Distance was ${d}, expected ~343km`);
});

test('score function grants 5000 for near-identical points and decreases with distance', () => {
  const perfect = calculateScore(0.02); // 20m
  assert.strictEqual(perfect, 5000);

  const close = calculateScore(100);
  assert.ok(close >= 4500 && close < 5000, `Close score: ${close}`);

  const far = calculateScore(5000);
  assert.ok(far < 1000, `Far score: ${far}`);

  const antipode = calculateScore(16000);
  assert.strictEqual(antipode, 0);
});

test('duel damage computes correctly with ramping multipliers', () => {
  // Round 1 (1.0x)
  const res1 = calculateDuelDamage(4500, 3500, 1);
  assert.strictEqual(res1.loser, 'opponent');
  assert.strictEqual(res1.damage, 1000);

  // Round 3 (1.5x)
  const res3 = calculateDuelDamage(2000, 4000, 3);
  assert.strictEqual(res3.loser, 'player');
  assert.strictEqual(res3.damage, 3000); // 2000 * 1.5

  // Round 5 (3.0x sudden death)
  const res5 = calculateDuelDamage(5000, 4000, 5);
  assert.strictEqual(res5.loser, 'opponent');
  assert.strictEqual(res5.damage, 3000); // 1000 * 3.0
});

test('country streak evaluates correctly', () => {
  const correct = evaluateCountryStreak('France', 'France', 2);
  assert.strictEqual(correct.isCorrect, true);
  assert.strictEqual(correct.newStreak, 3);
  assert.strictEqual(correct.streakBonus, 300);

  const incorrect = evaluateCountryStreak('Espagne', 'France', 5);
  assert.strictEqual(incorrect.isCorrect, false);
  assert.strictEqual(incorrect.newStreak, 0);
});

test('distance formatting outputs clean localized strings', () => {
  assert.strictEqual(formatDistance(0.045), '45 m');
  assert.ok(formatDistance(342.6).includes('342,6') || formatDistance(342.6).includes('342.6'));
});

test('rank tiers map correctly', () => {
  assert.strictEqual(getRankTier(24000).title, 'Grand Maître Géographe');
  assert.strictEqual(getRankTier(20000).title, 'Explorateur Élite');
  assert.strictEqual(getRankTier(2000).title, 'Novice de la Boussole');
});
