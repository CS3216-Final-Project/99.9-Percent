import type { Page, TestInfo } from "@playwright/test";
import { expect, expectRoom, savedGame, seedSave } from "./fixtures";
import { pauseTransition } from "../src/sim/__tests__/pauseFixture";
import type { GameState } from "../src/sim";
import { campaignAttention } from "../src/game/campaignAttention";

export async function bootPause(page: Page, game: GameState) {
  await page.route("**/api/**", r => r.abort()); await seedSave(page, game); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click(); await expectRoom(page);
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 60_000));
}
export async function pauseArrival(page: Page, info: TestInfo, chapter: number, touch = false) {
  const pair = pauseTransition(chapter); await bootPause(page, pair.before);
  const run = page.getByRole("button", { name: "Run", exact: true });
  if (touch) await run.tap(); else await run.click();
  await page.clock.runFor(1000);
  const state = await savedGame(page), gold = page.locator(".campaign-gold-attention");
  expect(campaignAttention(state).chapter).toBe(chapter);
  expect(state.campaign!.incident!.id).toBe(pair.incident.campaign!.incident!.id);
  expect(state.campaign!.step).toBe(pair.before.campaign!.step + 1);
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled();
  await expect(gold).toHaveCount(1); await expect(gold).toHaveAccessibleName("Pause");
  await expect(gold).toBeInViewport({ ratio: 1 });
  if (touch || chapter === 1 || chapter === 5) await page.screenshot({ path: info.outputPath("immediate-pause.png") });
  if (touch) await gold.tap(); else await gold.click();
  await expect(gold).toHaveCount(0); await expect(run).toBeVisible();
  await page.clock.runFor(1000);
  expect((await savedGame(page)).campaign!.step).toBe(state.campaign!.step);
}
