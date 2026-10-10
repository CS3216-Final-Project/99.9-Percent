import type { Page } from "@playwright/test";
import { test, expect, expectRoom, seedClassicSave } from "./fixtures";
import { advanceTurn, newLegacyGame } from "../src/sim";

type Point = { x: number; y: number };

/**
 * Presses a key and records where the equipment labels sit on average, relative to the middle of the room, on every
 * frame that moves them, until they have been still for a while. The scene projects each label from its equipment.
 */
async function trackLabels(page: Page, key?: string): Promise<Point[]> {
  const recording = page.evaluate(() => new Promise<Point[]>(resolve => {
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
    still = window.setTimeout(done, 800);
  }));
  if (key) await page.keyboard.press(key);
  return recording;
}

const spread = (points: Point[], from: Point) => Math.max(...points.map(p => Math.hypot(p.x - from.x, p.y - from.y)));

test("turning the room with Q and E keeps the company in place", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("nn.mode.v1", "classic"));
  await seedClassicSave(page, advanceTurn(newLegacyGame(1)));
  await page.goto("/");
  await page.getByRole("button", { name: "Continue week 2" }).click();
  await expectRoom(page);

  // Wait for the opening framing to settle on the built equipment.
  await expect.poll(async () => (await trackLabels(page)).length).toBe(1);

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
