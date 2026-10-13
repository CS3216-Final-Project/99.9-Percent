import { test, expect, expectRoom } from "./fixtures";

test("an action's confirmation opens in the room beside the machine it changes, clear of the panel", async ({ page }) => {
  await page.goto("/?floor=office");
  await page.getByRole("button", { name: "Start Guided Mode", exact: true }).click();
  await page.getByRole("button", { name: "Skip introduction", exact: true }).click();
  const panel = page.getByRole("complementary", { name: "System metrics" });
  await panel.getByRole("button", { name: /^Upgrade database/ }).click();
  await expect(page.getByRole("group", { name: "Floors" }).getByRole("button", { name: /^Server floor/ })).toHaveAttribute("aria-pressed", "true");
  await expectRoom(page);
  const confirm = page.getByRole("main").getByRole("region", { name: "Confirm Upgrade database" });
  await expect(confirm).toContainText("The database stores");
  await expect(confirm).toContainText("$3,000 now");
  await expect(panel.getByText("Effect & costs")).toHaveCount(0);
  const marker = page.getByRole("main").locator('.eq-label[data-eq="db"]');
  await expect(marker).toHaveClass(/is-affected/);
  await expect(page.locator(".campaign-action-popover")).toHaveClass(/is-placed/);
  const [box, at, side] = await Promise.all([page.locator(".campaign-action-popover").boundingBox(), marker.boundingBox(), panel.boundingBox()]);
  // Beside the marker, level with it, and never under the panel.
  expect(box!.x >= at!.x + at!.width || box!.x + box!.width <= at!.x).toBe(true);
  expect(box!.y).toBeLessThan(at!.y + at!.height);
  expect(box!.y + box!.height).toBeGreaterThan(at!.y);
  expect(box!.x + box!.width).toBeLessThanOrEqual(side!.x);
  await page.screenshot({ path: "test-results/action-popover.png" });
  await page.keyboard.press("Escape");
  await expect(confirm).toBeHidden();
  await expect(panel.getByRole("button", { name: /^Upgrade database/ })).toBeFocused();
});
