# Plan: Let players restart Campaign mode (#57)

Branch: `fe/restart-campaign` (worktree `../99.9-Percent-restart-campaign`, from `origin/main` at `aba488a`).

## Issue summary

Players cannot easily restart Guided Mode (the campaign).
The only reset is in-game, Menu > Saves > Start over > "New company".
The home screen Guided Mode card has no "New company" action, while the Challenge Mode card has "New game".
A finished campaign has no clear "play again" path from the home screen.

Acceptance criteria:

1. Restart from the home screen in at most two clicks, with a confirmation step.
2. Restarting replaces only the campaign save; the Classic (Challenge Mode) save is untouched.
3. A finished campaign can be replayed from the home screen.
4. Analytics record the restart as a new run (new `run_id`).
5. Tests cover restart from both the home screen and the in-game menu.

Issue comment (from #58): show "Replay the tutorial" on the Guided Mode card once `meta.tutorialDone` is true, calling `play()` then `startTour("campaign")`.
This already exists on `main` (`HomeScreen.tsx` `replayTutorial`, covered by `HomeScreen.test.tsx`), so no change is needed beyond keeping it working next to the new actions.

## Current behavior (verified in code)

- `HomeScreen.tsx` `ModeCard` renders a primary button (`onPlay`) and, for Classic only, a "New game" secondary button.
- `campaignSummary` labels an ended campaign "Company closed" for both a won and a bankrupt company, and the only action is "Continue company".
- `store.newRun()` in campaign mode creates a new company with a new `runId` (`crypto.randomUUID()`), a new seed, saves with `explicitReset`, archives pending playtest events and emits `replay_started`.
  It emits the local playtest events `run_reset`, `run_evidence` and `run_scorecard` only when `old.started` is true.
  From the home screen `started` is false, so a home-screen restart would silently drop those archive records for the replaced company.
- `store.switchMode(mode)` always calls `enter(mode, true)`, which calls `play()` for the campaign.
  Restarting Guided Mode from a Challenge Mode home screen through `switchMode` + `newRun` would therefore first resume the old company (product analytics emits `gameplay_run_resumed` and `gameplay_session_ended` for it), then replace it.
- Product analytics (`productAnalytics.ts`) emits `gameplay_run_started` with `run_id = campaign.runId` when `started` flips true with a fresh `lastIntro` of kind `begin`; `newRun` satisfies that, so a restart already produces a new `run_id`.
- In-game `CampaignMenu` (`CampaignUI.tsx`) has the two-press "New company" button and warning callout on the Saves tab only.
- `meta.challengeUnlocked` is persisted in campaign meta, so replacing the company does not re-lock Challenge Mode.

## Design decisions

- **Home card, campaign in progress:** primary "Continue company" (unchanged), secondary "New company".
- **Home card, campaign ended (won or bankrupt):** primary "Play again", secondary "Review company" (opens the ended company, as "Continue company" does today).
  A bankrupt company is also finished; it has nothing to continue but review, so it gets the same treatment.
- **Progress line:** a won campaign reads "Campaign complete"; a bankrupt one keeps "Company closed".
- **Confirmation:** both restart buttons use the same two-press pattern as the in-game reset.
  The first press turns the pressed button red with the label "Lose this company? Press again" and shows a compact warn `Callout` under the card actions.
  The second press restarts.
  The callout text: "This replaces only your Guided Mode save. Challenge Mode is not affected. Export the company first if you want to keep it." with an "Export company" action button.
  The confirmation is "Play again" too for a finished company, because the save (scorecard and history) is still replaced.
- **Disarming:** pressing any other home-screen action (either card's play, new game or tutorial) clears the pending confirmation, matching the in-game rule that a confirmation belongs to the control that asked for it.
  "Export company" inside the warning is exempt: it keeps the confirmation armed, so export then restart is still one more press.
- **Armed layout:** the armed button takes the full row of the `mode-actions` grid (`.mode-actions .btn-danger { grid-column: 1 / -1; }`), so "Lose this company? Press again" never wraps in the 1fr secondary column; the warn callout sits after the grid.
- **Focus:** the last-played card still auto-focuses its primary button; for a finished company that is "Play again", which only arms on the first press.
- **Export from home:** if the campaign is the loaded mode with a run, export `exportGame(game, remainderMs, measurement)` as `campaign.json` (as `SaveFiles`' "Export current company"); otherwise export the stored raw save `rawSave("campaign")` as `stored-campaign.json` (as `SaveFiles`' "Export original stored save").
- **No spurious resume:** add `start?: boolean` (default `true`) to `switchMode` options, passed through to `enter(mode, start)`.
  The home-screen restart switches with `start: false`, then calls `newRun()`.
  Other callers are unchanged.
- **Archive on home restart:** change the `newRun` guard for `run_reset` / `incident_abandoned` / `run_evidence` / `run_scorecard` from `old.started` to `old.hasRun`, so the replaced company's evidence is archived wherever the restart comes from.
  `hasRun` is false for a corrupt or absent save, so those cases still emit nothing.
- **In-game discoverability:** add a "New company" `MenuTile` to the campaign menu's Run tab, using the same two-press confirmation and warning as the Saves button (mirrors Classic's "Tutorial" tile pattern in `Modals.tsx:347`).
  When armed, the tile's title (and so its accessible name) becomes "Lose this company? Press again", as Classic's `label("tutorial", ...)` does.
  `MenuTile` gains an optional `dangerText` prop (default "Your current run will be replaced.") so the tile reads "Your current company will be replaced."
  Both controls share `confirmReset`; switching tabs already clears it.
- **Shared helper:** move the duplicated `download(name, text)` helper (in `SaveFiles.tsx` and `CampaignUI.tsx`) to `frontend/src/components/download.ts` and use it from the home screen too.
- **Unsaved Challenge Mode run:** if switching away from an unsaveable Classic run fails, the existing `unsaved` callout appears; pressing the still-armed restart again calls `switchMode` with `discard: true` (existing `inMode` logic), so the restart still completes in the same flow.

Out of scope: changing Classic's "New game" path, backend or `shared/` contracts, schema.

## Code changes

1. `frontend/src/components/download.ts` (new): `export function download(name: string, text: string)`; remove the two local copies and import it.
2. `frontend/src/game/store.ts`:
   - `switchMode: (mode, opts?: { discard?: boolean; start?: boolean }) => boolean`; call `enter(mode, opts.start ?? true)`.
   - `newRun` campaign branch: guard the replaced company's archive events on `old.hasRun` instead of `old.started`.
3. `frontend/src/components/HomeScreen.tsx`:
   - `Summary` gains `restartable: boolean` (a campaign run exists) and the ended labels ("Play again" / "Review company", "Campaign complete").
   - `HomeScreen` state `confirmRestart: boolean`; `restartCampaign()` arms, then on the second press runs `inMode("campaign", () => useGame.getState().newRun(), { start: false })`.
   - `inMode` accepts the `start` option and forwards it to `switchMode`; any other action clears `confirmRestart`.
   - `exportCampaign()` downloads the current or stored campaign save.
   - `ModeCard` renders, for the campaign card when `restartable`: in progress, primary Continue + secondary "New company"; ended, primary "Play again" + secondary "Review company"; armed label "Lose this company? Press again" with `btn-danger`; the warn callout with the "Export company" action.
4. `frontend/src/components/CampaignUI.tsx` and `MenuRun.tsx`:
   - Run tab: add `MenuTile` "New company" (icon `refresh`, `danger` when armed, armed title "Lose this company? Press again", `dangerText` "Your current company will be replaced."), wired to `reset`; show the same warning callout under the grid when armed.
   - Extract the warning callout to one element used by both places.
   - `MenuTile`: optional `dangerText` prop; existing callers unchanged.
5. `frontend/src/components/HomeScreen.css`: `.mode-actions .btn-danger { grid-column: 1 / -1; }` and spacing for the warn callout inside `.mode-option`.
6. Existing browser journeys that press the home card's "Continue company" on an ended company switch to "Review company":
   - `frontend/e2e/gameplay.spec.ts:111` (bankrupt, "keeps history reachable after bankruptcy").
   - `frontend/e2e/combined.spec.ts:21` (bankrupt, via the `boot` helper at line 7; give `boot` a `resume` label parameter or click by the new name for that case).
   - `frontend/e2e/combined.spec.ts:19` (reload after `Complete campaign`, outcome "won").
   - `frontend/e2e/mobile.spec.ts:292` (reload after `outcome: "won"`).
   Any Vitest test that does the same on an ended company is updated in the same commit (found by running the suite).
7. `docs/testing.md`: extend the "Home screen" bullet with the restart coverage.

## Commit points

1. `refactor(frontend): share the save download helper` - change 1, no behavior change.
2. `feat(campaign): restart Guided Mode from the home screen` - changes 2, 3, 5 and 6 with the unit/store/analytics tests below, so existing journeys stay green at this commit.
3. `feat(campaign): add New company to the menu's Run tab` - change 4 with its App test.
4. `test(e2e): restart Guided Mode from the home screen` - new browser journeys.
5. `docs(testing): record campaign restart coverage` - change 7 (and this plan file).

## How to test

Unit and component tests (Vitest, run locally with `npm run test` / `npm run test:coverage` in `frontend/`):

- `HomeScreen.test.tsx`
  - No campaign save: Guided card has no "New company" / "Play again".
  - Campaign in progress (campaign loaded) with a Classic save present: "New company" first press keeps the same `runId`, shows "Are you sure?" and the armed label; second press starts a new company (`started`, new `runId`, `step 0`) and `localStorage["nn.classic.save.v1"]` is byte-identical.
  - Same from a Challenge Mode home screen: mode becomes `campaign`, new `runId`, Classic save byte-identical.
  - Armed confirmation is cleared by "Continue company" (same `runId` continues).
  - Finished company (`phase: "ended", outcome: "won"`): progress "Campaign complete", primary "Play again", "Review company" opens the same company; "Play again" twice starts a new company.
  - Bankrupt company: "Company closed", "Play again" offered, existing "no tutorial replay" assertion kept.
  - "Export company" from a Challenge Mode home screen downloads the stored campaign save byte-for-byte as `stored-campaign.json`; from a Guided Mode home screen it downloads the loaded company's envelope as `campaign.json` (decodes to the same `runId`).
    Stub `URL.createObjectURL` to capture the `Blob`, read it with `await blob.text()` (fall back to `FileReader` if jsdom lacks `Blob.text`), and spy on `HTMLAnchorElement.prototype.click` to read `download`.
  - Export keeps the confirmation armed: after Export, one more press restarts.
- `store.test.ts`
  - `switchMode("campaign", { start: false })` from Classic loads the saved company with `started: false`.
  - `newRun()` from the home screen (`hasRun`, not started) archives `run_reset` with `previousRunId`/`replacementRunId` and `replay_started`.
  - Failure case: `newRun()` with a corrupt campaign save (`hasRun: false`) archives no `run_reset`.
- `productAnalytics.test.tsx`
  - Home-screen restart: `gameplay_run_started` has a `run_id` different from the first run and equal to the new `campaign.runId`.
  - Restart from a Challenge Mode home screen emits no `gameplay_run_resumed` for the old company.
  - In-game menu restart (Saves button) also emits `gameplay_run_started` with a new `run_id`.
- `App.test.tsx`
  - Run tab lists the new "New company" tile; its two-press restart replaces the company; leaving the tab clears it.
  - Existing "asks once before New company replaces the campaign" Saves-tab test stays.

Browser journeys (added to `frontend/e2e/modes.spec.ts`; per the task, not run locally, CI runs them):

- Seed an in-progress company and a Classic save, go to `/`, press Guided card "New company" twice, skip nothing (seeded meta has the walkthrough done), assert the saved company has a new `runId` at step 0 and the Classic save is unchanged; reload and Continue resumes the new company.
- Seed a finished company (`act(finishedCompany(), { type: "complete_campaign" })`), go to `/`, assert "Campaign complete" and "Play again", press it twice, assert a new `runId` with `outcome: null`.
- Keep `withoutRoom()` for both, as they do not exercise the 3D room.

Local checks before pushing: `npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npm run build` in `frontend/`.
Not run locally: `npm run test:e2e` (per the task); CI's `frontend` job runs the browser shards.
No `src/sim` change, so `npm run balance` is not needed; no backend or schema change.

Visual check: run the dev server and screenshot the home card (in progress, armed, finished) at desktop and a narrow mobile width, and the menu Run tab, to confirm the armed label and callout fit.

## Implementation notes (deviations from the reviewed plan)

- **Armed button stays in place.** The plan stacked the actions full width when armed. The screenshot review showed this moves the armed button, so a quick second press would land on "Continue company". The armed secondary button now keeps its column and reads "Press again", with the full "Lose this company? Press again" as its accessible name. A finished company's full-width "Play again" shows the full label.
- **Review company is a link.** "Review company" wrapped to two lines in the narrow secondary column. A finished company's card now has "Play again" as its only button, with "Review company" as the text link where "Replay the tutorial" sits (which a finished company does not offer).
- **Phone layout.** At 640px and below, a card's two actions stack, because "New company" wrapped beside "Continue company". This applies to the Challenge Mode card's "New game" too.
- **Export placement.** The callout's "Export company" button sits under the warning text, so the text stays readable on a phone.
- **Extra fix: Challenge Mode unlock.** A save older than the `challengeUnlocked` profile field, or an imported one, unlocks Challenge Mode only through the company itself. Replacing that company re-locked Challenge Mode. `newRun` now records the unlock in the profile when it replaces a company (separate commit, with a store test that fails without the fix).
- **Classic save on switch.** Restarting from a Challenge Mode home screen re-saves the departing Challenge Mode run, as every switch does, so its `savedAt` changes. Tests compare the saved game, not the raw bytes.
- **Archive session.** From the home screen, the replaced company's `run_reset` and `run_evidence` records go to its last session, which Save and exit already closed.

## Risks

- Changing the `newRun` archive guard also archives evidence for any non-started restart path; today only the home screen calls `newRun` while not started in campaign mode.
- `switchMode(..., { start: false })` leaves walk/floor state as `enter` sets it with `started: false` (`walking: false`); `newRun` starts the company without resuming walk mode, which matches a new company.
