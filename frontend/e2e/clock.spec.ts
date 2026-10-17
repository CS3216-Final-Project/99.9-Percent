import { advanceCampaignStep, chapterComplete, expect, savedGame, seedSave, test } from "./fixtures";
import { finishingScaling } from "../src/sim/__tests__/dataFixture";

// These checks exercise the clock and chapter dialog, without scene interactions.
test.beforeEach(async ({ withoutRoom }) => { await withoutRoom(); });

test("clock batch continues after chapter acknowledgement and finishes paused", async ({ page, installClock }) => {
  await installClock();
  const game = finishingScaling();
  await seedSave(page, game);
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();

  // The chapter completes on the first of these three seconds.
  await advanceCampaignStep(page, { seconds: 3, resumeClock: false });
  await expect(chapterComplete(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Run", exact: true })).toBeVisible();
  expect((await savedGame(page)).campaign!.step).toBe(game.campaign!.step + 3);
  expect((await savedGame(page)).campaign!.dataStage).toBeNull();
  await page.clock.runFor(2_000);
  expect((await savedGame(page)).campaign!.step).toBe(game.campaign!.step + 3);
});

test("staying in a completed chapter leaves the player's clock paused", async ({ page, installClock }) => {
  await installClock();
  await page.removeLocatorHandler(chapterComplete(page));
  const game = finishingScaling();
  await seedSave(page, game);
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();

  await advanceCampaignStep(page, { resumeClock: false });
  const dialog = chapterComplete(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Stay in this chapter", exact: true }).click();
  await expect(page.getByRole("button", { name: "Run", exact: true })).toBeVisible();
  await page.clock.runFor(2_000);
  expect((await savedGame(page)).campaign!.step).toBe(game.campaign!.step + 1);
});
