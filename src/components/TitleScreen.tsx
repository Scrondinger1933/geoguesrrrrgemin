import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Volume2,
  VolumeX,
  Play,
  Users,
  Globe2,
  Radio,
  Sparkles,
  Layers,
  Building2,
  Plus,
  Swords,
  UserPlus,
  ShoppingBag,
  GraduationCap,
  Settings,
  Bug,
  Compass,
  ArrowRight,
  CheckCircle2,
  Clock,
  Flame,
} from 'lucide-react';
import { GameMode, BOT_OPPONENTS, OpponentProfile } from '../game/multiplayer';
import { AuthAndCloudModal } from './AuthAndCloudModal';
import { MultiplayerLobbyModal } from './MultiplayerLobbyModal';
import { sound } from '../utils/audio';

interface TitleScreenProps {
  onStartGame: (mode: GameMode, selectedBot: OpponentProfile, customRoomId?: string, mapFilter?: 'world' | 'france' | 'capitals' | 'rural') => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export function TitleScreen({ onStartGame, isMuted, onToggleMute }: TitleScreenProps) {
  const [showMultiplayerModal, setShowMultiplayerModal] = useState(false);
  const [urlRoomCode, setUrlRoomCode] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [modalTab, setModalTab] = useState<'auth' | 'leaderboard' | 'github' | null>(null);
  const [selectedMap, setSelectedMap] = useState<'france' | 'world' | 'capitals' | 'rural'>('world');
  const [storedUser, setStoredUser] = useState<any>(null);

  // Check URL params for ?room=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      setUrlRoomCode(room.toUpperCase());
      setShowMultiplayerModal(true);
    }
  }, []);

  // Check localStorage for logged-in user
  useEffect(() => {
    try {
      const user = localStorage.getItem('geoapex_auth_user');
      if (user) {
        setStoredUser(JSON.parse(user));
      }
    } catch {}
  }, [modalTab]);

  const handleStartSolo = (map: 'france' | 'world' | 'capitals' | 'rural') => {
    sound.playClick();
    setSelectedMap(map);
    onStartGame('classic', BOT_OPPONENTS[0], undefined, map);
  };

  const handleQuickDuel = () => {
    sound.playClick();
    onStartGame('duel', BOT_OPPONENTS[0], undefined, selectedMap);
  };

  const handleJoinRoom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    sound.playClick();
    if (roomCodeInput.trim()) {
      setUrlRoomCode(roomCodeInput.trim().toUpperCase());
    }
    setShowMultiplayerModal(true);
  };

  return (
    <div className="relative w-full h-full min-h-screen bg-[#0d0f17] flex flex-col justify-between overflow-hidden select-none text-slate-100">
      {/* Cinematic Ambient Street View Background with Blur */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center filter blur-md scale-105 opacity-35"
        style={{
          backgroundImage:
            'url("https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=2000&q=80")',
        }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#0d0f17]/80 via-[#0d0f17]/60 to-[#0d0f17] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 max-w-5xl mx-auto w-full">
        {/* Brand Lockup */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-400/30">
            <Globe2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black tracking-tight text-white font-mono">GEO</span>
              <span className="text-xl font-black tracking-tight bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                APEX
              </span>
              <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 ml-1">
                Street View 360°
              </span>
            </div>
          </div>
        </div>

        {/* Top Right Quick Settings */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              sound.playClick();
              setModalTab('github');
            }}
            className="px-3 py-1.5 rounded-xl bg-[#1e2235]/90 hover:bg-[#282d46] border border-slate-700/60 text-xs font-semibold text-slate-300 transition-all cursor-pointer"
          >
            GitHub
          </button>

          <button
            onClick={onToggleMute}
            title={isMuted ? 'Activer le son' : 'Couper le son'}
            className="p-2 rounded-xl bg-[#1e2235]/90 hover:bg-[#282d46] border border-slate-700/60 text-slate-300 transition-all cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>
        </div>
      </header>

      {/* Main Center Content: Clean OpenGuessr / GeoGuessr Card Layout */}
      <main className="relative z-10 max-w-3xl mx-auto w-full px-4 my-auto py-2 flex flex-col gap-3.5">
        {/* ROW 1: Singleplayer Cards */}
        <div className="bg-[#181a26]/90 border border-slate-700/70 rounded-2xl p-3 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <span>Singleplayer</span>
              <span className="text-cyan-400 font-mono text-xs">∞</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Générateur mondial aléatoire</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* France Map */}
            <button
              onClick={() => handleStartSolo('france')}
              className="group relative h-28 rounded-xl bg-[#222638] hover:bg-[#2c3148] border border-slate-700/80 hover:border-cyan-400/60 p-3 flex flex-col justify-between transition-all duration-150 active:scale-95 cursor-pointer text-left overflow-hidden shadow-md"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 group-hover:scale-105 transition-transform">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-extrabold text-white block">France</span>
                <span className="text-[10px] text-slate-400">Régions & routes</span>
              </div>
              <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Play className="w-4 h-4 text-cyan-400 fill-cyan-400" />
              </div>
            </button>

            {/* World Map */}
            <button
              onClick={() => handleStartSolo('world')}
              className="group relative h-28 rounded-xl bg-gradient-to-br from-[#1e293b] to-[#0f172a] hover:from-[#25334a] hover:to-[#172238] border-2 border-cyan-500/50 hover:border-cyan-400 p-3 flex flex-col justify-between transition-all duration-150 active:scale-95 cursor-pointer text-left overflow-hidden shadow-lg shadow-cyan-950/40"
            >
              <div className="w-8 h-8 rounded-lg bg-cyan-500/30 border border-cyan-400/40 flex items-center justify-center text-cyan-300 group-hover:scale-105 transition-transform">
                <Globe2 className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-black text-white block flex items-center gap-1">
                  <span>Monde Entier</span>
                  <Sparkles className="w-3 h-3 text-amber-400" />
                </span>
                <span className="text-[10px] text-cyan-300 font-medium">80+ pays couverts</span>
              </div>
              <div className="absolute right-2 bottom-2">
                <Play className="w-4 h-4 text-cyan-400 fill-cyan-400 group-hover:scale-110 transition-transform" />
              </div>
            </button>

            {/* Capital Cities */}
            <button
              onClick={() => handleStartSolo('capitals')}
              className="group relative h-28 rounded-xl bg-[#222638] hover:bg-[#2c3148] border border-slate-700/80 hover:border-cyan-400/60 p-3 flex flex-col justify-between transition-all duration-150 active:scale-95 cursor-pointer text-left overflow-hidden shadow-md"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 group-hover:scale-105 transition-transform">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-extrabold text-white block">Capitales</span>
                <span className="text-[10px] text-slate-400">Grandes métropoles</span>
              </div>
              <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Play className="w-4 h-4 text-cyan-400 fill-cyan-400" />
              </div>
            </button>

            {/* Rural & Highway Maps */}
            <button
              onClick={() => handleStartSolo('rural')}
              className="group relative h-28 rounded-xl bg-[#222638] hover:bg-[#2c3148] border border-slate-700/80 hover:border-cyan-400/60 p-3 flex flex-col justify-between transition-all duration-150 active:scale-95 cursor-pointer text-left overflow-hidden shadow-md"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 group-hover:scale-105 transition-transform">
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-extrabold text-white block">Campagnes</span>
                <span className="text-[10px] text-slate-400">Routes et nature</span>
              </div>
              <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Plus className="w-4 h-4 text-cyan-400" />
              </div>
            </button>
          </div>
        </div>

        {/* ROW 2: Multiplayer & Competitions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Multiplayer Card */}
          <div className="bg-[#181a26]/90 border border-slate-700/70 rounded-2xl p-3 shadow-xl backdrop-blur-md flex flex-col justify-between">
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>Multijoueur En Ligne</span>
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Serveur WebSocket
              </span>
            </div>

            <form onSubmit={handleJoinRoom} className="space-y-2">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Code salon (ex: APEX-1234)"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  className="flex-1 bg-[#222638] border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono tracking-wider text-white uppercase focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setUrlRoomCode('');
                    setShowMultiplayerModal(true);
                  }}
                  className="flex-1 py-2 rounded-xl bg-[#222638] hover:bg-[#2a3048] border border-slate-700 text-xs font-bold text-cyan-300 transition-colors cursor-pointer text-center"
                >
                  Partie Rapide
                </button>
                <button
                  type="button"
                  onClick={handleQuickDuel}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-bold text-white transition-all cursor-pointer shadow-md shadow-purple-900/30 flex items-center justify-center gap-1.5"
                >
                  <Swords className="w-3.5 h-3.5" />
                  <span>Duel Contre Bot</span>
                </button>
              </div>
            </form>
          </div>

          {/* Competitions / Daily Challenge Card */}
          <div className="bg-[#181a26]/90 border border-slate-700/70 rounded-2xl p-3 shadow-xl backdrop-blur-md flex flex-col justify-between">
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Compétitions Quotidiennes</span>
              </span>
              <span className="text-[10px] text-amber-300 font-mono">Défi du Jour</span>
            </div>

            {/* Daily pills */}
            <div className="grid grid-cols-5 gap-1 py-1">
              {['Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day, idx) => (
                <button
                  key={day}
                  onClick={() => handleStartSolo('world')}
                  className={`py-2 rounded-xl flex flex-col items-center justify-center gap-0.5 border text-xs transition-all cursor-pointer ${
                    idx === 4
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                      : 'bg-[#222638] border-slate-700/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {idx === 4 ? (
                    <Clock className="w-3 h-3 text-amber-400" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3 text-slate-500" />
                  )}
                  <span className="text-[10px] font-bold">{day}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => handleStartSolo('world')}
              className="w-full mt-2 py-1.5 rounded-xl bg-[#222638] hover:bg-[#2b3149] border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer text-center"
            >
              Lancer le défi mondial du jour
            </button>
          </div>
        </div>

        {/* ROW 3: Account & Quick Utility Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Account Card (Span 2) */}
          <button
            onClick={() => {
              sound.playClick();
              setModalTab('auth');
            }}
            className="sm:col-span-2 bg-[#181a26]/90 hover:bg-[#222638] border border-slate-700/70 hover:border-cyan-400/50 rounded-2xl p-3 shadow-xl backdrop-blur-md flex items-center justify-between transition-all cursor-pointer text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-lg text-cyan-300">
                {storedUser?.avatarUrl || <UserPlus className="w-5 h-5 text-cyan-400" />}
              </div>
              <div>
                <span className="text-xs font-bold text-white block group-hover:text-cyan-300 transition-colors">
                  {storedUser ? storedUser.displayName : 'Créer un Compte & Code Email'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {storedUser
                    ? `${storedUser.highestScore || 0} pts · Email vérifié Cloud SQL`
                    : 'Studio Maldecena Soeiro · Sauvegarder vos scores'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#222638] group-hover:bg-cyan-500 group-hover:text-slate-950 text-cyan-300 font-bold text-xs transition-colors border border-slate-700 group-hover:border-transparent">
              <span>{storedUser ? 'Mon Profil' : 'Connexion'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>

          {/* Quick Action Pills: Leaderboard & Sound */}
          <div className="flex gap-2">
            {/* Cloud SQL Podium / Leaderboard */}
            <button
              onClick={() => {
                sound.playClick();
                setModalTab('leaderboard');
              }}
              title="Classement mondial Cloud SQL"
              className="flex-1 rounded-2xl bg-[#181a26]/90 hover:bg-[#222638] border border-slate-700/70 hover:border-amber-400/50 flex flex-col items-center justify-center p-2.5 transition-all cursor-pointer group"
            >
              <Trophy className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold text-slate-300 mt-1">Podium</span>
            </button>

            {/* Settings & Info */}
            <button
              onClick={() => {
                sound.playClick();
                setModalTab('auth');
              }}
              title="Paramètres et configuration"
              className="flex-1 rounded-2xl bg-[#181a26]/90 hover:bg-[#222638] border border-slate-700/70 hover:border-cyan-400/50 flex flex-col items-center justify-center p-2.5 transition-all cursor-pointer group"
            >
              <Settings className="w-5 h-5 text-slate-300 group-hover:rotate-45 transition-transform" />
              <span className="text-[10px] font-bold text-slate-300 mt-1">Réglages</span>
            </button>
          </div>
        </div>
      </main>

      {/* Bottom Footer Mini Pills */}
      <footer className="relative z-10 py-3 flex items-center justify-center">
        <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-[#161822]/80 border border-slate-800 text-xs text-slate-400">
          <span className="text-[11px] font-medium">Studio Maldecena Soeiro</span>
          <span className="text-slate-600">&bull;</span>
          <span className="text-[11px]">GeoApex 3D</span>
          <span className="text-slate-600">&bull;</span>
          <span className="text-[11px] text-emerald-400 font-mono">Street View &amp; Cloud SQL</span>
        </div>
      </footer>

      {/* Modals */}
      <AuthAndCloudModal
        isOpen={modalTab !== null}
        defaultTab={modalTab || 'auth'}
        onClose={() => setModalTab(null)}
      />

      <MultiplayerLobbyModal
        isOpen={showMultiplayerModal}
        defaultRoomCode={urlRoomCode}
        onClose={() => setShowMultiplayerModal(false)}
        onStartGame={(roomId) => {
          setShowMultiplayerModal(false);
          onStartGame('duel', BOT_OPPONENTS[0], roomId);
        }}
      />
    </div>
  );
}
