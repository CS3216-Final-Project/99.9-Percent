# Phase 4 — Data Strategy implementation report

Prepared 10 October 2026. Local gameplay implementation; human validation and deployment are separate evidence gates.

## Checkpoint and scope

Repository: C:/Users/user/99.9-Percent. Branch: ai/phase-4-data-strategy. Starting/unchanged HEAD: b61e8acd72cc3e99ec64bb8b8eb8e0f6dec9c2ac. The initial tree was clean. Implementation changes remain unstaged; no commit, push, deployment or Phase 5 implementation was performed.

The approved contract remains unchanged. opening-db v1 and application-scaling v1 scenario files remain unchanged. Deferred phase3-deferred-auth-cloud (44b80f65b9644bfceeda3107d0d32e3077ce94bc) and phase4-approved-spec stashes remain unapplied. Backend/shared/auth/API/proxy/package/lockfile files were not changed.

## Result and reuse

The same company explicitly enters data-strategy v1 after scaling growth and acknowledged/drained management. Entry preserves architecture, limits, money, actions, history and physical step, pauses the shared clock, and does not manufacture an incident. Boot/migration cannot enter the stage. A retained admission limit or sufficient capacity can prevent degradation.

The existing step engine, bounded processors, per-instance routing, intervention scheduler, cent-based settlement, component incident/recovery rules, causal report, CampaignUI, Facility/office assets, shared selection, Zustand store, migration registry, local archive and export are extended. No second engine, store, renderer, save adapter, telemetry pipeline or game shell was introduced. Game.tsx composition and existing modal/layout primitives needed no new implementation.

The sole new production module, sim/scenarios/dataStrategy.ts, isolates approved versioned tuning and pinned workload profiles without altering preceding scenarios. A test-only dataFixture.ts shares preparation through actual public purchases/actions; it does not create product physics or runtime behavior.

## Workload, cache and economy

Normal entry selects read-heavy or write-heavy once using seeded RNG; evaluation can pin a profile without consuming RNG. Configuration/profile/source are saved. On the first ready post-entry step the event receives deadline n+3, retained if readiness is lost; it fires once when ready at/after that deadline. Traffic becomes 2,400 persistently. Explicit same-company contrast changes only profile once after drained management.

After aggregate application processing P, integer basis-point floors yield reads, writes, eligible reads, non-cacheable reads, hits and eligible misses. DB new demand is P minus hits; writes, non-cacheable reads and eligible misses reach DB. Old DB backlog is never converted into hits. Hits plus DB outcomes complete requests and earn revenue once. All processed/rejected/backlogged/overflow outcomes remain conserved.

At P=2,400 with 60% eligible-read hit rate, read-heavy yields 1,248 DB ops/s and write-heavy 2,112. Cache activates cold, uses stored warmth for completed work, then advances warmth by 1,200 basis points only on eligible work. Snapshots distinguish the used rate from next-step warmth. Tuning raises only the ceiling from 60% to 75%, preserving warmth, ramp and upkeep. Pause, review, acknowledgement and reload do not warm.

Approved actions retain the infrastructure slot and independent routing/admission channels: cache $1,500/two steps/$400 per period; tuning $1,000/two steps/no additional upkeep; sequential DB 2,000→3,000 $4,000/four steps/$3,500 total upkeep. Spending is on accepted request; effects/upkeep start at activation. Existing salaries/revenue/remainders/60-step settlement/bankruptcy precedence remain authoritative. Latency remains the conservative 100 ms plus maximum app queue delay plus DB queue delay, not a hit-weighted latency estimate.

## UI, persistence and telemetry

CampaignUI adds explicit continuation, workload/read-write/cache evidence, cache/tuning actions, contrast, countdowns and historical detail. The dependency strip and existing Facility cache asset share selection. The four-node data strip uses a vertical layout inside the narrow existing panel; earlier three-node layouts are preserved. The mobile cache label stays above the metrics sheet; actual touch selection is tested. Historical snapshots display unavailable workload detail rather than invented observations. Reports identify actual workload change and distinguish capacity, hits, writes, misses, pending actions and app-processing effects.

The current campaign key is retained; schema 4 extends the existing 1→2→3→4 registry and load dispatch. Existing data-stage/cache state initializes absent; source-byte backups precede replacement. Identity, finances, pending actions, snapshots, traces, reports, milestone and earlier history remain intact. Unknown/corrupt saves and backup/write failures remain protected. Cache warm-up/tuning resume matches uninterrupted execution. Legacy nn.save.v1, nn.meta.v1 and nn.analytics.v1 remain untouched.

Existing local trace projection now includes data_stage_entered, workload_changed, cache/cache-tuning request versus activation, and data-stage DB activation. Stable IDs, run/session/build/scenario/physical-step/timestamps and local durability/export remain in the existing pipeline. Historical profile attribution follows the trace at the occurrence, not the final contrast profile. Trace ordering also distinguishes pre-entry requests at the same physical step from data-stage requests. No remote ingestion or account/cloud operation was introduced.

## Campaign-flow clarity pass

The manually reviewed clarity pass extends the existing CampaignUI without changing campaign rules. A compact pinned progression strip remains visible while the panel scrolls and distinguishes completed, current, available-next and locked stages: Opening, Scaling & Routing, Data Strategy and later stages locked. Current objectives describe desired service/business states; factual prerequisites explain what must become true for further growth or continuation without prescribing an incident solution.

An active traffic limit displays incoming, admitted and rejected traffic plus the existing rejected-demand opportunity value (not an extra charge); the header qualifies healthy management as “Stable — traffic limited.” Unrouted applications show installed versus routed capacity and explain why installed capacity does not receive traffic. Pending postmortem/milestone acknowledgement and available scaling/data continuation are visible outside History and derived from existing state after reload.

Data-stage context shows read/write shares, cold/warming/warm cache state, effective hit rate used and DB demand/capacity. Campaign guidance, System evidence and Actions are separate labeled sections; demand, capacity, utilisation, backlog, processed, failed, latency and service errors remain available. Twelve new UI tests cover stage states, prerequisites, traffic-limit consequences, unrouted apps, acknowledgement, cache context and saved-state guidance. Existing desktop/mobile journeys also verify progression, reload and the pinned strip.

During this clarity pass, no simulation equations changed, no costs changed, no store semantics changed and no save semantics changed. No Phase 5 mechanics were introduced. Deferred auth/cloud work remained unapplied. Human sessions and deployment remain NOT TESTED; manual review of the implementation is not participant evidence or deployment verification.

## Changed files

Final Phase 4 implementation plus clarity pass: **25 files — 17 modified and 8 added**.

Added:

- frontend/src/sim/scenarios/dataStrategy.ts
- frontend/src/sim/__tests__/dataStrategy.test.ts
- frontend/src/sim/__tests__/dataFixture.ts (shared public-action test preparation)
- frontend/src/game/dataPersistence.test.ts
- frontend/src/components/CampaignUI.test.tsx
- frontend/e2e/dataStrategy.spec.ts
- docs/playtests/PHASE_4_DATA_PROTOCOL.md
- docs/phases/PHASE_4_IMPLEMENTATION_REPORT.md

Modified:

- frontend/src/sim/campaignTypes.ts
- frontend/src/sim/types.ts
- frontend/src/sim/step.ts
- frontend/src/sim/settlement.ts
- frontend/src/sim/trace.ts
- frontend/src/sim/derive.ts
- frontend/src/sim/tech.ts
- frontend/src/game/persist.ts
- frontend/src/game/saveMigrations.ts
- frontend/src/game/store.ts
- frontend/src/game/telemetry.ts
- frontend/src/components/CampaignUI.tsx
- frontend/src/components/scene/Facility.tsx
- frontend/src/index.css
- frontend/src/sim/__tests__/balance.test.ts
- frontend/e2e/gameplay.spec.ts
- frontend/e2e/mobile.spec.ts

## Verification

Runtime: Node v22.23.3, npm 11.16.0. Checks use explicit npm-cli.js invocation through the cached Node 22 executable and Node 22 PATH for test/build scripts. No dependencies were installed/upgraded. All commands run in their package directories.

| Package / exact command | Result | Accepted baseline → result |
|---|---|---|
| Frontend npm run lint | PASS | 23 existing warnings → 23 unchanged warnings |
| Frontend npm run typecheck | PASS | PASS → PASS |
| Frontend npm test -- --reporter=verbose | PASS | 162 → 210 passed; 198 before clarity, plus 12 clarity tests; 1 optional TRACE skip retained |
| Frontend npm run test:coverage | PASS — 210 passed, 1 optional TRACE skip; 81.21% statements, 76.10% branches, 86.18% functions, 83.95% lines | Baseline 80.74% statements, 74.64% branches, 85.85% functions, 83.55% lines |
| Frontend npm run balance | PASS — 6 passed | 5 → 6 |
| Frontend npm run build | PASS | PASS → PASS |
| Frontend CI=1 npm run test:e2e | PASS — 15 passed in the final rebuilt CI full suite after clarity | 12 → 15 |
| git diff --check | PASS — no whitespace errors | PASS → PASS |
| Backend npm run lint | PASS | PASS → PASS, no warnings |
| Backend npm run typecheck | PASS | PASS → PASS |
| Backend npm run test:coverage | PASS | 18 → 18; 66.66% statements/lines, 58.82% branches, 68% functions |

Earlier checks caught and corrected invalid new-test preparation and the real mobile cache label being covered by the metrics sheet. The vertical strip's decorative arrows initially blocked dependency clicks; they now have constrained size and ignore pointer events. An existing 600-step trace test exceeded its 5-second timeout during concurrent CPU-heavy checks; isolated coverage passed without changing the test or timeout. The clarity browser run initially found a stale assertion for the replaced unrouted-app sentence; it was updated to check the new installed/routing explanation, and the final rebuilt CI suite passed all 15 journeys without a failing or flaky test. Concurrent Chromium/coverage also reproduced the existing trace-test timeout; standalone final coverage passed all 210 tests without changing its timeout. No unrelated baseline warnings were fixed. Browser runners retain their existing FORCE_COLOR/NO_COLOR warning. An intermediate PowerShell npm function wrapper lost the verbose separator; the recorded final verbose/coverage commands were rerun with Node 22 invoking npm-cli.js directly and succeeded.

Phase 1 regressions cover deterministic stepping/conservation, settlement, causal evidence and all three recovery paths. Phase 2 regressions cover onboarding, selection, milestone idempotency, migration, archive/timing, guest entry, bankruptcy/restart and continuation/reload. Phase 3 regressions cover per-instance processing, vertical/horizontal scaling, deterministic routing, idle capacity, LB activation, component overload, schema 3 and browser continuation. All previously accepted tests remain present; Phase 1–4 regressions pass in the final 210-test unit/coverage run and 15-test CI browser suite. Backend results above are retained from Phase 4 implementation; no backend changes or reruns were needed for the clarity pass.

New checks cover exact integer cache equations, old backlog, zero eligibility, cold/tuned warmth, costs/revenue/exposure, both profiles, app/DB constraints, prevention, deadline loss/readiness, deterministic evaluation, schema 3 preservation, schema 4 corruption, source backup/write failures, partial warmth/pending-action resume, paused entry and trace event attribution/deduplication. Browser checks cover read-heavy cache recovery, explicit write-heavy cache insufficiency followed by paid DB recovery, DB-only recovery, same-company reload, blocked API and real mobile room/strip selection.

Final diff whitespace check (git diff --check) passed. The working tree contains 17 modified and 8 added files (25 total), all Phase 4 gameplay, campaign-flow clarity, test and documentation changes; the index is empty. This report refresh is documentation-only and uses the existing final check results; no tests were rerun to edit the report.

Screenshots and Playwright/coverage outputs are generated under ignored test-results/playwright-report/coverage directories; they are not committed assets. Desktop workload evidence and the mobile screenshot are visually inspected. Automated accessibility checks cover named controls, existing focus rules and touch access; a full screen-reader audit remains unperformed.

## Definition of Done

| Approved contract item | Status / evidence |
|---|---|
| Same company/state continuity; earlier scenarios immutable | PASS — entry/resume tests; unchanged prior scenario files |
| Explicit entry/prevention; no advancement on boot/migration | PASS — engine/store/migration and retained-limit tests |
| Seeded versioned configuration; once-only workload events | PASS — seeded/pinned/deadline/contrast tests |
| Integer arithmetic; outcome/revenue conservation | PASS — fixed fixtures, backlog/outcome/accounting tests |
| Cold deployment, eligible warmth, used snapshots, tuning | PASS — boundary and exact-resume tests |
| Sequential 3,000 tier, scheduling/economics | PASS — delayed DB paths and six passing balance tests |
| Preserved incidents/latency/recovery/bankruptcy | PASS — Phase 1–3 and data capacity regressions |
| Actual causal workload/cache/capacity/app evidence | PASS — trace/report tests and browser reports |
| Shared accessible UI/Facility/strip evidence | PASS — browser desktop/touch checks; manual screenshot review |
| Campaign-flow clarity and preserved evidence | PASS — 12 UI tests, desktop/mobile progression assertions and screenshot review |
| No duplicate engine/store/renderer/persistence/telemetry | PASS — existing modules extended; one versioned config module |
| Schema 4 chain/resume/history/source preservation | PASS — migration, corruption, backup/write and resume tests |
| Legacy keys and unexported evidence protected | PASS — existing persistence/archive/reset regressions |
| Attributed local events, dedup and request/activation | PASS — existing durability plus new trace attribution tests |
| DB/cache/write-heavy/mobile/API-unavailable journeys | PASS — 15 passed in the final rebuilt CI full suite after clarity — actual browser paths |
| Node 22 / Phase 1–3 regressions and baseline exceptions | PASS — verification table |
| No deferred auth/cloud/proxy/later mechanics mixed in | PASS — unchanged stash and forbidden-file diff inspection |
| Human protocol/export ready; contrasting sessions/reasoning | NOT TESTED for actual sessions; protocol/export preparation PASS |
| Deployment/build verification | NOT TESTED — no deployment or deployed build verification performed |

## Deviations, deferred scope and remaining evidence

No approved physical scenario values or prices were retuned. Mobile screenshot review led to a narrow Phase 4 dependency-layout/cache-label adjustment; existing Phase 1–3 layout behavior is preserved. Optional explicit contrast was implemented as allowed. The existing history table's missing app/routing headers were aligned with its recorded columns while adding workload history. Inactive legacy weekly caching/tuning mechanics and historical records remain unchanged; active campaign tuning copy describes only the ceiling.

Deferred auth/cloud/session/OAuth/ownership/revision/proxy/central ingestion work remains isolated and unapplied. No Phase 5 mechanics were introduced or activated. No production backend/schema change, db:generate, database migration, dependency/audit command, stash operation, staging, commit, push or deployment was performed.

Actual deployment/build identity, configured playtest registration and participant sessions remain external evidence/release inputs. This development build uses the existing dev/unrecorded identifier unless VITE_BUILD_ID is provided; it does not qualify as recorded participant evidence. Human understanding, learning effectiveness, timing targets and deployment have not been claimed. Full Phase 4 DoD is not complete until contrasting human sessions are actually observed and reported. Stop for review before Phase 5.
