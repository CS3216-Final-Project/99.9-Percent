# Phase 1 — Shared Simulation and First Database Incident

> **Project:** 99.99% — System Design Tycoon
> **Original target:** 5–8 October 2026 (historical planning target, not a completion claim)
> **Primary learning outcomes:** LO1 Diagnose bottlenecks; introductory LO4 Weigh design trade-offs
> **Status:** Authoritative implementation contract; implementation and validation outstanding
> **Scenario:** `opening-db`, version `1`

---

# 1. Authority, goal, and scope

This document, `docs/phases/PHASE_1_SIMULATION_FINAL.md`, is the single authoritative implementation contract for Phase 1. Use `docs/PROJECT_PROPOSAL.md` and `docs/DEVELOPMENT_ROADMAP.md` for broader context; this contract resolves Phase 1 technical details and supersedes earlier Phase 1 drafts and conversational suggestions. Later user-approved revisions take precedence.

Build and test the engine headlessly first, then minimally connect it to the existing game interface:

```text
Healthy company → traffic growth → database overload → inspection
→ player response → measured recovery → causal postmortem
→ the same company continues
```

This is the opening of one continuous campaign, not a standalone lesson mode. The existing visual theme, furnished office, renderer, icons, and camera controls remain. Do not implement later curriculum, full milestones, cloud saves, accounts, or a renderer redesign.

Phase 1 introduces one authoritative physical model, one action schedule, and periodic financial settlement. Both management and incidents use that model from this phase onward, including after recovery.

# 2. Player experience and learning intent

Start paused with one healthy application instance and one healthy database. Metrics are visible immediately. The player can inspect evidence, advance time, and make a small number of meaningful choices.

The configured traffic event increases demand without prescribing a response. Application capacity remains sufficient while database demand exceeds capacity. Players see demand, capacity, saturation, backlog, latency, and errors.

The opening exposes three intervention options plus free inspection:

- Add one application instance.
- Upgrade the database once.
- Enable or remove a traffic limit.
- Inspect the system repeatedly without changing its physical state.

Do not require the player to inspect before acting, prohibit an ineffective investment, or label an action “correct.” Resource and availability constraints are legitimate; strategic suitability is not a reason to disable an action.

**LO1:** Infer the constrained dependency from evidence.
**Introductory LO4:** Compare an ineffective investment, a delayed capacity investment, and immediate admission relief that sacrifices demand.

The 10–15-minute polished first-run target belongs to Phase 2. Do not add forced waiting to reach that duration in Phase 1.

# 3. Approved opening configuration

Create `frontend/src/sim/scenarios/openingDatabaseIncident.ts`. The following values define scenario `opening-db` version `1`; they are implementation values, not optional suggestions.

| Parameter | Value |
|---|---:|
| Initial completed physical step | 0 |
| Physical step duration | 1 modeled second |
| Financial period | 60 physical steps |
| Normal presentation speed | 1 physical step per real second while running |
| Starting incoming traffic | 300 requests/s |
| Growth event activation | Beginning of physical step 4 |
| Incoming traffic after growth | 800 requests/s, persistent |
| Primary application capacity | 1,000 requests/s |
| Each added application capacity | 1,000 requests/s |
| Application backlog limit | 1,000 requests per instance |
| Initial database capacity | 600 operations/s |
| Database backlog limit | 600 operations |
| Initial component backlogs | 0 |
| Base latency | 100 ms |
| Starting cash | $20,000 |
| Starting users | 2,000 |
| Engineers | 4, fixed |
| Add-application setup cost | $1,000 |
| Add-application activation delay | 2 steps |
| Maximum installed application instances | 2 |
| Database-upgrade setup cost | $3,000 |
| Database-upgrade activation delay | 3 steps |
| Upgraded database capacity | 1,000 operations/s |
| Admission limit when enabled | 500 requests/s |
| Admission change activation delay | 1 step |
| Application upkeep | $700 per active installed instance per operating week |
| Starter database upkeep | $500 per operating week |
| Upgraded database upkeep | $1,500 per operating week |
| Engineer salary | $1,600 per engineer per operating week |
| Revenue per successful request | $0.20 |
| Overload opening streak | 3 steps |
| Recovery latency threshold | Strictly below 500 ms |
| Recovery service-error threshold | Strictly below 1% |
| Recovery streak | 5 qualifying steps |

The growth event represents increased activity among the existing users. Users remain 2,000 in this slice: no automatic user growth/churn, milestone cash, or research-point awards. Record opening recovery for Phase 2, without granting later progression.

All traffic goes to the original application instance. An added instance becomes active installed capacity but remains unrouted; it generates upkeep but no request processing. Do not invent hidden load balancing.

One application-processed request creates exactly one database operation. No cache, retries, write amplification, or per-request object model is needed.

Scenario-specific values include traffic, event timing, capacities, backlog limits, starting resources, prices, salaries, delays, revenue rate, and permitted actions. Shared engine rules include processing order, accounting invariants, action/settlement idempotency, serialization, and recovery policy. Keep the old `BALANCE` constants unchanged for legacy compatibility; the replacement path resolves this versioned configuration explicitly.

Changing scenario values later requires a new scenario version. Saved campaigns retain their referenced configuration version; do not silently retune a resumed run.

# 4. Simulation clock and action timing

## 4.1 Physical, financial, and presentation time

One physical step represents one modeled second of request processing. Sixty physical steps represent a compressed operating week for financial accounting. This is a game abstraction, not literal real-world elapsed time.

For duration Δt:

```text
new demand count = demand rate per second × Δt
processing budget = capacity rate per second × Δt
```

Phase 1 fixes Δt to 1. Rates and counts must still have distinct field names/units.

Management’s manual “Advance step” executes one step. Automatic play advances one physical step per real second at normal speed. Incidents request the same steps at the same rate. Presentation speed changes only how frequently steps are requested; it never scales arithmetic, costs, or action delays.

The financial week index is `floor(completedStep / 60) + 1`. Completed-period count advances at steps 60, 120, and so on. Replace the opening’s “Next week”/26-week deadline presentation with accurate step and operating-week labels.

## 4.2 Pause and batch boundaries

- Start paused.
- Automatically pause when the first incident opens.
- Every transition to postmortem review or ended state stops advancement.
- Subsequent incidents do not require the first-incident automatic pause.
- User pause, review, and hidden-page pause advance no physical time, backlog, accounting exposure, or scheduled actions.
- An explicit manual advance is permitted while paused in management; it advances exactly one step.
- Opening the pause menu pauses the simulation; inspection panels do not independently pause it.
- Auto-pause on page hiding; returning does not automatically resume.
- No offline/background catch-up.
- Reset clears timing remainder; pause/resume retains it.

Keep a fractional presentation-time accumulator outside the physical engine and save its remainder in the runtime envelope. Use fixed integer timing units compatible with supported speeds. Browser animation frames never supply authoritative simulation arithmetic.

The batch advancement interface returns the new state, steps consumed, and any stop reason. It stops at the first mandatory pause/review/end boundary and does not consume subsequent whole-step requests. Discard unconsumed whole-step presentation credit at an automatic stop; retain only the fractional remainder so resuming cannot jump ahead.

Single-step and batched execution must match under the same boundary policy. A headless caller must explicitly resume past a stop, just as a player does. The first-incident-pause-consumed flag is persisted.

## 4.3 Action scheduling

An action accepted after completed step n with delay d activates at the beginning of step n + d, before traffic processing.

Examples when requested after step 6:

- Add application: activates at step 8.
- Database upgrade: activates at step 9.
- Admission change: activates at step 7.

Action requests do not advance time. Upfront costs are deducted on acceptance, never again on activation. Activated actions are removed from the pending schedule and recorded exactly once.

Permit one infrastructure deployment at a time. The four existing engineers are the fixed deployment team; staffing controls and legacy engineer-week task progression are inactive. Inspection and admission changes remain available during deployment.

Reject duplicate/completed infrastructure purchases and requests beyond the two-instance limit. Reject a second admission-change request while one is pending. A request for the already-active admission setting is a no-op rejection. No infrastructure cancellation/refund is introduced in Phase 1.

# 5. Physical processing and request accounting

## 5.1 Definitions

| Term | Meaning |
|---|---|
| Incoming | External requests arriving this step |
| Admitted | Incoming requests allowed into the application |
| Rejected | Incoming requests deliberately refused by admission control |
| Application processed | Work leaving application processing and entering database demand |
| Database processed | Work completing its required database operation |
| Queued/backlogged | Unfinished requests retained in a component |
| Failed | Requests discarded because a component backlog overflows |
| Successful | Database-processed requests, counted once when completed |

A request waiting at the database has already completed the application stage. Never process it through the application again. Failed application requests never reach the database. There are no automatic retries.

## 5.2 Bounded backlog

For a component, D is new demand count, C is its per-step processing budget, B is previous backlog, and L is backlog capacity:

```text
processed = min(B + D, C)
unfinished = B + D - processed
overflowFailures = max(0, unfinished - L)
newBacklog = min(unfinished, L)
```

The internal backlog is not a queue technology the player can purchase.

Required per-step conservation:

```text
incoming = admitted + rejected

previous total application/database backlog + admitted
= successful + failed + new total application/database backlog
```

Application-processed work is an intermediate quantity, not additional successful traffic.

## 5.3 Metrics

Use the completed step’s authoritative snapshot everywhere.

- Offered demand/capacity may exceed 100%.
- Busy utilisation is processed work divided by processing budget and cannot exceed 100%.
- Backlog-draining work contributes to busy utilisation.
- Report component demand, capacity, processed count, backlog, and failures separately.
- At 800 operations/s demand against a 600 operations/s database, show 133.3% demand/capacity and 100% busy utilisation.

Service error rate is:

```text
failed / (successful + failed)
```

If the denominator is zero, store a JSON-safe null and display “No completed requests.” Such a step cannot qualify for recovery. Deliberate rejections are excluded and displayed independently.

This terminal-outcome denominator replaces the earlier conversational admitted-request denominator for this implementation. It avoids attributing previously queued outcomes to an unrelated current arrival count.

## 5.4 Latency

Use end-of-step backlogs and rate capacities:

```text
latencyMs = 100 + 1000 × (
  routedPrimaryApplicationBacklog / routedPrimaryApplicationCapacityPerSecond
  + databaseBacklog / databaseCapacityPerSecond
)
```

The original routed instance has capacity 1,000 requests/s. An idle added instance must not lower latency through a larger denominator.

This is an explainable gameplay estimate, not a production percentile. Use unrounded values for thresholds; rounding is presentation-only. Scenario validation requires positive routed/database capacities. Do not emit Infinity or NaN into saves.

# 6. Economy and periodic settlement

## 6.1 Upfront spending

Deduct accepted purchase/setup costs immediately and record them as investment expenditure. Reject a purchase if it would leave cash at or below zero. Invalid actions do not mutate state.

Inspection and enabling/removing the admission limit are free.

## 6.2 Period ledger

Each physical step accumulates:

- successful completed requests;
- active installed application-instance exposure;
- database-tier exposure;
- engineer exposure;
- rejected and failed requests for reporting.

These are accounting inputs, not per-step cash deductions or repeated weekly charges.

At each completed 60-step boundary:

```text
revenue = period successful requests × $0.20

application upkeep =
sum(instance weekly price × active steps / 60)

database upkeep =
sum(tier weekly price × steps at that tier / 60)

salaries =
sum(engineer count × weekly salary × steps / 60)
```

The configuration active at the beginning of a physical step determines that step’s cost exposure. An upgrade activating on step 60 is charged one step of upgraded-tier exposure in that period. Installed but unrouted application instances incur upkeep.

Apply one net cash settlement, then clear that period’s inputs while retaining cumulative totals and fractional cost remainders. Persist the last-settled period index. A repeated settlement request, resumed save, postmortem acknowledgement, or phase transition must not settle it twice.

Use integer cents. Accumulate recurring-cost numerators in cents-times-steps; at settlement divide by 60, charge whole cents, and carry the nonnegative remainder to the next period for each cost category. Revenue is exactly 20 cents per successful request.

## 6.3 Revenue and damage

Queued requests earn no revenue until database completion. Successful requests earn revenue once in the period they finish, even if admitted earlier.

Failures and deliberate rejections earn nothing. Show rejected-demand opportunity value as rejected count × $0.20, explicitly a comparison rather than an extra cash deduction.

Do not run old incident refunds, severity-based cash damage, synthetic sustained-error deductions, or separate failed-request fines. No automatic satisfaction/churn/debt effects are introduced in this slice; existing values may remain stored but do not drive opening outcomes.

Do not settle an incomplete period on recovery, save, pause, or reset. Display pending period finances separately from cash.

## 6.4 Bankruptcy and campaign bounds

After settlement, cash <= 0 ends the run as bankrupt. Bankruptcy takes precedence over recovery on the same step. Final metrics and trace remain available; do not generate a successful-recovery report for that step.

Disable the legacy 26-week deadline and 50,000-user victory checks for the replacement opening. Phase 1 can continue operating on the same engine after recovery until bankruptcy or explicit reset. Full campaign growth, final victory, and milestone rewards belong to later phases.

# 7. Exact step and incident lifecycle

## 7.1 Step order

For the next integer physical step:

1. Activate scheduled actions due at its beginning; record effects.
2. Apply configured scenario events due now; mark event IDs consumed.
3. Determine incoming, admitted, and rejected traffic.
4. Route admitted traffic to the original application instance.
5. Process application work, backlog, and overflow.
6. Generate database demand from application completions.
7. Process database work, backlog, and overflow.
8. Derive the authoritative metrics snapshot.
9. Accumulate period accounting inputs.
10. Settle finances if a 60-step boundary was reached.
11. Evaluate bankruptcy.
12. If solvent, update incident-opening/recovery counters and determine transitions.
13. Record the completed snapshot and lifecycle/financial trace events.
14. Enter paused review if recovery completed; return any mandatory stop boundary.

Actions never activate retroactively. No alternate formula runs when the UI changes phase.

## 7.2 Opening event and overload

The step-4 event runs once and leaves incoming traffic at 800 requests/s. Before any intervention:

```text
Steps 1–3: database backlog 0; latency 100 ms; service errors 0%
Step 4: database backlog 200
Step 5: database backlog 400
Step 6: database backlog 600; incident opens
Step 7 onward without intervention:
  database backlog remains 600
  600 successes + 200 overflow failures per step
  service errors 25%
```

Increment the database overload counter when new database demand exceeds effective database processing capacity. Reset it on a non-overloaded step. Open after three consecutive overloaded steps, not merely because the configured event fired.

Record the affected database internally. Before recovery, the player-facing incident title and prompts show symptoms/evidence rather than explicitly supplying a root-cause answer or recommended purchase.

Only one incident is active. Do not reopen an existing incident every step. Clear the opening streak on recovery; subsequent overload after limit removal may open a new incident.

## 7.3 Recovery

An active incident qualifies for a stable step only when all are true:

- latency is strictly below 500 ms;
- service error rate is non-null and strictly below 1%;
- admitted traffic is positive;
- successful + failed outcomes are positive.

Any failed condition resets stableRecoveryCounter to zero. Five consecutive qualifying steps recover the incident. Actions and activations never set “resolved” or “mitigated” directly.

There is no forced timeout, forced capacity purchase, automatic repair, or customer-abandonment settlement. Persistent unhealthy demand remains an incident while the company is solvent. A future temporary workload may subside and recover through the same measured rules; “waiting never resolves anything” is not a universal engine rule.

At database backlog 600, activating the 1,000 ops/s database yields backlog 400 and latency exactly 500 ms on the first upgraded step: it does not qualify. The next step yields backlog 200 and latency 300 ms and can begin the recovery streak.

## 7.4 Review and same-company continuation

On recovery, create exactly one causal postmortem and pause review. Preserve:

- same run/company ID and seed;
- scenario ID/version and completed physical step;
- cash, period ledger, cost remainders, and settled-period index;
- architecture and backlog;
- active traffic limit;
- pending upgrades and admission changes;
- consumed opening event IDs;
- action/history/trace and progression state;
- same authoritative engine.

Record openingRecovered only once for future progression; do not award research or investment money yet.

Acknowledging review returns to paused management without initializing a new scenario or invoking legacy weekly settlement. Pending actions resume their countdown only as further physical steps run. Postmortem acknowledgement itself causes no financial change.

## 7.5 Traffic-limit removal

Use one admission-control toggle:

- “Limit to 500 requests/s”
- “Remove traffic limit”

Both changes activate at the next physical step and have no setup cost. Keep the limit after recovery until explicitly removed. Rejected requests and their foregone revenue remain visible.

Removing the limit restores admission of the full incoming demand; it does not change traffic, database capacity, or backlog. If capacity remains insufficient, three overloaded steps open another incident. This is the necessary inverse of the existing action, not a new curriculum system.

# 8. Trace and causal postmortem

Record structured, serializable events with deterministic sequence IDs and physical step numbers:

- scenario/version and initial configuration;
- growth event and consumption;
- component inspections with snapshot references;
- action request/rejection, paid cost, activation step, and activation effects;
- before/after demand, capacity, backlog, latency, failures, rejections, and throughput;
- incident opening and its three-step evidence;
- recovery streak start/reset/completion;
- period settlement and bankruptcy;
- review acknowledgement.

Wall-clock timestamps and generated run IDs come from the application boundary, not RNG or clock calls inside the engine. Determinism tests provide a fixed run ID.

Every completed step has one metric snapshot. Postmortems refer to the recorded interval, never the current scene’s independently recalculated metrics.

Explain effectiveness by changed state:
- Added application capacity with unchanged database demand/capacity did not relieve the database constraint.
- Increased database capacity enabled backlog drainage.
- Reduced admission enabled drainage by rejecting demand.
- An action requested but not yet activated did not contribute to recovery.
- If several actions contributed, describe them together rather than automatically crediting the last button.

Distinguish full-demand recovery from recovery under an ongoing limit. Include setup spending, capacity/demand changes, delay, backlog trend, recovery evidence, and one context-dependent prevention option.

Retain a bounded recent-step chart window (600 snapshots). Keep full snapshots for the active incident and freeze that incident’s evidence into its postmortem. Outside incidents retain structured event history and period summaries. Do not truncate an unresolved incident’s evidence silently; storage-write failures must be reported while allowing in-memory play.

# 9. Persistence and legacy preservation

Use replacement namespaces:

```text
nn.campaign.save.v1
nn.campaign.meta.v1
nn.campaign.analytics.v1
```

Preserve all existing legacy keys, including:

```text
nn.save.v1
nn.meta.v1
nn.analytics.v1
```

The existing loader removes incompatible legacy saves. Do not call it during replacement boot and do not merely bump its version.

The new envelope contains schemaVersion (initially 1), scenario ID/version, run/company ID, campaign state, runtime fractional timing remainder, and savedAt. savedAt is application metadata, not deterministic game state.

Requirements:
- Validate finite numeric values, counters, backlog limits, action schedule, identity/version, and required nested state.
- Return distinct missing, valid, corrupt, and unsupported-version results.
- Never automatically delete corrupt or unsupported new saves.
- Prevent boot autosave from overwriting an unreadable payload.
- Offer raw export before an explicit reset; only explicit reset authorizes replacing the new active slot.
- Legacy export does not require keeping the legacy campaign playable.
- New reset/clear/analytics operations affect only new namespaces.
- Resume saved incidents paused.
- Retain old onboarding metadata untouched; track new onboarding separately.
- Do not relabel old runs/ratings as new-campaign results.
- Preserve data on storage failure; report failure and keep play functional in memory.

Future migrations must copy and back up the original payload under a versioned backup key, apply a registered migration chain, validate the result, and only then replace the active save. If backup or validation fails, do not overwrite. Unknown future versions are not downgraded. Automatic conversion of prototype saves is outside Phase 1.

Update loadGame, saveGame, clearSave, validation, loadMeta/saveMeta, readAnalytics/track/clearAnalytics, plus store boot/newRun/saveNow and reset/tutorial handling. Same seed + same provided identity + same action sequence and physical-step sequence must reproduce the same gameplay state after serialization.

# 10. Integration boundary and exact file plan

## 10.1 Existing abstractions

Reuse immutable state transitions, ActionResult validation, seeded RNG helpers, stable IDs, the management/incident/review phases, Zustand commit handling, inspectors, charts, and report components.

Retain the existing public entry points where practical:
- newGame initializes the replacement campaign.
- applyAction validates and schedules allowed actions.
- advanceTurn becomes a compatibility adapter for one management physical step.
- incidentTick becomes a timing adapter into the same physical step engine.
- acknowledgeReview changes phase without settlement.
- metrics/equipmentInfo/currentWarnings project the authoritative snapshot.

Old aggregate capacity/utilisation and latencyFor calculations must not control the replacement path. Old progressTasks, finishTurn, completeRecovery, finishAttempt success flags, reassessLoad instant success, tickIncident/failIncident timeout, and accrue damage calculations are not authoritative for this path.

A temporary development-only legacy entry point may support comparison tests. Select campaign implementation at initialization, never by management-versus-incident phase. Do not build permanent parallel lesson modes.

## 10.2 Existing production files to modify

| File | Phase 1 responsibility |
|---|---|
| frontend/src/sim/types.ts | Clock, snapshots, backlogs, ledger, schedule, trace, identity and version types |
| frontend/src/sim/state.ts | Replacement initialization and reusable helpers |
| frontend/src/sim/actions.ts | Allowed-action validation, scheduling, inspection and upfront spending |
| frontend/src/sim/derive.ts | Authoritative snapshot projection and symptom alerts |
| frontend/src/sim/turn.ts | Step adapters; disconnect old weekly physical/settlement rules |
| frontend/src/sim/incidents.ts | Counter-based lifecycle and opening response descriptions |
| frontend/src/sim/postmortem.ts | Recorded-state causal explanations |
| frontend/src/sim/report.ts | Bankruptcy/report compatibility without premature victory |
| frontend/src/sim/index.ts | Public replacement-engine interfaces |
| frontend/src/game/store.ts | Timing, mandatory stops, identity injection, reset/resume and inspection |
| frontend/src/game/persist.ts | Namespaces, non-destructive loading, export and metadata |
| frontend/src/game/advisor.ts | Evidence-first opening prompts |
| frontend/src/components/Game.tsx | Step controls, operating-week display and hidden later views |
| frontend/src/components/Tutorial.tsx | Minimal navigation and observation guidance |
| frontend/src/components/SidePanel.tsx | Component metrics, actions and admission toggle |
| frontend/src/components/IncidentPanel.tsx | Scheduled activation and measured stability |
| frontend/src/components/Views.tsx | Step history and postmortem evidence |
| frontend/src/components/Modals.tsx | Opening objective, save/reset/export messaging |
| frontend/src/components/scene/Facility.tsx | Snapshot-based status and installed/routed distinctions |
| frontend/src/index.css | Minimal new display styles only |

## 10.3 Exact new modules

| File | Responsibility |
|---|---|
| frontend/src/sim/step.ts | Pure physical transition and guarded batch advancement |
| frontend/src/sim/settlement.ts | Period ledger and exactly-once cash settlement |
| frontend/src/sim/scenarios/openingDatabaseIncident.ts | Approved scenario configuration and event |
| frontend/src/sim/trace.ts | Structured trace and evidence helpers |
| frontend/src/game/saveMigrations.ts | Envelope validation, version dispatch and preservation boundary |
| frontend/src/sim/__tests__/step.test.ts | Arithmetic, units, routing and conservation |
| frontend/src/sim/__tests__/settlement.test.ts | Period boundaries, proration and financial idempotency |
| frontend/src/sim/__tests__/openingDatabaseIncident.test.ts | Full opening paths, recovery, continuity and postmortems |
| frontend/src/game/saveMigrations.test.ts | Non-destructive validation and migration behaviour |

Update existing sim tests/bots, frontend/src/game/store.test.ts, frontend/src/game/persist.test.ts, frontend/src/App.test.tsx, and relevant frontend/e2e journeys. Legacy test passes are not evidence that the replacement campaign works.

## 10.4 Minimum UI work

- Immediate, free, repeatable inspection with no mandatory investigation timer.
- Traffic/admission/rejections, component demand/capacity, backlog, latency, service errors.
- Busy utilisation separate from demand/capacity.
- Installed application capacity separate from routed capacity.
- “Stable steps: n/5” instead of an incident timeout.
- Activation countdowns in physical steps.
- Cash separate from unsettled financial-period totals.
- Only opening actions exposed and accepted by the engine.
- Evidence prompts rather than “Upgrade database” or “Pick the matching fix.”
- Charts, labels, scene indicators and inspector consume one snapshot.
- Review shows causal evidence and remaining restrictions.

No renderer, office, theme, icon-system, or camera redesign. Follow [the shared UI design guide](../UI_DESIGN.md): retain the existing HUD, incident banner, investigation controls and response rows while displaying the new physical-step metrics and recovery rules.

# 11. Automated acceptance and Definition of Done

Every unchecked requirement below is implementation work, not a claim of completion.

## 11.1 Physics and timing

- [ ] Healthy steps have zero backlog/errors, 300 successful requests, and 100 ms latency.
- [ ] Growth occurs once at step 4; without intervention backlog is 200/400/600 on steps 4/5/6.
- [ ] Under/equal/over-capacity arithmetic, overflow and drainage are exact.
- [ ] Both conservation identities hold each step and cumulatively.
- [ ] Application processing never creates duplicate successful requests.
- [ ] Idle installed capacity does not lower latency or database demand.
- [ ] Management and incidents use identical physical calculations.
- [ ] Batch and single-step results agree under identical mandatory-stop policy.
- [ ] Speed/pause/hidden-page/save-resume do not change physical results.
- [ ] No NaN/Infinity enters snapshots or saves.

## 11.2 Actions and incidents

- [ ] Inspection records evidence without changing physical/economic state.
- [ ] Purchase validation is immutable on failure and charges once on acceptance.
- [ ] Actions activate exactly at the scheduled boundary and only once.
- [ ] Add application cannot increase database capacity or solve this bottleneck.
- [ ] Database capacity changes only at activation; backlog drains over subsequent steps.
- [ ] Incident opens after exactly three overloaded steps; a healthy step resets the opening streak.
- [ ] Activation cannot directly resolve an incident.
- [ ] Recovery needs five qualifying steps and resets on any failure.
- [ ] 499 ms and 0.99% can qualify; 500 ms and 1% cannot.
- [ ] Zero admissions or zero completed outcomes cannot qualify.
- [ ] Solvent persistent overload remains active beyond 120 steps; no timeout resolves it.
- [ ] Bankruptcy takes precedence over same-step recovery.
- [ ] Later-phase actions are rejected even if dispatched outside visible controls.

## 11.3 Settlement and request revenue

- [ ] No recurring cash settlement before step 60.
- [ ] Steps 60/120 settle their own periods exactly once.
- [ ] Pausing, inspection, review acknowledgement and reload do not settle money.
- [ ] Mid-period activation correctly prorates active infrastructure exposure.
- [ ] Idle added instances cost upkeep.
- [ ] Integer-cent rounding remainders survive serialization and later settlements.
- [ ] Only database-completed successes earn revenue; queued work cannot earn twice.
- [ ] Backlog completed in a later period earns in that period only.
- [ ] Rejected-demand opportunity value is reported, not deducted a second time.
- [ ] Legacy refund/severity/sustained-error charges never run.
- [ ] Save immediately before/after settlement produces the same continuation as uninterrupted play.

## 11.4 Continuation and persistence

- [ ] Review preserves identity, physical step, cash, ledger, architecture, limit, pending actions and trace.
- [ ] Acknowledgement returns to paused management on the same engine.
- [ ] Opening event cannot replay; openingRecovered is recorded once.
- [ ] Limit remains active after recovery; removing it activates next step.
- [ ] Removing a limit with insufficient capacity can open another measured incident.
- [ ] Pending upgrades remain scheduled after earlier recovery.
- [ ] All legacy save/meta/analytics keys remain byte-for-byte unchanged through boot/save/reset.
- [ ] Corrupt/unsupported new saves are neither deleted nor overwritten by boot.
- [ ] Explicit export/reset and storage-unavailable cases behave correctly.
- [ ] New onboarding is independent of preserved prototype metadata.
- [ ] Same supplied identity, seed, actions and steps reproduce the same state.
- [ ] Save/resume preserves backlog, counters, financial remainders, timing remainder and activation schedule.

## 11.5 Full acceptance paths and postmortems

- [ ] Path A: healthy → overload → inspect → DB upgrade → activation → drainage → five stable steps → review → same company continues.
- [ ] Path B: healthy → overload → inspect → limit → rejected demand → drainage → measured recovery → limit retained.
- [ ] Path C: healthy → overload → add app → database remains constrained → inspect again → DB upgrade → measured recovery.
- [ ] Explain ineffective and contributing actions using trace values, not button identity.
- [ ] Combined interventions share causal credit where supported.
- [ ] An unactivated pending action receives no recovery credit.
- [ ] Postmortems preserve initiating event, action times, cost, metrics and trade-offs.
- [ ] Required paths also work through visible UI controls.

## 11.6 Engineering validation

Before implementation record the existing frontend lint, typecheck, unit tests, balance tests, production build, and browser-test results. Preserve a reproducible baseline and distinguish pre-existing failures.

After implementation run relevant focused tests, frontend lint/typecheck/unit tests, replacement balance coverage, production build, and browser journeys according to AGENTS.md and docs/testing.md. For a PR, also run the repository-required coverage/checks for both packages.

- [ ] Required new tests pass.
- [ ] No new lint/type/build regression.
- [ ] Pre-existing/unavailable checks are documented separately.
- [ ] UI has no duplicate authoritative simulation formulas.
- [ ] Browser StrictMode does not duplicate clocks, action activations, or settlement.
- [ ] Unmount and pause clean up timers.
- [ ] No production backend/schema/deployment changes were introduced.

Do not claim full Phase 1 completion while required checks or acceptance paths remain unverified.

# 12. Human validation, dependencies, and risks

Phase 0 must establish baseline checks, campaign-state and UI-snapshot contracts, module boundaries, and representative fixtures before UI integration.

Use 2–3 internal/friendly testers, then a small fresh-user sample once UI wiring exists. Ask “What is causing the problem?” and “What evidence are you using?” Do not reveal the database answer first.

Observe whether players explain why app addition did not change database demand/capacity, how upgrade activation led to drainage, and what admission limiting sacrificed. Record findings; this is not the formal evaluation cohort.

Main risks:
- Weekly logic competing with steps: adapters cannot call the old physics or finishTurn.
- Duplicate money: separate setup charges, ledger accumulation and period settlement.
- Save destruction: new namespaces and non-destructive validation before switching boot.
- UI disagreement: snapshot-only metrics and scenario-aware forecasts.
- Old tests enforcing obsolete behaviour: retain isolated comparison coverage and add replacement assertions.
- Unbounded unresolved-incident traces: never silently lose evidence; surface storage failures.
- Scope expansion: preserve later code without making it active in this opening.

Existing nine-node tree/cache/reliability code remains in the repository for later phases but is inaccessible and inactive during the opening. This includes hidden effects in forecasts, upkeep, routing, failures and reports—not only hidden buttons.

# 13. Required implementation sequence

Follow this order:

```text
baseline/contracts → engine → accounting → scheduling → incidents → trace
→ persistence/store → UI → validation
```

1. Read repository guidance, this contract, proposal and roadmap; inspect actual code.
2. Run baseline checks and record pre-existing failures.
3. Confirm types, versioned configuration and snapshot contract.
4. Implement pure processing/backlog/latency and exact conservation tests.
5. Implement period accounting, settlement, rounding and idempotency tests.
6. Implement allowed actions, upfront validation and common activation schedule.
7. Implement one-time traffic event, overload/recovery counters and stop boundaries.
8. Disconnect action-declared recovery and timeout from the replacement path.
9. Implement structured trace, causal postmortems and headless acceptance paths.
10. Implement safe persistence namespaces and validation before switching application boot.
11. Connect store timing, fixed-step adapters and paused save/resume.
12. Connect existing UI/scene to snapshots and restrict opening actions.
13. Replace prescriptive guidance and obsolete time/campaign labels.
14. Verify same-company continuation, limit removal and pending-upgrade preservation.
15. Run required automated checks and visible-control acceptance paths.
16. Conduct small human validation when participants are available.
17. Report files, results, deviations, outstanding checks and Definition of Done.
18. Stop for review before Phase 2.

# 14. Implementation handoff prompt

```text
Read:
- AGENTS.md
- docs/phases/PHASE_1_SIMULATION_FINAL.md
- docs/PROJECT_PROPOSAL.md
- docs/DEVELOPMENT_ROADMAP.md
- docs/testing.md

Treat docs/phases/PHASE_1_SIMULATION_FINAL.md as the single authoritative
Phase 1 implementation contract. Inspect frontend/src and reconcile actual
functions with the contract before editing.

Before changing production code, report:
1. exact files/functions affected;
2. conflicting current behaviour and reusable abstractions;
3. baseline check results;
4. any concrete specification conflict and smallest compatible adjustment;
5. implementation order.

Implement Phase 1 only, in this order:
engine → accounting → scheduling → incidents → trace →
persistence/store → UI.

Preserve the existing visual theme/renderer and all legacy browser data.
Keep later-phase code inactive in the opening. Do not implement caching,
reliability, full progression, cloud accounts/saves, or backend changes.

After implementation:
- run required tests, lint, typecheck, build and browser checks;
- report changed files and passed/failed/unavailable validation;
- report deviations and remaining issues;
- state which Definition of Done items are verified;
- do not claim completion for unverified items;
- stop for review before Phase 2.
```

# 15. Phase 1 outcome

The deliverable is one trustworthy opening campaign path with deterministic demand, measured recovery, periodic finances, preserved saves, and causal explanations. The same company continues on the same engine.

Phase 2 polishes this foundation into the 10–15-minute first playable campaign opening; this contract does not authorize later-phase implementation.
