import { test, expect, expectRoom, savedGame, seedSave } from "./fixtures";
import { newGame } from "../src/sim";
import { advanceSteps } from "../src/sim/step";

test("inspects evidence and advances a physical step on touch", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Try Prototype", exact: true }).tap();
  await page.getByRole("button", { name: "Skip introduction" }).tap();
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

test("investigates and responds through the incident panel on touch", async ({ page }) => {
  await seedSave(page, advanceSteps(newGame(1, "touch-incident"), 6).state);
  await page.goto("/"); await page.getByRole("button", { name: "Continue company" }).tap();
  await expectRoom(page);
  const panel = page.getByRole("complementary", { name: "System metrics" });
  await expect(page.getByRole("banner")).toHaveClass(/is-incident/);
  await panel.getByRole("button", { name: "Database", exact: true }).tap();
  await expect(panel.getByRole("status")).toContainText("Demand 800/s · capacity 600/s · backlog 600");
  expect((await savedGame(page)).campaign!.step).toBe(6);
  for (const name of [/Add server/, /Upgrade database/, /Limit to 500 requests\/s/]) {
    const button = panel.getByRole("button", { name });
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeVisible();
  }
  await panel.locator("summary").filter({ hasText: "Full system evidence" }).tap();
  await expect(panel.getByRole("table")).toContainText("133.33%");
  await panel.locator("summary").filter({ hasText: "Full system evidence" }).tap();
  await panel.getByRole("button", { name: /Upgrade database/ }).tap();
  await expect(panel.getByRole("status").filter({ hasText: "Database upgrade:" })).toContainText("3 step(s)");
  await expect(panel.getByRole("button", { name: /Add server/ })).toBeDisabled();
  await page.screenshot({ path: "test-results/phase1-mobile-incident.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.getByRole("button", { name: "Run", exact: true }).tap();
  const report = page.getByRole("dialog", { name: "Incident postmortem" });
  await expect(report).toBeVisible({ timeout: 25000 });
  await report.getByRole("button", { name: "Continue company" }).tap();
  expect((await savedGame(page)).phase).toBe("management");
});

test("a tap explains a term, and tapping a button does not leave a tooltip over it", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Try Prototype", exact: true }).tap(); await page.getByRole("button", { name: "Skip introduction" }).tap();
  await expectRoom(page);
  const tip = page.getByRole("tooltip");
  await page.getByRole("complementary", { name: "System metrics" }).getByText("Inspect the evidence", { exact: true }).tap();
  await expect(tip).toContainText("Inspection is free");
  await expect(tip).toHaveCSS("opacity", "1");
  const box = (await tip.boundingBox())!, view = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(view.width);
  await page.screenshot({ path: "test-results/tooltip-mobile.png" });

  const music = page.getByRole("button", { name: "Music", exact: true });
  await music.tap();
  await expect(tip).toBeHidden();
  await expect(music).toHaveAttribute("aria-pressed", "false");
});
