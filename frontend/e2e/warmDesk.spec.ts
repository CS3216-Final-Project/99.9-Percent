import { test, expect, expectRoom, seedSave, openRoomControls } from "./fixtures";
import type { Locator, Page } from "@playwright/test";
import { newGame } from "../src/sim";

async function expectFlatPress(page: Page, control: Locator) {
  const before = (await control.boundingBox())!;
  await control.hover();
  await expect(control).toHaveCSS("box-shadow", "none");
  await page.mouse.down();
  try {
    await expect(control).toHaveCSS("box-shadow", "none");
    expect(await control.boundingBox()).toEqual(before);
  } finally {
    // Release outside the control so inspecting its press does not activate it.
    await page.mouse.move(0, 0);
    await page.mouse.up();
  }
}

for (const width of [1440, 390, 320]) test(`Warm Desk navigation and selected icons remain clear at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await seedSave(page, newGame(1, "warm-desk"));
  await page.goto("/");
  await expectFlatPress(page, page.getByRole("button", { name: "Continue company", exact: true }));
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
  await expectFlatPress(page, trigger);
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
  await expectFlatPress(page, tech);
  await tech.click();
  await expect(tech).toHaveAttribute("aria-pressed", "true");
  expect(await tech.evaluate(el => getComputedStyle(el).backgroundColor !== getComputedStyle(el.querySelector('.tab-icon')!).backgroundColor)).toBe(true);
  await page.getByRole("region", { name: "Tech tree" }).getByRole("button", { name: "Close", exact: true }).click();
  const run = dock.getByRole("button", { name: "Run", exact: true });
  const runBox = (await run.boundingBox())!;
  await expectFlatPress(page, run);
  await run.click();
  const pause = dock.getByRole("button", { name: "Pause", exact: true });
  const pauseBox = (await pause.boundingBox())!;
  expect([pauseBox.width, pauseBox.height]).toEqual([runBox.width, runBox.height]);
  await pause.click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Menu", exact: true });
  await expectFlatPress(page, menu.getByRole("button", { name: "Resume", exact: true }));
  await menu.getByRole("tab", { name: "Sound", exact: true }).click();
  await expectFlatPress(page, menu.getByRole("tab", { name: "Sound", exact: true }));
  await menu.getByRole("button", { name: "Close", exact: true }).click();
  await page.screenshot({ path: `test-results/warm-desk-${width}.png` });
});

for (const width of [1440, 390, 320]) test(`Warm Classic header and inset views fit at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await seedSave(page, newGame(1, "warm-header-sheets"));
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page);
  const dock = page.locator(".controls-dock");
  for (const [label, title] of [["Tech", "Tech tree"], ["History", "History"]]) {
    await dock.getByRole("button", { name: label, exact: true }).click();
    const sheet = page.getByRole("region", { name: title, exact: true });
    await expect(sheet).toBeVisible();
    const bounds = (await sheet.boundingBox())!;
    const stage = (await page.getByRole("main").boundingBox())!;
    const left = width > 900 ? stage.x : 0;
    const right = width > 900 ? stage.x + stage.width : width;
    const top = width > 900 ? stage.y : 0;
    const bottom = width > 900 ? stage.y + stage.height : 900;
    expect(bounds.x - left).toBeGreaterThanOrEqual(8);
    expect(right - bounds.x - bounds.width).toBeGreaterThanOrEqual(8);
    expect(bounds.y - top).toBeGreaterThanOrEqual(8);
    expect(bottom - bounds.y - bounds.height).toBeGreaterThanOrEqual(8);
    if (label === "History") {
      expect(await sheet.locator(".history").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      for (const name of ["Events", "Incidents (0)", "Charts"]) {
        const tab = sheet.getByRole("tab", { name, exact: true });
        await expect(tab).toBeInViewport({ ratio: 1 });
        await tab.click();
        await expect(tab).toHaveAttribute("aria-selected", "true");
      }
    }
    const close = sheet.getByRole("button", { name: "Close", exact: true });
    await expect(close).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `test-results/warm-desk-${label.toLowerCase()}-${width}.png` });
    await close.click();
    await expect(sheet).toBeHidden();
  }
  // The headline readouts remain contained, and both interactive metrics still open their evidence.
  for (const name of ["View finances", "View app health"]) {
    const entry = page.getByRole("button", { name, exact: true });
    await entry.click();
    const evidence = page.getByRole("dialog");
    await expect(evidence).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(evidence).toBeHidden();
  }
  for (const stat of await page.locator(".topbar .stat").all()) {
    expect(await stat.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  await page.screenshot({ path: `test-results/warm-classic-header-${width}.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});
