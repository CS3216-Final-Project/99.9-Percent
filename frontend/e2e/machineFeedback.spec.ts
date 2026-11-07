import type { Page } from "@playwright/test";
import type { Object3D } from "three";
import { test, expect, seedSave, savedGame, expectRoom, advanceCampaignStep } from "./fixtures";
import { launchCompany } from "../src/sim/__tests__/scalingLaunchFixture";
import { infrastructureAction } from "./componentInspection";

// Read the existing performance probe, including the actual hardware transform drawn by WebGL.
async function machine(page: Page, id: string) {
  return page.evaluate(id => {
    const room = (window as unknown as { __nnRoom?: { scene: Object3D } }).__nnRoom;
    const node = room?.scene.getObjectByName(`machine:${id}`);
    return node ? { scale: node.scale.toArray(), floorY: node.getWorldPosition(node.position.clone()).y } : null;
  }, id);
}
async function boot(page: Page) {
  await page.route("**/api/**", route => route.abort());
  await seedSave(page, launchCompany());
  // A normal remembered overview, framed on the database for visual inspection.
  await page.addInitScript(() => localStorage.setItem("nn.campaign.exploration.v1", JSON.stringify({ version: 1, floor: "servers", walking: false, viewpoint: "overview", viewChosen: true, avatar: null, camera: { target: { x: -2, z: 2 }, offset: { x: 20, y: 18, z: 20 }, zoom: 45 } })));
  await page.goto("/?perf&graphics=basic");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page, 30_000);
  await expect.poll(() => machine(page, "db")).not.toBeNull();
  await expect.poll(() => page.evaluate(() => {
    const room = (window as unknown as { __nnRoom?: { gl: { info: { render: { calls: number } } } } }).__nnRoom;
    return room?.gl.info.render.calls ?? 0;
  }), { timeout: 30_000 }).toBeGreaterThan(0);
}
async function purchase(page: Page, label: RegExp) {
  await (await infrastructureAction(page, label)).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
}
async function capture(page: Page, name: string) {
  const label = await page.locator('main [data-eq="db"]').boundingBox();
  if (!label) throw Error("Database label must be visible");
  const viewport = page.viewportSize()!;
  await page.screenshot({ path: `test-results/machine-${name}.png`, clip: { x: Math.max(0, Math.min(viewport.width - 440, label.x - 110)), y: Math.max(0, Math.min(viewport.height - 300, label.y - 25)), width: 440, height: 300 } });
}

test("activated hardware grows and settles on its footprint; a loaded save never celebrates again", async ({ page, installClock }) => {
  test.setTimeout(120_000);
  await installClock(); await boot(page);
  const baseline = await machine(page, "db");
  expect(baseline!.scale).toEqual([1, 1, 1]);
  await expect(page.getByRole("region", { name: "Latest infrastructure change" })).toHaveCount(0);
  await capture(page, "before");
  await purchase(page, /^Upgrade database/);
  await advanceCampaignStep(page, { seconds: 2, resumeClock: false });
  expect((await machine(page, "db"))!.scale).toEqual([1, 1, 1]);
  await advanceCampaignStep(page, { seconds: 1, resumeClock: false });
  await page.clock.runFor(400);
  const grown = await machine(page, "db");
  expect(grown!.scale[1]).toBeGreaterThan(1.15);
  expect(grown!.floorY).toBe(baseline!.floorY);
  await expect(page.getByRole("status", { name: "Machine activation" })).toContainText("Database upgraded");
  await capture(page, "grown");
  const step = (await savedGame(page)).campaign!.step;
  // No game time is running: skip to the end of the cosmetic tween, then paint it.
  await page.clock.fastForward(1700);
  await page.clock.runFor(100);
  expect((await machine(page, "db"))!.scale).toEqual([1, 1, 1]);
  expect((await savedGame(page)).campaign!.step).toBe(step);
  await capture(page, "settled");
  await purchase(page, /^Add server/);
  await advanceCampaignStep(page, { seconds: 2, resumeClock: false });
  await page.clock.runFor(350);
  expect((await machine(page, "app-2"))!.scale[1]).toBeGreaterThan(1);
  expect((await savedGame(page)).campaign!.snapshot.instances!.find(a => a.id === "app-2")!.demand).toBe(0);
  await expect(page.getByRole("status", { name: "Machine activation" })).toContainText("Route traffic");
  // No game time is running: skip to the end of the cosmetic tween, then paint it.
  await page.clock.fastForward(1700);
  await page.clock.runFor(100);
  expect((await machine(page, "app-2"))!.scale).toEqual([1, 1, 1]);
  await page.clock.resume(); await page.reload();
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page, 30_000);
  await expect.poll(() => machine(page, "db")).not.toBeNull();
  expect((await machine(page, "db"))!.scale).toEqual([1, 1, 1]);
  await expect(page.getByRole("status", { name: "Machine activation" })).toBeEmpty();
});

test.describe("reduced motion on touch", () => {
  test.use({ edition: "phone", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  test("announces activation while the actual database model stays still", async ({ page, installClock }) => {
    test.setTimeout(120_000);
    await installClock(); await boot(page);
    await purchase(page, /^Upgrade database/);
    await advanceCampaignStep(page, { seconds: 3, resumeClock: false });
    await page.clock.runFor(400);
    expect((await machine(page, "db"))!.scale).toEqual([1, 1, 1]);
    await expect(page.getByRole("status", { name: "Machine activation" })).toContainText("Database upgraded");
    await page.screenshot({ path: "test-results/machine-reduced-phone.png" });
    // No game time is running: skip to the end of the cosmetic tween, then paint it.
    await page.clock.fastForward(1700);
    await page.clock.runFor(100);
    expect((await machine(page, "db"))!.scale).toEqual([1, 1, 1]);
    await expect(page.getByRole("button", { name: "Run", exact: true })).toBeEnabled();
  });
});
