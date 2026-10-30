import { openRoomControls } from "./fixtures";
import type { Page } from "@playwright/test";
import { test, expect, expectRoom, seedClassicSave, unlockChallenge } from "./fixtures";
import { advanceTurn, newLegacyGame, type GameState } from "../src/sim";
import { DEFAULT_META } from "../src/game/persist";

test.beforeEach(async ({ page }) => {
  await unlockChallenge(page);
  await page.addInitScript(() => localStorage.setItem("nn.mode.v1", "classic"));
});

/**
 * How long a ride's labels may take to appear. A ride lasts five seconds on the wall clock, but CI's software
 * renderer can hold the page for several more seconds while it draws the floor arriving, and only then do the labels
 * show. A trace from CI showed one ride's labels arriving after more than ten.
 */
const AFTER_RIDE = { timeout: 20_000 };

/** An equipment label in the room, as opposed to the panels' buttons of the same name. */
const label = (page: Page, name: string) => page.getByRole("main").locator(".eq-labels").getByRole("button", { name, exact: true });
const floor = (page: Page, name: "Office floor" | "Server floor") => page.locator(`.floor-menu button[data-floor="${name === "Office floor" ? "office" : "servers"}"]`);

/** A Classic save the next week of which brings an incident, with the incident guide still to be shown. */
async function seedBeforeIncident(page: Page, game: GameState) {
  await page.addInitScript(({ game, meta }) => {
    if (localStorage.getItem("nn.classic.save.v1") === null) {
      localStorage.setItem("nn.classic.save.v1", JSON.stringify({ savedAt: 1, game }));
      localStorage.setItem("nn.classic.meta.v1", JSON.stringify(meta));
    }
  }, { game, meta: { ...DEFAULT_META, tutorialDone: true, incidentGuideDone: false, runsStarted: 1 } });
}

test("rides between the floors by the floor menu and the keyboard, each floor with its own labels", async ({ page }) => {
  await seedClassicSave(page, advanceTurn(newLegacyGame(1)));
  await page.goto("/");
  await page.getByRole("button", { name: "Continue week 2" }).click();
  await expectRoom(page);
  // The machines are downstairs, where every run opens.
  await expect(floor(page, "Server floor")).toHaveAttribute("aria-pressed", "true");
  await expect(label(page, "Database")).toBeVisible();
  await expect(label(page, "Growth")).toHaveCount(0);

  await openRoomControls(page); await floor(page, "Office floor").click();
  await expect(floor(page, "Office floor")).toHaveAttribute("aria-pressed", "true");
  await expect(label(page, "Growth")).toBeVisible();
  await expect(label(page, "Database")).toHaveCount(0);
  // The office's equipment is clicked in the room as before, opening its inspection card.
  await label(page, "Growth").click();
  await expect(label(page, "Growth")).toHaveAttribute("aria-pressed", "true");
  const reveal = page.getByRole("dialog", { name: "Growth", exact: true });
  await expect(reveal).toBeVisible();
  await reveal.getByRole("button", { name: "Return to room" }).click();

  await page.keyboard.press("PageDown");
  await expect(floor(page, "Server floor")).toHaveAttribute("aria-pressed", "true");
  await expect(label(page, "Database")).toBeVisible();
  await expect(label(page, "Growth")).toHaveCount(0);
  // Page Up while a dialog has focus is the dialog's, not the room's.
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.keyboard.press("PageUp");
  await expect(floor(page, "Server floor")).toHaveAttribute("aria-pressed", "true");

  const switches = await page.evaluate(() => (JSON.parse(localStorage.getItem("nn.campaign.analytics.v1") ?? "[]") as { name: string; data?: { to: string; how: string } }[]).filter((e) => e.name === "floor_switched").map((e) => `${e.data?.how}:${e.data?.to}`));
  expect(switches).toEqual(["menu:office", "key:servers"]);
});

test("an incident downstairs badges the server floor from the office, and the incident panel takes the view there", async ({ page }) => {
  const game = advanceTurn({ ...newLegacyGame(1), users: 4500 });
  expect(game.phase).toBe("incident");
  // The room's first frame takes about 20 s in software, and this journey opens on the office, where expectRoom's
  // server-floor label never appears, so the first label waits for that frame instead.
  test.setTimeout(120_000);
  await seedClassicSave(page, game);
  await page.goto("/?floor=office");
  await page.getByRole("button", { name: /^Continue week/ }).click();
  await expect(label(page, "Growth")).toBeVisible({ timeout: 60_000 });
  // The incident never moves the view on its own; the menu and the panel say where it is.
  await expect(floor(page, "Office floor")).toHaveAttribute("aria-pressed", "true");
  await openRoomControls(page);
  await expect(floor(page, "Server floor")).toHaveAccessibleName(/incident here/);
  await page.getByRole("button", { name: "Go to the server floor" }).click();
  await expect(floor(page, "Server floor")).toHaveAttribute("aria-pressed", "true");
  await expect(label(page, "Database")).toBeVisible(AFTER_RIDE);
  await expect(floor(page, "Server floor")).not.toHaveAccessibleName(/incident here/);
  await expect(page.getByRole("button", { name: "Go to the server floor" })).toHaveCount(0);

  // Back upstairs, investigating from the panel rides down to what is being looked at.
  await page.keyboard.press("PageUp");
  await expect(label(page, "Growth")).toBeVisible(AFTER_RIDE);
  await page.locator(".incident-investigate").getByRole("button", { name: "Database", exact: true }).click();
  await expect(floor(page, "Server floor")).toHaveAttribute("aria-pressed", "true");
  await expect(label(page, "Database")).toBeVisible(AFTER_RIDE);
});

test("the tutorial takes the view to its step's floor once, and never pulls the player back", async ({ page }) => {
  await page.goto("/?floor=office");
  await page.getByRole("button", { name: "Start Challenge Mode", exact: true }).click();
  // The first step points at the servers, so the view rides down to them.
  await expect(page.getByRole("dialog", { name: /Tutorial, step 1/ })).toBeVisible();
  await expect(floor(page, "Server floor")).toHaveAttribute("aria-pressed", "true");
  await expect(label(page, "Servers")).toBeVisible();
  // Riding up mid-step stays up. The step's card has the keyboard, as a dialog, so the player uses the floor menu.
  await openRoomControls(page); await floor(page, "Office floor").click();
  await expect(label(page, "Growth")).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(floor(page, "Office floor")).toHaveAttribute("aria-pressed", "true");
});

test("the first incident's guide takes a player on the office floor down to the machines", async ({ page }) => {
  await seedBeforeIncident(page, { ...newLegacyGame(1), users: 4500 });
  await page.goto("/?floor=office");
  await page.getByRole("button", { name: /^(Start Challenge Mode|Continue week)/ }).click();
  await expect(label(page, "Growth")).toBeVisible();
  await page.getByRole("button", { name: "Next week", exact: true }).click();
  await expect(page.getByRole("dialog", { name: /Incident guide, step 1/ })).toBeVisible();
  await expect(floor(page, "Server floor")).toHaveAttribute("aria-pressed", "true");
  await expect(label(page, "Database")).toBeVisible();
});
