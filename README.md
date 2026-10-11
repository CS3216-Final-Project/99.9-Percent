# 99.99%

A software-startup infrastructure tycoon game. Grow to 50,000 users in 26 weeks, manage upgrades and engineers, and survive production incidents. CS3216 Final Project, Group 5.

The playable frontend was migrated from [99.9-Percent-Prototype](https://github.com/CS3216-Final-Project/99.9-Percent-Prototype). The existing backend, database, shared contracts and CI/CD configuration are retained. See [the migration notes](docs/prototype-migration.md) for the imported features and verification steps.

See the [Development Roadmap](docs/DEVELOPMENT_ROADMAP.md) for planned work and the [roadmap summary and proposal review](docs/DEVELOPMENT_ROADMAP_REVIEW.md) for milestones, scope alignment, and decisions to review.

The [System Architecture](docs/SYSTEM_ARCHITECTURE.md) diagrams show the target MVP's frontend, simulation, Google OAuth, saves, API and Neon database, plus the infrastructure simulated inside the game. [🔑 Authentication](docs/AUTHENTICATION.md) describes the optional Google sign-in, durable app sessions and account-owned cloud saves. Real-provider deployment acceptance remains outstanding.

The [UI design guide](docs/UI_DESIGN.md) defines the shared visual language, incident and inspector layouts, responsive behaviour and review checks used by both gameplay modes.

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

The frontend opens the 99.99% title screen and an isometric startup office: a glass-walled server floor surrounded by desks, a monitoring room, meeting rooms, a kitchen and a lounge, with people at work. Press Play to begin the guided first week. Drag to pan, scroll or pinch to zoom, and click equipment to inspect it. `Shift` + drag (or right-drag, or two fingers) rotates and tilts the room; `Q` and `E` turn it by 45 degrees, and the house button resets the view. Walls between the camera and the room drop out of the way. `P` pauses or resumes; `Esc` closes a view.

The office is staffed by a crew of animated monsters from Quaternius's CC0 [Ultimate Monsters](https://quaternius.com/packs/ultimatemonsters.html) pack, one species per role: cats and birds write the code, a yeti is on call, a monkey runs the meetings, a mushroom crunches data, a chick is the intern, a ninja handles security, a frog fixes hardware, a bunny runs reception and a bee does marketing. They walk, idle, nod and wave with the pack's own animations, and shake their heads during an incident. Six of them wander the office on seeded loops of their own, stopping at the vending machines, the coffee machine, the water cooler, a colleague's desk, the whiteboard or the window; small groups stand chatting with speech bubbles that turn to the outage during an incident; and a frog and a bunny keep the ping-pong rally going. Licences are in `frontend/public/models/creatures/`.

The office is the top floor of a sixteen-storey glass tower downtown at night, with the "99.99%" sign on the storey below it. Around the tower's plaza is a grid of four-lane streets with lamps, trees, zebra crossings and traffic that takes turns at the junctions, a park, and blocks of glass towers, concrete offices and older stone buildings. Lit offices vary floor by floor, and rooftops carry plant, water tanks, crown lights and blinking red beacons. Buildings grow taller with distance, so none ever stands between the camera and the crew. The city is generated in `frontend/src/components/scene/city.ts` and drawn without any downloads; a light haze settles over the street below, and the whole city fades into the night with distance, so it has no edge.

The game has its own music, written as notes in `frontend/src/game/score.ts` and synthesised in the browser with the Web Audio API: a mellow groove while you build and a tense loop during incidents. It starts when you press Play, and the speaker button beside the menu turns it off; the choice is remembered.

Every desk has an iMac-style all-in-one in its own colour with a matching keyboard and mouse, and the vending machines (stocked behind lit glass), water cooler, arcade cabinets, server-room cooling units, fridge and espresso machine are modelled part by part in `frontend/src/components/scene/propModels.ts`.

The office furniture comes from two CC0 model packs, [Kenney's Furniture Kit](https://kenney.nl/assets/furniture-kit) and [KayKit Furniture Bits](https://kaylousberg.itch.io/furniture-bits) by Kay Lousberg. Their licences sit beside the models in `frontend/public/models/`.

On a machine with a graphics card the room draws in HD: photo-scanned CC0 floors and walls from [Poly Haven](https://polyhaven.com) and [ambientCG](https://ambientcg.com), photo-scanned Poly Haven plants, sofas, armchairs, tables, boxes and a lamp in place of the stylised ones, physically based materials, soft reflections, softer shadows, ambient occlusion and a glow on screens and lights. Credits are in `frontend/public/textures/License.txt` and `frontend/public/models/polyhaven/License.txt`. Without a GPU it keeps the lighter pixel look and never downloads the HD assets. Add `?graphics=hd` or `?graphics=basic` to the address to force either.

The [nine-node technology tree](docs/tech-tree.md) groups upgrades into Capacity, Data and Reliability, with metrics and alerts available from the start. It follows the proposal's reduced research scope while retaining the weekly simulation and existing saves.

In either mode, open Menu > Save files to export the current run or import a JSON save. Imports validate before replacing a run and open the matching Campaign or Classic mode. If a pre-update browser save is present, the same menu offers Resume pre-update save and Export pre-update save. Resuming copies the validated weekly run into Classic; the original save, metadata and analytics remain untouched. The music button beside Menu shares its mute setting across both modes and remembers it after reload.

Gameplay, saves and prototype analytics run in the browser and work without the API. Saves stay in this browser and origin; saves on the prototype deployment do not automatically move to a new domain. The backend retains its existing health and dialogue endpoints for later integration.

Campaign continues into [Phase 3 scaling](docs/phases/PHASE_3_SCALING.md) after the opening milestone: buy database headroom, scale an application or install a second server, then explicitly deploy and configure load balancing. After scaling growth, acknowledged reports and drained backlogs, explicitly continue into [Phase 4 data strategy](docs/phases/PHASE_4_DATA_STRATEGY.md): compare read/write workloads, a warming Read Cache, ceiling tuning and the paid 3,000 ops/s database tier. See the [implementation report](docs/phases/PHASE_4_IMPLEMENTATION_REPORT.md) for validation and remaining acceptance work. Classic remains available through the mode selector. Existing replay saves are backed up before conversion to schema 4; historical reports retain their original observations.

Account and cloud saves are optional controls on the Campaign title and menu. Sign-in never attaches a guest company automatically. The frontend's server-side `API_PROXY_TARGET` and backend Google/`APP_ORIGIN` configuration are required for account endpoints; see the authentication guide and package `.env.example` files. All `VITE_*` settings are public. Guest play remains available when accounts are unconfigured or offline.

The API runs without a database. For routes that use one, put Neon's connection strings in `backend/.env` (ask Di Heng, or use your own Neon branch).

## Scripts (in each of `frontend/` and `backend/`)

| Script | What it does |
|---|---|
| `npm run dev` | Run locally with hot reload |
| `npm run lint` | oxlint |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Production build (frontend) / type check (backend) |
| `npm test` | Tests (vitest). Frontend: simulation, scripted balance players, game startup, tutorial, save/resume, and API client (WebGL is mocked in UI tests). Backend: routes, CORS, and every migration on an in-memory Postgres. |

`npm run balance` in `frontend/` runs the scripted balancing players across twelve seeds.

`npm run test:coverage` in either package generates coverage reports. For real browser tests, run `npx playwright install chromium` once in `frontend/`, then `npm run test:e2e`. See [testing guidance](docs/testing.md) for the test matrix, debugging and known gaps. Project instructions are in [AGENTS.md](AGENTS.md), with focused agent skills in `.agents/skills/`.

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
| `game_accounts` | Verified Google issuer/subject and display name |
| `game_sessions` | Hashed opaque session tokens, CSRF token and expiry |
| `game_auth_attempts` | Short-lived browser-bound OAuth state, nonce and PKCE verifier |
| `game_runs` | Owner-scoped compact campaign replay saves and revisions |

To change the schema: edit `schema.ts`, run `npm run db:generate`, and commit the new files in `backend/drizzle/`. Never edit a migration that has already been merged. The migration runs on production automatically after the merge.

## CI/CD

| Stage | When | Where | What |
|---|---|---|---|
| CI `frontend` | Every PR | GitHub Actions | lint, typecheck, coverage, build, desktop/touch browser tests |
| CI `backend` | Every PR | GitHub Actions | lint, typecheck, coverage (incl. migrations on in-memory Postgres), migrations match schema |
| Preview deploy | Every PR | Vercel | Preview URL for each project, linked on the PR |
| Production deploy | Push to `main` | Vercel | Both projects |
| Migrate database | Push to `main` | GitHub Actions (`cd.yml`) | `db:migrate` on the production Neon database |
| Smoke test | After the migration | GitHub Actions (`cd.yml`) | `/api/health` and `/api/health/db` on the live API |

The `frontend` and `backend` checks must pass, on a branch that is up to date with `main`, before merging. CI doesn't re-run after the merge because that code has already been tested.

Vercel and the migration start at the same time, so keep migrations backward-compatible: add first, drop or rename in a later PR.

## How we work

- Never push to `main`. Branch, open a pull request, and get 1 approval.
- Branch names: `ai/…`, `fe/…`, `be/…`, `3d/…`, `chore/…`
- PR titles: `type(area): summary`, e.g. `feat(ai): voice loop`. The title becomes the squash commit message.
- Secrets go in `.env` / Vercel settings, never in code. Only `VITE_*` variables reach the browser, so the OpenAI key lives in the backend only.
- Changing a file in `shared/` changes a handoff. Agree with the other side first.

## Deployment

Two Vercel projects from this repo, in the `hoo-di-hengs-projects` Vercel team. The backend runs in Singapore (`backend/vercel.json`) to sit next to the database. Each project only rebuilds when its own folder or `shared/` changed (`ignoreCommand` in its `vercel.json`).

| Project | Root directory | Env vars (type) |
|---|---|---|
| `frontend` | `frontend` | `VITE_API_URL=https://99-99-percent-backend.vercel.app` (Config) |
| `lingoquest-backend` | `backend` | `CORS_ORIGINS` (Config), `DATABASE_URL` (Secret, pooled), `OPENAI_API_KEY` (Secret) |

Production frontend: [99-99-percent-web.vercel.app](https://99-99-percent-web.vercel.app). Production backend: [99-99-percent-backend.vercel.app](https://99-99-percent-backend.vercel.app).

Set `CORS_ORIGINS` in the backend's Vercel settings to `https://99-99-percent-web.vercel.app,https://frontend-*-hoo-di-hengs-projects.vercel.app`. The preview pattern follows the existing Vercel project name, independently of its production domain. Local `.env.example` files retain localhost values for development and document the production values separately. Changing a domain does not update Vercel environment variables; redeploy after changing those settings.

GitHub Actions (Settings > Secrets and variables > Actions):

| Name | Kind | Value |
|---|---|---|
| `DATABASE_URL_UNPOOLED` | Secret | Neon's direct connection string, used by the migration |
| `API_URL` | Variable (optional) | Production API URL for the smoke test. Defaults to `https://99-99-percent-backend.vercel.app`. If set explicitly, it must use this new URL too. |

Merges to `main` deploy to production. Pull requests get preview links.
