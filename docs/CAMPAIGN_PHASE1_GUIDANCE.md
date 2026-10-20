# Development B Phase 1: Run guidance and global Hint

The later [progression attention refinement](CAMPAIGN_PROGRESSION_ATTENTION.md) adds eligible decision/Next/start controls to the same ten-second attention system. It supersedes the earlier “Neither” entries for these nonmodal progression controls; blocking reviews and tutorials still retain priority.

[Incident Pause guidance](CAMPAIGN_INCIDENT_PAUSE.md) adds a once-per-incident immediate Pause invitation for a new diagnostic incident that remains running. The existing first-incident automatic stop and recovery clock behaviour are preserved.

Local implementation on `fe/campaign-guidance-phase-1`, based on `6546f0c5169b6bb6b34a162801dfbfa128ef1e42`. The initial required fetch confirmed 0 ahead / 0 behind `origin/main`. Nothing is staged, committed, pushed or published. PR #119 was not copied or integrated.

## Implemented behavior

Campaign Chapters 1–6 have one global lightbulb beside Sound/Menu. Its hover and keyboard tooltip reads **Hint** / “Need help? See what to try next.” Manual Hint opens a short nonmodal card with one beginner-friendly explanation and one Got it acknowledgement. The engine evidence stays internal; there is no response-selection menu. It never pauses/runs the clock, purchases, configures, opens another panel or changes a save.

**Got it** closes the card and marks the relevant existing control. A collapsed inspector gets its visible **Equipment & actions** entry first; a target hidden behind a view sheet gets that sheet's existing Close control first. Inside an already-open inspector, explicit Got it may scroll the relevant control into view. It does not open a panel or move the camera. Interacting with the final marked control, changing running state, an invalid or materially changed recommendation, or a higher-priority interface clears the mark. Opening an intermediate inspector, choosing its server or opening its disclosure now advances the accepted sequence rather than cancelling it. A running company never gets a misleading Pause mark from Run advice.

The resolver automatically selects one feasible, evidence-supported correction, required decision or useful inspection. Got it immediately marks that control. A justified action takes priority over About, including when the relevant inspection is already open. If no correction is sufficiently supported, the existing inspection/About remains a safe destination. Alternatives remain in normal equipment/actions controls. Accepted targets retain eight pixels of scroll clearance for their full gold outline.

After ten continuous eligible real-world idle seconds, exactly one of these can receive gold attention:

- **Run:** a positively identified time-dependent event, accepted relevant activation, measured drainage or qualifying observation check, while paused and Run is available.
- **Hint:** investigation, uncertainty or multiple reasonable strategies.
- **Neither automatic idle cue:** required decision/review/acknowledgement, confirmation, tutorial/practice ownership, blocking modal, hidden/unfocused app or pointer lock. A valid open purchase confirmation receives immediate Confirm attention instead.

Gold uses a strong outline and pulsing outer effect without changing element dimensions. Reduced motion retains a strong static ring. The existing keyboard focus outline remains distinct. Genuine pointer/key/wheel/touch/drag activity and navigation restart the timer; passive metrics, rendering, saves and hover do not. Held input, visibility changes, StrictMode cleanup and stale callbacks are covered by focused tests. No timers or dismissal state are saved.

Chapter 0 retains its current ten lessons, bounded Run exercise, clock hold, control restrictions and explicit completion. Hint is absent during its walkthrough and separate practice company, including incidents that hide the lesson card. Other tutorial tracks suppress automatic attention. Classic Mode receives no new control or cue.

## Header preservation

The approved desktop spacing change uses 6px gaps and reclaims 26px of empty logo-container reservation: 106px minimum above 1250px, 86px at 901–1250px. Existing visible logo text, all four indicator widths, typography and functionality, Sound/Menu sizes and header height are preserved. At 900px and below, Hint uses empty space in the existing first row; the unchanged indicator strip stays in its existing second row.

The baseline already hides status labels and compacts cash on phones. This change introduces no additional label hiding, value/font reduction or indicator compression. Header tests compare the feature against the original presentation (the single button and its scoped spacing temporarily absent), including all four boxes, contents, fonts, icons, Sound/Menu dimensions, header height and dock geometry.

Audited widths: 1440, 1366, 1100, 1024, 901, 900, 768, 390 and 320px. Healthy and Traffic limited companies exercise both short and longer health status text. Touch journeys include 390×844 and 320×568.

## Implemented state-to-action matrix

“Run” and “Hint” below mean the automatic candidate before the ten-second timer. Manual help can explain an available mandatory interaction; it does not compete with the existing mandatory interface.

| Chapter/state | Candidate | Evidence / priority |
| --- | --- | --- |
| 1: before scheduled Opening growth | Run | Actual unconsumed `opening-growth`; tutorial is finished |
| Any: unresolved DB overload | Hint → Database | Current DB demand/capacity, not a guessed chapter script |
| Any: application overload, including an individually overloaded routed server | Hint → App Server | Per-instance and aggregate workload/capacity |
| Any: installed serving app is unrouted while routed capacity is overloaded | Hint → Network | Routing, role, health and measured demand; reserved spares are excluded |
| Any: accepted relevant DB upgrade, app scale, restoration, safe routing or admission relief pending | Run, unless a higher-priority choice remains | Noncancelled accepted action, target, activation state and measured bottleneck; no recovery guarantee |
| Any: unrelated pending purchase during unresolved overload | Hint | Installation alone is insufficient evidence |
| Any: incident still active but latest snapshot qualifies, failure routing is safe and no known component overload remains | Run | `qualifiesForRecovery`, `recoverySafe`, real incident streak; healthy aggregate thresholds do not conceal a recorded bottleneck |
| Any: observed queue drainage following a relevant activation, or comparable snapshots with processing headroom | Run | Decreasing retained work, nonworsening service, current processing budget and safe failure path |
| Any: postmortem, milestone or recognition pending | Neither | Existing review/acknowledgement owns the interface |
| 1: prevention inspections/full-demand checks missing | Hint → relevant inspection/Network | Actual prevention requirements |
| 1: prevention conditions met; fresh observations outstanding | Run | Real prevention streak; paused time adds no observations |
| 1: prevention already acknowledged | Hint → View chapters | Prevention does not unlock the recovered-incident Scaling route; no invented progression repair |
| 2: DB headroom/risk choice unresolved | Neither | Existing preparation/risk choice; unrelated installation does not override it |
| 2: headroom or accepted risk resolved, clean management | Run | Actual scaling scheduling condition, including a not-yet-initialized deadline |
| 2/3: continuation ready | Neither; manual help → Next | Existing `chapterAdvance` / continuation predicates |
| 3: workload increase not consumed, scheduling requirements met | Run | Existing `canEnterData` scheduling condition |
| 3: uncertain cache/read/write effect | Hint | No assumption that installing cache resolves writes or all DB pressure |
| 4: awaiting/between/within announced pulses, no unresolved symptoms | Run | Actual pulse deadlines and consumed state |
| 4: pulses ended, healthy baseline/empty queues/reports ready, observations missing | Run | Existing baseline stability predicate and counter |
| 5: unarmed and dispatcher accepts test start | Neither; manual help → Start reliability test | Existing cloned dispatcher preview; optional reliability purchases remain optional |
| 5: accepted preparation pending before arming | Run if otherwise appropriate | Arming is not yet available, so its generic guidance label is not treated as an actionable blocker |
| 5: armed, failure not started | Run | Actual fault state; no unobserved target disclosure |
| 5/6: untreated failed server | Hint → App Server | Observed symptoms/health and surviving route; no automatic endorsement of waiting through a failure |
| 5/6: a valid spare promotion is queued | Run | Matching fault, expected route, real healthy spare, capacity and cancellation checks; stale queued evidence falls back to Hint |
| 5: failed server safely isolated and service qualifies | Run | Incident recovery can qualify; physical restoration is still separately required for chapter completion |
| 5: restored, chapter observations outstanding | Run | Existing reliability stability conditions/counter |
| 6: healthy full-demand readiness observations outstanding | Run | `stableManagement(s,true)` and actual readiness counter |
| 6: growth wave ready to choose | Neither; manual help → Start next growth wave | `canStartGrowth` |
| 6: accepted wave announced/active with service ready to observe | Run | Real current round; a temporary limit is not a blanket prohibition on observing an accepted wave |
| 6: pressure ended, fault restored, full-demand observations outstanding | Run | Existing round completion predicate |
| 6: final requirements met, final stable observations outstanding | Run | `finalRequirements` and final streak |
| 6: growth outcome/final review pending | Neither | Existing `pendingCombined`/dialog |
| Traffic limit active | Depends on stage | Valid for some recovery/reliability checks; blocks prevention/full-demand growth where the engine requires full demand |
| Missing/inconsistent evidence | Conservative Hint | Never manufacture a next event, causal claim or save repair |

The pure resolver reads existing chapter/engine predicates. The UI host owns availability, real-time inactivity, local card state and DOM target visibility. It never creates a second simulation or a persistent progression state. The existing `previewCampaignAction` checks the otherwise unexported arming rule on a clone; it does not advance time or mutate the live company.

## Example flows

1. Opening DB incident → ten idle seconds → Hint gold → Hint explains observed excess DB work → Got it → existing Database inspection gold → inspection clears gold.
2. Same incident, accepted DB upgrade → ten eligible idle seconds → Run gold → user runs → installation activates → measured recovery observations → existing postmortem takes priority.
3. Same incident, free traffic-limit response → pending activation permits Run when current capacity supports that accepted limit → actual queue drainage remains valid Run guidance. No purchase is prescribed.
4. Collapsed inspector → Hint → Got it → Equipment & actions gold → player opens it. The guidance does not open the inspector.
5. Reliability ready but unarmed → no competing automatic cue → manual Hint → Got it points to the existing test-start control.
6. Valid queued reliability failover → Run gold → player runs → the engine promotes the existing spare. A stale expected route does not earn that recommendation.

## Changed files

Production presentation:

- `frontend/src/game/campaignAttention.ts` — deterministic read-only decision model.
- `frontend/src/components/CampaignAttention.tsx` — one UI host, global button/card and accepted targeting.
- `frontend/src/components/useCampaignAttention.ts` — shared presentation context.
- `frontend/src/components/idleAttention.ts` — one monotonic idle deadline and input cleanup.
- `frontend/src/components/CampaignAttention.css` — scoped spacing, card, tooltip title and gold effects.
- `frontend/src/components/CampaignUI.tsx` — header/dock connections and existing mandatory-control hooks.
- `frontend/src/components/Game.tsx` — mounts the presentation host.
- `frontend/src/components/Tooltip.tsx` — optional title in the existing tooltip; other tooltip behavior is retained.
- `frontend/src/components/CampaignAction.tsx` - shared action identity and immediate valid Confirm attention.
- `frontend/src/components/CampaignInfrastructure.tsx` - shared identity for existing direct decision controls.
- `frontend/src/components/CampaignEvidence.tsx` - identity for selecting the exact application instance before scaling it.

Tests and report:

- `frontend/src/game/campaignAttention.test.ts`.
- `frontend/src/components/CampaignAttention.test.tsx`.
- `frontend/src/components/idleAttention.test.ts`.
- `frontend/e2e/campaignAttention.spec.ts`.
- `frontend/e2e/mobile.spec.ts`.
- `docs/CAMPAIGN_PHASE1_GUIDANCE.md`.

Simulation, financial rules, chapter gates, saves, Chapter 0 progression, backend/shared, dependency lockfiles, workflows and deployment settings are untouched. There is no automatic Yes/No invitation, recovery celebration, postmortem redesign or Goal/Progress hierarchy rewrite.

## Original implementation validation and artifacts

The results in this section precede the targeting/Confirm follow-up below; they are retained as historical evidence.

Node **22.23.3**. All changes remain local and unstaged. Final frontend lint and typecheck passed without warnings; production build passed with the existing large-Facility-chunk advisory. No runtime changes followed the final six-case browser correction run.

| Verification | Result |
| --- | --- |
| Affected unit/component batch, eight files, one worker | **124 passed** |
| Final resolver/target-host rerun, two affected files, one worker | **28 passed**; includes three additional boundary/targeting cases. **127 distinct** focused cases have passing verification across these runs. |
| Frontend `npm run lint`, `npm run typecheck`, `npm run build` | Passed on the final runtime source |
| Existing desktop regressions | **10 passed**: tutorial completion, practice incident/reload/return, final tutorial clock hold, manual stepping, dock at 1440/390/320px and Classic incident transport at 1440/320px |
| Guidance completion browser batch | **21 passed / one failed**, 22 journeys; the failure exposed fractional clipping of the accepted target at 390px |
| Final desktop/touch corrections | **6 passed**, retries 0; includes the fixed 390px and retained 320px touch cases, already-open evidence, recovery, queued failover and collapsed entry |
| Git hygiene | `git diff --check` passed; no staged or unmerged entries |

**33 distinct browser journeys have passing verification across these runs:** 20 guidance journeys, ten existing desktop regressions and three touch journeys (two new guidance cases plus the existing combined scorecard/save journey). This is not one green full-suite batch. The final six-case correction batch is green; original failures remain recorded.

Focused unit command, from `frontend/`:

```powershell
npm test -- --maxWorkers=1 src/components/CampaignAttention.test.tsx src/components/idleAttention.test.ts src/game/campaignAttention.test.ts src/components/CampaignUI.test.tsx src/components/CampaignTutorial.test.tsx src/components/Tooltip.test.tsx src/components/tips.test.ts src/game/campaignGuidance.test.ts
```

The final affected rerun used `npm test -- --maxWorkers=1 src/game/campaignAttention.test.ts src/components/CampaignAttention.test.tsx`.

Browser commands, from `frontend/`, Node 22, `PLAYWRIGHT_PORT=4197`:

```powershell
node node_modules/@playwright/test/cli.js test campaignAttention.spec.ts controls.spec.ts campaignTutorial.spec.ts clock.spec.ts --project=chromium --grep 'guidance|bottom dock|Challenge incident transport|Chapter 0 requires real|Back and Save and exit|completed player.*1440|saved Chapter 0 replay.*1440|manual steps advance exact' --retries=0 --output=../test-results/phase1-implementation/browser-final-artifacts

node node_modules/@playwright/test/cli.js test campaignAttention.spec.ts mobile.spec.ts --grep 'guidance|Phase 1 Hint' --retries=0 --output=../test-results/phase1-implementation/browser-completion-artifacts

node node_modules/@playwright/test/cli.js test campaignAttention.spec.ts mobile.spec.ts --grep 'guidance incident:|guidance measured incident recovery|guidance collapsed entry|guidance queued reliability|Phase 1 Hint' --retries=0 --output=../test-results/phase1-implementation/browser-target-corrections-artifacts
```

The existing-regression command completed with **24 passes / one recovery-budget failure** before the final refinements. All ten selected existing regressions passed. The later recovery case passed after separating postmortem idle verification and using the existing public 2× control: ten idle seconds remain real seconds; five physical recovery seconds need 2.5 seconds of rendered clock ticks. No per-assertion timeout, expectation, skip or retry policy was weakened.

Initial diagnostics are retained under `test-results/phase1-implementation/browser-artifacts/`: 9 browser passes and three failures. One was an ambiguous Database locator; the two combined journeys exhausted their unchanged 60-second overall budget while rendering virtual clock frames. Traces show ten virtual seconds taking 18–40 real seconds under SwiftShader. The correction scopes the locator and splits installation/recovery and confirmation/modal ownership into focused journeys, preserving the checks, real room, per-assertion timeouts and retries=0.

A concurrent initial unit/browser attempt had five 5-second unit-test timeouts. Its serial rerun passed all 120 tests without increasing timeouts; subsequent focused checks cover the added visibility behavior. These diagnostics are not represented as a green full suite.

The final mobile defect was application presentation, not a test exception: the Database button had an intersection ratio of `0.996875` at 390px after scrolling to the inspector edge. Explicit Got it now reserves eight pixels of scroll clearance and requires a fully on-screen target. The unchanged ratio-1 visibility assertion passes at both touch widths. No existing status indicator was resized to fix it.

Reviewer screenshots:

- Header: [desktop](../test-results/phase1-implementation/review-screenshots/header-desktop.png), [390px](../test-results/phase1-implementation/review-screenshots/header-390.png), [320px](../test-results/phase1-implementation/review-screenshots/header-320.png).
- Attention: [Run gold](../test-results/phase1-implementation/review-screenshots/run-gold.png), [Hint gold](../test-results/phase1-implementation/review-screenshots/hint-gold.png), [accepted Database gold](../test-results/phase1-implementation/review-screenshots/database-gold.png).
- Manual help: [desktop card](../test-results/phase1-implementation/review-screenshots/hint-card-desktop.png), [320px touch card](../test-results/phase1-implementation/review-screenshots/hint-card-320-touch.png).
- Final touch targeting: [390px](../test-results/phase1-implementation/review-screenshots/hint-target-390-touch.png), [320px](../test-results/phase1-implementation/review-screenshots/hint-target-320-touch.png).

Screenshots, traces and temporary diagnostics remain ignored under `test-results/phase1-implementation/`. They are review artifacts, not intended Git content. The full frontend/backend coverage and entire existing browser suite are not claimed by these focused local checks. Chromium desktop and touch emulation do not establish Safari/Firefox/real-device or screen-reader acceptance. Ambiguous future outcomes remain conservative; hints cannot infer a player's intent or prove that an accepted change will recover service. The existing build warning for the large Facility chunk remains.


## Historical targeting and immediate Confirm correction

The strategy-selection presentation described in this section was superseded by the concise one-action refinement below. The shared action identities, nested targeting and confirmation mechanism remain in use.

The original resolver emitted only broad inspection destinations. Its DOM registry had no purchase/action identities, its already-selected inspection fallback explicitly chose About, and its lifecycle cancelled acceptance on panel/selection/view changes. Including all recorded inputs in the stage key also treated a legitimate intermediate inspection as a new stage. Together these prevented continuation from an entry to an actual corrective control. The new App 3 browser journey additionally exposed the inspector's existing passive scroll reset running after the first reveal. Accepted reveal now follows that reset; a separate layout cleanup removes the old gold before higher-priority Confirm can paint.

The existing read-only resolver now supplies contextual `GuidanceAction` alternatives (authoritative `Action`, label and observed evidence). Every offered action passes the existing `previewCampaignAction` dispatcher preview. This covers affordability, unlocks, prerequisites, outstanding work and current action validity without adding gameplay rules. A shared stable identity connects the proposal to existing CampaignAction and CampaignDecisionButton controls. The presentation host separately checks visibility, enablement, viewport bounds and occlusion before marking a control.

Multiple valid strategies require an explicit radio selection; nothing is purchased by selecting it. Inspect evidence first remains available. A sole validated strategy can proceed directly. The accepted sequence can pass through the existing sheet Close, Equipment & actions entry, routing disclosure, App Server inspection and exact instance selector. Those intermediate interactions preserve acceptance. The final interaction, invalidation, material stage/running changes, explicit dismissal or higher-priority ownership clears it. Passive inspection inputs no longer invalidate a valid sequence; accepted scrolling reveals each new destination once, without fighting subsequent player scrolling.

Full-demand removal is offered only when current healthy routing and observed workload capacity support it; otherwise inspection remains the recommendation. This advisory evidence check changes no availability or completion rule. It cannot guarantee future service.

### Real-state examples

| Observed state | Requested recommendation | Final existing control |
| --- | --- | --- |
| Opening DB demand exceeds capacity; upgrade affordable | Choose capacity, or explicitly choose free admission relief | Upgrade database, or Limit to 500 requests/s |
| App 3 individually overloaded during a spike | Choose that server's validated scale-up | App Server, then App 3, then Scale up App 3 |
| Healthy installed serving app is unrouted; current allocation fits | Compare validated routing with temporary relief | Configure routing disclosure, then All apps |
| Load balancer absent | Installation only enables a later routing decision | Deploy load balancing |
| Read-heavy DB pressure | Capacity/cache/admission alternatives, with cold-cache and write limitations | Available DB or Read Cache action |
| Write-heavy DB pressure | Capacity/admission or more diagnosis | Cache is not prescribed as a write-pressure correction |
| Observed failed server | Free restoration or available admission relief | Restore the actual failed App; no extra confirmation invented |
| Accepted correction/promotion or qualifying recovery observations pending | Preserve existing time-dependent recommendation | Run |
| Growth wave or reliability test ready | Existing explicit mandatory decision | Start next growth wave / Start reliability test |
| No valid affordable correction | Explain limitation and inspect existing readings/requirements | Evidence control; no disabled purchase target |

### Shared confirmation mechanism

`CampaignAction` is the shared quote/Confirm/Cancel flow for Campaign infrastructure, cache, routing-related purchases, autoscaling research/deployment and reliability purchases. Its existing quote preview, dispatch, signature re-review guard, cost/upkeep/delay facts, focus, Cancel and execution remain authoritative. The host supplies Campaign-only priority eligibility; the shared component adds the existing gold class only to an enabled, valid Confirm with the currently reviewed quote. A changed/stale quote loses gold until the existing review guard has accepted its current figures. Invalid or unaffordable quotes never receive gold.

Confirm has immediate priority over accepted targets and idle Run/Hint, without waiting ten seconds. Confirm/Cancel/close removes it; recalculated idle guidance starts afresh. Chapter 0/practice/tutorial ownership, blocking modals, hidden/unfocused app and pointer lock suppress it. Classic is not opted in. Direct routing, restoration and other direct decisions remain direct; no confirmation step was added. Menu reset/import/exit confirmations and the separate mandatory Scaling risk choice retain their own ownership and are not treated as equipment purchases. Reliability research in the technology tree and other direct decisions receive no invented quote step; only existing shared confirmation flows opt in.

Follow-up source changes: `campaignAttention.ts`, `CampaignAttention.tsx`, `useCampaignAttention.ts`, `CampaignAttention.css`, `CampaignAction.tsx`, `CampaignInfrastructure.tsx` and `CampaignEvidence.tsx`. Matching regressions changed in `campaignAttention.test.ts`, `CampaignAttention.test.tsx`, `campaignAttention.spec.ts` and `mobile.spec.ts`, plus this report. Existing header/status/dock geometry and other Phase 1 work are preserved. No simulation, costs, availability, activation delays, progression, persistence or backend/shared source changed.

### Historical targeting validation and limits

Node **22.23.3**, same `fe/campaign-guidance-phase-1` branch and base. The required fresh `git fetch origin main` succeeded; comparison was **0 ahead / 0 behind**. All **17 Phase 1 paths** remain local and unstaged (the original 14 plus the three shared component files above). No commit, push, PR, merge, deployment or other-worktree change.

| Verification | Result |
| --- | --- |
| Final focused unit/component batch, eight files, one worker | **116 passed**, no skips |
| Resolver rerun after adding an unsafe-full-demand boundary assertion | **21 passed**; same existing cases, additional assertion |
| Frontend lint, typecheck and production build | Passed; final lint/typecheck also repeated after test-only edits |
| First targeting browser batch | **29 passed / two failed**, 31 desktop/touch journeys, 10.3 minutes |
| Final targeting and correction batch | **19 passed**, retries 0, 4.7 minutes; includes both original failures, mandatory decisions, restoration, idle/recovery/queued activation and both touch widths |
| Compatibility and strengthened nested touch batch | **15 passed**, retries 0, 5.4 minutes: ten existing Chapter 0/practice/clock/dock/Classic regressions, Chapter 2/6 confirmation, preparation-risk ownership and both collapsed-inspector touch handoffs |
| Additional touch purchase-figure scrolling checks | **2 passed**, retries 0, 14.9 seconds; all four existing quote values can be brought fully into view at 390px and 320px while Confirm remains the sole gold target |
| Git whitespace, inventory and index | Clean checks; only the 17 intentional Phase 1 paths, none staged or unmerged |

**47 distinct browser journeys have passing verification across these runs.** These are selected journeys, not the complete browser suite or a claim of one all-green 47-case batch. The 19-, 15- and two-case follow-ups used the final runtime build; some cases overlap. The first batch retains its original failures. No runtime source changed after the final build; subsequent edits strengthened test assertions and this report only.

Browser failures were investigated rather than retried away:

- **App 3 selection lost its mark:** the actual instance control was present, but EquipmentPanel's existing post-selection passive scroll reset ran after the original layout-time reveal. Moving accepted reveal after that reset fixes the sequence. Layout cleanup still removes previous gold before Confirm paints. The unchanged App 3 sequence and 10-second assertion budget passed in the fresh run.
- **Health Checks Confirm viewport ratio:** native IntersectionObserver reported **0.9999993443489075** for the visually contained fractional-position popover. No quote layout, dimensions or placement changed. The shared-confirmation regression now checks exact full-button bounds, every clipping ancestor, five interior hit-test points and sole-target ownership. Other desktop and touch journeys retain ratio-1 assertions. The stronger bounds/occlusion check passes without a tolerance, forced click, skip or retry.

An interrupted correction attempt completed one case before its hit-test points were corrected to lie inside the existing rounded corners; it is diagnostic, not additional coverage. The final 19-case batch supersedes it. Initial unit diagnostics also caught an incorrect fixture expectation that zero-cash companies permit free admission actions (the existing dispatcher rejects insolvent actions), and a clipping test spy that unintentionally changed every mocked element's bounds. Low-cash/free-action and zero-cash/no-action cases now remain distinct; the clipping test supplies a per-element rectangle. The final 116-case batch passes without timeout or assertion-budget increases. A sandbox Vite spawn restriction required a permitted retry before tests could start.

Commands from `frontend/`, Node 22, `PLAYWRIGHT_PORT=4197`:

```powershell
npm test -- --maxWorkers=1 src/game/campaignAttention.test.ts src/components/CampaignAttention.test.tsx src/components/idleAttention.test.ts src/components/CampaignUI.test.tsx src/components/CampaignTutorial.test.tsx src/components/CampaignFinance.test.tsx src/components/CampaignRefinement.test.tsx src/components/Tooltip.test.tsx

node node_modules/@playwright/test/cli.js test campaignAttention.spec.ts mobile.spec.ts --grep 'action guidance|action confirmation|Phase 1 Hint|guidance collapsed entry|guidance incident:|guidance Chapter 1:|guidance accepted installation|guidance measured incident recovery|guidance queued reliability' --retries=0 --output=../test-results/phase1-targeting/browser-final-artifacts

node node_modules/@playwright/test/cli.js test campaignAttention.spec.ts controls.spec.ts campaignTutorial.spec.ts clock.spec.ts mobile.spec.ts --grep 'action confirmation chapter|action guidance preparation|Phase 1 Hint|bottom dock|Challenge incident transport|Chapter 0 requires real|Back and Save and exit|completed player.*1440|saved Chapter 0 replay.*1440|manual steps advance exact' --retries=0 --output=../test-results/phase1-targeting/browser-compatibility-artifacts

node node_modules/@playwright/test/cli.js test mobile.spec.ts --grep 'Phase 1 Hint' --retries=0 --output=../test-results/phase1-targeting/browser-mobile-details-artifacts
```

The grep commands describe the completed selections; later-added Chapter 2/6 and risk tests also match the broad targeting pattern if rerun now. Test-only changes do not alter the recorded runtime build.

Artifacts remain ignored under `test-results/phase1-targeting/`. Desktop DB/Confirm and 320px action/Confirm captures were inspected manually: gold is clear, focus remains distinct, Cancel remains reachable and HUD/dock geometry is preserved. On short phones the existing preview body scrolls; the new tests verify access to setup, cash-after, upkeep and activation figures without changing that panel. Initial traces and error contexts are retained alongside fresh passing artifacts.

Ambiguous future effects, mixed bottlenecks, uncertain cache/controller benefit, unsupported safe routes, insufficient cash and inconsistent evidence retain explicit alternatives or inspection rather than a promised optimal repair. Cache is not prescribed as a write-pressure fix; autoscaling research is not treated as installed capacity. Existing pending activation/recovery observations still recommend Run only through the prior evidence checks.

Full frontend/backend coverage and the entire browser suite were **not** rerun for this local correction. Backend/shared and simulation/store/finance/persistence source remain unchanged. Chromium desktop/touch emulation does not establish Safari, Firefox, real-device or screen-reader acceptance. Some unchanged legacy journeys log local `/api/session` proxy connection refusals because the backend is not running; no unhandled browser failure resulted, and no real account/cloud-save acceptance is claimed. The existing large-Facility-chunk build advisory remains.

## Concise contextual Hints (current presentation)

This refinement supersedes the historical strategy chooser above. The card now contains **Hint**, **one short paragraph** and **Got it**, with the existing Close icon for dismissal. No radios, response menu, strategy cards, measurements or navigation-explanation paragraphs are rendered. Got it is immediately enabled; it marks the already-selected next interaction without another idle delay.

### Cause and reference audit

The earlier correction exposed `AttentionDecision.actions`, each candidate's technical evidence, the long observation/recommendation and DOM-navigation notes directly in the card. It also required the player to select a strategy before accepting help. That made the implementation evidence become a beginner-facing decision form.

Reviewed [PR #119](https://github.com/CS3216-Final-Project/99.9-Percent/pull/119), verified its `fe/campaign-guidance-rewards` head at `7f198cc9e2339d56ebae28119205bcf3dcf85585`, and inspected its `ChapterHints.tsx` / `campaignNextStep.ts` read-only through Git. Its message, Got it and accepted-control relationship supplied the UX reference. Current Phase 1's global icon, nonmodal card, clock ownership, protected onboarding, target navigation and confirmation architecture remain in place. No old code was merged, cherry-picked or copied.

### How one action is selected

The existing mandatory-review/decision and time-dependent Run interpretation stays first. Candidate actions still pass the existing authoritative `previewCampaignAction`; their technical evidence remains internal. The resolver now emits a single `action` and concise `message`:

- DB overload: choose an affordable unlocked upgrade when its real next-tier capacity supports the observed demand. Otherwise consider available read-cache deployment/tuning when measured reads support it and writes alone do not exhaust the DB. Safe, feasible temporary traffic limiting can be the fallback; otherwise investigate.
- App overload: select a validated scale-up for an actually overloaded instance when that tier supports its demand; otherwise consider feasible added capacity with existing load balancing, then safe temporary limiting. Installation still requires later routing.
- Unrouted serving capacity: choose the validated existing All apps routing control when the healthy capacity fits; otherwise choose available load-balancer installation or useful investigation.
- Actual failure: choose the validated restoration control for the failed app. Existing accepted failover/installation and measured recovery retain their prior Run logic.
- Full-demand checks: suggest removing a limit only through the existing observed-capacity/safe-routing check. Mandatory growth/test decisions keep their existing controls.

These are reasonable beginner recommendations, not an optimal-strategy claim or new gameplay requirements. Unsupported, unavailable or unaffordable choices are never made executable by guidance. If evidence cannot justify a specific correction, one useful inspection is recommended instead. All alternative purchases, free responses, routing, cache and research controls remain available through normal gameplay; `CampaignUI.tsx` and purchase/validation components were not changed by this refinement.

The accepted key follows the selected recommendation, so invalidation clears an obsolete target. A real inspector/view navigation can reveal a reused final button again after the inspector's existing scroll reset. Ordinary scrolling and rerendering do not force the player back to it. Confirm still immediately owns the sole gold spotlight for a valid reviewed quote; its original costs, warnings, Cancel, validation and execution remain unchanged.

### Before and after examples

| Chapter / state | Previous presentation | Current concise message / next control |
| --- | --- | --- |
| 1 / affordable DB correction | Observation, technical evidence, strategy radios, navigation paragraph | "Your database is overloaded. Upgrade it to handle more requests." / Upgrade database |
| 2 / routing unused capacity | Compare routing options and choose a response | "Your new server isn't receiving traffic. Send traffic to All apps in Configure routing." / disclosure, then All apps |
| 3 / supported read-cache response | Read/write and cache evidence plus response selection | "Repeated lookups are overloading your database. Deploy Read Cache to reduce that work as it warms up." / Deploy Read Cache |
| 4 / announced pulse waiting | Announced pulse explanation and game-time instructions | "Press Run to see what happens next." / Run |
| 5 / observed failed App 1 | Health, surviving capacity and restoration/admission alternatives | "App 1 has failed. Restore it to bring it back online." / Restore App 1 |
| 6 / wave ready | Readiness explanation plus detailed next-action copy | "Your company is ready to grow. Choose Start next growth wave when you're ready." / Start next growth wave |

Recovery uses "Your app is recovering. Keep it running to make sure everything is stable." A pending installation uses "Your change is being installed. Press Run to let it finish, then check your app." Already-running advice says Keep running rather than suggesting a Pause interaction. Detailed metrics and technical explanations remain in the existing inspector, purchase preview and postmortem.

### Exact files changed by this refinement

Runtime presentation (three):

- `frontend/src/game/campaignAttention.ts` ? one validated recommendation and short message; reuse the prior admission-capacity evidence helper.
- `frontend/src/components/CampaignAttention.tsx` ? one paragraph/Got it, remove chooser state and navigation copy, preserve nested and Confirm priority; reveal a reused target after actual inspector navigation.
- `frontend/src/components/CampaignAttention.css` ? remove only the obsolete Hint chooser styles.

Regressions/report (five):

- `frontend/src/game/campaignAttention.test.ts`.
- `frontend/src/components/CampaignAttention.test.tsx`.
- `frontend/e2e/campaignAttention.spec.ts`.
- `frontend/e2e/mobile.spec.ts`.
- `docs/CAMPAIGN_PHASE1_GUIDANCE.md`.

The original 17 intentional Phase 1 paths remain pending; the other nine paths were preserved. Chapter goals, HUD indicators, Hint position, Sound/Menu, dock, Chapter 0/practice, Classic, simulation, incident/recovery/progression predicates, costs, saves and backend/shared source were not changed by this refinement. No automatic Yes/No invitation was added.

### Current refinement validation and remaining limits

Node **22.23.3**; final runtime source passed frontend lint, typecheck, **120 focused tests in eight files** (no skips, one worker, 45.07 seconds) and production build. The existing large-Facility-chunk advisory remains. The required start-of-task fetch succeeded and found the feature HEAD **0 ahead / 0 behind** `origin/main`; no rebase or branch/worktree creation was needed.

| Browser verification | Result |
| --- | --- |
| First six-chapter / confirmation / header / onboarding / Classic / touch selection | **33 passed / one failed**, 34 journeys, retries 0, 8.3 minutes |
| Fresh final correction and presentation selection | **15 passed**, retries 0, 2.6 minutes; includes the original failure, all six concise chapter cards, nested DB at 1440/1366px, App 3 selection/scaling, routing, keyboard/reduced motion, idle Run/Hint and 390/320px touch |

All **34 distinct selected browser journeys** have passing verification across these runs, rather than one green 34-case batch. The final 15 used the final runtime build. The first run's trace, screenshot and error context remain retained under `test-results/phase1-simple-hints/browser-artifacts/`; passing corrections are under `browser-corrections-artifacts/`. No runtime source changed after the final build.

The failure was an actual presentation lifecycle defect: opening Database readings while an upgrade was already accepted reused the same action button, but the inspector reset its scrolling and the old reveal reference prevented another reveal. The existing recommendation remains accepted; genuine selection/panel/view navigation now clears only that reveal reference, allowing the existing post-reset effect to reveal the same target again. Ordinary scrolling does not reset it. The unchanged 10-second visibility assertion passed after the fix; the case additionally verifies readable Database capacity information and the still-enabled free traffic-limit alternative. No forced click, timeout increase, retry or new skip was introduced.

An initial two-file unit attempt had **38 passes and one stale-copy failure**: its expectation referenced the previous long unavailable-action description. It now asserts no recommended correction and a concise useful inspection; final 120-case verification passed. The new tests retain affordability, pending installation, write-pressure/cache distinction, immutable advice, selected-target invalidation, sole-gold priority, stale/disabled Confirm, review/tutorial ownership and clock checks.

Commands from `frontend/` with Node 22 and `PLAYWRIGHT_PORT=4197`:

```powershell
npm run lint
npm run typecheck
npm test -- --maxWorkers=1 src/game/campaignAttention.test.ts src/components/CampaignAttention.test.tsx src/components/idleAttention.test.ts src/components/CampaignUI.test.tsx src/components/CampaignTutorial.test.tsx src/components/CampaignFinance.test.tsx src/components/CampaignRefinement.test.tsx src/components/Tooltip.test.tsx
npm run build

node node_modules/@playwright/test/cli.js test campaignAttention.spec.ts mobile.spec.ts campaignTutorial.spec.ts controls.spec.ts --grep 'simple Hint|action guidance|action confirmation|Phase 1 Hint|guidance collapsed entry|guidance incident:|guidance Chapter 1:|guidance accepted installation|guidance measured incident recovery|guidance queued reliability|guidance onboarding|guidance header preserves|Chapter 0 requires real|Challenge incident transport' --retries=0 --output=../test-results/phase1-simple-hints/browser-artifacts

node node_modules/@playwright/test/cli.js test campaignAttention.spec.ts mobile.spec.ts --grep 'simple Hint|guidance incident:|guidance collapsed entry|guidance Chapter 1:|action guidance selects the overloaded|action guidance nested DB|action guidance routing|Phase 1 Hint' --retries=0 --output=../test-results/phase1-simple-hints/browser-corrections-artifacts
```

Desktop and final 320px Hint captures were reviewed manually: the card is compact, the explanation and Got it fit, and the existing HUD, dock, dismissal and gold handoff are preserved. Touch tests continue to verify access to all four quote figures by scrolling, Confirm/Cancel, full target visibility and reduced motion. Generated images/traces/reports remain ignored.

Investigation remains safer when no feasible correction is supported: insufficient affordable capacity, cache benefit that cannot address observed writes, no safe existing routing choice, blocked work without a supported next activation, or incomplete/inconsistent evidence. A valid partial correction is not presented as the only strategy or a guaranteed recovery. Other strategies remain in the existing gameplay controls.

Full frontend/backend coverage and the complete browser suite were not rerun for this local presentation change. Chromium touch emulation is not real-device, Safari/Firefox or screen-reader acceptance. Existing local `/api/session` proxy refusals appeared in a few legacy journeys because the backend was not running; their browser assertions passed. There is no claim of real account/cloud-save acceptance. All **17 intended Phase 1 paths** remain unstaged; nothing was committed, pushed, published, merged or deployed, and other worktrees were not modified.

## Local preview

Use Node 22. From PowerShell:

```powershell
Set-Location C:\Users\user\99.9-Percent-Latest\frontend
npm run dev -- --host 127.0.0.1
```

Open the URL printed by Vite, normally `http://127.0.0.1:5173/`. Use a separate browser profile for disposable companies. Existing saves remain supported; no reset or migration is needed.

## Chapter 2 growth-readiness correction (October 20)

This amendment supersedes earlier Chapter 2 guidance that automatically marked Consider growth with current capacity, and the earlier universal single-action Hint description. Other chapters retain their existing guidance.

When database preparation and risk acceptance are both valid, ten eligible idle seconds mark **Hint first**. The card says: ?Your database may struggle when more users arrive. Upgrade it to prepare, or accept the risk and continue.? Its **Upgrade database** choice closes the card and marks the existing upgrade action; opening its quote immediately transfers gold to **Confirm**. **Accept risk** instead marks **Consider growth with current capacity**; opening the existing explanation immediately transfers gold to **Accept growth risk**. Opening either Hint choice or confirmation changes no company state. Only the existing confirmed action dispatches.

The resolver validates both choices with the existing cloned action preview. An unaffordable/unavailable upgrade is omitted and the card provides the valid single risk action. Accepted actions and changed evidence recalculate guidance using the existing resolver. One spotlight owner handles the chosen path, visible inspector entry/scroll clearance, and confirmation priority; a purchase Confirm takes priority over an open inline risk explanation. No new timer or persistent choice state is introduced. Simulation, costs, chapter progression and save schemas are unchanged.

Initial focused verification passed 76 unit/component cases. Browser testing then exposed a real scroll-handoff defect: cancelling a purchase quote while the inline risk explanation remained open left its confirmation out of view without gold. The shared spotlight owner now resets its reveal destination when a purchase confirmation takes ownership, allowing the remaining explicit risk confirmation to be revealed again on cancellation. Existing assertions, timeouts and retries remain unchanged. Final verification follows below.


Final-code unit/component verification: **76 passed** across `campaignAttention.test.ts`, `CampaignAttention.test.tsx`, `idleAttention.test.ts` and `IncidentPause.test.tsx`, using `npm test -- --maxWorkers=1` with those four paths. Frontend lint, typecheck and build passed again; the existing large Facility chunk advisory remains. The first ten-case browser run had **nine passes and one failure** at the cancellation handoff described above; its original trace and screenshot are retained under ignored `test-results/chapter2-choice/browser-artifacts/`. **Final browser batch: 10 passed in 2.8 minutes, retries 0**, including the corrected cancellation handoff, Hint-first 9,999/10,000ms boundary, both actual actions, Chapters 1/5 Hint regressions and fully visible 390px/320px touch transfers. Artifacts remain ignored under `test-results/chapter2-choice/browser-final-artifacts/`. No backend/full-coverage/full-browser-suite claim is made for this focused frontend correction.


Final browser command, from `frontend/` with Node 22 and `PLAYWRIGHT_PORT=4197`:

```powershell
node node_modules/@playwright/test/cli.js test campaignAttention.spec.ts mobile.spec.ts --grep 'guidance Chapter 2:|action guidance preparation:|simple Hint Chapter (1|2|5):|progression choice:|Chapter 2 chosen risk:' --retries=0 --output=../test-results/chapter2-choice/browser-final-artifacts
```

Desktop Hint and 320px selected-path captures were visually reviewed. Chromium touch emulation does not establish real-device, Safari or Firefox acceptance. Final whitespace checks passed; no staged or unmerged entries, commit or push. Earlier pending work is preserved.
