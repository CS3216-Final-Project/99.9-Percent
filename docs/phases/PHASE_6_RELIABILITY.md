# Phase 6 — Reliability

> **Project:** 99.99% — System Design Tycoon  
> **Target:** 23–28 October 2026, overlapping PR2 integration  
> **Primary learning outcomes:** LO3 Improve reliability; LO4 Weigh design trade-offs; reinforces LO1 Diagnose bottlenecks  
> **Status:** Detailed implementation plan for Phase 6 only

---

# 1. Goal

Extend the continuous campaign so that **temporary application-instance failures interact correctly with health detection, routing, spare capacity, and failover**.

Phase 6 completes the reliability branch of the 9-unlock technology structure.

The player should learn that:

> **Failover does not create capacity.**

A system can successfully detect a failed instance and reroute traffic, yet still remain overloaded if the surviving instances do not have enough capacity.

The phase should establish:

- temporary application-instance unavailability;
- separation between actual health, detected health, and routing eligibility;
- health checks;
- spare application capacity;
- automatic failover;
- preserved capacity constraints after rerouting;
- risky deployments mapping to temporary application unavailability;
- causal reliability postmortems;
- completion of all nine MVP technology unlocks.

The same company, architecture, finances, progression, history, and run identity continue from earlier phases.

This is not a separate reliability lesson.

---

# 2. Player Experience

The player has already learned to manage:

```text
database bottlenecks
application scaling
routing/load balancing
workload-aware caching
progression and technology unlocks
```

Now the campaign introduces reliability pressure.

A representative flow:

```text
Company grows
→ player operates multiple app instances
→ one instance becomes unavailable
→ health state changes
→ player observes whether failure is detected
→ traffic may or may not reroute
→ surviving instances receive additional load
→ system either remains healthy or overloads
→ player responds
→ service recovers
→ postmortem explains detection, routing, and spare-capacity outcome
→ same company continues
```

The player should understand that availability depends on both:

```text
correct failover behavior
AND
enough surviving capacity
```

---

## 2.1 Reliability scenario setup

A representative setup:

```text
Traffic:                 900 req/s
Application instances:   2
Capacity per instance:   600 req/s
Load balancing:          enabled
Database:                sufficient capacity
```

Before failure:

```text
App A: 450 / 600 req/s
App B: 450 / 600 req/s
```

The system is healthy.

Then App B becomes unavailable.

If traffic correctly fails over to App A:

```text
App A: 900 / 600 req/s
App B: unavailable
```

The system still overloads.

This is the core Phase 6 teaching example.

---

## 2.2 Temporary application failure

A failure event should temporarily make one application instance unavailable.

Possible causes:

- seeded failure event;
- risky deployment;
- modeled operational fault.

Do not create a new incident family for each cause.

All such events map to:

```text
temporary application-instance unavailability
```

The player should see:

- which instance failed;
- when it actually became unhealthy;
- whether the system has detected that failure;
- whether the instance is still receiving traffic;
- whether rerouting has occurred.

---

## 2.3 Actual health vs detected health

The player should experience a distinction between:

```text
actual instance health
```

and:

```text
what the system currently knows
```

Example:

```text
Step 10:
App B actually fails.

Step 11:
Without health checks, routing still considers App B eligible.

Step 12:
With health checks, failure is detected and App B becomes ineligible.
```

Exact detection delay is a balance parameter.

The key teaching point is:

> A failed service is not automatically removed from routing unless the system can detect that failure.

---

## 2.4 Health Checks

Health Checks should be a reliability technology.

When deployed, they should:

- inspect application-instance health;
- detect unhealthy instances after a deterministic delay;
- update detected health;
- make failed instances removable from routing once detected.

Health Checks should not:

- add capacity;
- replace failed instances;
- automatically guarantee availability.

They provide **detection**.

---

## 2.5 Spare Application Instance

A spare application instance provides additional capacity.

It may be:

- already running;
- warm standby;
- otherwise available under the simplified model.

For MVP clarity, keep the behavior explicit and deterministic.

The spare instance should:

- cost resources;
- contribute usable capacity only when active/eligible;
- be visible in the architecture;
- not automatically reroute traffic unless routing/failover capability exists.

Teaching point:

> Spare capacity helps only when it can actually receive traffic.

---

## 2.6 Automatic Failover

Automatic Failover should require the proposal-defined prerequisites:

```text
Health Checks
+
Spare Application Instance
+
Load Balancing
```

When active:

```text
instance fails
→ health check detects failure
→ failed instance becomes ineligible
→ traffic reroutes to healthy eligible instances
```

Automatic Failover should not:

- instantly repair the failed instance;
- create a replacement server from nothing;
- increase capacity beyond surviving/spare instances;
- solve database bottlenecks.

---

## 2.7 Sufficient surviving capacity

Example:

```text
Traffic = 500 req/s
2 × 600 req/s app instances
one fails
```

After failover:

```text
survivor receives 500 / 600 req/s
```

Expected result:

- service remains available;
- no app overload;
- temporary disruption may occur depending on detection delay;
- postmortem credits health checks/failover/spare capacity appropriately.

---

## 2.8 Insufficient surviving capacity

Core example:

```text
Traffic = 900 req/s
2 × 600 req/s app instances
one fails
```

After failover:

```text
survivor receives 900 / 600 req/s
```

Expected result:

- failed instance is correctly bypassed;
- routing is technically correct;
- remaining instance overloads;
- backlog/latency/errors rise;
- incident remains active until capacity is restored or demand is reduced.

Teaching point:

> Correct failover can still leave the service degraded.

---

## 2.9 Recovery options

Depending on currently unlocked technologies/actions, the player may respond with:

- activate/add another app instance;
- scale up a surviving instance;
- temporarily limit traffic;
- restore/restart the failed instance;
- wait for a temporary failure to recover, if safe and modeled;
- use existing autoscaling if conditions allow.

The phase should not introduce an entirely new recovery subsystem.

Reuse earlier action scheduling and capacity mechanics.

---

## 2.10 Risky deployment

The proposal includes deployment timing/testing as lightweight policy controls.

For Phase 6:

```text
risky deployment
→ may trigger temporary application-instance unavailability
```

This should use the same failure model as seeded faults.

Do not create:

```text
deployment incident family
```

as a separate simulation family.

---

## 2.11 Continuous campaign identity

After reliability incidents:

- preserve same run/company ID;
- preserve all previous architecture choices;
- preserve deployed reliability technologies;
- preserve cash and recurring cost;
- preserve incident history;
- preserve postmortems;
- preserve research/progression state.

The company should visibly evolve toward a more resilient architecture.

---

# 3. Learning Outcomes

## LO3 — Improve reliability

This phase directly implements LO3.

The player should understand how:

- health checks detect unhealthy instances;
- spare capacity provides additional surviving capacity;
- load balancing enables rerouting;
- automatic failover moves traffic away from failed instances;
- remaining capacity determines whether the service stays healthy.

The intended takeaway is:

> Reliability is not just detecting failure; the surviving system still has to handle the load.

---

## LO4 — Weigh design trade-offs

Reliability investments should involve trade-offs:

### Health Checks

Benefit:

```text
faster/automatic failure detection
```

Cost/limitation:

```text
no extra capacity
```

### Spare Application Instance

Benefit:

```text
more surviving capacity
```

Cost/limitation:

```text
recurring cost / potentially idle capacity
```

### Automatic Failover

Benefit:

```text
reroutes traffic after detected failure
```

Cost/limitation:

```text
depends on health checks, routing, and sufficient surviving capacity
```

---

## LO1 reinforcement

The player still needs to diagnose:

```text
failed instance
vs
routing problem
vs
surviving-capacity overload
vs
database bottleneck
```

The game should not flatten every reliability symptom into one generic "server down" explanation.

---

# 4. Engineering

## 4.1 Temporary application unavailability

Extend per-instance application state with explicit health.

Suggested minimum fields:

```text
actualHealth
detectedHealth
routingEligible
failureStartStep
failureEndStep
```

Possible values:

```text
actualHealth:
healthy | failed

detectedHealth:
unknown | healthy | unhealthy
```

Exact representation should match repository conventions.

---

## 4.2 Separate actual, detected, and routed state

This separation is non-negotiable.

Do not model failure as one boolean that simultaneously:

```text
fails instance
removes it from routing
starts replacement
```

The state transitions should be conceptually distinct:

```text
actual failure
→ detection
→ routing eligibility change
→ rerouting
```

This is central to the learning objective.

---

## 4.3 Failure scheduling

Introduce deterministic temporary failure scheduling.

A failure event should define:

```text
targetInstanceId
failureStartStep
failureDuration
cause
```

The cause may be:

```text
seeded failure
risky deployment
```

The physical outcome is the same:

```text
temporary instance unavailability
```

---

## 4.4 Health-check behavior

A health-check system should track:

```text
enabled
checkInterval / detectionDelay
```

For MVP simplicity, a deterministic detection delay is sufficient.

Example:

```text
actual failure at step 10
health-check detection delay = 1 step
detected unhealthy at step 11
```

Do not simulate packet-level probing.

---

## 4.5 Routing eligibility

The routing helper from Phase 3 should use:

```text
routingEligible
```

rather than raw actual health alone.

Before failure detection:

```text
failed instance may still be considered routable
```

After detection:

```text
failed instance becomes ineligible
```

This lets the game represent why health checks matter.

---

## 4.6 Spare capacity

The reliability model should distinguish:

```text
normal required capacity
spare capacity
```

A spare instance may be modeled as an additional active instance with a role/flag, or as another simple explicit state.

Avoid building a complex standby orchestration system.

The key simulation requirement is that spare capacity can absorb load if routing allows.

---

## 4.7 Automatic failover

Automatic Failover should trigger only when prerequisites are deployed.

Required prerequisites:

```text
Health Checks
Spare Application Instance
Load Balancing
```

When a failure is detected:

```text
failed instance routingEligible = false
traffic is redistributed across remaining eligible instances
```

Do not create capacity during failover.

---

## 4.8 Capacity after rerouting

Critical invariant:

```text
surviving capacity
=
sum(capacity of healthy + eligible instances)
```

After routing changes, calculate overload exactly as normal.

Example:

```text
traffic = 900
surviving capacity = 600
```

Then:

```text
demand > capacity
→ backlog grows
→ latency/errors rise
```

No special "failover success" flag should bypass normal overload logic.

---

## 4.9 Restoration

Temporary failures should eventually restore the affected instance if the event duration expires or the relevant recovery action completes.

Restoration should update:

```text
actual health
detected health as appropriate
routing eligibility
```

The instance should not instantly receive traffic before routing state permits it.

---

## 4.10 Reliability incident state

The proposal defines only two MVP incident families:

1. capacity overload;
2. temporary application-instance failure.

Preserve that boundary.

Do not create separate families for:

- health-check delay;
- failover;
- risky deployment;
- spare-capacity shortage.

These should be symptoms/causes within the same reliability/capacity model.

---

## 4.11 Recovery conditions

Continue using measured system state.

For a failure-related incident, recovery should require:

```text
failed component restored
OR
safely bypassed
```

and:

```text
latency < 500 ms
service errors < 1%
for 5 consecutive steps
```

where applicable under the shared recovery model.

If the failed component is bypassed but surviving capacity remains overloaded, recovery should not complete.

---

## 4.12 Reliability postmortems

Extend trace-based postmortems with:

```text
failure time
actual health transition
detection time
routing change
surviving capacity
traffic after reroute
player actions
restoration time
recovery metrics
```

The postmortem should be able to say:

> The failed instance was correctly detected and removed from routing, but the remaining 600 req/s of application capacity received 900 req/s of traffic, so the service remained overloaded.

This is the key causal explanation.

---

## 4.13 Architecture visualization

Update the 2D architecture view to show:

- healthy instance;
- failed instance;
- detected/undetected failure state where understandable;
- spare instance;
- current routing paths;
- overloaded surviving instance;
- health-check/failover technology state.

Use simple visual cues.

Do not overcomplicate the diagram.

---

## 4.14 Reliability branch completion

Phase 6 completes:

```text
Health Checks
Spare Application Instance
Automatic Failover
```

By the end of this phase, all nine technology unlocks must have real simulation effects.

Do not leave a reliability node cosmetic.

---

## 4.15 Risky deployment integration

If deployment testing/timing controls already exist or are introduced here in lightweight form:

```text
riskier deployment
→ higher modeled chance of temporary app unavailability
```

Keep this deterministic/seeded for reproducibility.

Do not create a detailed CI/CD simulator.

---

# 5. Existing Modules

Likely relevant areas:

```text
shared step engine
incident engine
action scheduler
per-instance application state
routing helper
technology definitions
progression state
postmortems
architecture indicators
scenario/event configuration
save schema
```

Possible file equivalents:

```text
src/sim/step.ts
src/sim/incidents.ts
src/sim/actions.ts
src/sim/routing.ts
src/sim/types.ts
src/game/technologies.ts
src/game/progression.ts
src/sim/postmortem.ts
src/components/ArchitectureCanvas.tsx
src/game/persist.ts
```

The IDE must inspect actual repository structure before modifying code.

---

# 6. New Modules

The master roadmap calls for:

```text
failure scheduling
detection/routing transition helpers
```

Possible additions:

```text
src/sim/failures.ts
src/sim/healthDetection.ts
```

Potential tests:

```text
src/sim/failures.test.ts
src/sim/healthDetection.test.ts
```

If existing incident/routing modules can absorb this cleanly, prefer extension over unnecessary fragmentation.

---

# 7. Automated Testing

## 7.1 Single-instance failure

Test:

```text
one app instance
→ instance fails
```

Expected:

- actual health becomes failed;
- service capacity becomes unavailable;
- service degrades/fails appropriately;
- restoration works.

---

## 7.2 Detection delay

Test:

- actual failure occurs at configured step;
- detected health does not change too early;
- detection occurs exactly at configured delay;
- save/resume preserves detection state.

---

## 7.3 No health checks

Test:

```text
instance fails
health checks not deployed
```

Expected:

- system does not automatically gain reliable failure detection;
- routing behavior reflects absence of detection capability;
- no hidden failover occurs.

---

## 7.4 Health Checks

Test:

- deployed Health Checks detect failure;
- health detection does not add capacity;
- health detection does not directly restore service.

---

## 7.5 Routing prerequisites

Test that failover does not occur unless routing prerequisites exist.

Examples:

### Health Checks but no LB

```text
failure detected
→ failed instance known
→ no automatic traffic redistribution capability
```

### LB but no health detection

```text
actual failure
→ failed instance may remain routing-eligible until detected
```

---

## 7.6 Sufficient surviving capacity

Example:

```text
traffic = 500 req/s
App A = 600
App B = 600
App B fails
```

After correct failover:

```text
App A = 500 / 600
```

Expected:

- no sustained overload;
- latency/errors recover;
- incident can resolve after stability window.

---

## 7.7 Insufficient surviving capacity

Core test:

```text
traffic = 900 req/s
App A = 600
App B = 600
App B fails
```

After correct failover:

```text
App A = 900 / 600
```

Expected:

- failover occurs;
- App A overloads;
- backlog grows;
- latency/errors rise;
- incident does not recover merely because rerouting succeeded.

---

## 7.8 Spare instance

Test:

- spare capacity exists only when deployed;
- spare instance has cost;
- spare becomes useful only when routing permits;
- spare does not change DB capacity.

---

## 7.9 Automatic Failover prerequisites

Test that Automatic Failover cannot deploy without:

```text
Health Checks
Spare Application Instance
Load Balancing
```

Test that all prerequisites together enable the expected rerouting behavior.

---

## 7.10 Restoration

Test:

- temporary failure ends at configured time or action;
- actual health restores;
- routing eligibility updates correctly;
- traffic redistribution after restoration is deterministic.

---

## 7.11 Risky deployment

Test:

- risky deployment can schedule temporary app unavailability;
- event remains reproducible for fixed seed/config;
- it uses the same failure model;
- no new incident family is created.

---

## 7.12 Database regression

Test:

- failover/routing changes do not change DB capacity;
- DB bottleneck logic from earlier phases remains intact;
- app failure can coexist with DB headroom correctly.

---

## 7.13 Recovery

Test:

- bypassed failure + insufficient surviving capacity does not count as recovered;
- recovery requires metric thresholds;
- restoration alone does not close an overload if system remains degraded;
- recovery streak resets correctly.

---

## 7.14 Postmortem

Test that the postmortem accurately explains:

- failure start;
- detection delay;
- routing change;
- surviving capacity;
- whether failover succeeded technically;
- whether capacity remained insufficient;
- final recovery action.

---

## 7.15 Phase 6 acceptance paths

### Path A — No health checks

```text
instance fails
→ failure not promptly detected
→ traffic handling degrades
→ player responds manually
```

### Path B — Health checks + LB, enough surviving capacity

```text
instance fails
→ detected
→ rerouted
→ survivor handles load
→ service stabilizes
```

### Path C — Health checks + LB, insufficient surviving capacity

```text
instance fails
→ detected
→ rerouted
→ survivor overloaded
→ player adds capacity / limits traffic
→ recovery
```

### Path D — Full automatic failover

```text
Health Checks
+ Spare App Instance
+ LB
→ failure
→ detection
→ automatic reroute
→ spare capacity absorbs traffic
→ minimal degradation
```

---

# 8. Human Validation

The central validation question is:

> **Do players understand that successful failover still depends on surviving capacity?**

---

## 8.1 Required test example

Use the master-plan example:

```text
Traffic = 900 req/s
2 app instances
600 req/s capacity each
```

Before failure:

```text
450 / 600
450 / 600
```

Then fail one instance.

After failover:

```text
900 / 600
0 / failed
```

Ask the player:

> "The failover worked. Why is the system still unhealthy?"

Do not explain beforehand.

---

## 8.2 Contrast with sufficient capacity

Also test:

```text
Traffic = 500 req/s
2 × 600 req/s
one fails
```

After failover:

```text
500 / 600
```

Ask:

> "Why did this failure have a much smaller impact?"

This contrast should make the capacity concept clearer.

---

## 8.3 Observe

Record whether players understand:

- actual failure vs detected failure;
- purpose of health checks;
- purpose of load balancing;
- purpose of spare capacity;
- why failover may succeed but overload remain;
- which metric shows surviving-capacity shortage;
- whether the reliability branch feels coherent;
- whether the architecture view makes failure/routing understandable.

---

## 8.4 Ask after play

Possible questions:

1. What did Health Checks actually do?
2. What did the spare instance actually do?
3. What did Automatic Failover actually do?
4. Why can failover still leave the service overloaded?
5. What would you change before the next similar failure?
6. Which metric helped you identify the remaining problem?

---

## 8.5 Human validation success signal

A player should be able to explain something like:

> "The failed server was removed from routing correctly, but the remaining server only had capacity for 600 requests per second while traffic was 900, so the system still overloaded."

The exact wording does not matter.

The causal chain does.

---

# 9. Definition of Done

Phase 6 is complete only when all of the following are true.

## Failure model

- [ ] Temporary application-instance failure exists.
- [ ] Failure is deterministic/reproducible.
- [ ] Actual health is modeled separately from detected health.
- [ ] Routing eligibility is modeled separately from actual health.
- [ ] Failure restoration works.

## Health Checks

- [ ] Health Checks have a real simulation effect.
- [ ] Detection delay is deterministic.
- [ ] Failed instances can become ineligible after detection.
- [ ] Health Checks do not add capacity.

## Spare capacity

- [ ] Spare Application Instance has a real simulation effect.
- [ ] Spare capacity is visible.
- [ ] Spare instance has an explicit cost.
- [ ] Spare capacity only helps when routable/eligible.

## Automatic Failover

- [ ] Automatic Failover requires Health Checks.
- [ ] Automatic Failover requires a Spare Application Instance.
- [ ] Automatic Failover requires Load Balancing.
- [ ] Detected failed instance is removed from routing.
- [ ] Traffic redistributes across surviving eligible instances.
- [ ] Failover never creates capacity.

## Surviving-capacity behavior

- [ ] 500 req/s across one surviving 600 req/s instance remains healthy after rerouting.
- [ ] 900 req/s across one surviving 600 req/s instance overloads after rerouting.
- [ ] Correct failover does not directly mark the incident recovered.
- [ ] Existing app backlog/latency/error model determines the outcome.

## Incident / recovery

- [ ] Failure uses the existing temporary-app-failure incident family.
- [ ] Risky deployment maps to temporary app unavailability rather than a new incident family.
- [ ] Recovery remains metric-based.
- [ ] Failed instance must be restored or safely bypassed.
- [ ] Insufficient surviving capacity prevents recovery.

## Technology tree

- [ ] Health Checks works.
- [ ] Spare Application Instance works.
- [ ] Automatic Failover works.
- [ ] All nine MVP technologies now have real simulation effects.
- [ ] No database-failure or database-failover gameplay remains in the new campaign.

## Postmortem

- [ ] Failure start is recorded.
- [ ] Detection time is recorded.
- [ ] Routing change is recorded.
- [ ] Surviving capacity is recorded.
- [ ] Postmortem can distinguish successful failover from sufficient capacity.
- [ ] Causal explanation matches the actual trace.

## Persistence

- [ ] Failure state survives save/resume correctly where relevant.
- [ ] Detection state survives save/resume.
- [ ] Reliability technologies survive save/resume.
- [ ] Same company/run identity is preserved.

## Validation

- [ ] 900 req/s / 2×600 scenario tested with users.
- [ ] Sufficient-capacity contrast scenario tested.
- [ ] Player explanations recorded.
- [ ] Reliability misunderstandings documented.

## Engineering quality

- [ ] Failure scheduling tests pass.
- [ ] Detection-delay tests pass.
- [ ] Routing prerequisite tests pass.
- [ ] Sufficient-capacity tests pass.
- [ ] Insufficient-capacity tests pass.
- [ ] Restoration tests pass.
- [ ] Phase 1–5 regression tests remain healthy.
- [ ] Typecheck/build pass or known pre-existing failures are documented.

---

# 10. Dependencies

Phase 6 depends on:

### Phase 3

- per-instance application model;
- explicit routing/load balancing;
- application scaling;
- routed-demand visibility.

### Phase 5

- reliability technology definitions;
- progression/prerequisite system;
- deployed/unlocked distinction;
- autoscaling and multi-instance architecture state;
- stable save schema.

### Earlier phases

- deterministic step engine;
- shared scheduler;
- measured incident recovery;
- postmortem trace;
- continuous campaign identity.

Do not implement reliability by bypassing the existing routing/capacity model.

Reliability must operate through the same simulation rules.

---

# 11. Scope Guard

Do not expand Phase 6 into:

- database failure;
- database failover;
- network failure;
- security incidents;
- regional outages;
- multi-region architecture;
- queues;
- microservices;
- complex deployment pipelines;
- service meshes;
- sophisticated health-check protocols;
- circuit breakers;
- chaos engineering systems;
- multiplayer incident response;
- new incident families.

Keep the reliability model narrow:

```text
temporary app failure
→ detect
→ reroute
→ assess surviving capacity
```

---

# 12. Main Risks and Mitigations

## Risk 1 — Failure instantly disappears from routing

**Mitigation:**

Separate actual health from detected health.

---

## Risk 2 — Failover is treated as automatic recovery

**Mitigation:**

Run normal capacity/backlog calculations after rerouting.

---

## Risk 3 — Spare instance becomes free magic capacity

**Mitigation:**

Give it cost, explicit state, and routing requirements.

---

## Risk 4 — Reliability creates a new incompatible simulation path

**Mitigation:**

Reuse:

```text
same per-instance model
same router
same scheduler
same overload logic
same recovery logic
```

---

## Risk 5 — Health Checks, Spare, and Failover blur together

**Mitigation:**

Keep responsibilities separate:

```text
Health Checks → detect
Spare Instance → provide capacity
Failover → reroute
```

---

## Risk 6 — Too many reliability states confuse players

**Mitigation:**

Expose only the evidence necessary to understand:

```text
failed
detected
routed
capacity remaining
```

---

## Risk 7 — Reliability lands too late for evaluation

**Mitigation:**

Prioritize the 900/2×600 scenario and the three reliability technologies before visual polish or extra scenario variation.

---

# 13. Recommended Implementation Order

1. Verify Phase 5 Definition of Done.
2. Run Phase 1–5 regression suite.
3. Inspect current instance-health representation.
4. Define actual-health/detected-health/routing-eligibility contract.
5. Implement temporary failure scheduling.
6. Add single-instance failure tests.
7. Implement deterministic detection delay.
8. Add Health Checks effect.
9. Update routing helper to use routing eligibility.
10. Add no-health-check / health-check tests.
11. Implement Spare Application Instance behavior.
12. Add spare-capacity tests.
13. Implement Automatic Failover prerequisites.
14. Implement rerouting after detected failure.
15. Add sufficient-capacity test.
16. Add 900 req/s / 2×600 insufficient-capacity test.
17. Verify overload/backlog logic still controls post-failover state.
18. Implement restoration.
19. Add restoration tests.
20. Map risky deployment to temporary app failure if relevant.
21. Extend trace/postmortem.
22. Update architecture visualization for health/routing/spare state.
23. Update save schema for failure/detection state where needed.
24. Verify reliability technologies persist.
25. Run all Phase 6 acceptance paths.
26. Conduct 900/2×600 human validation.
27. Conduct sufficient-capacity contrast test.
28. Fix high-impact misunderstandings.
29. Run typecheck/tests/build.
30. Stop for review before Phase 7.

---

# 14. Phase 6 Acceptance Scenario

Core scenario:

```text
Company has:
2 app instances
600 req/s each
load balancing
health checks
traffic = 900 req/s

Healthy:
App A = 450 / 600
App B = 450 / 600

App B fails
→ actual health becomes failed
→ health check detects failure
→ App B removed from routing
→ traffic reroutes to App A
→ App A = 900 / 600
→ backlog grows
→ latency/errors rise
→ failover technically succeeded
→ service still unhealthy because surviving capacity is insufficient
→ player adds/restores capacity or limits traffic
→ metrics stabilize
→ incident recovers
→ postmortem explains the full causal chain
```

Contrast scenario:

```text
traffic = 500 req/s
same architecture
one app fails
→ 500 / 600 on survivor
→ service remains within capacity
```

This contrast is the heart of LO3.

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
docs/phases/PHASE_5_PROGRESSION.md
docs/phases/PHASE_6_RELIABILITY.md
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
- docs/phases/PHASE_5_PROGRESSION.md
- docs/phases/PHASE_6_RELIABILITY.md

Treat PHASE_6_RELIABILITY.md as the detailed reliability, simulation, progression, persistence, and acceptance specification for this phase.

Inspect the current repository first.

Before modifying code, report:

1. whether Phases 1–5 are fully implemented and stable;
2. how instance health is currently represented;
3. how routing eligibility is currently decided;
4. where reliability technologies currently exist in progression;
5. exact files/functions that must change;
6. any current logic that conflates failure, detection, routing, and recovery;
7. the smallest safe implementation order.

Preserve these invariants:
- actual health, detected health, and routing eligibility are distinct concepts;
- Health Checks detect; they do not add capacity;
- Spare Application Instance provides capacity; it does not reroute by itself;
- Automatic Failover reroutes; it does not create capacity;
- surviving capacity determines post-failover overload;
- app failure remains one of only two MVP incident families;
- risky deployments reuse the same temporary-app-failure model;
- database failure/failover remains out of scope;
- the same company/run continues.

Implement Phase 6 only.

Do not proceed into:
- Phase 7 combined-campaign balancing;
- extra incident families;
- multi-region;
- database failover;
- network/security incidents;
- later phases.

After implementation:
- run Phase 1–5 regression tests;
- run failure/detection/routing tests;
- run sufficient/insufficient surviving-capacity tests;
- run reliability prerequisite tests;
- run save/resume tests;
- run browser smoke tests;
- run typecheck;
- run production build;
- list files changed;
- explain deviations from this specification;
- report remaining Phase 6 blockers;
- confirm whether every Phase 6 Definition of Done item is satisfied;
- stop for review.
```

---

# 16. Phase 6 Summary

At the end of Phase 6, the reliability branch should be fully functional:

```text
Instance fails
→ system may detect failure
→ routing may exclude failed instance
→ traffic reroutes
→ surviving capacity is evaluated
→ service may survive or remain overloaded
→ player responds
→ causal postmortem explains the outcome
→ same company continues
```

The player should understand the core reliability lesson:

> **Health checks detect, failover reroutes, spare capacity absorbs load — and none of them can ignore the actual capacity that remains.**

With all nine MVP technologies now functional, Phase 7 can combine the mechanics into a full campaign and focus on balance, replayability, and multiple viable strategies.
