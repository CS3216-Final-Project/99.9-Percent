# Phases 1–5 requirements audit

Reviewed on 11 October 2026 as part of PR #28, against `main` at `76f0c31` (including the latest title/overview layout, #33). This audit checks the current physical campaign implementation and its tests against each phase's requirements. Earlier implementation reports provide context, but their PASS labels are not used as independent proof.

## Verdict

The bounded gameplay for all five phases is implemented and covered by deterministic, persistence and UI regressions. **The full acceptance requirements for all five phases cannot be marked complete.** Human comprehension/playtest evidence is missing, live deployment acceptance is unverified, and Phase 3's real Google/cloud acceptance remains outstanding. Phase 2's original recovered-incident-only progression requirement is also deliberately changed by PR #28.

| Phase | Engineering verdict | Requirements still unmet or unverified |
| --- | --- | --- |
| 1: physical opening simulation | Implemented; numerical, timing, accounting and causal-report requirements have direct tests | Required friendly/fresh-player observation and comprehension evidence is not recorded |
| 2: PR1 onboarding and evidence | Implemented for onboarding, local saves, telemetry and reports; original progression rule changed by PR #28 | No verified real playtest signup destination; deployed build/asset checks and approximately five fresh-user sessions are not established; prevention now provides an additional progression route |
| 3: application scaling and optional accounts | Implemented against the accepted continuous-company contract; authenticated ownership/concurrency tested with isolated providers/database | Original sample capacities were intentionally adapted; real Google callback/cookie/proxy acceptance, two-account and cross-browser cloud acceptance, production database acceptance and human comparison sessions are not established |
| 4: data strategy | Implemented against the approved bounded contract | Human contrasting read/write workload sessions and deployed acceptance are not established; broader roadmap research/central telemetry were expressly deferred |
| 5: traffic spikes and autoscaling | Implemented against the approved bounded contract | Human threshold/capacity comprehension sessions and deployed acceptance are not established; the full research economy was expressly deferred |

“Implemented” here describes code and automated evidence. It does not substitute for the phases' human or live-service acceptance. The final browser execution and pushed-commit CI status are recorded in the [Phase 6 integration report](PHASE_6_IMPLEMENTATION_REPORT.md).

## Phase 1: physical opening simulation

Authority: [final Phase 1 plan](PHASE_1_SIMULATION_FINAL.md), including its configuration table, Definition of Done and validation protocol.

| Requirement group | Code and observable evidence | Assessment |
| --- | --- | --- |
| Deterministic physical steps | `frontend/src/sim/scenarios/openingDatabaseIncident.ts` and `step.ts` retain 300 req/s healthy demand, step-4 growth to 800, application capacity 1,000, database capacity 600, bounded queues and initial $20,000 / 2,000 users / four engineers. `openingDatabaseIncident.test.ts` checks the exact early steps, backlog progression, overflow and conservation | Met |
| Costs, delays and settlement | Add application costs $1,000 / two steps; database upgrade $3,000 / three steps; enabling/removing the 500 req/s admission limit is free and takes one step. `settlement.ts`, `settlement.test.ts` and opening tests cover activation exposure, 60-step settlement, retained fractional cents, installed idle upkeep and revenue only from completed work | Met |
| Incident and recovery rules | Three overloaded observations open an incident; five consecutive qualifying observations recover it. Strict latency/error boundaries, positive admitted work/outcomes, no forced timeout and bankruptcy taking precedence over same-step recovery are tested in `openingDatabaseIncident.test.ts` | Met |
| Three distinct response paths | Opening engine tests and `e2e/gameplay.spec.ts` cover direct database upgrade, an admission limit with rejected demand, and application-first followed by the database correction. Installed but unrouted capacity does not repair the database constraint | Met in code; browser execution status in integration report |
| Honest causal reports | `traceCampaign.test.ts` covers delayed/unactivated actions, the actual backlog-draining intervention, mixed responses and retained evidence beyond the normal rolling window. Reports use physical snapshots rather than requested actions as proof | Met |
| Clock, saves and component lifecycle | Store/persistence/component tests cover paused incident resume, hidden/menu pause, fractional speed credit, no jump over mandatory stops, corrupt/unavailable storage, cleanup and StrictMode startup | Met |
| Observed player understanding | The plan requests friendly and fresh-user sessions identifying the bottleneck and explaining the successful response | Not established by repository evidence |

Simulation source remains independent of React, browser storage, network access and wall-clock/random inputs. Classic's weekly engine is separate and is not evidence for these physical requirements.

## Phase 2: onboarding, local continuity and evidence

Authority: [Phase 2 PR1 plan](PHASE_2_PR1.md). This phase prepares optional accounts; it does not require the guest campaign to depend on a backend.

| Requirement group | Code and observable evidence | Assessment |
| --- | --- | --- |
| Title and onboarding | `CampaignUI.tsx`, game store/meta persistence and `phase2.test.ts` provide the actual gameplay screenshot, Try Prototype/Continue and three prompts with Next/Back/Skip and menu replay. Prompts do not advance steps, spend money or force inspection. `e2e/phase2.spec.ts` checks keyboard focus and paused continuity | Met |
| One dependency/selection model | The dependency strip, room and inspector use shared component selection; application installation and routing remain separate. Gameplay/scaling component and browser assertions exercise selected equipment and unrouted instances | Met |
| First real recovery recognition | `acknowledge_review` records the actual first recovered report once, separately from money, users, engineering or research awards. Pending milestone acknowledgement stops the clock and survives reload | Met for recovery; prevention exception described below |
| Compatible local saves | `persist.ts` / `saveEnvelope.ts` and phase/store/envelope tests cover replay, old schema foundations, exact source-byte backups, unavailable writes, corrupt/future records and no destructive reset on load. Meta is independently versioned | Met; PR #28 fixes migration acknowledgement/re-save compatibility |
| Attributed, durable local telemetry | `telemetry.ts` and Phase 2/store tests cover run/session/build attribution, stable sequence and trace identity, decision versus activation timing, archive crash recovery/deduplication, no truncation of unexported records, foreground thought time versus wall time, explicit quit and replay attribution | Met locally; deployed build identity unverified |
| Playtest CTA and deployed landing | The title validates `VITE_PLAYTEST_URL` as HTTP(S) and disables the CTA with an explanation when absent. The Phase 2 report explicitly records the missing destination. This audit has no verified production setting or actual signup destination | Working destination not established; configuration support alone is insufficient |
| Fresh-user acceptance | The protocol exists, but the requested approximately five fresh-user sessions, observed comprehension and fixed deployed-build evidence are not recorded | Not established |

### Progression change introduced by PR #28

The original Phase 2 milestone requires an acknowledged, actually recovered opening incident. The accepted Phase 3 contract also explicitly says prevention alone does not unlock scaling. PR #28 adds an alternate route: after growth, full 800 req/s admission, healthy empty queues, inspection of both the application and database, and five new stable physical observations, the player can acknowledge an opening-prevention outcome and then continue into scaling.

The implementation keeps `openingRecovered` false, does not fabricate an incident report and does not award resources. Tests in `sim/__tests__/openingPrevention.test.ts`, `game/openingPrevention.test.ts` and `e2e/prevention.spec.ts` cover this distinction and the required review pauses. It is a useful explicit prevention path, but **it is not literal conformance to the earlier recovered-incident-only requirement**. The adapted Phase 6 contract documents the changed progression; the older phase plans remain historical requirements.

For older replay schemas only, migration inserts an acknowledgement when that new recognition would otherwise interrupt an already-recorded history. Original source bytes remain backed up. Current schema-6 saves preserve the actual pending review. Physics continuity does not imply byte-identical newly derived recognition state across old and new versions.

## Phase 3: scaling and optional authenticated continuity

Authority: [original scaling plan](PHASE_3_SCALING.md), reconciled by the accepted [implementation contract](PHASE_3_IMPLEMENTATION_CONTRACT.md). The contract retains the same company and adapts sample capacities to the existing physical baseline.

| Requirement group | Code and observable evidence | Assessment |
| --- | --- | --- |
| Explicit same-company entry | `step.ts` / `applicationScaling.ts` and `scaling.test.ts` retain company identity, cash, history, limits and installed equipment; growth is scheduled three steps after readiness. Loading/migration does not enter the stage. Persistence tests cover the preserved deadline | Met, with the prevention-entry exception above |
| Paid vertical and horizontal alternatives | Contract values are 1,400 req/s demand, 1,000/1,600 application tiers, explicit paid 2,000-capacity database headroom, separate load balancer deployment and delayed route configuration. Tests cover each price/delay, target-specific upgrades, prerequisites, immutability on rejection and activation exposure | Met against accepted contract; original 600/900 sample is not claimed |
| Per-instance physical routing | `allocateTraffic` uses deterministic numeric-ID quotient/remainder allocation. Tests cover odd demand, individual overload despite sufficient aggregate capacity, zero allocation, retained unrouted backlog and independent database pressure | Met |
| Reports, snapshots and UI | Scaling tests and `e2e/scaling.spec.ts` check 1,400/0 traffic before balanced routing, 700/700 after it, App 2 selection, real incident recovery, paused reload and causal response evidence | Met in code; browser execution status in integration report |
| Optional accounts and explicit guest attachment | `cloud.ts`, store/account tests, backend `auth.ts`, `auth/google.ts` and `routes/runs.ts` preserve guest operation. Signed sessions determine ownership; attachment is explicit; account changes preserve local evidence; malformed/unsupported saves are rejected | Met in isolated tests |
| Atomic ownership and revisions | `backend/test/campaign.test.ts` uses an in-memory database to verify owner isolation, one-time guest claims, no reassignment and a single winner for concurrent expected-revision updates. Account tests retain both local/conflicting versions | Met in isolated tests |
| Google/session security behavior | Backend tests cover single-use bound OAuth attempts, state/nonce/PKCE, mocked new/returning accounts, expiry/cancel/binding failure, hashed sessions, exact-origin writes and logout. They do not run real Google or the deployed proxy/cookie path | Isolated behavior met; live acceptance unverified |
| Human and live-service acceptance | Real callback/session restore, two Google accounts, cross-browser cloud continuity, production database configuration and observed vertical/horizontal comparison sessions remain outside the established evidence | Not established |

No server dependency is added to ordinary campaign gameplay. No production database migration or provider configuration is performed by this review.

There is also a documented Scaling affordability limitation, retained by the adapted Phase 6 contract: an inherited company can lack the mandatory $3,000 database headroom purchase while installed costs exceed its obtainable revenue. For example, an unupgraded 600-capacity database yields at most $7,200 per 60-step period at $0.20 per completion, below the base $7,600 application/database/four-engineer cost. A company that has already spent down its cash cannot necessarily earn its way out. The representative balance paths do not prove universal financial recoverability. Earlier prices are preserved; the contract assigns a separate economy/progression decision to Phase 7.

## Phase 4: data strategy

Authority: approved [bounded Phase 4 contract](PHASE_4_DATA_STRATEGY.md). It explicitly defers the wider roadmap's full research progression and central ingestion; those deferrals are not silently treated as implemented.

| Requirement group | Code and observable evidence | Assessment |
| --- | --- | --- |
| Entry, workload and deadlines | `dataStrategy.ts` / `step.ts` and `dataStrategy.test.ts` require completed scaling growth, stable management, empty queues and acknowledged reviews. Traffic becomes 2,400 after the retained three-step deadline. Seeded read-heavy/write-heavy profiles are bounded, pinned selection consumes no RNG, and workload is revealed at the intended point | Met |
| Cache arithmetic and conservation | Classification uses actual aggregate application-processed work, with each logical request classified once and integer floors. Tests establish 1,248 database demand for read-heavy and 2,112 for write-heavy at 60% hits, odd rounding, zero eligible work, retained old database backlog and one-time success revenue | Met |
| Cold deployment and ceiling-only tuning | Cache costs $1,500 / two steps / $400 upkeep; eligible physical steps warm the next step's usable ratio through 0/12/24/36/48/60%. Tuning costs $1,000 / two steps and raises only the ceiling to 75%. Pause/reload/review/zero eligible work cannot warm it | Met |
| Contrasting database remedy | The paid 2,000→3,000 database tier costs $4,000 / four steps with total $3,500 upkeep. Tests and browser journeys demonstrate cache-only read-heavy relief, write-heavy insufficiency and database recovery, without assuming extra application capacity repairs the database | Met |
| Continuity, telemetry and UI | `dataPersistence.test.ts` covers schema-3 backups, no automatic stage entry and pending cache/tuning/database replay. Browser tests cover explicit entry, actual data-stage purchases, workload explanations, cold/warm evidence, reload and mobile controls while API access is blocked | Met in code; browser execution status in integration report |
| Human comparison and wider scope | Contrasting human workload sessions/deployed acceptance are not recorded. The full research economy and central telemetry are deferred by the approved contract | Human acceptance not established; deferrals explicit |

The data browser journeys begin from valid earlier-stage fixtures constructed through engine actions, then use browser controls for data-stage choices. They are useful stage regressions, not proof that a fresh participant completed the entire prior campaign. Classic's separate cache tuning behavior is not used as proof for physical campaign tuning.

## Phase 5: traffic spikes and autoscaling

Authority: approved [bounded Phase 5 contract](PHASE_5_PROGRESSION.md).

| Requirement group | Code and observable evidence | Assessment |
| --- | --- | --- |
| Explicit entry and scheduled pulses | `trafficSpikes.ts` / `autoscaling.ts` and `autoscaling.test.ts` preserve the company/workload, require acknowledged stable data readiness and schedule 2,400→4,000 traffic over offsets [8,28) and [48,68), without RNG or forced incidents. Boundary tests cover all pulse transitions | Met |
| Research versus deployment | Data readiness awards exactly one research point; autoscaling unlock is separate from the $1,000 / two-step controller deployment. Load balancing and two balanced recipients are required. Nine technology IDs remain; the whole research economy was deliberately deferred | Met within bounded contract |
| Scale-out observations and delays | Strict >80% routed processed/capacity for three consecutive observations triggers paid automatic capacity. Automatic installation takes three steps plus a separate one-step join. Equality, neutral/reset conditions, max four, insufficient cash, cooldown, disabled mode and manual routing changes are covered | Met |
| Safe scale-in | Strict <60% for six observations, four-step cooldown, protected manual/upgraded capacity, highest numeric controller-owned target, empty queues and a next-step safe-capacity preview are implemented. Tests cover upcoming-pulse cancellation, atomic retirement, minimum two and never-reused IDs | Met |
| Accepted actions, accounting and limits | Disabling the controller preserves accepted paid work and controller upkeep. It does not route arbitrary manual idle apps. Tests check exact setup/upkeep exposure, admission limits, unchanged write-heavy database constraints and action/telemetry ownership | Met |
| Completion, replay and UI | Completion requires five qualifying baseline steps after the second pulse and acknowledged reports; it awards no duplicate opening milestone. Every boundary through 68 steps is replay-tested. `spikePersistence.test.ts` and browser/mobile journeys cover pending work, disabled continuation, retirement, reports and completion pauses | Met in code; browser execution status in integration report |
| Human acceptance and scope | Observed understanding of thresholds, lag, idle spending and remaining database constraints is not recorded. Reliability being locked was the historical Phase 5 scope boundary; Phase 6 now intentionally extends it | Human acceptance not established; later-stage extension explicit |

## Validation and remaining acceptance work

The current integrated source passes frontend lint, typecheck, production build, 653 unit tests (one existing optional TRACE test skipped) and all 14 balance tests. Backend lint, typecheck and 37 tests pass. Source hashes were compared with the path-safe validation copy. Full browser and exact pushed-commit CI results belong in the [integration report](PHASE_6_IMPLEMENTATION_REPORT.md), so a prior run is not presented as final evidence.

To close full acceptance, the project still needs a verified playtest signup destination and deployed build identity; the documented human sessions with observations and exports; and the real Google/proxy/cookie, owner-isolated two-account and cross-browser cloud checks. The hosted frontend and backend could not be inspected through the available web tool in this review; that limitation does not establish an outage. Existing observer protocols are preparation, not completed sessions.

The review preserves the deliberate bounded contracts and records the opening-prevention progression change. It does not manufacture participant results, a signup URL, provider acceptance or deployment evidence to turn these remaining items into PASS.
