# Phase 6 review and integration report

Reviewed on 11 October 2026 against PR #28, the original [Phase 6 plan](PHASE_6_RELIABILITY.md), [UI design](../UI_DESIGN.md), and `main` at `c126b2ed4dadfd8df1629be713334f411ee3f685`. The later PR documentation commit `ad7ac41` is included. The original plan is preserved; the PR's adapted contract and its earlier rebase notes are in [PHASE_6_IMPLEMENTATION_CONTRACT.md](PHASE_6_IMPLEMENTATION_CONTRACT.md).

The additional [Phases 1–5 requirements audit](PHASE_1_TO_5_REQUIREMENTS_AUDIT.md) maps the earlier plans to physical campaign code and observable tests. Their bounded gameplay is implemented, but full acceptance is not established: human sessions, a verified playtest signup destination and live Google/cloud/deployment checks remain outstanding. PR #28 deliberately extends the earlier recovered-incident-only progression rule with acknowledged opening prevention; the audit records that deviation explicitly.

## Fixes from this review

- Reject a route that targets an application with an accepted spare reservation. Previously both actions could be accepted and the engine threw when the route activated. The regression checks rejection, immutability, activation and replay.
- Restrict implicit Opening prevention acknowledgement to older save schemas. Current saves must retain the required review pause. Migrated schema-1 foundations can be saved and loaded again with the inserted acknowledgement; that normalization must not make the next save unreadable.
- Show effective traffic recipients in application controls, independently of configured membership. Per-app health inspection now selects through the same dispatcher as room inspection. Disable unaffordable reliability deployments and failover without its real deployed prerequisites/spare.
- Draw installed campaign spares once in the fleet, with a standby indicator. Research ownership no longer draws a fictitious additional spare rack.
- Replace raw reliability event JSON in postmortems with failure/detection/promotion/restoration explanations and the measured surviving-capacity/admitted-demand comparison. Action evidence excludes failed capacity. Preserve exact snapshots and trace data in saves/exports.
- Record the reliability outcome in History after acknowledgement, including whether an incident opened, detection/promotion/restoration steps and company-wide spending/rejected demand at completion.
- Use the shared research balance in both the tree and controller evidence. Campaign node tooltips use campaign effects rather than legacy weekly research descriptions; unlock controls respect required reviews.
- Keep reliability responses ahead of older scaling/data controls. Campaign response buttons stack cost/delay badges beside wrapping labels inside their panel, and tree branch labels use ink on the paper modal. The opening browser assertion checks horizontal containment as well as vertical visibility.
- Resolve the latest-main header conflict by retaining its bottom Week/Step readout and the reliability stage label. Preserve main's synchronized sound controls, company startup/introduction cues, tests, five menu tabs, graphics settings, Classic behavior, deployment configuration and migrations.

## Validation

Node 22.20.0. Dependencies installed separately using `npm ci` in frontend and backend. The Windows checkout path contains `%`; Vitest coverage failed there with `URIError: URI malformed`. Validation uses an exact source copy in a path without `%`, without weakening test settings.

| Check | Result |
| --- | --- |
| Frontend lint / typecheck | Passed |
| Frontend coverage suite | 653 passed; one existing optional TRACE test skipped; 88.22% statements, 91.33% lines |
| Frontend balance | All 14 tests passed, including six solvent reliability alternatives |
| Frontend production build | Passed |
| Backend lint / typecheck / coverage | 37 passed; 81.35% statements, 83.62% lines |
| Complete desktop / touch browser suite | Final run pending. Earlier runs exposed action clipping, now corrected in CSS. The sandbox denies local loopback sockets; elevated execution is awaiting environment review. Final CI must verify the complete suite |
| Desktop and narrow touch visual inspection | Title, management, opening incident, selected equipment, pending response, report, outcome, history, menu and tree captured at 1440 × 900 and 390 × 844. Inspection found and corrected action badge overflow and tree label contrast. Generated screenshots remain outside Git |

The exact 500/900 req/s cases use isolated two-instance fixtures with 600 req/s each. Detection bypasses the failed instance without creating capacity; 900 req/s still overloads the survivor, cannot accumulate a recovery streak, and requires admission relief. The contrasting 500 req/s case stays within capacity. A separate real-spare-promotion case verifies that successful promotion with insufficient surviving capacity still leaves an incident active. Existing tests cover delayed detection, manual/no-check response, sufficient-capacity promotion, cancellation on restoration/manual route changes, frozen failed queues, costs, deterministic replay and paused reload boundaries.

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

No Phase 7 campaign balancing, new incident families, database failover, production migration or merge is part of this update. CI must be inspected on the final pushed commit; older runs are not evidence for this update. The PR discussion reports Vercel's free daily deployment limit, so a preview may be unavailable independently of code validation.
