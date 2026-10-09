# Phase 4 — Data Strategy and Parameter Variation

> **Project:** 99.99% — System Design Tycoon
> **Target:** 16–20 October 2026 (planning target, not a completion claim)
> **Learning outcomes:** LO1 Diagnose bottlenecks; LO2 Choose scaling strategies; LO4 Weigh design trade-offs
> **Status:** Authoritative repository-specific contract; implementation and validation outstanding
> **Continuation:** data-strategy v1; local save envelope schema 4

# 1. Authority, goal and reuse

Read with docs/PROJECT_PROPOSAL.md, docs/DEVELOPMENT_ROADMAP.md, docs/phases/PHASE_1_SIMULATION_FINAL.md, docs/phases/PHASE_1_IMPLEMENTATION_REPORT.md, docs/phases/PHASE_2_PR1.md, docs/phases/PHASE_2_IMPLEMENTATION_REPORT.md, docs/phases/PHASE_3_SCALING.md and docs/phases/PHASE_3_IMPLEMENTATION_REPORT.md.

Earlier approved contracts continue to govern their scenarios. This contract incorporates the user-approved Phase 4 workload, cache, economics, migration and local-only boundary. Later user-approved revisions take precedence. It explicitly narrows earlier roadmap/proposal expectations: tuning changes only hit-rate ceiling, and centralized ingestion/auth/cloud remain separate deferred workstreams unless approved later.

Extend the SAME company and deterministic engine. No standalone cache lesson, second campaign, engine, store, persistence layer, telemetry pipeline or renderer. Keep the Three.js office, Facility, camera, theme, icons and existing UI primitives. Teach demand reduction versus capacity investment through measured evidence. Application scaling may increase work reaching DB; it never directly reduces DB demand.

Keep opening-db v1 and application-scaling v1 immutable. Legacy weekly cache/research physics remain outside authoritative campaign processing. No later controls or hidden effects.

# 2. Existing foundation and checkpoint

Preserve existing per-instance processing, two-app maximum, 1,000/1,600 app capacities, deterministic routing, separate load-balancer deployment/routing activation, sequential DB upgrades 600 → 1,000 → 2,000, versioned growth, component overload counters, measured recovery, causal reports, cent-based 60-step finances, schema 3 persistence, shared UI selection and local telemetry/export.

The nine-node identities already include larger_database, caching and cache_tuning. Cache identities and a Facility rack asset exist; authoritative campaign cache processing does not. Legacy cacheWarmth, weekly tasks and DB load factors must not become the new physics.

Recorded Phase 3 results: 162 passing unit tests, one optional TRACE skip, five balance tests, 12 E2E tests and 23 unchanged lint warnings. These are historical, not a fresh Phase 4 baseline.

Inspect branch, HEAD, index and worktree before implementation. Do not assume the Phase 3 PR is merged. Preserve user changes and deferred drafts. Establish a reviewable Phase 3 checkpoint and fresh Node 22 baseline before gameplay edits; never automatically stage, commit, stash or discard changes.

# 3. Explicit entry and same-company continuity

Preserve run/company ID, seed, scenario origin, step, cash, apps/tiers, routing, load balancer, DB tier, traffic limit, backlog, pending actions/due steps, accounting exposure/remainders, milestones, trace, reports and telemetry. No reset, free capacity, DB downgrade, forced limit removal, traffic reward or fabricated incident.

Create a separately versioned data-strategy continuation; origin remains opening-db v1. Persist its identity/version, selected configuration, entry step, event deadlines and consumption. Explicit entry requires:

- Phase 3 growth actually occurred (application-scaling growth consumed).
- Management, not ended, with no unresolved incident/review.
- All app and DB backlogs drained.
- Any actual report requiring acknowledgement acknowledged.

Prevention paths remain eligible without a fabricated report. openingRecovered is not a Phase 3 completion fact. Derive entry eligibility from stage/event and lifecycle facts. Entry is idempotent, preserves pending work and leaves management paused. Boot/migration cannot enter, advance or fire growth. Reading/inspection never advances time.

Reveal data controls after explicit entry; keep existing app/routing/limit controls. Tuning requires deployed cache. Larger Database and Read Cache are not permanently mutually exclusive. No full research tree or extra technology node.

# 4. Versioned workload and architecture-dependent outcomes

Retire 900 req/s as the live continuation. Fixed data growth is 2,400 incoming req/s; actual application-processed P still depends on capacity, routing and admission. Never substitute incoming for P.

| Fixed profile | Read basis points | Writes | Cacheable-read basis points |
|---|---:|---:|---:|
| read-heavy | 8,000 | 20% | 10,000 |
| write-heavy | 2,000 | 80% | 10,000 |

At P=2,400 and eligible-read hit rate 60%, DB demand is exactly 1,248 read-heavy or 2,112 write-heavy. Cache helps writes-heavy traffic less and may remain insufficient for DB 2,000. DB 3,000 serves either fixture if applications suffice.

One large app remains app-limited; two base balanced apps also constrain. Mixed tiers can constrain the smaller app and DB together. Two large balanced apps can expose DB overload. Warm cache, DB 3,000 or a retained admission limit can prevent an incident. Preserve all these outcomes; never grant capacity or manufacture a DB incident. Headless fixtures can supply explicit sufficient architecture; browser paths must achieve it through actual actions.

## Event timing and minimal bounded variation

Keep v1 traffic fixed at 2,400 and observation interval at three physical steps. On the first post-entry step with management/no incident and drained backlogs, record due step = current step +3. At/after it, fire once on the first step readiness holds. Preserve deadline across lost readiness. Check after due action activation, following existing continuation semantics. Do not require sufficient app capacity or removal of admission limit to fire.

Apply selected read/write profile when growth fires. Before that, preserve preceding one-operation-per-request behavior. Growth is persistent. Record old/new traffic/profile, due and actual step; loading alone cannot fire it.

Minimal normal replay variation selects deterministically between the two approved profiles, using existing seeded RNG conventions. Keep traffic, cacheability and interval fixed; store chosen config/generation version once. Different seeds may select the same profile. No invented continuous ranges or changed earlier RNG behavior. Fixed evaluation pins seed/profile/version separately and cannot be overwritten by replay selection.

A contrasting profile can use a separate fixed evaluation session. An optional same-company contrast, if implemented, requires explicit action after growth, management/no review and drained backlogs; switches only profile at unchanged traffic, once, with consumed-event evidence. No automatic second spike, architecture reset, required purchase or reward. Broader traffic/timing/cacheability variation requires later approval/versioning.

# 5. Integer logical operations and conservation

Every application-processed request represents one logical data operation. Shares/rates are integer basis points in [0,10,000]. Apply the current profile when application processing completes, including app backlog; do not claim operation type was tracked at arrival. Apply floors once to aggregate P after per-instance processing, not separately per instance.

```text
reads             = floor(P × readShare / 10,000)
writes            = P - reads
eligibleReads     = floor(reads × cacheableReadShare / 10,000)
nonCacheableReads = reads - eligibleReads
hits              = floor(eligibleReads × effectiveHitRate / 10,000)
eligibleMisses    = eligibleReads - hits

databaseReadDemand  = nonCacheableReads + eligibleMisses
databaseWriteDemand = writes
databaseNewDemand   = P - hits
```

Without active cache effectiveHitRate=0. All counts are nonnegative integers; no fractional requests or hidden rounding remainder. Small-work rounding is documented behavior. Cache misses means eligibleMisses; display non-cacheable reads separately.

Existing DB backlog is previously submitted uncached work. Never turn it retroactively into hits or reclassify it when profile changes. Process DB backlog + databaseNewDemand with the existing bounded processor. Each DB operation still corresponds to one pending request outcome.

```text
successful = hits + completed DB operations
failed = sum(application overflow) + DB overflow
starting total backlog + admitted = successful + failed + ending total backlog
reads + writes = P
hits + databaseNewDemand = P
```

Rejected incoming demand stays separate. Hits complete once, earn revenue once and never also enter DB demand. Preserve outcome/error denominators and pending-request accounting. Zero admissions/outcomes cannot force recovery.

# 6. Cache model, warmth and one-dimensional tuning

Applications → optional Cache lookup → Database. Only cacheable/repeated reads hit. Misses, non-cacheable reads and all writes reach DB. Cacheability abstracts valid repeated reads; no invalidation/coherence is simulated. Writes do not change cache state in this model.

No cache queue, throughput bottleneck, failure, TTL, eviction, invalidation, consistency gameplay, size knob or independent incident. No added lookup latency. Hit ceiling represents effectiveness for the workload, not unlimited real-world storage.

Persist deployment/activation step, warmth, target and tuning state. Base target=6,000 basis points; tuned=7,500; increment=1,200 per qualifying eligible-work step.

Exact boundary:

1. Activate due actions before work. Deployment starts warmth at 0 and target 6,000. Tuning raises ceiling to 7,500 without resetting warmth.
2. Process apps/classify logical work. Use stored warmth bounded by active ceiling for this step's effective rate; deployment activation step uses 0%.
3. Compute hits/DB input, DB outcomes, latency and accounting.
4. Snapshot effectiveHitRateUsed and warmthUsed for this completed step.
5. If activated cache and eligibleReads>0, advance stored warmth by 1,200 up to target for NEXT step. Snapshot also records warmthAfterStep and target to distinguish used evidence from future state.

Successive eligible-work steps use 0%,12%,24%,36%,48%,60%. Five qualifying steps advance warmth to 60%; the following step uses it. Pause, review, zero eligible reads and reload never increment warmth. Fully warm cache uses 60% on tuning activation, then advances toward 75% at unchanged speed. Workload changes do not reset warmth; eligibility still determines hits.

Tuning changes ONLY ceiling. Remove stale Phase 4/campaign copy claiming faster warm-up or extra tuning upkeep. Preserve inactive legacy mechanics/history rather than rewriting them.

# 7. Approved actions and economics

Extend current accepted-action dispatch, IDs, scheduling and spending; UI never mutates money/capacity/warmth directly.

| Action | Effect | Setup | Delay | Upkeep per 60-step financial period |
|---|---|---:|---:|---:|
| Further DB tier | 2,000 → 3,000 ops/s | $4,000 | 4 steps | $3,500 total DB upkeep |
| Read Cache | Cold cache, target 60% | $1,500 | 2 steps | $400 cache upkeep |
| Cache Tuning | Target 60% → 75% | $1,000 | 2 steps | No additional upkeep |

Earlier tiers/prices/actions remain unchanged. Sequential upgrades only; no jumps/repeated terminal purchase. New tier/cache/tuning require data entry; tuning also deployed untuned cache. Reuse single infrastructure scheduling slot alongside app/LB work; routing/admission retain their existing independent channels.

Request at completed step n activates at beginning n+delay. Charge setup exactly once on accepted request; rejected requests spend nothing. Availability follows resources/prerequisites/scheduling, never strategic suitability. Accrue upkeep only after activation. DB $3,500 is total tier upkeep, not additive surcharge. Keep salary, request revenue, exposure/remainders, exactly-once settlement and bankruptcy precedence. No bailout/refund/new failure physics.

# 8. Incidents, latency and causal postmortem

Reuse component overload streaks, existing capacity family and measured recovery. DB offered demand becomes databaseNewDemand; old backlog still influences latency. Cache cannot erase backlog, force recovery or produce a cache incident.

Keep latency: 100 ms + maximum application backlog delay + DB backlog delay, with current capacities/units. It is a conservative dependency-queue estimate, not a hit-weighted mean/percentile. Cache helps indirectly through lower DB pressure. Preserve strict latency <500 ms, service errors <1%, positive admissions/completed outcomes and five qualifying steps, plus bankruptcy precedence and earlier mandatory pauses.

Record actual profile/shares, eligibility, logical P, reads/writes, hits/misses, used hit rate, warmth before/after, target, DB demand/capacity/backlog and request/activation timing. Preserve per-instance/routing evidence. Explain capacity increase versus demand reduction, combined contributions and continued rejection/revenue trade-offs. Never claim app scaling reduces DB demand, unactivated cache helped, or writes-heavy cache is universally useless. No fabricated report for prevention; historical reports remain read-only.

# 9. Actual UI and file reuse plan

Adapt CampaignUI, Game, Facility, dependency strip, existing selection and history. Logical view: Users → Applications → optional Cache → Database; show miss/non-cacheable/write DB paths without implying all traffic bypasses DB.

Show profile/read-write mix, cache/pending state, effective rate USED, hits, eligible misses, warmth/target, DB demand/capacity/backlog and existing app/latency/errors/admission/countdown evidence. Inspection can expose extra details. Snapshot history lacking new fields displays unavailable historical detail, never invented zeros.

Facility and strip select the same underlying cache through existing state/dispatcher. Reuse rack/location and office renderer. Preserve keyboard/touch, non-color evidence and actual app routing.

| Existing files | Required extension/adaptation |
|---|---|
| frontend/src/sim/campaignTypes.ts, types.ts | Serializable data-stage/cache/actions/evidence |
| frontend/src/sim/step.ts | Data calculation/downstream DB input, warmth, entry and conserved outcomes |
| frontend/src/sim/actions.ts | Existing dispatch/prerequisites/scheduling |
| frontend/src/sim/settlement.ts | DB/cache exposure without changing settlement arithmetic |
| frontend/src/sim/derive.ts | Snapshot selectors; no parallel demand formulas |
| frontend/src/sim/trace.ts | Actual cache/workload causal evidence |
| frontend/src/sim/tech.ts | Existing nine identities, reveal and accurate copy |
| frontend/src/game/store.ts | Explicit entry, shared selection and local lifecycle |
| frontend/src/game/persist.ts, saveMigrations.ts | Existing schema dispatch/validation/backup/export |
| frontend/src/game/telemetry.ts | Existing local projection/archive |
| frontend/src/components/CampaignUI.tsx | Existing actions, inspection, history and report flow |
| frontend/src/components/Game.tsx | Single clock/composition; only necessary integration |
| frontend/src/components/scene/Facility.tsx, scene/layout.ts | Existing cache asset/selection/dependency cues |
| frontend/src/index.css | Minimal responsive/accessibility styles if needed |

Reuse processWork, routing/allocation, pause cleanup and settlement. One new production file is justified: frontend/src/sim/scenarios/dataStrategy.ts, following separately versioned scenario conventions. Consider a local pure cache helper first; extract only for readability. No general generator framework, graph/editor, account client, new persistence/store or telemetry system. Extend existing tests; focused data-strategy test files are acceptable.

# 10. Schema 4 local migration

Retain nn.campaign.save.v1; envelope schemaVersion becomes 4, independently of scenario versions. Extend existing registry/validator/dispatch together: v1 → v2 → v3 → v4.

Persist data-stage/version/config/consumed events/deadlines, workload/profile shares, cache deployment/activation/warmth/target/tuning, data pending actions, 3,000 tier, cache accounting exposure and snapshot/trace evidence. Session/wall timestamps stay outside physics.

Existing saves migrate with data stage absent/not entered and cache absent. Preserve ID/cash/apps/routing/limits/backlog/actions/due steps/exposure/remainders/trace/reports/milestone/telemetry cursor. Preserve historical snapshot versions; no fabricated per-instance/read/write/cache observations or measured completion/session events. Do not reinterpret historical revenue/outcomes.

Maintain exact source-byte backups before replacement, validation before writes, incompatible-backup protection, corrupt/future save export and storage errors. Backup/validation/write failures preserve source. Keep nn.save.v1, nn.meta.v1 and nn.analytics.v1 byte-for-byte unchanged. Reset remains explicit and retains unexported evidence. Loading/migration cannot enter/grow/advance. Resume must match uninterrupted warmth, demand, outcomes, finances and actions exactly.

This is a browser envelope change, not a database migration: no Drizzle generation, production migrations or cloud binding is required.

# 11. Local telemetry and deferred backend boundary

Extend existing stable IDs/run/session/build/scenario/step/timestamp attribution, adding data continuation/config/profile. Preserve active/wall timing and unknown historical fields. Required events:

- data_stage_entered: explicit accepted entry once.
- workload_changed: actual growth/contrast with old/new config, due/actual step and event ID.
- database_upgrade_requested / database_upgrade_activated: accepted request versus actual capacity change.
- cache_requested / cache_activated: accepted request versus actual cold deployment.
- cache_tuning_requested / cache_tuning_activated: accepted request versus target change/preserved warmth.

Reuse current bridge/names where supported; no double emission. Link request IDs/cost/due step, capacity, workload and cache evidence. Preserve stable trace identity, StrictMode/reload/retry deduplication, archive/write-failure durability and unexported records. Local snapshots/export supply detailed per-step evidence without unnecessary events each tick.

Do not mix deferred Phase 3 auth/cloud drafts: account restoration, OAuth, attachment, owner binding, upload/resume, revision conflicts, account switching and proxy/cookie deployment. No centralized-ingestion service, API-routing change or fixed production rewrite is approved here. Guest gameplay/local persistence/export must work with API unavailable. Centralized ingestion remains a separately reported deferred task; local export is not a claim of central ingestion. Broader MVP auth/cloud obligations remain.

# 12. Automated and browser acceptance

Record fresh Node 22 lint/typecheck/unit/coverage/balance/build/E2E baseline per AGENTS.md and docs/testing.md. Preserve optional TRACE skip and unrelated warnings. No dependency/audit cleanup.

| Test | Required assertion |
|---|---|
| A | Sufficient apps expose actual DB bottleneck |
| B | App scaling changes neither DB capacity nor cache rules; DB demand may increase |
| C | Without cache all P logical operations reach DB |
| D | Exact fixed cache arithmetic: 1,248 read-heavy at P=2,400/hit=60% |
| E | Eligible misses reach DB |
| F | Writes/non-cacheable reads reach DB; write-heavy yields 2,112 |
| G | Sequential DB capacity changes only on scheduled activation |
| H | Cache has no preactivation effect and activates cold |
| I | Tuning changes only ceiling at activation, no reset/speed/upkeep effect |
| J | Request/operation/revenue conservation including backlog/overflow |
| K | Identical state/config/seed/actions reproduce results; bounded replay choice |
| L | Exact save/resume for warmth/config/actions/workload/finances |
| M | Phase 1 physics/settlement/trace and all three recovery paths |
| N | Phase 2 onboarding/milestone/selection/telemetry/migration/entry/failure |
| O | Phase 3 per-instance/routing/growth/selection/local persistence |

Also test zero eligibility, integer rounding, warmth/tuning boundaries, profile changes with old backlog, retained limits, same event/different architecture, simultaneous constraints, prevention, lost readiness/deadline, boot safety, fixed evaluation isolation, source-byte backup/write failures and telemetry retry.

Both DB-only and cache browser journeys are required: same-company continue → explicit data entry → growth/workload → inspect → adapt actual apps/routing if needed → paid DB or cache → activation/consequences → measured recovery if incident exists → actual report → continue → reload. Add write-heavy cache-insufficient then DB recovery, mobile/touch/cache selection, warmth reload and blocked-API guest coverage. Never force an incident for prevention. Headless controlled architectures complement actual browser purchases. Balance tests must assess approved prices against preserved cash/salaries and cost/rejection trade-offs.

# 13. Human validation and Definition of Done

Prepare contrasting pinned-profile sessions using recorded build/configuration, fresh/returning testers and evidence export. Record cause/evidence reasoning, choices, warmth understanding, confusion, help, timing and actual prevention/failure/quit/interruption. Paired questions cover only implemented concepts, not reliability. No automatic recruitment/contact or fabricated outcomes.

Report each item PASS / FAIL / NOT TESTED with evidence:

- [ ] Same-company/state continuity and immutable earlier scenarios.
- [ ] Explicit entry/prevention gates; no advancement/entry on boot or migration.
- [ ] Versioned seeded configuration and exactly-once workload events.
- [ ] Integer workload/cache arithmetic and outcome/revenue conservation.
- [ ] Cold activation, eligible-work warmth, used-rate snapshots and tuning rules.
- [ ] Sequential 3,000 tier and approved scheduling/economics.
- [ ] Preserved incidents/latency/recovery/bankruptcy precedence.
- [ ] Actual causal workload/cache/capacity/app trade-off evidence.
- [ ] Shared UI/Facility/strip selection and accessible workload/cache presentation.
- [ ] No duplicate engine/store/renderer/persistence/telemetry.
- [ ] Schema 4 chain/exact resume/history and failure/source preservation.
- [ ] Legacy keys and unexported evidence protected.
- [ ] Attributed local events deduplicate and distinguish request/activation.
- [ ] DB/cache/write-heavy browser paths, mobile and API-unavailable guest play.
- [ ] Phase 1–3 and Node 22 checks reported; baseline exceptions identified.
- [ ] No deferred backend/auth/cloud/proxy or later mechanics mixed into gameplay.
- [ ] Human protocol/export ready; actual contrasting sessions/reasoning reported honestly.

Engineering checks do not prove human understanding or deployment. Unperformed human/deployment checks remain NOT TESTED. Central ingestion/auth/cloud are separate deferred work, not satisfied by local export.

# 14. Implementation order

1. Inspect Git/checkpoint/index; isolate deferred work and preserve user changes.
2. Record fresh Node 22 baseline and approved contract/configuration.
3. Define serializable workload/cache/data-stage types and versioned scenario.
4. Implement pure integer cache/workload/warmth and conservation tests.
5. Integrate DB demand/outcomes, scheduled actions and accounting.
6. Extend incidents/postmortem evidence without retuning earlier rules.
7. Implement schema 4 validation/migration/backups and continuation tests.
8. Integrate explicit progression/reveal in current lifecycle.
9. Adapt existing UI/Facility/selection/history and accessibility.
10. Extend local telemetry/export.
11. Run regressions/balance/browser/manual checks; prepare human protocol/build.
12. Report changed files/reuse/baseline/deviations/issues/every DoD status. Stop before Phase 5.

# 15. Implementation handoff

Read repository guidance/testing, proposal/roadmap and approved Phase 1–4 contracts/reports. Treat this as authoritative Phase 4 local gameplay scope. Before edits report actual Git state, baseline and concrete conflicts. Extend existing modules only; preserve earlier scenarios and browser data. Implement approved integer physics, cold/warm timing, ceiling-only tuning, prices and schema 4. Keep auth/cloud/ingestion/proxy and later mechanics deferred. Run required Node 22 checks and both data strategies. Report PASS/FAIL/NOT TESTED honestly; stop before Phase 5.

# 16. Readiness and scope guard

Product/physics design is implementation-ready. Operational prerequisites are a reviewable Phase 3 checkpoint and fresh baseline; do not assume PR state. Minimal replay profiles are bounded and concrete. Optional broader variation or automatic profile progression requires later approval.

No health checks, failures, failover, spare-capacity curriculum, multi-region, replication/sharding, queues, autoscaling, arbitrary graph editing, multiplayer, AI-generated gameplay or full progression tree. Preserve later code inactive. Do not clean unrelated warnings or edit deferred backend/package/proxy files. Deployment and participant sessions need separate authority/evidence.
