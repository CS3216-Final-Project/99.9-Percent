import { test, expect, expectRoom, seedClassicSave } from "./fixtures";
import { applyAction, newLegacyGame } from "../src/sim";

test.use({ hasTouch: true });

for (const width of [1440, 390]) {
  test(`weekly work stays visible beside the room at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const upgrade = applyAction(newLegacyGame(1), { type: "start_tech", tech: "load_balancing" });
    if (!upgrade.ok) throw new Error(upgrade.message);
    const debt = applyAction(upgrade.state, { type: "start_debt_paydown" });
    if (!debt.ok) throw new Error(debt.message);
    await seedClassicSave(page, debt.state);
    await page.addInitScript(() => localStorage.setItem("nn.mode.v1", "classic"));
    await page.goto("/");
    await page.getByRole("button", { name: "Continue week 1", exact: true }).tap();
    await expectRoom(page);
    const operations = page.getByRole("complementary", { name: "Operations" });
    const roomBox = await page.getByRole("main").boundingBox();
    const railBox = await operations.boundingBox();
    expect(roomBox).not.toBeNull();
    expect(railBox).not.toBeNull();
    if (width === 390) {
      expect(railBox!.y).toBeGreaterThanOrEqual(roomBox!.y + roomBox!.height - 1);
      await operations.getByRole("button", { name: /Operations/ }).tap();
      const expandedRoom = await page.getByRole("main").boundingBox();
      const expandedRail = await operations.boundingBox();
      expect(expandedRail!.y).toBeGreaterThanOrEqual(expandedRoom!.y + expandedRoom!.height - 1);
      expect(expandedRoom!.height).toBeGreaterThan(300);
    } else {
      expect(railBox!.x).toBe(0);
      expect(roomBox!.x).toBeGreaterThanOrEqual(railBox!.x + railBox!.width);
    }
    await expect(operations.getByRole("region", { name: "Next move" })).toBeVisible();
    await expect(operations.getByRole("region", { name: "Warnings" })).toBeVisible();
    await expect(page.locator(".hud")).toHaveCount(0);
    const tracker = page.getByRole("region", { name: "In progress" });
    await expect(tracker).toContainText("Scale Out + Load Balancing");
    await expect(tracker).toContainText("2 wk left");
    await expect(tracker).toContainText("Pay down technical debt");
    await expect(tracker).toContainText("3 wk left");
    await tracker.getByRole("button", { name: /Scale Out.*Open Team/ }).tap();
    await expect(page.getByRole("region", { name: "Team", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).tap();
    await page.getByRole("button", { name: "Next week", exact: true }).tap();
    await expect(tracker).toContainText("1 wk left");
    await page.reload();
    await page.getByRole("button", { name: "Continue week 2", exact: true }).tap();
    if (width === 390) await operations.getByRole("button", { name: /Operations/ }).tap();
    await expect(tracker).toContainText("1 wk left");
    await page.getByRole("button", { name: "Next week", exact: true }).tap();
    await expect(tracker).toContainText("Ready to ship");
    const heading = tracker.getByRole("button", { name: /In progress/ });
    await heading.tap();
    await expect(heading).toHaveAttribute("aria-expanded", "false");
    await expect(tracker.getByText("Ready to ship")).toBeHidden();
    await heading.tap();
    await expect(tracker.getByText("Ready to ship")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/work-tracker-${width}.png` });
    if (width === 390) {
      await operations.getByRole("button", { name: /Operations/ }).tap();
      await expect(tracker).toBeHidden();
      await expect(operations).toContainText("2 tasks");
      // Wait for WebGL's ResizeObserver to follow the restored room height.
      await expect.poll(() => page.locator("canvas").evaluate((element) => {
        const canvas = element as HTMLCanvasElement;
        const box = canvas.getBoundingClientRect();
        return Math.abs(canvas.width / canvas.height - box.width / box.height);
      })).toBeLessThan(0.02);
      await page.screenshot({ path: "test-results/operations-mobile-collapsed.png" });
    }
  });
}
