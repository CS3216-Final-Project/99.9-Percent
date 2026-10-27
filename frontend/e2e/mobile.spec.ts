import { infrastructureAction, inspectEquipment, closeInspection, purchasePreview, followHintComponent, expectInspectionsOnly } from "./componentInspection";
import { reliabilityClarity } from "./reliabilityClarity";
import { campaignReportJourney } from "./campaignReports";
import { chapter6FinanceJourney } from "./chapter6Finance";
import { act as chapter6Act, tick as chapter6Tick, combinedCompany as chapter6Company, promotionRiskCompany } from "../src/sim/__tests__/combinedFixture";
import { chapter6Preparation, bootChapter6 } from "./chapter6Guidance";
import { appHealthDuringOpening, appHealthJourney, appHealthProblem } from "./appHealth";
import type { Page } from "@playwright/test";
import { keyboardDetails, purchaseLayout } from "./purchaseLayout";
import { completeTutorial, advanceCampaignStep } from "./fixtures";
import { financeDuringWalkthrough } from "./financeIntegration";
import { test, expect, expectRoom, savedGame, seedSave, unlockChallenge } from "./fixtures";
import { newGame } from "../src/sim";
import { recoveryJourney } from "./incidentRecovery";
import { pauseArrival } from "./incidentPause";
import { advanceSteps, applyCampaignInput, step } from "../src/sim/step";
import {preparedReliability,act,tick} from "../src/sim/__tests__/reliabilityFixture";
import { spikeCompany, untilOffset } from "../src/sim/__tests__/spikeFixtures";
import { expectCueColours, chapter4TrafficTarget } from "./chapter4Cues";
import { companyMessageJourney } from "./companyMessages";
import { finishedLaunchWeek } from "../src/game/__fixtures__/openingOutcome";

// These journeys cover the desktop edition's narrow touch layout, which narrow windows and the full campaign still use.
// A phone plays its own edition, covered by phoneLayout.spec.ts and phoneTutorial.spec.ts.
test.use({ edition: "desktop" });

test.describe("Company messages on touch", () => {
  test.use({reviewCompanyMessage:false});
  for (const width of [390,320]) test(`company message: Chapter 4 queues stage guidance at ${width}px touch`, async ({page, withoutRoom}, info) => {
  await withoutRoom();
    await page.setViewportSize({width,height:width===320?568:844});
    await companyMessageJourney(page,info,4,true);
  });
});

test("Chapter 4 traffic target: safe removal and confirmation stay actionable on 320px touch", async ({ page, installClock, withoutRoom}) => {
  await withoutRoom();
  await installClock(); await page.setViewportSize({ width: 320, height: 568 }); await chapter4TrafficTarget(page, true);
});

for (const [offset, name, tone] of [[0, "Prepare", "prepare"], [8, "Spike 1", "pressure"], [8, "Respond", "pressure"], [28, "Between spikes", "recovery"], [48, "Spike 2", "pressure"], [68, "Recover", "recovery"]] as const)
  test(`Chapter 4 colours: ${name} remains readable and dismissible on 320px touch`, async ({ page, installClock, withoutRoom}, info) => {
  await withoutRoom();
    await installClock(); await page.setViewportSize({ width: 320, height: 568 });
    const initial = spikeCompany(false);
    const game = offset ? untilOffset(name === "Respond" ? initial : tick(act(initial, { type: "set_traffic_limit", enabled: true })), offset) : initial;
    await page.route("**/api/**", route => route.abort()); await seedSave(page, game); await page.goto("/");
    await page.getByRole("button", { name: "Continue company", exact: true }).tap(); await expectRoom(page);
    if (name === "Respond") await page.getByRole("dialog", { name: "Chapter 4: Spike 1", exact: true }).getByRole("button", { name: "Got it", exact: true }).tap();
    const cue = page.getByRole("dialog", { name: `Chapter 4: ${name}`, exact: true });
    await expectCueColours(cue, tone); await page.screenshot({ path: info.outputPath(`${name.replaceAll(" ", "-")}-320-touch.png`) });
    const before = (await savedGame(page)).campaign!.step;
    await cue.getByRole("button", { name: "Got it", exact: true }).tap(); await expect(cue).toHaveCount(0);
    expect((await savedGame(page)).campaign!.step).toBe(before);
  });

for (const width of [390, 320]) test(`Phase 1 Hint and accepted control remain usable by touch at ${width}px`, async ({ page, installClock, withoutRoom}, info) => {
  await withoutRoom();
  await installClock(); await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/**", route => route.abort());
  const game = advanceSteps(newGame(), 6).state;
  await seedSave(page, game); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).tap(); await expectRoom(page);
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 60_000));
  await page.getByRole("button", {name:"Hide equipment and actions",exact:true}).tap();
  // A real tap resets inactivity without changing the company.
  await closeInspection(page); await page.getByRole("button", { name: "Hint", exact: true }).tap();
  const card = page.getByRole("dialog", { name: "Hint", exact: true });
  await expect(card).toBeInViewport({ ratio: 1 }); await expect(card).toContainText("Your database is overloaded");
  await expect(card.locator("p")).toHaveCount(1); await expect(card.locator("input,fieldset,select")).toHaveCount(0);
  await page.screenshot({ path: info.outputPath(`hint-card-touch-${width}.png`) });

  await card.getByRole("button", { name: "Got it" }).tap();
  const target = page.locator(".campaign-gold-attention");
  await expect(target).toHaveCount(1); await expect(target).toHaveAccessibleName("Equipment & actions");
  await target.tap();
  await expect(target).toHaveCount(1); await followHintComponent(page); await expect(target).toHaveAccessibleName(/^Upgrade database/);
  await expect(target).toBeInViewport({ ratio: 1 });
  expect(await target.evaluate(node => getComputedStyle(node).animationName)).toBe("none");
  await expectInspectionsOnly(page,game);
  await page.screenshot({ path: info.outputPath(`hint-target-touch-${width}.png`) });
  await target.tap(); await expect(target).toHaveCount(1); await expect(target).toHaveAccessibleName("Confirm");
  await expect(target).toBeInViewport({ratio:1});
  expect(await target.evaluate(node => getComputedStyle(node).animationName)).toBe("none");
  await page.screenshot({path:info.outputPath(`confirm-touch-${width}.png`)});
  const values = page.getByRole("region",{name:"Purchase preview"}).locator(".purchase-tile dd");
  await expect(values).toHaveCount(4);
  for (const value of await values.all()) {
    await value.scrollIntoViewIfNeeded();
    await expect(value).toBeInViewport({ratio:1});
  }
  await expect(target).toHaveCount(1); await expect(target).toHaveAccessibleName("Confirm");
  await expect(target).toBeInViewport({ratio:1});
  await page.getByRole("button",{name:"Cancel",exact:true}).tap(); await expect(target).toHaveCount(0);
  await (await infrastructureAction(page,/^Upgrade database/)).tap(); await expect(target).toHaveAccessibleName("Confirm");
  await target.tap(); await expect(target).toHaveCount(0);
  expect((await savedGame(page)).campaign!.pending.some(a=>a.type==="upgrade-db")).toBe(true);
  await expect(page.getByRole("button", { name: "Menu", exact: true })).toBeInViewport({ ratio: 1 });
});

test("Launch Week practice can be exited by touch during a saved incident", async ({ page, withoutRoom }) => {
  await withoutRoom();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/**", route => route.abort());
  const incident = advanceSteps(newGame(1, "touch-exit-replay"), 6).state;
  await seedSave(page, incident);
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).tap();
  await page.getByRole("button", { name: "View chapters", exact: true }).tap();
  await page.getByRole("dialog", { name: "Guided Mode chapters" }).getByRole("button", { name: "Replay Launch Week", exact: true }).tap();
  await expect(page.getByRole("region",{name:"Introduction Progress"})).toContainText("0/4");
  await expect(page.getByLabel("Current chapter", { exact: true })).toHaveText("Launch Week");
  await expect(page.getByRole("button", { name: "Run", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "View chapters", exact: true }).tap();
  await page.getByRole("dialog", { name: "Guided Mode chapters" }).getByRole("button", { name: "Exit practice", exact: true }).tap();
  expect((await savedGame(page)).campaign).toEqual(incident.campaign);
});

test("the touch Navigation menu keeps floors, walking and camera tools clear of time controls", async ({ page }) => {
 await seedSave(page,newGame(1,"touch-dock"));
 await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).tap();
 await expectRoom(page);
 // On a phone the map starts folded away to a button under the equipment sheet, and opens by touch inside the screen.
 await page.getByRole("button",{name:"Hide equipment and actions",exact:true}).tap();
 const fold=page.locator(".room-map.is-closed").getByRole("button",{name:"Map",exact:true});await expect(fold).toBeVisible();
 await fold.tap();const plan=(await page.getByRole("region",{name:"Map"}).boundingBox())!;
 expect(plan.x).toBeGreaterThanOrEqual(0);expect(plan.x+plan.width).toBeLessThanOrEqual(page.viewportSize()!.width);
 await page.getByRole("button",{name:"Hide map"}).tap();
 await page.getByRole("button",{name:"Equipment & actions",exact:true}).tap();
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

test("touch Chapter 0 explains weekly finances in-card and preserves the real Finance dialog",async({page,withoutRoom})=>{
 await withoutRoom();
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:"reduce"});
 await financeDuringWalkthrough(page,true);
});

test("finance and infrastructure help are reachable by touch with reduced motion",async({ page, withoutRoom })=>{
 await withoutRoom();
 await page.emulateMedia({reducedMotion:"reduce"});await page.setViewportSize({width:390,height:844});
 await page.route("**/api/**",r=>r.abort());await seedSave(page,newGame(1,"touch-finance"));
 await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).tap();
 const cash=page.getByRole("button",{name:"View finances"});await expectCashFits(page);
 await page.screenshot({path:"test-results/finance-cash-touch.png"});await cash.tap();const finance=page.getByRole("dialog",{name:"Company finances"});
 await expect(finance).toContainText("$0.20");await expect(finance.getByText("Costs waiting to be paid",{exact:true})).toBeHidden();await page.screenshot({path:"test-results/finance-refinement-touch.png"});await finance.getByText("Advanced details",{exact:true}).tap();await finance.getByText("Detailed running costs",{exact:true}).tap();
 await expect(finance.getByRole("table")).toBeVisible();await page.screenshot({path:"test-results/finance-touch.png"});
 await finance.getByText(/Complete a period before we can estimate your financial health/).scrollIntoViewIfNeeded();
 await expect(finance.getByText(/Complete a period before we can estimate your financial health/)).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await finance.getByRole("button",{name:"Close",exact:true}).tap();
 await page.locator('.campaign-panel .chip').filter({hasText:/^App Server$/}).tap();
 await inspectEquipment(page,"app",true);await page.getByText("About Servers",{exact:true}).tap();
 await expect(page.locator('.campaign-evidence')).toContainText("needs routing");
 await (await infrastructureAction(page,/Add server/)).tap();const confirmation=page.getByRole("region",{name:"Confirm Add server"});
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
 const before=await savedGame(page);
 await (await infrastructureAction(page,/^Add server/)).tap();
 const card=purchasePreview(page),content=card.getByRole("region",{name:"Purchase details",exact:true});
 await card.getByText("How it works",{exact:true}).tap();
 await expect.poll(()=>content.evaluate(el=>el.scrollHeight-el.clientHeight)).toBeGreaterThan(0);
 await expect.poll(()=>content.evaluate(el=>{
  const box=el.getBoundingClientRect(),preview=el.closest(".campaign-purchase-body")!.getBoundingClientRect();
  return (Math.min(box.bottom,preview.bottom)-Math.max(box.top,preview.top))/parseFloat(getComputedStyle(el).lineHeight);
 })).toBeGreaterThanOrEqual(3);
 await keyboardDetails(page);
 await page.setViewportSize({width:390,height:1200});
 await expect.poll(()=>content.evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(0);
 await keyboardDetails(page); // Natural fitting content; no artificial overflow.
 await card.getByRole("button",{name:"Cancel",exact:true}).tap();await closeInspection(page);
 await expectInspectionsOnly(page,before);
});


test("Opening prevention recognition unlocks Scaling after touch review and reload",async({ page , withoutRoom})=>{
  await withoutRoom();
 let g=newGame(0,"touch-prevention");
 g=act(g,{type:"set_traffic_limit",enabled:true});g=act(g,{type:"start_db_upgrade"});g=advanceSteps(g,4).state;
 g=act(g,{type:"incident_inspect",equipment:"app"});g=act(g,{type:"incident_inspect",equipment:"db"});
 g=act(g,{type:"set_traffic_limit",enabled:false});g=advanceSteps(g,5).state;
 await page.route("**/api/**",r=>r.abort());await page.setViewportSize({width:390,height:844});
 await seedSave(page,g);await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).tap();
 await expectRoom(page);
 const review=page.getByRole("dialog",{name:"Prevention review"});
 await expect(review).toContainText("Verified prevention is a valid Opening completion path");
 await review.getByRole("button",{name:"Continue company",exact:true}).tap();
 const recognition=page.getByRole("dialog",{name:"First growth challenge handled"});
 await expect(recognition).toContainText("You spotted the bottleneck early and prevented an outage.");
 await expect(page.getByLabel("Current Guided Mode stage")).toHaveText("Opening");
 await expect(page.getByRole("region",{name:"Scaling controls"})).toHaveCount(0);
 const before=(await savedGame(page)).campaign!;expect(before.openingMilestone!.acknowledged).toBe(false);expect(before.scaling).toBeNull();
 await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).tap();
 expect((await savedGame(page)).campaign).toEqual(before);await expect(page.getByLabel("Current Guided Mode stage")).toHaveText("Opening");
 await recognition.getByRole("button",{name:"Continue to Scaling & Routing",exact:true}).tap();
 const after=(await savedGame(page)).campaign!;
 expect(after.scaling).not.toBeNull();expect(after.reports).toEqual([]);expect(after.openingRecovered).toBe(false);expect(after.step).toBe(before.step);expect(after.cashCents).toBe(before.cashCents);
 await expect(page.getByLabel("Current Guided Mode stage")).toHaveText("Scaling & Routing");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
test("current chapter is prominent and the full journey opens on touch", async ({ page, withoutRoom }) => {
 await withoutRoom();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/**", route => route.abort());
  await seedSave(page, spikeCompany(false));
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).tap();

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

for (const next of [false,true]) test(`compact chapter bar keeps goal and navigation reachable on touch, Next=${next}`, async ({page,withoutRoom}) => {
  await withoutRoom();
  const {completedReliability}=await import("../src/sim/__tests__/combinedFixture");
  await page.route("**/api/**",route=>route.abort());
  await seedSave(page,next?completedReliability():newGame());
  await page.goto("/");
  await page.getByRole("button",{name:"Continue company",exact:true}).tap();

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

test("new players can compare both modes and start Challenge Mode on touch", async ({ page, withoutRoom}) => {
  await withoutRoom();
  await unlockChallenge(page);
  await page.goto("/");
  const choices = page.getByRole("region", { name: "Choose how you want to play" });
  await expect(choices.getByRole("button", { name: "Start Guided Mode" })).toBeInViewport();
  await expect(choices.getByRole("button", { name: "Start Challenge Mode" })).toBeInViewport();
  await expect(choices.getByRole("region", { name: "Challenge Mode" })).toContainText("50,000 users in 26 weeks");
  expect(await page.locator(".home-card").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: "test-results/mode-choice-mobile.png" });
  await choices.getByRole("button", { name: "Start Challenge Mode" }).tap();
  await completeTutorial(page);
  await expectRoom(page);
  await page.getByRole("button", { name: /Next week/ }).tap();
  await page.reload();
  await page.getByRole("button", { name: "Continue week 2" }).tap();
  await expect(page.getByRole("button", { name: /Next week/ })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("nn.campaign.save.v1"))).toBeNull();
});

test("reliability: inspection and effective recipients remain clear on narrow touch screens",async({ page, withoutRoom })=>{
 await withoutRoom();
 await page.setViewportSize({width:390,height:844});
 await page.route("**/api/**",route=>route.abort());
 await seedSave(page,tick(act(preparedReliability(),{type:"arm_reliability"}),9));
 await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).tap();
 const app=await inspectEquipment(page,"app");
 await app.getByRole("button",{name:"Server management",exact:true}).tap();
 const instances=app.getByRole("region",{name:"Application instances"});
 await instances.locator('[data-guidance-app="app-2"]').tap();
 await expect(app.getByRole("heading",{name:"App 2",exact:true})).toBeVisible();
 await expect(app).toContainText("detected unhealthy");
 await expect((await infrastructureAction(page,/Restore App 2/))).toBeEnabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await closeInspection(page);await page.getByRole("button",{name:"Tech",exact:true}).tap();
 const tree=page.getByRole("region",{name:"Tech tree"});
 await expect(tree.locator("[data-tech]")).toHaveCount(9);
 await tree.getByRole("button",{name:"Automatic Failover: Owned",exact:true}).tap();
 await expect(tree.getByRole("heading",{name:"Automatic Failover",exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await tree.getByRole("button",{name:"Back to room",exact:true}).tap();
 await page.getByRole("button",{name:"Menu",exact:true}).tap();
 await expect(page.getByRole("dialog",{name:"Menu"}).getByRole("tab",{name:/Graphics/})).toBeVisible();
});

test("inspects evidence and advances a physical step on touch", async ({ page , installClock, withoutRoom}) => {
  await withoutRoom();
 await installClock();
  // This journey checks evidence and the dock; full Chapter 0 is covered separately.
  await seedSave(page, newGame(1, "touch-evidence"));
  await page.goto("/"); await page.getByRole("button", { name: "Continue company", exact: true }).tap();
  await expectRoom(page);
  const mute = page.getByRole("button", { name: "Mute sound", exact: true });
  await mute.tap(); await expect(mute).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: "test-results/phase1-mobile.png" });
  await page.getByRole("complementary", { name: "System metrics" }).getByRole("button", { name: "Monitoring", exact: true }).tap();
  const before=(await savedGame(page)).campaign!.step;
  await closeInspection(page);await advanceCampaignStep(page);
  expect((await savedGame(page)).campaign!.step).toBe(before+1);
  await expect(page.getByRole("button", { name: "Run", exact: true })).toBeInViewport({ratio:1});
  await page.getByRole("button", { name: "History", exact: true }).tap();
  await expect(page.getByRole("region", { name: "History" })).toBeVisible();
  await page.getByRole("region", { name: "History" }).getByRole("button", { name: "Back to room", exact: true }).tap();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("investigates and responds through the incident panel on touch", async ({ page, withoutRoom}) => {
  await withoutRoom();
  await seedSave(page, advanceSteps(newGame(1, "touch-incident"), 6).state);
  await page.goto("/"); await page.getByRole("button", { name: "Continue company" }).tap();
  await expectRoom(page);
  const panel = page.getByRole("complementary", { name: "System metrics" });
  await expect(page.getByRole("banner")).toHaveClass(/is-incident/);
  const requirements = panel.getByRole("region", { name: "Guided Mode requirements", exact: true });
  await expect(requirements.getByRole("heading", { name: /Chapter requirements/ })).toBeVisible();
  const requirementBox = (await requirements.boundingBox())!;
  const latencyBox = (await panel.getByText("Latency · ms", { exact: true }).boundingBox())!;
  expect(requirementBox.y + requirementBox.height).toBeLessThanOrEqual(latencyBox.y);
  await expect(panel.getByRole("region", { name: "Incident recovery" })).toContainText("Latency below 500 ms");
  const database=await inspectEquipment(page,"db",true);
  await expect(database.locator(".campaign-evidence .evidence-rows dd")).toHaveText(["800 operations/s", "600 operations/s", "600"]);
  await expect(database.getByRole("progressbar", { name: "Database load: 800 of 600 operations/s" })).toBeVisible();
  expect((await savedGame(page)).campaign!.step).toBe(6);
  await expect(database.getByRole("region", { name: "Database readings" })).toContainText("133.33%");
  await expect(panel.getByText("Full system evidence", { exact: true })).toHaveCount(0);
  for (const name of [/Add server/, /Upgrade database/, /Limit to ~[\d,]+ requests\/s/]) {
    const button = await infrastructureAction(page,name);
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeVisible();
  }
  await inspectEquipment(page,"db",true);
  await expect(database.getByRole("region", { name: "Database readings" })).toContainText("133.33%");
  await expect(database.getByText("Full system evidence", { exact: true })).toHaveCount(0);
  await (await infrastructureAction(page,/Upgrade database/)).tap(); await page.getByRole("button", { name: "Confirm", exact: true }).tap();
  await expect(panel.getByRole("status").filter({ hasText: "Database upgrade:" })).toContainText("3 game second(s)");
  await expect((await infrastructureAction(page,/Add server/))).toBeDisabled();await closeInspection(page);
  await page.screenshot({ path: "test-results/phase1-mobile-incident.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.getByRole("button", { name: "Run", exact: true }).tap();
  const report = page.getByRole("dialog", { name: "Incident postmortem" });
  await expect(report).toBeVisible({ timeout: 25000 });
  await report.getByRole("button", { name: "Continue company" }).tap();
  expect((await savedGame(page)).phase).toBe("management");
});

test("recovery conditions are visible without a tooltip, and tapping a button leaves none", async ({ page, withoutRoom }) => {
 await withoutRoom();
 await seedSave(page,advanceSteps(newGame(1,"touch-tooltip"),6).state);
 await page.goto("/"); await page.getByRole("button", { name: "Continue company", exact: true }).tap();
  const tip = page.getByRole("tooltip");
  const heading = page.getByRole("complementary", { name: "System metrics" }).getByRole("heading", { name: "Inspect equipment", exact: true });
  await heading.tap();
  await expect(tip).toBeHidden();
  await expect(heading.locator(".tip")).toHaveCount(0);
  const recovery = page.getByRole("region", { name: "Incident recovery", exact: true });
  await recovery.getByRole("heading", { name: "Recovery progress", exact: true }).tap();
  await expect(tip).toBeHidden();
  await expect(recovery).toContainText("5 consecutive game seconds");
  await expect(recovery).toContainText("Latency below 500 ms");
  await expect(recovery).toContainText("Service errors below 1%");
  await expect(recovery).toContainText("Traffic is being accepted and requests are completing");
  await expect(recovery).toContainText("An unhealthy second resets progress. Pausing freezes it.");
  await page.screenshot({ path: "test-results/recovery-conditions-mobile.png" });

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
 await page.getByRole("dialog",{name:"App Servers"}).getByRole("button",{name:"Back to Server management",exact:true}).tap();
 await expect(page.getByRole("region",{name:"Application instances"}).getByRole("button",{name:/App 2:/})).toHaveAttribute("aria-pressed","true");
 await page.getByRole("region",{name:"Application instances"}).getByRole("button",{name:/App 1:/}).tap();
 await expect(page.getByRole("main").getByRole("button",{name:"App 1",exact:true})).toHaveAttribute("aria-pressed","true");
 await closeInspection(page);await page.screenshot({path:"test-results/phase3-mobile.png"});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('account controls remain usable on touch while accounts are offline',async({page, withoutRoom})=>{
  await withoutRoom();
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
  await expect(page.getByRole('region',{name:'Introduction Progress'})).toContainText('0/4');
});


test("cache selection, paid activation and warmth reload on touch",async({page, installClock})=>{
 // Two room loads, a cache deployment and a full-page screenshot take most of a minute on CI's software renderer.
 test.setTimeout(120_000);
 await installClock();
 const {dataCompany}=await import("../src/sim/__tests__/dataFixture");
 await page.route("**/api/**",route=>route.abort());await seedSave(page,dataCompany());
 await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).tap();await expectRoom(page);
 const panel=page.getByRole("complementary",{name:"System metrics"}),data=page.getByRole("region",{name:"Data strategy"});
 await (await infrastructureAction(page,/Deploy Read Cache/)).tap(); await page.getByRole("button", { name: "Confirm", exact: true }).tap();
 await advanceCampaignStep(page,{seconds:2});
 const roomCache=page.getByRole("main").getByRole("button",{name:/Read Cache/});
 await roomCache.tap();await expect(roomCache).toHaveAttribute("aria-pressed","true");await expect(panel.getByRole("button",{name:"Read Cache",exact:true})).toHaveAttribute("aria-pressed","true");
 await page.getByRole("dialog",{name:"Read Cache inspected"}).getByRole("button",{name:"Close"}).tap();
 await advanceCampaignStep(page);
 const before=(await savedGame(page)).campaign!;expect(before.readCache).not.toBeNull();expect(before.readCache!.warmth).toBe(0);
 await advanceCampaignStep(page);
 expect((await savedGame(page)).campaign!.readCache!.warmth).toBe(1200);
 await inspectEquipment(page,"cache",true);await data.scrollIntoViewIfNeeded();await page.screenshot({path:"test-results/phase4-mobile-cache.png"});
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
 await expect(page.getByRole("dialog",{name:"App Servers"}).getByRole("heading",{name:"App 5",exact:true})).toBeVisible();await page.getByRole("button",{name:"Back to Server management",exact:true}).tap();
 await expect(page.getByRole("region",{name:"Application instances"}).getByRole("button",{name:/App 5:/})).toHaveAttribute("aria-pressed","true");
 await page.getByRole("dialog",{name:"App Servers"}).getByRole("button",{name:"Close"}).tap();
 await inspectEquipment(page,"app");await page.getByRole("button",{name:"Server management",exact:true}).tap();await page.getByRole("button",{name:"Autoscaling",exact:true}).tap();await page.getByRole("region",{name:"Autoscaling",exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:"test-results/phase5-mobile.png"});await closeInspection(page);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
 await page.getByRole("button",{name:"Menu",exact:true}).tap();await expect(page.getByRole("dialog",{name:"Menu",exact:true})).toBeVisible();
});

test("combined: touch scorecard, completed guidance, technology inspection and paused reload",async({page,withoutRoom})=>{await withoutRoom();const {finishedCompany}=await import("../src/sim/__tests__/combinedFixture");await page.route("**/api/**",r=>r.abort());await seedSave(page,finishedCompany());await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).tap();await page.getByRole("button",{name:"Complete campaign",exact:true}).tap();await page.getByRole("button",{name:"Inspect final company",exact:true}).tap();await expect(page.getByLabel("Current chapter")).toHaveText("Grow the Company");await page.getByRole("button",{name:"View chapters",exact:true}).tap();await expect(page.getByRole("dialog",{name:"Guided Mode chapters"}).getByRole("listitem").filter({hasText:"Grow the Company"})).toContainText("Completed");await page.getByRole("button",{name:"Back to company",exact:true}).tap();await page.getByRole("button",{name:"View run scorecard",exact:true}).tap();await page.getByRole("region",{name:"Run scorecard"}).getByText("View Technical Details",{exact:true}).tap();await expect(page.getByRole("region",{name:"Run scorecard"})).toContainText("50,000");await page.getByRole("button",{name:"Close",exact:true}).tap();await page.getByRole("button",{name:"Tech",exact:true}).tap();await expect(page.getByRole("region",{name:"Tech tree"}).locator("[data-tech]")).toHaveCount(9);await page.reload();await page.getByRole("button",{name:"See how it ended",exact:true}).tap();expect((await savedGame(page)).outcome).toBe("won");});

for(const width of [390,320]) test(`Campaign UX: the touch opening and secondary controls fit at ${width}px`,async({page})=>{
 // The room is drawn in software, and its labels settle only as the camera brings each machine above the panel.
 test.setTimeout(90_000);
 await page.setViewportSize({width,height:844});
 await page.goto("/");await page.getByRole("button",{name:"Start Guided Mode",exact:true}).tap();
 await expectRoom(page);
 const introduction=page.getByRole("region",{name:"Introduction Progress"});
 await introduction.scrollIntoViewIfNeeded();
 await expect(introduction).toBeInViewport({ratio:1});
 await page.screenshot({path:`test-results/clarity-introduction-${width}.png`});
 await completeTutorial(page);
 const navigation = page.locator(".room-menu");
 await navigation.locator(":scope > summary").tap();
 const officeFloor = navigation.getByRole("group", { name: "Floors" }).getByRole("button", { name: /^Office floor/ });
 await officeFloor.tap();
 await expect(officeFloor).toHaveAttribute("aria-pressed","true");
 await navigation.locator(":scope > summary").tap();
 await expect(page.getByRole("button",{name:"Run",exact:true})).toBeInViewport();await expect(page.getByRole("button",{name:"Advance game second",exact:true})).toBeHidden();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
 const beforeRun=(await savedGame(page)).campaign!.step;
 await page.getByRole("button",{name:"Run",exact:true}).tap();
 await expect.poll(async()=>(await savedGame(page)).campaign!.step).toBeGreaterThan(beforeRun);
 const pause=page.getByRole("button",{name:"Pause",exact:true});if(await pause.isVisible())await pause.tap();
 await expect(page.getByRole("button",{name:"Run",exact:true})).toBeVisible();
 await page.screenshot({path:"test-results/campaign-ux-mobile.png"});
});

// The test browser draws in software, which Auto treats as a machine without a graphics card. Naming a phone's
// graphics card instead takes the path a real phone takes.
test("Auto draws Medium on a graphics card: the screen's normal pixel size, not High's sharper canvas", async ({ page }) => {
  await seedSave(page,newGame(1,"medium-renderer"));
  await page.addInitScript(() => {
    const getParameter = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function (this: WebGL2RenderingContext, name: number) {
      return name === 0x9246 ? "ANGLE (Qualcomm, Adreno (TM) 730, OpenGL ES 3.2)" : getParameter.call(this, name);
    };
  });
  await page.route("**/api/**", route => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).tap();
  // Auto initializes HD after renderer detection. Compiling those materials in
  // software can occupy the emulated phone beyond the normal 10s assertion budget.
  await expectRoom(page, 30_000);
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
test("Chapter 0 inspections and App Health work on touch", async ({page, withoutRoom}) => {
  await withoutRoom();
 await page.setViewportSize({width:390,height:844}); await page.emulateMedia({reducedMotion:"reduce"});
 await appHealthDuringOpening(page);
});
test("App Health explains problem evidence on touch", async ({page, withoutRoom}) => { await withoutRoom(); await appHealthProblem(page,true); });

test("App Health remains compact at 320px touch", async ({page}) => { await appHealthJourney(page,320,844,true); });


test("menu actions and unsaved exit confirmation are reachable by touch", async ({ page, withoutRoom}) => {
  await withoutRoom();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/**", route => route.abort());
  await seedSave(page, newGame(1, "touch-exit"));
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).tap();
  await expectRoom(page);
  await page.getByRole("button", { name: "Menu", exact: true }).tap();
  const menu = page.getByRole("dialog", { name: "Menu", exact: true });
  await expect(menu.getByRole("group", { name: "Run", exact: true }).getByRole("button")).toHaveText(["Resume", "Save now", "How to play", "Exit"]);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "nn.campaign.save.v1") throw new DOMException("Full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await menu.getByRole("button", { name: "Exit", exact: true }).tap();
  const confirm = page.getByRole("dialog", { name: "Exit without saving?", exact: true });
  await expect(confirm).toBeVisible();
  await page.screenshot({ path: "test-results/menu-exit-touch.png" });
  await confirm.getByRole("button", { name: "Cancel", exact: true }).tap();
  await menu.getByRole("button", { name: "Exit", exact: true }).tap();
  await confirm.getByRole("button", { name: "Exit without saving", exact: true }).tap();
  await expect(page.getByRole("region", { name: "Choose how you want to play" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test.describe('Campaign recovery feedback on touch', () => {
  test.use({ reviewRecoveryNotice: false });
  for (const width of [390, 320]) test(`recovery report: touch acknowledgement, evidence and reload at ${width}px`, async ({ page, installClock, withoutRoom}, info) => {
  await withoutRoom();
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installClock(); await recoveryJourney(page, info, true, width === 320);
  });
});

for (const width of [390, 320]) test(`progression choice: visible growth explanation on touch at ${width}px`, async ({ page, installClock }, info) => {
  await installClock(); await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/**', r => r.abort());
  const game = act(act(tick(act(tick(newGame(), 6), { type: 'start_db_upgrade' }), 30), { type: 'acknowledge_review' }), { type: 'acknowledge_milestone' });
  await seedSave(page, game); await page.goto('/');
  await page.getByRole('button', { name: 'Continue company', exact: true }).tap(); await expectRoom(page);
  const choice = page.getByRole('button', { name: 'Consider growth with current capacity', exact: true });
  await choice.scrollIntoViewIfNeeded();
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 60_000));
  await page.keyboard.press('Shift'); await page.clock.runFor(9999);
  const gold = page.locator('.campaign-gold-attention'); await expect(gold).toHaveCount(0);
  await page.clock.runFor(1); await expect(gold).toHaveCount(1); await expect(gold).toHaveAccessibleName('Hint');
  await gold.tap();
  const hint = page.getByRole('dialog', { name: 'Hint', exact: true });
  await expect(hint.getByRole('button', { name: 'Upgrade database', exact: true })).toBeVisible();
  await hint.getByRole('button', { name: 'Accept risk', exact: true }).tap();
  await expect(gold).toHaveAccessibleName('Consider growth with current capacity');
  await expect(choice).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: info.outputPath('growth-choice-touch.png') });
  await choice.tap(); await expect(gold).toHaveCount(1);
  await expect(gold).toHaveAccessibleName("Accept growth risk"); await expect(gold).toBeInViewport({ ratio: 1 });
  await page.getByRole('button', { name: 'Keep preparing', exact: true }).tap();
  expect((await savedGame(page)).campaign!.inputs).toEqual(game.campaign!.inputs);
});

for (const width of [390, 320]) test(`incident Pause: immediate touch attention at ${width}px`, async ({ page, installClock, withoutRoom}, info) => {
  await withoutRoom();
  await installClock(); await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await pauseArrival(page, info, width === 320 ? 5 : 2, true);
});


test("Chapter 6 guidance: 320px touch preparation, actionable routing and safe removal", async ({ page, installClock, withoutRoom}) => {
  await withoutRoom();
  await installClock(); await page.setViewportSize({ width: 320, height: 568 });
  await chapter6Preparation(page, true);
});


for (const milestone of ["wave", "recovery", "final"] as const)
  test(`Chapter 6 guidance: 320px touch ${milestone} milestone colours`, async ({ page, installClock, withoutRoom}, info) => {
  await withoutRoom();
    await installClock(); await page.setViewportSize({ width: 320, height: 568 });
    const wave = chapter6Act(chapter6Tick(chapter6Company(), 5), { type: "start_growth_wave" });
    const game = milestone === "wave" ? wave : milestone === "recovery" ? chapter6Tick(wave, 24) : promotionRiskCompany();
    const title = milestone === "wave" ? "Growth wave 1" : milestone === "recovery" ? "Recover at full demand" : "Final checks";
    await bootChapter6(page, game);
    const cue = page.getByRole("dialog", { name: `Chapter 6: ${title}`, exact: true });
    await expectCueColours(cue, milestone === "wave" ? "pressure" : "recovery");
    await expect(cue.locator("h3 > .icon")).toBeInViewport({ ratio: 1 });
    await expect(cue.getByRole("button", { name: "Dismiss chapter guidance", exact: true })).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: info.outputPath(`${milestone}-320.png`) });
    await cue.getByRole("button", { name: "Got it", exact: true }).tap();
    await expect(cue).toHaveCount(0);
  });


test("Chapter 5 clarity: outcome and details remain usable on 320px touch", async ({ page, installClock, withoutRoom}, info) => {
  await withoutRoom();
  await installClock(); await page.setViewportSize({ width: 320, height: 568 });
  await reliabilityClarity(page, info, true);
});

for (const kind of ["spikes", "completion"] as const) {
  test(`Campaign report: ${kind} summary and acknowledgement on 320px touch`, async ({ page, installClock, withoutRoom}, info) => {
  await withoutRoom();
    await installClock(); await page.setViewportSize({ width: 320, height: 568 });
    await campaignReportJourney(page, info, kind, true);
  });
}

test("Chapter 6 finances: funding warning and existing cash spotlight on 320px touch", async ({ page, installClock, withoutRoom}, info) => {
  await withoutRoom();
  await installClock(); await page.setViewportSize({ width: 320, height: 568 });
  await chapter6FinanceJourney(page, info, true);
});

test("Launch Week cold open and research sheet remain usable by touch at 390px", async ({ page, withoutRoom}, info) => {
  await withoutRoom();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/**", r => r.abort());
  // A company whose database incident was fixed, with the research point earned and unspent.
  let s = newGame(7, "lw-m", 2);
  for (let i = 0; i < 200 && !s.campaign!.launchWeek?.researchEarned; i++) {
    if (s.campaign!.incident && !s.campaign!.pending.some(a => a.type === "upgrade-db") && s.campaign!.dbCapacity < 1000) s = applyCampaignInput(s, { type: "start_db_upgrade" }).state;
    s = s.phase === "review" ? applyCampaignInput(s, { type: "acknowledge_review" }).state : step(s).state;
  }
  await seedSave(page, s); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).tap(); await expectRoom(page);
  const sheet = page.getByRole("region", { name: "Launch Week research" });
  await expect(sheet).toBeVisible();
  await page.screenshot({ path: info.outputPath("launch-research-touch.png") });
  await sheet.getByRole("button", { name: "Autoscaling" }).tap();
  await page.getByRole("button", { name: "Confirm", exact: true }).tap();
  expect((await savedGame(page)).campaign!.launchWeek?.tech).toBe("autoscaling");
});

for (const width of [390, 320]) test(`the Launch Week score card's three actions stay reachable and right-aligned at ${width}px`, async ({ page, withoutRoom}, info) => {
  await withoutRoom();
  await page.setViewportSize({ width, height: 844 });
  await page.route("**/api/**", r => r.abort());
  await seedSave(page, finishedLaunchWeek()); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).tap(); await expectRoom(page);
  const card = page.getByRole("dialog", { name: "Launch Week complete" });
  const proceed = card.getByRole("button", { name: "Continue to Scaling & Routing", exact: true });
  for (const name of ["Copy result", "Stay in this chapter", "Continue to Scaling & Routing"]) await expect(card.getByRole("button", { name, exact: true })).toBeInViewport({ ratio: 1 });
  const foot = await card.locator(".chapter-end-foot").boundingBox(), go = await proceed.boundingBox();
  expect(Math.abs(foot!.x + foot!.width - (go!.x + go!.width))).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({ path: info.outputPath(`launch-score-${width}.png`) });
  await proceed.tap();
  expect((await savedGame(page)).campaign!.scaling).not.toBeNull();
});
