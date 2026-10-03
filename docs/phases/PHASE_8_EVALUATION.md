# Phase 8 — Frozen Evaluation Build and Polish

> **Project:** 99.99% — System Design Tycoon  
> **Target:** Preparation throughout October; formal evaluation 1–8 November 2026  
> **Primary learning outcomes:** Evaluate LO1–LO4 without claiming professional competence or lasting learning gains  
> **Status:** Detailed implementation and evaluation plan for Phase 8 only

---

# 1. Goal

Freeze the major gameplay mechanics and turn the Phase 7 campaign into a **stable, measurable, evaluation-ready MVP**.

Phase 8 is not a feature-expansion phase.

The priority is to make the existing game:

- stable;
- measurable;
- accessible;
- reproducible;
- secure enough for evaluation;
- reliable for a 20-player cohort;
- consistent across sessions;
- easy to analyze afterward.

The formal evaluation should answer:

```text
Can fresh target users complete the first incident independently?
Do they enjoy the experience?
Do they voluntarily replay?
Do their explanations show the intended learning outcomes?
```

The central rule for this phase is:

> **No new gameplay mechanics unless a critical defect makes evaluation impossible.**

---

# 2. Player Experience

A Phase 8 participant should receive a polished but unchanged version of the Phase 7 game.

The evaluation experience should feel consistent:

```text
Start fresh run
→ same onboarding
→ same first-incident setup
→ same available opening controls
→ measured first incident
→ postmortem
→ campaign continuation / replay option
```

The game should not behave differently because the participant is part of a study.

The evaluation build should be a normal playable build with stable instrumentation.

---

## 2.1 Stable onboarding

The onboarding must:

- be the same for all formal participants;
- not reveal answers;
- be understandable without facilitator explanation;
- remain short enough for the 10–15 minute first-incident target;
- use evidence-focused prompts.

Do not change onboarding halfway through the cohort unless a critical issue forces a new evaluation build version.

---

## 2.2 Stable first-incident scenario

The proposal requires one recorded build, the same onboarding, and a fixed first-incident seed for the formal cohort.

Therefore the first incident should use:

```text
fixed evaluation scenario version
fixed evaluation seed
fixed opening architecture
fixed opening budget
fixed onboarding
```

This ensures variation in severity does not distort participant comparison.

Later campaign content may still exist, but the first-incident evaluation must be stable.

---

## 2.3 Fresh-user experience

The participant should be able to:

- start without facilitator setup;
- understand where the architecture and metrics are;
- inspect evidence;
- choose actions;
- recover or fail;
- reach the postmortem;
- decide whether to continue or replay.

The evaluator should observe rather than coach.

---

## 2.4 Failure and quit paths

Formal evaluation must include players who:

- fail the first incident;
- go bankrupt;
- quit early;
- encounter a technical problem.

Do not silently exclude them from enjoyment/completion reporting unless the protocol explicitly defines an exclusion.

Record the reason separately.

---

## 2.5 Replay behavior

Replay should count only when the participant:

```text
starts a new run
AND
makes at least one gameplay decision
```

Continuing the same company is not replay.

A participant should not be encouraged or rewarded to replay before the behavior is recorded.

---

# 3. Learning Outcomes

## LO1 — Diagnose bottlenecks

Evaluate whether the player can identify:

- limiting component;
- relevant dependency;
- evidence supporting the diagnosis.

---

## LO2 — Choose scaling strategies

Evaluate whether the player can choose and justify:

- Scale Up;
- Scale Out + LB;
- DB upgrade;
- caching;

based on workload and constraints.

---

## LO3 — Improve reliability

Evaluate whether the player understands:

- health checks;
- spare capacity;
- failover;
- surviving capacity.

Only assess this if the participant has encountered implemented reliability content.

---

## LO4 — Weigh trade-offs

Require the participant to mention at least one:

```text
benefit
cost
limitation
trade-off
```

for a chosen design response.

Do not claim that the evaluation proves professional system-design competence.

Do not claim lasting learning gains.

---

# 4. Engineering

## 4.1 Freeze mechanics

By the evaluation freeze:

- no new technology branches;
- no new incident families;
- no major simulation rewrites;
- no new management subsystems;
- no major progression changes.

Only allow:

```text
critical bug fixes
usability fixes
security fixes
small balance fixes
instrumentation fixes
```

If a fix materially changes evaluated behavior, create a new build version and report affected sessions separately.

---

## 4.2 Evaluation build versioning

Record:

```text
buildVersion
scenarioVersion
evaluationSeed
schemaVersion
```

These should be attached to analytics events and evaluation exports.

The formal cohort should ideally use one build version.

If multiple versions are unavoidable, record exactly which participant used which build.

---

## 4.3 First-incident timer

Measure first-incident completion accurately.

Record at least:

```text
run start
incident open time
incident recovery time
first-incident completion time
active elapsed time
wall-clock elapsed time
```

If the game pauses during inspection, define clearly whether the 15-minute metric uses:

```text
wall-clock time
```

or:

```text
active gameplay time
```

Use the protocol consistently.

The proposal's target is first incident resolved within 15 minutes.

---

## 4.4 Completion event

A participant counts as independently completing the first incident only when:

```text
recovery condition is actually satisfied
AND
no facilitator help occurred
```

In-game hints are allowed.

Do not count:

```text
clicked correct action
```

as completion before measured recovery.

---

## 4.5 Assistance logging

Support recording:

```text
no assistance
in-game hint only
facilitator intervention
technical intervention
```

The game may log hint use automatically.

Facilitator/technical intervention may be recorded through a lightweight evaluator form if not built into the game.

Do not overengineer evaluator tooling.

---

## 4.6 Quit / failure logging

Record:

```text
quit
bankruptcy
timeout / unresolved incident
technical failure
```

Do not collapse these into one generic failure state.

---

## 4.7 Enjoyment collection

The proposal requires asking:

> "How enjoyable was this play session?"

Use a 1–5 scale.

Collect after the first attempt and before coaching/discussion.

The game may:

- show an in-app survey;
- or use an external form.

Do not make usefulness ratings count toward the enjoyment target.

---

## 4.8 Replay instrumentation

Track:

```text
new_run_started
first_decision_in_new_run
```

A replay counts only after both occur.

Do not count:

- clicking "New Run" but immediately leaving;
- continuing current company;
- replay prompted by evaluator;
- rewarded replay.

---

## 4.9 Pre/post learning assessment

Use two equivalent question sets:

```text
Form A
Form B
```

Counterbalance order:

```text
half: A pre, B post
half: B pre, A post
```

Do not reveal answers between tests.

Each participant answers three scenario questions.

Score each question:

```text
0 = incorrect
1 = plausible choice/diagnosis without sound reasoning
2 = correct/suitable response with causal reasoning + relevant trade-off
```

Total:

```text
0–6
```

---

## 4.10 Assessment coverage

Question 1:

```text
LO1 — bottleneck diagnosis
```

Question 2:

```text
LO2 — scaling/cache strategy
```

Question 3:

```text
LO3 — reliability response
```

Require a benefit/cost/limitation to capture LO4.

Only assess concepts actually implemented and encountered.

---

## 4.11 Blind scoring process

Two team members should score anonymized responses independently.

They should not know:

- participant identity;
- whether the answer is pre or post.

Then reconcile disagreements.

The game itself does not need to automate blind scoring.

An external spreadsheet/script is sufficient.

---

## 4.12 Telemetry finalization

Finalize reliable event tracking for:

### Run

```text
run_started
run_resumed
run_completed
run_failed
run_reset
```

### Incident

```text
incident_opened
incident_recovered
incident_unresolved
```

### Actions

```text
action_requested
action_activated
action_failed_validation
```

### Hints/help

```text
hint_used
facilitator_help_recorded
```

### Replay

```text
new_run_started
new_run_first_decision
```

### Survey linkage

Use a pseudonymous participant/run identifier.

Do not store unnecessary personal data.

---

## 4.13 Analytics deduplication

Every analytics event should have:

```text
eventId
runId
sessionId
sequence
timestamp
buildVersion
scenarioVersion
```

Ensure events do not double-fire because of:

- React rerenders;
- save/resume;
- retry logic;
- offline queue replay.

---

## 4.14 Offline analytics queue

If connectivity drops:

- queue unsent events locally;
- preserve event IDs;
- retry later;
- avoid duplicates.

A temporary network failure should not destroy the player's run or the evaluation record.

---

## 4.15 Authentication and save validation

Recheck:

- owner-scoped cloud saves;
- no cross-user access;
- guest play;
- local fallback;
- conflict handling;
- save schema compatibility.

Formal evaluation should not fail because login is mandatory.

Guest-first play remains preferable.

---

## 4.16 Accessibility and interaction polish

Finish high-impact usability items:

- keyboard-accessible controls where practical;
- visible focus states;
- readable text;
- clear disabled states;
- clear error messages;
- sensible tab order;
- responsive layout;
- no critical information conveyed only by color;
- adequate contrast.

Do not attempt a complete accessibility certification exercise.

Focus on obvious blockers.

---

## 4.17 Responsive layout

Verify core play on:

- standard laptop;
- common desktop widths.

Mobile-first redesign is not required unless already part of the product scope.

The formal evaluation environment should be consistent where possible.

---

## 4.18 Error states

Handle:

- analytics failure;
- cloud-save failure;
- auth failure;
- stale save;
- malformed scenario config;
- failed API request.

The player should receive an understandable message and preserve local progress where possible.

---

## 4.19 Deployment stability

Verify:

- production deployment;
- environment variables;
- backend access policies;
- analytics endpoint;
- auth redirects;
- static assets;
- scenario/version config.

Create a known-good evaluation deployment URL/build.

---

# 5. Existing Modules

Likely relevant areas:

```text
telemetry
auth adapters
save adapters
onboarding
architecture view
controls
postmortems
analytics ingestion
deployment configuration
scenario config
campaign state
```

Possible file equivalents:

```text
src/analytics/*
src/backend/*
src/game/persist.ts
src/game/store.ts
src/components/Onboarding*
src/components/Architecture*
src/components/Postmortem*
src/sim/scenarios/*
src/app/*
```

The IDE should inspect actual repository structure before modifying code.

---

# 6. New Artifacts

The master roadmap calls for:

```text
evaluation protocol
equivalent question sets
scoring rubric
export/report scripts
```

Suggested repo artifacts:

```text
docs/evaluation/EVALUATION_PROTOCOL.md
docs/evaluation/PRE_POST_FORM_A.md
docs/evaluation/PRE_POST_FORM_B.md
docs/evaluation/SCORING_RUBRIC.md
scripts/export-evaluation-data.*
scripts/summarize-evaluation.*
```

If external Google Forms are used, store the wording and scoring rubric in the repo for reproducibility.

---

# 7. Automated Testing

## 7.1 Full campaign smoke test

Run at least one full deterministic campaign through:

```text
start
→ first incident
→ progression
→ later mechanics
→ final completion
```

This catches integration regressions before cohort testing.

---

## 7.2 Fixed evaluation seed regression

Test that the formal first-incident scenario remains unchanged for:

```text
evaluationSeed
+ evaluationScenarioVersion
```

unless the build version is intentionally changed.

---

## 7.3 Analytics deduplication

Test:

- same event ID cannot be counted twice;
- retry does not duplicate;
- resume does not duplicate prior events;
- React remount does not double-log critical events.

---

## 7.4 Replay detection

Test:

```text
continue current run
```

does not count as replay.

Test:

```text
new run + first decision
```

does count.

---

## 7.5 Save conflict

Test:

- stale cloud revision is rejected safely;
- local progress remains;
- conflict does not silently overwrite;
- user can recover the run.

---

## 7.6 Offline recovery

Test:

- disconnect;
- continue playing;
- events queue locally;
- reconnect;
- events upload once;
- save state remains valid.

---

## 7.7 Access isolation

Test:

- user A cannot fetch/update user B save;
- guest cannot access protected owner data;
- privileged credentials are not exposed client-side.

---

## 7.8 Completion measurement

Test:

- completion timestamp fires only after measured recovery;
- facilitator-help flag changes independent-completion classification;
- in-game hint alone does not mark facilitator help.

---

## 7.9 Quit/failure classification

Test distinct outcomes:

```text
completed
failed
quit
technical issue
unresolved
```

---

## 7.10 Survey linkage

Test pseudonymous mapping between:

```text
participant code
run ID
pre/post response
enjoyment response
```

without relying on personally identifying information.

---

## 7.11 Evaluation export

Test that the export contains all required fields for analysis.

At minimum:

```text
participant/run code
build version
scenario version
prior operations experience
completion
completion time
hint usage
facilitator help
failure/quit
enjoyment
replay
pre score
post score
missing-response flags
```

---

# 8. Human Validation

This phase contains the formal evaluation cohort.

---

## 8.1 Cohort

Target:

```text
20 first-time players
```

Primary audience:

```text
NUS computing undergraduates
with basic web-development knowledge
```

Exclude:

- team members;
- repeat testers from earlier formal playtests.

Record prior operations/system-design experience.

---

## 8.2 Standardized conditions

Use:

- one recorded build where possible;
- same onboarding;
- fixed first-incident seed;
- same evaluation protocol;
- same first-attempt enjoyment question.

Do not coach participants differently.

---

## 8.3 Independent completion target

Target:

```text
≥ 70%
```

Equivalent to:

```text
at least 14 of 20
```

Definition:

```text
resolve first incident
within 15 minutes
without facilitator help
```

In-game hints are allowed.

Record:

- time;
- hints;
- help;
- failures;
- quits;
- technical issues.

---

## 8.4 Enjoyment target

Target:

```text
median ≥ 4/5
```

Ask all participants after the first attempt, including those who fail or quit.

Report:

- median;
- full distribution;
- missing responses.

Do not omit negative ratings.

---

## 8.5 Voluntary replay target

Target:

```text
≥ 30%
```

Equivalent to:

```text
at least 6 of 20
```

Count only participants who:

```text
start a second run
AND
make a gameplay decision
```

without encouragement or reward.

---

## 8.6 Paired learning analysis

For complete pre/post pairs, report:

- n;
- pre scores;
- post scores;
- mean within-player change;
- median within-player change;
- improved count;
- unchanged count;
- lower count.

Also report:

- missing pre/post responses;
- incomplete pairs;
- common misconceptions;
- anonymized response examples.

Do not claim causality.

---

## 8.7 Organic vs recruited users

Keep formal recruited cohort results separate from:

```text
organic landing-page users
organic beta users
STePS booth users
```

Do not combine them into one headline metric.

---

# 9. Definition of Done

Phase 8 is complete only when all of the following are true.

## Evaluation build

- [ ] Major gameplay mechanics are frozen.
- [ ] Build version is recorded.
- [ ] Scenario version is recorded.
- [ ] Fixed evaluation seed is recorded.
- [ ] Formal deployment is stable.
- [ ] First-incident behavior is reproducible.

## Instrumentation

- [ ] Run events are reliable.
- [ ] Action events are reliable.
- [ ] Incident events are reliable.
- [ ] Hint events are reliable.
- [ ] Replay events are reliable.
- [ ] Event deduplication works.
- [ ] Offline queue works or equivalent failure-safe behavior exists.
- [ ] Build/scenario/seed metadata is attached.

## Persistence/security

- [ ] Guest play works.
- [ ] Auth works.
- [ ] Save ownership is enforced.
- [ ] Cloud conflicts are safe.
- [ ] Local fallback works.
- [ ] Cross-user access is blocked.

## UX/accessibility

- [ ] Onboarding is stable.
- [ ] Text is readable.
- [ ] Focus/keyboard blockers are addressed.
- [ ] Error states are understandable.
- [ ] Core layout works on evaluation devices.
- [ ] Critical information is not hidden only in color.

## Evaluation protocol

- [ ] Formal evaluation protocol exists.
- [ ] Form A exists.
- [ ] Form B exists.
- [ ] Counterbalancing method defined.
- [ ] 0–2 scoring rubric defined.
- [ ] Blind-scoring workflow defined.
- [ ] Participant/run coding method defined.

## Formal cohort

- [ ] 20 first-time participants targeted/recruited.
- [ ] Team members/repeat testers excluded.
- [ ] Prior operations experience recorded.
- [ ] Completion measured.
- [ ] Completion time measured.
- [ ] Hints/help measured.
- [ ] Enjoyment collected.
- [ ] Replay observed.
- [ ] Pre/post responses collected.
- [ ] Missing responses recorded.

## Analysis

- [ ] Completion rate calculated.
- [ ] Enjoyment median/distribution calculated.
- [ ] Replay rate calculated.
- [ ] Paired score changes calculated.
- [ ] Improved/unchanged/lower counts reported.
- [ ] Misconceptions summarized.
- [ ] Organic and recruited data separated.
- [ ] Limitations documented.
- [ ] No causal learning claim made.

## Engineering quality

- [ ] Full campaign smoke tests pass.
- [ ] Analytics dedupe tests pass.
- [ ] Access-isolation tests pass.
- [ ] Save conflict/offline tests pass.
- [ ] Evaluation-seed regression tests pass.
- [ ] Typecheck/build pass or known issues are documented.

---

# 10. Dependencies

Phase 8 depends on complete LO1–LO4 mechanics before formal testing.

Required from Phase 7:

- complete campaign;
- stable progression;
- stable scorecard;
- stable replay flow;
- balance sufficient for evaluation.

Required from earlier phases:

- deterministic simulation;
- reliable saves;
- account/cloud-save support;
- analytics;
- postmortems;
- fixed evaluation scenario;
- continuous campaign.

Formal evaluation should not begin while major gameplay mechanics are still changing.

---

# 11. Scope Guard

Do not add:

- new technologies;
- new incident families;
- new architecture component families;
- new management systems;
- scenario editor;
- multiplayer;
- leaderboards;
- major visual redesign;
- AI-generated content;
- major simulation rewrites.

If a critical fix changes evaluated behavior:

```text
version the build
record which sessions used which version
analyze separately where necessary
```

Do not silently pool incompatible sessions.

---

# 12. Main Risks and Mitigations

## Risk 1 — Build changes during cohort

**Mitigation:**

Freeze build and only make critical fixes.

Version every material change.

---

## Risk 2 — Analytics data is incomplete

**Mitigation:**

Add export checks and local/offline buffering before testing begins.

---

## Risk 3 — Facilitator behavior affects results

**Mitigation:**

Use a written protocol and record intervention.

---

## Risk 4 — Replay is overcounted

**Mitigation:**

Require new run + first gameplay decision.

---

## Risk 5 — Learning questions assess unplayed concepts

**Mitigation:**

Assess only implemented and encountered concepts.

---

## Risk 6 — Small sample is overinterpreted

**Mitigation:**

Report descriptive results and limitations.

Do not make causal or population-wide claims.

---

## Risk 7 — Security/auth issue breaks evaluation

**Mitigation:**

Keep guest-first play and local fallback.

---

## Risk 8 — Negative/missing results are hidden

**Mitigation:**

Report:

```text
failures
quits
missing responses
negative changes
```

explicitly.

---

# 13. Recommended Implementation Order

1. Verify Phase 7 Definition of Done.
2. Declare feature freeze.
3. Record candidate build/scenario versions.
4. Lock fixed evaluation seed/config.
5. Run full campaign smoke tests.
6. Finalize completion timing instrumentation.
7. Finalize hint/help instrumentation.
8. Finalize replay instrumentation.
9. Add event deduplication safeguards.
10. Verify offline event queue/retry.
11. Verify save ownership/access policies.
12. Verify guest/local fallback.
13. Verify cloud conflict handling.
14. Add clear evaluation export.
15. Draft evaluation protocol.
16. Finalize Form A and Form B.
17. Finalize 0–2 scoring rubric.
18. Define participant/run coding method.
19. Pilot the protocol with 1–2 non-cohort users.
20. Fix protocol/UX blockers only.
21. Freeze formal evaluation build.
22. Recruit/confirm 20 fresh participants.
23. Run formal sessions using standardized conditions.
24. Track build/session metadata.
25. Collect enjoyment before discussion.
26. Observe replay without prompting.
27. Collect post-test responses.
28. Blind-score responses independently.
29. Reconcile scoring disagreements.
30. Export data.
31. Calculate primary metrics.
32. Summarize misconceptions.
33. Report missing/incomplete data.
34. Separate organic and recruited results.
35. Fix only critical usability/security issues after cohort where necessary.
36. Stop for Phase 9 release/showcase freeze.

---

# 14. Phase 8 Evaluation Flow

A representative participant session:

```text
Assign participant code
→ pre-test Form A/B
→ start fixed evaluation build
→ same onboarding
→ first incident begins
→ observe without coaching
→ record hints/help/quit/failure
→ first incident resolves or session ends
→ collect enjoyment 1–5
→ observe whether participant starts a new run voluntarily
→ if replay: confirm first decision
→ post-test alternate form
→ end session
```

The evaluator should then record:

```text
build
scenario
completion
time
help
enjoyment
replay
technical issues
notes
```

---

# 15. Required Evaluation Outputs

At minimum, prepare the following outputs.

## Primary product metrics

```text
Independent completion:
x / 20
percentage

Enjoyment:
median
distribution

Voluntary replay:
x / 20
percentage
```

---

## Learning results

```text
complete paired n
pre score distribution
post score distribution
mean within-player change
median within-player change
improved / unchanged / lower
```

---

## Qualitative findings

Summarize:

- common bottleneck misconceptions;
- common scaling misconceptions;
- reliability misconceptions;
- confusing controls;
- useful postmortem feedback;
- reasons users replayed or did not replay.

---

## Limitations

Include:

- small sample;
- one university audience;
- short-term assessment;
- simplified simulation;
- novelty effect;
- incomplete sessions;
- build changes if any.

---

# 16. IDE Implementation Prompt

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
docs/phases/PHASE_8_EVALUATION.md
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
- docs/phases/PHASE_8_EVALUATION.md

Treat PHASE_8_EVALUATION.md as the detailed evaluation-freeze, analytics, usability, security, and acceptance specification for this phase.

Inspect the current repository first.

Before modifying code, report:

1. whether Phase 7 is fully implemented and stable;
2. current build/scenario/seed versioning;
3. current telemetry coverage and duplicate-event risks;
4. current replay-detection logic;
5. current save/auth/access-control risks;
6. current accessibility/usability blockers;
7. current evaluation export capability;
8. exact files/functions that must change;
9. the smallest safe implementation order before formal testing.

Preserve these invariants:
- no new gameplay mechanics;
- fixed first-incident evaluation scenario;
- one recorded evaluation build where possible;
- independent completion is based on measured recovery;
- in-game hints are allowed but facilitator help is recorded separately;
- replay means new run + first gameplay decision;
- organic and recruited users remain separate;
- learning results are descriptive and non-causal;
- critical post-freeze changes are versioned.

Implement Phase 8 only.

Do not proceed into:
- new mechanics;
- Phase 9 showcase-only work unless needed for a critical evaluation blocker.

After implementation:
- run full campaign smoke tests;
- run analytics dedupe tests;
- run access-control tests;
- run save conflict/offline tests;
- run evaluation-seed regression tests;
- run browser smoke tests;
- run typecheck;
- run production build;
- list files changed;
- explain deviations from this specification;
- report remaining evaluation blockers;
- confirm whether every Phase 8 Definition of Done item is satisfied;
- stop for review.
```

---

# 17. Phase 8 Summary

At the end of Phase 8, the project should be a **frozen, measurable, evaluation-ready MVP**:

```text
stable build
→ fixed first-incident scenario
→ reliable analytics
→ reliable saves/auth
→ accessible onboarding
→ standardized 20-player protocol
→ completion/enjoyment/replay measurement
→ paired learning assessment
→ honest analysis and limitations
```

No new gameplay should be needed after this point.

Phase 9 should focus on release stability, showcase preparation, final documentation, and final reporting.
