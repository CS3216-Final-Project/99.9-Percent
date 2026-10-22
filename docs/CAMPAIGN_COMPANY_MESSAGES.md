# Phase 3: company colleague introductions

Local implementation on `fe/campaign-guidance-phase-3`. Initial required fetch confirmed HEAD and `origin/main` match at `cbd006a`. All previous local work, including the Opening prevention fix, Chapter 4/6 guidance, shared reports and animated Chapter Goal, remains preserved. No commit, push or PR was created.

## Behaviour

Each actual Campaign chapter has an optional, centered **Company Message**, with an envelope, small colleague icon, sender, role, conversational message and **Your mission**. **Got it**, **X** and Escape dismiss it. A subsequent UI-only refinement adds a warm translucent full-screen backdrop and modal keyboard focus containment to Company Messages only. Background elements are temporarily inert and restored on dismissal or interruption; outside clicks do not dismiss. The card's content and geometry are unchanged. Chapter 4/6 stage cues remain nonmodal. There is no new quest, automatic purchase, forced pause or progression gate.

| Chapter | Colleague | Mission |
| --- | --- | --- |
| 1 | Maya, Customer Support | Compare demand and capacity to prevent or recover from a bottleneck. |
| 2 | Alex, CEO | Prepare capacity and route traffic to the servers that can handle it. |
| 3 | Jordan, Software Engineer | Compare database workloads and use caching where it helps. |
| 4 | Sam, Marketing | Observe traffic spikes and weigh capacity, autoscaling and rejected traffic. |
| 5 | Taylor, Operations Engineer | Prepare for server failures and verify stable recovery. |
| 6 | Alex, CEO | Serve growth at full demand and complete the Campaign's reliability checks. |

The supplied narratives are retained with evidence-sensitive wording: Maya says “Customers want our website to stay fast. Can you find what might slow it down?” for a healthy company, and uses the reported-slowness wording only with observed latency/backlog symptoms. Jordan says the database needs to keep up as the company grows, avoiding an unsupported “harder than ever” claim. Alex reads Chapter 6's actual user target, normally 50,000; if it is already reached, he talks about finishing the final reliability checks. None of these messages invents an engine incident or a recovery record.

## Priority and persistence

The existing guidance host supplies eligibility. Chapter 0, practice companies, other tutorials, incidents, mandatory reviews/recognitions, chapter continuation, confirmation, risk confirmation, active sheets, hidden/unfocused pages and pointer capture take priority. Shared modal detection now runs before paint. Manual Hint and accepted action guidance also take precedence. Existing idle decisions and immediate Pause/Confirm calculations are unchanged.

The introduction occupies the single narrative slot before a Chapter 4/6 stage cue. After dismissal, only the still-current stage can appear; earlier stages are not queued. Both cards never appear together. If a higher-priority interaction interrupts an already-shown introduction, it stays dismissed rather than nagging when that interaction ends. An unseen introduction remains pending until eligible.

Receipts use a browser-local key based on run identity, actual chapter and that stage's recorded entry step. They are recorded when shown, so even reloading before explicit dismissal does not repeat the introduction. An unlocked Next button is not treated as an actual chapter entry. Receipts are outside Campaign saves, inputs, schemas and analytics. The existing stage receipt implementation is shared without changing its keys or array format.

Existing/imported companies without receipts receive one introduction for their current chapter at the next eligible opportunity; earlier chapters are not replayed. A different company or actual entry has its own identity. Clearing browser data or moving a save to another browser can show the introduction again. If storage fails, an in-memory receipt prevents repetition within the current page session; persistence through a hard reload cannot be guaranteed without available browser storage.

## Changed files in this task

Production:

- `frontend/src/game/chapterCompanyMessage.ts`: read-only chapter identity, colleague copy and missions.
- `frontend/src/game/presentationReceipts.ts`: shared resilient presentation-only receipts.
- `frontend/src/components/ChapterCompanyMessage.tsx`: introduction/stage sequencing and dismissal.
- `frontend/src/components/Chapter4StagePopup.tsx`: extract the existing card for introductions while retaining Chapter 4/6 cue behaviour.
- `frontend/src/components/CampaignAttention.tsx`: connect introductions to existing priority/availability and stage cues.
- `frontend/src/components/CampaignAttention.css`: scoped colleague layout and responsive card height; shared palette and typography.

Tests:

- `frontend/src/components/ChapterCompanyMessage.test.tsx`: 24 cases covering all six chapters, truthful copy, dismissal, StrictMode, persistence, blocked storage, actual entry, Classic, tutorial/incident/review/confirmation priority, stage sequencing and manual Hint.
- `frontend/src/components/Chapter4StagePopup.test.tsx`: explicitly dismiss the introduction before retaining the existing stage/pause/Hint assertions.
- `frontend/e2e/companyMessages.ts`, `companyMessages.spec.ts`: public-UI real-WebGL introduction and reload journeys.
- `frontend/e2e/mobile.spec.ts`: 390px and 320px touch journeys.
- `frontend/e2e/fixtures.ts`: unrelated journeys dismiss only the new optional introduction through its real Got it button; dedicated story tests opt out. Existing stage, recovery, Hint and gameplay assertions remain intact.

There are no new simulation, economy, progression, save-schema, backend, dependency or deployment changes in this task. Prior pending engine changes belong to the earlier approved Opening fix and were not rewritten.

## Validation

Node **22.23.3**, one worker, browser retries 0.

- Selected five-file component batch: **99 passed**, including CompanyMessage, Chapter4StagePopup, Chapter6Guidance, CampaignAttention and IncidentPause.
- Final introduction-only batch after receipt lifecycle cleanup and target-aware wording: **24 passed**. These repeat the 24 cases above; they are not 24 extra distinct tests.
- Final lint/typecheck/build: passed with no new lint warnings. The existing large-Facility-chunk build advisory remains.
- Initial component diagnostics: 69 passed/two failed. One was a new test incorrectly mounting Campaign-only header components for Classic; corrected the fixture to match the real shell. The other was the existing five-second Chapter 6 UI timeout; its unchanged cases passed the subsequent 29-case correction and 99-case batch. No timeout, retry, skip or assertion was weakened. Intermediate React lint warnings were resolved before the final build.
- Desktop introductions: **eight passed** in one batch (1.5 minutes), covering all six colleagues, Got it/X, reload, current company preservation, Chapter 4/6 sequencing and review → recognition → actual Chapter 2 entry priority. Reload before explicit dismissal also deduplicates.
- Final mixed desktop/touch batch: **six passed** (2.0 minutes): 390px and 320px company messages, existing Chapter 4 and Chapter 6 Hint/action/Cancel/Confirm/Run sequences, Chapter 0 practice during an incident and a fresh Chapter 6 message check. Across the two green browser batches, **13 distinct journeys** passed; the Chapter 6 introduction is intentionally repeated. No browser retries were used.

Manually reviewed desktop Opening/Growth and 320px touch captures: complete sender/message/mission text, readable dark ink, visible X/Got it, centered card, no horizontal overflow and no competing stage notice. Sample ignored review captures:

- [Opening desktop](../test-results/company-messages/review-screenshots/chapter1-desktop.png)
- [Growth desktop](../test-results/company-messages/review-screenshots/chapter6-desktop.png)
- [Traffic Spikes, 390px touch](../test-results/company-messages/review-screenshots/chapter4-390-touch.png)
- [Traffic Spikes, 320px touch](../test-results/company-messages/review-screenshots/chapter4-320-touch.png)

Commands, from `frontend/`, Node 22 on PATH:

```powershell
npm test -- --maxWorkers=1 src/components/ChapterCompanyMessage.test.tsx src/components/Chapter4StagePopup.test.tsx src/components/Chapter6Guidance.test.tsx src/components/CampaignAttention.test.tsx src/components/IncidentPause.test.tsx
npm test -- --maxWorkers=1 src/components/ChapterCompanyMessage.test.tsx
npm run lint
npm run typecheck
npm run build
```

With `PLAYWRIGHT_PORT=4197`:

```powershell
node node_modules/@playwright/test/cli.js test companyMessages.spec.ts --project=chromium --retries=0 --output=../test-results/company-messages/browser-desktop-artifacts
node node_modules/@playwright/test/cli.js test mobile.spec.ts chapter4Guidance.spec.ts chapter6Guidance.spec.ts campaignTutorial.spec.ts companyMessages.spec.ts --grep 'company message: Chapter 4 queues|Chapter 4 traffic target: open Network|Chapter 6 guidance: capacity before|A saved Chapter 0 replay.*1440|company message: Chapter 6 sender' --retries=0 --output=../test-results/company-messages/browser-regression-artifacts
```

No full coverage, exhaustive browser sweep, backend, GitHub CI, Safari/Firefox, screen-reader or real-device acceptance is claimed. Chromium touch is emulation. Ignored screenshots/traces stay under `test-results/company-messages/`.

Final Git checks: whitespace check passes; nothing staged or unmerged. There are 70 pending paths including all 62 paths present at task start. All previous backups/stashes remain retained. No branch, worktree, commit, push or deployment was created by this task.

## Spotlight-modal refinement

Company Messages use a fixed, full-screen backdrop beneath the unchanged card. The latest visual refinement reuses Chapter 0's `--spotlight-dim` (`rgb(14 11 30 / .62)`) and spotlight layer 99, replacing the initial brown 48% backdrop. The card stays fully bright; higher-priority modals remain above the backdrop. Background body children become temporarily inert, their previous state is restored on cleanup, and focus starts on X, cycles between X/Got it and returns to the previous connected control after dismissal. Outside clicks retain focus without dismissing. Escape still closes. The distinct backdrop class preserves existing higher-priority modal detection and introduction receipts; Chapter 4/6 instructional cues remain nonmodal. No gameplay clock or guidance resolver changed.

Changed for this refinement: `Chapter4StagePopup.tsx`, `CampaignAttention.css`, `ChapterCompanyMessage.test.tsx`, `e2e/companyMessages.ts`, and this report.

Validation on Node 22.23.3:

- Four focused component files: **96 passed**, including modal focus, backdrop dismissal/cleanup, interruption, existing Hint and immediate Pause priority.
- Frontend lint, typecheck and production build passed; existing large-Facility-chunk advisory remains.
- Browser final batch: **8 passed**, retries 0, covering all six desktop chapter introductions plus 390px/320px touch. Checks include backdrop colour, inert background, actual blocked Run clicks and P shortcut, Tab/Shift+Tab containment, Got it/X, restored interaction, reload and stage sequencing. Real WebGL remains checked. Desktop and 320px captures reviewed visually.
- The initial browser attempt used an incorrect new test locator (`Run Company` rather than the existing `Run`) and was stopped after the first timeout. Corrected the locator; no application workaround, timeout increase or assertion weakening.
- Final whitespace check passed. All prior pending work remains; nothing staged, committed or pushed. Browser artifacts remain ignored under `test-results/company-message-modal/`. These focused Chromium checks do not establish real-device or screen-reader acceptance.

Tutorial-matching follow-up: only `CampaignAttention.css`, `e2e/companyMessages.ts` and this report changed. The production change is one scoped CSS rule; Chapter 0 styling and all JavaScript behaviour are unchanged. Fresh fetch confirmed HEAD matches `origin/main` at `cbd006a`. The 26 Company Message component cases, lint, typecheck and build passed (existing chunk-size advisory only). Six browser journeys passed with retries 0: Company Messages in Chapters 1/6 on desktop and Chapter 4 at 390px/320px touch, plus the existing Chapter 0 reference at desktop/390px. Checks cover the exact navy colour, 62% opacity, layer 99, a single backdrop intercepting all four viewport corners, bright card, focus containment, blocked background input, dismissal and reload. Desktop/mobile captures were visually compared with Chapter 0; artifacts are ignored under `test-results/company-message-tutorial-spotlight/`. All 70 pre-existing pending paths remain, nothing staged, committed or pushed.
