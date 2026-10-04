# Phase 1 — Shared Simulation and First Database Incident

> **Project:** 99.99% — System Design Tycoon  
> **Target:** 5–8 October 2026  
> **Primary learning outcomes:** LO1 Diagnose bottlenecks; introductory LO4 Weigh design trade-offs  
> **Status:** Detailed implementation plan for Phase 1 only

---

# 1. Goal

Build a **headless, deterministic version of the opening campaign loop** that establishes the simulation foundation for the rest of the game.

The phase should prove one complete causal loop:

```text
Healthy operation
→ traffic growth
→ database overload
→ inspection
→ player response
→ measured recovery
→ causal postmortem
→ same company continues
```

The purpose of this phase is to make the **physical simulation trustworthy and explainable** before adding more systems.

This phase is **not** a standalone lesson mode.

It must remain part of the same continuous software-company campaign that later phases extend.

---

# 2. Player Experience

The player starts with one small company architecture:

```text
Users
  ↓
Application instance
  ↓
Database
```

The system initially operates normally.

Traffic then increases deterministically.

The application remains within its own capacity, but database demand exceeds database capacity. Backlog, latency, and eventually service errors begin to rise.

The player should:

1. inspect metrics;
2. identify the constrained component;
3. choose a response;
4. observe the consequence of that response;
5. recover the system;
6. read a postmortem explaining what happened;
7. continue with the **same company and architecture**.

The game must not directly tell the player which response is correct.

The player should infer the cause from visible evidence.

---

## 2.1 Healthy startup state

Suggested initial tuning:

```text
Incoming traffic:       300 req/s
Application capacity:  1000 req/s
Database capacity:      600 ops/s
Application backlog:      0
Database backlog:         0
Base latency:           100 ms
Service error rate:       0%
```

Assume for this first slice:

```text
1 processed application request
=
1 database operation
```

The player should be able to inspect both components and see that the architecture currently has headroom.

No incident should be active.

---

## 2.2 Deterministic traffic growth

A configured growth event raises demand.

Suggested first-slice values:

```text
Traffic:
300 req/s
→
800 req/s
```

The application still has sufficient capacity:

```text
800 / 1000 req/s
```

The database does not:

```text
800 / 600 ops/s
```

Therefore the database becomes the bottleneck.

The game should expose this through:

- database demand;
- database capacity;
- utilisation;
- backlog;
- latency;
- errors.

It should not expose the answer through a prescriptive instruction such as:

> "Upgrade the database."

---

## 2.3 Incident development

Suggested deterministic progression:

```text
Step 4: DB backlog = 200
Step 5: DB backlog = 400
Step 6: DB backlog = 600
```

After **three consecutive overloaded steps**, open the overload incident.

At incident opening, the game may pause simulation progression so the player can inspect the evidence and choose a response.

The incident is caused by simulated state, not by a scripted "lesson trigger."

---

## 2.4 Player response options

Phase 1 should expose only the following choices.

### Inspect metrics

Inspection should:

- be free;
- be repeatable;
- expose evidence;
- record that the player inspected the system;
- not modify simulation capacity or physical state.

Metrics are a baseline capability, not an unlock.

---

### Add application instance

Purpose:

Teach that increasing application capacity does not necessarily fix a database bottleneck.

Expected effect:

- costs money;
- activates after a configured delay;
- adds application capacity;
- does **not** change database capacity;
- does **not** automatically reduce database demand;
- does **not** directly resolve the incident.

For this phase, no hidden load balancer should be invented.

If routing has not yet been introduced, the second instance may exist as installed capacity without receiving useful traffic.

The UI should distinguish:

```text
installed capacity
vs
capacity actually receiving traffic
```

---

### Upgrade database

Suggested effect:

```text
Database capacity:
600 ops/s
→
1000 ops/s
```

Suggested activation delay:

```text
3 simulation steps
```

After activation:

- database demand remains unchanged;
- database capacity increases;
- backlog drains gradually;
- latency decreases;
- service errors decrease;
- the incident remains active until recovery thresholds are satisfied.

Purchasing or activating the upgrade must not directly mark the incident as recovered.

---

### Limit incoming traffic

Suggested limit:

```text
500 req/s admitted
```

If incoming demand is 800 req/s:

```text
500 admitted
300 deliberately rejected
```

Expected effect:

- activates on the next relevant simulation step;
- database demand falls below capacity;
- backlog begins draining;
- deliberately rejected traffic is tracked separately from service errors;
- lost demand/revenue is visible as a trade-off.

Traffic limiting is a valid recovery path, but not a free solution.

---

# 3. Learning Outcomes

## LO1 — Diagnose bottlenecks

The player should use:

- traffic;
- component demand;
- component capacity;
- utilisation;
- backlog;
- latency;
- service errors;
- dependency structure;

to identify the database as the limiting component.

A successful player explanation should resemble:

> "The application still has spare capacity, but database demand is above database capacity. That causes backlog, which increases latency and eventually errors."

---

## Introductory LO4 — Weigh design trade-offs

The player should experience that:

- adding an app instance may be ineffective;
- upgrading the database fixes the capacity constraint but costs money and takes time;
- traffic limiting can stabilise the system quickly but rejects demand and loses revenue.

This phase does not need the full LO4 curriculum yet.

It only introduces the idea that multiple actions have different consequences and limitations.

---

# 4. Engineering

## 4.1 Shared deterministic step engine

Introduce a single authoritative step engine, expected to live at:

```text
src/sim/step.ts
```

The same physical calculations should eventually govern both:

- normal management;
- incident periods.

The UI must consume simulation outputs rather than calculate independent capacity or incident logic.

---

## 4.2 Core simulation variables

### Workload

Track:

```text
incoming requests
admitted requests
deliberately rejected requests
```

### Application

Per instance, track at least:

```text
id
capacity
routed demand
processed requests
backlog
active/inactive state
```

### Database

Track:

```text
capacity
incoming operations
processed operations
backlog
```

### Metrics

Track:

```text
incoming demand
admitted demand
rejected demand
processed requests
successful requests
failed requests
application utilisation
database utilisation
application demand/capacity
database demand/capacity
latency
service error rate
```

### Actions

Track at least:

```text
action ID
action type
requested step
activation step
cost
target/effect
```

### Incident state

Track:

```text
consecutive overload counter
active incident state
stable recovery counter
```

### Event trace

Record:

```text
step number
traffic changes
metric snapshots
inspection events
action requests
action activations
incident opening
recovery streak changes
incident recovery
```

---

## 4.3 Core backlog model

For any component with:

```text
D = new demand
C = capacity
B = previous backlog
L = backlog limit
```

use:

```text
processed = min(B + D, C)

unfinished = B + D - processed

overflowFailures = max(0, unfinished - L)

newBacklog = min(unfinished, L)
```

For this Phase 1 slice:

```text
application-processed request
→
1 database operation
```

A request is successful only when the required database work is completed.

The model is intentionally simplified for gameplay clarity.

---

## 4.4 Latency model

A simple initial model may be:

```text
latency =
100 ms
+ 1000 × (
    applicationBacklog / applicationCapacity
    + databaseBacklog / databaseCapacity
  )
```

The exact constants may be tuned later.

The important requirement is:

```text
more backlog
→
higher latency
```

This is a gameplay approximation, not a production latency formula.

---

## 4.5 Fixed step order

Each simulation step should use one consistent order.

Recommended order:

1. activate actions scheduled for this step;
2. apply configured scenario traffic/event changes;
3. apply traffic admission limits;
4. route admitted traffic;
5. process application work;
6. derive database demand;
7. process database work;
8. calculate utilisation, backlog, latency, errors, throughput and rejected demand;
9. apply financial effects once;
10. update overload counters;
11. update recovery counter;
12. open or close incident state where applicable;
13. record trace events and metric snapshot.

Important requirements:

- actions never activate retroactively;
- browser animation timing must not affect simulation results;
- pausing the UI freezes simulation progression;
- stepping individually or in a batch must produce the same result.

---

## 4.6 Incident opening

A database overload incident opens after:

```text
3 consecutive simulation steps
where database demand > effective database capacity
```

A non-overloaded step resets the opening counter.

The incident should identify the database as the affected component.

---

## 4.7 Incident persistence

Once active, the incident remains active until:

- measured recovery occurs; or
- the run ends through bankruptcy or another explicit campaign-ending condition.

Do not use:

- action-declared recovery;
- arbitrary "correct action" flags;
- automatic incident timeout.

---

## 4.8 Recovery

Initial recovery thresholds:

```text
latency < 500 ms
AND
service errors < 1%
FOR
5 consecutive simulation steps
```

If either threshold fails:

```text
stableRecoveryCounter = 0
```

Zero admitted traffic must not create a fake recovery streak.

Recovery should emerge from actual simulation state.

---

## 4.9 Structured postmortem trace

The postmortem should be derived from recorded evidence.

It should know:

- initiating traffic event;
- affected component;
- player inspections;
- actions requested;
- action activation times;
- metric changes;
- whether an action changed the constrained variable;
- when recovery thresholds were met.

The postmortem must not rely on hard-coded button labels such as:

```text
"database upgrade = correct"
"app scale = wrong"
```

It should infer effectiveness from the resulting state.

---

## 4.10 Continuous campaign state after recovery

This is a non-negotiable Phase 1 requirement.

After recovery and the postmortem:

- keep the same run/company ID;
- preserve cash;
- preserve architecture changes;
- preserve action history;
- preserve event history;
- preserve pending state where applicable;
- preserve progression state;
- return to company management.

Do **not** reset the player into a new scenario.

Phase 2 will polish the milestone transition, but Phase 1 must already preserve continuity.

---

# 5. Existing Modules

The IDE must inspect the actual repository before modifying code.

Likely existing areas include:

```text
src/sim/types.ts
src/sim/state.ts
src/sim/actions.ts
src/sim/derive.ts
src/sim/turn.ts
src/sim/incidents.ts
src/sim/postmortem.ts

src/game/store.ts
src/game/persist.ts
src/game/advisor.ts

src/components/Tutorial.tsx
src/components/SidePanel.tsx
src/components/IncidentPanel.tsx
src/components/Views.tsx
```

The implementation should reuse existing abstractions where practical.

Do not create a second simulation stack if the current one can be safely adapted.

---

# 6. New Modules

Expected additions may include:

```text
src/sim/step.ts
src/sim/scenarios/openingDatabaseIncident.ts
src/sim/trace.ts
```

Potential supporting test files:

```text
src/sim/step.test.ts
src/sim/openingDatabaseIncident.test.ts
```

Exact file names should be reconciled with current repository conventions before implementation.

---

# 7. Automated Testing

Phase 1 is not complete until deterministic tests prove the model.

## 7.1 Healthy state

Test:

- initial traffic produces no backlog;
- latency remains near base level;
- service error rate is zero;
- no incident is active.

---

## 7.2 Traffic event

Test:

- traffic changes at the configured step;
- same scenario + same actions produces identical results.

---

## 7.3 Backlog arithmetic

Test exact arithmetic for:

```text
demand below capacity
demand equal to capacity
demand above capacity
backlog accumulation
backlog limit
overflow failure
backlog draining
```

---

## 7.4 Incident opening

Test:

- overload counter increments correctly;
- incident does not open on step 1;
- incident does not open on step 2;
- incident opens after exactly 3 consecutive overloaded steps;
- a healthy step resets the opening counter.

---

## 7.5 Inspection

Test:

- inspection records an event;
- inspection does not change traffic;
- inspection does not change capacity;
- inspection does not affect backlog;
- inspection does not affect incident state.

---

## 7.6 Application addition

Test:

- action costs the intended amount;
- activation occurs exactly once;
- app capacity changes only after activation;
- database capacity stays unchanged;
- database bottleneck remains when database demand still exceeds capacity;
- action does not directly mark recovery.

---

## 7.7 Database upgrade

Test:

- capacity changes only on activation;
- pending delay behaves correctly;
- backlog drains after capacity exceeds demand;
- latency falls as backlog drains;
- action activation itself does not close the incident.

---

## 7.8 Traffic limiting

Test:

- admitted traffic respects limit;
- rejected traffic is counted separately;
- rejected traffic is not counted as service error;
- database backlog drains when admitted demand falls below capacity;
- lost/rejected demand remains visible for postmortem/economy.

---

## 7.9 Recovery boundaries

Test:

- recovery requires 5 qualifying steps;
- one failing step resets the counter;
- 499 ms qualifies;
- 500 ms does not qualify if threshold is strictly below 500;
- 0.99% errors qualify;
- 1.00% does not qualify if threshold is strictly below 1%;
- zero admitted traffic does not manufacture recovery.

---

## 7.10 No forced timeout

Test:

- incident remains active indefinitely if system remains unhealthy;
- waiting alone never resolves the incident.

---

## 7.11 Determinism

Test:

```text
same initial state
+ same seed
+ same action sequence
=
same final state
```

Also test:

- batch stepping equals repeated single stepping;
- pause/resume does not alter outcome;
- save/resume preserves:
  - backlog;
  - action timers;
  - incident counters;
  - trace;
  - campaign identity.

---

## 7.12 Required end-to-end acceptance paths

### Path A — Database upgrade only

```text
healthy
→ overload
→ inspect
→ upgrade DB
→ activation delay
→ backlog drains
→ 5 stable steps
→ recovery
```

---

### Path B — Traffic limiting only

```text
healthy
→ overload
→ inspect
→ limit traffic
→ rejected demand appears
→ backlog drains
→ 5 stable steps
→ recovery
```

---

### Path C — Ineffective then effective

```text
healthy
→ overload
→ add app instance
→ DB remains overloaded
→ inspect again
→ upgrade DB
→ backlog drains
→ recovery
```

The postmortem must explain why the first action did not address the constrained variable.

---

# 8. Human Validation

This is a small Phase 1 validation, not the formal PR1 cohort.

## Suggested participants

Start with:

```text
2–3 internal/friendly testers
```

Then test with a small number of fresh users once UI wiring is available.

---

## Observe

Check whether players can answer, through play:

- Which component is saturated?
- Which metric made that clear?
- Why is application utilisation not the main problem?
- What happened after adding another app instance?
- Why did the database remain overloaded?
- What changed after the database upgrade?
- What trade-off did traffic limiting introduce?

---

## Avoid leading questions

Do not ask:

> "Can you see that the database is overloaded?"

Prefer:

> "What do you think is causing the problem?"

or:

> "What evidence are you using?"

---

## Human validation success signal

A player should be able to explain something similar to:

> "The database demand was above its capacity. Adding another application instance didn't change the database limit, so the backlog kept growing."

The exact wording does not matter.

The causal understanding does.

---

# 9. Definition of Done

Phase 1 is complete only when all of the following are true.

## Simulation

- [ ] A single deterministic step engine governs the opening scenario.
- [ ] Healthy startup state is stable.
- [ ] Deterministic traffic growth creates a database bottleneck.
- [ ] Backlog behaves correctly.
- [ ] Latency increases as backlog increases.
- [ ] Overflow can create service failures.
- [ ] Rejected traffic is tracked separately from service errors.

## Incident

- [ ] Database overload opens only after three consecutive overloaded steps.
- [ ] The incident remains active until measured recovery.
- [ ] There is no action-declared recovery.
- [ ] There is no forced timeout.
- [ ] Recovery requires five qualifying steps below the thresholds.

## Actions

- [ ] Inspect metrics works without changing physical state.
- [ ] Add application instance works.
- [ ] App addition does not increase database capacity.
- [ ] App addition does not solve the database bottleneck by itself.
- [ ] Database upgrade works with an activation delay.
- [ ] Traffic limiting works.
- [ ] Actions activate exactly once.

## Postmortem

- [ ] Structured trace records cause, actions, activation times and metrics.
- [ ] Postmortem is generated from trace evidence.
- [ ] Ineffective app scaling is explained correctly.
- [ ] Successful recovery action is explained correctly.
- [ ] Trade-offs are visible.

## Campaign continuity

- [ ] Recovery returns to the same campaign.
- [ ] Same company/run ID is preserved.
- [ ] Cash is preserved.
- [ ] Architecture changes are preserved.
- [ ] Action/event history is preserved.
- [ ] No standalone lesson reset occurs.

## Engineering quality

- [ ] Required automated tests pass.
- [ ] Save/resume preserves Phase 1 simulation state.
- [ ] Typecheck passes, or pre-existing failures are documented.
- [ ] Production build passes, or pre-existing failures are documented.
- [ ] No UI component contains duplicate authoritative simulation formulas.

---

# 10. Dependencies

Phase 1 depends on Phase 0 having established:

- the current repository baseline;
- current typecheck/test/build status;
- agreed campaign-state contract;
- agreed UI snapshot contract;
- identified simulation/store/UI boundaries;
- identified reusable components;
- identified obsolete legacy assumptions;
- a safe migration path between legacy and new campaign behaviour;
- fixtures or sample states that frontend work can consume safely.

If these Phase 0 contracts are still unclear, resolve them before making large simulation changes.

---

# 11. Scope Guard

Do not introduce the following in Phase 1:

- cache mechanics;
- cache tuning;
- read/write workload strategy;
- load-balancing curriculum;
- autoscaling;
- application failure;
- health checks;
- failover;
- nine-node technology tree;
- full milestone progression;
- complex research economy;
- advanced management mechanics;
- arbitrary graph editing;
- additional incident families;
- multiplayer;
- AI-generated gameplay;
- AI-generated postmortems;
- leaderboards;
- cloud-save/account implementation.

These belong to later phases.

The priority is:

> **one trustworthy, deterministic, causal database-bottleneck slice**

---

# 12. Main Risks and Mitigations

## Risk 1 — Rewriting too much legacy code

**Mitigation:**

- reuse current abstractions;
- isolate old behaviour where necessary;
- replace only the path required for the new campaign foundation.

---

## Risk 2 — UI and simulation disagree

**Mitigation:**

- simulation snapshots are authoritative;
- React components should display results, not recalculate them.

---

## Risk 3 — Hard-coded correct answers

**Mitigation:**

- actions only modify state;
- effectiveness is determined from resulting metrics;
- recovery is state-based.

---

## Risk 4 — Simulation becomes too complicated

**Mitigation:**

- keep formulas simple;
- prefer explainability over production realism;
- defer edge cases not needed for LO1 / introductory LO4.

---

## Risk 5 — First incident becomes a permanent lesson mode

**Mitigation:**

- preserve campaign identity;
- preserve architecture and finances;
- return to company management after postmortem.

---

# 13. Recommended Implementation Order

1. Run current typecheck, tests, balance checks and production build.
2. Record pre-existing failures.
3. Inspect current simulation, store, persistence and incident flow.
4. Confirm Phase 0 contracts.
5. Define minimal Phase 1 state additions.
6. Implement pure `step` transition.
7. Add exact arithmetic tests.
8. Implement deterministic opening traffic event.
9. Implement overload opening counter.
10. Implement recovery counter.
11. Remove action-declared recovery from the new path.
12. Remove forced incident timeout from the new path.
13. Implement delayed database upgrade.
14. Implement traffic limiting.
15. Implement application addition without hidden load balancing.
16. Add structured trace events.
17. Derive postmortem from trace.
18. Add headless end-to-end acceptance tests.
19. Connect store/timing.
20. Connect UI metrics to simulation snapshot.
21. Replace solution-giving guidance with evidence prompts.
22. Verify save/resume.
23. Verify same-company continuation after recovery.
24. Run full relevant tests.
25. Run typecheck.
26. Run production build.
27. Manually play:
    - DB upgrade path;
    - traffic-limiting path;
    - app-scale mistake followed by recovery.
28. Stop for review before Phase 2.

---

# 14. IDE Implementation Prompt

Use this phase file together with:

```text
docs/PROJECT_PROPOSAL.md
docs/DEVELOPMENT_ROADMAP.md
docs/phases/PHASE_1_SIMULATION.md
```

Recommended prompt:

```text
Read:
- docs/PROJECT_PROPOSAL.md
- docs/DEVELOPMENT_ROADMAP.md
- docs/phases/PHASE_1_SIMULATION.md

Treat PHASE_1_SIMULATION.md as the detailed gameplay and acceptance specification for this phase.

Inspect the current repository first and reconcile the phase plan with the actual codebase.

Before modifying code, briefly report:

1. exact files/functions that will change;
2. current logic that conflicts with the phase plan;
3. reusable existing logic;
4. any small technical adjustment needed;
5. implementation order.

Do not change the product scope or learning intent unless there is a concrete technical conflict.

If a conflict exists, explain it and propose the smallest compatible adjustment.

Then implement Phase 1 only.

Do not proceed into:
- caching;
- read/write strategy;
- scaling curriculum;
- reliability;
- full technology progression;
- cloud saves/accounts;
- later phases.

After implementation:

- run relevant automated tests;
- run typecheck;
- run production build;
- list files changed;
- report tests passed/failed;
- explain deviations from this phase specification;
- list any remaining Phase 1 issues;
- confirm whether the Phase 1 Definition of Done is fully satisfied;
- stop for review.
```

---

# 15. Phase 1 Summary

At the end of Phase 1, the game should have one complete, deterministic, explainable gameplay slice:

```text
Healthy company
→ traffic growth
→ database bottleneck
→ evidence-based diagnosis
→ player action
→ visible consequence
→ measured recovery
→ causal postmortem
→ same company continues
```

This becomes the foundation for Phase 2, where the same simulation is turned into a polished **10–15 minute first playable campaign opening for PR1**.
