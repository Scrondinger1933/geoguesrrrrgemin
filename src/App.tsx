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
  MultiplayerRoom,
  generateBotGuess,
} from './game/multiplayer';
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
  // Client-Side Quota Defense & Maps API Key
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  // App Navigation State
  const [appState, setAppState] = useState<AppState>('title');
  const [gameMode, setGameMode] = useState<GameMode>('duel');
  const [botOpponent, setBotOpponent] = useState<OpponentProfile>(BOT_OPPONENTS[0]);
  const [isMuted, setIsMuted] = useState(false);

  // Gameplay State
  const [currentRound, setCurrentRound] = useState(1);
  const maxRounds = 5;
  const [totalScore, setTotalScore] = useState(0);
  const [playerHp, setPlayerHp] = useState(6000);
  const [opponentHp, setOpponentHp] = useState(6000);
  const [streakCount, setStreakCount] = useState(0);
  const [comboStreak, setComboStreak] = useState(0);
  const roundStartTimeRef = useRef<number>(Date.now());

  // Round Active Data
  const [currentLocation, setCurrentLocation] = useState<GeoLocation>(WORLD_LOCATIONS[0]);
  const [usedLocationIds, setUsedLocationIds] = useState<string[]>([]);
  const [lastRoundResult, setLastRoundResult] = useState<RoundResultData | null>(null);

  // Opponent and Timer state
  const [opponentHasGuessed, setOpponentHasGuessed] = useState(false);
  const [opponentSimulatedGuess, setOpponentSimulatedGuess] = useState<{
    guess: LatLng;
    distanceKm: number;
    score: number;
  } | null>(null);
  const [blitzTimeLeft, setBlitzTimeLeft] = useState<number>(30);

  // Multiplayer room reference
  const roomRef = useRef<MultiplayerRoom | null>(null);
  const botTimerRef = useRef<number | null>(null);
  const blitzIntervalRef = useRef<number | null>(null);

  // Quota event listener
  useEffect(() => {
    const handleQuota = () => setIsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  // Start Game handler
  const startGame = useCallback((mode: GameMode, bot: OpponentProfile, roomId?: string) => {
    setGameMode(mode);
    setBotOpponent(bot);
    setCurrentRound(1);
    setTotalScore(0);
    setPlayerHp(6000);
    setOpponentHp(6000);
    setStreakCount(0);
    setComboStreak(0);
    setUsedLocationIds([]);
    roundStartTimeRef.current = Date.now();

    const firstLoc = getRandomLocation([]);
    setCurrentLocation(firstLoc);
    setUsedLocationIds([firstLoc.id]);

    // Setup room if custom room provided
    if (roomId) {
      if (roomRef.current) roomRef.current.close();
      roomRef.current = new MultiplayerRoom(roomId, (e) => {
        if (e.data?.type === 'opponent_guess') {
          setOpponentHasGuessed(true);
          setOpponentSimulatedGuess(e.data.payload);
        }
      });
    }

    setAppState('playing');
  }, []);

  // Check URL params for ?autostart=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      startGame('duel', BOT_OPPONENTS[0]);
    }
  }, [startGame]);

  // Trigger Opponent AI Bot behavior when entering a new playing round
  useEffect(() => {
    if (appState !== 'playing') {
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
      if (blitzIntervalRef.current) clearInterval(blitzIntervalRef.current);
      return;
    }

    setOpponentHasGuessed(false);
    setOpponentSimulatedGuess(null);

    // Duel mode bot timer
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

    // Blitz mode 30s timer
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
  }, [appState, currentRound, currentLocation, gameMode, botOpponent]);

  // Handle Player Guess submission
  const handlePlayerGuess = (guess: LatLng) => {
    if (botTimerRef.current) clearTimeout(botTimerRef.current);
    if (blitzIntervalRef.current) clearInterval(blitzIntervalRef.current);

    const actual = { lat: currentLocation.lat, lng: currentLocation.lng };
    const playerDistance = calculateHaversineDistance(actual, guess);
    const secondsElapsed = Math.max(1, Math.round((Date.now() - roundStartTimeRef.current) / 1000));
    const speedBonus = calculateSpeedBonus(secondsElapsed);

    // Combo streak logic: under 350 km qualifies as close
    const isAccurate = playerDistance <= 350;
    const nextCombo = isAccurate ? comboStreak + 1 : 0;
    setComboStreak(nextCombo);
    const comboMultiplier = calculateComboMultiplier(nextCombo);

    const baseScore = calculateScore(playerDistance);
    const roundScore = Math.min(5000, Math.round((baseScore + speedBonus) * comboMultiplier));
    const updatedTotalScore = totalScore + roundScore;
    setTotalScore(updatedTotalScore);

    // Opponent guess in Duel mode
    let botGuess = opponentSimulatedGuess;
    if (!botGuess && gameMode === 'duel') {
      botGuess = generateBotGuess(actual, botOpponent);
    }

    let damage = 0;
    let damagedTarget: 'player' | 'opponent' | 'tie' = 'tie';
    let nextPlayerHp = playerHp;
    let nextOpponentHp = opponentHp;

    if (gameMode === 'duel' && botGuess) {
      const damageRes = calculateDuelDamage(roundScore, botGuess.score, currentRound);
      damage = damageRes.damage;
      damagedTarget = damageRes.loser;

      if (damageRes.loser === 'player') {
        nextPlayerHp = Math.max(0, playerHp - damage);
        setPlayerHp(nextPlayerHp);
      } else if (damageRes.loser === 'opponent') {
        nextOpponentHp = Math.max(0, opponentHp - damage);
        setOpponentHp(nextOpponentHp);
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
        currentRound >= 5 ? 3.0 : currentRound === 4 ? 2.0 : currentRound === 3 ? 1.5 : currentRound === 2 ? 1.2 : 1.0,
      speedBonus,
      comboMultiplier,
      comboStreak: nextCombo,
      timeSeconds: secondsElapsed,
    };

    setLastRoundResult(roundData);
    setAppState('round_result');
  };

  // Handle Country Streak guess submission
  const handleCountryGuess = (guessedCountry: string) => {
    const streakResult = evaluateCountryStreak(
      guessedCountry,
      currentLocation.country,
      streakCount
    );

    if (streakResult.isCorrect) {
      sound.playFanfare();
      const newStreak = streakResult.newStreak;
      setStreakCount(newStreak);
      setTotalScore((prev) => prev + 1000 + streakResult.streakBonus);

      // Advance to next location
      const nextLoc = getRandomLocation(usedLocationIds);
      setCurrentLocation(nextLoc);
      setUsedLocationIds((prev) => [...prev, nextLoc.id]);
      setCurrentRound((prev) => prev + 1);
      roundStartTimeRef.current = Date.now();
    } else {
      sound.playDamage();
      setAppState('game_over');
    }
  };

  // Move to next round or finish game
  const handleNextRound = () => {
    const isDuelEnded = gameMode === 'duel' && (playerHp <= 0 || opponentHp <= 0);
    const isTourEnded = currentRound >= maxRounds;

    if (isDuelEnded || isTourEnded) {
      setAppState('game_over');
    } else {
      const nextRoundNum = currentRound + 1;
      setCurrentRound(nextRoundNum);
      const nextLoc = getRandomLocation(usedLocationIds);
      setCurrentLocation(nextLoc);
      setUsedLocationIds((prev) => [...prev, nextLoc.id]);
      roundStartTimeRef.current = Date.now();
      setAppState('playing');
    }
  };

  // Record score to Cloud SQL when user finishes game
  useEffect(() => {
    if (appState === 'game_over') {
      const user = auth.currentUser;
      if (user) {
        user.getIdToken().then((token) => {
          fetch('/api/scores', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              mode: gameMode,
              score: totalScore,
              roundsCompleted: currentRound,
              isVictory: gameMode === 'duel' ? opponentHp <= 0 : totalScore >= 20000,
            }),
          }).catch((err) => console.error('Failed to post score to Cloud SQL:', err));
        });
      }
    }
  }, [appState, gameMode, totalScore, currentRound, opponentHp]);

  // Toggle Mute
  const handleToggleMute = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  // Teleport to a new random location anywhere in the world
  const handleRandomTeleport = useCallback(() => {
    sound.playTeleport();
    // 50% chance of curated spot, 50% pure unpredictable worldwide coordinates
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
          funFact: 'Vous avez été parachuté dans un lieu aléatoire sur le réseau mondial Google Street View !',
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

  // Update actual snapped coordinates from Google Street View & Reverse Geocode
  const handleLocationUpdate = useCallback((actualLat: number, actualLng: number) => {
    setCurrentLocation((prev) => {
      // Avoid re-rendering if coordinates are virtually identical
      if (Math.abs(prev.lat - actualLat) < 0.00005 && Math.abs(prev.lng - actualLng) < 0.00005) {
        return prev;
      }

      // If location was a mystery random teleport, reverse geocode to reveal true place
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
    <APIProvider apiKey={apiKey}>
      <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
        {/* Client-Side Demo Key Quota Defense Banner per GMP Skill Section 8 */}
        {isQuotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm flex items-center justify-center gap-1.5">
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

        {/* Screen 1: Title Screen */}
        {appState === 'title' && (
          <TitleScreen
            onStartGame={startGame}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
          />
        )}

        {/* Screen 2: Playing State */}
        {appState === 'playing' && (
          <div className="relative w-full h-full">
            {/* Top Low-Occlusion HUD Bar */}
            <GameHUD
              mode={gameMode}
              roundNumber={currentRound}
              maxRounds={maxRounds}
              score={totalScore}
              playerHp={playerHp}
              opponentHp={opponentHp}
              botOpponent={botOpponent}
              opponentHasGuessed={opponentHasGuessed}
              timeLeft={gameMode === 'blitz' ? blitzTimeLeft : undefined}
              streakCount={streakCount}
              isMuted={isMuted}
              onToggleMute={handleToggleMute}
              onExit={() => setAppState('title')}
            />

            {/* 360° Real Google Street View Explorer with Random Spot Teleport */}
            <StreetViewExplorer
              location={currentLocation}
              onRandomTeleport={handleRandomTeleport}
              onLocationUpdate={handleLocationUpdate}
            />

            {/* Bottom Right Guess Map Widget */}
            {gameMode !== 'streak' ? (
              <GuessMap
                apiKey={apiKey}
                onGuessSubmit={handlePlayerGuess}
                disabled={false}
                isQuotaExceeded={isQuotaExceeded}
              />
            ) : (
              <CountryStreakModal
                onSelectCountry={handleCountryGuess}
                disabled={false}
              />
            )}
          </div>
        )}

        {/* Screen 3: Round Result Modal */}
        {appState === 'round_result' && lastRoundResult && (
          <RoundResult
            data={lastRoundResult}
            isDuelMode={gameMode === 'duel'}
            playerHp={playerHp}
            opponentHp={opponentHp}
            onNextRound={handleNextRound}
            isGameOver={
              (gameMode === 'duel' && (playerHp <= 0 || opponentHp <= 0)) ||
              (gameMode !== 'streak' && currentRound >= maxRounds)
            }
          />
        )}

        {/* Screen 4: Game Over / Victory Modal */}
        {appState === 'game_over' && (
          <GameOverModal
            mode={gameMode}
            totalScore={totalScore}
            playerHp={playerHp}
            opponentHp={opponentHp}
            botOpponent={botOpponent}
            roundsCount={currentRound}
            streakCount={streakCount}
            onRestart={() => startGame(gameMode, botOpponent)}
            onHome={() => setAppState('title')}
          />
        )}
      </div>
    </APIProvider>
  );
}
