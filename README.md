# 99.99%

A software-startup infrastructure tycoon game: keep a growing company online by reading evidence, diagnosing bottlenecks and choosing what to build, while staying solvent.
CS3216 Final Project, Group 5.

Play it at [99-99-percent-web.vercel.app](https://99-99-percent-web.vercel.app).
Guided Mode teaches the concepts through a playable Launch Week and six chapters on one company; Challenge Mode, unlocked after five chapters, asks the player to reach 50,000 users in 26 weeks.
Everything runs in the browser; accounts and cloud saves are optional.

## Documentation

Each topic has exactly one home.

| Topic | Document |
| --- | --- |
| Gameplay rules, chapters, simulation and economy | [docs/GAMEPLAY.md](docs/GAMEPLAY.md) |
| The 3D building, controls, crew, city, sound and graphics | [docs/WORLD.md](docs/WORLD.md) |
| Visual language, screen patterns and UI review | [docs/UI_DESIGN.md](docs/UI_DESIGN.md) |
| Models, textures and licences | [docs/ASSET_PIPELINE.md](docs/ASSET_PIPELINE.md) |
| System architecture and browser storage | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| HTTP API and player feedback | [docs/api.md](docs/api.md) |
| Accounts, sessions and cloud saves | [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) |
| PostHog analytics and local playtest records | [docs/ANALYTICS.md](docs/ANALYTICS.md) |
| Hosting, environment variables, CI/CD and database | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| Test commands, coverage and CI shards | [docs/testing.md](docs/testing.md) |
| Status, milestones and scope | [docs/ROADMAP.md](docs/ROADMAP.md), with [phases/](docs/phases/) for the evaluation and showcase plans |
| Course proposal | [docs/PROJECT_PROPOSAL.md](docs/PROJECT_PROPOSAL.md) |
| Provenance of the migrated prototype | [docs/prototype-migration.md](docs/prototype-migration.md) |
| Instructions for coding agents | [AGENTS.md](AGENTS.md) and `.agents/skills/` |

## Structure

```
frontend/   React + Vite + TypeScript + Three.js (react-three-fiber) + Zustand
  src/sim/         deterministic simulation
  src/game/        store, persistence, guidance and analytics
  src/components/  UI and 3D scene
  api/             Vercel functions proxying account routes
backend/    Express + TypeScript API (a Vercel Function), Drizzle ORM
  drizzle/  generated SQL migrations
shared/     TypeScript types shared by both sides
docs/       documentation
```

## Getting started

Needs Node 22 (`nvm use`).
There is no root workspace; install each package separately.

```bash
# API: http://localhost:3001 (optional; the game runs without it)
cd backend
cp .env.example .env
npm ci
npm run dev

# Game: http://localhost:5173
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```

The API runs without a database; routes that need one read Neon connection strings from `backend/.env` (ask Di Heng, or use your own Neon branch).

| Script (in `frontend/` and `backend/`) | What it does |
| --- | --- |
| `npm run dev` | Run locally with hot reload |
| `npm run lint` / `npm run typecheck` | oxlint and TypeScript |
| `npm test` / `npm run test:coverage` | Vitest, optionally with coverage |
| `npm run build` | Production build (frontend) or type check (backend) |

The frontend also has `npm run balance`, `npm run test:e2e` and `npm run models:compress`; the backend has `npm run db:generate`, `db:migrate` and `db:studio`.
See [testing.md](docs/testing.md) and [DEPLOYMENT.md](docs/DEPLOYMENT.md#database) for when to use them.

## Contributing

- Never push to `main`. Branch, open a pull request and get one approval.
- Branch names: `ai/…`, `fe/…`, `be/…`, `3d/…`, `chore/…`.
- PR titles: `type(area): summary`, for example `feat(ai): voice loop`. The title becomes the squash commit message.
- The `frontend` and `backend` CI checks must pass on a branch that is up to date with `main`.
- Secrets go in `.env` files or Vercel settings, never in code; only `VITE_*` variables reach the browser.
- Changing a file in `shared/` changes a frontend/backend handoff, so agree it with the other side first.
- Merging to `main` deploys to production and migrates the production database.
