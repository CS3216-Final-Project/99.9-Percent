import {inspectEquipment,infrastructureAction,closeInspection} from "./componentInspection";
import type { Page } from "@playwright/test";
import { test, expect, expectRoom, seedSave, savedGame } from "./fixtures";
import { newGame, type GameState } from "../src/sim";
import { advanceSteps } from "../src/sim/step";

async function boot(page: Page, game: GameState = newGame()) {
  await page.route("**/api/**", r => r.abort());
  await seedSave(page, game);
  await page.goto("/"); await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page);
}
const panel = (page: Page) => page.getByRole("complementary", { name: "System metrics" });
// Normal companies use the shared inspection host rather than the retired inline tabs.
test("the Guided Mode panel opens equipment by pointer and keyboard without duplicate tabs", async ({ page }) => {
  await boot(page);
  await expect(panel(page).getByRole("tablist", { name: "Panel sections" })).toHaveCount(0);
  await expect(panel(page).getByRole("button", { name: /^Add server/ })).toHaveCount(0);
  const database=panel(page).getByRole("button", { name: "Database", exact: true });
  await database.click();
  const popup=page.getByRole("dialog", { name: "Database inspected", exact: true });
  await expect(popup).toBeVisible();
  await page.keyboard.press("Escape");await expect(database).toBeFocused();
  await database.press("Enter");await expect(popup).toBeVisible();
  await popup.getByRole("button", { name: "Inspect details", exact: true }).click();
  await expect(popup.getByRole("region", { name: "Database readings" })).toBeVisible();
  await page.keyboard.press("Escape");await expect(popup).toBeHidden();await expect(database).toBeFocused();
});

test("choosing equipment in the room uses the same popup as its shortcut", async ({ page }) => {
  await boot(page);
  await page.getByRole("main").getByRole("button", { name: "Database", exact: true }).click();
  const popup=page.getByRole("dialog", { name: "Database inspected", exact: true });
  await popup.getByRole("button", { name: "Inspect details", exact: true }).click();
  await expect(popup.getByRole("region", { name: "Database readings" })).toBeVisible();
  await popup.getByRole("button", { name: "Close", exact: true }).click();
  await expect(panel(page).getByRole("button", { name: "Database", exact: true })).toHaveAttribute("aria-pressed", "true");
  await panel(page).getByRole("button", { name: "Database", exact: true }).click();
  await expect(popup).toBeVisible();
});

test("an incident quote preserves component readings and Cancel preserves the company", async ({ page }) => {
  await boot(page, advanceSteps(newGame(), 6).state);
  const popup=await inspectEquipment(page,"db",true);
  await expect(popup.getByRole("region",{name:"Database readings"})).toBeVisible();
  const before=await savedGame(page);
  await (await infrastructureAction(page,/^Upgrade database/)).click();
  const quote=page.getByRole("region",{name:"Confirm Upgrade database"});
  await expect(quote).toBeVisible();
  await expect(popup.locator('.equipment-readings')).toContainText("Capacity");
  await quote.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(quote).toBeHidden();
  await expect(popup.getByRole("region",{name:"Database readings"})).toBeVisible();
  expect(await savedGame(page)).toEqual(before);
});

test("inspecting equipment keeps the compact dashboard and opens live readings", async ({ page, withoutRoom }) => {
  await withoutRoom();
  await page.route("**/api/**", r => r.abort());
  await seedSave(page, advanceSteps(newGame(1,"panel-inspect-scroll"),6).state);
  await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).click();
  const side=page.locator("aside.side.campaign-panel");
  for(const [component,readings] of [["gateway","Network"],["app","Servers"],["db","Database"],["monitoring","Monitoring"]] as const) {
    const before=await side.evaluate(el=>el.scrollTop);
    const popup=await inspectEquipment(page,component,true);
    const evidence=popup.getByRole("region",{name:`${readings} readings`});
    await evidence.getByRole("heading",{name:readings,exact:true}).scrollIntoViewIfNeeded();
    await expect(evidence.getByRole("heading",{name:readings,exact:true})).toBeInViewport({ratio:1});
    expect(await side.evaluate(el=>el.scrollTop)).toBe(before);
    expect(await popup.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await closeInspection(page);
  }
});
