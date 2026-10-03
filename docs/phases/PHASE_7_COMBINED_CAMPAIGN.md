# Phase 7 — Combined Campaign and Balance

> **Project:** 99.99% — System Design Tycoon  
> **Target:** 27–30 October 2026  
> **Primary learning outcomes:** LO1 Diagnose bottlenecks; LO2 Choose scaling strategies; LO3 Improve reliability; LO4 Weigh design trade-offs  
> **Status:** Detailed implementation plan for Phase 7 only

---

# 1. Goal

Combine the mechanics built in Phases 1–6 into a **complete, coherent campaign** with multiple viable strategies, meaningful trade-offs, and a clear final growth target.

By the end of Phase 7, the project should feel like one game rather than a sequence of isolated mechanics.

The campaign should now integrate:

- workload growth;
- application scaling;
- load balancing;
- database upgrades;
- caching;
- autoscaling;
- temporary application failures;
- health checks;
- spare capacity;
- automatic failover;
- cost and engineering constraints;
- traffic limiting;
- promotions;
- maintenance;
- deployment/testing risk;
- milestone progression;
- replay variation;
- final campaign success/failure conditions;
- an end-of-run scorecard.

The central design objective is:

> **Different situations should reward different strategies, and no single upgrade sequence should dominate the whole campaign.**

The opening must remain focused and understandable, while later play introduces increasingly combined trade-offs.

---

# 2. Player Experience

The player should now experience the full campaign arc:

```text
Start company
→ survive first incident
→ reach milestone
→ unlock scaling options
→ adapt application tier
→ encounter workload variation
→ choose data strategy
→ unlock automation
→ prepare for failure
→ survive reliability incidents
→ manage cost and growth
→ reach final growth target
→ finish solvent with no active incident
→ view run scorecard
```

The same company and architecture evolve throughout.

The campaign should feel like:

> "I built this system, and my earlier choices are now affecting what happens next."

---

## 2.1 Full campaign continuity

All mechanics should operate inside one persistent run.

Preserve:

- run/company ID;
- seed;
- architecture;
- technology unlocks;
- deployed upgrades;
- cash;
- recurring costs;
- traffic history;
- event history;
- postmortems;
- tech debt / maintenance state where implemented;
- engineering constraints;
- progression state.

Do not reset the architecture between major mechanics.

---

## 2.2 Campaign pacing

The campaign should have a clear rise in complexity.

Suggested progression:

### Stage 1 — Startup

```text
1 app
1 DB
healthy baseline
```

### Stage 2 — First bottleneck

```text
DB overload
→ diagnose
→ recover
```

### Stage 3 — Application growth

```text
app overload
→ Scale Up / Scale Out
→ load balancing
```

### Stage 4 — Data pressure

```text
read-heavy / write-heavy workload
→ DB upgrade / cache
```

### Stage 5 — Automation

```text
autoscaling
→ threshold + delay
```

### Stage 6 — Reliability

```text
temporary app failure
→ health checks
→ spare capacity
→ failover
```

### Stage 7 — Combined late-game pressure

```text
growth + cost + workload + failure + timing
```

### Stage 8 — Final growth target

```text
reach target
while solvent
and with no active incident
```

The exact milestone count can be tuned, but the player should clearly feel increasing responsibility and complexity.

---

## 2.3 Final growth target

The master roadmap specifies:

```text
50,000 users
```

as the initial configurable final target.

Treat this as a balance parameter, not a permanent hard-coded product truth.

The campaign succeeds when:

```text
users >= configured final target
AND
cash > 0
AND
no active incident
```

If later playtesting shows 50,000 is too short or too long, tune the value without changing the campaign structure.

---

## 2.4 Combined workload situations

Phase 7 should combine existing mechanics rather than introduce new incident families.

Examples:

### Situation A — Read-heavy growth

```text
traffic rises
→ DB pressure
→ cache may be effective
```

### Situation B — Write-heavy growth

```text
same traffic scale
→ cache less useful
→ DB upgrade may be stronger
```

### Situation C — App growth + delayed autoscaling

```text
traffic spike
→ threshold exceeded
→ autoscaling schedules capacity
→ startup delay
→ temporary overload may still occur
```

### Situation D — Failure during high load

```text
one app fails
→ failover succeeds
→ surviving capacity may still overload
```

### Situation E — Promotion at the wrong time

```text
promotion increases traffic
→ architecture not ready
→ player-created incident
```

The campaign should feel causally connected to the player's own decisions.

---

## 2.5 Multiple viable strategies

The campaign should allow more than one successful architecture path.

Examples:

### Strategy A — Vertical-heavy

```text
larger app instances
larger DB
limited horizontal scaling
```

### Strategy B — Horizontal-heavy

```text
more app instances
load balancing
autoscaling
```

### Strategy C — Cache-heavy data strategy

```text
moderate DB
read cache
cache tuning
```

### Strategy D — Reliability-heavy

```text
extra spare capacity
health checks
failover
```

These strategies should not be equally strong in every scenario, but more than one should be capable of finishing the campaign under suitable decisions.

---

## 2.6 Promotions

Promotions are a lightweight management control.

A promotion should:

```text
increase demand
```

and may increase revenue opportunity.

The player should be able to choose when to trigger one.

The purpose is to create:

```text
growth opportunity
vs
capacity risk
```

Do not build a full marketing simulator.

---

## 2.7 Maintenance

Maintenance should be a lightweight risk-control decision.

Possible effect:

```text
spend cash / engineering time
→ reduce modeled temporary-failure risk
```

The exact risk model should remain simple.

Maintenance should not guarantee zero failures.

Do not turn maintenance into a large subsystem.

---

## 2.8 Engineering allocation

Engineering allocation should remain lightweight.

Possible model:

```text
limited concurrent engineering actions
```

or:

```text
engineering capacity points
```

The player may need to choose between:

- scaling;
- maintenance;
- upgrade deployment;
- reliability preparation.

This supports trade-offs without creating a staff-management game.

---

## 2.9 Deployment timing and testing

Deployment/testing controls should affect:

```text
temporary app-unavailability risk
```

A safer deployment choice may:

- cost more engineering time;
- take longer;
- reduce modeled failure probability.

A faster/riskier choice may:

- activate sooner;
- carry greater seeded failure risk.

Do not create a full CI/CD simulator.

---

## 2.10 Concurrent disruptions

Keep combined disruptions understandable.

The master roadmap requires limiting concurrent disruptions to situations players can reasonably understand.

Examples of acceptable combinations:

```text
traffic spike + slow autoscaling
```

or:

```text
app failure + high traffic
```

Avoid:

```text
DB overload
+ app failure
+ promotion
+ cache warm-up
+ deployment fault
+ bankruptcy
```

all at once.

One or two interacting pressures are enough.

---

## 2.11 Run completion

A completed run should clearly communicate:

```text
Campaign Complete
```

with the company state that reached the final target.

Do not immediately erase the architecture.

Allow the player to inspect:

- final system;
- scorecard;
- postmortems;
- major technology choices.

Then offer:

```text
Start New Run
```

as a separate action.

---

## 2.12 Replay

A new run should vary bounded parameters such as:

- traffic growth;
- spike size;
- spike duration;
- read/write mix;
- cacheable share;
- failure timing;
- starting budget where configured;
- event sequence.

Replay should preserve:

```text
same game rules
different operating conditions
```

The goal is to create:

> "Same system-design concepts, different decisions."

---

# 3. Learning Outcomes

## LO1 — Diagnose bottlenecks

The player should identify whether the main constraint is:

- app capacity;
- routing;
- DB capacity;
- insufficient cache benefit;
- surviving capacity after failure;
- activation delay;
- cost/engineering constraint.

The campaign should require diagnosis rather than fixed upgrade order.

---

## LO2 — Choose scaling strategies

Players should compare:

- Scale Up;
- Scale Out + LB;
- Autoscaling;
- Larger DB;
- Read Cache;
- Cache Tuning.

The correct choice should depend on:

- workload;
- architecture;
- timing;
- cost;
- delay;
- current bottleneck.

---

## LO3 — Improve reliability

Players should apply:

- Health Checks;
- Spare App Instance;
- Automatic Failover.

They should understand:

```text
detection
≠
rerouting
≠
capacity
```

and that surviving capacity still matters.

---

## LO4 — Weigh trade-offs

Phase 7 is where LO4 becomes fully visible.

Players should weigh:

```text
performance
reliability
cost
complexity
engineering time
activation delay
growth opportunity
```

A design should be judged by context, not by a universal best architecture.

---

# 4. Engineering

## 4.1 Integrate all existing mechanics

Phase 7 should combine existing systems rather than invent new core mechanic families.

Integrate:

```text
traffic growth
spikes
per-instance app processing
routing
vertical scaling
horizontal scaling
autoscaling
DB upgrades
cache
cache warm-up
cache tuning
temporary app failure
health checks
spare capacity
failover
milestones
research
costs
scheduled actions
postmortems
analytics
```

All should operate through the same simulation engine and campaign state.

---

## 4.2 Campaign pacing model

Replace old weekly/deadline assumptions with the new continuous campaign pacing.

Campaign progression should be driven by:

- simulated growth;
- milestones;
- architecture state;
- events;
- player decisions.

Do not require artificial calendar weeks inside gameplay unless they already map cleanly to the chosen turn model.

---

## 4.3 Final-target state

Add configurable campaign target state:

```text
finalUserTarget
```

Initial value:

```text
50_000
```

Success condition:

```text
currentUsers >= finalUserTarget
AND
cash > 0
AND
activeIncident == none
```

Keep this logic testable and centralized.

---

## 4.4 Economy retuning

Retune:

- starting cash;
- recurring infrastructure costs;
- technology deployment cost;
- promotion effects;
- maintenance cost;
- rejected-demand impact;
- failure impact;
- upgrade lead times.

The goal is not economic realism.

The goal is:

```text
enough pressure to force trade-offs
without making one path obviously dominant
```

---

## 4.5 Milestone spacing

Retune milestones so that:

- first run remains focused;
- later mechanics do not arrive too quickly;
- players have time to understand one new concept before the next;
- campaign does not become excessively long.

Avoid:

```text
unlock spam
```

where multiple technologies appear simultaneously without context.

---

## 4.6 Promotion model

Suggested lightweight fields:

```text
promotionCost
trafficMultiplier
duration
revenueOpportunityMultiplier
```

Keep the mechanic deterministic and bounded.

Promotion should feed external workload into the same simulation model.

---

## 4.7 Maintenance model

Suggested lightweight fields:

```text
maintenanceActive
maintenanceCost
riskReduction
engineeringUsage
```

Maintenance should modify modeled failure risk, not directly mark future failures as impossible.

---

## 4.8 Engineering allocation

Use a simple constraint such as:

```text
availableEngineeringSlots
```

or an existing equivalent.

Scheduled actions consume engineering capacity until activation.

The player should sometimes need to choose:

```text
scale now
vs
maintain now
vs
deploy reliability now
```

Do not simulate individual engineers.

---

## 4.9 Deployment/testing control

Suggested simple configuration:

```text
deploymentMode:
safe
normal
risky
```

Possible effects:

```text
safe:
longer activation
lower failure risk

normal:
baseline

risky:
shorter activation
higher failure risk
```

Use bounded seeded outcomes.

---

## 4.10 Scenario pool

Create a small MVP scenario pool using the existing mechanics.

Possible scenario templates:

1. steady growth;
2. read-heavy spike;
3. write-heavy spike;
4. app-capacity pressure;
5. temporary app failure;
6. failure during high load;
7. promotion-driven overload.

Do not add new incident families.

Scenarios are configurations of existing workload/failure mechanics.

---

## 4.11 Scenario sequencing

The campaign may choose scenario/event sequences from a bounded seeded pool.

Requirements:

- reproducible from seed;
- reasonable warning;
- recoverable under valid strategies;
- no impossible combinations;
- later events may depend on architecture state.

The same event should still produce different outcomes under different architectures.

---

## 4.12 Limit concurrent complexity

Add guardrails so the scheduler does not create unreadable combinations.

Possible rule:

```text
maximum one primary incident-causing event active at a time
```

with limited secondary pressure allowed.

Exact implementation may vary.

The important goal is interpretability.

---

## 4.13 Run scorecard

Add an end-of-run scorecard.

Required fields from the master roadmap:

```text
users reached
uptime
revenue
infrastructure spending
largest outage
rejected demand
final architecture
```

Also include where already available:

```text
cash remaining
technologies deployed
incident count
final recurring cost
tech debt / maintenance state
```

Do not create a single opaque "overall score" unless clearly justified.

The scorecard should help players compare their own runs.

---

## 4.14 Largest outage

Define "largest outage" consistently.

Possible metric:

```text
incident with greatest cumulative failed/rejected demand
```

or:

```text
longest degraded duration
```

Choose one definition and document it.

Do not mix definitions across runs.

---

## 4.15 Uptime

Use a game-specific operational definition.

Example:

```text
uptime =
steps meeting service-health threshold
/
total eligible service steps
```

Document the simplification.

Do not claim this is equivalent to production SRE uptime measurement.

---

## 4.16 Revenue and rejected demand

Revenue should reflect:

- admitted/successful demand;
- promotion opportunity where relevant;
- lost demand from traffic limiting/rejection;
- outages.

Keep the model simple and internally consistent.

---

## 4.17 Final architecture snapshot

The scorecard should capture:

- app instance count/capacities;
- load balancer;
- autoscaling;
- DB capacity;
- cache;
- reliability technologies.

This supports replay comparison.

---

## 4.18 Campaign bot strategies

The master roadmap references updated campaign bot strategies.

If automated play/balance bots already exist, update them to represent multiple plausible strategies, such as:

```text
vertical-heavy
horizontal-heavy
cache-heavy
reliability-heavy
```

Use them for balance regression, not to define the "correct" strategy.

---

# 5. Existing Modules

Likely relevant areas:

```text
balance configuration
campaign progression
scenario configuration
action scheduler
economy
reports
management controls
postmortems
analytics
save state
campaign bot / automated simulation
```

Possible file equivalents:

```text
src/game/balance.ts
src/game/progression.ts
src/game/campaign.ts
src/sim/scenarios/*
src/sim/actions.ts
src/sim/step.ts
src/game/reports.ts
src/sim/postmortem.ts
src/game/bots/*
```

The IDE should inspect actual repository structure before implementation.

---

# 6. New Modules

The master roadmap calls for:

```text
scenario-pool definitions
updated campaign bot strategies
```

Possible additions:

```text
src/sim/scenarios/campaignPool.ts
src/game/bots/strategyProfiles.ts
```

Potential support modules:

```text
src/game/scorecard.ts
src/game/campaignOutcome.ts
```

Only create new modules where they clarify existing responsibilities.

---

# 7. Automated Testing

## 7.1 Campaign completion

Test:

```text
users >= final target
cash > 0
no active incident
```

→ campaign success.

Test each failed condition separately.

---

## 7.2 Bankruptcy

Test:

```text
cash <= 0
```

or the project's defined insolvency condition.

Expected:

- run ends;
- completion is not awarded;
- scorecard/report still records final state.

---

## 7.3 Final target during incident

Test:

```text
users reach target
but active incident remains
```

Expected:

- campaign does not complete until incident resolves.

---

## 7.4 Multiple strategy viability

Use automated strategy profiles where possible.

At least two distinct strategies should be able to complete representative scenario pools.

Do not require identical scores.

The test goal is:

```text
more than one viable route exists
```

---

## 7.5 No dominant universal sequence

Balance regression should flag if one exact technology sequence succeeds across nearly all bounded scenarios while alternatives consistently fail.

This can be a heuristic/manual review rather than a strict unit-test threshold.

---

## 7.6 Promotion

Test:

- promotion increases configured demand;
- cost applies once;
- demand returns/changes according to configured duration;
- promotion can cause overload through normal simulation;
- no special scripted incident is created.

---

## 7.7 Maintenance

Test:

- maintenance costs resources;
- maintenance modifies failure risk as intended;
- maintenance does not guarantee no failure;
- seeded reproducibility remains intact.

---

## 7.8 Engineering capacity

Test:

- limited engineering capacity prevents impossible simultaneous deployments;
- capacity is released after completion;
- save/resume preserves pending allocations.

---

## 7.9 Deployment modes

Test:

- safe/normal/risky configurations change intended delay/risk variables;
- failure outcomes remain seeded/reproducible;
- risky mode maps to temporary app failure, not a new incident type.

---

## 7.10 Scenario-pool bounds

Test every configured scenario template for:

- valid parameter ranges;
- recoverability;
- no impossible prerequisites;
- no out-of-scope components;
- reproducibility.

---

## 7.11 Concurrent-event guardrails

Test that the scheduler avoids unsupported combinations.

For example:

- no two unrelated major incident-causing failures open simultaneously if the design forbids it;
- allowed secondary pressure still works.

---

## 7.12 Full-run determinism

Test:

```text
same seed
+ same starting config
+ same player action sequence
=
same final campaign state
```

including:

- events;
- failures;
- scorecard;
- final architecture.

---

## 7.13 Scorecard

Verify exact derivation of:

- peak users;
- uptime;
- revenue;
- infrastructure spend;
- largest outage;
- rejected demand;
- final architecture.

Do not calculate scorecard values separately from authoritative run history.

---

## 7.14 Replay

Test:

- new run gets new run ID;
- seed/config can differ;
- prior run summary remains available where stored;
- account identity remains;
- analytics distinguish replay from continuation.

---

## 7.15 Phase 7 acceptance paths

### Path A — Vertical-heavy completion

```text
Scale Up
+ Larger DB
+ basic reliability
→ final target
```

### Path B — Horizontal/cache-heavy completion

```text
Scale Out + LB
+ Autoscaling
+ Read Cache
+ Cache Tuning
→ final target
```

### Path C — Reliability-heavy response

```text
extra spare capacity
+ Health Checks
+ Failover
→ survives failure-heavy late game
```

### Path D — Poor timing failure

```text
promotion
→ demand spike
→ insufficient capacity
→ incident
→ player recovers
→ campaign continues
```

### Path E — Final target blocked by active incident

```text
target reached
→ incident active
→ no completion
→ recover
→ completion
```

---

# 8. Human Validation

The central Phase 7 questions are:

> **Do players willingly continue after the first milestone?**

and:

> **Do later decisions feel meaningfully different rather than repetitive?**

---

## 8.1 Suggested participants

Use:

- returning testers who know the opening;
- fresh users for full-campaign observations where time allows.

This phase is about the whole campaign experience, not only the first incident.

---

## 8.2 Observe

Record:

- whether player continues after the first milestone without prompting;
- whether later mechanics feel like natural progression;
- whether the player identifies different bottlenecks correctly;
- whether the same upgrade is chosen repeatedly regardless of context;
- whether cost constraints matter;
- whether activation delay matters;
- whether reliability investment feels worthwhile;
- whether promotions feel like meaningful risk/reward;
- whether late-game complexity becomes overwhelming;
- whether full campaign duration feels reasonable.

---

## 8.3 Ask after play

Possible questions:

1. Did the campaign feel like one continuous company?
2. Which decision felt most meaningful?
3. Did any technology feel obviously mandatory?
4. Did any technology feel useless?
5. Did the later game feel different from the opening?
6. Were there moments when more than one choice seemed reasonable?
7. Did you understand why you won or lost?
8. Would you try another run with a different strategy?

---

## 8.4 Strategy diversity observation

For each tester, record the rough strategy path.

Examples:

```text
vertical-heavy
horizontal-heavy
cache-heavy
reliability-heavy
mixed
```

Do not force players into these labels during play.

Use them afterward to determine whether the game is producing actual strategy variation.

---

## 8.5 Replay signal

Observe whether players voluntarily choose:

```text
Start New Run
```

after seeing the scorecard.

This is stronger evidence than simply asking whether they would replay.

---

## 8.6 Human validation success signal

Good signs include:

- different players choose different upgrade paths;
- players explain why their strategy fit the workload;
- at least some players voluntarily continue beyond the opening;
- at least some players voluntarily start another run;
- no single sequence is described as "obviously always correct";
- late-game decisions remain understandable.

---

# 9. Definition of Done

Phase 7 is complete only when all of the following are true.

## Full campaign

- [ ] All required mechanics operate in one continuous run.
- [ ] Opening remains focused.
- [ ] Later mechanics appear progressively.
- [ ] Final growth target exists.
- [ ] Success requires final target + solvency + no active incident.
- [ ] Failure/bankruptcy flow works.
- [ ] Same company identity is preserved throughout a run.

## Combined mechanics

- [ ] Traffic growth works with scaling.
- [ ] Cache/data strategy works with later scenarios.
- [ ] Autoscaling works under campaign conditions.
- [ ] Reliability works under campaign conditions.
- [ ] Promotions affect demand through normal simulation.
- [ ] Maintenance affects modeled risk.
- [ ] Engineering constraints affect deployment timing.
- [ ] Deployment/testing affects temporary failure risk where implemented.

## Balance

- [ ] Milestone spacing is reasonable.
- [ ] Economy creates trade-offs without constant bankruptcy.
- [ ] Activation delays matter.
- [ ] At least two distinct strategy paths can complete representative runs.
- [ ] No single upgrade sequence clearly dominates the tested scenario pool.
- [ ] Concurrent disruption remains understandable.

## Scenario pool

- [ ] Bounded scenario pool exists.
- [ ] Scenarios use only existing incident families.
- [ ] Same event can produce different outcomes under different architectures.
- [ ] Seeds are reproducible.
- [ ] Invalid/impossible combinations are blocked.

## Scorecard

- [ ] Users reached shown.
- [ ] Uptime shown.
- [ ] Revenue shown.
- [ ] Infrastructure spending shown.
- [ ] Largest outage shown.
- [ ] Rejected demand shown.
- [ ] Final architecture shown.
- [ ] Scorecard uses authoritative run history.

## Replay

- [ ] Player can start a new run.
- [ ] New run gets new run ID.
- [ ] New run can use different bounded seed/config.
- [ ] Previous run data is preserved where intended.
- [ ] Analytics distinguish continuation from replay.

## Validation

- [ ] Full-campaign playtests conducted.
- [ ] Continuation after first milestone observed.
- [ ] Strategy diversity recorded.
- [ ] Repetitive/dominant upgrade patterns reviewed.
- [ ] Campaign-length feedback recorded.
- [ ] Replay interest/behavior recorded.

## Engineering quality

- [ ] Campaign completion tests pass.
- [ ] Economy tests pass.
- [ ] Scenario-pool tests pass.
- [ ] Full-run determinism tests pass.
- [ ] Scorecard tests pass.
- [ ] Replay/reset tests pass.
- [ ] Phase 1–6 regression tests remain healthy.
- [ ] Typecheck/build pass or known pre-existing failures are documented.

---

# 10. Dependencies

Phase 7 depends on Phases 3–6 being complete and stable.

Required from Phase 3:

- per-instance app model;
- routing/load balancing;
- scaling.

Required from Phase 4:

- workload variation;
- cache mechanics;
- scenario seeding.

Required from Phase 5:

- milestone/research progression;
- 9-unlock structure;
- autoscaling;
- replay reset;
- cloud persistence.

Required from Phase 6:

- temporary app failure;
- health checks;
- spare capacity;
- failover.

Required from all earlier phases:

- deterministic step engine;
- shared scheduler;
- postmortem trace;
- analytics;
- same-company continuity.

Do not attempt campaign balancing while core mechanics are still unstable.

---

# 11. Scope Guard

Do not expand Phase 7 into:

- additional incident families;
- database failover;
- queues;
- multi-region systems;
- CDNs;
- microservices;
- security incidents;
- network incidents;
- full staff simulator;
- large marketing simulator;
- scenario editor;
- achievements;
- leaderboards;
- multiplayer;
- AI-generated content;
- major new technology branches.

If scope pressure appears:

> **reduce scenario count before adding new complexity.**

The purpose of Phase 7 is integration and balance.

---

# 12. Main Risks and Mitigations

## Risk 1 — Full campaign becomes too long

**Mitigation:**

Tune:

- milestone spacing;
- traffic growth;
- event frequency;
- target users.

Do not add more mechanics.

---

## Risk 2 — Full campaign becomes too short

**Mitigation:**

Increase pacing pressure through existing mechanics rather than adding filler.

---

## Risk 3 — One strategy dominates

**Mitigation:**

Vary:

- workload mix;
- timing;
- costs;
- event type;
- failure pressure.

Test multiple strategy profiles.

---

## Risk 4 — Combined mechanics become unreadable

**Mitigation:**

Limit concurrent major disruptions.

Preserve clear architecture and metrics.

---

## Risk 5 — Management controls become a separate game

**Mitigation:**

Keep promotions, maintenance, engineering allocation, and deployment/testing lightweight.

They should modify system-design decisions, not replace them.

---

## Risk 6 — Economy overwhelms learning

**Mitigation:**

Use cost to create trade-offs, not constant punishment.

---

## Risk 7 — Scorecard encourages one-dimensional optimization

**Mitigation:**

Show multiple metrics rather than one opaque score.

---

## Risk 8 — Late-game unlocks overwhelm new players

**Mitigation:**

Preserve progressive reveal and milestone pacing.

---

# 13. Recommended Implementation Order

1. Verify Phase 6 Definition of Done.
2. Run Phase 1–6 regression suite.
3. Inspect campaign pacing and old weekly assumptions.
4. Define final-target state and completion condition.
5. Define late-campaign milestone spacing.
6. Integrate existing mechanics into one campaign path.
7. Add promotion control.
8. Add lightweight maintenance control.
9. Add engineering-capacity constraint.
10. Add deployment/testing mode where intended.
11. Define bounded scenario pool.
12. Add scenario sequencing/guardrails.
13. Add concurrent-disruption limits.
14. Retune starting cash and recurring costs.
15. Retune technology deployment costs.
16. Retune action delays.
17. Retune traffic growth.
18. Retune event severity.
19. Add campaign completion/failure state.
20. Build run scorecard.
21. Add scorecard tests.
22. Update automated campaign bot strategies if present.
23. Run vertical-heavy strategy simulation.
24. Run horizontal/cache-heavy strategy simulation.
25. Run reliability-heavy strategy simulation.
26. Check for universal dominant sequence.
27. Add replay/new-run scorecard flow.
28. Verify full-run determinism.
29. Conduct full-campaign user tests.
30. Record continuation, strategy diversity, campaign duration, replay behavior.
31. Fix only balance/clarity issues.
32. Run typecheck/tests/build.
33. Stop for review before Phase 8.

---

# 14. Phase 7 Acceptance Scenario

A representative full campaign:

```text
Start:
1 app + 1 DB

→ traffic grows
→ DB overload
→ player recovers
→ first milestone

→ app becomes bottleneck
→ player chooses Scale Out + LB

→ read-heavy spike
→ player deploys cache
→ cache warms
→ DB pressure falls

→ growth continues
→ autoscaling unlocked
→ threshold triggers
→ new app starts after delay

→ temporary app failure
→ health checks detect
→ failover reroutes
→ surviving capacity becomes tight
→ player adds spare capacity

→ player triggers promotion
→ traffic grows faster
→ costs increase
→ player manages engineering actions

→ final users reach 50,000
→ no active incident
→ cash remains positive
→ campaign completes

→ scorecard:
users
uptime
revenue
spend
largest outage
rejected demand
final architecture

→ player may start new run
```

Another valid campaign should be able to finish with a meaningfully different architecture.

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
docs/phases/PHASE_7_COMBINED_CAMPAIGN.md
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
- docs/phases/PHASE_7_COMBINED_CAMPAIGN.md

Treat PHASE_7_COMBINED_CAMPAIGN.md as the detailed integration, balance, campaign-completion, replay, and acceptance specification for this phase.

Inspect the current repository first.

Before modifying code, report:

1. whether Phases 1–6 are fully implemented and stable;
2. how campaign pacing currently works;
3. where old weekly/deadline assumptions still exist;
4. current economy/balance configuration;
5. current scenario/event sequencing;
6. current run completion/failure logic;
7. current scorecard/report infrastructure;
8. exact files/functions that must change;
9. the smallest safe implementation order.

Preserve these invariants:
- one continuous company/run;
- no new incident families;
- scenario variation comes from existing workload/failure mechanics;
- multiple strategies should remain viable;
- final success requires growth target + solvency + no active incident;
- concurrent disruptions remain understandable;
- management controls stay lightweight;
- scorecard reports multiple dimensions rather than one opaque score;
- replay starts a genuinely new run.

Implement Phase 7 only.

Do not proceed into:
- Phase 8 formal evaluation freeze;
- extra incident families;
- new architecture component families;
- scenario editor;
- multiplayer;
- later phases.

After implementation:
- run Phase 1–6 regression tests;
- run full-campaign completion tests;
- run scenario-pool tests;
- run balance strategy simulations;
- run full-run determinism tests;
- run scorecard/replay tests;
- run browser smoke tests;
- run typecheck;
- run production build;
- list files changed;
- explain deviations from this specification;
- report remaining Phase 7 blockers;
- confirm whether every Phase 7 Definition of Done item is satisfied;
- stop for review.
```

---

# 16. Phase 7 Summary

At the end of Phase 7, the project should function as a complete System Design Tycoon campaign:

```text
one company
→ evolving architecture
→ changing workload
→ scaling decisions
→ data decisions
→ automation
→ reliability
→ cost/timing trade-offs
→ final growth target
→ scorecard
→ replay
```

The campaign should support multiple viable strategies and make earlier decisions meaningfully affect later outcomes.

Phase 8 should then **freeze mechanics** and focus on evaluation, usability, analytics quality, accessibility, security, and polish rather than adding new gameplay.
