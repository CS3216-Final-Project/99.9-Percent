# Phase 9 — Freeze, Showcase, and Final Report

> **Project:** 99.99% — System Design Tycoon  
> **Target:** 9–19 November 2026  
> **Course milestones:** STePS — 12 November 2026, 3–7 pm (TBC); Final report — 19 November 2026, 7:59 am  
> **Primary objective:** Release stability, showcase readiness, final documentation, and evidence reporting  
> **Status:** Detailed implementation and release plan for Phase 9 only

---

# 1. Goal

Transition the project from an evaluated MVP into a **frozen, reliable showcase build** and complete the final documentation and report.

Phase 9 is not a gameplay-development phase.

The priorities are:

- preserve the evaluated product;
- fix only critical defects;
- avoid invalidating evaluation evidence;
- prepare a reliable STePS demo;
- prepare an offline/backup demonstration path;
- document final design decisions and limitations;
- consolidate customer-contact evidence;
- report evaluation results honestly;
- submit a reproducible final project.

The central rule is:

> **No substantial gameplay changes after the evaluation build.**

Any post-evaluation change should be either:

```text
critical bug fix
small narrowly justified balance adjustment
deployment/reliability fix
documentation/presentation work
```

---

# 2. Player Experience

The final showcase build should provide an immediate path into the core gameplay loop.

A STePS visitor should be able to understand the product quickly:

```text
Open game
→ see company architecture
→ understand current traffic/system state
→ make one meaningful decision
→ observe consequence
→ see incident/recovery or a prepared demonstration moment
```

The booth demo does not need to reproduce the full formal evaluation session.

It should showcase the product clearly and reliably.

---

## 2.1 Stable demo state

Prepare at least one known-good demo state/seed.

The demo should be:

- reproducible;
- fast to reach;
- visually interesting;
- representative of the real simulation;
- not dependent on random luck.

Possible demo setup:

```text
company already mid-growth
→ traffic rises
→ bottleneck becomes visible
→ visitor chooses between 2–3 actions
→ metrics respond immediately
```

Do not fake the underlying result with a scripted animation if the real simulation can support the demo.

---

## 2.2 Demo duration

A booth visitor should be able to understand the value proposition in roughly:

```text
1–3 minutes
```

A longer full run may remain available for interested users.

The booth experience should not require the full 10–15 minute introductory session.

---

## 2.3 Backup demo flow

Prepare a backup in case:

- Wi-Fi fails;
- backend is unavailable;
- auth fails;
- cloud save is unavailable;
- production deployment breaks;
- analytics endpoint is unavailable.

The backup may include:

- local-only playable mode;
- preloaded demo save;
- recorded gameplay video;
- screenshots;
- prepared deterministic run.

The backup should still communicate the core product value.

---

# 3. Learning Outcomes

Phase 9 does not introduce new learning outcomes.

The final product should continue demonstrating:

- LO1 — bottleneck diagnosis;
- LO2 — scaling strategy choice;
- LO3 — reliability reasoning;
- LO4 — trade-off reasoning.

Final documentation should clearly state that:

- the game is a simplified educational simulation;
- the evaluation does not establish professional system-design competence;
- short-term pre/post changes do not prove lasting learning gains.

---

# 4. Engineering

## 4.1 Feature freeze

Do not add:

- new technologies;
- new incident families;
- new architecture components;
- new campaign branches;
- new major management mechanics.

Treat the evaluated build as the behavioral baseline.

---

## 4.2 Critical-fix policy

A post-evaluation fix is acceptable if it addresses:

- crash;
- data loss;
- broken deployment;
- auth failure blocking use;
- severe UI blocker;
- incorrect simulation behavior;
- security issue;
- demo-breaking bug.

For every material fix, record:

```text
issue
reason
files changed
whether evaluated behavior changed
new build version
```

---

## 4.3 Balance-change policy

Only make small balance changes if necessary for:

- STePS demo reliability;
- obvious soft-lock prevention;
- severe pacing issue.

Do not re-tune the whole economy after evaluation.

If a balance change affects behavior measured in the formal cohort, do not merge its outcomes with the earlier evaluation results.

---

## 4.4 Release build

Create a final release candidate with:

```text
releaseVersion
buildVersion
scenarioVersion
schemaVersion
```

Document these in the repo.

---

## 4.5 Save compatibility

Verify:

- evaluation saves still load where intended;
- final demo save loads;
- schema migrations are safe;
- stale saves fail gracefully;
- cloud/local fallback still works.

Do not introduce a save-schema change unless necessary.

---

## 4.6 Deployment verification

Check:

- production URL;
- environment variables;
- backend connectivity;
- auth redirect URLs;
- backend authorization and owner-filtered database queries;
- analytics endpoint;
- static assets;
- cache headers where relevant;
- HTTPS;
- build reproducibility.

---

## 4.7 Demo-state loading

Provide a reliable way to enter the demo state.

Possible options:

```text
demo seed
demo save
internal demo route
preloaded local state
```

Keep this hidden from normal users if appropriate.

Do not contaminate formal analytics with demo sessions.

---

## 4.8 Demo analytics separation

Tag booth/demo activity separately from:

```text
formal evaluation cohort
organic beta
```

Possible field:

```text
sessionSource = "steps_demo"
```

This prevents showcase traffic from corrupting prior metrics.

---

## 4.9 Error recovery

Verify graceful recovery from:

- refresh;
- network interruption;
- backend timeout;
- failed save;
- malformed local state.

A booth demo should be recoverable without developer intervention where possible.

---

## 4.10 Security follow-up

Apply only verified fixes from the security scan or observed deployment issues.

Prioritize:

- access-control mistakes;
- exposed secrets;
- unsafe API routes;
- broken auth boundaries;
- unvalidated analytics input.

Do not undertake broad architecture rewrites.

---

# 5. Existing Modules

Likely relevant areas:

```text
deployment config
save/load
auth
analytics
demo/seed configuration
campaign state
release scripts
documentation
```

Possible file equivalents:

```text
vercel.json
next.config.*
src/backend/*
src/game/persist.*
src/analytics/*
src/sim/scenarios/*
docs/*
scripts/*
```

The IDE should inspect the actual repository before making changes.

---

# 6. New Artifacts

The master roadmap specifies:

```text
demo seed/save
offline or recorded backup
operator checklist
A1 poster
one-minute video
final documentation
final report
```

Recommended repository artifacts:

```text
docs/release/FINAL_RELEASE_NOTES.md
docs/release/DEMO_OPERATOR_CHECKLIST.md
docs/release/DEMO_FLOW.md
docs/release/KNOWN_LIMITATIONS.md
docs/evaluation/FINAL_RESULTS_SUMMARY.md
docs/customer-contact/
```

Optional technical artifacts:

```text
scripts/verify-release.*
scripts/load-demo-state.*
```

Do not force presentation assets into the code repo if the team stores them elsewhere, but preserve final exported copies where practical.

---

# 7. Showcase Preparation

## 7.1 STePS demo flow

Prepare a repeatable booth script.

Example:

```text
1. Explain premise in 10–15 seconds.
2. Show the architecture.
3. Trigger/show a traffic problem.
4. Ask visitor what they would change.
5. Apply decision.
6. Show metric consequence.
7. Explain that later stages include caching/reliability.
8. Show scorecard or postmortem.
```

The script should support both:

- guided visitor;
- self-play visitor.

---

## 7.2 Operator checklist

Before the booth:

- production build accessible;
- backup build accessible;
- demo account/session ready if needed;
- local demo save tested;
- video backup downloaded locally;
- laptop chargers available;
- browser cache/session reset method known;
- QR code/link tested;
- analytics/demo tagging verified.

---

## 7.3 Demo reset

Provide a fast reset path between visitors.

Reset should:

- restore demo architecture;
- restore demo traffic/event state;
- clear visitor-specific temporary actions;
- not require manual database cleanup.

---

## 7.4 One-minute video

The video should communicate:

```text
problem
→ gameplay
→ architecture decision
→ consequence
→ learning/strategy value
```

Avoid spending most of the video on menus or setup.

---

## 7.5 A1 poster

Poster content should emphasize:

- product premise;
- core loop;
- key system-design concepts;
- screenshots/architecture visuals;
- evaluation results;
- target audience;
- key user feedback;
- limitations.

Do not overstate learning evidence.

---

# 8. Final Evaluation Reporting

The final report should preserve the Phase 8 evaluation definitions.

---

## 8.1 Independent completion

Report:

```text
completed independently / eligible first-time participants
percentage
```

Include:

- facilitator-help exclusions;
- failures;
- quits;
- technical issues;
- completion-time summary.

---

## 8.2 Enjoyment

Report:

```text
median
distribution
missing responses
```

Do not report only the mean if the target was defined using the median.

---

## 8.3 Voluntary replay

Report:

```text
participants who started new run + made a decision
/
eligible first-run participants
```

State clearly that this measures immediate replay, not long-term retention.

---

## 8.4 Paired learning results

Report:

- paired n;
- pre scores;
- post scores;
- mean within-player change;
- median within-player change;
- improved count;
- unchanged count;
- lower count.

Also report:

- missing pairs;
- scoring disagreements/reconciliation;
- misconceptions;
- anonymized examples.

Do not claim causation.

---

## 8.5 Organic metrics

Report separately:

```text
landing-page sign-ups
organic beta players
organic replay
```

Do not combine organic-user metrics with recruited evaluation cohort metrics.

---

## 8.6 Customer-contact reports

Consolidate customer-contact evidence from:

- early interviews;
- PR1 playtests;
- workload/progression tests;
- reliability tests;
- formal cohort;
- STePS booth feedback.

Keep formal evaluation distinct from informal/showcase observations.

---

# 9. Documentation

## 9.1 Final architecture documentation

Document:

- simulation engine;
- campaign progression;
- scenario configuration;
- analytics;
- persistence;
- backend/auth;
- deployment.

Include a simple architecture diagram if useful.

---

## 9.2 Final gameplay rules

Document:

- incident families;
- recovery thresholds;
- technology tree;
- campaign completion rule;
- scenario variation;
- replay behavior.

---

## 9.3 Limitations

Explicitly document:

- simplified latency model;
- simplified cache model;
- simplified reliability model;
- no DB failover;
- no network/security incident simulation;
- no multi-region;
- small evaluation sample;
- short-term learning measurement;
- single primary university audience.

---

## 9.4 Future work

Future work may include proposal-listed extensions such as:

- queues;
- CDNs;
- microservices;
- multi-region deployment;
- security;
- disaster recovery;
- scenario packs.

Keep future work separate from completed MVP claims.

---

# 10. Automated Testing

## 10.1 Release smoke test

Test:

```text
open production build
→ start run
→ load metrics
→ perform action
→ incident flow works
→ save works
→ reload works
```

---

## 10.2 Demo-state test

Test:

- demo state loads deterministically;
- expected architecture appears;
- expected event occurs;
- reset restores starting demo state.

---

## 10.3 Account/save checks

Test:

- guest play;
- sign in;
- save;
- load;
- conflict handling;
- local fallback.

---

## 10.4 Regression tests for fixes

Every critical Phase 9 fix should include a regression test where practical.

---

## 10.5 Backup flow test

Before STePS, test:

```text
network unavailable
→ local demo still works
```

or:

```text
production unavailable
→ recorded backup accessible
```

---

## 10.6 Analytics-source separation

Test:

```text
formal_evaluation
organic
steps_demo
```

are distinguishable in exported data.

---

# 11. Human Validation

## 11.1 Booth rehearsal

Run at least one full rehearsal with someone not actively developing the feature.

Observe:

- explanation length;
- reset speed;
- demo reliability;
- confusing visuals;
- backup flow.

---

## 11.2 STePS feedback

Collect booth feedback separately from the formal cohort.

Possible lightweight questions:

- Was the idea immediately understandable?
- Which decision looked most interesting?
- Would you try a full run?
- What was confusing?

Do not mix these responses into formal evaluation targets.

---

## 11.3 Final team rehearsal

Before STePS/final presentation:

- each team member can explain the product;
- each team member can run the demo;
- each team member knows the backup flow;
- each team member understands the key evaluation results and limitations.

---

# 12. Definition of Done

Phase 9 is complete only when all of the following are true.

## Release stability

- [ ] Major gameplay remains frozen.
- [ ] Critical defects are fixed.
- [ ] Final release version is recorded.
- [ ] Production deployment is stable.
- [ ] Save compatibility is verified.
- [ ] Guest/local fallback works.

## Demo

- [ ] Known-good demo state exists.
- [ ] Demo reset is fast.
- [ ] STePS booth flow is documented.
- [ ] Offline/recorded backup exists.
- [ ] Backup has been tested.
- [ ] Demo traffic is separated from formal analytics.

## Security

- [ ] Critical security-scan findings are addressed.
- [ ] No exposed privileged credentials.
- [ ] Save ownership/access control still works.
- [ ] Analytics ingestion remains validated.

## Presentation assets

- [ ] A1 poster prepared.
- [ ] One-minute video prepared.
- [ ] Screenshots/demo visuals finalized.
- [ ] QR code/link tested.

## Evaluation reporting

- [ ] Independent completion reported.
- [ ] Enjoyment median/distribution reported.
- [ ] Voluntary replay reported.
- [ ] Paired learning results reported.
- [ ] Missing data reported.
- [ ] Misconceptions reported.
- [ ] Organic and recruited users separated.
- [ ] Limitations stated.
- [ ] No unsupported causal claim made.

## Documentation

- [ ] Final architecture documented.
- [ ] Final gameplay rules documented.
- [ ] Technology tree documented.
- [ ] Incident/recovery rules documented.
- [ ] Known limitations documented.
- [ ] Future work documented.
- [ ] Final release notes exist.

## Customer contact

- [ ] Customer-contact reports consolidated.
- [ ] Formal cohort kept separate from booth feedback.
- [ ] STePS feedback recorded separately.

## Final submission

- [ ] Demo is reproducible.
- [ ] Backup demo works.
- [ ] Final report is complete.
- [ ] Required project artifacts are archived.
- [ ] Final submission is ready before 19 November deadline.

---

# 13. Dependencies

Phase 9 depends on Phase 8 being complete.

Required from Phase 8:

- frozen evaluation build;
- completed formal cohort;
- evaluation export;
- stable analytics;
- stable auth/save system;
- known build/scenario versions;
- analyzed results or analysis-ready data.

Do not use Phase 9 to compensate for unfinished core mechanics from earlier phases.

If a core mechanic is still incomplete at this stage, document the limitation rather than expanding scope.

---

# 14. Scope Guard

Do not add:

- new gameplay mechanics;
- new technology nodes;
- new incident families;
- new architecture components;
- major progression changes;
- major simulation changes;
- major economy rebalance;
- scenario editor;
- multiplayer;
- leaderboards;
- AI-generated content;
- major UI redesign.

Do not "improve the game" in a way that invalidates the formal evaluation.

Phase 9 is about:

```text
stability
evidence
showcase
documentation
submission
```

---

# 15. Main Risks and Mitigations

## Risk 1 — Last-minute feature creep

**Mitigation:**

Require every code change to be categorized as:

```text
critical fix
demo reliability
security
documentation
```

Anything else is deferred.

---

## Risk 2 — Demo depends on network/backend

**Mitigation:**

Maintain a local/offline fallback and recorded backup.

---

## Risk 3 — Final build differs too much from evaluated build

**Mitigation:**

Record build versions and limit behavior-changing fixes.

---

## Risk 4 — Booth analytics corrupt evaluation metrics

**Mitigation:**

Tag STePS/demo sessions separately.

---

## Risk 5 — Evaluation claims become overstated

**Mitigation:**

Report sample size, missing data, limitations, and non-causal interpretation.

---

## Risk 6 — Team cannot recover from demo failure

**Mitigation:**

Use operator checklist, demo reset, and backup flow.

---

## Risk 7 — Final report misses traceability

**Mitigation:**

Link conclusions back to:

- product targets;
- recorded metrics;
- customer-contact reports;
- implemented mechanics.

---

# 16. Recommended Implementation Order

1. Verify Phase 8 Definition of Done.
2. Declare final gameplay freeze.
3. Record evaluated build version.
4. Create Phase 9 release branch/tag strategy.
5. Review critical bug list.
6. Fix crash/data-loss/security blockers only.
7. Add regression tests for critical fixes.
8. Verify save compatibility.
9. Verify auth/local fallback.
10. Verify final deployment.
11. Create known-good demo state.
12. Implement/test fast demo reset.
13. Tag demo analytics separately.
14. Prepare offline/local backup.
15. Prepare recorded-video backup.
16. Run full demo rehearsal.
17. Create operator checklist.
18. Finalize screenshots.
19. Finalize one-minute video.
20. Finalize A1 poster.
21. Export final evaluation data.
22. Calculate all primary metrics.
23. Summarize learning results.
24. Summarize misconceptions.
25. Separate organic/recruited/booth data.
26. Consolidate customer-contact reports.
27. Write final architecture documentation.
28. Write final gameplay/limitations documentation.
29. Write final results/limitations section.
30. Rehearse STePS booth with team.
31. Run STePS.
32. Record booth feedback separately.
33. Make only critical post-STePS fixes.
34. Finalize report.
35. Archive final release and evidence.
36. Submit before deadline.

---

# 17. Phase 9 Showcase Flow

A recommended booth flow:

```text
Visitor arrives
→ 10-second pitch:
   "Grow a software company by designing the system behind it."

→ show architecture
→ show traffic increasing
→ ask:
   "What would you change?"

→ visitor chooses action
→ metrics/architecture respond
→ explain consequence
→ show postmortem/scorecard briefly
→ invite full play / QR code
```

If live demo fails:

```text
switch to local demo
```

If local demo fails:

```text
switch to recorded gameplay
```

The team should practice these transitions.

---

# 18. Final Report Structure Support

Phase 9 should leave enough evidence for a final report structure such as:

```text
1. Product/problem
2. Target audience
3. Game design
4. Learning outcomes
5. Simulation model
6. Architecture/implementation
7. Development iterations
8. Customer contact
9. Evaluation method
10. Evaluation results
11. Discussion
12. Limitations
13. Business/market context
14. Future work
15. Individual contributions
```

Use actual course requirements if they specify a different format.

---

# 19. IDE Implementation Prompt

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
docs/phases/PHASE_9_FREEZE.md
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
- docs/phases/PHASE_9_FREEZE.md

Treat PHASE_9_FREEZE.md as the final release, showcase, documentation, and submission specification.

Inspect the current repository first.

Before modifying code, report:

1. whether Phase 8 is complete;
2. current evaluated build/version;
3. current critical bug/security list;
4. whether any proposed change would alter evaluated gameplay behavior;
5. current demo/reset capability;
6. current offline/backup options;
7. current analytics source tagging;
8. current save compatibility risks;
9. exact files/functions that need changes;
10. the smallest safe implementation order.

Preserve these invariants:
- no substantial gameplay changes;
- evaluated behavior remains the reference;
- critical behavior-changing fixes are versioned;
- STePS/demo analytics are separated from formal evaluation;
- backup demo works without relying on production availability;
- final reporting uses actual recorded evidence and states limitations honestly.

Implement Phase 9 only.

Do not add:
- new mechanics;
- new incident families;
- new technology branches;
- major balance systems;
- later experimental features.

After implementation:
- run release smoke tests;
- run demo-state/reset tests;
- run account/save checks;
- run regression tests for fixes;
- run backup-flow test;
- run typecheck;
- run production build;
- list files changed;
- explain deviations from this specification;
- report remaining release/showcase blockers;
- confirm whether every Phase 9 Definition of Done item is satisfied;
- stop for final review.
```

---

# 20. Phase 9 Summary

At the end of Phase 9, the project should be:

```text
frozen
stable
reproducible
showcase-ready
documented
evaluated
honestly reported
```

The final objective is not to add more game.

It is to present and submit the strongest, most reliable version of the game that was actually built and evaluated.
