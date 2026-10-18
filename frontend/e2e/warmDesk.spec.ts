import { test, expect, expectRoom, seedSave, openRoomControls } from "./fixtures";
import { newGame } from "../src/sim";

for (const width of [1440, 390, 320]) test(`Warm Desk navigation and selected icons remain clear at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await seedSave(page, newGame(1, "warm-desk"));
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page);
  const dock = page.locator(".controls-dock");
  await expect(dock.getByRole("group", { name: "Navigation", exact: true })).toBeVisible();
  for (const selector of ['.stat-cash', '.stat-users', '[aria-label="View app health"]']) {
    await expect(page.locator(selector).locator('.stat-icon .icon')).toBeVisible();
    const stat = page.locator(selector);
    const icon = (await stat.locator('.stat-icon').boundingBox())!;
    const value = (await stat.locator('.stat-body > strong').boundingBox())!;
    expect(icon.x + icon.width).toBeLessThanOrEqual(value.x);
  }
  const mode = width > 640 ? dock.locator(".view-mode-menu") : dock.locator(".room-menu");
  const trigger = mode.locator(":scope > summary");
  await trigger.click();
  const before = (await trigger.boundingBox())!;
  await mode.getByRole("button", { name: "Walk mode", exact: true }).click();
  await expect(mode.locator(".dock-panel")).toBeHidden();
  await expect(page.locator(".stage-canvas")).toBeFocused();
  const after = (await trigger.boundingBox())!;
  expect([after.width, after.height]).toEqual([before.width, before.height]);
  await trigger.click();
  await expect(mode.getByRole("button", { name: "Walk mode", exact: true })).toHaveAttribute("aria-pressed", "true");
  await mode.getByRole("button", { name: "Overview", exact: true }).click();
  await openRoomControls(page);
  const floorTrigger = dock.locator(".room-menu > summary");
  await expect(floorTrigger).toContainText(width > 640 ? "Floor" : "Navigation");
  await page.keyboard.press("Escape");
  const tech = dock.getByRole("button", { name: "Tech", exact: true });
  await tech.click();
  await expect(tech).toHaveAttribute("aria-pressed", "true");
  expect(await tech.evaluate(el => getComputedStyle(el).backgroundColor !== getComputedStyle(el.querySelector('.tab-icon')!).backgroundColor)).toBe(true);
  await page.getByRole("region", { name: "Tech tree" }).getByRole("button", { name: "Close", exact: true }).click();
  const run = dock.getByRole("button", { name: "Run", exact: true });
  const runBox = (await run.boundingBox())!;
  await run.click();
  const pause = dock.getByRole("button", { name: "Pause", exact: true });
  const pauseBox = (await pause.boundingBox())!;
  expect([pauseBox.width, pauseBox.height]).toEqual([runBox.width, runBox.height]);
  await pause.click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({ path: `test-results/warm-desk-${width}.png` });
});
