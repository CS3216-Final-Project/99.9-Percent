import { expectRoom, openCameraControls, seedSave, test, expect } from "./fixtures";
import { newGame } from "../src/sim";
import { advanceSteps } from "../src/sim/step";

// The traffic view strips the server floor down to the request path, and the choice is kept.
test("the traffic view hides the map and shows each machine's load, and stays on after a reload", async ({ page }) => {
  await seedSave(page, advanceSteps(newGame(1), 3).state);
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page, 30_000);
  const room = page.getByRole("main");
  // Guided Mode always shows each machine's load; the traffic view strips the rest away.
  await expect(room.locator('[data-eq="db"] .eq-load')).toBeVisible();
  await expect(room.locator('[data-eq="monitoring"]')).toHaveCount(1);
  await openCameraControls(page);
  const toggle = page.getByRole("button", { name: "Traffic view" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(room.locator('[data-eq="db"] .eq-load')).toBeVisible();
  await expect(room.locator('[data-eq="monitoring"]')).toHaveCount(0);
  await expect(page.locator(".room-map")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page, 30_000);
  await expect(room.locator('[data-eq="db"] .eq-load')).toBeVisible();
});
