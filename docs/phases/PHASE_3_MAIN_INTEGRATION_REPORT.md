# Phase 3 integration with merged main

Prepared 11 October 2026 for PR #17, `ai/phase-3-scaling`. Base: `85bfccc` (Phase 2 #11, shared tooltips #25, camera clipping #24, browser/scene-model improvements #23). This report supersedes the earlier Phase 3 reports' save-format boundaries and validation counts. Real-provider, deployed acceptance and human playtesting remain outstanding; full Phase 3 release completion is not claimed.

## Result and review fixes

- Continue the same opening-db v1 company after explicit milestone acknowledgement/continuation. Purchase database headroom before readiness-gated 1,400 req/s growth. Application upgrades, second-server installation, load-balancer deployment and routing remain distinct scheduled actions. No free capacity, company reset or Phase 4 mechanics.
- Retain main's compact deterministic replay engine, batched stepping, Classic mode, import/export, music, shared tooltips, updated camera/city and UI primitives. Move Phase 3 rack-state logic into main's extracted `sceneModel.ts`.
- Extend the local and cloud contract to schema-3 replay saves. Deployed schema-1/2 inputs load, with original bytes backed up before replacement. Old acknowledgements remain opening-only; boot never enters scaling. A persisted foundation boundary retains aggregate snapshots, settlement records and trace payloads without fabricated historical instance observations. New steps add per-instance evidence.
- Preserve measured report explanations from main. Scaling/routing activation compares the same step with that action unapplied, preventing natural drainage from being credited to a late upgrade. Raw report evidence includes each instance and routing; historical rows explicitly remain aggregate.
- Preserve pending owner copies before company imports. Block mode changes, imports and resets during uploads. Ignore a stale session-restoration reply after sign-out. Account bindings remain independent of guest gameplay and survive account switches.
- Keep the original phase plan; record concrete values and the updated save contract in `PHASE_3_IMPLEMENTATION_CONTRACT.md`. Optional auth/cloud work remains included from the original PR. The existing generated additive account migration is retained; merged migrations are unchanged.

## Validation

Node 22.20.0; dependencies installed separately using package lockfiles. Windows percent-sign checkout paths reproduce a Vitest URI error, so checks run against an identical source copy at a percent-free path. Generated coverage/browser artifacts stay out of Git.

| Check | Result |
| --- | --- |
| Frontend lint / typecheck | PASS, zero lint warnings |
| Frontend coverage | PASS: 356 tests; one existing optional TRACE diagnostic skipped |
| Scripted balance | PASS: 5 tests |
| Production frontend build | PASS |
| Full desktop/touch browser suite on newest main | PASS: 32 tests; no failures, retries or skipped journeys |
| Backend lint / typecheck / coverage | PASS: 34 tests, including mocked OIDC, session/CSRF/owner isolation/conflicts and PGlite migrations |
| Migration consistency | PASS: `db:generate` produces no changes; merged migration untouched |
| Actual main-save comparison | PASS: schema 1 and 2 at steps 6, 14 and 114; exact snapshots, recent history, reports, trace, settlements, money and counters |
| Diff/conflict checks | PASS before final documentation commit |

The pre-#23 browser suite passed all 34 journeys. After final compatibility edits, the four scaling/account journeys also passed. The newest-main suite includes #23's intentional consolidations; its final count is recorded above. After the final mobile label-spacing adjustment, lint/typecheck/build and all seven scaling/mobile journeys passed again. Screenshots cover title, management, opening incident, vertical/horizontal outcomes, instance selection, history, reports, account menu and narrow touch screens. Desktop routing uses a shared disclosure to keep response rows prominent. Mobile panel scrolling remains expected; tests check selection, reachable controls and horizontal overflow.

The optional TRACE skip, Three.js CommonJS deprecation and Playwright colour-environment warning remain known diagnostics. Local guest journeys may log an unavailable `/api/session` proxy when no backend runs; guest progression and saves remain usable and browser errors are checked. No failing required check is accepted as a baseline exception.

## Phase-plan acceptance

| Definition-of-Done area | Status and evidence |
| --- | --- |
| Application model: individual capacity, routed demand, utilisation, aggregation | PASS: per-instance and exact-conservation tests, odd/zero allocation and unrouted-backlog drainage |
| Vertical scaling: delayed activation, cost, recovery, database independence | PASS: targeted upgrade, positive recovery and late-upgrade negative-credit regression |
| Horizontal scaling: delayed paid installation, scene representation, no implicit routing | PASS: installation stays at 1,400/0; room/panel instance selection; deployment/configuration tested separately |
| Routing: deterministic distribution, visible demand, recovery, unchanged database | PASS: balanced/one-target allocation, 700/700 browser path, independent DB constraint |
| Player experience: gated reveal, both paths, visible consequences, same company | PASS for automated wiring and reviewed layouts; human understanding/enjoyment NOT TESTED |
| Guest play, local/legacy persistence and failed writes | PASS: API-unavailable journeys, old replay fixtures, exact backups, quota/corruption and future-version protection; Classic/import/export regressions retained |
| Google new/returning login and real session lifecycle | PASS with mocked provider/server tests; real Google and deployed cookies NOT TESTED |
| Restoration, logout, expiry, owner switching | PASS locally, including stale restoration reply and in-flight replacement regressions; deployed acceptance NOT TESTED |
| Cloud saves, ownership, revisions and fresh-session resume | PASS with PGlite/API tests and browser-stubbed flows; live cross-browser/provider acceptance NOT TESTED |
| Regression/static/build/browser checks | PASS as recorded above; final required GitHub checks must run on the pushed head |
| Human prediction/evidence sessions | NOT TESTED: protocol and export prepared; no participants contacted or results fabricated |

No production migration, merge, deployment or provider configuration was performed. Release acceptance still needs the registered Google client/consent/callback and test accounts, server-only proxy/backend settings, actual Neon connectivity, deployed cookies/cache/cross-session behavior, recorded build/playtest URL and arranged human sessions. These are distinct from the engineering integration validated here.
