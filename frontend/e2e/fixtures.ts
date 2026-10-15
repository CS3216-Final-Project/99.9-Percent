import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import type { GameState } from '../src/sim';
import { CHAPTER_TOURS, DEFAULT_META, type Meta } from '../src/game/persist';
import { decodeSave, makeEnvelope } from '../src/game/saveEnvelope';

// Unhandled browser errors fail each case. Journeys that call withoutRoom() skip the WebGL scene; the rest draw it.
export const test = base.extend<{ healthyBrowser: void; chapterCompletions: void; withoutRoom: (target?: Page | BrowserContext) => Promise<void> }>({
  /**
   * Finishing Scaling & Routing or Data Strategy stops on a dialog at whatever step the company qualifies.
   * Journeys that walk through those chapters stay in the chapter and carry on as before; a case that checks
   * the dialog itself calls page.removeLocatorHandler(chapterComplete(page)).
   */
  chapterCompletions: [async ({ page }, use) => {
    await page.addLocatorHandler(chapterComplete(page), dialog => dialog.getByRole('button', { name: 'Stay in this chapter', exact: true }).click());
    await use();
  }, { auto: true }],
  healthyBrowser: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await use();
    expect(errors, 'Unhandled browser errors').toEqual([]);
  }, { auto: true }],
  /**
   * Replaces the lazily loaded 3D room with an empty component. Software WebGL makes the room
   * the most expensive part of every test, so journeys that never touch it skip drawing it.
   */
  withoutRoom: async ({ page }, provide) => {
    let skipped = false;
    let stubbed = 0;
    await provide(async (target = page) => {
      skipped = true;
      await target.route('**/assets/Facility-*.js', route => {
        stubbed++;
        return route.fulfill({ contentType: 'text/javascript', body: 'export default function Facility() { return null; }' });
      });
    });
    // A renamed scene chunk would silently bring the room back and the time with it.
    if (skipped) expect(stubbed, 'The 3D room chunk was never requested, so it was not skipped').toBeGreaterThan(0);
  },
});
export { expect };

/** The dialog that announces a finished Scaling & Routing or Data Strategy chapter. */
export const chapterComplete = (page: Page) => page.getByRole('dialog', { name: /^(Scaling & Routing|Data Strategy) complete$/ });

/** The Guided Mode walkthrough's card, whichever step it shows. */
export const tutorial = (page: Page) => page.getByRole('dialog', { name: /^Tutorial, step/ });

/** Seeds a company whose player has finished the walkthrough and seen every chapter's guide, unless `meta` says otherwise. */
export async function seedSave(page: Page, game: GameState, extraMeta: Partial<Meta> = {}) {
  await page.addInitScript(({ save, meta }) => {
    // Only create the fixture once; a reload must exercise the real saved state.
    if (localStorage.getItem('nn.campaign.save.v1') === null) {
      localStorage.setItem('nn.campaign.save.v1', save);
      // Keep fields a companion fixture (for example the Challenge Mode unlock) already wrote.
      let earlier: Record<string, unknown> = {};
      try { const parsed = JSON.parse(localStorage.getItem('nn.campaign.meta.v1') ?? '{}'); if (parsed && typeof parsed === 'object') earlier = parsed; } catch { /* defaults below */ }
      localStorage.setItem('nn.campaign.meta.v1', JSON.stringify({ ...earlier, ...meta }));
    }
  }, { save: JSON.stringify(makeEnvelope(game)), meta: { ...DEFAULT_META, tutorialDone: true, incidentGuideDone: true, chapterTours: [...CHAPTER_TOURS], runsStarted: 1, ...extraMeta } });
}

/**
 * Marks Challenge Mode as unlocked in the campaign profile, the way a finished
 * Guided Mode run leaves it. Apply before navigation in any journey that starts
 * or switches to Challenge Mode; it merges, so seed order does not matter.
 */
export async function unlockChallenge(page: Page) {
  await page.addInitScript(defaults => {
    let meta: Record<string, unknown> = {};
    try { const parsed = JSON.parse(localStorage.getItem('nn.campaign.meta.v1') ?? '{}'); if (parsed && typeof parsed === 'object') meta = parsed; } catch { /* defaults below */ }
    localStorage.setItem('nn.campaign.meta.v1', JSON.stringify({ ...defaults, ...meta, challengeUnlocked: true }));
  }, DEFAULT_META);
}

/** The company the stored save replays to, decoded the same way the game loads it. */
export async function savedGame(page: Page): Promise<GameState> {
  const raw = await page.evaluate(() => localStorage.getItem('nn.campaign.save.v1'));
  const result = decodeSave(raw ?? 'null');
  if (result.status !== 'ok') throw new Error(`Stored save is ${result.status}`);
  return JSON.parse(JSON.stringify(result.game)) as GameState;
}

export async function expectRoom(page: Page, timeout?: number) {
  const room = page.getByRole('main');
  const canvas = room.locator('canvas');
  await expect(canvas).toBeVisible();
  // A visible canvas alone does not prove that WebGL initialized successfully.
  await expect.poll(() => canvas.evaluate(el => {
    const gl = (el as HTMLCanvasElement).getContext('webgl2');
    return !!gl && !gl.isContextLost();
  }), { timeout }).toBe(true);
  // The incident panel has its own Servers control outside the room.
  await expect(room.getByRole('button', { name: 'Servers', exact: true })).toBeVisible();
}

/** Classic keeps the weekly state in its own save slot. */
export async function seedClassicSave(page: Page, game: GameState) {
  await page.addInitScript(({ game, meta }) => {
    if (localStorage.getItem('nn.classic.save.v1') === null) {
      localStorage.setItem('nn.classic.save.v1', JSON.stringify({ savedAt: 1, game }));
      localStorage.setItem('nn.classic.meta.v1', JSON.stringify(meta));
    }
  }, { game, meta: { ...DEFAULT_META, tutorialDone: true, incidentGuideDone: true, runsStarted: 1 } });
}

export async function savedClassicGame(page: Page): Promise<GameState> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('nn.classic.save.v1')!).game);
}

/** Open Campaign's secondary precision control through the real UI. */
export async function advanceCampaignStep(page: Page) {
  const more = page.locator(".campaign-advanced");
  if (!(await more.evaluate(el => (el as HTMLDetailsElement).open))) await more.locator("summary").click();
  await page.getByRole("button", { name: "Advance step", exact: true }).click();
}
