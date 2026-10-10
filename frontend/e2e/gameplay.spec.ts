import { test, expect, expectRoom, savedGame, seedSave } from "./fixtures";
import { newGame } from "../src/sim";
import { advanceSteps } from "../src/sim/step";

for (const path of ["upgrade", "limit", "app-then-upgrade"] as const) {
  test(`opening acceptance: ${path}`, async ({ page }) => {
    await page.goto("/"); await page.getByRole("button", { name: "Try Prototype", exact: true }).click(); await page.getByRole("button",{name:"Skip introduction"}).click();
    await expectRoom(page);
    for (let i = 0; i < 6; i++)await page.getByRole("button", { name: "Advance step", exact: true }).click();
    if (path === "upgrade") {
      await expect(page.getByRole("banner")).toHaveClass(/is-incident/);
      const panel = page.getByRole("complementary", { name: "System metrics" });
      // The compact overview must leave every response visible before expanding evidence.
      const responsesFit = () => panel.locator(".actions").evaluate(el => {
        const panelBox = el.closest("aside")!.getBoundingClientRect();
        return [...el.querySelectorAll("button")].every(button => {
          const box = button.getBoundingClientRect();
          return box.top >= panelBox.top + 3 && box.bottom <= panelBox.bottom - 3;
        });
      });
      expect(await responsesFit()).toBe(true);
      await page.getByRole("main").getByRole("button", { name: "Database", exact: true }).click();
      await expect(panel.getByRole("button", { name: "Database", exact: true })).toHaveAttribute("aria-pressed", "true");
      await expect(panel.getByRole("status")).toContainText("Demand 800/s · capacity 600/s · backlog 600");
      expect(await responsesFit()).toBe(true);
      await panel.locator("summary").filter({ hasText: "Full system evidence" }).click();
      await expect(panel.getByRole("table")).toContainText("133.33%");
      await expect(panel.getByText("Installed server capacity", { exact: true })).toBeVisible();
      await panel.locator("summary").filter({ hasText: "Full system evidence" }).click();
      // Inspection is repeatable and cannot advance the physical clock.
      await panel.getByRole("button", { name: "Database", exact: true }).click();
      await panel.evaluate(el => { el.scrollTop = 0; });
      await page.screenshot({ path: "test-results/phase1-desktop.png" });
    }
    const opening = (await savedGame(page)).campaign!;
    expect(opening.step).toBe(6);
    await page.getByRole("button", { name: "Inspect metrics · free" }).click();
    if (path === "app-then-upgrade") {
      await page.getByRole("button", { name: /Add server/ }).click();
      await page.getByRole("button", { name: "Run", exact: true }).click();
      await expect.poll(async () => (await savedGame(page)).campaign!.apps.length).toBe(2);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      expect((await savedGame(page)).campaign!.dbCapacity).toBe(600);
    }
    await page.getByRole("button", { name: path === "limit" ? /Limit to 500 requests\/s/ : /Upgrade database/ }).click();
    if (path === "upgrade") {
      await expect(page.getByRole("status").filter({ hasText: "Database upgrade:" })).toContainText("activates in 3 step(s)");
      await expect(page.getByRole("button", { name: /Add server/ })).toBeDisabled();
    }
    await page.getByRole("button", { name: "Run", exact: true }).click();
    const report = page.getByRole("dialog", { name: "Incident postmortem" });
    await expect(report).toBeVisible({ timeout: 25000 });
    if (path === "app-then-upgrade") await expect(report).toContainText("did not relieve");
    await report.getByRole("button", { name: "Continue company" }).click();
    await page.getByRole("button",{name:"Continue operating"}).click();
    const after = await savedGame(page);
    expect(after.campaign!.runId).toBe(opening.runId); expect(after.phase).toBe("management");
    if (path === "limit") expect(after.campaign!.limit).toBe(500);
    await page.reload(); await page.getByRole("button", { name: "Continue company" }).click();
    expect(await savedGame(page)).toEqual(after); await expectRoom(page);
  });
}
test("preserves a corrupt campaign save until explicit reset", async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem("nn.campaign.save.v1", "{"); });
  await page.goto("/"); await page.getByRole("button", { name: "Try Prototype", exact: true }).click(); await page.getByRole("button",{name:"Skip introduction"}).click();
  await page.getByRole("button", { name: "Advance step" }).click();
  expect(await page.evaluate(() => localStorage.getItem("nn.campaign.save.v1"))).toBe("{");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toContainText("has been preserved");
  const download = page.waitForEvent("download"); await menu.getByRole("button", { name: "Export original stored save" }).click(); await download;
  await menu.getByRole("button", { name: "New company", exact: true }).click();
  await menu.getByRole("button", { name: "Confirm new company" }).click();
  expect((await savedGame(page)).campaign!.step).toBe(0);
});
test("resumes an incident paused", async ({ page }) => {
  const s = advanceSteps(newGame(1, "paused"), 6).state;
  await seedSave(page, s); await page.goto("/"); await page.getByRole("button", { name: "Continue company" }).click();
  await expect(page.getByRole("button", { name: "Run", exact: true })).toBeVisible();
  expect((await savedGame(page)).campaign!.step).toBe(6);
});
test("keeps the room playable without downloaded furniture", async ({ page }) => {
  await page.route("**/models/**", route => route.abort());
  await page.goto("/"); await page.getByRole("button", { name: "Try Prototype", exact: true }).click(); await page.getByRole("button",{name:"Skip introduction"}).click();
  await expectRoom(page); await page.getByRole("button", { name: "Advance step" }).click();
  expect((await savedGame(page)).campaign!.step).toBe(1);
});
test("keeps history reachable after bankruptcy", async ({ page }) => {
  // Leaving the opening incident unresolved loses money every week until cash runs out.
  // Each advance stops at the first incident, so keep going until the company is bankrupt.
  let s = newGame(1, "paused");
  for (let i = 0; i < 5 && s.phase !== "ended"; i++) s = advanceSteps(s, 100_000).state;
  expect(s.phase).toBe("ended");
  await seedSave(page, s); await page.goto("/"); await page.getByRole("button", { name: "Continue company" }).click();
  const bankrupt = page.getByRole("dialog", { name: "Company bankrupt" });
  await expect(bankrupt).toBeVisible();
  await bankrupt.getByRole("button", { name: "View history" }).click();
  const history = page.getByRole("dialog", { name: "Campaign history" });
  await expect(history).toContainText("Financial settlements");
  await expect(bankrupt).toBeHidden();
  await history.getByRole("button", { name: "Close" }).click();
  await expect(bankrupt).toBeVisible();
});
