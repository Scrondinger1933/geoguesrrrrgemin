import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import {
  getOrCreateUser,
  recordGameScore,
  getTopLeaderboard,
  createVerificationCode,
  verifyCodeAndCreateAccount,
} from './src/db/users.ts';
import {
  sendVerificationEmail,
  getActiveSmtpConfig,
  saveSmtpConfig,
} from './src/lib/email.ts';
import { WORLD_LOCATIONS, GeoLocation } from './src/game/locations.ts';
import {
  LatLng,
  calculateHaversineDistance,
  calculateScore,
  calculateSpeedBonus,
  calculateDuelDamage,
} from './src/game/rules.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Real-Time Multiplayer Room & Player Types
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

interface ServerRoom {
  id: string;
  players: Map<string, ServerPlayer>;
  status: 'lobby' | 'countdown' | 'playing' | 'round_resolved' | 'game_over';
  currentRound: number;
  maxRounds: number;
  locations: GeoLocation[];
  guesses: Map<string, ServerGuess>;
  roundStartTime: number;
  roundTimer: NodeJS.Timeout | null;
  emergencyTimer: NodeJS.Timeout | null;
  readyNextRound: Set<string>;
}

const rooms = new Map<string, ServerRoom>();

// Helper: Pick 5 distinct random locations for the match
function pickMatchLocations(): GeoLocation[] {
  const shuffled = [...WORLD_LOCATIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 5);
}

// Helper: Broadcast event to all players in a room
function broadcastToRoom(room: ServerRoom, type: string, payload: any) {
  const message = JSON.stringify({ type, payload });
  room.players.forEach((player) => {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(message);
    }
  });
}

// Helper: Send personalized room state to each player
function sendRoomState(room: ServerRoom) {
  room.players.forEach((player) => {
    if (player.ws.readyState === WebSocket.OPEN) {
      const statePayload = {
        roomId: room.id,
        playerId: player.id,
        isHost: player.isHost,
        status: room.status,
        currentRound: room.currentRound,
        maxRounds: room.maxRounds,
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

// Start a game round
function startRoomRound(room: ServerRoom) {
  room.status = 'playing';
  room.guesses.clear();
  room.readyNextRound.clear();
  room.roundStartTime = Date.now();

  if (room.roundTimer) clearTimeout(room.roundTimer);
  if (room.emergencyTimer) clearTimeout(room.emergencyTimer);

  const loc = room.locations[room.currentRound - 1];

  broadcastToRoom(room, 'ROUND_START', {
    roundNumber: room.currentRound,
    location: loc,
    roundDurationSeconds: 60,
  });

  sendRoomState(room);

  // Authoritative 65-second round timeout
  room.roundTimer = setTimeout(() => {
    handleRoundTimeout(room);
  }, 65000);
}

// Handle end of round when both players guessed or time expired
function resolveRoomRound(room: ServerRoom) {
  if (room.status !== 'playing') return;
  room.status = 'round_resolved';

  if (room.roundTimer) clearTimeout(room.roundTimer);
  if (room.emergencyTimer) clearTimeout(room.emergencyTimer);

  const loc = room.locations[room.currentRound - 1];
  const actual = { lat: loc.lat, lng: loc.lng };
  const playerList = Array.from(room.players.values());

  if (playerList.length < 2) {
    room.status = 'game_over';
    broadcastToRoom(room, 'MATCH_OVER', {
      winnerId: playerList[0]?.id || '',
      reason: 'opponent_forfeit',
      isWinner: true,
    });
    sendRoomState(room);
    return;
  }

  const [p1, p2] = playerList;
  const g1 = room.guesses.get(p1.id) || {
    guess: { lat: 0, lng: 0 },
    distanceKm: 20000,
    score: 0,
    timeSeconds: 65,
    speedBonus: 0,
  };
  const g2 = room.guesses.get(p2.id) || {
    guess: { lat: 0, lng: 0 },
    distanceKm: 20000,
    score: 0,
    timeSeconds: 65,
    speedBonus: 0,
  };

  p1.score += g1.score;
  p2.score += g2.score;

  // Calculate damage
  const damageRes = calculateDuelDamage(g1.score, g2.score, room.currentRound);
  let damagedPlayerId: string | 'tie' = 'tie';

  if (damageRes.loser === 'player') {
    p1.hp = Math.max(0, p1.hp - damageRes.damage);
    damagedPlayerId = p1.id;
  } else if (damageRes.loser === 'opponent') {
    p2.hp = Math.max(0, p2.hp - damageRes.damage);
    damagedPlayerId = p2.id;
  }

  const multiplier =
    room.currentRound >= 5 ? 3.0 : room.currentRound === 4 ? 2.0 : room.currentRound === 3 ? 1.5 : room.currentRound === 2 ? 1.2 : 1.0;

  // Send individualized payload to each player
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
            actualLocation: loc,
            playerResult,
            opponentResult,
            damageDealt: damageRes.damage,
            damagedPlayerId,
            damageMultiplier: multiplier,
          },
        })
      );
    }
  });

  sendRoomState(room);

  // Check Game Over condition (HP depleted or 5 rounds finished)
  if (p1.hp <= 0 || p2.hp <= 0 || room.currentRound >= room.maxRounds) {
    room.status = 'game_over';
    let winnerId = '';
    if (p1.hp > p2.hp) winnerId = p1.id;
    else if (p2.hp > p1.hp) winnerId = p2.id;
    else winnerId = p1.score >= p2.score ? p1.id : p2.id;

    playerList.forEach((p) => {
      if (p.ws.readyState === WebSocket.OPEN) {
        p.ws.send(
          JSON.stringify({
            type: 'MATCH_OVER',
            payload: {
              winnerId,
              reason: p1.hp <= 0 || p2.hp <= 0 ? 'hp_depleted' : 'rounds_finished',
              isWinner: p.id === winnerId,
            },
          })
        );
      }
    });
    sendRoomState(room);
  }
}

// Timeout handler if time expired without guess
function handleRoundTimeout(room: ServerRoom) {
  if (room.status === 'playing') {
    resolveRoomRound(room);
  }
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = process.env.PORT || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // 1. Sync User Profile from Firebase to Cloud SQL PostgreSQL
  app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email;
      const name = req.body.displayName || req.user?.name;
      const avatar = req.body.avatarUrl || req.user?.picture;

      if (!uid || !email) {
        return res.status(400).json({ error: 'UID and email are required' });
      }

      const user = await getOrCreateUser(uid, email, name, avatar);
      res.json({ user });
    } catch (error: any) {
      console.error('Failed to sync user:', error);
      res.status(500).json({ error: 'Failed to sync user' });
    }
  });

  // 1b. Send 6-digit email verification code for account creation
  app.post('/api/auth/send-verification-code', async (req, res) => {
    try {
      const { email, displayName } = req.body;
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'Adresse email invalide' });
      }

      const code = await createVerificationCode(email);
      console.log(`[AUTH] Verification code generated for ${email}: ${code}`);

      let emailResult = null;
      try {
        emailResult = await sendVerificationEmail(email, code, displayName);
      } catch (mailErr: any) {
        console.error('Email sending warning:', mailErr.message);
      }

      res.json({
        success: true,
        message: emailResult?.isRealSmtp
          ? `E-mail envoyé avec succès à ${email} ! Vérifiez votre boîte de réception.`
          : `Code de vérification généré pour ${email}`,
        email,
        verificationCode: code, // Kept for immediate fallback/convenience
        isRealSmtp: emailResult?.isRealSmtp ?? false,
        previewUrl: emailResult?.previewUrl || null,
      });
    } catch (err: any) {
      console.error('Failed to send verification code:', err);
      res.status(500).json({ error: 'Erreur lors de la génération du code de vérification' });
    }
  });

  // 1b-2. Check SMTP status
  app.get('/api/auth/smtp-status', (_req, res) => {
    const config = getActiveSmtpConfig();
    res.json({
      configured: !!config,
      user: config?.user ? config.user.replace(/(?<=.{2}).(?=.*@)/g, '*') : null,
      host: config?.host || 'smtp.gmail.com',
      port: config?.port || 587,
    });
  });

  // 1b-3. Save and test SMTP configuration (e.g. Gmail App Password or Brevo)
  app.post('/api/auth/configure-smtp', async (req, res) => {
    try {
      const { user, pass, host, port, fromName } = req.body;
      if (!user || !pass) {
        return res.status(400).json({ error: 'Identifiant (email) et mot de passe SMTP requis.' });
      }

      saveSmtpConfig({
        user: user.trim(),
        pass: pass.trim(),
        host: (host || 'smtp.gmail.com').trim(),
        port: port ? parseInt(port, 10) : 587,
        fromName: fromName ? fromName.trim() : 'GeoApex 3D',
      });

      res.json({ success: true, message: 'Configuration SMTP enregistrée avec succès !' });
    } catch (err: any) {
      res.status(500).json({ error: 'Impossible d’enregistrer la configuration SMTP.' });
    }
  });

  // 1c. Verify code and create / activate Cloud SQL user account
  app.post('/api/auth/verify-and-register', async (req, res) => {
    try {
      const { email, code, displayName, avatarUrl } = req.body;
      if (!email || !code) {
        return res.status(400).json({ error: 'Email et code de vérification obligatoires' });
      }

      const user = await verifyCodeAndCreateAccount(email, code, displayName, avatarUrl);
      res.json({
        success: true,
        user: {
          id: user.id,
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          highestScore: user.highestScore,
          gamesPlayed: user.gamesPlayed,
          duelsWon: user.duelsWon,
          emailVerified: user.emailVerified,
        },
        token: user.uid, // user.uid starts with 'email_' which requireAuth validates
      });
    } catch (err: any) {
      console.error('Failed to verify and register:', err);
      res.status(400).json({ error: err.message || 'Code de vérification invalide ou expiré' });
    }
  });

  // 2. Record Game Score & Update Statistics
  app.post('/api/scores', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { mode, score, roundsCompleted, isVictory } = req.body;
      if (!mode || typeof score !== 'number' || typeof roundsCompleted !== 'number') {
        return res.status(400).json({ error: 'Invalid score payload' });
      }

      await recordGameScore(uid, mode, score, roundsCompleted, !!isVictory);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to save score:', error);
      res.status(500).json({ error: 'Failed to save score' });
    }
  });

  // 3. Global Leaderboard from Cloud SQL
  app.get('/api/leaderboard', async (_req, res) => {
    try {
      const leaderboard = await getTopLeaderboard(10);
      res.json({ leaderboard });
    } catch (error: any) {
      console.error('Failed to fetch leaderboard:', error);
      res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
  });

  // 4. WebSocket Server for Real-Time Multiplayer Duels
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url || '', `http://${request.headers.host}`);
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    let currentRoomId: string | null = null;
    let playerId = `player_${Math.random().toString(36).substring(2, 9)}`;

    ws.on('message', (data: string) => {
      try {
        const msg = JSON.parse(data);
        const { type, payload } = msg;

        // --- LOBBY_JOIN: Join or create a room ---
        if (type === 'LOBBY_JOIN') {
          let reqRoomId = (payload?.roomId || '').trim().toUpperCase();

          // Quick Match: Find first open room with 1 player
          if (!reqRoomId || reqRoomId === 'QUICK') {
            for (const [rId, r] of rooms.entries()) {
              if (r.status === 'lobby' && r.players.size === 1) {
                reqRoomId = rId;
                break;
              }
            }
            if (!reqRoomId || reqRoomId === 'QUICK') {
              reqRoomId = `APEX-${Math.floor(1000 + Math.random() * 9000)}`;
            }
          }

          let room = rooms.get(reqRoomId);
          if (!room) {
            room = {
              id: reqRoomId,
              players: new Map(),
              status: 'lobby',
              currentRound: 1,
              maxRounds: 5,
              locations: pickMatchLocations(),
              guesses: new Map(),
              roundStartTime: 0,
              roundTimer: null,
              emergencyTimer: null,
              readyNextRound: new Set(),
            };
            rooms.set(reqRoomId, room);
          }

          if (room.players.size >= 2 && !room.players.has(playerId)) {
            ws.send(
              JSON.stringify({
                type: 'ROOM_ERROR',
                payload: { message: 'Le salon est déjà plein (2 joueurs max)' },
              })
            );
            return;
          }

          currentRoomId = reqRoomId;
          const isHost = room.players.size === 0;
          const playerName = payload?.playerName || (isHost ? 'Joueur 1' : 'Joueur 2');
          const playerAvatar = payload?.avatar || (isHost ? '👑' : '⚡');

          const player: ServerPlayer = {
            id: playerId,
            name: playerName,
            avatar: playerAvatar,
            hp: 6000,
            score: 0,
            ready: isHost, // Host is ready by default
            isHost,
            ws,
          };

          room.players.set(playerId, player);
          sendRoomState(room);

          // If 2 players, inform them they can start
          if (room.players.size === 2) {
            broadcastToRoom(room, 'PLAYERS_READY_TO_START', {
              message: '2 joueurs connectés ! Préparez-vous !',
            });
          }
        }

        // --- LOBBY_READY: Toggle ready state ---
        else if (type === 'LOBBY_READY' && currentRoomId) {
          const room = rooms.get(currentRoomId);
          if (room && room.status === 'lobby') {
            const player = room.players.get(playerId);
            if (player) {
              player.ready = !!payload?.ready;
              sendRoomState(room);

              // If both ready and 2 players, auto start countdown
              const allReady = Array.from(room.players.values()).every((p) => p.ready);
              if (room.players.size === 2 && allReady) {
                room.status = 'countdown';
                sendRoomState(room);
                setTimeout(() => {
                  startRoomRound(room);
                }, 2000);
              }
            }
          }
        }

        // --- LOBBY_START: Host initiates start ---
        else if (type === 'LOBBY_START' && currentRoomId) {
          const room = rooms.get(currentRoomId);
          if (room && room.status === 'lobby' && room.players.size === 2) {
            room.status = 'countdown';
            sendRoomState(room);
            setTimeout(() => {
              startRoomRound(room);
            }, 2000);
          }
        }

        // --- PLAYER_GUESS: A player submits their coordinates ---
        else if (type === 'PLAYER_GUESS' && currentRoomId) {
          const room = rooms.get(currentRoomId);
          if (room && room.status === 'playing') {
            const guess = payload?.guess as LatLng;
            const timeSeconds = payload?.timeSeconds || Math.round((Date.now() - room.roundStartTime) / 1000);

            if (guess && typeof guess.lat === 'number' && typeof guess.lng === 'number') {
              const loc = room.locations[room.currentRound - 1];
              const actual = { lat: loc.lat, lng: loc.lng };
              const dist = calculateHaversineDistance(actual, guess);
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

              // Notify the other player that opponent has guessed
              room.players.forEach((p) => {
                if (p.id !== playerId && p.ws.readyState === WebSocket.OPEN) {
                  p.ws.send(
                    JSON.stringify({
                      type: 'OPPONENT_GUESSED',
                      payload: {
                        emergencySeconds: 15,
                        message: "Votre adversaire a deviné ! Compte à rebours de 15s déclenché !",
                      },
                    })
                  );
                }
              });

              // If first player to guess, trigger emergency 15-second countdown for opponent
              if (room.guesses.size === 1 && !room.emergencyTimer) {
                room.emergencyTimer = setTimeout(() => {
                  resolveRoomRound(room);
                }, 15000);
              }

              // If both players have guessed, resolve round immediately!
              if (room.guesses.size >= room.players.size) {
                resolveRoomRound(room);
              }
            }
          }
        }

        // --- ROUND_READY_NEXT: Player is ready to advance ---
        else if (type === 'ROUND_READY_NEXT' && currentRoomId) {
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
        }

        // --- SEND_EMOTE: Quick in-game taunt / emote ---
        else if (type === 'SEND_EMOTE' && currentRoomId) {
          const room = rooms.get(currentRoomId);
          if (room) {
            const sender = room.players.get(playerId);
            broadcastToRoom(room, 'EMOTE_BROADCAST', {
              senderId: playerId,
              senderName: sender?.name || 'Joueur',
              emote: payload?.emote || '🎯',
            });
          }
        }

        // --- LOBBY_LEAVE ---
        else if (type === 'LOBBY_LEAVE' && currentRoomId) {
          const room = rooms.get(currentRoomId);
          if (room) {
            room.players.delete(playerId);
            if (room.players.size === 0) {
              rooms.delete(currentRoomId);
            } else {
              broadcastToRoom(room, 'OPPONENT_DISCONNECTED', {
                message: 'Votre adversaire a quitté la partie.',
              });
              sendRoomState(room);
            }
          }
          currentRoomId = null;
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      if (currentRoomId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          room.players.delete(playerId);
          if (room.players.size === 0) {
            if (room.roundTimer) clearTimeout(room.roundTimer);
            if (room.emergencyTimer) clearTimeout(room.emergencyTimer);
            rooms.delete(currentRoomId);
          } else {
            broadcastToRoom(room, 'OPPONENT_DISCONNECTED', {
              message: 'Votre adversaire s’est déconnecté.',
            });
            if (room.status === 'playing') {
              room.status = 'game_over';
              broadcastToRoom(room, 'MATCH_OVER', {
                winnerId: Array.from(room.players.keys())[0],
                reason: 'opponent_forfeit',
                isWinner: true,
              });
            }
            sendRoomState(room);
          }
        }
      }
    });
  });

  // 5. Vite Middleware (Dev) or Static Assets (Production)
  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
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
    console.log(`Server running on http://localhost:${PORT} in ${isProduction ? 'production' : 'development'} mode with WebSocket support on /ws`);
  });
}

startServer();
