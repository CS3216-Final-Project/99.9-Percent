import { sql } from 'drizzle-orm';
import { Router } from 'express';
import type { HealthResponse } from '../../../shared/common.ts';
import { getDb, isDbConfigured } from '../db/client.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  const body: HealthResponse = { status: 'ok', time: new Date().toISOString() };
  res.json(body);
});

// Separate from /api/health so uptime checks don't wake the database.
// Used by the CD workflow after a deploy.
healthRouter.get('/db', async (_req, res) => {
  if (!isDbConfigured()) {
    res.status(503).json({ error: 'DATABASE_URL is not set' });
    return;
  }
  try {
    await getDb().execute(sql`select 1`);
    const body: HealthResponse = { status: 'ok', time: new Date().toISOString() };
    res.json(body);
  } catch (err) {
    console.error(err);
    res.status(503).json({ error: 'Database unreachable' });
  }
});
