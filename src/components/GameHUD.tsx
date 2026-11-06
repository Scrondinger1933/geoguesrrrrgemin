import React from 'react';
import { Swords, Trophy, Compass, Flame, Volume2, VolumeX, Home, AlertCircle } from 'lucide-react';
import { GameMode, OpponentProfile } from '../game/multiplayer';

interface GameHUDProps {
  mode: GameMode;
  roundNumber: number;
  maxRounds: number;
  score: number;
  playerHp: number;
  opponentHp: number;
  botOpponent?: OpponentProfile;
  opponentHasGuessed: boolean;
  timeLeft?: number;
  streakCount?: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onExit: () => void;
}

export function GameHUD({
  mode,
  roundNumber,
  maxRounds,
  score,
  playerHp,
  opponentHp,
  botOpponent,
  opponentHasGuessed,
  timeLeft,
  streakCount = 0,
  isMuted,
  onToggleMute,
  onExit,
}: GameHUDProps) {
  return (
    <div className="absolute top-0 inset-x-0 z-30 p-3 sm:p-4 flex items-center justify-between pointer-events-none">
      {/* Top Left: Round & Mode Pill */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <div className="bg-slate-900/85 border border-slate-700/60 rounded-2xl px-3 py-2 shadow-lg backdrop-blur-md flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
            {mode === 'duel' && <Swords className="w-4 h-4" />}
            {mode === 'classic' && <Trophy className="w-4 h-4" />}
            {mode === 'streak' && <Compass className="w-4 h-4" />}
            {mode === 'blitz' && <Flame className="w-4 h-4" />}
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">
              {mode === 'duel'
                ? `Duel #${roundNumber}`
                : mode === 'streak'
                ? 'Country Streak'
                : `Manche ${roundNumber}/${maxRounds}`}
            </span>
            <span className="text-xs font-black text-white font-mono-numbers">
              {mode === 'streak' ? `${streakCount} trouvés` : `Round ${roundNumber}`}
            </span>
          </div>
        </div>

        {/* Live Opponent Alert */}
        {mode === 'duel' && opponentHasGuessed && (
          <div className="animate-bounce bg-rose-500/90 text-white border border-rose-300 rounded-full px-3 py-1.5 shadow-xl text-xs font-bold flex items-center gap-1.5 backdrop-blur-md">
            <AlertCircle className="w-4 h-4 animate-spin" />
            <span>Adversaire a deviné !</span>
          </div>
        )}
      </div>

      {/* Top Center: Duel Health Bars */}
      {mode === 'duel' ? (
        <div className="hidden sm:flex items-center gap-3 bg-slate-900/85 border border-slate-700/60 rounded-2xl px-4 py-2 shadow-xl backdrop-blur-md pointer-events-auto max-w-md w-full">
          {/* Player HP */}
          <div className="flex-1">
            <div className="flex justify-between text-[11px] font-bold mb-1">
              <span className="text-cyan-300">VOUS</span>
              <span className="font-mono text-cyan-400">{Math.max(0, playerHp)} PV</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500 rounded-full"
                style={{ width: `${Math.max(0, (playerHp / 6000) * 100)}%` }}
              />
            </div>
          </div>

          <span className="text-xs font-black text-slate-500 font-mono">VS</span>

          {/* Opponent HP */}
          <div className="flex-1">
            <div className="flex justify-between text-[11px] font-bold mb-1">
              <span className="text-rose-300 truncate max-w-[90px]">{botOpponent?.name || 'ADVERSAIRE'}</span>
              <span className="font-mono text-rose-400">{Math.max(0, opponentHp)} PV</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-rose-500 to-amber-500 transition-all duration-500 rounded-full"
                style={{ width: `${Math.max(0, (opponentHp / 6000) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Blitz Countdown Timer */}
      {mode === 'blitz' && timeLeft !== undefined && (
        <div
          className={`flex items-center gap-2 rounded-2xl px-4 py-2 border shadow-xl backdrop-blur-md pointer-events-auto ${
            timeLeft <= 5
              ? 'bg-rose-500/30 border-rose-500 text-rose-300 animate-pulse'
              : 'bg-slate-900/85 border-slate-700/60 text-slate-200'
          }`}
        >
          <Flame className="w-4 h-4 text-rose-400" />
          <span className="text-lg font-black font-mono tracking-widest">{timeLeft}s</span>
        </div>
      )}

      {/* Top Right: Score & Settings */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <div className="bg-slate-900/85 border border-slate-700/60 rounded-2xl px-3.5 py-2 shadow-lg backdrop-blur-md text-right">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Score</span>
          <span className="text-sm font-black text-amber-400 font-mono-numbers">
            {score.toLocaleString('fr-FR')} <span className="text-[10px] text-amber-300">pts</span>
          </span>
        </div>

        <button
          onClick={onToggleMute}
          title={isMuted ? 'Activer le son' : 'Couper le son'}
          className="p-2.5 rounded-xl bg-slate-900/85 border border-slate-700/60 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 transition-all backdrop-blur-md active:scale-95 cursor-pointer"
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
        </button>

        <button
          onClick={onExit}
          title="Quitter la partie"
          className="p-2.5 rounded-xl bg-slate-900/85 border border-slate-700/60 text-slate-300 hover:text-rose-400 hover:bg-slate-800 transition-all backdrop-blur-md active:scale-95 cursor-pointer"
        >
          <Home className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
