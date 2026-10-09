import { test as base, expect, type Page } from '@playwright/test';
import type { GameState } from '../src/sim';
import { DEFAULT_META } from '../src/game/persist';

// These tests render the actual WebGL scene. Unhandled browser errors fail each case.
export const test = base.extend<{ healthyBrowser: void }>({
  healthyBrowser: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await use();
    expect(errors, 'Unhandled browser errors').toEqual([]);
  }, { auto: true }],
});
export { expect };

export async function seedSave(page: Page, game: GameState) {
  await page.addInitScript(({ game, meta }) => {
    // Only create the fixture once; a reload must exercise the real saved state.
    if (localStorage.getItem('nn.campaign.save.v1') === null) {
      localStorage.setItem('nn.campaign.save.v1', JSON.stringify({schemaVersion:1,scenarioId:"opening-db",scenarioVersion:1,runId:game.campaign!.runId,game,runtime:{remainderMs:0},savedAt:Date.now()}));
      localStorage.setItem('nn.campaign.meta.v1', JSON.stringify(meta));
    }
  }, { game, meta: { ...DEFAULT_META, tutorialDone: true, incidentGuideDone: true, runsStarted: 1 } });
}

export async function savedGame(page: Page): Promise<GameState> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('nn.campaign.save.v1')!).game);
}

export async function expectRoom(page: Page) {
  const room = page.getByRole('main');
  const canvas = room.locator('canvas');
  await expect(canvas).toBeVisible();
  // A visible canvas alone does not prove that WebGL initialized successfully.
  await expect.poll(() => canvas.evaluate(el => {
    const gl = (el as HTMLCanvasElement).getContext('webgl2');
    return !!gl && !gl.isContextLost();
  })).toBe(true);
  // The incident panel has its own Servers control outside the room.
  await expect(room.getByRole('button', { name: 'Servers', exact: true })).toBeVisible();
}
