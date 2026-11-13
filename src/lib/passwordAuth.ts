/**
 * Standard Email & Password Authentication for GeoApex with Email Verification
 * Supports:
 * 1. Email + Password Account Creation with Verification Code sent by email
 * 2. Password Reset / Change with Security Verification Code sent by email
 * 3. Standard Login with Email + Password
 * 4. Password hashing with crypto.scryptSync and Cloud SQL sync
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { quickCreateAccount, createVerificationCode, validateVerificationCode } from '../db/users.ts';
import {
  sendVerificationEmail,
  DEFAULT_SENDER_NAME,
  DEFAULT_SENDER_EMAIL,
  type EmailRelayType,
} from './email.ts';

export interface UserCredential {
  email: string;
  passwordHash: string;
  uid: string;
  createdAt: string;
}

export interface PendingRegistration {
  email: string;
  passwordHash: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: number;
}

const CREDS_FILE = path.resolve(process.cwd(), 'credentials.json');
const PENDING_FILE = path.resolve(process.cwd(), 'pending_registrations.json');

function loadCredentials(): Record<string, UserCredential> {
  if (fs.existsSync(CREDS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CREDS_FILE, 'utf-8'));
    } catch {
      return {};
    }
  }
  return {};
}

function saveCredentials(creds: Record<string, UserCredential>): void {
  fs.writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2), 'utf-8');
}

function loadPending(): Record<string, PendingRegistration> {
  if (fs.existsSync(PENDING_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PENDING_FILE, 'utf-8'));
    } catch {
      return {};
    }
  }
  return {};
}

function savePending(pending: Record<string, PendingRegistration>): void {
  fs.writeFileSync(PENDING_FILE, JSON.stringify(pending, null, 2), 'utf-8');
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  try {
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

export async function requestRegisterCode(
  email: string,
  password: string,
  displayName?: string,
  avatarUrl?: string
) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Adresse e-mail invalide.');
  }
  if (!password || password.length < 6) {
    throw new Error('Le mot de passe doit comporter au moins 6 caractères.');
  }

  const creds = loadCredentials();
  if (creds[cleanEmail]) {
    throw new Error(
      'Un compte existe déjà avec cette adresse email. Veuillez vous connecter ou réinitialiser votre mot de passe.'
    );
  }

  const passwordHash = hashPassword(password);
  const pending = loadPending();
  pending[cleanEmail] = {
    email: cleanEmail,
    passwordHash,
    displayName: displayName?.trim() || cleanEmail.split('@')[0],
    avatarUrl: avatarUrl || '👑',
    createdAt: Date.now(),
  };
  savePending(pending);

  const code = await createVerificationCode(cleanEmail);

  let isRealSmtp = false;
  let deliveredToRealInbox = false;
  let relayType: EmailRelayType = 'local';
  let messageId: string | undefined;
  let previewUrl: string | false | undefined;
  let senderAddress = `"${DEFAULT_SENDER_NAME}" <${DEFAULT_SENDER_EMAIL}>`;

  try {
    const result = await sendVerificationEmail(cleanEmail, code, displayName, 'account_creation');
    isRealSmtp = result.isRealSmtp;
    deliveredToRealInbox = result.deliveredToRealInbox;
    relayType = result.relayType;
    messageId = result.messageId;
    previewUrl = result.previewUrl;
    senderAddress = result.sender;
  } catch (err: any) {
    console.log('[REGISTRATION SMTP NOTICE] Error in sendVerificationEmail:', err.message);
  }

  const statusMessage = deliveredToRealInbox
    ? `Code de confirmation expédié directement dans votre boîte ${cleanEmail} (${relayType.toUpperCase()}).`
    : previewUrl
    ? `Relais d'aperçu Ethereal actif (aucun relais Gmail/Brevo/Resend configuré). Ouvrez l'aperçu web ou connectez votre messagerie réelle.`
    : `Code généré localement (${code}). Configurez Gmail SMTP, Brevo ou Resend pour recevoir directement dans votre boîte mail.`;

  return {
    success: true,
    message: statusMessage,
    isRealSmtp,
    deliveredToRealInbox,
    relayType,
    code: deliveredToRealInbox ? undefined : code,
    previewUrl: previewUrl || undefined,
    emailDetails: {
      to: cleanEmail,
      from: senderAddress,
      subject: `[GeoApex] Code de vérification pour votre compte`,
      code: deliveredToRealInbox ? undefined : code,
      isRealSmtp,
      deliveredToRealInbox,
      relayType,
      messageId,
      previewUrl: previewUrl || undefined,
    },
    messageId,
  };
}

export async function confirmRegisterWithCode(email: string, code: string) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !code) {
    throw new Error('Email et code de vérification requis.');
  }

  const isValid = await validateVerificationCode(cleanEmail, code.trim());
  if (!isValid) {
    throw new Error('Code de vérification invalide ou expiré (durée de validité : 15 min).');
  }

  const pending = loadPending();
  const pendingData = pending[cleanEmail];

  const dbUser = await quickCreateAccount(
    cleanEmail,
    pendingData?.displayName || cleanEmail.split('@')[0],
    pendingData?.avatarUrl || '👑'
  );

  const creds = loadCredentials();
  creds[cleanEmail] = {
    email: cleanEmail,
    passwordHash: pendingData?.passwordHash || hashPassword('defaultP@ss123'),
    uid: dbUser.uid,
    createdAt: new Date().toISOString(),
  };
  saveCredentials(creds);

  if (pending[cleanEmail]) {
    delete pending[cleanEmail];
    savePending(pending);
  }

  return {
    user: dbUser,
    token: dbUser.uid,
    message: 'Compte vérifié et activé avec succès ! Bienvenue sur GeoApex.',
  };
}

export async function requestPasswordResetCode(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Adresse e-mail invalide.');
  }

  const creds = loadCredentials();
  if (!creds[cleanEmail]) {
    throw new Error('Aucun compte enregistré avec cette adresse e-mail.');
  }

  const code = await createVerificationCode(cleanEmail);

  let isRealSmtp = false;
  let deliveredToRealInbox = false;
  let relayType: EmailRelayType = 'local';
  let messageId: string | undefined;
  let previewUrl: string | false | undefined;
  let senderAddress = `"${DEFAULT_SENDER_NAME}" <${DEFAULT_SENDER_EMAIL}>`;

  try {
    const result = await sendVerificationEmail(cleanEmail, code, cleanEmail.split('@')[0], 'password_reset');
    isRealSmtp = result.isRealSmtp;
    deliveredToRealInbox = result.deliveredToRealInbox;
    relayType = result.relayType;
    messageId = result.messageId;
    previewUrl = result.previewUrl;
    senderAddress = result.sender;
  } catch (err: any) {
    console.log('[PASSWORD RESET SMTP NOTICE] Error in sendVerificationEmail:', err.message);
  }

  const statusMessage = deliveredToRealInbox
    ? `Code de sécurité expédié directement dans votre boîte ${cleanEmail} (${relayType.toUpperCase()}).`
    : previewUrl
    ? `Relais d'aperçu Ethereal actif (aucun relais Gmail/Brevo/Resend configuré). Ouvrez l'aperçu web ou connectez votre messagerie réelle.`
    : `Code de réinitialisation généré localement (${code}). Configurez un relais réel pour l'envoi en boîte mail.`;

  return {
    success: true,
    message: statusMessage,
    isRealSmtp,
    deliveredToRealInbox,
    relayType,
    code: deliveredToRealInbox ? undefined : code,
    previewUrl: previewUrl || undefined,
    emailDetails: {
      to: cleanEmail,
      from: senderAddress,
      subject: `[GeoApex] Code de sécurité - Changement de mot de passe`,
      code: deliveredToRealInbox ? undefined : code,
      isRealSmtp,
      deliveredToRealInbox,
      relayType,
      messageId,
      previewUrl: previewUrl || undefined,
    },
    messageId,
  };
}

export async function confirmPasswordResetWithCode(email: string, code: string, newPassword: string) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !code || !newPassword) {
    throw new Error('Email, code de vérification et nouveau mot de passe requis.');
  }
  if (newPassword.length < 6) {
    throw new Error('Le nouveau mot de passe doit comporter au moins 6 caractères.');
  }

  const isValid = await validateVerificationCode(cleanEmail, code.trim());
  if (!isValid) {
    throw new Error('Code de sécurité invalide ou expiré (durée de validité : 15 min).');
  }

  const creds = loadCredentials();
  const existing = creds[cleanEmail];
  if (!existing) {
    throw new Error('Compte introuvable.');
  }

  existing.passwordHash = hashPassword(newPassword);
  saveCredentials(creds);

  const dbUser = await quickCreateAccount(cleanEmail);

  return {
    user: dbUser,
    token: dbUser.uid,
    message: 'Votre mot de passe a été modifié avec succès ! Vous êtes maintenant connecté.',
  };
}

export async function registerWithPassword(
  email: string,
  password: string,
  displayName?: string,
  avatarUrl?: string
) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Adresse e-mail invalide.');
  }
  if (!password || password.length < 6) {
    throw new Error('Le mot de passe doit comporter au moins 6 caractères.');
  }

  const creds = loadCredentials();
  if (creds[cleanEmail]) {
    throw new Error('Un compte existe déjà avec cette adresse email. Veuillez vous connecter.');
  }

  const dbUser = await quickCreateAccount(cleanEmail, displayName, avatarUrl);
  const passwordHash = hashPassword(password);
  creds[cleanEmail] = {
    email: cleanEmail,
    passwordHash,
    uid: dbUser.uid,
    createdAt: new Date().toISOString(),
  };
  saveCredentials(creds);

  return {
    user: dbUser,
    token: dbUser.uid,
  };
}

export async function loginWithPassword(email: string, password: string) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) {
    throw new Error('Veuillez renseigner votre email et votre mot de passe.');
  }

  const creds = loadCredentials();
  const credential = creds[cleanEmail];

  if (!credential) {
    throw new Error('Aucun compte trouvé avec cet email. Veuillez créer un compte.');
  }

  const isValid = verifyPassword(password, credential.passwordHash);
  if (!isValid) {
    throw new Error('Mot de passe incorrect. Veuillez réessayer.');
  }

  const dbUser = await quickCreateAccount(cleanEmail);

  return {
    user: dbUser,
    token: dbUser.uid,
  };
}
