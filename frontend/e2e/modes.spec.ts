import { test, expect, expectRoom, savedGame } from "./fixtures";

// The room stays mounted while the game underneath it is swapped, so this journey keeps drawing it.
test("switches between campaign and classic from the menu, keeping each run", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Play", exact: true }).click();
  await expectRoom(page);
  await page.getByRole("button", { name: "Advance step", exact: true }).click();
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
  await page.goto("/"); await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await menu.getByRole("button", { name: "Switch to Classic" }).click();
  await expect(menu).toContainText("This run could not be saved");
  await menu.getByRole("button", { name: "Switch and lose this run" }).click();
  await expect(page.getByRole("button", { name: "Skip" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("nn.campaign.save.v1"))).toBe("{");
});
