import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Swords,
  Copy,
  Check,
  X,
  Play,
  Zap,
  Globe2,
  Lock,
  Search,
  RefreshCw,
  Send,
  Crown,
  MessageSquare,
  Wifi,
  WifiOff,
  Trophy,
  Flame,
} from 'lucide-react';
import {
  multiplayerClient,
  MultiplayerRoomState,
  MultiplayerMode,
  MapRegionFilter,
  PublicRoomSummary,
  ChatMessage,
} from '../game/multiplayerClient';
import {
  normalizeRoomCode,
  generateReadableRoomCode,
  filterPublicRooms,
  canStartMultiplayerMatch,
} from '../game/lobbyRules';
import { sound } from '../utils/audio';

interface MultiplayerLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartGame: (roomId: string, mode: MultiplayerMode, region: MapRegionFilter) => void;
  defaultRoomCode?: string;
}

const AVATARS = ['👑', '⚡', '🥷', '🦊', '🚀', '🧭', '🌍', '🔥', '🏆', '🎯'];

const MODE_LABELS: Record<MultiplayerMode, string> = {
  duel: 'Duel 6000 PV',
  classic: 'Classique 5M',
  blitz: 'Blitz 30s',
};

const REGION_LABELS: Record<MapRegionFilter, string> = {
  world: 'Monde',
  france: 'France',
  capitals: 'Capitales',
  rural: 'Campagnes',
};

export function MultiplayerLobbyModal({
  isOpen,
  onClose,
  onStartGame,
  defaultRoomCode = '',
}: MultiplayerLobbyModalProps) {
  const [playerName, setPlayerName] = useState(() => {
    try {
      const stored = localStorage.getItem('geoapex_auth_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.displayName) return parsed.displayName;
      }
    } catch {}
    return localStorage.getItem('geoapex_player_name') || `Explorateur_${Math.floor(100 + Math.random() * 900)}`;
  });
  const [selectedAvatar, setSelectedAvatar] = useState('👑');

  // Create / Join room state
  const [selectedMode, setSelectedMode] = useState<MultiplayerMode>('duel');
  const [selectedRegion, setSelectedRegion] = useState<MapRegionFilter>('world');
  const [isPublicRoom, setIsPublicRoom] = useState(true);
  const [roomNameInput, setRoomNameInput] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState(defaultRoomCode || '');

  // Server directory & socket status
  const [directoryRooms, setDirectoryRooms] = useState<PublicRoomSummary[]>(multiplayerClient.directory.rooms);
  const [onlineCount, setOnlineCount] = useState<number>(multiplayerClient.directory.onlineCount);
  const [wsConnected, setWsConnected] = useState<boolean>(multiplayerClient.isConnected);
  const [latencyMs, setLatencyMs] = useState<number | null>(multiplayerClient.latencyMs);
  const [searchQuery, setSearchQuery] = useState('');

  // Active lobby state
  const [isInRoom, setIsInRoom] = useState(false);
  const [roomState, setRoomState] = useState<MultiplayerRoomState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'info' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (defaultRoomCode) {
      setRoomCodeInput(normalizeRoomCode(defaultRoomCode));
    }
  }, [defaultRoomCode]);

  const onStartGameRef = useRef(onStartGame);
  onStartGameRef.current = onStartGame;

  useEffect(() => {
    if (!isOpen) return;

    multiplayerClient.connect();
    multiplayerClient.refreshRooms();

    const unbindDir = multiplayerClient.on('ROOMS_LIST', (snap: { rooms: PublicRoomSummary[]; onlineCount: number }) => {
      if (snap) {
        setDirectoryRooms(snap.rooms || []);
        setOnlineCount(snap.onlineCount || 0);
      }
    });

    const unbindConn = multiplayerClient.on('connection_status', (st: { connected: boolean }) => {
      setWsConnected(!!st?.connected);
    });

    const unbindLatency = multiplayerClient.on('LATENCY_UPDATE', (d: { latencyMs: number }) => {
      setLatencyMs(d.latencyMs);
    });

    const unbindState = multiplayerClient.on('ROOM_STATE', (state: MultiplayerRoomState) => {
      setRoomState(state);
      setIsInRoom(true);
      setChatMessages(state.chatHistory || []);
      setStatusMessage((prev) => (prev?.type === 'info' ? null : prev));
    });

    // Only transition into active gameplay when authoritative ROUND_START arrives
    const unbindRoundStart = multiplayerClient.on('ROUND_START', () => {
      const st = multiplayerClient.state;
      onStartGameRef.current(st?.roomId || 'LIVE', st?.mode || 'duel', st?.region || 'world');
    });

    const unbindChat = multiplayerClient.on('CHAT_MESSAGE', (msg: ChatMessage) => {
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev.slice(-49), msg];
      });
    });

    const unbindError = multiplayerClient.on('ROOM_ERROR', (err: { message: string }) => {
      setStatusMessage({ type: 'error', text: err.message });
      sound.playDamage();
    });

    const unbindDisconnect = multiplayerClient.on('OPPONENT_DISCONNECTED', (data: { message: string }) => {
      setStatusMessage({ type: 'info', text: data.message });
    });

    return () => {
      unbindDir();
      unbindConn();
      unbindLatency();
      unbindState();
      unbindRoundStart();
      unbindChat();
      unbindError();
      unbindDisconnect();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const cleanPlayerName = playerName.trim() || 'Explorateur';

  const handleQuickMatch = () => {
    sound.playClick();
    localStorage.setItem('geoapex_player_name', cleanPlayerName);
    setStatusMessage({ type: 'info', text: 'Recherche ou création d’un salon public en ligne...' });
    multiplayerClient.quickMatch(cleanPlayerName, selectedAvatar, selectedMode, selectedRegion);
  };

  const handleCreateRoom = () => {
    const code = normalizeRoomCode(roomCodeInput) || generateReadableRoomCode();
    setRoomCodeInput(code);
    sound.playClick();
    localStorage.setItem('geoapex_player_name', cleanPlayerName);
    setStatusMessage({ type: 'info', text: `Création du salon ${code}...` });
    multiplayerClient.joinRoom(code, cleanPlayerName, selectedAvatar, {
      roomName: roomNameInput.trim() || undefined,
      mode: selectedMode,
      region: selectedRegion,
      isPublic: isPublicRoom,
    });
  };

  const handleJoinByCode = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = normalizeRoomCode(roomCodeInput);
    if (!code) {
      setStatusMessage({ type: 'error', text: 'Veuillez saisir un code de salon valide.' });
      return;
    }
    sound.playClick();
    localStorage.setItem('geoapex_player_name', cleanPlayerName);
    setStatusMessage({ type: 'info', text: `Connexion au salon ${code}...` });
    multiplayerClient.joinRoom(code, cleanPlayerName, selectedAvatar);
  };

  const handleJoinDirectoryRoom = (room: PublicRoomSummary) => {
    sound.playClick();
    localStorage.setItem('geoapex_player_name', cleanPlayerName);
    setStatusMessage({ type: 'info', text: `Connexion à ${room.name} (${room.id})...` });
    multiplayerClient.joinRoom(room.id, cleanPlayerName, selectedAvatar, {
      mode: room.mode,
      region: room.region,
      isPublic: true,
    });
  };

  const handleToggleReady = () => {
    sound.playClick();
    if (!roomState) return;
    const me = roomState.players.find((p) => p.id === roomState.playerId);
    multiplayerClient.setReady(!me?.ready);
  };

  const handleHostStart = () => {
    sound.playFanfare();
    multiplayerClient.startGame();
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sound.playClick();
    multiplayerClient.sendChat(chatInput);
    setChatInput('');
  };

  const handleLeaveRoom = () => {
    sound.playClick();
    multiplayerClient.leaveRoom();
    setIsInRoom(false);
    setRoomState(null);
    setChatMessages([]);
    setStatusMessage(null);
    multiplayerClient.refreshRooms();
  };

  const handleCopyLink = () => {
    if (!roomState) return;
    sound.playClick();
    const url = `${window.location.origin}?room=${roomState.roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyRoomCode = () => {
    if (!roomState) return;
    sound.playClick();
    navigator.clipboard.writeText(roomState.roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const me = roomState?.players.find((p) => p.id === roomState.playerId);
  const opponent = roomState?.players.find((p) => p.id !== roomState.playerId);
  const isHost = !!roomState?.isHost;
  const hostStartGuard = canStartMultiplayerMatch(roomState?.players.length ?? 0, isHost);
  const visibleRooms = filterPublicRooms(directoryRooms, searchQuery);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#07090F]/90">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="multiplayer-server-title"
        className="relative w-full max-w-4xl bg-[#0E131D] border border-white/12 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Top Server Bar */}
        <div className="px-6 py-4 bg-[#07090F] border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-400">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <h2 id="multiplayer-server-title" className="font-display text-lg font-extrabold text-white">
                Serveur Multijoueur En Ligne
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono-numbers">
                <span className={`inline-flex items-center gap-1 ${wsConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {wsConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                  <span>{wsConnected ? 'WebSocket Connecté' : 'Reconnexion...'}</span>
                </span>
                {latencyMs !== null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{latencyMs} ms</span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span>{onlineCount} en ligne</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-label="Fermer le serveur multijoueur"
            onClick={() => {
              sound.playClick();
              if (isInRoom) handleLeaveRoom();
              onClose();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {statusMessage && (
            <div
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold border ${
                statusMessage.type === 'error'
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                  : 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200'
              }`}
            >
              {statusMessage.text}
            </div>
          )}

          {!isInRoom ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Identity + Create/QuickMatch */}
              <div className="lg:col-span-5 space-y-4">
                {/* Identity Box */}
                <div className="bg-[#07090F] border border-white/10 rounded-xl p-4 space-y-3">
                  <div>
                    <label htmlFor="mp-player-name" className="text-xs font-bold text-slate-200 block mb-1.5">
                      Votre Pseudo en Ligne
                    </label>
                    <input
                      id="mp-player-name"
                      type="text"
                      value={playerName}
                      maxLength={20}
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder="Entrez votre pseudo..."
                      className="w-full bg-[#0E131D] border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-slate-400 block mb-1.5">Avatar</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {AVATARS.map((av) => (
                        <button
                          key={av}
                          type="button"
                          onClick={() => {
                            sound.playClick();
                            setSelectedAvatar(av);
                          }}
                          className={`w-9 h-9 rounded-lg flex items-center justify-center text-base transition-colors cursor-pointer ${
                            selectedAvatar === av
                              ? 'bg-cyan-400/20 border border-cyan-400 text-white'
                              : 'bg-[#0E131D] border border-white/10 hover:border-white/25'
                          }`}
                        >
                          {av}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Room Creation & Mode Config */}
                <div className="bg-[#07090F] border border-white/10 rounded-xl p-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Paramètres du Salon</span>
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setIsPublicRoom(!isPublicRoom);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                        isPublicRoom
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                      }`}
                    >
                      {isPublicRoom ? <Globe2 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      <span>{isPublicRoom ? 'Salon Public' : 'Salon Privé'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {(['duel', 'classic', 'blitz'] as MultiplayerMode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          setSelectedMode(m);
                        }}
                        className={`py-2 px-2 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-1 ${
                          selectedMode === m
                            ? 'bg-cyan-400 text-slate-950 border-cyan-400'
                            : 'bg-[#0E131D] text-slate-300 border-white/10 hover:border-white/25'
                        }`}
                      >
                        {m === 'duel' && <Swords className="w-3 h-3" />}
                        {m === 'classic' && <Trophy className="w-3 h-3" />}
                        {m === 'blitz' && <Flame className="w-3 h-3" />}
                        <span>{MODE_LABELS[m]}</span>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {(['world', 'france', 'capitals', 'rural'] as MapRegionFilter[]).map((reg) => (
                      <button
                        key={reg}
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          setSelectedRegion(reg);
                        }}
                        className={`py-1.5 px-2.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                          selectedRegion === reg
                            ? 'bg-white/15 text-white border-cyan-400/60'
                            : 'bg-[#0E131D] text-slate-400 border-white/10 hover:text-white'
                        }`}
                      >
                        {REGION_LABELS[reg]}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label htmlFor="mp-room-name" className="sr-only">
                      Nom du salon
                    </label>
                    <input
                      id="mp-room-name"
                      type="text"
                      maxLength={30}
                      value={roomNameInput}
                      onChange={(e) => setRoomNameInput(e.target.value)}
                      placeholder="Nom du salon (optionnel, ex: Tournoi France)"
                      className="w-full bg-[#0E131D] border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleQuickMatch}
                      className="py-2.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Partie Rapide</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCreateRoom}
                      className="py-2.5 px-4 rounded-xl bg-[#141C2B] hover:bg-[#1B263B] border border-amber-400/40 text-amber-200 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Créer un Salon</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Public Directory & Code Join */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                {/* Join by Code */}
                <form onSubmit={handleJoinByCode} className="bg-[#07090F] border border-white/10 rounded-xl p-4 space-y-2.5">
                  <label htmlFor="mp-join-code" className="text-xs font-bold text-white block">
                    Rejoindre avec un Code Salon
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="mp-join-code"
                      type="text"
                      value={roomCodeInput}
                      onChange={(e) => setRoomCodeInput(normalizeRoomCode(e.target.value))}
                      placeholder="Ex: APEX-4829"
                      className="flex-1 bg-[#0E131D] border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white font-mono uppercase tracking-wider placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-cyan-400 hover:text-slate-950 text-white font-bold text-xs transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Rejoindre
                    </button>
                  </div>
                </form>

                {/* Live Public Rooms Directory */}
                <div className="bg-[#07090F] border border-white/10 rounded-xl p-4 flex-1 flex flex-col gap-3 min-h-[260px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Globe2 className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-bold text-white">
                        Salons Publics Ouverts ({visibleRooms.length})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Filtrer code ou hôte..."
                          className="w-44 bg-[#0E131D] border border-white/10 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        aria-label="Actualiser la liste des salons"
                        onClick={() => {
                          sound.playClick();
                          multiplayerClient.refreshRooms();
                        }}
                        className="p-1.5 rounded-lg bg-[#0E131D] hover:bg-white/10 border border-white/10 text-slate-300 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {visibleRooms.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-8 px-4 border border-dashed border-white/10 rounded-xl space-y-2">
                      <Users className="w-7 h-7 text-slate-500" />
                      <p className="text-xs font-semibold text-slate-300">
                        Aucun salon public en attente pour le moment
                      </p>
                      <p className="text-[11px] text-slate-500 max-w-sm">
                        Cliquez sur « Partie Rapide » ou « Créer un Salon » pour apparaître immédiatement dans l’annuaire mondial.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                      {visibleRooms.map((room) => {
                        const isFull = room.playerCount >= room.maxPlayers || room.status !== 'lobby';
                        return (
                          <div
                            key={room.id}
                            className="p-3 rounded-xl bg-[#0E131D] border border-white/10 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-lg bg-[#07090F] border border-white/10 flex items-center justify-center text-lg shrink-0">
                                {room.hostAvatar}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-white truncate">{room.name}</div>
                                <div className="text-[11px] text-slate-400 font-mono-numbers flex items-center gap-1.5 flex-wrap">
                                  <span className="text-cyan-400">{room.id}</span>
                                  <span aria-hidden="true">·</span>
                                  <span>{room.hostName}</span>
                                  <span aria-hidden="true">·</span>
                                  <span>{MODE_LABELS[room.mode]}</span>
                                  <span aria-hidden="true">·</span>
                                  <span>{REGION_LABELS[room.region]}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs font-mono-numbers text-slate-300">
                                {room.playerCount}/{room.maxPlayers}
                              </span>
                              <button
                                type="button"
                                disabled={isFull}
                                onClick={() => handleJoinDirectoryRoom(room)}
                                className="px-3.5 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:bg-white/10 disabled:text-slate-500 text-slate-950 font-bold text-xs transition-colors cursor-pointer whitespace-nowrap"
                              >
                                {isFull ? 'En cours' : 'Rejoindre'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Active Room View */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left: Room Info + Players + Start Controls */}
              <div className="lg:col-span-7 space-y-4">
                <div className="p-4 bg-[#07090F] border border-white/10 rounded-xl flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-400 font-semibold">
                      {roomState?.roomName} <span aria-hidden="true">·</span> {MODE_LABELS[roomState?.mode || 'duel']} <span aria-hidden="true">·</span> {REGION_LABELS[roomState?.region || 'world']}
                    </div>
                    <div className="font-mono text-2xl font-bold text-cyan-400 tracking-wider mt-0.5">
                      {roomState?.roomId}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyRoomCode}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0E131D] hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 cursor-pointer"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? 'Code copié' : 'Copier code'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-xs font-semibold text-cyan-200 cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Lien copié' : 'Lien direct'}</span>
                    </button>
                  </div>
                </div>

                {/* Synchronized Countdown Notice */}
                {roomState?.status === 'countdown' && (
                  <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs font-bold text-center">
                    Les 2 joueurs sont connectés — Synchronisation de la première manche...
                  </div>
                )}

                {/* 2 Players Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Me */}
                  <div className="p-4 bg-[#07090F] border border-cyan-400/35 rounded-xl flex flex-col items-center text-center gap-2">
                    <div className="w-14 h-14 rounded-xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-2xl">
                      {me?.avatar || '👑'}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white flex items-center justify-center gap-1">
                        <span>{me?.name}</span>
                        {me?.isHost && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                      <span className={`text-xs font-semibold ${me?.ready ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {me?.ready ? 'Prêt' : 'En attente'}
                      </span>
                    </div>
                  </div>

                  {/* Opponent */}
                  <div className="p-4 bg-[#07090F] border border-white/10 rounded-xl flex flex-col items-center text-center gap-2">
                    {opponent ? (
                      <>
                        <div className="w-14 h-14 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-2xl">
                          {opponent.avatar || '⚡'}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white flex items-center justify-center gap-1">
                            <span>{opponent.name}</span>
                            {opponent.isHost && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                          </div>
                          <span className={`text-xs font-semibold ${opponent.ready ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {opponent.ready ? 'Prêt' : 'En attente'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center py-2 gap-1.5">
                        <Users className="w-6 h-6 text-slate-500" />
                        <span className="text-xs font-semibold text-slate-300">Place libre (1/2)</span>
                        <span className="text-[11px] text-slate-500">Partagez le code {roomState?.roomId}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleToggleReady}
                    className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs border transition-colors cursor-pointer ${
                      me?.ready
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    }`}
                  >
                    {me?.ready ? 'Vous êtes prêt (cliquer pour annuler)' : 'Confirmer que vous êtes prêt'}
                  </button>

                  {isHost && (
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={handleHostStart}
                        disabled={!hostStartGuard.ok || roomState?.status === 'countdown'}
                        className="w-full py-3 px-5 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:bg-white/10 disabled:text-slate-500 text-slate-950 font-extrabold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>
                          {opponent ? 'Lancer la Partie (2/2)' : 'En attente d’un 2e joueur (1/2)'}
                        </span>
                      </button>
                      {!hostStartGuard.ok && (
                        <p className="text-[11px] text-slate-400 text-center">{hostStartGuard.reason}</p>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleLeaveRoom}
                    className="w-full py-2 px-4 rounded-xl bg-[#07090F] hover:bg-white/5 border border-white/10 text-slate-400 hover:text-white font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Quitter le salon
                  </button>
                </div>
              </div>

              {/* Right: Live Lobby Chat */}
              <div className="lg:col-span-5 bg-[#07090F] border border-white/10 rounded-xl p-4 flex flex-col h-[340px]">
                <div className="flex items-center gap-2 pb-2.5 border-b border-white/10 text-xs font-bold text-white">
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  <span>Discussion du Salon</span>
                </div>

                <div className="flex-1 overflow-y-auto py-3 space-y-2.5 text-xs">
                  {chatMessages.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">Aucun message pour l’instant.</p>
                  ) : (
                    chatMessages.map((msg) => (
                      <div key={msg.id} className="leading-snug">
                        <span className="font-bold text-cyan-300">
                          {msg.senderAvatar} {msg.senderName} :{' '}
                        </span>
                        <span className="text-slate-200">{msg.text}</span>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleSendChat} className="pt-2 border-t border-white/10 flex gap-2">
                  <label htmlFor="mp-chat-input" className="sr-only">
                    Message dans le chat du salon
                  </label>
                  <input
                    id="mp-chat-input"
                    type="text"
                    value={chatInput}
                    maxLength={200}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Écrire un message..."
                    className="flex-1 bg-[#0E131D] border border-white/15 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    aria-label="Envoyer le message"
                    className="px-3 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
