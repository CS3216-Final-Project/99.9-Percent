# Opening prevention completion

Implemented 10 October 2026 on `ai/phase-5-progression`, on top of the existing Phase 5 implementation and campaign UX pass. No deployment, save reset, staging or commit is claimed.

## Root cause and authorized change

Opening previously required an actual incident, recovery, report acknowledgement and milestone acknowledgement. A player who limited traffic before overload and later upgraded the database could serve healthy demand indefinitely without generating that report. Opening growth was consumed once; there was no further event to create the required incident. This was a progression dead-end, not a reason to fabricate failure or force a restart.

The user's implementation request authorizes a second Opening route while preserving the reactive path and all Phase 1–5 physical/balance constants. `CURRENT_GAME_LOGIC_AND_FLOW.md` has been updated to describe the new route.

## Exact rules

Eligibility is Opening-only, with consumed Opening growth and no current or historical incident, recovered report, recovery flag, milestone or later stage. `firstPauseConsumed` and recorded incident-opened events prevent qualification after an actual incident.

Five consecutive new physical observations require:

- Positive cash.
- No traffic limit, incoming and admitted demand both 800 req/s, no rejection.
- Every application queue and the database queue empty.
- Existing healthy latency <500 ms and service errors <1%, with completed outcomes.
- Explicit Application and Database inspections after Opening growth.
- Each counted observation occurs strictly after tracking begins and both credited inspections.

Any failed observation resets the streak, including bankruptcy. Inspections, paused time, reload and acknowledgements do not advance it. Historical observations and inspections are never backfilled. Once any Opening incident opens, the reactive route remains authoritative.

At five observations the engine stores a distinct prevention outcome with actual snapshots and trade-off evidence, pauses advancement, and exposes Review outcome. It does not create an incident/postmortem and does not set `openingRecovered=true`.

Continue company acknowledges this outcome and awards the existing Opening milestone once, without resources. The same Complete Opening / Continue operating acknowledgement invokes existing `enterScaling`. Company identity, finances, architecture, queue/pending state and histories remain intact. Later real incidents retain their normal reports without awarding Opening again.

## Reuse and persistence

The new small pure `openingPrevention.ts` module contains Opening-specific eligibility, shared requirement projection and observation/inspection helpers. Existing `step.ts` owns physical stepping and acknowledgement; existing store, CampaignUI, milestone, modal and persistence paths own their current responsibilities. This is not another campaign or progression store.

Schema remains **5**. `openingPrevention` is optional and initialized lazily by new steps or explicit post-growth inspection, not loading. Existing saves are validated and returned unchanged; they start with no prevention credits. Current validation checks optional fields, inspection/qualification trace evidence, five real snapshots and milestone provenance. Corrupt source payloads remain protected. Existing source-byte backup/migration chains and legacy namespaces are unchanged.

Prevention milestones use the same milestone ID and acknowledgement transition, with `incidentId=null` and an optional prevention `outcomeId`. Older builds predating this feature cannot read that new milestone variant; keep a company export before rolling back. No old incident ID or recovered flag is fabricated to make an older validator accept it.

## Telemetry and guidance

Existing trace-backed local telemetry adds:

- `opening_prevention_eligible`
- `opening_prevention_application_inspected`
- `opening_prevention_database_inspected`
- `opening_prevention_qualified`
- `opening_prevention_review_acknowledged`

Trace event IDs retain existing deduplication. Qualification/inspection/acknowledgement are not purchases or gameplay decisions. Existing opening-completion measurement occurs at milestone award, attributed to `outcome=prevention`.

Guidance shows the outstanding requirement checklist, explicit inspection buttons and stable observations 0–5. Pending outcomes remain discoverable outside History, including after dismissing a dialog or reloading. The distinct review explains 800 req/s growth, adequate app/DB capacity, full admission, inspections, setup spending, prior rejected-demand opportunity value and any installed-but-unrouted capacity. Acknowledged outcomes remain readable in History.

## Files changed in this task

Production:

- `frontend/src/sim/openingPrevention.ts` — new pure Opening helpers.
- `frontend/src/sim/step.ts` — observation hook, prevention pause and acknowledgement.
- `frontend/src/sim/campaignTypes.ts` — optional state and milestone provenance.
- `frontend/src/sim/types.ts`, `actions.ts` — distinct acknowledgement action.
- `frontend/src/game/store.ts` — shared clock/action guards for pending prevention review.
- `frontend/src/game/saveMigrations.ts` — optional extension and milestone validation; no schema bump or new migration.
- `frontend/src/game/telemetry.ts` — projection through the existing local archive.
- `frontend/src/components/CampaignUI.tsx` — checklist, distinct review and existing milestone presentation.

Tests:

- `frontend/src/sim/__tests__/openingPrevention.test.ts`
- `frontend/src/game/openingPrevention.test.ts`
- `frontend/src/components/OpeningPrevention.test.tsx`
- `frontend/e2e/prevention.spec.ts`
- Historical-format fixture adjustments in `phase2.test.ts`, `scalingPersistence.test.ts`, `dataPersistence.test.ts`, `spikePersistence.test.ts`: omit the new schema-5-only field when generating schemas 1–4. Existing migration assertions remain.

Documentation: this report and `docs/CURRENT_GAME_LOGIC_AND_FLOW.md`. All preceding uncommitted Phase 5/UX work was preserved.

## Validation

Final results: Node 22.23.3; npm 11.16.0. No dependencies, lockfiles, backend/auth work, deployment configuration or stashes were changed.

| Command from frontend | Result |
| --- | --- |
| `npm run lint` | PASS; 23 unchanged warnings |
| `npm run typecheck` | PASS |
| `npm run test:coverage` | PASS; 295 passed, 1 optional TRACE skip |
| `npm run balance` | PASS; 8 tests |
| `npm run build` | PASS |
| `$env:CI='true'; node node_modules\@playwright\test\cli.js test` | PASS; 21 passed, no retries |
| `git diff --check` | PASS |

Coverage: 83.25% statements, 79.83% branches, 88.29% functions, 85.93% lines. The new pure prevention module has 100% statement/branch/function/line coverage. Twenty-nine new unit/UI cases passed. The coverage scope excludes CampaignUI itself; UI behavior is asserted in the component/browser suites.

Focused initial engine/persistence checks: 22 passed. UI cases cover the checklist, distinct dismissible review, milestone and reload at streak/outcome/milestone/Scaling states. Full regression coverage retains all Phase 1–5 engine, store, migration, economy and UI tests. A later-stage test verifies that prevention provenance survives an actual scaling incident and Data continuation.

The new browser journey uses genuine fresh-company public controls, with API requests blocked: prevent overload, consume growth, remove the limit, inspect both components, collect five new observations, reload during the streak and pending outcome, acknowledge outcome/milestone, enter Scaling and reload the same company. Existing three reactive Opening paths remain covered.

The first full unit run found seven old-format fixture failures because current-engine fixture generation retained the new optional field while claiming an earlier schema. Removing it from historical fixtures restored their intended formats; production validation was not loosened. The final results below supersede that diagnostic run.

## Existing-company recovery and limits

For the previously reported step-405 company, once the updated local build is running: Continue company, inspect the prevention checklist, Remove traffic limit, explicitly inspect Application and Database, then advance five qualifying steps. With the reported empty queues and 1,000-capacity app/DB, full 800 req/s has headroom. Use Review outcome → Continue company → Complete Opening if the milestone was dismissed → Continue operating. No restart is necessary for an eligible solvent company. The user's browser save was not edited or imported; the test uses a representative old schema-5 dead-end and preserves its run identity.

If an actual incident previously opened, prevention is unavailable and the original recovery path applies. Insolvent companies cannot qualify. Qualification requires new evidence, not elapsed playtime or retrospective credit. Human acceptance, deployment and real-device testing remain NOT TESTED. An already-open game tab may need a normal reload to run the rebuilt code; production hosting has not been updated.

Scenario constants, traffic values, prices, settlement math, recovery/incident thresholds and later-stage gates were unchanged. Hash checks confirmed unchanged opening/scaling/data/spike scenario files, balance, settlement and autoscaling modules. Deferred auth/cloud stash remains unapplied. Phase 6 was not started.

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
