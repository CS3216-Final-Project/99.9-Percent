import { count, gt } from 'drizzle-orm';
import { Router } from 'express';
import { getDb, isDbConfigured } from '../db/client.js';
import { gameAccounts, gameRuns } from '../db/schema.js';

/** Public aggregate counts for the landing page. Never add names, IDs or save contents. */
export interface PublicStats {
  /** Google accounts created in the game. */
  signups: number;
  /** Accounts created in the last seven days. */
  signupsLast7Days: number;
  /** Companies saved to the cloud, one per run. */
  cloudSaves: number;
  generatedAt: string;
}

export const statsRouter = Router();
const WEEK_MS = 7 * 86_400_000;
// An outage must not be cached by the CDN, or the landing page would keep hiding the numbers.
const noStore = { 'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store' };

statsRouter.get('/', async (_req, res) => {
  if (!isDbConfigured()) {
    res.set(noStore).status(503).json({ error: 'Stats are temporarily unavailable.' });
    return;
  }
  try {
    const db = getDb();
    const since = new Date(Date.now() - WEEK_MS);
    const [[accounts], [recent], [saves]] = await Promise.all([
      db.select({ n: count() }).from(gameAccounts),
      db.select({ n: count() }).from(gameAccounts).where(gt(gameAccounts.createdAt, since)),
      db.select({ n: count() }).from(gameRuns),
    ]);
    const body: PublicStats = {
      signups: accounts.n,
      signupsLast7Days: recent.n,
      cloudSaves: saves.n,
      generatedAt: new Date().toISOString(),
    };
    // A minute at the CDN keeps landing-page visits from each querying the database.
    res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300').json(body);
  } catch {
    console.error('Stats query failed.');
    res.set(noStore).status(503).json({ error: 'Stats are temporarily unavailable.' });
  }
});
