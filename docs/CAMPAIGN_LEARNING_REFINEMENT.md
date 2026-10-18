# Campaign learning and guidance refinement

> Historical feature report. For the current integrated branch, Chapter 0 compatibility and fresh validation, see [Campaign Git integration audit](CAMPAIGN_GIT_INTEGRATION_AUDIT.md). Earlier test counts, preview URLs and ignored screenshots below describe their original runs.

> The later [Automatic Campaign Hint fix](CAMPAIGN_AUTOMATIC_HINT_FIX.md) supersedes this report's automatic-offer exclusions for incidents, progression decisions, open evidence and paused unfinished stability stages. Its report contains the current policy, validation and screenshots.

Local audit, 17 October 2026. Scope: the existing `fe/campaign-guidance-rewards` worktree, including uncommitted Development B. No publication or gameplay-rule changes are authorized. This report supplements, rather than replaces, `CAMPAIGN_GUIDANCE_REWARDS.md`.

## Verified flow matrix (before implementation)

All chapters inherit the same company's cash, installed equipment, pending actions, queues and reports. “Healthy” below means `qualifiesForRecovery`: latency <500 ms, service errors <1%, positive admission and completed work. Recovery requires five consecutive physical observations; pause adds none. Reports require a matching `review-acknowledged` trace entry. Purchases require strictly positive remaining cash and a free infrastructure channel; routing/admission have separate channel checks. Installed applications do not help until routed; reserved spares are not serving capacity.

| Stage | Current state | Required objective | Correct next action | Valid alternatives | Completion condition | Hint target |
|---|---|---|---|---|---|---|
| 1: observe | One 1,000 req/s app, 600 ops/s DB, 300 initial req/s | Observe Opening growth to 800 | Run when no tutorial interaction remains | Inspect components; prepare ahead | Scheduled Opening growth consumed | Run / current tutorial control |
| 1: incident | Measured overload, pending work or unhealthy service | Diagnose and recover | Inspect DB/app evidence; let accepted actions activate | DB upgrade to 1,000; admission relief; combinations | Five qualifying recovery steps, actual report | Database / Servers; Run during verification |
| 1: review | Incident recovered | Understand recorded outcome | Existing recovery CTA, postmortem Continue, milestone Continue | Inspect chronological evidence | Recovered Opening report acknowledged and milestone acknowledged | Existing review controls |
| 1: prevention branch | Healthy full-demand 800, no incident opened | Record prevention evidence | Inspect app and DB after growth; Run five observations; review | Stay and experiment; no forced incident | Prevention recorded, **does not unlock Scaling** | Missing inspection / Run / review |
| 2: entry | Milestone normally enters Scaling automatically | Prepare for 1,400 growth | DB headroom to 2,000 or explicitly consider current-capacity risk | Keep preparing; existing consent waives headroom only | Readiness schedules growth after observation delay | Consider growth / DB inspection |
| 2: growth | Growth consumed, inherited DB/apps | Handle work and drain queues | Inspect application demand versus routed capacity | Vertical scaling; add app plus LB and routing; temporary limit | `canEnterData`: consumed Scaling growth, management, no incident, empty app/DB queues, reports acknowledged | Servers / routing disclosure / Run for pending installation |
| 2: continuation | Existing gate satisfied | Continue or keep experimenting | Existing chapter outcome / Next | Stay in chapter | Explicit `enter_data` | Next |
| 3: entry | Seeded read-heavy or write-heavy profile; inherited capacity | Observe 2,400 growth | Run while management and queues/reports ready | Cache, tuning, DB to 3,000; prepare app capacity | Data growth consumed | Run / Database |
| 3: workload | Measured reads/writes/hits/DB demand | Handle workload | Compare actual DB demand and backlog | Cache only eligible reads; DB upgrade; app scaling; optional workload contrast | `canEnterSpikes`: consumed Data, healthy management, positive cash, milestone, no incident, empty queues, acknowledged reports | Database / Cache / Run during verification |
| 3: continuation | Existing equipment already sufficient or corrected workload | Understand result and continue | Existing Data completion panel / Next | No cache purchase or contrast required | Explicit `enter_spikes` | Next |
| 4: pre-pulse | Inherited capacity; controller initially absent | Observe first pulse | Run if paused; watch if running | Prepare manually; optional controller research and deployment | First pulse starts at entry +8 | Run |
| 4: pulse 1 | 4,000 req/s until +28 | Inspect response to burst | Inspect demand, effective routing and DB queues | Manual scaling, controller, admission relief, hybrids | First pulse ends; recovery if needed | Servers / routing / Database |
| 4: between pulses | 2,400 baseline until +48 | Observe next pulse | Run / keep running | Prepare for second pulse | Second pulse starts | Run |
| 4: pulse 2 | 4,000 until +68 | Handle second burst | Evidence-based inspection or recovery verification | Same alternatives; no controller requirement | Second pulse ends | Evidence / Run |
| 4: baseline | Both deadlines passed | Verify stable baseline | Run remaining stable observations | Correct remaining queues/errors, review incidents | `runAutoscaler`: five healthy baseline management steps, empty queues, reports acknowledged | Run / postmortem |
| 4: recognition | `pendingSpikeAcknowledgement` | Review response | Existing Continue operating | History remains available | `acknowledge_spikes`; healthy baseline then permits Reliability | Review / Next |
| 5: preparation | Three research points; inherited app tiers/routing | Prepare or choose manual/natural restoration | Existing Start reliability test when engine accepts | Checks, real spare and failover optional; pending actions must finish | `arm_reliability` accepts stable management, cash, no pending actions/queues/incidents, reports acknowledged | Start test / Run pending actions |
| 5: scheduled | Fault armed | Observe failure | Run / keep running | Inspect installed and healthy routed capacity | Failure starts +8; natural restore +28 | Run |
| 5: failure | Highest-numbered healthy routed app fails | Observe health, preserve service | Inspect health and surviving routed capacity | Manual restore (free, 3 steps); natural restore; routing/admission relief; deployed failover promotes real spare | Fault restored; any actual incident recovered and report acknowledged | Servers / routing / Run verification |
| 5: stable | Fault restored | Verify stable service | Run remaining observations | Resolve queues/reports first | `observeReliability`: five healthy management steps, positive cash, empty queues, reports acknowledged | Run / review |
| 5: outcome | `pendingReliability` | Review measured failure/restoration | Existing reliability Continue | Review snapshots and event evidence | Acknowledged outcome, then `canEnterCombined` requires baseline, all healthy apps, finished actions | Review / Next |
| 6: readiness | Inherited capabilities, 2,000 users | Prepare next wave | Run five healthy full-demand steps | Optional upgrades/promotion, but promotion delays readiness | `canStartGrowth`: readiness 5, stable management, no promotion | Run / Remove traffic limit |
| 6: decision | Next wave enabled | Choose to expose company to growth | Start next growth wave | Prepare further before choosing | Explicit wave action | Start next growth wave |
| 6: pressure | One of three seeded scenarios | Handle real growth/pressure/fault | Inspect actual bottleneck | Combined strategies; no fixed purchase sequence | Pressure ended, fault restored, five stable full-demand steps, reports/actions complete | Appropriate evidence / Run |
| 6: round review | Completed round | Review outcome | Existing Continue company | Inspect costs and rejections | Three acknowledged rounds and final target registrations | Growth review |
| 6: final | Three reviews, target users | Verify final baseline and review | Run five final stable full-demand steps, existing scorecard completion | End active promotion, remove limit, restore apps first | `finalRequirements` and `complete_campaign` | Run / scorecard |

## Technology unlock matrix and recommendation

Campaign does not use Classic's generic `start_tech` build/release path. `techStatus`/`completedTechIds` project Campaign ownership. `TechTree.tsx:CampaignDetail`, `step.ts:applyCampaignInputInPlace`/`actInPlace`, `autoscaling.ts:spikeAction` and `reliability.ts:reliabilityAction` are the authoritative handoff.

| Capability | Current availability / prerequisites | Recommended availability | Trade-off / compatibility / regression |
|---|---|---|---|
| Add server | Opening, two slots; four from Spikes | Retain | Useful early preparation; moving to chapter 2 would remove a legitimate investment. Test Opening alternatives and slot limits. |
| DB tiers | 600→1,000 in Opening; 2,000 after milestone; 3,000 in Data | Retain | Curriculum already staged; preserve pending installations, tier projection and reload. |
| Larger apps | Milestone acknowledged; active base app and cash | Retain chapter 2 | No separate research build in Campaign; activation changes actual app capacity. |
| Load balancing/routing | Milestone acknowledged; deployment then explicit routing | Retain chapter 2 | Installing LB alone does not distribute requests. Test unrouted installed capacity and valid route pool. |
| Cache/tuning | Data stage; tuning needs deployed untuned cache | Retain chapter 3 | Already restricted. Test cold cache, writes, misses, warmth and old saved deployments. |
| Autoscaling research | Spike stage plus available point; one point awarded on entry | Retain chapter 4 | Already restricted. Research alone does not create controller/capacity. Test earlier refusal, deployment prerequisites and reload. |
| Autoscaling deployment | Research spent, deployed LB, balanced ≥2 apps, channel and cash | Retain | Activation creates controller; high threshold 80% ×3, provisioning 3, routing 1; low 60% ×6, cooldown 4. Static capacity remains valid. |
| Health Checks | Reliability stage, point then paid deployment | Retain chapter 5 | Already restricted; research is not detection. Test stage refusal and ownership/deployment distinction. |
| Spare | Reliability point; buy or reserve healthy unrouted empty app | Retain chapter 5 | Real capacity with upkeep and slot cost; research does not establish redundancy. |
| Automatic Failover | Reliability; owned checks + standby + deployed LB to research; deployed checks and healthy reserved spare to deploy | Retain chapter 5 | Does not manufacture capacity. Test reserve/routing races, cancellation and saved spare ownership. |
| Promotion | Combined stage, between waves, stable management, cash/cooldown | Retain chapter 6 | Adds temporary requests, not registrations. No economics changes. |

The strongest low-disruption recommendation is to explain the restrictions already implemented, not add locks. No technology availability change is proposed for implementation. All acquired equipment remains untouched; no save migration is needed for presentation changes. Any future lock must grandfather acquired/pending capabilities, preserve replay interpretation, and prove a no-purchase/manual path avoids deadlock.

## Critical findings and separate approval proposals

1. No current Campaign path researched autoscaling before Spikes or reliability technology before Stay Online. Classic definitions are a different mode. Existing ownership is not proof of operational effect.
   Selecting a locked node to read its detail is possible; that is not research or activation. `CampaignDetail` only renders research controls when `techStatus` is available, and the engine separately rejects decisions outside the teaching stage. Monitoring/metrics are baseline tools; they are not an advanced research unlock.
2. Early app additions and earlier app/DB/LB investments carry forward. This is legitimate preparation; extra purchases must remain optional.
   There are only two app slots before Spikes, each at most 1,600 req/s. Therefore inherited full-demand application capacity alone cannot cover the 4,000 req/s pulses (maximum 3,200 before entry). Additional pre-pulse preparation becomes possible inside chapter 4 when four slots unlock. Likewise, DB capacity is at most 2,000 before Data's 2,400 req/s growth; the 3,000 tier and cache become available inside Data. “Prepared ahead” must distinguish preparation before a challenge from acquisition in an earlier chapter. Existing cash, routing, capacity and cache can still reduce later required interventions; the explanation is tied to measured observations rather than assumed stage ownership.
3. Data can complete without cache/contrast, Spikes without controller, Reliability without checks/failover. These predicates measure service, not concept comprehension. Research alone satisfies none of those engineering gates.
4. Scaling's `canEnterData` does not require healthy metrics, positive cash, routing or a new app. Empty queues under a traffic limit can qualify. This is permissive relative to the chapter description, not proof the player learned routing. The old fixed completion text claiming added capacity/routing is unsupported and should be neutralized in presentation.
5. Spikes and Reliability allow limited-traffic success. Their next-entry predicates require baseline health but do not require `limit===null`; Combined final victory **does** require full admission. Explanations must state rejection rather than claim full-demand success.
6. Opening prevention is explicitly separate from recovered-incident progression. A player who prepares perfectly can remain in Opening indefinitely. This conflicts with the desired curriculum principle, but changing it requires approval; no artificial incident is added.
7. Reliability always requires its actual armed fault and restoration; prior spare capacity may preserve service but does not bypass the failure event. Autoscaler is blocked during the unacknowledged reliability test. Health checks filter detected failed routes; redundancy depends on surviving actual capacity.
8. No universal mandatory understanding gate exists. Existing reviews are appropriate places for non-gating evidence, including “Why did my system succeed?” disclosures. Human comprehension cannot be established by a green service metric.

| Apparent shortcut | Classification and evidence |
|---|---|
| One larger app handles Scaling without extra servers or LB | Legitimate vertical strategy: 1,600 routed req/s handles the 1,400 wave. `canEnterData` does not require a routing purchase. Completion wording must not claim LB was used. |
| Cache handles Data without another DB upgrade | Legitimate only with actual hits and adequate remaining DB demand. `classifyData` subtracts eligible hits from new DB work; deployment starts cold. Writes and retained backlog still matter. |
| DB upgrade handles Data without cache | Legitimate capacity strategy; no cache ownership gate exists. The 3,000 tier is available inside Data, not an earlier chapter. |
| Scaling/Data finish under admission relief | Existing permissive gates, not proof of full demand or concept comprehension. Scaling can advance with drained queues; Data additionally requires measured healthy service. Tightening those predicates would change gameplay. |
| Autoscaling researched before its chapter | Not reproducible through current Campaign actions: `spikeAction` rejects without a Spike stage. Selecting a visible node is not research. |
| Autoscaling researched but no controller | No operational effect: `researchSpent` records the unlock; a paid `deploy-autoscaler` activation creates the controller. Actual automatic app installation and routing are separate delayed actions. |
| Spike test passes without autoscaling | Legitimate manual/pre-pulse preparation or admission strategy. Full-demand static application capacity needs additional capacity inside Spikes because the inherited two-app maximum is below the pulse. Completion does not require research. |
| Reliability passes with inherited servers | Legitimate surviving capacity may help, but configured failed recipients still lose traffic until detection/rerouting/restoration. `effectiveTargets`, per-instance health, completed work and fault events distinguish the mechanisms. Health Checks ownership alone creates neither detection nor capacity. |
| No production incident opens in Reliability | Legitimate prevention by this test's actual preparation; the armed application fault must still occur and restore before five stable observations and review. No incident needs to be artificially forced. |
| Existing equipment satisfies Combined waves | Legitimate preparation; `finalRequirements` still requires three reviewed outcomes, target registrations, all healthy apps, finished work and five final stable full-demand steps. A prior research checkbox cannot satisfy these service predicates. |

**Proposals requiring explicit approval, not implemented:**

- Allow verified Opening prevention plus its existing review to satisfy the existing Opening milestone. Benefit: reward preparation without requiring failure. Risk: changes milestone/replay semantics and Scaling entry; requires migration policy, prevention/recovery equivalence tests and old-save replay tests.
- Tighten Scaling's continuation to measured healthy full-demand service if curriculum intent requires it. Benefit: prevent admission-only bypass; cost: removes a currently valid strategy and can expose cash deadlocks. Requires balance and manual/vertical/horizontal strategy regressions. Do not mandate buying LB when vertical scaling suffices.
- Reuse Data/Spikes/Reliability reviews for an optional explanatory question or explicit learning acknowledgement. Benefit: distinguish measured success from understanding. Cost: a mandatory gate changes progression/persistence. Prefer optional disclosures now; no required quiz.

Source evidence: `frontend/src/sim/step.ts` (`databaseUpgrade`, `canEnterData`, `classifyData`, `pendingStop`, activation and campaign actions); `autoscaling.ts` (`canEnterSpikes`, `runAutoscaler`, `spikeAction`); `reliability.ts` (`canEnterReliability`, `effectiveTargets`, `observeReliability`, `reliabilityAction`); `combinedCampaign.ts` (`stableManagement`, `canStartGrowth`, `finalRequirements`); `openingPrevention.ts`; `game/campaignChapters.ts`; `game/campaignGuidance.ts`; `components/CampaignUI.tsx` outcome/review controls. Regression sources: `sim/__tests__/campaignTechOwnership.test.ts`, `dataStrategy.test.ts`, `autoscaling.test.ts`, `reliability.test.ts`, `openingPrevention.test.ts`, `combinedCampaign.test.ts`, `game/campaignGuidance.test.ts`, and browser chapter journeys. Predicates above refer to the current local implementation, not planned proposal mechanics.

Direct source links: [physical steps and actions](../frontend/src/sim/step.ts), [autoscaling and pulse completion](../frontend/src/sim/autoscaling.ts), [failure, restoration and reliability completion](../frontend/src/sim/reliability.ts), [combined growth and victory predicates](../frontend/src/sim/combinedCampaign.ts), [prevention branch](../frontend/src/sim/openingPrevention.ts), [research ownership projection](../frontend/src/sim/tech.ts), [technology detail and deployment presentation](../frontend/src/components/TechTree.tsx), [existing chapter/review controls](../frontend/src/components/CampaignUI.tsx), [new read-only guidance](../frontend/src/game/campaignNextStep.ts).

## Approved implementation and verification

`game/campaignNextStep.ts` derives a current objective, control target, conservative Run eligibility and a semantic stage key. Keys track decisions, pulse boundaries, incidents, verification and blockers; cash, user counts, readiness counters and stable-step ticks are not embedded. `components/ChapterHints.tsx` uses that model for Chapters 1–6 in System overview and Incident, and the clock uses the same model. No new acknowledgement, saved field, incident, formula, completion predicate or technology lock is included.

The existing valid reviewed Confirm keeps its immediate persistent gold treatment across the shared purchase component. Opening's walkthrough retains priority. Diagnostic incident Pause takes priority while investigation is appropriate; measured recovery does not suggest Pause. Valid confirmation then takes priority over decision/hint cues. Mandatory progression decisions receive a cue after 12 eligible idle seconds and are revealed once in the current panel without moving keyboard focus; ordinary Run after 10; an explicitly accepted Run hint can cue it immediately. Existing review Continue buttons also receive the established gold treatment. Disabled/refused actions and stale quotes retain their guards. Scroll-generated hover cannot cancel a decision cue; synthetic touch hover is ignored while real pointer-down, keys, wheel and dragging still reset inactivity.

Automatic offers use the existing focus-trapped Modal after 15 eligible paused idle seconds. Yes shows current advice; No, Escape and closing suppress another offer for that stage. Manual Hint remains available. The suppression set and accepted target live only in memory; reload starts a new presentation session and does not add persistence. Tutorials, open evidence disclosures, confirmations, views, chapter transitions, mandatory progression decisions/reviews and accumulating recovery/stability verification suppress automatic offers. Decisions retain their gold cue and manual Hint rather than competing with a help modal. Explicitly accepted hints can reveal/focus the existing control; automatic cues do not move focus, open panels, buy equipment or advance time.

`game/preparationEvidence.ts` reads retained snapshots, actions and events. Existing chapter outcome panels reveal a “Why did my system succeed?” disclosure when evidence exists. It separates cache hits from cache ownership, automatic provisioning/routing from research, and healthy routed capacity from detection. Preparation is measured against the challenge start, not just chapter entry. It labels limited observations and does not invent missing historical evidence or a counterfactual causal explanation. Scaling's completion introduction now states its real gate rather than asserting that added servers and routing must have carried the wave. Data's introduction describes the admitted workload; Scaling, Data and Spike outcomes explicitly note rejected requests when present.

### Chapter 4 and 5 wording

| Existing wording | State | New prominent instruction |
|---|---|---|
| Waiting for both announced traffic pulses to end | First pulse not started, paused | Run your company to observe the first traffic spike. |
| Same passive waiting text | First pulse not started, running | Your company is running. Watch for the upcoming traffic increase. |
| Both pulses completed: false | Pulse active, no inspection yet | Traffic has increased. Check application demand, routed capacity and database pressure. |
| Same checklist | Between pulses, paused | The first spike has ended. Run your company to observe the next. |
| Stable baseline observations: 4/5 | Both pulses ended, healthy, paused | Both traffic spikes are over. One more stable observation is needed. Run your company to verify stable service at normal traffic. |
| Same counter | Same state, running | Both traffic spikes are over. One more stable observation is needed. Keep running to verify stable service at normal traffic. |
| Spike response acknowledged: incomplete | Existing outcome ready | Your outcome is ready. Review spike recognition to continue. |
| Reliability test started: false | Arming enabled | Prepare if you wish, then start the reliability test to observe an application failure. |
| Stable service: 4/5 | Fault restored, healthy, paused | One more stable observation is needed. Run your company to verify stable service after restoration. |
| Reliability outcome acknowledged: incomplete | Existing outcome ready | Your outcome is ready. Review reliability outcome to continue. |
| Requirements: 9/11 | DB pressure actually outstanding | Inspect database demand, capacity and waiting work. Stable observations need healthy service and empty queues. |

Incident/review/pending-installation guidance takes precedence over those chapter messages. The complete original requirement checklist remains accessible.

### Optional future learning checks

- Scaling outcome: ask which installed apps actually received traffic. Accept vertical scaling as an alternative; do not mandate LB purchases.
- Data outcome: contrast recorded hits with writes and misses. If there were no hits, explain sufficient DB capacity instead of claiming cache benefit.
- Spike outcome: distinguish static headroom from a controller that actually provisioned and routed capacity. Research alone is not a correct operational explanation.
- Reliability outcome: distinguish detection, healthy surviving capacity, real spare promotion and restoration. An optional question can use this company's actual fault; a mandatory answer gate needs separate approval.

### Files changed by this refinement

New: this report; `frontend/src/game/campaignNextStep.ts`, `campaignNextStep.test.ts`, `preparationEvidence.ts`; `frontend/e2e/learningGuidance.spec.ts`.

Updated on top of existing local Development B: `frontend/src/components/CampaignUI.tsx`, `CampaignAction.tsx`, `CampaignChapters.tsx`, `ChapterHints.tsx`, `ChapterHints.test.tsx`, `chapterHintAttention.ts`, `CampaignFeedback.css`, `useGuidanceCue.ts`, `CampaignFeedback.test.tsx`; `frontend/e2e/chapterHints.ts`, `guidanceRewards.ts`, `spikes.spec.ts`; a pointer at the top of `docs/CAMPAIGN_GUIDANCE_REWARDS.md`. Earlier Development B and Finance/App Health changes remain in the worktree; the complete `git status` is recorded with the final evidence. No simulation, store, persistence, backend, shared-contract, dependency manifest or lockfile change is part of this refinement.

### Validation and preview

Node 22.23.3 is used directly; existing frontend dependencies are reused and backend dependencies were installed with `npm ci`. Generated evidence is kept under ignored `test-results/campaign-learning/` and `frontend/test-results/`. Root-level `test-results/campaign-learning-*.log` files retain the complete commands' output.

| Check | Actual result |
|---|---|
| Frontend lint | Passed, no warnings |
| Frontend typecheck and production build | Passed |
| Backend lint/typecheck | Passed |
| Complete backend coverage run | 61 passed across 10 files, 24.79 seconds |
| Initial complete frontend coverage attempt | 1,109 passed, 3 UI timeouts, 1 existing optional trace test skipped across 101 files; 1,011.50 seconds |
| Final affected frontend batch, with coverage | **158 passed across 10 files**, 72.74 seconds, original test limits and assertions |
| Additional final evidence/decision tests | 39 passed across 2 files, 21.39 seconds |
| Final attention, quote-safety and hover regression batch | 42 passed across 2 files, 52.14 seconds |
| Final diagnostic/verification model batch | 23 passed, 24.10 seconds |
| Final policy/attention batch | **66 passed across 3 files**, 81.84 seconds |
| Final browser batch | **16 passed**, retries disabled, native Playwright exit 0 (3.2 minutes) |

There are **166 distinct affected unit/component tests** verified in staged runs (the 158-case coverage batch plus eight additional cases), and **80 distinct browser journeys** verified in staged runs. These are not claims of single green 166-case or 80-case batches. The complete 34-path worktree, including pre-existing Development B, is listed in [changed-files.txt](../test-results/campaign-learning/changed-files.txt). This refinement changes/adds 18 of those paths as listed above.

The initial full coverage run exposed repeated render work. An intermediate normal batch passed Opening but hit a reliability tutorial timeout; intermediate coverage batches retained the Opening timeout. The final fix shares the derived guidance for an immutable published game snapshot, skips hint lookups when no hint is accepted, and memoizes rendered quotes and guidance. Actual Confirm dispatch still obtains a fresh engine preview. The pure model remains uncached for mutable fixtures. All three initially failing cases pass in the final 158-case coverage batch. No test assertion or timeout was relaxed. The complete 101-file coverage suite has not been repeated after these UI performance fixes; the final green coverage result is the affected batch, not a claim of a green complete-suite rerun. The skipped `trace.test.ts` case is the repository's existing opt-in `TRACE` diagnostic.

Final model/evidence helpers have substantial focused line coverage, but correctness is checked through observed outcomes, rejected-traffic and missing-history counterexamples, plus browser disclosures. The focused coverage percentage for the whole project is not a complete-project coverage measurement. No hosted CI, Safari, Firefox, physical-device or human comprehension validation is claimed.

Browser diagnostics are retained, not counted as passes: the broad batch had 66 passes and two failures; follow-up batches had 19/21 and 17/19 passes before the fixes. One paused 9,999 ms clock advance stalled and its browser session closed. Paused inactivity checks now use `fastForward`, retaining exact 9,999/10,000 ms assertions and unchanged physical-step assertions; running simulation checks still deliver every tick. A Spike fixture advanced a paused browser by a minute and correctly received the new hint offer; it now freezes one second ahead, preserving every simulation input and timing assertion. Visual review then exposed a scroll-generated hover cancelling the 320px decision cue; decision hover no longer cancels that cue. The phone fixture now enters with a real tap rather than leaving a mouse pointer behind before switching to touch. Finally, an automatic offer covering an available Next control exposed a real priority problem: mandatory decisions and open inspection disclosures now suppress automatic offers. All affected cases subsequently passed, including the final 16-case batch and isolated 320px touch check. No assertions, timeouts, engine data or gameplay rules were weakened to obtain these results.

The passing browser journeys cover a fresh guest completing all six chapters, both Data strategies, vertical/horizontal scaling, static and automatic spike responses, researched-versus-deployed capabilities, inherited failover, manual restoration, recovery/reviews, save/reload and corrupt saves, promotion trade-offs, Finance, App Health, the full Opening walkthrough and Classic's tutorial/purchase/reload. Desktop checks use 1440×900 and 1366×768; phone captures use 390×844 and 320×844, with additional actual Chromium touch emulation and reduced motion. The pre-existing 320px status-header crowding remains visible; decision buttons, Hint and purchase controls were checked for reachability and full visibility.

Key logs: [affected coverage](../test-results/campaign-learning-coverage-final.log), [final policy tests](../test-results/campaign-learning-policy-final.log), [final browser batch](../test-results/campaign-learning-browser-approved-final.log), [backend coverage](../test-results/campaign-learning-backend-coverage.log). Earlier failures remain in `campaign-learning-frontend-coverage.log`, `campaign-learning-browser-final.log`, `campaign-learning-browser-followup.log` and `campaign-learning-browser-delivery.log`, with screenshots/traces under ignored `test-results/campaign-learning/`.

### Screenshot evidence

| Viewport | Progression decision; Run unhighlighted | Manual Hint, normal | Manual Hint, Incident header |
|---|---|---|---|
| 1440×900 | [Gold decision](../test-results/campaign-learning/evidence/learning-growth-decision-1440.png) | [System overview](../test-results/campaign-learning/evidence/learning-manual-normal-1440.png) | [Incident](../test-results/campaign-learning/evidence/learning-manual-incident-1440.png) |
| 1366×768 | [Gold decision](../test-results/campaign-learning/evidence/learning-growth-decision-1366.png) | [System overview](../test-results/campaign-learning/evidence/learning-manual-normal-1366.png) | [Incident](../test-results/campaign-learning/evidence/learning-manual-incident-1366.png) |
| 390×844 | [Gold decision](../test-results/campaign-learning/evidence/learning-growth-decision-390.png) | [System overview](../test-results/campaign-learning/evidence/learning-manual-normal-390.png) | [Incident](../test-results/campaign-learning/evidence/learning-manual-incident-390.png) |
| 320×844 | [Fully revealed gold decision](../test-results/campaign-learning/evidence/learning-growth-decision-320.png) | [System overview](../test-results/campaign-learning/evidence/learning-manual-normal-320.png) | [Incident](../test-results/campaign-learning/evidence/learning-manual-incident-320.png) |

Confirm consistency: [Chapter 1](../test-results/campaign-learning/evidence/learning-confirm-chapter-1.png), [Chapter 2](../test-results/campaign-learning/evidence/learning-confirm-chapter-2.png), [Chapter 3](../test-results/campaign-learning/evidence/learning-confirm-chapter-3.png), [Chapter 4](../test-results/campaign-learning/evidence/learning-confirm-chapter-4.png), [Chapter 5](../test-results/campaign-learning/evidence/learning-confirm-chapter-5.png), [Chapter 6](../test-results/campaign-learning/evidence/learning-confirm-chapter-6.png), [390px touch](../test-results/campaign-learning/evidence/development-b-confirm-390.png), [320px touch](../test-results/campaign-learning/evidence/development-b-confirm-320.png).

Guidance and outcomes: [one-time Yes/No offer](../test-results/campaign-learning/evidence/final-b-offer-1440.png), [incident evidence target, Run unhighlighted](../test-results/campaign-learning/evidence/learning-incident-diagnostic-1366.png), [Chapter 4 final observation](../test-results/campaign-learning/evidence/learning-chapter-4-stable-1440.png), [Chapter 5 9/11, one observation left](../test-results/campaign-learning/evidence/learning-chapter-5-stable-390.png), [static capacity explanation](../test-results/campaign-learning/evidence/learning-chapter-4-outcome-1440.png), [surviving capacity explanation](../test-results/campaign-learning/evidence/learning-chapter-5-outcome-390.png).

Recorded examples: the Spike outcome shows 4,000 req/s admitted against 4,800 routed capacity at step 202 with no application backlog. The reliability outcome shows 3,200 healthy routed capacity serving 2,400 admitted req/s at step 282 while a server remained failed; detection, promotion and restoration are reported separately. Both explanations explicitly limit the claim to recorded observations. Tests reject static full-demand credit under a traffic limit and suppress historical claims when snapshots are missing.

Preview: the existing local server at **http://127.0.0.1:4198/** was verified to serve this worktree's build. If it stops, run from PowerShell:

```powershell
cd C:\Users\user\99.9-Percent-Latest\frontend
$refinementNode = 'C:\Users\user\AppData\Local\npm-cache\_npx\52027bd8fc0022aa\node_modules\node\bin\node.exe'
& $refinementNode node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4198 --strictPort
```

Continue/start Guided Mode and finish or skip the existing walkthrough. In Scaling, leave a headroom decision idle for 12 seconds; Run should remain unhighlighted. In any chapter use Hint immediately, or leave an eligible paused objective idle for 15 seconds and decline the offer; it will not repeat for that stage during the current presentation session. During an incident use Hint in the panel header. Preview an available purchase to see the immediate Confirm ring; Cancel preserves company cash. In Traffic Spikes or Stay Online, compare paused/running instructions and open the existing outcome evidence disclosure. These interactions use ordinary local saves and do not require the backend.

Everything remains local and uncommitted on `fe/campaign-guidance-rewards`, HEAD `4b8eda9`. No branch/worktree was created and no commit, push, PR, merge, migration or deployment was performed. Gameplay proposals above await separate approval; publication awaits the user's review.
