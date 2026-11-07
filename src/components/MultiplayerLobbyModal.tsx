import React, { useState, useEffect } from 'react';
import {
  Users,
  Swords,
  Copy,
  Check,
  Sparkles,
  X,
  Play,
  Zap,
  Radio,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { multiplayerClient, MultiplayerRoomState } from '../game/multiplayerClient';
import { sound } from '../utils/audio';

interface MultiplayerLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartGame: (roomId: string) => void;
  defaultRoomCode?: string;
}

const AVATARS = ['👑', '⚡', '🥷', '🦊', '🚀', '🧭', '🎒', '🌍', '🔥', '🏆'];

export function MultiplayerLobbyModal({
  isOpen,
  onClose,
  onStartGame,
  defaultRoomCode = '',
}: MultiplayerLobbyModalProps) {
  const [tab, setTab] = useState<'quick' | 'custom'>('quick');
  const [roomCode, setRoomCode] = useState(defaultRoomCode || '');
  const [playerName, setPlayerName] = useState(() => {
    return localStorage.getItem('geoapex_player_name') || `Explorateur_${Math.floor(100 + Math.random() * 900)}`;
  });
  const [selectedAvatar, setSelectedAvatar] = useState('👑');
  const [isInRoom, setIsInRoom] = useState(false);
  const [roomState, setRoomState] = useState<MultiplayerRoomState | null>(null);
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Sync state from multiplayerClient
  useEffect(() => {
    if (!isOpen) return;

    const unbindState = multiplayerClient.on('ROOM_STATE', (state: MultiplayerRoomState) => {
      setRoomState(state);
      setIsInRoom(true);
      if (state.status === 'playing' || state.status === 'countdown') {
        onStartGame(state.roomId);
      }
    });

    const unbindError = multiplayerClient.on('ROOM_ERROR', (err: { message: string }) => {
      setStatusMessage(err.message);
      sound.playDamage();
    });

    const unbindDisconnect = multiplayerClient.on('OPPONENT_DISCONNECTED', (data: { message: string }) => {
      setStatusMessage(data.message);
    });

    return () => {
      unbindState();
      unbindError();
      unbindDisconnect();
    };
  }, [isOpen, onStartGame]);

  if (!isOpen) return null;

  const handleQuickMatch = () => {
    sound.playClick();
    localStorage.setItem('geoapex_player_name', playerName);
    setStatusMessage('Recherche d’un adversaire en ligne...');
    multiplayerClient.quickMatch(playerName, selectedAvatar);
  };

  const handleJoinCustomRoom = () => {
    const code = roomCode.trim().toUpperCase();
    if (!code) return;
    sound.playClick();
    localStorage.setItem('geoapex_player_name', playerName);
    setStatusMessage(`Connexion au salon ${code}...`);
    multiplayerClient.joinRoom(code, playerName, selectedAvatar);
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

  const handleLeaveRoom = () => {
    sound.playClick();
    multiplayerClient.leaveRoom();
    setIsInRoom(false);
    setRoomState(null);
    setStatusMessage(null);
  };

  const handleCopyLink = () => {
    if (!roomState) return;
    sound.playClick();
    const url = `${window.location.origin}?room=${roomState.roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const me = roomState?.players.find((p) => p.id === roomState.playerId);
  const opponent = roomState?.players.find((p) => p.id !== roomState.playerId);
  const isHost = roomState?.isHost;
  const canHostStart = isHost && roomState?.players.length === 2 && roomState.players.every((p) => p.ready);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-cyan-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <span>Multijoueur En Ligne (Serveur)</span>
                <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                  <Radio className="w-3 h-3 animate-pulse" />
                  <span>Serveur Live</span>
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Duels 1v1 en temps réel synchronisés par WebSocket
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              if (isInRoom) handleLeaveRoom();
              onClose();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {!isInRoom ? (
            <>
              {/* Tab Selector: Quick Match vs Private Room */}
              <div className="grid grid-cols-2 gap-2 bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700/60">
                <button
                  onClick={() => {
                    sound.playClick();
                    setTab('quick');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    tab === 'quick'
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Partie Rapide</span>
                </button>

                <button
                  onClick={() => {
                    sound.playClick();
                    setTab('custom');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    tab === 'custom'
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Salon Privé</span>
                </button>
              </div>

              {/* Player Identity Setup */}
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-4 space-y-3">
                <label className="text-xs font-bold text-slate-300 block">Votre Pseudo</label>
                <input
                  type="text"
                  value={playerName}
                  maxLength={20}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Entrez votre pseudo..."
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                />

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">Choisissez votre Avatar</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {AVATARS.map((av) => (
                      <button
                        key={av}
                        onClick={() => {
                          sound.playClick();
                          setSelectedAvatar(av);
                        }}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all cursor-pointer ${
                          selectedAvatar === av
                            ? 'bg-cyan-500/30 border-2 border-cyan-400 scale-110 shadow-lg shadow-cyan-500/20'
                            : 'bg-slate-800 border border-slate-700/60 hover:bg-slate-700'
                        }`}
                      >
                        {av}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action based on Tab */}
              {tab === 'quick' ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/40 to-blue-950/40 border border-cyan-500/30 text-xs text-slate-300 space-y-1">
                    <span className="font-bold text-cyan-300 block">⚡ Matchmaking Instantané</span>
                    <p className="leading-relaxed">
                      Le serveur vous connecte immédiatement avec le premier joueur disponible dans le monde entier, ou ouvre un nouveau salon en attente d'un challenger !
                    </p>
                  </div>

                  <button
                    onClick={handleQuickMatch}
                    className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 text-white font-black text-sm tracking-wide shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>TROUVER UNE PARTIE RAPIDE</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-300 block">Code de Salon</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      placeholder="Ex: APEX-99 ou PARIS"
                      className="flex-1 bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono uppercase tracking-wider placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      onClick={() => setRoomCode(`APEX-${Math.floor(1000 + Math.random() * 9000)}`)}
                      className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
                    >
                      Aléatoire
                    </button>
                  </div>

                  <button
                    onClick={handleJoinCustomRoom}
                    disabled={!roomCode.trim()}
                    className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 disabled:opacity-50 text-white font-black text-sm tracking-wide shadow-lg shadow-purple-600/25 hover:shadow-purple-600/40 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Users className="w-4 h-4" />
                    <span>REJOINDRE / CRÉER CE SALON</span>
                  </button>
                </div>
              )}

              {statusMessage && (
                <div className="text-xs text-center text-cyan-300 animate-pulse font-medium">
                  {statusMessage}
                </div>
              )}
            </>
          ) : (
            /* Active Lobby Screen: 2 Players Slot View */
            <div className="space-y-5">
              {/* Room Code & Share Banner */}
              <div className="flex items-center justify-between p-3.5 bg-slate-800/80 border border-cyan-500/30 rounded-2xl">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Code du Salon
                  </span>
                  <span className="font-mono text-xl font-black text-cyan-400">
                    {roomState?.roomId}
                  </span>
                </div>

                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Lien copié !' : 'Copier le lien'}</span>
                </button>
              </div>

              {/* 2 Players Slots */}
              <div className="grid grid-cols-2 gap-3">
                {/* Player 1 (Host) */}
                <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-2xl flex flex-col items-center text-center space-y-2">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border-2 border-cyan-400/60 flex items-center justify-center text-3xl">
                      {me?.avatar || '👑'}
                    </div>
                    {me?.isHost && (
                      <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-900 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                        HÔTE
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white block">{me?.name} (Vous)</span>
                    <span className={`text-[11px] font-bold ${me?.ready ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {me?.ready ? '✓ Prêt pour le duel' : 'En attente...'}
                    </span>
                  </div>
                </div>

                {/* Player 2 (Opponent or Waiting) */}
                <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-2xl flex flex-col items-center text-center space-y-2">
                  {opponent ? (
                    <>
                      <div className="relative">
                        <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border-2 border-purple-400/60 flex items-center justify-center text-3xl">
                          {opponent.avatar || '⚡'}
                        </div>
                        {opponent.isHost && (
                          <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-900 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                            HÔTE
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-sm font-bold text-white block">{opponent.name}</span>
                        <span className={`text-[11px] font-bold ${opponent.ready ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {opponent.ready ? '✓ Prêt pour le duel' : 'En attente...'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center py-4 space-y-2">
                      <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center text-slate-500 animate-pulse">
                        <Users className="w-5 h-5" />
                      </div>
                      <span className="text-xs text-slate-400 font-medium">En attente d'un adversaire...</span>
                      <span className="text-[10px] text-slate-500">Partagez le code du salon</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Ready / Start Buttons */}
              <div className="space-y-2.5 pt-2">
                <button
                  onClick={handleToggleReady}
                  className={`w-full py-3 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                    me?.ready
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30'
                      : 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30'
                  }`}
                >
                  {me?.ready ? '✓ Vous êtes prêt ! (Cliquer pour annuler)' : 'Confirmer que vous êtes prêt'}
                </button>

                {isHost && (
                  <button
                    onClick={handleHostStart}
                    disabled={!canHostStart}
                    className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 disabled:opacity-40 text-white font-black text-sm tracking-wide shadow-lg shadow-cyan-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>LANCER LE DUEL EN LIGNE</span>
                  </button>
                )}

                <button
                  onClick={handleLeaveRoom}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  Quitter le salon
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
