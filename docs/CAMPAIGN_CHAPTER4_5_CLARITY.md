# Phase 3: Chapter 4 decisions and Chapter 5 report clarity

Local presentation work on `fe/campaign-guidance-phase-3`. The required fetch confirmed HEAD matches `origin/main` at `f05da9d`. Existing local Chapter 4/6 work, backups and stashes are preserved. Nothing is committed, staged or pushed.

## Chapter 4: evaluate before choosing

Previously, a protected company could Run between spikes because the resolver looked for overload, while the traffic cap hid the unmet incoming demand. It did not explain how many users were served or rejected. The new between-spike cue and Hint use deduplicated retained observations from recent readings and incident reports. Counts are labelled recorded evidence, not invented complete totals when observations are missing. The summary includes recorded incident count; missing observations are identified explicitly.

The player flow is **Prepare → observe Spike 1 → evaluate served/rejected traffic and service → choose an optional improvement or keep the strategy → test during Spike 2 → review**. Hint can mark an existing capacity, routing or database action. Gold still transfers through prerequisite controls and existing Confirm; nothing is bought or configured automatically. The resolver checks per-instance allocation and cache-adjusted database work before offering an optional removal of the limit. It also recognises that an enabled autoscaler is not proof that rejected demand has been served.

If no viable improvement is available, Hint points to Monitoring for evaluation. Recorded inspection lets it return to useful scheduled Run advice, including explicitly retaining the current strategy. Players may always use the ordinary Run control without purchasing anything. Existing preparation, active-spike and recovery Run paths, incident priorities and chapter gates are preserved. Popup colours, dimensions, dismissal and receipt behavior are unchanged.

## Chapter 5: explanation first, evidence available

Both the Reliability Outcome and incident reports overlapping its actual recorded failure use four primary sections: **What happened?**, **How did you recover?**, **What could be improved?**, **Key takeaway**.

The text distinguishes requested free restoration, natural return, actual spare promotion and observed routing changes. It does not credit an installed but unused protection, claim that failover creates capacity, or invent a repair from absent events. A substantial rejection note is shown when at least 10% of incoming requests in retained observations were rejected; that threshold classifies presentation only. Detailed counts remain available. Outcome evidence is bounded by the recorded completion event; an unrelated report after restoration is not rewritten as a new server failure. Chapter 6 reports retain their existing presentation.

Example from the deterministic protected, traffic-limited fixture:

- **What happened?** App 2 failed, leaving less capacity to serve users. No production incident was recorded during this period.
- **How did you recover?** Automatic failover brought a reserved spare into service; the failed server returned automatically. Five stable checks followed restoration. Many incoming requests were turned away by traffic limiting.
- **What could be improved?** Prepare enough healthy, connected capacity to serve more users without relying on the traffic limit.
- **Key takeaway:** Detect failures, keep a working route to healthy servers, and verify recovery. Restoring a server and recovering service are separate steps.

View Details retains the existing timestamps, detection source, promotion, restoration, request counts, spending, explanations, snapshots and event evidence. The existing recovery notice, report Continue company and outcome Continue operating acknowledgements remain authoritative and unchanged. Opening details and reports in other chapters do not receive the Chapter 5 rewrite.

## Changed paths in this task

Production:

- `frontend/src/game/chapter4Guidance.ts`
- `frontend/src/game/campaignAttention.ts`
- `frontend/src/game/reliabilityLesson.ts`
- `frontend/src/components/CampaignIncidentReport.tsx`
- `frontend/src/components/CampaignUI.tsx`

Tests/helpers:

- `frontend/src/game/chapter4Guidance.test.ts`
- `frontend/src/game/reliabilityLesson.test.ts`
- `frontend/src/game/__fixtures__/reliabilityOutcome.ts`
- `frontend/src/components/ReliabilityClarity.test.tsx`
- `frontend/e2e/chapter4Guidance.spec.ts`
- `frontend/e2e/reliabilityClarity.ts`
- `frontend/e2e/reliabilityClarity.spec.ts`
- `frontend/e2e/mobile.spec.ts`

This report is the only documentation addition for this task. Previously pending Chapter 6 and popup styling paths remain local.

## Validation

Node 22.23.3. The broader ten-file focused batch had 98 passes and three failures in the newly added report tests. The failures were corrected: jsdom does not reliably hide nested headings inside a closed details element, and the original protected fixture did not actually reject traffic. Component assertions now verify disclosure containment and collapsed state; real-browser checks verify native visibility. The protected rejection fixture uses the actual traffic-limit action. No expectation about actual rejection or acknowledgement was removed.

The affected three-file rerun passed 22 tests, including an additional autoscaler/capped-demand case. The final historical-scope wording checks passed all three model tests. **102 distinct focused cases have passing verification across these runs**, including existing Chapter 4, report, Chapter 6 and immediate Pause coverage. This is not a claim of one final 102-case batch.

Frontend lint, typecheck and production build passed on the final runtime source. The existing large Facility chunk advisory remains. No simulation, progression, finance, save-schema, backend, dependency or workflow change was made. Full coverage and exhaustive browser/backend suites are outside these focused checks.

**11 browser journeys passed in one focused run**, retries 0, 2.5 minutes. These cover the four real Chapter 4 event boundaries, immediate incident Pause/Confirm priority, evaluation/optional purchase cancellation/keeping the cap, Chapter 5 outcome and incident-report details/acknowledgements, the 320px touch outcome, and Chapter 6 final-review and restoration/routing regression journeys. The real WebGL room remains enabled. Desktop and touch screenshots were reviewed; the existing modal body remains scrollable on a narrow screen.

Commands, from `frontend/`, with Node 22:

```powershell
npm test -- --maxWorkers=1 src/game/chapter4Guidance.test.ts src/game/chapter4Attention.test.ts src/game/reliabilityLesson.test.ts src/components/ReliabilityClarity.test.tsx src/components/ReliabilityUI.test.tsx src/components/CampaignIncidentReport.test.tsx src/components/Chapter4StagePopup.test.tsx src/game/chapter6Guidance.test.ts src/components/Chapter6Guidance.test.tsx src/components/IncidentPause.test.tsx
npm test -- --maxWorkers=1 src/game/chapter4Guidance.test.ts src/game/reliabilityLesson.test.ts src/components/ReliabilityClarity.test.tsx
npm test -- --maxWorkers=1 src/game/reliabilityLesson.test.ts
npm run lint
npm run typecheck
npm run build
```

With `PLAYWRIGHT_PORT=4197`:

```powershell
node node_modules/@playwright/test/cli.js test chapter4Guidance.spec.ts reliabilityClarity.spec.ts chapter6Guidance.spec.ts mobile.spec.ts --grep 'Chapter 4 decisions:|engine boundary enters|Chapter 4 cues: Respond|Chapter 5 clarity:|post-review restoration|final review owns' --retries=0 --output=../test-results/chapter4-5-clarity/browser-artifacts
```

Git whitespace/index checks passed: no staged changes or unmerged entries. No commit, push, deployment or other-worktree modification was made. Generated screenshots/traces remain ignored under `test-results/chapter4-5-clarity/`. Chromium touch emulation is not real-device, Firefox, Safari or screen-reader acceptance. No new unresolved issue was found in the scoped checks; the previously documented Chapter 6 financial limitation remains outside this task.
