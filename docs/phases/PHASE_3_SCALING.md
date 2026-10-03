# Phase 3 — Application Scaling and Routing

> **Project:** 99.99% — System Design Tycoon  
> **Target:** 12–16 October 2026  
> **Primary learning outcomes:** LO1 Diagnose bottlenecks; LO2 Choose scaling strategies; LO4 Weigh design trade-offs  
> **Status:** Detailed implementation plan for Phase 3 only

---

# 1. Goal

Extend the same continuous company beyond the opening database incident so that the player can encounter and respond to **application-capacity bottlenecks**.

Phase 3 introduces the core distinction between:

- **vertical scaling** — making one application instance stronger;
- **horizontal scaling** — adding more application instances;
- **routing / load balancing** — distributing traffic so added instances actually receive work.

The central learning point is:

> **Installed capacity is not the same as useful capacity.**

Adding another application instance should not automatically improve throughput unless traffic is actually distributed to it.

The phase must also preserve a key earlier lesson:

> **Application scaling must not increase database capacity or fix a database bottleneck.**

This phase continues the **same company, architecture, finances, history, and run identity** established in Phases 1–2.

It must not become a disconnected scaling lesson.

---

# 2. Player Experience

The player has already:

```text
started a company
→ survived the first database incident
→ reached the first milestone
→ continued with the same company
```

Traffic continues to grow.

Eventually the application tier becomes the new limiting component.

The player should then experience:

```text
Company grows
→ app demand approaches capacity
→ app latency/backlog rises
→ player compares scaling options
→ player may add capacity that is not yet routed
→ player observes limited/no benefit
→ player enables effective traffic distribution
→ app bottleneck improves
→ database remains governed by its own capacity
→ same company continues
```

The game should teach through visible consequences, not through a tutorial that says:

> "Buy load balancing now."

---

## 2.1 Starting state for Phase 3

Phase 3 begins from a recovered Phase 2 campaign state.

The exact values may be tuned, but a representative setup is:

```text
Incoming traffic:          700 req/s
Application instances:     1
Application capacity:      600 req/s per instance
Database capacity:         sufficient for this scenario
Database bottleneck:       not active
```

The application tier should be the intended constraint in the main Phase 3 scenario.

The database should have enough headroom that the player can clearly distinguish:

```text
application bottleneck
vs
database bottleneck
```

Do not create a scenario where both are equally saturated unless intentionally used later.

---

## 2.2 Application bottleneck develops

As traffic rises:

- routed demand exceeds the active instance's effective capacity;
- application backlog increases;
- latency increases;
- service errors may appear;
- database demand may remain within capacity.

The architecture and metric panels should make the bottleneck diagnosable.

The player should be able to compare:

```text
Application demand / capacity
Database demand / capacity
```

Example:

```text
Application: 900 / 600 req/s
Database:    900 / 1200 ops/s
```

The player should infer:

> The app tier is overloaded; the database still has headroom.

---

## 2.3 Vertical scaling path

The player can choose to **Scale Up**.

Example:

```text
Application instance:
600 req/s
→
1000 req/s
```

Expected effects:

- one existing instance becomes stronger;
- activation has a visible delay;
- cost increases;
- routed traffic remains on that instance;
- app backlog drains if new capacity exceeds demand;
- database capacity does not change.

This should be a valid response when traffic fits within the larger instance.

---

## 2.4 Horizontal scaling path

The player can choose to **Scale Out** by adding another application instance.

Example:

```text
Before:
App A capacity = 600 req/s

After adding:
App A capacity = 600 req/s
App B capacity = 600 req/s
Installed total = 1200 req/s
```

However, if no load balancer / traffic distributor exists yet:

```text
traffic may still route primarily or entirely to App A
```

Therefore:

```text
installed total capacity = 1200
effective routed capacity ≠ 1200
```

This is a deliberate teaching moment.

The game must not silently distribute traffic across instances before routing has been introduced.

---

## 2.5 Load balancing / routing path

Once the relevant routing capability is available, the player can distribute traffic across healthy instances.

Example:

```text
Incoming traffic = 900 req/s

Without distribution:
App A = 900 / 600
App B = 0 / 600

With balanced distribution:
App A = 450 / 600
App B = 450 / 600
```

Expected effects:

- app utilisation drops;
- backlog drains;
- latency improves;
- service errors decrease;
- database demand remains determined by admitted application work;
- database capacity remains unchanged.

The architecture view should make traffic distribution visible enough that the player understands **why** the second instance becomes useful.

---

## 2.6 Delayed activation

Both vertical and horizontal scaling should take time.

The player should see:

```text
Action requested
→ pending
→ activation countdown
→ architecture/capacity change
```

This reinforces the proposal's requirement that startup or activation delays affect scaling decisions.

Scaling should not happen instantly unless a temporary simplified tuning choice is justified.

---

## 2.7 Consequences of the wrong diagnosis

The player should still be able to make mistakes.

For example:

```text
Database is constrained
→ player adds app instance
→ database remains constrained
```

Likewise:

```text
App is constrained
→ player adds second instance
→ no load balancing
→ original instance remains overloaded
```

These are important causal outcomes.

The simulation should not block the action merely because it is suboptimal.

---

## 2.8 Continuing campaign identity

After Phase 3 encounters and recoveries:

- preserve the same run/company ID;
- preserve earlier database upgrade choices;
- preserve all app instances;
- preserve cash and recurring costs;
- preserve postmortem/event history;
- preserve milestone/progression state.

The player should feel:

> "My architecture is evolving."

not:

> "I started a new lesson."

---

# 3. Learning Outcomes

## LO1 — Diagnose bottlenecks

The player should distinguish whether:

- the application tier is overloaded;
- the database is overloaded;
- added instances are not receiving traffic.

Evidence includes:

- per-instance routed demand;
- per-instance capacity;
- per-instance utilisation;
- application backlog;
- database demand/capacity;
- latency;
- service errors;
- architecture/routing state.

---

## LO2 — Choose scaling strategies

The player should compare:

### Vertical scaling

Benefits:

- simple;
- immediate conceptual model;
- no routing dependency after activation.

Costs / limitations:

- higher cost;
- still one instance;
- finite per-instance ceiling;
- no redundancy benefit by itself.

### Horizontal scaling

Benefits:

- adds instances;
- increases potential aggregate capacity;
- supports later redundancy/autoscaling.

Costs / limitations:

- extra instance alone is insufficient if traffic is not distributed;
- incurs cost;
- may require load balancing.

### Load balancing

Benefits:

- distributes traffic across instances;
- makes horizontal capacity usable.

Limitations:

- does not increase database capacity;
- later reliability still depends on healthy remaining capacity.

---

## LO4 — Weigh trade-offs

The player should begin to compare:

```text
cost
activation delay
capacity gained
architectural complexity
future flexibility
```

The game should not establish a universal winner between Scale Up and Scale Out.

Different conditions should support different choices.

---

# 4. Engineering

## 4.1 Per-instance application model

Move from aggregate application capacity toward explicit per-instance state.

Each application instance should track at least:

```text
id
health / active state
capacityRps
routedDemandRps
processedRps
backlog
upgrade level where applicable
activation state
```

The simulation should derive:

```text
aggregate installed capacity
aggregate routed demand
effective utilised capacity
per-instance utilisation
```

Do not represent horizontal scaling as merely:

```text
totalAppCapacity += X
```

without modeling where traffic goes.

---

## 4.2 Installed capacity vs effective capacity

The simulation/UI should explicitly distinguish:

```text
Installed capacity:
sum of all available instance capacities

Effective routed capacity:
capacity of instances that actually receive traffic under current routing
```

This distinction is central to the phase.

The player should be able to observe a second instance existing but not helping if routing is not configured.

---

## 4.3 Routing model

Introduce a small, deterministic routing helper.

The routing logic should remain simple.

Recommended initial policies:

```text
single-target routing
balanced distribution across eligible instances
```

Avoid sophisticated policies such as:

- least-connections;
- weighted routing;
- geo-routing;
- session affinity;
- service mesh behavior.

A simple equal split is sufficient for MVP learning goals.

---

## 4.4 Routing eligibility

Traffic should only be distributed to instances that are:

```text
active
healthy enough for this phase
eligible under current routing configuration
```

Phase 6 will introduce richer health/detection/failover behavior.

Do not prematurely implement reliability semantics here.

---

## 4.5 Vertical upgrade action

Implement a vertical scale action that:

- targets an application instance;
- costs cash;
- has an activation delay;
- increases that instance's capacity;
- activates exactly once;
- preserves instance identity where practical.

Example:

```text
App A
600 req/s
→
1000 req/s
```

Do not make vertical scaling instantaneous if action scheduling already exists.

---

## 4.6 Horizontal scale action

Implement an add-instance action that:

- costs cash;
- creates a pending instance;
- activates after delay;
- adds physical installed capacity;
- does not automatically alter database capacity;
- does not automatically imply traffic balancing.

The new instance should become visible in the architecture when active.

---

## 4.7 Load balancer / routing capability

Implement the minimum capability needed to intentionally distribute traffic.

The player-facing design may present this as:

```text
Load Balancer
```

or an equivalent routing control consistent with the project's 2D architecture.

When active:

- traffic can be distributed across eligible app instances;
- each instance receives deterministic routed demand;
- aggregate app throughput is derived from individual processing.

The load balancer itself should not become a complex simulated bottleneck in this phase unless already required by the existing model.

---

## 4.8 Preserve database constraints

Critical invariant:

```text
app scaling
≠
database scaling
```

Adding app instances, upgrading app capacity, or load balancing must not increase:

```text
database capacity
```

If database demand exceeds capacity, the database should still accumulate backlog regardless of frontend capacity.

This preserves continuity with the Phase 1 learning objective and the proposal.

---

## 4.9 Action delays

Use the same shared action scheduler introduced earlier.

Each scaling action should have:

```text
requested step
activation step
cost
target
result
```

The player should be able to see pending capacity.

The architecture should not update early.

---

## 4.10 Metric updates

Extend snapshots with per-instance metrics.

Suggested fields:

```text
appInstances: [
  {
    id,
    routedDemandRps,
    capacityRps,
    utilisation,
    backlog,
    active
  }
]
```

Also keep aggregate values for readability.

The UI may show both:

```text
App tier total
+
per-instance details
```

---

## 4.11 Architecture visualization

Update the Phase 2 architecture view so multiple app instances are visually represented.

Example:

```text
             ┌→ App A ─┐
Users → LB ──┤         ├→ Database
             └→ App B ─┘
```

Before load balancing, a second instance might appear but show:

```text
0 routed req/s
```

or another clear indication that it is not receiving traffic.

The visual should help players understand the relationship between:

```text
capacity
routing
utilisation
```

---

## 4.12 Progressive reveal

Scaling controls should not appear before the opening milestone.

After the milestone:

- reveal Scale Up;
- reveal Scale Out;
- reveal load-balancing capability at the intended progression point.

The exact reveal sequence may be simple in Phase 3 and formalized later in Phase 5.

Do not implement the entire nine-node research tree yet.

---

## 4.13 Account sign-in and cloud saves

The master roadmap requires Phase 3 to deliver:

```text
working account sign-in
owner-scoped cloud saves
```

This is a parallel release requirement, not a simulation mechanic.

Recommended behavior:

- guest play remains available;
- player can sign in;
- current local run can be associated with the authenticated owner;
- cloud saves are scoped to that user;
- one user cannot load another user's run;
- save revisions prevent silent overwrites.

Use the backend foundation started in Phase 2.

Do not make authentication mandatory to begin the game.

---

## 4.14 Save schema evolution

Phase 3 save state must persist:

- multiple application instances;
- per-instance capacities;
- routing configuration;
- pending scaling actions;
- architecture history;
- same campaign identity.

If the schema version changes, migrate or safely reject incompatible saves rather than silently corrupting state.

---

# 5. Existing Modules

The IDE should inspect the current repository before implementing.

Likely relevant areas:

```text
simulation state/types
shared step engine
action scheduler
derived metrics
application equipment controls
architecture view
campaign store
local persistence
backend client
auth adapter
cloud-save adapter
```

Likely files may include equivalents of:

```text
src/sim/types.ts
src/sim/state.ts
src/sim/step.ts
src/sim/actions.ts
src/sim/derive.ts
src/game/store.ts
src/game/persist.ts
src/components/ArchitectureCanvas.tsx
src/components/SidePanel.tsx
src/backend/client.ts
src/backend/saveAdapter.ts
```

Reuse existing abstractions where possible.

---

# 6. New Modules

The master roadmap calls for:

```text
small routing helper
cloud-save revision handling
```

Possible additions:

```text
src/sim/routing.ts
src/backend/cloudSaveRevision.ts
```

Potential supporting tests:

```text
src/sim/routing.test.ts
src/backend/cloudSaveRevision.test.ts
```

Exact names should follow repository conventions.

Do not build a broad networking abstraction.

---

# 7. Automated Testing

## 7.1 Per-instance routing

Test:

- one instance receives all traffic under single-target routing;
- second inactive instance receives zero traffic;
- active second instance still receives zero if routing is not changed;
- balanced routing splits demand deterministically;
- sum of routed demand equals admitted demand where capacity/routing allows.

---

## 7.2 Vertical scaling

Test:

- requested vertical upgrade enters pending state;
- capacity does not increase before activation;
- capacity increases exactly once;
- same instance identity is preserved where intended;
- cost is applied once;
- app backlog drains when upgraded capacity exceeds demand.

---

## 7.3 Horizontal scaling

Test:

- adding an instance creates pending capacity;
- new instance appears only when activated;
- installed capacity increases;
- without balancing, original routing behavior remains;
- new instance does not automatically receive useful traffic.

---

## 7.4 Load balancing

Test:

Example:

```text
Traffic = 900 req/s
App A = 600 capacity
App B = 600 capacity
```

Without load balancing:

```text
App A = 900 routed
App B = 0 routed
```

With equal distribution:

```text
App A = 450
App B = 450
```

Verify:

- per-instance utilisation;
- aggregate app throughput;
- backlog reduction;
- deterministic split.

---

## 7.5 Database constraint preservation

Test:

```text
DB capacity = 600 ops/s
Traffic = 900 req/s
```

Even after:

- app vertical scaling;
- app horizontal scaling;
- load balancing;

database capacity remains:

```text
600 ops/s
```

If 900 DB ops/s are generated:

```text
DB remains overloaded
```

This is a critical regression test.

---

## 7.6 Aggregate accounting

Verify:

```text
sum(per-instance processed)
=
aggregate app processed
```

and:

```text
sum(per-instance routed demand)
=
aggregate routed demand
```

within defined admission/routing semantics.

No traffic should be double-counted.

---

## 7.7 Activation delays

Test:

- app upgrades activate on configured step;
- new instances activate on configured step;
- routing changes activate consistently with scheduler rules;
- multiple pending actions do not activate twice.

---

## 7.8 Save/resume

Test persistence of:

- multiple app instances;
- capacities;
- routing state;
- pending actions;
- campaign ID;
- cash;
- prior milestone;
- prior postmortem/history.

Resume must reconstruct the same architecture.

---

## 7.9 Cloud-save ownership

Test:

- authenticated user can save own run;
- authenticated user can load own run;
- one user cannot load/update another user's run;
- guest/local play remains possible.

---

## 7.10 Cloud-save conflicts

Test:

- revision increments on successful save;
- stale revision does not silently overwrite newer state;
- conflict produces a safe resolution path;
- both versions are preserved where required by the master roadmap.

---

## 7.11 Full Phase 3 acceptance paths

### Path A — Vertical scale succeeds

```text
app overloaded
→ player scales up
→ activation delay
→ app capacity increases
→ backlog drains
→ DB remains healthy
```

### Path B — Horizontal scale without routing is ineffective

```text
app overloaded
→ player adds second instance
→ second instance activates
→ traffic remains on first instance
→ first instance stays overloaded
→ player inspects routing
```

### Path C — Horizontal scale + load balancing succeeds

```text
app overloaded
→ add second instance
→ activate routing/LB
→ traffic distributes
→ app utilisation drops
→ backlog drains
```

### Path D — Database bottleneck remains database bottleneck

```text
DB overloaded
→ player adds app instance
→ player enables LB
→ DB still overloaded
```

This confirms earlier learning has not been broken.

---

# 8. Human Validation

The main Phase 3 validation question is:

> **Do players understand that adding a server and distributing traffic are separate concepts?**

---

## 8.1 Suggested test

Use a small group of fresh or returning testers.

Present an application-overload situation.

Before the player acts, ask:

> "What do you think will happen if you add another application server?"

Record the prediction before they see the result.

Then allow them to add the instance.

If routing is not enabled, observe whether they notice:

- the new server exists;
- it receives little/no traffic;
- original app remains overloaded.

Then allow or reveal load balancing.

Ask afterward:

> "What changed when traffic started being distributed?"

---

## 8.2 Observe

Record:

- whether player identifies app rather than DB as bottleneck;
- whether player assumes total installed capacity is automatically usable;
- whether architecture visualization explains routing;
- whether the player understands why the second server initially did not help;
- whether they understand load balancing after seeing the consequence;
- whether they understand DB capacity is unaffected;
- whether action delay feels meaningful or merely annoying.

---

## 8.3 Success signal

A player should be able to explain something similar to:

> "Adding the second server gave me more potential capacity, but it didn't help until traffic was actually split across both servers."

and:

> "That still wouldn't fix a database bottleneck because the database has its own capacity."

Do not provide these statements before testing.

---

# 9. Definition of Done

Phase 3 is complete only when all of the following are true.

## Application model

- [ ] Application instances are modeled individually.
- [ ] Each instance has its own capacity.
- [ ] Each instance receives explicit routed demand.
- [ ] Per-instance utilisation is derived correctly.
- [ ] Aggregate app metrics equal the sum of per-instance behavior.

## Vertical scaling

- [ ] Scale Up action works.
- [ ] Capacity increases only after activation delay.
- [ ] Cost is applied correctly.
- [ ] Vertical scaling can resolve an app bottleneck when appropriate.
- [ ] Vertical scaling does not change DB capacity.

## Horizontal scaling

- [ ] Scale Out action works.
- [ ] New instance activates after delay.
- [ ] Installed capacity increases.
- [ ] New instance is visually represented.
- [ ] New instance does not silently receive balanced traffic before routing is enabled.

## Routing / load balancing

- [ ] Traffic distribution is explicit and deterministic.
- [ ] Load balancing makes horizontal capacity useful.
- [ ] Routed demand is visible.
- [ ] Balanced routing reduces app overload when enough capacity exists.
- [ ] Load balancing does not change DB capacity.

## Player experience

- [ ] Scaling options appear only after the opening milestone.
- [ ] Player can compare Scale Up and Scale Out.
- [ ] Player can experience ineffective horizontal scaling without routing.
- [ ] Consequences are visible in architecture and metrics.
- [ ] Same company continues through the phase.

## Persistence / backend

- [ ] Guest play still works.
- [ ] Account sign-in works.
- [ ] Cloud save works for authenticated users.
- [ ] Saves are owner-scoped.
- [ ] Cloud revision handling prevents silent overwrite.
- [ ] Cross-session resume preserves the same campaign.

## Testing

- [ ] Per-instance routing tests pass.
- [ ] Aggregate accounting tests pass.
- [ ] Activation-delay tests pass.
- [ ] Database-constraint regression tests pass.
- [ ] Save ownership tests pass.
- [ ] Cloud conflict tests pass.
- [ ] Phase 1–2 regression tests remain healthy.
- [ ] Typecheck passes or known pre-existing failures are documented.
- [ ] Production build passes or known pre-existing failures are documented.

---

# 10. Dependencies

Phase 3 depends on Phases 1–2 and the backend foundation.

Required simulation foundation:

- deterministic shared step engine;
- state-based incident/recovery behavior;
- action scheduler;
- database constraint model;
- structured metrics;
- same-company continuation.

Required Phase 2 product foundation:

- readable 2D architecture view;
- metric UI;
- local save/reset;
- first milestone;
- campaign store;
- basic telemetry.

Required backend foundation:

- auth project/configuration;
- initial save schema;
- client/backend connection;
- ownership model.

Do not begin large Phase 3 UI work against unstable simulation contracts.

---

# 11. Scope Guard

Do not expand Phase 3 into later phases.

Do not implement yet:

- cache mechanics;
- cache warm-up;
- read/write workload strategy;
- cache tuning;
- autoscaling;
- application failure;
- health checks;
- failover;
- full nine-node progression tree;
- complex milestone/research economy;
- arbitrary drag-and-drop architecture editing;
- advanced routing algorithms;
- multi-region routing;
- database failover;
- network/security incidents;
- leaderboards;
- multiplayer.

Keep the routing model small and teachable.

---

# 12. Main Risks and Mitigations

## Risk 1 — Horizontal scaling is secretly implemented as aggregate capacity

**Mitigation:**

Route demand per instance.

Do not simply sum capacity and divide later.

---

## Risk 2 — Load balancing is automatically present

**Mitigation:**

Make routing state explicit.

A second instance should be able to exist without receiving useful traffic.

---

## Risk 3 — Architecture visualization becomes too complex

**Mitigation:**

Use a fixed topology.

Only show the components required for the current campaign state.

---

## Risk 4 — Players interpret an idle second instance as a bug

**Mitigation:**

Show routed demand clearly.

Use evidence-focused UI such as:

```text
App B
Capacity: 600 req/s
Routed demand: 0 req/s
```

---

## Risk 5 — App scaling accidentally fixes DB incidents

**Mitigation:**

Keep database processing independent and covered by regression tests.

---

## Risk 6 — Auth/cloud saves consume the phase

**Mitigation:**

Keep guest play functional.

Implement only:

```text
sign-in
owner-scoped saves
safe revisions
resume
```

No advanced account ecosystem.

---

## Risk 7 — Scale Up becomes obviously always better

**Mitigation:**

Tune:

- costs;
- capacity gains;
- delays;
- future flexibility;

so both strategies can be viable under suitable conditions.

Do not solve full balance in Phase 3; Phase 7 will perform broader tuning.

---

# 13. Recommended Implementation Order

1. Verify Phase 2 Definition of Done.
2. Run current simulation/UI/backend regression suite.
3. Inspect existing application-capacity representation.
4. Define per-instance state contract.
5. Refactor aggregate app processing into per-instance processing.
6. Add per-instance metrics.
7. Add routing helper with simple single-target behavior.
8. Add deterministic balanced-routing mode.
9. Add routing tests.
10. Implement vertical scaling action.
11. Implement activation-delay tests.
12. Implement horizontal add-instance action.
13. Verify second instance does not auto-balance traffic.
14. Implement minimal load-balancer/routing action.
15. Add DB-capacity regression tests.
16. Update architecture visualization for multiple instances.
17. Show routed demand/capacity per instance.
18. Reveal scaling options after the opening milestone.
19. Update local save schema for multi-instance/routing state.
20. Verify local save/resume.
21. Complete account sign-in.
22. Implement owner-scoped cloud saves.
23. Implement cloud revision/conflict handling.
24. Add cloud ownership/conflict tests.
25. Run end-to-end Phase 3 acceptance paths.
26. Conduct player prediction test around "add another server."
27. Fix high-impact misunderstandings.
28. Run full tests/typecheck/build.
29. Stop for review before Phase 4.

---

# 14. Phase 3 Acceptance Scenario

A representative player flow:

```text
Player continues same company after first milestone
→ traffic grows
→ app demand reaches 900 req/s
→ one app has 600 req/s capacity
→ DB still has headroom
→ app bottleneck appears
→ player adds second 600 req/s instance
→ new instance activates
→ routed demand remains 900 / 0
→ player sees first app still overloaded
→ player enables load balancing
→ routed demand becomes 450 / 450
→ app backlog drains
→ latency improves
→ company continues
```

Alternative valid route:

```text
app overloaded
→ player scales existing instance vertically
→ capacity becomes sufficient after activation delay
→ app backlog drains
→ company continues
```

Neither path should be presented as universally correct.

---

# 15. IDE Implementation Prompt

Use this file together with:

```text
docs/PROJECT_PROPOSAL.md
docs/DEVELOPMENT_ROADMAP.md
docs/phases/PHASE_1_SIMULATION.md
docs/phases/PHASE_2_PR1.md
docs/phases/PHASE_3_SCALING.md
```

Recommended prompt:

```text
Read:
- docs/PROJECT_PROPOSAL.md
- docs/DEVELOPMENT_ROADMAP.md
- docs/phases/PHASE_1_SIMULATION.md
- docs/phases/PHASE_2_PR1.md
- docs/phases/PHASE_3_SCALING.md

Treat PHASE_3_SCALING.md as the detailed gameplay, simulation, persistence, backend, and acceptance specification for this phase.

Inspect the current repository first.

Before modifying code, report:

1. whether Phases 1–2 are fully implemented and stable;
2. how application capacity is currently represented;
3. exact files/functions that must change for per-instance processing and routing;
4. current logic that incorrectly aggregates capacity or assumes implicit balancing;
5. current auth/cloud-save foundation status;
6. the smallest safe implementation order.

Preserve the shared deterministic simulation as the source of truth.

Implement Phase 3 only.

Key invariants:
- installed app capacity is not automatically useful capacity;
- horizontal scaling does not imply load balancing;
- app scaling never increases database capacity;
- same company/run identity continues;
- guest play remains available.

Do not proceed into:
- caching/data strategy;
- autoscaling;
- reliability/failure mechanics;
- full technology tree;
- later phases.

After implementation:

- run Phase 1–2 regression tests;
- run Phase 3 routing/scaling tests;
- run save/auth/cloud-save tests;
- run browser smoke tests;
- run typecheck;
- run production build;
- list files changed;
- explain deviations from this specification;
- report any remaining Phase 3 blockers;
- confirm whether every Phase 3 Definition of Done item is satisfied;
- stop for review.
```

---

# 16. Phase 3 Summary

At the end of Phase 3, the same company should support meaningful application-scaling decisions:

```text
Traffic grows
→ app bottleneck appears
→ player compares Scale Up vs Scale Out
→ horizontal capacity may initially be unused
→ routing/load balancing determines whether it helps
→ app bottleneck improves
→ database remains an independent constraint
→ same company continues
```

This establishes the application-scaling foundation required for Phase 4, where workload characteristics, database investment, and caching begin to determine which data strategy is appropriate.
