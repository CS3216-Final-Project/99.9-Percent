# Player feedback

User-requested follow-up to PR #28, 11 October 2026.

## Behavior

Give feedback replaces Join Playtest on the first-visit mode chooser and returning Campaign title. It is also available on the Classic title and in Menu → Playtest in both modes. Title screens use the shared modal; menus open the form inline to preserve one dialog/focus boundary.

Feedback requires no account. Players explicitly submit 1–2000 trimmed characters. The backend stores only a random submission ID, the message, current mode and a server timestamp in game_feedback. There is no public feedback read endpoint. Save data, local analytics, email addresses and account credentials are not sent.

Success is shown only after a confirmed database write. A failed request retains the text for retry; the unchanged draft reuses its submission ID so a lost response does not produce duplicate rows. Pending sends disable duplicate submission; closing/unmounting aborts the request. A request times out after 15 seconds. Drafts survive closing/reopening the same mounted component but are not persisted across a reload or screen/tab change.

## API and migration

POST /api/feedback accepts { id, message, mode }. The ID must be a UUID v4 and mode is campaign or classic. New feedback returns 201 with { id }; an identical retry returns 200, conflicting ID reuse returns 409, invalid input returns 400, and unavailable storage returns 503.

The frontend reuses VITE_API_URL and the backend's existing CORS_ORIGINS policy, without account cookies or the account proxy. Production requires those existing API/CORS values and DATABASE_URL. No provider or deployment settings are changed.

Drizzle generated backend/drizzle/0002_fearless_exodus.sql together with its snapshot and journal entry. It adds game_feedback with a UUID primary key, required message/mode, creation timestamp and message-length/mode constraints. Existing migrations and tables are unchanged. The existing CD workflow runs npm run db:migrate on main after merge; no live migration was run manually. During the deploy/migration overlap, failed writes show the retry message instead of claiming success.

The original signup CTA requirement is superseded by the user's feedback request. This does not demonstrate historical signups or replace the required human playtest evidence.

## Verification status

Checks are intentionally skipped at the user's request. No lint, typecheck, test suite, browser suite, build, or CI result is claimed for this feedback commit.

Authored but unexecuted regression cases cover persisted guest submissions, database defaults/constraints, invalid input, unavailable storage, retry deduplication/conflicts, existing production/preview CORS, explicit UI submission without advancing gameplay, retained failed text, unmount cancellation, and durable response confirmation. The migration generator ran successfully as an implementation step; it did not connect to or apply changes to a live database.

Live Neon connectivity, deployed browser submissions and human feedback collection remain unverified.
