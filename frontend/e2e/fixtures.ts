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
  await page.getByRole("button", { name: "Advance game second", exact: true }).click();
}

/** Perform a required exercise and advance through the visible lesson controls. */
export async function nextChapterZero(page: Page, touch = false) {
  const card = tutorial(page);
  const click = async (control: ReturnType<Page["getByRole"]>) => touch ? control.tap() : control.click();
  const next = card.getByRole("button", { name: "Next", exact: true });
  if (!(await next.isEnabled())) {
    const step = Number((await card.getAttribute("aria-label"))!.match(/step (\d+) of/)![1]);
    const panel = page.getByRole("complementary", { name: "System metrics" });
    if (step === 1) await click(panel.getByRole("button", { name: "App Server", exact: true }));
    else if (step === 2) await click(panel.getByRole("button", { name: "Database", exact: true }));
    else if (step === 3) {
      await click(panel.getByRole("button", { name: "App Server", exact: true }));
      await expect(next).toBeDisabled();
      await click(panel.getByRole("button", { name: "Database", exact: true }));
    }
    else if (step === 6) {
      await click(page.getByRole("button", { name: "Run", exact: true }));
      await expect(page.getByRole("button", { name: "Run", exact: true })).toBeVisible();
    } else if (step === 7) await click(panel.locator(".act:not(:disabled)").first());
    else if (step === 8) {
      if (!(await page.getByRole("button", { name: "Cancel", exact: true }).count())) await click(panel.locator(".act:not(:disabled)").first());
      await click(page.getByRole("button", { name: "Cancel", exact: true }));
    } else if (step === 12) {
      const speed = page.getByRole("group", { name: "Game speed", exact: true });
      await click(speed.locator('button:not([aria-pressed="true"])').first());
    } else if (step === 14 || step === 15) {
      await click(page.getByRole("button", { name: step === 14 ? "Tech" : "History", exact: true }));
      await click(page.locator(".sheet-head").getByRole("button", { name: "Close", exact: true }));
    } else if (step === 16) {
      await click(page.getByRole("button", { name: "Menu", exact: true }));
      await click(page.getByRole("dialog", { name: "Menu", exact: true }).getByRole("button", { name: /Save now/ }));
      await click(page.getByRole("dialog", { name: "Menu", exact: true }).getByRole("button", { name: "Resume", exact: true }));
    } else throw new Error(`Unexpected required interaction in lesson ${step}`);
    await expect(next).toBeEnabled();
  }
  await click(next);
}

/** Complete Chapter 0 through the real UI, from whichever lesson is currently open. */
export async function finishChapterZero(page: Page, touch = false) {
  const card = tutorial(page);
  for (let lesson = 0; lesson < 21; lesson++) {
    const finish = card.getByRole("button", { name: "Finish Chapter 0", exact: true });
    if (await finish.count()) { if (touch) await finish.tap(); else await finish.click(); return; }
    await nextChapterZero(page, touch);
  }
  throw new Error("Chapter 0 did not reach its explicit finish action");
}

/** Unrelated journeys complete mandatory Chapter 0; optional spotlight guides retain their Skip action. */
export async function completeTutorial(page: Page) {
  if (await page.locator(".chapter-zero-modal").count()) {
    // These journeys previously skipped one card. Their setup now performs 21 real lessons,
    // including a bounded clock run; reserve that work without relaxing any assertion timeout.
    test.setTimeout(test.info().timeout + 60_000);
    await finishChapterZero(page);
  }
  else await page.getByRole("button", { name: "Skip", exact: true }).click();
}
