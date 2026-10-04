# Testing 99.99%

Use Node 22 and install with `npm ci` separately in `frontend/` and `backend/`. Tests use browser-local saves, Supertest and an in-memory PGlite database; no production database or API key is needed.

## Commands

| Directory | Command | Purpose |
| --- | --- | --- |
| Both packages | `npm run lint` / `npm run typecheck` | Static checks |
| Both packages | `npm test` | Unit and integration tests |
| Both packages | `npm run test:coverage` | Tests plus text, HTML and JSON coverage |
| Frontend | `npm run balance` | Scripted strategies across twelve seeds |
| Frontend | `npx playwright install chromium` | Install the browser once per machine |
| Frontend | `npm run test:e2e` | Build and test real desktop/touch browser journeys |
| Frontend | `npm run test:e2e:ui` | Debug browser tests interactively using an existing build |
| Backend | `npm run db:generate` | Verify schema and generated migrations agree |

On Linux CI, use `npx playwright install --with-deps chromium` for browser/system dependencies. For interactive tests rebuild with `npm run build` after changing application code. Preview runs on port 4175; a reused local server must serve the current build.

## What is covered

| Layer | Evidence | Boundaries |
| --- | --- | --- |
| Simulation | Actions, costs, upgrades, engineers, release risk, determinism, save continuation, incident families and postmortems | Seeded strategies do not prove all seeds or player enjoyment |
| Game lifecycle/storage | Idempotent boot, corrupt/old saves, storage failures, paused incident resume, speed, completion, replay and analytics bounds | Storage validation is structural, not a security boundary |
| React shell | Real store, first-run UI, week advancement, resume, StrictMode clocks, pause and unmount cleanup | jsdom mocks the WebGL facility |
| Browser | Tutorial purchases/research/promotion, reload, corrupt save recovery, replay confirmation, investigation/recovery/postmortem and touch smoke | Real Chromium WebGL; mobile emulation does not cover Safari or real devices |
| Backend | Route responses, invalid requests, health, origin parsing and HTTP CORS/preflight | Existing dialogue backend is retained; tycoon gameplay is browser-only |
| Database | Every committed migration, schema defaults and relational constraints on PGlite | Not a live Neon connectivity/load test |

Browser contexts are isolated. Advanced scenarios use engine-generated states in the normal localStorage save envelope before boot; decisions then happen through visible controls. Tests check a working WebGL context and fail on unhandled browser errors. Playwright's clock drives incident timers without arbitrary waits.

Browser journeys run one worker to avoid competing software WebGL renderers on CI. The incident journey has a 150-second budget because advancing the virtual clock also renders animation frames; other tests keep their 60-second budget. CI rejects flaky tests even if a retry passes.

## CI and diagnostics

The existing required `frontend` job runs static checks, Vitest coverage, the production build and desktop/mobile browser journeys. The required `backend` job runs static checks, Vitest coverage and migration consistency. Failed browser tests retain screenshots and traces; CI uploads coverage and browser reports for 14 days. Inspect with `npx playwright show-report` or `npx playwright show-trace <trace.zip>` in `frontend/`.

Coverage is a baseline report, with no arbitrary global percentage gate. Frontend reports instrument `src/sim`, `src/game` and `src/lib`, excluding test helpers. They do not measure visual components or aggregate browser coverage. Backend reports include all `src` files, so entrypoints and live database paths may remain uncovered. Add targeted assertions for changed risks rather than chasing a total percentage.

Still needed as the product grows: Firefox/WebKit and real-device checks, broader keyboard/screen-reader accessibility review, performance budgets, and integration tests for any new server-backed gameplay. Add these when their features or support commitments exist; do not label the current suite comprehensive.

## Agent guidance

`AGENTS.md` establishes project boundaries and validation rules. Six focused skills under `.agents/skills/` cover simulation, browser tests, gameplay UI, API tests, migrations and release checks. Their instructions support this runnable toolkit; they do not replace tests or authorize deployment.
