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
  await expect(card.getByRole("button", { name: "Next" })).toHaveCount(0);
  await page.screenshot({ path: "test-results/campaign-tutorial-system.png" });

  // The interactive steps move on once the player clicks what is lit up in the room; each opens its diagnostic card.
  await room.getByRole("button", { name: "Servers", exact: true }).click();
  await page.getByRole("dialog", { name: "Servers inspected" }).getByRole("button", { name: "Return to room" }).click();
  await expect(card).toHaveAccessibleName("Tutorial, step 2 of 8");
  await room.getByRole("button", { name: "Database", exact: true }).click();
  await page.getByRole("dialog", { name: "Database inspected" }).getByRole("button", { name: "Return to room" }).click();
  await expect(card).toHaveAccessibleName("Tutorial, step 3 of 8");
  await expect(card).toContainText("The Database is doing 300 of the 600 operations a second it can.");
  await page.screenshot({ path: "test-results/campaign-tutorial-evidence.png" });
  for (const [step, text] of [[4, "Over 500 ms or 1% errors"], [5, "Each successful request earns $0.20"], [6, "Pause (P) to think"], [7, "Click an action to see its costs."]] as const) {
    await card.getByRole("button", { name: "Next", exact: true }).click();
    await expect(card).toHaveAccessibleName(`Tutorial, step ${step} of 8`);
    await expect(card).toContainText(text);
  }

  await page.getByRole("button", { name: /Upgrade database/ }).click();
  const confirm = page.getByRole("region", { name: "Confirm Upgrade database" });
  await expect(confirm).toBeVisible();
  await expect(card).toHaveAccessibleName("Tutorial, step 8 of 8");
  await expect(card).toContainText("No need to buy yet.");
  await page.screenshot({ path: "test-results/campaign-tutorial-first-purchase.png" });
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await card.getByRole("button", { name: "Got it", exact: true }).click();
  await expect(card).toBeHidden();
  await expect(page.getByRole("region", { name: "Guided Mode chapters" })).toContainText("Getting started");

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

test("a walkthrough holds the clock, so no incident opens before it is done, and carries on from the same step after a reload", async ({ page }) => {
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

  // The step shows the clock, but the company cannot run into its first incident until the walkthrough is done.
  const run = page.getByRole("button", { name: "Run", exact: true });
  await expect(card).toContainText("After this guide, Run to watch.");
  await expect(run).toBeDisabled();
  await page.keyboard.press("p");
  await expect(run).toBeDisabled();
  await expect(page.getByTestId("physical-step")).toHaveText("0");
  await expect(page.locator(".incident-clock")).toHaveCount(0);
  await expect(card).toHaveAccessibleName("Tutorial, step 6 of 8");
  await page.screenshot({ path: "test-results/campaign-tutorial-clock-held.png" });

  await page.reload();
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page);
  await expect(card).toHaveAccessibleName("Tutorial, step 6 of 8");
  await expect(run).toBeDisabled();

  // The last step asks the player to run the company: doing so closes the card and starts the clock.
  await card.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: /Upgrade database/ }).click();
  await page.getByRole("region", { name: "Confirm Upgrade database" }).getByRole("button", { name: "Cancel" }).click();
  await expect(card).toHaveAccessibleName("Tutorial, step 8 of 8");
  await run.click();
  await expect(card).toBeHidden();
  await expect.poll(async () => (await savedGame(page)).campaign!.step, { timeout: 30_000 }).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  expect((await savedGame(page)).campaign!.actions).toEqual([]);
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
