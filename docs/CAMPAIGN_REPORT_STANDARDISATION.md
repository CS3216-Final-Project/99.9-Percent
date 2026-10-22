# Phase 3: consistent Campaign reports

Local presentation work on `fe/campaign-guidance-phase-3`, based on `f05da9d4ddedc63d46a23d25bbe8a298572cdb5a`. The initial fetch confirmed HEAD and `origin/main` match. Existing Chapter 4/6 improvements, local files, backups and three safety stashes are preserved. Nothing is staged, committed or pushed.

## Audit and resulting behaviour

Previously, incident reports, prevention reviews, chapter completions, reliability outcomes, growth reviews and scorecards used different structures. Some exposed long technical explanations immediately, while others contained several or nested evidence disclosures. All now reuse `CampaignReport` with four short primary sections: **What happened?**, **How did you respond?**, **What could be improved?**, and **Key takeaway**. An unsupported improvement can be omitted rather than invented.

Each report has exactly one native **View Technical Details** accordion, collapsed initially and after reload. Existing explanations, timestamps, IDs, spending, request counts, workload observations, event records and scorecard metrics remain available there. Incident observation/event JSON is retained without another nested disclosure. History still allows selecting individual reports; this does not create extra technical accordions inside a report.

| Location | Presentation and preserved action |
| --- | --- |
| Chapter 1 incident/recovery | Shared incident summary; existing recovered notice, View Incident Report and Continue company sequence |
| Chapter 1 prevention/milestone | Shared outcome summary; existing prevention and milestone acknowledgements |
| Chapters 2/3 completion | Shared summary tailored to routing/database learning; Stay and Continue actions unchanged |
| Chapter 4 spike recognition | Shared outcome summary, including observed rejection; existing spike acknowledgement |
| Chapter 5 outcome and related incidents | Actual failure, requested restore/natural return/failover and traffic trade-off; original review acknowledgement |
| Chapter 6 growth outcomes | Actual round and full-demand verification; existing growth acknowledgement |
| Final review/completion, bankruptcy and scorecards | Compact outcome summary; all previous scorecard evidence and explicit completion/inspect/export actions |
| Incident history and tutorial/practice reports | Shared report body; existing history selection and tutorial/practice acknowledgement behaviour |

The short **System Recovered!** notice remains a preliminary acknowledgement, followed by the standard report. Opening a report never acknowledges its engine outcome. Continue/Complete controls remain outside the scrolling report body; short phone screens may scroll the summary and evidence while keeping the action reachable. Warm Desk colours, fonts and keyboard focus treatment are reused.

## Evidence accuracy

Summaries distinguish accepted requests from actual activations. Installed equipment alone does not prove a purchase or recovery action. Natural server return and automatic spare promotion are distinct from a requested restore. Historical outcomes are bounded by their recorded completion and entry events, including event order within one game second, so a pre-entry or later action is not attributed to the chapter. The final growth round points towards final goals rather than an invented fourth wave.

Substantial rejection remains visible in the summary: at least 10% of incoming requests in retained observations earns the qualitative “Many incoming requests…” note. This is presentation classification, not an engine threshold. Exact recorded counts stay in technical details. Aggregate scorecards describe recorded outcomes rather than inventing recovery strategies. Missing historical evidence is identified conservatively.

Prevention still explains its existing limitation: it does not unlock Scaling's recovered-incident route. No chapter gate, simulation formula, finance rule, save schema, recorded event or acknowledgement predicate changed. The previously documented Chapter 6 financial limitation remains outside this work.

## Example before/after

Previously, the Opening database report immediately mixed capacity/backlog figures, game-second timestamps, spending and several explanations. The same actual database-upgrade recovery now reads:

- **What happened?** The database could not keep up with the work reaching it, causing delays.
- **How did you respond?** Recorded responses included a database upgrade.
- **What could be improved?** More database capacity adds ongoing costs; leave room for future traffic.
- **Key takeaway** One overloaded component can slow down the whole app.

The $3,000 setup spending, 600-to-1,000 capacity change, timing, queue observations and complete recorded evidence remain in **View Technical Details**. A traffic-limited recovery adds a visible rejection trade-off; a reliability outcome uses its actual requested restore, natural return or recorded failover instead of the database wording.

For the tested manual reliability outcome, the former server identity/timing-led report becomes:

- **What happened?** A server failed and a service incident was recorded.
- **How did you respond?** You requested a free server restore.
- **What could be improved?** Health Checks can help detect failures sooner; detection still needs healthy capacity and safe routing.
- **Key takeaway** Restoring a server and recovering service are separate steps; verify both.

Its failure identity, detection/restoration timestamps, spending and recorded observations remain in the same single technical accordion.

## Files touched by this report-standardisation task

This list distinguishes the current task from the pre-existing Chapter 4/6 pending work; some listed files already contained approved local edits.

Production presentation:

- `frontend/src/game/campaignReport.ts` — pure evidence-to-summary adapter.
- `frontend/src/game/reliabilityLesson.ts` — shorter reliability sentences, with server identity retained in technical evidence.
- `frontend/src/components/CampaignReport.tsx` — shared sections and single disclosure.
- `frontend/src/components/useReportTechnicalOpen.ts` — disclosure context for focusable evidence.
- `frontend/src/components/CampaignIncidentReport.tsx` — common incident body, complete evidence and unchanged recovery notice flow.
- `frontend/src/components/CampaignIncidentReport.css` — shared compact spacing and scrolling/footer layout.
- `frontend/src/components/CampaignScorecard.tsx` — common summary above the original scorecard evidence.
- `frontend/src/components/CampaignUI.tsx` — migrate outcome/review render paths while preserving store actions.

Tests/helpers:

- `frontend/src/game/campaignReport.test.ts`.
- `frontend/src/game/reliabilityLesson.test.ts`.
- `frontend/src/components/CampaignReport.test.tsx`.
- `frontend/src/components/CampaignIncidentReport.test.tsx`.
- `frontend/src/components/CampaignRefinement.test.tsx`.
- `frontend/src/components/ReliabilityClarity.test.tsx`.
- `frontend/e2e/campaignReports.spec.ts` and `frontend/e2e/campaignReports.ts`.
- `frontend/e2e/incidentRecovery.ts`.
- `frontend/e2e/reliabilityClarity.spec.ts` and `frontend/e2e/reliabilityClarity.ts`.
- `frontend/e2e/combined.spec.ts` and `frontend/e2e/mobile.spec.ts`.

Report: `docs/CAMPAIGN_REPORT_STANDARDISATION.md`.

## Validation

Node **22.23.3**. Focused validation only; no full coverage or exhaustive browser suite is claimed.

| Check | Result |
| --- | --- |
| Report/progression unit and component batch, 13 files, one worker | **118 passed** |
| Existing Hint/Confirm priority component tests | **27 passed** |
| Final summary/shared-report rerun after boundary and final-wave refinements | **12 passed**, including two added boundary cases; **147 distinct focused cases** have passing verification across these runs |
| Final frontend lint / typecheck / production build | Passed; lint has no warnings; existing large Facility chunk build advisory remains |
| Initial focused real-room desktop/touch browser batch | **9 passed / 3 failed**, 12 journeys |
| Final affected browser correction batch, retries 0 | **9 passed**, 2.3 minutes |
| Git hygiene | `git diff --check` passed; nothing staged or unmerged; simulation/store/persistence/backend/shared/workflow paths unchanged |

All **12 distinct browser journeys** have passing verification across the initial and corrective runs. This is not a claim of one green 12-case batch or a green entire browser suite. The three failures were stale expectations for the old generated response wording in the shared recovery helper (desktop database, desktop limited and 320px limited). Those now assert the new visible factual response; all original detailed-evidence, keyboard focus, reload, same-company, cash/time and explicit-acknowledgement checks remain. No retry, skip, forced click, assertion timeout or gameplay expectation was weakened. Original traces and failures remain under `test-results/phase3-reports/browser-artifacts/`; passing corrections are under `test-results/phase3-reports/browser-corrections-artifacts/`.

Focused units cover actual prevention, manual database recovery, requested versus natural restoration, recorded failover, traffic rejection, scaling/routing, growth, final acknowledgement, incomplete evidence and historical boundaries. The no-incident scorecard case is a presentation boundary using an engine-captured record; it does not establish an incident-free full Campaign route. Existing chapter-completion, prevention, incident-Pause and Chapter 6 guidance tests also passed. The initial sandbox test start was blocked by child-process EPERM; the permitted retry ran normally. Earlier diagnostics found copy expectations and the deliberately capped three-item strategy list; the final tests and evidence ordering were corrected before passing validation.

Browser command from `frontend/`, Node 22, `PLAYWRIGHT_PORT=4197`:

```powershell
node node_modules/@playwright/test/cli.js test campaignReports.spec.ts reliabilityClarity.spec.ts incidentRecovery.spec.ts mobile.spec.ts --grep 'Campaign report:|Chapter 5 clarity:|recovery report:.*(database|limited|320px)' --retries=0 --output=../test-results/phase3-reports/browser-artifacts

node node_modules/@playwright/test/cli.js test campaignReports.spec.ts incidentRecovery.spec.ts mobile.spec.ts --grep 'Campaign report:|recovery report:.*(database|limited|320px)' --retries=0 --output=../test-results/phase3-reports/browser-corrections-artifacts
```

Manually inspected desktop spike/final-review and 320px reliability/final-review captures. Browser captures wait for fonts before review screenshots. Long technical evidence remains scrollable; a short phone cannot display the entire summary and evidence simultaneously. Browser verification uses Chromium desktop and touch emulation, not real devices, Safari/Firefox or a screen reader. Backend and balance commands were not rerun because this task changes only frontend presentation. All screenshots, builds and traces remain ignored. The earlier Chapter 4/5 report's report-label/layout descriptions are historical; this document supersedes them.
