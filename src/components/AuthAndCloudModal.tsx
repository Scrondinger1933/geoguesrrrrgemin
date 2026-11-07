import React, { useState, useEffect } from 'react';
import { Trophy, Github, LogIn, LogOut, Check, Copy, ExternalLink, X, Database, ShieldCheck } from 'lucide-react';
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

interface AuthAndCloudModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'auth' | 'leaderboard' | 'github';
}

export function AuthAndCloudModal({ isOpen, onClose, defaultTab = 'leaderboard' }: AuthAndCloudModalProps) {
  const [activeTab, setActiveTab] = useState<'auth' | 'leaderboard' | 'github'>(defaultTab);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Sync auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
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

  const handleGoogleSignIn = async () => {
    try {
      sound.playClick();
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: any) {
      console.error('Sign-in error:', err);
    }
  };

  const handleSignOut = async () => {
    try {
      sound.playClick();
      await signOut(auth);
      setCurrentUser(null);
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
              <Trophy className="w-4 h-4" />
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
              <Database className="w-4 h-4" />
              <span>Compte & Cloud SQL</span>
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
              <Github className="w-4 h-4" />
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
                  Scores enregistrés en direct dans l'instance PostgreSQL Cloud SQL.
                </p>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>PostgreSQL Connecté</span>
              </span>
            </div>

            {isLoadingLeaderboard ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Chargement des scores depuis Cloud SQL...
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="py-10 text-center bg-slate-950/60 rounded-2xl border border-slate-800 p-6 space-y-2">
                <Trophy className="w-8 h-8 text-amber-400 mx-auto opacity-75" />
                <p className="text-sm font-bold text-white">Aucun score enregistré pour l'instant</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Connectez-vous avec votre compte Google et terminez une partie pour inscrire votre nom sur la base Cloud SQL !
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

        {/* Tab 2: Account & Firebase Auth */}
        {activeTab === 'auth' && (
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-black text-white">Authentification & Profil Joueur</h3>
              <p className="text-xs text-slate-400">
                Géré par Firebase Authentication et synchronisé dans la base Cloud SQL (PostgreSQL).
              </p>
            </div>

            {currentUser ? (
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-4">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt="Avatar"
                      className="w-14 h-14 rounded-full border-2 border-cyan-400 shadow-md"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300 font-bold text-lg">
                      {currentUser.displayName?.[0] || 'U'}
                    </div>
                  )}
                  <div>
                    <span className="text-base font-bold text-white block">
                      {currentUser.displayName || 'Joueur GeoApex'}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">{currentUser.email}</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-[10px] text-emerald-300 font-semibold">
                        Compte synchronisé Cloud SQL (ID: {currentUser.uid.slice(0, 8)}...)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Se Déconnecter</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center mx-auto text-cyan-300">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">Sauvegardez vos stats et duels</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Connectez-vous en un clic avec votre compte Google pour conserver vos statistiques et apparaître dans le classement Cloud SQL.
                  </p>
                </div>

                <button
                  onClick={handleGoogleSignIn}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-cyan-500/25 active:scale-95 transition-all cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Connexion avec Google</span>
                </button>
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
