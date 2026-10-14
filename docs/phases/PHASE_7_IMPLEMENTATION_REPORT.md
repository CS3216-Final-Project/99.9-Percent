# Phase 7 implementation report

Reviewed: 11 October 2026. Repository: `C:/Users/user/99.9-Percent`; branch `ai/phase-7-combined-campaign`; implementation base `ae35ca52c4c08e0092ab539409dbc9023bc14bc6`. These are uncommitted working-tree changes, not a deployed release. Nothing was staged, committed, pushed or deployed. Auth/cloud stash `44b80f65b9644bfceeda3107d0d32e3077ce94bc` remains unapplied.

## Result and scope

The continuous company now proceeds from acknowledged Reliability to **Grow the Company**, runs three explicitly scheduled and acknowledged growth waves, proves full-demand stable service, and offers an explicit final review. Campaign success freezes the real company for scorecard, architecture, tree, history and export inspection. Confirmed replay archives the old evidence before creating a new ID and seed.

The existing engine, scheduler, store, clock, persistence keys/migration registry, telemetry bridge, CampaignUI, Modal primitives, nine-node tree and Facility renderer were extended. Small pure combined-scenario, round and scorecard helpers keep their responsibilities inside the existing simulation. CampaignScorecard is a read-only presentation extraction. No second campaign/progression/store/renderer/network system was introduced. Phase 8 was not started.

## Exact configuration and progression

- Saved identities: `combined-campaign` v1, `combined-pool` v1. Default target 50,000 registered users; growth 2,000 → 20,000 → 35,000 → 50,000. Baselines 2,400 → 2,625 → 2,812 → 3,000 req/s. Existing stages retain their original traffic/user projection.
- One seeded permutation of read-growth pulse, write pressure and failure under load is saved at entry. Read peaks 3,800/4,000; write pressure 3,000; failure peaks 3,400/3,600; duration 12/16 steps. Warning is eight physical steps. Failure target is pinned at scheduling, with natural restoration 20 steps after pressure starts.
- Five fresh healthy full-admission management observations permit each wave and later its outcome review. Real reports must be acknowledged separately. After the third outcome acknowledgement, five new final observations permit final review. Closing a review does not acknowledge it or complete the company.
- Existing recovery thresholds, queues, capacities, routing integer/equal-share rules, acquisition/upkeep prices, salaries, settlement cadence and earlier event schedules remain unchanged. Shared current-fault and next-demand queries let existing reliability/controller mechanics consume combined pressure without replaying old teaching events.
- Optional promotion: $500 paid acceptance, next-step activation, +400 req/s for 12 steps, 30-step cooldown from end. It uses the existing infrastructure slot, grants no users/research and earns only real successful-outcome revenue.
- Larger Database ownership remains derived from achieved DB upgrades; nine IDs and existing research balance remain intact. No retrospective grant, charge or historical save rewrite.

## Scaling affordability remedy

The public-action fixture reproduces step 305, $1,593.34 cash, DB 1,000, large App 1 and idle base App 2. Its mandatory $3,000 headroom purchase is unaffordable, and full 800 req/s revenue cannot cover that architecture's steady costs. Guidance alone could not remove this dead-end.

**Proceed with current headroom** is an explicit versioned risk consent. It preserves the default 2,000 ops/s gate and waives only that capacity prerequisite for the consenting company. There is no cash injection, refund, price change, forced incident, automatic completion or consumed physical step. Real 1,400 req/s growth and actual settlements then fund the upgrade; browser coverage follows the reproduced company through paid headroom and Data continuation. Reload preserves consent and consumed growth.

This is the approved progression-policy exception, not a guarantee that every inefficient company can be rescued. Irrecoverable overspending can still produce bankruptcy; cost/service guidance, evidence export and confirmed restart remain available.

## Persistence, scorecard and telemetry

Envelope schema 7 uses the existing campaign key and sequential migrations 1 → 7. Schema-6 migration preserves physical state, pending deadlines, queues, cash, reports, milestone/research and health/fault evidence; combined stage, consent and promotion start absent. Exact source bytes are backed up before validated replacement; backup/write failures preserve the source and legacy namespaces.

New runs count eligible/healthy steps and current/longest contiguous degraded spans from their first physical step. Migrated saves begin prospective measurement on their next step and explicitly label earlier uptime/outage unknown. The scorecard uses authoritative settled ledgers, separately identifies pending revenue, paid setup/operating costs, salary/promotion spending, actual rejection and frozen real infrastructure. It does not infer whole-run uptime from the latest 600 snapshots or present a legacy grade.

Local trace events distinguish scheduling/start/end/completion/acknowledgement, promotion request/activation, final target/qualification/acknowledged success and actual replay. Stable identities deduplicate reload/retry/batched projection. A final audit corrected historical event user/workload attribution so earlier rounds do not inherit the latest company's values. Replay selects a distinct normalized seed at the application boundary, archives evidence/scorecard before replacement and retains source linkage. Guest play needs no API, account, proxy or cloud save.

## Validation

Node **22.23.3**, npm **11.16.0**. Accepted baseline: 396 unit passes, one optional TRACE skip, 14 balance tests, 27 E2E journeys, 18 backend tests and 23 frontend warnings. Final checks ran sequentially. On Windows these commands use `npm.cmd`; Node 22 was prepended to PATH. Unit and browser native exit codes were captured explicitly as zero. Balance tests are part of the unit total, not an additional 25 unit tests.

| Package / exact command | Final result |
| --- | --- |
| Frontend `npm run lint` | PASS, 23 unchanged warnings, no errors |
| Frontend `npm run typecheck` | PASS |
| Frontend `npm test -- --reporter=verbose` | PASS, 437 passed / 0 failed / 1 optional TRACE skip; 34 passing files / 1 skipped |
| Frontend `npm run test:coverage` | PASS, 437 passed / 0 failed / 1 optional TRACE skip |
| Frontend `npm run balance` | PASS, 25 passed / 0 failed / 0 skipped (included in unit count) |
| Frontend `npm run build` | PASS; also invoked by final test:e2e |
| Frontend `$env:CI='true'; npm run test:e2e` | PASS, 36 passed / 0 failed / 0 skipped, no retries; explicit native exit 0 |
| Backend `npm run lint` | PASS, no warnings |
| Backend `npm run typecheck` | PASS |
| Backend `npm run test:coverage` | PASS, 18 tests in four files |
| `git diff --check`, new-file whitespace inspection | PASS |

Backend coverage: statements 66.66%, branches 58.82%, functions 68%, lines 66.66%. Frontend coverage: statements 85.36%, branches 84.02%, functions 90.70%, lines 88.18% (baseline 84.62%, 82.64%, 89.74%, 87.43%). Coverage is evidence of exercised paths, not proof of learning or exhaustive correctness.

Implementation-time failures were corrected: a horizontal fixture bought its third app before the preserved Data-stage maximum allowed it; browser selectors used an absent Resume button while already running, ambiguous duplicated scorecard buttons, or omitted the admission intervention needed to drain accumulated DB backlog after a promotion. The final tests use legitimate public actions. A CPU-contended concurrent unit run timed out long public-action strategy fixtures; sequential validation and local timeout allowances address test execution cost without changing simulation values. Initial failed runs are not counted as clean final acceptance. The first full browser run passed all 36 cases, but redirected native warnings caused a PowerShell wrapper failure indication. A final full run after the last copy correction captured the native exit explicitly as zero, with 36 passes and no retries.

Supplementary desktop (1440 × 900) and mobile (393 × 851) screenshots were visually inspected. Stage states, registered-user context and finance/scorecard units are readable; the existing smaller office still clips some edge labels, and the mobile scorecard needs scrolling. The final-review card originally said Campaign complete prematurely; it now says Ready to complete campaign until explicit acknowledgement. UI and browser regressions cover the distinction. A supplementary isolated browser check passed eight Tab moves contained in the final modal, Escape/reopening/focus restoration, and no page-width overflow. Scratch screenshot harness module-resolution errors were corrected without production/config changes; the resulting supplementary check passed. This focused check is separate from the 36 CI journeys and does not establish full screen-reader or real-device accessibility.

Known warnings: 23 unchanged frontend lint warnings; existing NO_COLOR/FORCE_COLOR browser warning and LF/CRLF Git normalization notices. Playwright also reports the combined file as slow (5.4 minutes); the final 36-case suite took 12.4 minutes with the preserved single WebGL worker. This is test execution time, not measured player-session duration. No dependency/audit fix, package/lockfile change, database generation/migration, backend contract change or deployment command was performed.

## Strategy and browser evidence

Two full public-purchase campaign strategies finish: vertical/mixed with three large routed apps and larger DB without cache; horizontal/cache with four base apps, warm tuned cache and larger DB for write pressure. Both preserve the same company from earlier stages. Acquisition trace, minimum cash, final cash, failed/rejected requests, activation steps and architecture are recorded by the balance test. Recorded results (seed 0, explicitly pinned evaluation pool; full-run service coverage):

| Strategy | Final step | Minimum cash | Ending cash | Paid setups | Failed requests | Rejected requests | Final apps |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Vertical / no cache | 414 | $8,000.00 | $63,811.68 | $19,000.00 | 93,800 | 15,400 | 3 × 1,600 req/s |
| Horizontal / tuned cache | 425 | $12,000.00 | $92,560.81 | $16,500.00 | 67,800 | 29,000 | 4 × 1,000 req/s |

Vertical acquisition order: DB 1,000 → DB 2,000 → second app → large App 1 → large App 2 → load balancer → DB 3,000 → third app → large App 3. Horizontal order: DB 1,000 → DB 2,000 → second app → load balancer → cache → cache tuning → third app → fourth app → DB 3,000. Manual app/cache/LB activation takes two steps, app/first two DB upgrades three, final DB tier four, and routing one. No unpaid capacity or cash is injected. Minimum cash is reconstructed and checked against final cash from authoritative paid-action and settlement traces; the exported company preserves those acquisition/activation steps.

These are different purchase paths and durations, so ending cash is not a controlled architecture profitability comparison or a claim of optimality.

All six pool orders × two read peaks × two failure peaks × eight duration combinations = **192** bounded configurations finish through public combined-stage actions from a legitimately purchased predecessor. These tests establish a viable response for each bound, not that every architecture wins every seed.

The branch assessment is contextual: cached reads reduce DB demand; writes still require DB response; automation adds delayed app capacity but cannot expand DB; spare/checks/failover change fault exposure while carrying real costs. Successful vertical play does not require cache/controller/all nine technologies. Equal-share mixed pools and acquisition timing still matter. The tested outcomes support multiple viable strategies; they do not prove global optimality or rule out every dominant sequence across all possible decisions. Human strategy diversity remains NOT TESTED.

The new browser coverage includes a genuinely fresh guest from public entry through every teaching stage and all combined rounds, horizontal/cache completion, real late fault with checks/spare, promotion-induced incident and recovery, target reached before final proof, explicit Scaling consent, pending review/reload, bankruptcy scorecard, frozen success inspection and distinct replay/archive. Prior Opening reactive/preventive, scaling, data, spikes, reliability, touch and backend-unavailable guest journeys remain. Advanced fixtures are labelled and do not substitute for the fresh company journey.

## Changed files (32)

Production (17):

- `frontend/src/components/CampaignUI.tsx`
- `frontend/src/components/CampaignScorecard.tsx`
- `frontend/src/components/Game.tsx`
- `frontend/src/game/campaignGuidance.ts`
- `frontend/src/game/persist.ts`
- `frontend/src/game/saveMigrations.ts`
- `frontend/src/game/store.ts`
- `frontend/src/game/telemetry.ts`
- `frontend/src/sim/autoscaling.ts`
- `frontend/src/sim/campaignTypes.ts`
- `frontend/src/sim/campaignScorecard.ts`
- `frontend/src/sim/combinedCampaign.ts`
- `frontend/src/sim/reliability.ts`
- `frontend/src/sim/scenarios/combinedCampaign.ts`
- `frontend/src/sim/step.ts`
- `frontend/src/sim/trace.ts`
- `frontend/src/sim/types.ts`

Tests/E2E (12):

- `frontend/e2e/combined.spec.ts`
- `frontend/e2e/mobile.spec.ts`
- `frontend/src/components/CampaignUI.test.tsx`
- `frontend/src/components/CombinedUI.test.tsx`
- `frontend/src/game/combinedPersistence.test.ts`
- `frontend/src/game/dataPersistence.test.ts`
- `frontend/src/game/openingPrevention.test.ts`
- `frontend/src/game/spikePersistence.test.ts`
- `frontend/src/sim/__tests__/balance.test.ts`
- `frontend/src/sim/__tests__/combinedBalanceCases.ts`
- `frontend/src/sim/__tests__/combinedCampaign.test.ts`
- `frontend/src/sim/__tests__/combinedFixture.ts`

Documentation (3):

- `docs/CURRENT_GAME_LOGIC_AND_FLOW.md`
- `docs/phases/PHASE_7_IMPLEMENTATION_REPORT.md`
- `docs/playtests/PHASE_7_CAMPAIGN_PROTOCOL.md`

Total is 17 production + 12 tests/E2E + 3 documentation = 32 files. Earlier contracts/reports, auth/cloud drafts, manifests, locks, backend and deployment configuration are unchanged.

## Definition of Done

Statuses refer to the final local engineering checkpoint and its recorded automated evidence. Full human/release acceptance is separate.

| Contract item | Status / evidence |
| --- | --- |
| Phase 1–6 versions and both Opening routes preserved; consent separately tested | PASS — prior tests retained, exact consent fixture and E2E |
| Same company Reliability entry, three saved rounds/acks and target | PASS — public strategy and fresh guest journey |
| Central full-demand final qualification; blockers cannot award | PASS — engine tests for limit, pending pressure/reviews/actions and five new observations |
| Explicit success acknowledgement once, inspection and stopped clock | PASS — engine/store/UI and reload/replay journeys |
| Failure evidence/scorecard and explicit restart | PASS — bankruptcy/restart and archived evidence coverage |
| Visible blockers/actions and corrected Reliability strip | PASS — guidance/UI tests and public browser journeys |
| Saved reproducible pool/configuration and boundaries | PASS — seeded sequence and 192 configuration balance tests |
| One primary/secondary, no invalid promotion/scenario/fault overlap | PASS — engine acceptance and reload validators |
| Actual traffic/health/controller/failover; old teaching events preserved | PASS — shared queries, controller fault/pinning and historical restoration regressions |
| Exact promotion payment/deadlines/revenue consequences | PASS — engine/persistence/public promotion incident journey |
| Existing action slots and nine ownership/research rules | PASS — prior tech tests and no new identities/awards |
| Exact Scaling trap has explicit real-income remedy | PASS — public step-305 fixture, paid upgrade/Data browser path |
| Two public strategies, all bounded configurations; dominance review | PASS — recorded strategy/bounds plus limited contextual assessment above |
| Any extra tuning approved/versioned; older saves not retuned | PASS — no additional tuning performed |
| Schema 1–7, original/legacy bytes and failures | PASS — old migration tests plus schema-6 backup/failure/validation cases |
| Targets/events/promotion/consent/faults/streaks/acks survive reload | PASS — save tests and pending/final browser reloads |
| Authoritative scorecard and full/partial/unknown history | PASS — >600-step counters, migration scope and ledger assertions |
| Local trace/UI deduplication and retained export evidence | PASS — existing durability tests plus combined event attribution assertions |
| Replay distinct ID/seed and evidence preserved, no API dependency | PASS — public replay, archive and backend-blocked journeys |
| Node 22 baseline and final frontend/backend checks | PASS — exact commands/counts/coverage above, explicit final unit/browser exit 0 |
| E2E paths and prior/reload/API-blocked; manual focus/touch acceptance | NOT TESTED in full — automated coverage recorded; full keyboard/modal focus, real-device and screen-reader acceptance still required |
| Human protocol/observer/export preparation | PASS — linked playtest protocol and existing observer/export controls |
| Actual separately arranged human sessions | NOT TESTED — no sessions or learning/engagement claims |
| No duplicate systems/auth/cloud/deployment/Phase8 | PASS — final diff and stash inspection |

## Remaining release and human work

Human full-campaign comprehension, voluntary continuation/replay, enjoyment, strategy diversity and active/wall duration are NOT TESTED. Deployment/build identity, real playtest registration destination and live assets/API-independent release checks remain separate release inputs. Full keyboard focus/trap/restoration, screen-reader and real-device acceptance remain NOT TESTED; automated touch/WebGL rendering alone does not establish these.

Maintenance, deployment/testing risk, new research scarcity and auth/cloud are explicitly deferred by the approved contract. No Phase 8 work or production proxy was started. The approved consent removes the reproduced solvent Scaling trap; no universal rescue is promised for all bad spending decisions. Review this engineering checkpoint before release, human sessions or Phase 8.
