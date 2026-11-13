import { GeoLocation } from './locations';
import { LatLng } from './rules';
import type { MultiplayerMode, MapRegionFilter, PublicRoomSummary } from './lobbyRules';

export type { MultiplayerMode, MapRegionFilter, PublicRoomSummary };

export interface MultiplayerPlayer {
  id: string;
  name: string;
  avatar: string;
  hp: number;
  ready: boolean;
  isHost: boolean;
  score: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  timestamp: number;
}

export interface MultiplayerRoomState {
  roomId: string;
  roomName: string;
  playerId: string;
  isHost: boolean;
  isPublic: boolean;
  mode: MultiplayerMode;
  region: MapRegionFilter;
  status: 'lobby' | 'countdown' | 'playing' | 'round_resolved' | 'game_over';
  players: MultiplayerPlayer[];
  currentRound: number;
  maxRounds: number;
  chatHistory: ChatMessage[];
}

export interface MultiplayerRoundStart {
  roundNumber: number;
  mode: MultiplayerMode;
  location: GeoLocation;
  roundDurationSeconds: number;
  roundEndsAt: number;
}

export interface PlayerRoundSummary {
  guess: LatLng;
  distanceKm: number;
  score: number;
  hp: number;
  speedBonus?: number;
}

export interface MultiplayerRoundResolved {
  roundNumber: number;
  mode: MultiplayerMode;
  actualLocation: GeoLocation;
  playerResult: PlayerRoundSummary;
  opponentResult: PlayerRoundSummary;
  damageDealt: number;
  damagedPlayerId: string | 'tie';
  damageMultiplier: number;
}

export interface MultiplayerMatchOver {
  winnerId: string;
  reason: 'hp_depleted' | 'rounds_finished' | 'opponent_forfeit';
  isWinner: boolean;
  mode: MultiplayerMode;
}

export interface EmoteEvent {
  senderId: string;
  senderName: string;
  emote: string;
}

export interface RoomsDirectorySnapshot {
  rooms: PublicRoomSummary[];
  onlineCount: number;
}

type EventCallback<T = any> = (data: T) => void;

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  public state: MultiplayerRoomState | null = null;
  public lastRoundStart: MultiplayerRoundStart | null = null;
  public directory: RoomsDirectorySnapshot = { rooms: [], onlineCount: 0 };
  public isConnected = false;
  public latencyMs: number | null = null;

  private reconnectTimer: number | null = null;
  private pingInterval: number | null = null;
  private lastJoinPayload: {
    roomId?: string;
    roomName?: string;
    mode?: MultiplayerMode;
    region?: MapRegionFilter;
    isPublic?: boolean;
    playerName: string;
    avatar: string;
  } | null = null;
  private pendingQueue: string[] = [];

  constructor() {
    this.connect();
  }

  public connect() {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.emit('connection_status', { connected: true });

        while (this.pendingQueue.length > 0) {
          const queued = this.pendingQueue.shift();
          if (queued && this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(queued);
          }
        }

        // Request directory snapshot immediately
        this.send('LIST_ROOMS');
        this.startHeartbeat();

        // Re-join room only if we were previously in lobby waiting
        if (this.lastJoinPayload && this.state?.roomId) {
          this.send('LOBBY_JOIN', this.lastJoinPayload);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.stopHeartbeat();
        this.emit('connection_status', { connected: false });
        if (!this.reconnectTimer) {
          this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
          }, 1500);
        }
      };

      this.ws.onerror = () => {
        // Handled quietly via onclose reconnect
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const { type, payload } = message;

          if (type === 'PONG' && typeof payload?.ts === 'number') {
            this.latencyMs = Math.max(1, Date.now() - payload.ts);
            this.emit('LATENCY_UPDATE', { latencyMs: this.latencyMs });
            return;
          }

          if (type === 'ROOMS_LIST') {
            this.directory = payload;
          } else if (type === 'ROOM_STATE') {
            this.state = payload;
          } else if (type === 'ROUND_START') {
            this.lastRoundStart = payload;
          } else if (type === 'REMATCH_RESET' || type === 'MATCH_OVER') {
            this.lastRoundStart = null;
          }

          this.emit(type, payload);
        } catch {
          // Ignore malformed frame
        }
      };
    } catch {
      // Ignore connection setup error during SSR/headless boot
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.send('PING', { ts: Date.now() });
    this.pingInterval = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send('PING', { ts: Date.now() });
      }
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    if (event === 'ROOM_STATE' && this.state) {
      try {
        callback(this.state);
      } catch {}
    } else if (event === 'ROOMS_LIST' && this.directory) {
      try {
        callback(this.directory);
      } catch {}
    } else if (event === 'connection_status') {
      try {
        callback({ connected: this.isConnected });
      } catch {}
    } else if (event === 'ROUND_START' && this.lastRoundStart && this.state?.status === 'playing') {
      try {
        callback(this.lastRoundStart);
      } catch {}
    }

    return () => this.off(event, callback);
  }

  public off(event: string, callback: EventCallback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(data);
        } catch {}
      });
    }
  }

  public send(type: string, payload?: any) {
    const message = JSON.stringify({ type, payload });
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (type !== 'PING') {
        this.pendingQueue.push(message);
      }
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        this.connect();
      }
      return;
    }
    try {
      this.ws.send(message);
    } catch {
      if (type !== 'PING') this.pendingQueue.push(message);
    }
  }

  public refreshRooms() {
    this.send('LIST_ROOMS');
  }

  public joinRoom(
    roomId: string,
    playerName: string,
    avatar: string,
    options?: {
      roomName?: string;
      mode?: MultiplayerMode;
      region?: MapRegionFilter;
      isPublic?: boolean;
    }
  ) {
    this.lastRoundStart = null;
    this.lastJoinPayload = {
      roomId: roomId.trim().toUpperCase(),
      playerName,
      avatar,
      ...options,
    };
    this.send('LOBBY_JOIN', this.lastJoinPayload);
  }

  public quickMatch(
    playerName: string,
    avatar: string,
    mode: MultiplayerMode = 'duel',
    region: MapRegionFilter = 'world'
  ) {
    this.lastRoundStart = null;
    this.lastJoinPayload = {
      roomId: 'QUICK',
      playerName,
      avatar,
      mode,
      region,
      isPublic: true,
    };
    this.send('LOBBY_JOIN', this.lastJoinPayload);
  }

  public setReady(ready: boolean) {
    this.send('LOBBY_READY', { ready });
  }

  public startGame() {
    this.send('LOBBY_START');
  }

  public sendChat(text: string) {
    if (!text.trim()) return;
    this.send('LOBBY_CHAT', { text });
  }

  public submitGuess(guess: LatLng, timeSeconds: number) {
    this.send('PLAYER_GUESS', { guess, timeSeconds });
  }

  public readyForNextRound() {
    this.send('ROUND_READY_NEXT');
  }

  public requestRematch() {
    this.lastRoundStart = null;
    this.send('MATCH_REMATCH');
  }

  public sendEmote(emote: string) {
    this.send('SEND_EMOTE', { emote });
  }

  public leaveRoom() {
    this.send('LOBBY_LEAVE');
    this.lastJoinPayload = null;
    this.lastRoundStart = null;
    this.state = null;
  }

  public disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const multiplayerClient = new MultiplayerClient();
