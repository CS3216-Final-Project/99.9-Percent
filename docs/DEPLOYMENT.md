# Deployment, CI and database

This is the source of truth for hosting, environment settings, the CI/CD pipeline and the production database.
Test commands are in [testing.md](testing.md); account-specific provider setup is in [AUTHENTICATION.md](AUTHENTICATION.md#deployment).

## Hosting

Two Vercel projects deploy from this repository, in the `hoo-di-hengs-projects` team.
Each rebuilds only when its own folder or `shared/` changed (`ignoreCommand` in its `vercel.json`).

| Project | Root | Production URL | Notes |
| --- | --- | --- | --- |
| `frontend` | `frontend/` | [99-99-percent-web.vercel.app](https://99-99-percent-web.vercel.app) | Static Vite build plus the `/api` account proxy functions in `frontend/api/` |
| `lingoquest-backend` | `backend/` | [99-99-percent-backend.vercel.app](https://99-99-percent-backend.vercel.app) | Express as a Vercel Function in Singapore (`sin1`), next to the database |

Merges to `main` deploy both projects to production, and every pull request gets preview URLs.
Changing a domain or setting does not update a running deployment; redeploy after changing environment variables.

## Environment variables

Every `VITE_*` value is compiled into the public bundle, so never put a secret in one.
Local defaults are in `frontend/.env.example` and `backend/.env.example`.

| Project | Variable | Kind | Purpose |
| --- | --- | --- | --- |
| frontend | `VITE_API_URL` | Public | Direct API origin for health and feedback, `https://99-99-percent-backend.vercel.app` in production |
| frontend | `API_PROXY_TARGET` | Server-only | Verified HTTPS backend origin for the `/api` account proxy |
| frontend | `VITE_ANALYTICS_ENABLED`, `VITE_POSTHOG_TOKEN`, `VITE_POSTHOG_HOST`, `VITE_BUILD_ID` | Public, Production only | Product analytics; see [ANALYTICS.md](ANALYTICS.md#enable-collection) |
| backend | `CORS_ORIGINS` | Config | Allowed browser origins, comma-separated; `*` matches letters, digits and dashes |
| backend | `DATABASE_URL` | Secret | Neon pooled connection string for runtime queries |
| backend | `OPENAI_API_KEY` | Secret | Retained dialogue endpoint |
| backend | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `APP_ORIGIN` | Secret / Config | Google sign-in and the browser-facing origin for cookies and CSRF |

Vercel's `VERCEL_ENV` and `VERCEL_GIT_COMMIT_SHA` are mapped to `VITE_DEPLOY_ENV` and `VITE_COMMIT_SHA` in `frontend/vite.config.ts`.

Set the backend's `CORS_ORIGINS` to `https://99-99-percent-web.vercel.app,https://frontend-*-hoo-di-hengs-projects.vercel.app`.
The preview pattern follows the Vercel project name, not its production domain.

GitHub Actions needs these under Settings > Secrets and variables > Actions:

| Name | Kind | Value |
| --- | --- | --- |
| `DATABASE_URL_UNPOOLED` | Secret | Neon's direct connection string, used by the migration |
| `API_URL` | Variable, optional | API for the smoke test; defaults to `https://99-99-percent-backend.vercel.app` |

## Pipeline

| Stage | When | Where | What |
| --- | --- | --- | --- |
| CI `frontend` | Every PR | `ci.yml` | Gate over `frontend-checks` (lint, typecheck, coverage), `frontend-balance` and ten `frontend-browser` shards |
| CI `backend` | Every PR | `ci.yml` | Lint, typecheck, coverage including every migration on in-memory Postgres, migrations match the schema |
| Preview deploy | Every PR | Vercel | Preview URL for each project |
| Production deploy | Push to `main` | Vercel | Both projects |
| Migrate database | Push to `main` | `cd.yml` | `npm run db:migrate` on the production Neon database |
| Smoke test | After the migration | `cd.yml` | `/api/health` and `/api/health/db` on the live API, retried while Vercel deploys |

The `frontend` and `backend` checks must pass on a branch that is up to date with `main` before merging.
CI does not rerun after the merge.
How the browser shards are split and debugged is in [testing.md](testing.md#ci).

## Database

Postgres on [Neon](https://neon.tech) in Singapore, queried with [Drizzle](https://orm.drizzle.team).
Tables are defined in `backend/src/db/schema.ts`.

| Table | Holds |
| --- | --- |
| `game_accounts` | Verified identity (Google issuer and subject, or `email` and the address) and display name |
| `game_email_credentials` | scrypt password hashes and lockout state for email accounts |
| `game_sessions` | Hashed opaque session tokens, CSRF token and expiry |
| `game_auth_attempts` | Short-lived, browser-bound OAuth state, nonce and PKCE verifier |
| `game_runs` | Owner-scoped Guided Mode cloud saves and revisions |
| `game_feedback` | Anonymous player feedback: submission ID, message, mode and time |
| `players`, `sessions`, `dialogue_turns`, `mission_reports` | Retained tables from the earlier LingoQuest project, unused by the game |

To change the schema, edit `schema.ts`, run `npm run db:generate` in `backend/` and commit the new files in `backend/drizzle/`.
Never edit a merged migration.
The migration runs on production automatically after the merge, at the same moment Vercel deploys the new code, so keep migrations backward-compatible: add first, then drop or rename in a later PR.
Use `npm run db:studio` to browse a database, and your own Neon branch for local work that needs one.
