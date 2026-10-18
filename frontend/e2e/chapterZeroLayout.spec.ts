import { test, expect, expectRoom, seedSave, tutorial, savedGame, nextChapterZero } from "./fixtures";
import { newGame } from "../src/sim";

for (const [width, height] of [[1440, 900], [390, 844], [320, 568], [844, 390]]) {
  test(`Chapter 0 keeps guidance fixed and real game controls reachable at ${width}x${height}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/**", route => route.abort());
    await seedSave(page, newGame(1, "real-controls"), { tutorialDone: false, walkthroughStep: 0 });
    await page.goto("/");
    await page.getByRole("button", { name: "Continue company", exact: true }).click();
    await expectRoom(page);
    const card = tutorial(page);
    await expect(card).toHaveAttribute("aria-modal", "false");
    const frame = (await card.boundingBox())!;
    const back = (await card.getByRole("button", { name: "Back", exact: true }).boundingBox())!;
    const forward = (await card.locator(".btn-primary").boundingBox())!;
    for (let lesson = 1; lesson <= 21; lesson++) {
      await expect(card).toHaveAccessibleName(`Walkthrough, step ${lesson} of 21`);
      await expect(card).toBeInViewport({ ratio: 1 });
      const menu = page.getByRole("button", { name: "Menu", exact: true });
      await expect(menu).toBeEnabled();
      if (lesson === 1 || lesson === 7 || lesson === 8) {
        await menu.click();
        const settings = page.getByRole("dialog", { name: "Menu", exact: true });
        await settings.getByRole("tab", { name: "Sound", exact: true }).click();
        await expect(settings.getByRole("button", { name: "Mute all", exact: true })).toBeEnabled();
        await page.keyboard.press("Escape");
        await expect(settings).toBeHidden();
        await expect(card).toHaveAccessibleName(`Walkthrough, step ${lesson} of 21`);
      }
      if (lesson === 1) {
        await expect(page.getByRole("complementary", { name: "System metrics" }).getByRole("button", { name: "Database", exact: true })).toBeDisabled();
        await page.keyboard.press("PageUp");
        await expect(page.locator('.floor-menu button[data-floor="servers"]')).toHaveAttribute("aria-pressed", "true");
      }
      if (lesson === 7) {
        await page.getByRole("complementary", { name: "System metrics" }).locator(".act:not(:disabled)").first().click();
        await expect(page.getByRole("button", { name: "Confirm", exact: true })).toBeDisabled();
        await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
      }
      if (lesson === 8) {
        const quote = page.getByRole("region", { name: "Confirm Add server", exact: true });
        await page.keyboard.press("Escape");
        // The quote's Cancel button can occupy the room's centre on short screens.
        await page.getByRole("main").locator("canvas").click({ position: { x: 4, y: 4 } });
        await expect(quote).toBeVisible();
        await expect(quote.getByRole("button", { name: "Confirm", exact: true })).toBeDisabled();
        await expect(quote.getByRole("button", { name: "Cancel", exact: true })).toBeEnabled();
        await page.screenshot({ path: `test-results/chapter-zero-cancel-locked-${width}x${height}.png` });
      }
      if (lesson === 6) {
        await expect(card.locator(".lesson-tip kbd")).toHaveText("P");
        const description = await card.locator(".lesson-intro").evaluate(el => getComputedStyle(el).fontSize);
        expect(await card.locator(".lesson-caption").evaluate(el => getComputedStyle(el).fontSize)).toBe(description);
        expect(await card.locator(".lesson-task").evaluate(el => getComputedStyle(el).borderLeftWidth)).toBe("3px");
        expect(await card.locator(".lesson-tip").evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
        await expect(card.locator(".lesson-intro strong")).toHaveCount(0);
        await page.screenshot({ path: `test-results/chapter-zero-clock-${width}x${height}.png` });
        await card.locator(".lesson-tip").scrollIntoViewIfNeeded();
        await page.screenshot({ path: `test-results/chapter-zero-clock-tip-${width}x${height}.png` });
        await card.getByRole("heading", { name: "You control the clock", exact: true }).scrollIntoViewIfNeeded();
      }
      if (lesson === 3) {
        const panel = page.getByRole("complementary", { name: "System metrics" });
        const next = card.getByRole("button", { name: "Next", exact: true });
        await expect(next).toBeDisabled();
        await panel.getByRole("button", { name: "App Server", exact: true }).click();
        await expect(next).toBeDisabled();
        const rows = card.locator(".lesson-evidence dl > div");
        await expect(rows).toHaveCount(2);
        const demand = (await rows.nth(0).boundingBox())!;
        const capacity = (await rows.nth(1).boundingBox())!;
        expect(capacity.y).toBeGreaterThanOrEqual(demand.y + demand.height);
        await panel.getByRole("button", { name: "Database", exact: true }).click();
        await expect(next).toBeEnabled();
        await page.screenshot({ path: `test-results/chapter-zero-evidence-${width}x${height}.png` });
      }
      const box = (await card.boundingBox())!;
      expect(box.height).toBeCloseTo(frame.height, 0); expect(box.y).toBeCloseTo(frame.y, 0);
      const previous = (await card.getByRole("button", { name: "Back", exact: true }).boundingBox())!;
      const next = (await card.locator(".btn-primary").boundingBox())!;
      expect(previous.y).toBeCloseTo(back.y, 0); expect(next.y).toBeCloseTo(forward.y, 0);
      expect(next.height).toBeCloseTo(forward.height, 0); expect(next.width).toBeCloseTo(forward.width, 0);
      if ([1, 2, 6, 7, 12, 13, 14, 15, 16].includes(lesson)) {
        const actual = page.locator(".chapter-zero-target");
        await expect(actual).toBeVisible();
        await expect(actual).toBeInViewport({ ratio: 1 });
        const control = (await actual.boundingBox())!;
        expect(control.x >= box.x + box.width || control.y >= box.y + box.height || control.x + control.width <= box.x || control.y + control.height <= box.y).toBe(true);
      }
      if (lesson === 1 || lesson === 8) await page.screenshot({ path: `test-results/chapter-zero-real-${lesson}-${width}x${height}.png` });
      if (lesson === 21) await card.getByRole("button", { name: "Finish walkthrough", exact: true }).click();
      else await nextChapterZero(page);
    }
    await expect(card).toBeHidden();
    expect((await savedGame(page)).campaign).toMatchObject({ step: 1, actions: [], pending: [] });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
