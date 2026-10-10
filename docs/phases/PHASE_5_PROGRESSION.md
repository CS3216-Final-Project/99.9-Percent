# Phase 5 — Traffic Spikes, Autoscaling and Forward Progression

> **Project:** 99.99% — System Design Tycoon
> **Target:** 20–25 October 2026; PR2 — 26 October 2026, 7:59 am SGT
> **Learning outcomes:** LO2 Choose scaling strategies; LO4 Weigh trade-offs; supporting LO1 Diagnose bottlenecks
> **Status:** Repository-reconciled implementation contract; implementation and validation outstanding
> **Foundation:** One continuous company after completed Phases 1–4; local save schema 4

# 1. Authority and repository reconciliation

Read with `docs/PROJECT_PROPOSAL.md`, `docs/DEVELOPMENT_ROADMAP.md` and these phase documents: `PHASE_1_SIMULATION_FINAL.md`, `PHASE_2_PR1.md`, `PHASE_3_SCALING.md`, `PHASE_4_DATA_STRATEGY.md`, `PHASE_4_IMPLEMENTATION_REPORT.md`. Earlier approved contracts remain authoritative for earlier stages. The user's instruction to keep auth/cloud deferred narrows the old Phase 5 release scope.

Reconciliation checkpoint: branch `ai/phase-5-progression`, commit `40aeab4906c5d8e0feb102574985763afb0de35f`, clean working tree. The deferred auth/cloud stash remains unapplied. The Phase 4 report records 210 passing unit tests, one optional TRACE skip, six balance tests, 15 E2E tests, 23 unchanged lint warnings, and passing typecheck/build/whitespace checks. These are historical results, not a fresh Phase 5 baseline or validation of the new parameters.

| Previous specification | Repository reconciliation / decision |
| --- | --- |
| One company, gradual availability, investment alternatives, cost and delayed deployment | Preserve these principles. |
| Build campaign progression, milestones, continuation and reset | Already implemented. Extend existing transitions and guidance. |
| Replace a 17-node active tree with nine nodes | Active `TECH_ORDER` already has nine identities. Retain inactive legacy code; no tenth node. |
| Research gates for previously acquired technology | Would retroactively gate Phases 1–4 and saved purchases. Research applies only to the new autoscaling capability. |
| Opening milestone grants cash/research | Conflicts with Phase 2's recognition-only award. Preserve it unchanged. |
| Generic users/revenue milestone thresholds | Existing stages use actual state and consumed traffic events. Do not create a second progression score. |
| Instant temporary autoscaling capacity | Exists only in the inactive weekly model. Reuse the tech identity/assets, not those formulas. |
| Cache tuning accelerates warm-up | Current Phase 4 tuning raises the hit-rate ceiling. Preserve that behavior. |
| New progression store, panels, renderer or save adapter | Duplicate active systems. Extend CampaignUI/store/Facility/persistence. |
| Account/cloud usability delivered here | Deferred separate workstream; not delivered or claimed complete by this gameplay contract. |

Phase 5 introduces **temporary traffic spikes and delayed application autoscaling**, with the smallest forward research/recognition state needed to expose that capability. It does not rebuild campaign progression or deliver research pricing for all nine nodes.

# 2. Objective and learning outcome

The player prepares for variable demand, observes when new capacity actually receives traffic, and weighs delayed automation against continuing cost. Autoscaling changes application capacity; it cannot repair database pressure, cache misses, write demand or admission policy.

Teach that provisioning takes time, installed/routed/useful capacity differ, app relief can reveal a database bottleneck, and keeping capacity after demand falls costs money. Admission control remains a technical/business trade-off. Manual scaling, pre-provisioning, automation and limiting are legitimate alternatives; no mandatory autoscaling purchase or prescribed incident solution.

# 3. Entry and version identity

Display **Traffic Spikes & Autoscaling**. Serialize stage **`traffic-spikes`, version `1`**. Retain campaign origin `opening-db` and all earlier scenario/stage versions.

Offer explicit `enter_spikes` through existing campaign guidance when:

- Data Strategy exists and its growth event is consumed.
- Campaign is solvent, in management, with no active incident or pending report/milestone acknowledgement.
- All actual recovered reports have recorded acknowledgements and the opening recognition is acknowledged.
- All application/DB backlogs are zero and the latest snapshot qualifies under the existing measured-recovery predicate.

Do not require contrast completion, cache, a 3,000 ops/s DB, load balancing, both scaling investments, or traffic-limit removal. A pending infrastructure action alone does not block readiness. Show factual unmet requirements.

Entry is idempotent, zero-step, draws no RNG, settles no money and leaves management paused. Preserve run/company ID, seed, cash, ledger/remainders, architecture, inherited read/write profile, cache warmth/tuning, admission limit, pending actions/deadlines, trace/reports and consumed events. Never auto-enter on load/migration.

Keep the inherited workload profile fixed during this stage. Phase 4's optional contrast remains available before entry, without adding a contrast prerequisite. Do not expose another contrast change after entry.

# 4. Deterministic traffic spikes

These are **new version-1 design parameters**, awaiting balance validation. Persist configuration and absolute deadlines; never silently retune earlier stages or resumed campaigns.

| Parameter | Value |
| --- | --- |
| Baseline | 2,400 incoming requests/s |
| Peak | 4,000 incoming requests/s |
| First pulse | `[entryStep + 8, entryStep + 28)` |
| Second pulse | `[entryStep + 48, entryStep + 68)` |
| Duration | 20 physical steps each |
| At each end | Return to 2,400 requests/s |

For entry at completed step n, n+8 through n+27 use peak demand; n+28 returns to baseline. First resumed step is n+1. Show both scheduled pulses/countdowns at entry. One physical step remains one modeled second; reading/menu/review/hidden-page pauses advance nothing.

Reuse existing consumed-event records and action/event ordering. Start/end events fire exactly once. Readiness changes, incidents and pending actions after entry do not rebase the schedule. Reload preserves deadlines. Apply incoming changes before admission/processing; use existing workload/cache arithmetic and terminal-outcome accounting.

Two finite pulses only: no random promotion loop or perpetual spikes. Proactive prevention is valid; do not manufacture an incident or force recovery at a pulse end.

# 5. Forward progression and existing tech identities

Keep the nine identities:

| Group | IDs |
| --- | --- |
| Capacity | `larger_servers`, `load_balancing`, `autoscaling` |
| Data | `larger_database`, `caching`, `cache_tuning` |
| Reliability | `health_checks`, `standby`, `auto_failover` |

At explicit spike-stage entry, record one **data-readiness** award of one research point. Spending it unlocks the existing `autoscaling` identity once. Store earned=1/spent=0 or 1 within the new stage; derive unlock from spent=1. Reuse existing transition/trace infrastructure, not a second progression store or duplicate completion registry.

These zero-step transitions grant no cash, instances or earlier reward. Repeated entry/unlock, recovery, report reopening and reload cannot duplicate them. Earlier technologies remain available from existing stage/architecture state, without a retroactive research bill. Unlocking is distinct from paid deployment.

This bounded forward research introduction explicitly defers a full all-node research economy. Reliability stays locked. Active UI must not display the inactive weekly model's autoscaling price/effort or obsolete cache-tuning rules.

# 6. Autoscaling policy and scheduler

## 6.1 Deployment and measurement

Deployment requires autoscaling unlocked, an installed load balancer and balanced routing to at least two actual apps. Use the existing infrastructure slot: **$1,000 setup**, **two-step activation**, **$100 upkeep per 60 steps** after activation. It installs no app and changes no routing itself. Activation enables the fixed version-1 policy:

| Rule | Value |
| --- | --- |
| Minimum installed/routed pool for retirement | Two instances |
| Maximum installed/reserved pool | Four instances |
| Scale-out | Routed busy utilisation strictly >80% for three consecutive steps |
| Scale-in | Routed busy utilisation strictly <60% for six consecutive steps |
| Automatic provisioning | Three steps |
| Routing activation | Existing one-step delay |
| Cooldown | Four steps after routing activation, retirement or cancellation |

Expose parameters read-only; no policy editor. Enable/disable is an explicit free zero-step management/incident action, resets streaks and starts four-step cooldown. Disabling retains deployed-controller upkeep and accepted actions; no refund/cancellation of paid requests.

Observe authoritative routed completed app work divided by routed capacity using existing integer/fixed-point conventions. Exclude unrouted capacity; do not use incoming traffic, DB utilisation or legacy weekly projections. Threshold equality does not qualify. Neutral steps reset the respective streak.

Evaluate after processing, settlement and incident/recovery/bankruptcy transitions against that completed snapshot. No new request in review/ended state. Pending resize/join and cooldown reset counters; blocked time does not accumulate a burst of requests. At cooldownUntil, begin fresh observations.

## 6.2 Scale-out and routing

Reuse add-app scheduling with explicit `source: autoscaler`. An automatic base app costs **$1,000**, supplies **1,000 req/s**, activates after **three steps**, and incurs existing **$700/60-step upkeep** from installation. Manual add-app remains $1,000/two steps.

Installation is unrouted. Request the existing free one-step balanced routing change to append the controller-created app; useful traffic is possible no earlier than request+4. Retain infrastructure/routing/admission channels and stable acceptance order. No hidden provisioning queue.

Append only if still enabled and LB/routing membership still matches the expected pool. Wait visibly if routing is busy. A manual routing change invalidating the expected pool suspends automatic joining; preserve the paid idle app and show why. Never automatically route a previously manual idle app. Already accepted routing actions finish normally after disable.

Do not add again while an installed controller app awaits routing. Missing prerequisites, busy infrastructure, unaffordable purchase or the maximum produce a visible blocked reason; trace only changes of reason. Rejection spends nothing and consumes no app ID. Existing accepted player requests retain priority.

Generalize IDs to monotonic `app-N`, never reused after retirement. Allow four installed/reserved apps only in the new stage; earlier stages keep their two-app limit. Preserve numeric-ID ordering and existing equal quotient/remainder routing, including mixed-tier consequences. No capacity-weighted routing.

## 6.3 Safe scale-in

Only controller-created base apps are eligible; choose the highest numeric eligible ID. Protect all entry/manual apps. An accepted manual vertical upgrade transfers that app out of controller ownership.

For six low observations and again at activation, require:

- No active incident, qualifying service measurements and zero app/DB backlogs.
- Empty candidate still controller-owned, with at least two installed/routed apps remaining.
- Hypothetical balanced allocation gives every remaining target at most 80% demand/capacity.
- Unchanged routing and no incompatible routing action.

Retirement is a **one-step**, **zero-setup-cost** action using the infrastructure slot and reserving routing for atomic removal. At activation revalidate using demand scheduled for that step, including a pulse beginning then. This safety preview does not reorder existing action/event execution. Unsafe retirement cancels with evidence and four-step cooldown.

Remove only an empty app and its routing membership together; retire its overload-counter entry. Preserve history and repair selectedAppId via existing fallback. No dropped/transferred/reprocessed backlog, refunds or failure states. Upkeep stops on retirement. Never remove a protected app just to reach minimum size.

# 7. Economy, incidents and causal evidence

Preserve prior setup prices, salaries, revenue, period length and rejected-demand opportunity values. Accepted setup is paid exactly once under existing affordability rules. Installed idle apps accrue upkeep until retirement. Controller upkeep persists while disabled. Do not also charge legacy temporary-server/autoscale costs.

Extend existing exposure numerators/remainders and settlement evidence for controller cost, preserving partial-period and cent arithmetic and bankruptcy precedence. Rejected opportunity value is not an extra expense.

Reuse per-component overload streaks, latency equations, conservation and measured five-step recovery. DB demand remains app-processed work minus cache hits. Controller changes app capacity only. For example, 4,000 processed req/s with a warm 60% read cache produces 2,080 DB ops/s at 80% reads, versus 3,520 at 20% reads; 3,000 ops/s can still constrain the latter. These are arithmetic examples, not guaranteed processing outcomes.

No new DB tier, cache equation or timeout recovery. Falling traffic may drain work, but actual measurements govern recovery. Existing manual/admission actions remain available. Report pauses preserve remaining physical pulse duration.

Extend actual causal reports with pulse boundaries, controller observations, request/install/routing delay, blocked decisions, retirement and costs. Explain late or ineffective automation only when trace evidence supports it.

# 8. Completion and same-company continuation

After pulse two ends, require baseline input, management/no incident, zero backlogs, acknowledged actual reports and five consecutive qualifying baseline steps. Persist a baseline-stability counter using the existing recovery predicate.

Record one **spike-response** recognition with no further cash/research/unlock. Prevention can complete without inventing an incident/report. Show pending acknowledgement through existing presentation/pause rules. Acknowledgement is zero-step and returns to the same paused company.

Controller can continue managing baseline capacity afterward; generate no additional pulses. Reliability remains locked/unimplemented. Do not end the campaign or emit a new run/opening-completion event.

# 9. UI requirements

Extend CampaignUI's pinned progression strip with one stage between Data Strategy and locked future stages. Derive completed/current/available-next/locked states from campaign state; retain Campaign guidance / System evidence / Actions.

Show:

- State-based objective: “Maintain service through changing demand while managing capacity cost.”
- Factual entry requirements, pulse countdowns, current input and return-to-baseline timing.
- Research/unlock separately from controller purchase/activation.
- Enabled/disabled/suspended controller, measured utilisation, high/low counters, thresholds, limits, cooldown and blocked reason.
- Requested/provisioning/installed-unrouted/routing-pending/serving/retired states and countdowns.
- Installed/routed capacity and actual per-instance evidence, including apps 3/4 and retired-ID gaps.
- Traffic-limit qualification and rejected-demand business consequence.
- Inherited read/write profile, cache warmth/used hit rate and DB demand/capacity without prescribed investments.
- Required report/completion acknowledgements and continuation outside History, also after reload.

Reuse shared Facility/dependency selection and action dispatcher. Adapt hard-coded app label anchors using existing room positions; keep renderer, office, camera and icons. Do not use legacy instant temporary-server visuals. Preserve demand/capacity/utilisation/backlog/processed/failed/latency/errors and readable history. Keyboard, touch, focus restoration, mobile and color-independent state remain required. Reading advances no simulation and fabricates no inspections.

# 10. Local persistence and schema 5

Extend `persist.ts`/`saveMigrations.ts`/campaign types; no second save layer. Keep `nn.campaign.save.v1`, existing metadata/archive keys, legacy keys byte-for-byte, paused resume, raw backup/export and unexported-record retention.

Envelope **schemaVersion 5** uses chained dispatch **1 → 2 → 3 → 4 → 5**. Required saved additions:

- Nullable stage identity/configuration, entry/deadlines/consumed events, research award/spend, baseline counter and completion acknowledgement.
- Controller state within that stage: deployment/enabled policy, counters/cooldown, managed IDs, pending join/routing expectation, blocked reason.
- Monotonic next-app number and action provenance.
- Controller exposure/remainder and settlement cost evidence.
- Snapshot version 5 for stage/controller/current per-instance evidence.

Derive redundant status from pending actions/events where possible. Validate stage consistency, action targets, controller ownership, bounds and routing; do not merely permit arbitrary instance arrays.

Migration from valid schema 4 sets new stage/controller null and new financial accumulators zero, derives next ID from greatest existing/historical app identity, and treats historical action source as player. Preserve cash/backlog/pending deadlines/trace IDs/reports/milestones/profile/cache/ledger and every old snapshot. Do not backfill research, stage completion/timing or invented per-instance/controller observations.

Retain historical snapshot-version rules, including schema-3/4 snapshot two-app limits. Version-5 snapshots permit up to four current instances and valid retired-ID gaps. Do not relabel the old origin or earlier stages.

Backup original source bytes before validated replacement. Backup, validation or write failure preserves source/export. Unknown future versions remain unsupported. Reset retains existing explicit confirmation, onboarding preference and evidence/archive protection. Cloud bindings, owner IDs and account copies are unnecessary and excluded.

# 11. Local telemetry

Extend existing trace projection/archive/export with stable event IDs, run/session/build/scenario attribution, physical step, timestamps and active/wall timing. Preserve reload/StrictMode/retry deduplication and unexported records. Add stage ID/version to new-stage events.

| Occurrence | Required evidence |
| --- | --- |
| Entry / data-readiness award / unlock | Stage/research before-after, once-only identity |
| Pulse announcement/start/end | Pulse ID, scheduled/actual step and input |
| Controller request/activation/enable/disable | Action source, cost, policy and request/activation steps |
| Trigger / blocked-reason change | Snapshot, observation/streak, limits/cooldown, reason |
| Automatic app request/install/routing | Stable app/action IDs, source, useful-capacity delay |
| Retirement request/cancel/complete | Candidate, safety and cost/routing consequence |
| Completion/acknowledgement | Timing, response mix, profile, accepted limiting, cost exposure |

Use distinct progression-award events. Existing `milestone-awarded` projection into `run_completed_opening` must remain opening-specific; new recognition cannot produce another opening completion. Automatic requests are not player gameplay decisions, replay evidence or user intervention counts. Preserve request versus activation semantics and existing physical trace projection. No networking is required; this feature sends no browser data externally.

# 12. Tests and acceptance paths

Run a fresh Node 22 baseline before implementing, and repository-required checks afterward. Historical Phase 4 counts are not fresh results. Preserve all Phase 1–4 paths and storage/telemetry/conservation/pause regressions.

Unit/store/migration tests:

- Entry gates, idempotency, preserved state and no auto-entry.
- Exact n+8/28/48/68 boundaries, event consumption, pause/reload and batched-step equivalence.
- Strict threshold equality, three/six observations, four-step cooldown, blocked-counter reset.
- Three-step automatic install plus one-step routing; unchanged manual delay; no traffic through idle capacity.
- Numeric routing with four apps/mixed tiers/gaps; protected apps, reservation limits and earlier two-app restriction.
- Empty-only retirement, min pool, pulse-boundary revalidation/cancellation and selection fallback.
- Manual slot/routing priority, disabling and completion of accepted paid actions.
- Exact setup/upkeep/partial-period exposure, retirement stopping cost, affordability and bankruptcy.
- Continued DB constraint despite app relief; unchanged cache/latency/conservation.
- Once-only research and completion for prevention/recovery, acknowledgements and resume.
- Schema 1/2/3/4 chains, malformed actions/controller/snapshots, original-byte backups and failure preservation.
- Controller telemetry deduplication/exclusion from replay and opening completion.
- Local guest save/resume/export with backend unavailable.

Balance fixtures compare manual response, pre-provisioning and autoscaling under identical pulses. Include mixed app tiers, read/write-heavy profiles, admission limiting, activation lag, cost tail and safe scale-in. Check documented recoverability/solvency rather than asserting automation is optimal. Retuning, if needed, affects only new stage configuration with explicit version/reporting.

E2E through public controls:

1. Same Data Strategy company → enter → unlock/deploy → pulse/provisioning/idle/routing → reload → second pulse → measured recovery/report if needed → recognition → same company.
2. Manual/pre-provisioned path without autoscaling, including valid prevention/completion.
3. Write-heavy app relief with persistent DB evidence, then adaptation through existing controls.
4. Safe scale-in/cancellation and disable with retained accepted actions.
5. Mobile/touch/keyboard selection of new instances, guidance and pending acknowledgement.

Keep all three opening recovery paths, scaling/routing and data/cache/contrast journeys passing. Use deterministic fixtures, not production-only shortcuts. Run frontend lint/typecheck/unit/coverage/balance/build/CI E2E under Node 22; run existing non-destructive backend checks as repository guidance requires without applying drafts or generating DB migrations.

# 13. Human-test protocol

Prepare approximately five target-user sessions on one recorded build/configuration, with identified workload profile. Separate fresh/returning users, recruited testers and organic sign-ups. A same-company Data Strategy entry fixture is acceptable when prior stages would consume the session; record it as setup rather than player progression/replay.

Observe before coaching: expected/actual request-to-install-to-routing timing, first evidence/response, remaining DB pressure, rejected demand, interpretation of scale-in and cost tail, active/wall durations, failures/quits, confusion and intervention. Collect enjoyment 1–5 and spontaneous replay/continuation interest before prompting.

Ask: “When did extra capacity become useful?”, “What could automation change?”, “What remained constrained?”, and “Why keep or remove capacity after the spike?” The primary question is whether players can explain delayed app-only automation and its cost/headroom trade-off using evidence. Do not prescribe autoscaling or cache/database solutions.

Counterbalanced manual/automatic comparisons are permitted but must be labeled prompted evaluation, not spontaneous replay. Report missing/negative outcomes honestly. This is not the later learning-evaluation cohort. Actual deployment and human results remain NOT TESTED until performed.

# 14. File plan and reuse

| Responsibility | Existing extension points |
| --- | --- |
| Types/stage/policy/actions/snapshots/accounting | `frontend/src/sim/campaignTypes.ts`, `types.ts`, existing balance/config modules |
| Continuation/unlock/deployment/retirement | `frontend/src/sim/actions.ts`, `turn.ts` campaign dispatcher |
| Traffic/controller/processing/economy/recovery | `frontend/src/sim/step.ts` and current snapshot/report helpers |
| Tech availability | Existing tech IDs/config and campaign selectors in `derive.ts` |
| Lifecycle/selection/pause | `frontend/src/game/store.ts` |
| Save/validation/migration | `frontend/src/game/persist.ts`, `saveMigrations.ts` |
| Local event projection/export | `frontend/src/game/telemetry.ts` and existing archive |
| Guidance/evidence/actions/scene | `CampaignUI.tsx`, `Game.tsx`, `scene/Facility.tsx`, `index.css` |
| Coverage | Existing simulation/store/persistence/phase tests, `App.test.tsx`, `frontend/e2e/` |

A small `trafficSpikes.ts` configuration/pure-helper extraction is justified only if existing scenario/step modules become unclear; it uses the same scheduler/engine. Focused autoscaling/migration tests and a playtest protocol may be extracted from existing equivalents. Do not automatically create new TechTree/ProgressionStore/save adapter/renderer/telemetry systems.

Order: checkpoint/fresh baseline → stage/types/schema → pulse events → controller/routing/retirement/accounting → forward unlock/completion → existing UI/Facility → telemetry → regression/balance/E2E/accessibility → implementation report and review. Develop migration/transition tests alongside those changes.

# 15. Definition of Done

Report PASS / FAIL / NOT TESTED per item with evidence; unchecked items are requirements, not current claims.

- [ ] Phases 1–4 regression behavior and historical saves remain intact.
- [ ] Explicit same-company entry preserves state and exposes factual prerequisites.
- [ ] Pulses start/end once at the specified physical steps.
- [ ] Nine identities retained; forward research awards/spends once without retroactive gates.
- [ ] Deployment, thresholds, provisioning, routing, cooldown and limits follow deterministic rules.
- [ ] Installed/routed capacity and controller blocked decisions are visible.
- [ ] Safe scale-in preserves work, protected investments, IDs and exact cost exposure.
- [ ] Manual/prevention paths remain valid; automation cannot silently repair DB constraints.
- [ ] Recovery/reports/completion acknowledgement continue the same company.
- [ ] Schema 5, source backups, unsupported data/reset/paused reload checks pass.
- [ ] Local telemetry distinguishes player/controller decisions and preserves prior event/export semantics.
- [ ] Existing guidance/Facility/shared selection/mobile/accessibility checks pass.
- [ ] Node 22 checks recorded with baseline warnings/skips identified.
- [ ] Guest gameplay/save/export works with backend unavailable.
- [ ] Balance comparisons and human protocol ready; actual results reported honestly.
- [ ] Deployment/build verification and human sessions evidenced or NOT TESTED.
- [ ] No deferred auth/cloud or Phase 6 mechanics introduced.

# 16. Exclusions and release boundary

No app failure, unhealthy routing, health checks, redundancy/standby, failover, failure injection or reliability incidents. Reliability identities remain locked; no usable Phase 6 continuation.

Also exclude another campaign/progression system, tenth tech, full all-node research economy, new DB/cache equations, retuned Phase 1–4 costs, random incident families, arbitrary routing/policy editor, renderer replacement, account/session/OAuth integration, cloud writes/owner binding/revision conflicts/account switching, or production proxy/cookie changes.

Keep the auth/cloud stash unapplied. Account/cloud usability remains required in its separate release workstream; this contract neither waives final-MVP requirements nor claims the old PR2 account goal complete. Local schema 5 needs no backend schema generation or migrations.

This reconciliation changes documentation only. Implementation, fresh baseline, deployment and participant contact remain separate authorized work. Stop for review before implementation or Phase 6.
