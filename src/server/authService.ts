/**
 * GeoApex Authentication Business Logic
 * Cleanly separated from HTTP routes & UI:
 * - bcryptjs password hashing (12 rounds) + legacy scrypt compatibility
 * - Strict server-side input validation
 * - Anti-enumeration responses for account registration, password reset, and login
 * - 10-minute single-use 6-digit OTP verification via SMTP (NO links anywhere!)
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  createOrActivateEmailUser,
  getUserByEmail,
  updateUserPasswordByEmail,
} from '../db/users.ts';
import {
  sendVerificationEmail,
  type EmailRelayType,
} from '../lib/email.ts';
import {
  otpService,
  OtpError,
  OTP_TTL_MS,
  RESEND_COOLDOWN_MS,
} from './otpService.ts';

const BCRYPT_ROUNDS = 12;
// Precomputed dummy hash for constant-time login mitigation against account enumeration
const DUMMY_BCRYPT_HASH = '$2b$12$CwTycUXWue0Thq9StjUM0uJ8u1qP2j6S2eN1c4a8G0V0V6vJ6fQ9G';

export interface SafeUserDTO {
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

export interface AuthDependencies {
  getUserByEmail: typeof getUserByEmail;
  createOrActivateEmailUser: typeof createOrActivateEmailUser;
  updateUserPasswordByEmail: typeof updateUserPasswordByEmail;
  sendVerificationEmail: typeof sendVerificationEmail;
  otp: Pick<typeof otpService, 'issueCode' | 'verifyCode'>;
}

const defaultDeps: AuthDependencies = {
  getUserByEmail,
  createOrActivateEmailUser,
  updateUserPasswordByEmail,
  sendVerificationEmail,
  otp: otpService,
};

export function isValidEmail(email: string): boolean {
  const clean = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean) && clean.length <= 254;
}

export function validateUsername(name?: string): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 32) {
    throw new OtpError("Le nom d'utilisateur doit contenir entre 2 et 32 caractères.", 400);
  }
  return trimmed;
}

export function validatePasswordStrength(password: string): void {
  if (typeof password !== 'string' || password.length < 8) {
    throw new OtpError('Le mot de passe doit contenir au moins 8 caractères.', 400);
  }
  if (password.length > 128) {
    throw new OtpError('Le mot de passe est trop long (128 caractères max).', 400);
  }
}

export async function hashPasswordBcrypt(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPasswordSecure(password: string, storedHash: string | null | undefined): Promise<boolean> {
  if (!storedHash) {
    await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
    return false;
  }

  // Bcrypt ($2a$, $2b$, $2y$)
  if (storedHash.startsWith('$2')) {
    return bcrypt.compare(password, storedHash);
  }

  // Legacy scrypt salt:hex support
  if (storedHash.includes(':')) {
    const [salt, key] = storedHash.split(':');
    try {
      const keyBuffer = Buffer.from(key, 'hex');
      const derivedKey = crypto.scryptSync(password, salt, 64);
      return keyBuffer.length === derivedKey.length && crypto.timingSafeEqual(keyBuffer, derivedKey);
    } catch {
      return false;
    }
  }

  return false;
}

export function toSafeUserDTO(user: any): SafeUserDTO {
  return {
    id: user.id,
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || user.email.split('@')[0],
    avatarUrl: user.avatarUrl || '👑',
    highestScore: user.highestScore || 0,
    gamesPlayed: user.gamesPlayed || 0,
    duelsWon: user.duelsWon || 0,
    emailVerified: user.emailVerified || 0,
  };
}

export function createAuthService(deps: AuthDependencies = defaultDeps) {
  return {
    async requestRegistrationCode(params: {
      email: string;
      password: string;
      displayName?: string;
      avatarUrl?: string;
      clientIp?: string;
      nowMs?: number;
    }) {
      const cleanEmail = (params.email || '').trim().toLowerCase();
      if (!isValidEmail(cleanEmail)) {
        throw new OtpError('Veuillez saisir une adresse e-mail valide.', 400);
      }
      validatePasswordStrength(params.password);
      const validUsername = validateUsername(params.displayName) || cleanEmail.split('@')[0];

      const existing = await deps.getUserByEmail(cleanEmail);
      const nowMs = params.nowMs ?? Date.now();
      const genericExpiresAt = new Date(nowMs + OTP_TTL_MS).toISOString();
      const cooldownSeconds = Math.round(RESEND_COOLDOWN_MS / 1000);

      // Anti-enumeration: if an active verified password account already exists,
      // do not reveal account existence in the HTTP response.
      if (existing && existing.emailVerified === 1 && existing.passwordHash) {
        return {
          success: true,
          message:
            'Si cette adresse e-mail est éligible, un code de vérification à 6 chiffres vient d’être envoyé par e-mail (valable 10 minutes).',
          expiresAt: genericExpiresAt,
          expiresInSeconds: 600,
          cooldownSeconds,
          deliveredToRealInbox: false,
          relayType: 'smtp' as EmailRelayType,
        };
      }

      const passwordHash = await hashPasswordBcrypt(params.password);
      const issued = await deps.otp.issueCode({
        email: cleanEmail,
        purpose: 'register',
        pendingPayload: {
          displayName: validUsername,
          avatarUrl: params.avatarUrl || '👑',
          passwordHash,
        },
        clientIp: params.clientIp,
        nowMs,
      });

      let deliveredToRealInbox = false;
      let isRealSmtp = false;
      let relayType: EmailRelayType = 'ethereal';
      let previewUrl: string | false | undefined;
      let messageId: string | undefined;

      try {
        const mailRes = await deps.sendVerificationEmail(
          cleanEmail,
          issued.code,
          validUsername,
          'account_creation'
        );
        deliveredToRealInbox = mailRes.deliveredToRealInbox;
        isRealSmtp = mailRes.isRealSmtp;
        relayType = mailRes.relayType;
        previewUrl = mailRes.previewUrl;
        messageId = mailRes.messageId;
      } catch (err: any) {
        console.error('[AUTH SMTP ERROR]', err.message);
      }

      return {
        success: true,
        message: deliveredToRealInbox
          ? `Un code de vérification à 6 chiffres a été envoyé à ${cleanEmail} (valable 10 minutes).`
          : previewUrl
          ? 'Code généré via relais d’aperçu Ethereal (configurez SMTP dans .env pour l’envoi direct vers Gmail).'
          : 'Code généré et prêt pour vérification (validité 10 minutes).',
        expiresAt: issued.expiresAt.toISOString(),
        expiresInSeconds: 600,
        cooldownSeconds: issued.cooldownSeconds,
        isRealSmtp,
        deliveredToRealInbox,
        relayType,
        previewUrl: previewUrl || undefined,
        messageId,
        emailDetails: {
          to: cleanEmail,
          isRealSmtp,
          deliveredToRealInbox,
          relayType,
          previewUrl: previewUrl || undefined,
          messageId,
        },
      };
    },

    async confirmRegistrationCode(params: {
      email: string;
      code: string;
      clientIp?: string;
      nowMs?: number;
    }) {
      const cleanEmail = (params.email || '').trim().toLowerCase();
      if (!isValidEmail(cleanEmail)) {
        throw new OtpError('Adresse e-mail invalide.', 400);
      }

      const verified = await deps.otp.verifyCode({
        email: cleanEmail,
        purpose: 'register',
        code: params.code,
        consume: true,
        clientIp: params.clientIp,
        nowMs: params.nowMs,
      });

      const payload = verified.pendingPayload;
      if (!payload?.passwordHash) {
        throw new OtpError('Données d’inscription expirées. Veuillez recommencer.', 400);
      }

      const user = await deps.createOrActivateEmailUser({
        email: cleanEmail,
        passwordHash: payload.passwordHash,
        displayName: payload.displayName,
        avatarUrl: payload.avatarUrl || '👑',
      });

      const safeUser = toSafeUserDTO(user);
      return {
        success: true,
        user: safeUser,
        token: safeUser.uid,
        message: 'Adresse e-mail vérifiée et compte activé avec succès !',
      };
    },

    async loginWithPassword(params: { email: string; password: string }) {
      const cleanEmail = (params.email || '').trim().toLowerCase();
      if (!isValidEmail(cleanEmail) || !params.password) {
        throw new OtpError('Adresse e-mail ou mot de passe incorrect.', 401);
      }

      const user = await deps.getUserByEmail(cleanEmail);
      const valid = await verifyPasswordSecure(params.password, user?.passwordHash);

      if (!user || !valid || user.emailVerified !== 1) {
        throw new OtpError('Adresse e-mail ou mot de passe incorrect.', 401);
      }

      const safeUser = toSafeUserDTO(user);
      return {
        success: true,
        user: safeUser,
        token: safeUser.uid,
        message: 'Connexion réussie.',
      };
    },

    async requestResetCode(params: {
      email: string;
      clientIp?: string;
      nowMs?: number;
    }) {
      const cleanEmail = (params.email || '').trim().toLowerCase();
      if (!isValidEmail(cleanEmail)) {
        throw new OtpError('Veuillez saisir une adresse e-mail valide.', 400);
      }

      const nowMs = params.nowMs ?? Date.now();
      const cooldownSeconds = Math.round(RESEND_COOLDOWN_MS / 1000);
      const genericMsg =
        'Si un compte correspond à cette adresse e-mail, un code de sécurité à 6 chiffres vient d’être envoyé (valable 10 minutes).';

      const existing = await deps.getUserByEmail(cleanEmail);
      if (!existing) {
        // Still record rate limit against abuse without revealing non-existence
        return {
          success: true,
          message: genericMsg,
          expiresAt: new Date(nowMs + OTP_TTL_MS).toISOString(),
          expiresInSeconds: 600,
          cooldownSeconds,
          deliveredToRealInbox: false,
          relayType: 'smtp' as EmailRelayType,
        };
      }

      const issued = await deps.otp.issueCode({
        email: cleanEmail,
        purpose: 'reset',
        pendingPayload: null,
        clientIp: params.clientIp,
        nowMs,
      });

      let deliveredToRealInbox = false;
      let isRealSmtp = false;
      let relayType: EmailRelayType = 'ethereal';
      let previewUrl: string | false | undefined;
      let messageId: string | undefined;

      try {
        const mailRes = await deps.sendVerificationEmail(
          cleanEmail,
          issued.code,
          existing.displayName || cleanEmail.split('@')[0],
          'password_reset'
        );
        deliveredToRealInbox = mailRes.deliveredToRealInbox;
        isRealSmtp = mailRes.isRealSmtp;
        relayType = mailRes.relayType;
        previewUrl = mailRes.previewUrl;
        messageId = mailRes.messageId;
      } catch (err: any) {
        console.error('[RESET SMTP ERROR]', err.message);
      }

      return {
        success: true,
        message: genericMsg,
        expiresAt: issued.expiresAt.toISOString(),
        expiresInSeconds: 600,
        cooldownSeconds: issued.cooldownSeconds,
        isRealSmtp,
        deliveredToRealInbox,
        relayType,
        previewUrl: previewUrl || undefined,
        messageId,
        emailDetails: {
          to: cleanEmail,
          isRealSmtp,
          deliveredToRealInbox,
          relayType,
          previewUrl: previewUrl || undefined,
          messageId,
        },
      };
    },

    async verifyResetCode(params: {
      email: string;
      code: string;
      clientIp?: string;
      nowMs?: number;
    }) {
      const cleanEmail = (params.email || '').trim().toLowerCase();
      if (!isValidEmail(cleanEmail)) {
        throw new OtpError('Adresse e-mail invalide.', 400);
      }

      const verified = await deps.otp.verifyCode({
        email: cleanEmail,
        purpose: 'reset',
        code: params.code,
        consume: false,
        clientIp: params.clientIp,
        nowMs: params.nowMs,
      });

      return {
        success: true,
        valid: true,
        expiresAt: verified.expiresAt.toISOString(),
        message: 'Code vérifié ! Choisissez maintenant votre nouveau mot de passe.',
      };
    },

    async confirmPasswordReset(params: {
      email: string;
      code: string;
      newPassword: string;
      clientIp?: string;
      nowMs?: number;
    }) {
      const cleanEmail = (params.email || '').trim().toLowerCase();
      if (!isValidEmail(cleanEmail)) {
        throw new OtpError('Adresse e-mail invalide.', 400);
      }
      validatePasswordStrength(params.newPassword);

      // Verify and immediately consume (single-use invalidation)
      await deps.otp.verifyCode({
        email: cleanEmail,
        purpose: 'reset',
        code: params.code,
        consume: true,
        clientIp: params.clientIp,
        nowMs: params.nowMs,
      });

      const newHash = await hashPasswordBcrypt(params.newPassword);
      const updatedUser = await deps.updateUserPasswordByEmail(cleanEmail, newHash);
      if (!updatedUser) {
        throw new OtpError('Impossible de mettre à jour le mot de passe.', 400);
      }

      const safeUser = toSafeUserDTO(updatedUser);
      return {
        success: true,
        user: safeUser,
        token: safeUser.uid,
        message: 'Mot de passe mis à jour avec succès. Le code a été invalidé.',
      };
    },
  };
}

export const authService = createAuthService();
