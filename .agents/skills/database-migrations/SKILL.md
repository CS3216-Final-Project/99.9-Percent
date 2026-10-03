---
name: database-migrations
description: Change or review the Drizzle/Postgres schema, generated SQL migrations or migration consistency checks in backend. Use for database structure changes and failed migration CI, not ordinary frontend persistence.
---

# Database changes

Read `backend/src/db/schema.ts`, `backend/drizzle/` including the journal, `backend/test/db.test.ts`, `backend/drizzle.config.ts` and the migration step in `.github/workflows/cd.yml`.

1. Identify the compatibility requirement and affected API/shared contracts. Production deploy and migration can overlap; use additive changes first. Delay destructive drops/renames until code and data have transitioned.
2. Edit the schema and run `npm run db:generate` in `backend/`. Review generated SQL, snapshots and journal together. Commit a new migration; never edit an already merged migration or unrelated schema objects to satisfy CI.
3. Extend the PGlite test harness for the important default, constraint, relation or conversion. The harness applies the committed migrations to an isolated in-memory Postgres. Test fixture ordering must not create dependencies between individual cases.
4. Run backend lint, typecheck and tests. Run generation again and confirm it produces no additional migration. Check the Git diff for unexpected files.

Generation and in-memory tests do not authorize `db:migrate` against a live database. Production migration happens automatically after merge; document deployment assumptions and any separate backfill in the PR. If a migration needs data transformation, test representative old data and report unsupported Neon/Postgres features that the local emulator cannot validate.

Never print or commit connection strings. Use the environment examples for variable names and preserve the pooled/direct distinction. If generation fails locally, diagnose the environment and retain the intended schema change; do not fabricate generated metadata.
