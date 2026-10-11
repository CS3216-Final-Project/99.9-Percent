# Phase 4 — Data Strategy review and main integration

Prepared 10 October 2026 for PR #18. Main checkpoint: `c554c8b` (merged Phase 3 #17). This report supersedes the original Phase 4 snapshot-save assumptions, stale stacked-base description and historical validation counts. Human learning outcomes and deployed-provider acceptance are not established by engineering tests.

## Result

The same company explicitly continues from Scaling & Routing into Data Strategy. Entry preserves architecture, money, queues, pending work and evidence, pauses the store and records a replayable decision. Entry selects one bounded seeded read/write profile; ready growth applies it with persistent 2,400 req/s demand. A pinned evaluation profile remains deterministic without consuming selection RNG; an explicit one-time contrast changes only the profile.

Integer classification occurs once after aggregate application processing. Only eligible read hits avoid DB work. At P=2,400 and 60% effective rate, read-heavy DB demand is 1,248 and write-heavy demand is 2,112. Writes/misses/non-cacheable reads and old DB backlog still reach the database. Request outcomes and revenue are conserved exactly. Deployment activates cold; warmth increments only after eligible work for the next step. Tuning raises only the ceiling, preserving warmth, ramp and upkeep.

The sequential 3,000 ops/s database tier costs $4,000, activates after four steps and has $3,500 total period upkeep. Read Cache costs $1,500/two steps/$400 upkeep; tuning costs $1,000/two steps/no extra upkeep. Existing application, load-balancing, routing, admission and settlement rules remain intact. No Phase 5 mechanics are enabled.

## Review fixes and reuse

- Merge latest main into the existing PR branch, keeping its history without a force push. Main's replay loop, Classic mode, import/export, music, account/session lifecycle, tooltips, current Three.js room and browser optimizations remain the foundation.
- Replace the draft snapshot migration registry with schema 4 of main's replay envelope. Schema 1/2/3 sources replay without entering Data Strategy and retain exact source-byte backups before replacement. Historical aggregate observations and Phase 3 postmortems remain unchanged. Old snapshot drafts cannot be reconstructed into trustworthy inputs; preserve/export them rather than inventing a migration.
- Extend only the shared envelope version and existing backend transport validator to accept replay schemas 3/4. Cloud resume uses normal replay validation, preserves the original remote response and remains paused. Invalid/future saves display the compatibility message and preserve local progress. This narrow handoff is required by the user's latest-main integration request; no new auth/ingestion/deployment work is introduced.
- Render the fourth DB cabinet through main's extracted `sceneModel.ts`; its footprint and pad use the same tier count. Cache room labels and panel controls share the existing selection/inspection dispatcher, including touch placement.
- Preserve the UI guide's metric tiles, incident jobs, action rows with cost/delay badges, callouts, tooltips, charts, disclosures, menu and mobile panel. Keep the current stage in the fixed HUD and detailed progression in a disclosure after the response workspace. New workload detail is hidden until growth applies it; old history explicitly says when detail was not recorded.
- Use the engine's `databaseUpgrade` selector for allowed sequential tiers, prices and delays. A locked terminal stage no longer advertises the next purchase. Cache prices/delays/ceilings use versioned scenario constants.
- Apply cache classification to the same-step comparison used for app/routing causal reports. A late app upgrade receives no credit for drainage provided by an already-warm cache. Preserve the pre-data explanation text for old reports.

Production work extends existing engine/types/settlement/trace/derive/tech, store/persistence/telemetry, CampaignUI and Facility modules. `scenarios/dataStrategy.ts` is the one new production scenario module. No duplicate engine, store, renderer, telemetry service or persistence system is introduced. Earlier scenario configuration files and database migrations are unchanged.

## Validation

Node 22.23.3; `npm ci` run separately for both package lockfiles. Generated coverage, browser binaries, reports and screenshots stay out of Git. Required GitHub checks must run on the pushed head.

| Check | Result |
| --- | --- |
| Frontend lint/typecheck | PASS; zero lint warnings |
| Frontend coverage | PASS; 400 tests and one existing optional TRACE skip |
| Backend lint/typecheck/coverage | PASS; 35 tests with isolated PGlite and mocked provider exchange |
| Simulation balance | PASS; six tests covering strategies and economics |
| Production frontend build | PASS |
| Desktop/touch Chromium suite | PASS for all 35 unique journeys; 34 initially passed, then all three data/DB/touch journeys passed against the final rebuilt UI |
| Migration consistency | PASS; no changes generated |
| Final diff/conflict/remote checks | PASS against main `c554c8b`; no unresolved index entries/conflict markers; remote base/head unchanged before commit |

The initial new touch journey tried to select the intentionally hidden, undeployed cache bay. Corrected it to pay for deployment and advance through activation before tapping the room label; both room and panel expose the selected state. The final three-journey run also verifies the last workload-caption, upgrade-tooltip, chip-order and room accessibility refinements. Desktop and touch screenshots were visually inspected. CI must repeat the complete suite on the pushed head.

Known diagnostics: Three.js CommonJS deprecation, Playwright colour-environment warning and expected unavailable local `/api/session` requests in guest journeys. These are not accepted substitutes for a failing required check. Browser renders require visual inspection alongside assertions; actual-device/Safari/Firefox support is not established.

## Phase-plan acceptance

| Definition-of-Done item | Status and evidence |
| --- | --- |
| Same company, immutable earlier scenarios | PASS: continuity/replay/regression tests; original scenario files unchanged |
| Explicit entry/prevention, boot safety | PASS: lifecycle gates, pause, migration without entry, retained-limit prevention |
| Versioned config and once-only growth | PASS: seeded/pinned profiles, retained readiness deadline and trace event tests |
| Integer operations, outcome/revenue conservation | PASS: exact 1,248/2,112 fixtures, old backlog, rounding, settlement tests |
| Cold activation, warmth and tuning | PASS: delayed activation, used/next rates, zero eligibility, ceiling-only tuning |
| Sequential DB tier and economics | PASS: delayed paid activation, rejection/prerequisites and balance alternatives |
| Incidents/recovery/bankruptcy | PASS: existing threshold, first-pause, report and settlement regressions |
| Actual causal trade-off evidence | PASS: workload snapshots/reports, same-step cache-aware app comparison and no false recovery credit |
| UI/room/shared selection/accessibility | PASS: component assertions, desktop/touch browser selection and visually inspected screenshots |
| No duplicate architecture | PASS: existing modules extended as recorded above |
| Schema 4/exact resume/history/failure | PASS: replay equality, old schemas, backup/write/collision failures and paused cloud compatibility |
| Legacy keys/unexported evidence | PASS: inherited storage protections and telemetry/archive regressions |
| Attributed/deduplicated local events | PASS: request vs activation, profile at occurrence, same-step stage ordering and retry tests |
| DB/cache/write-heavy/mobile/offline browser paths | PASS: final data/DB/touch run, blocked API, weaker write-heavy cache, paid DB recovery and exact reload |
| Phase 1–3/Node 22 verification | PASS for static/coverage/balance/build and all browser journeys; required CI must pass on pushed head |
| Deferred backend/auth/proxy boundary | PASS for scope: only replay transport compatibility; no new service, schema, provider or proxy configuration |
| Human protocol/export | Prepared in `docs/playtests/PHASE_4_DATA_PROTOCOL.md`; actual sessions/reasoning NOT TESTED |

No production migration, merge or hosted configuration was performed. Real Google client/consent/callback, live Neon/cookies/cache/two-account acceptance, hosted playtest/build configuration and participant sessions remain NOT TESTED. Reviewer approval and required CI remain prerequisites for merging.
