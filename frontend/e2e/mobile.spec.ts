import { test, expect, expectRoom, savedGame } from "./fixtures";
test("inspects evidence and advances a physical step on touch", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Play", exact: true }).tap();
  await expectRoom(page);
  const music = page.getByRole("button", { name: "Music", exact: true });
  await music.tap(); await expect(music).toHaveAttribute("aria-pressed", "false");
  await page.screenshot({ path: "test-results/phase1-mobile.png" });
  await page.getByRole("button", { name: "Inspect metrics · free" }).tap();
  await page.getByRole("button", { name: "Advance step" }).tap();
  expect((await savedGame(page)).campaign!.step).toBe(1);
  await page.getByRole("button", { name: "History", exact: true }).tap();
  await expect(page.getByRole("dialog", { name: "Campaign history" })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).tap();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});
