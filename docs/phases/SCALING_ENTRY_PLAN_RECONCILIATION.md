# Scaling entry reconciled with the Phase 2/3 plan

User-requested follow-up to PR #28, 11 October 2026.

## Resulting behavior

Scaling entry again requires a real Opening incident to recover, acknowledgement of its actual postmortem, and explicit acknowledgement of the Opening milestone. The engine checks the recovered report and its acknowledgement, rather than trusting a milestone flag alone. The same company continues, paused, with its money, installed equipment, pending purchases and history preserved.

Opening prevention still records five fresh healthy observations at full demand with the required inspections, and pauses for its own review. Acknowledging prevention grants no milestone, resource reward, Opening-completion telemetry or Scaling entry. The outcome remains in History. No incident is forced: a company that prevents the Opening incident can keep operating but remains in Opening. This follows Phase 2 section 4 and the accepted Phase 3 contract's explicit recovery-only rule.

## Save compatibility

Schema 7 distinguishes the new entry rule from schema 6's historical prevention progression. A bounded `legacyPreventionInputs` prefix replays only decisions already recorded under that older rule. Re-saving retains the same fixed prefix; new decisions use the restored rule.

- A company that already entered Scaling or later stages remains usable with its assets, accounting, deadlines, identity and historical events intact.
- A pending prevention milestone without an entered Scaling stage is removed during normalization. Prevention remains acknowledged, but cannot grant a new continuation.
- Schema 1–5 histories may acknowledge a previously unseen prevention review to replay their existing physical steps; they do not receive a prevention milestone.
- Existing schema 1–6 source bytes are backed up before replacement. Current pending reviews remain paused. Invalid historical input bounds and unsupported future schemas are rejected.
- The existing optional cloud-save transport accepts schema 7 and preserves the prefix. Ownership, session/CSRF checks and optimistic revisions are unchanged. There is no database migration or provider configuration change.

## Validation

Validation uses the isolated source copy documented in the preceding Phase 6 report, with Node 22.20.0. The remote mode chooser and chapter UI commit e3bc662 arrived during validation and is preserved beneath this follow-up. Latest main 9ebb202 is subsequently merged, preserving its Classic operations dock and WorkTracker together with Campaign chapters. The only merge conflict combined the two mode-specific layout classes.

| Check | Result |
| --- | --- |
| Frontend lint, typecheck and production build | Passed |
| Frontend coverage | 665 passed after integrating e3bc662; one existing optional TRACE skip; 88.26% statements, 91.33% lines |
| Focused progression tests | 72 passed |
| Deterministic balance | All 14 passed |
| Backend lint, typecheck and coverage | 39 passed |
| Complete desktop and touch browser suite before the remote UI update | All 52 passed, including the new touch prevention gate; no retries, failures or skips in the successful complete run |
| Integrated mode/chapter, prevention and touch browser checks before the final main merge | All 17 passed |
| Final main merge | Checks skipped at the user's explicit request |
| Whitespace | Passed |

Sandboxed attempts encountered loopback restrictions and timing failures. The successful complete suites ran outside that sandbox with unchanged timeouts and assertions; local browser validation ran after the coverage suite to avoid contention. No product failure is accepted as a baseline exception. These results precede the final main merge; no new verification or CI result is claimed for that merge.

## Playtest controls

`Join Playtest` opens the HTTP(S) registration destination supplied through the public frontend build variable `VITE_PLAYTEST_URL`, in a new tab. Without a configured valid destination it is disabled and says registration is not open. It does not start gameplay. The separate Menu → Playtest → Export playtest record action downloads local session evidence as JSON. No signup destination is invented or configured by this change.

Human playtests, verified signup configuration and real Google/cloud/deployment acceptance remain unverified. The previously documented Scaling affordability limitation is unchanged.
