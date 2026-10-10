import { test, expect, expectRoom, seedSave } from "./fixtures";
import { newGame } from "../src/sim";
import { advanceSteps } from "../src/sim/step";

test("explains controls in the shared tooltip, never the browser's own", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Play", exact: true }).click();
  await expectRoom(page);
  await expect(page.locator("[title]")).toHaveCount(0);

  const tip = page.getByRole("tooltip");
  await page.getByRole("banner").getByText("Cash", { exact: true }).hover();
  await expect(tip).toContainText("Available cash");
  await expect(tip).toHaveCSS("opacity", "1");
  const box = (await tip.boundingBox())!, view = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(view.width); expect(box.y + box.height).toBeLessThanOrEqual(view.height);
  await page.screenshot({ path: "test-results/tooltip-desktop.png" });

  await page.mouse.move(view.width / 2, view.height / 2);
  await expect(tip).toBeHidden();

  // A shortcut reads as a key.
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
  await seedSave(page, advanceSteps(newGame(1, "tooltip-incident"), 6).state);
  await page.goto("/"); await page.getByRole("button", { name: "Continue company" }).click();
  await expectRoom(page);

  const advance = page.getByRole("button", { name: "Incident", exact: true });
  await expect(advance).toBeDisabled();
  await advance.hover();
  const tip = page.getByRole("tooltip");
  await expect(tip).toContainText("Advance one physical step");
  await expect(tip).toHaveCSS("opacity", "1");
  const box = (await tip.boundingBox())!, view = page.viewportSize()!;
  expect(box.x + box.width).toBeLessThanOrEqual(view.width);
  expect(box.y + box.height).toBeLessThanOrEqual((await advance.boundingBox())!.y);
  await page.screenshot({ path: "test-results/tooltip-locked-control.png" });
});
