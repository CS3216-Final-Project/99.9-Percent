# Chapter 1: verified prevention and reactive recovery

Local work on `fe/campaign-guidance-phase-3`. No commit or push is authorized. This report supersedes historical statements that prevention cannot unlock Scaling.

## Root cause and correction

Opening already recorded successful prevention, but live `acknowledge_prevention_review` did not award its milestone. Both `acknowledge_milestone` and `enter_scaling` required `recoveredOpening`, and replay explicitly removed unentered prevention milestones. The requirements and Hint text repeated that restriction.

`verifiedPrevention` now recognises the existing engine evidence: consumed Opening growth, post-growth Application and Database inspections, five consecutive recorded full-demand healthy observations with empty queues and no incident during qualification, qualification trace and outcome acknowledgement. Positive cash and the inactive traffic limit remain enforced by the unchanged qualification routine. A purchase alone never qualifies.

`completedOpening` accepts either the existing reviewed recovered-incident proof or this verified prevention proof linked to the existing Opening milestone. The prevention acknowledgement awards one pending milestone; the player must still acknowledge its recognition before entering Chapter 2. No incident, recovery flag or postmortem is manufactured. Reactive recovery and its report acknowledgement retain their existing requirements.

## Player paths and feedback

1. **Prevention:** prepare capacity → actual Opening growth → inspect Application and Database after growth → serve all 800 requests/s with healthy service and empty queues for five fresh observations → acknowledge Prevention review → acknowledge Opening recognition → Scaling & Routing.
2. **Recovery:** actual incident → diagnose/respond → five qualifying recovery observations → review and acknowledge the real postmortem → acknowledge Opening recognition → Scaling & Routing.

The existing recognition panel displays respectively:

- “You spotted the bottleneck early and prevented an outage.”
- “You diagnosed an outage and restored your service.”

Both use the shared compact report and one collapsed **View Technical Details** disclosure. Prevention recognition uses its original qualification evidence, excluding purchases made afterward. Required review/recognition takes priority over optional Run/Hint attention; continuation uses existing controls.

## Existing saves and preservation

Save schema remains 7; no persisted field or action was added. Older acknowledged prevention logs may contain later time and actions which were legal under the former gate. Replay defers the new award through that historical portion, then offers the missing recognition at the saved management step. Loading does not silently enter Chapter 2 or alter cash, infrastructure or elapsed time. An active incident/review retains priority; its actual review is completed before recognition is offered. Already-entered historical prevention companies remain supported. Corrupt/unacknowledged prevention histories are not treated as verified completion.

Repository-required refresh found one upstream scene-furniture commit, `cbd006af39d3754102406b88a21e229ee298d4d8`. Rebase completed without conflicts. All 48 pre-existing pending files were restored and verified against their original raw SHA-256 hashes before this task's edits. The retained `phase3 prevention progression pre-cbd006a safety` stash and earlier stashes remain available. Other worktrees were not modified.

## Files in this correction

- Engine: `frontend/src/sim/openingPrevention.ts`, `step.ts`, `replay.ts`.
- Presentation: `frontend/src/game/campaignGuidance.ts`, `campaignAttention.ts`, `campaignReport.ts`, `frontend/src/components/CampaignUI.tsx`.
- Regressions: Opening prevention engine/save/component/requirements tests; `openingCompletion.test.ts`; reusable `__fixtures__/openingOutcome.ts`; shared report tests; browser prevention, recovery and legacy recognition journeys including mobile.

No costs, cash grants, bankruptcy rules, Chapter 0 rules, Classic rules, later chapter gates, backend or save schema were changed. Previous Chapter 4/6 guidance and shared report work remains local.

## Validation

Node **22.23.3**, one unit/browser worker. The initial six-file engine/save/component/requirements/report batch passed **90 tests**. After the final report scoping, requirements copy and additional Chapter 2 continuation case, the three affected files passed **58 tests**. These overlap: **91 distinct Chapter 1 cases** have passing verification across the two batches, rather than 148 distinct cases. Coverage includes both acknowledgements, reactive recovery, rejected incomplete/fabricated evidence, saved continuation, old schemas 1/4/6/7, later historical actions/time, Chapter 0 practice/clock hold and Classic isolation.

The optional full frontend `npm test -- --maxWorkers=1` sweep was stopped after over 20 minutes while still progressing. It is **incomplete**, not a green full suite. Four existing UI cases reported their unchanged five-second timeout:

- `IncidentPause`: later distinct incident after free recovery; running Chapter 6 incident with captured mouse.
- `CampaignTutorial`: Stay Online Health Checks guide.
- `Chapter6Guidance`: Network → Remove → Confirm → accepted Run and cancellation.

The first focused rerun also timed out on all four. A comparison using the preserved pre-task runtime through an ignored transform passed all four; a subsequent **current-runtime** rerun also passed all four, retaining every assertion and original timeout. This supports variable local timing, not a demonstrated Chapter 1 regression. No timeout, retry, skip or test assertion was loosened. Fifty-four unselected cases were filtered by the focused command, not newly skipped in source. The comparison did not replace or edit working source, and its config/runtime snapshot remains ignored.

Initial and final frontend lint/typecheck and the final production build passed. The existing large-Facility-chunk advisory remains. The dedicated `npm run balance -- --maxWorkers=1` passed **25 tests in seven files** (335.94 seconds), including growth-wave peak/duration/order bounds and existing scripted strategies. These are regression evidence, not proof that every inherited company is winnable.

The final production build passed **six desktop browser journeys** in one batch (5.7 minutes), plus **one touch journey** (39.2 seconds), all with retries 0 and actual WebGL:

- Fresh player completes mandatory Chapter 0, proactively prepares, performs both inspections and five fresh observations, reloads partial verification/outcome/recognition and explicitly enters Scaling without an incident or API.
- Legacy acknowledged prevention preserves later time, cash and added server; recognition/reload/technical disclosure/continuation work at 320px.
- Real database-upgrade and traffic-limit incident recoveries retain notice → postmortem → recognition → Scaling, evidence inspection, focus, reload and the exact recovery feedback.
- Chapter 0 replay remains a separate visible practice during an incident at 1440px.
- Classic incident transport retains its existing footprint and controls at 1440px.
- Touch at 390px preserves prevention review, acknowledgement, saved recognition and explicit Scaling entry.

The fresh-player test took three minutes including the existing independently bounded mandatory Chapter 0 setup. Neither that helper nor any journey/assertion budget was increased. Manually inspected the 320px recognition capture: exact prevention feedback, actual database-upgrade response, compact shared sections, collapsed technical details and visible Continue operating. The body scrolls on the narrow screen while its continuation footer stays visible.

Artifacts and the pre-fix runtime comparison remain ignored under `test-results/opening-prevention-progression/`. No full coverage, full browser sweep, CI, backend, Safari/Firefox, screen-reader or real-device acceptance is claimed. The incomplete full frontend sweep and its original timeout failures remain a validation limitation despite passing focused corrections.

Focused unit commands, from `frontend/`, with Node 22 on PATH:

```powershell
npm test -- --maxWorkers=1 src/game/openingCompletion.test.ts src/sim/__tests__/openingPrevention.test.ts src/game/openingPrevention.test.ts src/game/campaignGuidance.test.ts src/components/OpeningPrevention.test.tsx src/game/campaignReport.test.ts
npm test -- --maxWorkers=1 src/game/openingCompletion.test.ts src/game/campaignGuidance.test.ts src/game/campaignReport.test.ts
npm test -- --maxWorkers=1 src/components/IncidentPause.test.tsx src/components/CampaignTutorial.test.tsx src/components/Chapter6Guidance.test.tsx --testNamePattern 'offers Pause for a later|marks a running Chapter 6 incident with the mouse captured|walks Stay Online|transfers selected Network'
```

The first command preceded the extra Chapter 2 continuation case; the second checks the final ten-case completion file and the two final guidance/report files.

Browser commands, from `frontend/`, Node 22, `PLAYWRIGHT_PORT=4197`:

```powershell
node node_modules/@playwright/test/cli.js test prevention.spec.ts openingCompletion.spec.ts incidentRecovery.spec.ts campaignTutorial.spec.ts controls.spec.ts --project=chromium --grep 'Opening prevention:|Opening legacy prevention:|recovery report:|A saved Chapter 0 replay.*1440|Challenge incident transport.*1440' --retries=0 --output=../test-results/opening-prevention-progression/browser-desktop-artifacts
node node_modules/@playwright/test/cli.js test mobile.spec.ts --project=mobile-chromium --grep 'Opening prevention recognition unlocks' --retries=0 --output=../test-results/opening-prevention-progression/browser-touch-artifacts
```

Final Git hygiene: 60 intentional pending paths, including all 48 earlier paths (41 unchanged byte-for-byte, seven intentionally updated by this task). No original path was removed. Whitespace check passes; nothing staged or unmerged. Branch HEAD matches the fetched `origin/main` at `cbd006a`. Safety stashes, earlier backups and other worktrees remain preserved. No feature commit, push or PR was created.
