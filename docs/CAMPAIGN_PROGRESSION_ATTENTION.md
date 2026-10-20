# Phase 1 progression attention

Local work on `fe/campaign-guidance-phase-1`. At task start, `git fetch origin main` succeeded and HEAD compared 0 ahead / 0 behind the refreshed `origin/main`. Existing Phase 1 and recovery/report changes remain intact. Nothing is staged, committed, pushed or published.

## Root cause and audit

The missing Chapter 2 highlight was intentional classification in the earlier Phase 1 model, not a missing timer or UI target. `campaignAttention.ts` returned `attention: null` for `scaling-choice`, `next`, `arm` and `growth-decision`. `CampaignAttention.tsx` registered all four existing targets, but its idle candidate accepted only `run` and `hint`.

`combinedCampaign.ts` accepts `accept_scaling_risk` only in management with an acknowledged Opening milestone, an unconsumed Scaling stage, no existing consent and no combined stage. The action is free and changes consent only. It can be accepted during an unrelated pending installation; that installation is not thereby completed. Guidance now validates this actual dispatch on a clone through existing `previewCampaignAction`, without changing the live company.

`ScalingRiskConsent` already separates **Consider growth with current capacity** from **Accept growth risk**, with **Keep preparing** as the alternative. Opening its explanation does not dispatch anything. Gold points only to this explanation entry, never automatically to Accept. The existing paragraph offers preparation of database capacity as an alternative. Manual Hint now says “Upgrade your database, or review the optional risk…” rather than implying risk acceptance is the only next step.

The existing chapter continuation predicates, reliability arming preview, `canStartGrowth`, engine review ownership, store action dispatch, tutorial clock hold and practice isolation were inspected and retained. No progression, purchase, financial, recovery or save rule changed.

## Resulting priority and lifecycle

One `watchIdleAttention` instance retains the existing ten-real-second monotonic deadline, genuine input reset, held-input protection, hidden/unfocused/pointer-lock suppression and StrictMode cleanup. There is no chapter timer and no 15-second Hint invitation.

1. Blocking tutorial/practice/modal owns the interface; optional gold is suppressed.
2. An open valid purchase Confirm keeps its existing immediate gold.
3. An explicitly accepted manual Hint owns its one target.
4. An eligible progression interaction receives gold after ten eligible seconds.
5. Otherwise positively justified time advancement may mark Run, while paused and available.
6. Otherwise diagnosis/uncertainty may mark Hint.

The inline growth explanation previously suppressed Confirm as well as optional attention. That suppression now applies to automatic/manual guidance while the explanation is open, but a valid purchase Confirm can take its specified higher priority. Blocking modals and tutorials still suppress Confirm attention. Cancel returns to the unchanged growth explanation without recording consent.

The resolver adds `attention: "progression"` for actual eligible nonmodal interactions. Next is checked against both the existing chapter predicate and dispatcher preview. Reliability uses the actual arming preview. Growth uses `canStartGrowth`. Scaling's review entry uses the real risk-dispatch eligibility after existing incident, workload and pending-relevant-activation analysis.

Progression uses the existing strong gold class, pulse, reduced-motion static alternative and distinct focus outline. No sizing or CSS change was needed. DOM attention is removed before a higher-priority Confirm/manual target can paint, and on input, navigation, stage change or lost eligibility. Passive snapshot updates with the same meaningful decision key do not restart the deadline.

Only enabled, fully visible and unobscured targets are marked. A folded inspector can mark its existing **Equipment & actions** entry first. If the decision is outside the currently visible panel area, the sole automatic target falls back to Hint; accepting manual help can use the existing navigation/scroll sequence. Automatic attention never scrolls, opens a panel, chooses risk, starts a test/wave, runs time or changes a save. Resize/scroll/disabled/hidden/disclosure changes recheck visibility without independent timers.

## Chapter/action coverage

| Chapter | Progression interaction | Retained prerequisite/priority |
| --- | --- | --- |
| 1 | Existing Next to Scaling when explicitly offered | Actual recovered report and milestone acknowledgement; prevention alone does not manufacture this route |
| 2 | Consider growth with current capacity; later eligible Next to Data | Healthy management and actual risk choice availability; DB preparation remains available; actual headroom or accepted consent leads to Run |
| 3 | Eligible Next to Traffic Spikes | Existing workload, service, queue and acknowledged-report requirements |
| 4 | Eligible Next to Stay Online | Existing spike completion and acknowledgement, followed by reliability entry eligibility |
| 5 | Start reliability test; later eligible Next to Grow the Company | Actual arming/continuation predicates; researched/deployed/pending/failed/restored states remain distinct |
| 6 | Start next growth wave | Existing healthy full-demand readiness predicate; accepted waves then use Run/Hint according to their actual symptoms |

Incident postmortems, System Recovered, prevention/milestone/spike/reliability/growth outcomes, chapter-completion dialogs and final reviews are blocking modals. They retain their visible required controls and focus, and suppress automatic secondary gold under priority 1. The change does not introduce competing review highlights inside those modals. No missing historical acknowledgement is repaired or promoted as a phantom control.

Before: these four nonmodal decisions had no idle spotlight even when their button existed. After: the relevant visible control receives the one spotlight at ten seconds. Opening the risk explanation clears it, accepting the decision recalculates state, and justified Run requires a fresh eligible idle interval. An actually activated database upgrade instead removes the risk recommendation without accepting risk. A pending purchase remains a pending purchase.

A relevant pending DB upgrade can justify Run to finish installation; it is not described as already-completed database preparation. Actual activated capacity supplies the readiness check before the scheduled growth event.

Ambiguous strategies are not automatically executed or endorsed: the highlighted growth entry reviews options, accepted risk itself never gains automatic gold, and investigation remains Hint when no clear valid progression action exists. Failed/disabled/hidden/unaffordable purchase controls cannot become progression targets.

## Exact changes for this task

Two runtime files:

- `frontend/src/game/campaignAttention.ts`
- `frontend/src/components/CampaignAttention.tsx`

Four test files:

- `frontend/src/game/campaignAttention.test.ts`
- `frontend/src/components/CampaignAttention.test.tsx`
- `frontend/e2e/campaignAttention.spec.ts`
- `frontend/e2e/mobile.spec.ts`

Two reports:

- `docs/CAMPAIGN_PHASE1_GUIDANCE.md` — link identifying the superseded historical attention rows.
- `docs/CAMPAIGN_PROGRESSION_ATTENTION.md` — this audit and validation.

`CampaignUI.tsx` was inspected but needed no new target registration or layout edit. Existing header, dock, Hint placement, simulation/store/persistence, backend/shared, dependencies and workflows are untouched by this task.

## Validation

Node **22.23.3**. Frontend lint, typecheck and build passed, including after the final Confirm-priority correction. The existing 1,512 kB Facility-chunk advisory remains.

- Affected unit/component batch: **99 passed in seven files**, 70.09 seconds. Includes the real Campaign UI, Chapter 0, recovery report and progression guardrails.
- Final affected attention/idle batch after the inline-Confirm correction: **54 passed in three files**, 24.96 seconds. Includes one additional priority regression: **100 distinct focused cases** have passing verification across runs. The resolver also passed a 24-case follow-up after aligning unrelated-pending-installation behaviour with the actual engine eligibility.
- Initial focused browser sweep: **17/17 passed**, retries 0, 10.5 minutes. All six chapter idle priorities, accepted risk → Run, scheduled workload → Run, pending review ownership, immediate purchase Confirm, risk explanation without consent, DB upgrade instead of risk, full interactive Chapter 0, Classic controls at 1440/320px and real-room touch at 390/320px.
- Final desktop/touch follow-up on the final build: **4/4 passed**, retries 0, 2.1 minutes. Includes the real purchase/Cancel check while the inline growth explanation remains open. No runtime source changed afterward. These four cases overlap the original 17; they are not four additional distinct journeys or a claim of a full browser-suite run.

The first 52-case unit attempt had 51 passes and one failed existing beginner-language check: the new Hint sentence used “headroom.” The copy was corrected to “Upgrade your database”; the concise-language assertion was retained. No failed browser case, new skip, forced click, automatic retry, weakened assertion or increased timeout was introduced. The DB-preparation journey now freezes scene frames while making paused purchase decisions, like existing public purchase journeys; it still uses all three actual Step 1 interactions, checks actual 2,000 capacity, and delivers the full ten eligible idle seconds.

Commands from `frontend/`, Node 22:

```powershell
npm test -- --maxWorkers=1 src/game/campaignAttention.test.ts src/components/CampaignAttention.test.tsx src/components/idleAttention.test.ts src/components/CampaignUI.test.tsx src/components/CampaignTutorial.test.tsx src/components/CampaignIncidentReport.test.tsx src/components/ProgressionGuardrail.test.tsx
npm test -- --maxWorkers=1 src/game/campaignAttention.test.ts src/components/CampaignAttention.test.tsx src/components/idleAttention.test.ts
npm run lint
npm run typecheck
npm run build
```

Browser commands, with `PLAYWRIGHT_PORT=4197`:

```powershell
node node_modules/@playwright/test/cli.js test campaignAttention.spec.ts mobile.spec.ts campaignTutorial.spec.ts controls.spec.ts --grep 'authoritative idle priority|progression choice:|guidance pending postmortem|action confirmation shared immediate gold: Add server|Chapter 0 requires real|Challenge incident transport' --retries=0 --output=../test-results/progression-attention/browser-artifacts

node node_modules/@playwright/test/cli.js test campaignAttention.spec.ts mobile.spec.ts --grep 'progression choice:' --retries=0 --output=../test-results/progression-attention/browser-final-artifacts
```

Real desktop and 320px captures were inspected: the existing risk explanation button has the complete strong ring, while Run and Hint are unmarked. The phone cases assert full target visibility after ordinary explicit scrolling and enable reduced motion. Automatic attention does not perform that scrolling. The opened explanation/purchase/Cancel journeys assert that merely viewing choices does not write consent or simulation inputs.

Final local captures: [desktop decision gold](../test-results/progression-attention/browser-final-artifacts/campaignAttention-progress-1cc93-lanation-never-accepts-risk-chromium/growth-readiness-gold.png), [320px decision gold](../test-results/progression-attention/browser-final-artifacts/mobile-progression-choice--87b6f-planation-on-touch-at-320px-mobile-chromium/growth-choice-touch.png).

Artifacts stay ignored under `test-results/progression-attention/`. The unchanged Classic cases logged local `/api/session` refusal because the retained backend was not running; both passed and had no unhandled browser errors. No frontend/backend full coverage, complete browser suite, Safari/Firefox, real-device or screen-reader validation is claimed. Gold identifies an available interaction, not a guarantee that accepting growth risk is the best economic strategy; user playtesting remains appropriate.

All work remains local and unstaged. The 29 pre-existing pending paths are preserved; this task adds only the new report path, for 30 intentional pending paths overall. No simulation/store/persistence, backend/shared, dependency, workflow or deployment change is introduced.

Final `git diff --check` passed. No staged paths or unmerged entries; reviewer captures and other generated outputs remain ignored. No commit, push, PR, merge, deployment, branch creation or other-worktree modification was performed.
