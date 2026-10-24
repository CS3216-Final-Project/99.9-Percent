import { test, expect, seedSave, savedGame, expectRoom, openCameraControls, openPanelTab } from "./fixtures";
import type { Page } from "@playwright/test";
import { newGame, type GameState } from "../src/sim";
import { applyCampaignInput, step } from "../src/sim/step";
import type { Action } from "../src/sim/types";
import { WALKTHROUGH_VERSION } from "../src/game/persist";
import { makeEnvelope } from "../src/game/saveEnvelope";

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

/** A recovered company whose week ended without its research point being spent. */
function endedUnspent() {
  return runUntil(recovered(), x => x.campaign!.launchWeek!.completedStep !== null && x.phase === "management");
}

/** Seeds a Launch Week replay in progress on a practice company, the original company paused behind it. */
async function seedPractice(page: Page, company: GameState, practice: GameState) {
  await seedSave(page, company, { walkthroughStep: 0 });
  await page.addInitScript(({ key, value }) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, value); },
    { key: "nn.campaign.tutorial.v1", value: JSON.stringify({ companyRunId: company.campaign!.runId, version: WALKTHROUGH_VERSION, save: makeEnvelope(practice) }) });
}

/** Opens a seeded company for a journey about the panel and dialogs; it skips drawing the room, which it never touches. */
async function bootPanel(page: Page, game: GameState) {
  await page.route("**/api/**", r => r.abort());
  await seedSave(page, game); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expect(page.getByRole("region", { name: "Guided Mode guidance" })).toBeVisible();
}

/** Spends the research pick through its confirmation on the Actions tab, as the player does. */
async function pickCaching(page: Page) {
  await openPanelTab(page, "Actions");
  const sheet = page.getByRole("region", { name: "Launch Week research" });
  await sheet.getByRole("button", { name: "Caching" }).click();
  await page.locator(".campaign-action-popover").getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(sheet).toBeHidden();
}

test("Complete Opening stays hidden until the week is over, even with the milestone recorded mid-week", async ({ page, withoutRoom }) => {
  await withoutRoom();
  await bootPanel(page, recovered());
  const guidance = page.getByRole("region", { name: "Guided Mode guidance" });
  await expect(guidance.getByRole("region", { name: "Guided Mode requirements" })).toContainText("2/5");
  await expect(guidance.getByRole("button", { name: "Complete Opening" })).toHaveCount(0);
});

test("a week that ends with research unspent asks for the pick, then scores and continues to Chapter 1", async ({ page, withoutRoom }) => {
  await withoutRoom();
  await bootPanel(page, endedUnspent());
  const guidance = page.getByRole("region", { name: "Guided Mode guidance" });
  await expect(guidance.getByRole("status").filter({ hasText: "Spend your free research pick" })).toBeVisible();
  await expect(guidance.getByRole("button", { name: "Complete Opening" })).toHaveCount(0);
  await expect(tutorial(page)).toContainText("research point");
  await expect(page.getByRole("region", { name: "Guided Mode chapters" })).toContainText("Spend your free research pick to see your Launch Week score.");
  // The pick is a purchase on Actions: the step lights that tab, then scrolls the whole sheet into the panel.
  await expect(page.locator("[data-spotlight]")).toHaveAttribute("data-tab", "actions");
  await openPanelTab(page, "Actions");
  await expect(page.getByRole("region", { name: "Launch Week research" })).toBeInViewport({ ratio: 1 });
  await pickCaching(page);
  const card = page.getByRole("dialog", { name: "Launch Week complete" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Continue to Scaling & Routing" }).click();
  await expect(card).toBeHidden();
  const saved = (await savedGame(page)).campaign!;
  expect(saved.launchWeek?.tech).toBe("caching");
  expect(saved.openingMilestone?.acknowledged).toBe(true);
  expect(saved.scaling).not.toBeNull();
});

test("a week that ends during its database incident lets the player fix and review it, then pick research and continue", async ({ page, withoutRoom, installClock }) => {
  await withoutRoom(); await installClock();
  // The database was never upgraded, so the incident is still open when the week ends at game second 60.
  const over = runUntil(newGame(7, "lw-late", 2), x => x.campaign!.launchWeek!.completedStep !== null);
  expect(over.phase).toBe("incident");
  await bootPanel(page, over);
  await expect(page.getByTestId("physical-step")).toHaveText("60");
  await expect(page.getByRole("button", { name: "Complete Opening" })).toHaveCount(0);
  await openPanelTab(page, "Actions");
  await page.getByRole("button", { name: /^Upgrade database/ }).click();
  await page.locator(".campaign-action-popover").getByRole("button", { name: "Confirm", exact: true }).click();
  expect((await savedGame(page)).campaign!.pending.some(a => a.type === "upgrade-db")).toBe(true);
  // Time still runs past the week's end, so the upgrade lands and the service recovers.
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 60_000));
  await page.getByRole("button", { name: "Run", exact: true }).click();
  // The recovery notice opens first; the fixture's handler moves on from it to the postmortem.
  const recovered = page.getByRole("dialog", { name: /^(System Recovered!|Incident postmortem)$/ });
  for (let i = 0; i < 150 && !(await recovered.isVisible()); i++) await page.clock.runFor(200);
  const report = page.getByRole("dialog", { name: "Incident postmortem" });
  await report.getByRole("button", { name: "Continue company", exact: true }).click();
  await expect(report).toBeHidden();
  await expect(page.getByRole("region", { name: "Guided Mode chapters" })).toContainText("Spend your free research pick to see your Launch Week score.");
  await pickCaching(page);
  await page.getByRole("dialog", { name: "Launch Week complete" }).getByRole("button", { name: "Continue to Scaling & Routing" }).click();
  const saved = (await savedGame(page)).campaign!;
  expect(saved.dbCapacity).toBeGreaterThan(over.campaign!.dbCapacity);
  expect(saved.openingMilestone?.acknowledged).toBe(true);
  expect(saved.scaling).not.toBeNull();
});

test("a practice replay resumes where it was left after a reload, finishes its research and returns the paused company", async ({ page, withoutRoom }) => {
  await withoutRoom();
  const company = recovered();
  await seedPractice(page, company, endedUnspent());
  await page.route("**/api/**", r => r.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  // The replay is still at the end of its week, not restarted from the launch letter.
  await expect(page.getByTestId("physical-step")).toHaveText("60");
  await expect(page.getByRole("dialog", { name: "Launch week" })).toHaveCount(0);
  await pickCaching(page);
  await page.getByRole("dialog", { name: "Launch Week complete" }).getByRole("button", { name: "Continue to Scaling & Routing" }).click();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Return to game" }).click();
  await expect(page.getByTestId("physical-step")).toHaveText(String(company.campaign!.step));
  expect((await savedGame(page)).campaign!.runId).toBe(company.campaign!.runId);
  expect(await page.evaluate(() => localStorage.getItem("nn.campaign.tutorial.v1"))).toBeNull();
});

test("Replay Launch Week from View chapters opens the practice company on the launch letter, without a reload", async ({ page, withoutRoom }) => {
  await withoutRoom();
  await bootPanel(page, newGame(7, "lw-replay", 2));
  const letter = page.getByRole("dialog", { name: "Launch week" });
  await letter.getByRole("button", { name: "Open the doors" }).click();
  await expect(letter).toBeHidden();
  await page.getByRole("button", { name: "View chapters", exact: true }).click();
  await page.getByRole("button", { name: "Replay Launch Week" }).click();
  await expect(page.getByRole("region", { name: "Guided Mode chapters" })).toContainText("Practice");
  await expect(letter).toBeVisible();
  await letter.getByRole("button", { name: "Open the doors" }).click();
  await expect(letter).toBeHidden();
});

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

test("the score card reports nines, copies the result and continues to Chapter 1", async ({ page }) => {
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
  await page.getByRole("button", { name: "Continue to Scaling & Routing" }).click();
  const saved = (await savedGame(page)).campaign!;
  expect(saved.openingMilestone?.acknowledged).toBe(true);
  expect(saved.scaling).not.toBeNull();
});

test("the incident's spotlight frames the Database below the growing checklist", async ({ page }) => {
  // The incident banner and recovery progress push Inspect equipment below the panel's fold, and the panel scrolls
  // itself back to the top when the incident opens: the step must still bring its control into view and frame it.
  await boot(page, runUntil(newGame(7, "lw-2", 2), x => !!x.campaign!.incident));
  await expect(tutorial(page)).toContainText("Choose Database under Inspect equipment");
  const lit = page.locator("[data-spotlight]");
  await expect(lit).toHaveAccessibleName("Database");
  await expect(lit).toBeInViewport({ ratio: 1 });
  const [hole, chip] = await Promise.all([page.locator(".tour-hole").boundingBox(), lit.boundingBox()]);
  expect(Math.abs(hole!.y + 5 - chip!.y)).toBeLessThan(2);
  expect(Math.abs(hole!.x + 5 - chip!.x)).toBeLessThan(2);
});

test("a week that ends mid-incident lets the player fix it before the score card", async ({ page }) => {
  await boot(page, runUntil(newGame(7, "lw-late", 2), x => x.campaign!.launchWeek!.completedStep !== null));
  await expect(page.getByRole("dialog", { name: "Launch Week complete" })).toHaveCount(0);
  await openPanelTab(page, "Actions");
  const upgrade = page.locator('.campaign-panel .campaign-action-card[data-campaign-action="Upgrade database"] > button.act');
  await expect(upgrade).toBeEnabled();
  await expect(page.locator(".campaign-panel")).not.toContainText("Acknowledge the pending review or milestone first.");
});
