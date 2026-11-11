import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import * as schema from '../src/db/schema.js';

const availability = vi.hoisted(() => ({ configured: true, fail: false }));
const client = new PGlite();
const db = drizzle({ client, schema, casing: 'snake_case' });
vi.mock('../src/db/client.js', () => ({
  isDbConfigured: () => availability.configured,
  getDb: () => {
    if (availability.fail) throw new Error('Database unavailable');
    return db;
  },
}));
let app: typeof import('../src/app.js').default;
const post = {
  id: '5d0c2b9e-3f6a-4b8e-9c1d-2a7f0e4b6c11', name: '  Ada   Lovelace ', score: 72, grade: 'B', weeks: 18, users: 51_234, outcome: 'won',
};
const at = (minutes: number) => new Date(Date.UTC(2026, 0, 1, 7, minutes));
async function seed(name: string, score: number, minutes: number, hidden = false) {
  await db.insert(schema.gameLeaderboard).values({ name, score, grade: 'C', weeks: 26, users: 9_000, outcome: 'deadline', hidden, createdAt: at(minutes) });
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
  vi.stubEnv('CORS_ORIGINS', 'http://localhost:5173,https://game.test');
  vi.resetModules();
  app = (await import('../src/app.js')).default;
});
beforeEach(async () => {
  availability.configured = true;
  availability.fail = false;
  vi.restoreAllMocks();
  await db.delete(schema.gameLeaderboard);
});
afterAll(async () => { await client.close(); vi.unstubAllEnvs(); });

it('stores a post with a tidied name and reports its place among visible entries', async () => {
  await seed('Higher', 90, 0);
  await seed('Same but earlier', 72, 1);
  await seed('Lower', 40, 2);
  await seed('Hidden higher', 99, 3, true);
  const response = await request(app).post('/api/leaderboard').send(post);
  expect(response.status).toBe(201);
  expect(response.body).toEqual({ id: post.id, rank: 3, total: 4 });
  const [row] = await db.select().from(schema.gameLeaderboard).where(eq(schema.gameLeaderboard.id, post.id));
  expect(row).toMatchObject({ name: 'Ada Lovelace', score: 72, grade: 'B', outcome: 'won', hidden: false });
});

it('acknowledges an identical retry once and rejects reuse of the ID for another result', async () => {
  const results = await Promise.all([
    request(app).post('/api/leaderboard').send(post),
    request(app).post('/api/leaderboard').send(post),
  ]);
  expect(results.map(r => r.status).sort()).toEqual([200, 201]);
  expect(results.map(r => r.body.rank)).toEqual([1, 1]);
  const conflict = await request(app).post('/api/leaderboard').send({ ...post, score: 100, grade: 'S' });
  expect(conflict.status).toBe(409);
  expect(await db.select().from(schema.gameLeaderboard)).toHaveLength(1);
});

it('rejects malformed posts without writing rows', async () => {
  for (const body of [
    {}, [], null, { ...post, id: 'nope' }, { ...post, name: '   ' }, { ...post, name: 'x'.repeat(17) },
    { ...post, name: '<script>' }, { ...post, name: 'party 🎉' }, { ...post, score: 101 }, { ...post, score: -1 },
    { ...post, score: 50.5 }, { ...post, score: '72' }, { ...post, grade: 'F' }, { ...post, weeks: 521 },
    { ...post, users: 1_000_000_001 }, { ...post, outcome: 'cheated' },
  ]) {
    expect((await request(app).post('/api/leaderboard').send(body ?? undefined)).status).toBe(400);
  }
  expect(await db.select().from(schema.gameLeaderboard)).toEqual([]);
});

it('accepts names in other scripts and simple punctuation', async () => {
  for (const [i, name] of ['陈小明', "O'Brien", 'zi_yao.dev', 'Đức-Anh 2'].entries()) {
    const id = `5d0c2b9e-3f6a-4b8e-9c1d-2a7f0e4b6c2${i}`;
    expect((await request(app).post('/api/leaderboard').send({ ...post, id, name })).status).toBe(201);
  }
});

it('lists the top ten and the latest posts without IDs or hidden entries', async () => {
  for (let i = 0; i < 12; i++) await seed(`Player ${i}`, 50 + i, i);
  await seed('Tie later', 61, 30);
  await seed('Removed', 100, 31, true);
  const response = await request(app).get('/api/leaderboard');
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toBe('public, max-age=0, s-maxage=5, stale-while-revalidate=10');
  expect(response.body.total).toBe(13);
  expect(response.body.top.map((e: { name: string }) => e.name)).toEqual([
    'Player 11', 'Tie later', 'Player 10', 'Player 9', 'Player 8', 'Player 7', 'Player 6', 'Player 5', 'Player 4', 'Player 3',
  ]);
  expect(response.body.recent.map((e: { name: string }) => e.name)).toEqual(['Tie later', 'Player 11', 'Player 10', 'Player 9', 'Player 8', 'Player 7']);
  expect(Object.keys(response.body.top[0]).sort()).toEqual(['createdAt', 'grade', 'name', 'outcome', 'score', 'users', 'weeks']);
  expect(JSON.stringify(response.body)).not.toMatch(/Removed|hidden|"id"/);
});

it('returns an empty board for an empty database', async () => {
  const response = await request(app).get('/api/leaderboard');
  expect(response.body).toMatchObject({ top: [], recent: [], total: 0 });
});

it('reports an unavailable database with uncached 503s and no false success', async () => {
  availability.configured = false;
  expect((await request(app).post('/api/leaderboard').send(post)).status).toBe(503);
  const offline = await request(app).get('/api/leaderboard');
  expect(offline.status).toBe(503);
  expect(offline.headers['cache-control']).toBe('no-store');
  availability.configured = true;
  availability.fail = true;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  expect((await request(app).post('/api/leaderboard').send(post)).status).toBe(503);
  const failed = await request(app).get('/api/leaderboard');
  expect(failed.status).toBe(503);
  expect(failed.headers['vercel-cdn-cache-control']).toBe('no-store');
  availability.fail = false;
  expect(await db.select().from(schema.gameLeaderboard)).toEqual([]);
});

it('enforces the ranges at the database boundary too', async () => {
  const base = { name: 'Ok', score: 10, grade: 'D' as const, weeks: 1, users: 1, outcome: 'unfinished' as const };
  const [row] = await db.insert(schema.gameLeaderboard).values(base).returning();
  expect(row).toMatchObject({ hidden: false });
  expect(row.createdAt).toBeInstanceOf(Date);
  for (const bad of [{ name: '' }, { name: 'x'.repeat(17) }, { score: 101 }, { weeks: -1 }, { users: -1 }]) {
    await expect(db.insert(schema.gameLeaderboard).values({ ...base, ...bad })).rejects.toThrow();
  }
  await expect(db.execute(sql`insert into game_leaderboard (name, score, grade, weeks, users, outcome) values ('A', 1, 'F', 1, 1, 'won')`)).rejects.toThrow();
  await expect(db.execute(sql`insert into game_leaderboard (name, score, grade, weeks, users, outcome) values ('A', 1, 'A', 1, 1, 'lost')`)).rejects.toThrow();
});

it('allows the game origins to post across origins', async () => {
  const preflight = await request(app).options('/api/leaderboard').set('Origin', 'https://game.test')
    .set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'content-type');
  expect(preflight.headers['access-control-allow-origin']).toBe('https://game.test');
  const blocked = await request(app).options('/api/leaderboard').set('Origin', 'https://evil.test')
    .set('Access-Control-Request-Method', 'POST');
  expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
});
