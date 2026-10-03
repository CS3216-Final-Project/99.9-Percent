---
name: browser-e2e
description: Add, maintain or debug Playwright browser journeys for the 99.99% frontend, including tutorial, local saves, incident clocks, recovery and mobile interactions. Use for browser test work and browser-only regressions.
---

# Browser journeys

Read `frontend/playwright.config.ts`, `frontend/e2e/fixtures.ts` and `docs/testing.md`. Run from `frontend/`: install Chromium with `npx playwright install chromium`, then `npm run test:e2e`. The suite uses the production build on port 4175 and an isolated browser context for each test.

- Use roles, accessible names and web-first assertions. Scope ambiguous controls to their region or dialog. Avoid arbitrary sleeps, forced clicks and brittle positional selectors.
- Keep the actual WebGL room in browser tests. `expectRoom` checks a live WebGL context and equipment controls; a visible canvas alone is insufficient. Unhandled page errors fail the suite.
- Use `newGame` and engine entry points for advanced-state fixtures, then seed the saved envelope before navigation with `seedSave`. Test subsequent decisions through the visible UI. Do not add production test hooks or call store actions through browser evaluation.
- Install Playwright's clock before navigation. Pause after scene initialization and use `runFor` to deliver all fixed-duration ticks. `fastForward` fires repeated timers only once and is unsuitable for measuring cumulative incident time. Assert pause, resume and the resulting phase.
- Reload to test persistence; preserve the browser's updated save rather than reseeding it. Test malformed data separately.
- Keep desktop journeys and touch smoke checks focused. The mobile project emulates Chromium; it does not establish Safari or Firefox support.

On failure inspect the HTML report, screenshot and trace; reproduce with a focused test. Determine whether the locator, fixture, environment or product is wrong before changing assertions. A retry is diagnostic, not permission to ignore a flaky journey. Rebuild before `test:e2e:ui` when app code changed.
