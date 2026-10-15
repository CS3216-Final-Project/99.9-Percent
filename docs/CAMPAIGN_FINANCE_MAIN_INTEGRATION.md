# Campaign Finance publication readiness

Branch: `fe/campaign-finance-main`.
Worktree: `C:/Users/user/99.9-Percent-Latest/test-results/campaign-finance-main`.
Approved base: `065b047d1d38b5883591b61b68cdb120c2af060a`.
Validated code snapshot: `16423f9` (the final report commit changes documentation only).
Pre-update backup: `fe/campaign-finance-main-backup-5f63f52` at `5f63f52dd121d3210a0af0ceb7b3303db0a553a6`.
The earlier backup `fe/campaign-finance-main-backup-0605867` remains available.

## Integration and scope

Rebased the two Finance integration/report commits onto the approved main. The only conflict was the `CampaignUI.tsx` import block: retain `AccountSection, CloudSavesSection` from main together with `FinanceEntry`, the infrastructure/disabled-action helpers and infrastructure descriptions from Finance. Main's Cloud Saves section remains in the Saves tab; Account remains in its own tab.

PR #86's Cloud Saves implementation and PR #88's walking destination marker implementation are unchanged from main. The marker still follows the actual planned path, respects reduced motion, clears when the path ends and does not intercept room raycasts. The diff was reviewed against `065b047`; no teammate implementation was replaced wholesale.

Finance retains the four-section dashboard, collapsed Advanced details, clickable keyboard/touch Cash card, actual/estimated accounting distinction, engine-derived purchase quotes and refusal reasons, warnings, stale-quote review, duplicate-click protection, infrastructure tooltips and closed About Equipment disclosure. Desktop purchase cards stay on the left of the usable scene; mobile sheets remain above navigation. Warnings and Confirm/Cancel remain outside optional scrolling details. Equipment highlights and camera focus remain.

The spotlight/shared confirmation observer, Health Checks guidance, chapter Next/completion behavior, routing selection, analytics privacy, menu/account navigation, graphics improvements and walking inspections remain. The purchase, positioning and Finance calculation implementations are unchanged from `5f63f52`.

Scope remains **27 files: 26 frontend files and this report**. Backend, shared contracts, dependency manifests/locks, workflows, deployment settings, main's store/persistence/simulation step, graphics profiles, Account/Modals and Avatar/palette implementations have no diff from updated main. The only simulation-file diff is the previously approved `sim/settlement.ts` helper extraction, unchanged from the validated Finance version. No new formulas, costs, timing, bankruptcy rules, save schemas or replay formats changed.

## Focused validation on 065b047

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

Current logs and browser artifacts are ignored under `test-results/publication-065b047/`: `lint.log`, `typecheck.log`, `targeted-unit.log`, `build.log`, `backend-lint.log`, `backend-typecheck.log`, `backend-coverage.log`, `backend-migrations.log`, `browser-focused.log`, `browser-report/`, `browser-artifacts/` and `browser-exit.txt`. The input manifest records hashes for 503 tracked frontend/backend/shared files. Final comparison confirms zero differences across all 503 validation-input hashes; only this report changes after the validated snapshot.

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

Publication is authorized only after a final fetch confirms main is still `065b047`, a clean branch and no blocking conflicts. If main advances again, stop and report; do not automatically rebase again. Hosted `frontend` and `backend` checks, including complete frontend coverage and all browser shards, must pass on the published PR result. The repo workflow also calls for one reviewer approval before merge. No hosted CI success is claimed in this local report.

The complete local browser suite on the new base was intentionally not run; the previous complete run retains its timeout. Safari/Firefox, physical-device testing, real-provider production authentication and human comprehension testing remain unverified. No merge, manual deployment, production configuration change or live migration is authorized.

## Preview and evidence

```powershell
cd C:\Users\user\99.9-Percent-Latest\test-results\campaign-finance-main\frontend
$env:PATH = "C:\Users\user\AppData\Local\npm-cache\_npx\52027bd8fc0022aa\node_modules\node\bin;$env:PATH"
npm run preview -- --host 127.0.0.1 --port 4188 --strictPort
```

Open http://127.0.0.1:4188. The focused browser run uses port 4193. From `frontend/`, open its report with `npx playwright show-report ../test-results/publication-065b047/browser-report`. Prior inspected screenshots at 1440x900, 1366x768 and 390x844 remain in ignored `test-results/main-update/review-screenshots/`.

## PR description

Title: `feat(campaign): simplify Finance and keep purchase controls accessible`

Campaign finances were difficult to discover, and lengthy purchase confirmations could obscure their action buttons.

- Add a beginner-friendly Finance dashboard with four overview sections and collapsed Advanced details.
- Make the Cash card accessible by pointer, touch and keyboard.
- Show engine-derived purchase quotes, financial warnings, stale-quote review and duplicate-click protection.
- Add infrastructure explanations and reachable disabled-action reasons, retaining collapsed About Equipment disclosures.
- Keep desktop purchase panels on the left of the usable scene and mobile sheets above navigation, with persistent warnings and Confirm/Cancel controls.

Preserve equipment highlighting, camera focus, the shared tutorial confirmation observer, Health Checks guidance, chapter/menu behavior, latest routing choices, graphics improvements and walking inspections. Retain economic constants, settlement arithmetic, purchase rules and save contracts.

Rebased onto `065b047`, retaining PR #86's Cloud Saves in the Saves tab and PR #88's walking destination markers. The only conflict combined main's Cloud Saves import with Finance's imports. Scope is 27 files (26 frontend files and the integration report); no backend contracts, save schemas, dependency versions or deployment settings changed. The settlement helper extracts the previously approved recurring charges without new economic constants or settlement formulas.

### Validation on updated main (`065b047`)

Node 22.23.3, against code snapshot `16423f9`; the publication commit adds only the final report:

- Frontend lint, typecheck and production build passed.
- **81 targeted frontend tests passed** across 9 files: Finance, Campaign UI/refinement/tutorials, Account/Cloud Saves, App/menu behavior, accounting and walking paths.
- Backend lint/typecheck and **61 complete coverage tests passed**. Migration consistency found no schema changes or generated migrations.
- **18 focused browser journeys passed** in 6.1 minutes (15 desktop, 3 touch): Finance/Cash keyboard and touch access, spotlight coexistence, purchase quotes/safeguards and left-side panels at 1440x900, 1366x768 and 390x844, later-stage purchases/Health Checks guidance, Cloud Saves navigation/conflict/ownership/load, and equipment-directed walking/inspection.

The complete local frontend coverage, balance and browser suites were intentionally not repeated for this import-only update. Complete frontend coverage, all browser shards and the required `frontend`/`backend` gates remain pending in hosted CI; these focused passes are not a full-suite result.

### Previous complete-suite evidence (base `75d486a`)

- **1,006 frontend tests passed**, one existing optional trace test skipped; **61 backend tests** and **25 balance tests passed**.
- Complete browsers: **104 passed, one unchanged walking-audio timeout**. All 17 touch cases passed. The 180-second walking-audio test reported 20.7 minutes across a user/tool interruption; the cause is not established.
- That test subsequently passed twice unchanged in isolation, in **38.6 and 33.6 seconds**. The complete browser suite is **not green**; isolated diagnostics do not erase the failure. No assertion, timeout or gameplay rule was weakened.

Older `0605867` results remain disclosed in the integration report: a Combined UI full-coverage timeout and a mobile-incident full-browser timeout both passed unchanged isolated diagnostics, without turning those full runs green.

Original Finance worktrees and backup references are preserved. Hosted CI, Safari/Firefox, physical-device testing and real-provider production authentication are not established by local checks. The repository workflow calls for one reviewer approval before merging. No merge or production deployment is part of this PR.
