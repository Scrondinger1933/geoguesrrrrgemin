import React, { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  Volume2,
  VolumeX,
  Play,
  Users,
  Globe2,
  Layers,
  Building2,
  Compass,
  Swords,
  Mail,
  Music,
  Pause,
  ArrowRight,
  KeyRound,
  UserCheck,
  Flame,
  Flag,
} from 'lucide-react';
import { GameMode, BOT_OPPONENTS, OpponentProfile } from '../game/multiplayer';
import { multiplayerClient, RoomsDirectorySnapshot } from '../game/multiplayerClient';
import { normalizeRoomCode } from '../game/lobbyRules';
import { AuthAndCloudModal } from './AuthAndCloudModal';
import { MultiplayerLobbyModal } from './MultiplayerLobbyModal';
import { StreetViewBackdrop } from './StreetViewBackdrop';
import { EarthGlobe } from './EarthGlobe';
import { sound } from '../utils/audio';

interface TitleScreenProps {
  onStartGame: (
    mode: GameMode,
    selectedBot: OpponentProfile,
    customRoomId?: string,
    mapFilter?: 'world' | 'france' | 'capitals' | 'rural'
  ) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

const REGIONS: Array<{
  id: 'world' | 'france' | 'capitals' | 'rural';
  label: string;
  subtitle: string;
  icon: React.ReactNode;
}> = [
  { id: 'world', label: 'Monde', subtitle: '80+ pays', icon: <Globe2 className="w-4 h-4" /> },
  { id: 'france', label: 'France', subtitle: 'Régions', icon: <Layers className="w-4 h-4" /> },
  { id: 'capitals', label: 'Capitales', subtitle: 'Métropoles', icon: <Building2 className="w-4 h-4" /> },
  { id: 'rural', label: 'Campagnes', subtitle: 'Routes & nature', icon: <Compass className="w-4 h-4" /> },
];

const MODES: Array<{
  id: GameMode;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: 'duel', label: 'Duel 6000 PV', icon: <Swords className="w-3.5 h-3.5" /> },
  { id: 'classic', label: 'Classique 5M', icon: <Trophy className="w-3.5 h-3.5" /> },
  { id: 'blitz', label: 'Blitz 30s', icon: <Flame className="w-3.5 h-3.5" /> },
  { id: 'streak', label: 'Streak Pays', icon: <Flag className="w-3.5 h-3.5" /> },
];

export function TitleScreen({ onStartGame, isMuted, onToggleMute }: TitleScreenProps) {
  const [showMultiplayerModal, setShowMultiplayerModal] = useState(false);
  const [urlRoomCode, setUrlRoomCode] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [modalTab, setModalTab] = useState<'auth' | 'leaderboard' | 'keys' | 'github' | null>(null);
  const [selectedMap, setSelectedMap] = useState<'france' | 'world' | 'capitals' | 'rural'>('world');
  const [activeGameMode, setActiveGameMode] = useState<GameMode>('duel');

  const [storedUser, setStoredUser] = useState<any>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(sound.isMusicPlaying);
  const [directory, setDirectory] = useState<RoomsDirectorySnapshot>(multiplayerClient.directory);
  const [wsConnected, setWsConnected] = useState(multiplayerClient.isConnected);

  const syncStoredUser = useCallback(() => {
    try {
      const user = localStorage.getItem('geoapex_auth_user');
      setStoredUser(user ? JSON.parse(user) : null);
    } catch {
      setStoredUser(null);
    }
  }, []);

  useEffect(() => {
    const unsubMusic = sound.subscribeMusic((playing) => setIsMusicPlaying(playing));
    const unsubDir = multiplayerClient.on('ROOMS_LIST', (snap: RoomsDirectorySnapshot) => {
      if (snap) setDirectory(snap);
    });
    const unsubConn = multiplayerClient.on('connection_status', (st: { connected: boolean }) => {
      setWsConnected(!!st?.connected);
    });
    return () => {
      unsubMusic();
      unsubDir();
      unsubConn();
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      setUrlRoomCode(normalizeRoomCode(room));
      setShowMultiplayerModal(true);
    }
  }, []);

  useEffect(() => {
    syncStoredUser();
    window.addEventListener('geoapex-auth-updated', syncStoredUser);
    return () => window.removeEventListener('geoapex-auth-updated', syncStoredUser);
  }, [modalTab, syncStoredUser]);

  const handlePrimaryStart = useCallback(
    (e?: React.SyntheticEvent) => {
      if (e && 'currentTarget' in e && e.currentTarget instanceof HTMLElement) {
        e.currentTarget.blur();
      }
      sound.playClick();
      onStartGame(
        activeGameMode,
        BOT_OPPONENTS[0],
        undefined,
        activeGameMode === 'streak' ? 'world' : selectedMap
      );
    },
    [activeGameMode, selectedMap, onStartGame]
  );

  // Title Screen Keyboard Start Handshake (Enter or Space)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showMultiplayerModal || modalTab !== null) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement ||
          target instanceof HTMLButtonElement)
      ) {
        return;
      }
      if (e.key === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        handlePrimaryStart();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showMultiplayerModal, modalTab, handlePrimaryStart]);

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playClick();
    const normalized = normalizeRoomCode(roomCodeInput);
    setUrlRoomCode(normalized);
    setShowMultiplayerModal(true);
  };

  const openPublicRoomsCount = directory.rooms.filter(
    (r) => r.status === 'lobby' && r.playerCount < r.maxPlayers
  ).length;

  return (
    <div className="relative w-full h-full overflow-y-auto overflow-x-hidden bg-[#07090F] flex flex-col justify-between select-none text-slate-100">
      {/* Live 360° Google Street View World Backdrop with Orbital Cartography Fallback */}
      <StreetViewBackdrop />

      {/* Top Minimalist Utility Header */}
      <header className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 sm:gap-6 shrink-0">
        <div className="flex items-center gap-3 shrink-0">
          <svg viewBox="0 0 36 36" className="w-9 h-9 shrink-0" aria-hidden="true">
            <rect
              x="1.5"
              y="1.5"
              width="33"
              height="33"
              rx="9"
              fill="#0E131D"
              stroke="rgba(34,211,238,0.45)"
              strokeWidth="1.5"
            />
            <circle cx="18" cy="18" r="10" stroke="#22D3EE" strokeWidth="1.4" strokeDasharray="3 2" fill="none" />
            <polygon points="18,6 21.5,18 18,15.5 14.5,18" fill="#F59E0B" />
            <polygon points="18,30 21.5,18 18,20.5 14.5,18" fill="#22D3EE" opacity="0.85" />
          </svg>
          <span className="font-display text-xl font-extrabold tracking-tight text-white whitespace-nowrap">
            GEO<span className="text-cyan-400">APEX</span>
          </span>
        </div>

        <nav aria-label="Outils du jeu" className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setModalTab('leaderboard');
            }}
            className="px-3 py-2 rounded-xl bg-[#0E131D]/90 hover:bg-[#151D2B] border border-white/10 text-xs font-semibold text-slate-200 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Classement</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setModalTab('keys');
            }}
            className="px-3 py-2 rounded-xl bg-[#0E131D]/90 hover:bg-[#151D2B] border border-white/10 text-xs font-semibold text-slate-200 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Mail className="w-3.5 h-3.5 text-cyan-400" />
            <span>Messagerie SMTP</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setModalTab('auth');
            }}
            className="px-3.5 py-2 rounded-xl bg-[#0E131D]/90 hover:bg-[#151D2B] border border-cyan-400/35 text-xs font-semibold text-cyan-200 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            {storedUser ? (
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span>{storedUser ? storedUser.displayName : 'Compte'}</span>
          </button>

          <button
            type="button"
            onClick={() => sound.toggleMusic()}
            title={isMusicPlaying ? 'Mettre la musique en pause' : 'Écouter Across the Meridian'}
            aria-label={isMusicPlaying ? 'Mettre la musique en pause' : 'Lancer la musique'}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              isMusicPlaying
                ? 'bg-amber-500/15 border-amber-400/40 text-amber-300'
                : 'bg-[#0E131D]/90 hover:bg-[#151D2B] border-white/10 text-slate-300'
            }`}
          >
            {isMusicPlaying ? <Pause className="w-3.5 h-3.5" /> : <Music className="w-3.5 h-3.5 text-amber-400" />}
            <span className="hidden md:inline">Across the Meridian</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Activer le son' : 'Couper le son'}
            className="p-2.5 rounded-xl bg-[#0E131D]/90 hover:bg-[#151D2B] border border-white/10 text-slate-200 transition-colors cursor-pointer shrink-0"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>
        </nav>
      </header>

      {/* Main Split Stage (Left Sleek Control Deck · Right Interactive 3D Globe with Flags) */}
      <main className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 py-3 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Hero Column */}
        <section className="lg:col-span-7 flex flex-col justify-center gap-5 max-w-xl">
          <div className="space-y-2.5">
            <p className="text-xs font-medium text-cyan-300/90 tracking-wide">
              Street View 360° <span aria-hidden="true">·</span> Duels Temps Réel <span aria-hidden="true">·</span> Serveur En Ligne
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.08] text-balance">
              Explorez la Planète.{' '}
              <span className="text-cyan-400">Dominez le Chronomètre.</span>
            </h1>
          </div>

          {/* Clean Single-Elevation Configuration Card */}
          <div className="bg-[#0E131D]/92 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xl">
            {/* Mode Segmented Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-200">Mode de jeu</span>
                <span className="font-mono-numbers">5 manches</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-[#07090F] p-1 rounded-xl border border-white/10">
                {MODES.map((m) => {
                  const active = activeGameMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setActiveGameMode(m.id);
                      }}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                        active
                          ? 'bg-cyan-400 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {m.icon}
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Region Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-200">Secteur</span>
                <span>{activeGameMode === 'streak' ? 'Monde entier' : 'Zone active'}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {REGIONS.map((reg) => {
                  const active = selectedMap === reg.id;
                  const disabled = activeGameMode === 'streak';
                  return (
                    <button
                      key={reg.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        sound.playClick();
                        setSelectedMap(reg.id);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                        active && !disabled
                          ? 'bg-cyan-500/15 border-cyan-400/70 text-white'
                          : 'bg-[#07090F] hover:bg-[#131A29] border-white/10 text-slate-300'
                      }`}
                    >
                      <div className="mb-1">
                        <span className={active && !disabled ? 'text-cyan-400' : 'text-slate-400'}>
                          {reg.icon}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-white leading-tight">{reg.label}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{reg.subtitle}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Primary Play Action + Online Server Launch */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                data-start="true"
                onClick={handlePrimaryStart}
                className="flex-1 py-3 px-6 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-extrabold text-sm tracking-wide transition-colors cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Lancer la Partie</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setUrlRoomCode('');
                  setShowMultiplayerModal(true);
                }}
                className="sm:w-auto py-3 px-5 rounded-xl bg-[#141C2B] hover:bg-[#1B263B] border border-amber-400/40 text-amber-200 font-bold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Users className="w-4 h-4 text-amber-400" />
                <span>Serveur En Ligne</span>
                <span className="font-mono-numbers text-xs text-amber-400">
                  ({directory.onlineCount || 1})
                </span>
              </button>
            </div>
          </div>

          {/* Slim Inline Room Code Join Bar */}
          <form
            onSubmit={handleJoinRoom}
            className="bg-[#0E131D]/90 border border-white/10 rounded-2xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
          >
            <div className="flex-1 flex items-center gap-2.5 px-1">
              <Users className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="text-xs leading-tight">
                <div className="font-semibold text-white">Rejoindre un salon</div>
                <div className="text-[11px] text-slate-400 font-mono-numbers">
                  {wsConnected ? 'Serveur en ligne' : 'Connexion...'} · {openPublicRoomsCount} salon{openPublicRoomsCount > 1 ? 's' : ''}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="title-room-code" className="sr-only">
                Code de salon multijoueur
              </label>
              <input
                id="title-room-code"
                type="text"
                placeholder="APEX-4829"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(normalizeRoomCode(e.target.value))}
                className="w-32 sm:w-36 bg-[#07090F] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono uppercase tracking-wider text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Rejoindre le salon"
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-cyan-400 hover:text-slate-950 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
              >
                <span>Rejoindre</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </section>

        {/* Right Hero Column: Interactive 3D Globe Centerpiece */}
        <section className="hidden lg:flex lg:col-span-5 flex-col items-center justify-center h-[470px] relative">
          <div className="w-full h-full max-w-[470px] max-h-[470px]">
            <EarthGlobe interactive={true} className="w-full h-full" />
          </div>
          <p className="text-[11px] font-mono text-slate-400 mt-1">
            Glissez le globe 3D pour explorer · 80+ destinations mondiales
          </p>
        </section>
      </main>

      {/* Bottom Minimalist Control Line */}
      <footer className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 py-3 mt-4 lg:mt-0 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 border-t border-white/10 shrink-0">
        <span>Entrée : Lancer · ZQSD / Flèches : Naviguer · Clic carte : Planter un drapeau</span>
        <span>Studio Maldecena Soeiro · GeoApex</span>
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
        onStartGame={(roomId, mode, region) => {
          setShowMultiplayerModal(false);
          onStartGame(mode, BOT_OPPONENTS[0], roomId, region);
        }}
      />
    </div>
  );
}
