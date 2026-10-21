# Intelligent incident Pause guidance


## Phase 2 correction - pointer capture (October 20)

Initial local work on `fe/campaign-guidance-phase-2`, based on merged main `f5848e0`; the required initial fetch confirmed 0 ahead / 0 behind. This section supersedes the historical pointer-lock exclusions below. Publication validation is recorded in `CAMPAIGN_CHAPTER4_GUIDED_FLOW.md`; the local status and results below describe the development checkpoint.

A real first-person Chapter 3 browser reproduction confirmed the failure before the correction: the engine opened its expected new incident, the company remained running and Pause was enabled, but no button glowed. The host classified `document.pointerLockElement` as a blocker, both when observing the incident transition and when rendering Pause. Its pointer-lock listener also discarded the incident token. Earlier browser cases always used the overview and therefore missed normal captured-mouse play. Chapter 1's first-incident engine/store stop is separate and correct; it remains unchanged.

The existing host now distinguishes mandatory/focus blockers from ordinary mouse capture. New running unresolved incidents can immediately mark the existing Pause button while the camera owns the mouse. Escape can release that mouse without consuming the offer; held movement-key repeats are also not treated as a fresh acknowledgement. A new deliberate interaction still dismisses once, as before. Pausing removes gold and starts the existing ten-second eligible Hint interval when diagnosis is still needed. No camera is moved or unlocked automatically.

Optional help remains blocked while the mouse is captured. Tutorials/practice, actual modals, confirmations, hidden/unfocused state, blocking views, paused companies and valid recovery paths retain their previous precedence. Existing manual accepted investigation ownership remains unchanged. The same resolver, ephemeral incident token, single spotlight owner and shared gold class are reused. Simulation, store clock/automatic-stop rules, chapter progression, header, controls, styling and saves are untouched.

New tests cover captured-mouse arrivals across all six chapters at the real-store boundary, real pointer capture and Escape in browser Chapters 2-6, held-key repeats, modal priority and accepted recovery. The browser Chapter 1 case retains its actual first-incident automatic stop; a real subsequent Chapter 1 incident remains a store-boundary case because loading acknowledged Opening normally enters Scaling.

Final focused unit validation: **95 passed in five files** (73.69 seconds), including nine new captured-input/priority cases. Frontend lint, typecheck and production build passed; the existing large Facility-chunk advisory remains. The initial unit attempt exposed a missing jsdom pointer-lock API in the new test setup (now explicitly defined/restored) and one pre-existing fixture-heavy resolver test hit its unchanged five-second limit. That resolver case passed in the final batch without changing its timeout or assertions.

The final browser selection passed **23 desktop cases**: native captured-mouse incident arrivals in Chapters 2-6, overview arrivals, Chapter 1's automatic stop/resume, Pause-to-Hint timing, accepted action/immediate Confirm, recovery exclusions, deliberate dismissal, four shared confirmation flows, complete interactive Chapter 0 and Classic layouts at 1440/320px. The same run had **two touch failures**, retained for diagnosis: 390px completed every gameplay assertion before browser-context teardown stalled for about 659 seconds; 320px stalled during WebGL initialization before incident assertions, with a roughly 695-second trace wait despite the unchanged ten-second expectation. These indicate browser/host stalls rather than a demonstrated guidance assertion defect; their exact environmental cause is unconfirmed. Both unchanged touch cases passed in a fresh Chromium process, retries 0: **2 passed in 45.4 seconds** (20.6/20.2 seconds). All **25 distinct selected journeys** therefore have passing verification across runs; this is not one green 25-case batch. No runtime source changes followed the final build.

Commands from `frontend/`, Node **22.23.3**, one worker, browser `PLAYWRIGHT_PORT=4197`:

```powershell
npm test -- --maxWorkers=1 src/components/IncidentPause.test.tsx src/game/incidentPause.test.ts src/components/CampaignAttention.test.tsx src/game/campaignAttention.test.ts src/components/idleAttention.test.ts
npm run lint
npm run typecheck
npm run build
node node_modules/@playwright/test/cli.js test incidentPause.spec.ts mobile.spec.ts campaignAttention.spec.ts campaignTutorial.spec.ts controls.spec.ts --grep 'incident Pause:|action confirmation shared immediate gold:|Chapter 0 requires real|Challenge incident transport' --retries=0 --output=../test-results/phase2-pause/browser-final-artifacts
node node_modules/@playwright/test/cli.js test mobile.spec.ts --project=mobile-chromium --grep 'incident Pause:' --retries=0 --output=../test-results/phase2-pause/browser-touch-diagnostic-artifacts
```

Only four paths are changed for this correction: the existing `CampaignAttention.tsx` host, its `IncidentPause.test.tsx` tests, `incidentPause.spec.ts` and this report. The first failed product reproduction, browser failure traces and local screenshots remain ignored under `test-results/phase2-pause/`. No skip, forced click, automatic retry, timeout increase or relaxed assertion was introduced. This is focused frontend validation, not full coverage, backend validation or the complete browser suite; Chromium touch emulation does not establish real-device, Safari/Firefox or screen-reader acceptance. No commit or push is authorized or performed.

## Historical Phase 1 implementation

Local implementation on `fe/campaign-guidance-phase-1`. At task start, `git fetch origin main` succeeded; the freshly fetched comparison was 0 ahead / 0 behind. All earlier Phase 1, progression-attention and recovery-report work is preserved. No new branch/worktree, commit, push, PR, merge or deployment.

## Audit and root cause

- The engine opens an incident after its authoritative overload/failure thresholds, records an incident ID and enters `incident`. `step.ts` already returns `first-incident` for the first incident in a company. The store stops running for that result and for the transition of `firstPauseConsumed`; it also stops on reviews and required acknowledgements. Later incidents normally remain running. None of these behaviours changed.
- `CampaignPanel` derives its incident/recovery presentation from the real phase and observations. `CampaignControls` uses the existing single Run/Pause dock button; its dimensions, label, icon, handler and speed are unchanged.
- Previous guidance only gave Run gold while paused, and deliberately prevented accepted Run help from marking Pause. It had no separate once-per-new-incident Pause signal. An unresolved incident could therefore remain running while Hint merely became eligible after idle time.
- The existing resolver already distinguishes investigation from relevant pending activation, measured drainage, qualifying recovery, safe failover and restoration. The new Pause eligibility reads that same decision rather than making another set of recovery rules.
- A real Chapter 1 repeat-incident fixture exposed an offered Next control outranking its new incident. Next attention now defers to active incident diagnosis; chapter availability and dispatch remain unchanged. Pending restoration also no longer hides a separately recorded overload on another routed healthy server. These are read-only guidance-priority corrections, not engine changes.

**First-incident boundary:** if the existing first-incident rule has already stopped the company, there is no Pause gold. Deliberately pressing Run on an existing paused incident does not masquerade as a new incident. Engine/live-host Chapter 1 tests create a real subsequent DB incident with the existing `enterScaling: false` engine action. Normal UI loading of an acknowledged Opening company already enters Scaling in `play()`; browser coverage therefore verifies Chapter 1's actual first stop, uses Chapters 2–6 for new running arrivals, and uses actual Chapter 3 for the DB diagnosis/purchase flow. That existing load transition is unchanged.

## Eligibility, priority and dismissal

`incidentNeedsPause(game, decision)` requires an actual Campaign incident in incident phase and a diagnosis/Hint decision. The UI additionally requires a newly observed incident ID in the same company and generation, a started/running company, available clock controls and no tutorial/practice, blocking view/modal, confirmation, hidden/unfocused app or pointer lock.

The resolver's Run classifications exclude Pause for relevant DB upgrades, justified admission relief/routing, valid queued failover/restoration and observed drainage. An actual positive recovery streak with a currently qualifying snapshot and safe failure path also excludes Pause, even if a remaining recorded bottleneck still warrants optional investigation. Confirmed recovery/review/recognition also excludes it. A purchase unrelated to the recorded constraint does not qualify as recovery. Restoration of one server does not excuse another server's measured overload or DB pressure.

The existing host owns all attention:

1. Blocking tutorial/practice/modal retains ownership.
2. Valid purchase Confirm retains immediate priority.
3. A new unresolved running incident may immediately mark Pause.
4. Accepted manual Hint targeting remains next, with an exception: a still-valid active explanation or accepted investigation is preserved across the new incident instead of being displaced.
5. Eligible progression, Run and Hint retain their shared ten-second idle system.

There is no Pause timer. One ephemeral incident token is armed only at the real ID transition. It is consumed when the player pauses, begins a deliberate pointer/key/wheel/touch interaction, chooses manual help, opens a higher-priority interface, changes navigation/company, or when the diagnosis becomes a valid time-dependent recovery path. Passive ticks, metrics, rendering, hover and recovery counters do not rearm it. A valid matching manual investigation keeps its accepted target/card instead of receiving Pause gold.

This is a one-time invitation per new incident, not repeated prompting until obedience. Continuing to run after deliberately interacting dismisses it; remaining diagnosis can still earn Hint after ten eligible seconds. If a valid recovery path later deteriorates within the same incident ID, normal contextual Hint remains available; Pause is not repeatedly reissued. A later distinct incident can receive its own invitation. Reload/load starts paused and does not invent an incident arrival. No token, dismissal flag or timer is saved.

The event subscription checks authoritative game changes before recalculating an active offer; unrelated store updates do not repeatedly resolve it. Existing timer cleanup and StrictMode ownership remain intact. The approved gold class is used on the existing dock button, with the same static reduced-motion ring and distinct keyboard focus. No CSS or layout change was needed.

## Before and after

Before: later unresolved incident begins while running → no immediate Pause guidance → optional Hint after idle.

After: real unresolved running arrival → **Pause immediately gold** → player pauses → gold clears and the company stays paused → ten eligible seconds → **Hint** → one short explanation → **Got it** → existing inspection/action → valid **Confirm immediately gold** → accepted relevant work → **Run after ten eligible seconds** → real recovery observations → existing recovery acknowledgement/report. Guidance does not execute any of these actions or change time/speed.

An already-running valid installation, restoration/failover, drainage or recovery-observation path continues without a misleading Pause invitation. Mandatory reviews and Chapter 0/practice retain their existing control ownership. Classic receives no new behaviour.

## Exact task-specific paths

Production presentation (four):

- `frontend/src/game/campaignAttention.ts`
- `frontend/src/components/CampaignAttention.tsx`
- `frontend/src/components/useCampaignAttention.ts`
- `frontend/src/components/CampaignUI.tsx`

Tests/helpers (six):

- `frontend/src/sim/__tests__/pauseFixture.ts` — engine-generated transitions; no simulation implementation edit.
- `frontend/src/game/incidentPause.test.ts`
- `frontend/src/components/IncidentPause.test.tsx`
- `frontend/e2e/incidentPause.ts`
- `frontend/e2e/incidentPause.spec.ts`
- `frontend/e2e/mobile.spec.ts`

Reports (two): `docs/CAMPAIGN_PHASE1_GUIDANCE.md`, `docs/CAMPAIGN_INCIDENT_PAUSE.md`.

Simulation production code, automatic stops/clock hold, costs/delays, chapter gates, schemas/persistence/store, backend/shared, dependencies and deployment configuration remain unchanged. Header/dock geometry and global Hint placement remain unchanged.

## Validation

Node **22.23.3**. Frontend lint, typecheck and build passed on the final source; the existing 1,512 kB Facility-chunk advisory remains.

| Check | Result |
| --- | --- |
| Affected incident/attention/UI/tutorial/report unit batch | **122 passed in eight files**, 58.48 seconds |
| Core follow-up with repeat-incident, background and restoration boundaries | **82 passed in five files**, 38.65 seconds |
| Final incident resolver/host rerun, including the recovery-observation boundary | **29 passed in two files**, 17.22 seconds |
| Distinct focused cases verified across these runs | **125**; not a claim of a single 125-case batch or full coverage |
| Initial browser sweep | **19 passed / one failed**, 20 journeys, retries 0, 7.8 minutes |
| Corrected final native-Opening/Chapters 2–6/touch sweep | **12/12 passed**, retries 0, 3.5 minutes, on the final runtime source |

All **19 current distinct selected browser journeys** have passing verification across the initial and final runs: 12 final incident cases plus seven existing recovery/tutorial/Classic regressions. This is not a claim of one green 19-case batch or the entire browser suite. No runtime source changed after final validation.

The initial browser failure was a fixture error: it compared a raw repeat-Opening engine state against its normal loaded UI state. The existing `play()` entered Scaling, added its recorded event and changed the resulting incident ID (`incident-34` versus `incident-35`). The test retained its exact incident-ID and physical-step checks, and now additionally checks the actual chapter number for running-arrival fixtures. The redundant impossible “resumed Chapter 1 still Opening” positive case was replaced by the already-present actual first-incident-stop assertion. No stage was forced, no load behaviour was changed, and no incident assertion was weakened. The generic DB journey and pending DB case now start in real Data Strategy. The initial failure trace remains retained.

Passing initial browser cases include all five genuine later-chapter running arrivals, the actual first-incident stop and deliberate resume, Pause → ten-second Hint → action → immediate Confirm, valid pending correction/restoration, continued-running dismissal, measured recovery → review, queued failover → Run, pending-postmortem priority, complete interactive Chapter 0, saved incident practice replay, Classic at 1440/320px and reduced-motion touch at 390/320px.

Earlier diagnostics: the first nine-case resolver attempt exposed Next outranking Chapter 1's active incident (eight passed / one failed); the priority correction passed subsequent runs. A 53-case batch passed, followed by lint's synchronous-effect-state warning and TS2769 for Testing Library's unsupported `exact` role option. Cleanup is now driven by store/input/ownership events, and the test selectors use Testing Library's already-exact string names. Final static checks passed without that warning or type error. No new skip, automatic retry, forced click or timeout increase was introduced.

Focused commands from `frontend/`, Node 22:

```powershell
npm test -- --maxWorkers=1 src/game/incidentPause.test.ts src/components/IncidentPause.test.tsx src/game/campaignAttention.test.ts src/components/CampaignAttention.test.tsx src/components/idleAttention.test.ts src/components/CampaignUI.test.tsx src/components/CampaignTutorial.test.tsx src/components/CampaignIncidentReport.test.tsx
npm test -- --maxWorkers=1 src/game/incidentPause.test.ts src/components/IncidentPause.test.tsx src/game/campaignAttention.test.ts src/components/CampaignAttention.test.tsx src/components/idleAttention.test.ts
npm test -- --maxWorkers=1 src/game/incidentPause.test.ts src/components/IncidentPause.test.tsx
npm run lint
npm run typecheck
npm run build
```

Browser commands, `PLAYWRIGHT_PORT=4197`:

```powershell
node node_modules/@playwright/test/cli.js test incidentPause.spec.ts mobile.spec.ts campaignAttention.spec.ts campaignTutorial.spec.ts controls.spec.ts --grep 'incident Pause:|guidance measured incident recovery|guidance queued reliability|guidance pending postmortem|Chapter 0 requires real|saved Chapter 0 replay.*1440|Challenge incident transport' --retries=0 --output=../test-results/incident-pause/browser-artifacts

node node_modules/@playwright/test/cli.js test incidentPause.spec.ts mobile.spec.ts --grep 'incident Pause:' --retries=0 --output=../test-results/incident-pause/browser-final-artifacts
```

Artifacts, screenshots and original failure traces remain ignored under `test-results/incident-pause/`. Classic's unchanged cases logged the expected local `/api/session` refusal with no backend server running; they passed with no unhandled browser errors. No generated output, log, screenshot or temporary script is intended Git content.

Final desktop and 320px captures were inspected: one complete gold Pause ring, visible existing dock controls and no competing Hint/Run spotlight. Local captures: [desktop failure](../test-results/incident-pause/browser-final-artifacts/incidentPause-incident-Pau-32827-unning-Chapter-5-transition-chromium/immediate-pause.png), [320px touch](../test-results/incident-pause/browser-final-artifacts/mobile-incident-Pause-immediate-touch-attention-at-320px-mobile-chromium/immediate-pause.png).

Limits: focused frontend verification, not full frontend/backend coverage or the complete browser suite. Chromium desktop and touch emulation do not establish Safari/Firefox, real-device or screen-reader acceptance. An arrival while hidden, unfocused, pointer-locked or owned by a higher-priority interface is consumed rather than delayed into a surprise offer on return. A same-ID relapse uses normal Hint instead of repeatedly reissuing Pause. Both are deliberate conservative attention policies; neither changes gameplay or predicts guaranteed recovery.

Final Git hygiene: `git diff --check` passed, no staged paths or unmerged entries. The 30 pre-existing pending paths are preserved; six newly pending helper/test/report paths bring the worktree to 36 intentional paths. No other worktree was modified. Nothing was committed or published.
