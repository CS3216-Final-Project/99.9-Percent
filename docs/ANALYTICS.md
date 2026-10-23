# Analytics

This is the source of truth for what 99.99% measures: the PostHog product analytics that leave the browser, and the local playtest records that never do.

| | PostHog product analytics | Local playtest records |
| --- | --- | --- |
| Code | `frontend/src/lib/analytics.ts`, `frontend/src/game/productAnalytics.ts` | `frontend/src/game/telemetry.ts`, `track()` in `frontend/src/game/persist.ts` |
| Leaves the browser | Yes, to PostHog | Never; exported by hand from Menu > Playtest |
| Runs | Production builds only, unless the player opts out | Always |
| Storage | `nn.product-analytics.v1` and `ph_*` | `nn.campaign.analytics.v1` |

## PostHog product analytics

The integration observes the game store from outside React and never modifies the simulation, saves or local records.
It sends only new observations, never historical local records.
The shared [99.99% Gameplay dashboard](https://us.posthog.com/shared/BAtLorlW6hhWp10C-ZxWuLR-itnjtQ) shows its results.

### Enable collection

The SDK loads only when all of these hold:

- A production build (`import.meta.env.PROD`) where Vercel's `VERCEL_ENV` is `production` (mapped to `VITE_DEPLOY_ENV` in `frontend/vite.config.ts`).
- `VITE_ANALYTICS_ENABLED=true` and a `VITE_POSTHOG_TOKEN` are set in the frontend project's Production environment.
- `VITE_POSTHOG_HOST` is exactly `https://us.i.posthog.com` (the default) or `https://eu.i.posthog.com`.
- The player has not opted out, and the browser is not sending Do Not Track or Global Privacy Control.

Local development, tests, previews, missing tokens and other hosts never initialise the SDK, create its storage or attach timers.
`VITE_BUILD_ID` optionally labels the release; otherwise the Vercel commit SHA is used, then `unrecorded`.
The token is PostHog's public project ingestion token; never put a personal API key in a `VITE_*` value.
Redeploy the frontend after changing these values, then check PostHog's live events before reading a dashboard.

### Consent and privacy

Analytics is on by default.
Until the player answers, a notice on the home screen offers OK or Opt out; the choice can also be changed in Menu > Playtest or the Account dialog and is kept in `nn.analytics-consent.v1`.
Opting out, in any tab, stops collection at once without a closing event and deletes the run ledger and PostHog's stored identity.
Opting back in starts a new anonymous identity.
Do Not Track or Global Privacy Control overrides an acceptance without changing the stored choice.

The SDK is configured with autocapture, pageviews, page leave, performance, exception capture, session recording, surveys, feature flags and person profiles all disabled, and with request batching off.
A `before_send` filter drops every event whose name does not start with `gameplay_` and removes every property outside an allowlist, which strips the URL, referrer, screen, browser and campaign properties the SDK normally adds.
The SDK properties that remain are `distinct_id`, `$device_id`, `$session_id`, `$window_id`, `$insert_id`, `$lib`, `$lib_version`, `$is_identified`, `$process_person_profile` and `token`.
`distinct_id` is a random browser ID in localStorage; nothing calls `identify`, so accounts are never linked.
No URLs, account details, saves, feedback or observer notes are sent.
PostHog still receives the request's network metadata, such as the IP address, unless IP capture is disabled in the PostHog project.

### Common properties

Every event carries:

| Property | Value |
| --- | --- |
| `event_version` | `1` |
| `build_id` | `VITE_BUILD_ID`, else the commit SHA, else `unrecorded` |
| `content_version` | `chapters-v2` for Guided Mode, `classic-v1` for Challenge Mode |
| `mode` | `campaign` or `classic` |
| `run_id` | The Guided Mode run ID, or a random UUID for a Challenge Mode run |
| `gameplay_session_id` | Random UUID per play session |
| `device_category` | `touch` for a coarse pointer, otherwise `desktop` |
| `chapter_id` | `opening`, `scaling`, `data`, `spikes` or `reliability`; null in Challenge Mode |
| `progress_step` | Guided Mode game second, or Challenge Mode week |
| `session_active_ms`, `run_active_ms` | Cumulative active time snapshots |
| `active_delta_ms` | Active time since the previous progress or end event |
| `eligible_started_run` | Whether this browser saw the run start fresh |

Active time counts only while the tab is visible and within two minutes of pointer, keyboard, wheel or touch activity; simulation ticks alone do not count as activity.
Visible planning, onboarding, incident and review time counts even while the game is paused.
These are engagement estimates, not proof of attention.

`content_version` `chapters-v2` counts the ten-lesson walkthrough, so `tutorial_step` means a different lesson list than in `chapters-v1`.
Increment it in `productAnalytics.ts` when the set or meaning of chapters or walkthrough steps changes; build IDs distinguish releases within a content version.

### Events

| Event | When | Extra properties |
| --- | --- | --- |
| `gameplay_run_started` | A player starts a newly observed run; booting to the home screen does not count | `entry_type=new`, `replay` |
| `gameplay_run_resumed` | A player opens an existing or imported run | `entry_type` `resume` or `existing_save`, `replay=false` |
| `gameplay_session_started` | Play begins, the run changes, or the page returns from back/forward cache | |
| `gameplay_session_progress` | Every 15 seconds while visible active time increased, and on each visibility change | `reason` `heartbeat`, `hidden` or `visible` |
| `gameplay_session_ended` | Going home, changing run, completion or failure, `pagehide` or observer disposal | `reason` `home`, `run_changed`, `completed`, `failed`, `pagehide`, `unmount` or `already_finished` |
| `gameplay_chapter_started` | First time this browser sees the run in a chapter | `chapter_id` |
| `gameplay_chapter_completed` | A chapter becomes complete during observed play | `chapter_id` |
| `gameplay_run_completed` | Guided Mode: chapters 1 to 5 all complete. Challenge Mode: the winning outcome | `outcome=completed` |
| `gameplay_run_failed` | A losing outcome | `outcome` |
| `gameplay_tutorial_started` | A walkthrough begins, once until it ends | `tutorial_track`, `tutorial_step`, `tutorial_from` |
| `gameplay_tutorial_completed` | The walkthrough reaches its last step | `tutorial_track`, `tutorial_step` |
| `gameplay_tutorial_skipped` | The walkthrough ends unfinished | `tutorial_track`, `tutorial_step`, `reason` |

Guided Mode completion means chapters 1 to 5, the same set that unlocks Challenge Mode.
Chapter 0 and chapter 6, Grow the Company, are not reported as chapters, and once a run is complete the observer stops measuring it, so chapter 6 play produces no session or duration events.
Reopening or importing a completed save baselines its milestones and emits no retrospective completion.

Tutorial events cover the two walkthroughs only: `tutorial_track` is `campaign` (Guided Mode's Chapter 0) or `basics` (Challenge Mode's first-week tutorial).
`tutorial_step` counts from 0, so a skip on the third card has step 2.
`tutorial_from` is `first_visit`, `resume`, `new_company`, `menu` or `home`.
A skip's `reason` is `player` or `chapter_entered`.
Challenge Mode's walkthrough starts behind the home screen and is reported when play begins.
A reload never repeats an event, but a fresh company reopened before its first decision offers the walkthrough again and so starts it again.

### Run ledger

`nn.product-analytics.v1` keeps the last 100 run records with active time, observed chapters and terminal status, so deduplication and cumulative durations survive reloads.
Runs first seen as existing saves are excluded from new-run cohorts (`eligible_started_run=false`).
If storage fails, timing and deduplication continue in memory for the visit.
Up to 200 events are buffered while the SDK loads; if it fails to load, analytics is dropped and play continues.

### Dashboard recipe

Filter by `mode`, `content_version` and a date range, with optional `build_id` and `device_category` breakdowns, and keep the two modes' completion separate.

| Insight | Definition |
| --- | --- |
| Unique players | Unique `distinct_id` on `gameplay_session_started` |
| Sessions | Unique `gameplay_session_id` on `gameplay_session_started` |
| New runs | Unique `run_id` on `gameplay_run_started` |
| Gameplay duration | MAX(`session_active_ms`) per `gameplay_session_id` over progress and end events; chart the median and a histogram, including unfinished sessions |
| Run duration | MAX(`run_active_ms`) per `run_id` and content version, never a sum of snapshots |
| Chapter progression | Unique `run_id` and players on chapter events, by `chapter_id` |
| Completions | Unique `run_id` and players on Guided Mode `gameplay_run_completed` |
| Completion rate | Runs (or players) with a start in the cohort that later complete one of those same run IDs, over all starts in the cohort |
| Time to completion | Median `run_active_ms` on completed runs with `eligible_started_run=true` |
| Chapter funnel | Run started, then chapter-completed events in order, matched by `run_id` |
| Drop-off | Highest chapter reached by eligible runs without completion inside the conversion window; label it incomplete, not abandoned |
| Day 1 / Day 7 retention | First `gameplay_session_started`, then a session start or a progress event with `active_delta_ms > 0` on day 1 or day 7, by `distinct_id` |
| Replay rate | Players who start a new run after a completed or failed run, over players who completed or failed |
| Failures | Unique `run_id` on `gameplay_run_failed`, by chapter and mode |
| Tutorial completion | Funnel from started to completed, `tutorial_from` `first_visit` or `new_company`, by `tutorial_track`, matched by `run_id` |
| Tutorial drop-off | `gameplay_tutorial_skipped` by `tutorial_step` and `reason`, per track |

Use SQL insights for MAX-of-snapshot aggregations and for matching completions to starts by run ID.
Select starts in the date range, allow completions within an explicit conversion window such as seven days, show the cohort size and mark recent cohorts as still maturing.
Never divide this week's completions by this week's starts.

### Limits

A browser identity only estimates a player: devices and cleared storage split people, and shared browsers merge them.
Blocked or offline collection undercounts, delivery is best effort, and a crash can lose the last checkpoint interval.
Cross-browser imports and cleared ledgers can repeat observations, so count unique run IDs, not raw events.
A visible active session sends about four progress events a minute; review event volume and retention limits in PostHog.

### Verification

Unit tests cover the real store under StrictMode, title-screen boot, reload, resume and replay identity, both walkthroughs, completion, historical saves, failure, visibility, inactivity, back/forward cache and storage and collector failures.
Adapter tests cover disabled environments, the startup buffer, region routing and the allowlist.
`frontend/e2e/analytics.spec.ts` exercises the built integration with a synthetic token and intercepted PostHog requests when run with `ANALYTICS_SMOKE=1`; build it with `VERCEL_ENV=production`, `VITE_ANALYTICS_ENABLED=true` and a synthetic `VITE_POSTHOG_TOKEN`, never a real one.
A live project, its settings and dashboard are not established by these tests.

## Local playtest records

Both modes append events to `nn.campaign.analytics.v1` for facilitated playtests; nothing is sent anywhere and records are never truncated.
Menu > Playtest exports them as JSON, together with observer notes and the participant source.

- Guided Mode records come from the engine trace (`projectEvents` in `telemetry.ts`): run and session starts, inspections, every player and autoscaler action requested and activated, traffic changes, incidents opened and recovered, chapter entries and completions, prevention progress, reliability and growth-wave events, the final scorecard and bankruptcy.
  Each record has an event ID, run, session, build, scenario and physical step.
- Both modes also record walkthrough starts, completions and skips, floor switches, walk mode, view changes, map use and avatar changes.
- Challenge Mode records runs started and finished, incidents started and completed, hints, ratings, voluntary replays, resumes, imports and mode switches.
