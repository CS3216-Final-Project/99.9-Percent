# Phase 2 — First Playable Campaign Opening / PR1

> **Project:** 99.99% — System Design Tycoon  
> **Target:** 8–11 October 2026  
> **Course milestone:** PR1 — 11 October 2026, 11:59 pm SGT  
> **Primary learning outcomes:** LO1 Diagnose bottlenecks; introductory LO4 Weigh design trade-offs  
> **Status:** Detailed implementation plan for Phase 2 only

---

# 1. Goal

Turn the Phase 1 deterministic database-overload slice into a **complete, player-facing 10–15 minute campaign opening** that a fresh user can understand and complete without facilitator help.

The Phase 2 experience should:

```text
Introduce the startup
→ show healthy metrics
→ grow traffic
→ reveal the first incident
→ let the player inspect evidence
→ let the player choose among limited responses
→ show consequences
→ recover based on simulation state
→ show a causal postmortem
→ award the first company milestone
→ continue with the same company
```

This phase is the first proper **functional prototype / PR1 experience**.

The purpose is not to add lots of mechanics. The purpose is to make the existing Phase 1 simulation:

- understandable;
- playable;
- visually readable;
- measurable;
- saveable;
- suitable for fresh-user testing.

The first 10–15 minutes should end at a **milestone**, not at the end of the entire campaign.

The player must be able to continue with the same company afterward, even if later mechanics are still locked or unavailable.

---

# 2. Player Experience

A fresh player should be able to start the game with minimal explanation and understand the basic situation.

The target first-run flow is:

```text
Start company
→ inspect simple architecture
→ understand basic metrics
→ traffic grows
→ database overload appears
→ inspect evidence
→ choose a response
→ observe consequences
→ recover
→ read postmortem
→ reach first growth milestone
→ continue same company
```

The opening should feel like the beginning of a tycoon campaign, not like a classroom quiz.

---

## 2.1 Opening state

The player begins with:

```text
1 application instance
1 database
limited cash
healthy traffic
baseline metrics
```

Suggested initial architecture:

```text
Users
  ↓
Application
  ↓
Database
```

The architecture view should make this dependency visually obvious.

The player should be able to see:

- traffic;
- application utilisation;
- database utilisation;
- latency;
- service errors;
- backlog;
- pending action timing where relevant.

The UI should not initially expose every future management control.

Only the controls needed for the first incident should be shown.

---

## 2.2 Onboarding

Onboarding should be short and evidence-focused.

It should explain only enough to let the player operate the game.

Suggested onboarding sequence:

1. identify the architecture area;
2. identify the main metrics;
3. explain that traffic will grow;
4. tell the player to watch for changes;
5. explain how to inspect a component;
6. explain how to choose an action.

Avoid onboarding such as:

> "When the database is overloaded, upgrade the database."

Prefer:

> "Watch how traffic affects each component. If performance drops, inspect the evidence and decide what to change."

The onboarding should not reveal the solution.

---

## 2.3 Healthy period

Before the incident, allow the player to observe a short period of healthy operation.

Purpose:

- establish a baseline;
- show that metrics change over time;
- let the architecture feel alive;
- avoid throwing the player directly into failure.

The healthy phase should be short enough that the first incident still occurs comfortably inside the 10–15 minute first-run target.

Do not artificially stretch this period just to reach 15 minutes.

---

## 2.4 First incident

The Phase 1 database-overload model remains the physical basis.

The player should see:

- database demand exceed capacity;
- database backlog increase;
- latency rise;
- service errors appear if overflow occurs;
- application remaining within its own capacity.

The incident panel should announce that the system is degraded, but should not reveal the answer.

Example neutral alert:

> "Performance degradation detected. Inspect the architecture and metrics."

Avoid:

> "Database overloaded — upgrade now."

---

## 2.5 Opening action set

The first run should expose only approximately **3–4 meaningful choices**.

Required first-run controls:

1. inspect metrics;
2. add application instance;
3. upgrade database;
4. limit incoming traffic.

These controls should reuse the authoritative Phase 1 simulation.

The player must be able to make a plausible but ineffective choice.

---

## 2.6 Visible consequences

Every action should have visible consequences.

Examples:

### Add application instance

The player should see:

- additional app capacity appear;
- cost deducted;
- action activation timing;
- database metrics remain constrained;
- incident persists if database demand still exceeds capacity.

### Upgrade database

The player should see:

- pending upgrade;
- activation countdown;
- capacity change when activated;
- backlog begin draining;
- latency reduce over time.

### Limit traffic

The player should see:

- admitted traffic drop;
- rejected demand increase;
- backlog drain;
- revenue / demand trade-off.

The player should not need to infer that "something happened" from hidden state.

---

## 2.7 Recovery

Recovery continues to use the Phase 1 measured-state rule.

The interface should clearly communicate:

- the system is improving;
- backlog is draining;
- latency is dropping;
- stable recovery is being approached.

Do not expose a simplistic "you clicked the right button" success banner before the metrics actually recover.

---

## 2.8 Postmortem

After recovery, show a concise event-based postmortem.

The postmortem should explain:

- what changed;
- which component became constrained;
- what evidence showed it;
- what the player tried;
- what helped;
- what did not help;
- what trade-off the successful response created.

It should remain causal and contextual.

It should not become a long lecture.

---

## 2.9 First milestone

After the postmortem, award the first campaign milestone **exactly once**.

The milestone should communicate:

```text
You survived the first major growth problem.
Your company is still operating.
New opportunities/mechanics will unlock as the company grows.
```

The player should keep:

- the same company/run ID;
- the same architecture;
- the same cash;
- previous upgrades;
- event history;
- postmortem history.

The first 10–15 minute experience ends at a natural stopping point, but the campaign remains available to continue.

---

# 3. Learning Outcomes

## LO1 — Diagnose bottlenecks

The player should use visible evidence to identify the database as the constrained component.

The interface must support this through:

- architecture visibility;
- component selection;
- demand vs capacity;
- utilisation;
- backlog;
- latency;
- errors;
- history over time.

The game should not solve LO1 on the player's behalf.

---

## Introductory LO4 — Weigh trade-offs

The player should experience that multiple responses have different consequences:

- app scaling may not solve the actual bottleneck;
- database upgrade costs money and has activation delay;
- traffic limiting stabilises quickly but rejects demand.

The first run only introduces this principle.

The full cost/reliability/complexity trade-off curriculum comes later.

---

# 4. Engineering

## 4.1 Connect Phase 1 simulation to the player-facing flow

Phase 2 must not replace the Phase 1 simulation with scripted UI outcomes.

All visible incident behaviour should still come from the shared simulation engine.

The UI should consume:

```text
simulation snapshots
incident state
action availability
pending actions
metric history
trace events
campaign progression state
```

---

## 4.2 Evidence-first onboarding

Replace prescriptive tutorial/advisor text with short navigation and evidence prompts.

Examples of acceptable prompts:

```text
"Traffic is growing. Watch what changes."
"Compare component demand with capacity."
"Which component has the least headroom?"
"What changed after your action?"
```

Avoid prompts that reveal the correct response.

---

## 4.3 Minimal 2D architecture view

Build a simple but readable 2D architecture view.

Required first-run topology:

```text
Users
  ↓
Application
  ↓
Database
```

Required interactions:

- select component;
- hover/focus for details;
- show component health/state;
- show demand/capacity;
- visually indicate overload;
- visually reflect architecture changes such as an added application instance.

The first implementation should use a fixed layout.

Do not build a general drag-and-drop architecture editor.

---

## 4.4 Required metrics

Display enough information for diagnosis.

At minimum:

```text
incoming traffic
admitted traffic
rejected traffic
latency
service errors
application utilisation
database utilisation
application demand / capacity
database demand / capacity
backlog
pending action activation time
```

Metric history should be available where practical so the player can see the incident develop and recover.

Important:

```text
100% utilisation
```

alone is not enough.

Also show demand relative to capacity, for example:

```text
Database demand: 800 / 600 ops/s
```

---

## 4.5 Incident panel

The incident panel should show:

- active incident status;
- affected service/component context;
- symptoms;
- recovery progress;
- pending actions;
- neutral evidence prompts.

It should not contain a "correct action" label.

---

## 4.6 Opening controls

Expose only the controls needed for the first run.

Required:

```text
Inspect
Add app instance
Upgrade database
Limit traffic
```

Hide later systems, including:

- cache controls;
- load-balancer controls;
- autoscaling;
- health checks;
- failover;
- research tree;
- advanced management controls.

The opening should not overwhelm the player.

---

## 4.7 Local save and reset

Add reliable local persistence for the Phase 2 campaign opening.

Before introducing its loader, preserve the old `nn.save.v1`, `nn.meta.v1`, and `nn.analytics.v1` keys unchanged. New campaign saves, onboarding metadata, and telemetry use a separate namespace. Do not feed legacy saves through a validator that removes incompatible data. Provide a legacy-save export path, and test that opening the new game, failed validation, and reset leave the original legacy values unchanged. New-run reset affects only the new campaign namespace. Automatic conversion of old campaigns is not required.

At minimum save:

- run/company ID;
- seed/scenario version;
- architecture state;
- cash;
- current traffic;
- metric/backlog state where needed;
- incident state;
- pending actions;
- progression/milestone state;
- trace/history needed for continuity.

Support:

```text
autosave
resume
reset/new run
```

Reset must clearly start a fresh run.

Resume must not duplicate milestone rewards or replay analytics events incorrectly.

---

## 4.8 Bankruptcy / failure flow

Define a clear first-run failure path if the player becomes insolvent or otherwise reaches a campaign-ending condition.

For PR1, this can remain simple.

Requirements:

- explain why the run ended;
- allow restart;
- avoid unexplained dead state;
- preserve analytics for failed/quit runs.

Do not add elaborate failure cutscenes.

---

## 4.9 First milestone

Add a simple first milestone award.

The milestone must:

- occur after first-incident recovery/postmortem;
- award once;
- preserve the same company;
- prepare the player for later progression;
- not expose unimplemented later mechanics as usable.

If research points or future unlock currency are not yet fully implemented, the milestone can record the reward state without exposing incomplete systems.

---

## 4.10 Basic analytics

Introduce basic gameplay analytics sufficient for PR1 playtesting.

Track at least:

### Run/session

```text
run_started
run_resumed
run_reset
run_failed
run_completed_opening
```

### Incident

```text
incident_opened
incident_recovered
incident_abandoned
```

### Player actions

```text
component_inspected
app_instance_requested
database_upgrade_requested
traffic_limit_applied
```

### Action timing

```text
action_requested_step
action_activated_step
```

### First-run evaluation

```text
opening_completion_time
hint_usage
facilitator_intervention flag if manually recorded
quit/early_exit
```

### Replay/continuation distinction

Do not confuse:

```text
continuing same company
```

with:

```text
starting a new run
```

They are different behaviours.

---

## 4.11 Backend foundation in parallel

The master roadmap specifies that extending the existing Neon/Express backend with authentication and cloud-save work **starts in parallel** during Phase 2. Retain React/Vite, Drizzle, Neon, and the two existing Vercel projects; no Supabase or Next.js migration is part of this phase.

This means Phase 2 may begin:

- verify the existing Neon connection and Drizzle migration workflow;
- plan additive game-specific account, run/save, event, and sign-up tables;
- select and configure authentication compatible with the Vite frontend and Express API;
- define first-time email account access, returning-user sign-in, session restoration, sign-out, and expired-session handling for delivery in Phase 3;
- define backend identity verification and owner-filtered save queries;
- design Express telemetry ingestion and shared request/response contracts.

However:

- login must not be mandatory for the PR1 first-run experience;
- cloud saves are not required to block PR1 gameplay;
- backend work must not delay the playable opening.

The player should still be able to start immediately as a guest.

Browser requests go through the API using `VITE_API_URL`; database credentials stay in the backend. Follow [the roadmap's backend requirements](../DEVELOPMENT_ROADMAP.md#backend-choice) for atomic save revisions, local-save namespace preservation, and deployment constraints. Preserve the existing production/preview CORS origins and configure authentication callbacks for the separate frontend and API deployments.

Authentication and owner-scoped cloud saves are required for the final MVP, owned by Di Heng; they are not stretch features. Phase 2 establishes the integration, Phase 3 delivers the working flow, and Phase 5 completes usability before PR2.

---

## 4.12 Landing page

Publish a simple landing page with:

- game name;
- one-sentence positioning;
- screenshot/mockup/gameplay image;
- CTA.

Possible CTA:

```text
Try Prototype
Join Playtest
```

The landing page supports the proposal's organic-signup target.

Do not spend excessive engineering time on marketing-site polish during PR1.

---

# 5. Existing Modules

The IDE should inspect the actual repository before implementing.

Likely existing areas include:

```text
game shell
tutorial/advisor
architecture view
component inspectors
incident panel
modals
styles
simulation snapshot selectors
store
persistence
postmortem/report UI
```

Likely file areas may include:

```text
src/components/
src/game/
src/sim/
src/app/
src/pages/
```

Use actual repository conventions rather than forcing these names.

---

# 6. New Modules

Possible additions include:

```text
2D architecture component
telemetry client
local save adapter improvements
backend client
account/save adapter
landing-page route
opening milestone UI
PR1 analytics helpers
```

Possible file examples:

```text
src/components/ArchitectureCanvas.tsx
src/analytics/telemetry.ts
src/persistence/localSave.ts
src/backend/client.ts
src/backend/saveAdapter.ts
src/game/openingMilestone.ts
```

Exact names should be reconciled with the repository.

Do not create duplicate systems if equivalents already exist.

---

# 7. Automated Testing

## 7.1 Store transitions

Test:

- fresh run initialization;
- incident opening reflected in store;
- action request reflected correctly;
- action activation reflected correctly;
- recovery reflected correctly;
- postmortem transition;
- milestone transition;
- same company preserved afterward.

---

## 7.2 Milestone idempotency

Test:

- first milestone awards exactly once;
- save/resume does not duplicate reward;
- reopening postmortem does not duplicate reward;
- repeated recovery checks do not duplicate reward.

---

## 7.3 Save/resume

Test that local persistence preserves:

- company/run ID;
- architecture;
- cash;
- pending actions;
- current incident;
- recovery counter;
- backlog;
- metric history needed for display;
- milestone state.

Resume should return to the same logical campaign state.

---

## 7.4 Reset

Test:

- reset creates a new run ID;
- architecture returns to configured starting state;
- previous pending actions do not leak;
- previous incident counters do not leak;
- analytics identify a new run rather than continuation.

---

## 7.5 UI snapshot integrity

Test:

- UI numbers match authoritative simulation snapshot;
- UI does not calculate separate capacity values;
- architecture visual state matches simulation state.

---

## 7.6 Opening controls

Test:

- only intended controls are visible;
- unavailable later mechanics are hidden or clearly inaccessible;
- actions obey resource/prerequisite validation.

---

## 7.7 Incident UI

Test:

- incident panel appears at correct state;
- neutral evidence is shown;
- no solution-giving message appears;
- recovery progress follows simulation state.

---

## 7.8 Postmortem

Test:

- postmortem appears after measured recovery;
- actual action sequence is represented;
- ineffective app scaling is explained where applicable;
- traffic limiting trade-off is represented where applicable;
- same campaign continues afterward.

---

## 7.9 Analytics

Test:

- run start emitted once;
- actions emitted once;
- incident open/recover emitted once;
- event IDs prevent accidental duplicates;
- resume does not create false "new run" events;
- same-company continuation is not counted as replay.

---

## 7.10 Introductory browser smoke flow

Automate at least one browser-level flow:

```text
start run
→ inspect architecture
→ incident opens
→ choose DB upgrade
→ wait for activation
→ recover
→ postmortem
→ milestone
→ continue same company
```

Where feasible, add a second smoke path for traffic limiting.

---

# 8. Human Validation

This phase contains the first meaningful fresh-user test.

The proposal calls for observing approximately five target users during the first 10–15 minute run.

---

## 8.1 Participants

Target:

```text
~5 fresh users
```

Prefer users from the intended primary audience:

- NUS computing undergraduates;
- basic web-development familiarity;
- interest in strategy/tycoon games where possible.

Do not explain the solution before or during play.

---

## 8.2 Test conditions

Use:

- the same build;
- the same onboarding;
- the same first-incident configuration;
- the same observation template.

Allow in-game hints if implemented.

Avoid facilitator advice unless needed to unblock the session, and record intervention.

---

## 8.3 Observe

Record:

- whether player understands architecture;
- whether player finds metrics;
- which metric they inspect first;
- whether they identify the database bottleneck;
- which action they choose first;
- whether they understand ineffective app scaling;
- whether they understand the consequences of traffic limiting;
- whether postmortem explanation matches their understanding;
- confusion points;
- interaction problems;
- time to first incident;
- time to recovery;
- total first-run duration.

---

## 8.4 Ask after play

Ask concise questions such as:

1. What do you think caused the incident?
2. Which evidence helped you decide?
3. What did your chosen action change?
4. Was there any decision that felt interesting?
5. Was anything confusing?
6. How enjoyable was the session? (1–5)
7. Would you want to continue this company or play another run?

Collect enjoyment before extended coaching/discussion.

---

## 8.5 PR1 demand signal

The master roadmap's Week 2 validation target is:

> At least 1 of 5 users spontaneously asks to replay or join a future test before prompting.

Record this separately from responses to direct questions.

Examples of valid spontaneous signals:

```text
"Can I play again?"
"When can I try the next version?"
"Can you send me the link?"
"Is there more after this?"
```

Do not count a "yes" given only after being directly asked whether they want to play again.

---

# 9. Definition of Done

Phase 2 is complete only when all of the following are true.

## Player experience

- [ ] A fresh player can start without facilitator setup.
- [ ] The opening architecture is understandable.
- [ ] Healthy operation is visible before failure.
- [ ] First database incident emerges from Phase 1 simulation.
- [ ] Player can inspect evidence.
- [ ] Only the intended 3–4 meaningful choices are exposed.
- [ ] Actions show visible consequences.
- [ ] Recovery is simulation-based.
- [ ] Postmortem explains actual cause and actions.
- [ ] First milestone is awarded once.
- [ ] Same company continues after the milestone.

## UI

- [ ] Minimal 2D architecture view works.
- [ ] Hover/select interaction works.
- [ ] Overload/health state is visually readable.
- [ ] Required metrics are visible.
- [ ] Demand vs capacity is visible.
- [ ] Pending activation time is visible.
- [ ] Incident state is understandable.
- [ ] No tutorial text reveals the correct solution.

## Persistence

- [ ] Local autosave works.
- [ ] Resume works.
- [ ] Reset/new run works.
- [ ] Same company state survives refresh/resume.
- [ ] Milestone reward is idempotent.

## Analytics

- [ ] Run events are recorded.
- [ ] Action events are recorded.
- [ ] Incident events are recorded.
- [ ] Opening completion can be measured.
- [ ] Quit/failure can be recorded.
- [ ] Same-company continuation is distinguished from new-run replay.
- [ ] Duplicate telemetry is prevented.

## PR1 validation

- [ ] Approximately five fresh target users are observed.
- [ ] Help/intervention is recorded.
- [ ] Confusion is recorded.
- [ ] Enjoyment is recorded.
- [ ] First-run duration is recorded.
- [ ] Spontaneous replay/future-test interest is recorded.
- [ ] At least 1 of 5 spontaneous replay/future-test signal is targeted and reported honestly.

## Engineering quality

- [ ] Phase 1 deterministic tests still pass.
- [ ] Phase 2 store/persistence tests pass.
- [ ] Introductory browser smoke flow passes.
- [ ] Typecheck passes or pre-existing failures are documented.
- [ ] Production build passes or pre-existing failures are documented.
- [ ] PR1 deployment is accessible.

---

# 10. Dependencies

Phase 2 depends directly on Phase 1.

Required Phase 1 foundation:

- deterministic shared step engine;
- working database-overload incident;
- state-based recovery;
- structured trace;
- causal postmortem data;
- limited response actions;
- same-company continuation;
- stable save serialization for Phase 1 state.

It also depends on Phase 0 fixtures/contracts for UI work that may have started in parallel.

Backend/auth work can begin during Phase 2 but must not block the PR1 playable flow.

---

# 11. Scope Guard

Do not expand Phase 2 into later roadmap phases.

Do not implement yet:

- full nine-node tech tree;
- full research system;
- caching/data strategy curriculum;
- read/write scenario variation;
- horizontal-scaling curriculum;
- load-balancer teaching;
- autoscaling;
- application failure;
- health checks;
- failover;
- reliability incidents;
- advanced animations;
- drag-and-drop architecture editor;
- complex management systems;
- mandatory login;
- full cloud-save UX;
- leaderboards;
- multiplayer;
- AI-generated postmortems;
- additional incident families.

If time is limited, prioritise:

```text
clarity
→ complete first-run loop
→ save/reset
→ analytics
→ fresh-user testing
```

over decorative polish.

---

# 12. Main Risks and Mitigations

## Risk 1 — Onboarding gives away the answer

**Mitigation:**

Use evidence prompts, not prescriptions.

---

## Risk 2 — Too many controls overwhelm the player

**Mitigation:**

Expose only the opening action subset.

Hide future systems.

---

## Risk 3 — PR1 becomes visually polished but mechanically fake

**Mitigation:**

All outcomes must come from the Phase 1 simulation.

Do not script recovery for the demo.

---

## Risk 4 — First run exceeds 15 minutes because of waiting

**Mitigation:**

Tune:

- healthy-period length;
- traffic-event timing;
- action activation delays;
- backlog drain time.

Do not insert forced idle time.

---

## Risk 5 — First run is too short to understand

**Mitigation:**

Keep a short healthy baseline and make metric changes visible before incident escalation.

---

## Risk 6 — Backend/auth work delays PR1

**Mitigation:**

Guest-first local play remains functional.

Backend work runs in parallel.

---

## Risk 7 — Milestone accidentally ends the campaign

**Mitigation:**

Preserve run identity, state, architecture, finances and history.

The milestone is a progression point, not a campaign-completion screen.

---

## Risk 8 — Analytics counts continuation as replay

**Mitigation:**

Use distinct events for:

```text
continue current run
start new run
```

Replay should only mean a genuinely new run.

---

# 13. Recommended Implementation Order

1. Verify Phase 1 Definition of Done.
2. Run typecheck/tests/build before Phase 2 changes.
3. Map current game shell and UI entry flow.
4. Define the exact first-run screen sequence.
5. Replace answer-giving onboarding with evidence prompts.
6. Build minimal fixed-layout 2D architecture view.
7. Bind architecture state to authoritative simulation snapshots.
8. Add required first-run metrics.
9. Add incident UI.
10. Expose only the opening action subset.
11. Show pending activation timing.
12. Add visible backlog/recovery behaviour.
13. Build postmortem screen from Phase 1 trace.
14. Add first milestone state/transition.
15. Ensure same company continues afterward.
16. Add local autosave.
17. Add resume.
18. Add reset/new-run flow.
19. Add simple bankruptcy/failure flow.
20. Add basic telemetry client.
21. Instrument run/action/incident/opening events.
22. Prevent duplicate analytics events.
23. Add PR1 browser smoke test.
24. Start backend/auth/cloud-save foundation in parallel.
25. Publish simple landing page + CTA.
26. Deploy PR1 build.
27. Observe ~5 fresh users.
28. Record timing, confusion, intervention, enjoyment, and spontaneous replay/future-test interest.
29. Fix only high-impact PR1 issues.
30. Stop for review before Phase 3.

---

# 14. PR1 Acceptance Scenario

A complete PR1 flow should work like this:

```text
Player opens game
→ starts immediately as guest
→ sees one app + one DB
→ short onboarding explains where to look
→ healthy traffic establishes baseline
→ traffic increases
→ database backlog/latency/errors rise
→ incident opens
→ player inspects metrics
→ player chooses one of the available responses
→ simulation applies consequences
→ system recovers or player adapts
→ postmortem explains cause and response
→ first milestone appears
→ player continues same company
```

The experience should be understandable without facilitator explanation.

---

# 15. IDE Implementation Prompt

Use this file together with:

```text
docs/PROJECT_PROPOSAL.md
docs/DEVELOPMENT_ROADMAP.md
docs/phases/PHASE_1_SIMULATION.md
docs/phases/PHASE_2_PR1.md
```

Recommended prompt:

```text
Read:
- docs/PROJECT_PROPOSAL.md
- docs/DEVELOPMENT_ROADMAP.md
- docs/phases/PHASE_1_SIMULATION.md
- docs/phases/PHASE_2_PR1.md

Treat PHASE_2_PR1.md as the detailed product, UX, validation, and acceptance specification for this phase.

Inspect the current repository first.

Before modifying code, report:

1. whether Phase 1 is fully implemented and stable;
2. exact files/components/stores that Phase 2 will modify;
3. existing UI/persistence/analytics logic that can be reused;
4. current onboarding or UI behaviour that conflicts with the phase plan;
5. the smallest implementation order that can reach PR1 safely.

Preserve the deterministic Phase 1 simulation as the source of truth.

Do not replace simulation behaviour with scripted UI outcomes.

Implement Phase 2 only.

Do not proceed into:
- Phase 3 scaling/routing curriculum;
- caching/data-strategy mechanics;
- full progression tree;
- reliability/failure mechanics;
- later phases.

Backend/auth/cloud-save foundation may begin only where it does not block the PR1 guest experience.

After implementation:

- run Phase 1 regression tests;
- run Phase 2 automated tests;
- run browser smoke tests;
- run typecheck;
- run production build;
- list files changed;
- explain deviations from this phase specification;
- report remaining PR1 blockers;
- confirm whether every Phase 2 Definition of Done item is satisfied;
- stop for review.
```

---

# 16. Phase 2 Summary

At the end of Phase 2, the project should no longer be only a headless simulation.

It should be a **complete first playable campaign opening**:

```text
Readable startup
→ understandable metrics
→ first incident
→ evidence-based decision
→ visible consequences
→ measured recovery
→ causal postmortem
→ first milestone
→ same company continues
```

This is the PR1 prototype.

Phase 3 can then build on the same company by introducing **application scaling and routing** rather than replacing the opening experience.
