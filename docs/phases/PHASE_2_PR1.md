# Phase 2 — First Playable Campaign Opening / PR1

> **Project:** 99.99% — System Design Tycoon
> **Target:** 8–11 October 2026
> **Course milestone:** PR1 — 11 October 2026, 11:59 pm SGT
> **Primary learning outcomes:** LO1 Diagnose bottlenecks; introductory LO4 Weigh design trade-offs
> **Status:** Authoritative implementation contract; Phase 2 implementation and validation outstanding
> **Foundation:** Existing playable Phase 1 campaign, opening-db v1

# 1. Authority, goal, and reuse principle

This document, `docs/phases/PHASE_2_PR1.md`, is the authoritative Phase 2 implementation contract for the actual repository after Phase 1. Read it with:

- `docs/PROJECT_PROPOSAL.md`
- `docs/DEVELOPMENT_ROADMAP.md`
- `docs/phases/PHASE_1_SIMULATION_FINAL.md`
- `docs/phases/PHASE_1_IMPLEMENTATION_REPORT.md`

The proposal and roadmap provide product context. The approved Phase 1 contract continues to govern physical simulation, scenario values, economy, and recovery. This contract governs the Phase 2 additions and explicitly narrows Phase 2 backend work to preparation. Later user-approved revisions take precedence. Report any remaining concrete conflict before implementing the conflicting change.

**Phase 1 is already playable.** Phase 2 refines that working opening into a clear, measurable PR1 experience a fresh player can use without facilitator setup.

```text
Existing playable company
→ short onboarding and clearer evidence
→ existing simulated incident and player responses
→ existing measured recovery and causal postmortem
→ first milestone
→ same company continues
```

Extend and integrate working systems. Do not duplicate or replace simulation, panels, renderer, lifecycle store, persistence, telemetry, or campaign flow without a concrete technical reason. Explain any required replacement and its migration before implementing it.

Keep the office, visual theme, icons, camera, Three.js Facility renderer, and existing modal/layout primitives. No framework migration or Phase 3 mechanics are authorized.

# 2. Existing foundation and actual remaining scope

## 2.1 Preserved Phase 1 requirements

These are implemented foundations to preserve and regression-test, not systems to rebuild:

| Foundation | Existing behavior |
|---|---|
| Deterministic physical engine | One authoritative engine for management and incidents; one modeled second per step |
| Economy | Exactly-once settlement every 60 steps; existing setup costs, exposure accounting and bankruptcy precedence |
| Incident lifecycle | Three consecutive overloaded steps open an incident; first incident auto-pauses |
| Measured recovery | Five qualifying steps; strict latency <500 ms and service errors <1%; positive admissions and completed outcomes; no timeout recovery |
| Opening actions | Free inspection, delayed app addition, delayed DB upgrade, traffic limit and removal |
| Action restrictions | Later controls hidden and rejected by the engine; added app remains unrouted |
| Metrics | Incoming/admitted/rejected traffic, component demand/capacity, utilisation, backlog, latency, errors |
| Feedback | Recovery counter, action countdowns, cash and pending-period finances |
| Postmortem | Recorded causal evidence, ineffective actions, contributing effects and trade-offs |
| Persistence | Campaign autosave/resume/reset, raw export, validation and migration boundary |
| Data preservation | Separate campaign namespaces; legacy keys untouched; unreadable saves protected |
| Continuation | Same identity, physical step, finances, architecture, limits, pending actions and history |

The active opening UI is in `frontend/src/components/CampaignUI.tsx`, composed by `Game.tsx`. Legacy SidePanel, IncidentPanel, Tutorial, Views and legacy modal flows are not mounted for the opening. Do not implement opening changes only in those inactive components.

## 2.2 Remaining Phase 2 work

| Area | Required addition or refinement |
|---|---|
| Onboarding | Short, skippable, separately persisted navigation and evidence prompts |
| Architecture | Explicit dependency direction and coordinated selection, using existing state |
| First-run flow | Clear labels, focused inspection, readable trends and coherent transitions |
| Milestone | Exactly-once recognition after first postmortem acknowledgement |
| Persistence | Safe migration of Phase 1 saves for genuinely new fields |
| Analytics | Attributed, deduplicated events, timing and export without silent record loss |
| Failure UX | Explain existing bankruptcy and retain failed-run evidence before explicit restart |
| Landing entry | Positioning, actual gameplay screenshot and working CTAs |
| Backend | Preparatory contracts/documentation only; guest play remains independent |
| Validation | Extended tests, deployment checks and human-test preparation |

The recorded Phase 1 report lists 111 passing tests, one optional TRACE skip, five passing balance tests and seven passing browser tests, with 23 pre-existing lint warnings. These are historical results, not a substitute for a fresh Phase 2 baseline. Phase 1 human validation remains outstanding. Preserve its report unchanged.

# 3. Player experience, learning intent, and timing

LO1 is supported by comparing dependencies, demand, capacity, backlog, latency and errors. Introductory LO4 is supported by observing an ineffective investment, delayed capacity investment, and admission relief that rejects demand. No quiz gates, correct-answer labels, mandatory inspection, or prescribed purchase.

## 3.1 Concrete first-run sequence

| Stage | Required behavior |
|---|---|
| Entry | Lightweight positioning and Try Prototype; existing company offers Continue company |
| Start | Explicit guest entry; company starts paused at physical step 0 |
| Onboarding | Three skippable prompts; reading advances no simulation |
| Healthy observation | Inspect initial metrics freely, then use existing Run/Advance step controls |
| Growth | Preserve opening-db v1 event at step 4 |
| Incident | Existing overload opens at step 6 without intervention and auto-pauses |
| Inspection | Select room equipment or dependency node; same component evidence is highlighted |
| Choice | Existing opening interventions; ineffective choices remain allowed |
| Consequences | Cost, human-readable pending action, countdown, capacity/backlog/rejection changes |
| Recovery | Existing stable-steps display follows actual measurements |
| Postmortem | Existing causal summary with expandable recorded evidence |
| Milestone | Acknowledge first recovered-incident report; award once |
| Continue | Acknowledge milestone; paused management, same company and engine |

This is a canonical acceptance path, not a script that forces outcomes. Proactive investment can prevent the incident. Do not manufacture an incident, recovery, or milestone in that case; record the prevention path separately in validation. The milestone requires an actual recovered incident and acknowledged report.

## 3.2 Duration contract

The 10–15-minute opening is a player-session target to observe, not a minimum simulation duration. Phase 1's DB-upgrade acceptance path can recover at physical step 14. Reading and deliberation add variable time.

Preserve opening-db v1 values, growth timing, activation delays and physical-step arithmetic. Do not insert forced idle time, slow recovery artificially, or silently retune saved campaigns. A later approved tuning change requires a new scenario version and separate validation reporting.

Reading onboarding pauses the existing clock. Closing or skipping onboarding leaves play paused until the player explicitly advances or runs. Existing first-incident, review, menu and hidden-page pause rules remain authoritative.

# 4. UI integration

## 4.1 Onboarding

Implement three short prompts using existing UI primitives:

1. **Your architecture:** identify Users → Application → Database; explain component selection.
2. **Your evidence:** compare demand/capacity and unfinished work; identify latency and service errors.
3. **Your controls:** identify free inspection, actions, pending activation and Run/Pause/Advance step; explain that traffic will change.

Allow Next, Back and Skip, plus replay from the menu. Never say which purchase resolves the incident. Prompts must not require an action, advance physical time, spend money, or inject inspections the player did not perform.

Persist versioned onboarding progress in `nn.campaign.meta.v1`, separately from campaign physics and legacy metadata: onboarding version, current prompt, and not-started/in-progress/completed/skipped status. Existing Phase 1 campaigns lacking this data may receive an optional introduction; never reset or advance them. New-company reset does not silently erase the player's onboarding preference. Replay is an explicit menu action.

## 4.2 Architecture presentation

**Keep the existing Three.js office and Facility renderer.** First improve labels, dependency cues and selection in the existing composition. Where these do not make the chain clear, add only a compact fixed-layout HTML/SVG dependency strip:

```text
Users → Application → Database
             Added application: installed, not receiving traffic
```

The current room does not explicitly communicate the whole chain, so a small strip is the expected implementation unless existing-view adaptation demonstrably meets the same acceptance criteria.

Requirements:

- Same authoritative snapshot, existing selection state and action dispatcher.
- Selecting an application or database in either representation selects the same underlying component.
- Users is workload context, not a new simulated component.
- Selected component has a visible title/highlight in the existing metrics panel.
- Demand/capacity, health/overload and backlog are readable without relying on color alone.
- Added app is visibly unrouted; never draw a useful traffic route to it.
- Hover details also work with keyboard focus and touch selection.
- Use current component IDs; do not create another architecture graph or lifecycle.
- No new canvas/WebGL renderer, graph editor, routing mechanic or camera replacement.

## 4.3 Existing panels, controls and history

Adapt CampaignUI rather than introducing parallel incident/metrics/report panels. Preserve all existing metrics and distinguish busy utilisation from offered demand/capacity and installed from routed capacity.

Use friendly action names in countdowns rather than raw identifiers. Keep the admission toggle's removal action and its next-step activation. Display ongoing rejected demand after recovery under a limit.

Improve existing history labels, units and selected-component evidence. Any added backlog/demand trend uses recorded snapshots; no independent physical formulas. Show the existing recovery counter, not a timer promising success.

Reuse the existing causal report. Keep ineffective-action explanations and shared contribution where several actions helped. Historical reports are read-only.

Later tree/cache/routing/reliability controls and their hidden effects remain inactive. Preserve their code for later phases.

# 5. First milestone and continuous campaign

## 5.1 State and trigger

Use recognition such as **First growth challenge handled**. No cash, research points, unlocks, users or additional traffic event are awarded.

Add the smallest campaign field:

```text
openingMilestone: null | {
  id: "opening-stability",
  incidentId,
  awardedStep,
  acknowledged
}
```

The existing openingRecovered flag remains a physical recovery fact, not the milestone award.

On acknowledgement of the first recovered incident's postmortem:

1. Validate that the report belongs to the current campaign and is its first recovered report.
2. If no milestone exists, record it and one deterministic award event.
3. Preserve existing report acknowledgement and same-company transition.
4. Persist the resulting state and present the milestone.
5. Keep management paused while its acknowledgement is pending.

Repeated acknowledgement, repeated recovery checks, report reopening, reload and later incidents cannot award again. A later milestone acknowledgement only marks acknowledged=true and returns to paused management. Neither acknowledgement consumes a physical step or settles money. A storage failure preserves the in-memory transition and reports that durable saving failed; do not claim reload safety when storage is unavailable.

## 5.2 Preserved state

Keep run/company ID, seed/scenario version, step, cash, ledger/remainders, architecture/backlog, admission limit, pending actions, consumed growth event, trace and reports. Pending timers advance only on subsequent physical steps. No replacement scenario or new company is initialized.

Milestone copy must not imply unfinished mechanics are currently usable. State that the company can continue operating; later development will add opportunities.

# 6. Persistence and migration

Extend `persist.ts` and `saveMigrations.ts`; do not add a second save system or local-save adapter.

Keep active namespaces:

```text
nn.campaign.save.v1
nn.campaign.meta.v1
nn.campaign.analytics.v1
```

Keep all legacy keys, including nn.save.v1, nn.meta.v1 and nn.analytics.v1, byte-for-byte unchanged. Preserve legacy export, corrupt/unsupported payload protection, explicit reset, storage-failure reporting and paused resume.

For required saved-state additions, use envelope schemaVersion 2 while retaining the current campaign storage key and scenario version. Register and test the version-1-to-2 migration in the existing registry. Update validator/version dispatch together; do not merely add required fields to initialization. Back up the original payload under a versioned backup key before replacement; validate migrated state. Backup/validation/write failure must not destroy the source. Unknown future versions remain unsupported and exportable.

Migration policy:

- Unrecovered Phase 1 campaign: milestone=null.
- First recovered report awaiting acknowledgement: milestone=null; award normally on acknowledgement.
- First report already acknowledged, evidenced by its recorded acknowledgement: backfill the milestone as acknowledged, using historical report/trace step data.
- Ambiguous historical evidence: preserve the payload and surface an unsupported migration condition rather than inventing a completion.
- Never fabricate old session IDs, completion times, PR1 analytics or player observations.
- Mark historical/backfilled completion provenance in migration/measurement metadata; exclude it from newly measured PR1 completion counts.

Only add onboarding, milestone and telemetry fields where their responsibilities require them. Presentation/session timestamps stay outside deterministic physics. Extend existing metadata/analytics validation and versioning when their shapes change; they do not have to share the campaign envelope version.

New-run reset replaces the new active campaign slot only after explicit confirmation and retains previous run analytics/evidence needed for export. Do not silently clear unexported test records. Reuse existing exports for full campaign traces.

# 7. Analytics and measurement

## 7.1 Extend existing telemetry

The current persist.ts telemetry and store lifecycle calls are the starting point. Existing run_started, save_resumed, incident_started, incident_completed and run_finished events provide partial groundwork. Deterministic traces already record inspections and action effects.

Replace overlapping emission sites with one coordinated bridge; do not emit both old and new names for one new occurrence. Retain historical analytics as historical data without relabeling them as measured PR1 sessions.

Each new event includes:

```text
eventId, eventVersion, name
runId, sessionId, buildId
scenarioId, scenarioVersion
physicalStep, occurredAt
payload
```

Supply an actual build identifier at the application boundary; local development may explicitly identify itself as dev/unrecorded. Only recorded builds qualify for the fixed-build playtest report.

Trace-backed event IDs use the run ID plus deterministic trace-event identity. UI/session events receive a persisted session-scoped sequence/identity before emission. Session ID identifies an explicit playing visit; reload resumes its persisted unfinished session, while an explicit new visit after ending creates another session for the same run. Multiple sessions do not imply multiple companies.

## 7.2 Event contract

| Event | Trigger / required distinction |
|---|---|
| run_started | First explicit player entry into a new company; not landing-page mount or boot alone |
| run_resumed | Explicit continuation of an existing run/session; not a new run |
| run_reset | Confirmed reset, referring to the old run and replacement identity |
| run_failed | Existing bankruptcy transition, once |
| run_completed_opening | First postmortem acknowledgement/milestone award, once; excludes migration backfills |
| incident_opened | Actual recorded opening, with incident ID and step |
| incident_recovered | Actual measured recovery, not purchase/activation |
| incident_abandoned | Confirmed end/reset while unresolved; page hiding alone is insufficient |
| component_inspected | Actual inspection, component ID and snapshot/step reference |
| app_instance_requested | Accepted request, action ID, paid cost, requested/activation steps |
| database_upgrade_requested | Accepted request with the same scheduling fields |
| traffic_limit_requested | Accepted admission change with intended enabled/removed setting |
| traffic_limit_applied / traffic_limit_removed | Actual scheduled activation |
| action_activated | Infrastructure activation with its action ID; never emitted on request |
| opening_completion_time | Recorded first-opening timing at milestone award; recovery time separately available |
| hint_usage | Explicit optional hint use, if offered; navigation onboarding is not a hint |
| facilitator_intervention | Manual observer record linked to session; never guessed from player behavior |
| quit / early_exit | Explicit exit or observer-confirmed quit; interrupted sessions remain distinguishable |
| opening_milestone_acknowledged | Presentation acknowledgement, separate from award |
| gameplay_decision | Accepted intervention in a run, sufficient to distinguish an actual replay from reset alone |

Rejected requests may be retained as diagnostic events but never counted as successful interventions. Include action_requested_step and action_activated_step as appropriate payloads; these are not interchangeable.

## 7.3 Deduplication and preservation

Use stable identities and persisted delivery/export state. Repeated trace projection, StrictMode, reload, review reopening and repeated save calls must not duplicate occurrences. Derive physical lifecycle events from trace rather than only comparing the outer phases of a batched store update.

Stage trace-derived telemetry with the campaign save before acknowledging its export/delivery cursor. Merge into the existing analytics archive by event ID. If saving the cursor fails, retrying the same event must be harmless; if archive writing fails, retain the staged record. Test crash/reload between each write. Do not mark a record delivered before the archive write succeeds.

Session/UI event identities and sequence state must likewise be durable with their local archive update. If browser storage is unavailable, report incomplete durability and keep records in memory for export; exactly-once survival across reload cannot be promised in that case.

The current latest-500-event truncation must not silently discard unexported PR1 records. Preserve them until explicit export/cleanup, expose storage failure, and offer JSON export containing session context and linked campaign evidence. Do not delete records merely because a download was initiated; any cleanup is explicit. No remote telemetry service is required for PR1.

## 7.4 Time and replay definitions

- Start measurement on explicit guest start/continue, not entry-page viewing.
- Physical step is simulated time; never use it as player completion duration.
- Active time counts foreground play, reading and deliberation, including user-paused inspection/onboarding.
- Stop active-time accumulation while the document is hidden or the session is explicitly ended.
- Wall time measures elapsed time from the recorded opening start, including interruptions.
- Persist accumulated active time at lifecycle boundaries; reload must not count offline time as active.
- Use application monotonic elapsed intervals for active-time accumulation; wall timestamps are metadata.
- Record first incident, first recovery, milestone award, failure and exit timings separately.
- Preserve timing-unknown states for migrated campaigns rather than supplying zeros as measured results.

Continuation is the same run ID. Voluntary replay requires a new run plus a gameplay decision without encouragement or reward. Track prompted/recruited context separately; clicking reset alone is not voluntary replay evidence.

# 8. Bankruptcy, entry page, and backend boundary

## 8.1 Failure UX

Preserve existing bankruptcy rules and precedence. Improve the existing end panel with ending cash, last settlement revenue/costs, relevant investment and rejection trade-offs, plus access to history/export.

Restart requires explicit confirmation and creates a new run ID. Record failure/abandonment and retain exportable evidence before replacement. Do not add fines, refund mechanics, automatic bailouts or a new failure simulation.

## 8.2 Lightweight landing entry

Adapt the existing entry composition with:

- Game name.
- One-sentence positioning.
- An actual screenshot of the current playable game.
- Try Prototype, leading to immediate guest entry.
- Join Playtest, pointing to a real configured registration destination.

Prefer extending the existing title/entry area; a small extracted component is acceptable. No router/framework rewrite, second game shell, or new signup backend solely for PR1. Entry-page viewing must not emit run_started.

The real Join Playtest destination and approved screenshot are release inputs. Do not publish a fake link or imply sign-ups are collected without a working destination. Track organic sign-ups separately from recruited testers; the proposal's 30-sign-up target is an outcome to report honestly, not an implementation guarantee.

## 8.3 Backend/auth preparation only

For this Phase 2 contract, backend work is limited to preparatory contracts/documentation: planned account/session/save/event ownership, revisions, Google callback/configuration requirements and testing handoff to Di Heng.

Working Google authentication and cloud saves may wait until Phase 3 without blocking guest PR1. This explicitly narrows the earlier roadmap/authentication document's Phase 2 delivery expectation; record the scheduling difference in the implementation report. Authentication remains required for the final MVP.

Keep React/Vite, Express, Drizzle, Neon and both Vercel projects. No production schema changes, auth implementation, provider configuration, cloud-save UX or API-routing changes solely for PR1. Keep existing VITE_API_URL behavior; implement the planned same-origin proxy with authentication later, following `docs/AUTHENTICATION.md`.

Guest play, local persistence and local evaluation export must work without the API.

# 9. Actual file plan and module reuse

## 9.1 Existing files to extend as needed

| File | Phase 2 responsibility |
|---|---|
| frontend/src/components/CampaignUI.tsx | Existing panels, entry/report flow, selection evidence, friendly labels, milestone and failure presentation |
| frontend/src/components/Game.tsx | Compose opening additions; preserve single clock, pause and cleanup |
| frontend/src/components/scene/Facility.tsx | Minimal labels/selection/status adaptation; keep renderer, office and camera |
| frontend/src/game/store.ts | Existing lifecycle, onboarding coordination, milestone presentation, session/telemetry bridge |
| frontend/src/game/persist.ts | Extend current metadata/archive/export and non-destructive save integration |
| frontend/src/game/saveMigrations.ts | Version-1-to-2 migration, validation and backups |
| frontend/src/sim/campaignTypes.ts | Minimal serializable milestone/progression additions |
| frontend/src/sim/actions.ts and frontend/src/sim/turn.ts | Reuse actual review-acknowledgement path; pure milestone transition without alternate physics |
| frontend/src/game/advisor.ts | Evidence prompts only where current wording needs adaptation |
| frontend/src/App.tsx | Lightweight entry integration if needed; no second game shell |
| frontend/src/index.css | Minimal responsive/accessibility styles matching existing theme |
| frontend/src/App.test.tsx | Active opening UI, clock and entry regressions |
| frontend/src/game/store.test.ts | Lifecycle, milestone, session and deduplication assertions |
| frontend/src/game/persist.test.ts and saveMigrations.test.ts | Migration, preservation, telemetry/archive failure boundaries |
| frontend/e2e/gameplay.spec.ts, mobile.spec.ts and fixtures.ts | Extend existing journeys through onboarding and milestone |

Keep existing step, scenario, settlement and trace semantics. Touch them only for a narrowly necessary milestone/evidence hook, with regression tests and explanation. Do not reorganize legacy code as unrelated cleanup.

## 9.2 Conditional new modules: extend first

| Candidate | Existing module to extend first | When extraction is justified |
|---|---|---|
| frontend/src/components/OpeningOnboarding.tsx | CampaignUI + store; existing modal/layout primitives | Small opening-only view keeps CampaignUI readable; no second tutorial store |
| frontend/src/components/OpeningArchitecture.tsx | CampaignUI/Facility selection and labels | Compact HTML/SVG strip needed for explicit dependencies; no separate graph/state |
| frontend/src/components/OpeningMilestone.tsx | CampaignUI existing overlay/report composition | Presentation-only extraction; award logic remains in existing campaign transition |
| frontend/src/components/LandingEntry.tsx | Existing CampaignUI title/entry and App composition | Lightweight marketing content is clearer separately; no second shell/router |
| frontend/src/game/telemetry.ts | persist.ts tracking and store emission sites | Shared identity/projection helpers justify extraction; same archive, no parallel telemetry pipeline |
| frontend/src/sim/__tests__/openingMilestone.test.ts | Existing openingDatabaseIncident.test.ts | Focused transition/migration fixtures merit a dedicated test file |
| frontend/src/game/telemetry.test.ts | Existing store/persist tests | Event projection and durability cases are clearer together |
| docs/playtests/PR1_PROTOCOL.md | Phase 2 section 11 | Reusable observer/export checklist for actual sessions |

Do not create all candidates automatically. Prefer adaptation when it remains clear and testable. Use existing test conventions. No new persistence layer, lifecycle store, backend client or ArchitectureCanvas is planned.

# 10. Automated and deployment acceptance

## 10.1 Baseline and preserved regressions

Before edits, record lint, typecheck, unit/coverage, balance, production build and browser results per AGENTS.md and docs/testing.md. Preserve the optional TRACE skip and unrelated baseline warnings.

Retain all three headless and visible-control paths: DB upgrade; limiting; ineffective app addition followed by effective recovery. Retain conservation, financial settlement, pause/batching, limit removal, continuation, storage preservation and StrictMode coverage.

## 10.2 New tests

- Onboarding can be skipped/replayed/resumed, reveals no solution and advances no physical time.
- Room/strip/panel share selection and snapshot values; idle app is visibly unrouted.
- Chart units, action labels, keyboard focus and touch selection are usable.
- Milestone requires first recovered-report acknowledgement, awards once and grants no resources.
- Reload before/after report acknowledgement and before/after milestone acknowledgement preserves exact state.
- Reopened historical reports and later incidents cannot award again.
- Existing Phase 1 saves migrate according to each defined historical case without changing physics.
- Migration backup failure, corrupt/unsupported data and storage failure preserve source payloads and legacy keys.
- Stable event IDs prevent duplication through reload, StrictMode, batched steps and failed writes.
- Requests and activations, landing visits and run starts, continuation and replay are distinct.
- Timing excludes hidden/offline time from active time and preserves unknown historical timing.
- Unexported records survive reset and retention pressure; export is usable.
- Failure panel explains actual settlement, preserves evidence and requires explicit restart.
- Proactive prevention does not manufacture an incident/milestone.

## 10.3 Browser and manual paths

Extend existing browser tests:

```text
Entry → explicit guest start → optional onboarding → healthy inspection
→ incident → upgrade → measured recovery → postmortem
→ milestone → same-company continuation → reload
```

Preserve limit and ineffective-app paths. Add milestone pending-reload, keyboard/touch selection and failure/restart coverage. Manually inspect labels, focus order, modal focus restoration, chart readability, mobile layout and color-independent states.

Before PR run repository-required checks for both packages. Verify Node 22 separately if the baseline environment differs. Do not claim automated tests establish human understanding.

## 10.4 Deployment verification

Use existing Vercel projects and release workflow. Verify the actual preview/release URL, assets/screenshot, guest independence from the API, refresh/resume, mobile layout, export and CTA destinations. Record build/commit, scenario version and known limitations.

A document update does not authorize deployment, merging, production migrations or contacting participants. Prepare a reviewable build before any separately required release approval. No deployment is claimed without checking its URL.

# 11. Human validation preparation

Prepare support after technical deployment verification; do not automatically recruit/contact or conduct sessions as part of implementation.

Use approximately five fresh target users, the same recorded build, onboarding and opening-db v1. Keep recruited and organic records separate. Include failures/quits; record missing responses honestly.

Observer sheet:

- Participant/session identifier, prior familiarity, recruitment source and build/scenario.
- First component/metric inspected and first intervention.
- Incident, recovery, milestone and total active/wall durations.
- Confusion, incorrect predictions, interesting decisions and interaction problems.
- Hint use and exact facilitator intervention.
- Outcome: completion, prevention, failure, quit or technical interruption.
- Enjoyment and spontaneous interest before prompting.

Collect enjoyment (1–5) before coaching. Then ask cause, evidence, action effect, interesting decision, confusion, and whether the player wants to continue or try another run. Do not explain the database solution beforehand.

Record spontaneous requests such as “Can I play again?” or “When is the next version?” before directly asking about continuation/replay. Prompted agreement does not count. Target at least one of five spontaneous replay/future-test signals and report the actual result; do not make a positive result a fabricated completion claim.

This is PR1 usability/demand validation, not the later 20-person learning-evaluation cohort.

# 12. Definition of Done

Unchecked items are requirements, not current completion claims. Final reporting must mark each PASS, FAIL or NOT TESTED with evidence.

## Preserved foundation

- [ ] Phase 1 physical/economic/incident regression tests pass without unapproved retuning.
- [ ] All three existing headless and visible recovery paths remain valid.
- [ ] Opening restrictions, metrics, countdowns and recovery stability remain authoritative.
- [ ] Limit removal and same-company continuation preserve all existing state.
- [ ] Legacy keys and unreadable saves remain protected.

## New player experience

- [ ] Guest entry works without facilitator setup or API availability.
- [ ] Onboarding is short, skippable, separately persisted and physically paused.
- [ ] Dependency direction and component selection are clear across existing views.
- [ ] Office, renderer, camera, theme and icons are preserved.
- [ ] Added application is accurately shown as unrouted.
- [ ] Existing action consequences/history are readable without solution disclosure.
- [ ] Milestone awards after first report acknowledgement exactly once, with no resource reward.
- [ ] Milestone acknowledgement continues the same paused company.
- [ ] Failure explanation, evidence export and explicit restart work.
- [ ] Landing entry has an actual screenshot and working Try Prototype/Join Playtest destinations.

## Persistence and analytics

- [ ] Phase 1 save migration and backup failure cases pass.
- [ ] Milestone/onboarding state survives the defined reload/reset cases.
- [ ] Required attributed events and request/activation distinctions work.
- [ ] Event identities deduplicate reload/StrictMode/retry occurrences.
- [ ] Active/wall timing, unknown history and session boundaries are explicit.
- [ ] Continuation is not replay; reset alone does not count as replay.
- [ ] Failed/quit records and unexported evidence are retained and exportable.
- [ ] Storage failures are reported without claiming impossible durability.

## Engineering and release

- [ ] Relevant lint/typecheck/unit/balance/build/browser checks pass; baseline exceptions are identified.
- [ ] Keyboard, touch, focus and responsive acceptance checks are recorded.
- [ ] No duplicate simulation/store/persistence/renderer/telemetry system was introduced.
- [ ] No Phase 3 mechanics or production backend/API-routing changes were introduced.
- [ ] Backend preparation and Phase 3 handoff are documented.
- [ ] PR1 deployment is accessible and verified against a recorded build.

## Human preparation and evidence

- [ ] Protocol, observer sheet and session export are ready.
- [ ] Approximately five fresh users are observed in separately arranged sessions.
- [ ] Timing, intervention, confusion, enjoyment, failures/quits and missing responses are recorded.
- [ ] Spontaneous interest is distinguished from prompted interest and reported honestly.

Engineering readiness and full Phase 2 completion are different: participant/deployment items remain NOT TESTED until actual evidence exists.

# 13. Risks and scope guard

Main risks are duplicated systems, misleading architecture routes, corrupted save migration, duplicate analytics, false duration claims, and milestone resets. Mitigate with existing-module integration, shared snapshots, backup-first migration, stable identities, measured timing and continuation tests.

Do not implement caching, full tree/research progression, application routing/scaling curriculum, autoscaling, reliability/failover, new incident families, arbitrary graph editing, mandatory login, cloud-save UX, leaderboards, multiplayer or AI-generated gameplay/postmortems.

Preserve later-phase code without activating it. Do not clean unrelated baseline warnings. Do not turn the first milestone into a campaign-ending screen.

# 14. Required implementation order

```text
Phase 1 checkpoint → baseline → onboarding → architecture clarity
→ milestone + migration → telemetry → failure UX → landing page
→ regression/browser/accessibility tests → deployment
→ human validation preparation
```

1. Inspect repository guidance and current changes; preserve a reviewable Phase 1 checkpoint/report without overwriting user work.
2. Run and record the fresh baseline; distinguish existing failures/warnings.
3. Extend onboarding and existing composition.
4. Improve shared selection/dependency clarity and existing evidence presentation.
5. Implement milestone transition and safe migration together with focused tests before integrating user flow.
6. Extend attributed telemetry, timing, deduplication and export; remove overlapping emitters.
7. Improve existing bankruptcy explanation and evidence retention.
8. Adapt lightweight entry with actual screenshot and configured CTAs.
9. Run full relevant regressions, browser journeys and accessibility/manual checks.
10. Prepare and verify deployment through the existing authorized release process.
11. Prepare the human-validation protocol and exports; arrange sessions separately.
12. Report changes, reuse decisions, checks, deviations, unresolved release inputs and every DoD status.
13. Stop for review before Phase 3.

Backend preparatory documentation may proceed alongside these steps, without backend implementation or blocking guest gameplay.

# 15. Implementation handoff prompt

```text
Read:
- AGENTS.md
- docs/testing.md
- docs/PROJECT_PROPOSAL.md
- docs/DEVELOPMENT_ROADMAP.md
- docs/phases/PHASE_1_SIMULATION_FINAL.md
- docs/phases/PHASE_1_IMPLEMENTATION_REPORT.md
- docs/phases/PHASE_2_PR1.md

Treat docs/phases/PHASE_2_PR1.md as the authoritative Phase 2 contract.
Phase 1 is already playable. Extend existing systems; do not duplicate them.

Before edits report:
- current active files and reusable entry points;
- fresh baseline versus recorded Phase 1 results;
- any concrete conflict and smallest compatible adjustment;
- implementation order and any new module justified by the reuse table.

Preserve opening-db v1 physics, the office/Facility renderer, the single
store/clock, current campaign persistence and all legacy browser data.
Implement onboarding, architecture clarity, milestone + migration,
telemetry, failure UX and lightweight entry in the specified order.
Keep backend work preparatory only. Do not implement Phase 3.

Run relevant checks and report each Definition of Done item as
PASS / FAIL / NOT TESTED. Separate engineering results from deployment
and human evidence. Do not fabricate completed sessions, sign-ups,
duration targets or learning results. Stop for review before Phase 3.
```

# 16. Readiness and remaining release inputs

The implementation design is concrete. Phase 2 extends the working opening into a clearer PR1 experience, adds one recognition milestone and improves measurement while preserving the same company.

Release inputs still required are a real Join Playtest destination, a selected current-game screenshot, the recorded deployment/build identity, and participant/session arrangements. These do not justify placeholder success claims or prevent independent implementation work. External deployment and human validation remain separate evidence gates.
