import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Users table authenticated via Firebase Auth (UID is string)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  gamesPlayed: integer('games_played').default(0).notNull(),
  duelsWon: integer('duels_won').default(0).notNull(),
  highestScore: integer('highest_score').default(0).notNull(),
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
