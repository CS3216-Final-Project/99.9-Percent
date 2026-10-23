import type { Page } from "@playwright/test";
import { expect, savedGame, seedSave } from "./fixtures";
import { newGame } from "../src/sim";

/** Launch Week's letter sets the stage; the real Finance dialog remains available from the first second. */
export async function financeDuringWalkthrough(page: Page, touch = false) {
  await seedSave(page, newGame(1, "finance-lesson", 2));
  await page.route("**/api/**", route => route.abort()); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  const letter = page.getByRole("dialog", { name: "Launch week" });
  await expect(letter).toBeVisible();
  await expect(letter).toContainText("requests per second");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.screenshot({ path: `test-results/integration-finance-${touch ? "touch" : "desktop"}.png` });
  const doors = letter.getByRole("button", { name: "Open the doors", exact: true });
  if (touch) await doors.tap(); else await doors.click();
  const before = (await savedGame(page)).campaign;
  const entry = page.getByRole("button", { name: "View finances", exact: true });
  if (touch) await entry.tap(); else await entry.click();
  const finance = page.getByRole("dialog", { name: "Company finances", exact: true });
  await expect(finance).toBeVisible(); await expect(letter).toBeHidden();
  await expect(finance).toContainText("$0.20");
  await page.keyboard.press("p");
  if (touch) await finance.getByRole("button", { name: "Close", exact: true }).tap(); else await page.keyboard.press("Escape");
  await expect(finance).toBeHidden(); await expect(entry).toBeFocused();
  expect((await savedGame(page)).campaign).toEqual(before);
}
