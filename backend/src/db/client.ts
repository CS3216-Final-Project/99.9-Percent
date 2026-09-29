import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

// Neon's HTTP driver: one HTTPS request per query and no connection to keep open,
// which suits Vercel functions. Use the pooled connection string here.
function createDb(url: string) {
  return drizzle({ client: neon(url), schema, casing: 'snake_case' });
}

export type Db = ReturnType<typeof createDb>;

let db: Db | undefined;

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Created on first use so routes that don't touch the database work without DATABASE_URL. */
export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  db ??= createDb(url);
  return db;
}
