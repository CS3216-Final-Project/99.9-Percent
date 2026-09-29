import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { beforeAll, describe, expect, it } from 'vitest';
import type { MissionReport } from '../../shared/scores.ts';
import * as schema from '../src/db/schema.js';

// Runs the real migrations in drizzle/ against an in-memory Postgres (PGlite),
// so a broken migration fails CI before it reaches Neon.
const db = drizzle({ client: new PGlite(), schema, casing: 'snake_case' });
const { players, sessions, dialogueTurns, missionReports } = schema;

beforeAll(async () => {
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
});

describe('database schema', () => {
  it('stores a player, a session, its turns and its report', async () => {
    await db.insert(players).values({ id: 'u1', displayName: 'Aki', targetLanguage: 'ja-JP' });
    const [session] = await db
      .insert(sessions)
      .values({ playerId: 'u1', missionId: 'lunch', language: 'ja-JP', level: 'beginner' })
      .returning();

    await db.insert(dialogueTurns).values([
      { sessionId: session.id, turn: 0, playerText: 'こんにちは', npcText: 'いらっしゃいませ' },
      {
        sessionId: session.id,
        turn: 1,
        playerText: 'ラーメンください',
        npcText: 'はい',
        completedObjectives: ['order'],
      },
    ]);

    const report: MissionReport = {
      missionId: 'lunch',
      overall: 80,
      taskCompletion: { objectives: { order: true }, percent: 100 },
      pronunciation: null,
      grammar: { score: 75, issues: [] },
      vocab: { score: 70, used: ['ラーメン'], missed: [] },
      xpEarned: 40,
    };
    await db.insert(missionReports).values({ sessionId: session.id, overall: 80, xpEarned: 40, report });

    const [player] = await db.select().from(players).where(eq(players.id, 'u1'));
    expect(player.level).toBe('beginner');
    expect(player.xp).toBe(0);

    const turns = await db.select().from(dialogueTurns).where(eq(dialogueTurns.sessionId, session.id));
    expect(turns.map((t) => t.completedObjectives)).toEqual([[], ['order']]);

    const [saved] = await db.select().from(missionReports);
    expect(saved.report).toEqual(report);
  });

  it('rejects a duplicate turn number in the same session', async () => {
    const [session] = await db.select().from(sessions).limit(1);
    await expect(
      db.insert(dialogueTurns).values({ sessionId: session.id, turn: 0, playerText: 'a', npcText: 'b' }),
    ).rejects.toThrow();
  });

  it('rejects an overall score above 100', async () => {
    await db.insert(players).values({ id: 'u2', displayName: 'Ben', targetLanguage: 'zh-CN' });
    const [session] = await db
      .insert(sessions)
      .values({ playerId: 'u2', missionId: 'taxi', language: 'zh-CN', level: 'advanced' })
      .returning();
    await expect(
      db.insert(missionReports).values({
        sessionId: session.id,
        overall: 101,
        xpEarned: 0,
        report: {} as MissionReport,
      }),
    ).rejects.toThrow();
  });

  it('deleting a player deletes their sessions, turns and reports', async () => {
    await db.delete(players).where(eq(players.id, 'u1'));
    expect(await db.select().from(sessions).where(eq(sessions.playerId, 'u1'))).toEqual([]);
    expect(await db.select().from(dialogueTurns)).toEqual([]);
    expect(await db.select().from(missionReports)).toEqual([]);
  });
});
