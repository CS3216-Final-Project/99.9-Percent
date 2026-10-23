import type { Locator, Page } from "@playwright/test";
import { expect, expectRoom, savedGame, seedSave, setGameSpeed } from "./fixtures";
import { act, tick, strategyPredecessor, sequence } from "../src/sim/__tests__/combinedFixture";
import type { GameState } from "../src/sim";
import { expectCueColours } from "./chapter4Cues";

export async function bootChapter6(page: Page, game: GameState) {
  await page.route("**/api/**", route => route.abort()); await seedSave(page, game); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click(); await expectRoom(page);
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 60_000));
}

export async function chapter6Preparation(page: Page, touch = false) {
  const press = (button: Locator) => touch ? button.tap() : button.click();
  let game = tick(act(strategyPredecessor(true), { type: "set_traffic_limit", enabled: true }));
  game = tick(act(game, { type: "set_routing", mode: "single", targets: ["app-1"] }));
  game = act(game, { type: "enter_combined", sequence });
  await bootChapter6(page, game);
  const cue = page.getByRole("dialog", { name: "Chapter 5: Prepare for full demand", exact: true });
  await expectCueColours(cue, "prepare");
  await expect(cue.locator("h3 > .icon")).toBeInViewport({ ratio: 1 });
  await expect(cue.getByRole("button", { name: "Dismiss chapter guidance", exact: true })).toBeInViewport({ ratio: 1 });
  await expect(cue).toHaveAttribute("aria-modal", "false");
  await press(cue.getByRole("button", { name: "Got it", exact: true }));
  await press(page.locator(".campaign-panel").getByRole("button", { name: "Network", exact: true }));
  const gold = page.locator(".campaign-gold-attention");
  const accept = async (name: RegExp) => {
    await press(page.getByRole("button", { name: "Hint", exact: true }));
    const hint = page.getByRole("dialog", { name: "Hint", exact: true });
    await expect(hint).not.toContainText("About Network");
    await press(hint.getByRole("button", { name: "Got it", exact: true }));
    await expect(gold).toHaveCount(1); await expect(gold).toHaveAccessibleName(name); await expect(gold).toBeEnabled();
  };
  // Routing options are always visible, so the accepted Hint frames "All apps" directly.
  await accept(/^All apps$/); await press(gold);
  expect((await savedGame(page)).campaign!.limit).toBe(500);
  // Deliver the same game ticks via the existing 2× control, with half as many WebGL frames.
  await setGameSpeed(page, 2);
  // The clock delivers 200ms ticks: three ticks at 2× complete one game second.
  await accept(/^Run$/); await press(gold); await page.clock.runFor(600);
  await press(page.getByRole("button", { name: "Pause", exact: true }));
  expect((await savedGame(page)).campaign!.step).toBe(game.campaign!.step + 1);
  await accept(/^Remove traffic limit/); await press(gold);
  await expect(gold).toHaveCount(1); await expect(gold).toHaveAccessibleName("Confirm");
  await press(page.getByRole("button", { name: "Cancel", exact: true }));
  expect((await savedGame(page)).campaign!.limit).toBe(500);
  await accept(/^Remove traffic limit/); await press(gold);
  await expect(gold).toHaveAccessibleName("Confirm"); await press(gold);
  await accept(/^Run$/); await press(gold); await page.clock.runFor(2500);
  await press(page.getByRole("button", { name: "Pause", exact: true }));
  await setGameSpeed(page, 1);
  const after = await savedGame(page);
  expect(after.campaign!.limit).toBeNull(); expect(after.campaign!.combinedStage!.readinessSteps).toBe(5);
  expect(after.campaign!.incident).toBeNull();
  const panel = page.getByRole("region", { name: "Guided Mode guidance", exact: true });
  await expect(panel).toContainText("Serve full demand steadily: 5 / 5 s");
  await expect(panel.getByRole("region", { name: "Final goals", exact: true })).toContainText("0 / 3");
  await page.clock.resume(); await page.reload();
  await press(page.getByRole("button", { name: "Continue company", exact: true })); await expectRoom(page);
  await expect(cue).toHaveCount(0);
  expect((await savedGame(page)).campaign!.combinedStage!.readinessSteps).toBe(5);
}
