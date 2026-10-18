import { test, expect, expectRoom, savedGame, seedSave, tutorial, finishChapterZero, nextChapterZero } from "./fixtures";
import { applyAction, newGame, type GameState } from "../src/sim";
import { advanceSteps } from "../src/sim/step";
function act(g: GameState, action: Parameters<typeof applyAction>[1]) { const r = applyAction(g, action); if (!r.ok) throw Error(r.message); return r.state; }

for (const width of [1440, 390]) test(`Cancel lesson restores its quote after reload at ${width}px`, async ({ page }) => {
  test.setTimeout(120_000); // This journey initializes the real WebGL room twice.
  await page.setViewportSize({ width, height: 900 });
  await page.route("**/api/**", route => route.abort());
  await seedSave(page, newGame(1, "resume-quote"), { tutorialDone: false, walkthroughStep: 7, walkthroughFurthestStep: 7 });
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page);
  await expect(page.getByRole("region", { name: "Confirm Add server", exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  const quote = page.getByRole("region", { name: "Confirm Add server", exact: true });
  await expect(quote).toBeVisible();
  await expect(quote.getByRole("button", { name: "Confirm", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Menu", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(quote).toBeVisible();
  await quote.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(quote).toBeHidden();
  await expect(tutorial(page).getByRole("button", { name: "Next", exact: true })).toBeEnabled();
  expect((await savedGame(page)).campaign!.cashCents).toBe(2_000_000);
});

for (const width of [1440, 390]) test(`How to play clears earlier completion and restarts the real exercises at ${width}px`, async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width, height: 900 });
  await page.route("**/api/**", route => route.abort());
  await seedSave(page, newGame(1, "restart-tutorial"), { tutorialDone: false, walkthroughStep: 15, walkthroughFurthestStep: 16 });
  await page.goto("/"); await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page);
  const card = tutorial(page);
  const replay = async () => {
    while ((await card.getAttribute("aria-label")) !== "Tutorial, step 16 of 21") await nextChapterZero(page);
    const before = (await savedGame(page)).campaign;
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("dialog", { name: "Menu", exact: true }).getByRole("button", { name: /How to play/ }).click();
    await expect(card).toHaveAccessibleName("Tutorial, step 1 of 21");
    await expect(card).not.toContainText("Completed earlier");
    await expect(card.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
    expect((await savedGame(page)).campaign).toEqual(before);
  };
  await replay();
  await page.getByRole("complementary", { name: "System metrics" }).getByRole("button", { name: "App Server", exact: true }).click();
  await expect(card.getByRole("button", { name: "Next", exact: true })).toBeEnabled();
  await replay();
  await page.reload(); await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expect(card).toHaveAccessibleName("Tutorial, step 1 of 21");
  await expect(card.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
});

test("Chapter 0 requires real game interactions, previews without spending, and persists completion", async ({ page }) => {
  test.setTimeout(150_000);
  await page.route("**/api/**", route => route.abort());
  await page.goto("/"); await page.getByRole("button", { name: "Start Guided Mode", exact: true }).click();
  await expectRoom(page); const card = tutorial(page);
  await expect(card.getByRole("button", { name: "Skip", exact: true })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  for (let i = 1; i < 8; i++) await nextChapterZero(page);
  await expect(page.getByRole("region", { name: "Confirm Add server" })).toBeVisible();
  await expect(card).toBeVisible();
  await expect(card.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await nextChapterZero(page); await finishChapterZero(page);
  const company = (await savedGame(page)).campaign!;
  expect([company.step, company.cashCents, company.actions, company.pending]).toEqual([1, 2_000_000, [], []]);
  await page.reload(); await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: /How to play/ }).click();
  await finishChapterZero(page);
  expect((await savedGame(page)).campaign).toMatchObject({ runId: company.runId, step: 2, actions: [] });
});

test("Back and Save and exit resume the same lesson, and the final card still holds the clock until Finish", async ({ page }) => {
  test.setTimeout(120_000);
  await page.route("**/api/**", route => route.abort());
  await seedSave(page, newGame(1, "mandatory-intro"), { tutorialDone: false, walkthroughStep: 16 });
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page);
  const card = tutorial(page);
  await expect(card).toHaveAccessibleName("Tutorial, step 17 of 21");
  await card.getByRole("button", { name: "Back", exact: true }).click();
  await card.getByRole("button", { name: "Save and exit", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expect(card).toHaveAccessibleName("Tutorial, step 16 of 21");
  for (let lesson = 16; lesson < 21; lesson++) await nextChapterZero(page);
  await expect(card).toHaveAccessibleName("Tutorial, step 21 of 21");
  await expect(page.getByRole("button", { name: "Run", exact: true })).toBeDisabled();
  await page.keyboard.press("p"); await page.keyboard.press("Escape");
  await expect(card).toBeVisible();
  expect((await savedGame(page)).campaign!.step).toBe(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("nn.campaign.meta.v1")!).tutorialDone)).toBe(false);
  await page.reload(); await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expect(card).toHaveAccessibleName("Tutorial, step 21 of 21");
  await card.getByRole("button", { name: "Finish Chapter 0", exact: true }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect.poll(async () => (await savedGame(page)).campaign!.step).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
});

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
