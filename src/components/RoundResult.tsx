import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowRight,
  ShieldAlert,
  Award,
  Sparkles,
  Map as MapIcon,
  Globe,
  Zap,
  Flame,
  Loader2,
} from 'lucide-react';
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
  isWaitingOpponent?: boolean;
}

export function RoundResult({
  data,
  isDuelMode,
  playerHp,
  opponentHp,
  onNextRound,
  isGameOver,
  isWaitingOpponent = false,
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

  const [viewMode, setViewMode] = useState<'map' | 'globe'>('map');

  const getAppraisalText = (distKm: number) => {
    if (distKm < 15) return 'Précision chirurgicale !';
    if (distKm < 100) return 'Remarquable — à deux pas du point exact';
    if (distKm < 350) return 'Très proche de la cible';
    if (distKm < 1000) return 'Bien visé — même région';
    if (distKm < 2500) return 'Bon continent identifié';
    return 'Éloigné cette fois — cap sur la prochaine manche';
  };

  useEffect(() => {
    if (playerScore >= 4500 || (isDuelMode && damagedTarget === 'opponent')) {
      sound.playFanfare();
      confetti({
        particleCount: 70,
        spread: 65,
        origin: { y: 0.6 },
        colors: ['#22D3EE', '#10B981', '#F59E0B', '#F43F5E'],
      });
    } else if (isDuelMode && damagedTarget === 'player') {
      sound.playDamage();
    } else {
      sound.playClick();
    }
  }, [playerScore, isDuelMode, damagedTarget]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#07090F]/95">
      <div className="relative w-full max-w-5xl bg-[#0E131D] border border-white/12 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header Ribbon */}
        <div className="px-5 py-4 bg-[#141C2B] border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/35 flex items-center justify-center text-cyan-300 font-display font-bold text-sm font-mono-numbers">
              #{data.roundNumber}
            </div>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-white flex flex-wrap items-center gap-2">
                <span>{location.name}</span>
                <span className="text-sm font-semibold text-cyan-400">({location.country})</span>
              </h2>
              <p className="text-xs text-slate-400 font-mono-numbers">
                {location.city}, {location.country} · {location.lat.toFixed(2)}°, {location.lng.toFixed(2)}°
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* 2D Map / 3D Globe View Mode Toggle */}
            <div className="flex items-center bg-[#07090F] rounded-xl p-1 border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setViewMode('map');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  viewMode === 'map'
                    ? 'bg-cyan-400 text-[#07090F]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>Carte Réelle</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setViewMode('globe');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  viewMode === 'globe'
                    ? 'bg-cyan-400 text-[#07090F]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Globe 3D</span>
              </button>
            </div>

            <div className="text-right flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-bold">
                Score Manche
              </span>
              <span className="text-xl sm:text-2xl font-display font-bold text-amber-400 font-mono-numbers">
                +{playerScore.toLocaleString('fr-FR')} <span className="text-xs text-amber-300">pts</span>
              </span>
              {(speedBonus > 0 || comboMultiplier > 1) && (
                <div className="flex items-center gap-1.5 mt-1 flex-wrap justify-end">
                  {speedBonus > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-400/30 font-mono-numbers">
                      <Zap className="w-2.5 h-2.5 text-amber-400" />
                      <span>
                        +{speedBonus} ({timeSeconds}s)
                      </span>
                    </span>
                  )}
                  {comboMultiplier > 1 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-400/30 font-mono-numbers">
                      <Flame className="w-2.5 h-2.5 text-cyan-400" />
                      <span>
                        x{comboMultiplier.toFixed(2)} ({comboStreak})
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-5 overflow-y-auto">
          {/* Left: Real Map / 3D Globe */}
          <div className="relative flex flex-col items-center justify-center bg-[#07090F] border border-white/10 rounded-xl overflow-hidden min-h-[300px]">
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

            {/* Map Legend (opaque dark surface, zero backdrop-blur) */}
            <div className="absolute top-3 left-3 z-[400] flex items-center gap-3 px-3 py-1.5 bg-[#0E131D]/95 border border-white/12 rounded-xl text-[11px] text-slate-200 shadow-md">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-white/80" />
                <span className="font-semibold">Lieu exact</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white/80" />
                <span className="font-semibold">Votre repère</span>
              </div>
              {opponentGuess && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 ring-2 ring-white/80" />
                  <span className="font-semibold">Adversaire</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Stats & Duel Resolution */}
          <div className="flex flex-col justify-between gap-3.5">
            {/* Distance Banner */}
            <div className="p-4 bg-[#141C2B] border border-white/10 rounded-xl flex items-center justify-between gap-3">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block mb-0.5">
                  Évaluation
                </span>
                <span className="text-base font-display font-bold text-white">
                  {getAppraisalText(playerDistanceKm)}
                </span>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block mb-0.5">
                  Distance
                </span>
                <div className="text-2xl font-display font-bold text-cyan-400 font-mono-numbers">
                  {formatDistance(playerDistanceKm)}
                </div>
              </div>
            </div>

            {/* Duel Mode Damage Resolution */}
            {isDuelMode && (
              <div
                className={`p-4 rounded-xl border ${
                  damagedTarget === 'opponent'
                    ? 'bg-emerald-950/35 border-emerald-400/40 text-emerald-100'
                    : damagedTarget === 'player'
                    ? 'bg-rose-950/35 border-rose-400/40 text-rose-100'
                    : 'bg-[#141C2B] border-white/10 text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold tracking-wider uppercase flex items-center gap-1.5">
                    {damagedTarget === 'opponent' ? (
                      <>
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        <span>Dégâts Infligés</span>
                      </>
                    ) : damagedTarget === 'player' ? (
                      <>
                        <ShieldAlert className="w-4 h-4 text-rose-400" />
                        <span>Dégâts Subis</span>
                      </>
                    ) : (
                      <span>Égalité Parfaite</span>
                    )}
                  </span>
                  {damageMultiplier > 1 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-400/35 font-mono-numbers font-bold">
                      x{damageMultiplier.toFixed(1)} Multiplicateur
                    </span>
                  )}
                </div>

                <div className="text-2xl font-display font-bold mb-2.5 font-mono-numbers">
                  {damagedTarget === 'opponent' && `+${damageDealt.toLocaleString('fr-FR')} DÉGÂTS`}
                  {damagedTarget === 'player' && `-${damageDealt.toLocaleString('fr-FR')} PV`}
                  {damagedTarget === 'tie' && 'Aucun dégât'}
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between mb-1 font-semibold">
                      <span className="text-cyan-300">Votre Santé</span>
                      <span className="font-mono-numbers text-cyan-300">
                        {Math.max(0, playerHp)} / 6000 PV
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[#07090F] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500 rounded-full"
                        style={{ width: `${Math.max(0, (playerHp / 6000) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1 font-semibold">
                      <span className="text-rose-300">Santé Adversaire</span>
                      <span className="font-mono-numbers text-rose-300">
                        {Math.max(0, opponentHp)} / 6000 PV
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[#07090F] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-rose-500 to-amber-500 transition-all duration-500 rounded-full"
                        style={{ width: `${Math.max(0, (opponentHp / 6000) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#141C2B] border border-white/10 p-3 rounded-xl">
                <span className="text-[11px] text-slate-400 font-semibold block mb-0.5">
                  Votre Précision
                </span>
                <div className="text-lg font-display font-bold text-cyan-400 font-mono-numbers">
                  {formatDistance(playerDistanceKm)}
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5">Écart au point réel</span>
              </div>

              {opponentDistanceKm !== undefined ? (
                <div className="bg-[#141C2B] border border-white/10 p-3 rounded-xl">
                  <span className="text-[11px] text-slate-400 font-semibold block mb-0.5">
                    Adversaire
                  </span>
                  <div className="text-lg font-display font-bold text-amber-300 font-mono-numbers">
                    {formatDistance(opponentDistanceKm)}
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5 font-mono-numbers">
                    {(opponentScore ?? 0).toLocaleString('fr-FR')} pts marqués
                  </span>
                </div>
              ) : (
                <div className="bg-[#141C2B] border border-white/10 p-3 rounded-xl">
                  <span className="text-[11px] text-slate-400 font-semibold block mb-0.5">Score Max</span>
                  <div className="text-lg font-display font-bold text-amber-400 font-mono-numbers">
                    5 000 pts
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Parfait sous 50 m</span>
                </div>
              )}
            </div>

            {/* Geo Trivia */}
            <div className="p-3 bg-[#07090F]/80 border border-white/10 rounded-xl space-y-1 text-xs">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>Le saviez-vous ?</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">{location.clues.funFact}</p>
              <div className="flex items-center gap-3 pt-0.5 text-[10px] text-slate-400">
                <span>
                  Côté conduite : <strong className="text-white">{location.clues.drivingSide}</strong>
                </span>
                <span>·</span>
                <span>
                  Alphabet : <strong className="text-white">{location.clues.alphabet}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-[#141C2B] border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400 font-mono-numbers">
            Coordonnées :{' '}
            <span className="text-cyan-300">
              {location.lat.toFixed(4)}°, {location.lng.toFixed(4)}°
            </span>
          </div>
          <button
            type="button"
            disabled={isWaitingOpponent}
            onClick={() => {
              sound.playClick();
              onNextRound();
            }}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:bg-slate-700 disabled:text-slate-300 text-[#07090F] font-display font-bold text-sm tracking-wide shadow-lg shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            {isWaitingOpponent ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>En attente de l’adversaire...</span>
              </>
            ) : (
              <>
                <span>{isGameOver ? 'Voir le Bilan Final' : 'Manche Suivante'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
