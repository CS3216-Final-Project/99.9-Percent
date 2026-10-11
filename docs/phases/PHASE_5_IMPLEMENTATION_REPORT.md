# Phase 5 integration and PR #20 review

Reviewed on 11 October 2026 against `main` 8e28147, the Phase 3 implementation contract, Phase 4's accepted implementation, `UI_DESIGN.md`, and the Phase 5 progression plan.

PR #20 adds Traffic Spikes & Autoscaling to the same company. Main remains authoritative for Phases 1–4, Classic, the room/camera, Google sessions, cloud saves, and the compact deterministic replay save format. No production migration, merge, provider configuration or participant contact was performed.

## Findings fixed

- **P1 — Outdated foundation and merge conflicts.** Reconciled the Phase 5 delta against main instead of restoring the earlier copies of Phases 1–4, account code, UI, browser fixtures, or plans. The unrelated opening-prevention/milestone rewrite and broad UI redesign are excluded.
- **P1 — Incompatible persistence.** Replaced the obsolete snapshot migration integration with schema 5 of main's replay envelope. Schemas 1–4 remain readable; original bytes are backed up before replacement. Failed backups/writes retain the source, legacy keys remain unchanged, and boot never enters Phase 5.
- **P1 — Replay could hang at completion.** Reject a save that claims to advance beyond an unacknowledged spike recognition. Acknowledgement followed by continued operation replays normally. A regression test covers both paths.
- **P1 — Cloud saves would reject the new envelope.** Extended the shared transport type and existing backend version validator to accept schema 5. Existing authentication, ownership, atomic revision conflicts and unknown-version rejection remain covered by the backend suite. No database structure changed.
- **P2 — New/gapped instances were mislabeled or selected by position.** Instance names, scaling/routing targets, room labels and rack clicks use stable app identities, including apps 3–5 after retirement. The mobile pool stays above the bottom panel and separate from the shared equipment labels; label placement follows main's camera frame helper. Idle capacity remains explicitly unrouted until a routing action activates.
- **P2 — Completion and lifecycle integration.** Pending recognition blocks manual advance, ticking and Run; reload stays paused. Acknowledgement continues the same company paused. Selection falls back when its app retires, and accepted manual upgrades protect controller-created apps from retirement.
- **P2 — UI/technology integration.** Autoscaling availability follows explicit stage entry and research, while deployment is separate. Controls reuse main's action rows, tooltips, callouts, disclosures, financial evidence and footer. Controller cost is included in unsettled and recurring costs; there is no alternative renderer or clock.

## Behavior retained and added

Application installation, useful routed capacity and database capacity remain separate. Equal deterministic routing, component overload streaks, measured recovery, Phase 4 cache equations, operating weeks, paid upgrades and account/save isolation retain their accepted behavior.

Phase 5 enters only through an explicit decision after stable data growth and acknowledged reports. It schedules two versioned demand pulses, grants/spends one forward research point, provisions applications after three steps and routes them one step later. Automatic scale-in removes only empty controller-owned base applications after the required safe observations and rechecks the next step's demand before retirement. IDs are monotonic and never reused. Disabled controllers retain their upkeep and already-paid accepted work; manual response and limiting remain valid alternatives.

Autoscaler trace events are projected through the existing local telemetry archive. Automatic actions do not become player decisions or additional opening completions. Phase 6 stays locked.

## Validation

Node 22.20.0. Existing installed dependencies matching main's lockfiles were reused after offline `npm ci` could not fetch an uncached package; package manifests/locks were not modified. Tests use fixed writable temporary directories because Windows sandbox child processes otherwise receive different temporary paths. HTTP/browser suites require localhost permission and use isolated saves/in-memory PGlite.

- Frontend lint/typecheck: PASS.
- Frontend coverage: PASS (486 tests; one existing skip).
- Focused Phase 5 simulation, replay, persistence and UI: PASS (32 tests at the replay repair checkpoint).
- Balance: PASS (8 cases, including the existing twelve-seed strategies and matched manual/automatic/limit/hybrid pulse comparisons).
- Frontend production build: PASS.
- Backend lint/typecheck/coverage: PASS (36 tests).
- Desktop/touch browser journeys: 42 distinct journeys verified. The full current-main run passed 41; the corrected autoscaling inspection/reload assertion passed in a focused rerun with the touch regression. A final mobile spacing refinement passed its focused rerun. Desktop (1440 × 900) and touch screenshots were inspected.
- Required `frontend` / `backend` CI is verified after pushing; see the PR checks for the exact commit result.

The shared/backend schema-5 change is a transport-version extension only. No migration was generated or applied. The four-strategy comparison reuses its immutable foundation, bounds the run to 200 steps and has an explicit 15-second test budget. Coverage is evidence of tested paths, not a claim of complete correctness. Real Google-provider/deployed configuration verification and human playtests remain NOT TESTED in this review.
