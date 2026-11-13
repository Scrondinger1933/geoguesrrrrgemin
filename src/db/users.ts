import { db } from './index.ts';
import { users, gameScores, verificationCodes } from './schema.ts';
import { eq, desc, and, gte } from 'drizzle-orm';
import crypto from 'crypto';

// Upsert user upon Firebase login
export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string,
  avatarUrl?: string
) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email: email.trim().toLowerCase(),
        displayName: displayName || email.split('@')[0],
        avatarUrl: avatarUrl || '',
        emailVerified: 1,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: email.trim().toLowerCase(),
          updatedAt: new Date(),
          ...(displayName ? { displayName } : {}),
          ...(avatarUrl ? { avatarUrl } : {}),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Error syncing user in Cloud SQL:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const res = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  return res[0] || null;
}

export async function getUserByUid(uid: string) {
  const res = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
  return res[0] || null;
}

export async function createOrActivateEmailUser(params: {
  email: string;
  passwordHash: string;
  displayName?: string;
  avatarUrl?: string;
}) {
  const normalizedEmail = params.email.trim().toLowerCase();
  const existing = await getUserByEmail(normalizedEmail);

  if (existing) {
    const updated = await db
      .update(users)
      .set({
        passwordHash: params.passwordHash,
        emailVerified: 1,
        updatedAt: new Date(),
        ...(params.displayName ? { displayName: params.displayName } : {}),
        ...(params.avatarUrl ? { avatarUrl: params.avatarUrl } : {}),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return updated[0];
  }

  const customUid = `email_${crypto.randomBytes(10).toString('hex')}`;
  const inserted = await db
    .insert(users)
    .values({
      uid: customUid,
      email: normalizedEmail,
      displayName: params.displayName || normalizedEmail.split('@')[0],
      avatarUrl: params.avatarUrl || '👑',
      passwordHash: params.passwordHash,
      emailVerified: 1,
    })
    .returning();

  return inserted[0];
}

export async function updateUserPasswordByEmail(email: string, passwordHash: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await getUserByEmail(normalizedEmail);
  if (!existing) return null;

  const updated = await db
    .update(users)
    .set({
      passwordHash,
      emailVerified: 1,
      updatedAt: new Date(),
    })
    .where(eq(users.id, existing.id))
    .returning();

  return updated[0] || null;
}

// Record completed game score
export async function recordGameScore(
  uid: string,
  mode: string,
  score: number,
  roundsCompleted: number,
  isVictory: boolean = false
) {
  try {
    const existingUser = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (!existingUser || existingUser.length === 0) {
      throw new Error(`User with uid ${uid} not found`);
    }

    const userRecord = existingUser[0];

    await db.insert(gameScores).values({
      userId: userRecord.id,
      mode,
      score,
      roundsCompleted,
    });

    const newHighest = Math.max(userRecord.highestScore, score);
    const newGamesPlayed = userRecord.gamesPlayed + 1;
    const newDuelsWon = isVictory ? userRecord.duelsWon + 1 : userRecord.duelsWon;

    await db
      .update(users)
      .set({
        highestScore: newHighest,
        gamesPlayed: newGamesPlayed,
        duelsWon: newDuelsWon,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userRecord.id));

    return { success: true };
  } catch (error) {
    console.error('Error recording game score in Cloud SQL:', error);
    throw new Error('Failed to record game score.', { cause: error });
  }
}

// Get global leaderboard from Cloud SQL
export async function getTopLeaderboard(limit = 10) {
  try {
    return await db
      .select({
        id: users.id,
        displayName: users.displayName,
        highestScore: users.highestScore,
        gamesPlayed: users.gamesPlayed,
        duelsWon: users.duelsWon,
      })
      .from(users)
      .orderBy(desc(users.highestScore))
      .limit(limit);
  } catch (error) {
    console.error('Error fetching leaderboard from Cloud SQL:', error);
    throw new Error('Failed to fetch leaderboard.', { cause: error });
  }
}

// Compatibility helpers
export async function createVerificationCode(email: string): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();
  const code = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.insert(verificationCodes).values({
    email: normalizedEmail,
    purpose: 'general',
    code: 'HASHED',
    codeHash: code,
    expiresAt,
    used: 0,
  });

  return code;
}

export async function verifyCodeAndCreateAccount(
  email: string,
  code: string,
  displayName?: string,
  avatarUrl?: string
) {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedCode = code.trim();

  const records = await db
    .select()
    .from(verificationCodes)
    .where(
      and(
        eq(verificationCodes.email, normalizedEmail),
        eq(verificationCodes.codeHash, trimmedCode),
        eq(verificationCodes.used, 0),
        gte(verificationCodes.expiresAt, new Date())
      )
    )
    .orderBy(desc(verificationCodes.id))
    .limit(1);

  if (!records || records.length === 0) {
    throw new Error('Code de vérification invalide ou expiré.');
  }

  await db
    .update(verificationCodes)
    .set({ used: 1, usedAt: new Date() })
    .where(eq(verificationCodes.id, records[0].id));

  return createOrActivateEmailUser({
    email: normalizedEmail,
    passwordHash: '',
    displayName,
    avatarUrl,
  });
}

export async function quickCreateAccount(
  email: string,
  displayName?: string,
  avatarUrl?: string
) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await getUserByEmail(normalizedEmail);
  if (existing) return existing;

  const customUid = `email_${crypto.randomBytes(10).toString('hex')}`;
  const inserted = await db
    .insert(users)
    .values({
      uid: customUid,
      email: normalizedEmail,
      displayName: displayName || normalizedEmail.split('@')[0],
      avatarUrl: avatarUrl || '👑',
      emailVerified: 1,
    })
    .returning();

  return inserted[0];
}
