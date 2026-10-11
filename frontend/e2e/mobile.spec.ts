import { test, expect, expectRoom, savedGame, seedSave } from "./fixtures";
import { newGame } from "../src/sim";
import { advanceSteps } from "../src/sim/step";

test("inspects evidence and advances a physical step on touch", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Try Prototype", exact: true }).tap();
  await page.getByRole("button", { name: "Skip introduction" }).tap();
  await expectRoom(page);
  const mute = page.getByRole("button", { name: "Mute sound", exact: true });
  await mute.tap(); await expect(mute).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: "test-results/phase1-mobile.png" });
  await page.getByRole("complementary", { name: "System metrics" }).getByRole("button", { name: "Monitoring", exact: true }).tap();
  await page.getByRole("button", { name: "Advance step" }).tap();
  expect((await savedGame(page)).campaign!.step).toBe(1);
  await page.getByRole("button", { name: "History", exact: true }).tap();
  await expect(page.getByRole("dialog", { name: "Campaign history" })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).tap();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("investigates and responds through the incident panel on touch", async ({ page }) => {
  await seedSave(page, advanceSteps(newGame(1, "touch-incident"), 6).state);
  await page.goto("/"); await page.getByRole("button", { name: "Continue company" }).tap();
  await expectRoom(page);
  const panel = page.getByRole("complementary", { name: "System metrics" });
  await expect(page.getByRole("banner")).toHaveClass(/is-incident/);
  await panel.getByRole("button", { name: "Database", exact: true }).tap();
  await expect(panel.getByRole("status")).toContainText("Demand 800/s · capacity 600/s · backlog 600");
  expect((await savedGame(page)).campaign!.step).toBe(6);
  for (const name of [/Add server/, /Upgrade database/, /Limit to 500 requests\/s/]) {
    const button = panel.getByRole("button", { name });
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeVisible();
  }
  await panel.locator("summary").filter({ hasText: "Full system evidence" }).tap();
  await expect(panel.getByRole("table")).toContainText("133.33%");
  await panel.locator("summary").filter({ hasText: "Full system evidence" }).tap();
  await panel.getByRole("button", { name: /Upgrade database/ }).tap();
  await expect(panel.getByRole("status").filter({ hasText: "Database upgrade:" })).toContainText("3 step(s)");
  await expect(panel.getByRole("button", { name: /Add server/ })).toBeDisabled();
  await page.screenshot({ path: "test-results/phase1-mobile-incident.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.getByRole("button", { name: "Run", exact: true }).tap();
  const report = page.getByRole("dialog", { name: "Incident postmortem" });
  await expect(report).toBeVisible({ timeout: 25000 });
  await report.getByRole("button", { name: "Continue company" }).tap();
  expect((await savedGame(page)).phase).toBe("management");
});

test("a tap explains a term, and tapping a button does not leave a tooltip over it", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Try Prototype", exact: true }).tap(); await page.getByRole("button", { name: "Skip introduction" }).tap();
  await expectRoom(page);
  const tip = page.getByRole("tooltip");
  await page.getByRole("complementary", { name: "System metrics" }).getByText("Inspect the evidence", { exact: true }).tap();
  await expect(tip).toContainText("Inspection is free");
  await expect(tip).toHaveCSS("opacity", "1");
  const box = (await tip.boundingBox())!, view = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(view.width);
  await page.screenshot({ path: "test-results/tooltip-mobile.png" });

  const mute = page.getByRole("button", { name: "Mute sound", exact: true });
  await mute.tap();
  await expect(tip).toBeHidden();
  await expect(mute).toHaveAttribute("aria-pressed", "true");
});

test("selects scaling instances through room and evidence on touch",async({page})=>{
 const {newGame,applyAction}=await import("../src/sim");
 const {advanceSteps}=await import("../src/sim/step");
 const {seedSave}=await import("./fixtures");
 let g=advanceSteps(newGame(),6).state;
 const act=(a:Parameters<typeof applyAction>[1])=>{const r=applyAction(g,a);if(!r.ok)throw Error(r.message);g=r.state;};
 act({type:"start_db_upgrade"});g=advanceSteps(g,30).state;
 act({type:"acknowledge_review"});act({type:"acknowledge_milestone"});act({type:"add_server"});g=advanceSteps(g,2).state;
 await seedSave(page,g);await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).tap();await expectRoom(page);
 await page.getByRole("main").getByRole("button",{name:"App 2",exact:true}).tap();
 await expect(page.getByRole("region",{name:"Application instances"}).getByRole("button",{name:/App 2:/})).toHaveAttribute("aria-pressed","true");
 await page.getByRole("region",{name:"Application instances"}).getByRole("button",{name:/App 1:/}).tap();
 await expect(page.getByRole("main").getByRole("button",{name:"App 1",exact:true})).toHaveAttribute("aria-pressed","true");
 await page.screenshot({path:"test-results/phase3-mobile.png"});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('account controls remain usable on touch while accounts are offline',async({page})=>{
  await page.route('**/api/session',route=>route.fulfill({status:503,json:{error:'offline'}}));
  await page.goto('/');await page.getByText('Account and cloud saves',{exact:true}).tap();
  await expect(page.getByRole('link',{name:'Sign in with Google'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Retry account connection'})).toBeEnabled();
  await page.getByRole('button',{name:'Retry account connection'}).scrollIntoViewIfNeeded();
  await page.screenshot({path:'test-results/phase3-account-mobile.png'});
  await page.getByRole('button',{name:'Try Prototype',exact:true}).tap();
  await expect(page.getByRole('dialog',{name:'Company introduction'})).toBeVisible();
});


test("cache selection, paid activation and warmth reload on touch",async({page})=>{
 const {dataCompany}=await import("../src/sim/__tests__/dataFixture");
 await page.route("**/api/**",route=>route.abort());await seedSave(page,dataCompany());
 await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).tap();await expectRoom(page);
 const panel=page.getByRole("complementary",{name:"System metrics"}),data=page.getByRole("region",{name:"Data strategy"});
 await data.getByRole("button",{name:/Deploy Read Cache/}).tap();
 for(let i=0;i<2;i++)await page.getByRole("button",{name:"Advance step",exact:true}).tap();
 const roomCache=page.getByRole("main").getByRole("button",{name:/Read Cache/});
 await roomCache.tap();await expect(roomCache).toHaveAttribute("aria-pressed","true");await expect(panel.getByRole("button",{name:"Read Cache",exact:true})).toHaveAttribute("aria-pressed","true");
 await page.getByRole("button",{name:"Advance step",exact:true}).tap();
 const before=(await savedGame(page)).campaign!;expect(before.readCache).not.toBeNull();expect(before.readCache!.warmth).toBe(0);
 await page.getByRole("button",{name:"Advance step",exact:true}).tap();
 expect((await savedGame(page)).campaign!.readCache!.warmth).toBe(1200);
 await data.scrollIntoViewIfNeeded();await page.screenshot({path:"test-results/phase4-mobile-cache.png"});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
 const saved=(await savedGame(page)).campaign!;await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).tap();
 expect((await savedGame(page)).campaign).toEqual(saved);
});

test("traffic spikes: touch selects an instance after retirement leaves an ID gap",async({page})=>{
 const {spikeCompany,untilOffset}=await import("../src/sim/__tests__/spikeFixtures");
 const g=untilOffset(spikeCompany(),54);expect(g.campaign!.apps.map(a=>a.id)).toContain("app-5");
 await page.route("**/api/**",r=>r.abort());await seedSave(page,g);await page.goto("/");
 await page.getByRole("button",{name:"Continue company",exact:true}).tap();await expectRoom(page);
 const room=page.getByRole("main"),app=room.getByRole("button",{name:"App 5",exact:true});
 await app.tap();await expect(app).toHaveAttribute("aria-pressed","true");
 await expect(page.getByRole("region",{name:"Application instances"}).getByRole("button",{name:/App 5:/})).toHaveAttribute("aria-pressed","true");
 await page.getByRole("region",{name:"Traffic spikes and autoscaling"}).scrollIntoViewIfNeeded();
 await page.screenshot({path:"test-results/phase5-mobile.png"});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
 await page.getByRole("button",{name:"Menu",exact:true}).tap();await expect(page.getByRole("dialog",{name:"Menu",exact:true})).toBeVisible();
});
