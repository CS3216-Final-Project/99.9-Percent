import type { Page } from "@playwright/test";
import { test, expect, expectRoom, savedGame, seedSave } from "./fixtures";
import { act, dataCompany, spikeCompany, tick, untilOffset } from "../src/sim/__tests__/spikeFixtures";
import type { GameState } from "../src/sim";

async function boot(page: Page, game: GameState) {
  await page.route("**/api/**", route => route.abort()); await seedSave(page, game); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click(); await expectRoom(page);
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 60_000));
}
/** Runs the clock until a dialog appears, reading any postmortem that comes first. */
async function runUntilDialog(page: Page, name: string) {
  const dialog = page.getByRole("dialog", { name, exact: true });
  await page.getByRole("button", { name: "Run", exact: true }).click();
  for (let i = 0; i < 200 && !await dialog.isVisible(); i++) {
    const postmortem = page.getByRole("button", { name: "Continue company", exact: true });
    if (await postmortem.isVisible()) { await postmortem.click(); await page.getByRole("button", { name: "Run", exact: true }).click(); }
    await page.clock.runFor(200);
  }
  await expect(dialog).toBeVisible();
  return dialog;
}
/** A third large server routed before the practice spike serves the whole test. */
function prepared(g: GameState): GameState {
  g = tick(act(g, { type: "add_server" }), 2); g = tick(act(g, { type: "scale_up", appId: "app-3" }), 3);
  return tick(act(g, { type: "set_routing", mode: "balanced", targets: ["app-1", "app-2", "app-3"] }));
}

test("graded spikes: a failed test stops on its debrief, survives reload and schedules the retry", async ({ page, installClock, withoutRoom }, info) => {
  await withoutRoom(); await installClock();
  const game = untilOffset(spikeCompany(false, "read-heavy", 2), 66);
  await boot(page, game);
  const debrief = await runUntilDialog(page, "Spike 2 test failed");
  await expect(debrief).toContainText("80% served - the test needs 95%");
  await expect(debrief).toContainText("Not enough server capacity");
  // Every request is accounted for: those still queued when the spike ended count as unserved too.
  await expect(debrief).toContainText("64,000 were served, 0 rejected, 14,000 failed and 2,000 were still queued when it ended");
  await expect(debrief).toContainText("Spike 3 starts in 20 game seconds");
  await expect(debrief.getByRole("button", { name: "Prepare for Spike 3" })).toBeFocused();
  await expect(page.getByRole("button", { name: "Run", exact: true })).toBeDisabled();
  await page.screenshot({ path: info.outputPath("debrief.png") });
  const failedAt = (await savedGame(page)).campaign!;
  await page.clock.resume(); await page.reload();
  await page.getByRole("button", { name: "Continue company", exact: true }).click(); await expectRoom(page);
  await expect(page.getByRole("dialog", { name: "Spike 2 test failed", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Prepare for Spike 3" }).click();
  await expect(page.getByRole("dialog", { name: "Spike 2 test failed", exact: true })).toHaveCount(0);
  const read = (await savedGame(page)).campaign!;
  expect(read.step).toBe(failedAt.step);
  expect(read.spikeStage!.pulses!.at(-1)).toMatchObject({ pulse: 2, result: "failed", reviewed: true });
  expect(read.spikeStage!.deadlines.slice(4)).toEqual([failedAt.spikeStage!.enteredStep + 88, failedAt.spikeStage!.enteredStep + 108]);
});

test("graded spikes: going bankrupt as a test fails shows the bankruptcy dialog, not a debrief", async ({ page, installClock, withoutRoom }, info) => {
  await withoutRoom(); await installClock();
  // Entering at step 212 lines a cash settlement up with Spike 4's last second; an unrouted server and the limit fail every test.
  let game = act(tick(dataCompany(), 18), { type: "enter_spikes", version: 2 });
  game = tick(act(act(game, { type: "add_server" }), { type: "set_traffic_limit", enabled: true }));
  game = untilOffset(game, 140, true);
  await boot(page, game);
  const bankrupt = await runUntilDialog(page, "Company bankrupt");
  await expect(page.getByRole("dialog", { name: /test failed$/ })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("bankrupt.png") });
  const saved = (await savedGame(page)).campaign!;
  expect(saved.spikeStage!.deadlines.filter((_, i) => i % 2)).toContain(saved.step);
  await bankrupt.getByRole("button", { name: "Close" }).click();
  await expect(bankrupt).toHaveCount(0);
});

test("graded spikes: a passed test opens the completion dialog with its cost score", async ({ page, installClock, withoutRoom }, info) => {
  await withoutRoom(); await installClock();
  await boot(page, untilOffset(prepared(spikeCompany(false, "read-heavy", 2)), 70));
  const passed = await runUntilDialog(page, "Spike test passed");
  const score = passed.getByRole("region", { name: "Spike test score" });
  await expect(score).toContainText("100% of requests");
  await expect(score).toContainText("1, passed first time");
  await expect(score).toContainText("$3,000");
  await page.screenshot({ path: info.outputPath("passed.png") });
  await passed.getByRole("button", { name: "Stay in this chapter", exact: true }).click();
  expect((await savedGame(page)).campaign!.spikeStage!.acknowledged).toBe(true);
});
