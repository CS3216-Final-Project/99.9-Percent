import type { Page } from "@playwright/test";
import { test, expect, expectRoom, openCameraControls, seedClassicSave, seedSave, unlockChallenge } from "./fixtures";
import { advanceTurn, newGame, newLegacyGame } from "../src/sim";
import { advanceSteps } from "../src/sim/step";

type Point = { x: number; y: number };

/** Pairs of shown room labels whose boxes cover each other on screen, by name. */
function coveredLabels(page: Page): Promise<string[]> {
  return page.locator(".eq-labels > :not(.is-quiet)").evaluateAll(els => {
    const shown = els.filter(el => getComputedStyle(el).visibility === "visible").map(el => ({ name: el.getAttribute("aria-label") ?? el.textContent ?? "", r: el.getBoundingClientRect() }));
    const covered: string[] = [];
    shown.forEach((a, i) => shown.slice(i + 1).forEach(b => {
      if (a.r.left < b.r.right - 1 && b.r.left < a.r.right - 1 && a.r.top < b.r.bottom - 1 && b.r.top < a.r.bottom - 1) covered.push(`${a.name} / ${b.name}`);
    }));
    return covered;
  });
}

/**
 * Presses a key and records where the equipment labels sit on average, relative to the middle of the room, on every
 * frame that moves them, until they have been still for a while. The scene projects each label from its equipment.
 */
async function trackLabels(page: Page, key?: string): Promise<Point[]> {
  // Install the observer before pressing, and give a slow software renderer time to draw the first moving frame.
  await page.evaluate(firstFrameMs => { (window as unknown as { labelTrack: Promise<Point[]> }).labelTrack = new Promise<Point[]>(resolve => {
    const canvas = document.querySelector("main canvas")!.getBoundingClientRect();
    const layer = document.querySelector(".eq-labels")!;
    const centre = () => {
      const boxes = [...layer.querySelectorAll(".eq-label")].map(label => label.getBoundingClientRect());
      const x = boxes.reduce((sum, r) => sum + r.left + r.width / 2, 0) / boxes.length;
      const y = boxes.reduce((sum, r) => sum + r.bottom, 0) / boxes.length;
      return { x: x - canvas.left - canvas.width / 2, y: y - canvas.top - canvas.height / 2 };
    };
    const samples = [centre()];
    let still: number;
    const done = () => { observer.disconnect(); resolve(samples); };
    const observer = new MutationObserver(() => {
      const now = centre();
      const last = samples.at(-1)!;
      if (Math.hypot(now.x - last.x, now.y - last.y) < 0.5) return;
      samples.push(now);
      clearTimeout(still);
      still = window.setTimeout(done, 800);
    });
    observer.observe(layer, { subtree: true, attributeFilter: ["style"] });
    still = window.setTimeout(done, firstFrameMs);
  }); }, key ? 5_000 : 800);
  if (key) await page.keyboard.press(key);
  return page.evaluate(() => (window as unknown as { labelTrack: Promise<Point[]> }).labelTrack);
}

const spread = (points: Point[], from: Point) => Math.max(...points.map(p => Math.hypot(p.x - from.x, p.y - from.y)));

test("turning the room with Q and E keeps the company in place", async ({ page }) => {
  // The opening framing and the turns ease a share of the way each frame, so software rendering takes tens of seconds.
  test.slow();
  await unlockChallenge(page);
  await page.addInitScript(() => localStorage.setItem("nn.mode.v1", "classic"));
  await seedClassicSave(page, advanceTurn(newLegacyGame(1)));
  await page.goto("/");
  await page.getByRole("button", { name: "Continue week 2" }).click();
  await expectRoom(page);

  // Wait for the opening framing to settle on the built equipment. It eases per frame, not per second, so a runner
  // drawing a few frames a second needs far longer than the default wait.
  await expect.poll(async () => (await trackLabels(page)).length, { timeout: 45_000 }).toBe(1);

  for (const key of ["q", "e"]) {
    const samples = await trackLabels(page, key);
    expect(samples.length, "the room should redraw while it turns").toBeGreaterThan(3);
    // Labels circle the company as it turns, but never swing further out than where the turn leaves them.
    const start = samples[0];
    const end = samples.at(-1)!;
    const overshoot = spread(samples, start) - Math.hypot(end.x - start.x, end.y - start.y);
    expect(overshoot, `labels swung ${Math.round(overshoot)}px off course while turning with ${key.toUpperCase()}`).toBeLessThan(8);
  }
  await page.screenshot({ path: "test-results/camera-turned.png" });
});

test("zooming out shrinks the equipment labels with the room, never below a clickable size", async ({ page }) => {
  test.slow();
  await unlockChallenge(page);
  await page.addInitScript(() => localStorage.setItem("nn.mode.v1", "classic"));
  await seedClassicSave(page, advanceTurn(newLegacyGame(1)));
  await page.goto("/");
  await page.getByRole("button", { name: "Continue week 2" }).click();
  await expectRoom(page);

  const labels = page.locator(".eq-labels .eq-label:not(.is-quiet)");
  const database = page.locator(".eq-labels").getByRole("button", { name: "Database", exact: true });
  /** Each shown label's height on screen, after the scene's transform, and the height its layout gives it. */
  const heights = () => labels.evaluateAll(els => els.map(el => ({ shown: el.getBoundingClientRect().height, laid: (el as HTMLElement).offsetHeight })));
  await openCameraControls(page);
  const zoomIn = page.getByRole("button", { name: "Zoom in", exact: true });
  const zoomOut = page.getByRole("button", { name: "Zoom out", exact: true });

  // Zoomed in, every label shows at its full size.
  for (let i = 0; i < 4; i++) await zoomIn.click();
  await expect.poll(async () => (await heights()).every(h => Math.abs(h.shown - h.laid) < 0.5)).toBe(true);
  const full = (await database.boundingBox())!;

  // Pulled right back, the labels shrink with the room, all by the same share, but stay a 24 px target.
  for (let i = 0; i < 12; i++) await zoomOut.click();
  await expect.poll(async () => (await database.boundingBox())!.height).toBeLessThan(full.height * 0.9);
  const shrunk = await heights();
  const shares = shrunk.map(h => h.shown / h.laid);
  for (const share of shares) expect(share).toBeCloseTo(shares[0], 2);
  for (const h of shrunk) expect(h.shown).toBeGreaterThanOrEqual(24 - 0.5);
  const small = (await database.boundingBox())!;
  expect(small.width).toBeLessThan(full.width * 0.9);
  // Network and Servers stand side by side: the room moves one label clear rather than covering the other.
  expect(await coveredLabels(page)).toEqual([]);
  await page.screenshot({ path: "test-results/camera-zoomed-out.png" });

  // A shrunk label is still the machine's control.
  await database.click();
  await expect(database).toHaveAttribute("aria-pressed", "true");
});

test("Guided Mode's server floor labels never cover each other, framed or zoomed right out", async ({ page }) => {
  test.slow();
  await seedSave(page, advanceSteps(newGame(1), 7).state);
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page, 30_000);
  const room = page.locator(".eq-labels");
  for (const name of ["Network", "Servers", "Database", "Monitoring"]) await expect(room.getByRole("button", { name, exact: true })).toBeVisible();
  await expect(page.getByLabel(/^In: /)).toBeVisible();

  await expect.poll(() => coveredLabels(page)).toEqual([]);
  await openCameraControls(page);
  for (let i = 0; i < 12; i++) await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await expect.poll(() => coveredLabels(page)).toEqual([]);
  await page.screenshot({ path: "test-results/camera-guided-zoomed-out.png" });
});
