# Campaign Git integration audit

## PR #119 browser CI correction

The original published head was `dae2a844e7d6cf06b49636081d6c2a3d281a2499`, containing implementation `ac92e90` and this audit. Direct inspection of [CI run 39124583467](https://github.com/CS3216-Final-Project/99.9-Percent/actions/runs/39124583467) found two failing browser jobs. Static checks/coverage, balance, backend and eight browser shards passed. The required `frontend` aggregate failed because its browser dependency failed. Main remained `5cd86d3d6548dfcd99ab44c9978eacc085f3677f`; the PR was mergeable, with no reviews or review threads.

| Failed job / case | Exact failure and evidence | Classification and correction |
| --- | --- | --- |
| `frontend-browser (10)` / `inspects evidence and advances a physical step on touch` (`mobile.spec.ts`) | `Test timeout of 60000ms exceeded`; Monitoring tap repeatedly intercepted by `.modal-backdrop` containing the legitimate Hint offer. Both CI attempts failed. Capturing the software-rendered room took 7.2 / 11.3 seconds. | Test fixture defect exposed by CI rendering cost: inactivity can reach 15 seconds while capturing the room. Freeze the clock after capture, assert the offer, decline through No and verify the entire saved company is unchanged before tapping Monitoring. Preserve exact step advancement, mute, dock, History and overflow assertions. |
| `frontend-browser (1)` / `Development B: touch guidance at 390` (`guidanceRewards.ts`, `fixtures.ts:completeTutorial`) | `Step timeout of 180000ms exceeded`; `locator.tap: Test ended` on tutorial Next. Both attempts steadily advanced through lessons rather than sticking at one gate. Completed taps: 35 / 34; total tap cost 179.8 / 182.5 seconds; median 5.1 / 5.3 seconds. | Test clock/software-rendering setup cost. Keep all 21 real lessons and touch input on native frames; install the controlled clock before reloading the preserved company for the spotlight checks. Move the unchanged timed onboarding Hint/clock-hold assertions into four focused viewport cases. No timeout, retry or assertion budget increases. |

The unchanged failing cases were first run locally with Node 22.23.3, locked Playwright 1.63.0, CI flags/retry policy, one worker, production preview and real SwiftShader WebGL. Both passed (170.65 seconds overall); the 390px case took approximately 2.5 minutes. The Ubuntu failures did not reproduce on this Windows host. With native frames, a measured complete 390px onboarding setup took 19.07 seconds; its subsequent successful complete journey took 17.9 seconds in another context.

Local diagnostics also exposed independent host suspension: a one-second parent-process heartbeat recorded a 432,815ms gap while an external 20-second wait took 436 seconds. A previous attempt stalled 268 seconds during reload. These failed/flaky attempts remain in ignored diagnostics and are not reported as clean batches. An experimental blank-document navigation produced a fixture storage-access error and was discarded. No application error was suppressed and no retry policy was changed.

The correction changes browser tests and documentation only. All application, simulation, financial/progression, save, backend/shared, dependency, workflow and deployment files remain identical to the published PR. Main's ruleset requires `frontend` and `backend` with strict up-to-date checks; repository instructions continue to call for reviewer approval. Nothing authorizes merging or manual deployment.

The corrective commit is limited to `frontend/e2e/guidanceRewards.ts`, `frontend/e2e/guidanceRewards.spec.ts`, `frontend/e2e/mobile.spec.ts`, `docs/testing.md` and this audit. The original 47-path staging inventory below records the initial publication; the correction also touches the existing testing guide, giving 48 distinct paths in the resulting PR. All diagnostic scripts, logs, traces, screenshots, browser reports and generated output remain ignored.

Validation commands use Node 22 and `PLAYWRIGHT_PORT=4197`. Browser commands retain `CI=true`, the repository's single worker, one diagnostic retry and fail-on-flaky policy. The two initial nine-case correction batches each had eight passing cases and one flaky case; neither batch passed. The first stalled 268 seconds during reload; the second coincided with the independently measured 433-second parent-process pause. All nine distinct cases have passing observations across these attempts. The discarded blank-document experiment was interrupted after its fixture error. A fresh relevant browser batch then passed all **40 cases**, with zero retries, flaky cases, failures or skips (863.08 seconds; results below).

A concurrent local unit attempt was stopped after `CampaignTutorial.test.tsx` reported eight failures in 97.52 seconds (the same unchanged 23-test file passed original Ubuntu CI in 16.58 seconds); the fresh serial run then passed all **63 tests** across CampaignTutorial, CampaignUI and ChapterHints in **93.60 seconds**, including all 23 tutorial tests. No unit test or application source was edited during this investigation.

| Correction validation | Result |
| --- | --- |
| Frontend lint, typecheck, production build | Passed on Node 22.23.3. |
| Serial component tests | **63 passed** in three files, 93.60 seconds, no skips or retries. No browser run overlapped this verification. |
| CI shard-planner unit tests | Three passed; complete current browser inventory is **232 cases**, including four new timed onboarding cases. |
| Relevant CI-policy browser regressions | **40 passed**, 863.08 seconds, zero retries/flaky cases/skips. Both originally failing cases passed. Includes all automatic Hint journeys, all chapter hierarchies, practice replay/reload, complete Chapter 0, Classic tutorial/purchases/reload and four dock spotlight widths. |
| Backend/shared | No changes; original required backend check passed. The new commit will receive fresh required GitHub checks. |
| Git / scope | Whitespace check passed; no runtime, lockfile or workflow changes. Diagnostic outputs are ignored. |

Exact clean browser command (from `frontend/`, Node 22, `CI=true`, `PLAYWRIGHT_PORT=4197`):

```powershell
node node_modules/@playwright/test/cli.js test automaticHints.spec.ts guidanceHierarchy.spec.ts campaignTutorial.spec.ts guidanceRewards.spec.ts mobile.spec.ts classic.spec.ts --grep 'Automatic Hint:|Guidance hierarchy:|Spotlight refinement: live incident Pause and Confirm priority|Chapter 0 requires real game interactions|A completed player.s Chapter 0 replay resumes|inspects evidence and advances a physical step on touch|Development B: touch guidance at 390|completes the first-week tutorial' --output=../test-results/pr119-ci/related-artifacts
```

Serial component command: `node node_modules/vitest/vitest.mjs run src/components/CampaignTutorial.test.tsx src/components/CampaignUI.test.tsx src/components/ChapterHints.test.tsx --maxWorkers=1`.

The local monitor wraps that unchanged CLI command only to record parent-process timer gaps; it does not alter the browser or application. Optional account-proxy connection refusals and color/deprecation warnings also appeared in passing cases; they were not the failing checks. Browser coverage remains Chromium desktop/touch emulation; real devices, Safari/Firefox and live-provider acceptance remain outside these checks. GitHub CI must pass on the new exact pushed head; follow PR #119's current checks for publication readiness. The earlier full sweeps and corrective-run counts below remain historical, without a claim of one green batch.

## Clean final refresh onto `5cd86d3`

The publication-time fetch found two further main commits: `8e386a5` (#116, Chapter 0 focus animation and Menu/Return-to-game refinements) and `5cd86d3d6548dfcd99ab44c9978eacc085f3677f` (#117, remove the duplicate guide exit button). Nine upstream paths changed. Read-only previews found two overlapping files, `CampaignUI.tsx` and `mobile.spec.ts`, merging cleanly with **no conflict blocks**. No simulation, financial/progression, save, backend/shared or dependency change appeared. This did not trigger the user's significant-conflict approval boundary.

The two approved commits had already been created locally and verified against the 47-path inventory. Before rebasing, their hashes and all 47 Git blob IDs were recorded under the ignored `test-results/integration-audit/submission-before-5cd86d3.json`. Rebase completed without conflict. `git range-diff` marks **both patches identical** before/after the rebase; the feature patch introduces no additional adaptation. Preserve native focus animation with reduced-motion support, Menu access at every lesson, practice Return to game, Menu-based Save and exit and quote clearance. Development B's Hint and attention guards remain intact.

Backend and shared Git tree IDs match the already-tested `48af47e` trees exactly; the 61 backend tests and static/build/migration results below remain applicable to identical source. The prior full browser sweep and its two corrections remain results on `48af47e`; they are not relabeled as a full sweep on the newer target.

| Verification on `5cd86d3` | Result |
| --- | --- |
| Frontend lint, typecheck, build | Passed with Node 22.23.3. |
| Frontend upstream CI coverage selection | **1,179 passed**, one existing opt-in diagnostic skipped, 104 passed files / one skipped file, **305.84 seconds**, exit 0. Same exclusion/one-worker command as the preceding snapshot, report directory `post-refresh-coverage`. Six exhaustive bounds cases already passed on the identical simulation source. |
| Relevant browser regressions | **20 passed**, 7.7 minutes, zero retries/skips/failures. |
| Backend/shared | Trees identical to the tested snapshot; **61 backend tests** plus static/build/migration checks remain applicable. |

The focused browser set covers the changed Menu/Return/Save-and-exit behavior, practice company restoration after reload, read-only quote recovery, complete Chapter 0 and final clock hold, all four guide layouts, Hint coexistence and desktop/390px/320px dock priorities. Exact command, from frontend with `PLAYWRIGHT_PORT=4197`:

```powershell
$pattern='A saved Chapter 0 replay resumes|A completed player.s Chapter 0 replay resumes|Cancel lesson restores|Chapter 0 requires real game interactions|Back and Save and exit|Chapter 0 keeps guidance fixed|Development B: contextual Run and Confirm at 1440|Spotlight refinement: live incident Pause and Confirm priority at (1440|390|320)$|Chapter 0 practice stays visible|Development B: touch guidance at 320$|resumed incident permits help|active investigation and Finance'
node node_modules/@playwright/test/cli.js test campaignTutorial.spec.ts chapterZeroLayout.spec.ts guidanceRewards.spec.ts automaticHints.spec.ts mobile.spec.ts --grep $pattern --retries=0 --output=../test-results/integration-audit/post-refresh-browser-artifacts
```

Machine-readable results confirm all 20 passed and all 42 current code/test/helper hashes remain unchanged since validation began. The latest target has **focused 20-case verification**, supplemented by the preceding 228 distinct journeys verified across runs on `48af47e`; this is **not a claim of a new full 228-case sweep on `5cd86d3`**. GitHub CI runs the complete inventory on the published head.

The documentation commit is amended to record this refresh and its validation while retaining the approved two commits and 47-path inventory. The Development B feature patch remains identical. The user's development server remains restored at `http://localhost:5173/` (expected game entry, HTTP 200); the isolated audit preview was stopped after tests completed. Other worktrees remain untouched. Publication uses a normal push after another fresh main comparison; no force-push, main merge or manual deployment is authorized.

## Validated interactive Chapter 0 integration on `48af47e` (preceding snapshot)

The user approved resolving the ten overlapping files while preserving both implementations, followed by the two documented commits, a normal feature-branch push and a PR targeting main. This approval does not authorize force-pushing, merging or manual deployment. The existing feature branch was rebased onto `48af47e928f61c08702944c919c77f5a0f39a4ad`, then the protected Development B changes were reapplied. All 47 files were archived and their raw SHA-256 hashes verified under the ignored `test-results/integration-audit/interactive-integration/` directory before integration. No other worktree was modified.

Keep upstream interactive Chapter 0, its separate practice-company persistence and real-company restoration, tutorial clock hold, consolidated bottom dock and Warm Desk design. The native Chapter 0 controls own tutorial attention; optional Development B Hint offers and contextual cues yield to its visible guide. The read-only purchase lesson retains a disabled Confirm and cannot spend cash. The bounded tutorial Run exercise remains available; the final lesson holds the clock until Finish. Hidden legacy tutorial state during a resumed incident still permits manual incident Hint without granting unsolicited Run guidance.

Chapters 1-6 retain educational Goal, factual situation and measured requirements/progress, requested button-level Hint, centered automatic Yes/No offers, per-stage dismissal, gold Run/Pause/Confirm attention, recovery acknowledgement and preparation evidence. Existing chapter predicates, simulation/financial rules and save schemas are unchanged relative to the included main commit. Upstream tutorial/practice store and persistence implementations, Classic rules, backend/shared contracts, dependencies and workflows are retained unchanged.

### Investigation of earlier timeouts

- Two earlier spike journeys were blocked by a genuine test-fixture interaction: positioning the public browser clock by 60 seconds correctly opened the inactivity Hint offer, then the fixture tried to navigate through it. The helper now checks that the paused saved company is unchanged, chooses the visible No button and verifies closure. It does not force clicks, suppress the offer or alter application timing. Both journeys passed their former modal obstruction; the manual-planning journey completed, while explicit continuation later encountered the separate host delay described below.
- The third earlier timeout stalled during initial browser/room setup amid long host delays. Its unchanged planned-capacity journey subsequently passed in 8.0 seconds in the focused run, then 5.6 seconds in the fresh full-suite run.
- A subsequent explicit-continuation attempt passed the former modal obstruction but encountered a roughly 162-second gap waiting for a visible Run button to become stable. Its trace contains no modal interception during that wait. That focused batch finished seven passed / one failed. In the fresh full-suite run, the unchanged explicit-continuation journey passed in 43.7 seconds; manual planning and planned capacity also passed in 18.3 and 5.6 seconds. Assertion limits and retry policy remain intact. The original two modal obstructions were test-setup defects; the initial room stall and later Run wait are consistent with host/browser delays. No application regression was reproduced.
- Running coverage alongside software WebGL produced Combined UI timeouts. All five Combined UI tests passed unchanged in isolation; full coverage was restarted without a browser workload. The first isolated restart encountered a stale coverage lock from the stopped attempt, so the final run uses a separate ignored report directory.

### Validation of the combined code

Node 22.23.3; frontend and backend lint, typecheck and builds passed. Backend full coverage passed **61 tests in 10 files**. Migration generation found no schema changes; no migration was generated or applied. The upstream browser-shard helper tests passed all three checks.

Final frontend CI coverage selection passed **1,178 tests**, one existing opt-in diagnostic skipped, 104 passed files / one skipped file, **344.39 seconds**, exit 0. This is the upstream CI command with one local worker and a separate ignored report directory:

```powershell
npm run test:coverage -- --exclude=src/sim/__tests__/balanceBounds*.test.ts --maxWorkers=1 --coverage.reportsDirectory=../test-results/integration-audit/interactive-ci-coverage
```

The six exhaustive bounds cases excluded from CI coverage passed in both preceding full attempts; no simulation test was removed or altered. Final coverage: statements 87.97%, branches 85.92%, functions 90.94%, lines 89.88%. These percentages do not establish visual quality or human learning.

Frontend default full coverage attempts are reported separately rather than called one green batch:

| Attempt | Result |
| --- | --- |
| Isolated full coverage, `interactive-frontend-coverage-final.log` | **1,170 passed / one existing diagnostic skipped**, plus a worker startup timeout before `openingPrevention.test.ts` could execute. Exit 1. |
| Unchanged prevention file with coverage, `interactive-opening-coverage.log` | **14 passed**, 2.37 seconds. |
| Full rerun, `interactive-frontend-coverage-complete.log` | **1,183 passed / one failed / one existing skip**, 479.71 seconds. The unchanged Chapter 4 display case exceeded its existing five-second timeout, taking 32.2 seconds. No changed-value assertion failed. Exit 1. |
| Unchanged chapter-display file with coverage, `interactive-chapters-coverage.log` | **10 passed**, 4.78 seconds for the entire file. |

All **1,184 active frontend tests have passing verification across these runs**; neither full coverage attempt was completely green. The focused interactive tutorial, practice isolation, controls and Hint tests also passed. The working source did not change between these attempts or their reproductions. Host delays are supported by the isolated results and trace gaps; GitHub CI must independently run the required checks on the published commit.

The complete current browser suite selects **228 desktop/touch journeys** with one worker and retries zero:

```powershell
$env:PLAYWRIGHT_PORT='4197'
node node_modules/@playwright/test/cli.js test --retries=0 --output=../test-results/integration-audit/interactive-full-browser-artifacts
```

The full current sweep completed **226 passed / two failed**, 47.7 minutes, retries zero, no skips. The two failures were:

| Case | Diagnosis and correction | Fresh result |
| --- | --- | --- |
| Opening prevention | The 60-second clock-positioning jump opened the expected Hint offer, which intercepted the Time menu. Add the existing public No-dismissal helper immediately after positioning. It asserts the entire paused saved company is unchanged. Retain all actual recovery/prevention gates, step counts, acknowledgements, locked-Scaling and reload assertions. | Passed in **10.1 seconds**. |
| Development B touch guidance at 390px | A trace contains a **297.6-second gap** waiting for a tutorial button to become stable; an independent requested 40-second tool wait took **315.5 seconds** in the same interval. This exhausted the existing onboarding setup budget. No application or test change for this failure. | Unchanged case passed in **1.8 minutes**. |

The fresh corrective command selected exactly those two failures and finished **two passed**, 2.0 minutes, retries zero:

```powershell
node node_modules/@playwright/test/cli.js test prevention.spec.ts mobile.spec.ts --grep 'Opening prevention: fresh player|Development B: touch guidance at 390$' --retries=0 --output=../test-results/integration-audit/interactive-browser-corrections-artifacts
```

Machine-readable full/corrective reports were compared by project, file and title: the corrective set equals the two failures exactly. All **228 distinct current desktop/touch journeys have passing verification across runs**, rather than one green 228-case batch. This includes all interactive Chapter 0 lessons and practice return/resume/exit, four guide layouts, keyboard and touch walkthroughs, tutorial clock hold, Classic/saves, all six chapters, Hint offers/No/manual access, Run/Pause/Confirm priorities, recovery, preparation and Chapter 4/5 measured observations.

Runtime source did not change after the full sweep. Only the two-line Opening-prevention fixture correction followed it; the fresh case preserved all behavioral assertions. Final lint/typecheck/build and CI coverage selection follow that correction. The original failed reports, screenshots and traces remain ignored locally; no automatic retry, forced click, new skip or weakened assertion was introduced.

Current desktop/phone captures were reviewed: Warm Desk Goal/status separation, Chapter 4 factual pulse and stability counters, requested gold Run at 320px, protected Chapter 0 practice at 390px, and valid real Confirm. Four current review copies use the `interactive-` prefix under the ignored `test-results/integration-audit/reviewer-screenshots/` directory. They are not included in Git or uploaded as inline PR attachments.

All 47 approved paths remain the explicit staging boundary. Generated outputs, logs, coverage, images, traces, archives and local scripts are excluded. The approved two-commit split is 42 code/tests/helpers followed by five reports. All four other worktrees were checked again: clean and untouched. The temporarily stopped Node 22 development server is restored at `http://localhost:5173/`, verified HTTP 200 with this game's Vite entry. Publication still requires a fresh main comparison; any new significant conflict requires approval before integration. GitHub CI must run on the exact published head; local results do not substitute for the required frontend/backend gates or teammate approval.

The earlier 189-pass/seven-failure full sweep and corrective verification of all 196 distinct journeys are historical results, retained below. They are not a claim of one green sweep or current-target coverage.

## Earlier approval stop before integrating `48af47e` (historical)

On resuming October 18, `git fetch origin main` found six further commits after `3df51aa`; `origin/main` is now `48af47e928f61c08702944c919c77f5a0f39a4ad`. They include CI setup/shard changes and a redesigned interactive Chapter 0 with separate practice-company replay, resume, exit and restart behavior. The feature branch remains at `3df51aa`; these newer commits have **not** been integrated.

Read-only previews identified **10 conflicting paths / 16 blocks**: `combined.spec.ts`, `fixtures.ts`, `gameplay.spec.ts`, `guardrail.spec.ts`, `mobile.spec.ts`, `scaling.spec.ts`, `CampaignAction.tsx`, `CampaignUI.test.tsx`, `CampaignUI.tsx` and `campaignChapters.ts`. Eleven other overlapping tracked files merged cleanly in previews, and there was no untracked-file collision. Evidence is retained under the ignored `test-results/integration-audit/resume-main-preview/` directory. This triggers the user's explicit instruction to stop and ask before another significant conflict is resolved.

All **47 intended paths remain unstaged**, and all **42 code/test/helper raw hashes** still match the source used for validation. No commits, pushes or PR were created. The old-target browser run and isolated preview were stopped; the user's development server remains available at `http://localhost:5173/` (HTTP 200).

The completed checks below apply to `3df51aa`: **1,148 frontend tests passed** (one existing opt-in diagnostic skip), **61 backend tests passed**, and both packages' lint/typecheck/build plus migration consistency passed. The interrupted selected browser attempt recorded **99 passes**, with three preceding timeout cases and the remaining run interrupted; this is **not** a completed 140-case sweep. Two spike-case traces show a Hint-offer modal intercepting navigation after clock positioning, so those test journeys still need public No-dismissal handling. Another spike case stalled during initial browser/room setup amid long host delays. These failures remain recorded and must not be counted as passing verification.

Proposed next step, pending approval: preserve the upstream interactive Chapter 0 and its separate practice-company persistence, retain all Development B guidance and cue priorities, resolve the ten overlapping files without changing company save schemas or simulation/financial/chapter rules, adapt the affected browser journeys, rerun relevant checks, and resume the already approved two-commit / normal-push / PR submission. The earlier 189/7 full sweep and its corrective verification remain historical results, as described below.

## Latest submission preparation on `3df51aa`

**Historical integration snapshot; superseded by the resume status above.** Integration on this target completed, but browser validation was interrupted and the branch is now behind newer main commits. The sections for `d17db06` and `9ce8565` below also retain historical results.

A subsequent refresh found `5c6112a` (Warm Desk visual direction, PR #108) and `3df51aa` (fetch/rebase instructions, PR #109). Read-only, line-ending-normalized previews found three overlapping pending files (`CampaignAction.tsx`, `CampaignUI.tsx`, `mobile.spec.ts`), all merging cleanly, and no untracked-file collision. Semantic review retained both the upstream scrollable purchase-preview body and Development B's quote validation, Confirm cue and confirmation observer; there was no additional significant conflict or gameplay change requiring a stop.

All 47 pending paths were archived and their raw hashes verified again under the ignored `test-results/integration-audit/warm-desk-integration/` directory. The existing feature branch advanced to `3df51aa3d4e409e53d9c0dd78ef60d99fb099d68` using `git rebase origin/main` before reapplying the clean combined files. There were still no local feature commits or published feature branch. No other worktree was modified.

Keep the consolidated bottom dock, Warm Desk surfaces and icons, Time/Navigation controls, public clock fixture and scrollable purchase preview. Development B retains the educational Goal, factual situation/progress, requested Hint, automatic Yes/No offer, No dismissal, gold Run/Pause/Confirm cues, recovery/preparation explanations and Chapter 0 compatibility. Only three of the 14 approved runtime files need upstream presentation adaptation relative to the original approved snapshot: `CampaignAction.tsx`, `CampaignUI.tsx` and `campaignGuidance.ts`; the other 11 remain unchanged after newline normalization.

The upstream Lucide dependency replacement is retained verbatim; frontend `npm ci` completed using Node 22. Both packages' checks are rerun below. The development server was restored at `http://localhost:5173/`. The final selected browser run uses an isolated Node 22 production preview at port 4197.

| Latest verification | Result |
| --- | --- |
| Frontend lint, typecheck, production build | Passed on the latest target. |
| Frontend full coverage | **1,148 passed**, one existing opt-in diagnostic skipped; 103 passed files / one skipped file, 471.16 seconds. |
| Backend lint, typecheck, build, full coverage | Passed; **61 tests** in 10 files. |
| Migration consistency | No schema change, no generated migration, no migration applied. |
| Selected browser regressions | Interrupted: 99 recorded passes, three preceding timeouts; remaining cases were not completed. See the resume status above. |

Selected browser command (from `frontend/`, Node 22, `PLAYWRIGHT_PORT=4197`, one worker):

```powershell
node node_modules/@playwright/test/cli.js test controls.spec.ts clock.spec.ts warmDesk.spec.ts actionPopover.spec.ts automaticHints.spec.ts chapterHints.spec.ts guidanceHierarchy.spec.ts guidanceRewards.spec.ts learningGuidance.spec.ts gameplay.spec.ts mobile.spec.ts combined.spec.ts spikes.spec.ts --retries=0 --output=../test-results/integration-audit/latest-browser-artifacts
```

This selects **140 journeys in 13 files**, including purchase layout and Warm Desk navigation in addition to the earlier Campaign/dock regressions. Earlier `d17db06` browser attempts were stopped when the next main refresh required a new production build; they are diagnostics, not a complete current-target sweep. One earlier 390px dock timeout coincided with a host stall: all layout assertions passed, then a viewport-width read returning the correct value took about 728 seconds; a requested 45-second tool wait also took about 731 seconds. The test and its existing timeout remain unchanged; the latest selection includes the same 390px dock case again.

The original complete browser sweep remains **189 passed / seven failed**. Fresh corrective runs provided passing verification for all **196 distinct earlier journeys across runs**, not one completely green full sweep. Current-target results are recorded separately above. GitHub CI must still run the full latest inventory and required `frontend` / `backend` gates on the submitted commit.

The approved staging inventory remains exactly **47 paths**, with the same two approved commit subjects and 42/5 path split. Generated outputs, logs, screenshots, traces, local backup archives and temporary scripts stay ignored. Simulation, financial/progression rules, save schemas, backend/shared contracts, dependencies and workflow files match the latest target; upstream presentation/dependency changes are part of `main`, not extra Development B changes. The user's normal-push-only restriction takes precedence over the new repository instruction's conditional force-with-lease guidance. No force push, main merge or manual deployment is authorized.

Review attention remains narrow-layout menu/modal/spotlight clearance, Chapter 0/guidance coexistence, and Chromium-only emulation limits. Inline PR screenshots are not attached; local screenshots are reviewed and CI retains browser artifacts. Existing dependency advisories, real Google/Neon acceptance and human-learning limits remain documented in the historical audit.

## Earlier submission integration on `d17db06`

**Historical pre-publication snapshot.** This section records the first approved submission integration. Later main changes and their verification are recorded above. The user approved the two commits, normal feature-branch push and PR creation.

- Feature branch: `fe/campaign-guidance-rewards`; target: `main`. Refresh found `d17db06a21e0913aa735549c960887a923e1465d`, PR #103, consolidating the bottom controls. Work stopped before integration, and the user explicitly approved combining it with Development B.
- Read-only previews normalized line endings and found six conflicting files with 13 blocks: `CampaignUI.tsx`, `Tooltip.test.tsx`, `combined.spec.ts`, `gameplay.spec.ts`, `mobile.spec.ts` and `spikes.spec.ts`. Ten other overlapping tracked paths merged cleanly. All 47 current source/test/report files were archived and their raw SHA-256 hashes verified before the fast-forward; the ignored snapshot is `test-results/integration-audit/controls-integration/before-integration.zip` with its manifest beside it. The original external recovery archive remains intact.
- The feature branch was fast-forwarded, and the combined files reapplied. Keep #103's `RoomControlsSlot`, Time menu, fixed-footprint Run/Pause, dock layout, hidden clock status and room/camera controls. Attach the existing requested-Hint/tutorial Run cue and investigation Pause cue to that same Run/Pause button. Keep the confirmation observer, shared Chapter 0 last-lesson guard and incident explanation in its tooltip.
- Production comparison against the approved 47-file snapshot found only two adapted runtime files: `CampaignUI.tsx` for those controls and `campaignGuidance.ts` for upstream removal of obsolete Advance-button references. The other 12 approved runtime files are unchanged after line-ending normalization. Goal/Progress/Hint, automatic/manual/declined Hint, recovery/preparation evidence and Chapter 0 compatibility remain present.
- Tests preserve #103's public Run/Pause and Time-menu interactions and controlled-clock fixture, alongside Development B's recovery acknowledgement, factual status and educational-objective assertions. Both implementations' touch journeys remain present.
- The initial selected browser attempt recorded 28 passes and one failure before stopping its stale test snapshot. Its fresh-company trace showed the clock helper's 60-second positioning jump correctly opening the inactivity Hint offer, which blocked a subsequent Run click. The helper now asserts the simulation counter stayed unchanged, chooses the visible **No, thanks** button and verifies the offer closed before operating. A fresh reproduction passed the full public-control company journey and both clock companion checks: **three passed, 1.6 minutes**. No production timing, forced click, skip, assertion limit or retry-policy change was made.

### Fresh verification on `d17db06`

| Verification | Result |
| --- | --- |
| Node version | 22.23.3; explicit Node 22 executables for static checks, coverage and browser CLI; final browser production preview also launched directly with Node 22. |
| Frontend lint, typecheck, build | Passed. Lint/typecheck passed again after the test-helper correction. |
| Frontend full coverage | **1,146 passed**, one existing opt-in diagnostic skipped; 102 passed files / one skipped file, 461.42 seconds. Statements 87.98%, branches 85.78%, functions 90.90%, lines 89.84%. Runtime source did not change afterward. |
| Backend lint, typecheck, build and full coverage | Passed; **61 tests** in 10 files. |
| Migration consistency | No schema changes, no new migration and no migration applied. |
| Selected browser attempt | Interrupted after a further main refresh; retained as diagnostic evidence rather than a completed 128-case sweep. |

The final selected batch uses one worker and retries zero on port 4197:

```powershell
node node_modules/@playwright/test/cli.js test controls.spec.ts clock.spec.ts automaticHints.spec.ts chapterHints.spec.ts guidanceHierarchy.spec.ts guidanceRewards.spec.ts learningGuidance.spec.ts gameplay.spec.ts mobile.spec.ts combined.spec.ts spikes.spec.ts --retries=0 --output=../test-results/integration-audit/controls-browser-final-artifacts
```

The current full browser inventory is **205 journeys in 36 files**; the selected regression batch has 128 journeys in 11 files. GitHub CI will run the full inventory across the existing ten shards. The earlier complete sweep remains **189 passed / seven failed**, followed by passing corrective runs covering eight desktop cases and one touch case: all **196 distinct earlier journeys** have passing verification **across runs**, not one completely green full sweep. Those historical results are not relabeled as a complete sweep on `d17db06`.

The approved inventory remains the same **47 paths** listed at the end of this report: 42 production/test/helper paths for the feature commit and five reports for the documentation commit. Generated output, logs, traces, screenshots, temporary scripts and the extra local recovery snapshot remain ignored. Simulation, finances, chapter predicates, state/save schemas, backend/shared contracts, dependencies and workflows match `d17db06`; other worktrees were not modified.

Review attention remains Chapter 0/guidance coexistence, narrow dock/modal/spotlight clearance and the existing bounded overall test budgets. Chromium emulation does not establish Safari, Firefox or real-device support. Existing dependency advisories and real Google/Neon acceptance limits remain as recorded below. Screenshots are reviewed locally; inline PR attachment remains pending, with CI browser artifacts available after their jobs complete. The user authorized submission, not a main merge or manual deployment.

## Earlier completed audit on `9ce8565` (historical pre-publication snapshot)

**READY TO COMMIT** — local integration and validation complete. All 47 pending paths remain unstaged. Nothing committed, pushed, published or deployed.

## Git and recovery

- Working branch: `fe/campaign-guidance-rewards`; confirmed PR target: `main` (remote default, repository workflows and merged PR history).
- Original HEAD/base: `4b8eda93437c731e8b62fc6ad32ebcb7c8583e9d`.
- Initially integrated target: `ec94ad2cae0b90898bb9955c5989d7dcc366a4d2`. After resuming on October 18, the refreshed target and current HEAD are `9ce8565bda5b92d4c346c609d47dee52c2d007a1`.
- Six upstream commits; no local feature commits or published feature tracking branch. Existing branch fast-forwarded, then the protected Development B changes reapplied. No history rewrite or extra branch/worktree.
- Original pending work: 42 paths (18 tracked modifications, 24 untracked; 14 production, 24 tests/helpers, four historical reports). No unrelated changes or unfinished Git operations found.
- Verified external recovery archive: `C:\Users\user\Codex-Backups\99.9-Percent-Development-B\20261018-001443\development-b.zip`. Companion manifest, binary patch, original HEAD and status are beside it. All 42 original raw SHA-256 hashes matched an extracted restoration; durable archive hash matched the tested archive. Credentials, environments, dependencies and generated outputs excluded.
- Final worktree: 47 intentional paths (22 tracked modifications, 25 untracked; 14 production, 28 tests/helpers, five reports). No staged changes, unmerged entries or unfinished Git operation. HEAD and the audited `origin/main` ref match (0 ahead / 0 behind).
- All four other worktrees were checked again at completion: clean and untouched.

## Upstream changes and conflict resolution

| Commit | Change and integration consequence |
| --- | --- |
| `8a5405a` (#96) | Hold the Opening tutorial clock. Keep store and control guards; Run attention respects the hold. |
| `d452f2c` (#97) | Remove redundant infrastructure help disclosure. Keep component help tooltips, the selected component's About disclosure and actual evidence. |
| `260f3aa` (#101) | Source Sans 3 / Space Grotesk and shared sizing replace pixel typography. Keep manifest, lockfile and styling; revalidate layout and spotlight clearance. |
| `ec94ad2` (#102) | Chapter 0, 21 lessons, replay, seven-entry chapter overview and game-second labels. Keep numbering 0–6 and adapt Development B assumptions. |
| `d008856` (#105) | Keep the camera stationary while walking; retain the upstream scene changes and new browser regression verbatim. |
| `9ce8565` (#106) | Ten CI browser shards, preserving the required frontend/backend gates, one worker, timeouts and failure policy. |

Upstream changed 71 paths. The first four commits changed 66 paths; the next two changed six non-overlapping paths, with one already in that first set. All 44 pending file hashes were verified unchanged across the second fast-forward. Fifteen overlapped the original Development B tracked changes; no untracked path collided with upstream. Read-only three-way previews identified five conflicted files containing 13 blocks. User explicitly approved the combined resolution before any integration.

- `campaignChapters.ts`: retain upstream Chapter 0 and numbering; attach stable educational objectives by chapter ID, avoiding a shifted six-item objective array.
- `CampaignChapters.tsx`: retain the Chapter 0 overview/replay/advance rules; render the appropriate educational objective for each of Chapters 0–6.
- `CampaignUI.tsx`: combine React guidance subscriptions and clock guards; preserve Run/Pause/Confirm attention, factual situation/progress, preparation evidence and recovery reports. Use the shared last tutorial lesson instead of hardcoded step 7; retain game-second units in new UI copy.
- `App.test.tsx` and `Tooltip.test.tsx`: preserve recovery assertions while reconciling “Checking recovery” with game-second units.
- Text-clean E2E merges also required semantic adaptation: 21 lessons, seven overview entries, new units and explicit Finish Chapter 0.
- Resumed incidents hide an unfinished Chapter 0 lesson. Hint now remains available in that state without changing the saved lesson or game state; unit and real-browser regressions cover this coexistence. A hidden lesson does not bypass requested-Hint gating for incident Run attention; the visible final Chapter 0 lesson retains its mandatory instruction.

The additional upstream changes do not overlap Development B; no new conflict or architecture decision was needed. No Development B changes to simulation mathematics, finances, chapter completion predicates, research/unlock rules, recovery requirements, saves, backend/shared contracts, schemas, deployment configuration or Classic Mode rules. Upstream store tutorial clock fix retained verbatim.

## Intended behavior

Chapters 1–6 retain an educational Goal, factual Current situation and measured requirements/progress. Optional button-level recommendations remain inside requested Hint. Mandatory warnings, decisions, reviews and tutorial instructions stay discoverable. The centered automatic Yes/No offer at 15 eligible seconds, Hint glow at 10 seconds, one-time-per-stage No dismissal, manual incident/normal Hint and contextual gold attention are retained. Factual optional purchase constraints remain discoverable in Chapter requirements. Offers do not advance or pause simulation. Prior preparation is explained using recorded observations without introducing rewards or changing chapter gates.

## Validation results

Node **22.23.3**; separate `npm ci` in each package. Final static checks used the Node 22 executable explicitly. The audited target is `9ce8565` (remote refresh on October 18).

| Verification | Command | Result |
| --- | --- | --- |
| Frontend static checks | `npm run lint`, `npm run typecheck`, `npm run build` | All passed again after the last test corrections. |
| Frontend full coverage | `npm run test:coverage -- --maxWorkers=1` | **1,144 passed**, one existing opt-in TRACE printer skipped; 100 passed files / one skipped file, 503.42 seconds. |
| Affected UI after restoring upstream About disclosure | `npm test -- --maxWorkers=1` with the seven component files below | **103 passed**. No further production source changes followed. |
| Backend static checks/build | `npm run lint`, `npm run typecheck`, `npm run build` | Passed. Backend tree unchanged by all integration commits. |
| Backend full coverage | `npm run test:coverage` | **61 passed** in 10 files. |
| Migration consistency | `npm run db:generate` | No schema changes; no generated migration and no migration applied. |
| Complete browser sweep | `npx playwright test --output=../test-results/integration-audit/browser-validation-artifacts` with `PLAYWRIGHT_PORT=4197` | **189 passed / seven failed**, 196 desktop/touch journeys, 55.3 minutes; original failures retained. |
| Fresh desktop correction run | Node 22 Playwright CLI, command below, retries 0 | **8 passed**, 3.1 minutes. |
| Fresh touch correction run | Node 22 Playwright CLI, command below, retries 0 | **1 passed**, 23.6 seconds. |
| Git whitespace/index checks | `git diff --check`, `git diff --cached --name-only`, `git ls-files -u` | Passed; nothing staged or unmerged. |

All **196 distinct browser journeys have passing verification across the complete sweep and fresh corrective runs**. This is **not a claim of one green 196-test batch**: the full attempt had seven failures, all covered by the nine-case follow-up (which also includes the two companion desktop-size variants). No new skip, automatic retry, forced click or weakened assertion was introduced.

Frontend coverage: statements 87.99%, branches 85.83%, functions 90.90%, lines 89.84%. Backend coverage: statements 88.18%, branches 87.16%, functions 84.61%, lines 89.56%. Coverage does not measure visual quality or human learning.

### Browser failures and resolutions

| Full-run failure | Evidence and correction | Fresh verification |
| --- | --- | --- |
| 1440px purchase layout | All final assertions passed at **64.77 seconds**, exceeding the 60-second aggregate budget. This journey includes four real-room purchase previews, keyboard checks, three screenshots and desktop/touch resizing. Give its two desktop variants 120 seconds overall. | Both sizes passed (17.6s / 12.9s). |
| Opening upgrade and touch incident inspection | New factual Current situation status made the old unscoped evidence-status locator match two elements. Scope to the status containing Demand; retain every expected demand/capacity/backlog value and both accessible statuses. | Desktop and touch passed. |
| Spike guardrail | Old test expected duplicate side-panel Next instructions deliberately removed by the approved hierarchy. Assert the actual chapter-bar Next control is enabled after recognition; preserve all pulse/stability, acknowledgement and reload checks. | Passed. |
| 1440px live Pause/Confirm priority | Final assertions passed at **62.49 seconds**, exceeding the aggregate budget. Repeated real clock, quote/sheet and compositor checks justify 120 seconds for its two desktop variants. | Both sizes passed. |
| Opening prevention | Old notice wording changed; the factual recovery requirement remains visible. Assert that requirement, the unmet recovery check and absent Next, retaining same-company, step-count, acknowledgement and reload checks. | Passed. |
| Straight walk across the server hall | Chromium navigation failed before app load with `ERR_NETWORK_IO_SUSPENDED`; error-page origin then refused fixture localStorage. No application or test change for this failure. | Unchanged test passed in a fresh context (7.3s). |

The four long desktop variants alone receive a 120-second **overall** budget. Every 10-second per-assertion limit, real WebGL room, public interaction, screenshot, clock delivery, retry policy and gameplay/financial check remains intact. The frame/rendering traces support this bounded change; it does not suppress functional assertions.

Exact fresh desktop command (from `frontend/`, Node 22, `PLAYWRIGHT_PORT=4197`):

```powershell
node node_modules/@playwright/test/cli.js test actionPopover.spec.ts guidanceRewards.spec.ts gameplay.spec.ts guardrail.spec.ts prevention.spec.ts walk.spec.ts --project=chromium --grep 'purchase card keeps|Spotlight refinement: live incident|opening acceptance: upgrade|guardrail: pulses|Opening prevention:|walks straight' --retries=0 --output=../test-results/integration-audit/browser-corrections-desktop-artifacts
```

Exact fresh touch command:

```powershell
node node_modules/@playwright/test/cli.js test mobile.spec.ts --project=mobile-chromium --grep 'investigates and responds through the incident panel on touch' --retries=0 --output=../test-results/integration-audit/browser-corrections-mobile-artifacts
```

The 103-case component rerun covered `CampaignUI`, `CampaignRefinement`, `CampaignTutorial`, `CampaignFeedback`, `ChapterHints`, `ProgressionGuardrail` and `Tooltip` test files. Full coverage passed on the latest target before the selected-About restoration; the affected component rerun and all browser validation used the restored disclosure. Runtime source did not change afterward.

Initial `npm run typecheck` / `npm run build` reported TS2339 for a new unit-test `toBeEnabled` matcher unsupported by this repository's Vitest setup; use the existing DOM disabled-attribute assertion style. Final static checks and full coverage passed after correction. Earlier coverage commands were `npm run test:coverage` (default workers), `npm run test:coverage -- --maxWorkers=2`, then `npm run test:coverage -- --maxWorkers=1`.

Earlier diagnostics are retained locally: default-worker and two-worker coverage attempts were stopped after host contention produced timeouts; the first completed serial run was 1,140 passed / three failed / one existing skip. Corrected the stale Advance-step locator, restored factual optional-purchase constraints and asserted the actual Next control. The affected 31-case batch passed, followed by full coverage (first 1,143 on `ec94ad2`, then 1,144 on `9ce8565`, including the added hidden-tutorial regression). Initial `npm ci` attempts hit sandbox spawn restrictions and a Vite-held Windows native-module lock; permitted retries completed after temporarily stopping those local Vite processes. Interrupted browser attempts (6, 7 and 27 passes) are diagnostics, not final coverage.

### Hygiene, review artifacts and limits

All 47 intended paths are inventoried below, including untracked source/tests/reports omitted by ordinary diff statistics. Generated build output, coverage, traces, screenshots, logs and audit scripts stay ignored. Changed runtime files contain no debug logging, debugger statements, hardcoded localhost URLs, conflict markers or credential patterns. No simulation, save/persistence, backend/shared, dependency, workflow or deployment change is introduced relative to the audited target.

Manually reviewed current desktop/phone captures: readable purchase warnings and Confirm/Cancel, visible gold attention, Chapter 4's distinct educational goal/factual pulse and stability counters, and the centered 320px Yes/No offer. Four prepared local screenshots for a future PR are under `test-results/integration-audit/reviewer-screenshots/`; they are not staged or uploaded.

All four other worktrees remain clean and untouched. The temporarily stopped development server is restored at **http://localhost:5173/**, verified HTTP 200 with this game's Vite entry point.

Installer advisories remain from the existing lockfiles: frontend one high; backend four moderate and one high. No unrelated dependency upgrade was made. Browser coverage is Chromium desktop and touch emulation, not Safari/Firefox/real-device validation. Account/cloud-save tests use mocks and isolated PGlite; real Google/Neon deployment acceptance is outside these local checks. GitHub CI cannot evaluate uncommitted changes: the required `frontend` and `backend` checks and reviewer approval still apply after an authorized publication.

The four earlier Campaign reports are historical. Their old test counts, local preview URLs and ignored screenshots do not establish current integration validation; this report supersedes those claims.

## Original commit and PR proposal (historical; subsequently approved)

1. `feat(campaign): refine guidance and recovery presentation` — 42 coupled production/test/helper paths: the 14 production paths plus all 28 tests/helpers listed below. Keep implementation and matching assertions in the same commit so the intermediate commit remains testable.
2. `docs(campaign): record learning refinements and integration validation` — the four historical feature reports plus this current audit (five paths).

Suggested PR title: `feat(campaign): refine guidance, recovery and learning progression`

Target: `main`.

Proposed description, following `.github/pull_request_template.md`:

```markdown
## What

Separate Campaign educational goals and factual progress from requested action guidance across Chapters 1–6. Preserve timed/manual Hint, recovery and preparation evidence, and control spotlights alongside Chapter 0's 21 lessons, clock hold and current main changes.

## How to test

- Node 22: frontend/backend lint, types and builds; full coverage: 1,144 frontend tests passed (one existing diagnostic skip) and 61 backend tests passed.
- Complete Chromium desktop/touch sweep: 189 passed / seven failed; all seven failures resolved or identified as a transient pre-load network suspension and passed in fresh corrective runs covering nine cases. All 196 distinct journeys have passing verification across these runs, rather than one green batch. See docs/CAMPAIGN_GIT_INTEGRATION_AUDIT.md for exact commands, traces and bounded overall test-budget changes.
- Review Chapters 1–6, manual/declined Hint, active incidents, Chapter 4/5 observations and 320px layouts. Prepared local screenshots: test-results/integration-audit/reviewer-screenshots/.

## Checklist

- [x] PR title follows type(area): summary.
- [x] No secrets or API keys introduced.
- [x] shared/ unchanged; counterpart contract approval is not applicable.
- [ ] Screenshots attached for UI changes — prepared locally; attach only when PR creation is authorized.
```

No migration or configuration rollout is needed for this frontend presentation work. Existing main-branch automatic deployment and reviewer approval requirements remain in place. Reviewer attention: Chapter 0/guidance coexistence, narrow-layout spotlight/modal clearance and the trace-justified overall budgets for four desktop browser variants. No unresolved integration incompatibility was found; the original browser failures and verification limits remain recorded above. No commit, push, PR creation, main merge or deployment is authorized by this report.

## Pending staging inventory

The approved inventory contains **47 intentional paths**: 42 production/test/helper paths for commit 1 and five reports for commit 2. Before staging, these comprised 22 modified tracked paths and 25 untracked paths. Use this explicit inventory rather than tracked-only diff statistics; generated outputs and local artifacts are excluded.

<details>
<summary>Review all intended paths</summary>

### Production presentation (commit 1) — 14 paths

- `frontend/src/components/CampaignAction.tsx`
- `frontend/src/components/CampaignChapters.tsx`
- `frontend/src/components/CampaignFeedback.css`
- `frontend/src/components/CampaignUI.tsx`
- `frontend/src/components/ChapterHints.tsx`
- `frontend/src/components/chapterHintAttention.ts`
- `frontend/src/components/useGuidanceCue.ts`
- `frontend/src/components/useLiveRecovery.ts`
- `frontend/src/game/campaignChapters.ts`
- `frontend/src/game/campaignFeedback.ts`
- `frontend/src/game/campaignGuidance.ts`
- `frontend/src/game/campaignNextStep.ts`
- `frontend/src/game/campaignSituation.ts`
- `frontend/src/game/preparationEvidence.ts`

### Tests and helpers (commit 1) — 28 paths

- `frontend/e2e/actionPopover.spec.ts`
- `frontend/e2e/automaticHints.spec.ts`
- `frontend/e2e/chapterHints.spec.ts`
- `frontend/e2e/chapterHints.ts`
- `frontend/e2e/chapters.spec.ts`
- `frontend/e2e/combined.spec.ts`
- `frontend/e2e/dataStrategy.spec.ts`
- `frontend/e2e/fixtures.ts`
- `frontend/e2e/gameplay.spec.ts`
- `frontend/e2e/guardrail.spec.ts`
- `frontend/e2e/guidanceHierarchy.spec.ts`
- `frontend/e2e/guidanceRewards.spec.ts`
- `frontend/e2e/guidanceRewards.ts`
- `frontend/e2e/learningGuidance.spec.ts`
- `frontend/e2e/mobile.spec.ts`
- `frontend/e2e/prevention.spec.ts`
- `frontend/e2e/reliability.spec.ts`
- `frontend/e2e/scaling.spec.ts`
- `frontend/e2e/spikes.spec.ts`
- `frontend/src/App.test.tsx`
- `frontend/src/components/CampaignFeedback.test.tsx`
- `frontend/src/components/CampaignUI.test.tsx`
- `frontend/src/components/ChapterHints.test.tsx`
- `frontend/src/components/ProgressionGuardrail.test.tsx`
- `frontend/src/components/Tooltip.test.tsx`
- `frontend/src/game/campaignFeedback.test.ts`
- `frontend/src/game/campaignGuidance.test.ts`
- `frontend/src/game/campaignNextStep.test.ts`

### Reports (commit 2) — 5 paths

- `docs/CAMPAIGN_AUTOMATIC_HINT_FIX.md`
- `docs/CAMPAIGN_GIT_INTEGRATION_AUDIT.md`
- `docs/CAMPAIGN_GUIDANCE_HIERARCHY.md`
- `docs/CAMPAIGN_GUIDANCE_REWARDS.md`
- `docs/CAMPAIGN_LEARNING_REFINEMENT.md`

</details>
