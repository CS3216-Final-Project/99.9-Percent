import { test as base, expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import type { GameState } from '../src/sim';
import { CHAPTER_TOURS, DEFAULT_META, type Meta } from '../src/game/persist';
import { decodeSave, makeEnvelope } from '../src/game/saveEnvelope';
import { WALKTHROUGH_LESSON_IDS, WALKTHROUGH_LESSONS as CHAPTER_ZERO_LESSONS } from '../src/game/walkthrough';
export { CHAPTER_ZERO_LESSONS };
/** A Chapter 0 lesson's 1-based position, as its card announces it. */
export const lessonNumber = (id: (typeof WALKTHROUGH_LESSON_IDS)[number]) => WALKTHROUGH_LESSON_IDS.indexOf(id) + 1;

const controlledPages = new WeakSet<Page>();
type ClockOptions = Parameters<Page["clock"]["install"]>[0];

// Unhandled browser errors fail each case. Journeys that call withoutRoom() skip the WebGL scene; the rest draw it.
export const test = base.extend<{ healthyBrowser: void; chapterCompletions: void; recoveryNotices: void; reviewRecoveryNotice: boolean; companyMessages: void; reviewCompanyMessage: boolean; overviewChosen: boolean; chosenView: void; installClock: (options?: ClockOptions) => Promise<void>; withoutRoom: (target?: Page | BrowserContext) => Promise<void> }>({
  // Unrelated journeys dismiss optional narrative, while dedicated introduction tests opt out.
  reviewCompanyMessage: [true, { option: true }],
  companyMessages: [async ({ page, reviewCompanyMessage }, use) => {
    if (reviewCompanyMessage) await page.addLocatorHandler(page.getByRole('dialog', { name: 'Company Message', exact: true }), dialog => dialog.getByRole('button', { name: 'Got it', exact: true }).click());
    await use();
  }, { auto: true }],
  // Existing journeys still review and acknowledge the actual report themselves. Only the new
  // presentation step is handled here; dedicated two-stage/reload/focus journeys opt out.
  reviewRecoveryNotice: [true, { option: true }],
  recoveryNotices: [async ({ page, reviewRecoveryNotice }, use) => {
    if (reviewRecoveryNotice) await page.addLocatorHandler(page.getByRole('dialog', { name: 'System Recovered!', exact: true }), dialog => dialog.getByRole('button', { name: 'View Incident Report', exact: true }).click());
    await use();
  }, { auto: true }],
  // Opt in before navigation. Scene-only journeys keep the browser's native animation/audio clocks.
  installClock: async ({ page }, provide) => { await provide(async (options) => { await page.clock.install(options); controlledPages.add(page); }); },
  /**
   * Finishing Scaling & Routing or Data Strategy stops on a dialog at whatever step the company qualifies.
   * Journeys that walk through those chapters stay in the chapter and carry on as before; a case that checks
   * the dialog itself calls page.removeLocatorHandler(chapterComplete(page)).
   */
  chapterCompletions: [async ({ page }, use) => {
    await page.addLocatorHandler(chapterComplete(page), dialog => dialog.getByRole('button', { name: 'Stay in this chapter', exact: true }).click());
    await use();
  }, { auto: true }],
  /**
   * A run opens in first person until the player chooses a view. Journeys play as someone who chose the overview, in
   * both modes, unless they say otherwise with test.use({ overviewChosen: false }); a record a journey seeds itself wins.
   */
  overviewChosen: [true, { option: true }],
  chosenView: [async ({ context, overviewChosen }, use) => {
    if (overviewChosen) {
      await context.addInitScript(() => {
        for (const key of ['nn.campaign.exploration.v1', 'nn.classic.exploration.v1']) {
          if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify({ version: 1, floor: 'servers', walking: false, viewpoint: 'overview', viewChosen: true, avatar: null, camera: null }));
        }
      });
    }
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
export const tutorial = (page: Page) => page.getByRole('dialog', { name: /^(?:Walkthrough|Tutorial), step/ });

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

/** Run for exact game seconds through public controls and fixed-duration ticks. */
export async function advanceCampaignStep(page: Page, { seconds = 1, resumeClock = true }: { seconds?: number; resumeClock?: boolean } = {}) {
  if (seconds <= 0) return;
  if (!controlledPages.has(page)) throw new Error("Call installClock before navigation in journeys that advance exact game seconds.");
  const counter = page.getByTestId("physical-step");
  const before = Number(await counter.textContent());
  // The company is paused. Leave enough lead time for a busy software-rendered browser
  // to deliver pauseAt without its target already being in the past.
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 60_000));
  await page.getByRole("button", { name: "Run", exact: true }).click();
  const target = before + seconds;
  for (let tick = 0; tick < seconds * 10 && Number(await counter.textContent()) < target; tick++) {
    const completed = chapterComplete(page);
    if (await completed.isVisible()) {
      // Trigger the journey's acknowledgement handler before delivering more ticks.
      // Staying in a chapter deliberately leaves the game paused, so this requested
      // batch must explicitly run again to deliver its remaining game seconds.
      await expect(completed).toBeHidden();
      await page.getByRole("button", { name: "Run", exact: true }).click();
    }
    await page.clock.runFor(200);
  }
  await expect(counter).toHaveText(String(target));
  const pause = page.getByRole("button", { name: "Pause", exact: true });
  if (await pause.isVisible()) await pause.click();
  if (resumeClock) await page.clock.resume();
}

export async function openRoomControls(page: Page) {
  const menu = page.locator(".room-menu");
  if (!(await menu.evaluate(el => (el as HTMLDetailsElement).open))) await menu.locator(":scope > summary").click();
}
export async function openCameraControls(page: Page) {
  const menu = page.locator(".camera-menu");
  if (await menu.isVisible()) {
    if (!(await menu.evaluate(el => (el as HTMLDetailsElement).open))) await menu.locator(":scope > summary").click();
  } else await openRoomControls(page);
}
export async function setGameSpeed(page: Page, speed: number) {
  const menu = page.locator(".time-menu");
  if (!(await menu.evaluate(el => (el as HTMLDetailsElement).open))) await menu.locator(":scope > summary").click();
  await page.getByRole("group", { name: "Game speed" }).getByRole("button", { name: `${speed}×`, exact: true }).click();
  await menu.locator(":scope > summary").click();
}

/**
 * Press Next until the lesson moves on. The card can move as Next becomes ready (an inspection's spotlight jumps to
 * its readings), so a click may land where the card was and miss; a player would simply press again. The lesson on
 * the card is read afresh before each press, so a press that did land is never repeated on the next lesson.
 */
async function pressNext(card: Locator, step: string, touch: boolean) {
  const next = card.getByRole("button", { name: "Next", exact: true });
  await expect(async () => {
    // Bounded, so a press that cannot happen fails this try instead of waiting out the whole journey.
    if ((await card.getAttribute("data-lesson")) === step) await (touch ? next.tap({ timeout: 5_000 }) : next.click({ timeout: 5_000 }));
    await expect(card).not.toHaveAttribute("data-lesson", step, { timeout: 2_000 });
  }, `Chapter 0 lesson ${step} did not move on after Next`).toPass({ timeout: 20_000 });
}

/** Perform the open lesson's required exercise, which moves on by itself (inspections then press Next), or press Next on a reading lesson. */
export async function nextChapterZero(page: Page, touch = false) {
  const card = tutorial(page);
  const click = async (control: Locator) => touch ? control.tap() : control.click();
  const next = card.getByRole("button", { name: "Next", exact: true });
  const lesson = (await card.getAttribute("data-lesson-id"))!;
  const step = (await card.getAttribute("data-lesson"))!;
  if (await next.isEnabled()) { await pressNext(card, step, touch); return; }
  const panel = page.getByRole("complementary", { name: "System metrics" });
  if (lesson === "inspect-app" || lesson === "inspect-db") {
    // An inspection waits on its readings until the player presses Next.
    await click(panel.getByRole("button", { name: lesson === "inspect-app" ? "App Server" : "Database", exact: true }));
    await expect(next).toBeEnabled();
    await pressNext(card, step, touch);
    return;
  } else if (lesson === "run") {
    await click(page.getByRole("button", { name: "Run", exact: true }));
    await expect(page.getByRole("button", { name: "Run", exact: true })).toBeVisible();
  } else if (lesson === "quote") await click(panel.locator(".act:not(:disabled)").first());
  else if (lesson === "cancel") {
    if (!(await page.getByRole("button", { name: "Cancel", exact: true }).count())) await click(panel.locator(".act:not(:disabled)").first());
    await click(page.getByRole("button", { name: "Cancel", exact: true }));
  } else if (lesson === "speed") {
    const menu = page.locator(".time-menu");
    if (!(await menu.evaluate(el => (el as HTMLDetailsElement).open))) await click(menu.locator(":scope > summary"));
    const speed = page.getByRole("group", { name: "Game speed", exact: true });
    // Choosing a speed finishes the lesson; the next card may already sit over the menu's trigger.
    await click(speed.locator('button:not([aria-pressed="true"])').first());
  } else throw new Error(`Unexpected required interaction in lesson ${lesson}`);
  // A finished exercise opens the next lesson.
  await expect(card).not.toHaveAttribute("data-lesson", step);
}

/** Complete Chapter 0 through the real UI, from whichever lesson is currently open. */
export async function finishChapterZero(page: Page, touch = false) {
  const card = tutorial(page);
  for (let lesson = 0; lesson < CHAPTER_ZERO_LESSONS; lesson++) {
    const finish = card.getByRole("button", { name: "Finish walkthrough", exact: true });
    if (await finish.count()) { if (touch) await finish.tap(); else await finish.click(); return; }
    await nextChapterZero(page, touch);
  }
  throw new Error("Chapter 0 did not reach its explicit finish action");
}

/** Unrelated journeys complete mandatory Chapter 0; optional spotlight guides retain their Skip action. */
export async function completeTutorial(page: Page) {
  if (await page.locator(".chapter-zero-guide").count()) {
    // Completing the real lessons is setup for these journeys. Bound that setup
    // separately, then preserve the journey's original budget and assertion timeouts.
    const journeyBudget = test.info().timeout;
    const started = performance.now();
    test.setTimeout(journeyBudget + 180_000);
    await test.step("Complete mandatory Chapter 0 setup", () => finishChapterZero(page), { timeout: 180_000 });
    test.setTimeout(journeyBudget + Math.ceil(performance.now() - started));
  }
  else await page.getByRole("button", { name: "Skip", exact: true }).click();
}
