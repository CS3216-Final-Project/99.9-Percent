import type { Locator, Page } from "@playwright/test";
import { test, expect, seedSave, tutorial, savedGame, advanceCampaignStep, CHAPTER_ZERO_LESSONS } from "./fixtures";
import { newGame } from "../src/sim";

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const box = async (locator: Locator) => (await locator.boundingBox())!;

/** The guide card names its step; its lit window holds the control it names and the card never covers it. */
async function step(page: Page, name: string, title: string) {
  const card = page.getByRole("dialog", { name, exact: true });
  await expect(card).toContainText(title);
  await expect(card).toBeInViewport({ ratio: 1 });
  // The lit window follows its control as the layout settles, and the card follows the window.
  const hole = page.locator(".tour-hole");
  await expect.poll(async () => !(await hole.count()) || !overlaps(await box(card), await box(hole)), { message: `${title}: the card covers its target` }).toBe(true);
  return card;
}
const panel = (page: Page) => page.getByRole("complementary", { name: "System metrics" });
async function buy(page: Page, name: RegExp) {
  await panel(page).getByRole("button", { name }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
}
/** Run until a dialog the journey waits for opens, a game second at a time. */
async function runUntil(page: Page, dialog: Locator, budget = 40) {
  for (let i = 0; i < budget && !(await dialog.isVisible()); i++) await advanceCampaignStep(page, { seconds: 1, resumeClock: false });
  await page.clock.resume();
  await expect(dialog).toBeVisible();
}

// Panel-only journeys: the guides point at panel and dock controls, and Chapter 0's layout suite covers the room.
test.beforeEach(async ({ withoutRoom }) => { await withoutRoom(); });

for (const [width, height] of [[1440, 900], [390, 844]]) {
  test(`chapter missions lead a new player from the Opening through the first slowdown into routing at ${width}x${height}`, async ({ page, installClock }) => {
    test.setTimeout(180_000);
    await installClock();
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/**", route => route.abort());
    await seedSave(page, newGame(1, "missions"), { tutorialDone: false, walkthroughStep: CHAPTER_ZERO_LESSONS - 1, walkthroughFurthestStep: CHAPTER_ZERO_LESSONS - 1, chapterTours: [], tipsSeen: [] });
    await page.goto("/");
    await page.getByRole("button", { name: "Continue company", exact: true }).click();
    await tutorial(page).getByRole("button", { name: "Finish walkthrough", exact: true }).click();

    // Chapter 1: the Opening guide follows Chapter 0, and pauses when demand grows.
    const opening = (n: number) => `Chapter guide, step ${n} of 5`;
    await (await step(page, opening(1), "Chapter 1: Opening")).getByRole("button", { name: "Got it", exact: true }).click();
    await step(page, opening(2), "Run and watch");
    await advanceCampaignStep(page, { seconds: 4 - (await savedGame(page)).campaign!.step });
    await step(page, opening(3), "Demand just grew");
    await expect(page.getByRole("button", { name: "Run", exact: true })).toBeVisible();
    await panel(page).getByRole("button", { name: "Database", exact: true }).click();
    await step(page, opening(4), "Fix the bottleneck");

    // Doing nothing lets the slowdown start; its guide takes over.
    await advanceCampaignStep(page, { seconds: 2 });
    expect((await savedGame(page)).phase).toBe("incident");
    const slowdown = (n: number) => `Slowdown guide, step ${n} of 4`;
    await (await step(page, slowdown(1), "A slowdown started")).getByRole("button", { name: "Next", exact: true }).click();
    // The Database is still the one inspected, so finding the cause is already done.
    await step(page, slowdown(3), "Press Upgrade database");
    await buy(page, /^Upgrade database/);
    await step(page, slowdown(4), "Run to recover");
    const postmortem = page.getByRole("dialog", { name: "Incident postmortem" });
    await runUntil(page, postmortem);
    await expect(page.getByRole("dialog", { name: /^(Chapter|Slowdown) guide/ })).toHaveCount(0);
    await postmortem.getByRole("button", { name: "Continue company", exact: true }).click();
    await page.getByRole("dialog", { name: "First growth challenge handled" }).getByRole("button", { name: "Continue operating", exact: true }).click();

    // Chapter 2: App Servers first, then routing, then the Database that brings the wave.
    const scaling = (n: number) => `Chapter guide, step ${n} of 7`;
    await (await step(page, scaling(1), "Chapter 2: Scaling & Routing")).getByRole("button", { name: "Got it", exact: true }).click();
    await step(page, scaling(3), "Add App Server capacity");
    await buy(page, /^Add server/);
    await step(page, scaling(4), "Deploy load balancing");
    await advanceCampaignStep(page, { seconds: 2 });
    await buy(page, /^Deploy load balancing/);
    await step(page, scaling(5), "Send traffic to both servers");
    await advanceCampaignStep(page, { seconds: 2 });
    const routing = await step(page, scaling(5), "Press All apps under Configure routing.");
    await expect(page.locator('[data-tour="routing"]')).toHaveAttribute("open", "");
    await page.screenshot({ path: `test-results/chapter-missions-routing-${width}x${height}.png` });
    await page.getByRole("button", { name: /^All apps$/ }).click();
    await expect(routing).toBeHidden();
    await step(page, scaling(6), "Make room in the Database");
    const c = (await savedGame(page)).campaign!;
    expect(c.routing.targets.length + c.pending.filter(a => a.type === "routing").length).toBeGreaterThan(0);
  });
}
