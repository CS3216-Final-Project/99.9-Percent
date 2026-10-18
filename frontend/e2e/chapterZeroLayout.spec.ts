import type { Locator } from "@playwright/test";
import { test, expect, expectRoom, seedSave, tutorial, savedGame, nextChapterZero, CHAPTER_ZERO_LESSONS } from "./fixtures";
import { newGame } from "../src/sim";

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const contains = (outer: Box, inner: Box) => inner.x >= outer.x - 1 && inner.y >= outer.y - 1 && inner.x + inner.width <= outer.x + outer.width + 1 && inner.y + inner.height <= outer.y + outer.height + 1;
const box = async (locator: Locator) => (await locator.boundingBox())!;

for (const [width, height] of [[1440, 900], [1366, 768], [390, 844], [320, 568], [844, 390]]) {
  test(`Chapter 0 dims around each lit control and never covers it with its card at ${width}x${height}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/**", route => route.abort());
    await seedSave(page, newGame(1, "real-controls"), { tutorialDone: false, walkthroughStep: 0 });
    await page.goto("/");
    await page.getByRole("button", { name: "Continue company", exact: true }).click();
    await expectRoom(page);
    const card = tutorial(page);
    const spotlight = page.locator(".cz-spotlight");
    await expect(card).toHaveAttribute("aria-modal", "false");
    for (let lesson = 1; lesson <= CHAPTER_ZERO_LESSONS; lesson++) {
      await expect(card).toHaveAccessibleName(`Walkthrough, step ${lesson} of ${CHAPTER_ZERO_LESSONS}`);
      await expect(card).toBeInViewport({ ratio: 1 });
      const id = (await card.getAttribute("data-lesson-id"))!;
      const menu = page.getByRole("button", { name: "Menu", exact: true });
      await expect(menu).toBeEnabled();
      await expect(spotlight).toBeVisible();
      if (id === "goal") {
        // Nothing to point at yet: the whole game is dimmed, and its controls stay locked.
        await expect(spotlight).toHaveClass(/is-full/);
        await menu.click();
        const settings = page.getByRole("dialog", { name: "Menu", exact: true });
        await settings.getByRole("tab", { name: "Sound", exact: true }).click();
        await expect(settings.getByRole("button", { name: "Mute all", exact: true })).toBeEnabled();
        await expect(card).toBeHidden();
        await page.keyboard.press("Escape");
        await expect(settings).toBeHidden();
        await expect(card).toHaveAccessibleName(`Walkthrough, step ${lesson} of ${CHAPTER_ZERO_LESSONS}`);
        await expect(page.getByRole("complementary", { name: "System metrics" }).getByRole("button", { name: "Database", exact: true })).toBeDisabled();
        await page.keyboard.press("PageUp");
        await expect(page.locator('.floor-menu button[data-floor="servers"]')).toHaveAttribute("aria-pressed", "true");
      }
      if (id === "quote") {
        await page.getByRole("complementary", { name: "System metrics" }).locator(".act:not(:disabled)").first().click();
        await expect(page.getByRole("button", { name: "Confirm", exact: true })).toBeDisabled();
        await expect(card).toHaveAttribute("data-lesson-id", "cancel");
        lesson++;
        await expect(card).toHaveAccessibleName(`Walkthrough, step ${lesson} of ${CHAPTER_ZERO_LESSONS}`);
      }
      if (await card.getAttribute("data-lesson-id") === "cancel") {
        const quote = page.getByRole("region", { name: "Confirm Add server", exact: true });
        await page.keyboard.press("Escape");
        // The quote's Cancel button can occupy the room's centre on short screens.
        await page.getByRole("main").locator("canvas").click({ position: { x: 4, y: 4 } });
        await expect(quote).toBeVisible();
        await expect(quote.getByRole("button", { name: "Confirm", exact: true })).toBeDisabled();
        await expect(quote.getByRole("button", { name: "Cancel", exact: true })).toBeEnabled();
        await page.screenshot({ path: `test-results/chapter-zero-cancel-${width}x${height}.png` });
      }
      const target = page.locator(".chapter-zero-target");
      if (await target.count()) {
        // The lit control is fully visible, inside the undimmed window and clear of the card.
        // A phone on its side leaves about 390 px for the HUD, panel and card; there the card scrolls and may meet the control.
        const roomy = height >= 500;
        await expect(target).toBeInViewport({ ratio: roomy ? 1 : 0.5 });
        await expect(spotlight).not.toHaveClass(/is-full/);
        const control = await box(target);
        await expect.poll(async () => contains(await box(spotlight), control)).toBe(true);
        // The card settles beside the control once the layout has been measured.
        if (roomy) await expect.poll(async () => overlaps(await box(card), await box(target))).toBe(false);
      }
      if (id === "speed") {
        const speed = page.locator(".time-menu > summary");
        expect(await speed.evaluate(el => {
          const r = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }), "Navigation must not cover the walkthrough's speed selector").toBe(true);
      }
      await page.screenshot({ path: `test-results/chapter-zero-${lesson}-${id}-${width}x${height}.png` });
      if (lesson === CHAPTER_ZERO_LESSONS) await card.getByRole("button", { name: "Finish walkthrough", exact: true }).click();
      else await nextChapterZero(page);
    }
    await expect(card).toBeHidden();
    await expect(page.locator(".cz-spotlight")).toHaveCount(0);
    expect((await savedGame(page)).campaign).toMatchObject({ step: 1, actions: [], pending: [] });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
