# Chapter 4 Run / Hint attention correction

Local work on `fe/campaign-guidance-phase-2`. The initial fetch found upstream `e8c4238` (logo font only). The required `git rebase --autostash origin/main` completed without conflicts and restored all four existing local Pause-fix paths. No feature commit or push was made. Frontend dependencies were installed from the upstream lockfile with Node 22.23.3.

## Audit and correction

The existing resolver already gives observed database/application overload, routing problems and unresolved incidents priority over Chapter 4's pulse schedule. Accepted relevant activation, measured drainage and qualifying recovery can legitimately select Run before the chapter-specific branch. Mandatory reviews and immediate Pause/Confirm remain higher-priority UI owners.

The Chapter 4 branch itself used only `step < final deadline` to recommend pulse time, and only unfinished completion plus baseline traffic to recommend stability time. If neither matched, it continued into older chapter scheduling rules. These are insufficient positive evidence when progression/scheduling records disagree.

The correction is confined to that resolver branch:

- Pulse Run requires an unfinished stage and an actual future, unconsumed pulse event.
- Baseline Run requires the final deadline to have passed and management phase, in addition to baseline traffic and the existing earlier healthy-service, empty-queue and acknowledged-report checks.
- Otherwise, Chapter 4 ends in Hint pointing to the existing View chapters control instead of falling through into earlier chapter guidance.

Observed overload still receives the existing short action explanation. In the engine-generated browser fixture, affordable extra application capacity selects Add server: Hint -> Got it -> Add server -> immediate Confirm. Accepted actions trigger the existing recalculation; guidance does not purchase, connect equipment or run the company automatically. No simulation, chapter gates, costs, saves, header, styling or timer changes were made.

No failing player save was supplied. The audit demonstrates the permissive scheduling/fallthrough paths and tests contradictory scheduling evidence explicitly; it does not establish which saved state produced the user's original symptom. Normal scheduled pulses remain valid Run opportunities, and autoscaling remains optional.

## Validation

Focused tests: **100 passed in six files**, 77.80 seconds. Five new resolver cases cover scheduled events versus already-consumed records, real engine baseline-counter advancement, non-management baseline evidence, overloaded applications/action selection, and recognition/Next priority.

The first focused run had 98 passes and two failures: the new fixture expectation incorrectly assumed traffic limiting instead of the existing valid Add server recommendation; an existing fixture-heavy routing test exceeded its unchanged five-second limit. Correcting only the new expectation and rerunning the unchanged existing test produced the passing result above. No timeout or assertion was weakened.

Frontend lint, typecheck and production build passed. The existing large Facility-chunk advisory remains. No runtime source changes followed the build.

**Six browser journeys passed in one batch**, 2.5 minutes, retries 0, real WebGL room: the two new Chapter 4 investigation/baseline journeys, existing scheduled-pulse idle Run, shared immediate Add server confirmation, Chapter 4's overview incident arrival and its native captured-mouse arrival/Escape/Pause flow. The investigation journey checks 9,999 ms with no gold then 1 ms to sole Hint, one short explanation, Got it -> Add server -> sole immediate Confirm, unchanged company inputs/time until confirmation and a real accepted pending action. The baseline journey checks sole idle Run and an actual increment of the engine's stability counter after running. No test timeout, assertion, skip or retry policy was weakened.

Commands from `frontend/`, Node 22:

```powershell
npm test -- --maxWorkers=1 src/game/chapter4Attention.test.ts src/game/campaignAttention.test.ts src/components/CampaignAttention.test.tsx src/game/incidentPause.test.ts src/components/IncidentPause.test.tsx src/components/idleAttention.test.ts
npm run lint
npm run typecheck
npm run build
node node_modules/@playwright/test/cli.js test campaignAttention.spec.ts incidentPause.spec.ts --project=chromium --grep 'guidance Chapter 4|incident Pause: immediate running Chapter 4|incident Pause: first-person Chapter 4|action confirmation shared immediate gold: Add server' --retries=0 --output=../test-results/chapter4-attention/browser-artifacts
```

Browser port: `PLAYWRIGHT_PORT=4197`. Artifacts remain ignored under `test-results/chapter4-attention/`. This selection uses desktop Chromium; it does not establish mobile, Safari/Firefox, real-device or screen-reader acceptance for this change.

The four pre-existing local Pause-fix files were compared against the automatically preserved pre-update work and match exactly. The four additional paths for this task are `frontend/src/game/campaignAttention.ts`, `frontend/src/game/chapter4Attention.test.ts`, `frontend/e2e/campaignAttention.spec.ts` and this report. Final `git diff --check` passed; no staged or unmerged paths. The branch matches freshly fetched `origin/main` at `e8c4238`. This report describes focused frontend checks, not backend/full-coverage or complete browser-suite acceptance. Nothing is staged, committed or pushed; no other worktree was modified.
