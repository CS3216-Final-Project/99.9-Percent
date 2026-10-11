# Phase 6 — Stay Online: reliability and technology tree v1

> **Project:** 99.99% — System Design Tycoon
> **Target:** 23–28 October 2026; scheduling target, not completion evidence
> **Learning outcomes:** LO3 Improve reliability; LO4 Weigh trade-offs; reinforce LO1
> **Status:** Reconciled implementation contract; implementation, baseline and validation outstanding
> **Repository checkpoint inspected:** `ai/phase-5-progression`, `8be77e220b9b130cdcc6812a5975bd2127ca851a`, 10 October 2026

# 1. Authority and repository reconciliation

Read this with `docs/PROJECT_PROPOSAL.md`, `docs/DEVELOPMENT_ROADMAP.md`, the approved Phase 1–5 contracts, `docs/CURRENT_GAME_LOGIC_AND_FLOW.md`, `docs/phases/PHASE_5_IMPLEMENTATION_REPORT.md` and the Opening/UX/guardrail reports. Current campaign implementation and subsequent user-approved scope take precedence over stale roadmap assumptions. This document specifies future work; it does not claim Phase 6 is implemented.

Phase 5 is committed at the checkpoint above; the inspected working tree was clean. Its final recorded validation was Node 22.23.3: 340 unit tests passed, one optional TRACE skip, eight balance tests, 23 CI E2E journeys without retries, 18 backend tests, 23 unchanged frontend lint warnings and passing typecheck/coverage/build/whitespace. These are historical results; obtain a fresh Phase 6 baseline before implementation. Deferred auth/cloud remains in the unapplied `phase3-deferred-auth-cloud` stash, hash `44b80f65b9644bfceeda3107d0d32e3077ce94bc`.

## 1.1 What already exists

| Actual repository entry point | Foundation to extend |
| --- | --- |
| `sim/step.ts`, `campaignTypes.ts`, `types.ts` | One-second deterministic processing, per-instance queues, numeric equal routing, delayed actions, settlement, incidents and explicit continuation |
| `sim/autoscaling.ts`, `scenarios/trafficSpikes.ts` | Two consumed pulses, saved deadlines, four-app limit, controller ownership, protected investments, delayed join/retirement and explicit recognition |
| `sim/openingPrevention.ts` | Preventive Opening observations/outcome; original recovered-incident route remains valid |
| `sim/tech.ts` | Nine `TECH_ORDER` identities, three groups and prerequisite definitions; campaign-aware queries partially implemented |
| `components/TechTree.tsx` | Existing nine-node layout/icons/edges, but its current actions, prices, engineer-weeks and releases belong to the inactive weekly flow |
| `components/CampaignUI.tsx`, `Game.tsx`, `scene/Facility.tsx` | Active guidance/evidence/actions, pinned progression, explicit reviews/recognitions and shared selection; Three.js room retained |
| `game/campaignGuidance.ts` | Pure unsaved projection of existing gates; pending actions outside History, no automatic acknowledgement |
| `game/store.ts` | Single clock, pause/selection/lifecycle; currently rejects normal campaign navigation to the legacy tech view |
| `game/persist.ts`, `saveMigrations.ts` | Schema 5 local envelope, source-byte backups, schema 1–5 chain, paused resume and protected legacy namespaces |
| `game/telemetry.ts`, `sim/trace.ts` | Local attributed/deduplicated events and causal evidence |

The campaign is one company: First Growth → Scale Your App → Data Bottlenecks → Survive Traffic Spikes. No active health checks, failures, spare role, failover or Reliability entry currently exists. `AppInstance.state` is only `active`. Current schema-5 validation and processing assume all installed apps are active and routed membership equals configured targets. Research exists only as the Phase 5 earned/spent counters for autoscaling. Legacy `game.techDone`, engineer tasks and weekly release research are not authoritative campaign research.

## 1.2 Keep, replace and defer from the old Phase 6 plan

| Old requirement | Reconciliation |
| --- | --- |
| Capacity differs from reliability; detection, spare capacity and failover have distinct effects | Keep; these are the learning objective |
| Actual health differs from detected health and traffic routing | Keep; define exact transitions below |
| Temporary app failure, measured recovery and causal postmortem | Keep; integrate with the physical engine rather than legacy incidents |
| Examples with 600-capacity apps / 900 traffic | Replace with existing 1,000/1,600 apps and inherited 2,400 baseline; no earlier-stage retuning |
| Seeded/risky faults without exact schedule, prices or delays | Specify one bounded deterministic scheduled exercise; defer risky-deployment policy to Phase 7 |
| Complete all nine technologies | All nine must have real effects, not all nine bought by every player; no prescribed purchase gate |
| Generic `ArchitectureCanvas`, routing/progression stores, 2D view | Use Facility, dependency evidence, existing engine/store/guidance; no renderer replacement |
| Weekly research/task costs and old automatic replacement behavior | Do not activate; reuse identities/layout only and display actual campaign costs |
| Full technology-tree/research economy already delivered in Phase 5 | False: Phase 5 delivered autoscaling unlock only. Phase 6 owns tree v1; Phase 7 owns full pacing/balance |

Inactive `turn.ts`/`incidents.ts` contain weekly random degradation, DB failure, instant replacement/promotion, replacement charges and fabricated automatic downtime reports. `TechTree.tsx` dispatches legacy `start_tech` and shows engineer-weeks. These are unsuitable for the active physical campaign. Reuse names, assets, icons and presentation primitives where sound; do not call the legacy hazard/absorbFailure/incident recovery/task engines or activate DB replicas/backups.

# 2. Objective, player experience and boundaries

Teach **“Capacity is not the same as reliability.”** A failed app may remain in the route, health checks identify it, surviving capacity may still overload, and a spare contributes only when traffic reaches it. Failover creates no capacity. Autoscaling reacts to utilisation; it is not failure replacement. Redundancy has ongoing cost.

Phase 6 owns:

- One explicit same-company Reliability stage and one temporary app failure exercise.
- Health Checks, Spare Application Instance and Automatic Failover, with real distinct effects.
- First active player-facing nine-node technology tree over existing campaign state.
- Existing guidance, metrics, selection, local saves, telemetry and tests extended for this stage.

It does not rebuild progression, routing, autoscaling, settlement, persistence or research. It does not retroactively charge Phase 1–5 purchases. The stage does not force an incident, a particular purchase or an automatic success.

Normal flow:

```text
Acknowledged spike recognition → Continue to reliability → same paused company
→ inspect tree / prepare / optionally deploy reliability capabilities
→ explicitly Start reliability test → temporary app failure
→ observe actual health, detection and effective routing
→ manual response, automatic failover or natural restoration
→ actual incident postmortem if one opened
→ five stable post-restoration management steps → Review reliability outcome
→ acknowledge recognition → same paused company; later campaign locked
```

Finite natural restoration and a free delayed manual restore preserve a response even without research or spare cash. They do not guarantee profitability or recovery before bankruptcy.

# 3. Identity, entry and progression

Use internal stage `application-reliability`, version `1`, player label **Stay Online**. Root `opening-db` v1/run ID stays unchanged. Put versioned values in a conditional `sim/scenarios/applicationReliability.ts`; serialize configuration at entry as existing stages do.

## 3.1 Entry predicate

An explicit `enter_reliability` action requires all of:

- Existing spike stage has a non-null completion step and `acknowledged=true`; no Reliability stage yet.
- Management phase, positive cash, no active incident or pending review/recognition.
- Every existing actual recovered report acknowledged in trace; Opening milestone acknowledged by either route.
- All app/DB queues empty and current snapshot passes existing recovery predicate.
- Incoming demand is the existing 2,400 req/s baseline.

Do not require full admission, autoscaling ownership/deployment, cache, a particular DB tier beyond inherited valid state, load balancing, all nine nodes, a purchased spare or optional workload contrast. An active admission limit remains visible and is preserved. Pending accepted actions do not disappear: entry preserves them; arming below waits for them to finish. Entry consumes zero physical steps, pauses the company, records entry and awards research once; it does not arm the failure or change traffic.

Preserve ID/seed, cash, ledger/remainders, queues, routing, profile/cache/warmth, DB tier, app IDs/tiers, pending actions, controller state, consumed events, trace/reports, both Opening provenance variants, milestones and measurement. No new company/scenario reset.

## 3.2 Completion predicate

After the test actually starts and its target is physically restored (manual or natural), count five consecutive new management steps with positive cash, no active incident, all queues empty, reports acknowledged, and existing healthy latency/errors with positive admission/completed outcomes. A failing observation resets the counter. Count the restoration step if it meets all conditions; reading, inspections, research, save/load and acknowledgements add no steps.

Record one reliability outcome with trace/snapshot links and `completedStep`; pause for explicit review/recognition. If an incident occurred, its measured recovery and report acknowledgement come first. If it was prevented, create a distinct stage outcome, not an invented incident/postmortem. Display actual prevention/degradation and admission trade-offs.

Acknowledgement marks `acknowledged=true` and resumes the same paused company with no reward, new fault or new traffic. Reliability becomes Completed; later combined-campaign content remains visibly unavailable. No mandatory technology ownership, full-demand requirement or success shortcut. Limited completion says **Stable — traffic limited** and records rejected demand.

# 4. Technology tree v1 and research ownership

## 4.1 One existing research-point currency

Retain Phase 5 `spikeStage.researchEarned=1` and `researchSpent=0|1` as the autoscaling award/spend history. At explicit Reliability entry grant **three research points once** under one `reliability-readiness` trace identity. Each previously unowned reliability node costs **one point**, no cash and no physical step to unlock. Zero points are awarded by incident creation, recovery, repeated entry, reload, recognition or purchasing infrastructure.

Derive the single available balance as:

```text
Phase 5 points earned + Reliability points earned
− Phase 5 autoscaling points spent − number of purchased reliability unlocks
```

Extend current campaign research queries/actions and both tree/controller balance displays for this sum; no second wallet, currency, lifecycle store or independent research ledger. Keep the old counters and autoscaling ownership intact. Store Reliability award count and unique owned IDs in its stage, with trace-backed one-point debits; never reset between stages. An unused Phase 5 point carries forward. All six earlier capacity/data nodes require no retroactive research spend. The bounded grant deliberately makes the three capabilities reachable; full research scarcity/pacing belongs to Phase 7.

## 4.2 Exact nine nodes, ownership and prerequisites

Use `TECH_ORDER`, `TECH` names/group/coordinates, existing icons and `requires` relationships. Add campaign-specific effect/price/status projection using scenario constants; do not overwrite legacy saved-task semantics or show their prices. The table separates **Owned** from deployment/useful capacity:

| Existing ID / player name | Owned evidence | Research/relationship and next action |
| --- | --- | --- |
| `larger_servers` / Scale Up | Any paid large app tier | Existing per-app scale-up action; no research charge |
| `load_balancing` / Scale Out + Load Balancing | Deployed load balancer | No Scale Up prerequisite; installations/routing remain separate |
| `autoscaling` / Autoscaling | Existing Phase 5 `researchSpent=1`, even if controller undeployed/disabled | Preserve existing Phase 5 unlock availability; LB edge is a deployment prerequisite, not a retroactive unlock gate |
| `larger_database` / Larger Database | DB capacity at least 1,000 ops/s | Owned at first investment, not only maximum tier; details retain eligible next-tier purchases |
| `caching` / Read Cache | Deployed cache | Existing data-stage availability/action; no DB purchase prerequisite |
| `cache_tuning` / Cache Tuning | Cache tuned | Existing Read Cache prerequisite; actual 60%→75% ceiling and existing costs |
| `health_checks` / Health Checks | Reliability unlock recorded | Reliability entered, one point; `TECH.requires=[]`; paid deployment separate |
| `standby` / Spare Application Instance | Reliability unlock recorded | Reliability entered, one point; `TECH.requires=[]`; reserve/create a real instance separately |
| `auto_failover` / Automatic Failover | Reliability unlock recorded | Reliability entered, one point, Health Checks and Spare unlocks owned, Load Balancing deployed; preserve three `TECH.requires` edges |

Never infer ownership from merely reaching a stage, `game.techDone`, being able to afford an action, or a future maximum tier. Never fabricate unused technologies as owned. Already-owned nodes remain Owned if prerequisites would now be unavailable; deployment availability is shown separately. Research ownership survives spare promotion or controller disable; physical evidence reflects what actually remains deployed.

For old capacity/data technologies that never used research, stage availability and live architecture stay authoritative. Selecting their tree nodes invokes the same existing action dispatcher or focuses the existing action/instance selector. Unsupported or busy actions show the real reason. Do not expose legacy `start_tech`, engineer allocation, tasks or releases.

## 4.3 Presentation and navigation

Adapt `TechTree.tsx` first, conditionally using a campaign projection instead of legacy detail actions. Reuse current layout/edge primitives, `TECH_ORDER`, icons and Modal. Allow campaign `view="tech"` through the existing store/Game/CampaignUI composition; no second game shell. Tree opening pauses physical play; closing leaves it paused until explicit Resume. UI view/focus may remain transient on reload; ownership never does.

Provide an optional visible **Technology tree** button throughout the campaign. Display exactly nine nodes in Capacity / scaling, Data and Reliability lanes. Earlier stages show unavailable future nodes visibly Locked with the actual stage prerequisite; do not overwhelm the primary action panel with future controls.

Each node shows Owned / Available / Locked with text and icon, named prerequisite links, research requirement if applicable, exact current cash cost/delay/upkeep and concise effect. A secondary state distinguishes unlocked/undeployed, pending activation, deployed, disabled, and spare unavailable/standing by/in use. Internal IDs are not player-facing labels. No “Live” label for research-only ownership.

Keyboard focus, activation, accessible names, touch selection and mobile stacked/scrollable lanes are required. Edges and state cannot depend on color/hover alone. Guidance still answers “What am I trying to achieve?”; the tree answers “What capabilities can my company unlock?” Required acknowledgements remain in guidance, never hidden in the tree.

# 5. Deterministic temporary failure model

## 5.1 Explicit arming and immutable schedule

The player explicitly selects **Start reliability test** once. Arming requires Reliability active/unarmed, positive cash, stable management, no incident/review, empty queues, all actual reports acknowledged, at least one configured healthy serving target, and **no accepted pending actions**. No purchase or full-demand prerequisite. An autoscaler-owned installed but unjoined app does not by itself block arming; its join state is preserved.

At completed step `n` of arming, choose the **greatest numeric ID among the current configured healthy non-spare routing targets**, save that ID, and set start `F=n+8`, natural restoration `R=F+20`. Exactly one fault, no RNG/wall clock, no repeating hazard and no traffic change. The chosen ID is pinned against retirement from arming through restoration. Manual routing may bypass it before failure; that is valid prevention, not reason to retarget or postpone the event. UI says a reliability test is scheduled but does not reveal hidden target/deadline before it occurs. Accepted deployment/routing countdowns remain visible.

The target is actually unavailable on `[F,R)`, unless manual restoration activates earlier. At `F`, record actual failure once; do not instantly detect, exclude, replace, reroute or award an incident. Manual/natural restoration closes the same event once; preserve its original deadline and record actual restored step/source. Later natural deadline is a consumed/no-op for an already-restored event. If natural restoration occurs before an accepted manual restore is due, mark that request superseded at its due step without a second restoration or charge. Pause/reload do not rebase deadlines or execute offline catch-up.

## 5.2 Actual health, detected health and routes

Extend each live instance with physical health `healthy|failed`, detected health `unknown|healthy|unhealthy`, actual-change step, detected-change step, and role `serving|spare`. Keep current tier/capacity/ID and existing scheduling semantics; avoid a duplicate fleet. The existing `state="active"` can continue to mean installed rather than healthy; do not overload that flag to represent detection or routing. Separate these from configured route membership.

- Actual health controls whether the app processes work.
- Detected health comes from a probe or explicit inspection, never from routing code reading actual failure to silently exclude it.
- Configured targets are the current `c.routing.targets` chosen through existing actions.
- Effective recipients are configured non-spare targets, filtered by detected `unhealthy` **only when load balancing and deployed Health Checks exist**. Unknown instances remain eligible.
- The live app's compatibility `routed` flag remains a projection of configured membership, not an independent source. `routed` in version-6 observations means effective receipt; add explicit configured membership there. Derive both from the single route and health rules. Without checks, a failed configured target can still receive requests.

Health Checks can exclude detected failed recipients but cannot add a spare to configured routing. Automatic Failover changes configured routing to promote a real spare. Manual routing uses existing numeric equal allocation; detection does not secretly weight traffic by capacity. Retain original Phase 1–5 behavior when Reliability is absent.

## 5.3 Request/queue accounting

Healthy serving apps retain existing processing, 1,000-per-app backlog bound and equal-allocation rounding. Healthy unrouted apps drain existing queues as before. A reserved spare must have an empty queue and receives no demand until promoted.

For a failed instance: processing budget is zero; all newly assigned requests immediately fail at the app and never reach cache/DB; its existing backlog is retained/frozen until restoration. Do not fail that backlog repeatedly or move it invisibly to a replacement. Failed outcomes enter the existing service-error and revenue accounting. Once healthy, existing queued work drains normally, even if the restored app remains unrouted.

If effective recipients are empty, all newly admitted requests fail once at the application; they are not admission rejections and do not enter a hidden queue. Do not call the existing nonempty-only `allocateTraffic` helper with an empty list. Record this as a system-level unroutable failure count, included in aggregate app failures but not fabricated as a live instance. Cache/DB process only real app completions and existing downstream queues.

Preserve conservation: cumulative admitted equals successes + failures + all retained app/DB backlog. Opportunity value, salary, installed upkeep and 60-step settlement remain unchanged. Failed apps still incur installed upkeep. No refunds or downtime fines.

Report installed nominal, configured routed nominal, healthy effective routed and reserved spare capacity separately. Keep existing latency formula using nominal nonzero per-instance capacity for retained queue delay; failure errors express lost service. Guard zero-budget/zero-route ratios with null/not-applicable display rather than NaN/Infinity. Do not relabel a failed nominal capacity as useful capacity. Do not alter cache/read-write formulas, DB bounds or existing latency/error thresholds.

# 6. Reliability capabilities, actions and costs

The following are **new Phase 6 v1 values**, not legacy `TECH.cost/effort` values or modifications to earlier scenario constants. Money persists in cents; one step is one modeled second. Purchases must leave positive cash. Activations use the existing infrastructure channel; routing changes use its existing routing channel. An action claiming both reserves both, as retirement already does.

| Action / capability | Setup cash | Delay | Upkeep / full 60-step period | Requirement / effect |
| --- | ---: | ---: | ---: | --- |
| Unlock each reliability identity | $0 + 1 research point | 0 | $0 | Actual prerequisites; once-only research ownership |
| Deploy Health Checks | $500 | 2 | $100 | Owned Health Checks; deploy once; recurring cost starts at activation |
| Reserve an existing application as spare | $0 | 1 | Existing $700 base / $1,100 large | Owned Spare; healthy, unrouted, empty queue, no action targeting it; no duplicate upkeep |
| Install a new base spare | $1,000 | 2 | $700 | Owned Spare; free infrastructure slot and total installed count <4 |
| Release a reserved spare to ordinary unrouted service | $0 | 1 | Unchanged | No pending promotion/targeted action; does not automatically route it |
| Deploy Automatic Failover | $1,000 | 2 | $100 | Owned Failover, deployed Health Checks and LB, actual healthy reserved spare, free slot |
| Automatic spare promotion/routing | $0 | 1 | No new capacity/upkeep | Detected unavailable configured target, deployed/enabled prerequisites and usable spare |
| Manual routing | $0 | Existing 1 | No extra | Existing LB/channel/target validation; preserve earlier-stage rules |
| Restore failed app | $0 | 3 | Installed upkeep unchanged | Actually failed target; existing infrastructure channel; no research/spare prerequisite |
| Natural restoration | $0 | At saved R | Unchanged | Same temporary event; no automatic incident recovery |

Existing additions, scaling, DB/cache/controller setup and upkeep are unchanged. Spare creation is existing paid app installation with reserved role/provenance, not a magical technology-generated host. Maximum **four installed/reserved apps** includes failed apps and spares. At capacity, reserve an existing unrouted app or use manual bypass/restoration; no forced fifth instance. Existing large apps can be reserved and retain their useful 1,600 capacity and cost. Manual vertical scaling of a healthy spare is allowed under existing costs/delay and infrastructure-channel rules.

## 6.1 Health Checks

On deployment activation initialize detected health to `unknown`; do not copy actual health and claim a probe occurred. Probe once per new physical step. A change at step `s` becomes observable no earlier than `s+1`; an app existing at activation is first probed at activation+1. Failure/restoration therefore has a deterministic **one-step detection delay**. Only changed observations emit detection trace events.

Explicit existing app inspection with an instance ID may identify its actual health immediately and records a manual detection trace. Free inspection advances no time, adds no capacity and does not silently reroute. Without deployed checks, manually detected failure is informational; manual routing/restoration still requires its real action. Do not credit passive selection/hover as inspection. System aggregate inspection does not inspect every app.

With deployed checks and LB, detected unhealthy status filters effective recipients at the probe step before request allocation. Detecting healthy again restores eligibility to an instance still in configured targets. An app replaced in the configured pool remains unrouted after restoration until an explicit routing action; there is no implicit return that would remove the promoted spare. Without LB, checks show detection but cannot change routing; UI explains that dependency.

## 6.2 Spare role

One reserved spare at a time; no speculative inventory subsystem. Reservation preserves real app ID/tier/provenance, and does not reset cash, history or health. It contributes installed/standby capacity but no serving capacity. Promotion clears the spare role and removes its reservation atomically with routing. No free replenishment; the capability remains owned but another actual app must be reserved/installed to have a spare again.

Reserving an autoscaler-created idle app explicitly transfers retirement control to the player: remove it from managed retirement IDs; clear its joining pointer if it referred to that app; record this handoff. No pending join/routing action is cancelled silently—reservation is rejected until such accepted work finishes. An already-routed autoscaled app must first be unrouted through a valid manual action. Spares, failure targets and physically unhealthy apps are never eligible for automatic retirement.

## 6.3 Automatic Failover

Deployment installs a persistent capability; activation enables it. A zero-step enable/disable action changes future decisions only; upkeep continues while disabled and already accepted promotion is retained. No new research price for toggling.

When a configured target is detected unhealthy, the controller requests one one-step routing promotion if checks/LB are deployed, failover enabled, the spare is healthy with empty queue, and the routing channel is free. Candidate is the single reserved spare. Remove detected unhealthy configured targets and add the spare, preserving other valid configured serving IDs in numeric order; use balanced mode. Never create/replace an app during this action.

The request saves failed target/event, spare ID and expected configured routing. Revalidate target still failed/detected unhealthy, spare still valid and routing unchanged at activation. Cancellation records its reason, spends no money and changes no route. A valid explicit manual routing request may supersede a pending failover promotion: record cancellation at the player request step, remove that pending promotion, then schedule the existing one-step manual route. Do not supersede other accepted player/autoscaler routing. Never overwrite a newer player route. If target restored meanwhile, promotion is cancelled. If no spare remains, show blocked evidence; Health Checks may still bypass into insufficient capacity. No guarantee of stable metrics from successful promotion.

One promotion pending per failure event; repeat observations cannot enqueue duplicates. Mark successful promotion consumed for that event. If checks detect multiple failures in future unsupported data, reject that payload rather than inventing concurrent faults; v1 has only one target.

# 7. Autoscaling and deterministic event ordering

## 7.1 Explicit interaction contract

| Question | Phase 6 answer |
| --- | --- |
| Can an autoscaled instance fail? | Yes; target selection uses routed IDs regardless of installation source. Pin it against retirement. |
| Does autoscaling replace failure? | No. It remains utilisation automation, not health replacement. |
| Can an autoscaled app become a spare? | Yes, through explicit reservation/handoff; never by guessing that every idle app is a spare. |
| Can failover and autoscaling duplicate routing/install decisions? | No. From test arming through reliability recognition acknowledgement, new autoscaler decisions are suspended with a visible reason and counters reset. Existing enabled state and costs remain unchanged. |
| What happens to previously accepted automation? | Arming waits for actual pending actions to finish. Entry does not cancel them. A stranded joining pointer is preserved and explained, not an invented arming gate. |
| Do health checks affect capacity observation? | In Reliability observations, useful routed capacity and utilisation exclude physically failed/standby apps. Configured-but-undetected requests still fail. Phase 5 observations/math remain versioned unchanged. |
| When does automation resume? | After explicit reliability acknowledgement; retain enabled/disabled flag, clear observation streaks and impose existing four-step cooldown. It then requires valid healthy balanced serving targets under existing policy. |
| Does unhealthy capacity count as installed? | Yes for installed limits/upkeep; zero useful processing capacity. |

This bounded suspension is intentional to isolate the reliability learning question; do not secretly disable or remove the deployed controller. UI shows **Autoscaling waiting — reliability test in progress**. Manual additions/scaling/routing, limit changes, research and restoration remain available through the existing legal channels. No simultaneous new demand pulse is added. Phase 7 may design combined automation/fault scenarios separately.

## 7.2 Physical step order

Keep the single authoritative step; use this Reliability-only extension:

1. Increment physical step. Apply due existing actions; prevalidate a due promotion against this step's actual manual/natural restoration and latest route, without changing event history prematurely. A promotion must cancel if restoration occurs on the same step. Manual restoration precedes a due promotion where both concern the target.
2. Apply saved natural failure/restoration transitions once. Earlier successful manual restoration consumes the event and makes later natural restoration a no-op. No deletion/retirement of a pinned target.
3. Apply due health observations only for transitions old enough to probe; update detected health and effective eligibility. Same-step physical failure/restore is not detected yet.
4. Derive effective targets, allocate integer demand, process real queues/failures, classify reads/cache, process DB and record the snapshot.
5. Accrue existing salaries/infrastructure plus new deployed check/failover exposure; settle once if due. Bankruptcy takes precedence.
6. Update component overload and failed-delivery streaks, shared incident/recovery, causal report/stop state.
7. If not terminal/review, request at most one valid promotion for a newly detected failure; existing player routing has priority. Arming suspension prevents autoscaler decisions. Count Reliability completion observations only in eligible management.
8. Record deterministic trace/metrics and project through the same store/local telemetry bridge.

Do not apply a just-requested action in the same step. Numeric IDs and action identity order are deterministic; tests specify same-step restoration/promotion/probe and routing collision cases. Health filtering does not require an infrastructure slot or paid routing action; promotion changes configured routing through the scheduler. Failed queue conservation and bankruptcy precedence govern all branches.

# 8. Incidents, recovery and postmortems

Extend the existing `CampaignIncident` with a versioned kind/cause and referenced failure event/targets; missing historical kind remains capacity overload. No second lifecycle, legacy `IncidentState`, separate timer or guaranteed failure incident.

- Existing healthy-component overload: unchanged demand > nominal capacity for three consecutive steps.
- Failure symptom: three consecutive new steps with positive failure-attributed delivery failures (requests assigned to the actually failed app, or no effective route after detecting/excluding it) opens `application-failure` if no incident is active. Delivery failure itself is an outcome, not an artificial backlog. A successful bypass with no failure-attributed losses resets that failure streak.
- If both qualify together, retain one incident: record both constraints; failure target is primary, followed by other numeric app IDs then DB. Add subsequent fault evidence to an already-active incident rather than resetting its opening/recovery counter.
- Promptly preventing failure deliveries/overload may avoid an incident. Fault events still receive stage outcome evidence.

Recovery keeps **latency <500 ms, service errors <1%, positive admissions/completed outcomes for five consecutive physical steps**. For an active Reliability failure reference additionally require the target physically restored **or** safely bypassed from effective recipients, and all retained queues empty for a bypassed failed app; frozen unfinished work must not vanish. A failed app with retained queue therefore needs restoration/drainage before recovery. Insufficient surviving allocation keeps ordinary overload/latency/error evidence authoritative. No timeout, restoration deadline, completed purchase, health detection or promotion directly completes an incident.

Extend `trace.ts` causal evidence: physical failure time/source, manual/probe detection time/source, configured versus effective routing, delivered failures, frozen queue, spare reservation/promotion, healthy surviving capacities and equal per-instance allocations, accepted/activated/cancelled actions, app restoration, rejected traffic, setup/upkeep and the actual recovery streak. Attribute health filtering versus spare promotion separately. A correct route with inadequate capacity must be explainable. A read-heavy cache or DB headroom cannot manufacture app reliability.

Historical Opening prevention, reports and recognition remain read-only. Later Reliability recovery must not award Opening or replay completion again.

# 9. Guidance, evidence and Facility

Extend `campaignGuidance.ts` and existing CampaignUI; never store another derived progression state. Pinned strip adds current/available/completed Stay Online using the actual stage/recognition fields. Required Continue to reliability, Start reliability test, Review postmortem and Review reliability outcome actions are visible outside History and collapsed detail panels. Closing a review or tree is not acknowledgement. Reload shows the same outstanding action.

Guidance explains: entry prerequisite, pending accepted work before arming, scheduled test without hidden deadline/target, actual failed app, detection waiting, no LB for automatic exclusion, missing unlocked/deployed capability, unavailable/busy spare or routing channel, surviving capacity/backlog, missing report acknowledgement, remaining stable observations and pending recognition. Do not tell the player a mandatory correct technology sequence. No false promise that research/promotion guarantees recovery or financial rescue.

Preserve all engineering evidence: demand/capacity, utilisation, backlog, processed/failed, latency, service errors, workload/cache/DB, installed/routed distinction and rejection opportunity value. Add actual/detected health, configured/effective routing, standby/promotion, healthy surviving capacity, failed deliveries, frozen queue and check/failover costs. Clearly distinguish simulation truth shown for learning from whether the infrastructure has detected it. A failed instance may say **Failed — still receiving traffic**, followed by **Detected — excluded**, **Restored — unrouted** or its actual state.

Keep Facility, office/camera/theme/icons and dependency-strip shared selection. Use existing app equipment/labels with health/spare cues, not new WebGL/architecture renderer. Selecting/focusing/tapping one representation highlights the same ID and snapshot. Research nodes use existing icons; the tree does not become the incident dashboard.

## 9.1 Guardrail limits

Every supported gate must have a factual visible reason and valid next observation/action. Preventing a Reliability incident must still complete the bounded event/outcome route. No dead end from absent research, four installed apps, missing spare or discarded review. Natural restoration/free manual restoration remain possible while solvent; no required paid cure.

This is not a guarantee that every inherited company remains solvent. The existing Scaling affordability trap is preserved and disclosed: mandatory $3,000 headroom can be unaffordable while installed costs exceed full-demand revenue. Phase 6 must not add an unrelated bailout, refund or retroactive gate change. Inconsistent/corrupt save evidence remains protected/exportable, not automatically repaired or marked complete. Phase 7 owns the separate economy/progression decision.

# 10. Persistence: schema 6 is required for this model

This is not a schema bump merely for tree presentation. Tree-only derived states would fit schema 5. Physical failure/standby requires incompatible routing/snapshot invariants: even if installed `state="active"` is retained, schema 5 requires snapshot `routed` to match configured membership, checks processing budgets against nominal tiers, has fixed action/source kinds and lacks fault/detection/promotion/restoration references. Optional fields alone would either violate current validation or leave older readers treating unhealthy configured capacity as useful. New health-aware snapshots must not masquerade as version 5.

Use envelope **schemaVersion 6**, same `nn.campaign.save.v1` key and root scenario. Extend existing migration dispatch/registry and version-6 validators together. New state is the smallest serializable extension:

- Nullable Reliability stage: identity/config, entry, award/owned IDs, armed step/target/start/natural-restoration/consumed evidence, actual restored step/source, failed-delivery and completion counters, recognition state.
- Instance actual/detected health and transition/probe steps; serving/spare role and one reservation ID. Configured routing remains existing state; effective routing is derived.
- Deployed check activation and failover activation/enabled state and scheduler references for reserve/create/release/restore/promotion; expected-route event identity and source `failover` distinct from `player`/`autoscaler`.
- Check/failover financial exposure/remainders and additive settlement evidence; no duplicate spare exposure.
- Version-6 snapshots with actual/detected health, configured/effective recipients, processing budgets, failed deliveries, usable/spare capacity and fault references.

Chain validated **v1 → v2 → v3 → v4 → v5 → v6** through the existing registry. Before replacement preserve original source bytes at its existing versioned backup key, validate each required source and final result; failed backup/validation/write cannot destroy source. Unknown future envelopes remain unsupported/exportable.

Schema-5-to-6 migration sets Reliability null, deployed controls absent and new cost accumulators zero. Initialize only current live app health as healthy/unknown and role serving, matching schema-5 facts; do not claim historic probes. Preserve paid architecture, next ID, pending deadlines/provenance, snapshot/recent history versions, queues, money/rounding, traces/IDs, both Opening milestone variants and optional prevention state, spike deadlines/ownership/recognition and measurement exactly. Do not add per-instance health observations to historical snapshots or rewrite historical reports. Do not enter Reliability, award its points, arm events or invent owned nodes during migration.

Historical validators must keep original v1–5 rules; v6 dispatch interprets versioned past snapshots using their original conservation/route contracts. Validate live/fault target IDs, singular reserve, safe event order/consumption, finite counters, deployed/prerequisite evidence, action delays/costs/sources, pending promotion revalidation, research nonnegative balance/unique spend and report/recognition provenance. Preserve legacy keys `nn.save.v1`, `nn.meta.v1`, `nn.analytics.v1` byte-for-byte. Guest resume is paused with no offline stepping; preserve detection/retained queue/accepted actions and every pending review.

No cloud binding, owner fields, auth/session restoration, remote save adapter, API/proxy/configuration or backend/schema migration is included. Browser schema migration is not a production database migration.

# 11. Local telemetry and measurement

Extend existing deterministic trace projection and analytics archive, not another pipeline. Stable `runId:trace:eventId` attribution, session/build/scenario metadata, physical step, timestamps and unknown historical timing remain authoritative. Separate UI tree interaction from actual inspection, unlock, action request, activation and outcome. No network destination is added.

| Occurrence | Required payload/evidence |
| --- | --- |
| Reliability entry / readiness research award | Stage/version, same run, earned/spent before-after, once-only award ID |
| Technology tree opened / node selected | Session UI identity, named tech ID in data, ownership/availability; not a gameplay decision or inspection |
| Reliability research unlock | Node, one point, balance before-after, prerequisites; once-only |
| Check/spare/failover/restore request and activation | Existing action identity, source, paid cost, requested/activation steps, target and capability |
| Fault armed / actual failure | Event/target, saved schedule and actual step; trace export may contain deadlines even though normal guidance hides future timing |
| Health transition detected | Actual-change step, detection step, source manual/probe, delay and target |
| Effective routing exclusion / failover request/activation/cancellation | Old/new configured and effective IDs, event/action, expected route, spare, healthy capacity, cancellation reason |
| Restoration | Manual/natural source, target/event, scheduled versus actual step, retained work |
| Autoscaler suspension/resumption | Existing enabled flag, reason, cooldown; only changed status events |
| Incident opening/recovery/report acknowledgement | Existing occurrence names with versioned kind/failure references; no duplicate Opening award |
| Reliability outcome / acknowledgement | Actual prevention or incident history, physical duration, active/wall timing separately, rejection/spending/cost and completion evidence |

Controller decisions are not player replay decisions. Accepted paid/manual interventions may retain existing `gameplay_decision` classification; inspection/research/tree navigation cannot count as purchases or voluntary replay. Preserve staged records, archive/cursor retries, exports and storage-failure reporting; no silent retention loss or fabricated migrated timing.

# 12. File reuse plan and implementation order

Paths below are relative to `frontend/src/` unless stated otherwise.

| Existing file to extend first | Responsibility |
| --- | --- |
| `sim/step.ts`, `sim/campaignTypes.ts`, `sim/types.ts`, `sim/actions.ts` | Same engine/instance/scheduler, health-aware processing/route validation, failure incident and explicit continuation |
| `sim/autoscaling.ts` | Bounded suspension, pin/spare protection, role handoff and cooldown; original Phase 5 policy untouched |
| `sim/settlement.ts`, `sim/derive.ts` | Only new check/failover exposure and usable-capacity presentation |
| `sim/tech.ts` | Nine identities, single research balance, real campaign ownership/prerequisites and accurate effects |
| `sim/trace.ts` | Recorded detection/routing/surviving capacity and restoration causality |
| `game/store.ts`, `game/campaignGuidance.ts` | Existing tech view/pause/selection, pending outcome and pure visible gates |
| `game/persist.ts`, `game/saveMigrations.ts` | Existing local schema-6 chain, backups/validation/resume |
| `game/telemetry.ts` | Existing attributed event projection/archive/export |
| `components/TechTree.tsx`, `CampaignUI.tsx`, `Game.tsx`, `scene/Facility.tsx`, `index.css` | Adapt actual campaign view/tree, evidence/controls and minimal responsive cues |
| Existing engine/store/persistence/tech/UI tests and `frontend/e2e/` | Extend current regression conventions/public fixtures |

Conditional new modules must be justified, not created automatically:

| Candidate | Extend first / justification |
| --- | --- |
| `sim/scenarios/applicationReliability.ts` | Existing scenario-constant convention; versioned values warrant this small module |
| `sim/reliability.ts` | Extend `step.ts` first; extract pure event/detection/promotion helpers if it becomes unreadable; no separate loop/lifecycle |
| `game/campaignTech.ts` | Extend `sim/tech.ts` queries and TechTree projection first; only extract a shared read-only projection when needed; no research store |
| Focused reliability/migration/tree test files, `e2e/reliability.spec.ts` | Extend nearby tests first; new focused cases only for distinct physical/routing risks |
| `docs/playtests/PHASE_6_RELIABILITY_PROTOCOL.md` | Extract reusable observer sheet from section 14 during implementation |

Order: approved Phase 5 checkpoint → fresh Node 22 baseline → state/schema and preservation tests → entry/research/tree ownership queries → physical fault/detection/accounting → spare/promotion/restore and deterministic collision tests → autoscaling isolation → incident/outcome/guardrail → tree/Facility UI → local telemetry → full regression/balance/E2E/accessibility checks → report/review. Do not deploy, apply stashes or start Phase 7 as part of implementation. This reconciliation authorizes only this document edit; implementation starts after separate approval.

# 13. Automated acceptance and balance constraints

## 13.1 Engine and persistence

- Fault F−1/F/R−1/R boundaries; once-only event/manual restoration, exact delays; pause/batch/reload equivalence and unchanged RNG.
- Undetected failed recipient receives/loses work; detected filtering, no-LB detection-only behavior, zero recipients, frozen queue, restore/drain and full conservation.
- One-step probes including late deployment, same-step failure/probe/restoration; inspection credits only selected actual app and creates no automatic route.
- Installed/configured/healthy/spare capacity and null ratios; equal numeric allocation with mixed tiers and zero budget.
- Health Checks without spare reduces healthy capacity; spare without routing does nothing; failover with sufficient spare can restore service; insufficient capacity still overloads.
- Research carry-over for both spent/unspent autoscaling, three-point grant once, unique spends, prerequisites, no negative balance and no retrospective charge/reset.
- All nine exact identities, real earlier-node ownership including partially upgraded DB, research-owned but undeployed/disabled/spare-consumed states.
- Reservation/creation/release/promotion costs, exact upkeep and partial-period remainders; no free replacement, duplicate exposure or refunds.
- Manual route versus pending promotion; restoration on promotion step; no spare/invalid target/pool cancellation; no duplicate promotion.
- Autoscaled failure target, pinned retirement, explicit spare handoff, accepted-action preservation, decision suspension and original four-step restart cooldown.
- Incident kind/tie precedence, existing overloads, five measured recovery steps and safe bypass/frozen work; bankruptcy before recovery/outcome.
- Stage completion with/without incident, limited/manual/automatic paths, report/outcome/recognition reopening and no premature/automatic completion.
- Migration v1–5→6, source backups and failures, invalid/future payload protection, legacy bytes, old snapshots and both Opening provenance variants; every fault/probe/action/outcome boundary reloads paused exactly.
- Trace-backed deduplication, controller/player distinctions, unknown old timing and retained records after reset/export/storage failure.

## 13.2 Balance paths

Use public engine actions from the same inherited company; obtain operating revenue through real settlement, never injected cash. Keep all earlier constants unchanged. A representative fixture uses baseline 2,400, two 1,600 routed apps, sufficient DB/read-cache evidence and no limit; fail one real routed app. Survivor alone cannot serve 2,400. A base spare yields mixed 1,600/1,000 allocations of 1,200 each and still overloads the smaller app; a large spare yields two 1,600 recipients and sufficient capacity. Aggregate headroom alone is not proof.

Compare at least: no automation + manual restoration; checks-only insufficient survivor; spare present but not promoted; checks + large spare + failover; mixed-tier insufficient spare; admission-limited response. Include an inherited four-app company and an autoscaler-created target. Record failures/rejections, detection/promotion/restoration/recovery steps, setup, installed recurring exposure and settled/unsettled costs. At least one public manual/restoration path and one prepared automatic path must remain solvent and complete. If new v1 costs cannot support those fixtures, report the conflict before changing approved constants.

Do not claim universal financial recoverability or tune earlier stages to make Reliability fixtures pass. Preserve the known Scaling trap test until a separately approved economy change.

## 13.3 UI and E2E acceptance paths

Use existing public-control/real-store conventions, real Chromium WebGL and API aborts. Advanced fixtures may reach acknowledged spikes through public engine actions before boot; do not mutate browser store to force failure/recognition. No arbitrary sleeps/forced clicks/relaxed timeouts.

1. Both Opening routes still reach the same Scaling stage; existing Phase 1–5 journeys remain.
2. Earlier-stage tree: exactly nine nodes; already-owned technology retained; future reliability visibly locked; no legacy weekly action activated.
3. Acknowledged spikes → visible Reliability entry → paused same company/tree → research carry-over → arm → actual failure → manual inspection/restore → measured recovery/report if needed → explicit outcome → reload/acknowledgement.
4. Prepared checks + large spare + failover: observe one-step detection then one-step promotion, actual same app IDs, no invented capacity/incident and causal outcome. Dismiss/reopen review before acknowledging.
5. Checks-only or mixed-tier spare: correctly excluded failed app but insufficient surviving allocations; stage guidance shows real evidence and legal response; limiting/restoration recovers without force.
6. Autoscaled target/spare: preserve source/role, suspension/collision safety and same-company controller state after acknowledgement.
7. Reload before F, after failure/before detection, during promotion, after restoration and with pending report/outcome/recognition; no rebased schedule or duplicated debit/event.
8. Mobile/touch: tree states/prerequisites and app health/spare/shared selection, no horizontal page overflow, all required actions reachable with backend unavailable.

Run frontend lint, typecheck, verbose unit, coverage, balance, build and full CI Playwright under Node 22. Run installed backend existing nondestructive checks without API/schema/proxy changes. No `db:generate`, production migration, dependency/audit fix or deployment. Report exact counts/warnings/coverage/failures; preserve optional TRACE skip and unrelated baseline warnings. Manually inspect keyboard focus/trap/restoration, touch/mobile readability, state labels without color, screen-reader names and snapshots. Do not infer human understanding from tests.

# 14. Human validation preparation

Prepare approximately five fresh/appropriately introduced target participants on one recorded build. Do not recruit/contact or fabricate sessions during implementation. Preserve recruited/organic source, familiarity, session/build/scenario, active/wall timing, interventions, confusion, failures/quits and missing responses.

Before coaching ask what they predict when one app stops processing and whether installed capacity guarantees availability. Record their first inspected evidence, preparation/response, tree/prerequisite confusion, detection/routing interpretation, pending-action expectations and spending choices. Include paired sufficient/insufficient surviving-capacity evidence without prescribing purchases.

After play ask:

1. How is capacity different from reliability?
2. What did Health Checks change, and what did they not do?
3. Why did the spare matter, and when did it receive traffic?
4. Did failover create capacity? Why might service still overload?
5. How was failover different from autoscaling and its provisioning delay?
6. What ongoing cost or rejected-demand trade-off did the company accept?

Collect enjoyment before explanations; record spontaneous interest before prompts. The question is whether players can explain detection, routing, surviving capacity and redundancy cost using actual evidence. Full learning evaluation remains Phase 8; deployment and human results are NOT TESTED until evidence exists.

# 15. Definition of Done and review report

Mark every item PASS / FAIL / NOT TESTED with evidence; unchecked items are future requirements.

- [ ] Fresh accepted Node 22 baseline and preserved Phase 1–5 regression paths, including both Opening routes.
- [ ] Same-company explicit Reliability entry/arming/completion/recognition preserves all prior state.
- [ ] Versioned one-fault schedule, actual/detected health and no offline/reload rebasing.
- [ ] Failed deliveries/frozen queue/empty recipients conserve work and distinguish rejection/service errors.
- [ ] Health Checks, actual spare and failover have distinct delayed effects and costs; no fabricated capacity or repair.
- [ ] Correct failover can still expose insufficient per-instance capacity; manual/restoration/limited paths remain valid.
- [ ] Autoscaled target/spare, pin/ownership handoff, bounded suspension and action collision/cancellation pass.
- [ ] Exactly nine visible nodes, accurate prerequisite/state/costs, prior ownership preserved and one research balance carries forward.
- [ ] Campaign tree uses current actions, not legacy engineer-week tasks/releases or a second research/store system.
- [ ] Existing guidance exposes all blockers/pending actions without forced purchase, automatic completion or hidden future timing.
- [ ] Schema 6 migration/backups/validators preserve prior bytes/evidence and every specified reload boundary.
- [ ] Local telemetry deduplicates events and distinguishes research/request/activation/detection/player/controller/outcome.
- [ ] Real public-control E2E and mobile/touch/backend-unavailable guest acceptance pass.
- [ ] Relevant Node 22 frontend/backend checks, whitespace and responsive/accessibility evidence recorded honestly.
- [ ] No earlier balance retuning, auth/cloud/proxy, DB migration, new currency/tech identity/store/renderer or Phase 7 work.
- [ ] Human protocol/export ready; actual sessions and deployment reported separately as NOT TESTED until performed.

The implementation report must explain changed files/reuse, schema decision, stage-entry versus deployment prerequisites, research carry-over, failure delivery accounting, event ordering, autoscaling isolation, all test counts, known financial limitation and every DoD status. Stop for review before Phase 7.

# 16. Phase 7 deferrals and exclusions

Phase 7 explicitly owns full nine-node research economy/pacing, final unlock scarcity, dominant-strategy tuning, whole-campaign difficulty/replay balance, final tree visual polish, end-game/combined campaign integration and the separate Scaling affordability decision. Risky deployment/testing timing may later invoke this same physical failure model, but no such policy or extra incident family is activated in Phase 6.

Exclude DB failure/replication/backups, network/packet loss, disk/data-loss models, multi-region, consensus/split brain, simultaneous/cascading faults, health-probe networks, replacement autoscaling policies, arbitrary fault editors, mandatory correct-answer quizzes, general research redesign or tenth node. Preserve inactive legacy code without activating it. No auth/cloud stash, account ownership, OAuth/session restoration, cloud saves, remote telemetry, production routing/cookies or deployment configuration.

The reconciled design is concrete for implementation after approval. New Phase 6 costs and bounded research values require its acceptance tests; all-node final tuning is deferred. No Phase 6 implementation, baseline, deployment or human-validation completion is claimed by this document.
