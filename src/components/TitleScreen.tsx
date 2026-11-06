import React, { useState } from 'react';
import { Swords, Compass, Flame, Trophy, Volume2, VolumeX, Play, Users, Globe2 } from 'lucide-react';
import { GameMode, BOT_OPPONENTS, OpponentProfile } from '../game/multiplayer';
import { EarthGlobe } from './EarthGlobe';
import { sound } from '../utils/audio';

interface TitleScreenProps {
  onStartGame: (mode: GameMode, selectedBot: OpponentProfile, customRoomId?: string) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export function TitleScreen({ onStartGame, isMuted, onToggleMute }: TitleScreenProps) {
  const [selectedMode, setSelectedMode] = useState<GameMode>('duel');
  const [selectedBot, setSelectedBot] = useState<OpponentProfile>(BOT_OPPONENTS[0]);
  const [customRoom, setCustomRoom] = useState<string>('');
  const [showMultiplayerTab, setShowMultiplayerTab] = useState(false);

  const handleStart = () => {
    sound.playClick();
    onStartGame(selectedMode, selectedBot, customRoom.trim() || undefined);
  };

  return (
    <div className="relative w-full h-full min-h-screen bg-slate-950 flex flex-col justify-between overflow-hidden select-none">
      {/* Background Interactive 3D Earth Globe Hero */}
      <div className="absolute inset-0 z-0 opacity-45 pointer-events-auto">
        <EarthGlobe interactive={true} className="w-full h-full" />
      </div>

      {/* Atmospheric Vignette & Top Light */}
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent pointer-events-none" />

      {/* Top Bar: Title & Sound Toggle */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto w-full">
        {/* Title Lockup */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 border border-cyan-400/40">
            <Globe2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight text-white font-mono">GEO</span>
              <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                APEX
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                3D Street View
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Clone GeoGuessr Compétitif en Temps Réel</p>
          </div>
        </div>

        {/* Audio Mute toggle button */}
        <button
          onClick={onToggleMute}
          title={isMuted ? 'Activer le son' : 'Couper le son'}
          className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 transition-all backdrop-blur-md active:scale-95 cursor-pointer"
        >
          {isMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-cyan-400" />}
        </button>
      </header>

      {/* Central Content Area: Mode Cards & Start CTA */}
      <main className="relative z-10 max-w-4xl mx-auto w-full px-6 flex flex-col items-center justify-center my-auto py-6">
        {/* Subtitle pitch */}
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-3">
            Explorez le Monde. <br />
            <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
              Affrontez vos Rivaux en Temps Réel.
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto">
            Plongez dans des panoramas Street View 360°, devinez les coordonnées sur la carte et éliminez vos adversaires dans des duels intenses.
          </p>
        </div>

        {/* Game Mode Selector Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full mb-6">
          {/* Duel 1v1 */}
          <button
            onClick={() => {
              sound.playClick();
              setSelectedMode('duel');
            }}
            className={`p-4 rounded-2xl border text-left transition-all backdrop-blur-md flex flex-col justify-between cursor-pointer ${
              selectedMode === 'duel'
                ? 'bg-gradient-to-b from-cyan-500/20 to-blue-600/20 border-cyan-400 text-white shadow-xl shadow-cyan-500/15 scale-[1.02]'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center mb-3">
              <Swords className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <span className="text-sm font-bold block text-white">Duel 1v1</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">PV, dégâts & chrono</span>
            </div>
          </button>

          {/* Classic 5 Rounds */}
          <button
            onClick={() => {
              sound.playClick();
              setSelectedMode('classic');
            }}
            className={`p-4 rounded-2xl border text-left transition-all backdrop-blur-md flex flex-col justify-between cursor-pointer ${
              selectedMode === 'classic'
                ? 'bg-gradient-to-b from-emerald-500/20 to-teal-600/20 border-emerald-400 text-white shadow-xl shadow-emerald-500/15 scale-[1.02]'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-3">
              <Trophy className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <span className="text-sm font-bold block text-white">Classique</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">5 rounds · 25 000 max</span>
            </div>
          </button>

          {/* Country Streak */}
          <button
            onClick={() => {
              sound.playClick();
              setSelectedMode('streak');
            }}
            className={`p-4 rounded-2xl border text-left transition-all backdrop-blur-md flex flex-col justify-between cursor-pointer ${
              selectedMode === 'streak'
                ? 'bg-gradient-to-b from-amber-500/20 to-orange-600/20 border-amber-400 text-white shadow-xl shadow-amber-500/15 scale-[1.02]'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center mb-3">
              <Compass className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <span className="text-sm font-bold block text-white">Country Streak</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Série de pays sans faute</span>
            </div>
          </button>

          {/* Blitz 30s */}
          <button
            onClick={() => {
              sound.playClick();
              setSelectedMode('blitz');
            }}
            className={`p-4 rounded-2xl border text-left transition-all backdrop-blur-md flex flex-col justify-between cursor-pointer ${
              selectedMode === 'blitz'
                ? 'bg-gradient-to-b from-rose-500/20 to-pink-600/20 border-rose-400 text-white shadow-xl shadow-rose-500/15 scale-[1.02]'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center mb-3">
              <Flame className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <span className="text-sm font-bold block text-white">Blitz 30s</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Vitesse & adrénaline</span>
            </div>
          </button>
        </div>

        {/* Duel Mode Options: Choose Opponent or Room */}
        {selectedMode === 'duel' && (
          <div className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-4 mb-6 backdrop-blur-md">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-cyan-400" />
                <span>Adversaire Compétitif</span>
              </span>

              <button
                onClick={() => setShowMultiplayerTab(!showMultiplayerTab)}
                className="text-xs text-cyan-400 hover:underline font-semibold cursor-pointer"
              >
                {showMultiplayerTab ? 'Affronter un Bot' : 'Créer un salon privé (2 joueurs)'}
              </button>
            </div>

            {!showMultiplayerTab ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {BOT_OPPONENTS.map((bot) => (
                  <button
                    key={bot.id}
                    onClick={() => {
                      sound.playClick();
                      setSelectedBot(bot);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedBot.id === bot.id
                        ? 'bg-cyan-500/20 border-cyan-400 text-white'
                        : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xl">{bot.avatar}</span>
                      <span className="text-[10px] font-mono text-cyan-400 font-bold">{bot.elo} ELO</span>
                    </div>
                    <span className="text-xs font-bold block truncate">{bot.name}</span>
                    <span className="text-[10px] text-slate-400 block">{bot.flag} {bot.country}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Code de salon (ex: AMIS-2026)"
                  value={customRoom}
                  onChange={(e) => setCustomRoom(e.target.value)}
                  className="flex-1 bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
                <span className="text-[11px] text-slate-400">
                  Ouvrez un 2ème onglet avec le même code pour jouer en direct !
                </span>
              </div>
            )}
          </div>
        )}

        {/* Primary Start CTA Button */}
        <button
          onClick={handleStart}
          className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 text-white font-black text-lg tracking-wide shadow-2xl shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
        >
          <Play className="w-5 h-5 fill-white" />
          <span>LANCER LA PARTIE</span>
          <span className="text-xs font-mono bg-black/20 px-2 py-0.5 rounded-md text-cyan-100 font-normal">
            [Espace / Entrée]
          </span>
        </button>
      </main>

      {/* Control Hints Footer Bar */}
      <footer className="relative z-10 py-3.5 px-6 border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex items-center justify-center text-xs text-slate-400 gap-6 font-mono">
          <span>ZQSD / Glisser : Vue 360°</span>
          <span>·</span>
          <span>Espace : Valider le Guess</span>
          <span>·</span>
          <span>R : Retour au départ</span>
          <span>·</span>
          <span>T : Spot Aléatoire</span>
        </div>
      </footer>
    </div>
  );
}
