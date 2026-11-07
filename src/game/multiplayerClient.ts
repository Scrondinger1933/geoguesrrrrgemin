import { GeoLocation } from './locations';
import { LatLng } from './rules';

export interface MultiplayerPlayer {
  id: string;
  name: string;
  avatar: string;
  hp: number;
  ready: boolean;
  isHost: boolean;
  score: number;
}

export interface MultiplayerRoomState {
  roomId: string;
  playerId: string;
  isHost: boolean;
  status: 'lobby' | 'countdown' | 'playing' | 'round_resolved' | 'game_over';
  players: MultiplayerPlayer[];
  currentRound: number;
  maxRounds: number;
}

export interface MultiplayerRoundStart {
  roundNumber: number;
  location: GeoLocation;
  roundDurationSeconds: number;
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
}

export interface EmoteEvent {
  senderId: string;
  senderName: string;
  emote: string;
}

type EventCallback<T = any> = (data: T) => void;

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  public state: MultiplayerRoomState | null = null;
  public isConnected = false;
  private reconnectTimer: number | null = null;
  private lastJoinPayload: { roomId?: string; playerName: string; avatar: string } | null = null;

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
        // Re-join room if disconnected mid-game
        if (this.lastJoinPayload && this.state?.roomId) {
          this.send('LOBBY_JOIN', this.lastJoinPayload);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.emit('connection_status', { connected: false });
        // Attempt reconnect after 2 seconds
        if (!this.reconnectTimer) {
          this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
          }, 2000);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('Multiplayer WebSocket error:', err);
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const { type, payload } = message;

          if (type === 'ROOM_STATE') {
            this.state = payload;
          }

          this.emit(type, payload);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };
    } catch (err) {
      console.error('WebSocket connection failed:', err);
    }
  }

  public on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
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
        } catch (e) {
          console.error(`Error in listener for ${event}:`, e);
        }
      });
    }
  }

  public send(type: string, payload?: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send message, WebSocket not connected:', type);
      return;
    }
    this.ws.send(JSON.stringify({ type, payload }));
  }

  public joinRoom(roomId: string, playerName: string, avatar: string) {
    this.lastJoinPayload = { roomId: roomId.trim().toUpperCase(), playerName, avatar };
    this.send('LOBBY_JOIN', this.lastJoinPayload);
  }

  public quickMatch(playerName: string, avatar: string) {
    this.lastJoinPayload = { roomId: 'QUICK', playerName, avatar };
    this.send('LOBBY_JOIN', this.lastJoinPayload);
  }

  public setReady(ready: boolean) {
    this.send('LOBBY_READY', { ready });
  }

  public startGame() {
    this.send('LOBBY_START');
  }

  public submitGuess(guess: LatLng, timeSeconds: number) {
    this.send('PLAYER_GUESS', { guess, timeSeconds });
  }

  public readyForNextRound() {
    this.send('ROUND_READY_NEXT');
  }

  public sendEmote(emote: string) {
    this.send('SEND_EMOTE', { emote });
  }

  public leaveRoom() {
    this.send('LOBBY_LEAVE');
    this.lastJoinPayload = null;
    this.state = null;
  }

  public disconnect() {
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
