# Campaign-wide progression guidance guardrail

Reviewed: 10 October 2026. Repository: `C:/Users/user/99.9-Percent`; branch `ai/phase-5-progression`; HEAD `1322ebcdbade2fe4d1ec9fc34fb8bea652b6077a`.

This pass extends the existing working-tree Phase 5, comprehension and Opening prevention implementation. It changes presentation and tests only. It is not a deployment or human-acceptance claim.

## Derived guidance model

`frontend/src/game/campaignGuidance.ts` is a pure, unsaved projection of the current campaign. It returns the current stage, next stage, completed/incomplete requirements, a lock reason, a pending explicit action, waiting text and optional-context text. It uses the existing prevention requirements, `canEnterData`, `canEnterSpikes`, recovery predicate and pending-recognition helper. Scaling growth readiness mirrors the existing engine conditions; it does not supply engine inputs or introduce another progression system.

CampaignUI reuses this model for continuation availability, the factual checklist and the pending-action button. The initial screen keeps the checklist expandable to preserve the existing compact workflow; after growth, unmet requirements and required actions are shown directly. Existing objectives, system evidence and actions remain separate. No acknowledgement is performed by rendering guidance or closing a dialog.

Completed conditions use a visible check mark; incomplete conditions use a cross and a factual label. These states also have named DOM requirements for deterministic UI/browser assertions. Required review and continuation buttons are outside collapsed details and History. Spike recognition can now be dismissed and reopened from guidance, just like the existing Opening report and milestone, without acknowledging it.

## Stage requirements and apparent-stuck states

| Stage | Guidance and recovery from an apparent progression block |
| --- | --- |
| Opening reactive | Active incident: measured recovery still required; preventive requirements hidden. Actual recovered report: Review postmortem. Acknowledged report/pending milestone: Complete Opening. Only the existing explicit milestone acknowledgement enters Scaling. |
| Opening preventive | Actual growth/no incident, positive cash, full 800 req/s admission with no limit, healthy completed outcomes, empty queues, two post-growth inspections and five new stable observations. Shows the live count and explicit App/DB inspection controls. Limit explanation: “You are protecting the system by rejecting traffic. To prove the architecture can handle current demand, remove the limit and serve the full 800 req/s.” Outcome review and milestone acknowledgement remain separate explicit actions. |
| Scaling & Routing | Opening completion and Scaling entry; before growth, purchased DB headroom at least 2,000 ops/s, management, no incident and empty queues. Growth occurrence and actual report acknowledgements are shown separately. After consumed growth, Data continuation uses `canEnterData`; no new latency, cash or investment gate was added to that predicate. Waiting text does not reveal the saved growth deadline. |
| Data Strategy | Actual data growth, positive cash, Opening acknowledgement, management, no incident, empty queues, all reports acknowledged, healthy latency/errors and completed requests. Continue to traffic spikes appears only when `canEnterSpikes` allows it. Workload contrast, cache and DB purchases are explicitly optional rather than invented prerequisites. Data growth readiness and waiting are explained using the existing management/queue/report conditions. |
| Traffic Spikes | Both pulses ended, management, no incident, empty queues, acknowledged reports, baseline traffic, healthy completed outcomes and five stable baseline observations. Shows the recorded count and pending recognition. Manual capacity, admission relief and hybrid approaches remain valid; autoscaling is optional. Stay Online is explicitly unimplemented, so it cannot be unlocked by a player action. |

Required reviews/recognitions take priority over continuation. Readiness met but continuation pending surfaces the existing continuation action. An acknowledged Opening with a missing Scaling entry surfaces the existing `enter_scaling` action. A recovered report with no acknowledgement and no active review is diagnosed as inconsistent saved evidence; it is not silently repaired or falsely marked complete.

Scaling headroom that is currently unaffordable has a factual cash/settlement explanation. Pending revenue is not presented as spendable cash. This guidance pass cannot guarantee that every inefficient purchase sequence remains financially recoverable: positive cash alone does not prove that mandatory headroom is affordable or that the company can earn enough before insolvency. Guaranteeing universal financial recoverability would require an economy/progression change outside the requested boundaries. A public-engine reproduction (also a deterministic regression test) recovers Opening, keeps admission limited through step 300, installs App 2 and vertically scales App 1. At step 305 cash is $1,593.34, Scaling growth remains unconsumed, and the $3,000 DB upgrade is rejected. Full 800 req/s service earns $9,600 against $9,700 installed infrastructure/salary costs per full period. Removing the limit improves revenue but does not restore investment affordability. This is a supported economic dead end, not a missing report button. The universal “no solvent company permanently locked” goal is therefore not satisfied under the simultaneous no-balance/no-progression-change constraint.

No refund, bailout, alternate headroom gate or automatic reset was introduced.

## Files changed by this pass

Production presentation/model:

- `frontend/src/game/campaignGuidance.ts` — new pure derived projection.
- `frontend/src/components/CampaignUI.tsx` — integrated checklist/actions, prevention limit explanation, recognition reopening and hidden-growth-deadline wording removal.

Tests:

- `frontend/src/game/campaignGuidance.test.ts` — 39 deterministic cases covering all stage gates, optional mechanics, waiting/deadline privacy, pending actions, affordability, inconsistent review evidence, purity and equivalent reloaded state.
- `frontend/src/components/ProgressionGuardrail.test.tsx` — four real-store UI cases.
- `frontend/src/components/OpeningPrevention.test.tsx` — corrected existing corrupted tick/cross assertions to the proper readable symbols.

Browser journeys:

- `frontend/e2e/prevention.spec.ts` — limit explanation, updated full-admission requirement, inspection/streak/reload checks.
- `frontend/e2e/scaling.spec.ts` — real missing DB headroom before both existing recovery strategies.
- `frontend/e2e/dataStrategy.spec.ts` — actual unconsumed-growth blocker and optional contrast before both response paths.
- `frontend/e2e/guardrail.spec.ts` — advanced public-engine fixture with pulses ended; visible 1/5 observations, four public steps, pending recognition reopening and reload.

Documentation:

- `docs/CAMPAIGN_PROGRESSION_GUARDRAIL_REPORT.md` — this report.
- `docs/CURRENT_GAME_LOGIC_AND_FLOW.md` — linked presentation update; underlying mechanics retained.

Existing reactive Opening browser journeys already dismiss/reopen both report and milestone through guidance; they continue to exercise those actions. Existing mobile/touch journeys retain WebGL and shared selection. There are no new browser test hooks or direct store mutations from page evaluation.

## Unchanged mechanics and state

Progression logic changes: **NONE**. Simulation/balance changes: **NONE**. Cost, thresholds, scheduling, routing, controller, save schema and store semantics are unchanged. No new persistence fields or telemetry events were introduced.

All 52 pre-pass files under simulation and game (including existing tests, store, persistence, migrations and telemetry) match their captured SHA-256 hashes. The new guidance files are additions outside that protected pre-pass set. Earlier uncommitted work was preserved. Deferred auth/cloud stashes remain unapplied. Phase 6 was not started. Nothing was staged, committed, pushed or deployed.

## Validation

Node 22.23.3, commands from `frontend/`:

| Command | Result |
| --- | --- |
| `npm run lint` | PASS; 23 unchanged warnings |
| `npm run typecheck` | PASS |
| `npm test -- --reporter=verbose` | PASS; 338 passed, one optional TRACE skip |
| `npm run test:coverage` | PASS; 338 passed, one optional TRACE skip; isolated final run |
| `npm run balance` | PASS; eight passed |
| `npm run build` | PASS |
| `$env:CI='true'; node node_modules\@playwright\test\cli.js test` | PASS; all 22 journeys in one full run, no retries; final initial-checklist marker additionally checked by all four mobile journeys |
| `git diff --check` | PASS |

Coverage: 83.89% statements, 80.42% branches, 88.44% functions and 86.47% lines. The new guidance model has 100% statement/function/line coverage and 98.27% branch coverage. UI components are outside the configured coverage scope. Desktop spike and mobile initial-state screenshots were inspected.

An initial focused run caught unused UI bindings, which were removed, and a React test update missing an `act` boundary, which was corrected. A coverage run overlapping software-WebGL browser testing produced six 5-second timeouts in existing tests; final coverage was run in isolation without changing timeouts or assertions. Browser environment warnings about NO_COLOR/FORCE_COLOR and Git LF/CRLF normalization are retained separately from lint warnings.

Phase 1–5 regression evidence includes both Opening routes; all three reactive response paths; conservation, settlement and postmortems; onboarding/milestones; local saves/migrations/telemetry; scaling/routing; cache/workloads; delayed autoscaling/manual approaches; guest play with API blocked; reload and mobile selection.

Human comprehension, real-device/screen-reader acceptance, deployment and external services remain NOT TESTED. Inconsistent saved review evidence and financially unrecoverable purchases cannot be made recoverable by a presentation-only pass; they are explained without fabricating progress. Supported ordinary progression gates are now visible, but this is not an exhaustive proof of every possible action sequence.

## Current prevention UX and completion flow

The subsequent polish keeps the existing prevention/progression rules. FIRST GROWTH explains that handling growth without an incident is a valid success path. The compact checklist shows full 800 req/s service, Application inspection, Database inspection and Stable service: n / 5 seconds of simulated service; any unmet cash/queue/health requirement remains visible. Traffic limiting explicitly explains the rejected-demand trade-off rather than calling limited service an unqualified success.

Actual completion shows FIRST GROWTH PREVENTED and Review outcome. The existing modal is now named **Prevention review**, with What happened, What you prepared, What the evidence showed, Trade-offs and Outcome. Preparation uses recorded accepted actions and their activation state at completion; later purchases at the same physical step are excluded using the qualification trace identity. Pending investments are not described as already useful. Continue company awards the existing milestone, then explicit Continue operating enters Scaling; closing either dialog does not acknowledge it. Reviews and milestones can be reopened from guidance after dismissal/reload.

No simulation constants, costs, action/progression logic, store semantics or save semantics changed during that UI polish. The final validation below supersedes earlier totals, while earlier diagnostic runs and their limitations remain historical evidence.

## Final validation — Opening routes and progression guidance

Fresh validation on 10 October 2026 used Node **22.23.3**, npm **11.16.0**, branch `ai/phase-5-progression`, HEAD `1322ebcdbade2fe4d1ec9fc34fb8bea652b6077a`. These results cover the uncommitted Phase 5 implementation, reactive Opening fix, preventive route, campaign guidance guardrail and prevention UX polish together. Earlier validation sections remain historical evidence for their respective passes.

| Package / exact command | Result |
| --- | --- |
| Frontend `npm run lint` | PASS; 23 unchanged warnings, zero errors |
| Frontend `npm run typecheck` | PASS |
| Frontend `npm test -- --reporter=verbose` | PASS; 340 passed, zero failed, one optional TRACE skip; 27 passing files and one skipped file |
| Frontend `npm run test:coverage` | PASS; 340 passed, zero failed, one optional TRACE skip |
| Frontend `npm run balance` | PASS; eight passed, zero failed/skipped; these tests are also included in the unit total |
| Frontend `npm run build` | PASS |
| Frontend `$env:CI='true'; node node_modules\@playwright\test\cli.js test` | PASS; 23 passed in one full CI run, zero failed/skipped/retries |
| Backend `npm run lint` | PASS; zero warnings/errors |
| Backend `npm run typecheck` | PASS |
| Backend `npm run test:coverage` | PASS; 18 passed across four files, zero failed/skipped |
| Repository `git diff --check` | PASS |

Frontend coverage: **83.89% statements, 80.42% branches, 88.44% functions, 86.47% lines**. Backend: **66.66 / 58.82 / 68 / 66.66%**, respectively. The configured frontend scope excludes visual components and does not quantify browser coverage. The existing lint warnings and Playwright NO_COLOR/FORCE_COLOR environment warning remain; no warnings, dependencies or lockfiles were fixed.

| Required behavior | Status and evidence |
| --- | --- |
| Reactive Opening → recovery → postmortem → milestone → Scaling | PASS; all three browser response paths (DB upgrade, admission limiting, ineffective app then DB upgrade), engine and real-store UI tests |
| Preventive Opening → full-demand service → both inspections → five new stable steps → review → milestone → Scaling | PASS; engine, persistence, UI and fresh desktop/mobile browser journeys with API requests blocked |
| No premature or automatic acknowledgement/completion | PASS; missing-inspection/full-admission/health checks, failed-step reset, repeated acknowledgement and dismissed/reopened dialog tests |
| Required stage actions and factual blockers visible; valid interventions retained | PASS; 39 derived-guidance cases, real-store UI assertions and Scaling/Data/Spike browser journeys |
| No future event deadlines revealed by guidance | PASS; derived-model assertions and UI inspection; current measurements and accepted action countdowns remain visible |
| Reload: inspections, partial streak, pending prevention review, pending milestone and completed Opening | PASS; exact campaign equality after save/load, paused resume, UI reload cases and browser reloads |
| Save schema, source/legacy preservation and local telemetry | PASS; schema 1–5 migration and corruption/storage regressions; optional prevention extension without fabricated historical credit; deduplicated local events |
| Phase 1–5 regressions | PASS; full unit, coverage, balance and browser suites |
| Every solvent company can always advance | NOT MET; the known Scaling affordability trap remains, as documented below; guidance explains it but cannot repair it without changing economy/progression |

The known financial dead end remains reproducible through public actions: recover Opening, keep the limit through step 300, install App 2 and vertically scale App 1. At step 305 cash is **$1,593.34**, below the required **$3,000** DB headroom investment. Serving all 800 req/s earns **$9,600** per full period against **$9,700** operating costs. Solvency does not guarantee that the company can finance the gate. No bailout, refund, automatic reset or alternate gate was added. The previous healthy-Opening prevention dead end is resolved; universal financial recoverability is not claimed.

This final validation/documentation pass changed no gameplay, tests, configuration, manifests, lockfiles or protocol. The deferred auth/cloud stash remains unapplied at `44b80f65b9644bfceeda3107d0d32e3077ce94bc`. No Phase 6 work began. Nothing was staged, committed, pushed or deployed.

Human comprehension/enjoyment, real-device and screen-reader acceptance, and deployed build/URL verification remain **NOT TESTED**. Manual review should exercise both routes, dismiss/reopen their reviews and milestones, reload at each pending state, and check later-stage blockers and optional controls. Automated tests do not establish session duration or learning outcomes.
