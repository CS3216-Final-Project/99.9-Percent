import { test, expect, expectRoom, savedGame, seedSave } from "./fixtures";
test("inspects evidence and advances a physical step on touch", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Try Prototype", exact: true }).tap(); await page.getByRole("button",{name:"Skip introduction"}).tap();
  await expectRoom(page);
  await expect(page.getByRole("region",{name:"Campaign guidance"})).toBeInViewport();
  await expect(page.getByRole("region",{name:"System status"})).toBeInViewport();
  await expect(page.getByRole("region",{name:"Architecture"})).toBeInViewport();
  await expect(page.getByRole("region",{name:"Actions"}).getByRole("button",{name:/Add application/})).toBeInViewport();
  await page.screenshot({ path: "test-results/phase1-mobile.png" });
  await page.getByRole("button", { name: "Inspect metrics · free" }).tap();
  await page.getByRole("button", { name: "Advance 1 step" }).tap();
  expect((await savedGame(page)).campaign!.step).toBe(1);
  await expect(page.getByRole("navigation",{name:"Campaign progression"})).toBeInViewport();
  await expect(page.getByRole("navigation",{name:"Campaign progression"})).toContainText("Opening Current");
  await page.getByRole("button", { name: "History", exact: true }).tap();
  await expect(page.getByRole("dialog", { name: "Campaign history" })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).tap();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
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

test("selects the read cache through room and dependency evidence on touch",async({page})=>{
 const {dataCompany}=await import("../src/sim/__tests__/dataFixture");const {applyAction}=await import("../src/sim");const {advanceSteps}=await import("../src/sim/step");const {seedSave}=await import("./fixtures");
 let g=advanceSteps(dataCompany(),6).state;let r=applyAction(g,{type:"deploy_cache"});if(!r.ok)throw Error(r.message);g=advanceSteps(r.state,30).state;
 r=applyAction(g,{type:"acknowledge_review"});if(!r.ok)throw Error(r.message);g=r.state;
 await seedSave(page,g);await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).tap();await expectRoom(page);
 await page.getByRole("main").getByRole("button",{name:"Read Cache",exact:true}).tap();
 await expect(page.getByRole("navigation",{name:"Request dependencies"}).getByRole("button",{name:/Read Cache/})).toHaveAttribute("aria-pressed","true");
 await expect(page.getByRole("status").filter({hasText:"Selected component"})).toContainText("Read Cache");
 await expect(page.getByRole("navigation",{name:"Campaign progression"})).toBeInViewport();
 await expect(page.getByRole("navigation",{name:"Campaign progression"})).toContainText("Data Strategy Current");
 await page.screenshot({path:"test-results/phase4-mobile.png"});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("selects autoscaled instances and reads controller guidance on touch without API",async({page})=>{
 const {spikeCompany,untilOffset}=await import("../src/sim/__tests__/spikeFixtures");const {seedSave}=await import("./fixtures");
 await page.route("**/api/**",r=>r.abort());await seedSave(page,untilOffset(spikeCompany(),24));await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).tap();await expectRoom(page);
 await expect(page.getByRole("navigation",{name:"Campaign progression"})).toContainText("Traffic Spikes & Autoscaling Current");
 await page.getByRole("region",{name:"Application instances"}).getByRole("button",{name:/App 4:/}).tap();
 await expect(page.getByRole("main").getByRole("button",{name:"App 4",exact:true})).toHaveAttribute("aria-pressed","true");
 await page.getByRole("main").getByRole("button",{name:"App 3",exact:true}).tap();await expect(page.getByRole("region",{name:"Application instances"}).getByRole("button",{name:/App 3:/})).toHaveAttribute("aria-pressed","true");
 await expect(page.getByRole("region",{name:"Traffic spikes and autoscaling"})).toContainText("Cooldown remaining");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);await page.screenshot({path:"test-results/phase5-mobile.png"});
});

test("First Growth prevention checklist and review are understandable on touch",async({page})=>{
 await page.route("**/api/**",r=>r.abort());await page.goto("/");await page.getByRole("button",{name:"Try Prototype",exact:true}).tap();await page.getByRole("button",{name:"Skip introduction"}).tap();await expectRoom(page);
 await page.getByRole("button",{name:"Limit to 500 requests/s",exact:true}).tap();await page.getByRole("button",{name:/Upgrade database/}).tap();
 for(let i=0;i<4;i++)await page.getByRole("button",{name:"Advance 1 step",exact:true}).tap();
 const checklist=page.getByRole("region",{name:"Opening prevention progress"});await expect(checklist).toContainText("You are protecting the system by rejecting traffic");await expect(checklist).toContainText("Stable service: 0 / 5 seconds of simulated service");
 await page.getByRole("button",{name:"Remove traffic limit",exact:true}).tap();await checklist.getByRole("button",{name:"Inspect Application evidence"}).tap();await checklist.getByRole("button",{name:"Inspect Database evidence"}).tap();
 for(let i=0;i<3;i++)await page.getByRole("button",{name:"Advance 1 step",exact:true}).tap();
 await expect(checklist).toContainText("Stable service: 3 / 5 seconds of simulated service");await checklist.scrollIntoViewIfNeeded();await page.screenshot({path:"test-results/prevention-polish-mobile-checklist.png"});
 for(let i=0;i<2;i++)await page.getByRole("button",{name:"Advance 1 step",exact:true}).tap();
 const review=page.getByRole("dialog",{name:"Prevention review"});await expect(review).toContainText("You prevented a production incident");await page.screenshot({path:"test-results/prevention-polish-mobile-review.png"});
 await review.getByRole("button",{name:"Close",exact:true}).tap();await expect(checklist).toContainText("FIRST GROWTH PREVENTED");await checklist.getByRole("button",{name:"Review outcome"}).tap();await review.getByRole("button",{name:"Continue company"}).tap();
 await page.getByRole("dialog",{name:"First growth challenge handled"}).getByRole("button",{name:"Continue operating"}).tap();expect((await savedGame(page)).campaign!.scaling?.id).toBe("application-scaling");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("touch: reliability tree ownership and real health evidence without API",async({page})=>{
 const {preparedReliability}=await import("../src/sim/__tests__/reliabilityFixture");await page.route("**/api/**",r=>r.abort());await seedSave(page,preparedReliability());await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).tap();await expectRoom(page);await page.getByRole("banner").getByRole("button",{name:"Technology tree",exact:true}).tap();const d=page.getByRole("dialog",{name:"Technology tree"});await expect(d.locator("[data-tech]")).toHaveCount(9);await d.getByRole("button",{name:"Health Checks: Owned",exact:true}).tap();await expect(d).toContainText("Deployed");await d.getByRole("button",{name:"Close",exact:true}).tap();await expect(page.getByRole("region",{name:"Stay Online"})).toContainText("healthy");
});

test("combined: touch scorecard, completed guidance, technology inspection and paused reload",async({page})=>{const {finishedCompany}=await import("../src/sim/__tests__/combinedFixture");await page.route("**/api/**",r=>r.abort());await seedSave(page,finishedCompany());await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).tap();await page.getByRole("button",{name:"Complete campaign",exact:true}).tap();await page.getByRole("button",{name:"Inspect final company",exact:true}).tap();await expect(page.getByRole("navigation",{name:"Campaign progression"})).toContainText("Combined campaign Completed");await page.getByRole("button",{name:"View run scorecard",exact:true}).tap();await expect(page.getByRole("region",{name:"Run scorecard"})).toContainText("50,000");await page.getByRole("button",{name:"Close",exact:true}).tap();await page.getByRole("banner").getByRole("button",{name:"Technology tree",exact:true}).tap();await expect(page.getByRole("dialog",{name:"Technology tree"}).locator("[data-tech]")).toHaveCount(9);await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).tap();expect((await savedGame(page)).outcome).toBe("won");});
