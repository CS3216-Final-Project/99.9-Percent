# 99.99% — System Design Tycoon

> An entertainment-first 2D software-company tycoon where computing students design and evolve systems, experience the consequences of architectural decisions, and adapt as their company grows.

> **Source of truth:** This Markdown file is a repository-friendly transcription of the final project proposal PDF. It is intended to give developers and IDE assistants a concise, machine-readable reference for product scope, learning outcomes, validation targets, schedule, simulation rules, and technical requirements.

---

## 1. Description of the Application

Players become the technical lead of a growing software company, designing how its application services, databases and supporting components work together. Starting with few users and a limited budget, they aim to scale towards millions of users while balancing uptime, performance, infrastructure cost, engineering capacity, technical debt and revenue.

For instance, the player starts with a small architecture consisting of a web server and database. As users and traffic grow, components approach capacity and bottlenecks emerge. The player has a limited budget and must choose between technologies such as larger servers, horizontal scaling, load balancing, caching and database upgrades. These technologies alter how the simulated system responds to traffic and failures.

Incidents emerge from the simulated system state and the player's earlier decisions. For example, growing traffic can saturate a neglected database; component metrics and alerts help reveal the cause, while dependencies can spread the outage. Postmortem states explain the cause, recovery and prevention.

### Core gameplay loop

```text
Observe & invest
Budget, design, capacity
        ↓
Traffic grows
Load and risks change
        ↓
Incident appears
Symptoms and alerts
        ↓
Diagnose & recover
Choose a response
        ↓
Read postmortem
Cause and consequences
        ↓
Improve the design
Apply lessons
        ↺
```

**Figure 1.** Decisions shape future incidents; each recovery informs the next investment.

---

## 2. Justification and Learning Assessment

### Problem and opportunity

System design involves choosing how components work together under changing workloads and constraints. A tycoon game lets players explore architecture, scalability, performance and reliability through visible consequences. We want to make these trade-offs understandable and enjoyable for computing students. Interviews and early playtests will establish whether this audience wants to play and what keeps them engaged.

**Feasibility:** A discrete simulation models traffic, capacity, dependencies, costs and failures without provisioning real cloud resources. A small deterministic engine, interactive visualisations and saved game state provide technical depth within six weeks.

### Learning Outcomes

**LO1 — Diagnose bottlenecks.**  
Use traffic, latency, errors, utilisation and component dependencies to identify the limiting component and explain how it affects the rest of the system.

**LO2 — Choose scaling strategies.**  
Compare vertical scaling, horizontal scaling with load balancing, database upgrades and caching for a given workload. Explain how traffic spikes, cacheable reads and startup delays affect the choice.

**LO3 — Improve reliability.**  
Explain how health checks, spare capacity and failover affect availability when an application instance fails, including what happens when surviving instances lack capacity.

**LO4 — Weigh design trade-offs.**  
Justify a design using performance, reliability, cost and complexity; explain what it cannot solve and revise the choice when requirements change.

### Player takeaway

**Primary promise:** learn real software scalability concepts through play.

**Product requirement:** it still has to be enjoyable enough that players want to continue.

Players should be able to:

- **Understand architecture and bottlenecks.** Explain how services, databases, caches and load balancers interact. Use traffic, latency, errors and utilisation to identify the limiting component and predict effects on its dependencies. For example, adding application servers may not help when the database is overloaded.
- **Compare system-design trade-offs.** Choose between designs based on workload and constraints. Explain how scaling, caching and redundancy change performance, reliability, cost and complexity, and why a design that suits one stage of growth may not suit another.
- **Evolve the design as requirements change.** Adapt the architecture when traffic grows or a component fails. Connect design choices to observed outcomes, justify a change using evidence, and use the postmortem to improve the next design rather than repeat the same upgrade sequence.

The main takeaway is:

> "I can explain how my system works, where it struggles, and why I would choose one design over another."

The scenario questions assess these intended outcomes. The game develops intuition through simplified models; its results do not establish professional system-design competence.

### Secondary learning assessment

From Week 3, testers answer three short questions before and after play using equivalent, different scenarios.

Each answer earns:

- **0:** incorrect response
- **1:** plausible diagnosis or design choice without sound reasoning
- **2:** correct diagnosis or suitable design choice supported by causal reasoning and a relevant trade-off

Report paired score changes and misconceptions alongside completion, enjoyment (1–5) and voluntary replay.

This small pilot guides iteration; it does not establish lasting learning gains.

---

## Success Targets and Validation Plan

### Primary Targets

**Evaluation cohort:** Aim to recruit 20 first-time players from the primary audience in Weeks 5–6, before STePS.

Enjoyment and voluntary replay assess the core entertainment promise; independent completion assesses accessibility; paired learning scores explore the intended secondary takeaway.

Use:

- one recorded build
- the same onboarding
- a fixed first-incident seed so random severity does not distort comparisons

Earlier playtests guide improvements and are reported separately. Record prior operations experience and exclude team members and repeat testers from this cohort.

#### 1. Independent completion ≥70%

At least **14 of 20 players** should resolve the first incident within **15 minutes** without facilitator help.

- In-game hints are allowed.
- Define recovery conditions before testing.
- Record hints, assistance, failures and quits.
- Log completion time, intervention and outcome.

#### 2. Median enjoyment ≥4/5

After the first attempt, ask every player:

> "How enjoyable was this play session?"

Use a 1–5 scale from *not at all enjoyable* to *extremely enjoyable*, including players who fail or quit.

- Collect responses before coaching or discussion.
- Report median, rating distribution and missing responses.
- Optional usefulness questions are separate and do not count toward this target.

#### 3. Voluntary replay ≥30%

At least **6 of 20 players** should voluntarily start another run and make a gameplay decision without encouragement or rewards.

This measures immediate replay, not long-term retention.

Record:

- early departures
- technical barriers
- actual replay behaviour

#### 4. Paired learning results and misconceptions

Before and after playing, ask three scenario questions:

1. Which component or dependency limits the system and why? (**LO1**)
2. Which scaling or caching choice best fits the workload and budget? (**LO2**)
3. How would health checks, spare capacity and failover affect an application-instance failure? (**LO3**)

Require a benefit, cost or limitation in each answer to assess **LO4**.

Assessment rules:

- assess only concepts implemented in the game
- use two similar question sets
- alternate which set players receive first
- do not reveal answers between tests
- score each answer 0–2, total **0–6**
- two team members mark responses independently
- markers should not know participant identity or whether the answer is pre/post
- reconcile scoring disagreements

Report:

- number of completed comparisons
- pre/post scores
- average and median change
- number improved / unchanged / lower
- missing tests
- common misunderstandings

These results show observed changes but do not prove the web app caused them.

### Secondary Targets

| Deadline | Measure |
|---|---|
| **PR1** | **At least 30 organic landing-page sign-ups.** Count unique sign-ups through public channels; exclude team members and recruited testers. |
| **PR2** | **At least 20 organic beta players.** Count unique players who independently start a run and make at least one gameplay decision; exclude team members and recruited testers. |
| **During beta** | **At least 30% voluntary replay.** Divide organic players who start a second run and make a gameplay decision by all organic first-run players. Exclude prompted or rewarded replays; report the count and percentage. |

Assess organic replay with at least **20 organic first-run players**: at least **6 of 20** must replay.

Report organic-user results separately from the recruited test cohort.

---

## 3. Project Schedule

### 3.1 Defined MVP Scope

#### Campaign

- One software company.
- First-run target: **10–15 minutes**.
- Opening system:
  - one application instance
  - one database
- First run:
  - one incident
  - only **3–4 meaningful choices**
  - visible consequences after each decision
- Company grows through a fixed sequence of milestones.
- A run succeeds by reaching the final growth target while:
  - solvent
  - having no active incident
- Growth target and starting budget are tuned in Week 2.

#### Components

- application instances
- one database
- one optional read cache
- one optional load balancer
- metrics
- metric history
- alerts
- health checks
- automation
- application-instance redundancy

Metrics, metric history and alerts are available from the start.

Health checks and automation are upgrades attached to components.

Redundancy is limited to application instances.

#### Incidents

Two incident families:

1. **Capacity overload**
   - application variant
   - database variant

2. **Temporary application-instance failure**

Parameterised traffic and failure events provide variation without adding new incident families.

#### Actions

The first run exposes only the controls needed for its 3–4 choices.

Metrics and alerts are available from the start.

Later runs gradually introduce:

- promotions
- application scaling and routing
- database upgrades
- cache upgrades/tuning
- redundancy
- maintenance and technical debt
- engineer allocation
- deployment timing and testing
- traffic limiting
- restarting/replacing failed instances when relevant

Operational actions change a named variable, cost or delay.

Inspection provides evidence for choosing a response.

#### Deliverables

The MVP should include:

- realistic 2D architecture canvas
- hover/click controls
- onboarding
- metrics
- alerts
- 9-unlock skill tree
- run reset/save
- event-based postmortems
- playtest analytics

**PR1** delivers one working overload scenario and a small subset of actions.

The remaining scope is added iteratively.

#### Scope boundary

Later extensions, **not MVP**:

- queues
- multi-region systems
- database failover
- security incident models
- network incident models
- multiplayer
- AI-generated content

---

### 3.2 Parallel Workstreams and Milestones

| Dates | Engineering | Marketing | Customer Contact & Validation | Course Milestone |
|---|---|---|---|---|
| **Week 1 · 29 Sep–5 Oct** | Define 3–4 concepts, core mechanic and variables. Design simple tech tree and identify reference games. Build one UI-only / low-fi playable loop: one architecture, one traffic event, 3–4 decisions with immediate consequences. | Build simple landing page with positioning, screenshots/mockups and CTA such as "Join playtest" or "Try prototype." Start recruiting testers. | **Test:** Observe about 5 users playing one incident with 3–4 choices before explanations. **Success criteria:** Players can explain consequences and identify decisions they enjoyed. Record confusion and signs of overload. | Project proposal |
| **Week 2 · 6–12 Oct** | Refine mechanic using Week 1 feedback. Define resource constraints such as budget, traffic and component capacity. Decide how winning/losing works. Build first functional scenario with simulation variables, architecture changes, metrics and consequences. Add basic progression between decisions. | Improve landing-page messaging based on interviews. Share playable prototype through NUS Computing / CS3216 / gaming communities. | **Test:** Observe another 5 target users during the first 10–15-minute run; continue demand interviews. **Success criteria:** At least 1 of 5 spontaneously asks to replay or join a future test before prompting. Record understanding, interesting/confusing decisions and overload. | **PR1: 11 Oct, 11:59 pm SGT** — functional prototype |
| **Week 3 · 13–19 Oct** | Design parameterised scenarios rather than fixed answers. Define how traffic, budget, capacity and other variables change between runs. Add scenario variation. The same event should produce different bottlenecks depending on system state. Add basic reset/replay flow. | Show short gameplay examples illustrating "same event, different solution." Continue recruiting fresh testers. | **Test:** Retest new and returning players with scenario variation and gradual unlocks; begin paired learning assessments. **Success criteria:** Players can explain how changed conditions affect their choices. Record paired scores, misconceptions and confusion caused by new controls. | — |
| **Week 4 · 20–26 Oct** | Finalise initial tech tree. Connect technologies directly to learning concepts: capacity → load balancing → caching → autoscaling, etc. Define difficulty progression. Implement technology unlocks/upgrades and 2–3 additional system mechanics. Add clearer visual feedback showing how architecture changes affect performance. | Refine positioning around "learn scalability through gameplay." Prepare cleaner screenshots/demo clips. | **Test:** Check balance, gradual skill-tree reveal and unprompted replay; review organic beta activity. **Success criteria:** Players understand new upgrades and consequences without feeling overwhelmed. Reach 20 organic beta players by PR2. | **PR2: 26 Oct, 7:59 am** |
| **Week 5 · 27 Oct–2 Nov** | Combine existing mechanics into more complex situations. Tune traffic growth and event severity so choices involve trade-offs rather than obvious answers. Build main MVP scenario pool. Improve UX, onboarding, animations, dashboards and feedback. Add gameplay analytics. | Begin wider beta recruitment. Promote beta through NUS channels and short gameplay clips, e.g. "Can your architecture survive a 10× traffic spike?" | **Test:** Begin 20-player cohort across Weeks 5–6 using fresh players, one recorded build and a fixed first-incident seed. **Success criteria:** Capture completion, assistance, enjoyment, replay and paired assessments, including missing responses. Report recruited and organic users separately. | Presentation & preliminary security scan: **3 Nov** |
| **Week 6 · 3–9 Nov** | Freeze major mechanics. Focus on balance, transfer of learning and whether multiple strategies are viable. Stabilise build, fix usability/security issues and implement final analytics/post-play feedback. | Prepare A1 poster, 1-minute video and STePS booth demo. Promote showcase using actual user results and gameplay footage. | **Test:** Complete 20-player cohort and analyse results. **Success criteria:** ≥70% independent completion, median enjoyment ≥4/5 and ≥30% voluntary replay. Report paired score changes, misconceptions, sample sizes and limitations; assess organic replay separately. | Scan report arrives; STePS preparation |
| **After · 10–19 Nov** | Only small balancing adjustments. Document final game design, learning objectives and limitations. Freeze build. Fix critical bugs only. Prepare reliable demo and backup demo flow. | Run STePS booth; present demo and collect interest for future releases. | **Test:** Collect STePS booth feedback and consolidate customer-contact reports. **Success criteria:** Report each target with sample sizes and limitations. Separate booth observations from formal evaluation and identify improvements supported by feedback. | **STePS: 12 Nov, 3–7 pm (TBC)**; **Final report: 19 Nov, 7:59 am** |

---

## 4. Individual Contributions and Roles

| Member | Weeks 1–2 | Weeks 3–4 | Weeks 5–6 |
|---|---|---|---|
| **Hai** | W1: Simulation core, traffic/capacity modeling. W2: Dependencies & bottleneck simulation. | W3: Technical debt & risk calculation. W4: Simulation balancing & state transitions. | W5: Project management & milestone tracking. W6: Final project review & roadmap alignment. |
| **Di Heng** | W1: Backend setup & database schema. W2: Incidents engine & backend APIs. | W3: Auth & state persistence / saved games. W4: Postmortems & analytics backend. | W5: Security scanning & backend hardening. W6: Security fixes & deployment stability. |
| **Qi Jun** | W1: Architecture graph & canvas setup. W2: Infrastructure controls & node interactions. | W3: Animations & real-time visual cues. W4: Marketing campaign & outreach assets. | W5: Public beta promotions & social clips. W6: STePS booth materials & video demo. |
| **Zi Yao** | W1: Dashboards & metrics UX. W2: Onboarding flow & alert displays. | W3: Progression UI & analytics interface. W4: Consistency polish & usability fixes. | W5: User validation cohort testing. W6: Evaluation reporting & cohort feedback. |

Everyone contributes to:

- scenarios
- balancing
- playtests
- deployment
- code reviews

Experienced engineers or SREs will be invited to review:

- architectural trade-offs
- simulation behaviour
- incident plausibility
- postmortems

---

## 5. Long-Term Plan and Business Model

The initial release will establish whether system-design decisions make an engaging strategy game.

If the core loop succeeds, expand through scenario packs such as:

- legacy system
- e-commerce sale
- viral growth

Potential later mechanics:

- queues
- CDNs
- microservices
- multi-region deployment
- security
- disaster recovery

Possible business model:

- premium base game
- optional scenario packs
- educational edition for universities, bootcamps or engineering teams

The educational edition depends on separate validation of learning value and demand.

---

## 6. Primary Audience and Marketing

### Primary audience

NUS computing undergraduates with:

- basic web-development knowledge
- interest in strategy or tycoon games
- interest in exploring how systems are designed and adapted beyond a small application

Prior production experience is not required.

Recruit through:

- CS3216
- NUS Computing communities
- Telegram groups

Test the first playable prototype with this audience before expanding the audience or feature set.

Experienced developers review technical plausibility.

Broader management-game audiences are a later expansion.

### Marketing positioning

Marketing should emphasise:

- growing a company by designing its systems
- balancing architectural trade-offs
- adapting to changing traffic and failures

Example short-form hook:

> "500,000 users, one database, and crashing servers — what do you do?"

Possible channels:

- TikTok gameplay clips
- up-and-coming strategy-game YouTubers
- free access
- livestreams
- speedrun challenges

### Market context

**Software Inc.** provides a precedent for software-company management games. Our focus is designing and evolving software architectures, with growth and incidents revealing the consequences of those choices.

**SpaceChem** is a puzzle/indie game by Zachtronics Industries based on principles of automation and chemical bonding, and serves as a reference for serious-game design.

Our project sits between **Software Inc.** and **SpaceChem**:

- software-company growth and management context from Software Inc.
- educational design philosophy from SpaceChem, where technical reasoning is embedded into player decisions

### Demand validation

Interview **10–15 potential target users** about:

- games they play
- purchases
- reasons to replay simulation/management games

Discuss past behaviour before showing the concept to reduce polite-only reactions.

Start with five interviews in Week 1 and extend recruitment during early playtests.

---

## 7. High-Level Design

### 7.1 Simulation Model

Represent the architecture as connected components.

Each simulation step:

1. routes incoming requests
2. applies cache hits
3. distributes work across healthy servers
4. compares demand with capacity
5. accumulates excess work in a bounded backlog
6. increases latency as work waits
7. fails requests beyond the backlog limit
8. propagates dependency unavailability to services that require them

The model is deliberately simplified and will be tuned through playtests.

#### Time model

- Normal play advances one simulated day per turn.
- During incidents, the same model advances in short real-time steps.
- Costs, action delays and incident thresholds use simulation steps rather than real cloud timings.

Visible from the start:

- traffic
- latency
- errors
- per-component utilisation
- request mix
- metric history
- alerts

Players use this evidence to diagnose constraints.

**Reading metrics does not change physical capacity.**

---

### 7.2 Variables That Change a Run

#### Workload

- baseline traffic
- growth rate
- spike size
- spike duration
- read/write mix
- cacheable share

A read-heavy spike and a write-heavy spike can require different responses.

#### Architecture

- server count
- server capacity
- routing
- database capacity
- cache hit rate
- cache warm-up
- component health
- redundancy

**Adding application servers does not increase database capacity.**

#### User decisions

Constraints include:

- cash
- recurring costs
- available engineers
- upgrade lead times

Decisions include:

- promotions increase demand
- maintenance reduces modeled failure risk
- deployment timing/testing affects the chance of temporary component unavailability

These are lightweight policy controls, not separate staff or coding simulators.

#### Initial setup

A recorded random seed selects bounded:

- traffic events
- failure timing

The architecture and actions determine their consequences.

The same seed + same action sequence should reproduce a run.

Evaluation uses a fixed first-incident seed.

Random events must leave enough warning or recovery options to support meaningful choices.

---

### 7.3 Incident Triggers and Recovery

#### Incident family 1 — Demand overload

Application or database demand above effective capacity directly increases:

- backlog
- latency
- errors

For the initial prototype:

- sustained overload for **3 consecutive steps** raises an incident
- the affected component identifies the variant

A traffic spike may remain harmless if capacity or caching actively absorbs it.

#### Incident family 2 — Component failure

A seeded failure event or risky deployment temporarily makes one application instance unavailable.

Traffic is redistributed only when:

- routing exists
- healthy spare capacity exists

Otherwise requests:

- fail, or
- overload surviving instances

Database, network and security failure models are outside the MVP.

#### Player response

Players inspect symptoms, then apply actions with explicit:

- cash costs
- engineering time
- activation delays

Changes update the same simulation when ready.

Examples:

- traffic limiting gives fast relief but rejects demand
- scaling and caching have different lead times
- workload type changes benefits
- multiple responses may work

#### Recovery

Initial tuning targets:

- latency **< 500 ms**
- service errors **< 1% of admitted requests**
- maintained for **5 consecutive steps**
- failed component restored or safely bypassed where applicable

Deliberately rejected traffic:

- is reported separately
- still reduces revenue

These thresholds are game rules, not production guarantees.

Consequences:

- lost requests and prolonged degradation reduce revenue/reputation
- zero cash ends the run
- unresolved incidents remain active until recovery or the run ends
- concurrent symptoms share one incident state rather than becoming unrelated scripted incidents

#### Postmortem

Record:

- initiating event
- affected dependency
- player actions
- action activation times
- resulting metrics

Explain both:

- successful choices
- ineffective choices

After recovery, resume the next management turn.

---

### 7.4 Worked Example — Database Overload

#### Setup

- application capacity: **1,000 requests/s**
- database capacity: **600 operations/s**
- each uncached request performs one database operation
- promotion raises demand: **400 → 900 requests/s**
- read share: **80%**
- reads are fully cacheable in this example

The application has spare capacity, but database demand reaches **150% of capacity**.

Backlog, latency and timeouts rise, triggering overload.

| A — Cache eligible reads | B — Upgrade database | C — Limit incoming traffic |
|---|---|---|
| 900 DB ops/s → warm cache → **468 / 600 ops/s** → backlog drains. **Cost:** warm-up and cache spend | 900 / 600 ops/s → upgrade activates → **900 / 1,000 ops/s** → backlog drains. **Cost:** delay and recurring spend | 900 req/s → reject 400 req/s → **500 / 600 ops/s** → backlog drains. **Cost:** lost demand and revenue |

#### Response A — Cache eligible reads

If a warmed cache hits 60% of reads:

```text
database work
= 900 × (1 − 0.8 × 0.6)
= 468 operations/s
```

This creates headroom for the backlog to drain.

Limitations:

- cold cache takes time to warm
- write-heavy workloads benefit less

#### Response B — Upgrade database

Upgrade database capacity to **1,000 operations/s**.

Demand remains 900 operations/s, but the upgrade adds headroom after activation delay and increases recurring cost.

#### Response C — Limit incoming traffic

Temporarily admit **500 requests/s**.

This drains backlog sooner but rejects **400 requests/s** and loses revenue.

Actual recovery still requires five stable steps.

#### Key teaching point

Adding application servers leaves the database limit at **600 operations/s**.

The postmortem should link:

- promotion
- database saturation
- chosen response
- cost/effect
- preparation for future growth

---

### 7.5 Example Skill Tree

The tree supports **LO1–LO4** through **9 unlocks** across three branches.

Players:

1. earn milestone research points
2. spend research points to unlock technologies
3. spend cash + engineering time to deploy them

Metrics, history and alerts are baseline tools and require no research unlock.

Reveal upgrades gradually as players reach relevant milestones.

The first run shows only the options needed for its one incident and 3–4 meaningful choices.

Later runs introduce remaining paths and management controls.

Keep all three branches and all nine unlocks in the overall MVP progression.

| Capacity — LO2 · LO4 | Data — LO1 · LO2 · LO4 | Reliability — LO3 · LO4 |
|---|---|---|
| **Scale up:** larger server **OR** **Scale out:** extra instances + load balancing → **Autoscaling** | **Larger database OR Read cache** → **Cache tuning** | **Health checks + Spare application instance** → **Automatic failover** |

#### Capacity

- larger servers increase per-instance capacity
- extra instances need traffic distribution
- autoscaling reacts after a delay
- autoscaling cannot fix a database bottleneck

#### Data

- database upgrade adds capacity at recurring cost
- caching reduces eligible reads
- cache tuning changes hit rate and warm-up
- compare options against workload rather than buying them in a fixed order

#### Reliability

- health checks detect unhealthy instances
- spare instances provide replacement capacity
- failover routes work to healthy instances
- availability still depends on sufficient remaining capacity

---

### 7.6 Application Architecture

```text
Player Interface
Decisions · dashboards
        ⇅ save / load
Backend + PostgreSQL
Accounts · runs · analytics

Player Interface
        ⇄
Simulation + Incidents
State · ticks · event trace
        →
Postmortem
Cause · recovery · prevention
```

**Figure 4.** Player actions change simulation state; metrics and postmortems make the consequences visible.

#### Frontend

- Next.js
- TypeScript
- architecture graph
- monitoring dashboard
- incident controls
- management interface
- React Flow and Recharts/D3 can support graphs, metrics and immediate feedback

#### Backend and deployment

- Next.js / Node.js APIs
- managed PostgreSQL:
  - Supabase or Neon
- intended data:
  - accounts
  - saved runs
  - scenarios
  - analytics
- leaderboards may follow
- deploy on Vercel
- use GitHub Actions or preview deployments for pull requests
- playable release starts in Week 2

#### Stretch features

Not required for MVP:

- LLM-generated readable postmortems from recorded events
- WebSockets for collaborative incident response

---

## Repository / IDE Assistant Guidance

When using this document as context for implementation, preserve these principles:

1. **Continuous tycoon campaign, not disconnected lesson screens.**
2. **First run = 10–15 minutes, one incident, 3–4 meaningful choices.**
3. **Teach through consequences, not answer-giving tutorials.**
4. **Metrics and alerts are available from the start.**
5. **The same simulation model should govern healthy operation and incidents.**
6. **Incidents should emerge from state, not be solved by hard-coded "correct" actions.**
7. **Multiple strategies may work depending on workload, budget and timing.**
8. **Adding application servers must never increase database capacity.**
9. **Caching must depend on eligible reads / workload characteristics.**
10. **Failover cannot create capacity; surviving capacity still matters.**
11. **Keep only two MVP incident families: overload and temporary application-instance failure.**
12. **Gradually reveal the 9-unlock technology tree.**
13. **Do not add out-of-scope mechanics unless the proposal is explicitly revised.**
14. **Prioritise fun, clarity and replayability over technical realism.**
15. **Human playtests determine whether the 10–15 minute experience is actually enjoyable and understandable.**

---

## Source

Converted from **Final Project Proposal Group 5 (1).pdf** for repository and IDE-assistant reference.
