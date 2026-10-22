import { completeTutorial, test, expect, expectRoom, savedGame, savedClassicGame, seedSave, tutorial, unlockChallenge } from "./fixtures";
import { newGame } from "../src/sim";
import { advanceSteps } from "../src/sim/step";

test("new players see Guided Mode first with Challenge Mode locked", async ({ page }) => {
  await page.goto("/");
  const choices = page.getByRole("region", { name: "Choose how you want to play" });
  const guided = choices.getByRole("region", { name: "Guided Mode" });
  const challenge = choices.getByRole("region", { name: "Challenge Mode" });
  await expect(guided).toContainText("Continuous play · Six guided chapters");
  await expect(challenge).toContainText("50,000 users in 26 weeks");
  await expect(challenge).toContainText("Complete the first five Guided Mode chapters to unlock.");
  await expect(guided.getByRole("button", { name: "Start Guided Mode" })).toBeVisible();
  await expect(challenge.getByRole("button", { name: "Complete Guided Mode to unlock" })).toBeDisabled();
  await page.keyboard.press("p");
  expect(await page.evaluate(() => [localStorage.getItem("nn.campaign.save.v1"), localStorage.getItem("nn.classic.save.v1")])).toEqual([null, null]);
  await page.screenshot({ path: "test-results/mode-choice-guided-first.png" });
  await guided.getByRole("button", { name: "Start Guided Mode" }).press("Enter");
  await expect(tutorial(page)).toBeVisible();
  await completeTutorial(page);
  expect((await savedGame(page)).campaign!.step).toBe(1);
  await expectRoom(page);
});

// The room stays mounted while the game underneath it is swapped, so this journey keeps drawing it.
test("switches between Guided Mode and unlocked Challenge Mode from the menu, keeping each run", async ({ page }) => {
  await seedSave(page, advanceSteps(newGame(1, "mode-switch"), 1).state, { challengeUnlocked: true });
  await page.goto("/"); await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page);
  // This journey tests mode persistence; the public step control advances the same
  // company by one game second without an unrelated animated-clock exercise.
  await page.getByRole("button", { name: "Step 1 game second", exact: true }).click();
  const campaign = await savedGame(page);
  expect(campaign.campaign!.step).toBe(2);

  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: "Switch to Challenge Mode" }).click();
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeHidden();
  // This guide follows the moving camera. Dismiss through its real keyboard
  // control so pointer hit-testing during that motion does not consume the journey budget.
  const skip = page.getByRole("button", { name: "Skip", exact: true });
  await expect(skip).toBeVisible(); await skip.press("Enter");
  await expectRoom(page);
  await page.getByRole("button", { name: /Next week/ }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("nn.classic.save.v1")!).game.turn)).toBe(2);

  // The last mode played is the one that loads next time.
  await page.reload(); await page.getByRole("button", { name: "Continue week 2" }).click();
  await expect(page.getByRole("button", { name: /Next week/ })).toBeVisible();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await menu.getByRole("button", { name: "Switch to Guided Mode" }).scrollIntoViewIfNeeded();
  await menu.getByRole("button", { name: "Switch to Guided Mode" }).click();
  await expectRoom(page);
  expect(await savedGame(page)).toEqual(campaign);
  expect(await page.evaluate(() => localStorage.getItem("nn.mode.v1"))).toBe("campaign");
});

test("the menu offers a disabled unlock instead of a switch while Challenge Mode is locked", async ({ page, withoutRoom }) => {
  await withoutRoom();
  await seedSave(page, newGame(1, "locked-mode"));
  await page.goto("/"); await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu.getByRole("region", { name: "Game mode" })).toContainText("Complete the first five Guided Mode chapters to unlock Challenge Mode.");
  await expect(menu.getByRole("button", { name: "Complete Guided Mode to unlock" })).toBeDisabled();
  await expect(menu.getByRole("button", { name: /Switch to/ })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("nn.classic.save.v1"))).toBeNull();
});

test("asks before switching away from a run that cannot be saved", async ({ page, withoutRoom }) => {
  await withoutRoom();
  await unlockChallenge(page);
  await page.addInitScript(() => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("nn.campaign.save.v1", "{"); } });
  await page.goto("/"); await page.getByRole("button", { name: "Start Guided Mode", exact: true }).click(); await completeTutorial(page);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await menu.getByRole("button", { name: "Switch to Challenge Mode" }).click();
  await expect(menu).toContainText("This run could not be saved");
  await menu.getByRole("button", { name: "Switch and lose this run" }).click();
  await expect(page.getByRole("button", { name: "Skip" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("nn.campaign.save.v1"))).toBe("{");
});

test("the home screen is the same in both modes and can continue or switch either game", async ({ page }) => {
  await seedSave(page, newGame(4, "home-company"));
  await unlockChallenge(page);
  await page.goto("/");
  const choices = page.getByRole("region", { name: "Choose how you want to play" });
  const campaign = choices.getByRole("region", { name: "Guided Mode" }), classic = choices.getByRole("region", { name: "Challenge Mode" });
  await expect(campaign).toContainText("Last played");
  await expect(campaign).toContainText("Chapter 1 of 6: Opening");
  await expect(classic).toContainText("No saved game");
  await page.screenshot({ path: "test-results/home-campaign-in-progress.png" });
  // Halfway through Guided Mode, Challenge Mode is one click away from the home screen.
  await classic.getByRole("button", { name: "Start Challenge Mode" }).click();
  await completeTutorial(page);
  await page.getByRole("button", { name: /Next week/ }).click();
  await page.reload();
  await expect(classic).toContainText("Last played");
  await expect(classic).toContainText("Week 2 of 26");
  await expect(classic.getByRole("button", { name: "New game" })).toBeVisible();
  await expect(campaign).toContainText("Chapter 1 of 6: Opening");
  await page.screenshot({ path: "test-results/home-classic-in-progress.png" });
  // And Guided Mode is one click away from a Challenge Mode home screen.
  await campaign.getByRole("button", { name: "Continue company" }).click();
  await expectRoom(page);
  expect((await savedGame(page)).campaign!.runId).toBe("home-company");
  expect((await savedClassicGame(page)).turn).toBe(2);
  expect(await page.evaluate(() => localStorage.getItem("nn.mode.v1"))).toBe("campaign");
});
