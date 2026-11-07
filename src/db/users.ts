import { db } from './index.ts';
import { users, gameScores } from './schema.ts';
import { eq, desc, sql } from 'drizzle-orm';

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
