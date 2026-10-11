import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
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
const day = 86_400_000;
// Stats count rows only, so any stored save body will do.
const envelope = { v: 1 } as unknown as typeof schema.gameRuns.$inferInsert['envelope'];

async function account(subject: string, displayName: string, ageDays: number) {
  const [row] = await db.insert(schema.gameAccounts)
    .values({ issuer: 'https://accounts.google.com', subject, displayName, createdAt: new Date(Date.now() - ageDays * day) })
    .returning();
  return row;
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
  vi.resetModules();
  app = (await import('../src/app.js')).default;
});
beforeEach(async () => {
  availability.configured = true;
  availability.fail = false;
  vi.restoreAllMocks();
  await db.delete(schema.gameRuns);
  await db.delete(schema.gameAccounts);
});
afterAll(async () => { await client.close(); });

it('counts sign-ups, recent sign-ups and cloud saves without exposing accounts', async () => {
  const recent = await account('recent-1', 'Recent Player', 1);
  await account('recent-2', 'Another Player', 6);
  await account('old', 'Early Player', 10);
  await db.insert(schema.gameRuns).values([
    { runId: 'run-a', accountId: recent.id, revision: 1, envelope },
    { runId: 'run-b', accountId: recent.id, revision: 3, envelope },
  ]);

  const response = await request(app).get('/api/stats');
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toBe('public, max-age=0, s-maxage=60, stale-while-revalidate=300');
  expect(Object.keys(response.body).sort()).toEqual(['cloudSaves', 'generatedAt', 'signups', 'signupsLast7Days']);
  expect(response.body).toMatchObject({ signups: 3, signupsLast7Days: 2, cloudSaves: 2 });
  expect(Number.isNaN(Date.parse(response.body.generatedAt))).toBe(false);
  expect(JSON.stringify(response.body)).not.toMatch(/Player|recent-1|google/);
});

it('reports zero counts as numbers for an empty database', async () => {
  const response = await request(app).get('/api/stats');
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ signups: 0, signupsLast7Days: 0, cloudSaves: 0 });
});

it('returns an uncached 503 when the database is not configured', async () => {
  availability.configured = false;
  const response = await request(app).get('/api/stats');
  expect(response.status).toBe(503);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers['cdn-cache-control']).toBe('no-store');
  expect(response.body).toEqual({ error: 'Stats are temporarily unavailable.' });
});

it('returns an uncached 503 when the query fails', async () => {
  availability.fail = true;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const response = await request(app).get('/api/stats');
  expect(response.status).toBe(503);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers['vercel-cdn-cache-control']).toBe('no-store');
  expect(response.body).toEqual({ error: 'Stats are temporarily unavailable.' });
});
