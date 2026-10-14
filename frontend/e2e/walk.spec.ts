import type { Page } from "@playwright/test";
import { test, expect, expectRoom, seedClassicSave, unlockChallenge } from "./fixtures";
import { advanceTurn, newLegacyGame } from "../src/sim";

test.beforeEach(async ({ page }) => {
  await unlockChallenge(page);
  await page.addInitScript(() => localStorage.setItem("nn.mode.v1", "classic"));
  await seedClassicSave(page, advanceTurn(newLegacyGame(1)));
});

const label = (page: Page, name: string) => page.getByRole("main").locator(".eq-labels").getByRole("button", { name, exact: true });
const floor = (page: Page, name: "Office floor" | "Server floor") => page.getByRole("group", { name: "Floors" }).getByRole("button", { name: new RegExp(`^${name}`) });
const walk = (page: Page) => page.getByRole("main").getByRole("button", { name: "Walk", exact: true });
const prompt = (page: Page) => page.locator(".walk-prompt");
const events = (page: Page, prefix: string) =>
  page.evaluate((p) => (JSON.parse(localStorage.getItem("nn.campaign.analytics.v1") ?? "[]") as { name: string }[]).filter((e) => e.name.startsWith(p)).map((e) => e.name), prefix);

async function open(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Continue week 2" }).click();
  await expectRoom(page);
}

test("walks the building as an avatar: the elevator by Space, Walk keeping out of Space's way, and Esc to stop", async ({ page }) => {
  // The opening framing and the walk move a share of the way each frame, so software rendering takes a while.
  test.slow();
  await open(page);
  await walk(page).click();
  await expect(walk(page)).toHaveAttribute("aria-pressed", "true");
  // On the server floor the avatar steps out of the elevator, so the ride is within reach at once.
  await expect(prompt(page)).toContainText("Ride up to the office floor");
  await expect(page.getByRole("status").filter({ hasText: "Ride up to the office floor: press Space" })).toHaveCount(1);
  // Space rides: the Walk button, just pressed, does not take it for itself.
  await page.keyboard.press("Space");
  await expect(walk(page)).toHaveAttribute("aria-pressed", "true");
  await expect(floor(page, "Office floor")).toHaveAttribute("aria-pressed", "true");
  await expect(label(page, "Growth")).toBeVisible();
  // Out of the car upstairs, the way back down is offered.
  await expect(prompt(page)).toContainText("Ride down to the server floor", { timeout: 20_000 });
  await page.keyboard.press("Escape");
  await expect(walk(page)).toHaveAttribute("aria-pressed", "false");
  await expect(prompt(page)).toHaveCount(0);
  expect(await events(page, "walk_")).toEqual(["walk_started", "walk_ended"]);
});

test("in walk mode, clicking equipment walks the avatar to it, and Space then inspects it", async ({ page }) => {
  test.slow();
  await open(page);
  await walk(page).click();
  await expect(prompt(page)).toContainText("Ride up");
  // The monitoring room is just past the elevator, through its glass door.
  await label(page, "Monitoring").click();
  await expect(label(page, "Monitoring")).toHaveAttribute("aria-pressed", "true");
  await expect(prompt(page)).toContainText("Inspect Monitoring", { timeout: 40_000 });
  // Close the inspector, then Space opens it again from where the avatar stands.
  await page.getByRole("complementary", { name: "Details" }).getByRole("button", { name: "Close" }).click();
  await expect(label(page, "Monitoring")).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Space");
  await expect(label(page, "Monitoring")).toHaveAttribute("aria-pressed", "true");
  // The prompt is a button too, for a phone with no Space key.
  await page.getByRole("complementary", { name: "Details" }).getByRole("button", { name: "Close" }).click();
  await prompt(page).click();
  await expect(label(page, "Monitoring")).toHaveAttribute("aria-pressed", "true");
});

test("changes the avatar mid-game from the menu, fetching only the one chosen", async ({ page }) => {
  const fetched: string[] = [];
  page.on("request", (r) => {
    const m = /\/models\/avatars\/([a-z]+)\.glb/.exec(r.url());
    if (m) fetched.push(m[1]);
  });
  await open(page);
  await expect.poll(() => fetched).toEqual(["fox"]);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await menu.getByRole("tab", { name: "Avatar" }).click();
  await menu.getByRole("radio", { name: "Panda" }).check();
  await expect(menu.getByRole("radio", { name: "Panda" })).toBeChecked();
  await expect.poll(() => fetched).toEqual(["fox", "panda"]);
  await menu.getByRole("button", { name: "Close" }).click();
  // Remembered for the next visit, and never in the save.
  expect(await page.evaluate(() => localStorage.getItem("nn.avatar.v1"))).toBe("panda");
  expect(await page.evaluate(() => localStorage.getItem("nn.classic.save.v1") ?? "")).not.toContain("panda");
  expect(await events(page, "avatar_")).toEqual(["avatar_changed"]);
});
