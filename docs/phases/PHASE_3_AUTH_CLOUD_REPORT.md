# Phase 3 account/cloud integration follow-up

> Historical pre-rebase report. The save-compatibility boundary and validation counts below are superseded by [the latest-main integration report](PHASE_3_MAIN_INTEGRATION_REPORT.md): deployed replay saves and Classic are now retained, and cloud transport uses the same schema-3 replay envelope.

Prepared 10 October 2026. Phase 3's missing scaling commit b251dbf is cherry-picked with provenance before the account patch. The active 3D checkout is untouched.

## Result

Core scaling/routing plus optional backend-managed Google OIDC, opaque durable app sessions, reload restoration, sign-out, explicit guest attachment, owner-scoped cloud listing/save/resume and atomic expected-revision conflicts are implemented. The existing engine, clock, store, local snapshot/migration registry and Neon/Express deployment boundaries remain authoritative. No production deployment or database migration has been performed.

The frontend account proxy has a server-only, explicitly configured HTTPS destination. It forwards only account endpoints and required headers, preserving separate cookies/redirects and no-store headers. The direct health transport/CORS contracts remain intact. Missing configuration or network/session failure leaves guest gameplay/local storage available.

The new generated additive migration creates game_accounts, game_sessions, game_auth_attempts and game_runs, preserving all existing tables/migrations. Account identity is issuer+subject; attempts are bound to HttpOnly browser cookies and deleted atomically; code exchange checks state, nonce, PKCE and ID-token signature/issuer/audience/expiry through openid-client. Sessions expire/revoke server-side. Private writes require Origin and CSRF. Each run read/update is owner-filtered; revisions update atomically without a Neon interactive transaction. Cross-owner collisions disclose no snapshot.

## Save compatibility and ownership

Cloud transport supports the existing Phase 3/4 snapshot envelopes. Full simulation validation occurs in the compatible frontend before loading. The newer Phase 1 branch's schema-1 input-log format is a different contract: source bytes remain intact/exportable, migration refuses it before writing a backup, and cloud snapshot ingestion rejects it. Replay saves and Classic mode are not merged into this branch or silently reinterpreted. This boundary avoids changing the accepted scaling/data engine while adding persistence services.

Owner bindings and pending snapshots persist separately from gameplay, survive sign-out and block reassignment on account switches. New companies remain guests until explicitly attached. Cloud load preserves original stored bytes, current pending state and old owner copy before replacement. Conflict overwrite is explicit and revision-conditional, with both versions archived. Failed/quota-limited retention refuses destructive transitions and offers export; local storage failure cannot guarantee durability. Save retries are manual; no background upload, central analytics or extra telemetry store was introduced.

## Validation

Node v22.20.0. The managed checkout's percent-sign path reproduces the existing Vitest URI malformed error, so validation uses a source copy in a clean temporary path with identical lockfiles. npm ci ran separately in both packages. Node's system certificate trust store was used for installation; TLS verification stayed enabled.

- Backend lint/typecheck/coverage: PASS, 34 tests. Real committed migrations execute on isolated PGlite; tests cover uniqueness/FKs/revisions, two owners, concurrent insert/update, expired/revoked sessions, Origin/CSRF, browser-bound/expired/replayed callbacks, cancellation and provider rejection.
- Migration generation: PASS; rerunning creates no additional migration.
- Frontend lint: PASS with the 23 existing warnings and no new warnings. Typecheck/build: PASS.
- Frontend coverage: PASS, 181 tests and the existing optional TRACE skip, using one worker to avoid CPU starvation. Cases cover explicit attachment, account switching, offline/expiry retries, conflicts, quota/corruption, paused resume, replay-source protection, in-flight new-company races and proxy cookie/header handling.
- Full Chromium desktop/touch browser suite: PASS, 15 tests, no failures or flaky retries. Includes explicit attachment/conflict/account-switch/cloud-resume, cancelled sign-in, offline account controls, opening/scaling, paused reload and local recovery. Desktop and mobile account screenshots were visually reviewed.
- Dedicated balance suite: PASS, 5 tests.
- Final diff whitespace check: PASS. Browser tests can use PLAYWRIGHT_PORT to avoid colliding with another active checkout; the default stays 4175.

Earlier failures were fixed: a proxy absolute-path validation bug, UTF-8 handling in editing scripts, and migration rejection of a custom test-only schema-0 fixture. A CPU-starved legacy balance test passed with a single worker without changing test timeouts or simulation. Temporary lint initially scanned generated bundles because the copy lacked the root ignore file; copying the existing ignore rules restored the normal 23-warning result.

## Outstanding external acceptance

Google web-client/consent/test-audience/callback registration, deployment environment configuration, actual Neon HTTP connectivity and live two-account/cookie/cache/cross-session checks are NOT TESTED. No production migration/deployment, participant contact or human playtesting was performed. VITE_PLAYTEST_URL, recorded VITE_BUILD_ID and human evidence remain release inputs. Full Phase 3 release completion is not claimed until these checks pass.
