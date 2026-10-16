# Phase 7 — Combined Campaign and Balance

> **Project:** 99.99% — System Design Tycoon
> **Reconciled:** 11 October 2026
> **Target:** 27–30 October 2026
> **Status:** Repository-reconciled implementation contract proposed for approval; implementation and validation outstanding
> **Foundation:** Completed Phases 1–6, one continuous local company, save schema 6
> **Learning outcomes:** LO1 Diagnose bottlenecks; LO2 Choose scaling strategies; LO3 Improve reliability; LO4 Weigh design trade-offs

# 1. Authority and repository reconciliation

Read this contract with `docs/PROJECT_PROPOSAL.md`, `docs/DEVELOPMENT_ROADMAP.md`, `docs/CURRENT_GAME_LOGIC_AND_FLOW.md`, the approved Phase 1–6 contracts, and the Phase 5/6 implementation reports. Actual implemented behavior takes precedence over older planning assumptions. Later user-approved revisions take precedence over this proposal.

Inspection checkpoint: `C:/Users/user/99.9-Percent`, branch `ai/phase-6-reliability`, HEAD `450332f94aa96f96c8af251ef364082308630890`, initially clean. The auth/cloud draft remains in stash `44b80f65b9644bfceeda3107d0d32e3077ce94bc`, unapplied. This reconciliation edits only this document. It does not implement, retune, run a baseline, stage, commit, deploy or validate Phase 7.

The committed Phase 6 report records 396 passing unit tests, one optional TRACE skip, 14 balance tests, 27 E2E journeys without retries, 18 backend tests and 23 unchanged frontend lint warnings, with typecheck/coverage/build/whitespace PASS. These are historical checkpoint results, not a fresh Phase 7 baseline. Human sessions, deployment and full accessibility acceptance remain NOT TESTED.

## 1.1 What exists and what changes

| Concern | Actual repository after Phase 6 | Phase 7 decision |
| --- | --- | --- |
| Campaign | Opening → Scaling → Data → Spikes → Reliability; same run throughout | Add one explicit continuation, not a replacement campaign controller |
| Opening | Reactive recovery/report and preventive full-demand/inspection routes share milestone acknowledgement | Preserve both routes and their guardrail |
| Reliability exit | Outcome acknowledgement returns to paused management; no late-game state or final success exists | Add explicit **Continue to company growth** after acknowledgement |
| Users | `step.ts` projects 2,000, CampaignUI displays 2,000, save validator requires 2,000 | Introduce an explicit versioned registered-user/demand model only in the new continuation |
| Final target | Legacy `BALANCE.targetUsers=50_000` belongs to the inactive weekly game | Use saved configurable target in the active campaign; no legacy deadline win condition |
| Events | Saved stage-specific growth/pulse/fault schedules | Add a small saved scenario sequence; do not replay completed teaching events |
| Autoscaling | Continues operating beyond its lesson, but traffic preview refers to Phase 5 pulses | Feed actual combined workload into observation and retirement previews |
| Reliability | Real health, probes, routing, spare and failover; promotion logic references the teaching fault | Reuse those mechanics with a shared current-fault query; preserve the historical exercise |
| Engineering | One pending infrastructure action, separate admission/routing constraints and failover precedence | Reuse these constraints; no engineering points or staff simulator |
| Tree | Nine nodes already rendered; earlier ownership derives from real infrastructure, later research is saved | Preserve IDs and ownership; no retroactive research prices or new tree |
| Scaling affordability | Solvent inefficient architecture can fail the mandatory DB-headroom gate indefinitely | Add an explicit risk-consent alternative; preserve the ordinary preparation path |
| Reports | Causal incident reports, prevention review and stage recognition already exist | Extend their evidence and presentation; never fabricate an incident |
| Scorecard | Legacy weekly report is unsuitable; campaign snapshots retain only the latest 600 | Derive finances from campaign ledgers and add prospective service counters with historical coverage labels |
| Replay | New run ID, archived evidence, default seed reused | Keep reset/archive flow; select and save a fresh seed at the application boundary |
| Auth/cloud | Deferred; not part of current guest flow | Not a Phase 7 dependency or deliverable |
| Maintenance / deployment risk | Inactive legacy code, no general active failure-risk model | Defer; bounded deterministic app faults suffice for this release |

The old Phase 7 goals of continuity, contextual strategy, configurable target, scorecard, replay and bounded combined pressure remain valid. Its guessed module paths, cloud prerequisite, calendar deadlines, automatic activation of promotions/maintenance/testing, broad retuning and implied new progression/research systems are replaced by this contract. Phase 6's deferral of all-node research scarcity to Phase 7 is narrowed here: review pacing and branch usefulness, but retain existing earned/spent rules instead of imposing a new all-node research bill.

`CURRENT_GAME_LOGIC_AND_FLOW.md` describes the prior campaign and is useful background; its older locked-Reliability description is superseded by the Phase 6 implementation. The current progression strip also retains a hard-coded locked **Stay Online** label despite active Reliability. Correct that existing presentation inconsistency when integrating Phase 7, using actual stage state.

## 1.2 Existing continuity and timing

Same-company transitions preserve run ID, origin/seed, physical step, cash/settlement remainders, queues, installed infrastructure, routing, admission limit, pending work, tech ownership, trace, reports, onboarding preference and session evidence.

Consumed Opening/Scaling/Data growth does not recur. Phase 5's two pulses end permanently after their saved deadlines. Phase 6's armed teaching fault occurs once and ends on restoration. Processing, cache warmth, admission, salaries/upkeep, settlements, health probes and a deployed enabled autoscaler continue after their teaching stage. Failover must be generalized to the current fault before new faults are usable; its existing exercise reference is not a generic late-game scheduler.

| Stage | Physical timing currently implemented | Required decisions / pacing pressure |
| --- | --- | --- |
| Opening | Growth at step 4; unmitigated incident at 6; DB response can recover at 14 | Inspect/respond, acknowledge report, acknowledge milestone; preventive route needs both inspections and five fresh stable full-demand steps |
| Scaling | First ready step schedules growth three steps later; readiness includes DB ≥2,000 | Prepare capacity/routing and acknowledge actual reports; spending before headroom can stall indefinitely |
| Data | Ready growth scheduled three steps later; cache warms by 12 percentage points per eligible step | Choose workload response, app preparation, optional contrast and explicit continuation; costs may require real settlement income |
| Spikes | Entry-relative boundaries +8/+28/+48/+68; earliest healthy completion at +72 | Two pulses, optional research/deployment/control, reports and explicit recognition |
| Reliability | Preparation time is player-controlled; armed fault starts +8 and naturally restores +28; five subsequent stable steps | Arm explicitly; restore manually or observe checks/spare/failover; reports then outcome acknowledgement |
| Proposed combined stage | Three player-started rounds, each with eight-step warning, bounded pressure and five fresh stable observations | Preparation, contextual response, reports/round acknowledgements, final review and optional replay |

These are physical seconds, not player-session durations. A prepared natural-restoration Reliability path can reach recognition around arm +32; actual incidents, report reading and preparation extend it. Manual restoration can shorten failure exposure. Existing headless fixtures deliberately earn revenue through step 180; that is fixture strategy, not a mandatory campaign wait. Healthy prerequisite completion can prevent incidents. Do not force outages or idle time to fill a duration target.

The target's pacing impact comes from three growth rounds, not 48,000 per-user clicks or old 24-week deadlines. Observe actual active/wall durations in human tests; no full-campaign minute target is established by this reconciliation.

# 2. Goal, stage identity and explicit entry

Complete the playable arc:

```text
Same company through First Growth / Scale Your App / Data Bottlenecks
→ Survive Traffic Spikes → Stay Online
→ Grow the Company → final review → Campaign Complete → inspect → optional new run
```

Learning intent: diagnose changing app/data/surviving-capacity constraints, choose between paid capacity and demand reduction, and weigh delayed automation, spare capacity, rejection and operating cost. Multiple architectures must finish; equal scores and zero incidents are not required.

New continuation identity: **`combined-campaign` v1**. Player-facing stage: **Grow the Company**. Origin remains `opening-db` v1. Its target, selected sequence and balance configuration are saved at entry, never silently overwritten from a newer build.

**Continue to company growth** is a zero-step explicit action. Require:

- Existing Reliability stage completed and acknowledged; no combined stage already exists.
- Management, positive cash, no active incident, and Opening/spike recognitions acknowledged.
- All actual incident reports acknowledged; no pending prevention/reliability review or recognition.
- Healthy measured snapshot under existing strict recovery thresholds; all app/DB queues empty.
- No active failed app or pending infrastructure/admission/routing/failover action.
- Current teaching traffic has returned to its 2,400 req/s baseline.

No cache, autoscaling, checks, spare, failover, additional research spend or particular architecture is mandatory for entry. An active traffic limit is preserved; guidance explains that later growth-round proof and final completion require serving full baseline demand. Entry preserves all resources, grants none, stays paused and creates no incident. Repeated entry/reload is idempotent. Pending accepted actions are never cancelled to make entry possible.

# 3. Users, demand and final target

## 3.1 Versioned model

Use **registered users** as campaign growth opportunity, distinct from incoming requests, admitted traffic and successful service. Existing stages retain their 2,000-user projection and exact request rates. Combined entry starts at 2,000 registered users; it does not invent earlier growth.

Saved configuration `combined-campaign` v1:

| Parameter | Proposed value |
| --- | --- |
| `finalUserTarget` | 50,000 |
| Initial registered users | 2,000 |
| Baseline demand endpoints | 2,400 → 3,000 req/s |
| Growth rounds | 3 |
| Baseline workload | 80% reads / 20% writes, all reads eligible |
| Warning interval | 8 physical steps |
| Stable observations between rounds / before final review | 5 fresh physical steps each |

For integer target `T`, require `T ≥ 2,008`, representable safe-integer products and strictly increasing round targets. The three targets are:

```text
U1 = 2,000 + floor((T − 2,000) × 3 / 8)
U2 = 2,000 + floor((T − 2,000) × 11 / 16)
U3 = T
baseline(U) = 2,400 + floor((U − 2,000) × 600 / (T − 2,000))
```

At `T=50,000`, users progress 2,000 → 20,000 → 35,000 → 50,000, with baselines 2,400 → 2,625 → 2,812 → 3,000 req/s. This mapping is a documented gameplay abstraction, not real customer behavior. Growth is applied once at each round's pressure-start boundary. Serving requests does not increment users individually. A promotion does not bypass these targets.

At full final baseline, two large routed apps provide 3,200 req/s and a 3,000 DB can support all operations without a cache. Three base routed apps provide 3,000 req/s; a warm tuned read cache can reduce DB demand to 1,200 ops/s. These are capacity examples, not validated full-run strategies: fault response, equal-share routing, cash and acquisition timing still require tests.

## 3.2 Central completion predicate

Reaching the target alone records `final_target_reached` once; it does not end the run. Final review becomes available only when:

- Users ≥ saved target; all three rounds completed and explicitly acknowledged.
- Cash >0, management, no active incident, failed app, temporary scenario pressure or promotion.
- All actual reports and earlier recognitions acknowledged; all queues empty; no pending actions.
- Five **new** baseline physical observations after the last round acknowledgement meet strict measured health, positive completed outcomes, full admission and zero rejected requests, with no traffic limit.

Unhealthy/limited/interrupted qualification resets this final streak; rereading UI or repeated save calls cannot increment it. Pausing/reload preserves its count without counting offline time. The last round's observations cannot also count as these five final observations.

The full-demand requirement makes growth success meaningful: 50,000 registered users with only 500 admitted req/s is not proven capacity. It adds to, rather than replaces, target + solvency + no incident. Keep the predicate in the existing pure engine; guidance projects it without independently inventing gates.

Once qualified, pause for final review. Explicit **Complete campaign** acknowledges the frozen review and records success exactly once, with no step, money or research. Use the existing end-state mechanism with an explicit campaign success/failure reason; do not apply legacy deadline/grade logic. Bankruptcy on a settlement step precedes qualification. Completed architecture/tree/history/scorecard remain inspectable; time and paid actions stay stopped. Closing the review is not completion; guidance offers reopening. New run is separate and confirmed.

# 4. Small deterministic scenario pool

Three templates, one of each per combined run. Configuration below is proposed Phase 7 balance, not a claim of tested viability.

| Template | Active workload / traffic | Duration and physical effect |
| --- | --- | --- |
| `read-growth-pulse` | 80/20 reads/writes; absolute incoming peak chosen from 3,800 or 4,000 req/s | 12 or 16 steps; exposes app capacity and cache benefit |
| `write-pressure` | 20/80 reads/writes; absolute incoming 3,000 req/s | 12 or 16 steps; cache benefit falls, writes reach DB |
| `failure-under-load` | 80/20 reads/writes; absolute incoming peak 3,400 or 3,600 req/s | Elevated traffic for 12 or 16 steps; one real serving app fails at pressure start, naturally restores 20 steps later unless manually restored first |

All peaks exceed the round's ordinary baseline. Pressure intervals are half-open `[startStep, endStep)`. On end, restore that round's saved baseline and 80/20 workload. User growth remains; traffic does not return to the previous round's baseline. Cache warmth is preserved, not reset by profile changes.

Select a permutation of the three templates using the existing seeded RNG **once at entry**. Then draw allowed magnitude/duration values in saved sequence order. Persist selected parameters, generation version, RNG result and stable event IDs. Do not reroll at start, reload, failed action, changed architecture or repeated projection. Evaluation fixtures may pin an explicit valid sequence, labelled evaluation; normal replay cannot overwrite it.

No general random failure hazard is introduced. For the failure template, choose the highest numeric ID among current healthy **configured routed serving** apps at explicit round scheduling; save that target before the warning. Subsequent routing changes do not reroll it. Prevent its retirement until this fault resolves. It remains a real installed app and can be unrouted by a player. If the player reroutes beforehand, do not manufacture failed traffic or another target. Spares and already failed instances cannot be targets. No DB/network failure or second simultaneous app fault.

Fault structure, frozen queue behavior, manual restoration, natural restoration, probes, safe spare promotion and route collision rules reuse Phase 6. Detection is not rerouting; rerouting is not invented capacity. Keep the Phase 6 teaching fault/history intact. Restoration must work after traffic pressure ends, and no recognized fault can be left without a restoration deadline.

# 5. Round sequencing and concurrent pressure

At entry, display the next round's general operating context, not exact hidden fault IDs or deadlines. Offer **Start next growth wave** when management is stable, cash positive, queues empty, all reports/previous round acknowledgement complete, no active failed app/pressure/promotion/pending action, and five fresh baseline observations prove full admission without a limit. Entry does not award these observations retrospectively.

Scheduling records `startStep = currentStep +8`, `endStep = startStep + duration`; the failure template records natural restoration at `startStep +20`. No step is consumed by scheduling. Show a broad warning and allow preparation; do not display exact future fault target or countdown. A previously accepted event executes at its saved boundary even if preparation subsequently becomes poor. Opening a menu or reload does not rebase it. Ended campaigns do not continue events.

Order within each physical step:

1. Apply due accepted actions with existing routing/failover precedence.
2. Apply due growth/workload/promotion boundaries and real fault/restoration transitions before admission/processing, preserving Phase 6 collision semantics.
3. Use one authoritative incoming rate, profile and effective route for physical processing/accounting.
4. Settle if due; bankruptcy wins over recovery/completion.
5. Observe incidents/recovery, controller decisions, round/final qualification, then record trace/evidence.

Only one primary template is scheduled or active. `failure-under-load` permits its one secondary traffic pressure; no promotion or other template overlaps it. An expired pulse may leave an incident/backlog that must resolve before another round. Promotions are allowed only between rounds and block new round scheduling until ended and service/report prerequisites are restored.

After all current pressure has ended, any fault has restored, actual reports are acknowledged and five fresh stable full-demand baseline management steps occur with empty queues/no pending actions, mark the round complete and offer **Review growth outcome**. Reuse existing read-only evidence/presentation primitives; this is a scenario outcome, not an invented recovered-incident report. **Continue company** explicitly acknowledges it. Actual incident reports remain separate and must be acknowledged first. No resource award. No automatic next wave.

Completion observations are new steps after the blockers clear; acknowledgement of a stale snapshot does not count. Deadlines are immutable physical deadlines. Pending outcome/review/recognition pauses the existing clock and is reachable outside History. Final qualification starts only after the third round acknowledgement.

# 6. Routing, autoscaling and reliability integration

Keep existing integer equal-share routing in numeric app order, base/large tiers, four-app maximum, installed-versus-routed distinction, frozen failed queues and empty-recipient failure accounting. Mixed capacity pools can still overload a smaller recipient. Do not add capacity weighting, automatic vertical upgrades or DB autoscaling.

Extend the existing traffic preview so processing, scenario boundaries, promotion boundaries and autoscaler retirement safety use the same saved next-step workload. Phase 5's completed pulse helper must not overwrite Phase 7 demand or evaluate retirement against obsolete 2,400 demand.

Keep Phase 5 thresholds, three-step automatic installation, next-step routing activation, four-step cooldown, protected manual/large apps and safe retirement checks. The controller cannot treat failed/unrouted installed capacity as useful service capacity. Compute its busy observation from actual effective healthy serving recipients in the current snapshot; reset streaks on invalid/empty observations and existing blocked/pending joins. Pending accepted work is not silently cancelled. Failure-target pinning prevents controller retirement before restoration. An armed fault does not suspend automation for the entire combined stage: retain explicit safeguards, and test controller/failover/manual route collisions. Do not change the completed Phase 6 exercise's suspension policy.

Use a shared current-fault query inside existing reliability helpers: current unresolved combined fault, otherwise the applicable teaching fault. Failover's expected-routing validation, one-step promotion, probe delay and manual restoration all consume it. Natural/manual restoration and conflicting player routing retain Phase 6 precedence. Never overwrite old fault evidence or promote twice from repeated checks.

# 7. Economy inspection and minimal balance scope

## 7.1 Current values to preserve initially

Starting cash is $20,000. Four fixed engineers cost $6,400 per 60 physical steps. Successful outcomes earn $0.20 each; settlement occurs exactly once every 60 steps. Pending revenue is not spendable before settlement. Purchases must leave positive cash. Admission rejection has no extra fine; opportunity value is rejected count × $0.20. Failed service earns no successful-outcome revenue.

| Infrastructure/action | Setup | Activation | Upkeep per complete 60-step period |
| --- | ---: | ---: | ---: |
| Base app, 1,000 req/s | $1,000 | 2 manual / 3 automatic steps | $700 |
| Existing app → 1,600 req/s | $2,000 | 3 steps | $1,100 total for that app |
| DB initial 600 ops/s | Initial architecture | Installed | $500 |
| DB 600 →1,000 | $3,000 | 3 steps | $1,500 total DB |
| DB 1,000 →2,000 | $3,000 | 3 steps | $2,500 total DB |
| DB 2,000 →3,000 | $4,000 | 4 steps | $3,500 total DB |
| Load balancer | $1,000 | 2 steps | $300 |
| Read cache | $1,500 | 2 steps | $400 |
| Cache tuning, ceiling 60% →75% | $1,000 | 2 steps | No additional upkeep |
| Autoscaling controller | $1,000 | 2 steps | $100, including disabled time |
| Health Checks | $500 | 2 steps | $100 |
| New base spare | $1,000 | 2 steps | $700; counts toward four apps |
| Reserve/release existing eligible spare | $0 | 1 step | Existing app upkeep continues |
| Automatic Failover | $1,000 | 2 steps | $100, including disabled time |
| Manual restore | $0 | 3 steps | Existing app upkeep continues |
| Limit/remove admission cap, 500 req/s | $0 | 1 step | No extra upkeep |

Upkeep exposure begins at activation and continues for idle, unrouted, failed and spare infrastructure. No setup refund on retirement. Keep cent numerators/remainders, settled revenue/costs and bankruptcy precedence unchanged.

At 800 full successful req/s, revenue is $9,600 per period. One base app +1,000 DB +staff costs $8,600. A large app plus an idle base app +1,000 DB +staff costs $9,700. A 500 req/s limit yields only $6,000 at the same installed costs. These are steady-period illustrations; real partial periods use recorded exposure/outcomes.

At 2,400 fully successful req/s, revenue is $28,800 per period. Even four large apps, 3,000 DB, LB/cache/controller/checks/failover and staff total $15,300 upkeep. Acquisition cash, failures, rejection and deadline timing still matter. This explains why blanket salary/revenue retuning is not justified before public-action strategy tests.

Phase 7 initially changes **only** the explicit Scaling consent policy, the new combined traffic/user configuration and new promotion price/duration. Do not silently retune starting cash, earlier growth, queue bounds, costs, capacities, recovery, lead times or settlement cadence. If future balance tests require such tuning, report the concrete failure and smallest proposed new version/configuration for approval before changing existing saved scenarios. Never silently rewrite old campaigns to new balance.

## 7.2 Scaling affordability resolution plan

Existing public-action regression in `game/campaignGuidance.test.ts` reproduces a solvent company at step 305 with $1,593.34, DB 1,000, a large App 1 and an idle base App 2. DB headroom 2,000 is mandatory to consume Scaling growth; its $3,000 setup is unaffordable. Removing the limit restores 800 admissions but steady costs $9,700 exceed $9,600 revenue. Waiting cannot fund the prerequisite. Manual/large apps are protected from automatic retirement, and there is no general sell action.

Root cause is the combination of prerequisite design, recurring cost and revenue ceiling. It is an irreversible **progression dead-end while still solvent**, ultimately bankruptcy if time keeps running; the existing guardrail explains it but cannot recover it. This is not corrected merely by removing the traffic limit.

Smallest proposed correction: preserve ordinary DB ≥2,000 readiness, but offer **Proceed with current headroom** before Scaling growth is consumed. Show current DB capacity, upcoming 1,400 req/s demand, possible service loss and cost exposure. Explicit consent records a saved policy/version and step, with one trace event; it costs nothing and advances no time. It waives only that DB-capacity prerequisite for scheduling/activation, not management/no-incident/empty-queue/report prerequisites. The ordinary three-step schedule and 1,400 event remain unchanged. No automatic waiver, cash grant, refund, price change, debt or fabricated completion.

Existing saves default to no consent. Treat this as a versioned progression-policy addition, not a rewrite of `application-scaling` v1 physical values. Its original default path must pass unchanged. Growth at current capacity can produce real overload and failure. A 1,000 DB can in principle earn $12,000 per fully busy period while rejecting/failing excess through the actual engine, exceeding the example's $9,700 costs; **public-action tests must prove this particular company's recovery and ability to buy headroom without injected money**. That calculation alone is not validation. Keep limit removal, inspection, investments, restore/review and confirmed restart accessible.

Tests must reproduce the exact historical trap, preserve no-consent behavior, accept consent once, simulate real outcomes/settlements, reach affordable investment and Data continuation, and reload before/after consent/growth. Bad purchases may still lose the company; do not promise universal rescue for every reachable architecture. Any remaining solvent non-progressing case must have factual cost/service guidance and explicit loss/restart options, and be documented rather than called solved.

# 8. Management controls and research decisions

## 8.1 One optional promotion

Retain a small **Run promotion** control only in combined-stage baseline management between rounds:

- Require positive cash after a $500 setup payment, no active/scheduled scenario, promotion, incident, failed app, pending review/action, or active cooldown; healthy empty queues and reports acknowledged.
- Request uses the existing infrastructure slot; activates after one physical step. Request and activation are distinct trace events.
- Add **400 incoming req/s** for **12 physical steps** `[activationStep, activationStep+12)`, with current baseline 80/20 workload.
- End automatically at the saved deadline; begin a **30-step cooldown from end**. No stacking or renewal. A promotion blocks new growth-round scheduling until it ends and prerequisites recover.
- No revenue multiplier, user award or technology unlock. Actual extra successful work earns the existing $0.20. Maximum extra gross revenue is $960 if all 4,800 additional requests succeed; failures/rejections/upkeep reduce benefit. Setup remains paid even if the player later limits admission.
- UI shows cost, demand increment, duration, accepted activation countdown, active demand and cooldown. It never promises profit or recommends an incident solution.

Persist request/activation/end/cooldown and paid cost; reload does not extend them. Bankruptcy terminates further processing. Normal processing alone decides overload/incident/recovery. At most this one pressure exists between rounds. Its purpose is optional revenue opportunity versus real capacity risk, not a marketing simulator or mandatory resource grind.

## 8.2 Explicit deferrals

**Maintenance:** defer. The current model has a deliberately armed deterministic failure, not a general failure probability to reduce. Adding risk debt/hazard and a maintenance subsystem is unnecessary for three interpretable scenarios. Manual restore is not relabelled maintenance, and spare capacity is not a failure-risk reduction claim.

**Safe/normal/risky deployment:** defer. Preserve accepted activation delays and deterministic physical failures. Random deployment faults/testing policies would add a new decision family and migration burden without being needed for completion. Inactive legacy release/debt/engineer-week code stays inactive.

**Engineering capacity:** existing one infrastructure slot plus separate admission/routing constraints is the release model. Actions occupy it until activation; failure does not secretly release it. Promotions use that slot. No new staff allocation, engineering points, salaries or concurrent deployment allowance.

These are explicit scheduling differences from the older roadmap/Phase 7 plan. Neither maintenance nor deployment risk is a hidden DoD requirement for this narrowed contract.

## 8.3 Nine technologies and research pacing

Preserve exactly these IDs:

| Branch | IDs |
| --- | --- |
| Capacity | `larger_servers`, `load_balancing`, `autoscaling` |
| Data | `larger_database`, `caching`, `cache_tuning` |
| Reliability | `health_checks`, `standby`, `auto_failover` |

Phase 5 grants one forward research point; Phase 6 grants three. Preserve the current single derived balance across those stage earned/spent fields, saved reliability-owned IDs and paid deployments. No Phase 7 point award or new research currency. Earlier physically achieved technologies stay owned without retroactive spend. Larger Database ownership remains derived from actual DB upgrade evidence; no save mutation, grant or charge. Owned/unlocked/deployed/disabled remain distinct.

Branch usefulness must be tested contextually: a cache helps reads more than writes; DB headroom helps both; automation cannot fix DB load; failover needs spare capacity; vertical scaling can avoid automatic provisioning but cannot remove failure exposure. It is acceptable for a technology to be optional in a successful strategy. Do not make buying all nine the final-success condition. If tests show a universally mandatory/useless node, report the evidence and proposed bounded tuning before adding scarcity or altering earlier ownership. Research arrival is currently concentrated at two explicit entries; provide readable tree/context and avoid extra unlock spam, not invented rewards.

# 9. Campaign guidance and presentation

Extend `campaignGuidance.ts`, CampaignUI and the existing progression strip. Stage states derive from existing acknowledgements plus combined state. Correct Reliability current/completed status; show Grow the Company current/available-next/locked, and Campaign Complete only after final acknowledgement. No parallel progression registry.

Guidance shows:

- Current objective, registered users/target and ordinary baseline demand.
- Active traffic/workload/failure pressure, installed/routed/healthy/spare capacity and relevant actual evidence.
- Factual round readiness, full-admission requirement, report/review blockers and next action.
- Financial warning for limit-driven losses or unaffordable prerequisites; no guaranteed-profit promise.
- Visible actual postmortem, growth-outcome and final-review buttons outside History, including after reload.

Keep Campaign guidance / System evidence / Actions separation, shared Facility/dependency selection, per-instance metrics, cache warmth/hit rate, DB demand/capacity, queues, processed/failed outcomes, latency and errors. Keep **Stable — traffic limited**, incoming/admitted/rejected and opportunity value; this is not a fine. Existing metric units and countdowns remain.

Warnings communicate the kind of upcoming pressure without disclosing hidden exact fault target/deadline. The designer contract may list exact rules; player UI must not expose raw scheduler internals. Accepted player deployment countdowns and active promotion duration are intentionally visible. No prescribed purchase, quiz, automatic repair or auto-completion.

On final success/failure, retain evidence/tree/architecture inspection and JSON export, with separately confirmed new run. Mobile supports stage guidance, outcome/scorecard, action selection and touch; keyboard focus/trap/restoration and color-independent states require recorded checks. Preserve office, camera, renderer, store, clock and modal primitives.

# 10. Authoritative scorecard

Extend actual campaign accounting and evidence; do not mount legacy `sim/report.ts` weekly grades or use legacy `s.totals` as campaign history.

| Field | Source / meaning |
| --- | --- |
| Users reached / target | Saved registered users and combined target; distinguish pre-combined fixed 2,000 |
| Uptime | Healthy eligible physical steps / eligible physical steps, with measurement scope |
| Revenue | Settled cumulative campaign revenue; separately show pending successful-outcome revenue |
| Infrastructure spending | Cumulative paid infrastructure setups plus settled app/DB/LB/cache/controller/checks/failover costs; promotion and salaries separately itemized |
| Largest outage | Longest contiguous span of degraded eligible service steps, measured in modeled seconds |
| Rejected demand | Authoritative cumulative rejected requests; opportunity value ×$0.20, not added cash cost |
| Final architecture | Frozen real apps/tiers/health/roles/routing/LB/DB/cache/controller/checks/failover |
| Additional evidence | Cash, actual incident count, tech ownership versus deployments, recurring-cost projection and source run/build/config identity |

An eligible service step has positive incoming demand. A healthy eligible step uses existing strict measured thresholds (latency <500 ms, errors <1%, positive admissions and completed outcomes). Zero delivered service is unhealthy, not excluded to inflate uptime. Deliberate rejection is reported separately and does not become a service error. Largest outage uses the same degraded-step definition; do not substitute incident duration or sum rejected demand under that label. State that this is a gameplay metric, not production SRE uptime. Paused/hidden/offline time is not simulated uptime.

Exact whole-run uptime/largest-outage cannot be reconstructed from the last 600 snapshots; metrics trace references are not full observations. Add minimal engine counters for eligible/healthy steps, current/longest degraded span and measurement start/scope. New schema-7 companies accumulate from the first physical step. Migrated companies start prospective measurement at their next physical step and explicitly label **since upgrade/resume**, with earlier whole-run uptime/outage **unknown**. Do not manufacture historical zeros, infer hidden snapshots or relabel partial history as full-run. Also provide a separate exact combined-stage window where useful.

Capture a read-only scorecard at final acknowledged success or bankruptcy from authoritative counters/ledgers/architecture, preserving source IDs and known/unknown provenance. Final-review values cannot change while the paused review is pending. For failures before combined entry, target may be not applicable. A scorecard is not an incident postmortem and does not acknowledge old reports automatically. No opaque overall grade.

# 11. Persistence and replay

## 11.1 Schema decision

**Schema 7 is required.** Schema 6 validation constrains users to 2,000, known stage shapes/configurations/actions and existing terminal state. Combined sequence/deadlines, real user target/progress, consent, promotion, service counters and success/scorecard state are not safely introduced by only changing initialization.

Extend existing types, `persist.ts`, migration registry and validation dispatch together. Keep `nn.campaign.save.v1`, `nn.campaign.meta.v1`, `nn.campaign.analytics.v1` and legacy browser keys. Migrate `v1 →v2 →v3 →v4 →v5 →v6 →v7`, with exact-source-byte versioned backup before validated replacement. Backup, validation or write failure preserves the source. Future/corrupt saves remain protected and exportable. No production database migration or cloud binding.

Minimal responsibilities:

- `combinedStage: null | {id, version, configuration, enteredStep, users, sequence, nextRoundIndex, scheduled/activeRound, completedRounds, roundAcknowledgements, readiness/finalStableSteps, finalReview, acknowledged}`.
- One versioned Scaling risk-consent record, absent/no consent on migration; no rewrite of earlier physical configuration.
- One promotion record containing accepted action identity, payment, activation/end/cooldown deadlines and state.
- Prospective service-measurement counters/scope; terminal success/failure scorecard state.
- Existing session/replay context extended only where needed for source linkage; timestamps remain outside deterministic physics.

Exact discriminated unions must reject impossible overlap, invalid targets/round indices, duplicate event/acknowledgement identities, invalid fault target/restore deadline, negative counters and inconsistent terminal state. Validate all chosen bounded configuration values and safe integer arithmetic. Round action scheduling and reset behavior remain in the existing engine/store, not a save adapter.

Schema-6 migration initializes no combined stage, no promotion, no consent, no campaign success and unknown historical measurement coverage. Preserve every existing queue, pending action/deadline, cash/remainder, consumed event, health observation, fault/restoration, milestone, research field, trace/report and scenario version. Never auto-enter, award users/research, fabricate scorecards or complete older runs. Every pending review/streak/round/fault/promotion/target state must resume paused without rebasing or offline catch-up.

## 11.2 Replay and archived evidence

Reuse existing confirmed `newRun`, run-evidence archive and local export. A replay creates a fresh run ID and a newly selected seed at the application boundary; choose it once, persist it, and keep all physics seeded. Ensure it differs from the prior normal replay seed. Fixed evaluation can explicitly pin a recorded seed. Same seed + same decisions/config remains reproducible.

Bounded variation is existing Data profile plus combined scenario order/allowed peaks/durations. Do not vary starting cash, earlier growth, salaries, cache eligibility or core rules in this version. A different seed can still yield the same bounded scenario configuration; do not promise every replay is unique.

Before replacing the active slot, retain prior scorecard and linked full campaign evidence in the existing analytics/export archive by stable run identity. Archive failure must preserve the old active save and in-memory evidence, show the failure and offer export; never silently discard an unexported completed or failed run. Download is not cleanup. Preserve onboarding preference and existing legacy data. There is no account identity/owner switching in this guest workflow.

Continuation uses the same run ID. Replay uses a new ID linked through existing `replayOf`; reset alone does not prove voluntary replay. Separate observer prompted/recruited context and subsequent actual player decisions. Cloud attachment/upload/resume/revision conflicts remain deferred and stashed.

# 12. Local telemetry

Extend existing trace projection and archive. Attribute event/run/session/build, origin and continuation versions, physical step, wall/active timing and payload. Physical IDs derive from run + trace identity; UI scorecard/replay events use persisted session sequence. Project batched steps without dropping intermediate events, deduplicate reload/retry/StrictMode and preserve staged records on archive failure.

Required occurrences:

| Event | Required distinction / payload |
| --- | --- |
| `late_game_entered` | Explicit entry once; saved target/config/sequence identity |
| `scaling_growth_risk_accepted` | Explicit consent, policy version, DB/demand/cash evidence; not an upgrade |
| `scenario_scheduled` / `scenario_started` | Request/warning versus actual boundary, round/template/config, intended/actual step |
| `scenario_pressure_ended` / `scenario_completed` / `scenario_acknowledged` | End of pressure versus measured baseline completion versus player acknowledgement |
| Existing workload/fault/detection/route/restore/controller events | Actual causal effects and target, player versus scheduled/controller origin; no duplicate old/new names |
| `promotion_requested` / `promotion_started` / `promotion_ended` | Paid acceptance versus activation versus actual end; increment, payment, deadlines |
| `final_target_reached` | Once at actual user target; not completion |
| `campaign_completion_qualified` / `campaign_completed` | Final measured review eligibility versus explicit acknowledged success, once |
| Existing `run_failed` plus scorecard evidence | Bankruptcy once, actual settled finances and coverage scope |
| `scorecard_viewed` / `replay_started` | Actual UI visit/new-run entry; linked old/new IDs, source seed/context |

No maintenance event or remote telemetry. Scorecard export includes known/unknown historical scope, linked traces/reports and session/build configuration. Active versus wall durations retain hidden/offline semantics. No relabelling migration history as new completion, invented human enjoyment or automatic-controller action counted as voluntary replay.

# 13. Repository file plan and implementation order

Extend first:

| Existing files | Responsibility |
| --- | --- |
| `sim/campaignTypes.ts`, `sim/types.ts`, `sim/step.ts` | Saved continuation/configuration, public actions, traffic/user projection, central outcome and counters |
| `sim/scenarios/*` | Existing constants preserved; bounded combined configuration |
| `sim/autoscaling.ts`, `sim/reliability.ts` | Actual workload previews/current fault, safe controller/route/failover interaction |
| `sim/settlement.ts`, `sim/trace.ts` | Existing money/exposure, promotion classification, actual late-game causal evidence |
| `sim/tech.ts` | Existing nine-node derived ownership/balance/prerequisites; no new IDs |
| `game/store.ts`, `game/campaignGuidance.ts` | Existing clock/lifecycle, explicit outcomes/guardrail/local replay |
| `game/persist.ts`, `game/saveMigrations.ts`, `game/telemetry.ts` | Schema 7 chain, archive preservation, local attributed events/export |
| `components/CampaignUI.tsx`, `TechTree.tsx`, `scene/Facility.tsx`, existing CSS | Existing guidance/evidence/actions, tree/office selection, final inspection/scorecard |
| Existing sim/game/UI tests and `e2e/*` | Regressions plus combined completion/replay journeys |

Conditional small additions: `sim/scenarios/combinedCampaign.ts` for the saved pool/config; `sim/combinedCampaign.ts` if pure round/outcome helpers keep `step.ts` readable; a pure campaign scorecard helper if deriving it in existing reporting is unclear; campaign strategy fixtures under existing tests. These are helpers of the same engine, not new campaign/store/persistence/rendering systems. Do not create guessed `game/progression.ts`, another scheduler, or a parallel research module.

Order after separate implementation approval:

1. Review Git checkpoint/stash and establish a fresh Node 22 Phase 7 baseline.
2. Add state/schema/counters and backup/migration/unknown-history tests before UI integration.
3. Implement and validate the isolated Scaling consent policy against the exact public-action trap.
4. Add explicit combined entry, saved user/config/sequence and shared workload preview.
5. Integrate pool boundaries and existing health/controller/failover with collision/conservation tests.
6. Add round review, centralized final qualification/acknowledgement and scorecard.
7. Add optional promotion using the existing action slot and finances.
8. Extend guidance/tree/office and local telemetry/export/replay preservation.
9. Run public-action strategy simulations; assess viability and dominance before proposing any additional tuning.
10. Run full regression/browser/accessibility checks, prepare human protocol and report every DoD item.
11. Stop for review. No auth/cloud, deployment or Phase 8 implementation.

# 14. Automated and balance acceptance

## 14.1 Existing regressions

Preserve Phases 1–6: deterministic per-instance conservation/accounting, both Opening completion routes, all three original recovery choices, five-step strict recovery, postmortem/milestone acknowledgement, traffic limit/removal, salary/settlement precedence, onboarding, shared selection, tech ownership, schema 1–6 migration/backups, reload/session/export/deduplication, bankruptcy/restart, load-balancing/delayed routing, DB tiers, cache warmth/tuning/read-write contrast, both fixed pulses, controller installation/join/retirement, armed fault/checks/spare/failover/manual/natural restore and collision safeguards. Reliability exercise suspension remains unchanged.

## 14.2 New engine/store/persistence/UI tests

- Entry conditions separately; same company unchanged except explicit new state; no duplicate entry/research award.
- User-target arithmetic/config bounds and persisted version; old stages stay at 2,000; new demand never overwritten by old pulses/projection.
- Target reached during incident/pressure/limit/pending report/zero cash cannot qualify; exact final five fresh observations and explicit acknowledgement once.
- Every round request/start/end/restore/qualification/ack boundary, half-open duration, pause/batching/reload equivalence; no stale-snapshot observations.
- Saved seeded sequence/config and complete-state determinism for same seed/actions, evaluation pins and no reroll after architecture changes.
- All allowed scenario combinations/bounds; one primary + at most one secondary; no overlapping promo/round/fault; queues/reports block scheduling, not accepted interventions.
- Real fault target selection/pinning, no invented recipients, failed queues/outcomes and restored health; old teaching history stays intact.
- Autoscaler uses actual next-step demand/profile and healthy routed capacity; safe retirement around start/end/fault; manual routing, probe, promotion and restore precedence.
- Exact historical Scaling trap, unchanged default gate, explicit consent with real profitable service/settlement and Data continuation; no injected cash, bailout or automatic waiver.
- Promotion acceptance/cost once, pending slot, activation/duration/cooldown, real extra service/revenue, failure/rejection, no user/research award, reload and no double charge.
- Scorecard settled versus pending revenue, setup/operating/promotion/salary separation, exact uptime/outage counters, >600-step run, migrated partial/unknown history, zero service and failure scorecard.
- Schema 1–7 chain, exact backup bytes, unsupported/corrupt source preservation, failed backup/validation/write/archive; no invented old completion/config/research.
- Reload at pending wave, fault, round review, final streak/review, completed/failed scorecard and new-run boundary; new ID/seed/source link, no loss of old evidence.
- Guidance current/completed/available/locked states and corrected Reliability strip; factual blockers, full-admission trade-off, visible reports/outcomes, no hidden fault timing or prescribed purchase.
- Stable local telemetry identities through batched steps, retry/StrictMode/reload; final target versus completion, request versus activation, manual versus controller and continuation versus replay.

No tests for deferred maintenance/deployment modes or auth/cloud are implied.

## 14.3 Strategy fixtures and balance evidence

Existing `sim/__tests__/bots.ts` drives the inactive weekly game. Keep its legacy regression coverage; do not treat its reports as full active-campaign proof. Existing Opening/spike/reliability fixtures already use public campaign actions and real settlements; extend that convention with bounded campaign strategies.

Exercise:

- Vertical/mixed: two large routed apps, larger DB, manual failure response; optional spare without mandatory cache/controller.
- Horizontal/cache: balanced base apps, warm/tuned cache, moderate DB where sufficient, optional controller; DB response during write pressure permitted.
- Reliability-heavy/mixed: real spare/checks/failover with sufficient surviving **per-instance** capacity; ongoing cost explicit.
- Poor timing/inefficient spending: accepted risky growth/promotion, actual incident, recovery/continued campaign or honestly recorded bankruptcy.

At least two meaningfully different strategies must finish representative full public-action runs, not only final-state injections. Test all six pool orders and allowed peak/duration extremes for at least one viable response per configuration. Do not require every strategy to win every configuration or own every tech. Record seed, acquisition sequence, cash minimum, requests failed/rejected, activation delay, end architecture and scorecard coverage.

Review whether one exact sequence dominates all sampled conditions or some nodes never affect a decision. Heuristic/manual assessment is acceptable with evidence; bot completion is not learning/fun proof. If viability fails, reduce pool pressure/count or propose the smallest approved versioned adjustment before expanding infrastructure or granting cash.

# 15. Browser and check requirements

Representative CI E2E paths (retain all earlier journeys):

| Path | Required observable journey |
| --- | --- |
| A | Guest start → reactive or preventive Opening → existing stages → vertical/mixed combined rounds → final review → explicit success |
| B | Same continuous company through horizontal/cache-heavy decisions → actual warm-up/write response → complete |
| C | Reliability-heavy late-game fault → detection/rerouting/surviving capacity → restoration/recovery/report → continue |
| D | Explicit poorly prepared promotion/growth → actual overload/incident → measured recovery/report → later round |
| E | Final users reached while incident/pressure active → no success → recover/acknowledge → full-demand final proof → complete |
| F | Complete → inspect scorecard/tree/final architecture/history → confirmed new run → distinct ID/seed and retained previous export |
| G | Backend requests blocked throughout guest progression, completion/replay; no proxy/account dependency |
| H | Mobile/touch late-game controls, visible blockers/reviews, scorecard/replay and reload; keyboard/focus checks recorded separately |

Include reload during scheduled wave, fault/restoration, promotion, round review, final streak and pending/final completion. At least one journey is genuinely fresh guest entry through public controls; targeted advanced seeded fixtures must be clearly labelled and may not substitute for full-company paths. Scaling consent needs a focused public-control journey from its reproduced affordability state.

Under Node 22, run frontend `npm run lint`, `npm run typecheck`, `npm test -- --reporter=verbose`, `npm run test:coverage`, `npm run balance`, `npm run build`, and CI Playwright per `docs/testing.md`. Run installed backend's existing lint/typecheck/coverage only. Record exact commands/counts/coverage/warnings/failures, distinguish pre-existing issues, and run whitespace checks. No database generation/migration, dependency/audit fixes, deployment or stash application. Manually inspect desktop/mobile layout, evidence units, keyboard focus/trap/restoration and hidden future-timing leakage. Tests do not establish human understanding.

# 16. Human-validation preparation

Prepare a reusable full-campaign protocol after a reviewable implementation; sessions are separately arranged and never fabricated. Include returning users and some fresh users where time permits, recorded build/seed/scenario/target and recruitment context. Keep organic versus recruited and spontaneous versus prompted interest distinct.

Record company continuity, actual strategy/purchases, each stage/round outcome, cost/timing decisions, confusion/blockers, incidents/limits/rejected demand, active/wall duration, hint/facilitator intervention, failure/quit/technical interruption and missing responses. Observe voluntary continuation before prompting and actual new-run choice after scorecard; reset alone is not replay evidence. Ask enjoyment before coaching.

Post-play questions: Did this feel like one company? Which later decision differed from the Opening? Did workload, delay, cash or surviving capacity change your choice? Was any technology always necessary/useless? Why did you win/lose? Was complexity/duration manageable? Would you choose another strategy? Record a spontaneous replay request before directly asking.

Classify strategy only afterward. Report actual strategy diversity and dominant sequences, not a guaranteed success signal. Headless seconds and automated fixtures cannot validate campaign length, voluntary continuation, learning or enjoyment. Phase 7 preparation is not Phase 8's formal 20-person learning evaluation.

# 17. Definition of Done and release boundaries

Report each item **PASS / FAIL / NOT TESTED** with evidence; unchecked requirements are not completion claims.

## Continuous campaign and completion

- [ ] Phase 1–6 behavior/versions and both Opening routes preserved, with the explicit separately tested Scaling consent exception.
- [ ] Same-company Reliability → combined entry, three saved rounds, acknowledgements and final growth target work without reset.
- [ ] Full-demand measured final qualification is centralized; incident/limit/queue/review/insolvency cannot award success.
- [ ] Explicit final acknowledgement awards once, leaves inspectable architecture/evidence and stops the shared clock.
- [ ] Failure produces honest evidence/scorecard and separately confirmed restart.
- [ ] Guidance exposes every legitimate blocker/action, including the corrected Reliability stage and pending reviews after reload.

## Mechanics and balance

- [ ] Pool/configuration/sequence and all boundaries are reproducible, bounded and saved without reroll.
- [ ] One primary pressure and at most one secondary; no invalid promotion/scenario/fault overlap.
- [ ] Actual traffic/routing/health feed controller, retirement and failover safely; completed teaching events never overwrite late-game inputs.
- [ ] Promotion's exact payment, activation, demand, duration, cooldown and actual revenue consequences pass.
- [ ] Existing engineering slots and nine-node ownership/research are preserved; no new identities or retrospective charge.
- [ ] Exact Scaling affordability regression has a tested explicit recovery path without bailout or balance mutation.
- [ ] At least two different full public-action strategies finish; all bounded pool combinations have a viable response; dominance/useless-node review recorded.
- [ ] Any further tuning has explicit versioned approval and separate evidence; earlier saves are not silently retuned.

## Persistence, scorecard and telemetry

- [ ] Schema 1–7 validation/migration/backup failures preserve original/legacy data and all existing pending state.
- [ ] User target/progress, sequence, promotion, consent, faults, streaks and all outcome acknowledgements survive paused reload.
- [ ] Scorecard uses authoritative finances/architecture and explicit full/partial/unknown service history; no legacy grade or fabricated historical uptime.
- [ ] Local trace/UI events deduplicate, distinguish intended versus actual timing, and remain exportable under failed writes.
- [ ] Replay has distinct ID/seed, preserves previous evidence before replacement and does not depend on API/accounts/cloud.

## Engineering and human evidence

- [ ] Fresh Node 22 baseline and final frontend/backend required checks recorded, with exact counts and baseline exceptions.
- [ ] E2E A–H plus prior paths/reload/guest API-blocked coverage pass; focus/mobile/touch/manual limitations recorded honestly.
- [ ] Full-campaign human protocol/observer/export preparation ready.
- [ ] Actual separately arranged sessions record continuity, duration, strategy diversity, cost/timing, comprehension and spontaneous continuation/replay; NOT TESTED until evidence exists.
- [ ] No duplicate store/engine/renderer/persistence/progression system, auth/cloud application, deployment configuration or Phase 8 work introduced.

Maintenance and deployment/testing modes are deferred, not failed hidden requirements. Human/deployment/accessibility completion are separate evidence gates from an engineering checkpoint. Do not claim a tested live release from local checks.

# 18. Scope guard and Phase 8 handoff

Exclude new incident families, DB failover/replication/data loss, network/region/security faults, CDN, microservices, arbitrary queues/graph editing, simultaneous app-fault cascades, additional tech branches/tenth node, staff/marketing simulators, scenario editor, achievements, leaderboards, multiplayer and AI-generated events/reports. Preserve inactive legacy code without mounting its mechanics.

Auth/cloud/account ownership, Google/OAuth/session restoration, guest attachment, remote saves/telemetry, revision conflicts and production proxy/cookie configuration remain a separate deferred workstream. Do not apply its stash or make completion/replay depend on it. Guest local export must work with no backend.

Phase 8 owns formal evaluation, mechanics freeze, final usability/accessibility completion, security review, deployment verification, analytics-quality verification and STePS preparation. Phase 7 supplies coherent mechanics, reproducible balance evidence, truthful scorecards/export and documented limitations. Human observations may identify later polish; do not silently begin Phase 8 while completing this contract.

After implementation, report reuse/changed files, exact values/version decisions, Scaling remedy evidence, strategy viability/dominance, historical scorecard coverage, tests, deviations and every DoD status. Stop for review before Phase 8. This document update itself authorizes no implementation.
