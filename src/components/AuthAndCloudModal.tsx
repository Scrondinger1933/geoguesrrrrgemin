import React, { useState, useEffect, useRef } from 'react';
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
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Send,
  Trash2,
  Terminal,
  Lock,
  ArrowLeft,
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

interface EmailStatus {
  configured: boolean;
  provider: 'gmail' | 'smtp' | 'brevo' | 'resend' | 'ethereal' | 'local';
  user: string | null;
  fromEmail: string;
  fromName: string;
  host: string;
  port: number;
  hasResendKey: boolean;
  hasBrevoKey: boolean;
  hasSmtpPass: boolean;
}

interface AuthAndCloudModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'auth' | 'leaderboard' | 'keys' | 'github';
}

interface OtpSixBoxInputProps {
  idPrefix: string;
  value: string;
  onChange: (nextCode: string) => void;
  accent?: 'cyan' | 'amber';
}

function OtpSixBoxInput({ idPrefix, value, onChange, accent = 'cyan' }: OtpSixBoxInputProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  const handleDigitChange = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, '');
    if (!clean) {
      const next = digits.map((d, idx) => (idx === index ? '' : d)).join('');
      onChange(next);
      return;
    }

    if (clean.length > 1) {
      const pasted = clean.slice(0, 6);
      onChange(pasted);
      const focusIdx = Math.min(5, pasted.length - 1);
      inputRefs.current[focusIdx]?.focus();
      return;
    }

    const updated = [...digits];
    updated[index] = clean;
    onChange(updated.join(''));
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const updated = [...digits];
      updated[index - 1] = '';
      onChange(updated.join(''));
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text) {
      e.preventDefault();
      onChange(text);
      const focusIdx = Math.min(5, text.length - 1);
      inputRefs.current[focusIdx]?.focus();
    }
  };

  const focusClass =
    accent === 'amber'
      ? 'focus:border-amber-400 border-amber-400/35'
      : 'focus:border-cyan-400 border-cyan-400/35';

  return (
    <div className="grid grid-cols-6 gap-2 sm:gap-2.5" role="group" aria-label="Code de vérification à 6 chiffres">
      {digits.map((digit, index) => (
        <input
          key={index}
          id={`${idPrefix}-${index}`}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={6}
          aria-label={`Chiffre ${index + 1} sur 6`}
          value={digit}
          onChange={(e) => handleDigitChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          className={`h-12 sm:h-14 rounded-xl bg-[#0E131D] border ${focusClass} text-xl sm:text-2xl font-mono-numbers font-bold text-center text-white focus:outline-none transition-colors`}
        />
      ))}
    </div>
  );
}

const AVATAR_OPTIONS = ['👑', '⚡', '🎯', '🚀', '🧭', '🦁'];

export function AuthAndCloudModal({
  isOpen,
  onClose,
  defaultTab = 'leaderboard',
}: AuthAndCloudModalProps) {
  const [activeTab, setActiveTab] = useState<'auth' | 'leaderboard' | 'keys' | 'github'>(defaultTab);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [emailUser, setEmailUser] = useState<CustomAuthUser | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  // Auth form states
  const [accountMode, setAccountMode] = useState<'register' | 'login' | 'reset'>('register');
  const [accountPassword, setAccountPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authMethod, setAuthMethod] = useState<'password' | 'google'>('password');
  const [emailInput, setEmailInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('👑');

  const [regStep, setRegStep] = useState<'form' | 'verify_code'>('form');
  const [regCodeInput, setRegCodeInput] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const [resetStep, setResetStep] = useState<'request' | 'verify_and_update'>('request');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [lastDispatchedEmail, setLastDispatchedEmail] = useState<any>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Real Email Provider Wizard state
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [providerTab, setProviderTab] = useState<'gmail' | 'brevo' | 'resend' | 'smtp'>('gmail');
  const [cfgEmailUser, setCfgEmailUser] = useState('studiomaldecenasoeiro@gmail.com');
  const [cfgAppPassword, setCfgAppPassword] = useState('');
  const [cfgSmtpHost, setCfgSmtpHost] = useState('smtp.gmail.com');
  const [cfgSmtpPort, setCfgSmtpPort] = useState('587');
  const [cfgFromEmail, setCfgFromEmail] = useState('studiomaldecenasoeiro@gmail.com');
  const [cfgFromName, setCfgFromName] = useState('Studio Maldecena Soeiro');
  const [cfgBrevoKey, setCfgBrevoKey] = useState('');
  const [cfgResendKey, setCfgResendKey] = useState('');
  const [smtpTestRecipient, setSmtpTestRecipient] = useState('alexandre.soeirofrance@gmail.com');
  const [isSavingEmailCfg, setIsSavingEmailCfg] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [showAppPasswordHelp, setShowAppPasswordHelp] = useState(false);

  // Developer API keys state
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendCooldown]);

  const notifyAuthUpdated = () => {
    window.dispatchEvent(new Event('geoapex-auth-updated'));
  };

  const fetchEmailStatus = async () => {
    try {
      const res = await fetch('/api/auth/email-status');
      if (res.ok) {
        const data = await res.json();
        setEmailStatus(data);
        if (data.fromEmail) setCfgFromEmail(data.fromEmail);
      }
    } catch {}
  };

  const fetchApiKeys = async () => {
    try {
      const res = await fetch('/api/keys/list');
      if (res.ok) {
        const data = await res.json();
        if (data.keys) setApiKeys(data.keys);
      }
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      fetchEmailStatus();
      if (activeTab === 'keys') {
        fetchApiKeys();
      }
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('geoapex_auth_user');
      if (stored) setEmailUser(JSON.parse(stored));
    } catch {}
  }, []);

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
        } catch {}
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isOpen && activeTab === 'leaderboard') {
      setIsLoadingLeaderboard(true);
      fetch('/api/leaderboard')
        .then((res) => res.json())
        .then((data) => {
          if (data.leaderboard) setLeaderboard(data.leaderboard);
        })
        .catch(() => {})
        .finally(() => setIsLoadingLeaderboard(false));
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const dispatchRegistrationCode = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const email = emailInput.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setErrorMessage('Veuillez saisir une adresse e-mail valide.');
      return;
    }
    if (!accountPassword || accountPassword.length < 6) {
      setErrorMessage('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (accountPassword !== confirmPassword) {
      setErrorMessage('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setIsSubmitting(true);
    sound.playClick();

    try {
      const res = await fetch('/api/auth/request-register-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: accountPassword,
          displayName: displayNameInput.trim() || undefined,
          avatarUrl: selectedAvatar,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors de la demande d’inscription');
      }

      setRegCodeInput('');
      setLastDispatchedEmail(data.emailDetails || null);
      setRegStep('verify_code');
      setResendCooldown(45);
      setSuccessMessage(
        data.deliveredToRealInbox
          ? `Un code à 6 chiffres vient d’être envoyé à ${email}.`
          : data.message
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Impossible de créer le compte');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestRegisterCode = async (e: React.FormEvent) => {
    e.preventDefault();
    await dispatchRegistrationCode();
  };

  const handleConfirmRegisterCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const email = emailInput.trim().toLowerCase();
    const code = regCodeInput.trim();
    if (!code || code.length < 6) {
      setErrorMessage('Veuillez saisir les 6 chiffres du code de vérification.');
      return;
    }

    setIsSubmitting(true);
    sound.playClick();

    try {
      const res = await fetch('/api/auth/confirm-register-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Code invalide ou expiré');
      }

      sound.playFanfare();
      setEmailUser(data.user);
      localStorage.setItem('geoapex_auth_user', JSON.stringify(data.user));
      localStorage.setItem('geoapex_auth_token', data.token);
      notifyAuthUpdated();
      setSuccessMessage(`Compte activé ! Bienvenue ${data.user.displayName}.`);
      setRegStep('form');
      setAccountPassword('');
      setConfirmPassword('');
      setRegCodeInput('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Code invalide ou expiré');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoginWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const email = emailInput.trim().toLowerCase();
    if (!email || !accountPassword) {
      setErrorMessage('Veuillez renseigner votre e-mail et mot de passe.');
      return;
    }

    setIsSubmitting(true);
    sound.playClick();

    try {
      const res = await fetch('/api/auth/login-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: accountPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Identifiants incorrects');
      }

      sound.playFanfare();
      setEmailUser(data.user);
      localStorage.setItem('geoapex_auth_user', JSON.stringify(data.user));
      localStorage.setItem('geoapex_auth_token', data.token);
      notifyAuthUpdated();
      setSuccessMessage(`Connexion réussie ! Bonjour ${data.user.displayName}.`);
      setAccountPassword('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur de connexion');
    } finally {
      setIsSubmitting(false);
    }
  };

  const dispatchResetCode = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const email = resetEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setErrorMessage('Veuillez entrer une adresse e-mail valide.');
      return;
    }

    setIsSubmitting(true);
    sound.playClick();

    try {
      const res = await fetch('/api/auth/request-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors de la demande');
      }

      setResetCode('');
      setLastDispatchedEmail(data.emailDetails || null);
      setResetStep('verify_and_update');
      setResendCooldown(45);
      setSuccessMessage(
        data.deliveredToRealInbox
          ? `Code de réinitialisation envoyé à ${email}.`
          : data.message
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Impossible d’envoyer le code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    await dispatchResetCode();
  };

  const handleConfirmResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const email = resetEmail.trim().toLowerCase();
    const code = resetCode.trim();
    if (!code || code.length < 6) {
      setErrorMessage('Veuillez saisir les 6 chiffres reçus par e-mail.');
      return;
    }
    if (!resetPassword || resetPassword.length < 6) {
      setErrorMessage('Le nouveau mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      setErrorMessage('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setIsSubmitting(true);
    sound.playClick();

    try {
      const res = await fetch('/api/auth/confirm-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword: resetPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Code de sécurité invalide ou expiré');
      }

      sound.playFanfare();
      setEmailUser(data.user);
      localStorage.setItem('geoapex_auth_user', JSON.stringify(data.user));
      localStorage.setItem('geoapex_auth_token', data.token);
      notifyAuthUpdated();
      setSuccessMessage('Mot de passe mis à jour avec succès. Vous êtes connecté.');
      setResetStep('request');
      setResetPassword('');
      setResetConfirmPassword('');
      setResetCode('');
      setAccountMode('login');
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors du changement de mot de passe');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEmailConfiguration = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingEmailCfg(true);
    setSmtpTestResult(null);
    sound.playClick();

    try {
      const payload: Record<string, any> = {
        provider: providerTab,
        fromEmail: cfgFromEmail.trim(),
        fromName: cfgFromName.trim() || 'Studio Maldecena Soeiro',
        testRecipient: smtpTestRecipient.trim() || 'alexandre.soeirofrance@gmail.com',
      };

      if (providerTab === 'gmail') {
        payload.user = cfgEmailUser.trim();
        payload.pass = cfgAppPassword.trim();
        payload.host = 'smtp.gmail.com';
        payload.port = 587;
      } else if (providerTab === 'smtp') {
        payload.user = cfgEmailUser.trim();
        payload.pass = cfgAppPassword.trim();
        payload.host = cfgSmtpHost.trim();
        payload.port = Number(cfgSmtpPort) || 587;
      } else if (providerTab === 'brevo') {
        payload.brevoApiKey = cfgBrevoKey.trim();
      } else if (providerTab === 'resend') {
        payload.resendApiKey = cfgResendKey.trim();
      }

      const res = await fetch('/api/auth/configure-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Échec de validation du fournisseur e-mail.');
      }

      sound.playFanfare();
      setSmtpTestResult({ type: 'success', msg: data.message });
      setCfgAppPassword('');
      await fetchEmailStatus();
    } catch (err: any) {
      setSmtpTestResult({ type: 'error', msg: err.message || 'Erreur de configuration.' });
    } finally {
      setIsSavingEmailCfg(false);
    }
  };

  const handleTestLiveEmail = async () => {
    setIsTestingSmtp(true);
    setSmtpTestResult(null);
    sound.playClick();

    try {
      const res = await fetch('/api/auth/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetEmail: smtpTestRecipient.trim() || 'alexandre.soeirofrance@gmail.com',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Aucun relais réel configuré.');
      }

      sound.playFanfare();
      setSmtpTestResult({
        type: 'success',
        msg: `${data.message} (ID: ${data.messageId})`,
      });
      fetchEmailStatus();
    } catch (err: any) {
      setSmtpTestResult({
        type: 'error',
        msg: err.message || 'Échec de l’envoi réel.',
      });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const handleGenerateApiKey = async () => {
    setIsGeneratingKey(true);
    sound.playClick();
    try {
      const res = await fetch('/api/keys/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'GeoApex Live Key',
          scopes: ['maps:read', 'scores:write', 'duels:play'],
        }),
      });
      const data = await res.json();
      if (res.ok && data.apiKey) {
        sound.playFanfare();
        setGeneratedKey(data.apiKey.key);
        fetchApiKeys();
      }
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    sound.playClick();
    const res = await fetch('/api/keys/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) fetchApiKeys();
  };

  const handleGoogleSignIn = async () => {
    try {
      sound.playClick();
      await signInWithPopup(auth, googleAuthProvider);
    } catch {}
  };

  const handleSignOut = async () => {
    try {
      sound.playClick();
      await signOut(auth);
      setFirebaseUser(null);
      setEmailUser(null);
      localStorage.removeItem('geoapex_auth_user');
      localStorage.removeItem('geoapex_auth_token');
      notifyAuthUpdated();
    } catch {}
  };

  const copyGitCommands = () => {
    const cmd = `git init\ngit add .\ngit commit -m "feat: GeoApex 3D GeoGuessr"\ngit branch -M main\ngit remote add origin https://github.com/VOTRE_PSEUDO/geoapex.git\ngit push -u origin main`;
    navigator.clipboard.writeText(cmd);
    sound.playClick();
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const activeUser =
    emailUser ||
    (firebaseUser
      ? {
          id: 0,
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || 'Joueur GeoApex',
          avatarUrl: firebaseUser.photoURL || '👑',
          highestScore: 0,
          gamesPlayed: 0,
          duelsWon: 0,
          emailVerified: 1,
        }
      : null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#07090F]/90">
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-3xl bg-[#0E131D] border border-white/12 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header Tabs */}
        <div className="px-6 py-3.5 bg-[#07090F] border-b border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {[
              { id: 'leaderboard', label: 'Classement', icon: <Trophy className="w-3.5 h-3.5 text-amber-400" /> },
              { id: 'auth', label: 'Compte & Vérification', icon: <Database className="w-3.5 h-3.5 text-cyan-400" /> },
              { id: 'keys', label: 'Messagerie Réelle & SMTP', icon: <Mail className="w-3.5 h-3.5 text-cyan-400" /> },
              { id: 'github', label: 'GitHub', icon: <Github className="w-3.5 h-3.5 text-slate-300" /> },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  sound.playClick();
                  setActiveTab(t.id as any);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === t.id
                    ? 'bg-cyan-400/15 text-cyan-300 border border-cyan-400/40'
                    : 'text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            aria-label="Fermer la fenêtre"
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* TAB 1: Leaderboard */}
        {activeTab === 'leaderboard' && (
          <div className="p-6 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-extrabold text-white">Classement Mondial</h3>
                <p className="text-xs text-slate-400">
                  Meilleurs scores enregistrés sur le serveur GeoApex.
                </p>
              </div>
              <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Serveur Connecté</span>
              </span>
            </div>

            {isLoadingLeaderboard ? (
              <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Chargement des scores...</span>
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="py-10 text-center bg-[#07090F] rounded-xl border border-white/10 p-6 space-y-2">
                <Trophy className="w-8 h-8 text-amber-400 mx-auto" />
                <p className="text-sm font-bold text-white">Aucun score enregistré pour l’instant</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Connectez-vous et terminez une partie pour inscrire votre record mondial.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-[#07090F] border border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono-numbers font-bold text-xs ${
                          idx === 0
                            ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                            : idx === 1
                            ? 'bg-slate-300/20 text-slate-200 border border-slate-400/40'
                            : 'bg-white/5 text-slate-400'
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <div>
                        <span className="text-sm font-bold text-white block">{item.displayName}</span>
                        <span className="text-[11px] text-slate-400 font-mono-numbers">
                          {item.gamesPlayed} parties · {item.duelsWon} duels gagnés
                        </span>
                      </div>
                    </div>
                    <span className="font-mono-numbers font-bold text-amber-400 text-sm">
                      {item.highestScore.toLocaleString('fr-FR')} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Account & Real 6-Digit Email Verification */}
        {activeTab === 'auth' && (
          <div className="p-6 overflow-y-auto space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-lg font-extrabold text-white">Compte Joueur &amp; Vérification</h3>
                <p className="text-xs text-slate-400">
                  Création de compte et réinitialisation sécurisées par code à 6 chiffres envoyé par e-mail.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('keys')}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg border cursor-pointer ${
                  emailStatus?.configured
                    ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                    : 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                }`}
              >
                {emailStatus?.configured
                  ? `SMTP Actif (${emailStatus.provider.toUpperCase()})`
                  : 'Configurer Gmail / Brevo'}
              </button>
            </div>

            {activeUser ? (
              <div className="bg-[#07090F] border border-white/10 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-2xl">
                      {activeUser.avatarUrl?.startsWith('http') ? (
                        <img src={activeUser.avatarUrl} alt="Avatar" className="w-full h-full rounded-xl object-cover" />
                      ) : (
                        <span>{activeUser.avatarUrl || '👑'}</span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-white">{activeUser.displayName}</span>
                        <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Vérifié</span>
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono block">{activeUser.email}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0E131D] hover:bg-rose-500/15 border border-white/10 text-rose-300 text-xs font-semibold cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Déconnexion</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#0E131D] p-3 rounded-xl border border-white/10 text-center">
                    <span className="text-[11px] text-slate-400 block">Record</span>
                    <span className="text-sm font-bold text-amber-400 font-mono-numbers">
                      {(activeUser.highestScore || 0).toLocaleString('fr-FR')} pts
                    </span>
                  </div>
                  <div className="bg-[#0E131D] p-3 rounded-xl border border-white/10 text-center">
                    <span className="text-[11px] text-slate-400 block">Parties</span>
                    <span className="text-sm font-bold text-cyan-400 font-mono-numbers">
                      {activeUser.gamesPlayed || 0}
                    </span>
                  </div>
                  <div className="bg-[#0E131D] p-3 rounded-xl border border-white/10 text-center">
                    <span className="text-[11px] text-slate-400 block">Duels Gagnés</span>
                    <span className="text-sm font-bold text-emerald-400 font-mono-numbers">
                      {activeUser.duelsWon || 0}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-1 bg-[#07090F] p-1 rounded-xl border border-white/10 text-xs font-semibold">
                  {[
                    { id: 'register', label: 'Inscription', icon: <UserCheck className="w-3.5 h-3.5" /> },
                    { id: 'login', label: 'Connexion', icon: <Lock className="w-3.5 h-3.5" /> },
                    { id: 'reset', label: 'Mot de passe', icon: <KeyRound className="w-3.5 h-3.5" /> },
                    { id: 'google', label: 'Google', icon: <LogIn className="w-3.5 h-3.5" /> },
                  ].map((item) => {
                    const isGoogle = item.id === 'google';
                    const active = isGoogle
                      ? authMethod === 'google'
                      : authMethod === 'password' && accountMode === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          setErrorMessage(null);
                          setSuccessMessage(null);
                          if (isGoogle) {
                            setAuthMethod('google');
                          } else {
                            setAuthMethod('password');
                            setAccountMode(item.id as any);
                            if (item.id === 'register') setRegStep('form');
                            if (item.id === 'reset') {
                              setResetStep('request');
                              if (emailInput) setResetEmail(emailInput);
                            }
                          }
                        }}
                        className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                          active ? 'bg-cyan-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>

                {errorMessage && (
                  <div className="p-3.5 bg-rose-500/15 border border-rose-500/40 rounded-xl text-xs text-rose-200 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <span className="flex-1">{errorMessage}</span>
                  </div>
                )}

                {successMessage && (
                  <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {/* Register 2-step Real Website Flow */}
                {authMethod === 'password' && accountMode === 'register' && (
                  <div className="bg-[#07090F] border border-white/10 rounded-xl p-5">
                    {regStep === 'form' ? (
                      <form onSubmit={handleRequestRegisterCode} className="space-y-3.5">
                        <div className="space-y-1">
                          <label htmlFor="reg-email" className="text-xs font-bold text-slate-200 block">
                            Adresse E-mail
                          </label>
                          <input
                            id="reg-email"
                            type="email"
                            required
                            placeholder="votre.email@gmail.com"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E131D] border border-white/15 text-sm text-white focus:border-cyan-400 focus:outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label htmlFor="reg-pass" className="text-xs font-bold text-slate-200">
                                Mot de passe
                              </label>
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="text-[11px] text-cyan-400 hover:underline cursor-pointer"
                              >
                                {showPassword ? 'Masquer' : 'Afficher'}
                              </button>
                            </div>
                            <input
                              id="reg-pass"
                              type={showPassword ? 'text' : 'password'}
                              required
                              minLength={6}
                              placeholder="Min. 6 caractères"
                              value={accountPassword}
                              onChange={(e) => setAccountPassword(e.target.value)}
                              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E131D] border border-white/15 text-sm text-white focus:border-cyan-400 focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label htmlFor="reg-pass-confirm" className="text-xs font-bold text-slate-200 block">
                              Confirmer mot de passe
                            </label>
                            <input
                              id="reg-pass-confirm"
                              type={showPassword ? 'text' : 'password'}
                              required
                              minLength={6}
                              placeholder="Répéter le mot de passe"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E131D] border border-white/15 text-sm text-white focus:border-cyan-400 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                          <div className="space-y-1">
                            <label htmlFor="reg-pseudo" className="text-xs font-bold text-slate-200 block">
                              Pseudo Joueur
                            </label>
                            <input
                              id="reg-pseudo"
                              type="text"
                              placeholder="ex: Alexandre"
                              value={displayNameInput}
                              onChange={(e) => setDisplayNameInput(e.target.value)}
                              className="w-full px-3.5 py-2 rounded-xl bg-[#0E131D] border border-white/15 text-sm text-white focus:border-cyan-400 focus:outline-none"
                            />
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {AVATAR_OPTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => setSelectedAvatar(emoji)}
                                className={`w-9 h-9 rounded-lg text-base flex items-center justify-center cursor-pointer border ${
                                  selectedAvatar === emoji
                                    ? 'bg-cyan-400/20 border-cyan-400'
                                    : 'bg-[#0E131D] border-white/10'
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
                          className="w-full py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 font-bold text-xs tracking-wide cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Send className="w-4 h-4" />
                          <span>{isSubmitting ? 'Envoi du code...' : 'Créer le compte & recevoir le code'}</span>
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleConfirmRegisterCode} className="space-y-4">
                        <div className="flex items-center justify-between text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setRegStep('form');
                              setErrorMessage(null);
                            }}
                            className="flex items-center gap-1 text-slate-400 hover:text-white cursor-pointer"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Modifier l’adresse</span>
                          </button>
                          <span className="font-mono text-cyan-300">{emailInput}</span>
                        </div>

                        <div className="p-3.5 rounded-xl bg-[#0E131D] border border-white/10 space-y-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-white">Vérification par e-mail</span>
                            <span
                              className={`font-semibold ${
                                lastDispatchedEmail?.deliveredToRealInbox ? 'text-emerald-400' : 'text-amber-300'
                              }`}
                            >
                              {lastDispatchedEmail?.deliveredToRealInbox
                                ? `Livré en boîte réelle (${String(lastDispatchedEmail.relayType).toUpperCase()})`
                                : 'Relais réel non configuré (Aperçu Ethereal)'}
                            </span>
                          </div>

                          {!lastDispatchedEmail?.deliveredToRealInbox && (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {lastDispatchedEmail?.previewUrl && (
                                <a
                                  href={lastDispatchedEmail.previewUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 font-semibold flex items-center gap-1.5"
                                >
                                  <span>Voir le mail reçu (Ethereal)</span>
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => setActiveTab('keys')}
                                className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-400/40 text-amber-200 font-semibold cursor-pointer"
                              >
                                Configurer Gmail / Brevo sur le serveur
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label htmlFor="reg-otp-0" className="text-xs font-bold text-slate-200 block">
                            Entrez le code de confirmation à 6 chiffres
                          </label>
                          <OtpSixBoxInput
                            idPrefix="reg-otp"
                            value={regCodeInput}
                            onChange={setRegCodeInput}
                            accent="cyan"
                          />
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="text-slate-400">Vous n’avez pas reçu le mail ?</span>
                          <button
                            type="button"
                            disabled={resendCooldown > 0 || isSubmitting}
                            onClick={dispatchRegistrationCode}
                            className="font-semibold text-cyan-300 hover:text-cyan-200 disabled:text-slate-500 cursor-pointer disabled:cursor-not-allowed"
                          >
                            {resendCooldown > 0 ? `Renvoyer dans ${resendCooldown}s` : 'Renvoyer le code'}
                          </button>
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmitting || regCodeInput.length < 6}
                          className="w-full py-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 text-slate-950 font-bold text-xs cursor-pointer flex items-center justify-center gap-2"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>{isSubmitting ? 'Vérification...' : 'Vérifier et activer le compte'}</span>
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {/* Login */}
                {authMethod === 'password' && accountMode === 'login' && (
                  <form onSubmit={handleLoginWithPassword} className="bg-[#07090F] border border-white/10 rounded-xl p-5 space-y-3.5">
                    <div className="space-y-1">
                      <label htmlFor="login-email" className="text-xs font-bold text-slate-200 block">
                        Adresse E-mail
                      </label>
                      <input
                        id="login-email"
                        type="email"
                        required
                        placeholder="votre.email@gmail.com"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E131D] border border-white/15 text-sm text-white focus:border-cyan-400 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label htmlFor="login-pass" className="text-xs font-bold text-slate-200">
                          Mot de passe
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setAccountMode('reset');
                            setResetStep('request');
                            if (emailInput) setResetEmail(emailInput);
                          }}
                          className="text-[11px] text-cyan-400 hover:underline cursor-pointer"
                        >
                          Mot de passe oublié ?
                        </button>
                      </div>
                      <input
                        id="login-pass"
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Votre mot de passe"
                        value={accountPassword}
                        onChange={(e) => setAccountPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E131D] border border-white/15 text-sm text-white focus:border-cyan-400 focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 font-bold text-xs cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>{isSubmitting ? 'Connexion...' : 'Se Connecter'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                )}

                {/* Reset Password with 6-digit OTP */}
                {authMethod === 'password' && accountMode === 'reset' && (
                  <div className="bg-[#07090F] border border-white/10 rounded-xl p-5">
                    {resetStep === 'request' ? (
                      <form onSubmit={handleRequestResetCode} className="space-y-3.5">
                        <div className="space-y-1">
                          <label htmlFor="reset-email" className="text-xs font-bold text-slate-200 block">
                            Adresse E-mail du compte
                          </label>
                          <input
                            id="reset-email"
                            type="email"
                            required
                            placeholder="votre.email@gmail.com"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E131D] border border-white/15 text-sm text-white focus:border-amber-400 focus:outline-none"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold text-xs cursor-pointer"
                        >
                          {isSubmitting ? 'Envoi...' : 'Recevoir le code de réinitialisation'}
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleConfirmResetCode} className="space-y-3.5">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label htmlFor="reset-otp-0" className="text-xs font-bold text-slate-200">
                              Code à 6 chiffres reçu par e-mail
                            </label>
                            <button
                              type="button"
                              disabled={resendCooldown > 0 || isSubmitting}
                              onClick={dispatchResetCode}
                              className="text-xs font-semibold text-amber-300 disabled:text-slate-500 cursor-pointer"
                            >
                              {resendCooldown > 0 ? `Renvoyer (${resendCooldown}s)` : 'Renvoyer'}
                            </button>
                          </div>
                          <OtpSixBoxInput
                            idPrefix="reset-otp"
                            value={resetCode}
                            onChange={setResetCode}
                            accent="amber"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type={showResetPassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            placeholder="Nouveau mot de passe"
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                            className="w-full px-3.5 py-2 rounded-xl bg-[#0E131D] border border-white/15 text-sm text-white focus:outline-none"
                          />
                          <input
                            type={showResetPassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            placeholder="Confirmer"
                            value={resetConfirmPassword}
                            onChange={(e) => setResetConfirmPassword(e.target.value)}
                            className="w-full px-3.5 py-2 rounded-xl bg-[#0E131D] border border-white/15 text-sm text-white focus:outline-none"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setShowResetPassword(!showResetPassword)}
                            className="text-[11px] text-amber-300 hover:underline cursor-pointer"
                          >
                            {showResetPassword ? 'Masquer mots de passe' : 'Afficher mots de passe'}
                          </button>
                        </div>
                        <button
                          type="submit"
                          disabled={isSubmitting || resetCode.length < 6}
                          className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold text-xs cursor-pointer"
                        >
                          Valider le nouveau mot de passe
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {/* Google Sign In */}
                {authMethod === 'google' && (
                  <div className="bg-[#07090F] border border-white/10 rounded-xl p-6 text-center space-y-3">
                    <p className="text-xs text-slate-300">
                      Identifiez-vous instantanément avec votre compte Google.
                    </p>
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs cursor-pointer"
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

        {/* TAB 3: Real Inbox Email Wizard & API Keys */}
        {activeTab === 'keys' && (
          <div className="p-6 overflow-y-auto space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-lg font-extrabold text-white">
                  Messagerie Réelle (Gmail / Brevo / Resend / SMTP)
                </h3>
                <p className="text-xs text-slate-400">
                  Configurez votre serveur SMTP pour envoyer les codes de vérification et bilans directement en boîte Gmail.
                </p>
              </div>
              <span
                className={`text-xs font-semibold px-3 py-1 rounded-lg border ${
                  emailStatus?.configured
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                }`}
              >
                {emailStatus?.configured
                  ? `Actif : ${emailStatus.provider.toUpperCase()}`
                  : 'Aperçu Ethereal (non livré en boîte Gmail)'}
              </span>
            </div>

            <form
              onSubmit={handleSaveEmailConfiguration}
              className="bg-[#07090F] border border-white/10 rounded-xl p-5 space-y-4"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-[#0E131D] p-1 rounded-xl border border-white/10 text-xs font-semibold">
                {[
                  { id: 'gmail', label: 'Gmail App Pass' },
                  { id: 'brevo', label: 'Brevo API' },
                  { id: 'resend', label: 'Resend API' },
                  { id: 'smtp', label: 'SMTP Libre' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      setProviderTab(p.id as any);
                      setSmtpTestResult(null);
                    }}
                    className={`py-2 px-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      providerTab === p.id
                        ? 'bg-cyan-400 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {providerTab === 'gmail' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>Utilisez un Mot de passe d’application Google (16 caractères)</span>
                    <button
                      type="button"
                      onClick={() => setShowAppPasswordHelp(!showAppPasswordHelp)}
                      className="text-cyan-400 hover:underline cursor-pointer"
                    >
                      {showAppPasswordHelp ? 'Masquer aide' : 'Comment obtenir ?'}
                    </button>
                  </div>
                  {showAppPasswordHelp && (
                    <div className="p-3 rounded-lg bg-[#0E131D] border border-white/10 text-[11px] text-slate-300 space-y-1">
                      <p>1. Ouvrez <strong>myaccount.google.com/apppasswords</strong> (Validation en 2 étapes requise).</p>
                      <p>2. Créez une application « GeoApex » et copiez les 16 caractères générés.</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="cfg-gmail-user" className="text-xs font-semibold text-slate-300 block mb-1">
                        Compte Gmail expéditeur
                      </label>
                      <input
                        id="cfg-gmail-user"
                        type="email"
                        value={cfgEmailUser}
                        onChange={(e) => {
                          setCfgEmailUser(e.target.value);
                          setCfgFromEmail(e.target.value);
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-[#0E131D] border border-white/15 text-xs text-white focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="cfg-gmail-pass" className="text-xs font-semibold text-slate-300 block mb-1">
                        Mot de passe d’application (16 lettres)
                      </label>
                      <input
                        id="cfg-gmail-pass"
                        type="password"
                        value={cfgAppPassword}
                        onChange={(e) => setCfgAppPassword(e.target.value)}
                        placeholder="abcd efgh ijkl mnop"
                        className="w-full px-3 py-2 rounded-lg bg-[#0E131D] border border-white/15 text-xs text-white font-mono focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {providerTab === 'brevo' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-300">
                    Brevo offre 300 e-mails/jour gratuits sans domaine dédié (clé API v3).
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="cfg-brevo-key" className="text-xs font-semibold text-slate-300 block mb-1">
                        Clé API Brevo
                      </label>
                      <input
                        id="cfg-brevo-key"
                        type="password"
                        value={cfgBrevoKey}
                        onChange={(e) => setCfgBrevoKey(e.target.value)}
                        placeholder="xkeysib-..."
                        className="w-full px-3 py-2 rounded-lg bg-[#0E131D] border border-white/15 text-xs text-white font-mono focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="cfg-brevo-from" className="text-xs font-semibold text-slate-300 block mb-1">
                        E-mail expéditeur vérifié
                      </label>
                      <input
                        id="cfg-brevo-from"
                        type="email"
                        value={cfgFromEmail}
                        onChange={(e) => setCfgFromEmail(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#0E131D] border border-white/15 text-xs text-white focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {providerTab === 'resend' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="cfg-resend-key" className="text-xs font-semibold text-slate-300 block mb-1">
                        Clé API Resend
                      </label>
                      <input
                        id="cfg-resend-key"
                        type="password"
                        value={cfgResendKey}
                        onChange={(e) => setCfgResendKey(e.target.value)}
                        placeholder="re_..."
                        className="w-full px-3 py-2 rounded-lg bg-[#0E131D] border border-white/15 text-xs text-white font-mono focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="cfg-resend-from" className="text-xs font-semibold text-slate-300 block mb-1">
                        Expéditeur (ou onboarding@resend.dev)
                      </label>
                      <input
                        id="cfg-resend-from"
                        type="email"
                        value={cfgFromEmail}
                        onChange={(e) => setCfgFromEmail(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#0E131D] border border-white/15 text-xs text-white focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {providerTab === 'smtp' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="cfg-smtp-host" className="text-xs font-semibold text-slate-300 block mb-1">
                      Hôte SMTP
                    </label>
                    <input
                      id="cfg-smtp-host"
                      type="text"
                      value={cfgSmtpHost}
                      onChange={(e) => setCfgSmtpHost(e.target.value)}
                      placeholder="smtp-relay.brevo.com"
                      className="w-full px-3 py-2 rounded-lg bg-[#0E131D] border border-white/15 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="cfg-smtp-port" className="text-xs font-semibold text-slate-300 block mb-1">
                      Port (587 ou 465)
                    </label>
                    <input
                      id="cfg-smtp-port"
                      type="number"
                      value={cfgSmtpPort}
                      onChange={(e) => setCfgSmtpPort(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#0E131D] border border-white/15 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="cfg-smtp-user" className="text-xs font-semibold text-slate-300 block mb-1">
                      Utilisateur SMTP
                    </label>
                    <input
                      id="cfg-smtp-user"
                      type="text"
                      value={cfgEmailUser}
                      onChange={(e) => setCfgEmailUser(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#0E131D] border border-white/15 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="cfg-smtp-pass" className="text-xs font-semibold text-slate-300 block mb-1">
                      Mot de passe SMTP
                    </label>
                    <input
                      id="cfg-smtp-pass"
                      type="password"
                      value={cfgAppPassword}
                      onChange={(e) => setCfgAppPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#0E131D] border border-white/15 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-white/10 space-y-2.5">
                <label htmlFor="cfg-test-recipient" className="text-xs font-semibold text-slate-300 block">
                  Boîte e-mail de test
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="cfg-test-recipient"
                    type="email"
                    value={smtpTestRecipient}
                    onChange={(e) => setSmtpTestRecipient(e.target.value)}
                    placeholder="alexandre.soeirofrance@gmail.com"
                    className="flex-1 px-3.5 py-2 rounded-xl bg-[#0E131D] border border-white/15 text-xs text-white font-mono focus:border-cyan-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSavingEmailCfg}
                    className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 font-bold text-xs cursor-pointer whitespace-nowrap"
                  >
                    {isSavingEmailCfg ? 'Validation...' : 'Enregistrer & Envoyer Test'}
                  </button>
                  <button
                    type="button"
                    disabled={isTestingSmtp}
                    onClick={handleTestLiveEmail}
                    className="px-4 py-2 rounded-xl bg-[#0E131D] hover:bg-white/10 border border-white/15 text-white font-semibold text-xs cursor-pointer whitespace-nowrap"
                  >
                    {isTestingSmtp ? 'Test...' : 'Tester Relais Actuel'}
                  </button>
                </div>
              </div>

              {smtpTestResult && (
                <div
                  className={`p-3 rounded-xl text-xs border ${
                    smtpTestResult.type === 'success'
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                      : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                  }`}
                >
                  {smtpTestResult.msg}
                </div>
              )}
            </form>

            {/* Developer API Keys */}
            <div className="bg-[#07090F] border border-white/10 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  <span>Clés API Développeur ({apiKeys.length})</span>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateApiKey}
                  disabled={isGeneratingKey}
                  className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  {isGeneratingKey ? 'Génération...' : 'Générer une Clé'}
                </button>
              </div>

              {generatedKey && (
                <div className="p-3 bg-amber-500/10 border border-amber-400/40 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs text-amber-200 font-semibold">
                    <span>Copiez cette clé maintenant :</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedKey);
                        setCopiedKey(true);
                        setTimeout(() => setCopiedKey(false), 2000);
                      }}
                      className="px-2.5 py-1 rounded bg-amber-400 text-slate-950 font-bold cursor-pointer"
                    >
                      {copiedKey ? 'Copié' : 'Copier'}
                    </button>
                  </div>
                  <pre className="p-2 bg-[#07090F] rounded text-xs font-mono text-amber-200 overflow-x-auto">
                    {generatedKey}
                  </pre>
                </div>
              )}

              {apiKeys.length > 0 && (
                <div className="space-y-1.5">
                  {apiKeys.map((k) => (
                    <div
                      key={k.id}
                      className="p-2.5 bg-[#0E131D] border border-white/10 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-white">{k.name}</span>
                        <span className="text-slate-400 font-mono ml-2">{k.maskedKey}</span>
                      </div>
                      {k.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => handleRevokeApiKey(k.id)}
                          aria-label={`Révoquer la clé ${k.name}`}
                          className="p-1.5 rounded text-rose-300 hover:bg-rose-500/15 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: GitHub Export */}
        {activeTab === 'github' && (
          <div className="p-6 space-y-4">
            <h3 className="font-display text-lg font-extrabold text-white">Exporter vers GitHub</h3>
            <div className="bg-[#07090F] p-4 rounded-xl border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200">Commandes Git</span>
                <button
                  type="button"
                  onClick={copyGitCommands}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#0E131D] border border-white/10 text-xs font-semibold text-cyan-300 cursor-pointer"
                >
                  {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCmd ? 'Copié' : 'Copier'}</span>
                </button>
              </div>
              <pre className="p-3 bg-[#0E131D] rounded-lg text-[11px] font-mono text-slate-200 overflow-x-auto border border-white/10">
{`git init
git add .
git commit -m "feat: GeoApex 3D GeoGuessr"
git branch -M main
git remote add origin https://github.com/VOTRE_PSEUDO/geoapex.git
git push -u origin main`}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
