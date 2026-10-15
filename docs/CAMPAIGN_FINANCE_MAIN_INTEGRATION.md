# Campaign Finance integration onto current main

Branch: `fe/campaign-finance-main`.
Worktree: `C:/Users/user/99.9-Percent-Latest/test-results/campaign-finance-main`.
Base: `2df332ab62bf4504e19f57717c3db33cc291f5d4` (`origin/main` when approved).
Finance source: completed frontend changes between `27de0bc` and `f34870c`, including dashboard refinement `286418e` and the purchase-panel layout repair.

## Integration

This branch starts directly from current main. It does not merge or transplant the temporary integration history. The Finance-only frontend patch was applied with three-way context. One conflict in `CampaignUI.tsx` was resolved by combining main's `tour="deploy-checks"` marker with typed Finance decisions for Health Checks, spares and failover. Neither side was selected wholesale.

Main's spotlight framework and shared confirmation observer, Health Checks Tech/unlock/deploy guide, `installPending()` gating, chapter-bar Next action, chapter-completion dialogs, menu Account tab and vertical arrow-key navigation remain. Analytics privacy, tutorial/store/persistence lifecycle, account contracts and save schemas remain main's implementation. The only changes in `TechTree.tsx` and `scene/Facility.tsx` are the preserved unavailable-action explanation and equipment tooltip additions.

This retains #71's spotlight/tutorial observer, #77's Do Not Track/Global Privacy Control behavior, #79's menu/account navigation, #81's chapter-bar Next, #83's completion recognition and #84's Health Checks guidance. The analytics, store/persistence, chapter-bar, tutorial and menu-tab implementation files have no diff from `2df332a`; shared component edits were reviewed separately.

Finance retains the beginner dashboard, clickable Cash card, Advanced details, real/estimated financial separation, engine-derived action reasons, quoted purchase preview, stale-preview review and repeat-click guard. About Equipment remains initially collapsed. The shared settlement helper is exactly the preserved Finance version; no additional simulation formulas, costs, timing or financial rules were changed during integration.

## Purchase placement

The latest purchase card remains the sole confirmation component. To meet the new placement requirement, desktop cards use the left edge of the usable scene for every action, rather than switching sides according to the marker. They follow the affected machine vertically and remain bounded above floor/camera/navigation controls. Existing camera focus and equipment highlighting remain. Narrow screens use the same compact sheet above controls and temporarily hide the inspector while it is open, restoring it and focus on cancellation.

Essential quotes, live refusal reasons, warnings and Confirm/Cancel stay outside the optional scrolling More details area. Layout journeys check the left-edge coordinate, whole card bounds, warning/button hit targets, expansion, camera rotation, resize and highlighting. Additional engine-generated chapter fixtures cover scaling, load balancing, cache installation/tuning, autoscaling, Health Checks, spares and failover. Database and traffic-limit checks run with App Server checks at desktop, laptop and phone sizes.

The expanded action sequence exposed a real highlight ownership problem: pointer entry highlighted Traffic Limiting, then the previously focused Database button blurred and erased it before the click. Because the highlight boolean stayed true across opening, the effect did not reapply it. All actions now observe the existing shared confirmation label; the open decision takes priority over hover, opening explicitly reapplies its highlight, and another action's cleanup cannot erase it. The shared observer itself and simulation/store APIs are unchanged. A component regression reproduces that event order, and desktop/laptop/mobile action sequences cover the visible result.

## Validation

All commands use the isolated Node 22.23.3 runtime. Frontend dependencies were installed independently with `npm ci`; manifests and lockfiles were not edited. An initial `npm ci` invocation at the worktree root failed because there is no root npm package; installation was then run successfully in `frontend/`.

| Final check | Result |
| --- | --- |
| Frontend lint, typecheck and production build | Passed |
| Complete serial frontend coverage | 1,003 passed; 1 timeout; 1 existing optional trace test skipped |
| Isolated unchanged Combined UI file with coverage | All 5 passed |
| Balance | All 25 passed |
| Complete desktop/mobile browser suite | 102 passed; 1 mobile timeout; all 87 desktop cases passed |
| Unchanged mobile incident diagnostic, repeated twice | Both passed, 32.1 and 32.2 seconds |

The complete coverage and browser runs are **not claimed as green**. Both timed-out cases passed separate unchanged diagnostics, which establish non-reproduction in those runs rather than erasing the complete-run failures.

Initial validation before the highlight repair passed lint, typecheck, build and complete serial coverage: **1,003 tests passed; one existing optional trace test skipped**, across 92 passed files and one skipped file, in 444.25 seconds. Engine, persistence/replay, Finance safety, chapter progression, Health Checks guidance, menu navigation and analytics/privacy regressions are included. This is a pre-repair result; final full coverage is run again below. Dependency sourcemap/deprecation warnings were emitted; no assertion or timeout was weakened.

The standalone balance run passed all 25 tests. The first targeted browser run had 7 passes and 3 failures: the two desktop/laptop sequences exposed the highlight bug, while the Health Checks fixture incorrectly resumed an already-entered chapter and thus never triggered its entry-only guide. That fixture now enters Stay Online through the public chapter-bar Next action. Initial diagnostics are retained under `test-results/targeted-initial/`. The first ownership-only repair still failed the two desktop checks; tracing established the missing opening transition, which the final repair addresses. No assertion or timeout was relaxed.

After the final highlight repair, lint/typecheck/build and all 34 focused Finance/tutorial/refinement tests passed. Its targeted browser run had 9 passes and one scaling/layout failure during a roughly 15-minute tool interruption. That failure is retained under `test-results/targeted-interrupted/`; it is not relabeled a pass. Full final coverage and the complete browser suite were run afterward on the final code. Earlier passes do not substitute for those results.

Final complete serial coverage finished with **1,003 passed, one timeout failure and one optional trace test skipped**, across 93 files, in 782.84 seconds. The failure was `CombinedUI.test.tsx`'s unchanged “dismissed growth review remains a visible required action and freezes the clock” case, exceeding its existing 5,000 ms budget. All five Combined UI tests then passed unchanged in an isolated coverage diagnostic (19.33 seconds for the file). No timeout or assertion was changed. This does not turn the failed complete run into a pass; the final complete coverage result is not green. Logs are `test-results/frontend-coverage-final.log` and `test-results/combined-isolated-coverage.log`. The coverage directory now represents the isolated diagnostic, not full-suite coverage.

The complete browser suite finished in 46.1 minutes with **102 passed and one timeout**, including all 87 desktop journeys and 15 of 16 mobile journeys. Every new purchase layout/highlight test and the Health Checks Tech-to-deployment walkthrough passed in that full run. Finance/spotlight interaction, Cash keyboard/touch access, chapter completion/Next, account/menu flows, complete same-company progression, financial safety, Classic, save/replay, camera and walking checks passed.

The one failure was the unchanged mobile “investigates and responds through the incident panel on touch” case at `scrollIntoViewIfNeeded()`, waiting for an element to be stable. Its existing 60-second budget expired during a tool call that stalled for about 223 seconds; the case reported 3.3 minutes elapsed. This timing coincidence is recorded, not treated as proof of cause or as a passing result. The complete browser run is not green. Its log is `test-results/browser-full-final.log`, with HTML report at `test-results/browser-full-report/` and original screenshots/trace at `test-results/browser-full-artifacts/`. Subsequent diagnostics do not replace this complete run.

The same mobile journey passed unchanged in both isolated repetitions, in 32.1 and 32.2 seconds (1.2 minutes for the command). Its log is `test-results/mobile-incident-isolated.log`; its separate HTML report is `test-results/mobile-incident-diagnostic-report/`. No assertion, viewport, timeout or gameplay rule was changed to obtain these results.

Reproduction commands from `frontend/`, with Node 22 on PATH:

```powershell
npm ci
npm run lint
npm run typecheck
npm run build
npm run test:coverage -- --maxWorkers=1
npm run balance
$env:PLAYWRIGHT_PORT = '4189'
npx playwright test
```

## Preservation and scope

Both original worktrees remain in place. Final preservation checks confirm the original worktree stays at `806cd3a` with all 17 original file hashes and its original Git status matching the saved snapshot; the refinement worktree stays clean at `f34870c`. Historical temporary-integration reports remain in their original worktree; this report documents this exact result. The final diff against `2df332a` contains only the Finance frontend implementation, its integration/layout regressions and this report (26 files). No temporary merge history was carried over.

No push, PR creation, branch merge or deployment is authorized or performed. Backend, migrations, shared contracts and deployment settings are unchanged. Browser checks use Chromium and touch emulation, not Safari, Firefox or physical devices. Hosted CI and real-provider production authentication are not claimed.

The two complete-run timeout results remain validation limitations. Existing frontend/backend CI gates and reviewer approval must still pass before any eventual merge; isolated diagnostics are not a substitute.

## Review artifacts

Reviewed default and expanded purchase cards at 1440x900, 1366x768 and 390x844, including resize/camera changes, plus the desktop and touch Finance dashboards. Copies are retained in ignored `test-results/review-screenshots/`. Examples:

- [Desktop Finance](../test-results/review-screenshots/finance-refinement-desktop.png)
- [Touch Finance](../test-results/review-screenshots/finance-refinement-touch.png)
- [Desktop expanded purchase](../test-results/review-screenshots/purchase-1440x900-expanded.png)
- [Laptop expanded purchase](../test-results/review-screenshots/purchase-1366x768-expanded.png)
- [Touch expanded purchase](../test-results/review-screenshots/purchase-390x844-expanded.png)

From `frontend/`, inspect the preserved complete browser report with `npx playwright show-report ../test-results/browser-full-report`. The default `frontend/playwright-report` is overwritten by the subsequent diagnostic run.

## Local preview

From PowerShell:

```powershell
cd C:\Users\user\99.9-Percent-Latest\test-results\campaign-finance-main\frontend
$env:PATH = "C:\Users\user\AppData\Local\npm-cache\_npx\52027bd8fc0022aa\node_modules\node\bin;$env:PATH"
npm run preview -- --host 127.0.0.1 --port 4188 --strictPort
```

Open http://127.0.0.1:4188 and start or continue Guided Mode. This worktree has its own dependencies and production build. Local browser saves remain isolated by origin and port.
