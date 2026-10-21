import { test, expect, seedSave, savedGame, expectRoom } from "./fixtures";
import { act, spikeCompany, untilOffset } from "../src/sim/__tests__/spikeFixtures";
import type { GameState } from "../src/sim";
import type { Page } from "@playwright/test";

async function boot(page: Page, game: GameState) {
  await page.route("**/api/**", route => route.abort()); await seedSave(page, game); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click(); await expectRoom(page);
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 60_000));
}
const gold = (page: Page) => page.locator(".campaign-gold-attention");
test("Chapter 4 cues: centered 320px Prepare, manual Hint targeting and reload receipt", async ({ page, installClock }, info) => {
  await installClock(); await page.setViewportSize({ width: 320, height: 568 }); await boot(page, spikeCompany(false));
  const cue = page.getByRole("dialog", { name: "Chapter 4: Prepare", exact: true });
  await expect(cue).toHaveAttribute("aria-modal", "false"); await expect(cue).toBeInViewport({ ratio: 1 });
  const box = await cue.boundingBox(); expect(Math.abs(box!.x + box!.width / 2 - 160)).toBeLessThan(1);
  await page.screenshot({ path: info.outputPath("prepare-320.png") });
  const before = (await savedGame(page)).campaign!;
  await cue.getByRole("button", { name: "Got it", exact: true }).click();
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  const hint = page.getByRole("dialog", { name: "Hint", exact: true }); await expect(hint).toContainText("Check App Server capacity");
  await hint.getByRole("button", { name: "Got it", exact: true }).click();
  await expect(gold(page)).toHaveCount(1); await expect(gold(page)).toHaveAccessibleName("App Server");
  await gold(page).click(); await expect(page.getByRole("region", { name: "Servers readings" })).toBeVisible();
  expect((await savedGame(page)).campaign!.step).toBe(before.step);
  await page.clock.resume(); await page.reload();
  await page.getByRole("button", { name: "Continue company", exact: true }).click(); await expectRoom(page);
  await expect(cue).toHaveCount(0); expect((await savedGame(page)).campaign!.step).toBe(before.step);
});

for (const [offset, name, target] of [[7, "Spike 1", "Network"], [27, "Between spikes", "Network"], [47, "Spike 2", "Network"], [67, "Recover", "Run"]] as const)
  test(`Chapter 4 cues: engine boundary enters ${name} and targets ${target}`, async ({ page, installClock }) => {
    await installClock(); await boot(page, untilOffset(act(spikeCompany(false), { type: "set_traffic_limit", enabled: true }), offset));
    await page.getByRole("button", { name: "Run", exact: true }).click(); await page.clock.runFor(1000);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    const cue = page.getByRole("dialog", { name: `Chapter 4: ${name}`, exact: true }); await expect(cue).toBeVisible();
    await cue.getByRole("button", { name: "Got it", exact: true }).click();
    await page.getByRole("button", { name: "Hint", exact: true }).click();
    const hint = page.getByRole("dialog", { name: "Hint", exact: true }); await expect(hint).toContainText(/reject/);
    await hint.getByRole("button", { name: "Got it", exact: true }).click();
    await expect(gold(page)).toHaveCount(1); await expect(gold(page)).toHaveAccessibleName(target);
    expect((await savedGame(page)).campaign!.step).toBe(spikeCompany(false).campaign!.spikeStage!.enteredStep + offset + 1);
  });

test("Chapter 4 cues: Respond yields to immediate incident Pause and action Confirm", async ({ page, installClock }) => {
  await installClock(); await boot(page, untilOffset(spikeCompany(false), 7));
  await page.getByRole("button", { name: "Run", exact: true }).click(); await page.clock.runFor(1000);
  await page.getByRole("dialog", { name: "Chapter 4: Spike 1", exact: true }).getByRole("button", { name: "Got it", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Chapter 4: Respond", exact: true })).toContainText("Pause and inspect");
  await page.clock.runFor(2000); await expect(page.getByRole("dialog", { name: /^Chapter 4:/ })).toHaveCount(0);
  await expect(gold(page)).toHaveCount(1); await expect(gold(page)).toHaveAccessibleName("Pause"); await gold(page).click();
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  await page.getByRole("dialog", { name: "Hint", exact: true }).getByRole("button", { name: "Got it", exact: true }).click();
  await expect(gold(page)).toHaveCount(1); await expect(gold(page)).toHaveAccessibleName(/^Add server/);
  await gold(page).click(); await expect(gold(page)).toHaveCount(1); await expect(gold(page)).toHaveAccessibleName("Confirm");
});
