# Campaign recovery acknowledgement and learning report

Local presentation work on `fe/campaign-guidance-phase-1`, based on `6546f0c5169b6bb6b34a162801dfbfa128ef1e42`. The initial `git fetch origin main` succeeded after the sandbox retry; the refreshed comparison was 0 ahead / 0 behind. No branch, worktree, commit, push, PR, merge or deployment was created.

## Audit and boundaries

- `sim/step.ts` owns recovery: `qualifiesForRecovery` and `recoverySafe` must qualify for five consecutive game seconds. Only then does it record `incident-recovered`, append `causalPostmortem`, clear the incident and enter `review`. Purchases and improving snapshots alone do not qualify.
- `sim/trace.ts` retains report-local snapshots, events, explanations, admission status and episode setup spending. Its events include requested/activated/cancelled actions, recovery streaks, workload, routing, failure and automatic decisions. These historical records are used directly; later live-company state cannot rewrite a report.
- `CampaignUI.tsx` previously opened the dense report immediately during review and reused it in History. It had no separate recovery acknowledgement. The existing Opening milestone, prevention, spike, reliability and growth outcomes are separate mandatory reviews and retain their original order.
- `acknowledge_review` remains the sole engine action dispatched by **Continue company**. It resumes management, records the acknowledgement and awards the existing first-incident milestone where appropriate. The new first-stage button dispatches no action.
- `campaignGuidance.ts` and chapter predicates continue requiring actual report acknowledgements. No new educational text is used as a completion predicate.
- Chapter 0 walkthrough and separate practice-company reports retain the original component and immediate review flow, including resumed incidents hiding the lesson card. Their tutorial clock hold and practice save isolation are untouched.
- Classic uses `Modals.tsx` / `Views.tsx` and the separate Classic postmortem model. Those files are unchanged.
- Existing global Hint, idle/Run attention, purchase targeting and Confirm gold implementation are unchanged by this task. Both recovery screens reuse the existing modal, so the existing modal-priority rule suppresses optional attention.

## Before and after

Before: confirmed recovery → Incident postmortem → setup spending, evidence prose and three detailed disclosures → Continue company.

After, for ordinary Campaign Chapters 1–6:

1. Confirmed recovery → centered **System Recovered!**, “Great work! Your app is running smoothly again.” → **View Incident Report**. Limited recovery also explicitly warns that some requests are still rejected.
2. **Incident postmortem**, with **What went wrong?**, **What changed?**, **What did you learn?**, **Remember for next time**. Each contains one or two short sentences. At most three primary metrics: episode setup spending, recorded final response time when available, and traffic status.
3. Collapsed **View technical details** retains all original explanations without truncating their precision, incident game seconds, workload/cache observations, demand/capacity/backlog/routing/latency/error table, complete event data and complete recorded snapshots. The raw observation disclosure also preserves fields beyond the compact table, including failure health and detailed workload counters.
4. Existing **Continue company**, unchanged engine action and subsequent milestone/chapter flow.

History uses the same compact report without replaying the recovery acknowledgement. Technical tables scroll horizontally within a keyboard-accessible region. The active review scrolls its report body separately from the Continue footer, so focusing Continue does not scroll past the opening explanation on a short phone. Existing modal focus handling and Warm Desk styling are retained. No celebratory animation was added, so reduced motion needs no exception.

## Evidence selection and uncertainty

The pure `incidentLesson(report)` resolver reads only report snapshots and events. It finds the incident-opening observation and exact recorded recovery observation, rather than guessing missing final metrics. Observed failed servers, database overload and individual/aggregate application overload select the opening explanation.

Requested actions are matched to actual activation events by action ID. The short summary lists at most three recorded changes, with further changes retained in details. Installation is called installation, routing is called routing, and a purchase/activation is never described as proof of recovery. Cache research, an unactivated purchase and an autoscaling decision do not become deployed capacity. Restoration and spare promotion have separate descriptions. Temporary demand ending is an observed change, not a player investment.

The outcome sentence reports empty queues only when both recorded final queues are empty. Otherwise it reports authoritative recovery while explicitly declining to isolate a cause. Previously installed serving capacity is acknowledged where it was actually observed and no activation during the incident was retained; this does not claim those investments alone caused recovery. Multiple changes are listed without assigning individual credit.

Learning follows the observed constraint/change: failures and useful routed spares; deployed caching and writes; application installation/routing and separate database limits; temporary pressure; or a general bottleneck lesson. A retained traffic limit always makes the trade-off explicit: rejected requests earn no revenue, and full incoming demand has not been verified. Upgrades and additional servers can introduce ongoing costs; no unrecorded running-cost amount is manufactured.

**Episode setup spending** is the existing `report.setupCents`, not a new calculation or claim of incident-only repair cost. The disclosure explains that the engine includes preparation purchases since the preceding report (or company start), and excludes running costs. No spending or latency formula changed.

### Representative summaries across Chapters 1–6

These are evidence-dependent examples, not scripts selected solely by chapter number. A different response or workload produces a different report.

| Chapter / observed example | What went wrong? | What changed? | Learning / trade-off |
| --- | --- | --- | --- |
| 1: actual DB upgrade | The database could not keep up with the work reaching it, causing delays. | Database capacity increased; the recorded queues were empty at confirmed recovery. | One overloaded component can slow down the whole app. More DB capacity adds ongoing costs. |
| 2: growth with admission relief | Application or database work exceeded its recorded capacity. | Less traffic was admitted, then sustained recovery was confirmed. | Installed servers help only when traffic reaches them; limited recovery does not verify full demand and rejected requests earn no revenue. |
| 3: read-heavy cache deployment | The database could not keep up. | A cache change activated; the recorded recovery outcome followed, without asserting isolated causation. | A working cache can reduce repeated reads; writes and uncached reads still reach the database. Research alone does not deploy a cache. |
| 4: traffic pulse with prior capacity | The overloaded component is named from the opening observation. | Temporary demand eased, or a recorded admission/routing/scale change activated; existing capacity is acknowledged when no new activation was recorded. | Check capacity for the next peak; autoscaling decisions still need installation and routing, and application capacity does not enlarge the database. |
| 5: actual failed-server restoration | A server failed, reducing available capacity. | A failed server was restored; a promoted spare is mentioned separately only if recorded. | A spare helps only when it receives traffic. Service recovery and repairing the failed server are separate checks. |
| 6: failure under growth load | A server failed, or measured application/database work exceeded capacity. | Actual restoration, routing or pressure-ending events and the recorded recovery outcome. | Healthy routed capacity matters under load; later company configuration does not retroactively explain this report. |

### Missing evidence and presentation receipts

Historical snapshots remain in their original form. Missing workload/cache fields produce one concise explanation per report, not a repeated message for every observation. Missing routing is shown as an em dash. No table is rendered for an empty snapshot list; missing events are stated once. Missing causes fall back to an explicit evidence limitation; missing final latency omits that metric. Complete historical values remain readable in technical details.

The recovery notice has a presentation-only localStorage receipt, `99.99.recovery-notice:<runId>`, holding the latest incident ID/recovery-step pair. It is written when the acknowledgement is displayed, independently of simulation saves, replay inputs, schemas and engine acknowledgement. Reload from either stage opens the still-required report without repeating the notice. A subsequent incident gets its own notice. StrictMode does not duplicate it. If browser storage throws, an in-memory receipt prevents repeats during the visit and review remains usable; remembering the notice across a full page reload cannot be guaranteed when storage is unavailable. A different browser with no receipt may show the acknowledgement again for an imported pending review.

## Exact task-specific changed paths

Existing Phase 1 changes were preserved. This recovery task adds or further changes precisely these 14 paths:

Production presentation (four):

- `frontend/src/components/CampaignUI.tsx`
- `frontend/src/components/CampaignIncidentReport.tsx`
- `frontend/src/components/CampaignIncidentReport.css`
- `frontend/src/game/campaignPostmortem.ts`

Unit/component tests (five):

- `frontend/src/App.test.tsx`
- `frontend/src/components/CampaignRefinement.test.tsx`
- `frontend/src/components/ProgressionGuardrail.test.tsx`
- `frontend/src/components/CampaignIncidentReport.test.tsx`
- `frontend/src/game/campaignPostmortem.test.ts`

Browser tests/helpers (four):

- `frontend/e2e/fixtures.ts`
- `frontend/e2e/incidentRecovery.ts`
- `frontend/e2e/incidentRecovery.spec.ts`
- `frontend/e2e/mobile.spec.ts`

Report (one): `docs/CAMPAIGN_RECOVERY_POSTMORTEM.md`.

Existing browser journeys handle only the new **View Incident Report** presentation button via a shared locator handler. They still explicitly inspect/acknowledge the real report and retain their behavioural checks. Dedicated two-stage/reload/focus journeys opt out of that handler. No assertion timeout, retry, skip, forced click or recovery threshold was weakened.

## Validation

Node **22.23.3**. Frontend lint, typecheck and production build passed on the final runtime source. The existing 1,512 kB Facility chunk advisory remains. The serial unit/component batch passed **145 tests in ten files** (80.30 seconds). The final affected resolver/report rerun passed **26 tests in two files** (9.06 seconds), including one additional unrelated-failed-server boundary: **146 distinct focused cases** have passing verification across these runs. The scoped modal scroll layout and final conservative evidence handling are also covered by the final real-browser run.

The unit/component command, from `frontend/`:

```powershell
npm test -- --maxWorkers=1 src/game/campaignPostmortem.test.ts src/components/CampaignIncidentReport.test.tsx src/components/CampaignRefinement.test.tsx src/components/ProgressionGuardrail.test.tsx src/App.test.tsx src/components/CampaignAttention.test.tsx src/components/CampaignUI.test.tsx src/components/CampaignTutorial.test.tsx src/game/campaignAttention.test.ts src/components/idleAttention.test.ts
```

The first browser batch finished **21 passed / four failed** (25 selected journeys, 5.8 minutes). All four new recovery journeys reached a paused-clock reload and failed the unchanged actual-room initialization assertion (missing canvas or scene labels). The engine remained in review with its report intact. The correction resumes rendered frames during reload, then freezes the clock again after the real room initializes; review remains paused and the save's inputs and physical step are still asserted unchanged. No room assertion or timeout was weakened.

The 21 passing existing browser cases cover six short chapter Hints, six immediate Confirm gold cases, two recovery/postmortem priority cases, full interactive Chapter 0, incident practice replay, final tutorial clock hold/reload, Classic controls at 1440/320px and Hint targeting at 390/320px. The corrective run passed **all six affected journeys** (2.2 minutes, retries 0), including both modal-priority cases and all four desktop/touch recovery cases. **All 25 distinct selected browser journeys have passing verification across runs; this is not one green 25-case batch or a full-suite claim.** A final four-case recovery rerun after the last evidence refinements is recorded below.

Initial browser command (from `frontend/`, `PLAYWRIGHT_PORT=4197`, Node 22):

```powershell
node node_modules/@playwright/test/cli.js test incidentRecovery.spec.ts mobile.spec.ts campaignAttention.spec.ts campaignTutorial.spec.ts controls.spec.ts --grep 'recovery report:|guidance measured incident recovery|guidance pending postmortem|Chapter 0 requires real|Back and Save and exit|saved Chapter 0 replay.*1440|Challenge incident transport|simple Hint|action confirmation|Phase 1 Hint' --retries=0 --output=../test-results/recovery-postmortem/browser-artifacts
```

Corrective browser command:

```powershell
node node_modules/@playwright/test/cli.js test incidentRecovery.spec.ts mobile.spec.ts campaignAttention.spec.ts --grep 'recovery report:|guidance measured incident recovery|guidance pending postmortem' --retries=0 --output=../test-results/recovery-postmortem/browser-corrections-artifacts
```

Final runtime browser command:

```powershell
node node_modules/@playwright/test/cli.js test incidentRecovery.spec.ts mobile.spec.ts --grep 'recovery report:' --retries=0 --output=../test-results/recovery-postmortem/browser-final-artifacts
```

The final four-case run passed **4/4** (35.0 seconds, retries 0) on the final production build; no runtime source changed afterward. The journeys assert no premature acknowledgement, the ordered screens, focus and Tab containment, a visible opening explanation at 320px, unchanged engine inputs/cash/physical time through viewing/reload, actual technical explanations and event history, once-only acknowledgement across reload from either stage, preserved first milestone and History access. Desktop and 390/320px touch captures were reviewed locally; reduced motion is enabled in the touch cases.

Local final captures: [desktop report](../test-results/recovery-postmortem/browser-final-artifacts/incidentRecovery-recovery--c4ed3--focus-and-reload-database--chromium/postmortem.png), [320px report](../test-results/recovery-postmortem/browser-final-artifacts/mobile-Campaign-recovery-f-82e10-vidence-and-reload-at-320px-mobile-chromium/postmortem.png). These ignored artifacts are not Git content.

The first 56-case unit batch had 55 passes and exposed hidden technical-table focus. The scroll region is now focusable only when its disclosure is open; initial modal focus goes to the visible report button/Continue. A later 143-case run had 142 passes and exposed a fixture assumption: Chapter 6's prepared first wave never opened an incident. The fixture now reaches its real third, failure-under-load round. The 24-case focused rerun passed, followed by the final 145-case batch, including a new null/missing numerical-evidence boundary. These diagnostics are retained, not described as successful full-suite runs.

Build outputs, screenshots, traces and diagnostics remain ignored under `test-results/recovery-postmortem/`. Two unchanged Classic journeys logged the expected local `/api/session` refusal because no backend server was running; they passed and had no unhandled browser errors. Backend/shared, simulation rules, finances, chapter gates, persistence/schema and deployment files are unchanged. No dependency upgrade or migration was needed.

These are focused frontend checks, not full frontend/backend coverage or the complete existing browser suite. Chromium desktop and touch emulation do not establish Safari/Firefox, real-device or screen-reader acceptance. Reading the report within 15–30 seconds remains a human playtesting criterion. The receipt's unavailable-storage and different-browser limitations are described above.

Final Git hygiene: `git diff --check` passed, no staged paths or unmerged entries. All 29 pending paths are intentional: the 17 existing Phase 1 paths plus 12 newly pending paths, with this task further editing two already-pending paths. No generated output, screenshot, local log or temporary script is included. Simulation, store, persistence/schema, backend/shared, dependencies and workflows have no diff. Nothing was committed or published.
