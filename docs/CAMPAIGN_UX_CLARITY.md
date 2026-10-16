# Development A: Campaign interface and tutorial clarity

Branch: `fe/campaign-ux-clarity`.
Worktree: `C:/Users/user/99.9-Percent-Latest/test-results/campaign-ux-clarity`.
Implementation base: `3e89c1f7a17de1dced4c0222b515d1f39bdc2781`, fetched main at the start of implementation.
Publication was authorised after the player reviewed the chapter bar and spotlight tutorial in the browser. Original publication finalisation changed documentation only; the implementation and corrected fixtures remained as locally tested. The CI follow-up below records subsequent test fixes and main integration. Development B was not started. No merge or production deployment is authorised.

## Result

Interview feedback identified excessive chapter-navigation clutter, repeated objectives and too much explanation before the requested action. This change addresses those three issues and clarifies the game-specific response-time target.

- The chapter bar shows the current chapter and one state-derived goal, retaining Next and the existing View chapters interaction. The six-chapter overview and completion states remain in the existing paused modal; Getting started moves there too. On phones the goal wraps and Next takes a full-width row. Disabled Next has a visible, focusable reason associated with the button.
- Only the duplicated generic objective was removed from System Overview. Requirements, pending actions, required reviews, growth readiness, warnings and incident stability remain. Objective text follows incident/review/ended state before the current chapter.
- Campaign tutorial instructions lead, with shorter explanations below. All eight Opening steps, targets, predicates, persisted indices, skip/replay and chapter guides remain. Slow responses and failed requests are described separately; the clock introduction says Run is for after the guide. Health Checks research/deployment targets are unchanged. Classic tutorial copy and ordering remain unchanged.
- At risk says: "Your app is responding too slowly. Keep response time below 500 ms." More details adds: "500 ms is a target for this game, not a rule for every real app." The estimated reading, status precedence and threshold remain unchanged.

There is no diff in simulation, store lifecycle, persistence, purchase confirmation/validation, Finance calculations/components, scene/graphics/walking, backend/shared contracts, dependencies, workflows or deployment settings. The only shared stylesheet addition applies to the new Campaign tutorial explanation class.

## Original publication compatibility review

Final publication review fetched main at `0c2d4f80f27626a3c8ca2224b587ddb5e6373ad7`. PR [#95](https://github.com/CS3216-Final-Project/99.9-Percent/pull/95) is now merged; [#96](https://github.com/CS3216-Final-Project/99.9-Percent/pull/96) and [#97](https://github.com/CS3216-Final-Project/99.9-Percent/pull/97) remain open. Main's #98 walking collision fix is already in this branch's baseline.

A line-ending-normalised three-way rehearsal on ignored copies found no textual conflicts with latest main, #96 at `7f80f603c7cc8cb527db6cce555b1aed165a1760`, or #97 at `e54aad178be2f6b1cf993c0a41def09108fc3c4d`. It preserves main's #95 `selectedInView` tutorial changes, #96's clock hold and revised clock tests, and #97's component-help removal alongside the compact navigation. Source-level inspection is not a combined runtime/build result. Rehearsal files are ignored under `test-results/publication-review/`.

This branch does not independently implement #96's lifecycle. Its step-six instruction matches "After this guide", with the Run instruction at the final step where that PR allows it. No floor/purchase or component-help implementation was copied or replaced. There is no need for a conflict-resolution rebase now. Main is one commit ahead of this baseline, and strict up-to-date checks will require an update before merging; publication does not imply permission to make that update. Recheck the eventual combined result, including clock/skip/replay, floor-switch purchases and help removal.

## PR #100 CI investigation and correction

Original run [38922466800](https://github.com/CS3216-Final-Project/99.9-Percent/actions/runs/38922466800) failed on `e0851bc`. These were missed old-layout assertions introduced by the approved navigation change, not evidence of broken progression or a dependency/environment failure:

| Job | Exact failures and error | Root cause / correction |
| --- | --- | --- |
| `frontend-checks`, `npm run test:coverage` | Two cases each in `CombinedUI.test.tsx` and `SpikeUI.test.tsx`: `Unable to find an accessible element with the role "list" and name "Chapter progress"` | Completion/availability now lives in View chapters. Open the actual overview, read the same status assertions and return before continuing. |
| `frontend-browser (2)` | Both `data strategy: cache/database, continuity and reload` and `spikes: explicit continuation, delayed autoscaling, retirement and reload without API`: `element(s) not found`, expecting `Available next` in `Chapter progress` | Inspect availability through View chapters, retaining its status assertion and checking restored focus. Data Strategy's entry/reload assertions now check the compact current-chapter heading and exact goal instead of the deliberately removed `Current stage` callout. |
| Required `frontend` gate | `Frontend checks: failure; browser journeys: failure` | Consequence of the two failed jobs above, not another defect. |

Original full coverage: 1,046 passed, four failed, one optional skip. Browser shard 2: 37 passed, three failed (also failed on hosted retries). Backend and browser shards 1/3 passed. No original job remained pending, cancelled or skipped. The optional trace test is distinct from a skipped CI job. Branch status `BEHIND` was a separate strict up-to-date merge restriction.

Downloaded shard-2 logs, error contexts, screenshots and trace events confirm that the compact bar and Next were present while the assertions waited for the removed list. Local unchanged reproduction produced the same four failures (four other tests passed) and the same three browser failures with `CI=true`, actual Chromium WebGL and retries disabled.

Latest fetched main `0c2d4f8` was integrated once in feature-branch merge `66d8ad9`, without conflicts or rewritten published history. Backup `fe/campaign-ux-clarity-backup-e0851bc` retains the original head. This is not a merge of PR #100. PR #95's purchase/floor changes and Classic `selectedInView` tutorial behavior remain intact; #96/#97 remain open. No competing clock lifecycle or help-removal implementation was added. Against updated main, simulation, store, save formats, purchase implementation, floor helpers, Classic implementation, backend, dependencies and workflows have no diff.

The regression fix changes only `frontend/src/components/CombinedUI.test.tsx`, `frontend/src/components/SpikeUI.test.tsx`, `frontend/e2e/dataStrategy.spec.ts`, `frontend/e2e/spikes.spec.ts` and this report. No fixture, timeout, test budget, engine rule or runtime UI was changed to obtain passing results. These four test paths extend the original 21-file PR scope to 25 files.

Node 22.23.3 post-integration validation: the two failed component files passed all eight tests; focused coverage then passed 172 tests across 14 files with no failures/skips (the original ten focused files plus CombinedUI, SpikeUI, SidePanel and game/floors). The three failed browser journeys each passed twice (six passes), with `CI=true` and `--retries=0`. Lint, typecheck and production build passed. All ten nearby browsers passed without retries: Opening keyboard/inspection/purchase/replay, chapter entry, Health Checks Tech/deploy, Health/Finance spotlight coexistence, Classic tutorial/purchase/reload, touch chapter overview, touch Finance and complete 390px/320px walkthroughs. Full suites were not repeated locally; hosted CI must verify the exact pushed result, including backend. Backend files were unaffected, so no redundant local backend run was added.

Ignored evidence is under `test-results/ci-fix/`: original logs and hosted shard-2 artifacts; `unit-before.log`, `browser-before.log` and their diagnostic artifacts; `unit-fixed.log`, `focused-coverage.log`, static/build logs, `reproduction-fixed.log`/report/artifacts and `nearby-browser.log`/report/artifacts. The coverage directory now represents the focused run, not full-suite coverage.

## Original implementation validation

All check entry points explicitly used Node 22.23.3. Dependencies were installed separately in this frontend with `npm ci`; package files are unchanged.

| Check | Result |
| --- | --- |
| Stage A1 chapters, completion, Campaign UI and guidance | 64 tests passed across four files |
| Stage A1 desktop/laptop/touch chapter browsers | Seven passed, retries disabled |
| Stage A2 tutorial, purchase refinement and lifecycle | 51 tests passed across three files |
| Stage A2 Opening/reload/replay, chapter guide, Health Checks, Finance overlays, touch purchase and Classic smoke | Nine browsers passed, retries disabled |
| Stage A3 Health status/boundaries/component and Finance | 39 tests passed across three files |
| Final lint, typecheck, production build | Passed; lint also passed after the final test edits |
| Final focused browser batch | 16 passed, one new disabled-Next fixture failure |
| Corrected fixture plus complete 390px/320px touch walkthroughs | All three passed without retries |

Exact unit files (154 passing tests across ten files):

- A1: `components/CampaignChapters.test.tsx`, `components/ChapterComplete.test.tsx`, `components/CampaignUI.test.tsx`, `game/campaignGuidance.test.ts`.
- A2: `components/CampaignTutorial.test.tsx`, `components/CampaignRefinement.test.tsx`, `game/phase2.test.ts`.
- A3: `game/campaignAppHealth.test.ts`, `components/CampaignAppHealth.test.tsx`, `components/CampaignFinance.test.tsx`.

Paths above are under `frontend/src/`. Browser selections under `frontend/e2e/` were: `chapters.spec.ts` (chapter layout/overview/entry/completion and corrected disabled Next); `campaignTutorial.spec.ts` (Opening, reload, replay/skip and Scaling guide); `financeIntegration.spec.ts` (spotlight overlay/focus); `actionPopover.spec.ts` (Health Checks guide and 1440/1366 purchase layouts); `classic.spec.ts` (first-week tutorial/purchase/reload); `appHealth.spec.ts` (both desktop sizes, spotlight and incident); `combined.spec.ts` (entry/promotion/reload and final review/replay); and selected `mobile.spec.ts` chapter, Finance/Health, Cash-margin, purchase-sheet/keyboard and walkthrough journeys. These are selected journeys, not complete runs of those browser files. All used `--retries=0`.

The initial chapter tests intentionally failed before implementation. An initial A1 build caught a now-unused type import after moving the objective; it was removed and the build passed.

The final browser batch's failure was a test-authoring mistake: a pending traffic-limit action does not make `canEnterReliability()` false, so Next correctly remained enabled. The corrected fixture routes traffic to one app and advances one ordinary engine step, producing a replayable management state with waiting work. It explicitly verifies engine ineligibility before seeding the save. The unchanged disabled-button, accessible-description and keyboard-focus assertions then passed. No runtime fix, timeout increase, forced click, retry or weakened assertion was used. The failed batch is retained and is not relabeled green; only this fixture and explicit viewport coverage changed afterward.

Coverage includes all six chapters in the overview, same-company entry and completion/review/replay, Next present/absent/disabled, keyboard Enter/Space/Escape and focus restoration, touch, Finance/Health/spotlight coexistence, live inspections, desktop/laptop purchase bounds/highlighting, mobile purchase controls and keyboard scrolling. Screens were reviewed at 1440x900, 1366x768, 390x844 and 320x844. The default Health dashboard remains compact; its extra explanation starts collapsed. At 320px the existing metric tiles have text/icon crowding also visible in the baseline; that unrelated header layout was not redesigned.

Full frontend/backend coverage, balance and the complete browser suite were not run for this presentation-only local task. No hosted CI, combined-open-PR, Safari/Firefox, physical-device or human comprehension result is claimed. The user approved publication using these focused results without repeating lengthy local suites. Required hosted frontend/backend checks, an up-to-date branch and one reviewer approval remain necessary before merge. GitHub currently enforces the two strict required checks; the one-reviewer requirement is also retained by repository instructions.

## Evidence and preservation

Ignored screenshots: `test-results/review-screenshots/`. Examples:

- Desktop chapter bar: [before](../test-results/review-screenshots/clarity-before-1440-next-false.png), [after](../test-results/review-screenshots/clarity-after-1440-next-false.png).
- Narrow chapter bar with Next: [before](../test-results/review-screenshots/clarity-before-320-next-true.png), [after](../test-results/review-screenshots/clarity-after-320-next-true.png). Baseline captures use a resized desktop context; after captures also exercise Chromium touch emulation.
- Desktop instruction order: [before](../test-results/review-screenshots/campaign-tutorial-system.png), [after](../test-results/review-screenshots/after-campaign-tutorial-system.png). These were captured around Stage A2 after the chapter-bar change.
- [320px touch instruction](../test-results/review-screenshots/clarity-tutorial-320-first.png), [390px touch purchase/tutorial](../test-results/review-screenshots/clarity-tutorial-390-purchase.png).
- [Laptop Health dashboard](../test-results/review-screenshots/final-app-health-1366-default.png), [touch More details](../test-results/review-screenshots/final-app-health-390-details.png).

Logs are ignored under `frontend/`: `chapter-unit.log`, `chapter-browser.log`, `tutorial-unit.log`, `tutorial-browser.log`, `health-unit.log`, `clarity-{lint,typecheck,build}.log`, `clarity-final-browser.log`, `clarity-completion-browser.log`. Reports are separate under `test-results/{chapter-report,tutorial-report,final-report,completion-report}/`. The failed batch's original screenshot, error context and trace are preserved under `test-results/final-artifacts/`.

The original Finance worktree remains at `806cd3a`, with all 17 snapshot hashes and its saved Git status matching. Health remains clean at `215d841`, refinement clean at `f34870c`, and Finance integration clean at `c4009d5`. No files in those worktrees were edited.

## Original implementation files (21)

Runtime, under `frontend/src/`:
`components/CampaignChapters.tsx`, `components/CampaignChapters.css`, `components/CampaignUI.tsx`, `components/Tutorial.tsx`, `components/CampaignAppHealth.tsx`, `game/campaignGuidance.ts`, `game/campaignAppHealth.ts`, `index.css`.

Tests, under `frontend/`:
`src/components/CampaignChapters.test.tsx`, `src/components/CampaignUI.test.tsx`, `src/components/CampaignTutorial.test.tsx`, `src/components/CampaignAppHealth.test.tsx`, `src/game/campaignGuidance.test.ts`, `src/game/campaignAppHealth.test.ts`, `e2e/chapters.spec.ts`, `e2e/combined.spec.ts`, `e2e/campaignTutorial.spec.ts`, `e2e/mobile.spec.ts`, `e2e/appHealth.ts`.

Documentation: `docs/UI_DESIGN.md` and this report.

## Local preview

Use this worktree's existing production build in PowerShell:

```powershell
cd C:\Users\user\99.9-Percent-Latest\test-results\campaign-ux-clarity\frontend
$devNode = 'C:\Users\user\AppData\Local\npm-cache\_npx\52027bd8fc0022aa\node_modules\node\bin\node.exe'
& $devNode node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4202 --strictPort
```

Open http://127.0.0.1:4202 and start Guided Mode. To review the Opening again, use Menu > How to play. Existing saves on other ports are separate.
