// Database tables. After changing this file run `npm run db:generate` and commit
// the new SQL in `drizzle/`. CI fails if the two are out of sync.
// Column names are snake_case in Postgres (see `casing` in drizzle.config.ts).

import { sql } from 'drizzle-orm';
import {
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
