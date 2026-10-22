# Chapter 6 guidance — Phase 3

Local presentation changes on `fe/campaign-guidance-phase-3`. Existing Chapter 4 improvements are preserved. The branch was rebased onto `f05da9d` after preserving all eight pre-existing modified/untracked paths in the retained `phase3 Chapter4 preservation before f05da9d` stash. Nothing is committed or pushed.

## What changed

The previous full-demand Hint could fall through to the selected Network inspector's About disclosure without an actionable next step. Removing the cap then exposed inherited routing/capacity problems; overload guidance could recommend the cap again. Accepted routing and failover also compared database capacity with raw admitted traffic, overlooking cached reads. Finally, a retained queue at demand equal to capacity cannot drain, and final promotion waiting was presented as unspecified missing requirements.

Chapter 6 now resolves one dispatcher-validated existing action at a time. It considers each serving instance's allocation, excludes reserved spares, prepares or connects usable capacity, and uses the engine's integer read/write/cache classification for database work. Accepted wave peaks and write-heavy profiles are considered during their warning interval; an unobserved failure target is never disclosed. Waiting app work is included when checking the possible database processing burst. Cache warmth, accepted installations, valid cached routing/failover, actual queue headroom and promotion deadlines distinguish useful Run from another required action.

The sequence is preparation → installation/connection → safe traffic-limit removal → Run/five full-demand checks → explicit wave start → response/recovery → mandatory review/acknowledgement. Three acknowledged waves lead to final checks and the existing explicit Campaign completion. A temporary cap remains a legitimate way to observe an accepted wave's end when full peak preparation is unavailable; it rejects users and never counts as full-demand readiness. Where affordable preparation is unavailable, a suitable reserved spare can be explicitly released with its failover trade-off explained. This never changes its role automatically. A financially blocked company is directed to finances rather than promised that more Run time creates missing capacity.

Got it continues through existing inspector entries, routing disclosures, instance selection and the final action. Purchases retain their existing immediate Confirm spotlight. The same host owns all attention; immediate Pause, confirmations and mandatory reviews keep priority. No action is automatically accepted.

The Chapter 4 popup implementation and colours are shared with Chapter 6. Amber preparation, coral accepted-wave and teal recovery/final-check cues are derived from saved milestones, not timers. Run identity, chapter entry and round identity separate receipts. Receipts remain presentation-only browser storage, with the existing in-memory fallback; they are not added to company saves. Pause/resume and reload do not replay seen milestones. Incident/review ownership suppresses optional cues.

The side panel separates current full-demand/stability requirements from final Campaign goals. It shows real 0–5 counters, 0–3 acknowledged outcomes, registered users, unfinished work, incident/report/restoration blockers and promotion waiting. Existing gates and controls are unchanged.

## Financial limitation — deliberately unchanged

The preceding deterministic audit found a reachable inherited company entering Chapter 6 with **$560**, one base application (1,000 capacity), a **600-capacity database**, no cache and an active traffic limit. Its installed application, database and salaries cost **$7,600 per 60 game seconds**. Even the maximum 600 successful requests/s produce only **$7,200 per period**. It cannot afford the existing $1,000 server, $1,500 cache or $3,000 first database upgrade; a $500 promotion adds demand without increasing the bottleneck's capacity. In the audited best-throughput continuation it bankrupts at game second 840 with no completed growth waves.

The entry predicate permits positive cash and stable capped service, so it does not guarantee a financially viable full-demand preparation path. Guidance cannot fix this. Entry rules, prices, operating costs, revenue and save schemas remain untouched; an economy/entry-rule decision requires separate approval. Guidance validation is not a claim that every inherited company is winnable.

## Validation

Focused unit/component tests cover real engine action sequences, per-instance capacity and spares, safe removal, cached routing/failover (including stale evidence), non-draining queues, cache warming, accepted peak/write-profile preparation, five-check counters, all three waves, mandatory acknowledgement, promotion waiting and final explicit completion. UI checks cover ten-second Hint, sequential targeting/Cancel/Confirm/Run, StrictMode receipts and incident priority. Existing Chapter 4 and shared attention regressions are included.

Focused Chromium journeys exercise the real WebGL room on desktop and 320px touch: preparation/routing/removal/Confirm/Run/readiness/reload, actual wave/recovery boundaries and final-review ownership. Shared Chapter 4 colour and Pause/Confirm journeys remain regression coverage. Artifacts stay ignored under `test-results/chapter6-guidance/`.

Node **22.23.3**. The ten-file focused batch passed **189 tests**. After the final restoration/heading refinements, the two affected Chapter 6 files passed **17 tests**, including one additional real-engine recovery case: **190 distinct focused cases have passing verification across these runs**, rather than a claim of one final 190-case batch. Frontend lint, typecheck and production build passed on the final runtime source. No simulation/balance/backend change was made; full coverage and the full browser/backend suites were not rerun for this presentation task. The existing large Facility build-chunk advisory remains.

The unit command from `frontend/` was:

```powershell
npm test -- --maxWorkers=1 src/game/chapter6Guidance.test.ts src/components/Chapter6Guidance.test.tsx src/game/campaignAttention.test.ts src/game/campaignGuidance.test.ts src/components/IncidentPause.test.tsx src/components/Chapter4StagePopup.test.tsx src/game/chapter4Guidance.test.ts src/game/chapter4Attention.test.ts src/components/CampaignAttention.test.tsx src/components/CampaignUI.test.tsx
```

The final affected rerun selected only `src/game/chapter6Guidance.test.ts` and `src/components/Chapter6Guidance.test.tsx`. Intermediate failures caught the resolver's existing action-list/reason contract, incomplete new recovery fixtures and one unused import; those were corrected while preserving behavioural assertions. Recovery fixtures must first reach the actual incident threshold and isolate the failed route to qualify for service recovery; a traffic limit alone cannot repair a failed route.

**11 distinct Chromium browser journeys have passing verification across targeted runs:** four desktop Chapter 6 journeys, its existing running-incident Pause journey, two shared Chapter 4 regressions and four Chapter 6 touch journeys. The initial six-case batch passed. The next seven-case batch had six passes and one new mobile fixture failure: `seedSave` deliberately does not overwrite an existing company on reload, so a multi-company colour loop was still showing its first fixture. Three isolated mobile cases retain all colour/visibility assertions. The five-case corrective run passed, including real post-review restoration and running-incident Pause.

Visual review then caught clipping of the long final popup heading on 320px touch. Its title is now the concise **Final checks**; instructions are unchanged. Added ratio-1 visibility assertions for the coloured heading icon and dismiss control. The final four-case touch run passed on the final build with retries disabled. Reviewed wave, recovery and final screenshots; all controls remain visible. These are passing journeys across runs, not a claim of one green full browser suite. No expectation, per-assertion timeout, test budget or retry policy was weakened.

Browser commands from `frontend/`, Node 22, `PLAYWRIGHT_PORT=4197`:

```powershell
node node_modules/@playwright/test/cli.js test chapter6Guidance.spec.ts chapter4Guidance.spec.ts mobile.spec.ts --grep 'Chapter 6 guidance:|Chapter 4 cues: centered|Chapter 4 cues: Respond|Chapter 4 cues: all' --retries=0 --output=../test-results/chapter6-guidance/browser-artifacts
node node_modules/@playwright/test/cli.js test chapter6Guidance.spec.ts mobile.spec.ts incidentPause.spec.ts chapter4Guidance.spec.ts --grep 'Chapter 6 guidance:|immediate running Chapter 6|Chapter 4 cues: Respond' --retries=0 --output=../test-results/chapter6-guidance/browser-final-artifacts
node node_modules/@playwright/test/cli.js test chapter6Guidance.spec.ts mobile.spec.ts incidentPause.spec.ts --grep 'post-review restoration|320px touch (wave|recovery|final) milestone|immediate running Chapter 6' --retries=0 --output=../test-results/chapter6-guidance/browser-corrections-artifacts
node node_modules/@playwright/test/cli.js test mobile.spec.ts --project=mobile-chromium --grep 'Chapter 6 guidance:' --retries=0 --output=../test-results/chapter6-guidance/browser-mobile-final-artifacts
```

This work does not claim cross-browser/real-device acceptance or a change to game balance. Git whitespace/index checks passed; all 17 pending paths (including the preserved Chapter 4 paths) remain unstaged, with no unmerged entries. Existing backups and stashes remain retained; other worktrees were not modified.

## Changed paths for this task

- `frontend/src/game/chapter6Guidance.ts`: Chapter 6 action/evidence resolution and milestone model.
- `frontend/src/game/campaignAttention.ts`: connect the Chapter 6 resolver; cache-aware pending routing/failover guards scoped to Chapter 6.
- `frontend/src/game/campaignGuidance.ts` and `frontend/src/components/CampaignUI.tsx`: current requirements, real counters and separate final goals.
- `frontend/src/components/Chapter4StagePopup.tsx`, `CampaignAttention.tsx` and `CampaignAttention.css`: reuse the existing popup and palette, retaining Chapter 4 receipts and priority behavior.
- `frontend/src/game/chapter6Guidance.test.ts` and `frontend/src/components/Chapter6Guidance.test.tsx`: focused model, real-store and presentation regressions.
- `frontend/e2e/chapter6Guidance.ts`, `chapter6Guidance.spec.ts` and `mobile.spec.ts`: public-control desktop/touch journeys and shared fixtures.
- This report. Other pre-existing Chapter 4 test/helper changes remain local and preserved.
