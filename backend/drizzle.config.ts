import { defineConfig } from 'drizzle-kit';

// `db:generate` only reads the schema. `db:migrate` connects to the database:
// use Neon's direct (unpooled) connection string for migrations.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '',
  },
});
