import type { Page } from "@playwright/test";
import { test, expect, expectRoom, seedClassicSave, unlockChallenge } from "./fixtures";
import { advanceTurn, newLegacyGame } from "../src/sim";

test.beforeEach(async ({ page }) => {
  await unlockChallenge(page);
  await page.addInitScript(() => localStorage.setItem("nn.mode.v1", "classic"));
  await seedClassicSave(page, advanceTurn(newLegacyGame(1)));
});

const stage = (page: Page) => page.locator(".stage-canvas");
const equipmentLabel = (page: Page, name: string) => page.getByRole("main").locator(".eq-labels").getByRole("button", { name, exact: true });
const option = (page: Page, name: string) => page.locator(".desktop-walk").getByRole("button", { name, exact: true, includeHidden: true });
const map = (page: Page) => page.getByRole("region", { name: "Map" });
const where = (page: Page) => map(page).locator(".map-where");
const exploration = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("nn.classic.exploration.v1") ?? "null"));
const events = (page: Page, name: string) =>
  page.evaluate((n) => (JSON.parse(localStorage.getItem("nn.campaign.analytics.v1") ?? "[]") as { name: string; data?: Record<string, unknown> }[]).filter((e) => e.name === n).map((e) => e.data), name);

async function open(page: Page) {
  await page.goto("/");
  // The room is ready behind the title screen, so Continue's click can hand it the mouse.
  await expect(stage(page)).toHaveAttribute("data-camera", "overview");
  await page.getByRole("button", { name: "Continue week 2" }).click();
  await expectRoom(page);
}

test("focused workspaces ignore hidden room keyboard shortcuts", async ({ page }) => {
  await open(page);
  // The opening auto-fit saves its first camera asynchronously. Choose a real zoom to establish a
  // player-owned view, which stops auto-framing, before comparing exact saved camera coordinates.
  await expect.poll(async () => (await exploration(page))?.camera ?? null).not.toBeNull();
  const initialZoom = (await exploration(page)).camera.zoom;
  const cameraMenu = page.locator(".camera-menu > summary");
  await cameraMenu.click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await cameraMenu.click();
  await expect.poll(async () => (await exploration(page))?.camera?.zoom ?? 0).toBeGreaterThan(initialZoom);
  const before = await exploration(page);
  for (const [name, title] of [["Tech", "Tech tree"], ["History", "History"]]) {
    await page.getByRole("button", { name, exact: true }).click();
    const workspace = page.getByRole("region", { name: title, exact: true });
    await expect(workspace).toBeVisible();
    await workspace.getByRole("heading", { name: title, exact: true }).focus();
    for (const key of ["PageUp", "PageDown", "v", "q", "e"]) await page.keyboard.press(key);
    await workspace.getByRole("button", { name: "Back to room", exact: true }).click();
    await expect(stage(page)).toHaveAttribute("data-camera", "overview");
    const after = await exploration(page);
    expect(after.floor).toBe(before.floor);
    expect(after.viewpoint).toBe(before.viewpoint);
    expect(after.camera).toEqual(before.camera);
  }
});

/** The round map starts folded: unfold it from its Map button. */
async function showMap(page: Page) {
  await page.locator(".room-map.is-closed").getByRole("button", { name: "Map", exact: true }).click();
  await expect(map(page)).toBeVisible();
}

/** Where a spot on the floor shows on the round map, which turns with the view, in page pixels. */
async function onMap(page: Page, x: number, z: number) {
  return map(page)
    .locator(".map-world")
    .evaluate((g, [px, pz]) => {
      const p = new DOMPoint(px, pz).matrixTransform((g as SVGGraphicsElement).getScreenCTM()!);
      return { x: p.x, y: p.y };
    }, [x, z] as const);
}

/** A view from the avatar has the mouse: Escape gives the cursor back, so the page's controls can be clicked. */
async function freeCursor(page: Page) {
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => document.pointerLockElement)).toBeNull();
  // Escape so soon after letting go is still taken as letting go.
  await page.waitForTimeout(300);
}

const lockedTo = (page: Page) => page.evaluate(() => document.pointerLockElement?.tagName ?? null);

test.describe("a player who has not chosen a view", () => {
  test.use({ overviewChosen: false });

  test("opens following the avatar with the mouse, keeps it through a reading but not a dialog, and opens as chosen once a view is chosen", async ({ page }) => {
    await open(page);
    await expect(page.locator(".view-overlay")).toHaveAttribute("data-viewpoint", "follow");
    await expect(option(page, "Follow")).toHaveAttribute("aria-pressed", "true");
    // Continue's click took the mouse there and then. Opening there was not a choice, so none is remembered.
    await expect.poll(() => lockedTo(page)).toBe("CANVAS");
    expect((await exploration(page))?.viewChosen ?? false).toBe(false);
    // An inspection's reading is the room answering a click: looking round carries on through it.
    await page.evaluate(() => {
      const reading = document.createElement("section");
      reading.setAttribute("role", "dialog");
      reading.className = "inspection-reveal";
      reading.id = "reading";
      document.body.append(reading);
    });
    await page.waitForTimeout(300);
    expect(await lockedTo(page)).toBe("CANVAS");
    await page.evaluate(() => document.getElementById("reading")?.remove());
    // A dialog arriving over the room, as a guide's card or a confirmation would, gets the cursor to reach it.
    await page.evaluate(() => {
      const card = document.createElement("section");
      card.setAttribute("role", "dialog");
      card.id = "arrived";
      document.body.append(card);
    });
    await expect.poll(() => lockedTo(page)).toBeNull();
    await expect(page.getByRole("group", { name: "Mouse look paused" })).toBeVisible();
    await page.evaluate(() => document.getElementById("arrived")?.remove());
    // Ending the walk is a choice, so the next visit opens in the overview.
    await page.getByRole("group", { name: "Mouse look paused" }).getByRole("button", { name: "Exit follow" }).click();
    await expect(option(page, "Overview")).toHaveAttribute("aria-pressed", "true");
    expect(await exploration(page)).toMatchObject({ walking: false, viewpoint: "overview", viewChosen: true });
    await page.reload();
    await page.getByRole("button", { name: "Continue week 2" }).click();
    await expectRoom(page);
    await expect(stage(page)).toHaveAttribute("data-camera", "overview");
    await expect(page.locator(".view-overlay")).toHaveCount(0);
  });
});

test("V goes from the overview to follow and first person and back, and Escape only gives the cursor back, leaving Exit to end the walk", async ({ page }) => {
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
  // Into follow again: Escape gives the cursor back, and Escape again changes nothing. Exit ends the walk and the view.
  await page.keyboard.press("v");
  await expect(stage(page)).toHaveAttribute("data-camera", "perspective");
  await freeCursor(page);
  const paused = page.getByRole("group", { name: "Mouse look paused" });
  await expect(paused).toBeVisible();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await expect(stage(page)).toHaveAttribute("data-camera", "perspective");
  await expect(option(page, "Follow")).toHaveAttribute("aria-pressed", "true");
  await paused.getByRole("button", { name: "Exit follow" }).click();
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

test("first person looks round with the mouse as it opens, Escape gives the cursor back with a way out, and a click takes the mouse again without walking", async ({ page }) => {
  await open(page);
  await stage(page).focus();
  await page.keyboard.press("v");
  await page.keyboard.press("v");
  await expect(page.locator(".view-dot")).toBeVisible();
  // V took the mouse there and then: no click is needed to look round.
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName ?? null)).toBe("CANVAS");
  await expect(page.locator(".view-hint")).toContainText("Move the mouse to look around");
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => document.pointerLockElement)).toBeNull();
  const paused = page.getByRole("group", { name: "Mouse look paused" });
  await expect(paused).toBeVisible();
  expect(await exploration(page)).toMatchObject({ walking: true, viewpoint: "first" });
  // A click low in the room, where it would otherwise walk the avatar across the floor, only takes the mouse back.
  const canvas = (await stage(page).locator("canvas").boundingBox())!;
  // Chrome refuses the mouse for a moment after Escape releases it; the card stays, so a player clicks again.
  await expect(async () => {
    if (await paused.isVisible()) await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height * 0.8);
    expect(await page.evaluate(() => document.pointerLockElement?.tagName ?? null)).toBe("CANVAS");
  }).toPass({ intervals: [300, 600, 1000] });
  await expect(paused).toHaveCount(0);
  await expect(map(page).locator(".map-destination")).toHaveCount(0);
  // The card's Exit leaves first person for the overview.
  await page.keyboard.press("Escape");
  await expect(paused).toBeVisible();
  await paused.getByRole("button", { name: /^Exit first person/ }).click();
  await expect(page.locator(".view-dot")).toHaveCount(0);
  await expect(option(page, "Overview")).toHaveAttribute("aria-pressed", "true");
  expect(await exploration(page)).toMatchObject({ walking: false, viewpoint: "overview" });
});

test("Escape closes an inspection quietly before Escape shows the paused mouse card", async ({ page }) => {
  test.slow();
  await open(page);
  await stage(page).focus();
  await page.keyboard.press("v");
  await page.keyboard.press("v");
  await expect.poll(() => lockedTo(page)).toBe("CANVAS");
  await equipmentLabel(page, "Monitoring").evaluate((button) => (button as HTMLButtonElement).click());
  const reveal = page.getByRole("dialog", { name: "Monitoring", exact: true });
  await expect(reveal).toBeVisible({ timeout: 40_000 });
  await page.keyboard.press("Escape");
  await expect(reveal).toHaveCount(0);
  const paused = page.getByRole("group", { name: "Mouse look paused" });
  await expect(paused).toHaveCount(0);
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  await expect(paused).toBeVisible();
});

test("where the browser will not hand over the mouse, first person turns towards where it points, with no card", async ({ page }) => {
  // As an embedded browser may: every request to lock the pointer is refused.
  await page.addInitScript(() => {
    HTMLElement.prototype.requestPointerLock = function () {
      return Promise.reject(new DOMException("Pointer lock is not allowed here", "NotAllowedError"));
    } as typeof HTMLElement.prototype.requestPointerLock;
  });
  await open(page);
  await showMap(page);
  await stage(page).focus();
  await page.keyboard.press("v");
  await page.keyboard.press("v");
  await expect(page.locator(".view-dot")).toBeVisible();
  await expect(page.locator(".view-hint")).toContainText("Move the mouse to look around");
  await expect(page.getByRole("group", { name: "Mouse look paused" })).toHaveCount(0);
  // Wait for ResizeObserver to fit the canvas after Classic's sidebar appears.
  // CI captured the old 1440px width at x=280, sending the edge pointer to x=1716 outside the viewport.
  await expect.poll(() => stage(page).locator("canvas").evaluate(node => {
    const box = node.getBoundingClientRect(), host = node.closest(".stage-canvas")!.getBoundingClientRect();
    return box.width > 0 && Math.abs(box.width - host.width) < 1 && Math.abs(box.height - host.height) < 1 && box.right <= Math.min(innerWidth, host.right) && box.bottom <= Math.min(innerHeight, host.bottom);
  })).toBe(true);
  // Resting in the middle of the view keeps it still; pointing near the right edge turns it, as the map's arrow shows.
  const canvas = (await stage(page).locator("canvas").boundingBox())!;
  const arrow = map(page).locator(".map-avatar");
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  // The avatar may first finish turning to face the way the view looks; after that the view rests.
  let still: string | null = null;
  await expect
    .poll(
      async () => {
        const before = await arrow.getAttribute("transform");
        await page.waitForTimeout(600);
        still = await arrow.getAttribute("transform");
        return still === before;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  const edge = { x: canvas.x + canvas.width - 4, y: canvas.y + canvas.height / 2 };
  await expect.poll(() => stage(page).locator("canvas").evaluate((node, point) => document.elementFromPoint(point.x, point.y) === node, edge)).toBe(true);
  await page.mouse.move(edge.x, edge.y);
  await expect.poll(() => arrow.getAttribute("transform"), { timeout: 10_000 }).not.toBe(still);
  // The hint's Exit leaves first person.
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await page.locator(".view-hint").getByRole("button", { name: "Exit first person" }).click();
  await expect(page.locator(".view-dot")).toHaveCount(0);
  await expect(option(page, "Overview")).toHaveAttribute("aria-pressed", "true");
});

test("seen from the avatar the elevator simply rides, without the overview's cutscene", async ({ page }) => {
  await open(page);
  await showMap(page);
  await stage(page).focus();
  await page.keyboard.press("v");
  await expect(stage(page)).toHaveAttribute("data-camera", "perspective");
  await page.keyboard.press("PageUp");
  // Through the whole ride the dimming and passing shaft stay away.
  const dims: number[] = [];
  for (let i = 0; i < 8; i++) {
    dims.push(await page.locator(".ride-dip").evaluate((el) => Number(getComputedStyle(el).opacity)));
    await page.waitForTimeout(500);
  }
  expect(Math.max(...dims)).toBe(0);
  await expect(map(page).getByRole("button", { name: /^Office/ })).toHaveAttribute("aria-pressed", "true", { timeout: 20_000 });
  await expect(where(page)).toHaveText("Elevator", { timeout: 20_000 });
});

test("a new graphics quality in follow redraws the room and leaves the overview turning as before", async ({ page }) => {
  await open(page);
  await stage(page).focus();
  await page.keyboard.press("v");
  await expect(stage(page)).toHaveAttribute("data-camera", "perspective");
  await freeCursor(page);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await menu.getByRole("tab", { name: "Graphics" }).click();
  await menu.getByRole("radio", { name: "Low" }).check();
  await menu.getByRole("button", { name: "Close" }).click();
  // The new canvas picks up the view from the avatar it was in.
  await expect(stage(page)).toHaveAttribute("data-camera", "perspective");
  await page.getByRole("group", { name: "Mouse look paused" }).getByRole("button", { name: "Exit follow" }).click();
  await expect(stage(page)).toHaveAttribute("data-camera", "overview");
  await stage(page).focus();
  // The overview's own controls still turn the new canvas's camera.
  const label = page.locator('.eq-label[data-eq="db"]');
  await expect(label).toBeVisible();
  const before = (await label.boundingBox())!;
  await page.keyboard.press("e");
  await expect.poll(async () => Math.abs(((await label.boundingBox())?.x ?? before.x) - before.x)).toBeGreaterThan(20);
});

test("the first-person view picks up again after a reload, with walk mode", async ({ page }) => {
  await open(page);
  await page.locator(".view-mode-menu > summary").click();
  await option(page, "First person").click();
  await expect(page.locator(".view-dot")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Continue week 2" }).click();
  // A first-person room after a reload can take longer than the default to mount on a CI runner's software WebGL.
  await expectRoom(page, 30_000);
  await expect(page.locator(".view-dot")).toBeVisible();
  await expect(stage(page)).toHaveAttribute("data-camera", "perspective");
});

test("the map starts folded, says where the avatar is, changes floor from its tabs, and walks the avatar where it is clicked", async ({ page }) => {
  await open(page);
  await expect(map(page)).toHaveCount(0);
  await showMap(page);
  // Before walking, the avatar sits in the founder's chair upstairs.
  await expect(where(page)).toHaveText("Meeting room, office floor");
  await expect(map(page).getByRole("button", { name: /^Servers/ })).toHaveAttribute("aria-pressed", "true");
  await stage(page).focus();
  await page.keyboard.press("v");
  await expect(where(page)).toHaveText("Elevator");
  // Follow takes the mouse as it opens; the map is clicked with the cursor back.
  await freeCursor(page);
  await map(page).getByRole("button", { name: /^Office/ }).click();
  await expect(map(page).getByRole("button", { name: /^Office/ })).toHaveAttribute("aria-pressed", "true");
  // The map only walks the avatar once the elevator has arrived.
  await expect(where(page)).toHaveText(/^In the elevator/);
  await expect(where(page)).toHaveText("Elevator", { timeout: 20_000 });
  await expect(page.locator(".room-menu > summary .floor-number")).toHaveText("7");
  const lounge = await onMap(page, 18.25, 6.2);
  await page.mouse.click(lounge.x, lounge.y);
  await expect(map(page).locator(".map-destination")).toHaveCount(1);
  await expect(where(page)).toHaveText("Lounge", { timeout: 20_000 });
  expect(await events(page, "map_walked")).toHaveLength(1);
  expect((await events(page, "floor_switched")).map((d) => d?.how)).toContain("map");
  // Folded away, it stays folded after a reload.
  await map(page).getByRole("button", { name: "Hide map" }).click();
  await expect(map(page)).toHaveCount(0);
  await page.reload();
  // Back on the office floor, where the walk left it.
  await page.getByRole("button", { name: "Continue week 2" }).click();
  await expect(page.locator(".room-map.is-closed").getByRole("button", { name: "Map" })).toBeVisible();
  expect((await events(page, "map_toggled")).map((d) => d?.open)).toEqual([true, false]);
});

test("the menu's map finds equipment and places, and sends the room to them", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await menu.getByRole("tab", { name: "Map" }).click();
  const plan = page.getByRole("region", { name: "Floor plan" });
  await expect(plan).toBeVisible();
  await expect(page.getByRole("group", { name: "Map floor" }).getByRole("button", { name: /^Server floor/ })).toHaveAttribute("aria-pressed", "true");
  // The search looks on both floors and the match carries its floor's name.
  await plan.getByRole("searchbox", { name: "Find on the map" }).fill("lounge");
  const matches = page.getByRole("region", { name: "Matches" });
  await matches.getByRole("button", { name: /^Lounge/ }).click();
  await expect(page.getByRole("group", { name: "Map floor" }).getByRole("button", { name: /^Office floor/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "Selected place" })).toContainText("Lounge");
  // Back downstairs, a piece of equipment's card opens the room on it.
  await plan.getByRole("searchbox", { name: "Find on the map" }).fill("");
  await page.getByRole("group", { name: "Map floor" }).getByRole("button", { name: /^Server floor/ }).click();
  await page.getByRole("region", { name: "Places on this floor" }).getByRole("button", { name: /^Database/ }).click();
  await page.getByRole("group", { name: "Selected place" }).getByRole("button", { name: "Show in room" }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Database" })).toBeVisible();
  await expect(page.locator(".room-menu > summary .floor-number")).toHaveText("6");
});
