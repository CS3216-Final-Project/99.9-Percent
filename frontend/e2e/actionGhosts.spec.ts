import {infrastructureAction} from "./componentInspection";
import { expectRoom, openPanelTab, seedSave, test, expect } from "./fixtures";
import { newGame } from "../src/sim";
import { advanceSteps } from "../src/sim/step";

// Pointing at a purchase previews it in the room; cancelling the quote takes the preview away.
test("hovering and quoting an action previews it in the room until cancelled", async ({ page }) => {
  await seedSave(page, advanceSteps(newGame(1), 2).state);
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page, 30_000);
  // The floating hint card can sit over the actions column; acknowledge it so the purchases stay tappable.
  const hint = page.locator(".campaign-hint-card, .launch-tutorial").getByRole("button", { name: "Got it", exact: true });
  if (await hint.isVisible()) await hint.click();
  const stage = page.locator(".stage-canvas");
  await expect(stage).not.toHaveAttribute("data-ghost");
  await openPanelTab(page, "Actions");
  const upgrade = await infrastructureAction(page,/Upgrade database/);
  await upgrade.hover();
  await expect(stage).toHaveAttribute("data-ghost", "upgrade-db");
  const add = await infrastructureAction(page,/Add server/);
  await add.hover();
  await expect(stage).toHaveAttribute("data-ghost", "add-app");
  await page.getByRole("button", { name: /Add server/ }).click();
  const confirm = page.getByRole("region", { name: "Confirm Add server" });
  await expect(confirm).toBeVisible();
  await page.mouse.move(5, 5);
  await expect(stage).toHaveAttribute("data-ghost", "add-app");
  await page.keyboard.press("Escape");
  await expect(confirm).toBeHidden();
  // Focus returns to the action, which keeps previewing it, as hovering does, until focus moves on.
  await expect(page.getByRole("button", { name: /Add server/ })).toBeFocused();
  await expect(stage).toHaveAttribute("data-ghost", "add-app");
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect(stage).not.toHaveAttribute("data-ghost");
});
