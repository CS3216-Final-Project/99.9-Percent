import { test, expect, savedGame, seedSave, tutorial } from "./fixtures";
import { applyAction, newGame } from "../src/sim";
import { advanceSteps } from "../src/sim/step";

test("the walkthrough works from the keyboard, keeps shortcuts working and remembers a skip", async ({ page }) => {
  await page.goto("/");
  expect(await page.evaluate(() => localStorage.getItem("nn.campaign.save.v1"))).toBeNull();
  const preview = page.getByRole("img", { name: /furnished office/ });
  await expect(preview).toHaveCount(0);
  await page.screenshot({ path: "test-results/phase2-title.png" });
  await page.getByRole("button", { name: "Start Guided Mode" }).press("Enter");
  const card = tutorial(page);
  await expect(card).toHaveAccessibleName("Tutorial, step 1 of 21");
  // Each step takes focus, so a screen reader announces it; the card is not modal, so Tab leads on into the game.
  await expect(card).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(card.getByRole("button", { name: "Skip", exact: true })).toBeFocused();
  const room = page.getByRole("main");
  await room.getByRole("button", { name: "Servers", exact: true }).press("Enter");
  await page.getByRole("dialog", { name: "Servers inspected" }).getByRole("button", { name: "Return to room" }).press("Enter");
  await expect(card).toHaveAccessibleName("Tutorial, step 2 of 21");
  // The card's own focus went to the inspection dialog; give it back, as a player's Tab would.
  await card.focus();
  await expect(card).toBeFocused();
  await room.getByRole("button", { name: "Database", exact: true }).press("Enter");
  await page.getByRole("dialog", { name: "Database inspected" }).getByRole("button", { name: "Return to room" }).press("Enter");
  await expect(card).toHaveAccessibleName("Tutorial, step 3 of 21");
  await card.getByRole("button", { name: "Next", exact: true }).press("Enter");
  await expect(card).toHaveAccessibleName("Tutorial, step 4 of 21");
  // The guide holds the clock until it is done, so P does nothing while the card has focus.
  await expect(card).toBeFocused();
  await page.keyboard.press("p");
  await expect(page.getByRole("button", { name: "Run", exact: true })).toBeDisabled();
  await card.getByRole("button", { name: "Skip", exact: true }).press("Enter");
  await expect(card).toBeHidden();
  expect((await savedGame(page)).campaign!.step).toBe(0);
  // Skipped, P runs and pauses the company.
  await page.keyboard.press("p");
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await page.keyboard.press("p");
  await expect(page.getByRole("button", { name: "Run", exact: true })).toBeEnabled();
  await page.screenshot({ path: "test-results/phase2-healthy.png" });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.screenshot({ path: "test-results/phase2-menu.png" });
  await page.reload(); await page.getByRole("button", { name: "Continue company" }).click();
  await expect(page.getByRole("button", { name: "Run", exact: true })).toBeVisible();
  await expect(card).toHaveCount(0);
});

test("pending milestone reload keeps the company paused and awards it only once", async ({ page }) => {
  const incident = advanceSteps(newGame(1, "pending-milestone"), 6).state;
  const response = applyAction(incident, { type: "start_db_upgrade" });
  if (!response.ok) throw Error(response.message);
  const review = advanceSteps(response.state, 30).state;
  await seedSave(page, review); await page.goto("/");
  await page.getByRole("button", { name: "Continue company" }).click();
  const report = page.getByRole("dialog", { name: "Incident postmortem" });
  await page.screenshot({ path: "test-results/phase2-report.png" });
  await report.getByRole("button", { name: "Continue company" }).click();
  const before = await savedGame(page);
  await page.reload(); await page.getByRole("button", { name: "Continue company" }).click();
  await expect(page.getByRole("dialog", { name: "First growth challenge handled" })).toBeVisible();
  expect(await savedGame(page)).toEqual(before);
  await page.getByRole("button", { name: "Continue operating" }).click();
  const after = await savedGame(page);
  expect(after.campaign!.runId).toBe(before.campaign!.runId);
  expect(after.campaign!.step).toBe(before.campaign!.step);
  expect(after.campaign!.cashCents).toBe(before.campaign!.cashCents);
  expect(after.campaign!.trace.filter(e => e.type === "milestone-awarded")).toHaveLength(1);
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.screenshot({ path: "test-results/phase2-history.png" });
});
