import { infrastructureAction, closeInspection, purchasePreview } from "./componentInspection";
import { openCameraControls } from "./fixtures";
import { purchaseActions, purchaseLayout } from "./purchaseLayout";
import { test, expect, expectRoom, seedSave, savedGame } from "./fixtures";
import { newGame } from "../src/sim";
import { act, tick, spikeCompany } from "../src/sim/__tests__/spikeFixtures";
import { dataCompany } from "../src/sim/__tests__/dataFixture";
import { reliabilityCompany, readyReliability } from "../src/sim/__tests__/reliabilityFixture";

test("equipment selection reaches the server floor and opens a centered modal quote with accessible evidence", async ({page})=>{
  await page.route("**/api/**", r => r.abort());
  await seedSave(page, tick(newGame(1,"camera-action"),60));
  await page.goto("/?floor=office");await page.getByRole("button",{name:"Continue company",exact:true}).click();
  await openCameraControls(page);for(let i=0;i<4;i++)await page.getByRole("button",{name:"Zoom in"}).click();
  const panel=page.getByRole("complementary",{name:"System metrics"});
  const action=await infrastructureAction(page,/^Upgrade database/);const before=await savedGame(page);await action.click();
  await expect(page.locator('.floor-menu button[data-floor="servers"]')).toHaveAttribute("aria-pressed","true");await expectRoom(page);
  const card=purchasePreview(page),confirm=card.getByRole("region",{name:"Confirm Upgrade database"});
  await expect(confirm).toContainText("Stores data");await expect(confirm.getByText("Setup",{exact:true}).locator("..").locator("dd")).toHaveText("$3,000");
  await expect(confirm.getByText("Lets your database handle more requests at the same time.",{exact:true})).toBeVisible();
  await expect(confirm.locator(".campaign-action-machine")).toBeHidden();await expect(panel.getByText("Effect & costs")).toHaveCount(0);
  await expect(page.getByRole("main").locator('.eq-label[data-eq="db"]')).toHaveClass(/is-affected/);
  const box=(await card.boundingBox())!,viewport=page.viewportSize()!;
  expect(Math.abs(box.x+box.width/2-viewport.width/2)).toBeLessThan(1);expect(Math.abs(box.y+box.height/2-viewport.height/2)).toBeLessThan(1);
  expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(viewport.width);expect(box.y+box.height).toBeLessThanOrEqual(viewport.height);
  await expect(card).toHaveAttribute("aria-modal","true");await expect(confirm.getByRole("button",{name:"Confirm",exact:true})).toBeFocused();
  await page.screenshot({path:"test-results/action-popover.png"});await page.keyboard.press("Escape");await expect(confirm).toBeHidden();await expect(action).toBeFocused();expect(await savedGame(page)).toEqual(before);
  await closeInspection(page);
});



for(const [width,height] of [[1440,900],[1366,768]]) {
  test(`purchase card keeps its footer and warning accessible at ${width}x${height}, through expansion and resize`,async({page})=>{
    await purchaseLayout(page,width,height);
  });
}

test("scaling and load balancing confirmations stay centered and highlight their equipment",async({page})=>{
  let g=tick(newGame(3,"scaling-layout"),6);g=tick(act(g,{type:"start_db_upgrade"}),30);
  g=act(act(g,{type:"acknowledge_review"}),{type:"acknowledge_milestone"});
  await purchaseActions(page,g,[[/^Scale up App 1/,"app"],[/^Deploy load balancing/,"gateway"]]);
});

test("Read Cache confirmation stays centered and highlights the cache",async({page})=>{
  await purchaseActions(page,dataCompany(),[[/^Deploy Read Cache/,"cache"]]);
});

test("cache tuning and autoscaling confirmations stay centered",async({page})=>{
  const g=act(spikeCompany(false),{type:"unlock_autoscaling"});
  await purchaseActions(page,g,[[/^Tune cache ceiling/,"cache"],[/^Deploy autoscaling/,"app"]]);
});

test("Health Checks and spare confirmations stay centered with the correct highlights",async({page})=>{
  let g=act(reliabilityCompany(),{type:"unlock_reliability",tech:"health_checks"});
  g=act(g,{type:"unlock_reliability",tech:"standby"});
  await purchaseActions(page,g,[[/^Deploy Health Checks/,"monitoring"],[/^Install spare/,"app"]]);
});

test("Automatic Failover confirmation stays centered with its equipment highlight",async({page})=>{
  let g=act(reliabilityCompany(),{type:"unlock_reliability",tech:"health_checks"});
  g=tick(act(g,{type:"deploy_health_checks"}),2);g=act(g,{type:"unlock_reliability",tech:"standby"});
  g=tick(act(g,{type:"set_routing",mode:"balanced",targets:["app-1","app-2"]}),1);
  g=tick(act(g,{type:"reserve_spare",appId:"app-3"}),1);g=act(g,{type:"unlock_reliability",tech:"auto_failover"});
  await purchaseActions(page,g,[[/^Deploy Automatic Failover/,"app"]]);
});

test("Stay Online guide unlocks Health Checks in Tech and confirms its purchase",async({page})=>{
  await page.route("**/api/**",r=>r.abort());
  await seedSave(page,readyReliability(),{chapterTours:["scaling","data","spikes"]});
  await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);
  await page.getByRole("button",{name:"Next: Continue to Stay Online",exact:true}).click();
  const guide=(step:number)=>page.getByRole("dialog",{name:`Chapter guide, step ${step} of 3`,exact:true});
  await guide(1).getByRole("button",{name:"Got it",exact:true}).click();
  await expect(guide(2)).toContainText("Open Tech.");
  await page.getByRole("navigation",{name:"Views"}).getByRole("button",{name:"Tech",exact:true}).click();
  await page.getByRole("button",{name:"Health Checks: Research available",exact:true}).click();
  await expect(guide(2)).toContainText("Press Unlock Health Checks.");
  await page.getByRole("button",{name:/^Unlock Health Checks/}).click();
  await expect(guide(3)).toContainText("Close Tech.");
  await page.getByRole("navigation",{name:"Views"}).getByRole("button",{name:"Tech",exact:true}).click();
  // The guide keeps the normal panel: no tabs, and Deploy Health Checks is reached through Monitoring's inspection.
  await expect(page.getByRole("complementary",{name:"System metrics"}).getByRole("tablist")).toHaveCount(0);
  await expect(guide(3)).toContainText("Click Monitoring.");
  await page.getByRole("complementary",{name:"System metrics"}).getByRole("button",{name:"Monitoring",exact:true}).click();
  const monitoring=page.getByRole("dialog",{name:"Monitoring", exact: true});
  await expect(guide(3)).toContainText("Press the Monitoring disc to inspect details.");
  await monitoring.getByRole("button",{name:"Inspect details",exact:true}).click();
  await expect(guide(3)).toContainText("Press Deploy Health Checks.");
  await monitoring.getByRole("button",{name:/^Deploy Health Checks/}).click();
  await expect(guide(3)).toContainText("Press Confirm.");
  const confirmation=page.getByRole("region",{name:"Confirm Deploy Health Checks",exact:true});
  await expect(page.locator('.eq-label[data-eq="monitoring"]')).toHaveClass(/is-affected/);
  await confirmation.getByRole("button",{name:"Confirm",exact:true}).click();
  await expect(guide(3)).toBeHidden();
  expect((await savedGame(page)).campaign!.pending.filter(a=>a.type==="health-checks")).toHaveLength(1);
});
