/**
 * Cryptographically Secure 6-Digit OTP Verification Service
 * - CSPRNG generation via crypto.randomInt(100000, 1000000)
 * - Hashed storage ONLY (per-code random 16-byte salt + HMAC-SHA256)
 * - Strict 10-minute expiration window
 * - Single-use atomic invalidation
 * - Attempt limiting (max 5 failed tries per code -> automatic invalidation)
 * - Per-email resend cooldown (60s) & per-key abuse sliding window rate limiter
 */

import crypto from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { verificationCodes } from '../db/schema.ts';

export type OtpPurpose = 'register' | 'reset';

export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes strict
export const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds between resend requests
export const MAX_OTP_ATTEMPTS = 5;
export const ABUSE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const ABUSE_MAX_REQUESTS = 10;

export interface OtpRecord {
  id: number;
  email: string;
  purpose: string;
  codeHash: string;
  pendingPayload: string | null;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  used: number;
  usedAt: Date | null;
  createdAt: Date | null;
}

export interface OtpStore {
  getLatestActive(email: string, purpose: OtpPurpose): Promise<OtpRecord | null>;
  getLatestAny(email: string, purpose: OtpPurpose): Promise<OtpRecord | null>;
  invalidateAllActive(email: string, purpose: OtpPurpose, usedAt: Date): Promise<void>;
  insertCode(data: {
    email: string;
    purpose: OtpPurpose;
    codeHash: string;
    pendingPayload: string | null;
    maxAttempts: number;
    expiresAt: Date;
    createdAt: Date;
  }): Promise<OtpRecord>;
  incrementAttempts(id: number, nextAttempts: number, lockAsUsed: boolean, usedAt: Date): Promise<void>;
  markUsed(id: number, usedAt: Date): Promise<boolean>;
}

const getHmacSecret = (): string =>
  process.env.OTP_HMAC_SECRET || process.env.SESSION_SECRET || 'geoapex-otp-server-secret-v1';

export function generateSecureSixDigitCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashOtpCode(email: string, purpose: OtpPurpose, code: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = crypto
    .createHmac('sha256', getHmacSecret())
    .update(`${salt}:${email.trim().toLowerCase()}:${purpose}:${code.trim()}`)
    .digest('hex');
  return `${salt}:${digest}`;
}

export function verifyOtpHash(email: string, purpose: OtpPurpose, code: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, expectedHex] = storedHash.split(':');
  if (!salt || !expectedHex) return false;
  try {
    const actualHex = crypto
      .createHmac('sha256', getHmacSecret())
      .update(`${salt}:${email.trim().toLowerCase()}:${purpose}:${code.trim()}`)
      .digest('hex');
    const a = Buffer.from(expectedHex, 'hex');
    const b = Buffer.from(actualHex, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const postgresOtpStore: OtpStore = {
  async getLatestActive(email, purpose) {
    const rows = await db
      .select()
      .from(verificationCodes)
      .where(
        and(
          eq(verificationCodes.email, email),
          eq(verificationCodes.purpose, purpose),
          eq(verificationCodes.used, 0)
        )
      )
      .orderBy(desc(verificationCodes.id))
      .limit(1);
    return rows[0] || null;
  },

  async getLatestAny(email, purpose) {
    const rows = await db
      .select()
      .from(verificationCodes)
      .where(and(eq(verificationCodes.email, email), eq(verificationCodes.purpose, purpose)))
      .orderBy(desc(verificationCodes.id))
      .limit(1);
    return rows[0] || null;
  },

  async invalidateAllActive(email, purpose, usedAt) {
    await db
      .update(verificationCodes)
      .set({ used: 1, usedAt })
      .where(
        and(
          eq(verificationCodes.email, email),
          eq(verificationCodes.purpose, purpose),
          eq(verificationCodes.used, 0)
        )
      );
  },

  async insertCode(data) {
    const inserted = await db
      .insert(verificationCodes)
      .values({
        email: data.email,
        purpose: data.purpose,
        code: 'HASHED',
        codeHash: data.codeHash,
        pendingPayload: data.pendingPayload,
        attempts: 0,
        maxAttempts: data.maxAttempts,
        expiresAt: data.expiresAt,
        used: 0,
        createdAt: data.createdAt,
      })
      .returning();
    return inserted[0];
  },

  async incrementAttempts(id, nextAttempts, lockAsUsed, usedAt) {
    await db
      .update(verificationCodes)
      .set({
        attempts: nextAttempts,
        ...(lockAsUsed ? { used: 1, usedAt } : {}),
      })
      .where(eq(verificationCodes.id, id));
  },

  async markUsed(id, usedAt) {
    const updated = await db
      .update(verificationCodes)
      .set({ used: 1, usedAt })
      .where(and(eq(verificationCodes.id, id), eq(verificationCodes.used, 0)))
      .returning({ id: verificationCodes.id });
    return updated.length > 0;
  },
};

export class InMemoryRateLimiter {
  private buckets = new Map<string, number[]>();

  checkAndRecord(key: string, nowMs: number, windowMs: number, maxRequests: number): { allowed: boolean; retryAfterSeconds: number } {
    const cutoff = nowMs - windowMs;
    const prev = (this.buckets.get(key) || []).filter((ts) => ts > cutoff);
    if (prev.length >= maxRequests) {
      const oldest = prev[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1000));
      this.buckets.set(key, prev);
      return { allowed: false, retryAfterSeconds };
    }
    prev.push(nowMs);
    this.buckets.set(key, prev);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  clear() {
    this.buckets.clear();
  }
}

export class OtpError extends Error {
  statusCode: number;
  retryAfterSeconds?: number;
  constructor(message: string, statusCode = 400, retryAfterSeconds?: number) {
    super(message);
    this.statusCode = statusCode;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function createOtpService(
  store: OtpStore = postgresOtpStore,
  rateLimiter: InMemoryRateLimiter = new InMemoryRateLimiter()
) {
  return {
    async issueCode(params: {
      email: string;
      purpose: OtpPurpose;
      pendingPayload?: Record<string, any> | null;
      clientIp?: string;
      nowMs?: number;
    }): Promise<{ code: string; expiresAt: Date; cooldownSeconds: number }> {
      const nowMs = params.nowMs ?? Date.now();
      const normalizedEmail = params.email.trim().toLowerCase();

      // Sliding-window abuse check by IP & email
      if (params.clientIp) {
        const ipCheck = rateLimiter.checkAndRecord(
          `ip:${params.clientIp}`,
          nowMs,
          ABUSE_WINDOW_MS,
          ABUSE_MAX_REQUESTS
        );
        if (!ipCheck.allowed) {
          throw new OtpError(
            `Trop de requêtes détectées. Réessayez dans ${ipCheck.retryAfterSeconds}s.`,
            429,
            ipCheck.retryAfterSeconds
          );
        }
      }

      const emailAbuse = rateLimiter.checkAndRecord(
        `email:${params.purpose}:${normalizedEmail}`,
        nowMs,
        ABUSE_WINDOW_MS,
        ABUSE_MAX_REQUESTS
      );
      if (!emailAbuse.allowed) {
        throw new OtpError(
          `Trop de demandes pour cette adresse. Réessayez dans ${emailAbuse.retryAfterSeconds}s.`,
          429,
          emailAbuse.retryAfterSeconds
        );
      }

      // Enforce per-email resend cooldown using latest active or recent OTP timestamp
      const latest = await store.getLatestActive(normalizedEmail, params.purpose);
      if (latest?.createdAt) {
        const elapsed = nowMs - latest.createdAt.getTime();
        if (elapsed >= 0 && elapsed < RESEND_COOLDOWN_MS) {
          const waitSec = Math.max(1, Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000));
          throw new OtpError(
            `Veuillez patienter ${waitSec}s avant de demander un nouveau code.`,
            429,
            waitSec
          );
        }
      }

      // Invalidate any previous active codes before issuing a fresh one
      await store.invalidateAllActive(normalizedEmail, params.purpose, new Date(nowMs));

      const code = generateSecureSixDigitCode();
      const codeHash = hashOtpCode(normalizedEmail, params.purpose, code);
      const expiresAt = new Date(nowMs + OTP_TTL_MS);

      await store.insertCode({
        email: normalizedEmail,
        purpose: params.purpose,
        codeHash,
        pendingPayload: params.pendingPayload ? JSON.stringify(params.pendingPayload) : null,
        maxAttempts: MAX_OTP_ATTEMPTS,
        expiresAt,
        createdAt: new Date(nowMs),
      });

      return {
        code,
        expiresAt,
        cooldownSeconds: Math.round(RESEND_COOLDOWN_MS / 1000),
      };
    },

    async verifyCode(params: {
      email: string;
      purpose: OtpPurpose;
      code: string;
      consume: boolean;
      clientIp?: string;
      nowMs?: number;
    }): Promise<{ pendingPayload: Record<string, any> | null; expiresAt: Date }> {
      const nowMs = params.nowMs ?? Date.now();
      const normalizedEmail = params.email.trim().toLowerCase();
      const trimmedCode = params.code.trim();

      if (!/^\d{6}$/.test(trimmedCode)) {
        throw new OtpError('Le code doit contenir exactement 6 chiffres.', 400);
      }

      if (params.clientIp) {
        const verifyRate = rateLimiter.checkAndRecord(
          `verify-ip:${params.clientIp}`,
          nowMs,
          ABUSE_WINDOW_MS,
          25
        );
        if (!verifyRate.allowed) {
          throw new OtpError(
            `Trop de tentatives de vérification. Réessayez dans ${verifyRate.retryAfterSeconds}s.`,
            429,
            verifyRate.retryAfterSeconds
          );
        }
      }

      const record = await store.getLatestActive(normalizedEmail, params.purpose);
      if (!record) {
        throw new OtpError('Code de vérification invalide, expiré ou déjà utilisé.', 400);
      }

      if (record.expiresAt.getTime() <= nowMs) {
        await store.markUsed(record.id, new Date(nowMs));
        throw new OtpError('Ce code a expiré (validité de 10 minutes dépassée). Demandez un nouveau code.', 400);
      }

      if (record.attempts >= record.maxAttempts) {
        await store.markUsed(record.id, new Date(nowMs));
        throw new OtpError('Nombre maximal de tentatives atteint. Demandez un nouveau code.', 429);
      }

      const matches = verifyOtpHash(normalizedEmail, params.purpose, trimmedCode, record.codeHash);
      if (!matches) {
        const nextAttempts = record.attempts + 1;
        const exhausted = nextAttempts >= record.maxAttempts;
        await store.incrementAttempts(record.id, nextAttempts, exhausted, new Date(nowMs));
        const remaining = record.maxAttempts - nextAttempts;
        throw new OtpError(
          exhausted
            ? 'Code incorrect. Trop de tentatives erronées : ce code est maintenant invalidé.'
            : `Code incorrect. ${remaining} tentative${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}.`,
          exhausted ? 429 : 400
        );
      }

      if (params.consume) {
        const consumed = await store.markUsed(record.id, new Date(nowMs));
        if (!consumed) {
          throw new OtpError('Ce code a déjà été utilisé.', 400);
        }
      }

      let parsedPayload: Record<string, any> | null = null;
      if (record.pendingPayload) {
        try {
          parsedPayload = JSON.parse(record.pendingPayload);
        } catch {
          parsedPayload = null;
        }
      }

      return { pendingPayload: parsedPayload, expiresAt: record.expiresAt };
    },
  };
}

export const defaultOtpRateLimiter = new InMemoryRateLimiter();
export const otpService = createOtpService(postgresOtpStore, defaultOtpRateLimiter);
