# Campaign App Health implementation and publication review

Branch: `fe/campaign-app-health`.
Worktree: `C:/Users/user/99.9-Percent-Health`.
Base: `80400fb9daba97006d9aa0f748ab8562483d322d`, containing merged Finance PR #90. Finalisation and publication are user-authorised; merging, manual deployment and production settings changes are not.

## Final experience

The existing Campaign headline card is now **APP HEALTH**, with dashboard title **App Health** and accessible action **View app health**. It reuses Stat, TooltipLayer, the shared Modal and Finance's portal/pause/focus-restoration pattern. Existing status values, heart/status icons and tone conditions remain. Phones retain the compact status-only header arrangement. A small App Health-only font adjustment below 360px keeps Healthy on one line without changing other cards.

The default dashboard has the current status and one short reason, latest-reading label, three measurements (Response time, Failed requests (%) and Requests waiting), one short interpretation and this direction: Compare App Server, Database and Monitoring in System Overview. No new permanent panel, inspection shortcut, purchase or upgrade recommendation is added. More details starts closed and holds definitions, technical terms, rejected requests, status limitations and recovery requirements.

Opening pauses via the existing store action. Closing leaves the company paused and restores focus. Enter/Space, hover/focus guidance, touch, Escape and modal Tab containment reuse existing behavior. Different company identity remounts the entry and closes the dashboard. Existing purchase confirmation, highlight and selection are retained while reading it. The spotlight yields to the shared modal backdrop and resumes at its existing step.

## Classification and measurements

The presentation model extracts these existing CampaignHeader rules unchanged, in order:

1. Incident during the incident phase.
2. Campaign complete for a won ended campaign; otherwise Bankrupt for an ended campaign.
3. Recovered during incident review.
4. At risk at snapshot latency >= 500 ms.
5. Traffic limited when a traffic limit is configured.
6. Healthy otherwise.

Tone and icon rules remain independently preserved, including review/completion cases whose latest response time still gives a warning tone/icon. Errors, waiting work and infrastructure faults add no new status conditions. Healthy therefore does not guarantee all machines or measurements are healthy.

Response time reads existing modeled latency. Failed requests reads serviceErrorRate, whose denominator is successful plus failed outcomes. Waiting and rejected requests are excluded. Requests waiting sums the existing application and database snapshot backlogs. Unavailable/non-finite measurements display Unavailable rather than zero. Rejected requests remain separate in More details.

The Healthy interpretation is No failed requests or waiting work in this snapshot only when the available readings support it. Recorded errors, queued work, rejected traffic and unavailable values produce appropriate alternatives. Problem copy explains possible slower customer responses and unprocessed requests without claiming queues are growing or identifying a bottleneck. Recovered says: Service recovered. The incident outcome is ready for review.

## Scope and preservation

Ten paths are included:

- `frontend/src/game/campaignAppHealth.ts` and its test.
- `frontend/src/components/CampaignAppHealth.tsx`, scoped CSS and component test.
- `frontend/src/components/CampaignUI.tsx`: replace the existing Health Stat/classification with AppHealthEntry.
- `frontend/e2e/appHealth.ts`, `appHealth.spec.ts`, and four additions in `mobile.spec.ts`.
- This report.

No diff in simulation, financial rules, store lifecycle, persistence/save formats, shared Stat/Modal, Classic implementation, Finance implementation, backend/shared contracts, dependencies, workflows or deployment settings. The complete diff was reviewed against 80400fb. Original Finance worktrees were not edited and retain their prior heads.

## Current validation

Final executables use **Node 22.23.3 directly**; the installed npm PowerShell launcher otherwise selects system Node 24. Dependencies are local to this worktree; manifests and lockfiles are unchanged.

| Check | Result |
| --- | --- |
| Focused model/component/Finance/Campaign UI/tutorial/inspection tests | 69 passed, 0 failed, 0 skipped across 7 files |
| Frontend lint, typecheck, production build | Passed |
| Final-wording selected browser run | 20 passed, 0 failed, 0 skipped in 7.7 minutes; retries disabled |
| Final layout rerun after <=360px App Health text-fit polish | 4 passed, 0 failed, 0 skipped in 1.5 minutes; retries disabled |

The 20-case run covers 1440x900, 1366x768, 390x844 and 320x844; Healthy and Incident dashboards, expanded details, hover/keyboard/touch, pause/focus restoration, Finance, purchases, spotlight, equipment inspection, walking, floor/elevator/camera controls, save/reload and a Classic tutorial/purchase/reload smoke case. Snapshot fixtures use normal engine steps and the standard replayable save envelope.

Screenshot review after the 20-case run caught a Healthy word break at 320px despite passing card-bounds checks. The final scoped CSS keeps that word on one line. A new initial height-based assertion then falsely rejected 390px due to a 1.095px difference between glyph height and computed line height: that diagnostic had 1 pass and 1 failure. The assertion now counts rendered text-line rectangles directly, retaining the no-wrap requirement. All four final layout cases passed. No assertion was weakened, test disabled, wait added or timeout increased. The 20-case batch predates this narrow-only CSS correction; it is not presented as a single complete final-code browser-suite run. Model and interaction logic did not change after the 69-test pass.

Fresh desktop/laptop/touch default, incident and expanded-detail screenshots were inspected. Default dashboards fit without scrolling and remain above the bottom toolbar at tested sizes; expanded content scrolls inside the shared modal with Close visible. At 320px the surrounding Cash icon/amount remains crowded; Finance is outside this change and was left untouched. App Health itself remains readable and bounded. This is a disclosed cosmetic limitation, not a claim that the entire 320px HUD is polished.

Evidence: ignored `test-results/app-health-final/unit.log`, `lint.log`, `typecheck.log`, `build.log`, `browser.log`, `browser-report/`, `browser-artifacts/`, `narrow.log` and its diagnostic report/artifacts, `narrow-final.log`, `narrow-final-report/` and `narrow-final-artifacts/`. The complete 20-case report is separate from the four-case rerun report.

## Historical evidence and remaining limits

Before final naming/copy, 65 focused tests passed and 19 distinct browser journeys were verified across staged runs. Those are historical results, not validation of final wording. Their earlier ambiguous-locator and non-replayable-fixture authoring failures remain recorded under ignored `test-results/app-health/`; the corrected cases passed. No historical failed batch is relabeled green.

Complete frontend/backend coverage, balance and the complete browser suite were intentionally not rerun locally for this scoped finalisation. Hosted CI must validate the pushed PR commit. Safari/Firefox, physical-device, real-provider authentication and human beginner-comprehension checks remain unverified. Chromium touch emulation is not physical-device testing. The earlier npm ci emitted one dependency advisory; no dependency versions changed.

## Main and review requirements

Fetched origin/main remained 80400fb at the pre-publication review. No teammate change or conflict required rebasing. A final mergeability check is performed before publication; main advancing alone does not authorise repeated integration cycles.

Effective GitHub rules require frontend and backend success, strict up-to-date merging, a PR, squash and linear history. GitHub currently configures zero mandatory approving reviews; repository AGENTS.md still calls for one reviewer approval before merge. Neither local passes nor PR creation authorise merging or deploying.

## Local screenshots and preview

Screenshots are ignored local review artifacts, not committed GitHub assets:

- [Desktop](../frontend/test-results/app-health-1440-default.png)
- [Laptop](../frontend/test-results/app-health-1366-default.png)
- [390px touch](../frontend/test-results/app-health-390-default.png)
- [320px touch](../frontend/test-results/app-health-320-default.png)
- [Touch incident](../frontend/test-results/app-health-390-problem.png)
- [320px expanded details](../frontend/test-results/app-health-320-details.png)

```powershell
cd C:\Users\user\99.9-Percent-Health\frontend
$healthNode = 'C:\Users\user\AppData\Local\npm-cache\_npx\52027bd8fc0022aa\node_modules\node\bin\node.exe'
& $healthNode node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4199 --strictPort
```

Open http://127.0.0.1:4199 and start/continue Guided Mode, then select the App Health card (Healthy initially). On phones the header shows the status value, consistent with the existing compact header. Saves are isolated by origin/port.
