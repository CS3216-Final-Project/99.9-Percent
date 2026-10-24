import { completeTutorial, advanceCampaignStep } from "./fixtures";
import { readFile } from "node:fs/promises";
import { test, expect, savedGame, unlockChallenge } from "./fixtures";

test("exports a company and imports it into a fresh browser", async ({ page, browser, baseURL, withoutRoom , installClock}) => {
 await installClock();
  await withoutRoom();
  await page.goto("/"); await page.getByRole("button", { name: "Start Guided Mode", exact: true }).click(); await completeTutorial(page);
  await advanceCampaignStep(page,{seconds:3});
  const exported = await savedGame(page);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("tab", { name: "Saves" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export current company" }).click();
  const file = await (await download).path();

  await page.close();

  // A fresh browser with nothing stored yet.
  const fresh = await browser.newContext({ baseURL });
  await withoutRoom(fresh);
  const other = await fresh.newPage();
  await other.goto("/"); await other.getByRole("button", { name: "Start Guided Mode", exact: true }).click();
  await completeTutorial(other);
  expect((await savedGame(other)).campaign!.step).toBe(0);
  // This manually created context has no fixture locator handler.
  await other.getByRole("dialog", { name: "Company Message", exact: true }).getByRole("button", { name: "Dismiss company message", exact: true }).click();
  await other.getByRole("button", { name: "Menu", exact: true }).click();
  const menu = other.getByRole("dialog", { name: "Menu" });
  await menu.getByRole("tab", { name: "Saves" }).click();
  await other.getByLabel("Save file to import").setInputFiles({ name: "campaign.json", mimeType: "application/json", buffer: await readFile(file) });
  await expect(menu).toContainText("Replace the current company with campaign.json?");
  await other.screenshot({ path: "test-results/import-confirm.png" });
  await menu.getByRole("button", { name: "Confirm import" }).click();
  await expect(menu).toBeHidden();
  await expect(other.getByText("Save imported")).toBeVisible();
  expect(await savedGame(other)).toEqual(exported);
  await other.reload(); await other.getByRole("button", { name: "Continue company" }).click();
  expect(await savedGame(other)).toEqual(exported);
  await fresh.close();
});


test("recovers a pre-update run and exports/imports Challenge Mode files from either mode", async ({ page, withoutRoom }) => {
  await withoutRoom();
  await unlockChallenge(page);
  const { advanceTurn, newLegacyGame } = await import("../src/sim");
  const game = advanceTurn(newLegacyGame(777));
  const original = JSON.stringify({ savedAt: 1, game });
  await page.addInitScript(raw => {
    if (localStorage.getItem("nn.save.v1") === null) {
      localStorage.setItem("nn.save.v1", raw);
      localStorage.setItem("nn.meta.v1", JSON.stringify({ tutorialDone: true, incidentGuideDone: true }));
    }
  }, original);
  await page.goto("/"); await page.getByRole("button", { name: "Start Guided Mode", exact: true }).click(); await completeTutorial(page);
  await page.getByRole("button", { name: "Mute sound", exact: true }).click();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("tab", { name: "Saves" }).click();
  const legacyDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export pre-update save" }).click();
  expect(await readFile(await (await legacyDownload).path(), "utf8")).toBe(original);
  await page.getByRole("button", { name: "Resume pre-update save" }).click();
  await page.getByRole("button", { name: "Confirm resume", exact: true }).click();
  await expect(page.getByRole("button", { name: "Next week" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mute sound", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("nn.classic.save.v1")!).game)).toEqual(JSON.parse(JSON.stringify(game)));
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("tab", { name: "Saves" }).click();
  const classicDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export current run", exact: true }).click();
  const buffer = await readFile(await (await classicDownload).path());
  await page.getByRole("tab", { name: "Run" }).click();
  await page.getByRole("button", { name: "Switch to Guided Mode" }).click();
  // Switching back resumes the company whose introduction was already completed.
  await expect(page.getByLabel("Current chapter", { exact: true })).toHaveText("Opening");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("tab", { name: "Saves" }).click();
  await page.getByLabel("Save file to import").setInputFiles({ name: "classic.json", mimeType: "application/json", buffer });
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(page.getByRole("button", { name: "Next week" })).toBeVisible();
  await page.reload(); await page.getByRole("button", { name: /Continue week/ }).click();
  await expect(page.getByRole("button", { name: "Mute sound", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => localStorage.getItem("nn.save.v1"))).toBe(original);
});
