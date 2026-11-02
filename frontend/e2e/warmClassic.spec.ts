import { inspectEquipment, closeInspection } from "./componentInspection";
import { test, expect, expectRoom, seedSave, savedGame } from "./fixtures";
import { newGame } from "../src/sim";

for (const width of [1440, 390, 320]) test(`Warm Classic equipment workspace and all menu tabs at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await seedSave(page, newGame(1, "warm-classic-review"));
  await page.goto("/");
  await expect(page.getByText("A system design tycoon", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/^Guided Mode comes first:/)).toHaveCount(0);
  await page.screenshot({ path: `test-results/warm-classic-home-${width}.png` });
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page);
  const panel = page.getByRole("complementary", { name: "System metrics" });
  await expect(panel).toBeVisible();
  expect(await page.getByLabel("Current objective", { exact: true }).evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  await expect(panel.getByRole("heading", { name: "System overview" })).toHaveCount(0);
  await page.screenshot({ path: `test-results/warm-classic-overview-${width}.png` });
  const heading = panel.getByRole("heading", { name: "Inspect equipment", exact: true });
  await expect(heading.locator(".tip")).toHaveCount(0);
  const before = (await savedGame(page)).campaign!.step;
  for (const [component,name,title] of [["gateway","Network", "Network"], ["app","App Server", "Servers"], ["db","Database", "Database"], ["monitoring","Monitoring", "Monitoring"]] as const) {
    const popup=await inspectEquipment(page,component,true);
    const readings = popup.getByRole("region", { name: `${title} readings` });
    await expect(readings.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(readings.getByText("Live", { exact: true })).toBeVisible();
    await expect(readings.locator("h3 .icon")).toBeVisible();
    await expect(readings).not.toContainText("Latest measurement:");
    await expect(readings).not.toContainText("Busy is the share of capacity doing work.");
    await closeInspection(page);await expect(readings).toHaveCount(0);
    await expect(panel.getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true");
    await inspectEquipment(page,component,true);await expect(readings).toBeVisible();await closeInspection(page);
  }
  expect((await savedGame(page)).campaign!.step).toBe(before);
  await panel.evaluate(el => { el.scrollTop = 0; });
  await page.screenshot({ path: `test-results/warm-classic-game-${width}.png` });
  await page.getByRole("button", { name: "Hide equipment and actions", exact: true }).click();
  await expect(panel).toBeHidden();
  const reopen = page.getByRole("button", { name: "Equipment & actions", exact: true });
  await expect(reopen).toBeFocused();
  await page.screenshot({ path: `test-results/warm-classic-collapsed-${width}.png` });
  await reopen.click();
  await expect(panel).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide equipment and actions", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Hide equipment and actions", exact: true }).click();
  // A machine's dialog holds its readings, so inspecting it from the room leaves the collapsed workspace collapsed.
  await page.getByRole("main").getByRole("button", { name: "Monitoring", exact: true }).click();
  await page.getByRole("dialog", { name: "Monitoring", exact: true }).getByRole("button", { name: "Close" }).click();
  await expect(panel).toBeHidden();
  await reopen.click();
  await expect(panel).toBeVisible();
  await expect(page.locator(".dock-second")).toContainText(`${before % 60} / 60 s`);
  await expect(page.locator(".dock-primary > .icon")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Menu", exact: true });
  await expect(menu.locator(".menu-run-stats .concept")).toHaveCount(4);
  await page.screenshot({ path: `test-results/warm-classic-menu-${width}.png` });
  for (const name of ["Sound", "Graphics", "Avatar", "Saves", "Account", "Playtest", "Run"]) {
    await menu.getByRole("tab", { name, exact: true }).click();
    await expect(menu.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true");
    expect(await menu.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});
