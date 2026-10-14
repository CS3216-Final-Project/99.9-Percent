# Gameplay analytics

The optional PostHog integration measures player engagement in Campaign and Classic.
It observes the game store at app startup, outside React, without modifying the simulation,
save format, account API or existing local playtest archive. It sends selected new observations,
not historical local playtest records.

## Enable collection

1. Create a PostHog project in the US or EU region and invite the project team.
2. In the frontend Vercel project's **Production** environment, set:
   - `VITE_ANALYTICS_ENABLED=true`
   - `VITE_POSTHOG_TOKEN=<public project ingestion token>`
   - `VITE_POSTHOG_HOST=https://us.i.posthog.com` (or `https://eu.i.posthog.com`)
   - Optionally `VITE_BUILD_ID`, for a human-readable release label. Otherwise the Vercel commit SHA is used.
3. Redeploy the frontend after configuring these public build-time values.
4. Start a new run and check PostHog's live events before interpreting any dashboard.

Never use a personal/project-secret API key in a `VITE_*` value.
Collection requires a production build, `VERCEL_ENV=production` and explicit enablement.
Local development, automated test builds, previews, absent tokens and unsupported hosts do not
initialise the SDK, create its storage or attach analytics timers. Preview configuration cannot
accidentally enable tracking merely by inheriting production variables.
Analytics failures must not stop gameplay. No backend/database changes are required.

The dashboard is hosted in PostHog at [US Cloud](https://us.posthog.com) or
[EU Cloud](https://eu.posthog.com). Create **99.99% Gameplay** under Dashboards.
Its project/dashboard-specific URL is available after creation; an example URL shape is
`https://us.posthog.com/project/<project-id>/dashboard/<dashboard-id>`.
No account or dashboard is provisioned by installing the SDK or merging this PR.

## Events and properties

All events have `event_version`, `build_id`, `content_version`, `mode`,
`run_id`, `gameplay_session_id`, `device_category`, `chapter_id`,
`progress_step`, `session_active_ms`, `run_active_ms` and `eligible_started_run`.
An event has its own `$insert_id`. The SDK supplies a persistent anonymous browser
`distinct_id`; it is independent of the run and session IDs.

| Event | When |
| --- | --- |
| `gameplay_run_started` | A player actually starts a newly observed run. Title-screen boot does not count. Includes `entry_type=new` and `replay`. |
| `gameplay_run_resumed` | A player opens an existing run, including imports. Includes `entry_type=resume` or `existing_save`. |
| `gameplay_session_started` | Play begins, a run is changed or a page is restored from back/forward cache. |
| `gameplay_session_progress` | Every 15 seconds when visible active time has increased, and at visibility boundaries. Includes active_delta_ms since the previous checkpoint. Duration values are cumulative snapshots. |
| `gameplay_session_ended` | Going home, switching/replacing a run, completion/failure, pagehide or observer disposal. Includes `reason`. |
| `gameplay_chapter_started` | The player enters a Campaign chapter for the first time observed on this browser. |
| `gameplay_chapter_completed` | A previously incomplete chapter becomes complete during observed play. |
| `gameplay_run_completed` | All Campaign chapters are complete in the same run, or Classic reaches its winning outcome. |
| `gameplay_run_failed` | A run reaches a losing outcome. Includes `outcome` and the last reached chapter. |

Campaign chapter IDs are `opening`, `scaling`, `data`, `spikes`, `reliability`.
Completion reuses the same chapter-status function as the visible chapter list.
All five must be complete, including acknowledgement of the final chapter's outcome.
Recognising the opening milestone alone is not Campaign completion. Completion stops the
duration measurement for that run; continuing to operate the finished company does not inflate
time to completion. Campaign's content definition is versioned as `chapters-v1`;
increment it when the set/meaning of required chapters changes. Classic is `classic-v1`.
Build IDs distinguish releases within a content version.

Visible planning, onboarding, incident and review time counts even while simulation time is paused.
Hidden-tab time and time beyond two minutes without pointer, keyboard, wheel or touch activity
do not count. Activity restarts the clock; simulation ticks alone do not reset inactivity.
These are engagement estimates, not proof that a person was paying attention.

An independent local analytics ledger retains the last 100 run records, including active time,
observed chapter IDs and terminal status. It does not change the game save format.
Reopening/importing a completed save baselines its milestones and emits no retrospective
completion. Runs first encountered as existing saves are excluded from new-run completion
cohorts (`eligible_started_run=false`). If ledger storage fails, timing/deduplication continue
in memory; deduplication and cumulative duration across reloads can then be incomplete.

## Dashboard recipe

Use a default filter for `mode`, `content_version` and a date range, with optional
`build_id` and `device_category` breakdowns. Keep Campaign and Classic completion separate.

| Insight | Definition / configuration |
| --- | --- |
| Unique players | Unique `distinct_id` on `gameplay_session_started`. |
| Sessions | Unique `gameplay_session_id` on `gameplay_session_started`. |
| New runs | Unique `run_id` on `gameplay_run_started`. |
| Gameplay duration | Group all progress/end snapshots by `gameplay_session_id` and take MAX(`session_active_ms`); then chart the median and a histogram. Include unfinished sessions. |
| Run duration | MAX(`run_active_ms`) per `run_id` and content version, not SUM of snapshots. |
| Chapter progression | Unique `run_id` and unique players on chapter-started/completed events, broken down by `chapter_id`. |
| Campaign completions | Unique `run_id`, plus unique players, on Campaign `gameplay_run_completed`. |
| Player completion rate | Players with a Campaign start in the selected cohort who subsequently complete one of those same run IDs, divided by all players in that start cohort. |
| Run completion rate | Campaign runs started in the cohort that subsequently complete, divided by all runs started in that cohort. |
| Time to completion | Median and distribution of `run_active_ms` on completed runs, filtered to `eligible_started_run=true`. |
| Chapter funnel | Run started, then chapter-completed events in chapter order. Match steps by `run_id` so milestones from different attempts cannot combine. |
| Drop-off | Highest reached chapter for each eligible started run without a completion within the chosen conversion window. Label as incomplete, not proven abandoned. |
| Day 1 / Day 7 retention | First gameplay-session-started event to a session-started event or a progress event with active_delta_ms > 0 on the following calendar day / day 7, by anonymous browser identity. This also captures returning to a tab left open overnight. |
| Replay rate | Players who start a new run after a completed/failed run, divided by players who completed/failed. Match players and time order; the `replay` flag is a convenient browser-local breakdown. |
| Failures | Unique `run_id` on run-failed, broken down by chapter and mode. |

Use PostHog trends/funnels/retention where supported; use SQL insights for snapshot MAX aggregations
and matching completion cohorts by run ID. For the completion cohort, select starts in the date
range and allow later matching completions within an explicit conversion window (for example
seven days). Show cohort size and window, and mark recent cohorts as still maturing.
Do not divide completions occurring this week by starts this week: they can be different players/runs.
PostHog funnels default to people; configure the run ID property to remain constant through all
steps or use a SQL insight joining steps by run ID. Player completion rate counts each player once,
even if they replay.

Duration snapshots can be recovered without a final event, but a tab/browser crash can lose the
last checkpoint interval and network delivery is best effort. Do not sum cumulative heartbeat
durations. Configure the SDK's project retention/billing limits in PostHog and review event volume:
a visible active session produces about four progress events per minute; idle heartbeats are suppressed.

## Privacy and interpretation

The SDK uses localStorage for a pseudonymous browser identity.
Analytics is on by default and stops at once when the player opts out, which also removes the run ledger and PostHog's stored identity.
While the browser's Do Not Track or Global Privacy Control setting is on, the SDK is not loaded and no analytics data is observed or stored; the stored choice applies again once the setting is off.
Person profiles, automatic clicks/pageviews, session recording, surveys, automatic exception
capture and performance capture are disabled. The outgoing property allowlist removes URLs,
query strings, referrers, account identities, raw saves, observer notes and feedback.
PostHog still receives network metadata inherent in an HTTPS request.
Account sign-in/out does not link or reset analytics identities in this first version.

A browser identity estimates a player: different devices, cleared storage or blocked persistence
can split a person, while a shared browser can combine people. Blocking/offline collection
undercounts engagement. Cross-browser imports and cleared ledgers can repeat observations;
dashboard completion counts must use unique run IDs, not raw event totals.
Retention requires waiting for the relevant day to elapse; missing return events are not proof of
dissatisfaction.

## Verification

Focused regression tests cover the real store and StrictMode shell, no title-screen starts,
reload/resume/replay identity, all-chapter completion, historical completed saves, failure,
visibility, inactivity, back/forward cache and storage/collector failures. Adapter tests check
disabled environments, bounded SDK startup buffering, region routing and the outgoing allowlist.
Browser journeys exercise the build-time integration with synthetic credentials and intercepted
PostHog requests; no real project events or player data are needed.

For a deliberately enabled local smoke build, set `VERCEL_ENV=production`,
`VITE_ANALYTICS_ENABLED=true` and a synthetic `VITE_POSTHOG_TOKEN`, then run the analytics browser
journey with `ANALYTICS_SMOKE=1`. Use only the interception fixture, never a real project token.
A live PostHog project, configured production settings, event acceptance and actual dashboard
creation still require operator setup and are not established by mocked tests.

References: [JavaScript SDK](https://posthog.com/docs/libraries/js),
[Dashboards](https://posthog.com/docs/product-analytics/dashboards),
[Funnels](https://posthog.com/docs/product-analytics/funnels),
[Retention](https://posthog.com/docs/product-analytics/retention).
