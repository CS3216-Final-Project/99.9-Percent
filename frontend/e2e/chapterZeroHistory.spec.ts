import { test, expect, expectRoom, seedSave } from "./fixtures";
import { newGame } from "../src/sim";

// History left Chapter 0: the sheet introduces its own tabs the first time a player opens it.
for (const [width, height] of [[1440, 900], [390, 844], [320, 568]]) {
  test(`History introduces its tabs within the sheet at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/**", route => route.abort());
    await seedSave(page, newGame(1, "history-intro"));
    await page.goto("/");
    await page.getByRole("button", { name: "Continue company", exact: true }).click();
    await expectRoom(page);
    await page.getByRole("button", { name: "History", exact: true }).click();
    const history = page.getByRole("region", { name: "History", exact: true });
    await expect(history).toContainText("Charts show trends, Events list your decisions and Incidents hold the reports.");
    await page.screenshot({ path: `test-results/history-intro-${width}x${height}.png` });
    await history.getByRole("button", { name: "Close", exact: true }).click();
    await expect(history).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
