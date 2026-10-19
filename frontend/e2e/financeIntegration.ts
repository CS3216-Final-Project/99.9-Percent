import type { Page } from "@playwright/test";
import { expect, savedGame, seedSave, tutorial, finishChapterZero, lessonNumber, CHAPTER_ZERO_LESSONS } from "./fixtures";
import { newGame } from "../src/sim";

/** Chapter 0 explains finances in the card; the real Finance dialog remains available after completion. */
export async function financeDuringWalkthrough(page: Page, touch = false) {
  await seedSave(page, newGame(1, "finance-lesson"), { tutorialDone: false, walkthroughStep: lessonNumber("money") - 1, walkthroughFurthestStep: lessonNumber("money") - 1 });
  await page.route("**/api/**", route => route.abort()); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  const card = tutorial(page);
  await expect(card).toHaveAccessibleName(`Walkthrough, step ${lessonNumber("money")} of ${CHAPTER_ZERO_LESSONS}`);
  await expect(card).toContainText("Cash · spend now");
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
