# LingoQuest

A 3D web game for practising a language by talking to AI characters. CS3216 Final Project, Group 5.

## Structure

```
frontend/   React + Vite + TypeScript + Three.js (react-three-fiber) + Zustand
backend/    Express + TypeScript API (deployed as a Vercel Function), Drizzle ORM
  drizzle/  SQL migrations (generated, committed)
shared/     TypeScript types shared by both sides (the handoff formats)
docs/       API and design notes
```

## Getting started

Needs Node 22 (`nvm use`).

```bash
# API: http://localhost:3001
cd backend
cp .env.example .env
npm install
npm run dev

# Game: http://localhost:5173
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

The page should show a grey box on a green plane and `API: ok` in the top-left corner.

The API runs without a database. For routes that use one, put Neon's connection strings in `backend/.env` (ask Di Heng, or use your own Neon branch).

## Scripts (in each of `frontend/` and `backend/`)

| Script | What it does |
|---|---|
| `npm run dev` | Run locally with hot reload |
| `npm run lint` | oxlint |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Production build (frontend) / type check (backend) |
| `npm test` | Tests (backend, vitest). Includes running every migration on an in-memory Postgres. |

Database scripts (`backend/` only):

| Script | What it does |
|---|---|
| `npm run db:generate` | Write a migration in `drizzle/` from changes to `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL_UNPOOLED` |
| `npm run db:studio` | Browse the database in the browser |

## Database

Postgres on [Neon](https://neon.tech) (region: Singapore), queried with [Drizzle](https://orm.drizzle.team). Tables are defined in `backend/src/db/schema.ts`:

| Table | Holds |
|---|---|
| `players` | One row per player: name, target language, level, total XP |
| `sessions` | One row per mission attempt |
| `dialogue_turns` | What the player said and the NPC replied, per session (the conversation history) |
| `mission_reports` | The `MissionReport` for a finished session |

To change the schema: edit `schema.ts`, run `npm run db:generate`, and commit the new files in `backend/drizzle/`. Never edit a migration that has already been merged. The migration runs on production automatically after the merge.

## CI/CD

| Stage | When | Where | What |
|---|---|---|---|
| CI `frontend` | Every PR and push to `main` | GitHub Actions | lint, typecheck, build |
| CI `backend` | Every PR and push to `main` | GitHub Actions | lint, typecheck, tests (incl. migrations on in-memory Postgres), migrations match schema |
| Preview deploy | Every PR | Vercel | Preview URL for each project, linked on the PR |
| Production deploy | Push to `main` | Vercel | Both projects |
| Migrate database | Push to `main` | GitHub Actions (`cd.yml`) | `db:migrate` on the production Neon database |
| Smoke test | After the migration | GitHub Actions (`cd.yml`) | `/api/health` and `/api/health/db` on the live API |

The `frontend` and `backend` checks must pass before merging.

Vercel and the migration start at the same time, so keep migrations backward-compatible: add first, drop or rename in a later PR.

## How we work

- Never push to `main`. Branch, open a pull request, and get 1 approval.
- Branch names: `ai/…`, `fe/…`, `be/…`, `3d/…`, `chore/…`
- PR titles: `type(area): summary`, e.g. `feat(ai): voice loop`. The title becomes the squash commit message.
- Secrets go in `.env` / Vercel settings, never in code. Only `VITE_*` variables reach the browser, so the OpenAI key lives in the backend only.
- Changing a file in `shared/` changes a handoff. Agree with the other side first.

## Deployment

Two Vercel projects from this repo. The backend runs in Singapore (`backend/vercel.json`) to sit next to the database.

| Project | Root directory | Env vars (type) |
|---|---|---|
| `lingoquest-frontend` | `frontend` | `VITE_API_URL` (Config) |
| `lingoquest-backend` | `backend` | `CORS_ORIGINS` (Config), `DATABASE_URL` (Secret, pooled), `OPENAI_API_KEY` (Secret) |

`CORS_ORIGINS` should list the frontend's production URL and a pattern for its previews, e.g. `https://lingoquest-frontend.vercel.app,https://lingoquest-frontend-*-<vercel-team>.vercel.app`.

GitHub Actions (Settings > Secrets and variables > Actions):

| Name | Kind | Value |
|---|---|---|
| `DATABASE_URL_UNPOOLED` | Secret | Neon's direct connection string, used by the migration |
| `API_URL` | Variable (optional) | Production API URL for the smoke test. Defaults to `https://lingoquest-backend.vercel.app` |

Merges to `main` deploy to production. Pull requests get preview links.
