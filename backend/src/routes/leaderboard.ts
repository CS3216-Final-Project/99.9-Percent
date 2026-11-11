import { and, asc, count, desc, eq, gt, lt, or } from 'drizzle-orm';
import { Router } from 'express';
import {
  LEADERBOARD_GRADES, LEADERBOARD_NAME_MAX, LEADERBOARD_NAME_PATTERN, LEADERBOARD_OUTCOMES,
  type LeaderboardEntry, type LeaderboardResponse, type LeaderboardSubmission, type LeaderboardSubmitResponse,
} from '../../../shared/leaderboard.js';
import { getDb, isDbConfigured } from '../db/client.js';
import { gameLeaderboard } from '../db/schema.js';

export const leaderboardRouter = Router();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOP = 10;
const RECENT = 6;
const noStore = { 'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store' };
const unavailable = { error: 'The leaderboard is temporarily unavailable.' };
const whole = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;

/** The submission, trimmed and checked, or null when any field is out of range. */
export function parseSubmission(body: unknown): LeaderboardSubmission | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const { id, name, score, grade, weeks, users, outcome } = body as Record<string, unknown>;
  if (typeof id !== 'string' || !uuid.test(id) || typeof name !== 'string') return null;
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (trimmed.length < 1 || trimmed.length > LEADERBOARD_NAME_MAX || !LEADERBOARD_NAME_PATTERN.test(trimmed)) return null;
  if (!whole(score, 0, 100) || !whole(weeks, 0, 520) || !whole(users, 0, 1_000_000_000)) return null;
  if (!LEADERBOARD_GRADES.includes(grade as never) || !LEADERBOARD_OUTCOMES.includes(outcome as never)) return null;
  return { id: id.toLowerCase(), name: trimmed, score, grade: grade as LeaderboardSubmission['grade'], weeks, users,
    outcome: outcome as LeaderboardSubmission['outcome'] };
}

type Row = typeof gameLeaderboard.$inferSelect;
const entry = (r: Row): LeaderboardEntry => ({
  name: r.name, score: r.score, grade: r.grade, weeks: r.weeks, users: r.users, outcome: r.outcome,
  createdAt: r.createdAt.toISOString(),
});
const sameRun = (r: Row, v: LeaderboardSubmission) =>
  r.name === v.name && r.score === v.score && r.grade === v.grade && r.weeks === v.weeks && r.users === v.users && r.outcome === v.outcome;

/** Place on the board: visible entries with a higher score, or the same score posted earlier, come first. */
async function placing(row: Row): Promise<{ rank: number; total: number }> {
  const db = getDb();
  const visible = eq(gameLeaderboard.hidden, false);
  const [[ahead], [all]] = await Promise.all([
    db.select({ n: count() }).from(gameLeaderboard).where(and(visible, or(
      gt(gameLeaderboard.score, row.score),
      and(eq(gameLeaderboard.score, row.score), lt(gameLeaderboard.createdAt, row.createdAt)),
    ))),
    db.select({ n: count() }).from(gameLeaderboard).where(visible),
  ]);
  return { rank: ahead.n + 1, total: all.n };
}

leaderboardRouter.post('/', async (req, res) => {
  const value = parseSubmission(req.body);
  if (!value) {
    res.status(400).json({ error: `Provide a submission ID, a 1–${LEADERBOARD_NAME_MAX} character name and a valid Challenge Mode result.` });
    return;
  }
  if (!isDbConfigured()) {
    res.status(503).json(unavailable);
    return;
  }
  try {
    const db = getDb();
    const [saved] = await db.insert(gameLeaderboard).values(value).onConflictDoNothing({ target: gameLeaderboard.id }).returning();
    if (saved) {
      res.status(201).json({ id: saved.id, ...(await placing(saved)) } satisfies LeaderboardSubmitResponse);
      return;
    }
    // A response can be lost after the insert; an identical retry is acknowledged instead of stored twice.
    const [existing] = await db.select().from(gameLeaderboard).where(eq(gameLeaderboard.id, value.id));
    if (existing && sameRun(existing, value)) {
      res.status(200).json({ id: existing.id, ...(await placing(existing)) } satisfies LeaderboardSubmitResponse);
      return;
    }
    res.status(409).json({ error: 'Submission ID already used for a different result.' });
  } catch {
    console.error('Leaderboard persistence failed.');
    res.status(503).json(unavailable);
  }
});

leaderboardRouter.get('/', async (_req, res) => {
  if (!isDbConfigured()) {
    res.set(noStore).status(503).json(unavailable);
    return;
  }
  try {
    const db = getDb();
    const visible = eq(gameLeaderboard.hidden, false);
    const [top, recent, [all]] = await Promise.all([
      db.select().from(gameLeaderboard).where(visible).orderBy(desc(gameLeaderboard.score), asc(gameLeaderboard.createdAt)).limit(TOP),
      db.select().from(gameLeaderboard).where(visible).orderBy(desc(gameLeaderboard.createdAt)).limit(RECENT),
      db.select({ n: count() }).from(gameLeaderboard).where(visible),
    ]);
    const body: LeaderboardResponse = { top: top.map(entry), recent: recent.map(entry), total: all.n, generatedAt: new Date().toISOString() };
    // A few seconds at the CDN keeps a polling booth screen cheap while still feeling live.
    res.set('Cache-Control', 'public, max-age=0, s-maxage=5, stale-while-revalidate=10').json(body);
  } catch {
    console.error('Leaderboard query failed.');
    res.set(noStore).status(503).json(unavailable);
  }
});
