# Gameplay rules

This is the source of truth for how 99.99% plays: its two modes, the Guided Mode chapters, the simulation rules and the economy.
The code wins any disagreement; fix this file when it does.
The 3D building and its controls are in [WORLD.md](WORLD.md), and screen layout is in [UI_DESIGN.md](UI_DESIGN.md).

## Modes

The home screen offers two modes, each with its own save.

| Mode | Internal name | Clock | Goal |
| --- | --- | --- | --- |
| Guided Mode | `campaign` | Continuous game seconds, settled every 60 seconds as an operating week | Learn infrastructure concepts through Launch Week (Chapter 0) and five chapters |
| Challenge Mode | `classic` | Weekly turns, 26 weeks | Reach 50,000 users before week 26 without going bankrupt |

Challenge Mode is locked until the first five Guided Mode chapters (Opening to Stay Online) are complete.
Once unlocked, a player can switch between modes without losing either save.

## Guided Mode

One company, with one run ID, cash balance, architecture, queue state, pending work, trace and report history, carries through every chapter.
Starting a new company is a separate, confirmed reset.

| # | Chapter | Internal stage | Learning question |
| --- | --- | --- | --- |
| 0 | Walkthrough | `getting-started` | How do I read the evidence, run the clock and preview a purchase? |
| 1 | Opening | `opening-db` | Which dependency is constraining service? |
| 2 | Scaling & Routing | `application-scaling` | Does installed capacity actually receive traffic? |
| 3 | Data Strategy | `data-strategy` | How does workload change the value of a cache? |
| 4 | Traffic Spikes & Autoscaling | `traffic-spikes` | Can delayed automation handle changing demand at an acceptable cost? |
| 5 | Stay Online | `application-reliability` | Does failure detection leave enough surviving capacity? |
| 6 | Grow the Company | `combined-campaign` | Can the company handle combined growth and stay solvent? |

Chapter status is derived from engine state in `frontend/src/game/campaignChapters.ts`.
Every chapter transition is an explicit player action; reports, milestones and recognitions are acknowledged by the player, never automatically.

### Clock and pausing

One physical step is one game second of requests.
Run starts the shared clock and Pause freezes it.
The +1s and +5s buttons (and `N`) advance exactly that many seconds and stop early wherever running would.
Speed changes real-time pacing, not the work modelled per step.

The first incident pauses automatically.
Pending recovery reviews, milestones, spike recognition and bankruptcy stop advancement.
Opening the menu or hiding the browser tab pauses play; there is no offline catch-up.

### Chapter 0: Walkthrough

A mandatory, nonmodal guide with ten lessons runs beside the real game for new profiles.
It holds management time apart from a bounded one-second Run exercise, enables only the controls each lesson needs and lets the player open a purchase quote but not confirm it.
Progress is stored in the profile, so it resumes from the same lesson after a reload, Save and exit or a new company.
Finishing requires the explicit Finish walkthrough action.
A completed player can replay it from View chapters, Menu > How to play or the home screen; a replay runs on a practice company and restores the original company on Finish or Exit.
The lesson list and its control restrictions are specified in [UI_DESIGN.md](UI_DESIGN.md#screen-structure).

### Opening (version-1 companies)

Launch Week replaced the Opening for new companies, so the chapters after it are numbered from 1.

The company starts with $20,000, one 1,000 req/s application, one 600 ops/s database, 300 incoming req/s, 2,000 displayed users and four engineers.
At step 4 demand rises to 800 req/s, so the database is overloaded while the application has headroom.
Three overloaded steps open the first incident at step 6.

Opening choices are free inspection, adding an app, upgrading the database and limiting traffic.
An added app is installed but unrouted, so it neither adds database capacity nor shares traffic.
A database upgrade activates after its delay.
A traffic limit admits at most 500 req/s and rejects the rest.

There are two ways to complete the Opening; both award the same `opening-stability` milestone, which the player acknowledges from the chapter completion menu (see Guidance).

- **Recovery:** an actual incident, five consecutive qualifying recovery steps, the postmortem, then Continue company.
- **Prevention:** after growth, with no Opening incident ever opened, the company serves the full 800 req/s without a traffic limit, with positive cash, empty queues, latency under 500 ms and errors under 1%.
  The Application and Database must each be inspected after growth, then five consecutive new steps must meet every condition.
  A failing step resets the streak; pausing, reading and reloading add no observations.
  The player reviews the prevention outcome and presses Continue company.

The prevention rules are in `frontend/src/sim/openingPrevention.ts`.

### Chapter 1: Scaling & Routing

Growth to 1,400 req/s is scheduled three steps after the company is ready: management phase, no active incident, empty queues and purchased database capacity of at least 2,000 ops/s.
A separate confirmation lets the player accept the growth with current database capacity; it grants nothing and overload and bankruptcy stay possible.

Responses are scaling an app to 1,600 req/s, or installing another app and configuring load-balanced routing.
Deploying a load balancer does not change routing, and a new app receives no new work until routing includes it.
Balanced routing splits integer demand equally across the selected apps in numeric order; it does not weight by capacity, so a mixed 1,600/1,000 pool can overload its smaller app.

Continue to Data Strategy unlocks once growth has been consumed, queues are empty, no incident is active and every report is acknowledged.

### Chapter 2: Data Strategy

Entry deterministically picks a read-heavy (80% reads) or write-heavy (20% reads) profile from the saved RNG.
Growth to 2,400 req/s is scheduled three steps after readiness.

All reads are cache-eligible and writes always reach the database.
A cache starts cold, uses its current hit rate for the step, then warms by 12 percentage points when eligible reads were processed.
Its ceiling is 60%, or 75% after tuning.
Cache hits succeed without database work; misses and writes reach the database.
For example, 2,400 processed requests with a warm 60% cache produce 1,152 hits and 1,248 database operations when read-heavy, but only 288 hits and 2,112 operations when write-heavy.

The other major response is the 3,000 ops/s database tier.
Observe contrasting workload optionally switches the profile once after growth.

### Chapter 3: Traffic Spikes & Autoscaling

Entry requires consumed data growth, positive cash, stable management, empty queues and acknowledged reports, and grants one research point for the autoscaling technology.
For entry at step `n`, demand is 4,000 req/s during `[n+8, n+28)` and `[n+48, n+68)` and 2,400 req/s otherwise.
These are saved deadlines; pausing and reloading do not move them.

The optional controller needs the unlock, deployed load balancing, balanced routing to at least two apps, a free slot and cash.
It watches routed processed work divided by routed capacity:

- Above 80% for three observations, it requests one base app, which installs in three steps and joins routing one step later.
- Below 60% for six safe observations, it retires an eligible controller-created app, never leaving fewer than two.
- At most four apps are installed, with a four-step cooldown after each join or retirement.

Manually installed or vertically upgraded apps are never retired, and there are no refunds.
After both pulses, five stable baseline steps complete the chapter, which the player then acknowledges.

### Chapter 4: Stay Online

The player explicitly starts a temporary app failure test.
The target app fails eight steps later and restores itself after twenty failed steps, unless the free three-step manual restoration finishes first.
Health Checks detect the failure on a later step, and a reserved spare is promoted after a delay; failover reroutes traffic but adds no capacity.
Actual reports and five stable observations after restoration precede the explicit reliability acknowledgement.

### Chapter 5: Grow the Company

Entry requires acknowledged reliability, stable full-demand management at 2,400 req/s, empty queues, healthy apps, positive cash and finished actions and reports.
Registered users grow from 2,000 to 20,000, 35,000 and 50,000 across three announced waves.
Baseline demand is `2400 + floor((users - 2000) * 600 / (target - 2000))`, so 2,400, 2,625, 2,812 and 3,000 req/s for the default target.

The seeded pool holds one read-heavy pulse (3,800/4,000 req/s), one write-heavy pressure (3,000 req/s) and one failure under load (3,400/3,600 req/s with one temporary app fault).
Five stable full-demand observations make Start next growth wave available, and each wave is announced eight steps ahead.
After each wave, queues must drain, apps must be healthy, reports must be acknowledged and five stable full-demand observations must follow before the player reviews the growth outcome.
After all three reviews, five more full-demand steps qualify the final review, and Complete campaign ends the run, freezes the clock and keeps the company inspectable.
Before the final scorecard, the five colleagues celebrate once per run: Maya, Jordan, Sam, Taylor, then Alex each speak one line built from the recorded scorecard, and the last line shows users, uptime (when known) and incidents.
Skipping it at any line counts as seeing it; leaving it part way, for example by reloading, plays it again from the start.

An optional promotion costs $500, activates next step, adds 400 req/s for twelve steps and has a thirty-step cooldown.

The final scorecard separates settled and pending revenue, setup and operating costs, salaries and promotion spending.
It reports rejected demand separately from service errors, plus architecture, technologies, incident count, service-health uptime and the longest degraded span.
Confirmed replay archives the old company and scorecard and starts a new run ID and seed.

### Guidance

Guidance never changes the rules; it reads the same state the engine uses.

- The chapter bar shows the chapter, one state-derived goal and Next when a transition is available.
- Every chapter followed by another one (Launch Week or the Opening, Scaling & Routing, Data Strategy, Traffic Spikes, Stay Online) ends on one completion menu, with the clock paused: Stay in this chapter, or Continue into the next chapter.
  For Launch Week, the Opening, Traffic Spikes and Stay Online the menu is the chapter's own recognition, which either choice acknowledges; Scaling & Routing and Data Strategy announce it once per company.
- Continue is disabled while the next chapter's entry gate is unmet, and the menu names every unmet requirement; Next in the chapter bar then offers the chapter, disabled with the same reasons, until the company is ready.
  Stay Online needs normal 2,400 req/s traffic, positive cash, no incident, read reports, empty queues and healthy requests; Grow the Company also needs finished queued changes and every server up.
- The menu asks to open with Continue focused when it is possible, and with Stay focused otherwise.
- Escape, Close and a click outside the menu all mean Stay in this chapter: the recognition is acknowledged and the menu does not return for that company.
- A company that stays after Launch Week or the Opening remains in that finished chapter: none of Scaling & Routing's controls or requirements appear until Next enters it.
- An Opening the player stays in is remembered for that company in the browser's profile, so the next Play does not move it into Scaling & Routing; a company loaded without that record, such as an older save, an import or a cloud restore, still continues into Scaling & Routing on Play.
- Chapter requirements list each gate as met or unmet, without revealing future deadlines.
- Hint is player-requested and points at an existing control; optional attention cues for Run and Next defer to required reviews and guides.
- Each chapter opens with an optional Company Message from a colleague (Maya, Alex, Jordan, Sam, Taylor, then Alex) stating its mission.
  The colleague speaks a few short lines in their own voice, which the player reads one at a time, and the last line carries the mission.
  Dismissing it at any line counts as reading it.
- A new diagnostic incident that keeps running shows one Pause invitation.
- Every report (incident postmortem, prevention review, chapter outcome, growth review, scorecard) uses four short sections and one collapsed View Technical Details disclosure.
  Reports are built from recorded snapshots, trace and actual activations, never from later company state.

## Simulation rules

These rules are shared by every Guided Mode chapter and live in `frontend/src/sim/step.ts`.

- Each app processes `min(previous backlog + new demand, capacity)` per step; the remainder queues up to 1,000 per app and the overflow fails.
- The database applies the same rule with a 600-operation backlog limit at every capacity tier.
- Database demand is app-processed work minus cache hits, so draining queues can push work downstream after it arrived.
- Latency is `100 ms + 1,000 * (largest per-instance backlog / capacity + database backlog / capacity)`.
- Service error rate is failed outcomes over successful plus failed outcomes; deliberate rejections are reported separately.
- Demand strictly above a component's capacity for three consecutive steps opens an incident; with several components, app order then database picks the primary.
- Recovery needs five consecutive observations with latency under 500 ms, errors under 1%, positive admissions and completed outcomes. Buying, deploying or waiting is not recovery.
- Bankruptcy is checked after settlement and takes precedence over recovery in that step.

## Economy

Purchases deduct cash immediately and must leave a positive balance; running costs start when equipment activates.
Only one infrastructure deployment can be pending at a time.

| Investment | Setup | Activation (steps) | Upkeep per 60-step week |
| --- | ---: | ---: | ---: |
| Additional base app | $1,000 | 2 manual / 3 automatic | $700 |
| Scale an app to 1,600 req/s | $2,000 | 3 | $1,100 for that app |
| Database 600 to 1,000 ops/s | $3,000 | 3 | $1,500 database total |
| Database 1,000 to 2,000 ops/s | $3,000 | 3 | $2,500 database total |
| Database 2,000 to 3,000 ops/s | $4,000 | 4 | $3,500 database total |
| Load balancer | $1,000 | 2 | $300 |
| Read cache | $1,500 | 2 | $400 |
| Cache tuning | $1,000 | 2 | None |
| Autoscaling controller | $1,000 | 2 | $100, including while disabled |
| Traffic limit or removal | $0 | 1 | None |

The starting database costs $500 per week and four engineers cost $1,600 each.
Every 60 steps settles one operating week exactly once: each successful request earns $0.20, and accrued equipment and salary costs are charged, keeping partial cents.
Pending revenue is not spendable before settlement.

Traffic limiting always caps admission at 500 req/s.
Rejected demand earns nothing; its opportunity value is shown but is not an extra charge.
A limited company can be technically healthy and still lose money, for example $6,000 revenue against $8,600 costs per week at 500 req/s with one app and a 1,000 ops/s database.
Bankruptcy ends the run, explains the settlement, keeps the evidence and offers a confirmed restart.

## Technology tree

Both modes use the same nine nodes in three branches.

| Capacity | Data | Reliability |
| --- | --- | --- |
| Scale Up | Larger Database | Health Checks |
| Scale Out + Load Balancing | Read Cache | Spare Application Instance |
| Autoscaling | Cache Tuning | Automatic Failover |

Scale Up and Scale Out are independent, and Autoscaling requires load balancing.
Larger Database uses the repeatable database upgrade and is independent of Read Cache.
Cache Tuning requires a deployed Read Cache.
Automatic Failover requires Health Checks, a spare instance and load balancing, and it promotes a spare without adding total capacity.
Metrics, forecasts and alerts are always available.

In Guided Mode, chapters grant research points and the owned database tier implies Larger Database.
In Challenge Mode, research costs cash and engineer-weeks and built upgrades ship through the release flow.

## Challenge Mode

Challenge Mode is the migrated prototype ([prototype-migration.md](prototype-migration.md)): weekly turns, engineers assigned to work, deploy-now versus test-first releases and four incident families with a timed crisis clock, evidence gathering, recovery actions, hints and postmortems.

- Read Cache warms over two weekly turns; Cache Tuning raises the maximum database load reduction from 36% to 50% and warms a cold cache in one turn.
- The workload assumes 60% of database demand is cache-eligible, and writes are never cached.
- Promotions need no research: Social push from the start, Launch campaign at 5,000 users and Targeted campaign at 10,000 users.
- Legacy definitions from the 17-node prototype tree remain only so old saves resume; removed research cannot be started again, and progress counts only the nine nodes.

## Saves

Both modes autosave on transitions, on a ten-second timer while in the foreground and on page lifecycle events.
Resuming always starts paused and keeps pending deadlines, queues, progression, acknowledgements and measurement.
Menu > Saves exports and imports JSON saves; an import is validated before it replaces a run and opens the matching mode.
Corrupt or unsupported saves are kept and exportable, and a pre-update browser save can be exported or resumed into Challenge Mode.
Guided Mode saves are a compact input log replayed through the engine; storage keys and schema versions are in [ARCHITECTURE.md](ARCHITECTURE.md#browser-storage).
