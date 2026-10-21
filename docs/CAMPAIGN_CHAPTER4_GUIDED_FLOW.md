# Chapter 4 guided gameplay flow

Presentation work on `fe/campaign-guidance-phase-2`, originally based on `e8c4238`. The development validation below records the initial local implementation; the final integration section records publication checks.

## Final integration

On October 21, rebased onto `ceb6086635b78d52c1a1bf13cfe82ce4e925d37f` after fetching origin, then onto `b8afe54` at the pre-publication refresh. All four new upstream commits (wall texture correction, visitor lift rides/repeat errands, faster walking and softer ambient occlusion) are retained. All 16 pending Phase 2 paths were copied to a verified recovery backup and retained in safety stashes before rebasing. The overlapping browser helper merged cleanly, preserving upstream's software-WebGL budget adjustment and the Phase 2 assertions. No conflicts required resolution.

Only the approved immediate Pause correction and Chapter 4 attention/stage guidance are included. Chapter 5–6 audit recommendations remain unimplemented. Simulation, finances, progression predicates, save schemas, dependencies, backend and workflows are unchanged relative to this main commit. No other worktree was modified.

Integration validation used Node 22.23.3:

- Frontend lint, typecheck, build and all three browser-sharding checks passed. The existing large Facility chunk advisory remains.
- First complete serial frontend coverage attempt: 1,374 passed / one timeout / one existing diagnostic skip. The old all-chapter Hint-text test constructed ten complete histories inside one five-second budget. It now uses ten independent cases with every original assertion and timeout preserved; its 34-case file passed.
- Corrected complete two-worker coverage attempt: 1,383 passed / one timeout / one existing diagnostic skip. The unchanged Stay Online Health Checks tutorial case exceeded five seconds under concurrent instrumentation. Both its file and the resolver passed a fresh serial coverage run: 59 tests. All 1,384 distinct non-skipped cases therefore have passing verification across runs; this is **not one green full local coverage batch**. Partial rerun coverage percentages are not a whole-suite coverage result.
- Final focused five-file Phase 2 batch: 92 passed. Explicit balance: 25 passed in seven files, including all exhaustive growth-order bounds.
- Backend lint, typecheck and build passed; serial coverage: 61 passed in ten files. The initial concurrent attempt timed out in two migration hooks (51 passed / ten not run); unchanged limits passed when isolated. `db:generate` reported no schema changes and created no migration.
- At the user's request, the complete 258-case local browser sweep was stopped after one passing case. It is interrupted diagnostics, not suite validation. Only essential focused browser checks follow; the complete suite is delegated to GitHub Actions on the PR's latest commit.
- On final `b8afe54` integration, lint/typecheck/build passed again; all nine upstream player tests passed. Three essential real-room browser cases passed with retries 0 (29.6 seconds): centered 320px Prepare/Hint/reload receipt, Respond yielding to immediate incident Pause/action Confirm, and first-person Chapter 4 incident Pause surviving Escape. The current 320px screenshot was reviewed for readable copy, centered placement, usable dismissal/dock and a single gold target. It remains an ignored local artifact, not an uploaded PR attachment.

The initial implementation's 14-case browser batch below remains historical evidence on `e8c4238`. Final GitHub CI results are reported on the draft PR and in the submission response; no merge, manual deployment, force push or backup/stash deletion is authorized.

This report supplements the earlier Chapter 4 attention audit. Prepare now deliberately offers inspection Hint first; scheduled Run remains available after that inspection. Earlier pre-stage-cue test counts and descriptions are historical.

## Stage cues

`chapter4Stage` reads the existing chapter entry and consumed pulse events, not a separate timer. It identifies Prepare, Spike 1, Between spikes, Spike 2 and Recover. Observed application/database overload adds a Respond cue for the current pulse. The exact requested six short messages are used.

The existing Hint-card presentation is reused for a small centered nonmodal card, with close/Got it controls and Escape when the card owns keyboard input. There is no backdrop, focus trap, automatic camera movement, clock pause or automatic action. Announcements use a polite live region. A new current stage replaces an old card instead of queuing obsolete lessons.

Only one stage card is visible. A pulse introduction can be dismissed to reveal Respond if overload still exists. Active incidents, reviews, confirmations, tutorials/practice, view sheets, pointer capture, hidden/unfocused state and manual/accepted Hint suppress stage cards; immediate Pause/Confirm retain ownership. If an incident already owns the interface, its existing Pause/Hint flow is used rather than overlaying Respond on top of it. A stage still current can be offered when a higher-priority owner finishes; old stages are not replayed.

Per-company/chapter-entry presentation receipts under `99.99.chapter4-cues:` mark a cue when displayed, so remount/reload does not repeat it even if the player had not explicitly closed it. Pause/resume and passive ticks do not rearm it. Receipts are separate from Campaign saves, replay inputs, progression and simulation state. Corrupt/unavailable storage is tolerated; in-memory receipts cover the current visit when storage is unavailable. Persistence across a full reload cannot be guaranteed when browser storage is unavailable or explicitly cleared.

## Contextual Hint and accepted targets

- Prepare points to existing App Server evidence, explains optional preparation and then permits scheduled Run after an inspection in the current stage. Inspection freshness follows recorded stage-event IDs as well as game steps.
- A healthy active spike points to Monitoring; a capped spike points to Network and explains incoming/admitted/rejected demand. After that inspection, a real remaining pulse boundary justifies Run, with its current game-second countdown.
- Overload retains actual component diagnosis. A new Chapter 4 base server that cannot handle equal routing now receives Scale up before Connect guidance. Valid accepted preparatory addition/scale-up can receive Run to install, then the next action is recalculated; installation is not described as guaranteed recovery.
- Between spikes, recorded first-pulse weaknesses can suggest affordable optional Add -> Scale up -> Connect preparation. Enabled automation is not overridden by a forced manual capacity plan. Database constraints remain separate; the guidance never claims application capacity or cache removes write pressure. Unaffordable actions are not targeted. When no current corrective action is justified, stage inspection and scheduled Run remain available.
- Recover uses actual baseline stability observations and existing mandatory review/recognition ownership. A traffic limit remains a valid completion strategy; requested help explains that it still rejects requests.

All targets use the existing Hint -> short explanation -> Got it -> existing control mechanism, existing quote confirmations and gold styling. No stage popup receives a competing gold button. No purchase, risk acceptance, inspection or routing action executes automatically. Other chapters retain their existing resolver behavior.

## Validation

Node **22.23.3**. Focused eight-file batch: **125 passed**, followed by the affected stage/receipt two-file rerun: **25 passed** after the final freshness/sequence assertions. These are 125 distinct focused cases, not 150. The final frontend lint, typecheck and production build passed; the existing large Facility chunk advisory remains.

The first development batch had 123 passes and one failing newly added accepted-install expectation. Chapter 4's accepted preparation classification was completed, and subsequent focused batches passed without timeout increases, skips or assertion weakening.

Browser validation: **14 passed in one batch**, five minutes, retries 0, on the final built runtime. Six new journeys cover the centered 320px Prepare card, manual Hint targeting and reload receipt; real engine transitions into Spike 1, Between spikes, Spike 2 and Recover; and Respond yielding to immediate incident Pause/action Confirm. Eight retained regressions cover baseline observations, overload Hint targeting, initial Chapter 4 idle Hint, shared immediate confirmation, complete interactive Chapter 0, Classic incident controls at 320px, and overview/native-pointer-lock Chapter 4 incident arrival. The expected local `/api/session` refusal occurred in the unchanged Classic case with no backend running; the case passed.

The 320px screenshot was inspected: centered readable card, visible close/Got it, accessible existing dock and one gold target. Local artifact: `test-results/chapter4-guided-flow/browser-artifacts/chapter4Guidance-Chapter-4-38a85-argeting-and-reload-receipt-chromium/prepare-320.png`. The narrow case uses a desktop Chromium viewport, not touch-device acceptance. No runtime code changed after the validated build.

Commands from `frontend/`, Node 22:

```powershell
npm test -- --maxWorkers=1 src/game/chapter4Guidance.test.ts src/components/Chapter4StagePopup.test.tsx src/game/chapter4Attention.test.ts src/game/campaignAttention.test.ts src/components/CampaignAttention.test.tsx src/game/incidentPause.test.ts src/components/IncidentPause.test.tsx src/components/idleAttention.test.ts
npm test -- --maxWorkers=1 src/game/chapter4Guidance.test.ts src/components/Chapter4StagePopup.test.tsx
npm run lint
npm run typecheck
npm run build
node node_modules/@playwright/test/cli.js test chapter4Guidance.spec.ts campaignAttention.spec.ts incidentPause.spec.ts campaignTutorial.spec.ts controls.spec.ts --project=chromium --grep 'Chapter 4 cues:|guidance Chapter 4|incident Pause:.*Chapter 4|action confirmation shared immediate gold: Add server|Chapter 0 requires real|Challenge incident transport.*320px' --retries=0 --output=../test-results/chapter4-guided-flow/browser-artifacts
```

Browser port: `PLAYWRIGHT_PORT=4197`. Artifacts/screenshots remain ignored under `test-results/chapter4-guided-flow/`. This is focused frontend validation, not full frontend/backend coverage, the entire browser suite, real-device or screen-reader acceptance. There is no simulation, pulse timing, autoscaling algorithm, finance, chapter gate, save schema, header, dependency or deployment edit.

Development hygiene: `git diff --check` passed, with no staged or unmerged paths at that checkpoint. Only intended source, tests and reports were pending; generated browser/build output stays ignored. No other worktree was modified. Nothing had been committed or pushed at that checkpoint.
