import { test } from "./fixtures";
import { guidanceJourney, recoveryJourney, ordinaryRunJourney, incidentAttentionJourney } from "./guidanceRewards";

for (const [width, height] of [[1440, 900], [1366, 768]]) {
  test(`Development B: contextual Run and Confirm at ${width}`, async ({ page }) => { await guidanceJourney(page, width, height); });
  test(`Development B: live recovery and postmortem at ${width}`, async ({ page }) => { await recoveryJourney(page, width, height, width === 1366); });
}
for (const [width, height] of [[1440, 900], [1366, 768]]) {
  test.describe(`Visual attention at ${width}`, () => {
    test(`Spotlight refinement: ordinary idle Run at ${width}`, async ({ page }) => { await ordinaryRunJourney(page, width, height); });
    test(`Spotlight refinement: live incident Pause and Confirm priority at ${width}`, async ({ page }) => {
      // Live clock transitions, repeated quote/sheet checks and compositor captures reached the final
      // passing assertion at 62.5s on software WebGL. Preserve the 10s per-assertion checks.
      test.setTimeout(120_000);
      await incidentAttentionJourney(page, width, height);
    });
  });
}
