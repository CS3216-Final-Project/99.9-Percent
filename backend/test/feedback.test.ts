import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
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
const value = { id: '819251a5-e7bb-4e98-8c99-758bfc36b723', message: '  The routing panel was confusing.  ', mode: 'campaign' };

beforeAll(async () => {
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
  vi.stubEnv('CORS_ORIGINS', 'http://localhost:5173,https://game.test,https://game-*-team.vercel.app');
  vi.resetModules();
  app = (await import('../src/app.js')).default;
});
beforeEach(async () => {
  availability.configured = true;
  availability.fail = false;
  vi.restoreAllMocks();
  await db.delete(schema.gameFeedback);
});
afterAll(async () => { await client.close(); vi.unstubAllEnvs(); });

it('persists anonymous feedback before confirming success', async () => {
  const response = await request(app).post('/api/feedback').send(value);
  expect(response.status).toBe(201);
  expect(response.body).toEqual({ id: value.id });
  const [row] = await db.select().from(schema.gameFeedback);
  expect(row).toMatchObject({ id: value.id, message: value.message.trim(), mode: 'campaign' });
  expect(row.createdAt).toBeInstanceOf(Date);
});

it('stores a retry only once and rejects conflicting reuse of the submission ID', async () => {
  const results = await Promise.all([
    request(app).post('/api/feedback').send(value),
    request(app).post('/api/feedback').send(value),
  ]);
  expect(results.map(r => r.status).sort()).toEqual([200, 201]);
  const conflict = await request(app).post('/api/feedback').send({ ...value, message: 'Different feedback' });
  expect(conflict.status).toBe(409);
  expect(await db.select().from(schema.gameFeedback)).toHaveLength(1);
});

it('rejects malformed or empty feedback without writing rows', async () => {
  for (const body of [
    {}, [], { ...value, id: 'invalid' }, { ...value, message: ' \n\t ' },
    { ...value, message: 'x'.repeat(2001) }, { ...value, message: 7 }, { ...value, mode: 'unknown' },
  ]) {
    expect((await request(app).post('/api/feedback').send(body)).status).toBe(400);
  }
  expect(await db.select().from(schema.gameFeedback)).toEqual([]);
});

it('reports an unavailable database without a false success', async () => {
  availability.configured = false;
  expect((await request(app).post('/api/feedback').send(value)).status).toBe(503);
  availability.configured = true;
  availability.fail = true;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  expect((await request(app).post('/api/feedback').send(value)).status).toBe(503);
  expect(await db.select().from(schema.gameFeedback)).toEqual([]);
});

it('applies generated defaults and rejects invalid values at the database boundary', async () => {
  const [row] = await db.insert(schema.gameFeedback).values({ message: 'Classic is fun', mode: 'classic' }).returning();
  expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(row.createdAt).toBeInstanceOf(Date);
  for (const message of ['', '   ', 'x'.repeat(2001)]) {
    await expect(db.insert(schema.gameFeedback).values({ message, mode: 'classic' })).rejects.toThrow();
  }
  await expect(db.execute(sql`insert into game_feedback (message, mode) values ('Hello', 'unknown')`)).rejects.toThrow();
});

it('uses the existing configured production and preview CORS policy', async () => {
  for (const origin of ['https://game.test', 'https://game-preview-team.vercel.app']) {
    const response = await request(app).post('/api/feedback').set('Origin', origin).send(value);
    expect(response.headers['access-control-allow-origin']).toBe(origin);
  }
  for (const origin of ['https://game.test.evil', 'https://unrelated.vercel.app']) {
    const response = await request(app).options('/api/feedback').set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'content-type');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  }
  const preflight = await request(app).options('/api/feedback').set('Origin', 'https://game.test')
    .set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'content-type');
  expect(preflight.headers['access-control-allow-origin']).toBe('https://game.test');
  expect(preflight.headers['access-control-allow-methods']).toContain('POST');
  expect(preflight.headers['access-control-allow-headers']).toBe('content-type');
});
