// Database tables. After changing this file run `npm run db:generate` and commit
// the new SQL in `drizzle/`. CI fails if the two are out of sync.
// Column names are snake_case in Postgres (see `casing` in drizzle.config.ts).

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import type { MissionReport } from '../../../shared/scores.ts';

export const proficiency = pgEnum('proficiency', ['beginner', 'intermediate', 'advanced']);

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

export const players = pgTable(
  'players',
  {
    /** The login provider's user id. */
    id: text().primaryKey(),
    displayName: text().notNull(),
    /** BCP-47 tag, e.g. "ja-JP". */
    targetLanguage: text().notNull(),
    level: proficiency().notNull().default('beginner'),
    xp: integer().notNull().default(0),
    createdAt: createdAt(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [check('players_xp_non_negative', sql`${t.xp} >= 0`)],
);

/** One attempt at a mission. `DialogueRequest.sessionId` is this id. */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid().primaryKey().defaultRandom(),
    playerId: text()
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    missionId: text().notNull(),
    language: text().notNull(),
    level: proficiency().notNull(),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** Null while the mission is in progress. */
    endedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index('sessions_player_started_idx').on(t.playerId, t.startedAt)],
);

/** The conversation so far, so each /api/dialogue call can send the history to the model. */
export const dialogueTurns = pgTable(
  'dialogue_turns',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    sessionId: uuid()
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    /** 0, 1, 2... within the session. */
    turn: integer().notNull(),
    playerText: text().notNull(),
    npcText: text().notNull(),
    completedObjectives: text().array().notNull().default(sql`'{}'::text[]`),
    createdAt: createdAt(),
  },
  (t) => [unique('dialogue_turns_session_turn_key').on(t.sessionId, t.turn)],
);

/** One report per finished session. `overall` and `xpEarned` are copied out of `report` for queries. */
export const missionReports = pgTable(
  'mission_reports',
  {
    sessionId: uuid()
      .primaryKey()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    overall: integer().notNull(),
    xpEarned: integer().notNull(),
    report: jsonb().$type<MissionReport>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check('mission_reports_overall_range', sql`${t.overall} between 0 and 100`),
    check('mission_reports_xp_non_negative', sql`${t.xpEarned} >= 0`),
  ],
);

// Campaign accounts are independent of the retained language-learning tables.
export const gameAccounts = pgTable('game_accounts', {
  id: uuid().primaryKey().defaultRandom(), issuer: text().notNull(), subject: text().notNull(),
  displayName: text().notNull(), createdAt: createdAt(),
}, t => [unique('game_accounts_identity_key').on(t.issuer, t.subject)]);
export const gameSessions = pgTable('game_sessions', {
  tokenHash: text().primaryKey(), accountId: uuid().notNull().references(() => gameAccounts.id, {onDelete:'cascade'}),
  csrfToken: text().notNull(), expiresAt: timestamp({withTimezone:true}).notNull(), createdAt: createdAt(),
  /** This sign-in created the account, so the browser's guest company may be saved to it unasked. */
  createdAccount: boolean().notNull().default(false),
}, t => [index('game_sessions_account_idx').on(t.accountId)]);
/** Password sign-in for accounts whose identity is issuer `email` with the normalised email as subject. */
export const gameEmailCredentials = pgTable('game_email_credentials', {
  accountId: uuid().primaryKey().references(() => gameAccounts.id, {onDelete:'cascade'}), passwordHash: text().notNull(),
  failedAttempts: integer().notNull().default(0), lockedUntil: timestamp({withTimezone:true}), createdAt: createdAt(),
}, t => [check('game_email_credentials_failed_attempts', sql`${t.failedAttempts} >= 0`)]);
export const gameAuthAttempts = pgTable('game_auth_attempts', {
  stateHash: text().primaryKey(), bindingHash: text().notNull(), nonce: text().notNull(), verifier: text().notNull(),
  expiresAt: timestamp({withTimezone:true}).notNull(),
});
export const gameRuns = pgTable('game_runs', {
  runId: text().primaryKey(), accountId: uuid().notNull().references(() => gameAccounts.id, {onDelete:'cascade'}),
  revision: integer().notNull(), envelope: jsonb().$type<import('../../../shared/campaign.ts').CampaignEnvelope>().notNull(),
  updatedAt: timestamp({withTimezone:true}).notNull().defaultNow(),
}, t => [check('game_runs_positive_revision', sql`${t.revision} > 0`), index('game_runs_owner_updated_idx').on(t.accountId, t.updatedAt)]);

/** Anonymous player feedback, independent of accounts and browser saves. */
export const gameFeedback = pgTable('game_feedback', {
  id: uuid().primaryKey().defaultRandom(),
  message: text().notNull(),
  mode: text().$type<'campaign' | 'classic'>().notNull(),
  createdAt: createdAt(),
}, t => [
  check('game_feedback_message_length', sql`char_length(btrim(${t.message})) between 1 and 2000`),
  check('game_feedback_mode', sql`${t.mode} in ('campaign', 'classic')`),
]);
