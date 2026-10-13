# Campaign Mode UX refinement using Classic as reference

This is the historical refinement report from the original workspace. For the
subsequent integration with latest main, its preserved updates and current
validation, see [Phase 7 main integration](PHASE_7_MAIN_INTEGRATION_REPORT.md).

Reviewed: 11 October 2026. Repository: `C:/Users/user/99.9-Percent`. Branch: `ai/phase-7-ux-integration`. HEAD: `993a0240213789cfa7808e942a130a5c677324b0`. The existing Phase 7 cherry-pick remains in progress; this pass neither stages resolutions nor continues it.

This presentation pass responds to the supplied feedback from **two first-time Campaign players**. These are the user's prior interview observations, not new sessions conducted during implementation. No deployment, duration, learning improvement or participant acceptance is claimed.

## Findings and decisions

Classic's tutorial uses a short goal, a highlighted next interaction, concise contextual help, labelled controls and shared modal/typography conventions. Campaign's three original introduction paragraphs supplied information without a meaningful interaction. Its icon-only Run control competed with a primary manual-step button, and action tooltips left costs and differences easy to miss.

Adapted: short goals followed by clickable examples, selected-state feedback, comparable action information, prominent clock controls and progressive disclosure. Reused the existing Modal, Act, icons, store selection/actions, chapter model and onboarding metadata. Intentionally did not copy Classic's required purchases, weekly turns, promotion tutorial, solution-specific incident hints or tutorial store: those are coupled to different gameplay. There is no new progression system or campaign state.

## Changes and boundaries

| Area | Result |
| --- | --- |
| Getting started / Stage 0 | An interactive presentation of the existing three persisted prompts, before physical Opening play: explore Users → App Server → Database; compare successful/rejected requests; explore clock, actions and tree. |
| Component interaction | Selecting App Server/Database uses the existing UI selection and actual snapshot demand/capacity. It does not inject a gameplay inspection, purchase, trace event or stable-service observation. Practice is explicitly labelled. |
| Tutorial lifecycle | Next, Back, Skip, replay and interrupted-prompt resume retain the existing metadata shape/version. Finish and Skip leave the company paused. Existing completed/skipped preferences are respected; no compulsory repeat tutorial. The 1–3 minute duration remains a human-test target, not a measured result. |
| Terminology | Campaign's request path, inspection selector and evidence table use **App Server**, defined as a server running the application. Existing instance labels such as App 1 and shared office label Servers remain; internal IDs are unchanged. |
| Progression | Existing six-chapter bar remains pinned, with actual completed/current/available-next/locked state. Getting started ✓ reflects existing onboarding completion, without a new milestone or reward. |
| Actions | Campaign-only wrapper keeps each original button, price, dispatcher and disabled predicate. A short effect stays visible; Effect & costs reveals exact setup, cash after setup, activation, upkeep and upkeep change. Add Server installs another instance requiring routing; Scale Up changes the selected instance. |
| Disabled controls | Visible explanations cover insufficient cash, occupied slots, largest tier, pending infrastructure/admission work, locked research, missing load balancing/routing, cache prerequisite, missing healthy spare, existing deployments and pending acknowledgements. Routing disclosure identifies missing LB and pending route/retirement work. Existing tree detail retains prerequisite/ownership information. |
| Financial clarity | Successful requests earn $0.20; failed/rejected work earns nothing. Cash is available now; pending revenue is unspendable until the existing 60-step settlement. All figures use current state and existing scenario constants; no profit forecast or changed equation. |
| Traffic limiting | Before purchase: rejects above 500 req/s, with unchanged upkeep. While active: measured admissions/rejections and an explicit infrastructure/salary warning. Existing opportunity-value evidence remains; it is not a fine. No additional confirmation or rule was introduced. |
| Purchase safety | Exact cash-after-setup and operating-cost details, pending/low-cash reasons and explicit no-refund/undo wording support comparison before acceptance. No refund, sell, revoke, new affordability gate or enforced purchase is added. |
| Clock | Run company / Pause company is the primary visible control; accessible names Run/Pause and the P shortcut are retained. Advance step remains available under **More controls**, with its modeled-second explanation and original incident restriction. Pacing controls and activation delays are unchanged. |
| Investigation | **Pause & inspect** explicitly calls the existing pause and real free-inspection actions. Ordinary component selection retains its existing clock policy. Closing a view does not silently restart play. |
| Paused presentation | Visible paused/running state and a Campaign-only paused footer border. Shared room animation remains unchanged; see the limitation below. |
| Tree | Introduction explains Capacity/Data/Reliability and capability ownership versus deployment. Opening the real tree has a short contextual explanation; all nine labelled nodes, existing details, prerequisites and ownership rules are preserved. |
| Read Cache | Short card explanation plus existing details explain reuse of read results, cold activation, misses and writes. Cache mathematics, workload selection and warm-up are unchanged. |
| Copy and popups | Pending actions and acknowledgements stay visible. Combined-stage requirements and promotion detail are expandable. Postmortem leads with its recorded summary; remaining actual causes/actions/trade-offs and all recorded observations are retained in disclosures. No acknowledgement becomes automatic. |
| Desktop / mobile | Campaign panel is 420px on desktop, with compact labelled inspection controls and action metadata. All three Opening responses fit at 1440×900 before/after selection. Mobile preserves its existing panel layout and touch-sized tutorial buttons; the optional precision control is tested at 390×844. |
| Accessibility / navigation | Native labelled buttons/disclosures, pressed states and existing Modal focus/escape behavior are reused. Keyboard component activation and touch/reload journeys pass. Main menu, sound, graphics, mode choice, camera and shared control implementations are unchanged. Screen-reader and real-device acceptance remain untested. |

## Proof of scope

**Classic Mode was not behaviorally modified. Campaign Mode logic/balance remains unchanged.**

Before edits, SHA-256 checksums were captured for existing frontend source, game/simulation/shared modules and browser tests. All **90 existing simulation/game/shared-model files** still match, including store, persistence, save-envelope dispatch, campaign guidance/progression rules, telemetry and every physical scenario. The following shared/Classic files also match: `Tutorial.tsx`, `TechTree.tsx`, `ui.tsx`, `Game.tsx`, `scene/Facility.tsx`, `index.css` and `e2e/classic.spec.ts`. Only Campaign components instantiate the new presentation wrapper/styles. The deferred auth/cloud stash remains present and unapplied; main's already merged account/audio/settings code is preserved.

No equations, costs, thresholds, pending-action rules, stage gates, save fields/schema, ownership, research grants, reliability effects or replay/reset semantics changed. Practice selection is UI state only; real Pause & inspect is an explicit user action through the existing store. No camera system, parallel tutorial store or new game mode was introduced.

The pending Opening prevention decision is **unchanged**: under the integrated main rule, a new prevention-only company does not unlock Scaling without a real recovered Opening incident and acknowledged report/milestone. This known product-design mismatch is not silently repaired by tutorial copy or by manufacturing an incident.

## Files changed by this pass

26 files, distinguished from the pre-existing Phase 7 integration work:

Production (five):

- `frontend/src/components/CampaignUI.tsx`
- `frontend/src/components/CampaignChapters.tsx`
- `frontend/src/components/CampaignIntroduction.tsx` — new, existing onboarding presentation
- `frontend/src/components/CampaignAction.tsx` — new, information wrapper around shared Act
- `frontend/src/components/CampaignUX.css` — new, Campaign-only selectors

Unit/UI tests (four): `frontend/src/App.test.tsx`, `frontend/src/components/CombinedUI.test.tsx`, `frontend/src/components/Tooltip.test.tsx`, and new `frontend/src/components/CampaignRefinement.test.tsx` (12 cases).

Browser tests/helper (16): `frontend/e2e/accounts.spec.ts`, `chapters.spec.ts`, `combined.spec.ts`, `dataStrategy.spec.ts`, `fixtures.ts`, `gameplay.spec.ts`, `guardrail.spec.ts`, `import.spec.ts`, `mobile.spec.ts`, `modes.spec.ts`, `prevention.spec.ts`, `reliability.spec.ts`, `scaling.spec.ts`, `sound.spec.ts`, `spikes.spec.ts`, and new `campaignUX.spec.ts`.

Existing browser tests open the secondary step control through the public UI. Routing selectors target the actual summary rather than explanatory text. Old five-chapter assertions were corrected to the six chapters already implemented by Phase 7. Changes in `accounts.spec.ts` are Campaign step-selector adaptations, not auth implementation.

Documentation: this report. No other report/contract, production config, manifest or lockfile was edited by this pass.

## Verification

Node **22.23.3**, npm **11.16.0**, commands from `frontend/` with the Node 22 binary first on PATH:

| Check | Evidence |
| --- | --- |
| `npm run lint` | PASS, repository's current oxlint command; no warnings. The older 23-warning ESLint baseline is not this integrated main's linter. |
| `npm run typecheck` | PASS. |
| `npm test -- --reporter=verbose` | PASS: **732 tests**, **one optional TRACE skip**, 65 passing files and one skipped file. Includes all 25 balance cases and the 192 combined configurations. |
| Focused final UI recheck | PASS: **41 tests / five files**, including all 12 new usability cases, after the final copy changes. Final spacing changes afterward are CSS only. |
| `npm run build` | PASS on final CSS/TypeScript/Vite build. |
| CI Playwright | **21 distinct relevant journeys verified across runs and focused corrections, all with retries disabled**; this is not a claim that the full browser suite ran cleanly once. Details below. |
| `git diff --check` and new-file trailing-whitespace inspection | PASS. Git emits normal existing LF-to-CRLF normalization notices. |
| Classic regressions | Full unit suite plus four unchanged browser cases: complete interactive tutorial/purchase/reload, corrupt-save recovery, confirmed reset with supplied replay seed, incident diagnosis/recovery/postmortem. |
| Coverage / backend | Not rerun for this presentation-only pass; no backend files changed. No database, dependency, deployment or stash operations. |

The full unit run preceded the last copy/layout refinements; the affected five UI files were then rechecked (41 PASS), and final CSS was built and exercised in the browser. Physics/store/persistence checksums remain identical across those changes.

Browser command settings: `$env:CI='true'; $env:PLAYWRIGHT_PORT='4181'`, `node node_modules/@playwright/test/cli.js test … --retries=0`. Selected files were `campaignUX.spec.ts`, `gameplay.spec.ts`, `combined.spec.ts`, `mobile.spec.ts`, `classic.spec.ts` and `chapters.spec.ts`, filtered to new UX, three Opening recovery paths, combined journeys, four Classic paths and chapter guidance.

Initial 19-case selection: 16 PASS, three failures (two ambiguous routing locators and an actual viewport regression). After correcting selectors/copy, the expanded 21-case selection had 18 PASS and three failures (two stale five-chapter counts and the viewport after selection). The counts were corrected without changing chapter state; focused six-case run then had five PASS and only the layout failure. Subsequent desktop rechecks kept both new UX cases passing; the final real-WebGL Opening upgrade case passed after the Campaign-only spacing correction. These runs collectively verify all 21 selected journeys; no failures were hidden through retries or weakened visibility assertions.

Coverage includes fresh guest progression through all stages with API requests blocked; explicit consent; promotions and actual incidents; final review/completion/replay; mobile scorecard/tree/reload; introduction keyboard/touch/skip/resume; action-cost comparison; explicit inspection pause and no automatic resume. The three Opening paths remain DB upgrade, admission relief and ineffective app addition followed by DB recovery.

Expected environment messages: NO_COLOR/FORCE_COLOR warning, existing Three CJS deprecation during unit tests, and `/api/session` connection refusal in journeys intentionally run without a backend. No unhandled browser errors were accepted. Source/gallery/scene-specific paths use real WebGL; journeys that do not interact with the room use main's existing `withoutRoom` fixture.

## Remaining human-testing and approval limits

Retest with fresh players: can they explain the App Server/Database distinction, what earns spendable money, why adding capacity differs from routing, when to Run/Pause and where they are in the campaign? Observe whether optional cost details are noticed before purchases and whether later-stage controls still feel dense. Record actual duration and assistance; do not infer comprehension or enjoyment from automation.

Shared animation was not modified. Automatic approval review rejected a proposed shared Facility packet-clock change because Classic neutrality had not been established and the repository still has unmerged index entries. The renderer/camera/crew and traffic animations remain intact; clearer clock state is implemented, but freezing room traffic when Campaign pauses remains deferred. There is no permission bypass or pending shared renderer patch.

Desktop/mobile rendered screenshots were inspected during refinement, and real WebGL response visibility is tested. Wider Campaign panels can still obscure some office labels; existing camera and component-selection controls remain. Real-device, screen-reader, human acceptance and deployment verification remain **NOT TESTED**. No new sessions or release are claimed.

The prior integration conflicts/index state remains pending independently. Nothing was staged, committed, pushed, stashed, deployed or cherry-pick-continued. Stop after Campaign UX refinement.
