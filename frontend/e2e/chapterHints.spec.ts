import { test } from "./fixtures";
import { chapterHintJourney, recoveryVerificationJourney } from "./chapterHints";

for (const [width, height] of [[1440, 900], [1366, 768]]) {
  test(`Final B: Chapter 6 hints at ${width}`, async ({ page }) => { await chapterHintJourney(page, width, height); });
  test(`Final B: recovery verification at ${width}`, async ({ page }) => { await recoveryVerificationJourney(page, width, height); });
}
