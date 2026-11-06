import React from 'react';
import { Trophy, RotateCcw, Home, Swords, Compass, Flame } from 'lucide-react';
import { GameMode, OpponentProfile } from '../game/multiplayer';
import { getRankTier } from '../game/rules';
import { sound } from '../utils/audio';

interface GameOverModalProps {
  mode: GameMode;
  totalScore: number;
  playerHp: number;
  opponentHp: number;
  botOpponent?: OpponentProfile;
  roundsCount: number;
  streakCount: number;
  onRestart: () => void;
  onHome: () => void;
}

export function GameOverModal({
  mode,
  totalScore,
  playerHp,
  opponentHp,
  botOpponent,
  roundsCount,
  streakCount,
  onRestart,
  onHome,
}: GameOverModalProps) {
  const isDuelVictory = mode === 'duel' && opponentHp <= 0;
  const rank = getRankTier(totalScore);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center">
        {/* Victory / Defeat Badge */}
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-xl shadow-amber-500/25 border border-amber-300/40 mb-5">
          {mode === 'duel' ? (
            isDuelVictory ? (
              <Trophy className="w-10 h-10 text-white" />
            ) : (
              <Swords className="w-10 h-10 text-white" />
            )
          ) : mode === 'streak' ? (
            <Compass className="w-10 h-10 text-white" />
          ) : (
            <Flame className="w-10 h-10 text-white" />
          )}
        </div>

        {/* Title */}
        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2">
          {mode === 'duel'
            ? isDuelVictory
              ? 'VICTOIRE ÉCLATANTE !'
              : 'DÉFAITE AU DUEL'
            : mode === 'streak'
            ? 'FIN DE LA SÉRIE'
            : 'FIN DE LA PARTIE'}
        </h2>

        <p className="text-sm text-slate-400 mb-6">
          {mode === 'duel'
            ? isDuelVictory
              ? `Vous avez terrassé ${botOpponent?.name || 'votre adversaire'} !`
              : `${botOpponent?.name || 'Votre adversaire'} a été plus rapide et précis.`
            : mode === 'streak'
            ? `Vous avez identifié ${streakCount} pays consécutifs sans faute !`
            : `Tour de ${roundsCount} manches accompli.`}
        </p>

        {/* Score & Rank Card */}
        <div className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-6 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Score Total</span>
            <span className="text-2xl font-black text-amber-400 font-mono-numbers">
              {totalScore.toLocaleString('fr-FR')} <span className="text-xs text-amber-300">pts</span>
            </span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Rang Obtenu</span>
            <div className="flex items-center gap-1.5">
              <span>{rank.badge}</span>
              <span className={`text-xs font-black bg-gradient-to-r ${rank.color} bg-clip-text text-transparent`}>
                {rank.title}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 w-full">
          <button
            onClick={() => {
              sound.playClick();
              onRestart();
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-cyan-500/25 active:scale-95 transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Rejouer</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              onHome();
            }}
            className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-sm border border-slate-700 active:scale-95 transition-all cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Accueil</span>
          </button>
        </div>
      </div>
    </div>
  );
}
