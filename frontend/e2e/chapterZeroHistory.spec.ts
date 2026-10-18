import { test, expect, expectRoom, seedSave, tutorial } from "./fixtures";
import { newGame } from "../src/sim";

for (const [width, height] of [[1440, 900], [390, 844], [320, 568], [844, 390]]) {
  test(`Chapter 0 lesson 15 keeps chart icons and legends within the guide at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/**", route => route.abort());
    await seedSave(page, newGame(1, "history-formatting"), { tutorialDone: false, walkthroughStep: 14, walkthroughFurthestStep: 14 });
    await page.goto("/");
    await page.getByRole("button", { name: "Continue company", exact: true }).click();
    await expectRoom(page);
    const card = tutorial(page);
    await expect(card).toHaveAccessibleName("Walkthrough, step 15 of 21");
    const example = card.locator(".lesson-history-example");
    await expect(example.locator(".icon")).toHaveCount(4);
    const sizes = await example.locator(".icon").evaluateAll(icons => icons.map(icon => ({ width: icon.getBoundingClientRect().width, height: icon.getBoundingClientRect().height })));
    for (const size of sizes) {
      expect(size.width).toBeGreaterThanOrEqual(20);
      expect(size.width).toBeLessThanOrEqual(24);
      expect(size.height).toBe(size.width);
    }
    const chart = card.getByRole("img", { name: "Example traffic chart: demand rises over game seconds while capacity stays flat" });
    const chartBox = (await chart.boundingBox())!;
    expect(chartBox.width).toBeGreaterThan(100);
    expect(chartBox.height / chartBox.width).toBeCloseTo(150 / 560, 2);
    expect(await card.locator(".lesson-reading").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await example.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/chapter-zero-history-${width}x${height}.png` });
    await page.getByRole("button", { name: "History", exact: true }).click();
    const history = page.getByRole("region", { name: "History", exact: true });
    await expect(history).toBeVisible();
    await history.getByRole("button", { name: "Close", exact: true }).click();
    await expect(card.getByRole("button", { name: "Next", exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
