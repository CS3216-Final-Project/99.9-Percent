import { test, expect, expectRoom, seedClassicSave, unlockChallenge } from "./fixtures";
import { applyAction, newLegacyGame } from "../src/sim";

test.use({ hasTouch: true });

for (const width of [1440, 390]) {
  test(`weekly work stays visible beside the room at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const upgrade = applyAction(newLegacyGame(1), { type: "start_tech", tech: "load_balancing" });
    if (!upgrade.ok) throw new Error(upgrade.message);
    const debt = applyAction(upgrade.state, { type: "start_debt_paydown" });
    if (!debt.ok) throw new Error(debt.message);
    await unlockChallenge(page);
    await seedClassicSave(page, debt.state);
    await page.addInitScript(() => localStorage.setItem("nn.mode.v1", "classic"));
    await page.goto("/");
    await page.getByRole("button", { name: "Continue week 1", exact: true }).tap();
    await expectRoom(page);
    // A 390px touch screen is a phone: the weekly work lives in the System metrics sheet over the room.
    const phone = width === 390;
    const handle = page.getByRole("button", { name: "System metrics", exact: true });
    if (phone) await handle.tap();
    const operations = page.getByRole("complementary", { name: "Operations" });
    await expect(operations).toBeVisible();
    const roomBox = await page.getByRole("main").boundingBox();
    const railBox = await operations.boundingBox();
    expect(roomBox).not.toBeNull();
    expect(railBox).not.toBeNull();
    if (phone) {
      const sheet = (await page.locator(".phone-sheet").boundingBox())!;
      expect(railBox!.y).toBeGreaterThanOrEqual(sheet.y - 1);
      // The half sheet leaves the room at least 40% of the screen.
      expect(sheet.y).toBeGreaterThanOrEqual(page.viewportSize()!.height * 0.4);
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
    if (phone) await handle.tap();
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
    if (phone) {
      // Back to peek: the sheet folds away and the room is whole again.
      await handle.focus();
      await page.keyboard.press("Home");
      await expect(handle).toHaveAttribute("aria-expanded", "false");
      await expect(tracker).toBeHidden();
      await page.screenshot({ path: "test-results/operations-mobile-collapsed.png" });
    }
  });
}
