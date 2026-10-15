# Campaign Finance publication readiness

Branch: `fe/campaign-finance-main`.
Worktree: `C:/Users/user/99.9-Percent-Latest/test-results/campaign-finance-main`.
Approved base: `275081388a51d0832c05fd9b45848b461ce10b94`.
Initial publication code snapshot: `4c89bcf`, published with its report as `b6eb5e3`. The mobile CI correction below changes UI code and tests after that snapshot.
Pre-update backup: `fe/campaign-finance-main-backup-a11be33` at `a11be338126724ca288da5080b746d45e3808f35`.
Earlier backups at `5f63f52` and `0605867` remain available.

## PR #90 mobile CI correction

Follow-up to published commit `b6eb5e3`, on the same base `2750813`. This correction changes only `CampaignFinance.css`, `CampaignAction.tsx`, `e2e/mobile.spec.ts`, `e2e/purchaseLayout.ts` and this report. No simulation, finance calculation, purchase validation, save, backend, tutorial or scene implementation changes are included. All work remained inside this integration worktree; the original Finance worktrees were not modified.

The original hosted run `38702401704` failed browser shard 3: Cash clearance failed twice, and purchase-details End scrolling failed once before passing on retry. Other frontend checks, backend and browser shards 1/2 passed. CI correctly rejected the flaky result.

The unchanged two tests passed all six Windows baseline executions. An isolated Ubuntu/WSL Node 22.23.3 environment using the same Playwright Chromium headless-shell revision 1243, Pixel 7 settings, SwiftShader and one worker reproduced Cash failure on all three Linux attempts; the purchase test passed its three Linux baseline attempts. This is a platform-focused reproduction, not an identical hosted runner. The intermittent scrolling failure was not reproduced as a full local baseline failure. Its hosted trace and a local geometry probe were inspected instead.

Cash's 53px compact amount exceeded the 46.5px available body width at 390px, leaving only 1.5px of right clearance against the existing 2px minimum. The compact Cash body now reserves its intrinsic number width, uses a smaller gap, and lets the decorative icon shrink. Shared padding, card dimensions, font size, formatting and keyboard/button behavior remain. Final Linux measurements show 8px right clearance at 320/360/375/390px and 15.5px at 430px; the original equal-card-size and 2px minimum assertions remain.

The details region genuinely overflowed (247px content in a 74px viewport) and held focus. A local probe observed End still at zero immediately after animation frames; native scrolling could occur asynchronously, while the hosted failure remained at zero through the assertion. The precise intermittent browser cause is not established. Plain End/Home now explicitly move the focused details region to its endpoint, removing reliance on native scroll routing. Nested targets and modified keys retain their behavior. No artificial overflow, timeout increase or retry workaround was added. The test checks the actual current bottom within 1px for integer/fractional scroll geometry, rather than merely any positive movement, and accepts naturally fitting content. Added cases verify both real overflow and fitting content after resize. Existing full-room purchase and Cash journeys retain the actual WebGL room; the additional DOM-only cases use the existing UI fixture.

Final validation with Node 22.23.3:

- Frontend lint, typecheck and production build passed.
- All 33 focused Finance, Campaign UI and purchase/refinement component tests passed.
- Linux Chromium: both originally failing tests and both added responsive/keyboard tests passed five times each: **20 passed in 7.0 minutes, retries disabled**.
- Nearby Windows Chromium desktop/touch journeys: **14 passed in 4.3 minutes, retries disabled**, including Finance/spotlight focus restoration, Cash keyboard/touch access, tooltip/scaling interactions, camera/highlighting, left-side cards at desktop/laptop sizes and the touch purchase sheet.
- Fresh mobile Cash and expanded purchase screenshots were inspected. Financial warnings and Confirm/Cancel remain visible above controls.

The complete browser and coverage suites were intentionally not repeated locally for this scoped fix. Backend/balance inputs are unchanged. Historical full-suite results and their timeout limitations below remain historical; hosted CI must validate the new pushed commit. No assertion was weakened and no failing baseline/intermediate run was relabeled green. An intermediate padding adjustment was rejected by the unchanged equal-card-width check and corrected before final verification.

Ignored evidence is under `test-results/ci-mobile-fix/`: hosted artifacts, `linux-connected-baseline.log`, `linux-final.log`, `linux-final-report/`, `linux-final-artifacts/`, `nearby.log`, `nearby-report/`, `nearby-artifacts/`, and final lint/typecheck/build/unit logs. The isolated Linux runtime and helper files remain ignored; helper servers were stopped. No dependency or workflow change is included.

## Integration and scope

Rebased the three Finance integration/report commits onto `2750813` without conflicts. `git range-diff` confirms that all three commits were replayed unchanged. The earlier Cloud Saves/Finance import resolution remains: `AccountSection, CloudSavesSection` from main together with `FinanceEntry`, the infrastructure/disabled-action helpers and descriptions from Finance. Cloud Saves remains in the Saves tab; Account remains in its own tab.

PR #86's Cloud Saves, PR #88's walking destination markers and PR #89's elevator cutscene implementations are unchanged from main. The floor timing, levels helpers, cutscene styles and room transition code remain main's versions; Finance adds only its previously reviewed tooltip import/props in `Facility.tsx`. The marker still follows the actual planned path, respects reduced motion, clears when the path ends and does not intercept room raycasts. The diff was reviewed against `2750813`; no teammate implementation was replaced wholesale.

Finance retains the four-section dashboard, collapsed Advanced details, clickable keyboard/touch Cash card, actual/estimated accounting distinction, engine-derived purchase quotes and refusal reasons, warnings, stale-quote review, duplicate-click protection, infrastructure tooltips and closed About Equipment disclosure. Desktop purchase cards stay on the left of the usable scene; mobile sheets remain above navigation. Warnings and Confirm/Cancel remain outside optional scrolling details. Equipment highlights and camera focus remain.

The spotlight/shared confirmation observer, Health Checks guidance, chapter Next/completion behavior, routing selection, analytics privacy, menu/account navigation, graphics improvements and walking inspections remain. The purchase, positioning and Finance calculation implementations are unchanged from `5f63f52`.

Scope remains **27 files: 26 frontend files and this report**. Backend, shared contracts, dependency manifests/locks, workflows, deployment settings, main's store/persistence/simulation step, graphics profiles, Account/Modals and Avatar/palette implementations have no diff from updated main. The only simulation-file diff is the previously approved `sim/settlement.ts` helper extraction, unchanged from the validated Finance version. No new formulas, costs, timing, bankruptcy rules, save schemas or replay formats changed.

## Latest focused validation on 2750813

Node 22.23.3 was used. Existing separately installed dependencies were reused. After rebasing main, no additional product source, test assertion, timeout, package or lockfile was edited; only this report changes after the validated code snapshot.

| Check | Result |
| --- | --- |
| Frontend lint and typecheck | Passed |
| Production build | Passed |
| Focused Finance/Campaign UI/accounting/elevator/walking tests | 48 passed across 6 files (15.65 seconds) |
| Focused room/purchase browser journeys | 17 passed (16 desktop, 1 touch) in 4.4 minutes; no failures |

The unit targets were `CampaignFinance.test.tsx`, `CampaignUI.test.tsx`, `CampaignRefinement.test.tsx`, `campaignFinance.test.ts`, `scene/levels.test.ts` and `scene/walk.test.ts`. The browser scope is purchase focus/highlights and left-side layout, floor/elevator transitions, tutorial-guided floor changes, walking inspections and a narrow touch purchase sheet. The complete frontend coverage, balance and browser suites were intentionally not repeated under the approved focused workflow. Backend and shared inputs remain unchanged from the prior complete 61-test backend pass, so backend checks were not repeated for this elevator-only main update. Hosted full checks remain required.

All 17 journeys passed unchanged: purchase camera focus/highlights, desktop/laptop card expansion and resizing, every supported later-stage purchase, the Health Checks unlock/deployment guide, menu/keyboard elevator and floor switching, incident/tutorial floor transitions, walking elevator controls, Classic and Guided equipment walking inspections, and the 390x844 touch purchase sheet. No assertion or timeout was relaxed; no further failure required expanded testing.

Latest logs/reports are ignored under `test-results/publication-2750813/`: `lint.log`, `typecheck.log`, `targeted-unit.log`, `build.log`, `browser-focused.log`, `browser-report/`, `browser-artifacts/` and `browser-exit.txt`. The validation-input manifest records 503 tracked frontend/backend/shared file hashes, checked again before publication. From `frontend/`, view the latest browser report with `npx playwright show-report ../test-results/publication-2750813/browser-report`.

## Previous focused validation on 065b047

All check executables use Node 22.23.3. Existing separately installed frontend/backend dependencies were reused; no package or lock changes were needed. Per the user's approved efficient-validation scope, the complete local frontend coverage and browser suites were not repeated. No new failure justified broadening local testing.

| Check | Result |
| --- | --- |
| Frontend lint and typecheck | Passed |
| Production build | Passed |
| Targeted frontend tests | 81 passed across 9 files (26.03 seconds) |
| Backend lint and typecheck | Passed |
| Complete backend coverage | 61 passed across 10 files (16.86 seconds) |
| Migration consistency | No schema changes; no migration files generated |
| Focused desktop/touch browser journeys | 18 passed (15 desktop, 3 touch) in 6.1 minutes; no failures |

Frontend targets: `CampaignFinance.test.tsx`, `CampaignUI.test.tsx`, `CampaignRefinement.test.tsx`, `Account.test.tsx`, `App.test.tsx`, `campaignFinance.test.ts`, `scene/walk.test.ts`, `CampaignTutorial.test.tsx` and `MenuTabs.test.tsx`. These cover purchase safety/revalidation, finance accounting, tutorial observers, routing, Cloud Saves and Account separation in Guided and Challenge modes, menu accessibility and walking paths.

The 18 focused browser journeys all passed. They cover Cloud Saves in the Saves tab (explicit saving, conflict resolution, owner isolation and loading in a fresh browser), purchase camera focus/highlights, App Server/Database/traffic-limit card bounds at 1440x900 and 1366x768 through expansion/resize, all supported later-stage purchases, the Health Checks Tech-to-deployment guide, Finance/spotlight focus restoration, Cash keyboard access and status-card sizing, equipment-directed walking and Space inspection, Guided Mode office walking/inspection, and three touch journeys for Finance/spotlight, reduced-motion finance/help and the 390x844 purchase sheet. The destination-marker implementation remains identical to main and is exercised with the real WebGL room during walking interactions. A fresh Cloud Saves menu screenshot was inspected. No browser assertions or timeouts were changed.

The user-authorized focused scope passed without new failures, so no additional full local suite was necessary. Full frontend/browser regression validation remains a hosted-CI requirement.

Previous-step logs and browser artifacts are ignored under `test-results/publication-065b047/`: `lint.log`, `typecheck.log`, `targeted-unit.log`, `build.log`, `backend-lint.log`, `backend-typecheck.log`, `backend-coverage.log`, `backend-migrations.log`, `browser-focused.log`, `browser-report/`, `browser-artifacts/` and `browser-exit.txt`. The input manifest records hashes for 503 tracked frontend/backend/shared files. At that previous step, all 503 validation-input hashes matched and only the report changed afterward. The latest snapshot is recorded separately above.

## Previous complete-suite results (prior base 75d486a)

These are historical evidence for `32b8f7b`/`5f63f52`, not complete-suite results on `065b047`:

- Frontend lint/typecheck/build passed; complete serial frontend coverage: **1,006 passed, one existing optional trace test skipped, no failures**. Balance: **25 passed**.
- Backend lint/typecheck and complete coverage: **61 passed**; migration consistency found no changes. Backend coverage has also passed again in this update as recorded above.
- Complete browser suite: **104 passed, one timeout** in 55.2 minutes; 87 desktop and all 17 touch cases passed. The unchanged walking-audio test (`walk.spec.ts:144`) exceeded its existing 180,000ms budget while polling initial meeting-room audio. It reported 20.7 minutes across the user/tool interruption. That timing coincidence is not proof of cause.
- The same walking-audio test passed unchanged twice in isolation, in **38.6 and 33.6 seconds**. Those diagnostics did not make the complete browser run green. No assertion, timeout, fixture or gameplay rule was weakened.

The previous full report is preserved at `git show fe/campaign-finance-main-backup-5f63f52:docs/CAMPAIGN_FINANCE_MAIN_INTEGRATION.md`. Complete-run and isolated logs/reports remain separate under `test-results/main-update/`.

Older `0605867` evidence also remains disclosed: frontend coverage had 1,003 passes, one Combined UI timeout and one optional skip; all five unchanged Combined UI cases then passed in isolation. Browsers had 102 passes and one mobile incident timeout; that case then passed twice unchanged (32.1 and 32.2 seconds). Neither historical complete run became green. The later full frontend run and mobile incident browser case passed on the prior base as recorded in the backup report.

## Preservation and publication gates

Only the Finance integration worktree was used for this update. Neither original Finance worktree was modified. The pre-update branch is preserved at the backup reference above. Validation-input hashes and the final diff are checked before publication; generated outputs are excluded from Git.

The user authorized publication after successful focused checks and diff review. A newer main commit alone does not block PR creation: publish the reviewed branch and report any update requirement through the PR, without silently starting another integration cycle. Authentication, permission or actual publication failures must be reported. Hosted `frontend` and `backend` checks, including complete frontend coverage and all browser shards, must pass on the eventual merge result, and GitHub's strict up-to-date policy applies before merging. The repo workflow also calls for one reviewer approval. No hosted CI success is claimed in this local report.

The complete local browser suite on `2750813` was intentionally not run; the previous complete run retains its timeout. Safari/Firefox, physical-device testing, real-provider production authentication and human comprehension testing remain unverified. No merge, manual deployment, production configuration change or live migration is authorized.

## Preview and evidence

```powershell
cd C:\Users\user\99.9-Percent-Latest\test-results\campaign-finance-main\frontend
$env:PATH = "C:\Users\user\AppData\Local\npm-cache\_npx\52027bd8fc0022aa\node_modules\node\bin;$env:PATH"
npm run preview -- --host 127.0.0.1 --port 4188 --strictPort
```

Open http://127.0.0.1:4188. The latest focused browser run uses port 4194. Prior inspected screenshots at 1440x900, 1366x768 and 390x844 remain in ignored `test-results/main-update/review-screenshots/`.

## PR description

Title: `feat(campaign): simplify Finance and keep purchase controls accessible`

Campaign finances were difficult to discover, and lengthy purchase confirmations could obscure their action buttons.

- Add a beginner-friendly Finance dashboard with four overview sections and collapsed Advanced details.
- Make the Cash card accessible by pointer, touch and keyboard.
- Show engine-derived purchase quotes, financial warnings, stale-quote review and duplicate-click protection.
- Add infrastructure explanations and reachable disabled-action reasons, retaining collapsed About Equipment disclosures.
- Keep desktop purchase panels on the left of the usable scene and mobile sheets above navigation, with persistent warnings and Confirm/Cancel controls.

Preserve equipment highlighting, camera focus, the shared tutorial confirmation observer, Health Checks guidance, chapter/menu behavior, latest routing choices, graphics improvements and walking inspections. Retain economic constants, settlement arithmetic, purchase rules and save contracts.

Updated onto `2750813` without conflicts, preserving PR #86's Cloud Saves tab, PR #88's walking destination markers and PR #89's elevator cutscene. The reviewed diff contains 27 files: 26 frontend files and the integration report. Backend contracts, save schemas, dependencies and deployment settings are unchanged. The settlement helper is the previously approved extraction of recurring charges; it adds no new economic constants or settlement formulas.

### Latest focused validation (base 2750813)

Node 22.23.3, against code snapshot `4c89bcf`; the publication commit adds only the report:

- Frontend lint, typecheck and production build passed.
- **48 focused tests passed** across Finance, Campaign UI/refinement, accounting, elevator levels/timing and walking paths.
- **17 browser journeys passed** in 4.4 minutes: purchase camera focus, equipment highlights and left-side card bounds at 1440x900/1366x768, expanded details and persistent warning/Confirm/Cancel controls, later-stage purchases and Health Checks guidance, floor/elevator switching via menu/keyboard, incident/tutorial floor changes, walking/Space inspections and a 390x844 touch purchase sheet.
- No test assertion, timeout or unrelated gameplay behavior was changed.

Complete frontend coverage, balance and the full browser suite were intentionally not repeated locally for this conflict-free rebase. Backend inputs remain unchanged from the prior 61-test full pass. The required hosted `frontend` and `backend` checks must pass on the eventual merge result; current focused passes are not a full-suite result on this base.

### Prior validation and timeout disclosure

On base `065b047`: frontend lint/typecheck/build, **81 targeted frontend tests**, **18 focused browser journeys**, backend lint/typecheck and **61 complete backend coverage tests** passed. Migration consistency found no changes. This included Cloud Saves navigation/conflict/ownership/loading, Finance/Cash keyboard and touch access, spotlight coexistence and walking interactions.

Previous complete validation on base `75d486a`: **1,006 frontend tests passed**, one existing optional trace test skipped; **61 backend tests** and **25 balance tests passed**. Complete browsers: **104 passed, one unchanged walking-audio timeout**, with all 17 touch cases passing. The test's existing 180-second budget expired across a long user/tool interruption; the cause is not established. It subsequently passed twice unchanged in isolation, in **38.6 and 33.6 seconds**. The complete browser suite is **not green**; isolated passes do not erase the failure. No assertion, timeout or gameplay rule was weakened.

Older `0605867` complete-run timeouts and successful unchanged isolated diagnostics remain disclosed in the integration report. No historical failed complete run is relabeled green.

Original Finance worktrees and local backups are preserved. Full hosted CI, Safari/Firefox, physical devices and real-provider production authentication remain unverified locally. The repository workflow calls for one reviewer approval before merging. No merge or manual deployment is authorized by this PR.
