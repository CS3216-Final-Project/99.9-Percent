# Campaign guidance information hierarchy

> Historical feature report. For the current integrated branch, Chapter 0 compatibility and fresh validation, see [Campaign Git integration audit](CAMPAIGN_GIT_INTEGRATION_AUDIT.md). Earlier test counts, preview URLs and ignored screenshots below describe their original runs.

Local presentation refinement on `fe/campaign-guidance-rewards`, retaining the existing uncommitted work. No simulation, gates, tutorials, finances, save formats or backend contracts changed.

## Audit before editing

`CampaignChapters.tsx` used `campaignObjective()` for most chapters and `campaignNextView().message` for Chapters 4/5. `CampaignUI.tsx` rendered that same Hint message under “Next required step” in normal and incident guidance. `ChapterHints.tsx` correctly used it for the requested Hint dialog too. This made the optional answer visible before requesting help, with exact duplication in the chapter bar and side panel.

The requirements disclosure also rendered `campaignGuidance.waiting`, `notice` and `optional`, some of which contained Run/Advance-step directions or troubleshooting. Reliability's always-visible status told the player to start, run or inspect specific evidence. Ordinary Run and the optional growth-risk control received unsolicited action spotlights.

## Result

The top bar now shows a stable educational objective from the existing chapter presentation model. A separate read-only `campaignSituation()` produces factual side-panel status. The optional `campaignNextStep()` message is confined to the existing requested Hint dialog; its stage identity, eligibility and advice resolver are unchanged.

| Chapter | Always-visible Goal | Factual state/progress available before Hint |
| --- | --- | --- |
| Opening | Understand how bottlenecks affect reliable service. | Workload growth, incident severity/recovery measurements, required report/milestone acknowledgements |
| Scaling & Routing | Understand how server capacity and routing work together. | Growth readiness, current headroom requirement or accepted risk, recorded growth, routing/installed-capacity evidence |
| Data Strategy | Understand how workloads and caching affect database demand. | Pending/recorded workload growth, actual read/write mix, cache hits, capacity/backlog and chapter requirements |
| Traffic Spikes & Autoscaling | Keep your company reliable during sudden traffic spikes. | Pending/active/ended pulses, completed pulse count out of two, actual stable baseline observations out of five |
| Stay Online | Keep service available when application servers fail. | Test started, failure observed, restoration recorded, actual stable service count out of five, outcome acknowledgement; failed application identity remains visible |
| Grow the Company | Keep a growing company reliable while serving full demand. | Traffic admission, growth outcomes, registered-user target, wave/readiness/final observations |

The side panel says **Current situation**, not **Next required step**. It does not repeat the educational goal. For example, Chapter 4 initially shows “First traffic pulse pending”, “Traffic pulses completed 0 / 2” and “Stable baseline observations 0 / 5”. At the final baseline observation it shows the real 2 / 2 and 4 / 5 counters. No Run instruction appears there.

Manual Hint or Yes on the existing invitation opens the contextual explanation, such as “Run your company to observe the first traffic spike.” Got it then applies the existing gold spotlight to the appropriate control. The chapter goal and factual status stay independent of that advice.

Ordinary Run and optional growth-risk spotlights now require requested/accepted help. Before a request, eligible inactivity draws attention to Hint instead. Mandatory tutorial instructions, incident Pause warnings, valid Confirm, mandatory progression controls and disabled-control reasons retain their existing discoverability and priority. Purchase/action labels, prices, navigation, component evidence, control tooltips, essential review dialogs and acknowledgements remain available.

No timer or modal framework changed. The centered offer still uses 15 eligible real-world seconds; No/close suppress another automatic offer and Hint animation for the same stage; manual Hint stays available in both normal and incident panels. Recovery verification retains its protection from intrusive offers/Pause guidance. No Hint acceptance or dismissal advances simulation, executes an action or changes a chapter requirement.

## Changed files in this follow-up

Product presentation (five files):

- `frontend/src/game/campaignChapters.ts`
- `frontend/src/game/campaignSituation.ts` (new)
- `frontend/src/components/CampaignChapters.tsx`
- `frontend/src/components/CampaignUI.tsx`
- `frontend/src/components/ChapterHints.tsx`

Tests and expectation updates:

- `frontend/src/components/CampaignUI.test.tsx`
- `frontend/src/components/CampaignFeedback.test.tsx`
- `frontend/e2e/guidanceHierarchy.spec.ts` (new)
- `frontend/e2e/chapters.spec.ts`
- `frontend/e2e/combined.spec.ts`
- `frontend/e2e/dataStrategy.spec.ts`
- `frontend/e2e/chapterHints.ts`
- `frontend/e2e/guidanceRewards.ts`
- `frontend/e2e/learningGuidance.spec.ts`

Reports: this file and a follow-up pointer in `CAMPAIGN_AUTOMATIC_HINT_FIX.md`.

Existing expectations for unsolicited Run/risk advice were replaced by checks that it is absent before Hint and present, with its strong spotlight, after a request. Mandatory tutorial timer tests, confirmation/recovery assertions, physical-step checks, timeout limits and real WebGL checks remain. No assertions were relaxed to accommodate a failure.

## Validation and evidence

Node **22.23.3**. Focused unit/component regressions passed **154 tests in seven files**, including all six chapters, active incidents, Next/Start test controls, Chapter 4's 4 / 5 baseline state and Chapter 5's actual restoration/4 / 5 state ([unit log](../test-results/guidance-hierarchy-unit-final.log)). Final lint (no warnings), typecheck and production build passed.

The first broad browser run finished with **54 passed / 2 failed** ([diagnostic log](../test-results/guidance-hierarchy-browser.log), native exit code 1). It encountered a suspended room-asset request (`net::ERR_NETWORK_IO_SUSPENDED`) in its initial Opening case, with a 16.5-minute elapsed stall. The other failure was a new test hardcoding “App 1 failed”; the engine's seeded fault actually targeted App 2, and the interface correctly displayed App 2. The test now checks the fault's recorded target and its actual failed health. Both failed traces are preserved in `test-results/guidance-hierarchy/diagnostics/`. Both cases are rerun explicitly rather than ignored or given longer timeouts. An initial test typecheck also caught unsupported `exact` options in Testing Library calls; those test options were corrected before the passing static checks.

The rebuilt final run passed **21 / 21 browser checks**, retries disabled, native exit code 0, in 1.6 minutes ([final browser log](../test-results/guidance-hierarchy-browser-final.log)). It reruns all eleven hierarchy journeys, including all six chapters and the corrected failure-target test, the previously suspended Opening popup case, the unchanged Opening tutorial, mandatory tutorial Run/Confirm guidance and requested ordinary Run attention at 1440/1366/390/320, plus actual touch Hint diagnosis at 390/320. The final build uses the neutral status “Progression decision pending”, which does not imply a disabled decision is ready.

Across the staged runs, **65 distinct browser journeys passed**. The broad run also verified all six valid Confirm cases, mandatory progression and disabled Next explanations, No/manual Hint behavior, incident recovery/postmortems, and Chapter 4/5 final observations and outcome acknowledgements at desktop/mobile widths. This is not a claim that one complete browser-suite invocation passed: the 54/56 diagnostic run and the final 21/21 run are reported separately above. No timeouts, retries or WebGL assertions were weakened.

All screenshot/report links were verified on disk, and desktop/narrow screenshots were visually inspected. `git diff --check` passes; existing Windows line-ending notices remain for previously edited browser files. No changes appear in simulation, store/persistence, backend or shared-contract paths from this follow-up.

Screenshots are local ignored artifacts:

| Chapter | Before Hint | Requested Hint |
| --- | --- | --- |
| 1 | [Facts](../test-results/guidance-hierarchy/chapter-1-facts.png) | [Hint](../test-results/guidance-hierarchy/chapter-1-hint.png) |
| 2 | [Facts](../test-results/guidance-hierarchy/chapter-2-facts.png) | [Hint](../test-results/guidance-hierarchy/chapter-2-hint.png) |
| 3 | [Facts](../test-results/guidance-hierarchy/chapter-3-facts.png) | [Hint](../test-results/guidance-hierarchy/chapter-3-hint.png) |
| 4 | [Facts](../test-results/guidance-hierarchy/chapter-4-facts.png) | [Hint](../test-results/guidance-hierarchy/chapter-4-hint.png) |
| 5 | [Facts](../test-results/guidance-hierarchy/chapter-5-facts.png) | [Hint](../test-results/guidance-hierarchy/chapter-5-hint.png) |
| 6 | [Facts](../test-results/guidance-hierarchy/chapter-6-facts.png) | [Hint](../test-results/guidance-hierarchy/chapter-6-hint.png) |

Chapter 4 at [1366 facts](../test-results/guidance-hierarchy/chapter-4-facts-1366.png) / [requested target](../test-results/guidance-hierarchy/chapter-4-requested-1366.png), [390 facts](../test-results/guidance-hierarchy/chapter-4-facts-390.png) / [requested target](../test-results/guidance-hierarchy/chapter-4-requested-390.png), and [320 facts](../test-results/guidance-hierarchy/chapter-4-facts-320.png) / [requested target](../test-results/guidance-hierarchy/chapter-4-requested-320.png).

This is Chromium desktop/touch-emulation validation, not Safari/Firefox, a physical-device test or a comprehension study. Full frontend coverage, backend tests and hosted CI were not repeated for this presentation-only change.

## Local review

The final production build is available at **http://127.0.0.1:4198/**. Its served index was verified against this worktree's rebuilt `frontend/dist/index.html`.

From `C:\Users\user\99.9-Percent-Latest\frontend`, use Node 22.23.3 and `npm run dev`; open the URL Vite prints (normally `http://localhost:5173/`). For an existing company, keep using the same host/port to access its browser save.

In Chapter 4, compare the stable Goal and factual pulse/stability progress before requesting Hint. At eligible inactivity the existing centered invitation appears. No leaves those facts visible without revealing the solution or repeatedly animating Hint. Manual Hint remains usable afterward; Got it highlights Run if it is the appropriate current action. In Chapter 5 the Start reliability test control and requirements remain visible before asking for help.

No commit, push, PR, merge or deployment was performed. Stop at local review.
