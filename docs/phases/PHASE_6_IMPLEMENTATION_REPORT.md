# Phase 6 review and integration report

Reviewed on 11 October 2026 against PR #28, the original [Phase 6 plan](PHASE_6_RELIABILITY.md), [UI design](../UI_DESIGN.md), and `main` at `76f0c31` (including the latest title/overview layout, #33). The later PR documentation commit `ad7ac41` is included. The original plan is preserved; the PR's adapted contract and its earlier rebase notes are in [PHASE_6_IMPLEMENTATION_CONTRACT.md](PHASE_6_IMPLEMENTATION_CONTRACT.md).

The additional [Phases 1–5 requirements audit](PHASE_1_TO_5_REQUIREMENTS_AUDIT.md) maps the earlier plans to physical campaign code and observable tests. Their bounded gameplay is implemented, but full acceptance is not established: human sessions, a verified playtest signup destination and live Google/cloud/deployment checks remain outstanding. PR #28 deliberately extends the earlier recovered-incident-only progression rule with acknowledged opening prevention; the audit records that deviation explicitly.

## Fixes from this review

- Reject a route that targets an application with an accepted spare reservation. Previously both actions could be accepted and the engine threw when the route activated. The regression checks rejection, immutability, activation and replay.
- Restrict implicit Opening prevention acknowledgement to older save schemas. Current saves must retain the required review pause. Migrated schema-1 foundations can be saved and loaded again with the inserted acknowledgement; that normalization must not make the next save unreadable.
- Show effective traffic recipients in application controls, independently of configured membership. Per-app health inspection now selects through the same dispatcher as room inspection. Disable unaffordable reliability deployments and failover without its real deployed prerequisites/spare.
- Draw installed campaign spares once in the fleet, with a standby indicator. Research ownership no longer draws a fictitious additional spare rack.
- Replace raw reliability event JSON in postmortems with failure/detection/promotion/restoration explanations and the measured surviving-capacity/admitted-demand comparison. Action evidence excludes failed capacity. Preserve exact snapshots and trace data in saves/exports.
- Record the reliability outcome in History after acknowledgement, including whether an incident opened, detection/promotion/restoration steps and company-wide setup spending/rejected demand at completion.
- Use the shared research balance in both the tree and controller evidence. Campaign node tooltips use campaign effects rather than legacy weekly research descriptions; unlock controls respect required reviews.
- Keep reliability responses ahead of older scaling/data controls. Campaign response buttons stack cost/delay badges beside wrapping labels inside their panel, and tree branch labels use ink on the paper modal. Widen the tree-specific desktop dialog so all nine nodes fit beside the detail panel, retaining the touch layout. Browser assertions check opening response containment, desktop node visibility and touch node selection.
- Resolve the latest-main header conflict by retaining its bottom Week/Step readout and the reliability stage label. Preserve main's synchronized sound controls, company startup/introduction cues, tests, five menu tabs, graphics settings, Classic behavior, deployment configuration and migrations. Integrate the remote branch's later rebase/test commit `7e11a78`; address its rendering-cost concern by waiting for real physical outcomes in the manual-restoration journey while retaining live WebGL assertions.
- Integrate main's later title/overview update #33: preserve the two-column title, updated gameplay preview, compact healthy stage guidance, incident response order and shared action metadata. Keep Phase 6 requirements in the progression disclosure after the responses; retain 44px campaign action targets and contained cost/delay stacks.

## Validation

Node 22.20.0. Dependencies installed separately using `npm ci` in frontend and backend. The Windows checkout path contains `%`; Vitest coverage failed there with `URIError: URI malformed`. Validation uses an exact source copy in a path without `%`, without weakening test settings.

| Check | Result |
| --- | --- |
| Frontend lint / typecheck | Passed |
| Frontend coverage suite | 653 passed; one existing optional TRACE test skipped; 88.22% statements, 91.33% lines |
| Frontend balance | All 14 tests passed, including six solvent reliability alternatives |
| Frontend production build | Passed |
| Backend lint / typecheck / coverage | 37 passed; 81.35% statements, 83.62% lines |
| Complete desktop / touch browser suite | Final run against main #33: all 51 committed desktop/touch journeys plus two temporary screenshot-capture cases passed (53 total). Retries were enabled and flaky tests forbidden; no failures, retries or skipped browser cases |
| Desktop and narrow touch visual inspection | Title, management, opening incident, selected equipment, pending response, report, outcome, history, menu and tree captured at 1440 × 900 and 390 × 844. Inspection found and corrected action badge overflow, tree label contrast and the cramped desktop tree dialog. Generated screenshots remain outside Git |

Existing diagnostics include Three.js's CommonJS deprecation and Playwright's colour-environment warning. Guest journeys can log `/api/session` proxy `ECONNREFUSED` when no backend runs; the API-unavailable campaign journeys pass and unhandled page errors are checked. No failing required check is accepted as a baseline exception.

The exact 500/900 req/s cases use isolated two-instance fixtures with 600 req/s each. Detection bypasses the failed instance without creating capacity; 900 req/s still overloads the survivor, cannot accumulate a recovery streak, and requires admission relief. The contrasting 500 req/s case stays within capacity. A separate real-spare-promotion case verifies that successful promotion with insufficient surviving capacity still leaves an incident active. Existing tests cover delayed detection, manual/no-check response, sufficient-capacity promotion, cancellation on restoration/manual route changes, frozen failed queues, costs, deterministic replay and paused reload boundaries.

The six solvent reliability balance paths are representative, not a guarantee that every inherited company can complete. The adapted contract retains the known Scaling affordability limitation: required $3,000 database headroom may be unaffordable while installed costs exceed obtainable revenue. No bailout or earlier price retuning is added; the Phases 1–5 audit explains the concrete accounting constraint.

## Adapted contract Definition of Done

These statuses cover the implementation contract's sixteen checklist items. They do not erase the original-plan gaps listed below.

| Checklist item | Status / evidence |
| --- | --- |
| Node 22 baseline and Phase 1–5 paths / both Opening routes | PASS: unit, balance and 51-browser suite; earlier-phase audit records acceptance boundaries |
| Same-company entry, arming, completion and acknowledgement | PASS: reliability engine, persistence and browser tests preserve identity/resources/history |
| Versioned single fault, actual/detected health, fixed reload deadlines | PASS: fault/probe/restoration boundary replay tests |
| Failed deliveries, frozen queues, empty recipients and rejection distinction | PASS: exact conservation and failure/rejection regressions |
| Distinct delayed checks, spare and failover effects/costs | PASS: prerequisites, accepted versus activated actions, real instance IDs and settlement tests |
| Insufficient capacity after correct failover; manual/limited alternatives | PASS: 500/900 fixtures, insufficient promoted spare and balance paths |
| Autoscaled targets, ownership handoff, suspension and collisions | PASS: pin/role/cancellation tests; reserved-spare routing collision fixed in review |
| Nine visible nodes, accurate prerequisites/ownership/shared research | PASS: campaign ownership/TechTree/UI tests and browser tree journey |
| Campaign actions rather than weekly task/research systems | PASS: physical dispatch/tooltips and preserved separate Classic behavior |
| Blockers and pending actions exposed through existing guidance | PASS: guidance/UI tests; entry, unlock, deploy and arm remain separate |
| Schema 6 compatibility, backups and paused boundaries | PASS for replay envelopes: foundation/older/current/future/corrupt tests; no migration registry is claimed |
| Deduplicated attributed local telemetry | PASS: request/activation/research/detection/promotion/outcome and controller/player projection tests |
| Public-control browser and backend-unavailable touch guest paths | PASS: full suite includes reliability desktop and real Pixel 7 touch; no production store hooks |
| Package checks, whitespace and responsive/accessibility evidence | PASS locally: results above; final pushed-commit CI recorded separately |
| Scope preservation | PASS with explicit additive shared/backend schema-6 envelope acceptance; no DB migration, proxy/provider changes, new currency/renderer or earlier balance retuning |
| Human protocol / actual sessions and deployment | Protocol/export prepared; actual human and live deployment acceptance NOT TESTED |

## Plan reconciliation and remaining acceptance

| Original plan item | Delivered behavior / boundary |
| --- | --- |
| Separate actual health, detected health and routing | Implemented. Checks plus deployed load balancing filter effective recipients; automatic failover separately promotes a real reserved spare into configured routing |
| Failover does not create capacity; 900/2×600 and 500/2×600 | Covered by explicit boundary regressions and real-spare insufficient-capacity regression. Playable tiers remain inherited 1,000/1,600 req/s with 2,400 baseline; earlier phases are not retuned |
| Temporary failure / restoration | One explicitly armed deterministic fault, pinned target, delayed detection/promotion and free delayed/manual or natural restoration |
| Risky-deployment policies | Not introduced into the physical campaign. Such controls exist only in Classic's separate weekly engine; the adapted PR contract defers them. Original sections 2.10/7.11 are therefore not claimed complete |
| Architecture visualization | Existing Three.js room and shared inspector retained, as required by UI docs; no replacement 2D renderer |
| Reliability branch / nine technologies | All nine have campaign effects; ownership, deployment and traffic receipt are separate. Research completion does not require every player to buy all nodes |
| Save compatibility / backend | Schema-6 replay envelopes, old-source byte backups and paused continuation. Optional cloud envelope acceptance is additive in shared/backend code; no database schema or migration changes |
| Human validation / full Definition of Done | Not complete. The observer protocol is prepared, but no recruited human sessions, comprehension evidence, real Google-provider acceptance or production deployment verification are claimed |

No Phase 7 campaign balancing, new incident families, database failover, production migration or merge is part of this update. The exact final pushed-commit CI result is reported in the PR description; older runs are not evidence for this update. The PR discussion reports Vercel's free daily deployment limit, so a preview may be unavailable independently of code validation.
