import type { Page } from "@playwright/test";
import { test, expect, expectRoom } from "./fixtures";

/** Pixels drawn per CSS pixel of the room's canvas. */
const pixelRatio = (page: Page) =>
  page.getByRole("main").locator("canvas").evaluate((el) => (el as HTMLCanvasElement).width / (el as HTMLCanvasElement).clientWidth);

// The room is drawn for real here: the point is that the menu's choice reaches the renderer.
test("changes the graphics quality from the menu, redraws the room and remembers the choice", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try Prototype", exact: true }).click();
  await page.getByRole("button", { name: "Skip introduction" }).click();
  await expectRoom(page);
  // The test browser draws in software, so Auto means half the pixels.
  await expect.poll(() => pixelRatio(page)).toBeCloseTo(0.5, 1);

  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await menu.getByRole("tab", { name: "Graphics" }).click();
  await expect(menu.getByRole("radio", { name: "Auto" })).toBeChecked();
  await menu.getByRole("radio", { name: "Low" }).check();
  await expect(menu.getByRole("radio", { name: "Low" })).toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem("nn.graphics.v1"))).toBe(JSON.stringify({ quality: "low" }));
  await page.screenshot({ path: "test-results/graphics-menu.png" });
  await menu.getByRole("button", { name: "Close" }).click();

  // A new canvas replaced the old one and still draws, now at three quarters of the pixels.
  await expectRoom(page);
  await expect.poll(() => pixelRatio(page)).toBeCloseTo(0.75, 1);

  await page.reload();
  await page.getByRole("button", { name: "Continue company" }).click();
  await expectRoom(page);
  await expect.poll(() => pixelRatio(page)).toBeCloseTo(0.75, 1);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("tab", { name: "Graphics" }).click();
  await expect(page.getByRole("radio", { name: "Low" })).toBeChecked();
});
