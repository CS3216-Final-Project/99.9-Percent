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

test("manual steps advance exact game seconds in management and pause a running clock", async ({ page, installClock }) => {
  await installClock();
  const game = dataCompany(), start = game.campaign!.step;
  await seedSave(page, game);
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  const steps = page.getByRole("group", { name: "Step time" }), second = page.getByTestId("physical-step");
  await steps.getByRole("button", { name: "Step 1 game second" }).click();
  await expect(second).toHaveText(String(start + 1));
  await steps.getByRole("button", { name: "Step 5 game seconds" }).click();
  await expect(second).toHaveText(String(start + 6));
  await page.keyboard.press("n");
  await expect(second).toHaveText(String(start + 7));
  // A step while running pauses first, so the clock stays where the step left it.
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await steps.getByRole("button", { name: "Step 1 game second" }).click();
  await expect(page.getByRole("button", { name: "Run", exact: true })).toBeVisible();
  const after = (await savedGame(page)).campaign!.step;
  await page.clock.runFor(3_000);
  expect((await savedGame(page)).campaign!.step).toBe(after);
});

test("manual steps keep working during an incident", async ({ page, installClock }) => {
  await installClock();
  await seedSave(page, advanceSteps(newGame(1, "step-incident"), 6).state);
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expect(page.getByRole("banner")).toHaveClass(/is-incident/);
  await page.getByRole("group", { name: "Step time" }).getByRole("button", { name: "Step 5 game seconds" }).click();
  await expect(page.getByTestId("physical-step")).toHaveText("11");
  expect((await savedGame(page)).campaign!.step).toBe(11);
});
