import React from 'react';
import { Swords, Trophy, Compass, Flame, Volume2, VolumeX, Home, Clock, Music } from 'lucide-react';
import { GameMode, OpponentProfile } from '../game/multiplayer';
import { sound } from '../utils/audio';

interface GameHUDProps {
  mode: GameMode;
  roundNumber: number;
  maxRounds: number;
  score: number;
  playerHp: number;
  opponentHp: number;
  botOpponent?: OpponentProfile;
  opponentName?: string;
  opponentAvatar?: string;
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
  opponentName,
  opponentAvatar,
  opponentHasGuessed,
  timeLeft,
  streakCount = 0,
  isMuted,
  onToggleMute,
  onExit,
}: GameHUDProps) {
  return (
    <div className="absolute top-0 inset-x-0 z-30 p-3 sm:p-4 flex items-center justify-between gap-2 pointer-events-none">
      {/* Top Left: Round & Mode */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <div className="bg-[#0E131D]/92 border border-white/12 rounded-xl px-3.5 py-2 shadow-xl flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-400/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
            {mode === 'duel' && <Swords className="w-4 h-4" />}
            {mode === 'classic' && <Trophy className="w-4 h-4" />}
            {mode === 'streak' && <Compass className="w-4 h-4" />}
            {mode === 'blitz' && <Flame className="w-4 h-4" />}
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-semibold block leading-tight">
              {mode === 'duel'
                ? `Duel · Manche ${roundNumber}`
                : mode === 'streak'
                ? 'Country Streak'
                : `Manche ${roundNumber}/${maxRounds}`}
            </span>
            <span className="text-xs font-extrabold text-white font-mono-numbers">
              {mode === 'streak' ? `${streakCount} pays` : `Round ${roundNumber}`}
            </span>
          </div>
        </div>

        {opponentHasGuessed && (
          <div className="bg-rose-500 text-white border border-rose-300/40 rounded-xl px-3 py-2 shadow-xl text-xs font-bold">
            Adversaire a validé
          </div>
        )}
      </div>

      {/* Top Center: Duel Health Bars + Optional Synchronized Countdown */}
      <div className="flex items-center gap-2.5 pointer-events-auto">
        {mode === 'duel' && (
          <div className="hidden sm:flex items-center gap-3 bg-[#0E131D]/92 border border-white/12 rounded-xl px-4 py-2 shadow-xl min-w-[320px] max-w-md">
            <div className="flex-1">
              <div className="flex justify-between text-[11px] font-bold mb-1">
                <span className="text-cyan-300">VOUS</span>
                <span className="font-mono-numbers text-cyan-400">{Math.max(0, playerHp)} PV</span>
              </div>
              <div className="w-full h-2 bg-[#07090F] rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-400 transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(0, (playerHp / 6000) * 100)}%` }}
                />
              </div>
            </div>

            <span className="text-[11px] font-mono font-bold text-slate-500">VS</span>

            <div className="flex-1">
              <div className="flex justify-between text-[11px] font-bold mb-1">
                <span className="text-rose-300 truncate max-w-[110px]">
                  {opponentAvatar ? `${opponentAvatar} ` : ''}
                  {opponentName || botOpponent?.name || 'ADVERSAIRE'}
                </span>
                <span className="font-mono-numbers text-rose-400">{Math.max(0, opponentHp)} PV</span>
              </div>
              <div className="w-full h-2 bg-[#07090F] rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(0, (opponentHp / 6000) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {timeLeft !== undefined && (
          <div
            data-testid="round-countdown"
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 border shadow-xl font-mono-numbers ${
              timeLeft <= 10
                ? 'bg-rose-500/95 border-rose-300/40 text-white'
                : 'bg-[#0E131D]/92 border-white/12 text-slate-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span className="text-base font-extrabold">{timeLeft}s</span>
          </div>
        )}
      </div>

      {/* Top Right: Score & Audio/Exit */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <div className="bg-[#0E131D]/92 border border-white/12 rounded-xl px-3.5 py-2 shadow-xl text-right">
          <span className="text-[11px] text-slate-400 font-semibold block leading-tight">Score</span>
          <span className="text-sm font-extrabold text-amber-400 font-mono-numbers">
            {score.toLocaleString('fr-FR')} pts
          </span>
        </div>

        <button
          type="button"
          onClick={() => sound.toggleMusic()}
          aria-label="Basculer la musique Across the Meridian"
          title="Musique : Across the Meridian"
          className="p-2.5 rounded-xl bg-[#0E131D]/92 border border-white/12 text-amber-400 hover:bg-[#151D2B] transition-colors cursor-pointer"
        >
          <Music className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggleMute}
          aria-label={isMuted ? 'Activer le son' : 'Couper le son'}
          title={isMuted ? 'Activer le son' : 'Couper le son'}
          className="p-2.5 rounded-xl bg-[#0E131D]/92 border border-white/12 text-slate-200 hover:bg-[#151D2B] transition-colors cursor-pointer"
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
        </button>

        <button
          type="button"
          onClick={onExit}
          aria-label="Quitter la partie vers l’accueil"
          title="Quitter la partie"
          className="p-2.5 rounded-xl bg-[#0E131D]/92 border border-white/12 text-slate-200 hover:text-rose-400 hover:bg-[#151D2B] transition-colors cursor-pointer"
        >
          <Home className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
