# Phase 4 data-strategy observation protocol

Prepared 10 October 2026. This is a protocol, not completed participant evidence.

Use the approved Phase 4 contract and the same recorded build for all comparisons. Identify the commit/build, data-strategy v1 configuration, seed, pinned profile, participant/session ID and recruitment source. Set VITE_BUILD_ID when preparing the separately approved test build; dev/unrecorded exports do not qualify as recorded-build evidence. Guest play and local export work without an API.

## Preparation

1. Use isolated browser profiles and exported copies, preserving any participant's existing saves. Do not apply deferred auth/cloud drafts or overwrite real browser data.
2. Prepare read-heavy and write-heavy evaluation saves using the public simulation actions, following the preparation in frontend/src/sim/__tests__/dataFixture.ts. Pin enter_data.profile to read-heavy or write-heavy; record source=evaluation. Do not substitute an artificial recovery, free purchase, fabricated report or modified cash.
3. Use identical starting architecture, finances, admission and routing for the paired comparison. The sufficient-capacity fixture uses two paid large apps, balanced routing, deployed load balancing and the sequential 2,000 ops/s DB. Record other preserved architectures separately; app-limited/limited/prevention runs are valid outcomes.
4. Before handing over, verify normal entry/resume, paused clock, metrics, export, touch/keyboard selection and API-unavailable play. Do not explain which response solves the incident.
5. Counterbalance which profile is seen first. If using the explicit same-company contrast button, record order and previous interventions; it is not an identical independent start.

## During play

Invite the participant to operate the same company, inspect evidence and make a response. Let the real growth, activation and recovery happen. Record exact help; avoid prompting the DB answer or requiring cache. Acknowledge actual reports and continue the same company. Let the participant examine tuning if they choose it.

| Field | Record |
|---|---|
| Context | Participant/session ID, experience, recruitment source, build, seed, config/profile/order |
| Starting state | Run ID, step, cash, app tiers/routing, DB capacity, admission limit, cache warmth/target |
| Diagnosis | First component/metric inspected; predicted constraint and supporting evidence |
| Decisions | First intervention; later interventions; requested/activated steps and costs |
| Workload understanding | Reads/writes, cacheable reads, hits versus eligible misses, non-cacheable reads |
| Cache understanding | Rate used for completed work versus next-step warmth; cold activation; tuning ceiling |
| Causal understanding | App processing versus DB work; demand reduction versus DB capacity; old DB backlog |
| Timing | Active/wall time to diagnosis, recovery and completion; interruptions |
| Assistance | Exact hint/facilitator intervention and confusion point |
| Outcome | Recovery, prevention, failure, quit or technical interruption; unknown/missing answers |

## After play

Collect enjoyment before coaching. Ask what constrained the service, which evidence mattered, what each action changed, why writes still reached DB, how hit/miss changed with workload, what warmth/tuning changed, and how setup/upkeep/rejected demand affected the choice. Ask whether app scaling would reduce DB work. Do not score concepts that are not implemented (TTL, invalidation, consistency, reliability).

Export the existing playtest JSON and campaign evidence through the menu. Link exports by run/session/build and preserve unexported records. Retain failed/quit/prevention runs. Do not count reset alone or prompted interest as voluntary replay. Report actual answers and missing data; this small observation protocol does not establish learning effectiveness or deployment success.
