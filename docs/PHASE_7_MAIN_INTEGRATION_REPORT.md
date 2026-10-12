# Phase 7 and Campaign UX integration with main

Integration reviewed on 12 October 2026 (Asia/Singapore).

## Branch and recovery

The integration branch is `ai/phase-7-ux-main-integration`, based on fetched main
`22a5bdc08bf6dc9a19fb2a4a5492e38b96170cbb`. Work takes place in
`C:/Users/user/99.9-Percent/.worktrees/phase7`.

The original `ai/phase-7-ux-integration` workspace remains intact, including its
pending cherry-pick of `ad89e0c`, unresolved index entries, unstaged files and
untracked UX assets. File hashes, index bytes and CHERRY_PICK_HEAD were compared
with the recovery backup and match. Existing stashes remain untouched.

Recovery material is in
`C:/Users/user/AppData/Local/Temp/99-99-phase7-backup-20261012-221724`:
changed/untracked files with a SHA-256 manifest, the original index and
cherry-pick metadata, refs/status, and a repository bundle. The committed
working-file snapshot is retained on `ai/phase-7-ux-recovery-snapshot`.

## Result and preserved main updates

The same company continues from Reliability into Grow the Company, with seeded
combined growth challenges, explicit outcome reviews, completion and scorecards.
The Campaign presentation adds interactive skippable onboarding, App Server
terminology, visible action effects and cost disclosures, prominent Run/Pause,
optional precision stepping, explicit Pause & inspect and shorter reports.

Main's home screen, email/Google sign-in and account link, public stats,
Vercel account routes, backend feedback fix, and removed mode-preview behavior
are retained. Main's shared Tech/History sheets, history tabs, technology detail,
menu run card, Resume, tiles, and two-press reset confirmation are retained.
The interactive introduction uses main's concept icon, progress dots and modal
footer; all three original overview paragraphs remain in disclosures.

Conflict resolution adapted the new features to main's shared layout rather
than replacing it with the older layout. The new tests use main's Tech tab,
Tech tree region and existing reset-confirmation button. Chapter assertions
reflect the added sixth chapter. The shared sheet type and Classic guard only
exclude the two newly added Campaign view values; existing Classic views retain
their behavior.

No main files are deleted. Backend, migrations, CI/deployment configuration,
dependency manifests/locks, account UI, home-screen implementation, shared
MenuRun/TechTree/Views implementations, global CSS and renderer files match the
main baseline. The shared campaign contract adds optional prospective service
coverage metadata; existing account/cloud routes remain unchanged and their
regressions are included in validation.

Shared room-animation changes remain deferred. No renderer patch is included.

## Validation

Commands use checksum-verified Node 22.23.3. Both packages were installed
separately with `npm ci` in the integration worktree.

- Backend lint, typecheck and coverage: passed, 61 tests.
- Migration consistency: `npm run db:generate` produced no changes.
- Frontend build: passed.
- Balance: passed, 25 cases.
- Frontend lint and typecheck: passed.
- Final frontend coverage: passed, 759 tests and one optional TRACE skip.
- Final UI recheck after preserving main's introduction wording: 33 tests passed.
- Full production-build browser suite: all 74 journeys passed in one final run,
  with retries disabled (13.8 minutes), including Classic, Campaign, accounts,
  desktop and mobile.
- GitHub CI on code integration commit `0f4643e`: both required gates,
  `frontend` and `backend`, passed, including all three browser shards. See
  [PR #51](https://github.com/CS3216-Final-Project/99.9-Percent/pull/51) for checks
  on the final documentation commit and the current review state.
- Whitespace checks: passed. Integration worktree is clean after committing.

The first frontend coverage run passed 757 tests and failed two home-screen
assertions expecting five chapters. Those assertions were updated to six without
changing the home-screen implementation. The first full browser run passed 68
journeys and failed six checks using outdated copy/selectors: reset confirmation,
cache-evidence disclosure, home-screen chapter count, introduction prompt text,
collapsed precision controls and the mobile evidence term. These were corrected
without removing assertions or increasing timeouts; main's prompt wording was
retained in the interactive introduction. The rebuilt final run passed all 74.
Initial failure screenshots/traces are preserved in the recovery backup.
Generated logs, coverage, screenshots and browser artifacts are ignored and
excluded from the PR. Desktop introduction/overview and mobile controls were
also inspected visually.

## Review boundaries

Existing PR #31 contains the earlier Phase 7 mechanics. This separate integration
PR includes those mechanics together with the local UX refinements and latest
main integration. PR #31 is not edited or closed by this work; reviewers should
account for the overlapping Phase 7 scope when choosing what to merge.

Human usability retesting, real-device/screen-reader acceptance and real-provider
deployment acceptance remain outstanding. No production migration, merge or
deployment is authorized or performed by this integration.
