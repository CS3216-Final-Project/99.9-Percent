import type { Locator, Page } from "@playwright/test";
import { test, expect, expectRoom, seedSave, savedGame, savedClassicGame, unlockChallenge } from "./fixtures";
import { applyAction, newGame, type GameState } from "../src/sim";
import { advanceSteps, applyCampaignInput, step } from "../src/sim/step";

/*
 * The phone edition's coach strip (Pixel 7, touch). Launch Week's spotlight steps dock in one fixed-size strip above
 * the dock, so the room keeps at least 40% of the screen and each step's real control stays in view and uncovered.
 * The dock carries the speed menu and End week beside Run.
 */

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;
const box = async (locator: Locator) => (await locator.boundingBox())!;
/** Whether `inner` lies within `outer`, to a pixel. */
const inside = (inner: Box, outer: Box) => inner.x >= outer.x - 1 && inner.y >= outer.y - 1 && inner.x + inner.width <= outer.x + outer.width + 1 && inner.y + inner.height <= outer.y + outer.height + 1;
const SHOTS = process.env.PHONE_TUTORIAL_SHOTS ?? "test-results";

/** The share of the screen's height where the room shows: rows whose centre and quarter points reach the stage. */
function roomShare(page: Page) {
  return page.evaluate(() => {
    const stage = document.querySelector("main.stage");
    if (!stage) return 0;
    let rows = 0;
    for (let y = 2; y < window.innerHeight; y += 4) {
      const xs = [0.25, 0.5, 0.75].map(f => window.innerWidth * f);
      if (xs.every(x => stage.contains(document.elementFromPoint(x, y)))) rows++;
    }
    return rows * 4 / window.innerHeight;
  });
}

/** Whether every sampled point of the element is the element itself (nothing on top of it) and on screen. */
function uncovered(locator: Locator) {
  return locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.left < 0 || r.bottom > window.innerHeight + 0.5 || r.right > window.innerWidth + 0.5) return false;
    return [[0.5, 0.5], [0.1, 0.2], [0.9, 0.2], [0.1, 0.8], [0.9, 0.8]].every(([fx, fy]) => {
      const hit = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
      return !!hit && (el.contains(hit) || hit.contains(el));
    });
  });
}

const launchStep = (page: Page) => page.getByRole("region", { name: "Launch Week tutorial" });
const dockBox = (page: Page) => box(page.locator(".phone-dock").first());

/** Advance a Launch Week company in the simulation until `cond` holds. */
function runUntil(s: GameState, cond: (s: GameState) => boolean, cap = 200): GameState {
  for (let i = 0; i < cap && !cond(s) && s.phase !== "ended"; i++) {
    if (s.phase === "review") { const r = applyCampaignInput(s, { type: "acknowledge_review" }); if (!r.result.ok) throw Error(r.result.message); s = r.state; }
    else s = step(s).state;
  }
  return s;
}

async function boot(page: Page, game: GameState) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/**", route => route.abort());
  await seedSave(page, game);
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).tap();
  await expectRoom(page);
}

/** The strip sits directly above the dock, at the strip's fixed height, and never covers the lit control. */
async function expectDocked(page: Page, width: number) {
  const strip = await box(launchStep(page));
  const dock = await dockBox(page);
  expect(strip.height).toBeLessThanOrEqual(150);
  expect(strip.y + strip.height).toBeLessThanOrEqual(dock.y + 1);
  expect(dock.y - (strip.y + strip.height)).toBeLessThanOrEqual(12);
  expect(strip.x).toBeGreaterThanOrEqual(0);
  expect(strip.x + strip.width).toBeLessThanOrEqual(width + 0.5);
  const lit = page.locator("[data-spotlight]").first();
  if (await lit.count()) {
    await expect(lit).toBeInViewport();
    expect(overlaps(strip, await box(lit))).toBe(false);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

for (const [width, height] of [[390, 844], [360, 640], [320, 568]]) {
  test(`Launch Week docks its spotlight steps above the dock, with speeds and End week in the dock, at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await boot(page, newGame(7, `phone-lw-${width}`, 2));
    await page.getByRole("button", { name: "Open the doors", exact: true }).tap();
    // The first step lights Run, which stays in view and uncovered beside the strip.
    await expect(launchStep(page)).toContainText("launch week starts now");
    const run = page.locator(".phone-dock").getByRole("button", { name: "Run", exact: true });
    await expect(page.locator("[data-spotlight]")).toHaveAccessibleName("Run");
    await expect(run).toBeInViewport({ ratio: 1 });
    expect(await uncovered(run)).toBe(true);
    await expectDocked(page, width);
    // The dock shows End week beside Run; the three speeds are one tap away in the speed menu.
    const rush = page.getByRole("button", { name: "End the week at 20 times speed" });
    await expect(rush).toBeInViewport({ ratio: 1 });
    expect((await box(rush)).height).toBeGreaterThanOrEqual(44);
    const dock = await dockBox(page);
    expect((await box(rush)).y).toBeGreaterThanOrEqual(dock.y - 1);
    await page.locator(".phone-dock .time-menu > summary").tap();
    const speeds = page.getByRole("group", { name: "Game speed" });
    for (const label of ["0.5×", "1×", "2×"]) await expect(speeds.getByRole("button", { name: label, exact: true })).toBeVisible();
    await speeds.getByRole("button", { name: "2×", exact: true }).tap();
    await page.locator(".phone-dock .time-menu > summary").tap();
    await page.screenshot({ path: `${SHOTS}/phone-launch-run-${width}x${height}.png` });
    await expect.poll(() => roomShare(page)).toBeGreaterThanOrEqual(0.4);
    // Run follows the spotlight; the step clears while the clock runs.
    await run.tap();
    await expect(launchStep(page)).toBeHidden();
    await expect(page.locator(".phone-dock").getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  });
}

test("the database incident is taught from the same strip, and End week rushes the clock by touch", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page, runUntil(newGame(7, "phone-lw-incident", 2), s => !!s.campaign!.incident));
  // The incident pauses the company and the strip points at the database, never at the app server.
  await expect(launchStep(page)).toBeVisible();
  await expect(launchStep(page)).toContainText("Choose Database under Inspect equipment");
  // The sheet stands above the strip and scrolls the Database inspect control into view, lit and uncovered.
  const lit = page.locator("[data-spotlight]");
  await expect(lit).toHaveCount(1);
  await expect(lit).toHaveAttribute("data-tutorial", "inspect-db");
  await expect(lit).toBeInViewport({ ratio: 1 });
  expect(await uncovered(lit)).toBe(true);
  expect(overlaps(await box(launchStep(page)), await box(lit))).toBe(false);
  await expectDocked(page, 390);
  await page.screenshot({ path: `${SHOTS}/phone-launch-incident-390x844.png` });
  const saved = await savedGame(page);
  expect(saved.campaign!.incident).toBeTruthy();
});

test("End week rushes a stable Launch Week by touch", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  let s = runUntil(newGame(7, "phone-lw-rush", 2), x => !!x.campaign!.incident);
  const r = applyCampaignInput(s, { type: "start_db_upgrade" });
  if (!r.result.ok) throw Error(r.result.message);
  s = runUntil(r.state, x => x.phase === "management" && !x.campaign!.incident && x.campaign!.step >= 20);
  await boot(page, s);
  const rush = page.getByRole("button", { name: "End the week at 20 times speed" });
  await expect(rush).toBeEnabled();
  await rush.tap();
  await expect(rush).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await savedGame(page)).campaign!.step, { timeout: 20_000 }).toBeGreaterThan(s.campaign!.step);
});

function act(g: GameState, action: Parameters<typeof applyAction>[1]) { const r = applyAction(g, action); if (!r.ok) throw Error(r.message); return r.state; }

test("a chapter guide uses the same coach strip above the dock", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/**", route => route.abort());
  const recovered = advanceSteps(act(advanceSteps(newGame(1, "phone-chapter-guide"), 6).state, { type: "start_db_upgrade" }), 30).state;
  await seedSave(page, act(recovered, { type: "acknowledge_review" }), { chapterTours: [] });
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).tap();
  await page.getByRole("dialog", { name: "First growth challenge handled" }).getByRole("button", { name: "Continue to Scaling & Routing" }).tap();
  const guide = page.getByRole("dialog", { name: "Chapter guide, step 1 of 1" });
  await expect(guide).toContainText("Scale and route");
  const strip = await box(guide);
  const dock = await box(page.locator(".phone-dock, .bottombar").first());
  expect(strip.height).toBeLessThanOrEqual(150);
  expect(strip.y + strip.height).toBeLessThanOrEqual(dock.y + 1);
  expect(dock.y - (strip.y + strip.height)).toBeLessThanOrEqual(12);
  const got = guide.getByRole("button", { name: "Got it", exact: true });
  await expect(got).toBeInViewport({ ratio: 1 });
  expect((await box(got)).height).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole("region", { name: "Scaling controls" })).toBeVisible();
  expect(overlaps(strip, await box(page.locator(".tour-hole")))).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: `${SHOTS}/phone-coach-chapter-guide-390x844.png` });
  await got.tap();
  await expect(guide).toBeHidden();
});

/** Whether the spotlight's lit window holds the whole control, so the control the hint names is not under the dim. */
async function lit(page: Page, target: Locator) {
  const hole = page.locator(".tour-hole");
  if (!(await hole.count()) || !(await target.count())) return false;
  const h = await box(hole);
  return h.height > 0 && inside(await box(target), h);
}

for (const [width, height] of [[390, 844], [320, 568]]) {
  test(`Challenge Mode's first week lights each control it names, including the dock's, at ${width}x${height}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/**", route => route.abort());
    await unlockChallenge(page);
    await page.addInitScript(() => localStorage.setItem("nn.mode.v1", "classic"));
    await page.goto("/");
    await page.getByRole("button", { name: "Start Challenge Mode", exact: true }).tap();
    await expectRoom(page);
    const card = page.getByRole("dialog", { name: /^Tutorial, step/ });
    const prompt = card.locator(".tour-prompt");
    const shot = async (name: string) => {
      // What to press is never scrolled under the strip's Skip and Next.
      await expect.poll(() => uncovered(prompt), `${name}: the hint is in view`).toBe(true);
      await page.screenshot({ path: `${SHOTS}/phone-challenge-${width}x${height}-${name}.png` });
    };

    // 1. Add a server, from the room's Servers label and then the panel.
    await expect(card).toHaveAccessibleName("Tutorial, step 1 of 5");
    const servers = page.getByRole("main").getByRole("button", { name: "Servers", exact: true });
    await expect.poll(() => lit(page, servers), "the Servers label is lit").toBe(true);
    await shot("01-servers");
    await servers.tap();
    // Inspecting from the room always opens its reveal first.
    await page.getByRole("dialog", { name: "Servers inspected" }).getByRole("button", { name: "Return to room" }).tap();
    await page.getByRole("button", { name: /Add server/ }).tap();

    // 2. Explore Scale Up: the Tech tab is in the dock, or folded into its Views menu on the narrowest phones.
    await expect(card).toHaveAccessibleName("Tutorial, step 2 of 5");
    const techTab = page.locator(".phone-dock").getByRole("button", { name: /^Tech/ });
    const views = page.locator(".phone-views-menu > summary");
    if (width < 360) {
      await expect(views).toBeVisible();
      await expect(prompt).toHaveText("Open Views, then open Tech.");
      await expect.poll(() => lit(page, views), "the Views menu is lit").toBe(true);
      await shot("02-views");
      await views.tap();
    }
    await expect(prompt).toHaveText("Open Tech.");
    await expect.poll(() => lit(page, techTab), "the Tech tab is lit").toBe(true);
    await shot("02-tech");
    await techTab.tap();
    await page.getByRole("button", { name: "Scale Up: Available" }).tap();
    await page.getByRole("button", { name: /^Start/ }).tap();

    // 3. Get more users: the Growth label starts under the sheet, so the room brings it into the open part.
    await expect(card).toHaveAccessibleName("Tutorial, step 3 of 5");
    const growthLabel = page.getByRole("main").getByRole("button", { name: "Growth", exact: true });
    await expect.poll(() => lit(page, growthLabel), "the Growth label is lit").toBe(true);
    await expect.poll(() => uncovered(growthLabel), "the Growth label is above the sheet").toBe(true);
    await shot("03-growth");
    await growthLabel.tap();
    await page.getByRole("dialog", { name: "Growth inspected" }).getByRole("button", { name: "Return to room" }).tap();
    await page.getByRole("button", { name: /^Launch/ }).first().tap();

    // 4. Play the week: Next week is in the dock, below the coach strip.
    await expect(card).toHaveAccessibleName("Tutorial, step 4 of 5");
    const next = page.getByRole("button", { name: "Next week", exact: true });
    await expect.poll(() => lit(page, next), "Next week is lit").toBe(true);
    expect(overlaps(await box(page.locator(".tour-hole")), await box(card))).toBe(false);
    await shot("04-next-week");
    await next.tap();

    await expect(card).toHaveAccessibleName("Tutorial, step 5 of 5");
    await card.getByRole("button", { name: "Got it", exact: true }).tap();
    await expect(card).toBeHidden();
    const after = await savedClassicGame(page);
    expect(after.turn).toBe(2);
    expect(after.infra.appHosts).toHaveLength(2);
    expect(after.totals.promosRun).toBe(1);
  });
}
