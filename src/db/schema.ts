import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Users table authenticated via Email + Password (bcrypt) or Google Firebase Auth
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Auth UID (email_uid or Firebase UID)
  email: text('email').notNull(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  passwordHash: text('password_hash'), // bcrypt / scrypt hash (null for pure OAuth accounts)
  emailVerified: integer('email_verified').default(0).notNull(), // 1 = verified, 0 = unverified
  gamesPlayed: integer('games_played').default(0).notNull(),
  duelsWon: integer('duels_won').default(0).notNull(),
  highestScore: integer('highest_score').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Cryptographically hashed 6-digit OTP verification codes (10-min TTL, single-use, attempt-limited)
export const verificationCodes = pgTable('verification_codes', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  purpose: text('purpose').default('register').notNull(), // 'register' | 'reset'
  code: text('code').default('HASHED').notNull(), // Always 'HASHED' (plaintext is NEVER stored)
  codeHash: text('code_hash').default('').notNull(), // salt:hmac_sha256
  pendingPayload: text('pending_payload'), // JSON metadata for pending account activation
  attempts: integer('attempts').default(0).notNull(),
  maxAttempts: integer('max_attempts').default(5).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  used: integer('used').default(0).notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Game Scores & Records table
export const gameScores = pgTable('game_scores', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  mode: text('mode').notNull(), // 'duel' | 'classic' | 'blitz' | 'streak'
  score: integer('score').notNull(),
  roundsCompleted: integer('rounds_completed').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relationships
export const usersRelations = relations(users, ({ many }) => ({
  scores: many(gameScores),
}));

export const gameScoresRelations = relations(gameScores, ({ one }) => ({
  user: one(users, {
    fields: [gameScores.userId],
    references: [users.id],
  }),
}));
