import type { Page } from "@playwright/test";
import { test, expect, expectRoom, seedSave } from "./fixtures";
import { newGame } from "../src/sim";

async function boot(page: Page) {
  await page.route("**/api/**", r => r.abort());
  await seedSave(page, newGame());
  await page.goto("/"); await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page);
}
const panel = (page: Page) => page.getByRole("complementary", { name: "System metrics" });
const tab = (page: Page, name: "Analysis" | "Actions") => panel(page).getByRole("tab", { name: new RegExp(`^${name}`) });

test("the Guided Mode panel opens on Analysis and switches by pointer and keyboard", async ({ page }) => {
  await boot(page);
  await expect(panel(page).getByRole("tablist", { name: "Panel sections" })).toBeVisible();
  await expect(tab(page, "Analysis")).toHaveAttribute("aria-selected", "true");
  await expect(panel(page).getByRole("button", { name: "Database", exact: true })).toBeVisible();
  await expect(panel(page).getByRole("button", { name: /^Add server/ })).toHaveCount(0);

  await tab(page, "Actions").click();
  await expect(tab(page, "Actions")).toHaveAttribute("aria-selected", "true");
  await expect(panel(page).getByRole("button", { name: /^Add server/ })).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "Database", exact: true })).toHaveCount(0);

  await tab(page, "Actions").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(tab(page, "Analysis")).toBeFocused(); await expect(tab(page, "Analysis")).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(tab(page, "Actions")).toBeFocused(); await expect(tab(page, "Actions")).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(tab(page, "Analysis")).toBeFocused(); await expect(tab(page, "Analysis")).toHaveAttribute("aria-selected", "true");
});

test("choosing equipment in the room brings Analysis forward with its readings", async ({ page }) => {
  await boot(page);
  await tab(page, "Actions").click();
  await page.getByRole("main").getByRole("button", { name: "Database", exact: true }).click();
  await page.getByRole("dialog", { name: "Database inspected" }).getByRole("button", { name: "Return to room" }).click();
  await expect(tab(page, "Analysis")).toHaveAttribute("aria-selected", "true");
  await expect(panel(page).getByRole("button", { name: "Database", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(panel(page).getByRole("region", { name: "Database readings" })).toBeVisible();
});
