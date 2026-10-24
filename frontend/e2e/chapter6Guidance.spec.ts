import { test, expect, savedGame } from "./fixtures";
import { chapter6Preparation, bootChapter6 } from "./chapter6Guidance";
import { act, tick, combinedCompany, finishedCompany, finishRound } from "../src/sim/__tests__/combinedFixture";
import { expectCueColours } from "./chapter4Cues";

test("Chapter 6 guidance: capacity before removal, Confirm, Run, readiness and reload", async ({ page, installClock }) => {
  // The virtual clock renders every animation frame of the 2.5s readiness run at 1440x900 in software: about 20s of
  // the 55-65s this takes on CI. The 320px touch variant in mobile.spec.ts finishes the same steps in half the time.
  test.setTimeout(120_000);
  await installClock(); await chapter6Preparation(page);
});

test("Chapter 6 guidance: wave and recovery use real boundaries without repeating on pause", async ({ page, installClock }) => {
  await installClock();
  const game = act(tick(combinedCompany(), 5), { type: "start_growth_wave" });
  await bootChapter6(page, tick(game, 23));
  const wave = page.getByRole("dialog", { name: "Chapter 5: Growth wave 1", exact: true });
  await expectCueColours(wave, "pressure"); await wave.getByRole("button", { name: "Got it", exact: true }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click(); await page.clock.runFor(1000);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const recover = page.getByRole("dialog", { name: "Chapter 5: Recover at full demand", exact: true });
  await expectCueColours(recover, "recovery"); await recover.getByRole("button", { name: "Got it", exact: true }).click();
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  const hint = page.getByRole("dialog", { name: "Hint", exact: true }); await expect(hint).toContainText("full-demand");
  await hint.getByRole("button", { name: "Got it", exact: true }).click();
  await expect(page.locator(".campaign-gold-attention")).toHaveAccessibleName("Run");
  await page.locator(".campaign-gold-attention").click(); await page.clock.runFor(4000);
  await expect(page.getByRole("dialog", { name: "Growth outcome", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: /^Chapter 5:/ })).toHaveCount(0);
  await expect(page.locator(".campaign-gold-attention")).toHaveCount(0);
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  expect((await savedGame(page)).campaign!.combinedStage!.completedRounds).toHaveLength(1);
});

test("Chapter 6 guidance: final review owns completion and is never bypassed", async ({ page, installClock }) => {
  await installClock(); const game = finishedCompany(); await bootChapter6(page, game);
  await expect(page.getByRole("dialog", { name: "Final campaign review", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: /^Chapter 5:/ })).toHaveCount(0);
  expect((await savedGame(page)).outcome).toBeNull();
  await page.getByRole("button", { name: "Complete campaign", exact: true }).click();
  expect((await savedGame(page)).outcome).toBe("won");
});

test("Chapter 6 guidance: post-review restoration precedes replacement capacity and useful Run", async ({ page, installClock }) => {
  await installClock(); let game = combinedCompany();
  for (let i = 0; i < 2; i++) game = act(finishRound(act(tick(game, 5), { type: "start_growth_wave" })), { type: "acknowledge_growth" });
  game = tick(act(tick(game, 5), { type: "start_growth_wave" }), 10);
  game = act(game, { type: "set_traffic_limit", enabled: true });
  game = act(game, { type: "set_routing", mode: "balanced", targets: ["app-1", "app-2"] });
  for (let i = 0; i < 15 && game.phase !== "review"; i++) game = tick(game);
  expect(game.phase).toBe("review"); await bootChapter6(page, game);
  await page.getByRole("dialog", { name: "Incident postmortem", exact: true }).getByRole("button", { name: "Continue company", exact: true }).click();
  const cue = page.getByRole("dialog", { name: /^Chapter 5:/ });
  await cue.getByRole("button", { name: "Got it", exact: true }).click();
  const gold = page.locator(".campaign-gold-attention");
  const accept = async (name: RegExp) => {
    await page.getByRole("button", { name: "Hint", exact: true }).click();
    await page.getByRole("dialog", { name: "Hint", exact: true }).getByRole("button", { name: "Got it", exact: true }).click();
    await expect(gold).toHaveCount(1); await expect(gold).toHaveAccessibleName(name);
  };
  await accept(/^Restore App 3/); await gold.click();
  expect((await savedGame(page)).campaign!.pending.some(a => a.type === "restore-app")).toBe(true);
  await accept(/^Run$/); await gold.click(); await page.clock.runFor(3000);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  expect((await savedGame(page)).campaign!.combinedStage!.currentRound!.fault!.restoredStep).not.toBeNull();
  await accept(/^All apps$/); await gold.click();
  await accept(/^Run$/); await gold.click(); await page.clock.runFor(1000);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await accept(/^Remove traffic limit/); await gold.click(); await expect(gold).toHaveAccessibleName("Confirm");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
});
