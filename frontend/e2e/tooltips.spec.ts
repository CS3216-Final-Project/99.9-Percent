import { openCameraControls } from "./fixtures";
import { test, expect, expectRoom } from "./fixtures";

test("explains controls in the shared tooltip, never the browser's own", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Start Guided Mode", exact: true }).click(); await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expectRoom(page);
  await expect(page.locator("[title]")).toHaveCount(0);

  const tip = page.getByRole("tooltip");
  await page.getByRole("banner").getByRole("button", { name: "View finances", exact: true }).hover();
  await expect(tip).toContainText("Available cash");
  await expect(tip).toHaveCSS("opacity", "1");
  const box = (await tip.boundingBox())!, view = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(view.width); expect(box.y + box.height).toBeLessThanOrEqual(view.height);
  await page.screenshot({ path: "test-results/tooltip-desktop.png" });

  await page.mouse.move(view.width / 2, view.height / 2);
  await expect(tip).toBeHidden();

  // A shortcut reads as a key.
  await openCameraControls(page);
  await page.getByRole("button", { name: "Rotate left", exact: true }).hover();
  await expect(tip.locator("kbd")).toHaveText("Q");
  await expect(tip).toContainText("Rotate left");

  // Keyboard focus explains too, and Escape closes the tooltip.
  await page.keyboard.press("Tab");
  await expect(tip).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tip).toBeHidden();
});

test("explains a locked control, which is where the reason for being locked is shown", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Start Guided Mode", exact: true }).click();
  await expectRoom(page);
  const run = page.getByRole("button", { name: "Run", exact: true });
  await expect(run).toBeDisabled();
  await run.hover();
  const tip = page.getByRole("tooltip");
  await expect(tip).toContainText("Finish or skip the tutorial to run the company");
  await expect(tip).toHaveCSS("opacity", "1");
  const box = (await tip.boundingBox())!, view = page.viewportSize()!;
  expect(box.x + box.width).toBeLessThanOrEqual(view.width);
  expect(box.y + box.height).toBeLessThanOrEqual((await run.boundingBox())!.y);
  await page.screenshot({ path: "test-results/tooltip-locked-control.png" });
});
