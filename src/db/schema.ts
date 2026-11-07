import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Users table authenticated via Firebase Auth or Email + Verification Code
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Auth UID (Firebase or email_uid)
  email: text('email').notNull(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  emailVerified: integer('email_verified').default(0).notNull(), // 1 = verified, 0 = unverified
  gamesPlayed: integer('games_played').default(0).notNull(),
  duelsWon: integer('duels_won').default(0).notNull(),
  highestScore: integer('highest_score').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Verification Codes for Email Account Creation & Sign In
export const verificationCodes = pgTable('verification_codes', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  code: text('code').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  used: integer('used').default(0).notNull(),
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
