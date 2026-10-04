# Phase 5 — Progression and PR2 Integration

> **Project:** 99.99% — System Design Tycoon  
> **Target:** 20–25 October 2026  
> **Course milestone:** PR2 — 26 October 2026, 7:59 am SGT  
> **Primary learning outcomes:** LO1 Diagnose bottlenecks; LO2 Choose scaling strategies; LO4 Weigh design trade-offs  
> **Reliability preparation:** Phase 5 exposes the progression structure that Phase 6 completes for LO3  
> **Status:** Detailed implementation plan for Phase 5 only

---

# 1. Goal

Turn the mechanics built in Phases 1–4 into a **coherent continuous campaign progression system**.

By the end of Phase 5, the player should no longer feel like they are encountering isolated mechanics one at a time. They should feel that they are growing one software company, earning new options as the company reaches milestones, and making alternative technology investments based on the architecture they have already built.

The phase should establish:

- growth milestones;
- research-point awards;
- the specified **9-unlock technology structure**;
- prerequisites;
- gradual reveal of controls;
- deployment cost and activation delay;
- Scale Up vs Scale Out as alternative investments;
- delayed autoscaling with a visible threshold;
- replay reset;
- campaign summaries;
- persistence of progression;
- removal of the player-facing legacy campaign;
- cloud-save/account usability suitable for PR2.

The key design principle is:

> **Progression should reveal choices, not prescribe an upgrade order.**

The same company, finances, architecture, history, and run identity continue through the campaign.

---

# 2. Player Experience

The player has already encountered:

```text
database overload
→ application scaling
→ routing/load balancing
→ read/write workload differences
→ caching vs database upgrade
```

Phase 5 connects those mechanics into one progression loop:

```text
Company grows
→ milestone reached
→ research awarded
→ new technology choices revealed
→ player chooses an investment
→ deployment costs cash + engineering time
→ architecture changes
→ future traffic/event outcomes change
→ next milestone reached
→ more options revealed
```

The player should feel that earlier decisions create the starting conditions for later problems.

---

## 2.1 Milestone progression

The company should grow through a fixed sequence of milestones.

Milestones may be tied to configurable growth markers such as:

```text
users reached
revenue reached
incident recovered
company stage reached
```

For MVP simplicity, use a small number of clearly defined milestones.

A milestone should be awarded only when its condition is first satisfied.

It should never be re-awarded after:

- save/resume;
- reopening the same postmortem;
- repeated evaluation of the same condition.

---

## 2.2 Research points

Milestones award **research points**.

Research points are used to unlock technology options.

The player then spends:

```text
research points
→ to unlock technology

cash + engineering time
→ to deploy technology
```

This distinction is important.

Unlocking a technology should not instantly deploy it into the architecture.

---

## 2.3 Gradual reveal

Do not show all nine technologies at the start.

The player should first see only the options relevant to the current stage of growth.

Suggested reveal logic:

```text
Opening:
metrics/history/alerts only

After first milestone:
basic capacity choices

Later:
data choices

Later:
advanced capacity / reliability preparation
```

The exact reveal thresholds may be tuned, but the player should not be overwhelmed with the full tree immediately.

---

## 2.4 Alternative investments

The technology tree contains deliberate alternatives.

The player should be able to choose:

```text
Scale Up
OR
Scale Out + Load Balancing
```

and:

```text
Larger Database
OR
Read Cache
```

"OR" means:

> alternative investment paths that are both valid,

not:

> permanently mutually exclusive choices.

The player may eventually combine technologies if the campaign state and resources allow.

---

## 2.5 Autoscaling

Autoscaling is introduced as a later capacity unlock.

It should require:

```text
horizontal scaling
+ load balancing
+ configured scaling threshold
```

Autoscaling should:

- react only after a configured condition;
- have an activation/startup delay;
- add application capacity, not DB capacity;
- be visible when pending;
- not prevent all incidents automatically.

Teaching point:

> Autoscaling reacts to demand, but it cannot solve a database bottleneck and cannot create capacity instantly.

---

## 2.6 Reliability branch preparation

Phase 5 should show the existence of the reliability branch in the progression structure, but unimplemented reliability mechanics should not be interactable until Phase 6.

Possible behavior:

```text
Reliability branch visible as "coming next" or locked
```

or:

```text
reliability nodes hidden until Phase 6
```

Do not expose buttons that appear functional but have no simulation effect.

---

## 2.7 Replay / new-run flow

The player should be able to start a **new company/run** without confusing this with continuing the current company.

Replay should:

- create a new run ID;
- select a new bounded scenario seed/configuration where appropriate;
- reset company architecture and campaign progression;
- preserve account identity;
- preserve historical analytics;
- preserve completed prior run summaries if stored.

This is different from:

```text
continue same company
```

Replay analytics must preserve that distinction.

---

## 2.8 Campaign summary

At meaningful transition points, the game may show a compact campaign summary.

Suggested summary fields:

```text
current company stage
users reached
cash
current architecture
technologies unlocked
technologies deployed
incidents recovered
major trade-offs / recent postmortem
```

The full end-of-run scorecard belongs in Phase 7.

Phase 5 only needs enough summary information to make progression understandable.

---

# 3. Learning Outcomes

## LO1 — Diagnose bottlenecks

Progression should not remove the need to inspect evidence.

Unlocked technologies create more options, but players still need to diagnose the actual constraint before choosing an investment.

The player should understand:

```text
available technology
≠
appropriate technology
```

---

## LO2 — Choose scaling strategies

The progression tree directly supports LO2.

The player should compare:

### Capacity branch

```text
Scale Up
OR
Scale Out + Load Balancing
→ Autoscaling
```

### Data branch

```text
Larger Database
OR
Read Cache
→ Cache Tuning
```

The player should choose based on:

- current bottleneck;
- workload;
- cost;
- activation delay;
- existing architecture.

---

## LO4 — Weigh trade-offs

Technology unlocks should create real trade-offs between:

```text
performance
cost
activation delay
future flexibility
complexity
```

A technology should not exist only as a cosmetic badge.

Every exposed technology must have a real simulation effect.

---

## Reliability preparation for LO3

The reliability branch structure should prepare for Phase 6:

```text
Health Checks
+
Spare Application Instance
→ Automatic Failover
```

Do not assess or fully teach LO3 until Phase 6 mechanics are implemented.

---

# 4. Engineering

## 4.1 Replace legacy 17-node progression

The master roadmap requires replacing the old progression system with the proposal's **9-unlock structure**.

The new tree is:

### Capacity branch

1. Scale Up
2. Scale Out + Load Balancing
3. Autoscaling

### Data branch

4. Larger Database
5. Read Cache
6. Cache Tuning

### Reliability branch

7. Health Checks
8. Spare Application Instance
9. Automatic Failover

Metrics, metric history, and alerts are baseline tools and are **not** research unlocks.

---

## 4.2 Technology definition model

Each technology should have a structured definition.

Suggested fields:

```text
id
name
branch
description
learningOutcomeTags
researchCost
cashCost
engineeringCost
activationDelay
prerequisites
visibilityCondition
deployable
effectType
```

Separate:

```text
unlocked
```

from:

```text
deployed
```

A technology may be unlocked but not yet deployed.

---

## 4.3 Progression state

Campaign progression should track at least:

```text
currentMilestone
milestonesAwarded
researchPoints
unlockedTechnologyIds
deployedTechnologyIds
availableTechnologyIds
```

The exact representation should follow existing repository conventions.

---

## 4.4 Milestone awards

A milestone should:

- be deterministic;
- award exactly once;
- optionally award research points;
- optionally reveal new technology nodes;
- be recorded in campaign history.

The milestone engine should not directly apply technology effects.

---

## 4.5 Prerequisites

Required prerequisite logic:

### Autoscaling

Requires:

```text
Scale Out + Load Balancing
```

and a configured scaling threshold.

### Cache Tuning

Requires:

```text
Read Cache
```

### Automatic Failover

Will require in Phase 6:

```text
Health Checks
+
Spare Application Instance
+
Load Balancing
```

Until Phase 6 is implemented, Automatic Failover should not become deployable.

---

## 4.6 Scale Up vs Scale Out

Preserve both as alternative investment paths.

Do not encode:

```text
Scale Up must happen before Scale Out
```

or the reverse.

Both should be independently unlockable when allowed by the milestone/research state.

Their value should depend on context.

---

## 4.7 Larger Database vs Read Cache

Likewise, do not force:

```text
Larger DB
→ then Read Cache
```

or:

```text
Read Cache
→ then Larger DB
```

These should remain alternative investments.

Cache Tuning depends on Read Cache, but the DB upgrade path does not.

---

## 4.8 Autoscaling mechanics

Autoscaling should be added on top of the Phase 3 per-instance routing model.

Suggested configuration:

```text
enabled
utilisationThreshold
requiredConsecutiveSteps
startupDelay
maxInstances
```

Example behavior:

```text
app utilisation > 80%
for 3 consecutive steps
→ schedule one new app instance
→ instance activates after startup delay
```

Exact values are balance parameters.

Autoscaling must:

- use the existing scheduler;
- add app capacity only;
- require load balancing;
- respect max-instance limits;
- not scale instantly;
- not fix DB bottlenecks.

---

## 4.9 Technology deployment

Technology deployment should use the shared action scheduling model where practical.

Deploying a technology may require:

```text
cash
engineering time
activation delay
```

Effects should become active only after deployment completes.

Do not treat research unlock as instant physical deployment.

---

## 4.10 Engineering-time abstraction

Keep engineering capacity lightweight.

For Phase 5, this may simply mean:

```text
one or more available engineering slots
```

or:

```text
engineering points / action capacity
```

Do not create a separate staff-management simulator.

The goal is to support deployment trade-offs, not employee micromanagement.

---

## 4.11 Progressive UI

The progression UI should show:

- branch;
- unlocked state;
- deployed state;
- prerequisites;
- research cost;
- deployment cost;
- activation delay;
- unavailable reason.

Use clear states such as:

```text
hidden
visible + locked
unlocked
deployment pending
deployed
```

Avoid showing a technology as available when its mechanic is not implemented.

---

## 4.12 Remove player-facing legacy campaign

By PR2, the new continuous campaign should be the default player-facing experience.

Remove or hide:

- old weekly-campaign route;
- obsolete monitoring unlock;
- obsolete DB-failure progression;
- old 17-node tree;
- automatic incident timeout path;
- other superseded player-facing mechanics.

Legacy code may remain temporarily behind development-only adapters if required for migration/testing, but players should not encounter two competing campaign systems.

---

## 4.13 Cloud-save/account usability

Phase 5 completes usability work around the account/cloud-save flow.

The player should be able to:

```text
play as guest
→ optionally sign in with Google
→ associate/save current run
→ resume later
```

Requirements:

- clear save status;
- owner-scoped saves;
- safe revision behavior;
- no silent overwrite;
- guest play remains possible;
- Google cancellation or auth errors do not destroy local progress;
- app-session restoration, sign-out, and expired-session recovery work;
- Google callbacks and cookie-based sessions work on production and the explicitly configured auth-test preview origin; see [authentication](../AUTHENTICATION.md);
- account switching does not attach another owner's local run;
- legacy save/meta/analytics keys remain untouched, including during reset and account changes;
- legacy save export remains available after removing the player-facing legacy campaign.

---

## 4.14 Replay reset

A new-run action should:

- generate a new run ID;
- reset progression;
- reset company architecture;
- reset run-specific research points;
- select/configure a new valid seed;
- retain account identity;
- retain historical run records/analytics.

Do not reset the current company when the player merely closes a milestone or postmortem.

---

## 4.15 Campaign summaries

Add lightweight summary derivation from campaign state.

Do not maintain a second manually edited summary state if it can be derived safely.

Possible fields:

```text
milestones reached
research earned/spent
technologies unlocked
technologies deployed
company growth stage
current architecture
```

---

# 5. Existing Modules

The IDE should inspect the repository before implementation.

Likely relevant areas:

```text
technology definitions
existing technology tree
campaign state
actions
shared scheduler
store
reports
menu
save validation
local persistence
cloud-save adapter
scenario configuration
simulation effects
```

Likely file equivalents may include:

```text
src/game/technologies.ts
src/game/progression.ts
src/game/store.ts
src/game/persist.ts
src/sim/actions.ts
src/sim/step.ts
src/components/TechTree.tsx
src/components/Menu.tsx
src/components/CampaignSummary.tsx
src/backend/saveAdapter.ts
```

Use actual repository conventions.

---

# 6. New Modules

The master roadmap calls for:

```text
campaign progression rules
prerequisite tests
```

Possible additions:

```text
src/game/progression.ts
src/game/technologyPrerequisites.ts
```

Potential tests:

```text
src/game/progression.test.ts
src/game/technologyPrerequisites.test.ts
```

If a technology registry already exists, extend it rather than duplicating it.

---

# 7. Automated Testing

## 7.1 Milestone awards

Test:

- milestone is awarded when condition is first met;
- reward occurs exactly once;
- save/resume does not duplicate reward;
- repeated state evaluation does not duplicate reward.

---

## 7.2 Research points

Test:

- research points increase from milestone reward;
- spending reduces available points;
- insufficient research blocks unlock;
- research cannot go negative;
- duplicate spending is prevented.

---

## 7.3 Unlock vs deploy

Test:

```text
unlock technology
≠
deploy technology
```

Verify:

- unlock changes availability;
- simulation effect remains inactive until deployment completes.

---

## 7.4 Prerequisites

Test:

### Autoscaling

Cannot deploy without:

```text
Scale Out + Load Balancing
```

### Cache Tuning

Cannot deploy without:

```text
Read Cache
```

### Automatic Failover

Cannot deploy until all Phase 6 prerequisites/mechanics exist.

---

## 7.5 Alternative paths

Test that:

```text
Scale Up
```

does not require:

```text
Scale Out
```

and vice versa.

Likewise:

```text
Larger DB
```

and:

```text
Read Cache
```

remain independently unlockable where allowed.

---

## 7.6 Technology effect integrity

For every exposed technology, test that deployment changes the intended simulation variable.

Examples:

```text
Scale Up → per-instance app capacity
Scale Out + LB → instance count/routing capacity
Autoscaling → delayed automatic app-instance scheduling
Larger DB → DB capacity
Read Cache → eligible read demand reduction
Cache Tuning → hit rate/warm-up behavior
```

No exposed technology should be cosmetic only.

---

## 7.7 Autoscaling

Test:

- threshold must be met;
- required consecutive-step condition works;
- scale action is scheduled, not instant;
- new instance respects startup delay;
- max instance limit is respected;
- LB/routing prerequisite is respected;
- DB capacity remains unchanged.

---

## 7.8 Progression persistence

Save/resume should preserve:

- milestone state;
- research balance;
- unlocked technologies;
- deployed technologies;
- pending deployments;
- autoscaling configuration;
- same run/company identity.

---

## 7.9 Replay reset

Test:

- new run gets new run ID;
- progression resets;
- architecture resets;
- research resets;
- account identity remains;
- historical analytics are preserved;
- prior cloud save remains distinct.

---

## 7.10 Legacy-path removal

Test that normal production navigation no longer exposes:

- legacy campaign route;
- old 17-node tree;
- obsolete monitoring unlock;
- obsolete DB-failure path.

Development-only migration tooling may remain inaccessible to users.

---

## 7.11 Cloud-save usability

Test:

- guest run can become authenticated run;
- save ownership remains correct;
- local progress survives auth failure;
- revision conflict does not silently overwrite;
- cross-session resume restores progression accurately.

---

## 7.12 Phase 5 acceptance paths

### Path A — Capacity alternative

```text
milestone reached
→ research awarded
→ player unlocks Scale Up
→ deploys upgrade
→ app capacity increases
```

### Path B — Horizontal path

```text
milestone reached
→ research awarded
→ player unlocks Scale Out + LB
→ deploys additional instance/routing
→ later qualifies for Autoscaling
```

### Path C — Data alternative

```text
research awarded
→ player chooses Read Cache rather than Larger DB
→ deploys cache
→ later unlocks Cache Tuning
```

### Path D — Autoscaling delay

```text
traffic rises
→ threshold exceeded
→ autoscaling condition met
→ instance scheduled
→ startup delay
→ instance activates
```

### Path E — Save/resume

```text
player reaches milestone
→ unlocks technology
→ signs in/saves
→ closes session
→ resumes later
→ same company/progression restored
```

---

# 8. Human Validation

The core Phase 5 validation question is:

> **Do players understand what they unlocked, why it became available, and why multiple investment choices remain viable?**

---

## 8.1 Suggested participants

Use a mix of:

- fresh users;
- returning users from earlier tests.

The master roadmap also requires reviewing organic beta activity around PR2.

---

## 8.2 Observe

Record:

- whether players notice new unlocks;
- whether they understand prerequisites;
- whether "unlock" vs "deploy" is clear;
- whether research points make sense;
- whether Scale Up vs Scale Out feels like a meaningful choice;
- whether DB upgrade vs cache feels like a meaningful choice;
- whether too many nodes appear at once;
- whether players feel pushed toward one obvious upgrade path;
- whether autoscaling delay is understandable;
- whether players willingly continue after milestones.

---

## 8.3 Ask after play

Possible questions:

1. What did the milestone give you?
2. Why did you choose this technology?
3. What other option could you have taken?
4. What would make the other option more attractive?
5. Did anything in the tech tree feel confusing?
6. Did any option look available before you understood why?
7. Would you continue playing this company?

---

## 8.4 PR2 organic-beta validation

The proposal/master roadmap targets:

```text
At least 20 organic beta players by PR2
```

An organic beta player counts when they:

- independently start a run;
- make at least one gameplay decision;
- are not a team member;
- are not a recruited test participant.

Track organic activity separately from structured playtests.

---

## 8.5 Replay signal

Continue distinguishing:

```text
continue same company
```

from:

```text
start second run
```

For beta replay measurement, a replay requires:

- new run started;
- at least one gameplay decision made;
- no prompting/reward.

---

## 8.6 Human validation success signal

Players should be able to explain something like:

> "I unlocked a new option because I reached the milestone, but I still had to choose whether it was worth spending resources to deploy."

and:

> "Scale Up and Scale Out solve similar capacity problems differently, so I don't always need both."

The exact wording is not important.

Understanding of choice and prerequisite structure is.

---

# 9. Definition of Done

Phase 5 is complete only when all of the following are true.

## Campaign progression

- [ ] Growth milestones exist.
- [ ] Milestones award exactly once.
- [ ] Research points are awarded and spendable.
- [ ] Unlock and deployment are separate concepts.
- [ ] Gradual reveal works.
- [ ] Same company continues through milestones.

## Nine-unlock structure

- [ ] Scale Up exists.
- [ ] Scale Out + Load Balancing exists.
- [ ] Autoscaling exists.
- [ ] Larger Database exists.
- [ ] Read Cache exists.
- [ ] Cache Tuning exists.
- [ ] Health Checks is represented correctly for Phase 6.
- [ ] Spare Application Instance is represented correctly for Phase 6.
- [ ] Automatic Failover is represented correctly for Phase 6.
- [ ] No exposed unimplemented reliability technology pretends to work.

## Prerequisites

- [ ] Autoscaling requires horizontal scaling/load balancing.
- [ ] Cache Tuning requires Read Cache.
- [ ] Automatic Failover remains gated until Phase 6 prerequisites are real.
- [ ] Scale Up and Scale Out remain alternative investments.
- [ ] Larger DB and Read Cache remain alternative investments.

## Autoscaling

- [ ] Threshold is visible/configurable as intended.
- [ ] Trigger requires sustained condition.
- [ ] Scaling is delayed.
- [ ] Autoscaling adds app capacity only.
- [ ] Autoscaling cannot fix DB capacity.
- [ ] Max-instance bounds exist.

## Persistence

- [ ] Progression survives local save/resume.
- [ ] Progression survives cloud save/resume.
- [ ] Pending deployments survive save/resume.
- [ ] Run/company identity remains stable.
- [ ] New-run reset produces new run identity.

## Player-facing migration

- [ ] New campaign is default.
- [ ] Legacy campaign route is not player-facing.
- [ ] Old 17-node tree is removed from normal play.
- [ ] Obsolete monitoring unlock is removed.
- [ ] Obsolete DB-failure progression is removed.

## Account/cloud usability

- [ ] Guest-first play still works.
- [ ] Google sign-in, cancellation, and app-session recovery work.
- [ ] Local run can be associated safely with owner where supported.
- [ ] Cloud save status is understandable.
- [ ] Conflicts do not silently overwrite.
- [ ] Auth failure does not destroy local progress.

## PR2 validation

- [ ] Tech-tree usability tested with users.
- [ ] Gradual reveal tested.
- [ ] Alternative-investment understanding tested.
- [ ] Organic beta activity reviewed.
- [ ] Target of 20 organic beta players is measured and reported honestly.
- [ ] Organic replay is measured separately from recruited testing.

## Engineering quality

- [ ] Milestone tests pass.
- [ ] Research spending tests pass.
- [ ] Prerequisite tests pass.
- [ ] Autoscaling tests pass.
- [ ] Progression persistence tests pass.
- [ ] Replay-reset tests pass.
- [ ] Phase 1–4 regression tests remain healthy.
- [ ] Typecheck/build pass or known pre-existing failures are documented.

---

# 10. Dependencies

Phase 5 depends on Phases 3–4 being stable.

Required from Phase 3:

- per-instance application model;
- explicit routing/load balancing;
- delayed scaling actions;
- account sign-in;
- owner-scoped cloud-save foundation.

Required from Phase 4:

- database upgrade;
- read cache;
- cache tuning mechanics or their stable effect contracts;
- seeded scenario configuration;
- analytics run/session attribution.

Required from earlier phases:

- continuous campaign identity;
- milestone-compatible store;
- deterministic simulation;
- save schema/versioning;
- causal postmortems.

The reliability UI may use agreed fixtures while Phase 6 mechanics are being developed, but real reliability actions must not be exposed prematurely.

---

# 11. Scope Guard

Do not expand Phase 5 into:

- application-failure simulation;
- health-check behavior;
- failover behavior;
- database failure;
- database failover;
- network/security incidents;
- queues;
- multi-region;
- microservices;
- full management/staff simulator;
- arbitrary scenario editor;
- achievements;
- leaderboards;
- extra tech-tree branches;
- cosmetic upgrades with no simulation effect;
- reward systems that prescribe one solution.

The purpose of Phase 5 is:

> **coherent progression and gradual choice integration**

not adding more mechanic families.

---

# 12. Main Risks and Mitigations

## Risk 1 — Tech tree becomes a checklist

**Mitigation:**

Keep alternative investments viable.

Do not require all nodes in a fixed order.

---

## Risk 2 — Too many options appear at once

**Mitigation:**

Use milestone-based gradual reveal.

Hide later branches until relevant.

---

## Risk 3 — Research unlock is confused with deployment

**Mitigation:**

Use distinct UI states and separate costs.

---

## Risk 4 — Autoscaling becomes a universal safety net

**Mitigation:**

Require:

- threshold;
- sustained trigger;
- startup delay;
- LB;
- max instance count.

Keep DB bottlenecks independent.

---

## Risk 5 — Reliability nodes appear functional before Phase 6

**Mitigation:**

Hide or clearly lock them.

Never expose fake functionality.

---

## Risk 6 — Old and new campaign systems coexist visibly

**Mitigation:**

Remove legacy route from player navigation by PR2.

Keep migration adapters development-only.

---

## Risk 7 — Cloud-save work destabilizes progression

**Mitigation:**

Version save schema and test progression persistence before PR2.

---

## Risk 8 — PR2 adds too much scope

**Mitigation:**

Prioritize:

```text
progression coherence
→ 9-node structure
→ prerequisites
→ save/resume
→ replay flow
→ organic beta testing
```

before decorative polish.

---

# 13. Recommended Implementation Order

1. Verify Phase 4 Definition of Done.
2. Run Phase 1–4 regression suite.
3. Inspect current technology/progression implementation.
4. Identify and isolate the old 17-node progression path.
5. Define the 9-technology registry.
6. Define milestone state.
7. Define research-point state.
8. Implement milestone award logic.
9. Add exactly-once milestone tests.
10. Implement research earning/spending.
11. Separate unlock from deployment.
12. Implement prerequisite engine.
13. Add Scale Up / Scale Out alternative paths.
14. Integrate existing DB upgrade / Read Cache alternatives.
15. Integrate Cache Tuning prerequisite.
16. Implement autoscaling threshold/configuration.
17. Implement delayed autoscaling using existing scheduler.
18. Add autoscaling tests.
19. Add progressive reveal UI.
20. Add technology-state UI: locked/unlocked/pending/deployed.
21. Keep reliability nodes hidden/locked pending Phase 6.
22. Update save schema for progression.
23. Verify local save/resume.
24. Complete cloud-save/account usability.
25. Implement replay/new-run reset.
26. Add campaign summary.
27. Remove player-facing legacy campaign route.
28. Verify every exposed technology has a real effect.
29. Run acceptance paths.
30. Conduct progression/tech-tree playtests.
31. Review organic beta analytics.
32. Fix high-impact confusion.
33. Run typecheck/tests/build.
34. Freeze PR2 candidate.
35. Stop for review before Phase 6.

---

# 14. Phase 5 Acceptance Scenario

A representative flow:

```text
Player continues same company
→ reaches growth milestone
→ earns research points
→ sees Scale Up and Scale Out as alternatives
→ chooses one
→ unlocks technology
→ spends cash/engineering time to deploy
→ architecture changes after delay
→ later milestone reveals more options
→ player unlocks Read Cache
→ later qualifies for Cache Tuning
→ horizontal path can later qualify for Autoscaling
→ same company and history continue
```

Autoscaling example:

```text
app utilisation stays above threshold
→ trigger counter increases
→ autoscaling schedules new instance
→ startup delay
→ instance activates
→ LB distributes traffic
```

Database invariant:

```text
DB becomes bottleneck
→ autoscaling may add app instances
→ DB capacity remains unchanged
→ DB bottleneck remains
```

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

Treat PHASE_5_PROGRESSION.md as the detailed progression, persistence, PR2, and acceptance specification for this phase.

Inspect the current repository first.

Before modifying code, report:

1. whether Phases 1–4 are fully implemented and stable;
2. how the current technology/progression system works;
3. where the old 17-node tree and legacy campaign assumptions live;
4. which existing technologies can be reused directly;
5. exact files/functions that must change;
6. current save-schema implications;
7. the smallest safe implementation order for PR2.

Preserve these invariants:
- one continuous company/run;
- milestones award exactly once;
- unlock is separate from deployment;
- Scale Up and Scale Out remain alternative investments;
- Larger DB and Read Cache remain alternative investments;
- Autoscaling requires horizontal scaling/load balancing and acts after a delay;
- Autoscaling cannot fix a database bottleneck;
- every exposed technology has a real simulation effect;
- reliability mechanics remain gated until Phase 6;
- guest-first play remains available.

Implement Phase 5 only.

Do not proceed into:
- temporary application failure;
- health checks;
- failover;
- extra incident families;
- combined full-campaign balance work from Phase 7;
- later phases.

After implementation:
- run Phase 1–4 regression tests;
- run milestone/research/prerequisite tests;
- run autoscaling tests;
- run progression persistence tests;
- run replay/reset tests;
- run cloud-save/account tests;
- run browser smoke tests;
- run typecheck;
- run production build;
- list files changed;
- explain deviations from this specification;
- report remaining PR2 blockers;
- confirm whether every Phase 5 Definition of Done item is satisfied;
- stop for review.
```

---

# 16. Phase 5 Summary

At the end of Phase 5, the project should feel like one coherent growing-company campaign:

```text
Company grows
→ milestone reached
→ research earned
→ new options revealed
→ player chooses alternative investment
→ technology unlocks
→ deployment costs resources and takes time
→ architecture evolves
→ future situations change
→ same company continues
```

The 9-unlock structure should now organize the campaign, with the reliability branch prepared but not falsely implemented.

Phase 6 can then complete the reliability branch by introducing temporary application failures, health checks, spare capacity, and automatic failover.
