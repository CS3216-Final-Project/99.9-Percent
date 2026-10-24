import { closeInspection, followHintComponent, expectInspectionsOnly } from "./componentInspection";
import type { Locator, Page } from "@playwright/test";
import { expect, expectRoom, openPanelTab, savedGame, seedSave } from "./fixtures";
import { act, tick, spikeCompany } from "../src/sim/__tests__/spikeFixtures";

export async function expectCueColours(cue: Locator, tone: "prepare" | "pressure" | "recovery") {
  const [accent, background] = {
    prepare: ["rgb(244, 185, 66)", "rgb(255, 244, 216)"],
    pressure: ["rgb(242, 139, 130)", "rgb(255, 240, 233)"],
    recovery: ["rgb(85, 191, 166)", "rgb(233, 248, 241)"],
  }[tone];
  await expect(cue).toHaveCSS("border-top-color", accent);
  await expect(cue).toHaveCSS("background-color", background);
  await expect(cue.locator("h3 > .icon")).toHaveCSS("color", accent);
  await expect(cue.getByRole("button", { name: "Got it", exact: true })).toHaveCSS("background-color", accent);
  await expect(cue.getByRole("button", { name: "Got it", exact: true })).toHaveCSS("color", await cue.evaluate(node => getComputedStyle(node).color));
  await expect(cue).toBeInViewport({ ratio: 1 });
}

/** Real Network selection before a pulse must not trap accepted help on About. */
export async function chapter4TrafficTarget(page: Page, touch = false) {
  const press = (button: Locator) => touch ? button.tap() : button.click();
  let game = tick(act(spikeCompany(false), { type: "add_server" }), 2);
  game = tick(act(game, { type: "scale_up", appId: "app-3" }), 3);
  game = tick(act(game, { type: "set_routing", mode: "balanced", targets: ["app-1", "app-2", "app-3"] }));
  game = tick(act(game, { type: "set_traffic_limit", enabled: true }));
  await page.route("**/api/**", route => route.abort()); await seedSave(page, game); await page.goto("/");
  await press(page.getByRole("button", { name: "Continue company", exact: true })); await expectRoom(page);
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 60_000));
  await press(page.getByRole("dialog", { name: "Chapter 4: Prepare", exact: true }).getByRole("button", { name: "Got it", exact: true }));
  await press(page.locator(".campaign-panel").getByRole("button", { name: "Network", exact: true }));
  await closeInspection(page);await press(page.getByRole("button", { name: "Run", exact: true })); await page.clock.runFor(1000);
  await press(page.getByRole("button", { name: "Pause", exact: true }));
  await press(page.getByRole("dialog", { name: "Chapter 4: Spike 1", exact: true }).getByRole("button", { name: "Got it", exact: true }));
  const gold = page.locator(".campaign-gold-attention");
  const accept = async (target: RegExp) => {
    await closeInspection(page);await press(page.getByRole("button", { name: "Hint", exact: true }));
    const hint = page.getByRole("dialog", { name: "Hint", exact: true });
    await expect(hint).not.toContainText("About Network");
    await press(hint.getByRole("button", { name: "Got it", exact: true }));
    await followHintComponent(page);await expect(gold).toHaveCount(1); await expect(gold).toHaveAccessibleName(target); await expect(gold).toBeEnabled();
  };
  const before = await savedGame(page);
  await accept(/^Remove traffic limit/); await press(gold);
  await expect(gold).toHaveCount(1); await expect(gold).toHaveAccessibleName("Confirm");
  await press(page.getByRole("button", { name: "Cancel", exact: true })); await expect(gold).toHaveCount(0);
  await expectInspectionsOnly(page, before);
  await accept(/^Remove traffic limit/); await press(gold); await press(page.getByRole("button", { name: "Confirm", exact: true }));
  expect((await savedGame(page)).campaign!.pending.some(p => p.type === "unlimit")).toBe(true);
  await closeInspection(page);await accept(/^Run$/); await press(gold); await page.clock.runFor(1000);
  await press(page.getByRole("button", { name: "Pause", exact: true }));
  const after = (await savedGame(page)).campaign!;
  expect(after.limit).toBeNull(); expect(after.snapshot.app.demand).toBeLessThanOrEqual(after.snapshot.app.capacity);
  await openPanelTab(page, "Analysis");
  await press(page.locator(".campaign-panel").getByRole("button", { name: "Monitoring", exact: true }));
  await closeInspection(page);await accept(/^Run$/); expect((await savedGame(page)).campaign!.pending).toHaveLength(0);
}
