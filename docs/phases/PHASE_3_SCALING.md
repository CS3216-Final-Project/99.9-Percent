# Phase 3 — Application Scaling and Routing

> **Project:** 99.99% — System Design Tycoon
> **Target:** 12–16 October 2026
> **Learning outcomes:** LO1 Diagnose bottlenecks; LO2 Choose scaling strategies; LO4 Weigh trade-offs
> **Status:** Authoritative implementation contract; implementation and validation outstanding
> **Foundation:** Accepted playable Phase 1/2 company, opening-db v1
> **Continuation:** application-scaling v1, on the same engine

# 1. Authority and reuse

Read with:
- docs/PROJECT_PROPOSAL.md
- docs/DEVELOPMENT_ROADMAP.md
- docs/phases/PHASE_1_SIMULATION_FINAL.md
- docs/phases/PHASE_1_IMPLEMENTATION_REPORT.md
- docs/phases/PHASE_2_PR1.md
- docs/phases/PHASE_2_IMPLEMENTATION_REPORT.md
- docs/AUTHENTICATION.md
- AGENTS.md and docs/testing.md

Proposal/roadmap establish product scope; accepted Phase 1/2 contracts continue governing the opening. This contract governs the approved Phase 3 extension and replaces earlier illustrative starting values and speculative modules. Later user-approved revisions take precedence. Report concrete conflicts rather than silently retuning saves.

**Installed application capacity is not useful until traffic is actually routed to it.** App scaling never changes DB capacity.

Extend existing simulation, scheduler, CampaignUI, Game, Facility, selection, store, persistence, telemetry and reports. Preserve office/theme/icons/camera. No parallel engine, renderer, graph editor, architecture store, clock or save system. Legacy weekly physics, implicit balancing, task/release progression, timeout recovery and inactive panels stay inactive.

This document update does not authorize production implementation, committing, deployment, production database migration or participant contact.

# 2. Actual foundation

Checkpoint: 00ebc2b. Recorded Phase 2 results: Node 22; 129 frontend tests passing, one optional TRACE skip, five balance tests, nine browser tests, passing typecheck/build, 23 pre-existing lint warnings, 18 backend tests passing. Preserve reports and run a fresh implementation baseline.

| Existing foundation | Extension needed |
|---|---|
| Campaign.apps has ID/capacity/backlog/routed | Process all active instances; explicit routing and instance snapshots |
| Add Application activates second unrouted app | Reuse its action, cost, delay and installed state |
| Shared step/scheduler/60-step accounting | Targeted actions, tier/LB exposure; preserve idempotency |
| DB overload and measured recovery | Independent app/DB streaks and component-aware reports |
| CampaignUI inline strip; Game + Facility | Shared instance selection and routed evidence; no replacement view |
| Schema 2 backup-first persistence | Schema 3 and version-aware history/validation |
| Stable telemetry/session/archive/export | Exhaustive scaling/routing mappings |
| First milestone acknowledged once | Stage reveal/entry without resource reward |
| Express/Drizzle/Neon backend | Auth/cloud campaign groundwork is documentation only, not working endpoints |

# 3. Continuous company and growth configuration

Preserve run/company identity, seed, current app instances/capacities/backlogs, DB tier/backlog, limit, cash, ledger/remainders, pending actions, milestone, reports, trace IDs and telemetry continuity. Never reset to a 600-capacity application scenario. One/two apps, limit-only recovery, upgraded DB and pending purchases must all remain valid continuations.

Use a separately versioned `application-scaling` v1 configuration, preferably `frontend/src/sim/scenarios/applicationScaling.ts`. Keep the opening reference `opening-db` v1 unchanged; add a continuation reference, not a new company.

| Parameter | Value |
|---|---:|
| Persistent continuation traffic | 1,400 req/s |
| Base app capacity | Existing 1,000 req/s |
| Vertically upgraded app | 1,600 req/s |
| App backlog limit, either tier | 1,000 requests per instance |
| Maximum installed apps | 2 |
| Additional DB tier / readiness headroom | 2,000 ops/s |
| DB backlog limit | Existing 600 operations |
| Observation interval before growth | 3 physical steps after readiness |

Keep one-second steps, 60-step operating weeks, four engineers, 2,000 users and existing recovery thresholds. Growth represents activity, not a user/cash/research reward. The additional DB tier is solely headroom for this challenge, within the existing Larger Database family. No caching, request-mix strategy or extra technology node.

These are initial implementation values. Adjust only with concrete contradictory balance evidence and a reviewed explanation. Once referenced by saves, retuning requires another configuration version. Do not silently change opening-db v1.

## Stage entry and exact event boundary

New capabilities reveal after `openingMilestone.acknowledged`. On first explicit gameplay continuation with it acknowledged, record stage entry once, its configuration and entry step. During play, milestone acknowledgement may enter the stage. Boot/migration alone cannot enter, grow traffic or emit a measured stage event. Keep milestone continuation paused.

After due actions activate, check readiness during the event stage: continuation entered, milestone acknowledged, DB >=2,000, management with no active incident, zero app/DB backlog, growth unconsumed. First readiness at step n records due step n+3. At/after that boundary, fire on the first step readiness holds. Retain the due step if readiness is lost; wait rather than forcing an incident. A DB activation may establish readiness that same step.

Firing sets incoming traffic to 1,400 and records scheduled/actual steps, old/new traffic and a unique consumed event ID. The event never directly declares an incident. Show unmet DB prerequisite and any incident/backlog delay explicitly.

Require explicit paid DB purchases. Preserve existing limits: a 500 limit may prevent overload after external growth. Proactive scaling/routing may also prevent it. Record prevention honestly without fake recovery or reward.

Opening prevention still has no recovered-report milestone; Phase 3 stays locked until the real milestone is earned. This phase adds no alternative unlock or forced opening incident.

# 4. Instance model and routing

| Concept | Exact meaning |
|---|---|
| ID | Stable app-1/app-2 shared by routing, actions, selection and evidence |
| Capacity | Positive deployed-tier requests/s rate |
| Routed demand | New admitted request count assigned this step; separately expose its rate |
| Processed | Count leaving app processing, including backlog drainage |
| Backlog | Unfinished request count owned by that instance |
| Active | Installed and processing-capable; unrouted is not inactive |
| Deploying | Pending addition reserves ID; no installed capacity/upkeep until activation |
| Inactive | Cannot receive/process work; no Phase 3 failure/action creates this state |
| Installed capacity | Sum of active installed capacities, including unrouted; excludes deploying |
| Effective routed capacity | Sum of active configured target capacities, even at zero traffic |

Keep deploying placeholders derived from pending actions, not duplicate authoritative instances. Upgrading apps serve at old capacity until activation. No reliability/health-check/restart/failover behavior. Inactive states with unfinished work are not reachable Phase 3 states; reject unsupported imports rather than dropping work.

Reuse processWork for each active instance. Unrouted active apps receive zero new traffic but drain their own backlog. Never transfer, discard or reprocess backlog through another app. Distinguish rate/count fields despite one-second steps.

Persist LB deployment, routing policy and explicit target IDs. Any retained routed flag is derived compatibility state.

- Single: all admitted traffic goes to app-1.
- Balanced: divide over one/two explicitly configured active targets, ordered by stable instance number; requires deployed LB. One target is legal but adds no benefit.
- Validate nonempty, known, active, unique targets at request/activation; pending apps are not eligible.
- No weighting, least-connections, affinity or advanced policy.

```text
base = floor(D / N)
remainder = D % N
allocation[i] = base + (i < remainder ? 1 : 0)
900 -> 450 / 450
901 -> 451 / 450
```

Sort by stable instance number, never array ordering. Allocation is independent of capacity: excess becomes processing backlog/overflow, never routing loss.

New apps remain initially unrouted even when LB exists; explicitly change target membership. Deploying LB leaves existing single routing unchanged. A subsequent Change Routing action distributes traffic. Returning to single retains LB and its upkeep; no undeploy/refund action.

# 5. Step order, metrics and incidents

Reuse the existing step engine and adapters:
1. Activate due infrastructure/routing actions; record once.
2. Apply due events, including continuation readiness/scheduling/firing.
3. Calculate incoming/admitted/rejected traffic.
4. Allocate admitted traffic.
5. Process every active app independently.
6. Sum application-processed counts.
7. Use that sum as new DB demand.
8. Process DB with its existing backlog.
9. Derive authoritative metrics, latency and outcomes.
10. Accrue accounting and settlement.
11. Apply bankruptcy precedence, incidents/recovery and trace.

**DB demand = sum of application-processed requests**, not incoming traffic. A 600 req/s app produces at most 600 new DB operations per one-second step. Database backlog has already passed the app stage.

```text
incoming = admitted + rejected
sum(routed demand) = admitted
sum(app processed) = new DB demand
previous total app/DB backlog + admitted
= successful + app failures + DB failures + new total backlog
successful = DB processed
```

Snapshots add instance ID/tier/state, demand rate/count, capacity, processing budget/count, backlog, failures, demand/capacity and busy utilisation. Engine-derived aggregates retain readable tier totals. Mixed capacities can overload one instance despite sufficient aggregate capacity.

Busy utilisation per instance is processed/budget. An aggregate busy denominator includes active routing targets plus active apps with backlog at processing start. Unrouted draining work contributes its budget; empty idle capacity must not dilute opening utilisation. Store this denominator separately from effective routed capacity. No clamping invalid ratios; all values finite and busy <=100%.

Approved end-of-step latency:

```text
100 ms + 1000 * max(active app backlog / its capacity)
       + 1000 * (DB backlog / DB capacity)
```

Require at least one active app. This is a conservative gameplay approximation, not production latency or a percentile. Idle additions cannot lower it. Use unrounded thresholds; preserve historical snapshot interpretation.

Errors remain failed/(successful+failed), with null for no terminal outcomes; deliberate rejections are separate. Zero admissions/outcomes cannot qualify for recovery.

Maintain independent overload streaks for each app and DB: increment when its new demand exceeds capacity, otherwise reset. Backlog affects busy/latency, not new demand. Three consecutive overloaded steps on one component open one capacity incident. Alternating components never combine. Simultaneous triggers record all IDs and choose primary deterministically: app-number order, then DB. Keep changing constraints within one incident.

Recovery remains five consecutive qualifying steps, latency strictly <500 ms, errors strictly <1%, positive admissions/outcomes. Preserve bankruptcy precedence, first-pause-consumed flag and batch/pause rules. No action-declared recovery or new Phase 3 forced pause.

# 6. Actions and economics

| Action | Activation effect | Setup | Delay | Weekly upkeep |
|---|---|---:|---:|---:|
| Scale Up | Selected base app 1,000 -> 1,600 | $2,000 | 3 steps | $1,100 total for upgraded app |
| Add Application | New 1,000 app, unrouted | Existing $1,000 | Existing 2 | Existing $700/app |
| Deploy LB | Installed capability; route unchanged | $1,000 | 2 | $300 |
| Change Routing | Validated mode/targets | $0 | 1 | No extra |
| Existing DB upgrade | 600 -> 1,000 | Existing $3,000 | Existing 3 | Existing $1,500 total |
| Additional DB upgrade | 1,000 -> 2,000 | $3,000 | 3 | $2,500 total |
| Limit/removal | Existing 500 cap/full admission | $0 | 1 | No extra |

The additional DB price/delay/upkeep resolve previously unspecified economics. Tiers are sequential: a 600 DB first needs the existing paid upgrade. Reuse start_db_upgrade with next-tier stage validation. No automatic promotion or free overwrite.

Extend ScheduledAction with target and typed effect/configuration. Persist accepted cost/timing through reload. Request after step n activates at n+d. One vertical upgrade per instance, two installed apps maximum.

Retain one infrastructure deployment across app add/upgrade, DB upgrade and LB deployment. Four engineers remain the team. One routing change and one admission change may independently be pending. Routing requests require already deployed LB. Simultaneous due actions use stable acceptance order.

Reject duplicates, completed upgrades, invalid targets, no-op settings, conflicting pending requests and purchases leaving cash <=0. Charge once on acceptance, never activation. No cancellation/refund/scale-in. Valid ineffective choices and inspection remain available.

Sum active app tier exposure, including unrouted; pending apps incur none. Upgraded prices apply from activation. Add dedicated LB ledger/remainder/settlement fields. Preserve 60-step settlement, integer cents and rounding remainders; no settlement on stage/review/save/acknowledgement. Revenue only on DB success. Backlog drainage may transiently load DB; never script it healthy or change its capacity through app/routing actions.

# 7. Progression and postmortems

Keep nine technology identities: larger_servers = Scale Up; load_balancing = Scale Out + Load Balancing; DB tiers stay within larger_database. Separate capability availability, installed architecture and routing configuration. No extra node or full research/currency system.

New abilities follow acknowledged opening milestone. Preserve pre-milestone Add Application and earlier DB/admission behavior. Keep caching, cache tuning, autoscaling, health checks, standby/failover and reliability inaccessible, including hidden effects. Do not set legacy techDone flags merely to activate visuals.

Extend causalPostmortem rather than adding a generator. Record trigger components, event, allocation/capacity/backlog, routing before/after, request/activation times, costs and DB response. Replace unconditional DB-cause/ineffective-app assumptions for new incidents. Pending actions earn no credit; combined actions may share measured credit. Historical reports remain unchanged. No additional Phase 3 resource reward or milestone screen is required.

# 8. UI integration

Extend CampaignUI's existing inline strip, panel/history/reports; there is no standalone OpeningArchitecture to replace. Game retains composition/clock. Facility remains the only renderer.

Display App 1/App 2, demand/capacity, processed/backlogged work, busy/overload, installed versus routed capacity, routing mode/targets, LB deployment, countdowns, DB prerequisite and retained rejection trade-off. Label idle apps "Installed - not receiving traffic"; distinguish inactive/deploying. Pending placeholders cannot imply active capacity. Show request flow only along configured routes.

Extend existing selection with optional selectedAppId alongside equipment tier. Office rack and strip select the same instance and dispatcher; keep tier overview. Hover/focus/touch use the same snapshot. Users is workload context, not another component.

Reuse Facility buildModel, Rack, Cable, LB position, labels and appSlot; adapt instance LEDs and selection. Capability queries must distinguish available versus deployed LB. Preserve camera/office/theme/icons. Reuse modal/layout/tooltip/chart primitives, keyboard focus and mobile layout. No UI physics or graph editor. Never require inspection or mark a choice correct.

# 9. Persistence and schema 3

Extend persist.ts/saveMigrations.ts, retaining nn.campaign.save.v1, nn.campaign.meta.v1 and nn.campaign.analytics.v1. Preserve all legacy keys byte-for-byte. Schema version is separate from opening/continuation configuration versions.

Persist instance tier/state, LB deployment, policy/targets, targeted actions, continuation entry/due/consumed event, component streaks and added exposure/remainders. Preserve capacities/cash/backlog/milestone/reports/trace IDs/telemetry cursor.

- Validate source with original schema rules; migrate a copy; back up original bytes before replacement; validate result. Backup/validation/write failures preserve source/export.
- Support v1 -> v2 -> v3 with explicit dispatch. Freeze old migration behavior; current constructors/validators must not invalidate intermediate schemas.
- Existing apps become active base records unchanged; single route to app-1, LB absent. Pending additions retain schedule and reserve app-2 deterministically.
- Copy old overload streak to DB; app streaks zero because valid opening traffic cannot overload the primary. Preserve active DB incident evidence.
- New LB exposure/remainders start zero. Never recalculate historical cash/settlements.
- Migration never enters the stage, schedules growth, removes a limit or emits measured gameplay.
- Retain historical/current legacy snapshots under their original interpretation; new snapshots use a versioned per-instance format. Do not fabricate historical instance observations. Until a new step, display legacy metrics plus current architecture without invented measurements.
- Preserve trace sequence, pending telemetry and cursor. Unknown future/unsupported versions remain exportable and non-destructively rejected. Resume paused, no offline catch-up.

Replace opening-only hard-coded validation through version-aware checks for capacities/traffic/tiers/actions/targets/backlogs/latency and aggregate invariants. Do not merely loosen validation or replay history to manufacture observations.

# 10. Telemetry

Extend telemetry.ts projectEvents and the existing store/persist archive. Retain stable event IDs, run/session/build attribution, physical step, timestamp, active/wall time, pending durability and non-destructive export.

| Event | Trigger |
|---|---|
| vertical_scale_requested / vertical_scale_activated | Accepted target upgrade / actual capacity activation |
| app_instance_requested / app_instance_activated | Accepted purchase / installed activation |
| load_balancer_requested / load_balancer_deployed | Accepted LB purchase / actual deployment |
| routing_requested | Accepted configuration change |
| routing_enabled | First balanced-routing activation |
| routing_changed | Subsequent activated change, including return to single |
| scaling_stage_entered | First explicit gameplay continuation entry |
| Existing growth/incident/recovery | Actual engine evidence with component/continuation attribution |

Include action/target ID, request/activation step, cost, old/new capacity/configuration and continuation version as relevant. Specialized activation replaces overlapping generic emission; do not double-count. Replace unknown-action fallback-to-traffic-limit behavior with exhaustive typed mappings.

Preserve historical timing-unknown states and attribution; do not invent old sessions. Continuation is not replay; hidden pause is not quit; guidance is not a hint unless an actual optional hint is used. Retain unexported records and report storage failure without promising impossible durability.

# 11. Separate account/cloud workstream

Phase 2 supplied documentation only. Express currently has health/dialogue routes; mission players/sessions are not campaign accounts/app sessions. Existing lib/api.ts is health transport, not an auth adapter.

Keep auth/cloud separately reviewable and outside the scaling engine. Guest gameplay/local save/export remain independent of API/session availability. Working auth/owner-scoped cloud saves remain the roadmap's Phase 3 release requirement; report gameplay readiness separately from full completion.

Follow AUTHENTICATION.md: shared account/session/save DTOs; backend-managed Google sign-in; durable app sessions/restoration/revocation; explicit guest attachment; cancellation/expiry/local preservation; owner-filtered reads/writes; atomic expected-revision updates with retained conflict copies. Account switching must not reassign another owner's pending local run.

Add dedicated tables via additive reviewed migrations; retain legacy mission tables/migrations. Extend existing Express/Drizzle/Neon and frontend transport. Implement documented same-origin proxy/API-base changes with auth, retaining both Vercel projects and direct-API CORS. No mandatory login or provider/framework replacement.

Apply documented callback/state/nonce, HttpOnly session, CSRF/origin and private-cache rules. Test concurrent revision writes, two-owner isolation and local network-failure continuity. Verify real callback registrations, cookies/proxy and cross-session resume on a configured test deployment. External provider/deployment inputs do not block local scaling work. Production schema execution/deployment needs separate authorization.

# 12. Actual files and reuse

Frontend paths below are under frontend/src unless stated otherwise.

| Existing file/function | Treatment |
|---|---|
| sim/campaignTypes.ts; sim/types.ts | Extend instance/snapshot/incident/routing/action types |
| sim/step.ts processWork | Reuse bounded processing unchanged |
| step, campaignAction, initialCampaign, projectCampaign | Extend current engine/scheduler/projections |
| advanceSteps; sim/turn.ts adapters | Preserve single clock and stop/batch boundaries |
| sim/settlement.ts accruePeriod/settlePeriod | Extend tier/LB exposure; preserve settlement invariants |
| sim/trace.ts trace/causalPostmortem | Preserve IDs, extend measured explanation |
| sim/derive.ts campaign branches | Snapshot-based metrics/equipment/cost adapters only |
| sim/tech.ts has/status queries | Stage-aware availability/deployment; nine IDs retained |
| game/store.ts; inspectOrSelect | Extend selection/guards/lifecycle, no second store |
| game/persist.ts; saveMigrations.ts | Existing save/archive/export and schema 3 |
| game/telemetry.ts | Exhaustive mapping and continuation attribution |
| components/CampaignUI.tsx; Game.tsx | Existing panels/strip/overlays/history/composition |
| components/scene/Facility.tsx; layout.ts | Existing racks/cables/selection/projections |
| components/ui.tsx; index.css; game/advisor.ts | Reuse primitives/theme and neutral evidence guidance |
| frontend/src/lib/api.ts | Extend current account/save transport |
| backend/src/app.ts; db/schema.ts; db/client.ts | Extend route registration/additive schema; reuse client |

Conditional new production files:
- sim/scenarios/applicationScaling.ts: separate immutable continuation tuning avoids rewriting the opening configuration.
- sim/routing.ts: first implement a small pure helper in step.ts; extract only for justified reuse/test clarity.
- backend/src/routes/auth.ts: health/dialogue routes have no auth/session responsibility.
- backend/src/routes/runs.ts: no existing route authorizes/stores campaigns with revisions.
- shared/campaign.ts: existing health/dialogue/mission DTOs do not describe portable account/save contracts.

Do not create every candidate automatically. Justify any other extraction against existing equivalents. No new renderer, architecture store, persistence hierarchy or cloud-revision arithmetic subsystem. Legacy weekly/implicit-balancing/recovery code stays outside campaign authority; no unrelated cleanup.

# 13. Tests and acceptance paths

The 600-capacity examples are isolated parameterized engine fixtures, not production opening-db saves. Do not mutate production configuration or weaken save validation to create them.

| Test | Required outcome |
|---|---|
| A: one 600 app, 900 demand | Actual app overload/backlog |
| B: second installed, unrouted | 900/0; installed 1,200 does not relieve routed 600 constraint |
| C: balanced two 600 apps | Exactly 450/450 |
| D: odd 901 | Exactly 451/450, stable despite array reordering |
| E: vertical | Target alone changes at activation; charge once |
| F: DB independence | App/routing never alter DB capacity; DB demand equals app processing |
| G: resume | Instances/routes/backlogs/pending actions/streaks/money preserved |
| H: routing change | Backlog stays and drains on original instance |
| I: conservation | No loss/double count, including simultaneous overflow/drainage |
| J: aggregate headroom | Per-instance overload remains possible |
| K: independent streaks | App/DB cannot combine; simultaneous attribution deterministic |
| L: regressions | All Phase 1/2 paths remain valid |

Also test retained limits/prevention, existing second apps/pending upgrades, sequential DB purchases, growth readiness/scheduling/reload/one-time event, mixed capacities, invalid targets, zero traffic, no NaN/Infinity, LB deployment without routing, activation at step 60, bankruptcy precedence, pending/combined causal credit, schema chains/backup/write failure/legacy protection, telemetry retry/deduplication, and office/strip/panel keyboard/touch consistency.

Visible/headless continuation paths, after explicit DB headroom purchase:
1. 1,400 growth -> app overload -> targeted 1,600 upgrade -> drainage -> five qualifying steps -> report -> same company.
2. Growth -> second 1,000 app installed -> 1,400/0 remains constrained.
3. Deploy LB -> configure both apps -> 700/700 -> drainage -> measured recovery -> same company.
4. Controlled DB-constrained fixture -> app/routing actions leave DB capacity unchanged and constraint observable.
5. Limit/proactive prevention -> no manufactured incident/reward.

Extend existing sim step/opening/settlement/trace, store/persist/migration/phase2/App and e2e tests. Legacy progression tests do not prove new campaign routing.

Run Node 22 lint/typecheck/unit/coverage/balance/build and extended CI browser journeys. Before PR run required checks for both packages. Backend changes require auth/ownership/conflict and isolated migration tests with reviewed generated SQL. Preserve optional TRACE skip and baseline warnings; report commands/counts/failures/unavailable checks honestly.

Prepare prediction/evidence playtesting through the existing observer/export workflow: prediction before adding an app, observed effect after routing, DB-independence explanation, timing/confusion/intervention. Do not reveal answers or claim human understanding from automation. Sessions are separately arranged; no fabricated learning/enjoyment/duration results.

# 14. Definition of Done

Report each engineering item PASS / FAIL / NOT TESTED with evidence; distinguish gameplay, account integration, external release and human results.

- [ ] Opening-db v1 and same company/architecture/limit/finances remain intact.
- [ ] Phase 1/2 regressions, legacy protection and pause/batch/settlement invariants pass.
- [ ] Per-instance processing and exact request conservation pass.
- [ ] Targeted vertical upgrades and existing horizontal deployment activate/charge once.
- [ ] LB deployment/configuration are distinct; deterministic single/balanced/odd routing works.
- [ ] Backlog ownership and installed versus routed capacity remain accurate.
- [ ] DB headroom requires explicit purchase; app/routing never change DB capacity.
- [ ] Readiness-gated growth fires once and retained limits/prevention work honestly.
- [ ] Component streaks, approved latency and five-step measured recovery pass.
- [ ] Tier/LB exposure and cent remainders settle correctly.
- [ ] Causal reports explain actual ineffective/pending/contributing actions.
- [ ] Reveal follows acknowledged milestone, preserves earlier Add Application and nine-node scope.
- [ ] CampaignUI/Facility/strip share instance selection/dispatcher/snapshot evidence.
- [ ] Office/camera/theme preserved; routes/countdowns/unrouted states readable with keyboard/touch.
- [ ] Schema 3 migration preserves history/state/trace/cursor and handles failures non-destructively.
- [ ] Save/resume and scaling telemetry/deduplication/export pass.
- [ ] No duplicate systems or later-phase mechanics introduced.
- [ ] Guest play/local persistence remain independent of auth/API availability.
- [ ] Google session lifecycle, explicit attachment and account-switch preservation work.
- [ ] Owner-scoped cloud resume and atomic conflicts pass isolated tests.
- [ ] Actual callback/proxy/cookie/two-account/cross-session checks pass on a recorded deployment.
- [ ] Required static/unit/coverage/balance/build/browser checks pass with baseline exceptions identified.
- [ ] Vertical/horizontal journeys pass visible controls.
- [ ] Recorded build/configuration and deployed entry/assets/account flows verified.
- [ ] Human protocol/export prepared; actual sessions/results or their absence reported honestly.

# 15. Required implementation order and handoff

Before production edits inspect guidance/current changes, preserve checkpoint, record fresh Node 22 baseline and confirm types/configuration/snapshot contracts.

1. Update Phase 3 types/state contract.
2. Implement per-instance processing/tests.
3. Implement targeted vertical/horizontal actions through the existing scheduler.
4. Implement deterministic routing and LB deployment.
5. Extend accounting/latency/incidents/postmortems and continuation readiness/events.
6. Implement schema 3 migration before UI integration.
7. Integrate CampaignUI/Facility/selection/reveal.
8. Extend telemetry, durability and export; remove incorrect fallback mappings.
9. Integrate independently developed auth/cloud work against the stable envelope.
10. Run full regressions/E2E and backend checks; report all DoD items and external gaps.

Auth/backend work may develop independently without blocking guest engine work. No production deployment or participant contact is implied.

Implementation handoff: read all references in section 1; treat this as the Phase 3 contract; report baseline/reuse/conflicts before edits; preserve opening-db v1 and the same company; reuse all active systems; use explicit paid headroom and versioned growth; keep deployment/routing distinct; keep auth separate; report validation and each DoD status. Stop before Phase 4.

# 16. Readiness and external inputs

Core product decisions are resolved: additional DB economics/sequential purchase, distinct LB/routing activation, growth readiness/timing, retained limits, opening-prevention behavior and two-app limit. No production reset, free capacity grant or Phase 4 curriculum.

Gameplay implementation is ready after fresh baseline and ordinary code-contract review. Concrete balance conflicts require a reviewed adjustment, not silent retuning.

External inputs remain Google client/consent/callback/deployment access, real VITE_PLAYTEST_URL carried over from PR1, release VITE_BUILD_ID/URL verification, and arranged human sessions. These do not block local scaling implementation; full Phase 3 completion requires the specified integration/release evidence.
