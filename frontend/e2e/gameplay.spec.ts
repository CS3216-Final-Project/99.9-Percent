import { test, expect, expectRoom, savedGame, seedSave } from "./fixtures";
import { newGame } from "../src/sim";
import { advanceSteps } from "../src/sim/step";

for (const path of ["upgrade", "limit", "app-then-upgrade"] as const) {
  test(`opening acceptance: ${path}`, async ({ page }) => {
    await page.goto("/"); await page.getByRole("button", { name: "Try Prototype", exact: true }).click(); if(path==="upgrade"){
      const intro=page.getByRole("dialog",{name:"Company introduction"});
      await expect(intro).not.toContainText("Upgrade database");
      await expect(intro).toContainText("technical side of a growing software company");
      await intro.getByRole("button",{name:"Next",exact:true}).click();
      await intro.getByRole("button",{name:"Next",exact:true}).click();
      await intro.getByRole("button",{name:"Start company"}).click();
      expect((await savedGame(page)).campaign!.step).toBe(0);
    }else await page.getByRole("button",{name:"Skip introduction"}).click();
    await expectRoom(page);
    const guidanceAtStart=page.getByRole("region",{name:"Campaign guidance"});
    await expect(guidanceAtStart).toBeInViewport();
    await expect(guidanceAtStart).toContainText("First Growth");
    await expect(page.getByRole("region",{name:"System status"})).toContainText("Incoming 300 req/s");
    await expect(page.getByRole("button",{name:"Resume company",exact:true})).toBeVisible();
    await page.getByRole("main").getByRole("button",{name:"Database",exact:true}).click();
    await expect(page.getByRole("button",{name:/Database.*ops\/s/})).toHaveAttribute("aria-pressed","true");
    await page.getByRole("button",{name:/Application.*req\/s/}).click();
    await expect(page.getByText("Selected component:",{exact:false})).toContainText("Application");
    for (let i = 0; i < 6; i++) {
      await page.getByRole("button", { name: "Advance 1 step", exact: true }).click();
      if(i===3)await expect(page.getByRole("region",{name:"System status"})).toContainText("Incoming 800 req/s");
    }
    await expect(page.getByRole("alert")).toContainText("INCIDENT DETECTED");
    await expect(page.getByRole("alert")).not.toContainText("Upgrade database");
    await expect(page.getByRole("button",{name:"Advance 1 step",exact:true})).toBeDisabled();
    await page.getByRole("button",{name:"Investigate system"}).click();
    await expect(page.getByRole("button",{name:/Database.*ops\/s/})).toHaveAttribute("data-tip", /Demand exceeds capacity.*Backlog: 600/);
    if (path === "upgrade") await page.screenshot({ path: "test-results/phase2-desktop.png" });
    const opening = (await savedGame(page)).campaign!;
    expect(opening.step).toBe(6);
    await page.getByRole("button", { name: "Inspect metrics · free" }).click();
    if (path === "app-then-upgrade") {
      await page.getByRole("button", { name: /Add application/ }).click();
      await page.getByRole("button", { name: "Resume company", exact: true }).click();
      await expect.poll(async () => (await savedGame(page)).campaign!.apps.length).toBe(2);
      await page.getByRole("button", { name: "Pause company", exact: true }).click();
      expect((await savedGame(page)).campaign!.dbCapacity).toBe(600);
      await expect(page.getByRole("note",{name:"App 2 routing status"})).toContainText("Installed ✓ · Receiving traffic ✗");
    }
    await page.getByRole("button", { name: path === "limit" ? "Limit to 500 requests/s" : /Upgrade database/ }).click();
    await page.getByRole("button", { name: "Resume company", exact: true }).click();
    const report = page.getByRole("dialog", { name: "Incident postmortem" });
    await expect(report).toBeVisible({ timeout: 25000 });
    if (path === "app-then-upgrade") await expect(report).toContainText("did not relieve");
    await report.getByRole("button", { name: "Close", exact: true }).click();
    const guidance=page.getByRole("region",{name:"Campaign guidance"});
    await expect(guidance).toContainText("Incident recovered");
    expect((await savedGame(page)).campaign!.scaling).toBeNull();
    await guidance.getByRole("button",{name:"Review postmortem"}).click();
    await report.getByRole("button", { name: "Continue company" }).click();
    await expect(page.getByRole("dialog",{name:"First growth challenge handled"})).toBeVisible();
    if(path==="upgrade"){await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();}
    const milestone=page.getByRole("dialog",{name:"First growth challenge handled"});
    await milestone.getByRole("button",{name:"Close",exact:true}).click();
    expect((await savedGame(page)).campaign!.openingMilestone!.acknowledged).toBe(false);
    await guidance.getByRole("button",{name:"Complete Opening"}).click();
    await milestone.getByRole("button",{name:"Continue operating"}).click();
    await expect(page.getByRole("navigation",{name:"Campaign progression"})).toContainText("Opening Completed");
    await expect(guidance).toContainText("Current stage: Scale Your App");
    const after = await savedGame(page);
    expect(after.campaign!.runId).toBe(opening.runId); expect(after.phase).toBe("management");
    if (path === "limit") expect(after.campaign!.limit).toBe(500);
    await page.reload(); await page.getByRole("button", { name: "Continue company" }).click();
    expect(await savedGame(page)).toEqual(after); await expectRoom(page);
  });
}
test("preserves corrupt campaign and legacy data until explicit reset", async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem("nn.campaign.save.v1", "{"); localStorage.setItem("nn.save.v1", "legacy"); });
  await page.goto("/"); await page.getByRole("button", { name: "Try Prototype", exact: true }).click(); await page.getByRole("button",{name:"Skip introduction"}).click();
  await page.getByRole("button", { name: "Advance 1 step" }).click();
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
  await expect(page.getByRole("button", { name: "Resume company", exact: true })).toBeVisible();
  expect((await savedGame(page)).campaign!.step).toBe(6);
});
test("keeps the room playable without downloaded furniture", async ({ page }) => {
  await page.route("**/models/**", route => route.abort());
  await page.goto("/"); await page.getByRole("button", { name: "Try Prototype", exact: true }).click(); await page.getByRole("button",{name:"Skip introduction"}).click();
  await expectRoom(page); await page.getByRole("button", { name: "Advance 1 step" }).click();
  expect((await savedGame(page)).campaign!.step).toBe(1);
});

test("entry is guest-only and onboarding keyboard focus stays in the dialog", async ({page})=>{
  await page.goto("/");
  await expect(page.getByRole("button",{name:"Try Prototype"})).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem("nn.campaign.save.v1"))).toBeNull();
  await page.screenshot({path:"test-results/phase2-entry.png"});
  await page.getByRole("button",{name:"Try Prototype"}).click();
  const dialog=page.getByRole("dialog",{name:"Company introduction"});
  const next=dialog.getByRole("button",{name:"Next",exact:true});
  await next.focus();await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button",{name:"Close",exact:true})).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  expect((await savedGame(page)).campaign!.step).toBe(0);
});
test("bankruptcy explains finances and explicitly restarts while preserving evidence",async({page})=>{
  let g=advanceSteps(newGame(1,"bankrupt-test"),6).state;
  g=advanceSteps(g,53).state;g.campaign!.cashCents=1;g.cash=.01;
  await seedSave(page,g);await page.goto("/");await page.getByRole("button",{name:"Continue company"}).click();
  await page.getByRole("button",{name:"Resume company",exact:true}).click();
  const ended=page.getByRole("dialog",{name:"Company bankrupt"});
  await expect(ended).toBeVisible();
  await expect(ended).toContainText("Last period revenue");
  await ended.getByRole("button",{name:"Export or start a new company"}).click();
  const menu=page.getByRole("dialog",{name:"Menu"});
  const download=page.waitForEvent("download");await menu.getByRole("button",{name:"Export playtest record"}).click();await download;
  await menu.getByRole("button",{name:"New company",exact:true}).click();
  await menu.getByRole("button",{name:"Confirm new company"}).click();
  expect((await savedGame(page)).campaign!.runId).not.toBe("bankrupt-test");
  const events=await page.evaluate(()=>JSON.parse(localStorage.getItem("nn.campaign.analytics.v1")!));
  expect(events.filter((e:{name:string})=>e.name==="run_failed")).toHaveLength(1);
});
