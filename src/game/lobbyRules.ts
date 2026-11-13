export type MultiplayerMode = 'duel' | 'classic' | 'blitz';
export type MapRegionFilter = 'world' | 'france' | 'capitals' | 'rural';

export interface PublicRoomSummary {
  id: string;
  name: string;
  mode: MultiplayerMode;
  region: MapRegionFilter;
  playerCount: number;
  maxPlayers: number;
  hostName: string;
  hostAvatar: string;
  status: 'lobby' | 'countdown' | 'playing' | 'round_resolved' | 'game_over';
  isPublic: boolean;
  createdAt: number;
}

export interface RoomScoreEntry {
  id: string;
  hp: number;
  score: number;
}

/**
 * Normalizes a user-typed room code into canonical uppercase alphanumeric+hyphen form.
 */
export function normalizeRoomCode(raw: string): string {
  return (raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 18);
}

/**
 * Generates a readable 8-char room code like "APEX-4829".
 */
export function generateReadableRoomCode(prefix = 'APEX'): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${num}`;
}

/**
 * Returns the authoritative round duration in seconds for the given mode.
 */
export function getRoundDurationForMode(mode: MultiplayerMode): number {
  if (mode === 'blitz') return 30;
  return 60;
}

/**
 * Checks whether a room can start a PvP match.
 */
export function canStartMultiplayerMatch(
  playerCount: number,
  isHost: boolean
): { ok: boolean; reason?: string } {
  if (!isHost) {
    return { ok: false, reason: "Seul l'hôte du salon peut lancer la partie." };
  }
  if (playerCount < 2) {
    return {
      ok: false,
      reason: 'Il faut 2 joueurs connectés dans le salon pour démarrer un duel en ligne.',
    };
  }
  return { ok: true };
}

/**
 * Filters public rooms open in lobby/playing for directory browsing.
 */
export function filterPublicRooms(
  rooms: PublicRoomSummary[],
  query = '',
  modeFilter: MultiplayerMode | 'all' = 'all'
): PublicRoomSummary[] {
  const cleanQuery = query.trim().toLowerCase();
  return rooms
    .filter((r) => r.isPublic && r.status !== 'game_over')
    .filter((r) => (modeFilter === 'all' ? true : r.mode === modeFilter))
    .filter((r) => {
      if (!cleanQuery) return true;
      return (
        r.id.toLowerCase().includes(cleanQuery) ||
        r.name.toLowerCase().includes(cleanQuery) ||
        r.hostName.toLowerCase().includes(cleanQuery)
      );
    })
    .sort((a, b) => {
      // Waiting lobby rooms with 1 player come first!
      const aJoinable = a.status === 'lobby' && a.playerCount < a.maxPlayers ? 0 : 1;
      const bJoinable = b.status === 'lobby' && b.playerCount < b.maxPlayers ? 0 : 1;
      if (aJoinable !== bJoinable) return aJoinable - bJoinable;
      return b.createdAt - a.createdAt;
    });
}

/**
 * Picks the best open public room for Quick Matchmaking.
 */
export function pickQuickMatchRoom(
  rooms: PublicRoomSummary[],
  preferredMode?: MultiplayerMode
): PublicRoomSummary | null {
  const joinable = rooms.filter(
    (r) => r.isPublic && r.status === 'lobby' && r.playerCount >= 1 && r.playerCount < r.maxPlayers
  );
  if (joinable.length === 0) return null;
  if (preferredMode) {
    const exact = joinable.find((r) => r.mode === preferredMode);
    if (exact) return exact;
  }
  return joinable[0];
}

/**
 * Computes the winning player ID based on game mode.
 */
export function computeMatchWinner(
  players: RoomScoreEntry[],
  mode: MultiplayerMode
): string {
  if (players.length === 0) return '';
  if (players.length === 1) return players[0].id;

  const [p1, p2] = players;
  if (mode === 'duel') {
    if (p1.hp !== p2.hp) {
      return p1.hp > p2.hp ? p1.id : p2.id;
    }
  }
  return p1.score >= p2.score ? p1.id : p2.id;
}

/**
 * Sanitizes chat messages for safe display and length bounds.
 */
export function sanitizeChatMessage(text: string): string {
  return (text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
}
