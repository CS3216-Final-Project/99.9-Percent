import { test, expect, expectRoom, seedSave, savedGame } from "./fixtures";
import { DEFAULT_META } from "../src/game/persist";
import { newGame } from "../src/sim";
import type { Page } from "@playwright/test";

async function openMenu(page: Page) {
  await page.route("**/api/**", route => route.abort());
  await seedSave(page, newGame(1, "menu-exit"));
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  return page.getByRole("dialog", { name: "Menu", exact: true });
}

async function failSaveWrites(page: Page) {
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "nn.campaign.save.v1" && sessionStorage.getItem("fail-menu-save") === "yes") throw new DOMException("Full", "QuotaExceededError");
      return original.call(this, key, value);
    };
    sessionStorage.setItem("fail-menu-save", "yes");
  });
}

test("Run actions share a button row and a saved company exits directly", async ({ page }) => {
  const menu = await openMenu(page);
  const actions = menu.getByRole("group", { name: "Run", exact: true }).getByRole("button");
  await expect(actions).toHaveText(["Resume", "Save now", "How to play", "Exit"]);
  const boxes = await actions.evaluateAll(nodes => nodes.map(node => ({ top: node.getBoundingClientRect().top, height: node.getBoundingClientRect().height })));
  expect(new Set(boxes.map(box => box.top)).size).toBe(1);
  expect(new Set(boxes.map(box => box.height)).size).toBe(1);
  await page.screenshot({ path: "test-results/menu-action-buttons.png" });
  const before = await savedGame(page);
  await menu.getByRole("button", { name: "Exit", exact: true }).click();
  await expect(page.getByRole("region", { name: "Choose how you want to play" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Exit without saving?", exact: true })).toHaveCount(0);
  expect((await savedGame(page)).campaign!.runId).toBe(before.campaign!.runId);
});

test("failed saves require confirmation, retain focus on cancel and allow a successful retry", async ({ page }) => {
  const menu = await openMenu(page);
  const raw = await page.evaluate(() => localStorage.getItem("nn.campaign.save.v1"));
  await failSaveWrites(page);
  await menu.getByRole("button", { name: "Exit", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Exit without saving?", exact: true });
  await expect(confirm).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(menu.getByRole("button", { name: "Exit", exact: true })).toBeFocused();
  await expect(menu.getByText("Not saved", { exact: true })).toBeVisible();
  await menu.getByRole("button", { name: "Exit", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(menu.getByRole("button", { name: "Exit", exact: true })).toBeFocused();
  await menu.getByRole("button", { name: "Exit", exact: true }).click();
  await confirm.getByRole("button", { name: "Save and exit", exact: true }).click();
  await expect(confirm.getByRole("alert")).toContainText("Saving still failed");
  expect(await page.evaluate(() => localStorage.getItem("nn.campaign.save.v1"))).toBe(raw);
  await page.screenshot({ path: "test-results/menu-exit-confirm.png" });
  await page.evaluate(() => sessionStorage.removeItem("fail-menu-save"));
  await confirm.getByRole("button", { name: "Save and exit", exact: true }).click();
  await expect(page.getByRole("region", { name: "Choose how you want to play" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page);
  expect((await savedGame(page)).campaign!.runId).toBe("menu-exit");
});

test("explicitly exiting an unsaved company preserves a corrupt original save", async ({ page }) => {
  await page.route("**/api/**", route => route.abort());
  await page.addInitScript(meta => { localStorage.setItem("nn.campaign.save.v1", "{"); localStorage.setItem("nn.campaign.meta.v1", JSON.stringify({ ...meta, tutorialDone: true })); }, DEFAULT_META);
  await page.goto("/");
  await page.getByRole("button", { name: "Start Guided Mode", exact: true }).click();
  await expectRoom(page);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("dialog", { name: "Menu", exact: true }).getByRole("button", { name: "Exit", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Exit without saving?", exact: true });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Exit without saving", exact: true }).click();
  await expect(page.getByRole("region", { name: "Choose how you want to play" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("nn.campaign.save.v1"))).toBe("{");
});
