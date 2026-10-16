import { test, expect, expectRoom, savedGame, seedSave, tutorial } from "./fixtures";
import { applyAction, newGame, type GameState } from "../src/sim";
import { advanceSteps } from "../src/sim/step";

test("a first company's walkthrough points at the room and panel, finishes its steps as the player acts and buys nothing", async ({ page }) => {
  // The room is drawn in software, and its labels and the cards beside them settle only as the camera does.
  test.setTimeout(120_000);
  await page.route("**/api/**", r => r.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Start Guided Mode", exact: true }).click();
  await expectRoom(page);
  const card = tutorial(page);
  const room = page.getByRole("main");
  await expect(card).toHaveAccessibleName("Tutorial, step 1 of 8");
  await expect(card).toContainText("Customers send 300 requests a second");
  await expect(card.locator(".tour-prompt")).toHaveText("Click Servers to inspect your app.");
  expect(await card.locator(".tour-prompt").evaluate(el => el.nextElementSibling!.classList.contains("tour-explanation"))).toBe(true);
  await expect(card.getByRole("button", { name: "Next" })).toHaveCount(0);
  await page.screenshot({ path: "test-results/campaign-tutorial-system.png" });

  // The interactive steps move on once the player clicks what is lit up in the room; each opens its diagnostic card.
  await room.getByRole("button", { name: "Servers", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog", { name: "Servers inspected" }).getByRole("button", { name: "Return to room" }).press("Space");
  await expect(card).toHaveAccessibleName("Tutorial, step 2 of 8");
  await room.getByRole("button", { name: "Database", exact: true }).press("Enter");
  await page.getByRole("dialog", { name: "Database inspected" }).getByRole("button", { name: "Return to room" }).click();
  await expect(card).toHaveAccessibleName("Tutorial, step 3 of 8");
  await expect(card).toContainText("Demand: 300 operations/s. Capacity: 600 operations/s.");
  await page.screenshot({ path: "test-results/campaign-tutorial-evidence.png" });
  for (const [step, text] of [[4, "500 ms or more means slow responses"], [5, "Each successful request earns $0.20"], [6, "Pause (P) to think"], [7, "Select an action to preview its costs."]] as const) {
    await card.getByRole("button", { name: "Next", exact: true }).click();
    await expect(card).toHaveAccessibleName(`Tutorial, step ${step} of 8`);
    await expect(card).toContainText(text);
  }

  await page.getByRole("button", { name: /Upgrade database/ }).click();
  const confirm = page.getByRole("region", { name: "Confirm Upgrade database" });
  await expect(confirm).toBeVisible();
  await expect(card).toHaveAccessibleName("Tutorial, step 8 of 8");
  await expect(card).toContainText("Cancel the preview, then press Run company.");
  await page.screenshot({ path: "test-results/campaign-tutorial-first-purchase.png" });
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await card.getByRole("button", { name: "Got it", exact: true }).click();
  await expect(card).toBeHidden();
  await page.getByRole("button", { name: "View chapters", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Guided Mode chapters" })).toContainText("Getting started");
  await page.getByRole("button", { name: "Back to company", exact: true }).click();

  const company = (await savedGame(page)).campaign!;
  expect([company.step, company.cashCents, company.actions, company.pending]).toEqual([0, 2_000_000, [], []]);

  // Finished is remembered; the menu replays it on the same company.
  await page.reload();
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page);
  await expect(card).toHaveCount(0);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: /How to play/ }).click();
  await expect(card).toHaveAccessibleName("Tutorial, step 1 of 8");
  await card.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(card).toBeHidden();
  expect((await savedGame(page)).campaign!.actions).toEqual([]);

  // The home screen replays it too, on the same company.
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: /Save and exit/ }).click();
  const guided = page.getByRole("region", { name: "Guided Mode" });
  await guided.getByRole("button", { name: "Replay the tutorial", exact: true }).click();
  await expectRoom(page);
  await expect(card).toHaveAccessibleName("Tutorial, step 1 of 8");
  await card.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(card).toBeHidden();
  expect((await savedGame(page)).campaign).toMatchObject({ runId: company.runId, step: 0, actions: [] });
});

test("a walkthrough left after running the clock carries on from the same step after a reload", async ({ page }) => {
  test.setTimeout(120_000);
  await page.route("**/api/**", r => r.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Start Guided Mode", exact: true }).click();
  await expectRoom(page);
  const card = tutorial(page);
  const room = page.getByRole("main");
  await room.getByRole("button", { name: "Servers", exact: true }).click();
  await page.getByRole("dialog", { name: "Servers inspected" }).getByRole("button", { name: "Return to room" }).click();
  await room.getByRole("button", { name: "Database", exact: true }).click();
  await page.getByRole("dialog", { name: "Database inspected" }).getByRole("button", { name: "Return to room" }).click();
  for (let i = 0; i < 3; i++) await card.getByRole("button", { name: "Next", exact: true }).click();
  await expect(card).toHaveAccessibleName("Tutorial, step 6 of 8");

  // The step asks the player to run the company, so it moves on before the walkthrough ends.
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect.poll(async () => (await savedGame(page)).campaign!.step, { timeout: 30_000 }).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause", exact: true }).click();

  await page.reload();
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page);
  await expect(card).toHaveAccessibleName("Tutorial, step 6 of 8");
  await expect(card).toContainText("Pause (P) to think");
});

function act(game: GameState, action: Parameters<typeof applyAction>[1]): GameState {
  const result = applyAction(game, action);
  if (!result.ok) throw Error(result.message);
  return result.state;
}

test("entering Scaling & Routing shows its guide once, on the controls the chapter adds", async ({ page, withoutRoom }) => {
  await withoutRoom();
  const recovered = advanceSteps(act(advanceSteps(newGame(1, "chapter-guide"), 6).state, { type: "start_db_upgrade" }), 30).state;
  await seedSave(page, act(recovered, { type: "acknowledge_review" }), { chapterTours: [] });
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await page.getByRole("dialog", { name: "First growth challenge handled" }).getByRole("button", { name: "Continue operating" }).click();

  const guide = page.getByRole("dialog", { name: "Chapter guide, step 1 of 1" });
  await expect(guide).toContainText("Scale and route");
  await expect(guide).toContainText("The next growth wave brings 1,400 requests a second.");
  await expect(page.getByRole("region", { name: "Scaling controls" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/campaign-tutorial-chapter.png" });
  await guide.getByRole("button", { name: "Got it", exact: true }).click();
  await expect(guide).toBeHidden();

  await page.reload();
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expect(page.getByRole("region", { name: "Scaling controls" })).toBeVisible();
  await expect(guide).toHaveCount(0);
});
