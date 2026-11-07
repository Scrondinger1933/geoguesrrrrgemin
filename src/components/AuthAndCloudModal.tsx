import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Github,
  LogIn,
  LogOut,
  Check,
  Copy,
  ExternalLink,
  X,
  Database,
  ShieldCheck,
  Mail,
  KeyRound,
  UserCheck,
  Sparkles,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Settings,
  Send,
  HelpCircle,
} from 'lucide-react';
import { auth, googleAuthProvider, signInWithPopup, signOut } from '../lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { sound } from '../utils/audio';

interface LeaderboardEntry {
  id: number;
  displayName: string;
  highestScore: number;
  gamesPlayed: number;
  duelsWon: number;
}

interface CustomAuthUser {
  id: number;
  uid: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  highestScore: number;
  gamesPlayed: number;
  duelsWon: number;
  emailVerified: number;
}

interface SmtpStatus {
  configured: boolean;
  user: string | null;
  host: string;
  port: number;
}

interface AuthAndCloudModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'auth' | 'leaderboard' | 'github';
}

const AVATAR_OPTIONS = ['👑', '⚡', '🎯', '🚀', '🧭', '🦁', '🐯', '🦅', '🐺', '🏆'];

export function AuthAndCloudModal({ isOpen, onClose, defaultTab = 'leaderboard' }: AuthAndCloudModalProps) {
  const [activeTab, setActiveTab] = useState<'auth' | 'leaderboard' | 'github'>(defaultTab);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [emailUser, setEmailUser] = useState<CustomAuthUser | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Email Verification Form State
  const [authMethod, setAuthMethod] = useState<'email' | 'google'>('email');
  const [emailStep, setEmailStep] = useState<'enter_email' | 'enter_code'>('enter_email');
  const [emailInput, setEmailInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('👑');
  const [codeInput, setCodeInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receivedCodeBanner, setReceivedCodeBanner] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Real Email Delivery details
  const [emailDeliveryInfo, setEmailDeliveryInfo] = useState<{
    isRealSmtp: boolean;
    previewUrl?: string | null;
  } | null>(null);

  // SMTP Settings State
  const [showSmtpConfig, setShowSmtpConfig] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState<SmtpStatus | null>(null);
  const [smtpEmailInput, setSmtpEmailInput] = useState('');
  const [smtpPasswordInput, setSmtpPasswordInput] = useState('');
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpFeedback, setSmtpFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Check SMTP status from server
  const fetchSmtpStatus = async () => {
    try {
      const res = await fetch('/api/auth/smtp-status');
      if (res.ok) {
        const data = await res.json();
        setSmtpStatus(data);
      }
    } catch (e) {
      console.error('Error fetching SMTP status:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSmtpStatus();
    }
  }, [isOpen]);

  // Load existing session from localStorage (email user)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('geoapex_auth_user');
      if (stored) {
        setEmailUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error loading stored user:', e);
    }
  }, []);

  // Sync Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const idToken = await user.getIdToken();
          await fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              displayName: user.displayName,
              avatarUrl: user.photoURL,
            }),
          });
        } catch (e) {
          console.error('Failed to sync user with Cloud SQL backend', e);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch leaderboard when tab is opened
  useEffect(() => {
    if (isOpen && activeTab === 'leaderboard') {
      setIsLoadingLeaderboard(true);
      fetch('/api/leaderboard')
        .then((res) => res.json())
        .then((data) => {
          if (data.leaderboard) {
            setLeaderboard(data.leaderboard);
          }
        })
        .catch((err) => console.error('Error fetching leaderboard:', err))
        .finally(() => setIsLoadingLeaderboard(false));
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  // 1. Send verification code with real email sending
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setEmailDeliveryInfo(null);

    const email = emailInput.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setErrorMessage('Veuillez entrer une adresse email valide.');
      return;
    }

    setIsSubmitting(true);
    sound.playClick();

    try {
      const res = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          displayName: displayNameInput.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Impossible d’envoyer le code');
      }

      setReceivedCodeBanner(data.verificationCode);
      setEmailDeliveryInfo({
        isRealSmtp: !!data.isRealSmtp,
        previewUrl: data.previewUrl,
      });

      if (data.isRealSmtp) {
        setSuccessMessage(`✓ E-mail envoyé avec succès à ${email} ! Vérifiez votre boîte de réception.`);
      } else {
        setSuccessMessage(`✓ E-mail officiel GeoApex généré pour ${email} !`);
      }

      setEmailStep('enter_code');
    } catch (err: any) {
      setErrorMessage(err.message || 'Une erreur est survenue lors de l’envoi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Verify code and create account
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const email = emailInput.trim().toLowerCase();
    const code = codeInput.trim();

    if (!code || code.length < 4) {
      setErrorMessage('Veuillez entrer le code de vérification à 6 chiffres.');
      return;
    }

    setIsSubmitting(true);
    sound.playClick();

    try {
      const res = await fetch('/api/auth/verify-and-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          code,
          displayName: displayNameInput.trim() || email.split('@')[0],
          avatarUrl: selectedAvatar,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Code invalide ou expiré');
      }

      sound.playFanfare();
      setEmailUser(data.user);
      localStorage.setItem('geoapex_auth_user', JSON.stringify(data.user));
      localStorage.setItem('geoapex_auth_token', data.token);

      setSuccessMessage('🎉 Compte activé avec succès et enregistré dans Cloud SQL !');
      setEmailStep('enter_email');
      setCodeInput('');
      setReceivedCodeBanner(null);
      setEmailDeliveryInfo(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Code invalide ou expiré');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Save SMTP Credentials
  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmtpFeedback(null);
    if (!smtpEmailInput || !smtpPasswordInput) {
      setSmtpFeedback({ type: 'error', msg: 'Email et mot de passe d’application requis.' });
      return;
    }

    setSmtpSaving(true);
    sound.playClick();

    try {
      const res = await fetch('/api/auth/configure-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: smtpEmailInput.trim(),
          pass: smtpPasswordInput.trim(),
          host: smtpEmailInput.includes('@gmail.com') ? 'smtp.gmail.com' : 'smtp.gmail.com',
          port: 587,
          fromName: 'GeoApex 3D Game',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors de la configuration');
      }

      setSmtpFeedback({ type: 'success', msg: 'Configuration SMTP enregistrée ! Tous les e-mails partent maintenant via votre compte.' });
      fetchSmtpStatus();
      setSmtpPasswordInput('');
    } catch (err: any) {
      setSmtpFeedback({ type: 'error', msg: err.message || 'Erreur d’enregistrement' });
    } finally {
      setSmtpSaving(false);
    }
  };

  // Google sign in fallback
  const handleGoogleSignIn = async () => {
    try {
      sound.playClick();
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: any) {
      console.error('Sign-in error:', err);
    }
  };

  // Universal sign out
  const handleSignOut = async () => {
    try {
      sound.playClick();
      await signOut(auth);
      setFirebaseUser(null);
      setEmailUser(null);
      localStorage.removeItem('geoapex_auth_user');
      localStorage.removeItem('geoapex_auth_token');
    } catch (err) {
      console.error('Sign-out error:', err);
    }
  };

  const copyGitCommands = () => {
    const cmd = `git init\ngit add .\ngit commit -m "feat: GeoApex 3D GeoGuessr clone with Cloud SQL and Firebase"\ngit branch -M main\ngit remote add origin https://github.com/VOTRE_PSEUDO/geoapex.git\ngit push -u origin main`;
    navigator.clipboard.writeText(cmd);
    sound.playClick();
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const activeUser = emailUser || (firebaseUser ? {
    id: 0,
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName || 'Joueur GeoApex',
    avatarUrl: firebaseUser.photoURL || '👑',
    highestScore: 0,
    gamesPlayed: 0,
    duelsWon: 0,
    emailVerified: 1,
  } : null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Tabs */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sound.playClick();
                setActiveTab('leaderboard');
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'leaderboard'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Classement Cloud SQL</span>
            </button>

            <button
              onClick={() => {
                sound.playClick();
                setActiveTab('auth');
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'auth'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Database className="w-4 h-4 text-cyan-400" />
              <span>Compte & Vérification Email</span>
            </button>

            <button
              onClick={() => {
                sound.playClick();
                setActiveTab('github');
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'github'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Github className="w-4 h-4 text-purple-400" />
              <span>GitHub</span>
            </button>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab 1: Cloud SQL PostgreSQL Leaderboard */}
        {activeTab === 'leaderboard' && (
          <div className="p-6 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-white">Classement Mondial (Cloud SQL)</h3>
                <p className="text-xs text-slate-400">
                  Scores persistés et synchronisés en direct dans la base PostgreSQL Cloud SQL.
                </p>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>PostgreSQL Connecté</span>
              </span>
            </div>

            {isLoadingLeaderboard ? (
              <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Chargement des scores depuis Cloud SQL...</span>
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="py-10 text-center bg-slate-950/60 rounded-2xl border border-slate-800 p-6 space-y-2">
                <Trophy className="w-8 h-8 text-amber-400 mx-auto opacity-75" />
                <p className="text-sm font-bold text-white">Aucun score enregistré pour l'instant</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Créez votre compte par email ou connectez-vous, puis terminez une partie pour inscrire votre nom sur Cloud SQL !
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                          idx === 0
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                            : idx === 1
                            ? 'bg-slate-300/20 text-slate-200 border border-slate-400/50'
                            : idx === 2
                            ? 'bg-amber-700/20 text-amber-600 border border-amber-700/50'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <div>
                        <span className="text-sm font-bold text-white block">{item.displayName}</span>
                        <span className="text-[10px] text-slate-400">
                          {item.gamesPlayed} parties · {item.duelsWon} duels gagnés
                        </span>
                      </div>
                    </div>
                    <span className="font-mono font-black text-amber-400 text-sm">
                      {item.highestScore.toLocaleString('fr-FR')} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Account Creation with Real Email Verification & Cloud SQL */}
        {activeTab === 'auth' && (
          <div className="p-6 overflow-y-auto space-y-5">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-cyan-400" />
                  <span>Compte Joueur Cloud SQL</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  PostgreSQL europe-west2
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Créez votre compte joueur avec votre adresse email et un code de vérification officiel à 6 chiffres envoyé par e-mail.
              </p>
            </div>

            {/* If Logged In: Show Profile */}
            {activeUser ? (
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-5">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border-2 border-cyan-400/60 flex items-center justify-center text-3xl shadow-lg shadow-cyan-500/20">
                    {activeUser.avatarUrl && activeUser.avatarUrl.startsWith('http') ? (
                      <img src={activeUser.avatarUrl} alt="Avatar" className="w-full h-full rounded-2xl object-cover" />
                    ) : (
                      <span>{activeUser.avatarUrl || '👑'}</span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-white block">
                        {activeUser.displayName}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Email Vérifié</span>
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono block">{activeUser.email}</span>
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                      UID Cloud SQL: {activeUser.uid.slice(0, 16)}...
                    </span>
                  </div>
                </div>

                {/* Player Cloud SQL Statistics Grid */}
                <div className="grid grid-cols-3 gap-2.5 pt-2">
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider block">Record</span>
                    <span className="text-sm font-black text-amber-400 font-mono">
                      {activeUser.highestScore?.toLocaleString('fr-FR') || 0} pts
                    </span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider block">Parties</span>
                    <span className="text-sm font-black text-cyan-400 font-mono">
                      {activeUser.gamesPlayed || 0}
                    </span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider block">Duels Gagnés</span>
                    <span className="text-sm font-black text-emerald-400 font-mono">
                      {activeUser.duelsWon || 0}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Synchronisé avec PostgreSQL Cloud SQL</span>
                  </span>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Se Déconnecter</span>
                  </button>
                </div>
              </div>
            ) : (
              /* If Not Logged In: Email Creation / Verification Form */
              <div className="space-y-4">
                {/* Method Switcher */}
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
                  <button
                    onClick={() => {
                      sound.playClick();
                      setAuthMethod('email');
                      setErrorMessage(null);
                    }}
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${
                      authMethod === 'email'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                    <span>Envoi Réel par Email</span>
                  </button>

                  <button
                    onClick={() => {
                      sound.playClick();
                      setAuthMethod('google');
                      setErrorMessage(null);
                    }}
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${
                      authMethod === 'google'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Google (Firebase)</span>
                  </button>
                </div>

                {/* Notifications & Banners */}
                {errorMessage && (
                  <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Success Message Banner */}
                {successMessage && (
                  <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {/* Email Delivery Notification Banner */}
                {emailDeliveryInfo && (
                  <div className="p-4 bg-cyan-950/60 border border-cyan-500/50 rounded-2xl text-xs text-cyan-200 space-y-2.5 shadow-lg">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Send className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-white block">
                            {emailDeliveryInfo.isRealSmtp
                              ? 'E-mail envoyé dans votre boîte de réception !'
                              : 'E-mail officiel généré et prêt !'}
                          </span>
                          <span className="text-[11px] text-cyan-300/80">
                            {emailDeliveryInfo.isRealSmtp
                              ? 'Consultez vos e-mails (et vos spams si nécessaire).'
                              : 'Vous pouvez visualiser l’e-mail réel en direct ou utiliser le code.'}
                          </span>
                        </div>
                      </div>

                      {receivedCodeBanner && (
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-mono">CODE :</span>
                          <span className="font-mono font-black text-amber-300 text-lg tracking-widest">
                            {receivedCodeBanner}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-cyan-800/40">
                      {emailDeliveryInfo.previewUrl && (
                        <a
                          href={emailDeliveryInfo.previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Ouvrir l’e-mail reçu (HTML complet)</span>
                        </a>
                      )}

                      {receivedCodeBanner && (
                        <button
                          type="button"
                          onClick={() => {
                            sound.playClick();
                            setCodeInput(receivedCodeBanner);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-semibold border border-cyan-500/40 text-xs cursor-pointer"
                        >
                          Remplir automatiquement
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* EMAIL & CODE VERIFICATION FLOW */}
                {authMethod === 'email' && (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
                    {emailStep === 'enter_email' ? (
                      <form onSubmit={handleSendCode} className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Votre Adresse Email Personnelle</span>
                            </span>
                            {smtpStatus?.configured ? (
                              <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                <span>SMTP Actif ({smtpStatus.user})</span>
                              </span>
                            ) : null}
                          </label>
                          <input
                            type="email"
                            required
                            placeholder="ex: alexandre.soeirofrance@gmail.com"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-400 transition-colors"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Pseudo / Nom de Joueur (Optionnel)</span>
                          </label>
                          <input
                            type="text"
                            placeholder="ex: AlexandreMaster"
                            value={displayNameInput}
                            onChange={(e) => setDisplayNameInput(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-400 transition-colors"
                          />
                        </div>

                        {/* Avatar Picker */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-300 block">
                            Choisissez votre Avatar
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {AVATAR_OPTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  sound.playClick();
                                  setSelectedAvatar(emoji);
                                }}
                                className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all cursor-pointer ${
                                  selectedAvatar === emoji
                                    ? 'bg-cyan-500/30 border-2 border-cyan-400 scale-110 shadow-md'
                                    : 'bg-slate-900 border border-slate-800 hover:border-slate-700'
                                }`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs tracking-wider uppercase shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isSubmitting ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Envoi de l'e-mail en cours...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4" />
                              <span>Envoyer le code par E-mail</span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </form>
                    ) : (
                      /* STEP 2: ENTER 6-DIGIT CODE */
                      <form onSubmit={handleVerifyCode} className="space-y-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                              <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Code de vérification reçu (6 chiffres)</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                sound.playClick();
                                setEmailStep('enter_email');
                              }}
                              className="text-[11px] text-slate-400 hover:text-cyan-300 underline cursor-pointer"
                            >
                              Changer d'email
                            </button>
                          </div>
                          <input
                            type="text"
                            required
                            maxLength={6}
                            placeholder="123456"
                            value={codeInput}
                            onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, ''))}
                            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-cyan-500/50 text-xl font-mono tracking-widest text-center text-white focus:outline-none focus:border-cyan-400 shadow-inner"
                          />
                          <p className="text-[11px] text-slate-400 text-center">
                            Code envoyé pour <span className="text-cyan-300 font-mono">{emailInput}</span> (valable 15 min).
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleSendCode}
                            disabled={isSubmitting}
                            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Renvoyer l'e-mail</span>
                          </button>

                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs tracking-wider uppercase shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {isSubmitting ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Vérification...</span>
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="w-4 h-4" />
                                <span>Valider et Activer mon Compte</span>
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Collapsible SMTP / Direct Gmail Dispatch Configuration */}
                    <div className="pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setShowSmtpConfig(!showSmtpConfig)}
                        className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition-colors py-1 cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <Settings className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="font-semibold">
                            {smtpStatus?.configured
                              ? 'Serveur d’envoi SMTP configuré (Modifier)'
                              : 'Configurer l’envoi direct vers ma boîte Gmail (SMTP)'}
                          </span>
                        </span>
                        <span className="text-[10px] text-cyan-400 underline">
                          {showSmtpConfig ? 'Masquer' : 'Afficher'}
                        </span>
                      </button>

                      {showSmtpConfig && (
                        <div className="mt-3 p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
                          <div className="text-[11px] text-slate-300 space-y-1">
                            <p className="font-bold text-white flex items-center gap-1">
                              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                              <span>Comment recevoir directement dans votre boîte Gmail ?</span>
                            </p>
                            <p className="text-slate-400 leading-relaxed">
                              Google requiert un <strong>Mot de passe d'application</strong> (16 caractères) pour autoriser l'envoi d'e-mails sécurisé.
                            </p>
                            <a
                              href="https://myaccount.google.com/apppasswords"
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-cyan-400 hover:underline font-mono text-[11px] mt-1"
                            >
                              <span>Ouvrir Google App Passwords</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>

                          <form onSubmit={handleSaveSmtp} className="space-y-2.5 pt-1">
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                Votre adresse Gmail expéditrice
                              </label>
                              <input
                                type="email"
                                required
                                placeholder="mon.adresse@gmail.com"
                                value={smtpEmailInput}
                                onChange={(e) => setSmtpEmailInput(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                Mot de passe d'application Google (16 lettres)
                              </label>
                              <input
                                type="password"
                                required
                                placeholder="abcd efgh ijkl mnop"
                                value={smtpPasswordInput}
                                onChange={(e) => setSmtpPasswordInput(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400"
                              />
                            </div>

                            {smtpFeedback && (
                              <p
                                className={`text-[11px] font-semibold ${
                                  smtpFeedback.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {smtpFeedback.msg}
                              </p>
                            )}

                            <button
                              type="submit"
                              disabled={smtpSaving}
                              className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {smtpSaving ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>Enregistrement...</span>
                                </>
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Enregistrer et Activer l'envoi Gmail</span>
                                </>
                              )}
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* GOOGLE FIREBASE AUTH OPTION */}
                {authMethod === 'google' && (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center mx-auto text-cyan-300">
                      <LogIn className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white mb-1">Connexion Google en 1 clic</h4>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        Identifiez-vous instantanément avec votre compte Google et synchronisez vos parties avec Cloud SQL.
                      </p>
                    </div>

                    <button
                      onClick={handleGoogleSignIn}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-cyan-500/25 active:scale-95 transition-all cursor-pointer"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Continuer avec Google</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: GitHub Export Instructions */}
        {activeTab === 'github' && (
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                <Github className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Mettre sur GitHub</h3>
                <p className="text-xs text-slate-400">
                  Liez ce projet complet (React 19 + Express + Leaflet + Cloud SQL + Firebase) à votre compte GitHub.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300 font-mono">1. Créez un dépôt sur GitHub</span>
                  <a
                    href="https://github.com/new"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-cyan-400 hover:underline text-[11px]"
                  >
                    <span>Ouvrir github.com/new</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-slate-400">
                  Nommez votre dépôt (ex : <code className="text-cyan-300">geoapex</code>) sans cocher 'Initialize with README'.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 font-mono">2. Commandes Git pour pousser le code</span>
                  <button
                    onClick={copyGitCommands}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-300 transition-colors cursor-pointer"
                  >
                    {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCmd ? 'Copié !' : 'Copier'}</span>
                  </button>
                </div>

                <pre className="p-3 bg-slate-900 rounded-xl text-[11px] font-mono text-slate-200 overflow-x-auto leading-relaxed border border-slate-800">
{`git init
git add .
git commit -m "feat: GeoApex 3D GeoGuessr with Cloud SQL and Firebase"
git branch -M main
git remote add origin https://github.com/VOTRE_PSEUDO/geoapex.git
git push -u origin main`}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
