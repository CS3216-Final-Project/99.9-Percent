import type { Locator, Page } from "@playwright/test";
import { expect, expectRoom, savedGame, seedSave, tutorial } from "./fixtures";
import { newGame } from "../src/sim";
import { step } from "../src/sim/step";

async function healthWordFits(entry: Locator) {
    const entryBox = (await entry.boundingBox())!, textBox = (await entry.locator("strong").boundingBox())!;
    const textLines = await entry.locator("strong").evaluate(el => {
        const range = document.createRange(); range.selectNodeContents(el); return range.getClientRects().length;
    });
    expect(textLines).toBe(1); // Short status words stay whole, including on narrow phones.
    expect(textBox.x).toBeGreaterThanOrEqual(entryBox.x);
    expect(textBox.x + textBox.width).toBeLessThanOrEqual(entryBox.x + entryBox.width);
}

export async function appHealthJourney(page: Page, width: number, height: number, touch = false) {
    await page.setViewportSize({ width, height });
    if (touch) await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/**", r => r.abort());
    await seedSave(page, newGame(1, `health-${width}`));
    await page.goto("/"); await page.getByRole("button", { name: "Continue company", exact: true }).click();
    await expectRoom(page);
    const before = (await savedGame(page)).campaign;
    const entry = page.getByRole("button", { name: "View app health", exact: true });
    await healthWordFits(entry);
    if (touch) await entry.tap();
    else {
        await entry.focus(); await expect(page.getByRole("tooltip")).toContainText("estimated response time");
        await page.keyboard.press("Escape"); await entry.press("Enter");
    }
    const dialog = page.getByRole("dialog", { name: "App Health", exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Healthy", exact: true })).toBeVisible();
    await expect(dialog).toContainText("100 ms (estimated)"); await expect(dialog).toContainText("0.00%");
    await expect(dialog.getByText(/Rejected requests:/)).toBeHidden();
    await expect(dialog.getByText("500 ms is a target for this game, not a rule for every real app.")).toBeHidden();
    await expect(page.getByRole("button", { name: "Run", exact: true })).toBeVisible();
    const bounds = (await dialog.boundingBox())!, toolbar = (await page.locator(".bottombar").boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThanOrEqual(toolbar.y);
    await page.screenshot({ path: `test-results/app-health-${width}-default.png` });
    const details = dialog.getByText("More details", { exact: true });
    await dialog.getByRole("button", { name: "Close", exact: true }).focus();
    await page.keyboard.press("Shift+Tab"); await expect(details).toBeFocused();
    await page.keyboard.press("Tab"); await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeFocused();
    if (touch) await details.tap(); else { await details.focus(); await page.keyboard.press("Enter"); }
    await expect(dialog.getByText(/Rejected requests:/)).toBeVisible();
    await expect(dialog.getByText("500 ms is a target for this game, not a rule for every real app.")).toBeVisible();
    await expect(dialog).toContainText("separate from failed requests");
    await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `test-results/app-health-${width}-details.png` });
    await page.keyboard.press("Escape"); await expect(dialog).toBeHidden(); await expect(entry).toBeFocused();
    expect((await savedGame(page)).campaign).toEqual(before);
    await entry.press("Space"); await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "View finances", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Company finances", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: /^Add server/ }).click();
    const purchase = page.getByRole("region", { name: "Confirm Add server", exact: true });
    await expect(purchase).toBeVisible();
    await entry.click(); await expect(dialog).toBeVisible(); await page.keyboard.press("Escape");
    await expect(purchase).toBeVisible(); await expect(purchase.getByRole("button", { name: "Confirm", exact: true })).toBeEnabled();
    await purchase.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("main").getByRole("button", { name: "Servers", exact: true }).click();
    const inspection = page.getByRole("dialog", { name: "Servers inspected", exact: true });
    await expect(inspection).toBeVisible(); await inspection.getByRole("button", { name: "Return to room", exact: true }).click();
    expect((await savedGame(page)).campaign!.cashCents).toBe(before!.cashCents);
}

export async function appHealthDuringTutorial(page: Page) {
    await page.route("**/api/**", r => r.abort()); await page.goto("/");
    await page.getByRole("button", { name: "Start Guided Mode", exact: true }).click(); await expectRoom(page);
    const card = tutorial(page), entry = page.getByRole("button", { name: "View app health", exact: true });
    await expect(card).toHaveAccessibleName("Tutorial, step 1 of 21");
    const before = (await savedGame(page)).campaign;
    await entry.click(); const dialog = page.getByRole("dialog", { name: "App Health", exact: true });
    await expect(dialog).toBeVisible(); await expect(card).toBeHidden(); await page.keyboard.press("p");
    await expect(page.getByRole("button", { name: "Run", exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(entry).toBeFocused(); await expect(card).toHaveAccessibleName("Tutorial, step 1 of 21");
    expect((await savedGame(page)).campaign).toEqual(before);
    await page.getByRole("main").getByRole("button", { name: "Servers", exact: true }).click();
    await page.getByRole("dialog", { name: "Servers inspected", exact: true }).getByRole("button", { name: "Return to room", exact: true }).click();
    await expect(card).toHaveAccessibleName("Tutorial, step 2 of 21");
}

export async function appHealthProblem(page: Page, touch = false) {
    const width = touch ? 390 : 1440, height = touch ? 844 : 900;
    await page.setViewportSize({ width, height });
    if (touch) await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/**", r => r.abort());
    let game = newGame(1, "health-problem");
    for (let i = 0; i < 7; i++) game = step(game).state;
    const snapshot = game.campaign!.snapshot;
    await seedSave(page, game); await page.goto("/");
    await page.getByRole("button", { name: "Continue company", exact: true }).click(); await expectRoom(page);
    const entry = page.getByRole("button", { name: "View app health", exact: true });
    await healthWordFits(entry);
    if (touch) await entry.tap(); else { await entry.hover(); await expect(page.getByRole("tooltip")).toContainText("Incident"); await entry.click(); }
    const dialog = page.getByRole("dialog", { name: "App Health", exact: true });
    await expect(dialog.getByRole("heading", { name: "Incident", exact: true })).toBeVisible();
    await expect(dialog).toContainText(`${snapshot.latencyMs.toFixed(0)} ms (estimated)`);
    await expect(dialog).toContainText(`${(snapshot.serviceErrorRate! * 100).toFixed(2)}%`);
    await expect(dialog).toContainText("have not been processed yet");
    await expect(dialog.getByRole("button")).toHaveCount(1); // Inspecting status offers no purchase or automatic navigation.
    await page.screenshot({ path: `test-results/app-health-${width}-problem.png` });
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    expect((await savedGame(page)).campaign).toEqual(game.campaign);
}
