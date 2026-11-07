import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateHaversineDistance,
  calculateScore,
  calculateSpeedBonus,
  calculateComboMultiplier,
  calculateDuelDamage,
  evaluateCountryStreak,
  formatDistance,
} from './rules';

describe('GeoRules Engine', () => {
  it('calculates accurate Haversine distances', () => {
    // Paris (48.8566, 2.3522) to London (51.5074, -0.1278) ~343 km
    const dist = calculateHaversineDistance(
      { lat: 48.8566, lng: 2.3522 },
      { lat: 51.5074, lng: -0.1278 }
    );
    assert(dist > 330 && dist < 360, `Distance was ${dist}`);
  });

  it('awards 5000 points for pin <= 50m', () => {
    assert.strictEqual(calculateScore(0.02), 5000);
    assert.strictEqual(calculateScore(0.05), 5000);
  });

  it('calculates speed bonuses correctly', () => {
    assert.strictEqual(calculateSpeedBonus(5), 500);
    assert.strictEqual(calculateSpeedBonus(10), 500);
    assert.strictEqual(calculateSpeedBonus(15), 300);
    assert.strictEqual(calculateSpeedBonus(30), 150);
    assert.strictEqual(calculateSpeedBonus(45), 0);
  });

  it('computes combo multipliers properly', () => {
    assert.strictEqual(calculateComboMultiplier(0), 1.0);
    assert.strictEqual(calculateComboMultiplier(1), 1.25);
    assert.strictEqual(calculateComboMultiplier(2), 1.5);
    assert.strictEqual(calculateComboMultiplier(3), 1.75);
    assert.strictEqual(calculateComboMultiplier(4), 2.0);
    assert.strictEqual(calculateComboMultiplier(6), 2.0);
  });

  it('handles duel damage and multipliers correctly', () => {
    const duelR1 = calculateDuelDamage(4500, 3000, 1);
    assert.strictEqual(duelR1.loser, 'opponent');
    assert.strictEqual(duelR1.damage, 1500);

    const duelR5 = calculateDuelDamage(2000, 4000, 5);
    assert.strictEqual(duelR5.loser, 'player');
    assert.strictEqual(duelR5.damage, 6000); // 2000 * 3.0
  });

  it('evaluates country streaks accurately', () => {
    const correct = evaluateCountryStreak('France', 'france', 2);
    assert.strictEqual(correct.isCorrect, true);
    assert.strictEqual(correct.newStreak, 3);
    assert.strictEqual(correct.streakBonus, 300);

    const wrong = evaluateCountryStreak('Belgique', 'France', 2);
    assert.strictEqual(wrong.isCorrect, false);
    assert.strictEqual(wrong.newStreak, 0);
  });

  it('formats localized distances', () => {
    assert.strictEqual(formatDistance(0.45), '450 m');
    assert(formatDistance(12.4).includes('km'));
  });
});
