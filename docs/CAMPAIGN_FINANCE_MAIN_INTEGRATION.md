# Campaign Finance integration onto updated main

Branch: `fe/campaign-finance-main`.
Worktree: `C:/Users/user/99.9-Percent-Latest/test-results/campaign-finance-main`.
Approved base: `75d486a1678e8916a617696bed9819a51cd7e24d`.
Validated code commit: `32b8f7b75c7d661754147d2c98dd32fa81f6c5ec`; the final report is a subsequent documentation-only commit.
Local backup: `fe/campaign-finance-main-backup-0605867` at `0605867ba0ce3deb961c584c4f33ba6ee13b3895`.
Finance source remains the completed work through `f34870c`, originally integrated onto `2df332a` as `0605867`.

## Update and conflict resolutions

The original Finance commit was rebased locally onto the approved updated main. This retains PR #85's unique routing choices, PR #80's Medium graphics defaults and rendering improvements, and PR #87's Guided Mode walking inspections. No branch was merged, pushed or submitted as a PR.

Two conflicts required manual resolution:

- `CampaignUI.tsx`: retain main's `routeOptions`, `routeName`, serving-app filtering, active styling, `aria-pressed` and no-op when selecting the current route. Add typed Finance decisions without reinstating the old duplicate routing buttons. Keep the engine refusal explanation outside the disabled fieldset, using only routable serving apps. Purchase previews, safeguards and warnings elsewhere remain unchanged from the backup.
- `e2e/mobile.spec.ts`: keep both the complete newer Medium/Auto graphics test and the 390px Finance purchase-sheet test as separate tests, with their assertions and budgets intact.

The automatically combined `scene/Facility.tsx` retains main's inspection eligibility, office inspections, camera/walk behavior, outline memoization and shader preparation. Finance adds only its tooltip import and tooltip props. No graphics implementation was replaced.

A focused extension to `CampaignUI.test.tsx` checks that selecting the current route leaves the game unchanged and that a pending route produces the engine reason outside the disabled fieldset with keyboard access. Main's existing tests still cover unique routing choices and omission of reserved spares.

## Preserved behavior and diff review

The four-section Finance dashboard, collapsed Advanced details, fully clickable Cash card, actual/estimated accounting distinction, financial warnings, cloned engine previews, stale-quote review, duplicate-click guard, infrastructure explanations, unavailable-action reasons and initially closed About Equipment disclosure remain.

Desktop purchase cards remain on the left of the usable scene, with machine highlighting and camera focus. The same compact mobile sheet remains above navigation. Warnings and Confirm/Cancel stay outside the optional scrolling More details area. The purchase/positioning implementations are unchanged from `0605867`.

The spotlight/shared confirmation observer, Health Checks Tech/unlock/deploy guide, `installPending()` gates, chapter Next/completion behavior, account/menu navigation and analytics privacy remain. Tutorial, persistence, store, analytics, main's simulation step and graphics-profile files have no diff from updated main. Shared component changes were reviewed separately.

Only `sim/settlement.ts` differs within the simulation: it is exactly the previously approved Finance helper extraction from `0605867` and `f34870c`. No new simulation formulas, constants, timing, purchase rules, bankruptcy rules, save schemas or replay formats were introduced. Classic's default Stat behavior remains, with the shared modal focus handling covered by regressions.

The final changed-file scope against `75d486a` is 27 files: 26 frontend files and this report. Compared with the old Finance integration, the extra path is the routing integration regression in `CampaignUI.test.tsx`. Backend, shared contracts, package manifests/locks, workflows, deployment settings and generated outputs have no diff.

## Validation on updated main

All check executables use Node 22.23.3. Existing frontend dependencies were reused because manifests/lockfiles match the previously installed integration version. Backend dependencies were installed separately with `npm ci` in this worktree. No dependency versions were changed.

The initial sandboxed Vitest/build and backend install could not start required subprocesses (`EPERM`); they did not execute tests successfully. They were rerun with approved process access. These startup failures are retained in the logs and are distinct from assertion failures.

| Check | Result |
| --- | --- |
| Frontend lint, typecheck and production build | Passed |
| Targeted Finance/routing/refinement/graphics unit checks | 51 passed across 5 files |
| Complete serial frontend coverage | 1,006 passed, 1 existing optional trace test skipped; no failures (673.09 seconds) |
| Standalone balance | 25 passed (310.86 seconds) |
| Backend lint and typecheck | Passed |
| Complete serial backend coverage | 61 passed across 10 files; no failures (32.80 seconds) |
| Local migration consistency (`db:generate`) | No schema changes; no migration files generated |
| Complete desktop/touch browser suite | 104 passed, 1 timeout in 55.2 minutes; 87 desktop and all 17 touch cases passed |
| Unchanged isolated walking-audio diagnostic, repeated twice | Both passed: 38.6 and 33.6 seconds (1.3 minutes for the command) |

The complete browser run is **not green**. Its only failure was the unchanged `e2e/walk.spec.ts:144` case, ?walking away from the meeting leaves its nearby presentation sound behind?. The existing 180,000ms budget expired; the trace locates it at the initial presentation-audio polling check (`walk.spec.ts:158?159`, before walking away), then page evaluation failed when timeout cleanup closed the browser. The case reported 20.7 minutes elapsed across the user/tool interruption. This timing coincidence is recorded, not proof of cause. The two unchanged isolated passes establish non-reproduction only and do not replace the full-run failure. No assertion, timeout, fixture or gameplay rule was weakened. No additional complete run was performed after the diagnostic; no source change required one.

Every purchase layout/highlight journey passed in the complete run: App Server, Database and traffic limiting at desktop/laptop/touch sizes, scaling, load balancing, cache/tuning, autoscaling, Health Checks, spares and failover. The Health Checks Tech-to-deployment guide passed. Finance/spotlight coexistence and focus restoration passed on desktop and touch; so did Cash keyboard/touch and compact-number bounds, chapter guidance/completion/Next, unique routing, account/menu navigation, same-company progression, Classic, save/replay, camera controls, equipment walking inspections and the new Guided Mode Deploy-office inspection. The previously timed-out mobile incident journey passed unchanged in this complete run in 25.4 seconds. Both the newer Medium/Auto graphics test and the Finance purchase-sheet test passed.

The complete frontend coverage run also includes engine, financial safety, deterministic replay, persistence, chapter/tutorial, menu and analytics/privacy regressions. Its one skipped case is the existing optional trace harness requiring an explicit scenario environment variable. Dependency sourcemap/deprecation and terminal-color warnings were emitted; these are not test passes or failures.

Current evidence:

- `test-results/main-update/targeted-unit-approved.log`, `lint.log`, `typecheck.log`, `build-approved.log`.
- `test-results/main-update/frontend-coverage.log`, `frontend-coverage-exit.txt`, `balance.log`.
- `test-results/main-update/backend-install-approved.log`, `backend-lint.log`, `backend-typecheck.log`, `backend-coverage.log`, `backend-migrations.log`.
- Full browser log/report/trace: `test-results/main-update/browser-full.log`, `browser-report/`, `browser-artifacts/`; `browser-exit.txt` records exit 1.
- Separate unchanged diagnostic: `test-results/main-update/walking-isolated.log`, `walking-diagnostic-report/`, `walking-diagnostic-artifacts/`; `walking-isolated-exit.txt` records exit 0.

From `frontend/`, open the preserved complete report with `npx playwright show-report ../test-results/main-update/browser-report`. The diagnostic report is separate; it does not overwrite the complete result. The current frontend coverage directory represents the complete updated-main run, not an isolated diagnostic.

Fresh default/expanded purchase cards at 1440?900, 1366?768 and 390?844, the resized narrow card, and desktop/touch Finance dashboards were inspected visually. Warnings and Confirm/Cancel remain above controls; optional details scroll within the purchase card. Thirteen current-run screenshots are copied to ignored `test-results/main-update/review-screenshots/`, including:

- [Desktop expanded purchase](../test-results/main-update/review-screenshots/purchase-1440x900-expanded.png)
- [Laptop expanded purchase](../test-results/main-update/review-screenshots/purchase-1366x768-expanded.png)
- [Touch expanded purchase](../test-results/main-update/review-screenshots/purchase-390x844-expanded.png)
- [Desktop Finance](../test-results/main-update/review-screenshots/finance-refinement-desktop.png)
- [Touch Finance](../test-results/main-update/review-screenshots/finance-refinement-touch.png)

Current-run logs and reports are under ignored `test-results/main-update/`. The validation-input manifest records hashes for 503 tracked frontend/backend/shared files so the final report commit can be checked against the code exercised by validation. Generated screenshots, builds, reports and dependency directories stay ignored.

## Historical validation at 0605867

These are historical results on the prior base, not results of this update:

- Complete final frontend coverage: 1,003 passed, one timeout and one existing optional trace test skipped. The unchanged Combined UI case exceeded its 5,000ms budget. All five tests in that file passed in the isolated coverage diagnostic.
- Complete browser suite: 102 passed and one timeout, including all 87 desktop cases. The unchanged mobile incident journey timed out waiting for stability at `scrollIntoViewIfNeeded()`. It subsequently passed unchanged twice, in 32.1 and 32.2 seconds.

Neither historical full suite is claimed as green. Isolated reruns establish non-reproduction only; no assertion or timeout was relaxed. The full old report is preserved in the backup commit (`git show fe/campaign-finance-main-backup-0605867:docs/CAMPAIGN_FINANCE_MAIN_INTEGRATION.md`); its original logs/reports remain under this worktree's ignored `test-results/`.

## Preservation and readiness

Final preservation checks confirm:

- Original `fe/campaign-finance-ux` worktree remains at `806cd3a`: all 17 original file hashes match `test-results/finance-snapshot/manifest.json`, and its original Git status matches `status.txt`.
- Original refinement worktree remains clean at `f34870c39895a9b5123b8760e52a4dc891d70a65`.
- Backup branch still points to `0605867ba0ce3deb961c584c4f33ba6ee13b3895`.
- All 503 tracked frontend/backend/shared validation-input hashes still match. Only this report changes after the validated code commit `32b8f7b`.
- The final diff against `75d486a` was reviewed; no conflict markers, whitespace errors, unrelated files, generated reports or dependency changes are included.

The local integration is complete and ready for contributor review with a disclosed validation limitation: the complete browser run retains one timeout despite two successful unchanged diagnostics. It is not a fully green browser regression result. Hosted CI on the eventual pushed commit must still pass; no hosted PR/CI outcome is claimed.

Hosted CI, Safari/Firefox, physical devices, real-provider authentication and human comprehension testing are not established by local Chromium/touch emulation. Both existing required CI gates and one reviewer approval remain required before any eventual merge. No push, PR creation, merge, deployment or live database migration was performed.

## Reproduction and preview

From PowerShell, use this integration frontend (not either original Finance worktree):

```powershell
cd C:\Users\user\99.9-Percent-Latest\test-results\campaign-finance-main\frontend
$env:PATH = "C:\Users\user\AppData\Local\npm-cache\_npx\52027bd8fc0022aa\node_modules\node\bin;$env:PATH"
npm run preview -- --host 127.0.0.1 --port 4188 --strictPort
```

Open http://127.0.0.1:4188 and start or continue Guided Mode. Browser saves are isolated by origin/port.

Check commands from `frontend/` are `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:coverage -- --maxWorkers=1`, `npm run balance` and `npx playwright test` (this run uses `PLAYWRIGHT_PORT=4191`). From `backend/`: `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test:coverage -- --maxWorkers=1` and `npm run db:generate`. The latter only checks/generates local migration files; it does not apply a live migration.

## Proposed PR text (local draft only)

Title: `feat(campaign): simplify Finance and keep purchase controls accessible`

Campaign finances were difficult to discover, and lengthy purchase confirmations could obscure their action buttons.

- Add a beginner-friendly Finance dashboard with four overview sections and collapsed Advanced details.
- Make the Cash card accessible by pointer, touch and keyboard.
- Show engine-derived purchase quotes, financial warnings, stale-quote review and duplicate-click protection.
- Add infrastructure explanations and reachable disabled-action reasons, retaining collapsed About Equipment disclosures.
- Keep desktop purchase panels on the left of the usable scene and mobile sheets above navigation, with persistent warnings and Confirm/Cancel controls.

Preserve equipment highlighting, camera focus, the shared tutorial confirmation observer, Health Checks guidance, chapter/menu behavior, latest routing choices, graphics improvements and walking inspections. Retain economic constants, settlement arithmetic, purchase rules and save contracts.

Validation on the rebased code: Node 22 lint/typecheck/build passed; targeted frontend 51 passed; complete frontend coverage 1,006 passed and one existing optional trace case skipped; balance 25 passed. Backend lint/typecheck and all 61 coverage tests passed; migration consistency found no schema changes. Complete desktop/touch browsers: **104 passed, one unchanged walking-audio timeout**, with all 17 touch cases passing. That walking case subsequently passed twice unchanged in isolation (38.6 and 33.6 seconds). The complete browser run remains failed; no assertion or timeout was relaxed.

Historical validation at `0605867` also had two complete-run timeouts: frontend coverage had 1,003 passes, one Combined UI timeout and one optional skip (all five unchanged Combined UI tests then passed in isolation); browsers had 102 passes and one mobile incident timeout (the unchanged case then passed twice in 32.1 and 32.2 seconds). Those isolated passes did not make either historical full suite green. The current full frontend run and current full-run mobile incident case passed as recorded above.

Hosted CI, real-device/Safari/Firefox checks and real-provider production authentication remain unverified. Original Finance worktrees are preserved. This local draft does not authorize a push, PR, merge or deployment.
