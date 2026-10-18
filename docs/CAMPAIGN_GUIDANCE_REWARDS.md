# Development B: contextual guidance and recovery acknowledgement

> Historical feature report. For the current integrated branch, Chapter 0 compatibility and fresh validation, see [Campaign Git integration audit](CAMPAIGN_GIT_INTEGRATION_AUDIT.md). Earlier test counts, preview URLs and ignored screenshots below describe their original runs.

Latest follow-up: [six-chapter learning and guidance refinement](CAMPAIGN_LEARNING_REFINEMENT.md) records the current audit, unlock recommendations, presentation changes and validation. Its results supersede the older hint repetition and Run eligibility descriptions below.
The linked report is the current delivery; the sections below retain the earlier Development B findings and verification.

## Final refinement: recovery, Chapter 6 and optional hints

This section supersedes the incident-cue and validation descriptions below. Work remains local and uncommitted on `fe/campaign-guidance-rewards` at `4b8eda9`. No new branch/worktree or publication was performed.

### Verified mechanics

The audit read `sim/step.ts` (`qualifiesForRecovery`, incident stepping), `sim/reliability.ts` (`recoverySafe`), `sim/combinedCampaign.ts`, its scenario configuration and fixtures/tests, `sim/trace.ts`, Campaign controls/reports, the store and shared Modal.

- An incident qualifies one physical step at a time: response time below 500 ms, non-null service errors below 1%, positive admitted traffic, completed outcomes, and `recoverySafe`. For an unresolved application fault the latter requires that failed target to be excluded from effective routing with its retained queue empty. Buying equipment alone proves nothing.
- `campaign.incident.stableSteps` is the sole recovery counter. Each qualifying step adds one; a failing step resets it to zero and records a `recovery-streak` event. Five steps create the report, clear the incident and enter review. Limited-demand recovery is possible and differs from restoring full demand.
- Chapter 6 entry requires acknowledged Stay Online and Traffic Spikes, the Opening milestone, stable management at the 2,400 req/s baseline, empty queues, healthy apps and completed work/reports. The entry guard permits a traffic limit; that limit subsequently prevents full-demand qualification.
- Five fresh stable full-demand observations unlock the explicit Start next growth wave action. Three seeded waves cover read growth, write pressure and failure under load. Their order is seeded. Each announced wave starts after eight steps. Registrations increase at wave start, to 20,000, 35,000 and 50,000 for the normal 50,000 target; they are not earned per successful request.
- Each wave must finish its pressure period, restore any failed target, acknowledge real incident reports and serve five stable full-demand steps before its Growth outcome can be reviewed. Reviewing it advances the round index. Acknowledging all three outcomes is mandatory.
- Final qualification requires the user target, all three acknowledged outcomes, no current round, positive cash, no incident, empty queues, healthy applications, finished actions/reports, healthy measured service and full baseline demand with no traffic limit or active promotion. Five more qualifying steps create the final scorecard; explicit Complete campaign ends the run as won.
- Promotions are optional: $500 setup, +400 req/s for 12 seconds, no registration award. Specific infrastructure purchases are not mandated; the player chooses a viable strategy. Removing the traffic limit alone neither proves capacity nor wins the campaign.

The audit found missing explanations, not a demonstrated rule defect. No simulation, registration, growth, completion or save-schema change was needed.

### Presentation changes

Pause previously checked only running + incident. It now also checks the recorded recovery context. Positive recovery progress suppresses Pause emphasis and tells a running player to keep running; paused verification asks the player to run. The existing panel displays Checking recovery: n/5 steps directly from the engine. After a recorded reset, neutral guidance explains that stability did not last and points to current response time, failed-request and queue measurements. It does not automatically restore Pause merely because the incident is still open. Pending work also receives neutral observation guidance. No auto-pause or replacement progress counter was added.

Chapter 6's old generic goal, Serve growing demand, manage costs and review each outcome, becomes one state-aware goal in the existing chapter bar: traffic restriction, paused full-traffic observation, incident investigation/verification, pending work, ready wave or required review. System Overview adds a compact Final chapter progress summary for full traffic, reviewed milestones and registrations. Other completion checks remain in the existing disclosure. The repeated registrations/outcomes paragraph is removed from the optional promotion section. View chapters, Next and tutorial definitions are unchanged.

The small Hint control uses the existing paper Modal and focus behavior. Automatic offers require 15 eligible idle seconds in paused, incomplete Chapter 6 management. Running, incidents, reviews, pending work, purchases, tutorials, inspections, chapter transitions and blocking views/modals suppress them. Relevant interaction restarts inactivity, including active pointer drags; passive cursor movement alone does not. Objective/progress changes invalidate obsolete content. No, thanks closes immediately and starts a fresh 15-second interval; it never permanently disables offers. Yes, show hint reveals the current hint; Got it closes it. Manual Hint can pause management play and never resumes it automatically.

Accepting the traffic hint highlights the existing available Remove traffic limit action with the approved gold ring/glow. It centres that control within the inspector and gives it keyboard focus once, without opening a preview, selecting equipment or executing an action. Resuming emphasis after Finance or another modal does not move focus again, preserving the modal's normal focus restoration. Its confirmation takes priority. The hint never executes a decision, recommends a purchase or calls removal safe. A pending traffic change instead explains why another change is unavailable. Accepted traffic-hint emphasis suppresses idle Run and repeated offers; changes to its context clear ownership. Attention state is transient, company/generation-scoped and not persisted.

Postmortems now default to four short sections: opening measurements, grouped recorded action requests, verified outcome and one trade-off. Limited recovery explicitly says full demand was not restored; rejected requests remain distinct from failed requests. A change's presence is not presented as proof of causation. Every original explanation and every chronological event remains available under collapsed disclosures, alongside existing snapshot/workload evidence. Report generation/calculation and the recovery acknowledgement/Continue company lifecycle are unchanged.

Before/after examples:

| Context | Earlier presentation | Final presentation |
| --- | --- | --- |
| Chapter 6 with a traffic limit | Serve growing demand, manage costs and review each outcome | Your traffic limit is restricting customers. Check whether your app can handle more traffic. |
| Full traffic enabled, paused | Same generic chapter objective | Run your company to see how it handles full traffic. |
| Positive recovery streak while running | Pause continued glowing | Keep running while we check if your app has recovered; Checking recovery: n/5 steps; no Pause spotlight |
| Final review qualified | Generic growth goal | Review your final campaign scorecard |
| Postmortem default | What happened and what changed: a technical component-demand/capacity paragraph | Separate observed symptoms, recorded requests, verified result and one trade-off |

The captured limited-recovery example now reads: opening response time 1,100 ms, 0.00% failed requests and 600 waiting; recorded request: Traffic limit; recovery verified at 100 ms with full demand still not restored. The lesson explains that limiting admission adds no infrastructure capacity and rejected requests earn nothing. The original causal explanation, capacity values and repeated events remain in the disclosures. Automated requests are not attributed to the player in the default change summary.

### Current verification

Node 22.23.3 lint without warnings, typecheck and production build pass. The broad focused batch passed 164 tests across 12 files (58.53 seconds). A six-case model run verifies the action-source attribution change and adds the repeated-player-versus-automated-request regression. After the accepted-target clearance adjustment, all 55 affected component cases passed again across four files (23.26 seconds). Final wording/input/focus checks passed all 63 tests across five files (27.80 seconds), including two additional drag/Finance-focus cases. In total, 167 distinct focused tests have passed in staged runs. This is not a claim of a single 167-case batch or complete coverage run.

All eight real-room feature journeys passed together with retries disabled (2.0 minutes), covering hints and recovery at 1440x900, 1366x768, 390x844 and 320x844. Visual review then tightened the accepted-target reveal from nearest edge to centre, avoiding clipped glow at 320px. A ten-pixel panel-clearance assertion checks the ring space. All 28 compatibility journeys then passed (8.1 minutes), including all four affected hint cases, purchase layouts, Health Checks, App Health, tutorial/Finance coexistence, Classic and Chapter 6 entry/promotion/review/completion/replay.

The last wording/input/focus refinements passed a seven-case browser follow-up (1.9 minutes): all four hint sizes including Cash focus restoration, desktop and 320px ordinary Run, and the updated final-scorecard objective through completion/reload. These staged green batches cover **34 distinct browser journeys**, with overlap between batches. They are not a single 34-case batch or full browser-suite run; the 28-case batch preceded those last scoped refinements, which were covered by the follow-up and 63-case unit run. Every final passing batch had zero failures/skips and retries disabled. No source changed after the final follow-up; only this report was completed afterward.

Current diagnostics and outputs are ignored under `test-results/development-b-final/`: `unit-delivery.log`, `summary-delivery.log`, `unit-clearance-final.log`, `final-polish-unit.log`; `feature-delivery.log`, `feature-delivery-report/`, `feature-delivery-artifacts/`; `compatibility-browser.log`, `compatibility-report/`, `compatibility-artifacts/`; `final-polish-browser.log`, `final-polish-report/`, `final-polish-artifacts/`; and `lint-delivery.log`, `typecheck-delivery.log`, `build-delivery.log`. `validation-inputs.json` hashes all 28 source/test paths, excluding this report. Older diagnostic logs and traces remain separate.

Initial diagnostics: the staged run passed 37 tests and failed one cleanup assertion. Timer instrumentation identified jsdom's zero-delay `selectionchange` from shared Modal focus restoration; draining that event preserves the no-pending-timer assertion. A subsequent broader run passed 148 tests and failed the older App journey's assumption that recovery directly opened the postmortem. That journey now verifies and follows System Recovered! → Review What Happened before the unchanged acknowledgement assertions. No runtime workaround or timeout increase was used for either test issue.

The cleanup diagnostic also had a 33-pass/one-failure rerun and an isolated one-failure run with eight tests deselected. These are retained, not relabelled as passes. Final typechecking caught a new test using Playwright's `exact` option with Testing Library; the option was removed because Testing Library's string name already matches exactly, and the final checks passed. No test was disabled or forced click added.

The first two-case browser exploration passed recovery and timed out the new hint journey after successfully checking the first and repeated offers. It exhausted its unchanged 60-second budget rendering 30 idle seconds of software WebGL. The paused single-timeout checks now jump 14,999 ms and deliver the last millisecond; simulation/recovery checks still deliver every cumulative tick with `runFor`. The corrected eight-case feature batch passed, followed by the eight-case delivery batch above. No browser timeout, assertion or retry policy was relaxed.

### Exact uncommitted scope

The complete Development B working diff is 29 paths: ten production presentation files, eighteen test/helper files and this report. This includes the preserved earlier Development B work; only the final refinement adds twelve paths to its previous seventeen-path scope.

Production:

- `frontend/src/components/CampaignUI.tsx`
- `frontend/src/components/CampaignAction.tsx`
- `frontend/src/components/CampaignChapters.tsx`
- `frontend/src/components/CampaignFeedback.css`
- `frontend/src/components/ChapterHints.tsx`
- `frontend/src/components/chapterHintAttention.ts`
- `frontend/src/components/useGuidanceCue.ts` (existing hook; active drags also reset inactivity)
- `frontend/src/components/useLiveRecovery.ts` (preserved)
- `frontend/src/game/campaignFeedback.ts`
- `frontend/src/game/campaignGuidance.ts`

Tests/helpers:

- `frontend/src/App.test.tsx`
- `frontend/src/components/CampaignFeedback.test.tsx`
- `frontend/src/components/ChapterHints.test.tsx`
- `frontend/src/components/Tooltip.test.tsx`
- `frontend/src/game/campaignFeedback.test.ts`
- `frontend/src/game/campaignGuidance.test.ts`
- `frontend/e2e/chapterHints.ts`
- `frontend/e2e/chapterHints.spec.ts`
- `frontend/e2e/guidanceRewards.ts`
- `frontend/e2e/guidanceRewards.spec.ts`
- `frontend/e2e/fixtures.ts`
- `frontend/e2e/mobile.spec.ts`
- `frontend/e2e/gameplay.spec.ts`
- `frontend/e2e/dataStrategy.spec.ts`
- `frontend/e2e/scaling.spec.ts`
- `frontend/e2e/reliability.spec.ts`
- `frontend/e2e/spikes.spec.ts`
- `frontend/e2e/combined.spec.ts`

The final diff review confirms no changes in simulation, financial helpers, store/persistence/save contracts, tutorial definitions, shared Modal, Classic implementation, backend/shared contracts, dependencies, workflows or deployment. Other registered worktree branches/heads remain unchanged and no files there were edited. HEAD remains `4b8eda93437c731e8b62fc6ad32ebcb7c8583e9d`; the 29-path working tree deliberately remains uncommitted. Whitespace checks pass, generated evidence is ignored, and all 28 source/test hashes match the final validation-input manifest.

### Screenshots and local review

- [Chapter 6 objective and required progress, desktop](../frontend/test-results/final-b-chapter-1440.png)
- [Chapter 6 objective and required progress, touch](../frontend/test-results/final-b-chapter-390.png)
- [Yes/No offer, desktop](../frontend/test-results/final-b-offer-1440.png)
- [Yes/No offer, touch](../frontend/test-results/final-b-offer-390.png)
- [Accepted traffic-limit hint, laptop](../frontend/test-results/final-b-traffic-cue-1366.png)
- [Accepted traffic-limit hint, 320px](../frontend/test-results/final-b-traffic-cue-320.png)
- [Recovery checking without Pause emphasis](../frontend/test-results/final-b-recovery-check-1440.png)
- [Simplified postmortem](../frontend/test-results/final-b-postmortem-1440.png)
- [Simplified touch postmortem](../frontend/test-results/final-b-postmortem-390.png)

After No, the browser sources check that the offer remains closed through 14,999 ms and reappears at 15,000 ms on desktop and 390px touch. They also verify Yes/Got it, keyboard focus containment, real touch choices, obsolete-hint invalidation, pending changes and reload. Screenshots retain the familiar Finance/Modal style and the 3D room. Existing 320px status-card crowding is unchanged; a phone capture may include the native temporary tap highlight, which is not a new hint style.

Preview remains http://127.0.0.1:4197 using this worktree's production build; the exact Node 22 command is retained at the end of this document. A new company must reach Chapter 6 normally to see its hints; there is no production fixture shortcut. Recovery and earlier button cues can be reviewed during ordinary play. The initial Run/Confirm/Pause visibility evidence and recovery celebration images remain below as historical artifacts.

Full frontend/backend coverage, the full browser suite, balance, hosted CI, Safari/Firefox, physical devices and human comprehension testing were not run for this presentation-only refinement. There is no demonstrated gameplay-rule defect requiring approval; any future change to organic registration growth, recovery or victory rules would be separate work. No commit, push, PR, merge or deployment was performed.

Workspace: `C:/Users/user/99.9-Percent-Latest`.
Branch: `fe/campaign-guidance-rewards`, based on `4b8eda93437c731e8b62fc6ad32ebcb7c8583e9d` (merged Development A PR #100).
The existing branch was clean, had no unique commits and matched fetched origin/main before editing. Finance PR #90 and App Health PR #93 are included. No extra worktree was created.

## Earlier guidance and visibility changes

Ryan's Run discoverability finding: Run now receives a strong gold spotlight after ten idle seconds throughout paused Campaign play, including later chapters. Run must be enabled, with no pending confirmation, blocking view/modal, inspection, chapter completion or explicit progression decision. Tutorial steps requiring something else suppress it; the final Opening instruction and the reliability guide's explicit pending-install Run instruction are eligible. Scaling headroom/consent decisions also suppress it until addressed or an accepted installation needs time. Pointer/key/wheel/focus interactions and equipment/action hover restart the inactivity timer. After a cue is interrupted, another ten eligible idle seconds can show it again. No simulation step is advanced by guidance.

Ryan's Confirm discoverability finding: the existing primary/autofocused button receives an immediate, persistent spotlight while its quote remains engine-accepted, enabled and reviewed. Financial-risk warnings remain prominent alongside it; they do not bypass the existing review/safety checks. Unreviewed/changed quotes, refusals, blocking modals/view sheets and visible tutorials suppress it. Focus, hovering and reading details do not make it expire. Confirm, Cancel, dismissal or invalidation end it. A running incident takes priority and transfers emphasis to Pause. Quote revalidation, duplicate dispatch guards, equipment highlights, floor dismissal and left-side/mobile placement are unchanged.

Pause during an incident: when the company is running through an actual incident, the existing Pause button is highlighted immediately, until pausing or leaving the relevant incident state. Its existing tooltip says Pause the company to investigate (P). This is a suggestion, never an automatic pause or a requirement to buy something. Existing first-incident clock holds remain unchanged: an already-paused company does not receive a Pause cue.

Attention priority is running incident Pause, then valid reviewed Confirm, then eligible idle Run. Blocking views/modals, tutorial requirements and disabled actions take precedence. Only one of these controls receives the strongest cue at a time.

The old blue outline resembled normal focus, Run was limited to one instruction, and Confirm expired after three seconds. These restrictions have been removed. The shared treatment now uses a contrasting gold outline/ring, a dark separator, a strong outer glow and an infinite 1.8-second pulse. A separate blue outer focus outline remains available for keyboard users. Reduced motion retains the strong static treatment. Outline and shadow do not occupy layout space; no screen dimmer, pointer-blocking layer, extra modal or competing tutorial system was introduced. The existing tutorial retains its own targeting and dimming when it is active.

Xuan Jun's recovery feedback finding: the existing Campaign review Modal first shows System Recovered!, Service has stabilised again, and Review What Happened. Active traffic limits receive a rejection caveat. The CTA only changes transient presentation state; the existing postmortem and Continue company action still perform the actual acknowledgement. There is no animation delay before the CTA. Both cues and the small success entrance respect reduced motion.

`useLiveRecovery` observes a same-company, same-generation, started incident-to-review transition with a newly recorded report. It does not celebrate initial render, resume, reload, import/company replacement or merely buying an upgrade. Reading the postmortem consumes the presentation; a later genuine report can celebrate again. No new persistence field is needed. The existing `relief` sound path remains the sole recovery sound and retains mute behavior.

## Earlier Development B scope

Production files:

- `frontend/src/components/CampaignUI.tsx`
- `frontend/src/components/CampaignAction.tsx`
- `frontend/src/components/useGuidanceCue.ts` (new)
- `frontend/src/components/useLiveRecovery.ts` (new)
- `frontend/src/components/CampaignFeedback.css` (new)

Tests:

- `frontend/src/components/CampaignFeedback.test.tsx` (new)
- `frontend/e2e/guidanceRewards.ts` and `guidanceRewards.spec.ts` (new)
- `frontend/e2e/fixtures.ts`: explicit `reviewRecovery` helper asserts the new visible CTA and unchanged saved review state; no automatic dismissal handler.
- `frontend/e2e/gameplay.spec.ts`, `mobile.spec.ts`, `dataStrategy.spec.ts`, `scaling.spec.ts`, `reliability.spec.ts`, `spikes.spec.ts`, `combined.spec.ts`: follow the new recovery CTA before their existing postmortem assertions. Mobile also includes the new 390px/320px journeys.

This report is the seventeenth changed/new path. No simulation, financial helper, store lifecycle, save schema, tutorial implementation, shared Modal, Classic implementation, backend, shared contract, dependency, workflow or deployment file changes.

## Earlier visibility refinement validation

The refinement changes four production source files: `CampaignUI.tsx`, `CampaignAction.tsx`, `useGuidanceCue.ts` and `CampaignFeedback.css`. Tests change in `CampaignFeedback.test.tsx`, `e2e/guidanceRewards.ts`, `guidanceRewards.spec.ts` and `mobile.spec.ts`, plus this report. The recovery implementation is preserved.

Node 22.23.3 lint, typecheck and production build pass. The focused unit run passes 114 tests across eight files (22.04 seconds), including persistent cues, ordinary/later-chapter Run, progression suppression, quote safeguards, modal/sheet suppression and Pause-over-Confirm priority.

| Current refinement check | Result |
| --- | --- |
| Focused unit/component regressions | 114 passed across eight files |
| Attention/viewport browser batch | 12 passed, retries disabled (5.1 minutes) |
| Finance/tutorial/purchase/recovery/Classic compatibility batch | 20 passed, retries disabled (6.0 minutes) |

These two green browser batches cover **28 distinct journeys**, with four priority cases repeated between batches. They are not a full browser-suite run. The compatibility batch also verifies the settled capture sequence at all four widths. A separate passing 390px visual diagnostic repeats an existing case rather than adding another distinct journey. Results below marked historical are not claimed for the refinement.

New browser journeys observe an engine-generated later incident beginning while Run is active, then test Pause, reviewed Confirm, view-sheet interruption and priority switching. They compare normal and highlighted Run/Confirm states and inspect outline width, glow, infinite animation and reduced-motion behavior. A local ignored `frontend/test-results/spotlight.config.ts` inherits repository browser settings and records video without changing CI configuration.

Diagnostics are retained under `test-results/development-b-spotlight/`. The first new incident fixture incorrectly selected Add server in a chapter already at its two-instance limit; it now previews an available Read Cache action without buying it. Another priority check let operating time change its reviewed quote, correctly suppressing Confirm; its browser clock now freezes only after witnessing the live incident so pure priority checks use a stable quote. Stale-quote safety remains separately tested. Screenshots await the existing purchase-card opacity transition rather than capturing its initial fade. Frozen browser-clock captures retained old inspector pixels on phones; the settled visual check resumes browser rendering while leaving the actual company paused, waits for rendered frames, verifies the inspector is hidden and reopens/cancels the quote without spending money. That check passed at all four widths and showed no production layout issue. An unsupported per-describe video option prevented one run from starting; recording now uses the ignored inherited configuration. No refusal, timeout or assertion was weakened to address these test-authoring issues.

Current evidence: `focused-unit-final.log`, `attention-browser-delivery.log`, `attention-delivery-report/`, `attention-delivery-artifacts/`, `compatibility-browser.log`, `compatibility-report/` and `compatibility-artifacts/`, all under ignored `test-results/development-b-spotlight/`. Final static checks use `lint-delivery.log`, `typecheck-delivery.log` and `build-delivery-approved.log`. The final sandboxed build could not spawn a required subprocess (`EPERM`, retained in `build-delivery.log`); the subprocess-enabled rerun passed and reproduced the same frontend asset hashes exercised by the browsers. Videos and screenshots remain ignored. Complete frontend/backend coverage, balance, full browser regression and hosted CI were not run for this refinement; no simulation or backend implementation changed.

## Original Development B validation (before visibility refinement)

The following counts and asset-hash statement document the previous subtle-cue implementation. They are retained as historical evidence, not validation of the current spotlight styling and triggering rules.

Node 22.23.3 is invoked directly for lint, TypeScript, Vite, Vitest, Playwright and the local preview; system Node is unchanged. Existing frontend dependencies are reused.

| Final check | Result |
| --- | --- |
| Frontend lint | Passed, no diagnostics |
| Typecheck and production build | Passed |
| Focused serial unit/component regressions | 109 passed across 8 files, no skips or failures (32.28 seconds) |
| Finance/tutorial/layout/Classic compatibility browser batch | 20 passed, no retries (5.0 minutes) |
| Live recovery/progression browser batch | 11 passed, no retries (6.5 minutes) |
| New feature browser journeys | All 8 distinct journeys verified in staged runs at 1440x900, 1366x768, 390x844 and 320x844 |

There are **37 distinct passing browser journeys** across the staged runs. The 20-case compatibility batch includes the two new touch guidance cases; the remaining six new feature journeys passed in earlier feature runs. This is not a claim of a single green 37-case batch, a single green eight-case feature batch, or a complete browser-suite run. Earlier failed/interrupted feature runs remain recorded below. The final production build retains the same frontend asset hashes as the build exercised by the browser checks; intervening refinements were tests and documentation only.

The 109 focused tests include 19 new feedback cases: the ten-second boundary, interaction cancellation, disabled/running/other-step suppression, overlay and spotlight interruption, pending-timer cleanup, real quote autofocus/duration, financial warning/refusal/stale-quote handling, live full-demand/limited recovery, review acknowledgement, company replacement/loading and a separate later incident. Existing tests cover Finance safeguards, tutorial sequencing, App Health coexistence, chapter completion and recovery sound/mute behavior.

Browser coverage includes the unchanged eight-step Opening walkthrough, Health Checks Tech-to-deployment guidance, desktop/mobile Finance and focus restoration, Cash margin and keyboard access, purchase details scrolling, left-side panels with persistent warnings/buttons, actual room inspections, Classic tutorial/purchase/reload, already-pending review reload, all three Opening responses, both Data Strategy responses (including successive incidents), vertical/horizontal scaling, manual restoration and traffic spikes. A fresh guest completes every chapter through public controls in the combined journey. Touch guidance explicitly verifies static reduced-motion cues. No assertion or timeout was weakened, no forced click was used and retries were disabled.

Evidence under `test-results/development-b/`: `unit-delivery-final.log`, `node-version.log`, `lint-delivery-final.log`, `typecheck-delivery-final.log`, `build-delivery-final.log`; `compatibility-browser.log`, `compatibility-report/`, `compatibility-artifacts/`; `recovery-regression-browser.log`, `recovery-regression-report/`, `recovery-regression-artifacts/`; and the separate feature/touch logs, reports and artifacts. Generated evidence remains ignored. Complete frontend/backend coverage, balance and the full browser suite were not run for this presentation-only local task. Hosted CI is not claimed.

Diagnostics are preserved under ignored `test-results/development-b/`. Initial new test-authoring issues were a Run/Pause locator and an invalid ended fixture without a scorecard. Both were corrected without product changes. A redundant second ten-second live WebGL clock interval exceeded the new browser test's unchanged 60-second budget; one interval suffices because unit tests verify non-repetition. A subsequent test clock used host time behind browser time; it now pauses using browser time. Touch checks additionally wait for the existing deferred Cancel focus restoration before measuring inactivity. The existing top-docked mobile tutorial covers Cash at step 8, so that journey now finishes the guide before touching Cash; desktop retains the modal-interruption check while the instruction remains open. Final phone purchase screenshots use keyboard opening after the initial touch preview/cancel to avoid freezing the native tap highlight. Reduced-motion assertions check that the cues have no animation. The interrupted/failed runs remain diagnostics rather than passes. Two expanded unit cases timed out while WebGL rendered concurrently; the separate serial unit run passed without assertion or budget changes.

## Current visual review and preview

Current strong-cue screenshots are under ignored `frontend/test-results/`: `spotlight-run-normal-{width}.png`, `spotlight-run-active-{width}.png`, `spotlight-pause-active-{width}.png`, `spotlight-confirm-normal-{width}.png` and `spotlight-confirm-active-{width}.png`, at widths 1440, 1366, 390 and 320. Existing recovery/postmortem screenshots remain available separately.

- [Desktop Run, normal](../frontend/test-results/spotlight-run-normal-1440.png)
- [Desktop Run, highlighted](../frontend/test-results/spotlight-run-active-1440.png)
- [Desktop incident Pause](../frontend/test-results/spotlight-pause-active-1440.png)
- [Desktop Confirm, normal while Pause has priority](../frontend/test-results/spotlight-confirm-normal-1440.png)
- [Desktop Confirm, highlighted with financial warning](../frontend/test-results/spotlight-confirm-active-1440.png)
- [Laptop Confirm](../frontend/test-results/spotlight-confirm-active-1366.png)
- [Touch Confirm](../frontend/test-results/spotlight-confirm-active-390.png)
- [Touch incident Pause](../frontend/test-results/spotlight-pause-active-390.png)
- [320px static Run](../frontend/test-results/spotlight-run-active-320.png)
- [320px static Confirm](../frontend/test-results/spotlight-confirm-active-320.png)
- [Desktop Pause/Confirm recording](../frontend/test-results/spotlight-priority-1440.webm)
- [Touch Pause/Confirm recording, reduced motion](../frontend/test-results/spotlight-priority-390.webm)
- [Desktop recovery acknowledgement](../frontend/test-results/development-b-recovery-1440.png)
- [320px recovery acknowledgement](../frontend/test-results/development-b-recovery-320.png)
- [Touch postmortem](../frontend/test-results/development-b-postmortem-390.png)

Desktop 1440x900, laptop 1366x768, touch 390x844 and narrow 320x844 screenshots were inspected, including settled purchase cards. The normal/active comparison deliberately retains keyboard focus, so the extra gold ring and glow can be distinguished from the ordinary blue focus outline. Confirm retains its financial warning and Cancel; its outline fits within the existing purchase card and above navigation. Glows remain local to the controls rather than dimming the screen. Existing Opening spotlight targeting/dimming is retained when its guide is open; ordinary Campaign play has no added dimmer. The recovery acknowledgement remains compact and unchanged. Existing crowded 320px status-card text is visible in the captures and was not changed by this button-guidance task.

From PowerShell:

```powershell
cd C:\Users\user\99.9-Percent-Latest\frontend
$guidanceNode = 'C:\Users\user\AppData\Local\npm-cache\_npx\52027bd8fc0022aa\node_modules\node\bin\node.exe'
& $guidanceNode node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4197 --strictPort
```

Open http://127.0.0.1:4197. If the validation preview is already running, open that address directly. Start/continue Guided Mode, finish or skip the walkthrough, close views, and leave an eligible paused company idle for ten seconds to see Run. Later chapters work too unless a progression decision or acknowledgement takes precedence. Preview an available action to see Confirm immediately. While an incident is running, Pause takes priority; the existing first-incident hold may already have paused the company, in which case resume the active incident to see Pause. Nothing is purchased or paused automatically by these cues. Use the operating system/browser reduced-motion preference for the strong static treatment.

Two smaller eventual PRs would ease review: button guidance, then recovery presentation and the affected review journeys. The recovery work adds a presentation step to many existing journeys and deserves separate attention. This task keeps everything uncommitted on the one approved branch; no automatic split or publication is performed.

Human playtesting should establish whether the persistent strong emphasis helps without becoming distracting, and whether the recovery acknowledgement feels rewarding without interrupting diagnosis. Full regression coverage, hosted CI, Safari/Firefox and physical-device checks are outside this focused local run. No commit, push, PR, merge or deployment is authorized or performed.

Earlier scope review, before the final refinement: 17 changed/new paths (5 production UI files, 11 test/helper files and this report). The current 29-path scope and verification are recorded at the top. HEAD remains `4b8eda9`, with all implementation deliberately uncommitted for local review.
