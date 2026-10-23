import type { Page } from "@playwright/test";
import { test, expect, expectRoom, seedSave } from "./fixtures";
import { newGame, type GameState } from "../src/sim";
import { advanceSteps } from "../src/sim/step";

async function boot(page: Page, game: GameState = newGame()) {
  await page.route("**/api/**", r => r.abort());
  await seedSave(page, game);
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

test("an open quote stays open while Analysis is read during an incident", async ({ page }) => {
  await boot(page, advanceSteps(newGame(), 6).state);
  await tab(page, "Actions").click();
  await panel(page).getByRole("button", { name: /^Upgrade database/ }).click();
  const quote = page.getByRole("region", { name: "Confirm Upgrade database" });
  await expect(quote).toBeVisible();
  // Checking the readings is part of the purchase decision, so the quote never locks the tabs.
  await tab(page, "Analysis").click();
  await expect(tab(page, "Analysis")).toHaveAttribute("aria-selected", "true");
  await expect(panel(page).getByRole("heading", { name: "Inspect equipment" })).toBeVisible();
  await expect(quote).toBeVisible();
  await quote.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(quote).toBeHidden();
});

test("inspecting equipment from Analysis keeps the player's place and shows its readings", async ({ page, withoutRoom }) => {
  await withoutRoom();
  await page.route("**/api/**", r => r.abort());
  // An incident makes Analysis long enough to scroll down to the chips.
  await seedSave(page, advanceSteps(newGame(1, "panel-inspect-scroll"), 6).state);
  await page.goto("/"); await page.getByRole("button", { name: "Continue company", exact: true }).click();
  const side = page.locator("aside.side.campaign-panel");
  for (const [chip, readings] of [["Network", "Network"], ["App Server", "Servers"], ["Database", "Database"], ["Monitoring", "Monitoring"]]) {
    const button = panel(page).getByRole("button", { name: chip, exact: true });
    await button.evaluate(el => el.scrollIntoView({ block: "center" }));
    const before = await side.evaluate(el => el.scrollTop);
    expect(before).toBeGreaterThan(0);
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(panel(page).getByRole("region", { name: `${readings} readings` })).toBeInViewport();
    await expect(button).toBeInViewport();
    expect(await side.evaluate(el => el.scrollTop)).toBeGreaterThanOrEqual(before);
  }
});
