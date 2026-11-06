import { LatLng, calculateHaversineDistance, calculateScore } from './rules';
import { GeoLocation } from './locations';

export type GameMode = 'duel' | 'classic' | 'streak' | 'blitz';

export interface OpponentProfile {
  id: string;
  name: string;
  country: string;
  flag: string;
  avatar: string;
  elo: number;
  varianceKmMin: number;
  varianceKmMax: number;
  speedSecondsMin: number;
  speedSecondsMax: number;
}

export const BOT_OPPONENTS: OpponentProfile[] = [
  {
    id: 'bot-geoking',
    name: 'Atlas_Pro',
    country: 'Suède',
    flag: '🇸🇪',
    avatar: '👑',
    elo: 1850,
    varianceKmMin: 20,
    varianceKmMax: 350,
    speedSecondsMin: 6,
    speedSecondsMax: 14,
  },
  {
    id: 'bot-navigator',
    name: 'GeoNinja',
    country: 'Japon',
    flag: '🇯🇵',
    avatar: '🥷',
    elo: 1600,
    varianceKmMin: 150,
    varianceKmMax: 1200,
    speedSecondsMin: 8,
    speedSecondsMax: 18,
  },
  {
    id: 'bot-wanderer',
    name: 'Routard99',
    country: 'France',
    flag: '🇫🇷',
    avatar: '🎒',
    elo: 1350,
    varianceKmMin: 400,
    varianceKmMax: 3000,
    speedSecondsMin: 10,
    speedSecondsMax: 22,
  },
  {
    id: 'bot-novice',
    name: 'LostTourist',
    country: 'Canada',
    flag: '🇨🇦',
    avatar: '🧭',
    elo: 950,
    varianceKmMin: 1500,
    varianceKmMax: 6000,
    speedSecondsMin: 12,
    speedSecondsMax: 25,
  },
];

export interface RoundResultData {
  roundNumber: number;
  location: GeoLocation;
  playerGuess: LatLng;
  playerDistanceKm: number;
  playerScore: number;
  opponentGuess?: LatLng;
  opponentDistanceKm?: number;
  opponentScore?: number;
  damageDealt?: number;
  damagedTarget?: 'player' | 'opponent' | 'tie';
  damageMultiplier?: number;
}

/**
 * Procedurally generates a plausible guess for an AI opponent.
 */
export function generateBotGuess(
  actualLocation: LatLng,
  bot: OpponentProfile
): { guess: LatLng; distanceKm: number; score: number } {
  const dist =
    Math.random() * (bot.varianceKmMax - bot.varianceKmMin) + bot.varianceKmMin;
  const bearing = Math.random() * 2 * Math.PI;

  const R = 6371; // Earth radius in km
  const lat1 = (actualLocation.lat * Math.PI) / 180;
  const lng1 = (actualLocation.lng * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(dist / R) +
      Math.cos(lat1) * Math.sin(dist / R) * Math.cos(bearing)
  );

  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(dist / R) * Math.cos(lat1),
      Math.cos(dist / R) - Math.sin(lat1) * Math.sin(lat2)
    );

  const guessLat = Math.max(-85, Math.min(85, (lat2 * 180) / Math.PI));
  const guessLng = ((((lng2 * 180) / Math.PI + 180) % 360) + 360) % 360 - 180;

  const guess = { lat: Math.round(guessLat * 1000) / 1000, lng: Math.round(guessLng * 1000) / 1000 };
  const actualDist = calculateHaversineDistance(actualLocation, guess);
  const score = calculateScore(actualDist);

  return { guess, distanceKm: actualDist, score };
}

/**
 * Multi-tab cross-session multiplayer room using BroadcastChannel.
 */
export class MultiplayerRoom {
  private channel: BroadcastChannel | null = null;
  public roomId: string;

  constructor(roomId: string, onMessage: (msg: MessageEvent) => void) {
    this.roomId = roomId;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(`geoapex-room-${roomId}`);
      this.channel.onmessage = onMessage;
    }
  }

  public send(type: string, payload: unknown) {
    if (this.channel) {
      this.channel.postMessage({ type, payload, sender: 'remote-player', timestamp: Date.now() });
    }
  }

  public close() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }
}
