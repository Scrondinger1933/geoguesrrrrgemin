import React, { useState, useEffect } from 'react';
import {
  Trophy,
  RotateCcw,
  Home,
  Swords,
  Compass,
  Flame,
  Mail,
  Send,
  CheckCircle2,
  Music,
  Pause,
  Play,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Globe,
} from 'lucide-react';
import { GameMode, OpponentProfile } from '../game/multiplayer';
import { getRankTier } from '../game/rules';
import { sound } from '../utils/audio';

interface GameOverModalProps {
  mode: GameMode;
  totalScore: number;
  playerHp: number;
  opponentHp: number;
  botOpponent?: OpponentProfile;
  opponentName?: string;
  opponentAvatar?: string;
  roundsCount: number;
  streakCount: number;
  playerEmail?: string;
  initialEmailSent?: boolean;
  initialEmailPreviewUrl?: string;
  isOnlineMultiplayer?: boolean;
  onRematch?: () => void;
  onRestart: () => void;
  onHome: () => void;
}

export function GameOverModal({
  mode,
  totalScore,
  playerHp,
  opponentHp,
  botOpponent,
  opponentName,
  roundsCount,
  streakCount,
  playerEmail,
  initialEmailSent,
  initialEmailPreviewUrl,
  isOnlineMultiplayer = false,
  onRematch,
  onRestart,
  onHome,
}: GameOverModalProps) {
  const isDuelVictory = mode === 'duel' && (opponentHp <= 0 || playerHp > opponentHp);
  const rank = getRankTier(totalScore);

  const [emailInput, setEmailInput] = useState(playerEmail || '');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [deliveredRealInbox, setDeliveredRealInbox] = useState<boolean>(
    Boolean(initialEmailSent && !initialEmailPreviewUrl)
  );
  const [emailSentStatus, setEmailSentStatus] = useState<string | null>(
    initialEmailSent
      ? initialEmailPreviewUrl
        ? `Certificat généré en aperçu Ethereal pour ${playerEmail || 'votre adresse'} (configurez un relais SMTP/API pour boîte réelle).`
        : `E-mail récapitulatif envoyé dans la boîte de ${playerEmail || 'votre adresse'}.`
      : null
  );
  const [summaryPreviewUrl, setSummaryPreviewUrl] = useState<string | null>(
    initialEmailPreviewUrl || null
  );
  const [emailError, setEmailError] = useState<string | null>(null);
  const [rematchRequested, setRematchRequested] = useState(false);

  const [isMusicPlaying, setIsMusicPlaying] = useState(sound.isMusicPlaying);

  useEffect(() => {
    const unsub = sound.subscribeMusic((playing) => {
      setIsMusicPlaying(playing);
    });
    return unsub;
  }, []);

  const handleSendSummaryEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setEmailError('Veuillez renseigner une adresse email valide.');
      return;
    }

    setIsSendingEmail(true);
    setEmailError(null);
    sound.playClick();

    try {
      const res = await fetch('/api/scores/send-summary-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          playerName: opponentName ? 'Explorateur' : undefined,
          score: totalScore,
          mode,
          roundsCompleted: roundsCount,
          isVictory: isDuelVictory || totalScore >= 20000,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Échec lors de l'envoi");
      }

      const realInbox = Boolean(data.deliveredToRealInbox);
      setDeliveredRealInbox(realInbox);
      setSummaryPreviewUrl(data.previewUrl || null);

      sound.playFanfare();
      if (realInbox) {
        setEmailSentStatus(
          `Récapitulatif officiel transmis directement dans la boîte de ${cleanEmail}.`
        );
      } else {
        setEmailSentStatus(
          `Aperçu généré via Ethereal (${cleanEmail}). Configurez un relais Gmail/Brevo/Resend dans Messagerie & SMTP pour l'envoi en boîte réelle.`
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'envoi par e-mail.";
      setEmailError(message);
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#07090F]/95 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#0E131D] border border-white/12 rounded-2xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center my-auto">
        {/* Badge */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 border border-amber-300/40 mb-4">
          {mode === 'duel' ? (
            isDuelVictory ? (
              <Trophy className="w-8 h-8 text-[#07090F]" />
            ) : (
              <Swords className="w-8 h-8 text-[#07090F]" />
            )
          ) : mode === 'streak' ? (
            <Compass className="w-8 h-8 text-[#07090F]" />
          ) : (
            <Flame className="w-8 h-8 text-[#07090F]" />
          )}
        </div>

        {/* Title */}
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight mb-2">
          {mode === 'duel'
            ? isDuelVictory
              ? 'VICTOIRE DU DUEL'
              : 'FIN DU DUEL'
            : mode === 'streak'
            ? 'FIN DE LA SÉRIE'
            : 'FIN DE LA PARTIE'}
        </h2>

        <p className="text-sm text-slate-400 mb-5">
          {mode === 'duel'
            ? isDuelVictory
              ? `Vous avez pris l'avantage sur ${opponentName || botOpponent?.name || 'votre adversaire'}.`
              : `${opponentName || botOpponent?.name || 'Votre adversaire'} l'emporte sur cette manche.`
            : mode === 'streak'
            ? `${streakCount} pays consécutifs identifiés sans erreur.`
            : `Expédition de ${roundsCount} manches terminée.`}
        </p>

        {/* Score & Rank Card */}
        <div className="w-full bg-[#141C2B] border border-white/10 rounded-xl p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
              Score Total
            </span>
            <span className="text-2xl font-display font-bold text-amber-400 font-mono-numbers">
              {totalScore.toLocaleString('fr-FR')} <span className="text-xs text-amber-300">pts</span>
            </span>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
              Rang Obtenu
            </span>
            <div className="flex items-center gap-1.5">
              <span>{rank.badge}</span>
              <span className={`text-xs font-bold bg-gradient-to-r ${rank.color} bg-clip-text text-transparent`}>
                {rank.title}
              </span>
            </div>
          </div>
        </div>

        {/* Email Summary Section */}
        <div className="w-full bg-[#141C2B] border border-cyan-400/25 rounded-xl p-4 mb-4 text-left space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-cyan-400" />
              <span>Récapitulatif par E-mail</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-400/25 font-mono-numbers">
              {deliveredRealInbox ? 'Boîte Réelle' : 'Certificat'}
            </span>
          </div>

          {emailSentStatus ? (
            <div className="space-y-2">
              <div
                className={`p-2.5 rounded-xl text-xs flex items-start gap-2 border ${
                  deliveredRealInbox
                    ? 'bg-emerald-500/10 border-emerald-400/35 text-emerald-200'
                    : 'bg-amber-500/10 border-amber-400/35 text-amber-200'
                }`}
              >
                {deliveredRealInbox ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                )}
                <span className="leading-snug">{emailSentStatus}</span>
              </div>
              {summaryPreviewUrl && (
                <a
                  href={summaryPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Ouvrir l’aperçu du certificat</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          ) : (
            <form onSubmit={handleSendSummaryEmail} className="space-y-2">
              <p className="text-[11px] text-slate-400">
                Recevez votre certificat de score et le détail de vos manches par e-mail :
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  required
                  placeholder="votre.email@gmail.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-[#07090F] border border-white/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="submit"
                  disabled={isSendingEmail}
                  className="px-3.5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-[#07090F] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isSendingEmail ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Envoyer</span>
                </button>
              </div>
              {emailError && <p className="text-[11px] text-rose-400">{emailError}</p>}
            </form>
          )}
        </div>

        {/* Music Bar */}
        <div className="w-full flex items-center justify-between px-3 py-2 bg-[#141C2B] border border-white/10 rounded-xl mb-5 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Music className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px]">
              Bande sonore : <strong className="text-amber-300">Across the Meridian</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => sound.toggleMusic()}
            className="flex items-center gap-1 text-[11px] font-bold text-slate-200 hover:text-white px-2.5 py-1 rounded-lg bg-[#07090F] border border-white/10 hover:border-cyan-400/40 transition-colors cursor-pointer"
          >
            {isMusicPlaying ? (
              <>
                <Pause className="w-3 h-3 text-amber-400" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 text-cyan-400" />
                <span>Lecture</span>
              </>
            )}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 w-full">
          {isOnlineMultiplayer && onRematch ? (
            <button
              type="button"
              disabled={rematchRequested}
              onClick={() => {
                sound.playClick();
                setRematchRequested(true);
                onRematch();
              }}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:bg-slate-700 disabled:text-slate-300 text-[#07090F] font-display font-bold text-sm tracking-wide shadow-lg shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Globe className="w-4 h-4" />
              <span>{rematchRequested ? 'En attente de l’adversaire...' : 'Revanche En Ligne'}</span>
            </button>
          ) : (
            <button
              type="button"
              data-start="true"
              onClick={() => {
                sound.playClick();
                onRestart();
              }}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#07090F] font-display font-bold text-sm tracking-wide shadow-lg shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Rejouer</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onHome();
            }}
            className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-[#141C2B] hover:bg-[#1B2538] text-slate-200 hover:text-white font-bold text-sm border border-white/12 active:scale-95 transition-all cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Accueil</span>
          </button>
        </div>
      </div>
    </div>
  );
}
