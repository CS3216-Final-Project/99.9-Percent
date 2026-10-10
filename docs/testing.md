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

On Linux CI, use `npx playwright install --with-deps chromium` for browser/system dependencies. For interactive tests rebuild with `npm run build` after changing application code. Preview runs on port 4175 by default (override with PLAYWRIGHT_PORT when another checkout is active); a reused local server must serve the current build.

## What is covered

| Layer | Evidence | Boundaries |
| --- | --- | --- |
| Simulation | Actions, costs, upgrades, engineers, release risk, determinism, save continuation, incident families and postmortems | Seeded strategies do not prove all seeds or player enjoyment |
| Game lifecycle/storage | Idempotent boot, corrupt/old saves, storage failures, paused incident resume, speed, completion, replay and analytics bounds | Storage validation is structural, not a security boundary |
| React shell | Real store, first-run UI, week advancement, resume, StrictMode clocks, pause and unmount cleanup | jsdom mocks the WebGL facility |
| 3D scene helpers | Detail level per renderer, HD texture loading (failure, retry, caching, colour spaces), world-scale texture coordinates, compressed-geometry decoding, crew casting, every animation an activity asks for being present in each creature's model file, every detailed prop building within a vertex budget with nothing in front of a Mac's picture, wandering routes that keep clear of glass, furniture and seated crew and loop without a seam, chatting groups that stand in the open and take turns, a ping-pong ball that clears the net and reaches both paddles, and a city whose buildings, roof plant and beacons never rise between the camera and the office, whose buildings keep to their lots, whose lamps and trees stand on the pavements, whose crossing traffic takes turns at the junctions without colliding (and would collide out of turn), and whose roads run out into the night | Checked structurally in jsdom; how the crew, props, surfaces and city look and move is checked by eye |
| Music | The score stays in key and inside its loop, the incident loop is faster with an alarm, the music setting defaults on, survives a reload and ignores a corrupt value, and the player is silent and harmless without Web Audio | Synthesis is not run in jsdom; the browser journey checks that the loops are prepared without error, not how they sound |
| Browser | Tutorial purchases/research/promotion, reload, corrupt save recovery, failed furniture and creature downloads, basic detail without a GPU (crew loads, no HD assets), forced HD textures and furniture loading and failing, music starting on Play and staying off after a reload, replay confirmation, investigation/recovery/postmortem and touch smoke | Real Chromium WebGL; mobile emulation does not cover Safari or real devices. CI renders without a GPU, so it checks that the room works, not how the furniture, crew or HD surfaces look. HD is reached there only through `?graphics=hd`, and the ambient occlusion and glow never run there |
| Backend | Route responses, invalid requests, health, origin parsing and HTTP CORS/preflight | Existing dialogue backend is retained; tycoon gameplay is browser-only |
| Database | Every committed migration, schema defaults and relational constraints on PGlite | Not a live Neon connectivity/load test |

Browser contexts are isolated. Advanced scenarios use engine-generated states in the normal localStorage save envelope before boot; decisions then happen through visible controls. Tests check a working WebGL context and fail on unhandled browser errors. Playwright's clock drives incident timers without arbitrary waits.

Browser journeys run one worker to avoid competing software WebGL renderers on CI. The incident journey has a 150-second budget because advancing the virtual clock also renders animation frames, and the forced-HD journey has 120 seconds because it draws the HD materials and models on the CPU; other tests keep their 60-second budget. CI rejects flaky tests even if a retry passes.

## CI and diagnostics

The existing required `frontend` job runs static checks, Vitest coverage, the production build and desktop/mobile browser journeys. The required `backend` job runs static checks, Vitest coverage and migration consistency. Failed browser tests retain screenshots and traces; CI uploads coverage and browser reports for 14 days. Inspect with `npx playwright show-report` or `npx playwright show-trace <trace.zip>` in `frontend/`.

Coverage is a baseline report, with no arbitrary global percentage gate. Frontend reports instrument `src/sim`, `src/game` and `src/lib`, excluding test helpers. They do not measure visual components or aggregate browser coverage. Backend reports include all `src` files, so entrypoints and live database paths may remain uncovered. Add targeted assertions for changed risks rather than chasing a total percentage.

Still needed as the product grows: Firefox/WebKit and real-device checks, broader keyboard/screen-reader accessibility review, performance budgets, and integration tests for any new server-backed gameplay. Add these when their features or support commitments exist; do not label the current suite comprehensive.

## Google authentication and cloud save coverage

Google OIDC and optional account-owned snapshots are implemented and tested against mocked provider exchange and isolated PGlite. Follow the [authentication contract](AUTHENTICATION.md) for deployment acceptance. The automated suite covers:

- **API:** mock Google code exchange/token validation; reject invalid/replayed callbacks, expired/revoked sessions and CSRF; verify two-account save isolation and revision conflicts.
- **Database:** additive account/session/attempt/run migrations and constraints with PGlite. Actual Neon HTTP connectivity remains an isolated deployment acceptance check.
- **Browser:** Google cancellation, session restoration/sign-out, explicit guest-run attachment, offline changes and preserved legacy keys. Stub provider responses for repeatable CI.
- **Remaining deployment acceptance:** real Google sign-in with two test accounts on registered production/auth-test origins, exact callbacks, proxy cookies and private-response cache headers. These checks require configured test credentials and are not established by mocked CI.

## Agent guidance

`AGENTS.md` establishes project boundaries and validation rules. Six focused skills under `.agents/skills/` cover simulation, browser tests, gameplay UI, API tests, migrations and release checks. Their instructions support this runnable toolkit; they do not replace tests or authorize deployment.
