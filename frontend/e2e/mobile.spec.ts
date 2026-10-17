import { appHealthDuringTutorial, appHealthJourney, appHealthProblem } from "./appHealth";
import type { Page } from "@playwright/test";
import { keyboardDetails, purchaseLayout } from "./purchaseLayout";
import { advanceCampaignStep, finishChapterZero } from "./fixtures";
import { financeDuringWalkthrough } from "./financeIntegration";
import { test, expect, expectRoom, savedGame, seedSave, tutorial, unlockChallenge } from "./fixtures";
import { newGame } from "../src/sim";
import { advanceSteps } from "../src/sim/step";
import {preparedReliability,act,tick} from "../src/sim/__tests__/reliabilityFixture";
import { spikeCompany } from "../src/sim/__tests__/spikeFixtures";

test("the touch Navigation menu keeps floors, walking and camera tools clear of time controls", async ({ page }) => {
 await seedSave(page,newGame(1,"touch-dock"));
 await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).tap();
 await expectRoom(page);
 const dock=page.locator(".controls-dock"),room=dock.locator(".room-menu");
 const run=dock.getByRole("button",{name:"Run",exact:true}),before=(await run.boundingBox())!;
 await room.locator(":scope > summary").tap();
 await room.getByRole("group",{name:"Floors"}).getByRole("button",{name:/^Office floor/}).tap();
 await expect(room.locator(":scope > summary .floor-number")).toHaveText("7");
 const walk=room.getByRole("button",{name:"Walk mode",exact:true,includeHidden:true});await walk.tap();await expect(walk).toHaveAttribute("aria-pressed","true");
 await room.locator(":scope > summary").tap();
 await room.getByRole("button",{name:"Zoom out",exact:true}).tap();
 const menu=(await room.locator(".dock-panel").boundingBox())!,bar=(await dock.boundingBox())!;
 expect(menu.y+menu.height).toBeLessThanOrEqual(bar.y);
 await run.tap();await expect(room.locator(".dock-panel")).toBeHidden();
 const pause=dock.getByRole("button",{name:"Pause",exact:true}),after=(await pause.boundingBox())!;
 expect([after.width,after.height]).toEqual([before.width,before.height]);await pause.tap();
});

async function expectCashFits(page:Page) {
 const cash=page.getByRole("button",{name:"View finances"});
 const cashBox=(await cash.boundingBox())!,usersBox=(await page.locator(".stat-users").boundingBox())!,amount=(await cash.locator(".finance-cash-compact").boundingBox())!;
 expect(cashBox.height).toBe(usersBox.height);expect(Math.abs(cashBox.width-usersBox.width)).toBeLessThan(2);
 expect(amount.x).toBeGreaterThanOrEqual(cashBox.x+2);
 expect(amount.x+amount.width).toBeLessThanOrEqual(cashBox.x+cashBox.width-2);
 return {width:page.viewportSize()!.width,cashBox,amount,clearance:cashBox.x+cashBox.width-amount.x-amount.width};
}

test("touch Finance overlays the spotlight walkthrough and restores its step and focus",async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:"reduce"});
 await financeDuringWalkthrough(page,true);
});

test("finance and infrastructure help are reachable by touch with reduced motion",async({page})=>{
 await page.emulateMedia({reducedMotion:"reduce"});await page.setViewportSize({width:390,height:844});
 await page.route("**/api/**",r=>r.abort());await seedSave(page,newGame(1,"touch-finance"));
 await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).tap();await expectRoom(page);
 const cash=page.getByRole("button",{name:"View finances"});await expectCashFits(page);
 await page.screenshot({path:"test-results/finance-cash-touch.png"});await cash.tap();const finance=page.getByRole("dialog",{name:"Company finances"});
 await expect(finance).toContainText("$0.20");await expect(finance.getByText("Costs waiting to be paid",{exact:true})).toBeHidden();await page.screenshot({path:"test-results/finance-refinement-touch.png"});await finance.getByText("Advanced details",{exact:true}).tap();await finance.getByText("Detailed running costs",{exact:true}).tap();
 await expect(finance.getByRole("table")).toBeVisible();await page.screenshot({path:"test-results/finance-touch.png"});
 await finance.getByText(/Complete a period before we can estimate your financial health/).scrollIntoViewIfNeeded();
 await expect(finance.getByText(/Complete a period before we can estimate your financial health/)).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await finance.getByRole("button",{name:"Close",exact:true}).tap();
 await page.locator('.campaign-panel .chip').filter({hasText:/^App Server$/}).tap();
 await page.getByText("About App Server",{exact:true}).tap();
 await expect(page.locator('.campaign-evidence')).toContainText("needs routing");
 await page.getByRole("button",{name:/Add server/}).tap();const confirmation=page.getByRole("region",{name:"Confirm Add server"});
 await expect(confirmation).toContainText("$19,000");await confirmation.getByRole("button",{name:"Cancel"}).tap();
 expect((await savedGame(page)).campaign!.cashCents).toBe(2000000);
});

test("Cash card preserves its inner margin across phone widths",async({page,withoutRoom})=>{
 await withoutRoom();await page.route("**/api/**",r=>r.abort());await seedSave(page,newGame(1,"cash-widths"));
 await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).tap();
 const geometry=[];
 for(const width of [320,360,375,390,430]) {
  await page.setViewportSize({width,height:844});geometry.push(await expectCashFits(page));
 }
 await test.info().attach("Cash clearance by viewport",{body:JSON.stringify(geometry),contentType:"application/json"});
 const cash=page.getByRole("button",{name:"View finances"});await cash.press("Enter");
 await expect(page.getByRole("dialog",{name:"Company finances"})).toBeVisible();
 await page.getByRole("button",{name:"Close",exact:true}).click();await expect(cash).toBeFocused();
 await cash.press("Space");await expect(page.getByRole("dialog",{name:"Company finances"})).toBeVisible();
});

test("purchase details keyboard navigation handles overflow and fitting content",async({page,withoutRoom})=>{
 // Source Sans 3 fits these details at 844px; a shorter phone still exercises real overflow.
 await withoutRoom();await page.setViewportSize({width:390,height:667});await page.emulateMedia({reducedMotion:"reduce"});
 await page.route("**/api/**",r=>r.abort());await seedSave(page,tick(newGame(1,"details-keyboard"),60));
 await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).tap();
 const before=(await savedGame(page)).campaign;
 await page.getByRole("button",{name:/^Add server/}).tap();
 const card=page.locator(".campaign-action-popover"),content=card.getByRole("region",{name:"Purchase details",exact:true});
 await card.getByText("More details",{exact:true}).tap();
 await expect.poll(()=>content.evaluate(el=>el.scrollHeight-el.clientHeight)).toBeGreaterThan(0);
 await keyboardDetails(page);
 await page.setViewportSize({width:390,height:1200});
 await expect.poll(()=>content.evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(0);
 await keyboardDetails(page); // Natural fitting content; no artificial overflow.
 await card.getByRole("button",{name:"Cancel",exact:true}).tap();
 expect((await savedGame(page)).campaign).toEqual(before);
});


test("Opening prevention recognition keeps Scaling locked after touch review and reload",async({page})=>{
 let g=newGame(0,"touch-prevention");
 g=act(g,{type:"set_traffic_limit",enabled:true});g=act(g,{type:"start_db_upgrade"});g=advanceSteps(g,4).state;
 g=act(g,{type:"incident_inspect",equipment:"app"});g=act(g,{type:"incident_inspect",equipment:"db"});
 g=act(g,{type:"set_traffic_limit",enabled:false});g=advanceSteps(g,5).state;
 await page.route("**/api/**",r=>r.abort());await page.setViewportSize({width:390,height:844});
 await seedSave(page,g);await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).tap();await expectRoom(page);
 const review=page.getByRole("dialog",{name:"Prevention review"});
 await expect(review).toContainText("Scaling unlocks only after a real Opening incident");
 await review.getByRole("button",{name:"Continue company",exact:true}).tap();
 await expect(page.getByRole("dialog",{name:"First growth challenge handled"})).toHaveCount(0);
 await expect(page.getByLabel("Current Guided Mode stage")).toHaveText("Opening");
 await expect(page.getByRole("region",{name:"Scaling controls"})).toHaveCount(0);
 const before=(await savedGame(page)).campaign!;expect(before.openingMilestone).toBeNull();expect(before.scaling).toBeNull();
 await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).tap();
 expect((await savedGame(page)).campaign).toEqual(before);await expect(page.getByLabel("Current Guided Mode stage")).toHaveText("Opening");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
test("current chapter is prominent and the full journey opens on touch", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/**", route => route.abort());
  await seedSave(page, spikeCompany(false));
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).tap();
  await expectRoom(page);
  const bar = page.getByRole("region", { name: "Guided Mode chapters" });
  await expect(bar).toContainText("Chapter 4 of 6");
  await expect(bar.getByLabel("Current chapter", { exact: true })).toHaveText("Traffic Spikes & Autoscaling");
  await expect(bar.getByRole("button", { name: "View chapters" })).toBeInViewport();
  expect(await bar.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: "test-results/campaign-chapters-mobile.png" });
  const before = await savedGame(page);
  await bar.getByRole("button", { name: "View chapters" }).tap();
  const dialog = page.getByRole("dialog", { name: "Guided Mode chapters" });
  await expect(dialog.getByRole("listitem")).toHaveCount(7);
  await expect(dialog.getByRole("heading", { name: "Stay Online" })).toBeVisible();
  await dialog.getByRole("button", { name: "Back to company" }).tap();
  await expect(dialog).toBeHidden();
  expect(await savedGame(page)).toEqual(before);
  await expect(page.getByRole("button", { name: "Run", exact: true })).toBeVisible();
});

for (const next of [false,true]) test(`compact chapter bar keeps goal and navigation reachable on touch, Next=${next}`, async ({page}) => {
  const {completedReliability}=await import("../src/sim/__tests__/combinedFixture");
  await page.route("**/api/**",route=>route.abort());
  await seedSave(page,next?completedReliability():newGame());
  await page.goto("/");
  await page.getByRole("button",{name:"Continue company",exact:true}).tap();
  await expectRoom(page);
  const bar=page.getByRole("region",{name:"Guided Mode chapters"});
  const before=await savedGame(page);
  for (const width of [390,320]) {
    await page.setViewportSize({width,height:844});
    await expect(bar.getByLabel("Current objective")).toBeInViewport();
    await expect(bar.getByRole("button",{name:/^Next:/})).toHaveCount(next?1:0);
    expect(await bar.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if(next) {
      const bounds=await bar.getByRole("button",{name:/^Next:/}).boundingBox();
      expect(bounds!.width).toBeGreaterThan(width-24);
      await expect(bar.getByRole("button",{name:/^Next:/})).toBeInViewport();
    }
    await page.screenshot({path:`test-results/clarity-after-${width}-next-${next}.png`});
    const view=bar.getByRole("button",{name:"View chapters"});
    await view.tap();
    const dialog=page.getByRole("dialog",{name:"Guided Mode chapters"});
    await expect(dialog.getByRole("listitem")).toHaveCount(7);
    await dialog.getByRole("button",{name:"Back to company"}).tap();
    await expect(view).toBeFocused();
  }
  expect(await savedGame(page)).toEqual(before);
  if(next) {
    await bar.getByRole("button",{name:"Next: Continue to Grow the Company"}).tap();
    await expect(bar.getByLabel("Current chapter",{exact:true})).toHaveText("Grow the Company");
    expect((await savedGame(page)).campaign!.runId).toBe(before.campaign!.runId);
  }
});

test("new players can compare both modes and start Challenge Mode on touch", async ({ page }) => {
  await unlockChallenge(page);
  await page.goto("/");
  const choices = page.getByRole("region", { name: "Choose how you want to play" });
  await expect(choices.getByRole("button", { name: "Start Guided Mode" })).toBeInViewport();
  await expect(choices.getByRole("button", { name: "Start Challenge Mode" })).toBeInViewport();
  await expect(choices.getByRole("region", { name: "Challenge Mode" })).toContainText("50,000 users in 26 weeks");
  expect(await page.locator(".home-card").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: "test-results/mode-choice-mobile.png" });
  await choices.getByRole("button", { name: "Start Challenge Mode" }).tap();
  await page.getByRole("button", { name: "Skip", exact: true }).tap();
  await expectRoom(page);
  await page.getByRole("button", { name: /Next week/ }).tap();
  await page.reload();
  await page.getByRole("button", { name: "Continue week 2" }).tap();
  await expect(page.getByRole("button", { name: /Next week/ })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("nn.campaign.save.v1"))).toBeNull();
});

test("reliability: inspection and effective recipients remain clear on narrow touch screens",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.route("**/api/**",route=>route.abort());
 await seedSave(page,tick(act(preparedReliability(),{type:"arm_reliability"}),9));
 await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).tap();await expectRoom(page);
 const panel=page.getByRole("region",{name:"Stay Online"});
 await panel.getByRole("button",{name:"Inspect App 2 health · free",exact:true}).tap();
 const instances=page.getByRole("region",{name:"Application instances"});
 await expect(instances.getByRole("button",{name:/App 2: Installed - not receiving traffic/})).toHaveAttribute("aria-pressed","true");
 await expect(panel).toContainText("detected unhealthy");
 await expect(page.getByRole("button",{name:"Restore App 2 · free · 3 game seconds",exact:true})).toBeEnabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByRole("button",{name:"Tech",exact:true}).tap();
 const tree=page.getByRole("region",{name:"Tech tree"});
 await expect(tree.locator("[data-tech]")).toHaveCount(9);
 await tree.getByRole("button",{name:"Automatic Failover: Owned",exact:true}).tap();
 await expect(tree.getByRole("heading",{name:"Automatic Failover",exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await tree.getByRole("button",{name:"Close",exact:true}).tap();
 await page.getByRole("button",{name:"Menu",exact:true}).tap();
 await expect(page.getByRole("dialog",{name:"Menu"}).getByRole("tab",{name:/Graphics/})).toBeVisible();
});

test("inspects evidence and advances a physical step on touch", async ({ page , installClock}) => {
 await installClock();
  await page.goto("/"); await page.getByRole("button", { name: "Start Guided Mode", exact: true }).tap();
  await page.getByRole("button", { name: "Skip", exact: true }).tap();
  await expectRoom(page);
  const mute = page.getByRole("button", { name: "Mute sound", exact: true });
  await mute.tap(); await expect(mute).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: "test-results/phase1-mobile.png" });
  await page.getByRole("complementary", { name: "System metrics" }).getByRole("button", { name: "Monitoring", exact: true }).tap();
  await advanceCampaignStep(page);
  expect((await savedGame(page)).campaign!.step).toBe(1);
  await page.getByRole("button", { name: "History", exact: true }).tap();
  await expect(page.getByRole("region", { name: "History" })).toBeVisible();
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
  await panel.getByRole("button", { name: /Upgrade database/ }).tap(); await page.getByRole("button", { name: "Confirm", exact: true }).tap();
  await expect(panel.getByRole("status").filter({ hasText: "Database upgrade:" })).toContainText("3 game second(s)");
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
  await page.goto("/"); await page.getByRole("button", { name: "Start Guided Mode", exact: true }).tap(); await page.getByRole("button", { name: "Skip", exact: true }).tap();
  await expectRoom(page);
  const tip = page.getByRole("tooltip");
  await page.getByRole("complementary", { name: "System metrics" }).getByText("System evidence", { exact: true }).tap();
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
 await page.getByRole("dialog",{name:"Servers inspected"}).getByRole("button",{name:"Return to room"}).tap();
 await page.getByRole("region",{name:"Application instances"}).getByRole("button",{name:/App 1:/}).tap();
 await expect(page.getByRole("main").getByRole("button",{name:"App 1",exact:true})).toHaveAttribute("aria-pressed","true");
 await page.screenshot({path:"test-results/phase3-mobile.png"});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('account controls remain usable on touch while accounts are offline',async({page})=>{
  await page.route('**/api/session',route=>route.fulfill({status:503,json:{error:'offline'}}));
  await page.goto('/');await page.getByRole('button',{name:/Sign in/}).tap();
  const dialog=page.getByRole('dialog',{name:'Account'});
  await expect(dialog.getByRole('link',{name:'Continue with Google'})).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Try again'})).toBeEnabled();
  await expect(dialog.getByLabel('Email',{exact:true})).toBeVisible();
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.screenshot({path:'test-results/phase3-account-mobile.png'});
  await dialog.getByRole('button',{name:'Close'}).tap();
  await page.getByRole('button',{name:'Start Guided Mode',exact:true}).tap();
  await expect(tutorial(page)).toBeVisible();
});


test("cache selection, paid activation and warmth reload on touch",async({page, installClock})=>{
 await installClock();
 const {dataCompany}=await import("../src/sim/__tests__/dataFixture");
 await page.route("**/api/**",route=>route.abort());await seedSave(page,dataCompany());
 await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).tap();await expectRoom(page);
 const panel=page.getByRole("complementary",{name:"System metrics"}),data=page.getByRole("region",{name:"Data strategy"});
 await data.getByRole("button",{name:/Deploy Read Cache/}).tap(); await page.getByRole("button", { name: "Confirm", exact: true }).tap();
 await advanceCampaignStep(page,{seconds:2});
 const roomCache=page.getByRole("main").getByRole("button",{name:/Read Cache/});
 await roomCache.tap();await expect(roomCache).toHaveAttribute("aria-pressed","true");await expect(panel.getByRole("button",{name:"Read Cache",exact:true})).toHaveAttribute("aria-pressed","true");
 await page.getByRole("dialog",{name:"Read Cache inspected"}).getByRole("button",{name:"Return to room"}).tap();
 await advanceCampaignStep(page);
 const before=(await savedGame(page)).campaign!;expect(before.readCache).not.toBeNull();expect(before.readCache!.warmth).toBe(0);
 await advanceCampaignStep(page);
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
 await page.getByRole("dialog",{name:"Servers inspected"}).getByRole("button",{name:"Return to room"}).tap();
 await page.getByRole("region",{name:"Traffic spikes and autoscaling"}).scrollIntoViewIfNeeded();
 await page.screenshot({path:"test-results/phase5-mobile.png"});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
 await page.getByRole("button",{name:"Menu",exact:true}).tap();await expect(page.getByRole("dialog",{name:"Menu",exact:true})).toBeVisible();
});

test("combined: touch scorecard, completed guidance, technology inspection and paused reload",async({page})=>{const {finishedCompany}=await import("../src/sim/__tests__/combinedFixture");await page.route("**/api/**",r=>r.abort());await seedSave(page,finishedCompany());await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).tap();await page.getByRole("button",{name:"Complete campaign",exact:true}).tap();await page.getByRole("button",{name:"Inspect final company",exact:true}).tap();await expect(page.getByLabel("Current chapter")).toHaveText("Grow the Company");await page.getByRole("button",{name:"View chapters",exact:true}).tap();await expect(page.getByRole("dialog",{name:"Guided Mode chapters"}).getByRole("listitem").filter({hasText:"Grow the Company"})).toContainText("Completed");await page.getByRole("button",{name:"Back to company",exact:true}).tap();await page.getByRole("button",{name:"View run scorecard",exact:true}).tap();await expect(page.getByRole("region",{name:"Run scorecard"})).toContainText("50,000");await page.getByRole("button",{name:"Close",exact:true}).tap();await page.getByRole("button",{name:"Tech",exact:true}).tap();await expect(page.getByRole("region",{name:"Tech tree"}).locator("[data-tech]")).toHaveCount(9);await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).tap();expect((await savedGame(page)).outcome).toBe("won");});

for(const width of [390,320]) test(`Campaign UX: the touch walkthrough and secondary controls fit at ${width}px`,async({page})=>{
 // The room is drawn in software, and its labels settle only as the camera brings each machine above the panel.
 test.setTimeout(90_000);
 await page.setViewportSize({width,height:844});
 await page.goto("/");await page.getByRole("button",{name:"Start Guided Mode",exact:true}).tap();
 await expectRoom(page);
 const card=tutorial(page),room=page.getByRole("main");
 await expect(card).toBeInViewport({ratio:1});
 await expect(card.locator(".tour-prompt")).toHaveText("Click Servers to inspect your app.");
 await page.screenshot({path:`test-results/clarity-tutorial-${width}-first.png`});
 // The camera brings each machine above the panel, where it can be tapped.
 await room.getByRole("button",{name:"Servers",exact:true}).tap();await page.getByRole("dialog",{name:"Servers inspected"}).getByRole("button",{name:"Return to room"}).tap();await expect(card).toHaveAccessibleName("Tutorial, step 2 of 21");
 await room.getByRole("button",{name:"Database",exact:true}).tap();await page.getByRole("dialog",{name:"Database inspected"}).getByRole("button",{name:"Return to room"}).tap();await expect(card).toHaveAccessibleName("Tutorial, step 3 of 21");
 for(let step=4;step<=7;step++){await card.getByRole("button",{name:"Next",exact:true}).tap();await expect(card).toHaveAccessibleName(`Tutorial, step ${step} of 21`);await expect(card).toBeInViewport({ratio:1});}
 await page.getByRole("button",{name:/Upgrade database/}).tap();await expect(card).toHaveAccessibleName("Tutorial, step 8 of 21");
 await expect(card).toBeInViewport({ratio:1});
 await page.screenshot({path:`test-results/clarity-tutorial-${width}-purchase.png`});
 await page.getByRole("region",{name:"Confirm Upgrade database"}).getByRole("button",{name:"Cancel"}).tap();
 await finishChapterZero(page);await expect(card).toBeHidden();
 expect((await savedGame(page)).campaign!.actions).toEqual([]);
 await expect(page.getByRole("button",{name:"Run",exact:true})).toBeInViewport();await expect(page.getByRole("button",{name:"Advance game second",exact:true})).toBeHidden();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
 await page.getByRole("button",{name:"Run",exact:true}).tap();
 await expect.poll(async()=>(await savedGame(page)).campaign!.step).toBeGreaterThan(0);
 const pause=page.getByRole("button",{name:"Pause",exact:true});if(await pause.isVisible())await pause.tap();
 await expect(page.getByRole("button",{name:"Run",exact:true})).toBeVisible();
 await page.screenshot({path:"test-results/campaign-ux-mobile.png"});
});

// The test browser draws in software, which Auto treats as a machine without a graphics card. Naming a phone's
// graphics card instead takes the path a real phone takes.
test("Auto draws Medium on a graphics card: the screen's normal pixel size, not High's sharper canvas", async ({ page }) => {
  await page.addInitScript(() => {
    const getParameter = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function (this: WebGL2RenderingContext, name: number) {
      return name === 0x9246 ? "ANGLE (Qualcomm, Adreno (TM) 730, OpenGL ES 3.2)" : getParameter.call(this, name);
    };
  });
  await page.route("**/api/**", route => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Start Guided Mode", exact: true }).tap();
  await page.getByRole("button", { name: "Skip", exact: true }).tap();
  await expectRoom(page);
  const canvas = page.getByRole("main").locator("canvas");
  // High would draw 1.75 pixels per CSS pixel on this screen; Medium draws one, or a little fewer if the frame rate falls.
  await expect.poll(() => canvas.evaluate(el => (el as HTMLCanvasElement).width / (el as HTMLCanvasElement).clientWidth)).toBeLessThanOrEqual(1.01);
  expect(await canvas.evaluate(el => (el as HTMLCanvasElement).width / (el as HTMLCanvasElement).clientWidth)).toBeGreaterThanOrEqual(0.74);
  await page.getByRole("button", { name: "Menu", exact: true }).tap();
  await page.getByRole("tab", { name: "Graphics" }).tap();
  await expect(page.getByRole("radio", { name: "Auto" })).toBeChecked();
});

test("purchase sheet keeps warnings and decisions reachable on 390px touch",async({page})=>{
 await purchaseLayout(page,390,844,true);
});

test("App Health dashboard and overlays work on narrow touch screens", async ({page}) => {
 await appHealthJourney(page,390,844,true);
});
test("App Health restores the spotlight on touch without advancing it", async ({page}) => {
 await page.setViewportSize({width:390,height:844}); await page.emulateMedia({reducedMotion:"reduce"});
 await appHealthDuringTutorial(page);
});
test("App Health explains problem evidence on touch", async ({page}) => { await appHealthProblem(page,true); });

test("App Health remains compact at 320px touch", async ({page}) => { await appHealthJourney(page,320,844,true); });
