# API

This is the source of truth for the backend's HTTP routes.
Request and response types live in [`shared/`](../shared); change a type there only after both sides agree.
How sign-in, sessions and cookies work is in [AUTHENTICATION.md](AUTHENTICATION.md).

The gameplay itself never needs the API.
The browser calls public routes directly at `VITE_API_URL` (local: `http://localhost:3001`) and account routes through the same-origin `/api` proxy.

## Public routes

| Method | Path | Types | Behaviour |
| --- | --- | --- | --- |
| GET | `/api/health` | `HealthResponse` (`shared/common.ts`) | Liveness |
| GET | `/api/health/db` | `HealthResponse` | 503 when the database is unreachable |
| GET | `/api/stats` | `PublicStats` (`backend/src/routes/stats.ts`) | Sign-up and cloud-save counts for the landing page, cached for 60 s; 503 with `no-store` when the database is unavailable |
| POST | `/api/feedback` | `FeedbackRequest` / `FeedbackResponse` (`shared/feedback.ts`) | Anonymous player feedback, see below |
| POST | `/api/dialogue` | `DialogueRequest` / `DialogueResponse` (`shared/dialogue.ts`) | Retained from the earlier LingoQuest project; unused by the game |

### Feedback

Players send feedback from Give feedback on the home screen or Menu > Playtest, without signing in.
The body is `{ id, message, mode }`: a random UUID v4 submission ID, 1 to 2,000 trimmed characters and `campaign` or `classic`.

| Status | Meaning |
| --- | --- |
| 201 `{ id }` | Stored in `game_feedback` |
| 200 `{ id }` | Identical retry of an already stored submission |
| 400 | Invalid ID, mode or message |
| 409 | The ID was already used for different feedback |
| 503 | Database unavailable |

The client reuses the submission ID while the text is unchanged, so a lost response never duplicates a row, and it times out after 15 seconds.
Only the message, mode and ID are sent; no saves, records, emails or tokens.
There is no route that reads feedback.

## Account routes

Called only through the `/api` proxy, never through `VITE_API_URL`.

| Method | Path | Behaviour |
| --- | --- | --- |
| GET | `/api/auth/google` | Start Google sign-in |
| GET | `/api/auth/google/callback` | Validate the callback, create or resolve the account and issue an app session |
| POST | `/api/auth/email/register` | `{ email, password, name? }` to `AppSession` (201) and session cookie; 409 when the email has an account |
| POST | `/api/auth/email/login` | `{ email, password }` to `AppSession` and session cookie; 401 for a wrong email or password, 429 while locked |
| GET | `/api/session` | Current `AppSession`, or 401 when signed out; `newAccount` is true while this session created the account and it has no cloud saves (see [AUTHENTICATION.md](AUTHENTICATION.md#cloud-saves)) |
| POST | `/api/auth/logout` | Revoke the app session and clear the cookie; CSRF token required |
| GET | `/api/runs` | The account's Guided Mode cloud saves (`RunSummary[]`) |
| GET / PUT | `/api/runs/:runId` | Load, or save with an expected revision (`CloudRun`; 409 `SaveConflict`) |

Private routes validate the app session and filter every save by owner and revision.
Writes require the exact `APP_ORIGIN` as `Origin` and the session's CSRF token.
Request bodies are limited to 1 MB.

## Other shared formats

`shared/scores.ts` and `shared/cityLayout.ts` are retained LingoQuest contracts with no route in this backend.
