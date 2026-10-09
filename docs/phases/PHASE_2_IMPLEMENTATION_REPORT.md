# Phase 2 implementation report

Date: 9 October 2026. Branch: `ai/phase-2-pr1`. Starting checkpoint: `69e3a918edd88d94d73fe64faa5a3a689be7b710`.

The existing playable Phase 1 campaign has been extended with onboarding, shared dependency evidence, an acknowledgement-triggered milestone, safe save migration, local playtest measurement, failure context and guest entry. Phase 2 is ready for code review; release and human-validation gates remain open. No commit, push, deployment or participant contact was performed.

## Files and reuse

Added:

- `frontend/src/game/telemetry.ts`: pure attributed-event types, identity/projection and timing metadata helpers. Existing `persist.ts` and `store.ts` were considered first and remain the only archive and lifecycle owners. Extraction keeps deterministic event projection independently testable without expanding storage code further; this is not another telemetry service or archive.
- `frontend/src/game/phase2.test.ts`: 18 targeted transition, migration, timing and durability tests.
- `frontend/public/opening-gameplay.png`: actual local Chromium gameplay capture, not a mockup. Existing entry composition consumes this asset; no new renderer or image generation.
- `docs/playtests/PR1_PROTOCOL.md`: observer protocol, sheet and export instructions.
- `docs/phases/PHASE_2_IMPLEMENTATION_REPORT.md`: this report.

Modified production files:

- `frontend/src/components/CampaignUI.tsx`: adapts existing entry, panel, overlays, history, menu and bankruptcy explanation. Adds three onboarding prompts, a fixed dependency strip, friendly countdowns, selected evidence and milestone presentation. Existing tooltip styles provide hover/focus evidence. No parallel panels or shell.
- `frontend/src/components/Game.tsx`: existing composition adds foreground measurement and periodic durable timing; preserves the simulation clock and cleanup.
- `frontend/src/components/ui.tsx`: extends existing Modal with initial focus, Tab containment, Escape handling and focus restoration.
- `frontend/src/game/store.ts`: existing lifecycle coordinates explicit entry, onboarding pause, milestone pause, sessions, event projection, observer input, export retention and restart.
- `frontend/src/game/persist.ts`: extends existing metadata, analytics archive and export; removes silent 500-event truncation and stages pending records through the existing campaign save.
- `frontend/src/game/saveMigrations.ts`: schema 2 validation and backup-first v1 migration in the existing registry and namespace.
- `frontend/src/sim/campaignTypes.ts`, `types.ts`, `actions.ts`, `step.ts`: minimal milestone field, acknowledgement action and trace events. No physical-step, demand, latency, recovery or settlement arithmetic changes.
- `frontend/src/index.css`: compact dependency strip, selected evidence, responsive entry and focus styling.

Modified tests: `frontend/src/App.test.tsx`, `frontend/src/game/store.test.ts`, `persist.test.ts`, `frontend/src/sim/__tests__/openingDatabaseIncident.test.ts`, `frontend/e2e/fixtures.ts`, `gameplay.spec.ts`, `mobile.spec.ts`.

Modified documentation: `docs/AUTHENTICATION.md` adds the preparatory Phase 3 ownership/session/revision/telemetry handoff. No backend production files changed.

`Facility.tsx`, camera/office/assets/icons, `App.tsx`, scenario configuration, legacy engine and later-phase controls were reused unchanged. Existing snapshot, selection and dispatcher serve both office and dependency strip. Existing postmortem and history remain authoritative. Existing tests were retained and adapted for explicit entry/onboarding/milestone; no Phase 1 acceptance path was removed.

## Behavior and persistence

- Landing does not persist a new run or emit `run_started`. Explicit guest entry creates the company; continuation retains its identity.
- Three navigation/evidence prompts support Back, Next, Skip and menu replay. Progress lives in `nn.campaign.meta.v1`; reading blocks actions, physical steps and settlement. Completion/skip leaves simulation paused.
- Room and dependency buttons share selection and inspection. Added application is explicitly installed but unrouted. Snapshot values and recorded history provide demand, capacity, backlog, outcomes and action timing.
- First recovered report acknowledgement awards recognition once. No cash/research/unlock reward. A pending milestone blocks store advancement; acknowledgement preserves the same paused company. Later incidents cannot award again.
- Save key remains `nn.campaign.save.v1`, envelope schema becomes 2, scenario remains v1. Original v1 bytes are backed up before replacement. Healthy/review saves retain null milestone; historical acknowledged recovery backfills acknowledged recognition. Ambiguous history and write/backup failures preserve original data. Migration marks historical timing unknown and does not invent PR1 completions.
- Trace IDs drive physical event identity; UI events have persisted session sequences. Request and activation steps differ. Reload resumes unfinished sessions; explicit exit ends the visit. Foreground reading counts as active time; hidden/offline time does not. Wall time is separate.
- Pending telemetry travels in the campaign envelope before merging by ID into the existing archive. Retry/reload after partial writes is idempotent. Unexported records are retained; reset archives old campaign evidence before replacement and refuses destructive replacement if archiving fails. Storage failure is surfaced; reload durability is not promised when storage is unavailable.
- Menu offers JSON playtest export and optional observer source/intervention recording. Hidden-page pause is not a quit. No actual hint system was added, so onboarding is not recorded as hint use.
- Bankruptcy retains existing rules and now shows ending cash, last revenue/infrastructure/salary settlement, investment and rejection context. Restart requires existing confirmation and retains failed-run evidence.

## Validation: accepted baseline versus implementation

All checks used Node **v22.23.3** with its directory prepended to process PATH. Existing lockfiles/dependencies were used unchanged. Commands run in the named package; E2E used PowerShell `$env:CI='true'` before `npm run test:e2e`.

| Package / exact command | Accepted baseline | Final result |
|---|---|---|
| Frontend `npm run lint` | PASS, 23 warnings | PASS, same 23 warnings, no errors |
| Frontend `npm run typecheck` | PASS | PASS |
| Frontend `npm test -- --reporter=verbose` | 111 pass, 1 optional skip | 129 pass, 0 fail, 1 optional skip |
| Frontend `npm run test:coverage` | Passing baseline coverage check | PASS, 129 pass, 1 skip |
| Frontend `npm run balance` | 5 pass | 5 pass, 0 fail |
| Frontend `npm run build` (also invoked by E2E) | PASS | PASS |
| Frontend CI `npm run test:e2e` | 7 pass | 9 pass, 0 fail |
| Backend `npm run lint` | PASS | PASS, no warnings |
| Backend `npm run typecheck` | PASS | PASS |
| Backend `npm run test:coverage` | 18 pass | 18 pass, 0 fail |

Frontend coverage: statements 79.80%, branches 71.74%, functions 83.57%, lines 82.81%. Backend: statements 66.66%, branches 58.82%, functions 68%, lines 66.66%. Coverage includes retained inactive legacy code and excludes visual components; no percentage gate was invented.

No remaining new test failures or lint warnings. The optional `src/sim/__tests__/trace.test.ts` diagnostic remains skipped intentionally. Existing lint warnings remain in scene modules, icons, shared UI exports and inactive legacy panels. Browser launcher prints the environment `NO_COLOR`/`FORCE_COLOR` warning; this is not an application error. Existing dependency audit findings were untouched. No database generate/migrate command was run.

Phase 1 physical/conservation/settlement/scheduling/recovery tests, store/persistence/migration tests and StrictMode clock checks pass. All three headless and visible paths remain valid: database upgrade, traffic limit, and ineffective application followed by database upgrade. Limit removal, continuation, pending actions and safe storage remain covered.

The nine browser tests cover the three recovery paths through entry/onboarding/report/milestone/reload, corrupt-save preservation/reset, paused incident resume, furniture failure fallback, keyboard onboarding/landing behavior, bankruptcy/export/restart, and touch/mobile inspection. Milestone pending-reload is tested. Actual office selection and strip selection agree. Desktop/mobile/entry screenshots were inspected for layout, labels, units and preserved office styling. This is Chromium and mobile emulation evidence, not a real-device or comprehensive screen-reader audit.

## Deviations, release inputs and known limits

- Join Playtest is configurable through `VITE_PLAYTEST_URL` and accepts a real HTTP(S) destination. No URL was supplied; the button is disabled with an honest explanation. A working signup CTA remains a release blocker.
- Supply `VITE_BUILD_ID` with the actual release commit/build identifier. Local builds explicitly report `dev/unrecorded`; they are not claimed as a recorded participant-test build.
- The real local gameplay screenshot is included. Final release approval of the screenshot and deployed entry remains outstanding.
- No deployment was authorized or performed. Deployment/CTA/asset checks on a real URL remain NOT TESTED.
- Human sessions were prepared, not conducted. Duration, understanding, enjoyment, signups and spontaneous interest remain unmeasured. Opening-db v1 was not retuned to force 10-15 minutes.
- Backend delivery is preparatory documentation only, following the explicit user-approved Phase 2 boundary. Working authentication, proxy routing and owner-scoped cloud saves are handed to Phase 3; this narrows the older roadmap delivery schedule.
- Local storage has finite capacity. Unexported records are never silently truncated; export and explicit cleanup/retention planning remain necessary for extended testing. Save failures are visible.
- No Phase 3 implementation, additional mechanics, production backend/schema/API changes, dependency cleanup or unrelated warning fixes were made.

## Every Phase 2 Definition of Done item

PASS denotes the engineering behavior checked here, not proof of fresh-user understanding.

| Preserved foundation | Status / evidence |
|---|---|
| Phase 1 physical/economic/incident regressions without retuning | PASS - full unit, settlement and balance suites |
| Three headless and visible recovery paths | PASS - opening tests and three browser journeys |
| Restrictions, metrics, countdowns and recovery authoritative | PASS - existing engine/snapshot/UI assertions |
| Limit removal and same-company continuation preserve state | PASS - simulation/store and browser reload checks |
| Legacy keys and unreadable saves protected | PASS - persistence/migration and corrupt-save browser tests |

| New player experience | Status / evidence |
|---|---|
| Guest entry without facilitator setup or API | PASS - local browser entry without backend |
| Short, skippable, separately persisted, paused onboarding | PASS - three prompts, store and browser tests |
| Dependency direction/shared selection clear across views | PASS - visible strip, room/strip/panel checks; human understanding pending |
| Office, renderer, camera, theme, icons preserved | PASS - Facility unchanged; browser room and screenshots |
| Added application accurately unrouted | PASS - visible label and capacity/browser assertions |
| Consequences/history readable without solution disclosure | PASS - snapshot labels, trace history and neutral onboarding; human review pending |
| Milestone after first report acknowledgement once, no reward | PASS - targeted transition and later-incident tests |
| Milestone acknowledgement continues same paused company | PASS - store/reload/browser assertions |
| Failure explanation/export/explicit restart | PASS - bankruptcy browser and archive retention tests |
| Real screenshot and working Try Prototype/Join Playtest | FAIL - screenshot/Try Prototype work; Join Playtest destination missing |

| Persistence and analytics | Status / evidence |
|---|---|
| Phase 1 migration and backup failure cases | PASS - healthy/review/acknowledged/ambiguous/write/backup tests |
| Milestone/onboarding defined reload/reset cases | PASS - store and browser tests |
| Attributed events and request/activation distinction | PASS - trace projection and observer/export implementation/tests |
| Event identity deduplicates reload/StrictMode/retry | PASS - idempotent entry, repeated projection/archive and reload tests |
| Active/wall timing, unknown history and session boundaries explicit | PASS - timing/continuation/migration tests |
| Continuation is not replay; reset alone not replay | PASS - identity and decision assertions |
| Failed/quit/unexported evidence retained/exportable | PASS - archive/export/reset tests and explicit-exit recording |
| Storage failures reported without impossible durability claim | PASS - quota/failure tests and error notices |

| Engineering and release | Status / evidence |
|---|---|
| Relevant lint/typecheck/unit/balance/build/browser checks | PASS - table above; baseline exceptions preserved |
| Keyboard/touch/focus/responsive checks recorded | PASS - focus-contained onboarding, touch journey, screenshot review; broader audit pending |
| No duplicate engine/store/persistence/renderer/telemetry system | PASS - existing ownership retained; pure helper extraction only |
| No Phase 3 or production backend/API-routing changes | PASS - changed-file inspection |
| Backend preparation/Phase 3 handoff documented | PASS - AUTHENTICATION.md handoff |
| PR1 deployment accessible and recorded-build verified | NOT TESTED - no deployment performed |

Human preparation is reported separately as requested:

| Human item | Status |
|---|---|
| Protocol, observer sheet and session export ready | PREPARED - PR1_PROTOCOL.md and menu export |
| Approximately five fresh users observed | NOT YET CONDUCTED |
| Timing/intervention/confusion/enjoyment/failures/missing responses recorded | NOT YET CONDUCTED - fields prepared, no participant results |
| Spontaneous versus prompted interest honestly reported | NOT YET CONDUCTED - protocol separates them |

Stop for review at Phase 2. Full Phase 2 completion is not claimed while the CTA, release verification and human evidence gates remain open.
