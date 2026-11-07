import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { ArrowRight, ShieldAlert, Award, Sparkles, Map as MapIcon, Globe, Zap, Flame } from 'lucide-react';
import { RoundResultData } from '../game/multiplayer';
import { formatDistance } from '../game/rules';
import { EarthGlobe } from './EarthGlobe';
import { DetailedResultMap } from './DetailedResultMap';
import { sound } from '../utils/audio';

interface RoundResultProps {
  data: RoundResultData;
  isDuelMode: boolean;
  playerHp: number;
  opponentHp: number;
  onNextRound: () => void;
  isGameOver: boolean;
}

export function RoundResult({
  data,
  isDuelMode,
  playerHp,
  opponentHp,
  onNextRound,
  isGameOver,
}: RoundResultProps) {
  const {
    location,
    playerGuess,
    playerDistanceKm,
    playerScore,
    opponentGuess,
    opponentDistanceKm,
    opponentScore,
    damageDealt = 0,
    damagedTarget = 'tie',
    damageMultiplier = 1.0,
    speedBonus = 0,
    comboMultiplier = 1.0,
    comboStreak = 0,
    timeSeconds = 0,
  } = data;

  // View toggle: default to detailed geographic map matching OpenGuessr (image_24da0ebb.png)
  const [viewMode, setViewMode] = useState<'map' | 'globe'>('map');

  // Qualitative appraisal based on distance (matching OpenGuessr: "Quite close!", etc.)
  const getAppraisalText = (distKm: number) => {
    if (distKm < 15) return 'Précision chirurgicale ! 🎯';
    if (distKm < 100) return 'Incroyable ! Pratiquement sur place ! ✨';
    if (distKm < 350) return 'Très proche ! (Quite close!) 👏';
    if (distKm < 1000) return 'Bien visé ! Même région ! 👍';
    if (distKm < 2500) return 'Bon continent ! 🌍';
    return 'Un peu loin cette fois... 🧭';
  };

  // Sound and confetti effects on mount
  useEffect(() => {
    if (playerScore >= 4500 || (isDuelMode && damagedTarget === 'opponent')) {
      sound.playFanfare();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#38bdf8', '#34d399', '#fbbf24', '#f43f5e'],
      });
    } else if (isDuelMode && damagedTarget === 'player') {
      sound.playDamage();
    } else {
      sound.playClick();
    }
  }, [playerScore, isDuelMode, damagedTarget]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="relative w-full max-w-5xl bg-slate-900/95 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header Ribbon */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-black text-sm">
              #{data.roundNumber}
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                <span>{location.name}</span>
                <span className="text-sm font-semibold text-cyan-400">({location.country})</span>
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {location.city}, {location.country} · {location.lat.toFixed(2)}°, {location.lng.toFixed(2)}°
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* 2D Map / 3D Globe View Mode Toggle */}
            <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700/60 text-xs">
              <button
                onClick={() => {
                  sound.playClick();
                  setViewMode('map');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  viewMode === 'map'
                    ? 'bg-cyan-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>Carte Réelle</span>
              </button>
              <button
                onClick={() => {
                  sound.playClick();
                  setViewMode('globe');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  viewMode === 'globe'
                    ? 'bg-cyan-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Globe 3D</span>
              </button>
            </div>

            <div className="text-right flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-bold">Score Manche</span>
              <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono-numbers">
                +{playerScore.toLocaleString('fr-FR')} <span className="text-xs text-amber-300">pts</span>
              </span>
              {(speedBonus > 0 || comboMultiplier > 1) && (
                <div className="flex items-center gap-1.5 mt-1 flex-wrap justify-end">
                  {speedBonus > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      <Zap className="w-2.5 h-2.5 text-amber-400" />
                      <span>+{speedBonus} Vitesse ({timeSeconds}s)</span>
                    </span>
                  )}
                  {comboMultiplier > 1 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      <Flame className="w-2.5 h-2.5 text-purple-400" />
                      <span>Combo x{comboMultiplier.toFixed(2)} ({comboStreak})</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content Body: Left Map / Globe View, Right Duel / Stats breakdown */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-5 overflow-y-auto">
          {/* Left: OpenGuessr-Style Real Map (or 3D Earth Globe) */}
          <div className="relative flex flex-col items-center justify-center bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden min-h-[300px]">
            {viewMode === 'map' ? (
              <DetailedResultMap
                actual={{ lat: location.lat, lng: location.lng }}
                guess={playerGuess}
                opponentGuess={opponentGuess}
                className="w-full h-full min-h-[300px]"
              />
            ) : (
              <EarthGlobe
                targetLocation={{ lat: location.lat, lng: location.lng }}
                guessLocation={playerGuess}
                showArc={true}
                interactive={true}
                className="w-full h-full min-h-[300px]"
              />
            )}

            {/* Map Legend */}
            <div className="absolute top-3 left-3 z-[400] flex items-center gap-3 px-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-xl text-[11px] text-slate-200 backdrop-blur-md shadow-md">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">🏁</span>
                <span className="font-semibold">Lieu exact</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                <span className="font-semibold">Votre repère</span>
              </div>
              {opponentGuess && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 ring-2 ring-white" />
                  <span className="font-semibold">Adversaire</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Round Stats & Duel Combat Resolution */}
          <div className="flex flex-col justify-between gap-3.5">
            {/* OpenGuessr-style Distance Banner (matching image_24da0ebb.png) */}
            <div className="p-4 bg-slate-800/70 border border-slate-700/80 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 block mb-0.5">Évaluation</span>
                <span className="text-base font-black text-white">
                  {getAppraisalText(playerDistanceKm)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-slate-400 block mb-0.5">Distance</span>
                <div className="text-2xl font-black text-cyan-400 font-mono-numbers">
                  {formatDistance(playerDistanceKm)}
                </div>
              </div>
            </div>

            {/* Duel Mode Damage Resolution Box */}
            {isDuelMode ? (
              <div
                className={`p-4 rounded-2xl border ${
                  damagedTarget === 'opponent'
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                    : damagedTarget === 'player'
                    ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                    : 'bg-slate-800/40 border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold tracking-wider uppercase flex items-center gap-1.5">
                    {damagedTarget === 'opponent' ? (
                      <>
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        <span>Coup Critique Infligé !</span>
                      </>
                    ) : damagedTarget === 'player' ? (
                      <>
                        <ShieldAlert className="w-4 h-4 text-rose-400" />
                        <span>Dégâts Subis !</span>
                      </>
                    ) : (
                      <span>Égalité Parfaite !</span>
                    )}
                  </span>
                  {damageMultiplier > 1 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold">
                      x{damageMultiplier.toFixed(1)} Multiplicateur
                    </span>
                  )}
                </div>

                <div className="text-2xl font-black mb-2 font-mono-numbers">
                  {damagedTarget === 'opponent' && `+${damageDealt.toLocaleString('fr-FR')} DÉGÂTS`}
                  {damagedTarget === 'player' && `-${damageDealt.toLocaleString('fr-FR')} PV`}
                  {damagedTarget === 'tie' && 'Aucun dégât'}
                </div>

                {/* Health bars */}
                <div className="space-y-2 text-xs pt-1">
                  <div>
                    <div className="flex justify-between mb-1 font-semibold">
                      <span className="text-cyan-300">Votre Santé</span>
                      <span className="font-mono text-cyan-400">{Math.max(0, playerHp)} / 6000 PV</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-700 rounded-full"
                        style={{ width: `${Math.max(0, (playerHp / 6000) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1 font-semibold">
                      <span className="text-rose-300">Santé Adversaire</span>
                      <span className="font-mono text-rose-400">{Math.max(0, opponentHp)} / 6000 PV</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-rose-500 to-amber-500 transition-all duration-700 rounded-full"
                        style={{ width: `${Math.max(0, (opponentHp / 6000) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Performance metrics breakdown */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/60 border border-slate-700/60 p-3 rounded-2xl">
                <span className="text-[11px] text-slate-400 font-semibold block mb-0.5">Votre Précision</span>
                <div className="text-lg font-black text-cyan-400 font-mono-numbers">
                  {formatDistance(playerDistanceKm)}
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5">Écart au point réel</span>
              </div>

              {isDuelMode && opponentDistanceKm !== undefined ? (
                <div className="bg-slate-800/60 border border-slate-700/60 p-3 rounded-2xl">
                  <span className="text-[11px] text-slate-400 font-semibold block mb-0.5">Adversaire</span>
                  <div className="text-lg font-black text-purple-400 font-mono-numbers">
                    {formatDistance(opponentDistanceKm)}
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {opponentScore?.toLocaleString('fr-FR')} pts marqués
                  </span>
                </div>
              ) : (
                <div className="bg-slate-800/60 border border-slate-700/60 p-3 rounded-2xl">
                  <span className="text-[11px] text-slate-400 font-semibold block mb-0.5">Score Max</span>
                  <div className="text-lg font-black text-amber-400 font-mono-numbers">5 000 pts</div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Score parfait sous 50m</span>
                </div>
              )}
            </div>

            {/* Location Trivia / Geo Tip */}
            <div className="p-3 bg-slate-800/40 border border-slate-700/60 rounded-2xl space-y-1 text-xs">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>Le saviez-vous ?</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">{location.clues.funFact}</p>
              <div className="flex items-center gap-3 pt-0.5 text-[10px] text-slate-400">
                <span>Côté conduite : <strong className="text-white">{location.clues.drivingSide}</strong></span>
                <span>·</span>
                <span>Alphabet : <strong className="text-white">{location.clues.alphabet}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Footer (matching image_24da0ebb.png: Continue button) */}
        <div className="p-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Coordonnées : <span className="font-mono text-cyan-300">{location.lat.toFixed(4)}°, {location.lng.toFixed(4)}°</span>
          </div>
          <button
            onClick={() => {
              sound.playClick();
              onNextRound();
            }}
            className="flex items-center gap-2 px-7 py-3 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-black text-sm tracking-wide shadow-lg shadow-red-600/30 active:scale-95 transition-all cursor-pointer"
          >
            <span>{isGameOver ? 'Voir le Bilan Final' : 'Continuer'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
