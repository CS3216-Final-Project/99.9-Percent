# Phase 3 core gameplay implementation report

Status: Core gameplay implemented and validated under Node 22. Auth/cloud integration is DEFERRED by the latest user instruction. This is not a claim that the entire Phase 3 release is complete.

## Checkpoint and scope

- Branch: `ai/phase-3-scaling`.
- Accepted checkpoint: `f32e9c049ae5b73ea79d042bf42eec3370dcd33a`.
- Runtime: Node `v22.23.3`, using the existing Node 22 executable; npm `11.16.0`.
- No staging, commits, pushes, deployments, database migrations or dependency changes in this separation pass.
- The working tree contains core changes and pre-existing unfinished auth/cloud drafts. They are listed separately below and must not be treated as one core commit.

The approved scope now excludes frontend account restoration, sign-out, cloud listing, guest attachment, uploads, cloud resume, owner switching and cloud conflicts. These operations and their menu were removed from the active store/UI. Local envelopes no longer emit cloud bindings or cloud-copy state. `frontend/src/lib/api.ts` was left untouched in this pass; its earlier draft helpers are not imported by the gameplay store/UI. The already-applied Vite proxy remains local-only (`/api` to `http://localhost:3001`). Guest gameplay does not call it.

`frontend/vercel.json` remains unchanged. No fixed rewrite to `https://99-99-percent-backend.vercel.app/api/*` was applied. Root `vercel.json` does not exist. Destination ownership/deployed code/cookies/OAuth/payload authorization remain unverified, so that production rewrite remains excluded.

## Resulting gameplay

The same opening-db v1 company continues after explicit acknowledgement/continuation of its opening milestone. Application-scaling v1 records entry once. Database headroom is a sequential paid 1,000-to-2,000 ops/s upgrade; no capacity is granted. The first ready physical step schedules persistent 1,400 req/s growth three steps later. The deadline survives temporary loss of readiness and save/resume. Existing traffic limits remain active and can prevent an incident.

Each active application processes its own requests and backlog. Single routing targets app-1; balanced routing requires a deployed load balancer and explicit valid target selection. Integer allocation uses stable instance IDs; odd demand goes to the first ID. New installations remain unrouted. Unrouted instances can drain their original backlog without receiving new requests. Capacity increases affect only the selected instance, at activation.

App/database overload streaks are independent. Three consecutive overloaded steps on the same component open the incident; simultaneous attribution uses stable app order followed by the database. Recovery retains five qualifying measured steps. Latency follows the largest app queue/capacity plus the database queue/capacity. Revenue, tier upkeep, load-balancer exposure and fractional-cent remainders use the existing 60-step settlement.

CampaignUI and Facility share instance IDs, selection, snapshots and action dispatch. Installed/routed capacity, routing targets, unrouted/deploying states and countdowns are explicit. Room cable branches follow configured targets. Existing office, icons, theme, renderer and camera controls remain. Reports include app/routing evidence alongside database evidence. Local trace-backed telemetry uses stable identities and specialized request/activation events, target/capacity/routing/cost evidence and continuation attribution; the existing archive/export remains authoritative.

## Files added for the core patch

- `frontend/src/sim/scenarios/applicationScaling.ts`
- `frontend/src/sim/__tests__/scaling.test.ts`
- `frontend/src/game/scalingPersistence.test.ts`
- `frontend/e2e/scaling.spec.ts`
- `docs/playtests/PHASE_3_SCALING_PROTOCOL.md`
- `docs/phases/PHASE_3_IMPLEMENTATION_REPORT.md`

## Files modified for the core patch

- `frontend/src/sim/campaignTypes.ts`, `types.ts`: instances, routing, continuation, actions and financial fields.
- `frontend/src/sim/step.ts`: per-instance processing, scheduler, routing, streaks, growth and continuation.
- `frontend/src/sim/settlement.ts`, `derive.ts`: tier/LB operating costs and authoritative financial presentation.
- `frontend/src/sim/trace.ts`: component-specific cause, pending/ineffective/contributing actions and measured evidence.
- `frontend/src/sim/actions.ts`, `tech.ts`: exhaustive legacy dispatch and campaign-only capability restrictions.
- `frontend/src/game/persist.ts`: schema 1/2 migration dispatch in the existing local save loader.
- `frontend/src/game/saveMigrations.ts`: schema 3 validation and backup-first v1-to-v2-to-v3 chain.
- `frontend/src/game/store.ts`: instance selection, explicit continuation and existing local save/telemetry flow; no account/cloud operations.
- `frontend/src/game/telemetry.ts`: exhaustive scaling/routing mappings and continuation attribution.
- `frontend/src/components/CampaignUI.tsx`: instance/routing controls and evidence; no cloud/account panel.
- `frontend/src/components/scene/Facility.tsx`, `layout.ts`: shared instance selection, deployed LB footprint/status, target-specific flow and readable labels.
- `frontend/e2e/mobile.spec.ts`: touch selection across room and evidence.

Existing Game/App composition, opening-db configuration, Phase 1/2 reports and legacy save keys were not replaced. No second renderer, store, clock, persistence layer, routing graph editor or telemetry archive was introduced. Caching, reliability and later curriculum remain inactive.

## Local save compatibility

Schema 3 stays in `nn.campaign.save.v1`; scenario origin stays opening-db v1. Versions 1/2 dispatch through the existing migration registry. Original source bytes are backed up before replacement, with validation before the replacement write. Existing incompatible backup bytes are not overwritten. Backup/write failure preserves the active source payload. Future/corrupt saves remain protected/exportable. The three legacy keys are untouched.

Migration preserves company ID, cash, backlog, pending actions and activation steps, trace/report history, milestone, financial exposure/remainders and telemetry cursor. Historical aggregate snapshots remain aggregate snapshots: no per-instance observations are invented. New snapshots supply versioned per-instance evidence. Boot/migration does not enter the scaling stage; explicit continuation does.

Tests cover real reconstructed version-1/version-2 shapes, acknowledged companies, source-byte backup and replacement failures, unsupported imports, inconsistent routing/tier/counter/snapshot/cash/deployment fields and exact pending targeted-upgrade resume. Existing persistence/milestone/telemetry failure tests remain active.

## Validation

All commands run from `frontend/` under Node 22. Final results are recorded below; earlier intermediate failures were corrected, not hidden.

| Command | Accepted Phase 2 baseline | Final core result |
|---|---|---|
| `npm run lint` | PASS; 23 existing warnings | PASS; same 23 warnings, no new warnings |
| `npm run typecheck` | PASS | PASS |
| `npm test -- --reporter=verbose` | 129 passed, 1 optional skip | PASS; 162 passed, 0 failed, 1 optional skip |
| `npm run test:coverage` | PASS | PASS; 162 passed, 1 skipped; statements 80.14%, branches 74.21%, functions 84.41%, lines 83.18% |
| `npm run balance` | 5 passed | PASS; 5 passed, 0 failed/skipped |
| `npm run build` | PASS | PASS |
| `$env:CI='1'; npm run test:e2e` | 9 passed | PASS; 12 passed, 0 failed/skipped/flaky |

After the last label-spacing adjustment, `npm run build` and `$env:CI='1'; npx playwright test e2e/scaling.spec.ts e2e/mobile.spec.ts` passed again (4/4, no failures/retries/skips). This focused rerun covers every affected scaling/mobile path; the full 12-test run above already passed.

The only optional skipped test is `src/sim/__tests__/trace.test.ts` (TRACE diagnostic). Existing lint warnings concern component exports, legacy effects/immutability and camera mutation; no unrelated cleanup was performed. Playwright retains the existing NO_COLOR/FORCE_COLOR environment warning.

Intermediate findings: a new readiness test initially expected growth one step too early (readiness is checked before that step's processing); its expectation was corrected. Screenshot review identified overlapping instance labels. Removing the existing Servers label broke the old room-control assertion, so that control was restored and labels were separated. The affected browser run was stopped and rerun. Final checks, not intermediate attempts, determine the result below.

## Acceptance paths and regression evidence

| Path | Status/evidence |
|---|---|
| Phase 1 DB upgrade | Existing headless and browser opening acceptance retained |
| Phase 1 traffic limiting/removal | Existing headless and browser acceptance retained |
| Phase 1 ineffective app then DB upgrade | Existing headless and browser acceptance retained |
| Phase 2 onboarding/selection/milestone/migration/telemetry/failure/entry/continuation/resume | Existing unit, store, persistence, App and browser tests retained |
| Phase 3 vertical | Explicit DB headroom, growth, app incident, 1,600 upgrade, drainage, measured recovery, report and same-company reload |
| Phase 3 horizontal | Added app receives zero demand; LB alone preserves single routing; explicit balancing gives 700/700, drains backlog and recovers |
| Odd/zero routing and independent constraints | Isolated deterministic engine fixtures; 451/450 for 901; no NaN; per-instance overload despite aggregate headroom |
| Database independence | Controlled DB-constrained fixture keeps DB capacity unchanged by app actions |
| Prevention/readiness/resume | Retained limits do not manufacture an incident; due step survives queues/serialization; event consumed once |
| Backend-unavailable guest play | Both scaling browser paths abort all `/api/**` requests and assert no API requests occurred, including reload |
| Mobile/touch | Existing opening mobile flow and new room/panel instance-selection flow |

Final core adds 33 passing unit tests and three passing browser tests. There are no remaining new test failures or lint warnings. Backend drafts were not changed or retested in this core-only pass.

Browser screenshots are generated under ignored `frontend/test-results/`; they are review artifacts, not committed generated reports.

## Deferred auth/cloud files and tasks

Earlier draft changes remain in the working tree, unchanged during this core separation pass. Exclude them from the core gameplay checkpoint:

- `frontend/src/lib/api.ts`
- `frontend/vite.config.ts` (local proxy only; safe to retain separately)
- `shared/campaign.ts`
- `backend/package.json`, `backend/package-lock.json`
- `backend/src/app.ts`, `backend/src/db/schema.ts`
- `backend/src/routes/auth.ts`, `backend/src/routes/runs.ts`
- `backend/test/campaign.test.ts`
- `backend/drizzle/meta/_journal.json`, `backend/drizzle/meta/0001_snapshot.json`
- `backend/drizzle/0001_eager_daimon_hellstrom.sql`

No auth/cloud work was resumed in this pass. Prior isolated backend results are not release authorization or verification of a deployed destination. Before a separate follow-up: review backend/provider/session contracts; verify OAuth client/callback configuration and team ownership of the deployed destination; verify expected deployed code and cookie forwarding; document permitted proxy payloads; implement/review the deferred account/cloud UI/store operations; test attachment, owner switching, atomic revision conflicts and two-account/cross-session behavior. Review any production proxy independently after those gates. No production migration/deployment occurred.

## Definition of Done (full contract, with core-only authorization)

| # | Requirement | Status and evidence |
|---|---|---|
| 1 | Opening-db v1 and same company/architecture/limit/finances intact | PASS: unchanged scenario; opening/continuation tests |
| 2 | Phase 1/2 regressions, legacy protection, pause/batch/settlement invariants | PASS: existing suites retained |
| 3 | Per-instance processing and exact conservation | PASS: scaling/step fixtures |
| 4 | Targeted vertical and horizontal activation/charge once | PASS: delayed-action and visible journeys |
| 5 | Separate LB/configuration and deterministic odd routing | PASS: deployment/configuration and 900/901/zero fixtures |
| 6 | Backlog ownership and installed/routed capacity | PASS: unrouted drainage and headroom fixtures |
| 7 | Explicit DB headroom; app/routing do not change DB capacity | PASS: sequential paid purchase and DB independence |
| 8 | Readiness growth once; retained limits/prevention | PASS: scheduled deadline, serialization and prevention |
| 9 | Component streaks, latency, five-step recovery | PASS: independent/simultaneous streaks and both recovery paths |
| 10 | Tier/LB exposure and cent remainders | PASS: activation-at-60 and existing settlement tests |
| 11 | Causal reports for ineffective/pending/contributing actions | PASS: trace and scaling report assertions |
| 12 | Milestone-gated reveal, earlier Add Application, nine-node scope | PASS: existing opening tests and campaign gating; no new full tree |
| 13 | UI/Facility/strip shared instance selection/dispatch/evidence | PASS: horizontal and mobile selection assertions |
| 14 | Preserved office/camera/theme; readable routes/countdowns/unrouted states | PASS: existing room controls, screenshots and touch journeys; human understanding not established |
| 15 | Schema 3 preserves history/state/trace/cursor; safe failures | PASS: migration and existing persistence suites |
| 16 | Resume/scaling telemetry/deduplication/export | PASS: pending-upgrade resume, stable projections and existing export/archive tests |
| 17 | No duplicate systems or later mechanics | PASS: existing modules extended; inactive later systems retained |
| 18 | Guest/local play independent of auth/API | PASS: API-aborted browser paths assert zero API requests |
| 19 | Google lifecycle/attachment/account switching | NOT TESTED: deferred frontend integration |
| 20 | Owner-scoped cloud resume/atomic conflicts | NOT TESTED for release: deferred integration; prior isolated drafts are separate |
| 21 | Deployed callback/proxy/cookies/two-account/cross-session checks | NOT TESTED: production proxy excluded |
| 22 | Required static/unit/coverage/balance/build/browser checks | PASS: all requested frontend checks; deferred backend release checks remain separate |
| 23 | Vertical/horizontal visible-control journeys | PASS: both journeys, same-company reload and API-blocked assertions |
| 24 | Recorded deployment/build/entry/assets/account flows | NOT TESTED: no deployment performed; build remains dev/unrecorded |
| 25 | Human protocol/export and actual results/absence | NOT TESTED for sessions: protocol prepared, export reused, no sessions conducted |

## Deviations and remaining issues

The latest user instruction narrows Phase 3 to core gameplay. Working authentication/cloud frontend integration and fixed production proxy are explicitly deferred rather than completed. No scenario economics/timing were retuned. No Phase 4 work started.

Full Phase 3 remains incomplete until separately authorized auth/cloud integration, release verification and human validation. The real `VITE_PLAYTEST_URL`, recorded `VITE_BUILD_ID`, deployed URL and participant arrangements remain external inputs. Coverage includes dormant legacy code and the untouched deferred API helper draft; it is not a production-only coverage claim. Automatic durability still cannot be promised when browser storage is unavailable, as the existing UI reports.

Stop point: core gameplay review. No automatic staging, commit, deployment, authentication follow-up or participant contact.
