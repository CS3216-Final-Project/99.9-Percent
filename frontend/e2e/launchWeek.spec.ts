import { test, expect, seedSave, savedGame, expectRoom, openCameraControls, openPanelTab } from "./fixtures";
import type { Page } from "@playwright/test";
import { newGame, type GameState } from "../src/sim";
import { applyCampaignInput, step } from "../src/sim/step";
import type { Action } from "../src/sim/types";

async function boot(page: Page, game: GameState) {
  await page.route("**/api/**", r => r.abort());
  await seedSave(page, game); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page); await page.evaluate(() => document.fonts.ready);
}
const coach = (page: Page) => page.getByRole("button", { name: "Show me", exact: true });
const tutorial = (page: Page) => page.getByRole("region", { name: "Launch Week tutorial" });
const act = (s: GameState, a: Action) => { const r = applyCampaignInput(s, a); if (!r.result.ok) throw new Error(r.result.message); return r.state; };
const runUntil = (s: GameState, cond: (s: GameState) => boolean, cap = 200): GameState => {
  for (let i = 0; i < cap && !cond(s) && s.phase !== "ended"; i++)
    s = s.phase === "review" ? act(s, { type: "acknowledge_review" }) : step(s).state;
  return s;
};

/** A company whose one database incident was fixed by the upgrade and its postmortem acknowledged. */
function recovered() {
  let s = runUntil(newGame(7, "lw-2", 2), x => !!x.campaign!.incident);
  s = act(s, { type: "start_db_upgrade" });
  s = runUntil(s, x => x.phase === "review");
  return act(s, { type: "acknowledge_review" });
}

/** A recovered company whose research point is earned and unspent. */
function researchReady() {
  return runUntil(recovered(), x => !!x.campaign!.launchWeek?.researchEarned && x.phase === "management" && !x.campaign!.incident);
}

/** A company with its research spent, moments before the week ends. */
function nearlyDone() {
  const s = act(researchReady(), { type: "pick_launch_tech", tech: "caching" });
  return runUntil(s, x => x.campaign!.step >= 55);
}

test("cold open: the launch letter, the whole room and the opening beat", async ({ page }) => {
  await boot(page, newGame(7, "lw-1", 2));
  await expect(page.getByRole("dialog", { name: "Launch week" })).toBeVisible();
  await page.getByRole("button", { name: "Open the doors" }).click();
  await openCameraControls(page);
  // The whole room stays furnished; the traffic view is the player's own choice.
  await expect(page.getByRole("button", { name: "Traffic view" })).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Escape");
  await expect(page.locator(".room-map")).toBeVisible();
  // Chapter 0 teaches with spotlighted tutorial steps, never the hint card.
  await expect(tutorial(page)).toContainText("launch week starts now");
  await expect(page.locator("[data-spotlight]")).toHaveAccessibleName("Run");
  await expect(coach(page)).toHaveCount(0);
});

test("the research sheet previews each option and spends the pick", async ({ page }) => {
  await boot(page, researchReady());
  // The pick is a purchase on Actions: the step lights that tab until the player opens it.
  await expect(page.locator("[data-spotlight]")).toHaveAttribute("data-tab", "actions");
  await openPanelTab(page, "Actions");
  const sheet = page.getByRole("region", { name: "Launch Week research" });
  await expect(sheet).toBeVisible();
  // A spotlighted tutorial step explains the free research point beside the sheet.
  await expect(tutorial(page)).toContainText("research point");
  // Hovering an option previews its deployment in the room, then the pick is spent.
  await sheet.getByRole("button", { name: "Caching" }).hover();
  await sheet.getByRole("button", { name: "Autoscaling" }).hover();
  await sheet.getByRole("button", { name: "Caching" }).click();
  await page.locator(".campaign-action-popover").getByRole("button", { name: "Confirm", exact: true }).click();
  const saved = (await savedGame(page)).campaign!;
  expect(saved.launchWeek?.tech).toBe("caching");
  await expect(sheet).toBeHidden();
});

test("the score card reports nines, copies the result and continues to Chapter 2", async ({ page }) => {
  await boot(page, nearlyDone());
  const rush = page.getByRole("button", { name: "End the week at 20 times speed" });
  const card = page.getByRole("dialog", { name: "Launch Week complete" });
  await rush.click();
  for (let i = 0; i < 60 && !(await card.isVisible()); i++) {
    const dialog = page.getByRole("dialog");
    if (await dialog.isVisible()) {
      const next = dialog.getByRole("button", { name: "View Incident Report", exact: true });
      const go = dialog.getByRole("button", { name: "Continue company", exact: true });
      const close = dialog.getByRole("button", { name: "Close", exact: true });
      if (await next.isVisible()) await next.click();
      else if (await go.isVisible()) await go.click();
      else if (await close.isVisible()) await close.click();
    } else if (await rush.isEnabled() && (await rush.getAttribute("aria-pressed")) !== "true") await rush.click({ timeout: 1000 }).catch(() => {}); // the week can end between the check and the click
    await page.waitForTimeout(150);
  }
  await expect(card).toBeVisible();
  await expect(card).toContainText("Uptime");
  await expect(card).toContainText("nine");
  await page.getByRole("button", { name: "Continue into Chapter 2" }).click();
  const saved = (await savedGame(page)).campaign!;
  expect(saved.openingMilestone?.acknowledged).toBe(true);
  expect(saved.scaling).not.toBeNull();
});
