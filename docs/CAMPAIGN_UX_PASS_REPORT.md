# Campaign comprehension and visual hierarchy pass

Reviewed: 10 October 2026. Repository: `C:/Users/user/99.9-Percent`, branch `ai/phase-5-progression`, HEAD `1322ebcdbade2fe4d1ec9fc34fb8bea652b6077a`.

This report covers the UX pass on top of the existing uncommitted Phase 5 implementation and Opening-flow fix. It does not claim deployment or human acceptance. `CURRENT_GAME_LOGIC_AND_FLOW.md` remains the reference for underlying campaign behavior; the presentation labels below supersede its older control labels.

## Root cause and resulting presentation

The working simulation exposed engineering evidence, but its screen hierarchy gave the office most of the space and placed the objective in a narrow sidebar. Actions appeared below the initial viewport. Generic onboarding, subtle incident styling and unexplained clock controls left a new player to infer their role and next action.

The existing CampaignUI now leads with campaign guidance, measured system status and architecture, followed by actions. Detailed evidence and finances remain available through expandable sections. The Three.js office remains the same renderer and selection surface; desktop composition gives it a smaller column, while mobile places it below the workflow.

At 1440 × 900, the first action section moved from about y=1300 to y=602, and guidance widened from about 314 to 914 pixels. At 393 × 851, the objective, status and dependency chain are visible before the office; actions begin around y=646. Mobile still requires scrolling for complete action descriptions and later-stage controls. The persistent clock footer remains visible.

## Existing systems reused

CampaignUI, Game composition, existing Modal/layout primitives, dependency selection, Facility, store actions, snapshot evidence, reports, milestones, onboarding metadata and stage gates are reused. No parallel tutorial, progression store, renderer, persistence layer or telemetry pipeline was introduced.

The presentation now provides:

- Three existing skippable introduction prompts explaining company role, dependencies and demand/capacity. Start company finishes the introduction and leaves physical time paused; it reveals no incident solution.
- Player-facing stage names: First Growth, Scale Your App, Data Bottlenecks and Survive Traffic Spikes, with existing internal stage identities retained. Stay Online is explicitly locked and unimplemented.
- Persistent completed/current/available-next/locked progression states, current objective and factual prerequisites. Required report and milestone actions remain outside expandable context.
- A prominent measured status: Healthy, Near capacity, Degraded, Incident, Recovering, Stable — traffic limited, Paused for review or Bankrupt. These labels do not change engine thresholds.
- Users → Application → Database evidence with actual demand/capacity, headroom and overload cues. Existing per-instance, cache and installed-versus-routed selection/evidence remain intact.
- Resume company, Pause company and Advance 1 step, with Slow/Normal/Fast pacing labels, visible running state and an explanation of physical seconds. Disabled incident stepping is explained; Run/Pause behavior is preserved.
- Neutral incident alerts and Investigate system. Inspection uses the existing free inspection action and opens detailed evidence; it still records the real inspection trace.
- Action cards with existing price/delay, effect and ongoing cost. Installed app capacity is explicitly distinguished from useful routed capacity. Admission relief explicitly rejects incoming demand.
- Causal report sections for what happened, what changed, resulting effects and trade-offs. SERVICE RECOVERED and FIRST GROWTH RECOVERED refer to actual recovery; FIRST GROWTH COMPLETE appears after milestone acknowledgement.
- Stage-specific introductions describing routing, read/write consequences and delayed automation. Spike presentation describes the actual two-pulse scenario without exposing exact upcoming physical deadlines.
- Traffic-limit admission/rejection and potential revenue not served, using the existing opportunity-value calculation. This is explicitly not an additional cash charge.

Detailed demand, capacity, utilisation, backlog, processed/failed outcomes, latency and errors remain available. Progressive disclosure changes their initial visibility, not their calculation.

## Files changed by this pass

Production presentation:

- `frontend/src/components/CampaignUI.tsx`
- `frontend/src/components/Game.tsx` — campaign layout class only
- `frontend/src/index.css`

Tests and browser journeys:

- `frontend/src/App.test.tsx`
- `frontend/src/components/CampaignUI.test.tsx`
- `frontend/src/components/CampaignComprehension.test.tsx` — new, 11 cases
- `frontend/src/components/SpikeUI.test.tsx`
- `frontend/e2e/gameplay.spec.ts`
- `frontend/e2e/mobile.spec.ts`
- `frontend/e2e/scaling.spec.ts`
- `frontend/e2e/dataStrategy.spec.ts`
- `frontend/e2e/spikes.spec.ts`

Documentation: `docs/CAMPAIGN_UX_PASS_REPORT.md`.

Other working-tree changes belong to the preceding Phase 5 implementation/Opening-flow work. They were preserved. All 49 pre-pass hashes for simulation and game/store/persistence/telemetry files, including their existing tests, matched after the UX edits. No simulation equations, balance, costs, store semantics, save schema/semantics, action scheduling or progression gates changed in this pass. There are no new persistence fields. Existing acknowledgement state remains the source of reload guidance. Deferred auth/cloud stashes remain unapplied; Phase 6 was not started.

## Validation

Node 22.23.3 was used. Commands run from `frontend/`:

| Command | Result |
| --- | --- |
| `npm run lint` | PASS; 23 existing warnings, no new warning |
| `npm run typecheck` | PASS |
| `npm run test:coverage` | PASS; 266 tests, 1 optional TRACE skip |
| `npm run balance` | PASS; 8 tests |
| `npm run build` | PASS |
| `$env:CI='true'; node node_modules\@playwright\test\cli.js test` | 18 PASS in full run; 2 stale-label failures, then both PASS on corrected focused rerun |
| `git diff --check` | PASS |

Coverage: 82.72% statements, 78.70% branches, 87.82% functions and 85.44% lines. The configured coverage scope covers simulation/game modules, so it does not quantify CampaignUI coverage. The new 11 UI cases verify introduction, initial hierarchy, detailed evidence, controls, neutral incident/recovery presentation, report/recognition, both workload profiles and actual spike/controller observations. Existing acknowledgement/reload and traffic-limit tests remain.

Final browser evidence covers all 20 journeys: 18 passing unchanged journeys plus both corrected Data Strategy journeys passing without retries. The initial full run failed only those two old-label assertions; it was not a clean 20-test run. Focused recheck: `$env:CI='true'; node node_modules\@playwright\test\cli.js test e2e/dataStrategy.spec.ts`. Browser tools emitted the existing NO_COLOR/FORCE_COLOR environment warning; Git also reported normal LF-to-CRLF normalization for CampaignUI, with no whitespace defects.

The genuine fresh-guest browser journey uses public controls through the introduction, step-4 growth, first incident, inspection, measured recovery, report acknowledgement, milestone acknowledgement and same-company Scaling entry. All three existing Opening response paths remain covered. Browser coverage also retains scaling, data, spikes, reload, corrupt-save preservation, touch selection and backend-unavailable guest play.

During verification, a new test incorrectly expected inspection to leave the trace unchanged; it now expects the existing inspection event. Browser stage-label assertions were updated to the new player-facing label. No production behavior was changed to satisfy these assertions.

## Exact manual walkthrough: new company to Scaling

Use a fresh browser profile/private window at the local game URL so no prior onboarding preference or company exists. This avoids resetting/exporting an existing company merely for this check.

| Screen/state | What you see and click | What to notice and why |
| --- | --- | --- |
| Entry | Click Try Prototype. | Guest entry requires no backend or account. |
| Introduction 1 | Company role; Next. | You manage service for a growing company. The physical step stays 0. |
| Introduction 2 | Users → Application → Database; Next. | Dependencies and selection explain where to inspect evidence. |
| Introduction 3 | Demand/capacity explanation; Start company. | No answer is supplied. The company starts paused. Skip remains available. |
| Initial company | First Growth is Current; objective, Healthy, incoming 300 req/s, dependency evidence and actions. | App 300/1000 and DB 300/600 establish headroom. Detailed system evidence expands for full metrics. |
| Growth | Click Advance 1 step four times. | At step 4 incoming becomes 800; DB offered demand exceeds capacity and status becomes Degraded. No scripted victory/incident is triggered by the UI. |
| Incident | Advance two more steps. | At step 6 the actual overload incident is prominent and the first incident pauses. Advance is disabled with an explanation. |
| Investigation | Click Investigate system, inspect component demand/capacity, backlog, latency and errors. | The evidence identifies where work is constrained; the alert does not tell you what to buy. Inspection is free and consumes no step. |
| One valid response | For this test path, click Upgrade database, then Resume company. | Cost is immediate; activation remains delayed by three physical steps. Watch the countdown and real queue drainage. This walkthrough choice is not an in-game recommendation. |
| Recovery | Wait for the engine to record stable recovery and pause for the report. | Recovering is shown before completion; clicking an investment is not recovery. |
| Report | Read the causal sections, then Continue company. If dismissed, use Review postmortem in guidance. | Report acknowledgement awards recognition once without a resource reward or physical step. |
| Milestone | FIRST GROWTH RECOVERED appears. Click Continue operating. If dismissed, use Complete Opening in guidance to reopen it. | Closing a dialog is not acknowledgement. Explicit acknowledgement completes Opening. |
| Scaling entry | First Growth is Completed; Scale Your App is Current; FIRST GROWTH COMPLETE and stage context appear. | Same company, cash, evidence and step persist. The company remains paused. Factual DB headroom 1000/2000 explains why the next growth wave has not started. |
| Reload | Reload and Continue company. | Completed Opening and current Scaling guidance persist; no duplicate recognition or new run is created. |

## Remaining limitations and acceptance

Advanced stages still expose several meaningful controls and can feel dense. Mobile requires scrolling, and the smaller desktop office can clip labels at its edges; camera controls and the shared dependency view remain available. Detailed evidence is initially collapsed, making clear inspection entry points important.

At the time of this UX pass, Opening still required an actual recovered incident: proactively preventing every Opening incident did not unlock Scaling. This UX pass did not change that rule. A subsequently authorized prevention route now addresses it; see [OPENING_PREVENTION_IMPLEMENTATION_REPORT.md](OPENING_PREVENTION_IMPLEMENTATION_REPORT.md). Pending revenue remains unspendable until settlement; UI improvements cannot guarantee profitability for every inherited company.

Rendered desktop/mobile screenshots were inspected and automated journeys exercise real WebGL. Real-device testing, screen-reader testing, human comprehension/enjoyment, user manual acceptance and deployment remain NOT TESTED. No 10–15-minute duration or learning improvement is claimed. Nothing was staged, committed, pushed or deployed by this pass. Stop before Phase 6.

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
