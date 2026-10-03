# Phase 4 — Data Strategy and Parameter Variation

> **Project:** 99.99% — System Design Tycoon  
> **Target:** 16–20 October 2026  
> **Primary learning outcomes:** LO1 Diagnose bottlenecks; LO2 Choose scaling strategies; LO4 Weigh design trade-offs  
> **Status:** Detailed implementation plan for Phase 4 only

---

# 1. Goal

Extend the continuous campaign so that **workload characteristics and timing determine whether database upgrades or caching are useful**.

Phase 4 should make the player reason about the **kind of traffic** reaching the data layer, not merely the amount of traffic.

The central idea is:

> **The same amount of traffic can require different responses depending on read/write mix, cacheability, warm-up, architecture, and timing.**

The player should no longer be able to rely on one repeated upgrade sequence.

This phase should establish:

- read-heavy vs write-heavy workload differences;
- cacheable-read share;
- cache hit rate;
- cache warm-up;
- database upgrade vs cache trade-offs;
- seeded but bounded workload variation;
- the same event producing different outcomes under different architectures;
- centralized analytics attribution for runs/sessions.

The company, architecture, finances, history, and campaign identity continue from earlier phases.

This is not a standalone data-layer lesson.

---

# 2. Player Experience

The player has already experienced:

```text
database bottleneck
→ app scaling
→ routing/load balancing
```

Now the same company begins facing different workload profiles.

A representative flow:

```text
Company grows
→ traffic spike arrives
→ player sees read/write characteristics
→ data-layer pressure increases
→ player compares DB upgrade vs cache
→ player chooses a response
→ cache may warm gradually
→ DB demand changes
→ outcome depends on workload
→ postmortem explains why the choice worked or did not work
→ same company continues
```

The player should learn that:

```text
cache works well for repeated eligible reads
```

but:

```text
cache helps less for writes or non-cacheable traffic
```

and:

```text
database capacity upgrades are broader but costlier/slower
```

---

## 2.1 Starting state for Phase 4

The player enters Phase 4 with:

- the same company from Phases 1–3;
- application scaling options already introduced;
- routing/load balancing available where unlocked;
- one database;
- no read cache deployed by default.

The database should still be a single database component for MVP simplicity.

The phase should not introduce database sharding, replicas, or database failover.

---

## 2.2 Workload profiles

At minimum, support distinct workload profiles such as:

### Read-heavy

Example:

```text
Traffic:              900 req/s
Read share:            80%
Write share:           20%
Cacheable read share: 100% of reads
```

This workload should strongly benefit from caching once the cache is warm.

---

### Write-heavy

Example:

```text
Traffic:              900 req/s
Read share:            30%
Write share:           70%
Cacheable read share: 100% of reads
```

This workload should benefit much less from caching.

The player should be able to observe that the same cache technology has different value under different traffic.

---

## 2.3 Cache introduction

The player can deploy a **Read Cache**.

The cache should not instantly remove all database work.

Its value depends on:

```text
read share
× cacheable-read share
× cache hit rate
```

A simple model is sufficient.

The proposal's worked example uses:

```text
900 requests/s
80% reads
60% cache hit rate
```

which gives:

```text
DB demand
= 900 × (1 − 0.8 × 0.6)
= 468 ops/s
```

This relationship should be preserved conceptually.

---

## 2.4 Cache warm-up

A newly deployed cache should begin cold or partially warm.

Suggested behavior:

```text
initial hit rate = low
target hit rate = configured value
hit rate increases over several simulation steps
```

This means:

```text
cache installed
≠
instant full benefit
```

The player should be able to see:

- current hit rate;
- target hit rate;
- warm-up progress;
- resulting database demand.

Warm-up should be deterministic for a given run state.

---

## 2.5 Database upgrade remains viable

The existing database upgrade remains a valid option.

Example:

```text
DB capacity:
600
→
1000 ops/s
```

This may be preferable when:

- write share is high;
- cacheable share is low;
- immediate broad capacity is required;
- cache warm-up is too slow for the situation.

The game should not label database upgrades as the "boring" or "wrong" choice.

---

## 2.6 Cache tuning

Introduce a simple **Cache Tuning** effect consistent with the proposal's 9-unlock tree.

In Phase 4, this may initially exist as a mechanic or controlled option even if the full tree arrives in Phase 5.

Cache tuning may modify:

```text
target hit rate
warm-up speed
```

Keep the model simple.

Do not implement:

- eviction algorithms;
- TTL policy simulators;
- cache coherence;
- distributed cache topology.

---

## 2.7 Same event, different outcome

The same traffic spike should be able to produce:

```text
application overload
database overload
no incident
```

depending on architecture and workload.

Example:

### Architecture A

```text
weak app tier
strong DB
```

Result:

```text
application bottleneck
```

### Architecture B

```text
strong app tier
weak DB
```

Result:

```text
database bottleneck
```

### Architecture C

```text
strong app tier
warm cache
strong DB
```

Result:

```text
no incident
```

This is a central replayability requirement.

Events should not encode a predetermined "correct purchase."

---

## 2.8 Read-heavy vs write-heavy consequence

A player should be able to experience:

```text
Read-heavy spike
→ cache becomes highly effective
```

and later:

```text
Write-heavy spike
→ same cache provides limited benefit
```

The postmortem should explain this using the actual workload and hit-rate evidence.

---

## 2.9 Continuous campaign identity

Preserve:

- same run/company ID;
- app instances;
- routing state;
- DB upgrades;
- cache state;
- cash;
- recurring costs;
- event history;
- milestone history;
- previous postmortems.

The player should feel that the architecture they built earlier changes the outcome of later events.

---

# 3. Learning Outcomes

## LO1 — Diagnose bottlenecks

The player should identify whether the limiting factor is:

- application processing;
- database capacity;
- insufficient cache benefit;
- cache warm-up delay.

Evidence should include:

- app demand/capacity;
- DB demand/capacity;
- read/write mix;
- cacheable-read share;
- current cache hit rate;
- warm-up state;
- backlog;
- latency;
- errors.

---

## LO2 — Choose scaling strategies

The player should compare:

### Database upgrade

Useful when:

- total DB demand is high;
- workload is write-heavy;
- many reads are not cacheable;
- broader capacity is needed.

Trade-offs:

- activation delay;
- recurring cost;
- does not reduce work generated by the workload.

### Read cache

Useful when:

- workload is read-heavy;
- reads are cacheable;
- hit rate becomes sufficiently high.

Trade-offs:

- warm-up delay;
- cache cost;
- limited value for writes;
- limited value for non-cacheable reads.

### Cache tuning

Useful when:

- cache already exists;
- improving hit rate or warm-up meaningfully changes DB demand.

The player should reason from workload evidence rather than use a fixed upgrade order.

---

## LO4 — Weigh trade-offs

The player should compare:

```text
cost
activation delay
warm-up delay
workload fit
capacity gained
future usefulness
```

The phase should reinforce:

> A good architecture decision depends on context.

---

# 4. Engineering

## 4.1 Extend the existing database model

Do not create a second database-upgrade system.

Extend the existing database model with workload-aware demand.

Database demand should be derived from application-processed requests after cache effects.

---

## 4.2 Workload state

Add or formalize:

```text
readShare
writeShare
cacheableReadShare
```

Require:

```text
readShare + writeShare = 1
```

or equivalent normalized representation.

The workload should be part of scenario/run state and reproducible from the seed/configuration.

---

## 4.3 Cache state

A cache should track at least:

```text
deployed
currentHitRate
targetHitRate
warmupProgress
warmupDuration
cost
```

Optional simple fields:

```text
enabled
tuningLevel
```

Keep this small.

---

## 4.4 Database demand calculation

A simple initial model:

```text
cacheableReadFraction
=
readShare × cacheableReadShare
```

Then:

```text
cacheHitFraction
=
cacheableReadFraction × currentHitRate
```

Then:

```text
DB operations per processed request
=
1 − cacheHitFraction
```

Therefore:

```text
dbDemandOps
=
processedAppRequests × (1 − readShare × cacheableReadShare × currentHitRate)
```

Example:

```text
processedAppRequests = 900
readShare = 0.8
cacheableReadShare = 1.0
currentHitRate = 0.6
```

Then:

```text
dbDemandOps
=
900 × (1 − 0.8 × 1.0 × 0.6)
=
468 ops/s
```

Writes always reach the database in this simplified model.

---

## 4.5 Cache warm-up calculation

Use deterministic warm-up.

Example:

```text
currentHitRate =
min(
  targetHitRate,
  previousHitRate + warmupIncrementPerStep
)
```

Alternative deterministic model is acceptable if simple and testable.

The important invariant is:

```text
cold cache
→ lower hit rate
→ higher DB demand
```

and:

```text
warm cache
→ higher hit rate
→ lower DB demand
```

---

## 4.6 Cache tuning

Cache tuning may modify:

```text
targetHitRate
warmupIncrementPerStep
```

For example:

```text
Base cache:
target hit rate = 0.60

Tuned cache:
target hit rate = 0.75
```

or:

```text
Base warm-up = 5 steps
Tuned warm-up = 3 steps
```

Exact values are balance parameters.

Do not turn this into a detailed cache-engine simulator.

---

## 4.7 Seeded workload/event configuration

Introduce bounded scenario configuration.

A scenario should define or derive:

```text
baseline traffic
growth rate
spike magnitude
spike duration
read share
write share
cacheable share
event timing
```

The random seed should choose values within approved ranges.

The same:

```text
seed
+ starting architecture
+ action sequence
```

must reproduce the same run.

---

## 4.8 Evaluation scenario vs normal variation

Separate:

### Fixed evaluation configuration

Used later for formal testing.

Properties:

- stable;
- recorded;
- reproducible;
- same first incident where needed.

### Normal replay configuration

May vary:

- workload mix;
- spike magnitude;
- spike duration;
- timing;
- budget where later enabled.

Do not accidentally randomize formal evaluation conditions.

---

## 4.9 Same event under different architectures

Scenario generation should describe external demand.

The simulation determines the bottleneck.

Do not encode:

```text
eventType = DATABASE_INCIDENT
```

if the event is really:

```text
traffic spike
```

Instead:

```text
traffic event
→ simulation evaluates architecture
→ resulting bottleneck emerges
```

This is essential to the project's "same event, different solution" design.

---

## 4.10 Postmortem updates

Extend postmortems to include workload context.

For example:

```text
Traffic was 900 req/s.
80% of requests were reads.
The cache reached a 60% hit rate.
DB demand fell from 900 to 468 ops/s.
```

For a write-heavy scenario:

```text
Only 30% of traffic was read traffic, so the cache could remove only a limited share of DB operations.
```

Postmortems should explain actual outcomes rather than recommend one technology universally.

---

## 4.11 Metric/UI updates

Display enough workload information for decision-making.

Suggested visible fields:

```text
read %
write %
cacheable read %
cache hit rate
cache warm-up progress
DB demand
DB capacity
```

Do not overload the main dashboard.

A component/details panel can hold secondary information.

---

## 4.12 Centralized analytics ingestion

The master roadmap requires Phase 4 to centralize analytics ingestion and run/session attribution.

Analytics should reliably associate events with:

```text
session ID
run ID
build version
scenario version
seed
user/guest identifier where allowed
event sequence
timestamp
```

The backend should validate event payloads.

Do not expose privileged database credentials to the browser.

---

## 4.13 Session/run distinction

Maintain clear identity:

```text
session = one browser/play session
run = one company campaign attempt
```

A resumed run may occur in a new session.

Analytics should preserve this distinction.

---

# 5. Existing Modules

Likely relevant areas:

```text
shared step engine
scenario configuration
database model
actions
metrics derivation
architecture view
charts
postmortem generation
telemetry client
backend ingestion
campaign store
save schema
```

Likely file equivalents:

```text
src/sim/step.ts
src/sim/scenarios/*
src/sim/actions.ts
src/sim/derive.ts
src/sim/postmortem.ts
src/game/store.ts
src/analytics/telemetry.ts
src/backend/*
src/components/*
```

The IDE should inspect actual repository conventions first.

---

# 6. New Modules

The master roadmap calls for:

```text
cache calculation helper
bounded scenario generator
```

Possible additions:

```text
src/sim/cache.ts
src/sim/scenarioGenerator.ts
```

Potential supporting tests:

```text
src/sim/cache.test.ts
src/sim/scenarioGenerator.test.ts
```

A schema/config file may also be appropriate:

```text
src/sim/scenarios/schema.ts
```

Do not add a large generic simulation framework unless the current codebase clearly requires it.

---

# 7. Automated Testing

## 7.1 Cache arithmetic

Test:

```text
no cache
cold cache
partially warm cache
fully warm cache
```

Verify exact DB-demand calculations.

Example:

```text
900 req/s
80% reads
100% cacheable reads
60% hit rate
→ 468 DB ops/s
```

---

## 7.2 Write-heavy limitation

Example:

```text
900 req/s
30% reads
100% cacheable reads
60% hit rate
```

Expected:

```text
dbDemand
=
900 × (1 − 0.3 × 0.6)
=
738 ops/s
```

The test should prove that the same cache is much less effective here.

---

## 7.3 Non-cacheable reads

Test:

```text
high read share
low cacheable share
```

and verify that DB demand remains high despite cache deployment.

---

## 7.4 Warm-up

Test:

- cache starts at configured initial hit rate;
- hit rate increases deterministically;
- target hit rate is never exceeded;
- DB demand falls step by step;
- save/resume preserves warm-up state.

---

## 7.5 Cache tuning

Test:

- tuning changes only intended parameters;
- tuning does not activate before action completion;
- tuned hit rate/warm-up produces expected DB-demand change;
- cost is applied exactly once.

---

## 7.6 Database upgrade

Regression test:

- DB upgrade still changes DB capacity;
- cache changes DB demand;
- the two mechanisms remain distinct.

This distinction is important:

```text
DB upgrade → capacity ↑
Cache → demand ↓
```

---

## 7.7 Seed reproducibility

Test:

```text
same seed
→ same workload/event configuration
```

including:

- traffic profile;
- spike timing;
- spike duration;
- read/write mix;
- cacheable share.

---

## 7.8 Different seeds

Test that different allowed seeds can produce bounded variation without invalid scenarios.

Avoid:

- impossible recovery;
- instant unavoidable bankruptcy;
- events with no useful warning;
- values outside configured ranges.

---

## 7.9 Same event, different architecture

Use one external traffic event with at least three architectures.

Verify:

### Weak app / strong DB

```text
application bottleneck
```

### Strong app / weak DB

```text
database bottleneck
```

### Strong app / warm cache / sufficient DB

```text
no incident
```

The event itself must not hard-code the incident result.

---

## 7.10 Evaluation configuration

Test:

- fixed evaluation configuration never changes with random normal replay generation;
- evaluation seed/config version is recorded;
- normal replay generation cannot overwrite fixed evaluation values.

---

## 7.11 Postmortem

Test:

- workload mix appears correctly;
- cache hit rate appears correctly;
- DB demand before/after is correct;
- cache is not credited when it had negligible effect;
- DB upgrade is not described as reducing workload;
- write-heavy limitation is explained accurately.

---

## 7.12 Analytics attribution

Test:

- every event has run ID;
- every event has session ID;
- build/scenario version is recorded;
- event ordering is preserved;
- duplicate event IDs are rejected/deduplicated where intended;
- resumed run retains run identity across sessions.

---

## 7.13 Full Phase 4 acceptance paths

### Path A — Read-heavy + cache

```text
read-heavy spike
→ DB overload
→ deploy cache
→ cache warms
→ DB demand falls
→ backlog drains
→ recovery
```

### Path B — Write-heavy + cache is insufficient

```text
write-heavy spike
→ DB overload
→ deploy cache
→ limited DB-demand reduction
→ DB remains constrained
→ player upgrades DB
→ recovery
```

### Path C — DB upgrade only

```text
DB overload
→ DB upgrade
→ capacity increases
→ backlog drains
→ recovery
```

### Path D — Same traffic, different prior architecture

```text
same external spike
→ architecture A: app overload
→ architecture B: DB overload
→ architecture C: no incident
```

---

# 8. Human Validation

The core validation question is:

> **Do players change their decisions when workload characteristics change?**

---

## 8.1 Suggested test design

Use both fresh and returning testers.

Present two scenarios with similar traffic but different workload mixes.

Example:

### Scenario A

```text
80% reads
high cacheable share
```

### Scenario B

```text
30% reads
high write share
```

Ask before action:

> "Which response seems most appropriate here, and why?"

Do not reveal the answer.

---

## 8.2 Observe

Record:

- whether player notices read/write mix;
- whether player understands cacheable share;
- whether player expects cache to help writes;
- whether warm-up is understood;
- whether DB upgrade vs cache feels like a real trade-off;
- whether changed conditions change the player's choice;
- whether extra metrics feel useful or overwhelming.

---

## 8.3 Begin paired learning assessment

The master roadmap specifies that equivalent pre/post questions begin around this period for implemented concepts.

Use only concepts already present in the game.

Possible question focus:

- identify bottleneck;
- choose scaling/cache strategy;
- explain one benefit and one limitation.

Do not assess reliability concepts before Phase 6 is implemented.

---

## 8.4 Human validation success signal

A player should be able to explain something like:

> "Caching works better here because most requests are cacheable reads."

and in another scenario:

> "This workload is mostly writes, so the cache will not reduce enough database work. A database upgrade makes more sense."

The exact wording does not matter.

Context-sensitive reasoning does.

---

# 9. Definition of Done

Phase 4 is complete only when all of the following are true.

## Workload model

- [ ] Read/write mix exists in simulation state.
- [ ] Cacheable-read share exists.
- [ ] Workload parameters affect DB demand.
- [ ] Values are deterministic for a given scenario/seed.

## Cache

- [ ] Read cache can be deployed.
- [ ] Cache hit rate is modeled.
- [ ] Cache warm-up is modeled.
- [ ] Cache only reduces eligible read work.
- [ ] Writes always reach the DB in this simplified model.
- [ ] Cache tuning modifies intended cache behavior.
- [ ] Cache state survives save/resume.

## Database

- [ ] Existing DB upgrade remains functional.
- [ ] DB upgrade changes capacity, not workload.
- [ ] Cache changes workload, not DB capacity.
- [ ] Both strategies can be viable under suitable conditions.

## Scenario variation

- [ ] Seeded bounded workload variation works.
- [ ] Same seed reproduces same event parameters.
- [ ] Different seeds can vary workload safely.
- [ ] Same external event can produce app overload, DB overload, or no incident depending on architecture.
- [ ] No event hard-codes a required purchase.

## UI / player experience

- [ ] Read/write mix is understandable.
- [ ] Cache hit rate is visible.
- [ ] Warm-up progress is visible.
- [ ] DB demand/capacity is visible.
- [ ] Player can compare cache vs DB upgrade.
- [ ] Same company continues through the phase.

## Postmortem

- [ ] Workload context appears.
- [ ] Cache effectiveness is quantified from actual state.
- [ ] Write-heavy limitations are explained.
- [ ] Postmortem remains causal rather than prescriptive.

## Analytics

- [ ] Centralized ingestion is working.
- [ ] Run/session attribution is reliable.
- [ ] Build/scenario/seed metadata is recorded.
- [ ] Resume preserves run identity across sessions.

## Validation

- [ ] At least two contrasting workload scenarios are tested with users.
- [ ] Players' reasoning is recorded.
- [ ] Paired assessment begins only for implemented concepts.
- [ ] Confusion from new metrics is documented.

## Engineering quality

- [ ] Cache arithmetic tests pass.
- [ ] Warm-up tests pass.
- [ ] Write-heavy limitation tests pass.
- [ ] Seed reproducibility tests pass.
- [ ] Same-event/different-architecture tests pass.
- [ ] Analytics attribution tests pass.
- [ ] Phase 1–3 regression tests remain healthy.
- [ ] Typecheck/build pass or pre-existing failures are documented.

---

# 10. Dependencies

Phase 4 depends on a stable foundation from Phases 1–3.

Required:

### From Phase 1

- deterministic step engine;
- DB demand/capacity model;
- backlog;
- recovery rules;
- trace/postmortem foundation.

### From Phase 2

- metrics UI;
- architecture view;
- local persistence;
- telemetry basics;
- continuous campaign flow.

### From Phase 3

- per-instance application processing;
- routing/load balancing;
- correct app-vs-DB bottleneck behavior;
- account/cloud-save foundation;
- save schema capable of evolving safely.

Do not implement Phase 4 workload variation on top of unstable app-routing logic.

---

# 11. Scope Guard

Do not expand Phase 4 into:

- cache eviction algorithms;
- TTL design;
- distributed cache clusters;
- consistency models;
- cache invalidation gameplay;
- database replicas;
- database sharding;
- database failover;
- queues;
- microservices;
- autoscaling;
- application failure;
- health checks;
- failover;
- full progression tree;
- complex staff simulation;
- arbitrary scenario editor;
- new incident families.

The phase only needs enough data-layer behavior to support meaningful workload-dependent decisions.

---

# 12. Main Risks and Mitigations

## Risk 1 — Cache becomes a universal best answer

**Mitigation:**

Make effectiveness depend on:

```text
read share
cacheable share
hit rate
warm-up
```

---

## Risk 2 — Too many new metrics overwhelm players

**Mitigation:**

Keep primary dashboard simple.

Put detailed workload/cache information in component details.

---

## Risk 3 — Scenario variation becomes random noise

**Mitigation:**

Use bounded parameter ranges and deterministic seeds.

Variation should change decisions, not merely cosmetic numbers.

---

## Risk 4 — Events hard-code the answer

**Mitigation:**

Events describe workload.

Architecture determines bottleneck/outcome.

---

## Risk 5 — Cache warm-up feels arbitrary

**Mitigation:**

Show current hit rate and warm-up progress.

Keep deterministic timing.

---

## Risk 6 — DB upgrade and cache become mechanically identical

**Mitigation:**

Preserve the conceptual distinction:

```text
DB upgrade → capacity ↑
Cache → demand ↓
```

---

## Risk 7 — Analytics identity becomes unreliable

**Mitigation:**

Define run/session/build/scenario IDs centrally and test resume behavior.

---

# 13. Recommended Implementation Order

1. Verify Phase 3 Definition of Done.
2. Run full simulation/routing regression suite.
3. Inspect existing workload/scenario representation.
4. Define workload state contract.
5. Add read/write/cacheable-share fields.
6. Add cache state contract.
7. Implement cache-demand helper.
8. Add exact cache arithmetic tests.
9. Implement deterministic cache warm-up.
10. Add warm-up tests.
11. Add cache deployment action.
12. Add cache tuning action/effect.
13. Confirm DB upgrade remains separate.
14. Add workload metrics to simulation snapshots.
15. Add workload/cache UI.
16. Extend postmortems with workload/cache evidence.
17. Define bounded scenario parameter ranges.
18. Implement seeded scenario generator.
19. Add reproducibility tests.
20. Add same-event/different-architecture tests.
21. Separate fixed evaluation config from replay config.
22. Update save schema for workload/cache state.
23. Verify local/cloud save-resume.
24. Centralize analytics ingestion.
25. Add run/session/build/scenario attribution.
26. Add analytics tests.
27. Run full Phase 4 acceptance paths.
28. Test read-heavy and write-heavy cases with users.
29. Begin paired assessment for implemented concepts.
30. Fix high-impact confusion only.
31. Run typecheck/tests/build.
32. Stop for review before Phase 5.

---

# 14. Phase 4 Acceptance Scenario

A representative read-heavy path:

```text
Same company continues
→ 900 req/s spike arrives
→ 80% reads
→ DB demand exceeds capacity
→ player inspects workload
→ deploys read cache
→ cache warms toward 60% hit rate
→ DB demand falls toward 468 ops/s
→ backlog drains
→ system recovers
→ postmortem explains why cache worked
```

A contrasting write-heavy path:

```text
same traffic
→ only 30% reads
→ cache deployed
→ DB demand remains high
→ player sees limited benefit
→ upgrades DB
→ capacity rises
→ backlog drains
→ postmortem explains why workload changed the best response
```

Neither path should be scripted as the only legal solution.

---

# 15. IDE Implementation Prompt

Use this file with:

```text
docs/PROJECT_PROPOSAL.md
docs/DEVELOPMENT_ROADMAP.md
docs/phases/PHASE_1_SIMULATION.md
docs/phases/PHASE_2_PR1.md
docs/phases/PHASE_3_SCALING.md
docs/phases/PHASE_4_DATA_STRATEGY.md
```

Recommended prompt:

```text
Read:
- docs/PROJECT_PROPOSAL.md
- docs/DEVELOPMENT_ROADMAP.md
- docs/phases/PHASE_1_SIMULATION.md
- docs/phases/PHASE_2_PR1.md
- docs/phases/PHASE_3_SCALING.md
- docs/phases/PHASE_4_DATA_STRATEGY.md

Treat PHASE_4_DATA_STRATEGY.md as the detailed gameplay, simulation, scenario, analytics, and acceptance specification for this phase.

Inspect the current repository first.

Before modifying code, report:

1. whether Phases 1–3 are fully implemented and stable;
2. how workload and database demand are currently represented;
3. where cache mechanics should integrate into the existing step engine;
4. exact files/functions that must change;
5. current analytics/session/run attribution status;
6. any conflict between current implementation and this phase plan;
7. the smallest safe implementation order.

Preserve these invariants:
- cache reduces eligible read demand rather than increasing DB capacity;
- DB upgrades increase capacity rather than reducing workload;
- writes are not served by the read cache in this simplified MVP model;
- workload variation is deterministic from scenario/seed;
- events describe external workload, not a hard-coded incident answer;
- the same company continues.

Implement Phase 4 only.

Do not proceed into:
- full progression tree;
- autoscaling;
- reliability/failure mechanics;
- extra incident families;
- later phases.

After implementation:
- run Phase 1–3 regression tests;
- run Phase 4 cache/workload/scenario tests;
- run analytics attribution tests;
- run browser smoke tests;
- run typecheck;
- run production build;
- list files changed;
- explain deviations from this phase specification;
- report remaining Phase 4 blockers;
- confirm whether every Phase 4 Definition of Done item is satisfied;
- stop for review.
```

---

# 16. Phase 4 Summary

At the end of Phase 4, the same company should support workload-sensitive data decisions:

```text
Traffic changes
→ read/write mix matters
→ cacheability matters
→ cache warms over time
→ DB demand changes
→ cache and DB upgrades have different strengths
→ same event produces different outcomes under different architectures
→ player adapts rather than repeats one solution
→ same company continues
```

This establishes the scenario variation and data-strategy foundation required for Phase 5, where the campaign's full milestone/research progression and nine-unlock structure are integrated for PR2.
