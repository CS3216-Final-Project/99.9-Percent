import { advanceCampaignStep, chapterComplete, expect, savedGame, seedSave, test } from "./fixtures";
import { dataCompany, finishingScaling } from "../src/sim/__tests__/dataFixture";
import { newGame } from "../src/sim";
import { advanceSteps } from "../src/sim/step";

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

test("speed buttons set the rate and the week rush stops at the boundary", async ({ page, installClock }) => {
  await installClock();
  const game = dataCompany(), start = game.campaign!.step;
  await seedSave(page, game);
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  const speeds = page.getByRole("group", { name: "Game speed" });
  await expect(speeds.getByRole("button", { name: "1×", exact: true })).toHaveAttribute("aria-pressed", "true");
  await speeds.getByRole("button", { name: "2×", exact: true }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await page.clock.runFor(2000);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  expect((await savedGame(page)).campaign!.step).toBeGreaterThan(start + 2);
  // The week rush fast-forwards at 20x and hands the clock back at the boundary.
  await speeds.getByRole("button", { name: /End the week/ }).click();
  await page.clock.runFor(30_000);
  const after = await savedGame(page);
  expect(after.turn).toBeGreaterThan(game.turn);
  await expect(speeds.getByRole("button", { name: /End the week/ })).toHaveAttribute("aria-pressed", "false");
  await expect(speeds.getByRole("button", { name: "2×", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("the week rush returns to normal speed when an incident opens", async ({ page, installClock }) => {
  await installClock();
  await seedSave(page, advanceSteps(newGame(1, "rush-incident"), 6).state);
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  const speeds = page.getByRole("group", { name: "Game speed" });
  await speeds.getByRole("button", { name: /End the week/ }).click();
  await page.clock.runFor(30_000);
  expect((await savedGame(page)).campaign!.incident).toBeTruthy();
  // The rush is off and the picked speed owns the pressed state again.
  await expect(speeds.getByRole("button", { name: /End the week/ })).toHaveAttribute("aria-pressed", "false");
  await expect(speeds.getByRole("button", { name: "1×", exact: true })).toHaveAttribute("aria-pressed", "true");
});
