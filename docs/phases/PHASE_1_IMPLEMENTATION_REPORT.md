# Phase 1 implementation and verification report

Recorded 9 October 2026. Repository: `C:\Users\user\99.9-Percent`.
Branch: `ai/phase-1-simulation`; baseline commit: `13bb125`.
Changes are local and uncommitted. No push, merge, deployment, backend or Phase 2 work was performed.

The default browser campaign now runs `opening-db` v1 on one deterministic physical engine. Management and incidents request the same steps. Recovery preserves the company, ongoing admission limit, pending actions, financial ledger and event history.

All 61 engineering acceptance checkboxes in the approved contract are verified PASS below. Human evidence-reading validation remains NOT TESTED; this report does not claim that players have demonstrated the intended learning outcome.

## Accepted baseline and final results

All npm commands use `frontend/`. Baseline and implementation checks used Node 24.18.0 / npm 11.16.0 on Windows. The repository recommends Node 22; a separate Node 22 run was not performed.

| Check / command | Accepted pre-Phase-1 baseline | Final result |
|---|---|---|
| `npm run lint` | PASS; 23 existing warnings | PASS; same 23 warnings, no new lint warnings |
| `npm run typecheck` | PASS | PASS |
| Unit suite: baseline `npm test`; final `npm run test:coverage` (same complete test suite plus coverage) | 70 passed, 1 optional skip | 111 passed, 1 optional skip; 12 files passed, 1 file skipped |
| `npm run balance` | 4 passed | 5 passed, including new opening economy trade-off test |
| `npm run build` | PASS | PASS (also executed by final E2E command) |
| `$env:CI='1'; npm run test:e2e` | 6 passed after installing missing Chromium | 7 passed; no failed or flaky cases |
| `git diff --check` | No application edits | PASS |

The existing `src/sim/__tests__/trace.test.ts` diagnostic remains optional and skipped without `TRACE`. It is not a Phase 1 failure.

The 23 lint warnings remain in icons, shared UI exports, scene helpers, SidePanel, Modals and Facility. Facility line numbers shifted because its snapshot mapping changed; the warned camera code was not rewritten. The Playwright process also emits the environment's NO_COLOR/FORCE_COLOR notice; it does not fail tests.

New failures or warnings remaining: **none** in the executed checks. Intermediate implementation errors (action-union exhaustiveness, an icon name, and text encoding) were corrected and verified. No unrelated baseline warnings were fixed.

Coverage run: 81.91% lines across the configured scope, including retained inactive legacy modules. Coverage is supporting information, not a substitute for acceptance tests.

## Files added

- `frontend/src/components/CampaignUI.tsx`
- `frontend/src/game/saveMigrations.test.ts`
- `frontend/src/game/saveMigrations.ts`
- `frontend/src/sim/__tests__/openingDatabaseIncident.test.ts`
- `frontend/src/sim/__tests__/settlement.test.ts`
- `frontend/src/sim/__tests__/step.test.ts`
- `frontend/src/sim/__tests__/traceCampaign.test.ts`
- `frontend/src/sim/campaignTypes.ts`
- `frontend/src/sim/scenarios/openingDatabaseIncident.ts`
- `frontend/src/sim/settlement.ts`
- `frontend/src/sim/step.ts`
- `frontend/src/sim/trace.ts`
- `docs/phases/PHASE_1_IMPLEMENTATION_REPORT.md` (this report)


New responsibilities:
- `campaignTypes.ts`: physical state, snapshots, action schedule, financial ledger and evidence contracts.
- `scenarios/openingDatabaseIncident.ts`: immutable version-specific tuning.
- `step.ts`: initialization, pure physical steps, stop boundaries, shared action scheduling and compatibility projections.
- `settlement.ts`: exposure accumulation, periodic settlement and integer-cent remainders.
- `trace.ts`: deterministic event IDs and causal postmortems.
- `saveMigrations.ts`: validation, envelope/schema dispatch, migration registry and backup boundary.
- `CampaignUI.tsx`: opening-specific controls, metrics, history, review and preservation/export flows using the existing theme and modal components.

## Files modified

- `frontend/e2e/fixtures.ts`
- `frontend/e2e/gameplay.spec.ts`
- `frontend/e2e/mobile.spec.ts`
- `frontend/src/App.test.tsx`
- `frontend/src/components/Game.tsx`
- `frontend/src/components/scene/Facility.tsx`
- `frontend/src/game/advisor.ts`
- `frontend/src/game/persist.test.ts`
- `frontend/src/game/persist.ts`
- `frontend/src/game/store.test.ts`
- `frontend/src/game/store.ts`
- `frontend/src/index.css`
- `frontend/src/sim/__tests__/balance.test.ts`
- `frontend/src/sim/__tests__/bots.ts`
- `frontend/src/sim/__tests__/progression.test.ts`
- `frontend/src/sim/__tests__/sim.test.ts`
- `frontend/src/sim/actions.ts`
- `frontend/src/sim/derive.ts`
- `frontend/src/sim/index.ts`
- `frontend/src/sim/state.ts`
- `frontend/src/sim/tech.ts`
- `frontend/src/sim/turn.ts`
- `frontend/src/sim/types.ts`


The approved `docs/phases/PHASE_1_SIMULATION_FINAL.md` was already modified before implementation. Its approved content was preserved, not rewritten by this implementation.

## Tests added and updated

New tests:
- `sim/__tests__/step.test.ts`: request conservation, snapshots, inactive later technology, validation and pending-action continuation.
- `sim/__tests__/settlement.test.ts`: activation on step 60, exact proration, serialized cent remainders, cross-period completion revenue and idle-instance costs.
- `sim/__tests__/openingDatabaseIncident.test.ts`: arithmetic, timing, opening/recovery boundaries, determinism, bankruptcy and all three headless acceptance paths.
- `sim/__tests__/traceCampaign.test.ts`: shared causal credit, recorded inspections and retention of unresolved incident evidence beyond the chart window.
- `game/saveMigrations.test.ts`: nested-state consistency, supported versions and valid continuation snapshots.

Rewritten integration tests:
- `game/persist.test.ts`: preservation of legacy bytes and unreadable new saves, export/reset boundary, storage failure, migration backup and settlement resume.
- `game/store.test.ts`: single clock, fractional timing, mandatory pause boundaries, safe boot, review continuation and inaccessible later views.
- `App.test.tsx`: real store and shell with WebGL mocked, StrictMode, visible actions, hidden-page pause, cleanup, one activation and one settlement.
- `e2e/gameplay.spec.ts`, `e2e/mobile.spec.ts`, `e2e/fixtures.ts`: real WebGL, all three visible paths, reload, corrupt-save export/reset, paused resume, furniture fallback and mobile layout.

Legacy simulation tests and bots explicitly call `newLegacyGame` for comparison. Their old failure/tree/timeout assumptions no longer describe the default campaign. The balance command retains those isolated comparisons and adds the opening's profitable-upgrade versus revenue-losing-limit trade-off.

## Acceptance paths

| Path | Headless | Visible browser controls | Result |
|---|---|---|---|
| A: healthy, overload, inspect, delayed DB upgrade, backlog drainage, five stable steps, review, same company | PASS | PASS | Upgrade requested after step 6 activates at step 9; 500 ms does not qualify; recovery occurs at step 14 |
| B: healthy, overload, inspect, admission limit, rejection trade-off, measured recovery | PASS | PASS | Limit is retained after review; rejected demand remains visible |
| C: healthy, overload, application addition, constraint persists, DB upgrade, recovery | PASS | PASS | Added instance stays unrouted; postmortem explains unchanged DB demand/capacity |

Headless tests also verify removing the limit reopens an incident when capacity remains insufficient, and pending upgrades survive earlier recovery without receiving premature causal credit.

Desktop and mobile screenshots were inspected. The header clipping found on mobile was fixed. The furnished room, models, icon assets and camera behavior remain; later-phase scene labels and actions are hidden for this opening.

## Implementation adjustments and deviations

No scenario tuning, physical rules, recovery thresholds, economy amounts or storage keys were changed from the approved Phase 1 contract.

Implementation organization differs from the provisional file plan:
- Detailed new types live in `campaignTypes.ts`, referenced from existing `types.ts`.
- Opening incident lifecycle and action scheduling live alongside the pure transition in `step.ts`; evidence-based postmortems live in `trace.ts`. Existing legacy incident/postmortem modules remain isolated rather than being rewritten.
- Opening UI is composed in `CampaignUI.tsx` through the existing Game shell and scene. Legacy tutorial, incident, tree and report components remain in the repository but are not mounted for this campaign.
- An optional `campaign` field provides a temporary compatibility envelope for existing scene/state consumers. Its legacy display fields are projections, not physical inputs. New runs and validated campaign saves always select the replacement engine; there is no player-facing legacy mode.
- Rejected actions leave the pure action input unchanged. The application boundary separately appends an audit event for an actual player's rejected request.
- Internal load statuses use `none` / `ok` / `corrupt` / `unsupported` / `unavailable`; these correspond to the contract's missing/valid/error distinctions.

The original proposal still describes daily turns and an admitted-request error denominator. This implementation follows the user's explicitly approved Phase 1 technical design: one modeled second per step, 60-step operating weeks, and errors divided by completed outcomes. No broader proposal files were silently edited. Opening recovery records the progression flag only; milestone rewards remain outside Phase 1.

## Definition of Done: every contract item

PASS means verified through the named tests and/or the code and browser checks described above. NOT TESTED means evidence is unavailable, rather than an assumed pass.


### 11.1 Physics and timing

Evidence: step.test.ts; openingDatabaseIncident.test.ts; store.test.ts; App.test.tsx; save validation.

| Requirement | Status |
|---|---|
| Healthy steps have zero backlog/errors, 300 successful requests, and 100 ms latency. | PASS |
| Growth occurs once at step 4; without intervention backlog is 200/400/600 on steps 4/5/6. | PASS |
| Under/equal/over-capacity arithmetic, overflow and drainage are exact. | PASS |
| Both conservation identities hold each step and cumulatively. | PASS |
| Application processing never creates duplicate successful requests. | PASS |
| Idle installed capacity does not lower latency or database demand. | PASS |
| Management and incidents use identical physical calculations. | PASS |
| Batch and single-step results agree under identical mandatory-stop policy. | PASS |
| Speed/pause/hidden-page/save-resume do not change physical results. | PASS |
| No NaN/Infinity enters snapshots or saves. | PASS |

### 11.2 Actions and incidents

Evidence: openingDatabaseIncident.test.ts; step.test.ts; pure action/step review.

| Requirement | Status |
|---|---|
| Inspection records evidence without changing physical/economic state. | PASS |
| Purchase validation is immutable on failure and charges once on acceptance. | PASS |
| Actions activate exactly at the scheduled boundary and only once. | PASS |
| Add application cannot increase database capacity or solve this bottleneck. | PASS |
| Database capacity changes only at activation; backlog drains over subsequent steps. | PASS |
| Incident opens after exactly three overloaded steps; a healthy step resets the opening streak. | PASS |
| Activation cannot directly resolve an incident. | PASS |
| Recovery needs five qualifying steps and resets on any failure. | PASS |
| 499 ms and 0.99% can qualify; 500 ms and 1% cannot. | PASS |
| Zero admissions or zero completed outcomes cannot qualify. | PASS |
| Solvent persistent overload remains active beyond 120 steps; no timeout resolves it. | PASS |
| Bankruptcy takes precedence over same-step recovery. | PASS |
| Later-phase actions are rejected even if dispatched outside visible controls. | PASS |

### 11.3 Settlement and request revenue

Evidence: settlement.test.ts; openingDatabaseIncident.test.ts; persist.test.ts; balance.test.ts.

| Requirement | Status |
|---|---|
| No recurring cash settlement before step 60. | PASS |
| Steps 60/120 settle their own periods exactly once. | PASS |
| Pausing, inspection, review acknowledgement and reload do not settle money. | PASS |
| Mid-period activation correctly prorates active infrastructure exposure. | PASS |
| Idle added instances cost upkeep. | PASS |
| Integer-cent rounding remainders survive serialization and later settlements. | PASS |
| Only database-completed successes earn revenue; queued work cannot earn twice. | PASS |
| Backlog completed in a later period earns in that period only. | PASS |
| Rejected-demand opportunity value is reported, not deducted a second time. | PASS |
| Legacy refund/severity/sustained-error charges never run. | PASS |
| Save immediately before/after settlement produces the same continuation as uninterrupted play. | PASS |

### 11.4 Continuation and persistence

Evidence: openingDatabaseIncident.test.ts; step.test.ts; store.test.ts; persist.test.ts; saveMigrations.test.ts; browser preservation/reload.

| Requirement | Status |
|---|---|
| Review preserves identity, physical step, cash, ledger, architecture, limit, pending actions and trace. | PASS |
| Acknowledgement returns to paused management on the same engine. | PASS |
| Opening event cannot replay; openingRecovered is recorded once. | PASS |
| Limit remains active after recovery; removing it activates next step. | PASS |
| Removing a limit with insufficient capacity can open another measured incident. | PASS |
| Pending upgrades remain scheduled after earlier recovery. | PASS |
| All legacy save/meta/analytics keys remain byte-for-byte unchanged through boot/save/reset. | PASS |
| Corrupt/unsupported new saves are neither deleted nor overwritten by boot. | PASS |
| Explicit export/reset and storage-unavailable cases behave correctly. | PASS |
| New onboarding is independent of preserved prototype metadata. | PASS |
| Same supplied identity, seed, actions and steps reproduce the same state. | PASS |
| Save/resume preserves backlog, counters, financial remainders, timing remainder and activation schedule. | PASS |

### 11.5 Full acceptance paths and postmortems

Evidence: openingDatabaseIncident.test.ts; traceCampaign.test.ts; gameplay.spec.ts.

| Requirement | Status |
|---|---|
| Path A: healthy → overload → inspect → DB upgrade → activation → drainage → five stable steps → review → same company continues. | PASS |
| Path B: healthy → overload → inspect → limit → rejected demand → drainage → measured recovery → limit retained. | PASS |
| Path C: healthy → overload → add app → database remains constrained → inspect again → DB upgrade → measured recovery. | PASS |
| Explain ineffective and contributing actions using trace values, not button identity. | PASS |
| Combined interventions share causal credit where supported. | PASS |
| An unactivated pending action receives no recovery credit. | PASS |
| Postmortems preserve initiating event, action times, cost, metrics and trade-offs. | PASS |
| Required paths also work through visible UI controls. | PASS |

### 11.6 Engineering validation

Evidence: final lint/typecheck/coverage/build/E2E; App.test.tsx StrictMode; source and git diff review.

| Requirement | Status |
|---|---|
| Required new tests pass. | PASS |
| No new lint/type/build regression. | PASS |
| Pre-existing/unavailable checks are documented separately. | PASS |
| UI has no duplicate authoritative simulation formulas. | PASS |
| Browser StrictMode does not duplicate clocks, action activations, or settlement. | PASS |
| Unmount and pause clean up timers. | PASS |
| No production backend/schema/deployment changes were introduced. | PASS |


Total: **61 PASS, 0 FAIL, 0 NOT TESTED** across section 11's engineering checklist.

## Remaining validation and limitations

| Item | Status | Notes |
|---|---|---|
| 2-3 internal/friendly human testers and fresh-user evidence-reading sessions | NOT TESTED | No participant sessions were conducted. Do not claim learning or usability validation from automated checks. |
| Node 22 execution | NOT TESTED | Used the accepted baseline's Node 24.18.0 environment; the frontend declares Node >=22. |
| Backend checks | NOT TESTED | Backend was untouched; no PR was created. Both packages' checks are required before a future PR under AGENTS.md. |
| Multi-hour unresolved-incident performance | NOT TESTED | Full incident evidence is deliberately retained; 606-step unresolved retention and storage-failure handling are tested. |

Long-running incidents can exceed browser storage capacity because the contract requires retaining their full evidence. Storage failure is reported and in-memory play/export remain available; no evidence or legacy save is silently deleted.

The engineering slice is ready for review. Human validation is still outstanding. Phase 2 was not started.
