import type { Page, TestInfo } from "@playwright/test";
import { expect, expectRoom, savedGame, seedSave } from "./fixtures";
import { financiallyTrappedCompany } from "../src/game/__fixtures__/chapter6Finance";

export async function chapter6FinanceJourney(page: Page, info: TestInfo, touch = false) {
  const game = financiallyTrappedCompany();
  await page.route("**/api/**", route => route.abort()); await seedSave(page, game); await page.goto("/");
  const press = async (button: ReturnType<Page["getByRole"]>) => touch ? button.tap() : button.click();
  await press(page.getByRole("button", { name: "Continue company", exact: true })); await expectRoom(page);
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 60_000));
  await press(page.getByRole("dialog", { name: "Chapter 6: Prepare for full demand", exact: true }).getByRole("button", { name: "Got it", exact: true }));
  const panel = page.getByRole("region", { name: "Campaign mission dashboard", exact: true });
  await expect(panel).toContainText("Capacity funding blocked");
  await expect(panel).toContainText("at most $7,200 per period but costs $7,600");
  const cash = page.getByRole("button", { name: "View finances", exact: true });
  const beforeBox = await cash.boundingBox();
  // The company is paused: only the inactivity deadline needs to elapse.
  // Avoid rendering 600 WebGL frames; cumulative simulation ticks are not involved.
  await page.clock.fastForward(10000);
  const gold = page.locator(".campaign-gold-attention");
  await expect(gold).toHaveCount(1); await expect(gold).toHaveAccessibleName("Hint");
  await press(gold);
  const hint = page.getByRole("dialog", { name: "Hint", exact: true });
  await expect(hint).toContainText("cannot fund a capacity improvement");
  await expect(hint).not.toContainText("About Network");
  await press(hint.getByRole("button", { name: "Got it", exact: true }));
  await expect(gold).toHaveCount(1); await expect(gold).toHaveAccessibleName("View finances");
  await expect(gold).toBeInViewport({ ratio: 1 });
  expect(await cash.boundingBox()).toEqual(beforeBox);
  await press(gold);
  const finance = page.getByRole("dialog", { name: "Company finances", exact: true });
  await expect(finance).toContainText("$560");
  const warning = finance.getByRole("note");
  await warning.scrollIntoViewIfNeeded();
  await expect(warning).toBeInViewport();
  await expect(warning).toContainText("open Menu to export your save or start a new company");
  await expect(gold).toHaveCount(0);
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.screenshot({ path: info.outputPath("chapter6-financial-warning.png") });
  await press(finance.getByRole("button", { name: "Close", exact: true }));
  expect(await savedGame(page)).toEqual(game);
  await page.clock.resume(); await page.reload();
  await press(page.getByRole("button", { name: "Continue company", exact: true })); await expectRoom(page);
  await expect(panel).toContainText("Capacity funding blocked");
  expect(await savedGame(page)).toEqual(game);
}
