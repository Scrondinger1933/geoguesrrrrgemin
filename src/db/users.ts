import { db } from './index.ts';
import { users, gameScores, verificationCodes } from './schema.ts';
import { eq, desc, and, gte } from 'drizzle-orm';

// Upsert user upon login
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
        email,
        displayName: displayName || email.split('@')[0],
        avatarUrl: avatarUrl || '',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
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

// Record completed game score
export async function recordGameScore(
  uid: string,
  mode: string,
  score: number,
  roundsCompleted: number,
  isVictory: boolean = false
) {
  try {
    // 1. Find user by Firebase UID
    const existingUser = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (!existingUser || existingUser.length === 0) {
      throw new Error(`User with uid ${uid} not found`);
    }

    const userRecord = existingUser[0];

    // 2. Insert game score
    await db.insert(gameScores).values({
      userId: userRecord.id,
      mode,
      score,
      roundsCompleted,
    });

    // 3. Update user statistics
    const newHighest = Math.max(userRecord.highestScore, score);
    const newGamesPlayed = userRecord.gamesPlayed + 1;
    const newDuelsWon = isVictory ? userRecord.duelsWon + 1 : userRecord.duelsWon;

    await db
      .update(users)
      .set({
        highestScore: newHighest,
        gamesPlayed: newGamesPlayed,
        duelsWon: newDuelsWon,
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

// 4. Generate & Save a 6-digit verification code in Cloud SQL (valid 15 mins)
export async function createVerificationCode(email: string): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();
  // 6-digit code e.g. 749215
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await db.insert(verificationCodes).values({
    email: normalizedEmail,
    code,
    expiresAt,
    used: 0,
  });

  return code;
}

// 5. Verify the code and activate/create the account in Cloud SQL
export async function verifyCodeAndCreateAccount(
  email: string,
  code: string,
  displayName?: string,
  avatarUrl?: string
) {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedCode = code.trim();

  // Find valid, unexpired, unused code
  const records = await db
    .select()
    .from(verificationCodes)
    .where(
      and(
        eq(verificationCodes.email, normalizedEmail),
        eq(verificationCodes.code, trimmedCode),
        eq(verificationCodes.used, 0),
        gte(verificationCodes.expiresAt, new Date())
      )
    )
    .orderBy(desc(verificationCodes.id))
    .limit(1);

  if (!records || records.length === 0) {
    throw new Error('Code de vérification invalide ou expiré.');
  }

  // Mark code as used
  await db
    .update(verificationCodes)
    .set({ used: 1 })
    .where(eq(verificationCodes.id, records[0].id));

  // Find or create user
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  let userRecord;
  if (existing.length > 0) {
    // Update existing user to verified
    const updated = await db
      .update(users)
      .set({
        emailVerified: 1,
        ...(displayName ? { displayName } : {}),
        ...(avatarUrl ? { avatarUrl } : {}),
      })
      .where(eq(users.id, existing[0].id))
      .returning();
    userRecord = updated[0];
  } else {
    // Create new email account
    const customUid = `email_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;
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
    userRecord = inserted[0];
  }

  return userRecord;
}

// 6. Get user by UID
export async function getUserByUid(uid: string) {
  const res = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
  return res[0] || null;
}

