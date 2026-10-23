import type { Locator, Page } from "@playwright/test";
import { advanceTurn, newGame, newLegacyGame } from "../src/sim";
import { advanceSteps } from "../src/sim/step";
import { reliabilityCompany } from "../src/sim/__tests__/reliabilityFixture";
import { expect, expectRoom, openPanelTab, seedClassicSave, seedSave, test, unlockChallenge } from "./fixtures";

/*
 * The phone edition's layout regions on a touch phone (Pixel 7): the top strip, the System metrics sheet, the dock
 * and its menus, in Guided Mode and Challenge Mode. Reduced motion makes the sheet snap, so its geometry can be read
 * straight after a tap.
 */

const sheet = (page: Page) => page.locator(".phone-sheet");
const handle = (page: Page) => page.getByRole("button", { name: "System metrics", exact: true });
const dock = (page: Page) => page.locator(".phone-dock");

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("Element has no box");
  return b;
}

/** The room the player can see: from the top strip's bottom to the sheet's top edge. */
async function visibleRoom(page: Page) {
  const top = await box(page.locator(".phone-top"));
  const edge = await box(sheet(page));
  return edge.y - (top.y + top.height);
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
}

async function openGuided(page: Page, size: { width: number; height: number }, game = newGame(1, "phone-layout")) {
  await page.setViewportSize(size);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/**", route => route.abort());
  await seedSave(page, game);
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).tap();
  // The phone shell loads on demand and a Company Message may open first, so the first paint gets a longer budget.
  await expect(handle(page)).toBeVisible({ timeout: 30_000 });
}

async function openChallenge(page: Page, size: { width: number; height: number }) {
  await page.setViewportSize(size);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/**", route => route.abort());
  await unlockChallenge(page);
  await seedClassicSave(page, advanceTurn(newLegacyGame(1)));
  await page.goto("/");
  await page.getByRole("button", { name: /^Continue week/ }).tap();
  // The phone shell loads on demand and a Company Message may open first, so the first paint gets a longer budget.
  await expect(handle(page)).toBeVisible({ timeout: 30_000 });
}

for (const size of [{ width: 390, height: 844 }, { width: 360, height: 640 }]) {
  test(`Guided Mode at ${size.width}×${size.height}: the room keeps at least 40% at peek and the sheet snaps peek, half, full`, async ({ page, withoutRoom }) => {
    await withoutRoom();
    await openGuided(page, size);
    await expect(sheet(page)).toHaveAttribute("data-state", "peek");
    await expect(handle(page)).toHaveAttribute("aria-expanded", "false");
    expect(await visibleRoom(page)).toBeGreaterThanOrEqual(size.height * 0.4);
    // Peek: the three headline readings, not the panel.
    const summary = page.locator(".phone-sheet-summary");
    await expect(summary).toContainText("ms");
    await expect(summary).toContainText("%");
    const metrics = page.getByRole("complementary", { name: "System metrics" });
    await expect(metrics).toBeHidden();

    await handle(page).tap();
    await expect(sheet(page)).toHaveAttribute("data-state", "half");
    await expect(handle(page)).toHaveAttribute("aria-expanded", "true");
    await expect(metrics).toBeVisible();
    const room = size.height - (await box(page.locator(".phone-top"))).height - (await box(dock(page))).height;
    expect((await box(sheet(page))).height).toBeCloseTo(room / 2, -1);

    await handle(page).tap();
    await expect(sheet(page)).toHaveAttribute("data-state", "full");
    expect((await box(sheet(page))).height).toBeGreaterThan(room * 0.9);
    // The dock stays on screen and the canvas never changed size.
    await expect(page.getByRole("button", { name: "Run", exact: true })).toBeInViewport({ ratio: 1 });

    await handle(page).tap();
    await expect(sheet(page)).toHaveAttribute("data-state", "peek");

    // The keyboard opens and closes it too.
    await handle(page).focus();
    await page.keyboard.press("ArrowUp");
    await expect(sheet(page)).toHaveAttribute("data-state", "half");
    await page.keyboard.press("ArrowDown");
    await expect(sheet(page)).toHaveAttribute("data-state", "peek");
    await expectNoHorizontalOverflow(page);
  });
}

test("Guided Mode: choosing equipment in the room opens the sheet to half on that equipment", async ({ page }) => {
  await openGuided(page, { width: 390, height: 844 });
  await expectRoom(page);
  await expect(sheet(page)).toHaveAttribute("data-state", "peek");
  await page.getByRole("main").getByRole("button", { name: "Servers", exact: true }).tap();
  await expect(sheet(page)).toHaveAttribute("data-state", "half");
  await expect(page.locator(".phone-sheet-summary")).toContainText("App Server");
  await expect(page.getByRole("complementary", { name: "System metrics" }).getByRole("button", { name: "App Server", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("Guided Mode incident: the sheet stays at least half open with every response and the quote's decision in reach", async ({ page, withoutRoom }) => {
  await withoutRoom();
  await openGuided(page, { width: 390, height: 844 }, advanceSteps(newGame(1, "phone-layout-incident"), 6).state);
  await expect(page.locator(".phone-top")).toHaveClass(/is-incident/);
  await expect(sheet(page)).toHaveAttribute("data-state", "half");
  await expect(page.locator(".phone-sheet-summary")).toContainText("Incident");
  // The handle goes between half and full, never back to peek, while the incident lasts.
  await handle(page).tap();
  await expect(sheet(page)).toHaveAttribute("data-state", "full");
  await handle(page).tap();
  await expect(sheet(page)).toHaveAttribute("data-state", "half");

  const panel = page.getByRole("complementary", { name: "System metrics" });
  await expect(panel.getByRole("region", { name: "Incident recovery" })).toBeVisible();
  await openPanelTab(page, "Actions");
  for (const name of [/Add server/, /Upgrade database/, /Limit to 500 requests\/s/]) {
    const response = panel.getByRole("button", { name });
    await response.scrollIntoViewIfNeeded();
    // Inside the sheet's own scroll area, clipped by it like any other reader would be.
    await expect(response).toBeInViewport({ ratio: 0.95 });
    await expect(response).toBeEnabled();
  }
  // The quote opens as a sheet of its own over the room, with Confirm and Cancel pinned above the dock.
  await panel.getByRole("button", { name: /Upgrade database/ }).tap();
  const confirm = page.getByRole("button", { name: "Confirm", exact: true });
  const cancel = page.getByRole("button", { name: "Cancel", exact: true });
  await expect(confirm).toBeInViewport({ ratio: 1 });
  await expect(cancel).toBeInViewport({ ratio: 1 });
  expect((await box(cancel)).y + (await box(cancel)).height).toBeLessThanOrEqual((await box(dock(page))).y);
  await expect(sheet(page)).toBeHidden();
  await cancel.tap();
  await expect(sheet(page)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("Guided Mode: a new panel tab opens at the top of the sheet, not where the last one was scrolled", async ({ page, withoutRoom }) => {
  await withoutRoom();
  // Stay Online's Actions are long enough to scroll well down, and so are the Database's readings on Analysis.
  await openGuided(page, { width: 390, height: 844 }, reliabilityCompany());
  await expect(sheet(page)).toHaveAttribute("data-state", "peek");
  await handle(page).tap();
  await handle(page).tap();
  await expect(sheet(page)).toHaveAttribute("data-state", "full");
  const panel = page.getByRole("complementary", { name: "System metrics" }), body = page.locator(".phone-sheet-body");
  await openPanelTab(page, "Analysis");
  await panel.getByRole("button", { name: "Database", exact: true }).tap();
  await openPanelTab(page, "Actions");
  await body.evaluate(el => el.scrollTo({ top: 300 }));
  await expect.poll(() => body.evaluate(el => el.scrollTop)).toBe(300);
  // A finger taps the switch where it is stuck; Playwright's own tap would first scroll it to where it sits unstuck.
  const analysis = await box(page.getByRole("tab", { name: "Analysis" }));
  await page.touchscreen.tap(analysis.x + analysis.width / 2, analysis.y + analysis.height / 2);
  await expect(page.getByRole("tab", { name: "Analysis" })).toHaveAttribute("aria-selected", "true");
  await expect.poll(() => body.evaluate(el => el.scrollTop)).toBe(0);
  await expect(panel.getByRole("region", { name: "Database readings" })).toBeVisible();
});

test("Guided Mode: inspecting equipment keeps the sheet's place and shows its readings", async ({ page, withoutRoom }) => {
  await withoutRoom();
  await openGuided(page, { width: 390, height: 844 }, advanceSteps(newGame(1, "phone-layout-inspect"), 6).state);
  await handle(page).tap();
  await expect(sheet(page)).toHaveAttribute("data-state", "full");
  const panel = page.getByRole("complementary", { name: "System metrics" }), body = page.locator(".phone-sheet-body");
  for (const [chip, readings] of [["Network", "Network"], ["App Server", "Servers"], ["Database", "Database"], ["Monitoring", "Monitoring"]]) {
    const button = panel.getByRole("button", { name: chip, exact: true });
    await button.evaluate(el => el.scrollIntoView({ block: "center" }));
    const before = await body.evaluate(el => el.scrollTop);
    expect(before).toBeGreaterThan(0);
    await button.tap();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(panel.getByRole("region", { name: `${readings} readings` })).toBeInViewport();
    await expect(button).toBeInViewport();
    expect(await body.evaluate(el => el.scrollTop)).toBeGreaterThanOrEqual(before);
  }
});

test("Guided Mode top strip: Cash stays visible, users and pending revenue are one tap away, and the chapter row counts the phone's chapters", async ({ page, withoutRoom }) => {
  await withoutRoom();
  await openGuided(page, { width: 360, height: 640 });
  const top = page.getByRole("banner");
  const cash = top.getByRole("button", { name: "View finances", exact: true });
  await expect(cash).toBeInViewport({ ratio: 1 });
  await expect(cash.locator(".concept")).toBeVisible();
  await expect(top.getByRole("button", { name: "View app health", exact: true })).toBeInViewport({ ratio: 1 });
  for (const name of ["Users and revenue", "Mute sound", "Menu"]) {
    const control = top.getByRole("button", { name, exact: true });
    await expect(control).toBeInViewport({ ratio: 1 });
    expect((await box(control)).width).toBeGreaterThanOrEqual(44);
  }

  const toggle = top.getByRole("button", { name: "Users and revenue", exact: true });
  await toggle.tap();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const numbers = page.getByRole("region", { name: "Company numbers" });
  await expect(numbers).toContainText("Users");
  await expect(numbers).toContainText("Pending revenue");
  await expect(numbers).toContainText("Not cash yet");
  await page.keyboard.press("Escape");
  await expect(numbers).toBeHidden();
  await expect(toggle).toBeFocused();

  const chapters = page.getByRole("region", { name: "Guided Mode chapters" });
  await expect(chapters).toContainText("Chapter 1 of 2");
  await expect(page.getByLabel("Current chapter", { exact: true })).toHaveText("Opening");
  await chapters.getByRole("button", { name: "View chapters", exact: true }).tap();
  const overview = page.getByRole("dialog", { name: "Guided Mode chapters" });
  await expect(overview.locator(".chapter-overview > li")).toHaveCount(3);
  await expect(overview).toContainText("play two chapters");
  await overview.getByRole("button", { name: "Back to company", exact: true }).tap();
  await expect(overview).toBeHidden();
  await expectNoHorizontalOverflow(page);
});

for (const mode of ["Guided", "Challenge"] as const) {
  test(`${mode} Mode dock at 320×568: one row of 44 px targets, with the speed menu one tap away and above the dock`, async ({ page }) => {
    const size = { width: 320, height: 568 };
    if (mode === "Guided") await openGuided(page, size); else await openChallenge(page, size);
    // Navigation comes with the room.
    await expectRoom(page);
    await expect(dock(page).locator(".room-menu > summary")).toBeVisible();
    const bar = await box(dock(page));
    expect(bar.height).toBeLessThanOrEqual(60);
    expect(bar.width).toBeLessThanOrEqual(size.width);
    const targets = dock(page).locator(":scope button:visible, :scope details > summary:visible");
    const count = await targets.count();
    // Views, Navigation, speed and the primary action.
    expect(count).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < count; i++) {
      const target = await box(targets.nth(i));
      expect(target.width, `dock target ${i}`).toBeGreaterThanOrEqual(44);
      expect(target.height, `dock target ${i}`).toBeGreaterThanOrEqual(44);
      expect(target.y, `dock target ${i} sits in the one row`).toBeGreaterThanOrEqual(bar.y);
      expect(target.x + target.width).toBeLessThanOrEqual(size.width);
    }
    // The room keeps at least 40% at peek on the smallest phone too.
    expect(await visibleRoom(page)).toBeGreaterThanOrEqual(size.height * 0.4);

    const speed = dock(page).locator(".time-menu > summary");
    const before = await box(speed);
    await speed.tap();
    const speeds = page.getByRole("group", { name: "Game speed" });
    await expect(speeds).toBeInViewport({ ratio: 1 });
    const panel = await box(dock(page).locator(".time-menu .dock-panel"));
    expect(panel.y + panel.height).toBeLessThanOrEqual(bar.y);
    expect(await box(speed)).toEqual(before);
    if (mode === "Guided") await expect(dock(page).getByRole("button", { name: "End the week at 20 times speed", exact: true })).toBeInViewport({ ratio: 1 });
    await speeds.getByRole("button", { name: "2×", exact: true }).tap();
    await expect(speed).toContainText("2×");
    await expect(speed).toHaveJSProperty("offsetWidth", Math.round(before.width));
    await expectNoHorizontalOverflow(page);
  });
}

test("Challenge Mode: equipment and weekly operations share the sheet, and the views open between the strip and the dock", async ({ page, withoutRoom }) => {
  await withoutRoom();
  await openChallenge(page, { width: 360, height: 640 });
  await expect(sheet(page)).toHaveAttribute("data-state", "peek");
  expect(await visibleRoom(page)).toBeGreaterThanOrEqual(640 * 0.4);
  await handle(page).tap();
  await expect(sheet(page)).toHaveAttribute("data-state", "half");
  await expect(page.getByRole("complementary", { name: "Details" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Operations" })).toBeAttached();
  await expect(page.getByRole("button", { name: "Next week", exact: true })).toBeInViewport({ ratio: 1 });

  // Tech, Team and History fold into Views where they do not fit beside the time controls.
  const views = dock(page).locator(".phone-views-menu > summary");
  if (await views.isVisible()) await views.tap();
  await dock(page).getByRole("button", { name: "Tech", exact: true }).tap();
  const tree = page.getByRole("region", { name: "Tech tree" });
  await expect(tree).toBeVisible();
  const view = await box(tree);
  expect(view.y).toBeGreaterThanOrEqual((await box(page.locator(".phone-top"))).height);
  expect(view.y + view.height).toBeLessThanOrEqual((await box(dock(page))).y);
  await tree.getByRole("button", { name: "Close", exact: true }).tap();
  await expect(tree).toBeHidden();
  await expectNoHorizontalOverflow(page);
});

for (const size of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) test(`Hint in the chapter row leads to the action on a ${size.width}px phone`, async ({ page, installClock }, info) => {
  await installClock();
  const game = advanceSteps(newGame(), 6).state;
  await openGuided(page, size, game);
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 60_000));
  // Hint sits in the Guided Mode chapter row, so the strip keeps Cash and App Health readable at 320px.
  const row = page.locator(".phone-chapter-row");
  const hint = row.getByRole("button", { name: "Hint", exact: true });
  await expect(hint).toBeInViewport({ ratio: 1 });
  for (const name of ["View finances", "View app health"]) {
    const value = page.locator(".phone-top").getByRole("button", { name }).locator(".stat-body > strong");
    expect(await value.evaluate(el => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  }
  await hint.tap();
  const card = page.getByRole("dialog", { name: "Hint", exact: true });
  await expect(card).toBeInViewport({ ratio: 1 });
  await expect(card).toContainText("Your database is overloaded");
  await card.getByRole("button", { name: "Got it" }).tap();
  // An incident holds the sheet half open, so the gold mark lands on the action itself.
  await expect(handle(page)).toHaveAttribute("aria-expanded", "true");
  const target = page.locator(".campaign-gold-attention");
  await expect(target).toHaveCount(1);
  await expect(target).toHaveAccessibleName(/^Upgrade database/);
  await expect(target).toBeInViewport({ ratio: 1 });
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: info.outputPath(`hint-phone-${size.width}.png`) });
});
