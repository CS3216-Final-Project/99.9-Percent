# PR1 observation protocol — Phase 2

Status: PREPARED; no participant sessions conducted by this implementation.

Use the same recorded build and opening-db v1 for approximately five fresh target users. Keep recruited and organic records separate. Do not mix this usability/demand pilot with the later 20-person learning cohort.

## Setup
- Record deployed URL, commit/build ID, scenario ID/version, browser and device.
- Configure VITE_BUILD_ID to the release identifier and VITE_PLAYTEST_URL to the real registration URL before a release build. Never include secrets in VITE_* values.
- Confirm guest play, local save/resume, screenshot, CTAs and export on the actual deployment.
- Use isolated browser profiles for separate participants. Export before resetting a profile.
- The menu's Playtest observer notes shows session ID and accepts source and exact facilitator intervention. No participant name is required; link an observer participant code to that session ID.
- The runtime records foreground active time (including paused reading), wall elapsed time, physical steps and event identities separately.
- A migrated Phase 1 run has unknown historical timing and is not a fresh-user opening sample.
- Do not retune opening-db v1 to force a session duration.

## Observer sheet
Copy one sheet per participant.

| Field | Record |
|---|---|
| Participant code / session ID | |
| Fresh user? Prior web/operations/tycoon familiarity | |
| Source: recruited / organic / unspecified | |
| URL / build / commit / scenario | |
| Browser / device | |
| Explicit start time | |
| First component and metric inspected | |
| First intervention, request step and activation step | |
| Incident time / recovery time / milestone time | |
| Active time / wall time / interruptions | |
| Exact hints used (navigation onboarding is not a hint) | |
| Exact facilitator words, time and reason | |
| Confusion, predictions and interaction problems | |
| Outcome: completed / prevented incident / bankrupt / quit / technical interruption | |
| Enjoyment 1–5 or missing | |
| Unprompted replay/future-test words and time | |
| Asked before a continuation/replay prompt? | |
| New run AND gameplay decision? Prompted/rewarded? | |
| Export filename / missing data | |

Watch silently where possible. Do not identify the database or suggest an upgrade. If assistance is needed, record it verbatim. Record unsuccessful choices without treating them as an invalid run.

## After the first attempt
Ask enjoyment before coaching: “How enjoyable was this play session?” (1 not at all enjoyable to 5 extremely enjoyable). Ask players who quit or fail too.

Then ask:
1. What caused the slowdown?
2. Which evidence helped you decide?
3. What did your action change?
4. Which decision was interesting?
5. What was confusing?
6. Would you want to continue this company or try another run?

Record spontaneous interest BEFORE question 6. “Can I try again?” or “When can I try the next version?” counts only if unsolicited. A prompted yes does not count. Target at least one of five and report the actual numerator/denominator.

## Export and retention
Menu → Export playtest record downloads attributed events, session measurement, current game/evidence and the original archive payload. Earlier reset runs have run_evidence records. Export does not delete anything.

Menu → Save and exit to title explicitly ends a session. Hidden tabs are interruptions, not inferred quits. Re-entering the same company retains its run ID. A new company plus an accepted intervention is a replay candidate; the observer must distinguish voluntary from prompted/rewarded behavior.

Storage failures are visible. Keep the tab open and export in-memory data; do not promise that failed writes survive reload. Do not clear browser storage before export. Record any missing data.

## Reporting
Report all attempts, timing distributions, confusion, interventions, failures/quits and missing responses. Report recruited versus organic outcomes separately. Sign-up totals come from the configured registration destination, not gameplay events. Do not infer learning effectiveness, professional competence or a guaranteed 10–15-minute experience from these sessions.
