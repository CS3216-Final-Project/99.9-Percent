import { test, expect, expectRoom, savedGame } from "./fixtures";
import { playedRun, v1Envelope } from "../src/game/testing/saves";

test("converts a full-state save from the previous build and continues it", async ({ page }) => {
  const game = playedRun(), v1 = JSON.stringify(v1Envelope(game, 0));
  await page.addInitScript(raw => { if (localStorage.getItem("nn.campaign.save.v1") === null) localStorage.setItem("nn.campaign.save.v1", raw); }, v1);
  await page.goto("/"); await page.getByRole("button", { name: "Continue company" }).click();
  await expectRoom(page);
  expect(await savedGame(page)).toEqual(JSON.parse(JSON.stringify(game)));
  const stored = await page.evaluate(() => ({ save: localStorage.getItem("nn.campaign.save.v1")!, backup: localStorage.getItem("nn.campaign.save.v1.backup.v1") }));
  expect(stored.backup).toBe(v1);
  expect(JSON.parse(stored.save)).toMatchObject({ schemaVersion: 2, step: game.campaign!.step });
  expect(stored.save.length).toBeLessThan(v1.length / 20);
  await page.getByRole("button", { name: "Advance step", exact: true }).click();
  expect((await savedGame(page)).campaign!.step).toBe(game.campaign!.step + 1);
});
