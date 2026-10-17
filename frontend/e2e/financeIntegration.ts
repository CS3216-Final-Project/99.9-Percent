import type { Page } from "@playwright/test";
import { expect, expectRoom, savedGame, tutorial, nextChapterZero, finishChapterZero } from "./fixtures";

/** Chapter 0 explains finances in the card; the real Finance dialog remains available after completion. */
export async function financeDuringWalkthrough(page: Page, touch = false) {
  await page.route("**/api/**", route => route.abort()); await page.goto("/");
  await page.getByRole("button", { name: "Start Guided Mode", exact: true }).click(); await expectRoom(page);
  const card = tutorial(page);
  for (let lesson = 1; lesson < 10; lesson++) await nextChapterZero(page, touch);
  await expect(card).toHaveAccessibleName("Tutorial, step 10 of 21");
  await expect(card).toContainText("Example · Week 1 settlement");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.screenshot({ path: `test-results/integration-finance-${touch ? "touch" : "desktop"}.png` });
  await finishChapterZero(page, touch);
  const before = (await savedGame(page)).campaign;
  const entry = page.getByRole("button", { name: "View finances", exact: true });
  if (touch) await entry.tap(); else await entry.click();
  const finance = page.getByRole("dialog", { name: "Company finances", exact: true });
  await expect(finance).toBeVisible(); await expect(card).toBeHidden();
  await expect(finance).toContainText("$0.20");
  await page.keyboard.press("p");
  if (touch) await finance.getByRole("button", { name: "Close", exact: true }).tap(); else await page.keyboard.press("Escape");
  await expect(finance).toBeHidden(); await expect(entry).toBeFocused();
  expect((await savedGame(page)).campaign).toEqual(before);
}
