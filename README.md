# LingoQuest

A 3D web game for practising a language by talking to AI characters. CS3216 Final Project, Group 5.

## Structure

```
frontend/   React + Vite + TypeScript + Three.js (react-three-fiber) + Zustand
backend/    Express + TypeScript API (deployed as a Vercel Function)
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

## Scripts (in each of `frontend/` and `backend/`)

| Script | What it does |
|---|---|
| `npm run dev` | Run locally with hot reload |
| `npm run lint` | oxlint |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Production build (frontend) / type check (backend) |
| `npm test` | Tests (backend, vitest) |

CI runs lint, typecheck and build/test for both folders on every pull request. The `frontend` and `backend` checks must pass before merging.

## How we work

- Never push to `main`. Branch, open a pull request, and get 1 approval.
- Branch names: `ai/…`, `fe/…`, `be/…`, `3d/…`, `chore/…`
- PR titles: `type(area): summary`, e.g. `feat(ai): voice loop`. The title becomes the squash commit message.
- Secrets go in `.env` / Vercel settings, never in code. Only `VITE_*` variables reach the browser, so the OpenAI key lives in the backend only.
- Changing a file in `shared/` changes a handoff. Agree with the other side first.

## Deployment

Two Vercel projects from this repo:

| Project | Root directory | Env vars |
|---|---|---|
| `lingoquest-web` | `frontend` | `VITE_API_URL` |
| `lingoquest-api` | `backend` | `CORS_ORIGINS`, `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

Merges to `main` deploy to production. Pull requests get preview links.
