import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHaversineDistance,
  calculateScore,
  calculateSpeedBonus,
  calculateComboMultiplier,
  calculateDuelDamage,
  evaluateCountryStreak,
  formatDistance,
  getRankTier,
} from './rules.ts';

test('calculateHaversineDistance computes accurate distances', () => {
  const paris = { lat: 48.8566, lng: 2.3522 };
  const london = { lat: 51.5074, lng: -0.1278 };
  const same = calculateHaversineDistance(paris, paris);
  assert.equal(same, 0);

  const dist = calculateHaversineDistance(paris, london);
  assert.ok(dist > 335 && dist < 350, `Expected ~343 km, got ${dist}`);
});

test('calculateScore gives 5000 for <= 50m and 0 beyond 14916km', () => {
  assert.equal(calculateScore(0), 5000);
  assert.equal(calculateScore(0.05), 5000);
  assert.equal(calculateScore(15000), 0);
  const mid = calculateScore(500);
  assert.ok(mid > 3500 && mid < 4200, `Expected ~3894, got ${mid}`);
});

test('calculateSpeedBonus and calculateComboMultiplier tiers', () => {
  assert.equal(calculateSpeedBonus(5), 500);
  assert.equal(calculateSpeedBonus(15), 300);
  assert.equal(calculateSpeedBonus(30), 150);
  assert.equal(calculateSpeedBonus(50), 0);

  assert.equal(calculateComboMultiplier(0), 1.0);
  assert.equal(calculateComboMultiplier(1), 1.25);
  assert.equal(calculateComboMultiplier(2), 1.5);
  assert.equal(calculateComboMultiplier(3), 1.75);
  assert.equal(calculateComboMultiplier(4), 2.0);
});

test('calculateDuelDamage scales by round multiplier', () => {
  const tie = calculateDuelDamage(4000, 4000, 1);
  assert.equal(tie.loser, 'tie');
  assert.equal(tie.damage, 0);

  const r1 = calculateDuelDamage(4500, 3500, 1);
  assert.equal(r1.loser, 'opponent');
  assert.equal(r1.damage, 1000);

  const r5 = calculateDuelDamage(3000, 4000, 5);
  assert.equal(r5.loser, 'player');
  assert.equal(r5.damage, 3000);
});

test('evaluateCountryStreak is case/whitespace insensitive', () => {
  const ok = evaluateCountryStreak(' France ', 'france', 2);
  assert.equal(ok.isCorrect, true);
  assert.equal(ok.newStreak, 3);
  assert.equal(ok.streakBonus, 300);

  const bad = evaluateCountryStreak('Japon', 'France', 3);
  assert.equal(bad.isCorrect, false);
  assert.equal(bad.newStreak, 0);
  assert.equal(bad.streakBonus, 0);
});

test('formatDistance and getRankTier format cleanly', () => {
  assert.equal(formatDistance(0.45), '450 m');
  assert.ok(formatDistance(120.4).includes('km'));
  assert.equal(getRankTier(24000).title, 'Grand Maître Géographe');
  assert.equal(getRankTier(1000).title, 'Novice de la Boussole');
});
