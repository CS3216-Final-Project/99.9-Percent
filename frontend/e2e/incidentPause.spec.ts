import { test, expect, savedGame } from "./fixtures";
import { newGame } from "../src/sim";
import { act, tick } from "../src/sim/__tests__/spikeFixtures";
import { pauseTransition } from "../src/sim/__tests__/pauseFixture";
import { bootPause, pauseArrival } from "./incidentPause";

// Opening's native first incident already stops; its separate negative case preserves that rule.
for (const chapter of [2, 3, 4, 5, 6]) test(`incident Pause: immediate running Chapter ${chapter} transition`, async ({ page, installClock }, info) => {
  await installClock(); await pauseArrival(page, info, chapter);
});

test("incident Pause: preserves the first-incident stop and paused-save resume", async ({ page, installClock }) => {
  await installClock(); await bootPause(page, tick(newGame(), 5));
  await page.getByRole("button", { name: "Run", exact: true }).click(); await page.clock.runFor(1000);
  expect((await savedGame(page)).phase).toBe("incident");
  await expect(page.getByRole("button", { name: "Run", exact: true })).toBeVisible();
  await expect(page.locator(".campaign-gold-attention")).toHaveCount(0);
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await expect(page.locator(".campaign-gold-attention")).toHaveCount(0);
});

test("incident Pause: pause to ten-second Hint", async ({ page, installClock }) => {
  await installClock(); await bootPause(page, pauseTransition(3).before);
  const gold = page.locator(".campaign-gold-attention");
  await page.getByRole("button", { name: "Run", exact: true }).click(); await page.clock.runFor(1000);
  await expect(gold).toHaveAccessibleName("Pause"); await gold.click(); await expect(gold).toHaveCount(0);
  const paused = (await savedGame(page)).campaign!;
  // Once paused, advance only the idle deadline, retaining the 9,999/10,000ms boundary.
  await page.clock.fastForward(9999); await expect(gold).toHaveCount(0);
  await page.clock.runFor(1); await expect(gold).toHaveCount(1); await expect(gold).toHaveAccessibleName("Hint");
  expect((await savedGame(page)).campaign!.inputs).toEqual(paused.inputs);
  expect((await savedGame(page)).campaign!.step).toBe(paused.step);
});

test("incident Pause: paused incident Hint targets the accepted action and immediate Confirm", async ({ page, installClock }) => {
  await installClock(); await bootPause(page, pauseTransition(3).incident);
  const gold = page.locator(".campaign-gold-attention"), paused = (await savedGame(page)).campaign!;
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  const hint = page.getByRole("dialog", { name: "Hint", exact: true });
  await expect(hint.locator("p")).toHaveCount(1); expect((await hint.locator("p").innerText()).split(/\s+/).length).toBeLessThan(25);
  await hint.getByRole("button", { name: "Got it", exact: true }).click();
  await expect(gold).toHaveCount(1); await expect(gold).toHaveAccessibleName(/^Upgrade database/);
  await gold.click(); await expect(gold).toHaveCount(1); await expect(gold).toHaveAccessibleName("Confirm");
  expect((await savedGame(page)).campaign!.inputs).toEqual(paused.inputs);
  await gold.click(); await expect(gold).toHaveCount(0);
  expect((await savedGame(page)).campaign!.pending.some(a => a.type === "upgrade-db")).toBe(true);
  await page.getByRole("button", { name: "Run", exact: true }).click(); await page.clock.runFor(1000);
  await expect(gold).toHaveCount(0); await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
});

for (const chapter of [3, 5]) test(`incident Pause: accepted recovery work needs time in Chapter ${chapter}`, async ({ page, installClock }) => {
  await installClock(); let g = pauseTransition(chapter).before;
  g = act(g, chapter === 3 ? { type: "start_db_upgrade" } : { type: "restore_app", appId: g.campaign!.reliabilityStage!.fault!.targetId });
  await bootPause(page, g); await page.getByRole("button", { name: "Run", exact: true }).click(); await page.clock.runFor(1000);
  expect((await savedGame(page)).phase).toBe("incident");
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await expect(page.locator(".campaign-gold-attention")).toHaveCount(0);
});

test("incident Pause: deliberate continued-running activity dismisses once, not on every tick", async ({ page, installClock }) => {
  await installClock(); await bootPause(page, pauseTransition(4).before);
  await page.getByRole("button", { name: "Run", exact: true }).click(); await page.clock.runFor(1000);
  const gold = page.locator(".campaign-gold-attention"); await expect(gold).toHaveAccessibleName("Pause");
  const id = (await savedGame(page)).campaign!.incident!.id;
  await page.keyboard.press("Shift"); await expect(gold).toHaveCount(0);
  await page.clock.runFor(2000); expect((await savedGame(page)).campaign!.incident!.id).toBe(id);
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible(); await expect(gold).toHaveCount(0);
});

// A real captured mouse is the normal first-person play path, not a blocking dialog.
for (const chapter of [2, 3, 4, 5, 6]) test(`incident Pause: first-person Chapter ${chapter} arrival keeps Pause through releasing the mouse`, async ({ page, installClock }) => {
  // First person loads the room twice over and Chapter 3 also waits out the hint delay: about a minute on CI.
  test.setTimeout(120_000);
  await installClock(); const pair = pauseTransition(chapter); await bootPause(page, pair.before);
  await page.locator(".stage-canvas").focus();
  await page.keyboard.press("v"); await page.clock.runFor(200);
  await page.keyboard.press("v"); await page.clock.runFor(200);
  await expect(page.locator(".view-dot")).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(true);
  await page.keyboard.press("p"); await page.clock.runFor(1000);
  expect((await savedGame(page)).campaign!.incident!.id).toBe(pair.incident.campaign!.incident!.id);
  await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(true);
  const gold = page.locator(".campaign-gold-attention");
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled();
  await expect(gold).toHaveCount(1); await expect(gold).toHaveAccessibleName("Pause");
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => document.pointerLockElement)).toBeNull();
  await expect(gold).toHaveCount(1); await expect(gold).toHaveAccessibleName("Pause");
  await gold.click(); await expect(gold).toHaveCount(0);
  const paused = (await savedGame(page)).campaign!.step;
  await page.clock.runFor(1000); expect((await savedGame(page)).campaign!.step).toBe(paused);
  if (chapter === 3) {
    await page.clock.runFor(8999); await expect(gold).toHaveCount(0);
    await page.clock.runFor(1); await expect(gold).toHaveCount(1); await expect(gold).toHaveAccessibleName("Hint");
    expect((await savedGame(page)).campaign!.step).toBe(paused);
  }
});
