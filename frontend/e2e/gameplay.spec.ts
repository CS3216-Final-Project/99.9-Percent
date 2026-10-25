import { infrastructureAction, inspectEquipment, closeInspection } from "./componentInspection";
import { completeTutorial, advanceCampaignStep, setGameSpeed } from "./fixtures";
import { test, expect, expectRoom, savedGame, seedSave } from "./fixtures";
import { newGame } from "../src/sim";
import { advanceSteps } from "../src/sim/step";

for (const path of ["upgrade", "limit", "app-then-upgrade"] as const) {
  test(`opening acceptance: ${path}`, async ({ page, withoutRoom , installClock}) => {
    if (path !== "upgrade") await installClock();
    // Only the upgrade path inspects a machine by clicking it in the room.
    const room = path === "upgrade";
    if (!room) await withoutRoom();
    await seedSave(page, newGame(1, `opening-${path}`));
    await page.goto("/"); await page.getByRole("button", { name: "Continue company", exact: true }).click();
    if (room) await expectRoom(page);
    if (room) {
      // The Opening pauses itself at the first incident. Keep native scene frames
      // while reaching that exact boundary through the player's Run control.
      await setGameSpeed(page, 2);
      await page.getByRole("button", { name: "Run", exact: true }).click();
      await expect(page.getByTestId("physical-step")).toHaveText("6");
      await expect(page.getByRole("button", { name: "Run", exact: true })).toBeVisible();
    } else await advanceCampaignStep(page,{seconds:6-(await savedGame(page)).campaign!.step});
    if (path === "upgrade") {
      await expect(page.getByRole("banner")).toHaveClass(/is-incident/);
      const panel = page.getByRole("complementary", { name: "System metrics" });
      await page.getByRole("main").getByRole("button", { name: "Database", exact: true }).click();
      // Clicking in the room opens the diagnostic card; the panel's inspection behind it is unchanged.
      const dbReveal = page.getByRole("dialog", { name: "Database inspected" });
      await expect(dbReveal).toBeVisible();
      await dbReveal.getByRole("button", { name: "Inspect details",exact:true }).click();
      await expect(panel.getByRole("button", { name: "Database", exact: true })).toHaveAttribute("aria-pressed", "true");
      const evidence=dbReveal.locator(".campaign-evidence .evidence-rows");
      await expect(evidence.locator("dd")).toHaveText(["800 operations/s", "600 operations/s", "600"]);
      await expect(dbReveal.getByRole("progressbar", { name: "Database load: 800 of 600 operations/s" })).toBeVisible();
      await expect(dbReveal.getByRole("region", { name: "Database readings" })).toContainText("133.33%");
      await expect(dbReveal.getByText("Live", { exact: true })).toBeVisible();
      await expect(dbReveal.getByText("Full system evidence", { exact: true })).toHaveCount(0);
      for (const name of [/Add server/, /Upgrade database/, /Limit to 500 requests\/s/]) {
        const action = await infrastructureAction(page,name);
        await action.scrollIntoViewIfNeeded();
        await expect(action).toBeInViewport();
      }
      // Inspection is repeatable and cannot advance the physical clock.
      await inspectEquipment(page,"db",true);
      await panel.evaluate(el => { el.scrollTop = 0; });
      await page.screenshot({ path: "test-results/phase1-desktop.png" });await closeInspection(page);
    }
    const opening = (await savedGame(page)).campaign!;
    expect(opening.step).toBe(6);
    await page.getByRole("complementary", { name: "System metrics" }).getByRole("button", { name: "Monitoring", exact: true }).click();
    if (path === "app-then-upgrade") {
      await (await infrastructureAction(page,/Add server/)).click(); await page.getByRole("button", { name: "Confirm", exact: true }).click();
      await page.getByRole("button", { name: "Run", exact: true }).click();
      await expect.poll(async () => (await savedGame(page)).campaign!.apps.length).toBe(2);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      expect((await savedGame(page)).campaign!.dbCapacity).toBe(600);
    }
    await (await infrastructureAction(page,path === "limit" ? /Limit to 500 requests\/s/ : /Upgrade database/)).click(); await page.getByRole("button", { name: "Confirm", exact: true }).click();
    if (path === "upgrade") {
      await expect(page.getByRole("status").filter({ hasText: "Database upgrade:" })).toContainText("activates in 3 game second(s)");
      await expect((await infrastructureAction(page,/Add server/))).toBeDisabled();
    }
    await closeInspection(page);await page.getByRole("button", { name: "Run", exact: true }).click();
    const report = page.getByRole("dialog", { name: "Incident postmortem" });
    await expect(report).toBeVisible({ timeout: 25000 });
    if (path === "app-then-upgrade") await expect(report).toContainText("did not relieve");
    await report.getByRole("button", { name: "Continue company" }).click();
    await page.getByRole("button",{name:"Continue to Scaling & Routing"}).click();
    const after = await savedGame(page);
    expect(after.campaign!.runId).toBe(opening.runId); expect(after.phase).toBe("management");
    if (path === "limit") expect(after.campaign!.limit).toBe(500);
    await page.reload(); await page.getByRole("button", { name: "Continue company" }).click();
    expect(await savedGame(page)).toEqual(after); if (room) await expectRoom(page);
  });
}
test("preserves a corrupt campaign save until explicit reset", async ({ page, withoutRoom , installClock}) => {
 await installClock();
  await withoutRoom();
  await page.addInitScript(() => { localStorage.setItem("nn.campaign.save.v1", "{"); });
  await page.goto("/"); await page.getByRole("button", { name: "Start Guided Mode", exact: true }).click(); await completeTutorial(page);
  await advanceCampaignStep(page);
  expect(await page.evaluate(() => localStorage.getItem("nn.campaign.save.v1"))).toBe("{");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toContainText("has been preserved");
  await menu.getByRole("tab", { name: "Saves" }).click();
  const download = page.waitForEvent("download"); await menu.getByRole("button", { name: "Export original stored save" }).click(); await download;
  await menu.getByRole("button", { name: "New company", exact: true }).click();
  await menu.getByRole("button", { name: "Lose this company? Press again" }).click();
  expect((await savedGame(page)).campaign!.step).toBe(0);
});
test("resumes an incident paused", async ({ page, withoutRoom }) => {
  await withoutRoom();
  const s = advanceSteps(newGame(1, "paused"), 6).state;
  await seedSave(page, s); await page.goto("/"); await page.getByRole("button", { name: "Continue company" }).click();
  await expect(page.getByRole("button", { name: "Run", exact: true })).toBeVisible();
  expect((await savedGame(page)).campaign!.step).toBe(6);
});
test("keeps the room playable without downloaded furniture", async ({ page , installClock}) => {
 await installClock();
  await page.route("**/models/**", route => route.abort());
  await seedSave(page, newGame(1, "missing-furniture"));
  await page.goto("/"); await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page); const before=(await savedGame(page)).campaign!.step; await advanceCampaignStep(page);
  expect((await savedGame(page)).campaign!.step).toBe(before+1);
});
test("keeps history reachable after bankruptcy", async ({ page, withoutRoom }) => {
  await withoutRoom();
  // Leaving the opening incident unresolved loses money every week until cash runs out.
  // Each advance stops at the first incident, so keep going until the company is bankrupt.
  let s = newGame(1, "paused");
  for (let i = 0; i < 5 && s.phase !== "ended"; i++) s = advanceSteps(s, 100_000).state;
  expect(s.phase).toBe("ended");
  await seedSave(page, s); await page.goto("/"); await page.getByRole("button", { name: "See how it ended" }).click();
  const bankrupt = page.getByRole("dialog", { name: "Company bankrupt" });
  await expect(bankrupt).toBeVisible();
  await bankrupt.getByRole("button", { name: "View history" }).click();
  const history = page.getByRole("region", { name: "History" });
  await expect(history).toContainText("Financial settlements");
  await expect(bankrupt).toBeHidden();
  await history.getByRole("button", { name: "Close" }).click();
  await expect(bankrupt).toBeVisible();
});
