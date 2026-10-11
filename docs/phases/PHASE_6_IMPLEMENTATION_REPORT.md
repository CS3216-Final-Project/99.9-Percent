# Phase 6 — Stay Online implementation report

Reviewed: 11 October 2026. Reviewed against branch `ai/phase-6-reliability`, baseline commit `78cb8b664ea18c407f81ec99aa526d38583ba125`. This report describes uncommitted local work, not a deployment. The accepted contract remains `PHASE_6_RELIABILITY.md`.

## Result and reuse

The same company can explicitly enter Stay Online after acknowledged spike completion and stable baseline management. Entry keeps the run, cash, queues, architecture, workload/cache, routing, pending actions, research history, reports and local measurement. It awards three points once and does not arm a fault. Unlocks, paid deployments and measured useful effects remain separate.

The single physical engine, scheduler, settlement, incident/recovery lifecycle, CampaignUI, Facility, store, local save key and telemetry archive are extended. No auth/cloud, backend configuration, new renderer, wallet, tech identity or Phase 7 mechanic is introduced. The deferred `phase3-deferred-auth-cloud` stash remains unapplied.

New modules are narrowly scoped: scenario constants follow the existing convention; `sim/reliability.ts` extracts pure entry/action/health/promotion helpers from the already substantial step module, with no clock or alternate lifecycle. Focused public-action fixtures, engine/storage/UI/browser tests isolate the new risks.

## Technology ownership reconciliation

Root cause: campaign `has()` omitted Larger Database; `completedTechIds()` read the legacy compatibility tier; `techStatus()` waited for the stage's maximum capacity. A paid 1,000 ops/s database could therefore be counted completed but appear unowned/available depending on the query.

The authoritative derived ownership query is now `has()`. For the physical campaign, actual `campaign.dbCapacity >= 1000` proves Larger Database ownership. `completedTechIds()` filters through that query, and campaign `techStatus()` returns done/Owned for the same evidence. The retained legacy game still derives database ownership from its actual legacy tier. Higher-tier purchasing eligibility remains separate from ownership.

No technology is granted, no point or cash is spent, no `techDone` list is rewritten and no historical save is edited by these queries. Regression tests use a real accepted DB purchase/activation, reject ownership before activation, ignore a stale compatibility tier, compare serialized state before/after all ownership queries, and verify other nodes are unchanged. The tree displays Owned rather than Live for research ownership; deployment, disable and standing-by state are separate details.

Exactly the existing nine identities remain: Scale Up, Scale Out + Load Balancing, Autoscaling, Larger Database, Read Cache, Cache Tuning, Health Checks, Spare Application Instance and Automatic Failover. The campaign tree dispatches current actions or directs players to the existing action panel; it does not activate legacy weekly engineer tasks/releases. Opening the tree pauses the existing clock. Prior six-node ownership is projected from actual paid architecture/research.

## Reliability mechanics

Start reliability test chooses the greatest numeric configured healthy serving app ID once, pins it against retirement, and saves arm+8 failure and arm+28 natural restoration deadlines. Reload does not rebase them. The test is explicit, finite and non-random. Normal guidance hides the future target/deadline.

Actually failed apps have zero processing budget. Newly assigned requests fail once; retained backlog freezes until restoration. Empty effective routes fail admission once as system-level unroutable work. Rejection remains separate. Conservation, cache classification, DB queues, salary/installed upkeep, original prices and measured recovery thresholds are preserved.

Health Checks cost $500, activate in two steps and cost $100 per 60-step period. A probe observes a transition no earlier than its next step; activation does not claim an immediate probe. Explicit selected-app inspection may detect immediately without advancing time or changing configured routing. Checks need the load balancer to exclude detected unhealthy recipients.

Spare ownership costs one research point. A real base spare costs $1,000, installs in two steps and incurs the existing $700 upkeep. Existing healthy unrouted empty apps can be reserved free in one step; large spares keep their capacity/upkeep. Only one spare is reserved, four installed apps remain the maximum, and no second upkeep charge is created. Explicit reservation transfers controller retirement ownership.

Automatic Failover requires the existing three prerequisites and a real healthy spare for paid deployment ($1,000/two steps/$100 upkeep). After detection, promotion takes one step through the existing routing scheduler. It creates no capacity and repairs nothing. Activation rechecks restoration, spare, failure and expected route. A valid explicit player route cancels/supersedes pending automatic promotion; other accepted work is preserved. Manual restoration is free with a three-step delay; natural restoration consumes the same event once.

New autoscaler decisions are suspended from arming through explicit reliability acknowledgement, without erasing deployment, ownership, enabled state, installed instances or recurring cost. Acknowledgement resets observation counters and restores the existing four-step cooldown.

Failure delivery symptoms use the existing incident lifecycle. Three failed-delivery steps may open an application-failure incident; ordinary component overload remains active. Recovery still requires five measured steps and safe restoration/bypass with retained queues accounted for. A prepared sufficient spare may prevent an incident. The separate reliability outcome waits for physical restoration, acknowledged reports and five stable management steps, then requires explicit acknowledgement with no resource reward.

## Persistence and local measurement

Envelope schema 6 retains `nn.campaign.save.v1`. The existing v1→v2→v3→v4→v5→v6 registry validates the schema-5 source, backs up original bytes under the source-version key and validates before replacement. Migration adds no stage, fault, research award or reliability ownership, and initializes only live healthy/unknown serving app state. Historical snapshots/reports are unchanged. Old snapshots retain their versions; reliability observations are version 6. Legacy namespaces remain untouched.

New trace projections retain run/session/build attribution and stable deduplicated identities. Entry, award, unlock, failure schedule/start, detection, reserve, promotion/cancellation, restoration and outcome/acknowledgement are local events. Request and activation remain distinct. Automatic promotion is not a player gameplay decision. Tree opening/node selection use the existing persisted session/UI-event sequence. No new network destination is added.

## Validation

Baseline: Node 22.23.3; 340 unit tests plus one optional TRACE skip; eight balance tests; 23 CI E2E; 18 backend tests; 23 frontend lint warnings. Final checks used the same Node 22.23.3 environment. Commands below ran from the indicated package; generated logs/artifacts remain outside the commit.

| Package / exact command | Result |
| --- | --- |
| frontend: `npm run lint` | PASS; 23 unchanged warnings, no errors |
| frontend: `npm run typecheck` | PASS |
| frontend: `npm test -- --reporter=verbose` | PASS; 396 passed, 1 optional TRACE skip; 31 passing files, 1 skipped file |
| frontend: `npm run test:coverage` | PASS; 396 passed, 1 optional TRACE skip |
| frontend: `npm run balance` | PASS; 14 passed, including the six separate Reliability alternatives; these tests are included in the unit total |
| frontend: `npm run build` | PASS |
| frontend: `$env:CI='true'; node node_modules\@playwright\test\cli.js test` | PASS; 27 desktop/mobile journeys, no failures, skips or retries; 7.6 minutes |
| frontend: `$env:CI='true'; node node_modules\@playwright\test\cli.js test e2e/reliability.spec.ts` | PASS; 3 passed without retries on the final telemetry-corrected build (46.6 seconds) |
| backend: `npm run lint` | PASS; no warnings |
| backend: `npm run typecheck` | PASS |
| backend: `npm run test:coverage` | PASS; 18 passed in 4 files; no failures/skips |
| repository: `git diff --check` | PASS |

Frontend coverage: **84.62% statements, 82.64% branches, 89.74% functions, 87.43% lines**. Backend coverage remains **66.66% statements, 58.82% branches, 68% functions, 66.66% lines**. Coverage measures the configured simulation/game scope; it is not proof of human understanding or complete UI accessibility.

Ownership regressions cover activated/upgraded versus unupgraded/requested DB capacity, stale legacy compatibility fields, unchanged serialized saves and unchanged other technology ownership. Both normal spent/unspent Phase 5 research paths retain their real prior capabilities. No retroactive unlock or charge is made.

Focused engine/storage tests cover real entry and research carry-over, unique unlocks, pinned fault deadlines, one-step detection/promotion, late checks deployment, manual route precedence, same-step natural restoration cancelling promotion, disabling failover preserving already accepted promotion, frozen queues, zero effective recipients, manual recovery/review/outcome, controller suspension and real autoscaled target/spare ownership transfer. Cost assertions verify exact partial-period checks/failover exposure and disabled upkeep without double settlement. Reload cases cover arm, pre-failure, failure, detection, pending promotion, pre/post restoration, pending and acknowledged outcome. Migration backup/replacement failures retain source bytes. Local telemetry asserts deduplicated trace projection/archive writes, correct Reliability attribution and automatic promotion excluded from player decisions.

Fourteen balance tests include six public-action Reliability alternatives: manual restoration, checks-only, spare-only, prepared automatic failover, insufficient mixed-tier spare and admission relief. Companies earn money through real earlier settlement; no injected cash or relaxed test timeout. The insufficient mixed-tier path requires an explicit later routing response. No universally optimal strategy or universal solvency is claimed.

The clean 27-journey browser run verifies both Opening routes, all three original recovery paths, continuation, scaling, cache/DB paths, autoscaling, guardrails, corruption preservation, bankruptcy/restart, mobile/touch and API-independent guest play. Three new desktop journeys cover same-company entry/tree/unlock, manual failure-to-outcome recovery/reload, and delayed real spare promotion/reload; a new mobile journey covers tree ownership and health evidence. The final focused browser check rechecks those three desktop journeys after the local telemetry attribution correction. Other UI/engine behavior did not change between those builds.

Intermediate verification found stale schema/tree/locked-stage assertions, a duplicate arming button, Windows encoding errors, an insufficient-spare fixture missing its valid later response, aggregation timeouts in new balance/reload tests, and assumptions about which autoscaled app remained installed. Tests now use independent paths/boundaries and actual controller-owned IDs; existing timeouts and approved constants were not relaxed. The initial full browser run had 26 passes and one stale guardrail assertion failure, corrected before the clean 27-pass run. No retry-based success is claimed. Browser output retains the existing NO_COLOR/FORCE_COLOR environment warning.

## Known limits and Phase 7 deferrals

The existing Scaling affordability dead end remains unchanged. Phase 7 owns full research economy/pacing, dominant-strategy tuning, combined scenarios, endgame and that separate economy decision. No DB failure, replication, network fault, multiple simultaneous failures, provider/auth/cloud deployment or production migration was added.

Manual real-device, keyboard/focus restoration, screen-reader and human learning/enjoyment validation are NOT TESTED unless separately recorded. The browser mobile project is Chromium emulation. Deployment and human sessions remain NOT TESTED. Historical/current pre-entry in-memory campaign apps may omit additive health fields until migration or explicit Reliability entry; no historical probe is fabricated.

## Definition of Done audit

| Contract item | Status and evidence |
| --- | --- |
| Accepted baseline and Phase 1–5 regressions, both Opening routes | PASS; full unit, balance and 27-journey browser suite |
| Same-company explicit entry/arming/completion/recognition | PASS; public-action engine, store reload and browser journeys |
| Saved single-fault schedule, actual/detected health, no rebasing | PASS; deterministic JSON equivalence and boundary reload cases |
| Failed deliveries, frozen work, empty recipients, rejection accounting | PASS; conservation and zero-recipient tests |
| Distinct checks/spare/failover delays and costs, no capacity invention | PASS; engine, settlement and browser evidence |
| Insufficient surviving capacity; valid manual and limited responses | PASS; six solvent balance alternatives and manual E2E |
| Autoscaled target/spare handoff, suspension and action collision safety | PASS; public autoscaled fixture, route precedence, restoration collision and suspension tests |
| Nine nodes, correct states/prerequisites/costs, preserved ownership/balance | PASS; six ownership tests, UI/tree/browser assertions |
| Current campaign actions, no legacy task or duplicate research/store | PASS; code review and nine-node CampaignUI tests |
| Visible blockers/pending actions, explicit completion, hidden future timing | PASS; existing guidance regressions and Reliability UI/browser assertions |
| Schema 6 migration, backups, validators and reload boundaries | PASS; existing migration chain plus Reliability source/failure/boundary tests |
| Local deduplicated telemetry and player/controller/event distinctions | PASS; staged archive regressions and Reliability projection test |
| Public-control E2E, mobile/touch, guest play without API | PASS; clean 27-journey suite; final focused Reliability build recheck recorded above |
| Node 22/whitespace plus manual accessibility evidence | NOT TESTED in full; automated checks PASS, manual real-device/screen-reader and full keyboard/focus review outstanding |
| No prior retuning, auth/cloud/proxy/DB migration/duplicate system/Phase 7 | PASS; changed-file review; deferred stash remains `44b80f65b9644bfceeda3107d0d32e3077ce94bc` |
| Protocol/export ready; human and deployment evidence separate | PASS for preparation; actual sessions and deployment NOT TESTED |

Mixed-tier and autoscaled-target/spare combinations have engine/balance coverage; they do not yet each have a dedicated browser journey. No manual/human conclusion is inferred from those tests. Nothing was staged, committed, pushed or deployed. Stop for review before Phase 7.

## Changed files

35 files: 25 tracked modifications and 10 new files. Production, tests and documentation are listed below; no backend, package, lockfile or deployment configuration changed.

- `frontend/e2e/reliability.spec.ts`
- `frontend/src/components/ReliabilityUI.test.tsx`
- `frontend/src/game/reliabilityPersistence.test.ts`
- `frontend/src/sim/__tests__/campaignTechOwnership.test.ts`
- `frontend/src/sim/__tests__/reliability.test.ts`
- `frontend/src/sim/__tests__/reliabilityFixture.ts`
- `frontend/src/sim/reliability.ts`
- `frontend/src/sim/scenarios/applicationReliability.ts`
- `frontend/e2e/guardrail.spec.ts`
- `frontend/e2e/mobile.spec.ts`
- `frontend/src/components/CampaignUI.tsx`
- `frontend/src/components/ProgressionGuardrail.test.tsx`
- `frontend/src/components/TechTree.tsx`
- `frontend/src/components/scene/Facility.tsx`
- `frontend/src/game/campaignGuidance.test.ts`
- `frontend/src/game/campaignGuidance.ts`
- `frontend/src/game/dataPersistence.test.ts`
- `frontend/src/game/openingPrevention.test.ts`
- `frontend/src/game/persist.ts`
- `frontend/src/game/phase2.test.ts`
- `frontend/src/game/saveMigrations.ts`
- `frontend/src/game/spikePersistence.test.ts`
- `frontend/src/game/store.test.ts`
- `frontend/src/game/store.ts`
- `frontend/src/game/telemetry.ts`
- `frontend/src/sim/__tests__/balance.test.ts`
- `frontend/src/sim/autoscaling.ts`
- `frontend/src/sim/campaignTypes.ts`
- `frontend/src/sim/settlement.ts`
- `frontend/src/sim/step.ts`
- `frontend/src/sim/tech.ts`
- `frontend/src/sim/trace.ts`
- `frontend/src/sim/types.ts`
- `docs/phases/PHASE_6_IMPLEMENTATION_REPORT.md`
- `docs/playtests/PHASE_6_RELIABILITY_PROTOCOL.md`
