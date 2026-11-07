export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Calculates Great-Circle distance using Haversine formula in Kilometers.
 */
export function calculateHaversineDistance(point1: LatLng, point2: LatLng): number {
  const R = 6371; // Earth radius in km
  const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
  const dLng = ((point2.lng - point1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((point1.lat * Math.PI) / 180) *
      Math.cos((point2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * GeoGuessr exponential score formula.
 * Yields exactly 5,000 pts for <= 50m.
 * Decays smoothly to 0 at ~15,000 km.
 */
export function calculateScore(distanceKm: number): number {
  if (distanceKm <= 0.05) return 5000;
  if (distanceKm >= 14916) return 0;
  // Standard GeoGuessr exponential decay formula
  const score = Math.round(5000 * Math.exp(-distanceKm / 2000));
  return Math.max(0, Math.min(5000, score));
}

/**
 * Calculates extra speed bonus points for fast intuition.
 */
export function calculateSpeedBonus(secondsElapsed: number): number {
  if (secondsElapsed <= 10) return 500;
  if (secondsElapsed <= 20) return 300;
  if (secondsElapsed <= 35) return 150;
  return 0;
}

/**
 * Computes accuracy combo multiplier for consecutive accurate guesses.
 */
export function calculateComboMultiplier(comboStreak: number): number {
  if (comboStreak >= 4) return 2.0;
  if (comboStreak === 3) return 1.75;
  if (comboStreak === 2) return 1.5;
  if (comboStreak === 1) return 1.25;
  return 1.0;
}

export interface DuelDamageResult {
  loser: 'player' | 'opponent' | 'tie';
  damage: number;
}

/**
 * Computes damage dealt in Duel mode with round scaling multipliers.
 */
export function calculateDuelDamage(
  playerScore: number,
  opponentScore: number,
  roundNumber: number
): DuelDamageResult {
  const diff = Math.abs(playerScore - opponentScore);
  if (diff === 0) {
    return { loser: 'tie', damage: 0 };
  }

  // Multiplier ramps up as duel progresses
  let multiplier = 1.0;
  if (roundNumber === 2) multiplier = 1.2;
  else if (roundNumber === 3) multiplier = 1.5;
  else if (roundNumber === 4) multiplier = 2.0;
  else if (roundNumber >= 5) multiplier = 3.0;

  const damage = Math.round(diff * multiplier);
  const loser = playerScore > opponentScore ? 'opponent' : 'player';

  return { loser, damage };
}

/**
 * Evaluates Country Streak match.
 */
export function evaluateCountryStreak(
  guessedCountry: string,
  actualCountry: string,
  currentStreak: number
): { isCorrect: boolean; newStreak: number; streakBonus: number } {
  const normGuess = guessedCountry.trim().toLowerCase();
  const normActual = actualCountry.trim().toLowerCase();
  const isCorrect = normGuess === normActual;

  if (isCorrect) {
    const newStreak = currentStreak + 1;
    const streakBonus = Math.min(1000, newStreak * 100);
    return { isCorrect: true, newStreak, streakBonus };
  }

  return { isCorrect: false, newStreak: 0, streakBonus: 0 };
}

/**
 * Localized distance formatting.
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;
}

export function getRankTier(score: number): { title: string; color: string; badge: string } {
  if (score >= 23500) return { title: 'Grand Maître Géographe', color: 'from-amber-400 to-yellow-500', badge: '🏆' };
  if (score >= 19000) return { title: 'Explorateur Élite', color: 'from-purple-400 to-indigo-500', badge: '💎' };
  if (score >= 14000) return { title: 'Voyageur Chevronné', color: 'from-cyan-400 to-blue-500', badge: '🧭' };
  if (score >= 9000) return { title: 'Cartographe Amateur', color: 'from-emerald-400 to-teal-500', badge: '🗺️' };
  return { title: 'Novice de la Boussole', color: 'from-slate-400 to-slate-500', badge: '📍' };
}
