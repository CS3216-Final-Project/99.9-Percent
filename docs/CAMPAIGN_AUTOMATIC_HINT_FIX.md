# Automatic Campaign Hint fix

> Historical feature report. For the current integrated branch, Chapter 0 compatibility and fresh validation, see [Campaign Git integration audit](CAMPAIGN_GIT_INTEGRATION_AUDIT.md). Earlier test counts, preview URLs and ignored screenshots below describe their original runs.

> The later [Campaign guidance hierarchy refinement](CAMPAIGN_GUIDANCE_HIERARCHY.md) separates factual goals/status from requested advice and reserves ordinary Run/optional-risk spotlights for requested help. The centered invitation, stable stage identity and No dismissal policy remain in place.

This follow-up supersedes the automatic-offer exclusions in [Campaign Learning Refinement](CAMPAIGN_LEARNING_REFINEMENT.md). Work remains local on `fe/campaign-guidance-rewards`; existing Development B changes are retained.

## Reproduction and root cause

Before changing product code, a real Chromium journey loaded an engine-generated Opening company with an active database incident, completed tutorials and a paused clock. After 15 real-time eligible seconds, the expected centered dialog was absent. The test failed on the missing dialog, with a screenshot and trace preserved in [baseline evidence](../test-results/automatic-hints/baseline/).

The failure was unconditional policy, not modal stacking: `campaignNextStep.ts` required management phase **and no active incident**, and each diagnostic incident branch also passed `automatic=false`. Thus the existing `ChapterHints` offer timer never armed in the reported state. A separate exclusion disabled offers for progression decisions. `useGuidanceCue.ts` also treated any open evidence disclosure as an indefinite blocker. Hint had no automatic gold treatment at all.

The timer already used real `setTimeout`, independent of simulation steps. Metric publications did not inherently reset it. However, pointer-over was considered activity; that could also postpone assistance after a control moved beneath a stationary pointer. Hint/offer timers now ignore hover, while real clicks, keys, wheel activity, focus changes and dragging reset them. Run keeps its established hover behavior.

## Resulting behavior and priorities

- Paused unresolved incidents, normal gameplay, mandatory decisions and chapter-specific blockers may receive an offer after 15 eligible seconds. Paused unfinished Chapter 4/5 stability stages can receive help too; counter changes do not create new stages.
- Where investigation is needed, the existing Hint button receives the established gold ring, outer glow and pulse at 10 seconds. It scrolls into view without taking keyboard focus. Reduced motion uses the same strong static treatment.
- Run keeps priority when observation is the appropriate next action. Mandatory progression controls retain their 12-second guidance until an offer opens. Neither situation adds a competing Hint glow. An accepted contextual hint directs attention to its actual entry control.
- The shared existing `Modal`, portaled to `document.body`, provides the centered offer, backdrop, Escape/close behavior, keyboard trap and focus restoration. The modal has priority over underlying highlights.
- Yes resolves current authoritative context, then Got it reveals the corresponding control. No, Escape and close suppress further offers and Hint animation for that stage. Manual Hint remains available. Suppression survives entry-button remounts during the current company visit.
- A chapter, incident identity or material bottleneck/objective change permits another interval. Metrics, cash, render counts and individual stability-counter increments do not. Existing stale dialogs close when the stage changes.
- Opening/closing evidence restarts the interval. Leaving evidence open permits help after another 15 seconds; scrolling or interacting keeps postponing it.
- Tutorials, blocking modals, purchase confirmation, room inspection, view sheets, chapter completion, postmortems and recovery acknowledgements retain priority. Pending accepted work and authoritative incident recovery verification do not receive automatic offers. Running companies retain Run/Pause guidance; automatic dialogs are restricted to paused play so they cannot conceal an advancing incident.

Automatic offers never pause, resume, reset or advance the company. Manual Hint retains its existing explicit pause-on-open behavior. Accepting or dismissing help never performs a purchase, inspection, configuration or progression action.

## Contextual advice

| Chapter | Recorded situation and guidance |
| --- | --- |
| Opening | Actual database demand/backlog directs to Database. Actual application failure or pressure directs to Servers instead. No purchase is prescribed. |
| Scaling & Routing | The optional growth-risk review remains explicitly optional. Measured application pressure with unrouted installed capacity and load balancing directs to Routing. |
| Data Strategy | Database pressure directs to demand/capacity, read/write composition, cache hits and backlog. Writes still reach the database; caching is not assumed to solve every workload. |
| Traffic Spikes | Before/between pulses: Run to observe. Measured overload: inspect the overloaded component. After pulses: Run/Keep running for the actual remaining observations. |
| Stay Online | Actual failed application: inspect health and surviving routed capacity. Research is distinguished from deployed detection/redundancy. After restoration: finish stable observations. |
| Grow the Company | An active limit directs to capacity review before Remove traffic limit. Existing growth-wave guidance explains registrations; promotions are not described as direct registrations. |

The conservative fallback is inactivity only. Repeated inspections or attempts keep postponing assistance until the player stops for 15 seconds. This implementation does not infer that an alternative strategy is wrong or classify purchases as unproductive. No reliable general-purpose classification is available in current UI state.

## Visual evidence

All screenshots are local ignored artifacts. Each row includes a centered Yes/No offer, visible gold Hint and accepted contextual target.

| Viewport | Incident | System overview |
| --- | --- | --- |
| 1440 × 900 | [Offer](../test-results/automatic-hints/offer-incident-1440.png), [Hint](../test-results/automatic-hints/hint-incident-1440.png), [target](../test-results/automatic-hints/accepted-incident-1440.png) | [Offer](../test-results/automatic-hints/offer-normal-1440.png), [Hint](../test-results/automatic-hints/hint-normal-1440.png), [target](../test-results/automatic-hints/accepted-normal-1440.png) |
| 1366 × 768 | [Offer](../test-results/automatic-hints/offer-incident-1366.png), [Hint](../test-results/automatic-hints/hint-incident-1366.png), [target](../test-results/automatic-hints/accepted-incident-1366.png) | [Offer](../test-results/automatic-hints/offer-normal-1366.png), [Hint](../test-results/automatic-hints/hint-normal-1366.png), [target](../test-results/automatic-hints/accepted-normal-1366.png) |
| 390 × 844 | [Offer](../test-results/automatic-hints/offer-incident-390.png), [Hint](../test-results/automatic-hints/hint-incident-390.png), [target](../test-results/automatic-hints/accepted-incident-390.png) | [Offer](../test-results/automatic-hints/offer-normal-390.png), [Hint](../test-results/automatic-hints/hint-normal-390.png), [target](../test-results/automatic-hints/accepted-normal-390.png) |
| 320 × 844 | [Offer](../test-results/automatic-hints/offer-incident-320.png), [Hint](../test-results/automatic-hints/hint-incident-320.png), [target](../test-results/automatic-hints/accepted-incident-320.png) | [Offer](../test-results/automatic-hints/offer-normal-320.png), [Hint](../test-results/automatic-hints/hint-normal-320.png), [target](../test-results/automatic-hints/accepted-normal-320.png) |

Browser assertions verify the dialog center in both axes, fully visible dialog/buttons, Hint visibility, strong outline/glow, animation/reduced motion, target visibility, no competing Run highlight, 60 seconds without a repeat after No, manual Hint after No, and unchanged company step.

## Storage warning investigation

`store.saveNow()` uses the exact warning “Could not save: browser storage is unavailable.” whenever `persist()` returns false. This is broader than a proven browser restriction:

- `persist.ts` catches localStorage read/write exceptions, including security restrictions and quota failures.
- It refuses to overwrite an incompatible/corrupt stored save or conflicting historical backup without an explicit reset.
- `store.ts` can also return false for a blocked save, a failed local cloud checkpoint, or an analytics archive write failure after the main save succeeds.

The reproduction fixture does not disable storage. Normal saving on the local test preview origin is checked separately from deliberately denied writes, which reproduce the warning without disabling Hint assistance. A different host or port gives a different storage origin; that alone does not imply saving is forbidden.

The user's browser exception, quota and settings are not available in the supplied request, so identifying private browsing, quota exhaustion or a particular origin as the actual cause would be speculation. No persistence code or schema was changed. The warning establishes a failed persistence path, not which path. Keep an affected tab open and use the existing export control if its progress needs preserving.

## Exact files changed in this follow-up

- `frontend/src/game/campaignNextStep.ts`
- `frontend/src/game/campaignNextStep.test.ts`
- `frontend/src/components/ChapterHints.tsx`
- `frontend/src/components/ChapterHints.test.tsx`
- `frontend/src/components/chapterHintAttention.ts`
- `frontend/src/components/useGuidanceCue.ts`
- `frontend/e2e/automaticHints.spec.ts` (new)
- `frontend/e2e/learningGuidance.spec.ts`
- `frontend/e2e/mobile.spec.ts`
- `docs/CAMPAIGN_AUTOMATIC_HINT_FIX.md` (new)
- `docs/CAMPAIGN_LEARNING_REFINEMENT.md` (pointer to this follow-up)

The established `CampaignFeedback.css` treatment is reused unchanged. Simulation, finance, unlock rules, chapter requirements, save schemas, backend and shared contracts were not modified by this follow-up.

## Validation

Node **22.23.3** is used explicitly (`C:\Users\user\AppData\Local\npm-cache\_npx\52027bd8fc0022aa\node_modules\node\bin\node.exe`). Frontend lint (no warnings) and typecheck passed after the final Chapter 6 wording change. The focused Vitest run passed **189 tests in seven files**, including application, guidance, attention, growth-wave wording, engine-generated pre-incident database/routing evidence and persistence regressions ([unit log](../test-results/automatic-hints-regression-unit-final.log), 40.17 seconds). A full frontend coverage run and backend suite were not repeated for this presentation-only follow-up.

The broad browser run passed **all 72 journeys**, with retries disabled and native exit code 0, in 12.5 minutes ([regression log](../test-results/automatic-hints-browser-regression.log)). It covers automatic incident/normal offers and accepted targets at all four widths; all six chapters; once-per-stage No and manual entry afterward; active investigation, open disclosures and Finance suppression; storage success/refusal; valid Confirm in all six chapters; mandatory progression decisions; final Chapter 4/5 observations and outcomes; Opening walkthrough; Finance; App Health; recovery/postmortem acknowledgements; save/reload; Classic tutorial/purchase/reload; keyboard focus and touch journeys at 390/320.

That broad run used the completed eligibility/attention fix before the last Chapter 6 explanatory wording build. The final production build passed, followed by **22/22 targeted browser checks**, with retries disabled and native exit code 0, in 1.9 minutes ([delivery log](../test-results/automatic-hints-browser-delivery.log)). These recheck every new automatic-offer flow, all four screenshot widths, desktop Chapter 6 hint/confirmation/reload journeys and 390/320 touch diagnosis. They also add two visible growth-registration explanations: preparing for readiness and an available Start next growth wave decision. The two browser runs cover **74 distinct journeys**; they do not claim a rerun of the entire browser suite on the final wording. Final lint and typecheck also pass without warnings.

All 24 screenshot links were checked on disk; representative modal, Hint and accepted-target images were visually inspected across the four requested widths. `git diff --check` passes; Git prints existing Windows line-ending notices for the previously edited browser files. No assertions were removed or weakened, test timeouts increased, or retries enabled. Expected `/api/session` connection-refused messages appear because the optional backend is not running; the isolated browser game journeys pass and the fixture rejects unhandled page errors.

Initial diagnostic failures remain in `test-results/automatic-hints/first-pass-failures/`: a newly written visual assertion encountered the existing keyboard-focus outline (3 px plus a separate gold ring), so the visual fixture now moves keyboard focus before measuring the 4 px idle outline; no outline assertion was reduced. The initial disclosure `toggle` listener could fire late under Playwright's paused clock, so it was replaced by immediate `open` attribute observation. The active-investigation fixture now establishes a fresh focus interval before its first 14-second check, avoiding inherited navigation time. These failures were inspected and retained, not suppressed by retries or increased timeouts.

The next diagnostic run passed 14 of 18 browser cases. Four normal-play screenshots reached the accepted traffic target assertion before delivering its existing zero-delay attention timer. The journey now advances the browser clock by one millisecond after Got it; the company remains paused and no simulation step advances. The full visibility assertion is retained. That diagnostic log is `automatic-hints-browser-final.log`; the final build's combined regression log is `automatic-hints-browser-regression.log`.

Remaining coverage boundaries: Chromium touch emulation does not establish real-device, Safari or Firefox behavior. Suppression is visit-only, not a new saved preference; reloading may permit a fresh offer. No unproductive-strategy classifier, production deployment or hosted CI validation is claimed.

## Local review

The final production build is running locally at **http://127.0.0.1:4198/**. Its served index was checked against this worktree's final `frontend/dist/index.html`. This is a local-only preview; it does not publish or deploy the game. A host/port different from your usual dev URL has its own browser save slot.

From PowerShell:

```powershell
cd C:\Users\user\99.9-Percent-Latest\frontend
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173/`). Use Node 22.23.3. Continue Guided Mode, pause an unresolved incident, and leave the UI idle: Hint highlights at 10 seconds and the centered offer follows at 15. Leave Full system evidence open to verify it no longer blocks the offer. Choose No and wait again to check suppression; manual Hint still works.

No branch/worktree, commit, push, PR, merge or deployment was created. This build is ready for local review after the recorded checks.
