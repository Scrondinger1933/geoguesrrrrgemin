/**
 * GeoApex - Ultimate GeoGuessr Clone with 3D Three.js, Street View & Real-time Duels.
 * @license Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { TitleScreen } from './components/TitleScreen';
import { GameHUD } from './components/GameHUD';
import { StreetViewExplorer } from './components/StreetViewExplorer';
import { GuessMap } from './components/GuessMap';
import { CountryStreakModal } from './components/CountryStreakModal';
import { RoundResult } from './components/RoundResult';
import { GameOverModal } from './components/GameOverModal';
import {
  GameMode,
  OpponentProfile,
  BOT_OPPONENTS,
  RoundResultData,
  generateBotGuess,
} from './game/multiplayer';
import {
  multiplayerClient,
  MultiplayerRoundStart,
  MultiplayerRoundResolved,
} from './game/multiplayerClient';
import { MultiplayerEmotesDock } from './components/MultiplayerEmotesDock';
import {
  WORLD_LOCATIONS,
  getRandomLocation,
  getRandomWorldCoordinates,
  GeoLocation,
} from './game/locations';
import {
  LatLng,
  calculateHaversineDistance,
  calculateScore,
  calculateSpeedBonus,
  calculateComboMultiplier,
  calculateDuelDamage,
  evaluateCountryStreak,
} from './game/rules';
import { sound } from './utils/audio';
import { auth } from './lib/firebase';

type AppState = 'title' | 'playing' | 'round_result' | 'game_over';

export default function App() {
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  const [appState, setAppState] = useState<AppState>('title');
  const [gameMode, setGameMode] = useState<GameMode>('duel');
  const [botOpponent, setBotOpponent] = useState<OpponentProfile>(BOT_OPPONENTS[0]);
  const [isMuted, setIsMuted] = useState(false);
  const [initialEmailSent, setInitialEmailSent] = useState(false);
  const [initialEmailPreviewUrl, setInitialEmailPreviewUrl] = useState<string | undefined>(undefined);
  const [activePlayerEmail, setActivePlayerEmail] = useState<string | undefined>(undefined);

  const [currentRound, setCurrentRound] = useState(1);
  const maxRounds = 5;
  const [totalScore, setTotalScore] = useState(0);
  const [playerHp, setPlayerHp] = useState(6000);
  const [opponentHp, setOpponentHp] = useState(6000);
  const [streakCount, setStreakCount] = useState(0);
  const [comboStreak, setComboStreak] = useState(0);
  const roundStartTimeRef = useRef<number>(Date.now());

  const [currentLocation, setCurrentLocation] = useState<GeoLocation>(WORLD_LOCATIONS[0]);
  const [usedLocationIds, setUsedLocationIds] = useState<string[]>([]);
  const [lastRoundResult, setLastRoundResult] = useState<RoundResultData | null>(null);

  const [opponentHasGuessed, setOpponentHasGuessed] = useState(false);
  const [opponentSimulatedGuess, setOpponentSimulatedGuess] = useState<{
    guess: LatLng;
    distanceKm: number;
    score: number;
  } | null>(null);
  const [blitzTimeLeft, setBlitzTimeLeft] = useState<number>(30);
  const [onlineRoundEndsAt, setOnlineRoundEndsAt] = useState<number | null>(null);
  const [onlineTimeLeft, setOnlineTimeLeft] = useState<number | undefined>(undefined);

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [onlineOpponent, setOnlineOpponent] = useState<{ name: string; avatar: string } | null>(null);
  const [isWaitingServerResult, setIsWaitingServerResult] = useState(false);
  const botTimerRef = useRef<number | null>(null);
  const blitzIntervalRef = useRef<number | null>(null);

  // Sync document.body.dataset.state for deterministic game state checks
  useEffect(() => {
    const bodyState =
      appState === 'title' ? 'title' : appState === 'game_over' ? 'gameover' : 'playing';
    document.body.dataset.state = bodyState;
  }, [appState]);

  useEffect(() => {
    const handleQuota = () => setIsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  // Live WebSocket Multiplayer Synchronization
  useEffect(() => {
    const unbindRoundStart = multiplayerClient.on('ROUND_START', (data: MultiplayerRoundStart) => {
      setActiveRoomId(multiplayerClient.state?.roomId || 'LIVE');
      setGameMode(data.mode || 'duel');
      setCurrentLocation(data.location);
      setCurrentRound(data.roundNumber);
      setOnlineRoundEndsAt(data.roundEndsAt || Date.now() + (data.roundDurationSeconds || 60) * 1000);
      setOnlineTimeLeft(data.roundDurationSeconds || 60);
      setIsWaitingServerResult(false);
      setOpponentHasGuessed(false);
      roundStartTimeRef.current = Date.now();
      setAppState('playing');
      sound.playFanfare();
    });

    const unbindOpponentGuess = multiplayerClient.on(
      'OPPONENT_GUESSED',
      (data?: { emergencyEndsAt?: number }) => {
        setOpponentHasGuessed(true);
        if (data?.emergencyEndsAt) {
          setOnlineRoundEndsAt((prev) =>
            prev ? Math.min(prev, data.emergencyEndsAt!) : data.emergencyEndsAt!
          );
        }
        sound.playTick();
      }
    );

    const unbindResolved = multiplayerClient.on('ROUND_RESOLVED', (data: MultiplayerRoundResolved) => {
      setIsWaitingServerResult(false);
      setOnlineRoundEndsAt(null);
      setOnlineTimeLeft(undefined);
      setPlayerHp(data.playerResult.hp);
      setOpponentHp(data.opponentResult.hp);
      setTotalScore((prev) => prev + data.playerResult.score);

      const roundData: RoundResultData = {
        roundNumber: data.roundNumber,
        location: data.actualLocation,
        playerGuess: data.playerResult.guess,
        playerDistanceKm: data.playerResult.distanceKm,
        playerScore: data.playerResult.score,
        opponentGuess: data.opponentResult.guess,
        opponentDistanceKm: data.opponentResult.distanceKm,
        opponentScore: data.opponentResult.score,
        damageDealt: data.damageDealt,
        damagedTarget:
          data.damagedPlayerId === multiplayerClient.state?.playerId
            ? 'player'
            : data.damagedPlayerId === 'tie'
            ? 'tie'
            : 'opponent',
        damageMultiplier: data.damageMultiplier,
        speedBonus: data.playerResult.speedBonus,
      };

      setLastRoundResult(roundData);
      setAppState('round_result');
    });

    const unbindMatchOver = multiplayerClient.on('MATCH_OVER', () => {
      setIsWaitingServerResult(false);
      setOnlineRoundEndsAt(null);
      setOnlineTimeLeft(undefined);
      setAppState('game_over');
    });

    const unbindRematch = multiplayerClient.on('REMATCH_RESET', () => {
      setTotalScore(0);
      setPlayerHp(6000);
      setOpponentHp(6000);
      setCurrentRound(1);
      setLastRoundResult(null);
      setIsWaitingServerResult(false);
      setOpponentHasGuessed(false);
    });

    const unbindRoomState = multiplayerClient.on('ROOM_STATE', (state) => {
      if (state.roomId) {
        setActiveRoomId(state.roomId);
        const op = state.players.find((p: any) => p.id !== state.playerId);
        if (op) {
          setOnlineOpponent({ name: op.name, avatar: op.avatar });
        }
      }
      if (state.status === 'playing' && multiplayerClient.lastRoundStart) {
        setGameMode(multiplayerClient.lastRoundStart.mode || 'duel');
        setCurrentLocation(multiplayerClient.lastRoundStart.location);
        setCurrentRound(multiplayerClient.lastRoundStart.roundNumber);
        setOnlineRoundEndsAt(multiplayerClient.lastRoundStart.roundEndsAt);
        setAppState('playing');
      }
    });

    return () => {
      unbindRoundStart();
      unbindOpponentGuess();
      unbindResolved();
      unbindMatchOver();
      unbindRematch();
      unbindRoomState();
    };
  }, []);

  // Synchronized live countdown ticker for online multiplayer rounds
  useEffect(() => {
    if (appState !== 'playing' || !activeRoomId || !onlineRoundEndsAt) {
      return;
    }

    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((onlineRoundEndsAt - Date.now()) / 1000));
      setOnlineTimeLeft((prev) => (prev === remaining ? prev : remaining));
    };

    updateTimer();
    const id = window.setInterval(updateTimer, 500);
    return () => clearInterval(id);
  }, [appState, activeRoomId, onlineRoundEndsAt]);

  const [activeMapFilter, setActiveMapFilter] = useState<'world' | 'france' | 'capitals' | 'rural'>('world');

  const startGame = useCallback(
    (
      mode: GameMode,
      bot: OpponentProfile,
      roomId?: string,
      mapFilter: 'world' | 'france' | 'capitals' | 'rural' = 'world'
    ) => {
      setGameMode(mode);
      setBotOpponent(bot);
      setActiveMapFilter(mapFilter);
      setCurrentRound(1);
      setTotalScore(0);
      setPlayerHp(6000);
      setOpponentHp(6000);
      setStreakCount(0);
      setComboStreak(0);
      setUsedLocationIds([]);
      setIsWaitingServerResult(false);
      roundStartTimeRef.current = Date.now();
      setInitialEmailSent(false);
      setInitialEmailPreviewUrl(undefined);
      sound.initMusic();
      sound.playMusic().catch(() => {});

      setActiveRoomId(roomId || null);
      if (roomId) {
        const op = multiplayerClient.state?.players.find(
          (p) => p.id !== multiplayerClient.state?.playerId
        );
        if (op) {
          setOnlineOpponent({ name: op.name, avatar: op.avatar });
        }
        if (multiplayerClient.lastRoundStart) {
          setCurrentLocation(multiplayerClient.lastRoundStart.location);
          setCurrentRound(multiplayerClient.lastRoundStart.roundNumber);
          setOnlineRoundEndsAt(multiplayerClient.lastRoundStart.roundEndsAt);
        }
      } else {
        setOnlineOpponent(null);
        setOnlineRoundEndsAt(null);
        setOnlineTimeLeft(undefined);
        const firstLoc = getRandomLocation([], mapFilter);
        setCurrentLocation(firstLoc);
        setUsedLocationIds([firstLoc.id]);
      }

      setAppState('playing');
    },
    []
  );

  // Support ?autostart=1 for deterministic testing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      startGame('duel', BOT_OPPONENTS[0]);
    }
  }, [startGame]);

  const handlePlayerGuess = useCallback(
    (guess: LatLng) => {
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
      if (blitzIntervalRef.current) clearInterval(blitzIntervalRef.current);

      if (activeRoomId) {
        setIsWaitingServerResult(true);
        const secondsElapsed = Math.max(
          1,
          Math.round((Date.now() - roundStartTimeRef.current) / 1000)
        );
        multiplayerClient.submitGuess(guess, secondsElapsed);
        sound.playClick();
        return;
      }

      const actual = { lat: currentLocation.lat, lng: currentLocation.lng };
      const playerDistance = calculateHaversineDistance(actual, guess);
      const secondsElapsed = Math.max(
        1,
        Math.round((Date.now() - roundStartTimeRef.current) / 1000)
      );
      const speedBonus = calculateSpeedBonus(secondsElapsed);

      const isAccurate = playerDistance <= 350;
      const nextCombo = isAccurate ? comboStreak + 1 : 0;
      setComboStreak(nextCombo);
      const comboMultiplier = calculateComboMultiplier(nextCombo);

      const baseScore = calculateScore(playerDistance);
      const roundScore = Math.min(5000, Math.round((baseScore + speedBonus) * comboMultiplier));
      setTotalScore((prev) => prev + roundScore);

      let botGuess = opponentSimulatedGuess;
      if (!botGuess && gameMode === 'duel') {
        botGuess = generateBotGuess(actual, botOpponent);
      }

      let damage = 0;
      let damagedTarget: 'player' | 'opponent' | 'tie' = 'tie';

      if (gameMode === 'duel' && botGuess) {
        const damageRes = calculateDuelDamage(roundScore, botGuess.score, currentRound);
        damage = damageRes.damage;
        damagedTarget = damageRes.loser;

        if (damageRes.loser === 'player') {
          setPlayerHp((hp) => Math.max(0, hp - damage));
        } else if (damageRes.loser === 'opponent') {
          setOpponentHp((hp) => Math.max(0, hp - damage));
        }
      }

      const roundData: RoundResultData = {
        roundNumber: currentRound,
        location: currentLocation,
        playerGuess: guess,
        playerDistanceKm: playerDistance,
        playerScore: roundScore,
        opponentGuess: botGuess?.guess,
        opponentDistanceKm: botGuess?.distanceKm,
        opponentScore: botGuess?.score,
        damageDealt: damage,
        damagedTarget,
        damageMultiplier:
          currentRound >= 5
            ? 3.0
            : currentRound === 4
            ? 2.0
            : currentRound === 3
            ? 1.5
            : currentRound === 2
            ? 1.2
            : 1.0,
        speedBonus,
        comboMultiplier,
        comboStreak: nextCombo,
        timeSeconds: secondsElapsed,
      };

      setLastRoundResult(roundData);
      setAppState('round_result');
    },
    [
      activeRoomId,
      currentLocation,
      comboStreak,
      opponentSimulatedGuess,
      gameMode,
      botOpponent,
      currentRound,
    ]
  );

  // Solo Bot & Blitz timer
  useEffect(() => {
    if (appState !== 'playing' || activeRoomId) {
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
      if (blitzIntervalRef.current) clearInterval(blitzIntervalRef.current);
      return;
    }

    setOpponentHasGuessed(false);
    setOpponentSimulatedGuess(null);

    if (gameMode === 'duel') {
      const reactionTimeMs =
        (Math.floor(
          Math.random() * (botOpponent.speedSecondsMax - botOpponent.speedSecondsMin)
        ) +
          botOpponent.speedSecondsMin) *
        1000;

      botTimerRef.current = window.setTimeout(() => {
        const botGuess = generateBotGuess(
          { lat: currentLocation.lat, lng: currentLocation.lng },
          botOpponent
        );
        setOpponentSimulatedGuess(botGuess);
        setOpponentHasGuessed(true);
        sound.playTick();
      }, reactionTimeMs);
    }

    if (gameMode === 'blitz') {
      setBlitzTimeLeft(30);
      blitzIntervalRef.current = window.setInterval(() => {
        setBlitzTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(blitzIntervalRef.current!);
            handlePlayerGuess({ lat: 0, lng: 0 });
            return 0;
          }
          if (prev <= 5) sound.playTick();
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
      if (blitzIntervalRef.current) clearInterval(blitzIntervalRef.current);
    };
  }, [appState, currentRound, currentLocation, gameMode, botOpponent, activeRoomId, handlePlayerGuess]);

  const handleCountryGuess = (guessedCountry: string) => {
    const streakResult = evaluateCountryStreak(
      guessedCountry,
      currentLocation.country,
      streakCount
    );

    if (streakResult.isCorrect) {
      sound.playFanfare();
      setStreakCount(streakResult.newStreak);
      setTotalScore((prev) => prev + 1000 + streakResult.streakBonus);

      const nextLoc = getRandomLocation(usedLocationIds, activeMapFilter);
      setCurrentLocation(nextLoc);
      setUsedLocationIds((prev) => [...prev, nextLoc.id]);
      setCurrentRound((prev) => prev + 1);
      roundStartTimeRef.current = Date.now();
    } else {
      sound.playDamage();
      setAppState('game_over');
    }
  };

  const handleNextRound = () => {
    if (activeRoomId) {
      setIsWaitingServerResult(true);
      multiplayerClient.readyForNextRound();
      return;
    }

    const isDuelEnded = gameMode === 'duel' && (playerHp <= 0 || opponentHp <= 0);
    const isTourEnded = currentRound >= maxRounds;

    if (isDuelEnded || isTourEnded) {
      setAppState('game_over');
    } else {
      const nextRoundNum = currentRound + 1;
      setCurrentRound(nextRoundNum);
      const nextLoc = getRandomLocation(usedLocationIds, activeMapFilter);
      setCurrentLocation(nextLoc);
      setUsedLocationIds((prev) => [...prev, nextLoc.id]);
      roundStartTimeRef.current = Date.now();
      setAppState('playing');
    }
  };

  const handleExitToTitle = () => {
    sound.playClick();
    if (activeRoomId) {
      multiplayerClient.leaveRoom();
      setActiveRoomId(null);
      setOnlineOpponent(null);
      setOnlineRoundEndsAt(null);
      setOnlineTimeLeft(undefined);
      setIsWaitingServerResult(false);
    }
    setAppState('title');
  };

  // Record score to Cloud SQL when game ends & dispatch summary email if configured
  useEffect(() => {
    if (appState === 'game_over') {
      const emailToken = localStorage.getItem('geoapex_auth_token');
      let savedEmail: string | undefined;
      try {
        const raw = localStorage.getItem('geoapex_auth_user');
        if (raw) savedEmail = JSON.parse(raw)?.email;
      } catch {}
      if (!savedEmail && auth.currentUser?.email) {
        savedEmail = auth.currentUser.email;
      }
      setActivePlayerEmail(savedEmail);

      const payload = {
        mode: gameMode,
        score: totalScore,
        roundsCompleted: currentRound,
        isVictory: gameMode === 'duel' ? opponentHp <= 0 : totalScore >= 20000,
        email: savedEmail,
      };

      const submitScore = async (token: string) => {
        try {
          const res = await fetch('/api/scores', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (data?.deliveredToRealInbox) {
            setInitialEmailSent(true);
          } else if (data?.previewUrl) {
            setInitialEmailPreviewUrl(data.previewUrl);
          }
        } catch {}
      };

      if (emailToken) {
        submitScore(emailToken);
      } else if (auth.currentUser) {
        auth.currentUser.getIdToken().then(submitScore).catch(() => {});
      }
    }
  }, [appState, gameMode, totalScore, currentRound, opponentHp]);

  const handleToggleMute = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  const handleRandomTeleport = useCallback(() => {
    sound.playTeleport();
    if (Math.random() > 0.5) {
      const newLoc = getRandomLocation([currentLocation.id]);
      setCurrentLocation(newLoc);
    } else {
      const coords = getRandomWorldCoordinates();
      const dynamicLoc: GeoLocation = {
        id: `random-${Date.now()}`,
        name: 'Spot Aléatoire Mondial',
        city: 'Exploration Libre',
        country: 'Monde',
        countryCode: 'XX',
        lat: coords.lat,
        lng: coords.lng,
        heading: Math.floor(Math.random() * 360),
        pitch: 0,
        zoom: 1,
        clues: {
          drivingSide: Math.random() > 0.5 ? 'Droite' : 'Gauche',
          continent: 'Terre',
          alphabet: 'Indices locaux sur la route',
          landscape: 'Observez la végétation, les poteaux électriques et les marquages routiers.',
          funFact: 'Lieu généré aléatoirement sur le réseau mondial Street View.',
        },
        theme: {
          skyTop: '#0369a1',
          skyBottom: '#93c5fd',
          groundColor: '#334155',
          ambientFeatures: ['Route panoramique', 'Horizon infini', 'Végétation locale', 'Poteaux routiers'],
          sunAngle: Math.floor(Math.random() * 80) + 10,
        },
      };
      setCurrentLocation(dynamicLoc);
    }
  }, [currentLocation.id]);

  const handleLocationUpdate = useCallback((actualLat: number, actualLng: number) => {
    setCurrentLocation((prev) => {
      if (Math.abs(prev.lat - actualLat) < 0.00005 && Math.abs(prev.lng - actualLng) < 0.00005) {
        return prev;
      }

      if (
        prev.id.startsWith('random-') &&
        typeof window !== 'undefined' &&
        window.google?.maps?.Geocoder
      ) {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat: actualLat, lng: actualLng } }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            let countryName = '';
            let cityName = '';
            let countryCode = '';
            for (const comp of results[0].address_components) {
              if (comp.types.includes('country')) {
                countryName = comp.long_name;
                countryCode = comp.short_name;
              }
              if (
                comp.types.includes('locality') ||
                comp.types.includes('administrative_area_level_1')
              ) {
                if (!cityName) cityName = comp.long_name;
              }
            }
            if (countryName) {
              setCurrentLocation((curr) => ({
                ...curr,
                name: cityName ? `${cityName}, ${countryName}` : countryName,
                country: countryName,
                city: cityName || curr.city,
                countryCode: countryCode || curr.countryCode,
              }));
            }
          }
        });
      }

      return {
        ...prev,
        lat: actualLat,
        lng: actualLng,
      };
    });
  }, []);

  return (
    <APIProvider apiKey={apiKey} language="fr">
      <div className="relative w-screen h-screen overflow-hidden bg-[#07090F] font-sans select-none">
        {isQuotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2 text-xs md:text-sm text-center sticky top-0 z-50 flex items-center justify-center gap-1.5">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}

        {appState === 'title' && (
          <TitleScreen
            onStartGame={startGame}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
          />
        )}

        {appState === 'playing' && (
          <div className="relative w-full h-full">
            <GameHUD
              mode={gameMode}
              roundNumber={currentRound}
              maxRounds={maxRounds}
              score={totalScore}
              playerHp={playerHp}
              opponentHp={opponentHp}
              botOpponent={botOpponent}
              opponentName={onlineOpponent?.name}
              opponentAvatar={onlineOpponent?.avatar}
              opponentHasGuessed={opponentHasGuessed}
              timeLeft={activeRoomId ? onlineTimeLeft : gameMode === 'blitz' ? blitzTimeLeft : undefined}
              streakCount={streakCount}
              isMuted={isMuted}
              onToggleMute={handleToggleMute}
              onExit={handleExitToTitle}
            />

            {isWaitingServerResult && (
              <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-[#0E131D] border border-cyan-400/50 px-5 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 pointer-events-none">
                <div className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                <span className="text-xs font-bold text-white">
                  Repère enregistré — En attente de l’adversaire...
                </span>
              </div>
            )}

            {activeRoomId && <MultiplayerEmotesDock />}

            <StreetViewExplorer
              location={currentLocation}
              onRandomTeleport={handleRandomTeleport}
              onLocationUpdate={handleLocationUpdate}
            />

            {gameMode !== 'streak' ? (
              <GuessMap
                apiKey={apiKey}
                onGuessSubmit={handlePlayerGuess}
                disabled={isWaitingServerResult}
                isQuotaExceeded={isQuotaExceeded}
              />
            ) : (
              <CountryStreakModal onSelectCountry={handleCountryGuess} disabled={false} />
            )}
          </div>
        )}

        {appState === 'round_result' && lastRoundResult && (
          <RoundResult
            data={lastRoundResult}
            isDuelMode={gameMode === 'duel'}
            playerHp={playerHp}
            opponentHp={opponentHp}
            onNextRound={handleNextRound}
            isWaitingOpponent={isWaitingServerResult}
            isGameOver={
              (gameMode === 'duel' && (playerHp <= 0 || opponentHp <= 0)) ||
              (gameMode !== 'streak' && currentRound >= maxRounds)
            }
          />
        )}

        {appState === 'game_over' && (
          <GameOverModal
            mode={gameMode}
            totalScore={totalScore}
            playerHp={playerHp}
            opponentHp={opponentHp}
            botOpponent={botOpponent}
            opponentName={onlineOpponent?.name}
            opponentAvatar={onlineOpponent?.avatar}
            roundsCount={currentRound}
            streakCount={streakCount}
            playerEmail={activePlayerEmail}
            initialEmailSent={initialEmailSent}
            initialEmailPreviewUrl={initialEmailPreviewUrl}
            isOnlineMultiplayer={Boolean(activeRoomId)}
            onRematch={activeRoomId ? () => multiplayerClient.requestRematch() : undefined}
            onRestart={() => startGame(gameMode, botOpponent, activeRoomId || undefined, activeMapFilter)}
            onHome={handleExitToTitle}
          />
        )}
      </div>
    </APIProvider>
  );
}
