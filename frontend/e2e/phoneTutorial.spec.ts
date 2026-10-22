import type { Locator, Page } from "@playwright/test";
import { test, expect, expectRoom, seedSave, tutorial, savedGame, CHAPTER_ZERO_LESSONS } from "./fixtures";
import { applyAction, newGame, type GameState } from "../src/sim";
import { advanceSteps } from "../src/sim/step";

/*
 * The phone edition's coach strip (Pixel 7, touch). Chapter 0 docks in one fixed-size strip above the dock, so the
 * room keeps at least 40% of the screen and each lesson's real control stays in view and uncovered. Longer reading
 * opens in a layer that never covers that control.
 */

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;
const box = async (locator: Locator) => (await locator.boundingBox())!;
const near = (a: Box, b: Box) => Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1 && Math.abs(a.width - b.width) <= 1 && Math.abs(a.height - b.height) <= 1;
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

/** Lessons where the real control is a full-width purchase quote while it is open: it covers the room by design. */
const QUOTE_LESSONS = new Set(["quote", "cancel"]);
/**
 * Lessons whose control is in the System metrics sheet. Under about 700 px of height, the sheet's header and one row
 * of controls (or an inspection's three readings) leave the room less than 40% of the screen, but never less than this.
 */
const SHEET_LESSONS = new Set(["inspect-app", "inspect-db", "warnings", "quote"]);
const SHORT_SHEET_SHARE = 0.25;

async function startWalkthrough(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/**", route => route.abort());
  await seedSave(page, newGame(1, "phone-coach"), { tutorialDone: false, walkthroughStep: 0 });
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).tap();
  await expectRoom(page);
}

for (const [width, height] of [[390, 844], [360, 640], [320, 568]]) {
  test(`Chapter 0 coaches from a fixed strip above the dock and keeps the room and each control in view at ${width}x${height}`, async ({ page }) => {
    // Every lesson is checked and photographed with the room drawn in software.
    test.setTimeout(300_000);
    await page.setViewportSize({ width, height });
    await startWalkthrough(page);
    const card = tutorial(page);
    await expect(card).toHaveAttribute("aria-modal", "false");
    await expect(card).toHaveClass(/phone-coach/);
    const back = card.getByRole("button", { name: "Back", exact: true });
    const next = card.getByRole("button", { name: /^(Next|Finish walkthrough)$/ });
    const more = card.getByRole("button", { name: "Learn more", exact: true });
    const reading = page.getByRole("region", { name: /^About / });
    const panel = page.getByRole("complementary", { name: "System metrics" });
    let strip: Box | null = null, backBox: Box | null = null, nextBox: Box | null = null;

    const check = async (id: string, state: string) => {
      await expect(card).toBeInViewport({ ratio: 1 });
      // The same box, and Back and Next in the same places, in every lesson and state.
      const now = await box(card), b = await box(back), n = await box(next);
      strip ??= now; backBox ??= b; nextBox ??= n;
      expect(near(now, strip), `strip box in ${id} ${state}`).toBe(true);
      expect(near(b, backBox), `Back in ${id} ${state}`).toBe(true);
      expect(near(n, nextBox), `Next in ${id} ${state}`).toBe(true);
      expect(now.height).toBeLessThanOrEqual(150);
      // Directly above the dock, not over it.
      const dock = page.locator(".phone-dock, .bottombar").first();
      const dockTop = (await box(dock)).y;
      expect(now.y + now.height).toBeLessThanOrEqual(dockTop + 1);
      expect(dockTop - (now.y + now.height)).toBeLessThanOrEqual(12);
      // Touch targets.
      for (const control of [b, n, await box(more)]) expect(control.height).toBeGreaterThanOrEqual(44);
      // Nothing in the strip is clipped: the title and the one-line task are complete.
      expect(await card.evaluate(el => [...el.querySelectorAll("h3, .phone-coach-task, .phone-coach-kicker")].every(e => e.scrollWidth <= e.clientWidth + 1 && e.scrollHeight <= e.clientHeight + 1))).toBe(true);
      // The lit control is fully in view and nothing (strip, reading layer, dock) is on top of it.
      // Inspected readings: the sheet shows the card's demand, capacity and backlog rows, which are what is lit.
      const target = state === "readings" ? page.locator(".chapter-zero-target .evidence-rows") : page.locator(".chapter-zero-target");
      if (await target.count()) {
        await expect.poll(() => uncovered(target), `${id} ${state}: the lit control is uncovered`).toBe(true);
        await expect.poll(async () => {
          const lit = await box(page.locator(".cz-spotlight")), t = await box(target);
          return t.y >= lit.y - 1 && t.y + t.height <= lit.y + lit.height + 1 && t.x >= lit.x - 1 && t.x + t.width <= lit.x + lit.width + 1;
        }, `${id} ${state}: the control is inside the lit window`).toBe(true);
        expect(overlaps(await box(target), now)).toBe(false);
      }
      // An open quote, and on short screens an open dock menu, cover the room by design while they are open.
      const popover = QUOTE_LESSONS.has(id) && await page.locator(".campaign-action-popover").count() || state === "menu" && height < 700;
      if (!popover) {
        const least = height < 700 && SHEET_LESSONS.has(id) ? SHORT_SHEET_SHARE : 0.4;
        await expect.poll(() => roomShare(page), `${id} ${state}: room share`).toBeGreaterThanOrEqual(least);
        console.log(`${width}x${height} ${id} ${state}: room ${(await roomShare(page)).toFixed(2)}`);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: `${SHOTS}/phone-coach-${width}x${height}-${String(lesson).padStart(2, "0")}-${id}-${state}.png` });
    };

    const readMore = async (id: string) => {
      // Learn more opens beside the lit control, never over it, and Escape returns to the toggle.
      await more.tap();
      await expect(more).toHaveAttribute("aria-expanded", "true");
      await expect(reading).toBeVisible();
      await expect(reading).toBeFocused();
      await expect(reading).toBeInViewport();
      const target = page.locator(".chapter-zero-target");
      if (await target.count()) {
        await expect.poll(async () => overlaps(await box(reading), await box(target)), `${id}: reading layer covers the control`).toBe(false);
        // A useful reading area, not a sliver: it shows all its text or at least 120 px of it.
        expect(await reading.evaluate(el => el.scrollHeight <= el.clientHeight + 1 || el.clientHeight >= 120)).toBe(true);
        await expect.poll(() => uncovered(target)).toBe(true);
      }
      expect(overlaps(await box(reading), await box(card))).toBe(false);
      const menu = page.getByRole("button", { name: "Menu", exact: true });
      await expect.poll(() => uncovered(menu)).toBe(true);
      await page.screenshot({ path: `${SHOTS}/phone-coach-${width}x${height}-${String(lesson).padStart(2, "0")}-${id}-reading.png` });
      await page.keyboard.press("Escape");
      await expect(reading).toBeHidden();
      await expect(more).toBeFocused();
      await expect(more).toHaveAttribute("aria-expanded", "false");
    };

    let lesson = 1;
    for (; lesson <= CHAPTER_ZERO_LESSONS; lesson++) {
      await expect(card).toHaveAccessibleName(`Walkthrough, step ${lesson} of ${CHAPTER_ZERO_LESSONS}`);
      const id = (await card.getAttribute("data-lesson-id"))!;
      await check(id, "open");
      await readMore(id);
      if (id === "inspect-app" || id === "inspect-db") {
        await panel.getByRole("button", { name: id === "inspect-app" ? "App Server" : "Database", exact: true }).tap();
        await expect(next).toBeEnabled();
        // The readings join the lit window, in view and uncovered.
        await expect(card).toHaveAttribute("data-inspected", "true");
        await check(id, "readings");
      } else if (id === "run") {
        await page.getByRole("button", { name: "Run", exact: true }).tap();
        await expect(card).toHaveAttribute("data-lesson-id", "quote");
        continue;
      } else if (id === "quote") {
        await panel.locator(".act:not(:disabled)").first().tap();
        await expect(card).toHaveAttribute("data-lesson-id", "cancel");
        continue;
      } else if (id === "cancel") {
        const quote = page.getByRole("region", { name: /^Confirm / });
        await expect(quote.getByRole("button", { name: "Confirm", exact: true })).toBeDisabled();
        await quote.getByRole("button", { name: "Cancel", exact: true }).tap();
        await expect(card).toHaveAttribute("data-lesson-id", "money");
        continue;
      } else if (id === "speed") {
        const menu = page.locator(".time-menu");
        await menu.locator(":scope > summary").tap();
        await check(id, "menu");
        await page.getByRole("group", { name: "Game speed", exact: true }).locator('button:not([aria-pressed="true"])').first().tap();
        await expect(card).toHaveAttribute("data-lesson-id", "ready");
        // The finished exercise closes the speed menu, so the room is clear for the last lesson.
        await expect(page.getByRole("group", { name: "Game speed", exact: true })).toBeHidden();
        continue;
      }
      await next.tap();
    }
    await expect(card).toBeHidden();
    await expect(page.locator(".cz-spotlight")).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("nn.campaign.meta.v1") ?? "{}").tutorialDone)).toBe(true);
    expect((await savedGame(page)).campaign).toMatchObject({ step: 1, actions: [], pending: [] });
    await expect(page.getByRole("button", { name: "Run", exact: true })).toBeEnabled();
    await expect.poll(() => roomShare(page)).toBeGreaterThanOrEqual(0.4);
  });
}

test("a completed player's replay keeps Return to game in the strip", async ({ page, withoutRoom }) => {
  await withoutRoom();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route("**/api/**", route => route.abort());
  await seedSave(page, newGame(1, "phone-replay"), { walkthroughStep: 0, walkthroughFurthestStep: 0 });
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).tap();
  const card = tutorial(page);
  await expect(card).toContainText("Practice");
  const back = await box(card.getByRole("button", { name: "Back", exact: true }));
  const ret = card.getByRole("button", { name: "Return to game", exact: true });
  await expect(ret).toBeInViewport({ ratio: 1 });
  expect((await box(ret)).height).toBeGreaterThanOrEqual(44);
  await expect(card.getByRole("heading")).toBeInViewport({ ratio: 1 });
  expect(back.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: `${SHOTS}/phone-coach-replay-320x568.png` });
  await ret.tap();
  await expect(card).toBeHidden();
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
  await page.getByRole("dialog", { name: "First growth challenge handled" }).getByRole("button", { name: "Continue operating" }).tap();
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
