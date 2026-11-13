import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import {
  recordGameScore,
  getTopLeaderboard,
  getUserByUid,
} from './src/db/users.ts';

import {
  sendGameSummaryEmail,
  maskEmail,
} from './src/lib/email.ts';
import {
  generateNewApiKey,
  listApiKeys,
  revokeApiKey,
} from './src/lib/apiKeys.ts';
import { createAuthRouter } from './src/server/authRoutes.ts';

import { GeoLocation, generateRandomMatchLocations } from './src/game/locations.ts';
import {
  LatLng,
  calculateHaversineDistance,
  calculateScore,
  calculateSpeedBonus,
  calculateDuelDamage,
} from './src/game/rules.ts';
import {
  MultiplayerMode,
  MapRegionFilter,
  PublicRoomSummary,
  normalizeRoomCode,
  generateReadableRoomCode,
  getRoundDurationForMode,
  canStartMultiplayerMatch,
  filterPublicRooms,
  pickQuickMatchRoom,
  computeMatchWinner,
  sanitizeChatMessage,
} from './src/game/lobbyRules.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ServerPlayer {
  id: string;
  name: string;
  avatar: string;
  hp: number;
  score: number;
  ready: boolean;
  isHost: boolean;
  ws: WebSocket;
}

interface ServerGuess {
  guess: LatLng;
  distanceKm: number;
  score: number;
  timeSeconds: number;
  speedBonus: number;
}

interface ServerChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  timestamp: number;
}

interface ServerRoom {
  id: string;
  name: string;
  isPublic: boolean;
  mode: MultiplayerMode;
  region: MapRegionFilter;
  createdAt: number;
  players: Map<string, ServerPlayer>;
  status: 'lobby' | 'countdown' | 'playing' | 'round_resolved' | 'game_over';
  currentRound: number;
  maxRounds: number;
  locations: GeoLocation[];
  guesses: Map<string, ServerGuess>;
  roundStartTime: number;
  roundEndsAt: number;
  roundTimer: NodeJS.Timeout | null;
  emergencyTimer: NodeJS.Timeout | null;
  countdownTimer: NodeJS.Timeout | null;
  readyNextRound: Set<string>;
  chatHistory: ServerChatMessage[];
}

const rooms = new Map<string, ServerRoom>();
const connectedSockets = new Set<WebSocket>();

function pickMatchLocations(region: MapRegionFilter = 'world'): GeoLocation[] {
  return generateRandomMatchLocations(5, region);
}

function getRoomSummaries(): PublicRoomSummary[] {
  const summaries: PublicRoomSummary[] = [];
  rooms.forEach((room) => {
    const players = Array.from(room.players.values());
    const host = players.find((p) => p.isHost) || players[0];
    if (!host) return;
    summaries.push({
      id: room.id,
      name: room.name,
      mode: room.mode,
      region: room.region,
      playerCount: room.players.size,
      maxPlayers: 2,
      hostName: host.name,
      hostAvatar: host.avatar,
      status: room.status,
      isPublic: room.isPublic,
      createdAt: room.createdAt,
    });
  });
  return filterPublicRooms(summaries);
}

function broadcastDirectoryUpdate() {
  const payload = {
    rooms: getRoomSummaries(),
    onlineCount: connectedSockets.size,
  };
  const msg = JSON.stringify({ type: 'ROOMS_LIST', payload });
  connectedSockets.forEach((sock) => {
    if (sock.readyState === WebSocket.OPEN) {
      sock.send(msg);
    }
  });
}

function clearRoomTimers(room: ServerRoom) {
  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
    room.roundTimer = null;
  }
  if (room.emergencyTimer) {
    clearTimeout(room.emergencyTimer);
    room.emergencyTimer = null;
  }
  if (room.countdownTimer) {
    clearTimeout(room.countdownTimer);
    room.countdownTimer = null;
  }
}

function broadcastToRoom(room: ServerRoom, type: string, payload: any) {
  const message = JSON.stringify({ type, payload });
  room.players.forEach((player) => {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(message);
    }
  });
}

function sendRoomState(room: ServerRoom) {
  room.players.forEach((player) => {
    if (player.ws.readyState === WebSocket.OPEN) {
      const statePayload = {
        roomId: room.id,
        roomName: room.name,
        playerId: player.id,
        isHost: player.isHost,
        isPublic: room.isPublic,
        mode: room.mode,
        region: room.region,
        status: room.status,
        currentRound: room.currentRound,
        maxRounds: room.maxRounds,
        chatHistory: room.chatHistory.slice(-40),
        players: Array.from(room.players.values()).map((p) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          hp: p.hp,
          score: p.score,
          ready: p.ready,
          isHost: p.isHost,
        })),
      };
      player.ws.send(JSON.stringify({ type: 'ROOM_STATE', payload: statePayload }));
    }
  });
}

function scheduleCountdownStart(room: ServerRoom, delayMs = 1500) {
  if (room.players.size < 2) return;
  if (room.countdownTimer) clearTimeout(room.countdownTimer);
  room.status = 'countdown';
  sendRoomState(room);
  broadcastDirectoryUpdate();
  room.countdownTimer = setTimeout(() => {
    room.countdownTimer = null;
    if (room.status === 'countdown' && room.players.size >= 2) {
      startRoomRound(room);
    } else if (room.players.size < 2) {
      room.status = 'lobby';
      sendRoomState(room);
      broadcastDirectoryUpdate();
    }
  }, delayMs);
}

function startRoomRound(room: ServerRoom) {
  clearRoomTimers(room);
  room.status = 'playing';
  room.guesses.clear();
  room.readyNextRound.clear();
  const durationSeconds = getRoundDurationForMode(room.mode);
  room.roundStartTime = Date.now();
  room.roundEndsAt = room.roundStartTime + durationSeconds * 1000;

  const loc = room.locations[room.currentRound - 1];

  broadcastToRoom(room, 'ROUND_START', {
    roundNumber: room.currentRound,
    mode: room.mode,
    location: loc,
    roundDurationSeconds: durationSeconds,
    roundEndsAt: room.roundEndsAt,
  });

  sendRoomState(room);
  broadcastDirectoryUpdate();

  // Authoritative timeout (+2s grace for network latency)
  room.roundTimer = setTimeout(() => {
    handleRoundTimeout(room);
  }, (durationSeconds + 2) * 1000);
}

function resolveRoomRound(room: ServerRoom) {
  if (room.status !== 'playing') return;
  clearRoomTimers(room);
  room.status = 'round_resolved';

  const loc = room.locations[room.currentRound - 1];
  const playerList = Array.from(room.players.values());

  if (playerList.length < 2) {
    room.status = 'game_over';
    broadcastToRoom(room, 'MATCH_OVER', {
      winnerId: playerList[0]?.id || '',
      reason: 'opponent_forfeit',
      isWinner: true,
      mode: room.mode,
    });
    sendRoomState(room);
    broadcastDirectoryUpdate();
    return;
  }

  const [p1, p2] = playerList;
  const maxDuration = getRoundDurationForMode(room.mode);
  const g1 = room.guesses.get(p1.id) || {
    guess: { lat: 0, lng: 0 },
    distanceKm: 20000,
    score: 0,
    timeSeconds: maxDuration,
    speedBonus: 0,
  };
  const g2 = room.guesses.get(p2.id) || {
    guess: { lat: 0, lng: 0 },
    distanceKm: 20000,
    score: 0,
    timeSeconds: maxDuration,
    speedBonus: 0,
  };

  p1.score += g1.score;
  p2.score += g2.score;

  let damage = 0;
  let damagedPlayerId: string | 'tie' = 'tie';
  const multiplier =
    room.currentRound >= 5
      ? 3.0
      : room.currentRound === 4
      ? 2.0
      : room.currentRound === 3
      ? 1.5
      : room.currentRound === 2
      ? 1.2
      : 1.0;

  if (room.mode === 'duel') {
    const damageRes = calculateDuelDamage(g1.score, g2.score, room.currentRound);
    damage = damageRes.damage;
    if (damageRes.loser === 'player') {
      p1.hp = Math.max(0, p1.hp - damage);
      damagedPlayerId = p1.id;
    } else if (damageRes.loser === 'opponent') {
      p2.hp = Math.max(0, p2.hp - damage);
      damagedPlayerId = p2.id;
    }
  } else {
    if (g1.score > g2.score) damagedPlayerId = p2.id;
    else if (g2.score > g1.score) damagedPlayerId = p1.id;
  }

  playerList.forEach((player) => {
    const isP1 = player.id === p1.id;
    const playerResult = {
      guess: isP1 ? g1.guess : g2.guess,
      distanceKm: isP1 ? g1.distanceKm : g2.distanceKm,
      score: isP1 ? g1.score : g2.score,
      hp: isP1 ? p1.hp : p2.hp,
      speedBonus: isP1 ? g1.speedBonus : g2.speedBonus,
    };
    const opponentResult = {
      guess: isP1 ? g2.guess : g1.guess,
      distanceKm: isP1 ? g2.distanceKm : g1.distanceKm,
      score: isP1 ? g2.score : g1.score,
      hp: isP1 ? p2.hp : p1.hp,
      speedBonus: isP1 ? g2.speedBonus : g1.speedBonus,
    };

    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(
        JSON.stringify({
          type: 'ROUND_RESOLVED',
          payload: {
            roundNumber: room.currentRound,
            mode: room.mode,
            actualLocation: loc,
            playerResult,
            opponentResult,
            damageDealt: damage,
            damagedPlayerId,
            damageMultiplier: room.mode === 'duel' ? multiplier : 1,
          },
        })
      );
    }
  });

  sendRoomState(room);

  const hpDepleted = room.mode === 'duel' && (p1.hp <= 0 || p2.hp <= 0);
  if (hpDepleted || room.currentRound >= room.maxRounds) {
    room.status = 'game_over';
    const winnerId = computeMatchWinner(
      playerList.map((p) => ({ id: p.id, hp: p.hp, score: p.score })),
      room.mode
    );

    playerList.forEach((p) => {
      if (p.ws.readyState === WebSocket.OPEN) {
        p.ws.send(
          JSON.stringify({
            type: 'MATCH_OVER',
            payload: {
              winnerId,
              reason: hpDepleted ? 'hp_depleted' : 'rounds_finished',
              isWinner: p.id === winnerId,
              mode: room.mode,
            },
          })
        );
      }
    });
    sendRoomState(room);
    broadcastDirectoryUpdate();
  }
}

function handleRoundTimeout(room: ServerRoom) {
  if (room.status === 'playing') {
    resolveRoomRound(room);
  }
}

function detachPlayerFromRoom(roomId: string, playerId: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  const leaving = room.players.get(playerId);
  room.players.delete(playerId);

  if (room.players.size === 0) {
    clearRoomTimers(room);
    rooms.delete(roomId);
    broadcastDirectoryUpdate();
    return;
  }

  // Promote remaining player to host if host left
  if (leaving?.isHost) {
    const remaining = Array.from(room.players.values())[0];
    if (remaining) remaining.isHost = true;
  }

  if (room.status === 'countdown') {
    if (room.countdownTimer) {
      clearTimeout(room.countdownTimer);
      room.countdownTimer = null;
    }
    room.status = 'lobby';
  }

  broadcastToRoom(room, 'OPPONENT_DISCONNECTED', {
    message: `${leaving?.name || 'Votre adversaire'} a quitté le salon.`,
  });

  if (room.status === 'playing' || room.status === 'round_resolved') {
    clearRoomTimers(room);
    room.status = 'game_over';
    const remainingId = Array.from(room.players.keys())[0];
    broadcastToRoom(room, 'MATCH_OVER', {
      winnerId: remainingId,
      reason: 'opponent_forfeit',
      isWinner: true,
      mode: room.mode,
    });
  }

  sendRoomState(room);
  broadcastDirectoryUpdate();
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = process.env.PORT || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // 1. Modular Authentication & SMTP OTP Routes
  app.use('/api/auth', createAuthRouter());

  // 1f. API Keys routes
  app.post('/api/keys/generate', (req, res) => {
    try {
      const name = (req.body?.name || 'GeoApex Client Key').toString().trim();
      const scopes = req.body?.scopes || ['maps:read', 'scores:write', 'duels:play'];
      const newKey = generateNewApiKey(name, scopes);
      res.json({ success: true, apiKey: newKey });
    } catch {
      res.status(500).json({ error: 'Failed to generate API key' });
    }
  });

  app.get('/api/keys/list', (_req, res) => {
    try {
      res.json({ success: true, keys: listApiKeys() });
    } catch {
      res.status(500).json({ error: 'Failed to list API keys' });
    }
  });

  app.post('/api/keys/revoke', (req, res) => {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'Key ID required' });
      res.json({ success: revokeApiKey(id) });
    } catch {
      res.status(500).json({ error: 'Failed to revoke API key' });
    }
  });

  // 2. Scores & Email Summary
  app.post('/api/scores', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });

      const { mode, score, roundsCompleted, isVictory, email: clientEmail } = req.body;
      if (!mode || typeof score !== 'number' || typeof roundsCompleted !== 'number') {
        return res.status(400).json({ error: 'Invalid score payload' });
      }

      await recordGameScore(uid, mode, score, roundsCompleted, !!isVictory);

      let targetEmail = req.user?.email || clientEmail;
      let targetName = req.user?.name || req.user?.displayName || 'Explorateur GeoApex';

      if ((!targetEmail || !targetEmail.includes('@')) && uid) {
        try {
          const dbUser = await getUserByUid(uid);
          if (dbUser?.email) {
            targetEmail = dbUser.email;
            targetName = dbUser.displayName || targetName;
          }
        } catch {}
      }

      let emailSummary = null;
      if (targetEmail && targetEmail.includes('@')) {
        try {
          emailSummary = await sendGameSummaryEmail(targetEmail, targetName, {
            score,
            mode,
            roundsCompleted,
            isVictory: !!isVictory,
          });
        } catch (e: any) {
          console.log('[SCORE EMAIL NOTICE] Failed to send summary:', e.message);
        }
      }

      res.json({
        success: true,
        score,
        emailSent: emailSummary?.deliveredToRealInbox || false,
        deliveredToRealInbox: emailSummary?.deliveredToRealInbox || false,
        relayType: emailSummary?.relayType,
        recipient: targetEmail ? maskEmail(targetEmail) : null,
        previewUrl: emailSummary?.previewUrl || undefined,
        emailSummary,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to save score' });
    }
  });

  app.post('/api/scores/send-summary-email', async (req, res) => {
    try {
      const { email, playerName, score, mode, roundsCompleted, isVictory } = req.body;
      if (!email || !email.includes('@') || typeof score !== 'number') {
        return res.status(400).json({ success: false, error: 'Email valide et score requis.' });
      }

      const result = await sendGameSummaryEmail(email.trim().toLowerCase(), playerName, {
        score,
        mode: mode || 'classic',
        roundsCompleted: roundsCompleted || 5,
        isVictory: !!isVictory,
      });

      res.json({
        success: true,
        message: result.deliveredToRealInbox
          ? `✓ Récapitulatif expédié directement dans la boîte de ${email} (${result.relayType.toUpperCase()}) !`
          : `Relais d'aperçu Ethereal actif : consultez le certificat ci-dessous ou configurez votre relais réel.`,
        isRealSmtp: result.isRealSmtp,
        deliveredToRealInbox: result.deliveredToRealInbox,
        relayType: result.relayType,
        previewUrl: result.previewUrl || undefined,
        emailSummary: result,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Échec de transmission.' });
    }
  });

  // 3. Leaderboard
  app.get('/api/leaderboard', async (_req, res) => {
    try {
      const leaderboard = await getTopLeaderboard(10);
      res.json({ leaderboard });
    } catch {
      res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
  });

  // 4. Online Multiplayer HTTP Rooms Directory
  app.get('/api/multiplayer/rooms', (_req, res) => {
    res.json({
      rooms: getRoomSummaries(),
      onlineCount: connectedSockets.size,
    });
  });

  // 5. WebSocket Server for Real-Time Multiplayer
  const wss = new WebSocketServer({ noServer: true });

  // Heartbeat keepalive to prevent Cloud Run / proxy idle disconnects
  const heartbeatSet = new WeakMap<WebSocket, boolean>();
  const wsHeartbeatInterval = setInterval(() => {
    wss.clients.forEach((client) => {
      if (heartbeatSet.get(client) === false) {
        client.terminate();
        return;
      }
      heartbeatSet.set(client, false);
      try {
        client.ping();
      } catch {}
    });
  }, 20000);

  wss.on('close', () => clearInterval(wsHeartbeatInterval));

  server.on('upgrade', (request, socket, head) => {
    try {
      const parsedUrl = new URL(request.url || '', 'http://localhost');
      const cleanPath = parsedUrl.pathname.replace(/\/+$/, '') || '/';
      if (cleanPath === '/ws' || parsedUrl.pathname === '/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    } catch {}
  });

  wss.on('connection', (ws: WebSocket) => {
    connectedSockets.add(ws);
    heartbeatSet.set(ws, true);
    ws.on('pong', () => heartbeatSet.set(ws, true));

    let currentRoomId: string | null = null;
    const playerId = `player_${Math.random().toString(36).substring(2, 9)}`;

    // Send immediate directory snapshot on connect
    ws.send(
      JSON.stringify({
        type: 'ROOMS_LIST',
        payload: { rooms: getRoomSummaries(), onlineCount: connectedSockets.size },
      })
    );
    broadcastDirectoryUpdate();

    ws.on('message', (data: string) => {
      try {
        const msg = JSON.parse(data);
        const { type, payload } = msg;

        if (type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', payload: { ts: payload?.ts || Date.now(), serverTime: Date.now() } }));
          return;
        }

        if (type === 'LIST_ROOMS') {
          ws.send(
            JSON.stringify({
              type: 'ROOMS_LIST',
              payload: { rooms: getRoomSummaries(), onlineCount: connectedSockets.size },
            })
          );
          return;
        }

        if (type === 'LOBBY_JOIN') {
          const requestedMode: MultiplayerMode =
            payload?.mode === 'classic' || payload?.mode === 'blitz' ? payload.mode : 'duel';
          const requestedRegion: MapRegionFilter =
            payload?.region === 'france' || payload?.region === 'capitals' || payload?.region === 'rural'
              ? payload.region
              : 'world';
          let reqRoomId = normalizeRoomCode(payload?.roomId || '');

          if (!reqRoomId || reqRoomId === 'QUICK') {
            const match = pickQuickMatchRoom(getRoomSummaries(), requestedMode);
            reqRoomId = match ? match.id : generateReadableRoomCode();
          }

          if (currentRoomId && currentRoomId !== reqRoomId) {
            detachPlayerFromRoom(currentRoomId, playerId);
          }

          let room = rooms.get(reqRoomId);
          if (!room || room.status === 'game_over') {
            if (room) clearRoomTimers(room);
            const isPublic = payload?.isPublic ?? (payload?.roomId === 'QUICK');
            const roomName =
              (payload?.roomName || '').trim().slice(0, 32) ||
              (isPublic ? `Arène ${reqRoomId}` : `Salon ${reqRoomId}`);
            room = {
              id: reqRoomId,
              name: roomName,
              isPublic,
              mode: requestedMode,
              region: requestedRegion,
              createdAt: Date.now(),
              players: new Map(),
              status: 'lobby',
              currentRound: 1,
              maxRounds: 5,
              locations: pickMatchLocations(requestedRegion),
              guesses: new Map(),
              roundStartTime: 0,
              roundEndsAt: 0,
              roundTimer: null,
              emergencyTimer: null,
              countdownTimer: null,
              readyNextRound: new Set(),
              chatHistory: [],
            };
            rooms.set(reqRoomId, room);
          }

          if (room.players.size >= 2 && !room.players.has(playerId)) {
            ws.send(
              JSON.stringify({
                type: 'ROOM_ERROR',
                payload: { message: 'Ce salon est déjà complet (2 joueurs max).' },
              })
            );
            return;
          }

          if (room.status === 'playing' || room.status === 'round_resolved') {
            ws.send(
              JSON.stringify({
                type: 'ROOM_ERROR',
                payload: { message: 'Ce duel a déjà commencé.' },
              })
            );
            return;
          }

          currentRoomId = reqRoomId;
          const isHost = room.players.size === 0;
          const playerName = (payload?.playerName || '').trim().slice(0, 20) || (isHost ? 'Hôte' : 'Challenger');
          const playerAvatar = payload?.avatar || (isHost ? '👑' : '⚡');

          room.players.set(playerId, {
            id: playerId,
            name: playerName,
            avatar: playerAvatar,
            hp: 6000,
            score: 0,
            ready: true,
            isHost,
            ws,
          });

          const joinSysMsg: ServerChatMessage = {
            id: `sys_${Date.now()}_${Math.random()}`,
            senderId: 'system',
            senderName: 'Serveur',
            senderAvatar: '🛰️',
            text: `${playerName} a rejoint le salon.`,
            timestamp: Date.now(),
          };
          room.chatHistory.push(joinSysMsg);
          if (room.chatHistory.length > 50) room.chatHistory.shift();

          broadcastToRoom(room, 'CHAT_MESSAGE', joinSysMsg);
          sendRoomState(room);
          broadcastDirectoryUpdate();

          if (room.players.size === 2) {
            broadcastToRoom(room, 'PLAYERS_READY_TO_START', {
              message: '2 joueurs connectés ! Lancement du duel...',
            });
            const targetRoomId = reqRoomId;
            setTimeout(() => {
              const r = rooms.get(targetRoomId);
              if (r && r.status === 'lobby' && r.players.size === 2) {
                const allReady = Array.from(r.players.values()).every((p) => p.ready);
                if (allReady) scheduleCountdownStart(r, 1500);
              }
            }, 1200);
          }
        } else if (type === 'LOBBY_CHAT' && currentRoomId) {
          const room = rooms.get(currentRoomId);
          const sender = room?.players.get(playerId);
          const text = sanitizeChatMessage(payload?.text || '');
          if (room && sender && text) {
            const chatMsg: ServerChatMessage = {
              id: `msg_${Date.now()}_${Math.random()}`,
              senderId: playerId,
              senderName: sender.name,
              senderAvatar: sender.avatar,
              text,
              timestamp: Date.now(),
            };
            room.chatHistory.push(chatMsg);
            if (room.chatHistory.length > 50) room.chatHistory.shift();
            broadcastToRoom(room, 'CHAT_MESSAGE', chatMsg);
          }
        } else if (type === 'LOBBY_READY' && currentRoomId) {
          const room = rooms.get(currentRoomId);
          if (room && room.status === 'lobby') {
            const player = room.players.get(playerId);
            if (player) {
              player.ready = !!payload?.ready;
              sendRoomState(room);
              const allReady = Array.from(room.players.values()).every((p) => p.ready);
              if (room.players.size === 2 && allReady) {
                scheduleCountdownStart(room, 1500);
              }
            }
          }
        } else if (type === 'LOBBY_START' && currentRoomId) {
          const room = rooms.get(currentRoomId);
          const player = room?.players.get(playerId);
          if (room && player) {
            const check = canStartMultiplayerMatch(room.players.size, player.isHost);
            if (!check.ok) {
              ws.send(JSON.stringify({ type: 'ROOM_ERROR', payload: { message: check.reason } }));
              return;
            }
            if (room.status === 'lobby' || room.status === 'game_over') {
              scheduleCountdownStart(room, 1200);
            }
          }
        } else if (type === 'PLAYER_GUESS' && currentRoomId) {
          const room = rooms.get(currentRoomId);
          if (room && room.status === 'playing') {
            const guess = payload?.guess as LatLng;
            const timeSeconds =
              payload?.timeSeconds || Math.max(1, Math.round((Date.now() - room.roundStartTime) / 1000));

            if (guess && typeof guess.lat === 'number' && typeof guess.lng === 'number') {
              const loc = room.locations[room.currentRound - 1];
              const dist = calculateHaversineDistance({ lat: loc.lat, lng: loc.lng }, guess);
              const baseScore = calculateScore(dist);
              const speedBonus = calculateSpeedBonus(timeSeconds);
              const totalRoundScore = Math.min(5000, baseScore + speedBonus);

              room.guesses.set(playerId, {
                guess,
                distanceKm: dist,
                score: totalRoundScore,
                timeSeconds,
                speedBonus,
              });

              const emergencySeconds = 15;
              const emergencyEndsAt = Date.now() + emergencySeconds * 1000;

              room.players.forEach((p) => {
                if (p.id !== playerId && p.ws.readyState === WebSocket.OPEN) {
                  p.ws.send(
                    JSON.stringify({
                      type: 'OPPONENT_GUESSED',
                      payload: {
                        emergencySeconds,
                        emergencyEndsAt,
                        message: "Votre adversaire a validé son repère ! 15 secondes restantes !",
                      },
                    })
                  );
                }
              });

              if (room.guesses.size === 1 && !room.emergencyTimer) {
                room.emergencyTimer = setTimeout(() => {
                  resolveRoomRound(room);
                }, emergencySeconds * 1000);
              }

              if (room.guesses.size >= room.players.size) {
                resolveRoomRound(room);
              }
            }
          }
        } else if (type === 'ROUND_READY_NEXT' && currentRoomId) {
          const room = rooms.get(currentRoomId);
          if (room && room.status === 'round_resolved') {
            room.readyNextRound.add(playerId);
            if (room.readyNextRound.size >= room.players.size) {
              room.currentRound += 1;
              if (room.currentRound <= room.maxRounds) {
                startRoomRound(room);
              }
            }
          }
        } else if (type === 'MATCH_REMATCH' && currentRoomId) {
          const room = rooms.get(currentRoomId);
          if (room && room.players.size >= 2) {
            clearRoomTimers(room);
            room.status = 'lobby';
            room.currentRound = 1;
            room.locations = pickMatchLocations(room.region);
            room.guesses.clear();
            room.readyNextRound.clear();
            room.players.forEach((p) => {
              p.hp = 6000;
              p.score = 0;
              p.ready = true;
            });
            broadcastToRoom(room, 'REMATCH_RESET', { message: 'Revanche lancée avec 5 nouveaux lieux !' });
            scheduleCountdownStart(room, 1400);
          } else {
            ws.send(
              JSON.stringify({
                type: 'ROOM_ERROR',
                payload: { message: 'Impossible de relancer : votre adversaire a quitté le salon.' },
              })
            );
          }
        } else if (type === 'SEND_EMOTE' && currentRoomId) {
          const room = rooms.get(currentRoomId);
          if (room) {
            const sender = room.players.get(playerId);
            broadcastToRoom(room, 'EMOTE_BROADCAST', {
              senderId: playerId,
              senderName: sender?.name || 'Joueur',
              emote: payload?.emote || '🎯',
            });
          }
        } else if (type === 'LOBBY_LEAVE' && currentRoomId) {
          detachPlayerFromRoom(currentRoomId, playerId);
          currentRoomId = null;
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      connectedSockets.delete(ws);
      if (currentRoomId) {
        detachPlayerFromRoom(currentRoomId, playerId);
      } else {
        broadcastDirectoryUpdate();
      }
    });
  });

  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, () => {
    console.log(
      `Server running on http://localhost:${PORT} in ${isProduction ? 'production' : 'development'} mode with WebSocket support on /ws`
    );
  });
}

startServer();
