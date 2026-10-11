# API

Base URL: `VITE_API_URL` (local: `http://localhost:3001`).
Request and response types live in [`shared/`](../shared). Change a type there only after both sides agree.

| Method | Path | Owner | Types | Status |
|---|---|---|---|---|
| GET | `/api/health` | Di Heng | `HealthResponse` (`shared/common.ts`) | Done |
| GET | `/api/health/db` | Di Heng | `HealthResponse`, or 503 if the database is unreachable | Done |
| GET | `/api/stats` | Di Heng | `PublicStats` (`backend/src/routes/stats.ts`): public sign-up and cloud-save counts for the landing page, cached for 60 s; 503 with `no-store` when the database is unavailable | Done |
| POST | `/api/dialogue` | Zi Yao | `DialogueRequest` → `DialogueResponse` (`shared/dialogue.ts`) | Stub |
| POST | `/api/missions/:id/report` | Zi Yao | → `MissionReport` (`shared/scores.ts`) | Planned |
| GET | `/api/progress` | Di Heng | TBD | Planned |
| GET | `/api/areas/:id/layout` | Di Heng | → `CityLayout` (`shared/cityLayout.ts`) | Planned |

## 🔑 Accounts and cloud saves

Google OAuth + OpenID Connect, or an email and password, with Express-managed app sessions in Neon. Owner: Di Heng. The browser always calls these through the same-origin `/api` proxy, never through `VITE_API_URL`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/auth/google` | Start Google sign-in |
| GET | `/api/auth/google/callback` | Validate callback, create/resolve account, issue app session |
| POST | `/api/auth/email/register` | `{email, password, name?}` → `AppSession` (201) and session cookie; 409 if the email has an account |
| POST | `/api/auth/email/login` | `{email, password}` → `AppSession` and session cookie; 401 for a wrong email or password, 429 while locked |
| GET | `/api/session` | Restore account state (`AppSession`), or 401 when signed out |
| POST | `/api/auth/logout` | Revoke app session and clear cookie (CSRF token required) |
| GET | `/api/runs` | List the account's Campaign cloud saves (`RunSummary[]`) |
| GET / PUT | `/api/runs/:runId` | Load, or save with an expected revision (`CloudRun`, 409 `SaveConflict`) |

Private save routes validate the app session and enforce owner/revision checks. Guest play stays local. [🔑 Flow, security and deployment](AUTHENTICATION.md)

## Handoff formats

- **Dialogue** (Zi Yao → Qi Jun): `shared/dialogue.ts`
- **Mission report** (Zi Yao → Qi Jun): `shared/scores.ts`
- **City layout** (Di Heng → Qi Jun): `shared/cityLayout.ts`. Units are metres, origin at the area centre.
- **3D assets** (Hai → Qi Jun): `.glb` in `frontend/public/models/`, 1 unit = 1 metre, snake_case names (e.g. `cafe_counter.glb`). Keep `.blend` files in Google Drive.
