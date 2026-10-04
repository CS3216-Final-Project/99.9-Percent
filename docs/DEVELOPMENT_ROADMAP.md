# Development Roadmap: one continuous System Design Tycoon campaign

> Start with the [roadmap summary and proposal review](DEVELOPMENT_ROADMAP_REVIEW.md). The detailed phase specifications are in [phases/](phases/).
>
> Proposal reference: [99.99% Google Doc](https://docs.google.com/document/d/1VZQgBruLhEUj_p7P7EK_jIpkQpg_v2m1Gyh0ZCr8ceo/edit?tab=t.26iodeiyag9x). The review distinguishes proposal commitments from additional implementation decisions in this roadmap.

## 1. Revised product architecture

The game remains **one company, one evolving architecture, and one continuous campaign**.

The first 10–15 minutes introduce one main incident and approximately 3–4 meaningful choices. Recovery leads to a postmortem and growth milestone—not a separate lesson-completion screen. The player then continues with the same company, finances, infrastructure, and history.

### Decisions established

- The introductory experience ends at a milestone, with the same campaign available to continue.
- Authentication, accounts, and owner-scoped cloud saves are required for the final MVP. Guest play remains available.
- Preserve existing prototype saves and their metadata; replacing the campaign must not erase them.
- Metrics and alerts are available immediately.
- Later mechanics appear progressively within the campaign.
- Replay creates a new company with different seeded conditions.
- The first database incident is the initial development slice, not a permanent game mode.

### Architecture to build toward

See the [System Architecture diagrams](SYSTEM_ARCHITECTURE.md) for application/deployment boundaries and the separate infrastructure model inside the game.

| Layer | Responsibility |
|---|---|
| Deterministic simulation | Traffic, component processing, backlog, latency, errors, action delays, costs, failures |
| Campaign progression | Company growth, milestones, research, revealed controls, final target |
| Scenario configuration | Seeded workload and event parameters; fixed evaluation configuration |
| Player interface | Readable 2D architecture, metrics, actions, management controls |
| Educational feedback | Evidence-focused prompts and trace-based postmortems |
| Persistence and services | Local autosave, accounts, cloud saves, analytics |

Preserve the existing separation between `src/sim`, `src/game`, and `src/components`. The interface must consume simulation outputs rather than calculate its own capacity or incident outcomes.

### Core interfaces

- **Campaign state:** one run ID, seed, schema/scenario version, company state, architecture, pending actions, progression, incidents, and trace.
- **Simulation step:** a pure transition from state to next state and recorded events.
- **Action dispatcher:** validates resources and prerequisites, then applies or schedules actions.
- **UI snapshot:** component demand/capacity, backlog, health, latency, errors, rejected demand, costs, and action availability.
- **Campaign progression:** awards milestones and reveals capabilities without resetting the architecture.
- **Save envelope:** campaign state plus schema version and cloud revision.
- **Analytics event:** unique event ID, run/session/build/scenario identifiers, sequence, timestamp, and bounded payload.

Wall-clock analytics identifiers and timestamps remain outside deterministic gameplay calculations.

### Migration approach

Temporarily retain the old campaign behind a development-only switch while the replacement foundation is verified. It must not become a second player-facing product.

By PR2, the new engine is the default campaign foundation. Remove obsolete database-failure, automatic incident-timeout, monitoring-unlock, and 17-node progression paths as their replacements become complete.

Old saves remain preserved separately. Do not reinterpret old weekly-campaign saves as new simulation state.

Preservation is a prerequisite for introducing the replacement loader: leave `nn.save.v1`, `nn.meta.v1`, and `nn.analytics.v1` intact, and use a separate namespace for new campaign saves, onboarding metadata, and telemetry. Offer export of the legacy save without requiring the legacy campaign to remain playable. Reset, sign-out, and failed validation must not delete legacy data. Automatic conversion is outside the MVP; any future importer must validate a copy and retain the original.

### Backend choice

Keep the existing **Neon PostgreSQL + Drizzle + Express API** backend and **React + Vite + TypeScript + Zustand** frontend. Simulation stays client-side; retain the two existing Vercel projects and GitHub Actions pipeline. No database-provider or Next.js migration is required.

The existing repository setup supports these requirements; the integration constraints and required additions are recorded below.

- Allow immediate guest play with local autosave.
- Add **Google OAuth with OpenID Connect** to enable cloud saves. Google is the confirmed sign-in provider; implementation remains planned. Express handles the authorization code flow and issues an app session stored in Neon. See [🔑 Authentication](AUTHENTICATION.md) for identity, session, and deployment contracts.
- Associate an existing local run with its owner after sign-in.
- Verify identity in Express and enforce ownership in every save read/write query. The browser uses the API; Neon credentials remain server-side. Database row policies may add defence in depth, but are not a substitute for verified API authorization.
- Use an atomic owner-and-revision-conditional update for cloud saves; preserve both versions on conflict rather than silently overwriting. This fits the existing Neon HTTP driver without an interactive transaction.
- Queue analytics and save updates during connectivity loss.
- Add validated Express ingestion endpoints for guest analytics and public sign-ups; never expose database credentials to the frontend.
- Add game-specific account/run/save/event/sign-up tables through Drizzle migrations. Existing language-learning mission tables are legacy structures, not ready-made campaign storage.
- Keep pooled `DATABASE_URL` for runtime queries and `DATABASE_URL_UNPOOLED` for migrations. Preserve the Singapore backend region and existing preview/production configuration.
- Use new versioned local-save keys before loading the replacement campaign. The legacy loader deletes incompatible saves, so a version bump alone does not preserve them.
- Keep the landing page in the Vite app; use an entry-screen or hash navigation initially. If introducing pathname routes, add and verify the appropriate SPA fallback on Vercel.
- Do not build multiplayer, server-authoritative gameplay, or competitive leaderboards.

### Authentication delivery and acceptance

**Owner: Di Heng**, with frontend account UI integrated alongside the game UI.

- **Phase 2 / PR1:** configure the Google OAuth web client, consent screen, exact callback URLs, backend identity validation, and additive account/session schema. Plan a frontend `/api` proxy to the existing Express deployment and a local Vite proxy for cookie-based app sessions. PR1 gameplay remains guest-first and does not depend on authentication being complete.
- **Phase 3 / 12–16 October:** deliver working Google sign-in for first-time and returning players, app-session restoration, sign-out, and owner-scoped cloud save/resume. A guest can explicitly attach their current new-format run after signing in without changing the company or run ID.
- **Phase 5 / PR2:** complete account UI, save status, conflict handling, expired-session recovery, and production/preview configuration. Local play continues when authentication or connectivity fails.
- **Phase 8 / evaluation freeze:** verify Google sign-in/cancellation, invalid callbacks, two-account isolation, expired/invalid app sessions, sign-out, guest-to-account attachment, cloud conflicts, and cross-session resume against the Google integration and Neon API.

Final-MVP acceptance requires a player to sign in with Google, return in a fresh browser session and sign in again if needed, resume their own cloud run, and sign out. Reloads restore an unexpired app session. The API rejects unauthenticated private-save requests and prevents another account reading or overwriting the run. Switching accounts must not automatically attach a previously signed-in owner's local snapshot to the next account. Preserve pending local changes for the original owner; only explicitly selected guest runs may be attached to an account.

## 2. Phased development roadmap

Dates below use the supplied course schedule and Singapore time. Phases overlap; they are not ten separate weeks.

### Phase 0 — Establish the baseline
**Target: 4–5 October**

**Goal and player experience:** Preserve the current playable prototype while establishing a safe migration path. No new gameplay.

**Learning outcomes:** No new coverage; document where current behaviour contradicts LO1–LO4.

**Engineering:**
- Install existing dependencies and run typecheck, tests, balance checks, and production build.
- Record failures without assuming current tests pass.
- Map simulation-to-store-to-UI dependencies.
- Define the campaign state and UI snapshot contracts.
- Identify reusable controls, charts, scene interactions, and persistence.
- Separate temporary legacy initialization from the new campaign constructor.
- Inventory legacy storage keys and record old-save fixtures; agree a separate namespace and export path before replacement persistence is implemented.

**Existing modules:** Simulation types, entrypoint, state initialization, store, persistence, test configuration.

**New artifacts:** Migration notes, representative UI fixtures, baseline verification record.

**Automated testing:** Establish reproducible baseline results and identify tests tied to obsolete behaviour.

**Human validation:** Observe a small number of current-prototype sessions to identify confusing controls and useful interactions.

**Definition of done:** Baseline is documented, known failures have owners, contracts are agreed, frontend work can use fixtures, and legacy-save preservation is part of the persistence contract.

**Dependencies:** Current repository.

**Scope guard:** No new mechanics, visual redesign, or general simulation framework.

---

### Phase 1 — Shared simulation and first database incident
**Target: 5–8 October**

**Goal:** A headless, deterministic version of the opening campaign loop.

**Player experience:** Healthy operation → traffic growth → database overload → inspection → response → measured recovery → causal postmortem.

**Learning outcomes:** LO1 and introductory LO4.

**Engineering:**
- Introduce `src/sim/step.ts`.
- Model demand, processing capacity, bounded internal backlog, latency, service errors, and rejected demand.
- Use the same calculations during management and incidents.
- Schedule action activation consistently across both phases.
- Open overload after three consecutive overloaded steps.
- Recover only after five steps with latency below 500 ms and service errors below 1%.
- Remove action-declared recovery and forced timeout from the new path.
- Keep application addition, database upgrade, and traffic limiting as the limited responses.
- Record structured metrics and actions for postmortems.
- Preserve company and architecture state after recovery.

**Existing modules:** Simulation types/state, actions, derivation, turn advancement, incidents, postmortems.

**New modules:** Shared step engine, opening-event configuration, structured trace helpers, step tests.

**Automated testing:** Exact backlog arithmetic, activation order, recovery boundaries, ineffective application addition, limiting, reproducibility, and save serialization.

**Human validation:** Internal walkthrough followed by a small evidence-reading test: can players identify the constrained component without a recommendation?

**Definition of done:** Upgrade-only, limiting-only, and ineffective-then-effective paths all work; recovery is explained by recorded state.

**Dependencies:** Phase 0 contracts.

**Scope guard:** No cache, routing curriculum, reliability mechanics, full progression tree, or standalone lesson mode.

---

### Phase 2 — First playable campaign opening / PR1
**Target: 8–11 October**

**Goal:** A fresh player can experience the first meaningful incident in approximately 10–15 minutes.

**Player experience:** Inspect the startup, observe growth, choose a response, recover, read the postmortem, and reach a company milestone. Continue with the same company.

**Learning outcomes:** LO1 and LO4, supported through consequences.

**Engineering:**
- Replace prescriptive onboarding with short navigation and evidence prompts.
- Show traffic, latency, errors, utilisation, backlog, and action activation time.
- Build a minimal 2D architecture view with fixed layout, selection, and hover details.
- Expose only the opening controls.
- Add local save/reset and clear bankruptcy/recovery flows.
- Preserve legacy save/meta/analytics keys, add separate new-campaign storage, and provide legacy save export before using the new loader.
- Award the first milestone once; preserve architecture, cash, and ongoing restrictions.
- Introduce basic run/action/incident analytics.
- Extend the existing Neon/Express backend with authentication and cloud-save work in parallel.
- Publish a simple landing page with a play/sign-up call to action.

**Existing modules:** Game shell, tutorial/advisor, inspectors, incident panel, views/modals, styles, store and persistence.

**New modules:** 2D architecture component, telemetry client, backend client, account/save adapter, landing-page route.

**Automated testing:** Store transitions, milestone award idempotency, save/resume, event deduplication, introductory browser smoke flow.

**Human validation:** Observe approximately five fresh target users without explanations. Record help, confusion, enjoyment, and whether they ask to continue or replay.

**Definition of done:** PR1 has a complete playable opening with no facilitator-dependent interaction and no cosmetic recovery flags.

**Dependencies:** Phase 1 physical model; Phase 0 fixtures allow earlier UI work.

**Scope guard:** No full tree, elaborate animation, mandatory login, or forced waiting to make the session last 15 minutes.

---

### Phase 3 — Application scaling and routing
**Target: 12–16 October**

**Goal:** The same company can grow beyond its initial application capacity.

**Player experience:** Compare larger instances with additional instances; observe how routing determines whether installed capacity is useful.

**Learning outcomes:** LO1, LO2, LO4.

**Engineering:**
- Add per-instance demand, capacity, and utilisation.
- Implement vertical upgrades and delayed instance activation.
- Implement explicit traffic distribution.
- Separate installed capacity from capacity that actually receives traffic.
- Reveal scaling options after the opening milestone.
- Continue the same finances, architecture, and event history.
- Deliver working Google sign-in and owner-scoped cloud saves.
- Include first-time account access, returning-user sign-in, session restoration, sign-out, and explicit guest-run attachment.

**Existing modules:** State/types, step engine, actions, derived metrics, equipment controls, architecture view, persistence.

**New modules:** Small routing helper and cloud-save revision handling.

**Automated testing:** Per-instance routing, aggregate accounting, routing changes, activation delays, database constraints, save ownership, and cloud conflicts.

**Human validation:** Ask players to predict the effect of adding a server, then observe whether the displayed outcome changes their reasoning.

**Definition of done:** Application scaling helps an application bottleneck but cannot increase database capacity; the same campaign survives cross-session resume.

**Dependencies:** Phases 1–2 and backend foundation.

**Scope guard:** No arbitrary graph editor or sophisticated routing policies.

---

### Phase 4 — Data strategy and parameter variation
**Target: 16–20 October**

**Goal:** Workload and timing determine whether database investment or caching is useful.

**Player experience:** Adapt the existing company to read-heavy and write-heavy growth rather than repeat one upgrade sequence.

**Learning outcomes:** LO1, LO2, LO4.

**Engineering:**
- Extend the existing database upgrade rather than create another upgrade system.
- Add read share, cacheable-read share, cache warm-up, and hit rate.
- Add cache tuning effects.
- Define bounded seeded workload and event configurations.
- Separate scripted evaluation conditions from normal replay variation.
- Allow the same spike to cause application overload, database overload, or no incident.
- Centralize analytics ingestion and session/run attribution.

**Existing modules:** Step engine, scenario configuration, actions, metrics, charts, postmortems, telemetry.

**New modules:** Cache calculation helper and bounded scenario generator.

**Automated testing:** Cache arithmetic, warm-up, write-heavy limitations, repeatable event generation, and different outcomes under different architectures.

**Human validation:** Compare two workloads with fresh and returning testers. Begin equivalent pre/post scenario questions only for implemented concepts.

**Definition of done:** Both caching and database upgrades are viable under suitable conditions; no event hardcodes the expected purchase.

**Dependencies:** Stable step engine and routed application processing.

**Scope guard:** No cache eviction algorithms, distributed caches, or player-deployable queues.

---

### Phase 5 — Progression and PR2 integration
**Target: 20–25 October; PR2 due 26 October, 7:59 am**

**Goal:** A coherent campaign with growth milestones, research, and gradual options.

**Player experience:** Grow the same company and choose alternative investments without seeing every control immediately.

**Learning outcomes:** LO1, LO2, LO4; reliability branch prepares for Phase 6.

**Engineering:**
- Replace the 17-node progression with the specified nine-node structure.
- Add research-point awards and deployment costs/delays.
- Implement prerequisites and gradual reveal.
- Keep Scale Up and Scale Out as alternative investments.
- Integrate delayed autoscaling with a visible threshold.
- Connect milestones, replay reset, and campaign summaries.
- Hide unimplemented reliability nodes from normal interaction until Phase 6.
- Remove the player-facing legacy campaign route.
- Complete cloud-save and account usability.
- Verify expired-session recovery and account switching without losing or reassigning local progress.

**Existing modules:** Technology definitions/tree, campaign state, actions, store, reports, menu, save validation.

**New modules:** Campaign progression rules and prerequisite tests.

**Automated testing:** Research spending, prerequisite enforcement, exactly-once awards, delayed autoscaling, progression persistence, and uninterrupted company identity.

**Human validation:** Check whether players understand what they unlocked and why multiple investments remain possible. Review organic beta activity.

**Definition of done:** PR2 demonstrates continuous progression, replay variation, working accounts/saves, and every exposed technology has a real effect.

**Dependencies:** Phases 3–4. Reliability UI can use agreed fixtures while its mechanics are completed.

**Scope guard:** No extra technology branches, rewards for prescribed solutions, or cosmetic upgrades presented as functional.

---

### Phase 6 — Reliability
**Target: 23–28 October, overlapping PR2 integration**

**Goal:** Temporary application failures interact correctly with detection, routing, and remaining capacity.

**Player experience:** Prepare for failure and discover that spare capacity matters even when failover works.

**Learning outcomes:** LO3 and LO4, reinforcing LO1.

**Engineering:**
- Add temporary application-instance unavailability.
- Separate actual health, detected health, and routing eligibility.
- Implement health checks, spare instances, and automatic failover.
- Preserve capacity constraints after rerouting.
- Map risky deployments to temporary application unavailability, not a new incident family.
- Complete the reliability branch and causal postmortems.

**Existing modules:** Step engine, incidents, actions, component state, technology definitions, postmortems, architecture indicators.

**New modules:** Failure scheduling and detection/routing transition helpers.

**Automated testing:** Single-instance failure, detection delays, routing prerequisites, sufficient capacity, insufficient capacity, and restoration.

**Human validation:** Test the 900 requests/s, two 600 requests/s instances example. Players should explain why correct failover still overloads the survivor.

**Definition of done:** All nine technologies work; no database-failure or database-failover gameplay remains in the new campaign.

**Dependencies:** Per-instance routing, action scheduling, progression contracts.

**Scope guard:** No database, network, or security incident simulation.

---

### Phase 7 — Combined campaign and balance
**Target: 27–30 October**

**Goal:** All required mechanics form an enjoyable campaign with several viable strategies.

**Player experience:** Continue beyond the opening into changing constraints, then reach the final growth target with a solvent company and no active incident.

**Learning outcomes:** LO1–LO4 together.

**Engineering:**
- Combine workload changes, traffic growth, scaling, caching, and temporary failures.
- Retune economy, milestone spacing, activation times, and company growth.
- Integrate lightweight promotions, maintenance, engineering allocation, and deployment/testing controls.
- Keep those controls progressively revealed and outside the nine research unlocks.
- Replace the old weekly deadline assumptions with the new campaign pacing.
- Retain 50,000 users as the initial configurable final target; tune against observed play.
- Add a scorecard covering users, uptime, revenue, infrastructure spending, largest outage, rejected demand, and final architecture.
- Limit concurrent disruptions to situations players can reasonably understand.

**Existing modules:** Balance, campaign progression, action scheduling, reports, management controls, postmortems.

**New modules:** Scenario-pool definitions and updated campaign bot strategies.

**Automated testing:** Solvency, final-target conditions, multiple winning strategies, bounded scenario difficulty, and full-run replay determinism.

**Human validation:** Test whether players willingly continue after the first milestone and whether later decisions feel meaningfully different.

**Definition of done:** Complete campaigns are playable; the opening stays focused; no single upgrade sequence dominates the tested scenario pool.

**Dependencies:** Phases 3–6.

**Scope guard:** No additional incident families or management subsystems. Reduce scenario count before adding complexity.

---

### Phase 8 — Frozen evaluation build and polish
**Target: preparation throughout October; formal evaluation 1–8 November**

**Goal:** A stable, measurable MVP evaluated with 20 fresh target players.

**Player experience:** Reliable onboarding, clear evidence, accessible controls, dependable save/resume, and understandable postmortems.

**Learning outcomes:** Evaluate LO1–LO4 without claiming professional competence or lasting learning gains.

**Engineering:**
- Freeze a recorded evaluation build and scenario version by 31 October.
- Finalize action traces, outcomes, hints, assistance, active/wall elapsed time, ratings, and replay events.
- Record recruited versus organic participation separately.
- Count replay only after a new run and a gameplay decision.
- Collect enjoyment after the first attempt, including failure or quitting.
- Finish keyboard interaction, focus handling, text readability, error states, and responsive layout.
- Check save ownership, analytics validation, authentication, and deployment behaviour.

**Existing modules:** Telemetry, auth/save adapters, onboarding, views, controls, postmortems, deployment configuration.

**New artifacts:** Evaluation protocol, equivalent question sets, scoring rubric, and export/report scripts.

**Automated testing:** Full campaign smoke tests, analytics deduplication, access isolation, save conflict/offline recovery, and evaluation-seed regression tests.

**Human validation:**
- Recruit 20 first-time players; exclude team members and repeat testers.
- Measure first-incident completion within 15 minutes, including help and quits.
- Record median enjoyment and voluntary replay.
- Collect equivalent pre/post responses with counterbalanced question order.
- Two team members independently score anonymized responses.
- Keep organic and recruited results separate.

**Definition of done:** Cohort is complete, results and missing responses are reported, and critical usability/security defects are addressed.

**Dependencies:** Complete LO1–LO4 mechanics before formal testing.

**Scope guard:** No new mechanics. If a critical fix changes evaluated behaviour, version and report the affected sessions separately rather than silently pooling results.

---

### Phase 9 — Freeze, showcase, and report
**Target: 9–19 November**

**Goal:** A reliable showcase and honest account of the final product and evidence.

**Player experience:** Stable demo with an immediate route into the core loop.

**Learning outcomes:** Demonstrate implemented concepts and acknowledge model limitations.

**Engineering:** Critical fixes only; narrowly justified balance changes outside the recorded evaluation build; final deployment, save compatibility checks, and recovery procedures.

**Existing modules:** Only files needed for verified defects or final presentation.

**New artifacts:** Demo seed/save, offline or recorded backup, operator checklist, A1 poster, one-minute video, final documentation and report.

**Automated testing:** Release smoke test, demo-state loading, account/save checks, and regression tests for fixes.

**Human validation:** Rehearse booth operation and collect showcase feedback separately from the formal cohort.

**Definition of done:** Demo and backup work, results are reproducible, and final report is submitted.

**Dependencies:** Evaluation build and completed analysis.

**Scope guard:** No substantial gameplay changes.

## 3. Calendar and course milestones

The plan starts on **4 October 2026**. The original first week is nearly complete, leaving roughly five weeks to the feature/evaluation deadline and a final showcase/report period.

| Project week | Engineering goal | Playable deliverable | Validation goal | Course milestone | Major risk |
|---|---|---|---|---|---|
| W1: 29 Sep–5 Oct | Baseline, contracts, start shared engine | Existing prototype retained | Small baseline usability sample | Proposal | Baseline build/dependency problems |
| W2: 6–12 Oct | Phases 1–2; backend foundation | Opening incident and milestone | About five fresh users; demand interviews | **PR1: 11 Oct, 11:59 pm SGT** | Simulation and UI integration |
| W3: 13–19 Oct | Scaling, routing, cache foundation, cloud saves | Same company adapts to new workloads | Fresh/returning tests; initial paired questions | — | Save schema and routing churn |
| W4: 20–26 Oct | Progression, scenario variation, autoscaling; reliability starts | PR2 continuous campaign beta | Organic beta recruitment; gradual-reveal tests | **PR2: 26 Oct, 7:59 am** | Too many mechanics arriving together |
| W5: 27 Oct–2 Nov | Finish reliability and combined balance; freeze by 31 Oct | Full MVP evaluation build | Pilot protocol, then begin cohort | Prepare 3 Nov materials | Insufficient time to stabilize LO3 |
| W6: 3–9 Nov | Evaluation, security/usability fixes, analysis | Stable final candidate | Complete 20-player cohort | **Presentation/security scan: 3 Nov** | Build changes compromising comparisons |
| W7: 10–16 Nov | Showcase freeze and demo support | Reliable booth demo and backup | Separate booth feedback | **STePS: 12 Nov, 3–7 pm, TBC** | Demo/network/account failures |
| Closeout: 17–19 Nov | Final documentation and evidence | Archived release | Consolidate limitations and results | **Final report: 19 Nov, 7:59 am** | Unsupported claims or missing data |

Treat milestone dates as supplied course requirements; STePS timing remains tentative.

Marketing runs alongside engineering:
- Aim for **30 organic landing-page sign-ups by PR1**.
- Aim for **20 organic beta players by PR2**.
- Assess organic replay with at least 20 eligible players.
- Record shortfalls honestly; these recruitment outcomes cannot be guaranteed by implementation.

## 4. Critical path and scope protection

### Must-have critical path

**Baseline/contracts → shared engine → complete opening → per-instance routing → workload-aware data mechanics → progression → reliability → integrated balance → frozen evaluation → final release.**

Parallel release requirement:

**Auth/data ownership → local/cloud save integration → analytics ingestion → reliable evaluation records.**

Non-negotiable final behaviours:
- One continuous company and architecture.
- Clear 2D evidence and interaction.
- Measured incident recovery.
- Nine functional unlocks.
- Two incident families only.
- Save/reset, accounts, and cloud saves.
- Reproducible scenarios and event-based postmortems.
- Meaningful LO1–LO4 coverage.

### Important but reducible

- Number of scenario variants.
- Amount of animation and decorative detail.
- Number of charts and report panels.
- Management-control depth.
- Number of bespoke tutorial prompts.
- Cloud save convenience features beyond safe save/resume.
- Automated assessment administration; use external forms and scripts instead.

### Drop first

- Leaderboards, social features, achievements, scenario editors.
- Additional architecture components or incident families.
- General drag-and-drop graph editing.
- Sophisticated deployment pipelines inside gameplay.
- AI-generated feedback or gameplay.
- Extra authentication providers.
- Advanced admin dashboards.

Do not cut surviving-capacity behaviour, baseline metrics, or causal recovery to preserve cosmetic scope.

## 5. Four-person parallel workstreams

| Owner | Primary responsibility | Early work independent of engine completion | Integration dependency |
|---|---|---|---|
| **Hai** | Simulation, campaign rules, balance | State/step contracts and deterministic fixtures | Supplies stable metrics/actions to other streams |
| **Di Heng** | Backend, auth, cloud saves, analytics, security | Database ownership model, auth setup, telemetry ingestion | Uses versioned save envelope; does not calculate gameplay |
| **Qi Jun** | 2D architecture and interactions; later outreach assets | Fixed-layout nodes and fixture-driven component states | Binds to UI snapshot and action dispatcher |
| **Zi Yao** | Metrics, onboarding, progression UI, validation | Charts, observation prompts, study protocol using fixtures | Uses action availability and milestone contracts |

Working rules:
- Agree contracts in Phase 0 before dependent UI work.
- Use a small shared fixture set: healthy, database overloaded, upgrade pending, backlog draining, recovered.
- Assign one owner to each shared simulation contract; review changes before merging dependent work.
- Integrate daily before PR1, then at least twice weekly.
- Reserve team time for user sessions, code reviews, and deployment checks.
- Marketing and recruitment begin immediately, not after feature completion.

No separate agent delegation or repository changes are part of this planning deliverable.

## 6. Principal risks and mitigations

| Risk | Mitigation |
|---|---|
| First milestone becomes a disguised standalone lesson | Keep the same run ID, architecture, finances, history, and pending state throughout |
| Simulation steps and management days produce inconsistent costs/delays | One clock model and one transition engine; display time units separately |
| Framework migration consumes PR1 | Keep temporary adapters and focus PR1 on one complete opening |
| Authentication interrupts first-time play | Guest-first local play; account creation optional until cloud saving is desired |
| Reliability arrives too late for evaluation | Start during Phase 5; finish by 28 Oct; cut variation/polish before postponing LO3 |
| Full campaign takes longer than the opening test | Measure first incident separately; schedule longer sessions for later concepts and learning assessment |
| Formal learning questions include unplayed content | Record exposure and assess only implemented concepts participants encountered |
| Weak replay measurement | Distinguish continuing the same company from starting a new run and making a decision |
| Legacy tests reward obsolete mechanics | Separate legacy coverage during migration; replace assertions when corresponding new behaviour lands |
| Overcomplicated model undermines learning | Keep deterministic, explainable arithmetic and a fixed component topology |
| Cloud conflicts or network failures lose runs | Local-first saving, revision checks, explicit conflict choice, and retained copies |

## 7. Exact next implementation step

After Phase 0 verification, implement **the shared deterministic simulation and the first database-bottleneck event inside campaign state**.

The first reviewable increment should:

1. Initialize one company with one application instance and one database.
2. Record a healthy baseline.
3. Apply a deterministic traffic increase.
4. Accumulate database backlog and open the incident after three overloaded steps.
5. Expose inspection, application addition, database upgrade, and traffic limiting.
6. Permit ineffective application investment.
7. Activate changes through the shared scheduler.
8. Recover only after five qualifying metric steps.
9. Generate a trace-based postmortem.
10. Award the introductory milestone exactly once and return to management with the **same company and architecture**.

Build and test this headlessly before expanding the UI. Then connect the existing controls to it for PR1.

Do not introduce caching, reliability, the full technology tree, or a separate lesson-completion mode in this increment.
