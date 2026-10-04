# Development Roadmap — Summary and Proposal Review

Reviewed on 4 October 2026 against the live **99.99%** tab of the [project proposal](https://docs.google.com/document/d/1VZQgBruLhEUj_p7P7EK_jIpkQpg_v2m1Gyh0ZCr8ceo/edit?tab=t.26iodeiyag9x), including its linked schedule section. This review covers the [master roadmap](DEVELOPMENT_ROADMAP.md) and nine detailed phase specifications. It reviews planned work; it does not certify implementation readiness. Dates below follow the supplied proposal and use Singapore time; STePS timing remains tentative.

Updated after checking [99.9-Percent/main](https://github.com/CS3216-Final-Project/99.9-Percent/tree/8168a9917293926c44a6198cd48b8930bf41ace2): retain Neon, Drizzle, Express, React/Vite, and existing deployments. Authentication, cloud storage endpoints, and centralized analytics are additions to implement; see the [roadmap's backend choice and authentication requirements](DEVELOPMENT_ROADMAP.md#backend-choice).

## What we are building

One software-company tycoon campaign in which players grow and evolve an architecture, diagnose bottlenecks, recover from incidents, and see the consequences of their choices. The first 10–15 minutes contain one database-overload incident and 3–4 meaningful choices. Recovery produces a causal postmortem and a milestone; players can continue with the same company, infrastructure, finances, and history.

The main engineering change is a deterministic simulation shared by normal management and incident play. Traffic, capacity, bounded backlog, latency, errors, action delays, and cost must determine outcomes. Buying an upgrade must not itself declare recovery. The UI displays the model's results.

The final MVP includes a readable 2D architecture view, baseline metrics/history/alerts, gradual progression through nine technology unlocks, seeded variation, save/reset, trace-based postmortems, and analytics. The roadmap additionally makes accounts and cloud saves required, with guest play and local saving available immediately.

## Delivery sequence

Phases overlap. Phase 0 is described in the master roadmap; Phases 1–9 have separate specifications.

| Phase | Target in 2026 | Reviewable outcome |
|---|---|---|
| 0 — Baseline | 4–5 Oct | Verify the current prototype; agree state, action, UI, and save contracts; preserve old saves. |
| [1 — Simulation](phases/PHASE_1_SIMULATION_FINAL.md) | 5–8 Oct | Headless database overload: inspect, add an ineffective app instance, upgrade the database or limit traffic, recover through measured metrics, then continue. |
| [2 — PR1 opening](phases/PHASE_2_PR1.md) | 8–11 Oct | Playable 10–15-minute opening, minimal 2D view, onboarding, local save/reset, analytics, landing page; backend work starts in parallel. **PR1: 11 Oct, 11:59 pm.** |
| [3 — Scaling](phases/PHASE_3_SCALING.md) | 12–16 Oct | Vertical/horizontal app scaling and explicit routing; sign-in and owner-scoped cloud saves. Added app capacity cannot fix database capacity. |
| [4 — Data strategy](phases/PHASE_4_DATA_STRATEGY.md) | 16–20 Oct | Cache warm-up, read/write mix, cache tuning, and seeded variation make database upgrades and caching useful in different conditions. |
| [5 — Progression / PR2](phases/PHASE_5_PROGRESSION.md) | 20–25 Oct | Milestones, research, gradual reveal, delayed autoscaling, replay, and accounts/saves integrated; legacy campaign removed from normal play. **PR2: 26 Oct, 7:59 am.** |
| [6 — Reliability](phases/PHASE_6_RELIABILITY.md) | 23–28 Oct | Temporary app failures, health checks, spare capacity, and failover; all nine unlocks functional. Rerouting can still overload surviving instances. |
| [7 — Combined campaign](phases/PHASE_7_COMBINED_CAMPAIGN.md) | 27–30 Oct | Balance the complete game, lightweight management controls, multiple viable strategies, final growth target, and scorecard. |
| [8 — Evaluation](phases/PHASE_8_EVALUATION.md) | Freeze by 31 Oct; cohort 1–8 Nov | One recorded build and fixed opening seed; evaluate 20 fresh players; polish usability, security, and analytics. **Presentation / preliminary security scan: 3 Nov.** |
| [9 — Showcase / report](phases/PHASE_9_FREEZE.md) | 9–19 Nov | Critical fixes, reliable demo and backup, A1 poster, one-minute video, and evidence reporting. **STePS: 12 Nov, 3–7 pm (TBC); final report: 19 Nov, 7:59 am.** |

PR2 establishes the nine-node progression structure, but reliability is scheduled to finish on 28 October, after PR2. Unimplemented reliability options must remain unavailable until their effects work.

## Alignment with the proposal

| Proposal commitment | Roadmap treatment | Assessment |
|---|---|---|
| [MVP scope, §3.1](https://docs.google.com/document/d/1VZQgBruLhEUj_p7P7EK_jIpkQpg_v2m1Gyh0ZCr8ceo/edit?tab=t.26iodeiyag9x#heading=h.1bcz8avtoqw0) | One company, focused opening, gradual controls, two incident families, 2D evidence, save/reset, postmortems, analytics. | Core scope aligns. The roadmap explicitly allows longer play after the introductory milestone. |
| [Simulation and recovery, §§7.1–7.4](https://docs.google.com/document/d/1VZQgBruLhEUj_p7P7EK_jIpkQpg_v2m1Gyh0ZCr8ceo/edit?tab=t.26iodeiyag9x#heading=h.vt3lh5pn48lf) | One deterministic step engine; overload after three steps; recovery below 500 ms latency and 1% service errors for five steps; rejected demand reported separately. | Closely aligned; operational details still need a shared time-unit contract. |
| [Nine unlocks, §7.5](https://docs.google.com/document/d/1VZQgBruLhEUj_p7P7EK_jIpkQpg_v2m1Gyh0ZCr8ceo/edit?tab=t.26iodeiyag9x#heading=h.u2xsiflnyp1x) | Capacity: Scale Up, Scale Out + Load Balancing, Autoscaling. Data: Larger Database, Read Cache, Cache Tuning. Reliability: Health Checks, Spare Instance, Automatic Failover. | Matches the three branches and nine unlocks; metrics remain baseline tools. |
| [Validation, §2](https://docs.google.com/document/d/1VZQgBruLhEUj_p7P7EK_jIpkQpg_v2m1Gyh0ZCr8ceo/edit?tab=t.26iodeiyag9x#heading=h.ngi3syobdsz8) | Fresh cohort, fixed opening, completion/enjoyment/replay, counterbalanced pre/post questions, independent anonymized scoring, separate organic results. | Targets align; later-concept exposure needs an explicit session procedure. |
| [Schedule, §3.2](https://docs.google.com/document/d/1VZQgBruLhEUj_p7P7EK_jIpkQpg_v2m1Gyh0ZCr8ceo/edit?tab=t.26iodeiyag9x#heading=h.h98j682e7tmq) | Same course milestones, decomposed into overlapping implementation phases starting 4 Oct. | Consistent deadlines; less preparation time remains than the original six-week framing suggests. |
| [Application architecture, §7.6](https://docs.google.com/document/d/1VZQgBruLhEUj_p7P7EK_jIpkQpg_v2m1Gyh0ZCr8ceo/edit?tab=t.26iodeiyag9x#heading=h.rhqt74hhjq0t) | Client-side simulation, React/Vite, Express, Neon/Drizzle, required cloud saves with API authorization. | Neon is an allowed proposal option. Retaining Vite/Express is an implementation adjustment to the proposal's Next.js description; it supports the same required behaviours. |

The final scope continues to exclude player-deployable queues, multi-region systems, database failover, network/security incident models, multiplayer, and AI-generated content. The internal bounded backlog is simulation bookkeeping, not a queue technology unlock.

## Review findings and recommended decisions

1. **Protect PR1 from migration scope.** There is roughly one week to establish the new engine, connect a 2D opening, and test it with fresh users. Retain useful prototype controls and temporary adapters. Gate PR1 on a complete, understandable overload loop; decorative work and account integration should not delay it.

2. **Deliver authentication and preserve saves.** These commitments are confirmed: retain Neon/Drizzle and Express, use **Google OAuth with OpenID Connect**, include owner-scoped cloud saves in the final MVP, and preserve legacy saves. Di Heng configures Google and the account/session foundation in Phase 2, delivers Google sign-in/app-session restoration/sign-out and cloud resume in Phase 3, and completes usability by PR2. [The authentication design](AUTHENTICATION.md) covers the same-origin API proxy and backend sessions. Before the replacement loader ships, separate new campaign storage from `nn.save.v1`, `nn.meta.v1`, and `nn.analytics.v1`; keep the originals intact and exportable.

3. **Reserve time for reliability and integration.** Reliability ends 28 Oct, combined balancing ends 30 Oct, and evaluation freezes 31 Oct. This leaves little buffer for LO3 defects or economy retuning. Start reliability contracts and fixtures during scaling/progression, pilot the full campaign before freeze, and reduce scenario count, chart count, and decoration if necessary. All nine functional unlocks and surviving-capacity behaviour remain final-MVP requirements.

4. **Specify learning-assessment exposure.** The opening teaches database overload; the assessment also asks about scaling/cache choices and reliability. Phase 8 correctly says to assess only implemented, encountered concepts, but does not define a standard route and time allowance for every participant to encounter them. Measure completion and enjoyment after the first attempt and preserve an unprompted replay opportunity before any directed assessment continuation. Define that continuation separately; do not treat it as voluntary replay. Report partial concept exposure separately and do not pool unequal question totals as comparable 0–6 scores.

5. **Agree the simulation clock in Phase 0.** The proposal uses one simulated day per management turn and short real-time steps during incidents. The roadmap requires shared calculations but leaves the conversion contract unspecified. Define the step duration and how request rates, backlog, recurring costs, engineering delays, and financial effects accumulate. Otherwise changing play speed or entering an incident could change the economy or capacity behaviour unintentionally.

6. **Make campaign length and recruitment explicit.** The proposal describes scaling towards millions of users, but leaves the MVP growth target to tuning; the roadmap starts at a configurable 50,000 users. This is a tuning decision rather than a demonstrated scope failure. Agree the expected full-campaign duration as well as the 10–15-minute opening. Assign dated recruitment tasks now: 30 organic sign-ups by PR1, 20 organic beta players by PR2, and the separate 20-player formal cohort are distinct targets. Keep the proposal's 10–15 demand interviews visible alongside gameplay tests.

The review supports the core gameplay direction. The Neon and existing-framework compatibility corrections, explicit authentication milestones, and legacy-save preservation requirements have been applied to the roadmap and relevant phase specifications. Campaign timing, assessment exposure, and scope-priority recommendations remain review items.

## Ownership and success criteria

- **Hai:** simulation, campaign rules, and balance.
- **Di Heng:** backend, authentication, saves, analytics, and security.
- **Qi Jun:** architecture view and interactions, then outreach assets.
- **Zi Yao:** metrics, onboarding, progression UI, and validation.

The roadmap preserves the main technical ownership from proposal §4, while shifting some later-week responsibilities. Confirm who covers Hai's proposal-listed project management and final roadmap review while simulation integration continues. All four members still contribute to scenarios, reviews, playtests, and deployment.

For the formal cohort of 20 fresh players, the proposal targets are **at least 14 independent first-incident recoveries within 15 minutes**, **median enjoyment at least 4/5**, and **at least six voluntary replays**. In-game hints are allowed; facilitator help affects independent completion. Replay requires a new run plus a gameplay decision. Report paired learning scores and misconceptions without claiming lasting or causal learning gains. Assess organic replay separately with at least 20 organic first-run players and a 30% target.

## Immediate next increment

Complete the baseline and contracts, then prove this headlessly: healthy startup → deterministic traffic increase → database backlog → incident → upgrade or traffic limiting → five qualifying recovery steps → trace-based postmortem → exactly-once milestone → same company continues. An app-only investment must fail to remove the database constraint. Connect that verified loop to the PR1 UI before expanding mechanics.
