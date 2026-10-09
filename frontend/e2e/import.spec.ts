import { readFile } from "node:fs/promises";
import { test, expect, expectRoom, savedGame } from "./fixtures";

test("exports a company and imports it into a fresh browser", async ({ page, browser, baseURL }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Play", exact: true }).click();
  await expectRoom(page);
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Advance step", exact: true }).click();
  const exported = await savedGame(page);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export current company" }).click();
  const file = await (await download).path();

  await page.close();

  // A fresh browser with nothing stored yet.
  const fresh = await browser.newContext({ baseURL });
  const other = await fresh.newPage();
  await other.goto("/"); await other.getByRole("button", { name: "Play", exact: true }).click();
  expect((await savedGame(other)).campaign!.step).toBe(0);
  await other.getByRole("button", { name: "Menu", exact: true }).click();
  const menu = other.getByRole("dialog", { name: "Menu" });
  await other.getByLabel("Save file to import").setInputFiles({ name: "campaign.json", mimeType: "application/json", buffer: await readFile(file) });
  await expect(menu).toContainText("Replace the current company with campaign.json?");
  await other.screenshot({ path: "test-results/import-confirm.png" });
  await menu.getByRole("button", { name: "Confirm import" }).click();
  await expect(menu).toBeHidden();
  await expect(other.getByText("Save imported")).toBeVisible();
  expect(await savedGame(other)).toEqual(exported);
  await other.reload(); await other.getByRole("button", { name: "Continue company" }).click();
  await expectRoom(other);
  expect(await savedGame(other)).toEqual(exported);
  await fresh.close();
});
