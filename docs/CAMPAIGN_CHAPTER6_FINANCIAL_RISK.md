# Phase 3: Chapter 6 financial risk warnings

Local work on `fe/campaign-guidance-phase-3`, based on `f05da9d4ddedc63d46a23d25bbe8a298572cdb5a`. The required fetch confirmed HEAD matches `origin/main`. Previous Chapter 4/6, report, Hint and spotlight changes remain intact. Nothing is staged, committed or pushed; backups and all three safety stashes are preserved.

## Verified root cause

`combinedCampaign.ts:canEnterCombined` requires acknowledged reliability/spike outcomes, stable management and positive cash. `stableManagement(s)` accepts healthy traffic-limited service; only `stableManagement(s, true)` requires serving full incoming demand. Entry charges no fee and does not increase operating costs. Later readiness and wave/final completion need five full-demand stability checks.

The dead end therefore starts before Chapter 6: the player can recover Opening with a traffic limit, explicitly accept Scaling risk and complete the intervening chapters without buying capacity. Healthy admitted traffic is not proof that the business is financially sustainable. Keeping the cap while waiting consumes the available cash.

The new `cappedFinancialPredecessor` and `financiallyTrappedCompany` fixtures use `newGame`, accepted public decisions and deterministic engine advancement only. No cash, equipment, evidence or progression overrides produce the trapped fixture. The path limits traffic at game second 11, completes Chapters 1–5, then waits with capped service. At second **660**, it legally enters Chapter 6 with:

| Evidence | Value |
| --- | --- |
| Available money | $560 |
| Installed application | One base server, 1,000 capacity |
| Database / cache | 600 capacity / no cache |
| Traffic cap | 500 requests per second |
| Fixed cost per 60-game-second period | App $700 + database $500 + salaries $6,400 = **$7,600** |
| Capped ongoing revenue ceiling | 500 × 60 × $0.20 = **$6,000** |
| Optimistic uncapped revenue ceiling | 600 × 60 × $0.20 = **$7,200** |

`step.ts` counts successful completed DB work plus actual cache hits; without a cache the database's 600 processing budget bounds earnings even during unhealthy, uncapped play. `settlement.ts` charges installed equipment and salaries independently of rejected traffic. `step.ts` rejects purchases that would leave zero or negative cash.

Removing the cap can raise throughput but cannot make this setup profitable or meet full-demand readiness. The regression's uncapped continuation bankrupts at second **780**, with no completed waves. This is this fixture's timeline, not a universal bankruptcy deadline; the earlier audit's reported second 840 is not used as an assertion for this newly reconstructed action log.

## Alternatives evaluated

| Existing option | Result for this company |
| --- | --- |
| Add server / load balancing | Each costs $1,000; unavailable at $560. One existing server also offers no spare route to connect. |
| Scale up / DB upgrade / cache | $2,000 / $3,000 / $1,500; unavailable. Research or inspection alone adds no capacity. |
| Free routing, spare release or restoration | No other server, reserved spare or failed server is available to recover. |
| Keep/remove traffic cap | Keeping it loses revenue; removing it cannot exceed the DB revenue ceiling and causes overload. Neither funds preparation. |
| Promotion | The $500 action is legal but adds demand, not capacity. The tested company falls to $60 and still bankrupts. |
| Health checks | Detection does not increase processing capacity or reduce fixed costs; it adds expense. |
| Equipment sale/downgrade | No manual Campaign sale/refund/downgrade exists; Classic `remove_server` is rejected. Automatic retirement requires eligible autoscaler-managed equipment and at least two remaining instances, absent here. Disabling controllers does not remove their upkeep. |
| Unsettled earnings or already paid deployment | Must be checked before declaring a funding trap. These can make other low-cash companies recoverable. |

Earlier investment with the original larger cash budget can avoid this situation. Once this particular setup reaches $560, guidance cannot repair it under the current rules. Existing options are financial inspection, exporting the company and starting a new company; there is no newly introduced rescue or automatic reset.

## Implemented presentation

`chapter6FinancialRisk` reuses authoritative installed/accrued charges, prices and revenue units. It has two distinct outputs:

- **Capacity funding blocked:** deliberately restricted to the verified original one-app/600-DB setup, without cache, other equipment, unresolved restoration, pending changes or a usable spare/routing option. It includes already earned revenue and conservatively rounded remaining costs when bounding the next cash update. Only when neither current cash nor the optimistic next receipt can fund even the cheapest capacity purchase does it use the stronger message. Since even optimistic subsequent full periods lose money and no free cost reduction exists in this setup, waiting cannot fund the missing capacity.
- **Money at risk:** a qualified estimate, never a claim that recovery is impossible. It compares recent earnings with running costs. It also warns when the cash buffer is at most one period's upkeep and the current traffic cap's ongoing earnings ceiling falls below that upkeep—even if the preceding period was profitable. Temporary queue receipts, pending work and future player decisions can change the outcome.

The existing side panel shows the warning during Chapter 6 and when Chapter 5 is acknowledged and Chapter 6 entry is available. It therefore warns before entry without changing entry eligibility. The existing finances dialog explains the same distinction.

Hint retains actual available capacity/routing/repair actions, useful paid deployment time and valid recovery verification. Financial review replaces the generic Menu fallback when no immediate preparation action is available and financial evidence supports it. The flow is **10 eligible seconds → Hint → short explanation → Got it → existing View finances control glows**. No financial panel opens automatically. Reading guidance does not spend money or advance time. Opening finances still uses its pre-existing pause behaviour.

Immediate Pause/Confirm, mandatory reviews, one primary spotlight, safe limit-removal checks and the existing Chapter 4/6 guidance remain in place. The cash control's bounds are compared before/after its spotlight in desktop and touch browsers; no header layout or styling was changed.

## Policy proposed and decision

Proposed follow-up: reject Chapter 6 entry only for a narrowly proven no-path case after accounting for pending earnings, free repairs/routing/spares/cache and deployments; explain why and return to the company. Existing Chapter 6 saves would remain loadable with warnings and export/restart options. This would prevent new entry into the verified trap, but would not rescue an already insolvent company.

**User decision: “Keep warnings only for now.”** No economic formula, price, entry gate, bankruptcy condition, financial assistance, simulation source, progression predicate, evidence, save schema or backend contract changed. The test deliberately verifies that the trapped predecessor can still enter Chapter 6 under the unchanged rules.

## Validation

Node **22.23.3**, one test worker. Results are focused checks, not full coverage or a complete browser sweep.

| Check | Result |
| --- | --- |
| Initial financial/finance/guidance/Pause/Confirm batch, eight files | **102 passed** |
| Affordability-boundary/component follow-up | **11 passed**, including one new boundary |
| Final four affected financial/guidance/component files | **37 passed**, including the added current-cap/profitable-history case; **104 distinct focused cases** have passing verification across these runs |
| Final frontend lint / typecheck / build | Passed; lint has no warnings; existing large Facility chunk advisory remains |
| First real-room desktop/touch browser batch | **4 passed**, 2.6 minutes: new financial trap desktop/320px touch plus existing preparation/routing/Confirm/Run/readiness/reload journeys |
| Final financial browser batch | **3 passed**, 1.2 minutes: trap desktop/touch plus a public-action low-buffer company that safely uncaps with no purchase |
| Git checks | `git diff --check` passed; nothing staged or unmerged; simulation/store/persistence/backend/shared/workflow paths unchanged |

All **five distinct browser journeys** have passing verification across the two batches; there was no single five-case run. Browser retries remained zero. No assertions, skips, timeout budgets, room rendering or gameplay rules were weakened. Tests cover the exact trap, unaffordable/ineffective alternatives, unchanged bankruptcy after poor spending, healthy companies, recoverable free routing, cache/spare/deployment exclusions, pending cash receipts, strict purchase affordability, safe uncapping and warnings recalculating after action.

The exact trap and browser low-buffer fixtures use public engine actions and replayable saves. Separate unit tests explicitly adjust cash or a historical ledger to exercise boundaries; these are not claims that those synthetic combinations arise from the public fixture. Browser checks compare the full replayed company before/after financial inspection and reload, assert a sole Hint/finances spotlight, and verify that a recoverable company reaches five full-demand checks without losing cash or opening an incident. Manual review included the 320px finances warning screenshot.

Initial reproduction diagnostics checked admission timing to locate the exact $560 path; they did not grant the fixture money. An initial typecheck caught a test-only Testing Library option unsupported by this setup; it was removed. Final checks pass.

Browser commands, from `frontend/` with `PLAYWRIGHT_PORT=4197`:

```powershell
node node_modules/@playwright/test/cli.js test chapter6Finance.spec.ts chapter6Guidance.spec.ts mobile.spec.ts --grep 'Chapter 6 finances:|Chapter 6 guidance: capacity before removal|Chapter 6 guidance:.*preparation' --retries=0 --output=../test-results/chapter6-finance/browser-artifacts

node node_modules/@playwright/test/cli.js test chapter6Finance.spec.ts mobile.spec.ts --grep 'Chapter 6 finances:' --retries=0 --output=../test-results/chapter6-finance/browser-final-artifacts
```

Artifacts remain ignored under `test-results/chapter6-finance/`. Backend/balance/full coverage were not rerun: production changes are presentation only. Chromium touch emulation does not establish real-device, Safari/Firefox or screen-reader acceptance.

## Changed files and remaining limits

Production presentation:

- `frontend/src/game/chapter6Finance.ts` — pure, conservative financial warning model.
- `frontend/src/game/chapter6Guidance.ts` — financial fallback after valid action/waiting priorities.
- `frontend/src/game/campaignAttention.ts` — ephemeral `finance` guidance target.
- `frontend/src/components/CampaignAttention.tsx` — target the existing finances button without a new spotlight owner.
- `frontend/src/components/CampaignUI.tsx` — side-panel warning.
- `frontend/src/components/CampaignFinance.tsx` — explain the funding trap/risk in existing financial health.

Tests/helpers: `frontend/src/game/__fixtures__/chapter6Finance.ts`, `frontend/src/game/chapter6Finance.test.ts`, `frontend/src/game/chapter6Guidance.test.ts`, `frontend/src/components/Chapter6Finance.test.tsx`, `frontend/e2e/chapter6Finance.ts`, `frontend/e2e/chapter6Finance.spec.ts`, `frontend/e2e/mobile.spec.ts`.

Report: `docs/CAMPAIGN_CHAPTER6_FINANCIAL_RISK.md`. These files include extensions of already pending Phase 3 work; unrelated prior changes are preserved.

The verified trap remains legally enterable and financially unrecoverable under the unchanged rules, as requested after the policy review. The warning model is not a general solvability solver or a complete investment plan. More complex financially blocked configurations may receive an estimated-risk message or ordinary capacity guidance; lack of the strong warning is not proof of eventual winnability. Paid preparation can have several prerequisites and future service/cost consequences. Guidance never guarantees that an accepted purchase will recover the company.
