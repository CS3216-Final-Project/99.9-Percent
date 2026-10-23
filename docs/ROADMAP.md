# Roadmap

This is the source of truth for project status, remaining milestones and scope decisions.
The course proposal is in [PROJECT_PROPOSAL.md](PROJECT_PROPOSAL.md) and the [proposal Google Doc](https://docs.google.com/document/d/1VZQgBruLhEUj_p7P7EK_jIpkQpg_v2m1Gyh0ZCr8ceo/edit?tab=t.26iodeiyag9x); the detailed plans for the remaining phases are in [phases/](phases/).
Dates are 2026, Singapore time.

## Product decisions

- One company, one evolving architecture and one continuous Guided Mode campaign; recovering from the first incident leads to a milestone, not a separate lesson screen.
- Guest play with local saves comes first; accounts and owner-scoped cloud saves are optional additions.
- Prototype saves (`nn.save.v1`, `nn.meta.v1`, `nn.analytics.v1`) are preserved and exportable, never reinterpreted or deleted.
- Metrics and alerts are available from the start, and later mechanics appear chapter by chapter.
- Replay creates a new company with different seeded conditions.
- The stack stays React, Vite, Zustand and Three.js in the browser, with Express, Drizzle and Neon on Vercel; simulation stays client-side.
- Out of scope: multiplayer, server-authoritative gameplay, leaderboards, player-deployable queues, multi-region systems, database failover, network or security incident models and AI-generated content.

## Status

| Phase | Target | Outcome | Status |
| --- | --- | --- | --- |
| 0 - Baseline | 4-5 Oct | Prototype migrated, contracts agreed, legacy saves preserved | Done |
| 1 - Simulation | 5-8 Oct | Deterministic step engine and the first database incident | Done |
| 2 - PR1 opening | 8-11 Oct | Playable Opening, onboarding, local save, feedback | Done |
| 3 - Scaling | 12-16 Oct | Scaling and routing; Google sign-in and cloud saves | Done; live Google acceptance outstanding |
| 4 - Data strategy | 16-20 Oct | Cache warm-up, workload profiles, database tier | Done |
| 5 - Progression / PR2 | 20-25 Oct | Traffic spikes, autoscaling, research points | Done |
| 6 - Reliability | 23-28 Oct | Failures, Health Checks, spares, failover; all nine nodes functional | Done |
| 7 - Combined campaign | 27-30 Oct | Grow the Company, promotion, scorecard, replay | Done |
| Office add-on | By 31 Oct | Two-floor zoned office, elevator, walk mode, views and map | Done |
| 8 - Evaluation | Freeze 31 Oct; cohort 1-8 Nov | Frozen build evaluated with 20 fresh players | Planned: [PHASE_8_EVALUATION.md](phases/PHASE_8_EVALUATION.md) |
| 9 - Showcase and report | 9-19 Nov | Critical fixes, demo and backup, poster, video, final report | Planned: [PHASE_9_FREEZE.md](phases/PHASE_9_FREEZE.md) |

The rules each finished phase produced are described in [GAMEPLAY.md](GAMEPLAY.md); the phase-by-phase history is in Git.

## Milestones

| Date | Milestone |
| --- | --- |
| 26 Oct, 7:59 am | PR2 |
| 31 Oct | Evaluation build freeze |
| 1-8 Nov | Formal 20-player cohort |
| 3 Nov | Presentation and preliminary security scan |
| 12 Nov, 3-7 pm (TBC) | STePS showcase |
| 19 Nov, 7:59 am | Final report |

## Success targets

For the formal cohort of 20 fresh players, the proposal targets:

- At least 14 independent first-incident recoveries within 15 minutes; in-game hints are allowed, facilitator help is not.
- Median enjoyment of at least 4/5.
- At least six voluntary replays, where a replay is a new run plus a gameplay decision.

Report paired learning scores and misconceptions without claiming lasting or causal learning gains.
Assess organic replay separately, with at least 20 organic first-run players and a 30% target.
Organic recruitment targets were 30 sign-ups by PR1 and 20 beta players by PR2; record shortfalls honestly.

## Open review items

- **Assessment exposure:** the assessment asks about scaling, caching and reliability, but the evaluation needs a standard route and time allowance so every participant meets those concepts. Measure completion and enjoyment after the first attempt, keep an unprompted replay opportunity before any directed continuation, and report partial exposure separately.
- **Campaign length:** agree the expected full-campaign duration alongside the 10 to 15 minute Opening.
- **Scope after freeze:** if a critical fix changes evaluated behaviour, version and report the affected sessions separately rather than pooling them.

## Scope protection

Never cut surviving-capacity behaviour, baseline metrics or causal recovery to preserve cosmetic scope.

- **Reducible:** scenario variants, decorative detail, chart and report panels, management-control depth, bespoke tutorial prompts, cloud-save conveniences.
- **Drop first:** leaderboards, social features, achievements, scenario editors, new architecture components or incident families, graph editing, in-game deployment pipelines, extra sign-in providers, admin dashboards.

## Ownership

| Owner | Responsibility |
| --- | --- |
| Hai | Simulation, campaign rules and balance |
| Di Heng | Backend, authentication, saves, analytics and security |
| Qi Jun | Architecture view, interactions and outreach assets |
| Zi Yao | Metrics, onboarding, progression UI and validation |

All four contribute to scenarios, reviews, playtests and deployment.
