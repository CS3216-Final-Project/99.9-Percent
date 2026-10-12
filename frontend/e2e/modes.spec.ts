import { advanceCampaignStep, test, expect, expectRoom, savedGame, savedClassicGame, seedSave } from "./fixtures";
import { newGame } from "../src/sim";

for (const mode of ["Campaign", "Classic"] as const) {
  test(`new players can choose ${mode} directly from the title`, async ({ page }) => {
    await page.goto("/");
    const choices = page.getByRole("region", { name: "Choose how you want to play" });
    await expect(choices.getByRole("region", { name: "Campaign" })).toContainText("Continuous play");
    await expect(choices.getByRole("region", { name: "Classic" })).toContainText("50,000 users in 26 weeks");
    for (const name of ["Play Campaign", "Play Classic"]) await expect(choices.getByRole("button", { name })).toBeVisible();
    await page.keyboard.press("p");
    expect(await page.evaluate(() => [localStorage.getItem("nn.campaign.save.v1"), localStorage.getItem("nn.classic.save.v1")])).toEqual([null, null]);
    await page.screenshot({ path: `test-results/mode-choice-${mode.toLowerCase()}.png` });
    await choices.getByRole("button", { name: `Play ${mode}` }).press("Enter");
    if (mode === "Campaign") {
      await expect(page.getByRole("dialog", { name: "Company introduction" })).toBeVisible();
      await page.getByRole("button", { name: "Skip introduction" }).click();
      expect((await savedGame(page)).campaign!.step).toBe(0);
    } else {
      await expect(page.getByRole("button", { name: "Skip", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Skip", exact: true }).click();
      await expect(page.getByRole("button", { name: /Next week/ })).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem("nn.campaign.save.v1"))).toBeNull();
    }
    await expectRoom(page);
  });
}

// The room stays mounted while the game underneath it is swapped, so this journey keeps drawing it.
test("switches between campaign and classic from the menu, keeping each run", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Play Campaign", exact: true }).click(); await page.getByRole("button",{name:"Skip introduction"}).click();
  await expectRoom(page);
  await advanceCampaignStep(page);
  const campaign = await savedGame(page);
  expect(campaign.campaign!.step).toBe(1);

  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: "Switch to Classic" }).click();
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeHidden();
  await page.getByRole("button", { name: "Skip" }).click();
  await expectRoom(page);
  await page.getByRole("button", { name: /Next week/ }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("nn.classic.save.v1")!).game.turn)).toBe(2);

  // The last mode played is the one that loads next time.
  await page.reload(); await page.getByRole("button", { name: "Continue week 2" }).click();
  await expect(page.getByRole("button", { name: /Next week/ })).toBeVisible();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await menu.getByRole("button", { name: "Switch to Campaign" }).scrollIntoViewIfNeeded();
  await menu.getByRole("button", { name: "Switch to Campaign" }).click();
  await expectRoom(page);
  expect(await savedGame(page)).toEqual(campaign);
  expect(await page.evaluate(() => localStorage.getItem("nn.mode.v1"))).toBe("campaign");
});

test("asks before switching away from a run that cannot be saved", async ({ page, withoutRoom }) => {
  await withoutRoom();
  await page.addInitScript(() => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("nn.campaign.save.v1", "{"); } });
  await page.goto("/"); await page.getByRole("button", { name: "Play Campaign", exact: true }).click(); await page.getByRole("button",{name:"Skip introduction"}).click();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await menu.getByRole("button", { name: "Switch to Classic" }).click();
  await expect(menu).toContainText("This run could not be saved");
  await menu.getByRole("button", { name: "Switch and lose this run" }).click();
  await expect(page.getByRole("button", { name: "Skip" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("nn.campaign.save.v1"))).toBe("{");
});

test("the home screen is the same in both modes and can continue or switch either game", async ({ page }) => {
  await seedSave(page, newGame(4, "home-company"));
  await page.goto("/");
  const choices = page.getByRole("region", { name: "Choose how you want to play" });
  const campaign = choices.getByRole("region", { name: "Campaign" }), classic = choices.getByRole("region", { name: "Classic" });
  await expect(campaign).toContainText("Last played");
  await expect(campaign).toContainText("Chapter 1 of 6: Opening");
  await expect(classic).toContainText("No saved game");
  await page.screenshot({ path: "test-results/home-campaign-in-progress.png" });
  // Halfway through a Campaign, Classic is one click away from the home screen.
  await classic.getByRole("button", { name: "Play Classic" }).click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.getByRole("button", { name: /Next week/ }).click();
  await page.reload();
  await expect(classic).toContainText("Last played");
  await expect(classic).toContainText("Week 2 of 26");
  await expect(classic.getByRole("button", { name: "New game" })).toBeVisible();
  await expect(campaign).toContainText("Chapter 1 of 6: Opening");
  await page.screenshot({ path: "test-results/home-classic-in-progress.png" });
  // And the Campaign is one click away from a Classic home screen.
  await campaign.getByRole("button", { name: "Continue company" }).click();
  await expectRoom(page);
  expect((await savedGame(page)).campaign!.runId).toBe("home-company");
  expect((await savedClassicGame(page)).turn).toBe(2);
  expect(await page.evaluate(() => localStorage.getItem("nn.mode.v1"))).toBe("campaign");
});
