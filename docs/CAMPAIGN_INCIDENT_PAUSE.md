# Intelligent incident Pause guidance

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
