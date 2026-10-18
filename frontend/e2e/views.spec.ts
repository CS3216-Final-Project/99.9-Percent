import type { Page } from "@playwright/test";
import { test, expect, expectRoom, seedClassicSave, unlockChallenge } from "./fixtures";
import { advanceTurn, newLegacyGame } from "../src/sim";

test.beforeEach(async ({ page }) => {
  await unlockChallenge(page);
  await page.addInitScript(() => localStorage.setItem("nn.mode.v1", "classic"));
  await seedClassicSave(page, advanceTurn(newLegacyGame(1)));
});

const stage = (page: Page) => page.locator(".stage-canvas");
const option = (page: Page, name: string) => page.locator(".desktop-walk").getByRole("button", { name, exact: true, includeHidden: true });
const map = (page: Page) => page.getByRole("region", { name: "Map" });
const where = (page: Page) => map(page).locator(".map-where");
const exploration = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("nn.classic.exploration.v1") ?? "null"));
const events = (page: Page, name: string) =>
  page.evaluate((n) => (JSON.parse(localStorage.getItem("nn.campaign.analytics.v1") ?? "[]") as { name: string; data?: Record<string, unknown> }[]).filter((e) => e.name === n).map((e) => e.data), name);

async function open(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Continue week 2" }).click();
  await expectRoom(page);
}

/** The point on the map's plan for a spot on the floor, in page pixels. */
async function onMap(page: Page, x: number, z: number) {
  const box = (await map(page).locator(".map-plan").boundingBox())!;
  // The plan shows the building with 0.8 m round it: x from -22.8 to 22.8, z from -10.3 to 15.3.
  return { x: box.x + ((x + 22.8) / 45.6) * box.width, y: box.y + ((z + 10.3) / 25.6) * box.height };
}

test("V goes from the overview to follow and first person and back, and Escape ends the walk from any of them", async ({ page }) => {
  await open(page);
  await stage(page).focus();
  await page.keyboard.press("v");
  await expect(page.locator(".view-overlay")).toHaveAttribute("data-viewpoint", "follow");
  await expect(stage(page)).toHaveAttribute("data-camera", "perspective");
  await expect(option(page, "Follow")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("v");
  await expect(page.locator(".view-overlay")).toHaveAttribute("data-viewpoint", "first");
  await expect(page.locator(".view-dot")).toBeVisible();
  await expect.poll(async () => (await exploration(page))?.viewpoint).toBe("first");
  // Back to the overview while still walking.
  await page.keyboard.press("v");
  await expect(page.locator(".view-overlay")).toHaveCount(0);
  await expect(stage(page)).toHaveAttribute("data-camera", "overview");
  await expect(option(page, "Walk mode")).toHaveAttribute("aria-pressed", "true");
  // Into follow again, and Escape ends the walk and the view with it.
  await page.keyboard.press("v");
  await expect(stage(page)).toHaveAttribute("data-camera", "perspective");
  await page.keyboard.press("Escape");
  await expect(option(page, "Overview")).toHaveAttribute("aria-pressed", "true");
  await expect(stage(page)).toHaveAttribute("data-camera", "overview");
  expect(await exploration(page)).toMatchObject({ walking: false, viewpoint: "overview" });
  expect((await events(page, "view_changed")).map((d) => `${d?.from}>${d?.to}:${d?.how}`)).toEqual([
    "overview>follow:key",
    "follow>first:key",
    "first>overview:key",
    "overview>follow:key",
    "follow>overview:walk_ended",
  ]);
});

test("the first-person view picks up again after a reload, with walk mode", async ({ page }) => {
  await open(page);
  await page.locator(".view-mode-menu > summary").click();
  await option(page, "First person").click();
  await expect(page.locator(".view-dot")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Continue week 2" }).click();
  await expectRoom(page);
  await expect(page.locator(".view-dot")).toBeVisible();
  await expect(stage(page)).toHaveAttribute("data-camera", "perspective");
});

test("the map says where the avatar is, changes floor from its tabs, and walks the avatar where it is clicked", async ({ page }) => {
  await open(page);
  // Before walking, the avatar sits in the founder's chair upstairs.
  await expect(where(page)).toHaveText("Meeting room, office floor");
  await expect(map(page).getByRole("button", { name: /^Servers/ })).toHaveAttribute("aria-pressed", "true");
  await stage(page).focus();
  await page.keyboard.press("v");
  await expect(where(page)).toHaveText("Elevator, server floor");
  await map(page).getByRole("button", { name: /^Office/ }).click();
  await expect(where(page)).toHaveText("Elevator, office floor", { timeout: 20_000 });
  await expect(page.locator(".room-menu > summary .floor-number")).toHaveText("7");
  const lounge = await onMap(page, 18.25, 6.2);
  await page.mouse.click(lounge.x, lounge.y);
  await expect(map(page).locator(".map-destination")).toHaveCount(1);
  await expect(where(page)).toHaveText("Lounge, office floor", { timeout: 20_000 });
  expect(await events(page, "map_walked")).toHaveLength(1);
  expect((await events(page, "floor_switched")).map((d) => d?.how)).toContain("map");
  // Folded away, it stays folded after a reload.
  await map(page).getByRole("button", { name: "Hide map" }).click();
  await expect(map(page)).toHaveCount(0);
  await page.reload();
  // Back on the office floor, where the walk left it.
  await page.getByRole("button", { name: "Continue week 2" }).click();
  await expect(page.locator(".room-map.is-closed").getByRole("button", { name: "Map" })).toBeVisible();
  expect((await events(page, "map_toggled")).map((d) => d?.open)).toEqual([false]);
});
