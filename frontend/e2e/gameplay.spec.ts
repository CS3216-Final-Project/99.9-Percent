import { test, expect, expectRoom, savedGame, seedSave } from "./fixtures";
import { newGame } from "../src/sim";
import { advanceSteps } from "../src/sim/step";

for (const path of ["upgrade", "limit", "app-then-upgrade"] as const) {
  test(`opening acceptance: ${path}`, async ({ page }) => {
    await page.goto("/"); await page.getByRole("button", { name: "Play", exact: true }).click();
    await expectRoom(page);
    for (let i = 0; i < 6; i++)await page.getByRole("button", { name: "Advance step", exact: true }).click();
    if (path === "upgrade") await page.screenshot({ path: "test-results/phase1-desktop.png" });
    const opening = (await savedGame(page)).campaign!;
    expect(opening.step).toBe(6);
    await page.getByRole("button", { name: "Inspect metrics · free" }).click();
    if (path === "app-then-upgrade") {
      await page.getByRole("button", { name: /Add application/ }).click();
      await page.getByRole("button", { name: "Run", exact: true }).click();
      await expect.poll(async () => (await savedGame(page)).campaign!.apps.length).toBe(2);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      expect((await savedGame(page)).campaign!.dbCapacity).toBe(600);
    }
    await page.getByRole("button", { name: path === "limit" ? "Limit to 500 requests/s" : /Upgrade database/ }).click();
    await page.getByRole("button", { name: "Run", exact: true }).click();
    const report = page.getByRole("dialog", { name: "Incident postmortem" });
    await expect(report).toBeVisible({ timeout: 25000 });
    if (path === "app-then-upgrade") await expect(report).toContainText("did not relieve");
    await report.getByRole("button", { name: "Continue company" }).click();
    const after = await savedGame(page);
    expect(after.campaign!.runId).toBe(opening.runId); expect(after.phase).toBe("management");
    if (path === "limit") expect(after.campaign!.limit).toBe(500);
    await page.reload(); await page.getByRole("button", { name: "Continue company" }).click();
    expect(await savedGame(page)).toEqual(after); await expectRoom(page);
  });
}
test("preserves corrupt campaign and legacy data until explicit reset", async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem("nn.campaign.save.v1", "{"); localStorage.setItem("nn.save.v1", "legacy"); });
  await page.goto("/"); await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Advance step" }).click();
  expect(await page.evaluate(() => localStorage.getItem("nn.campaign.save.v1"))).toBe("{");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toContainText("has been preserved");
  const download = page.waitForEvent("download"); await menu.getByRole("button", { name: "Export original stored save" }).click(); await download;
  await menu.getByRole("button", { name: "New company", exact: true }).click();
  await menu.getByRole("button", { name: "Confirm new company" }).click();
  expect((await savedGame(page)).campaign!.step).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem("nn.save.v1"))).toBe("legacy");
});
test("resumes an incident paused", async ({ page }) => {
  const s = advanceSteps(newGame(1, "paused"), 6).state;
  await seedSave(page, s); await page.goto("/"); await page.getByRole("button", { name: "Continue company" }).click();
  await expect(page.getByRole("button", { name: "Run", exact: true })).toBeVisible();
  expect((await savedGame(page)).campaign!.step).toBe(6);
});
test("keeps the room playable without downloaded furniture", async ({ page }) => {
  await page.route("**/models/**", route => route.abort());
  await page.goto("/"); await page.getByRole("button", { name: "Play", exact: true }).click();
  await expectRoom(page); await page.getByRole("button", { name: "Advance step" }).click();
  expect((await savedGame(page)).campaign!.step).toBe(1);
});
test("keeps history reachable after bankruptcy", async ({ page }) => {
  let s = newGame(1, "paused"); s.campaign!.cashCents = 1;
  // Cash runs out at the first weekly settlement.
  while (s.phase !== "ended") s = advanceSteps(s, 60).state;
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
