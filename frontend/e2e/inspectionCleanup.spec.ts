import type { Page } from "@playwright/test";
import type { SavedCameraView } from "../src/game/exploration";
import { test, expect, expectRoom, seedSave, openCameraControls } from "./fixtures";
import { inspectEquipment, closeInspection, infrastructureAction } from "./componentInspection";
import { newGame } from "../src/sim";
import { spikeCompany } from "../src/sim/__tests__/spikeFixtures";
import { reliabilityCompany } from "../src/sim/__tests__/reliabilityFixture";
import { combinedCompany } from "../src/sim/__tests__/combinedFixture";

/** As in the existing walk journeys, wait for the original camera damping/framing to finish. */
async function settledCamera(page:Page) {
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem("nn.campaign.exploration.v1")??"null")?.camera);
  let current=await read(),last="",since=Date.now();
  await expect.poll(async()=>{
    current=await read();const json=JSON.stringify(current);
    if(json!==last){last=json;since=Date.now();}
    return !!current&&Date.now()-since>=1200;
  },{timeout:45_000,intervals:[300,350,400]}).toBe(true);
  return current;
}

test("inspection camera: pan and rotate survive live rerenders",async({page,installClock})=>{
  await installClock();await page.route("**/api/**",route=>route.abort());
  await seedSave(page,newGame(1,"inspection-camera"));await page.goto("/");
  await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1000));
  const camera=()=>page.evaluate(()=>JSON.parse(localStorage.getItem("nn.campaign.exploration.v1")??"null")?.camera);
  await expect.poll(camera).not.toBeNull();
  const canvas=page.getByRole("main").locator("canvas"),box=(await canvas.boundingBox())!;
  const start={x:box.x+box.width*.25,y:box.y+box.height*.55};
  const drag=async()=>{
    await page.mouse.move(start.x,start.y);await page.mouse.down();
    await page.mouse.move(start.x+80,start.y+30,{steps:12});await page.mouse.up();
    await page.clock.runFor(1200);
  };
  const original=await camera();await drag();expect((await camera()).target).not.toEqual(original.target);
  const panned=await camera();
  await page.mouse.move(start.x,start.y);await page.mouse.down({button:"right"});
  await page.mouse.move(start.x+80,start.y,{steps:12});await page.mouse.up({button:"right"});
  await page.clock.runFor(1200);expect((await camera()).offset).not.toEqual(panned.offset);
  // A simulation tick rerenders the same camera rig while a real pointer is held.
  await page.getByRole("button",{name:"Run",exact:true}).click();
  await page.mouse.move(start.x,start.y);await page.mouse.down();
  await page.mouse.move(start.x+20,start.y,{steps:4});await page.clock.runFor(1000);
  const during=await camera();await page.mouse.move(start.x+120,start.y,{steps:16});await page.mouse.up();
  await page.clock.runFor(1200);const after=await camera();expect(Math.hypot(after.target.x-during.target.x,after.target.z-during.target.z)).toBeGreaterThan(1);
  await page.getByRole("button",{name:"Pause",exact:true}).click();
  await expect(page.locator(".component-inspection")).toHaveCount(0);
});

test("inspection modal: blocks camera input and restores dragging and scene clicks after close",async({page})=>{
  await page.route("**/api/**",route=>route.abort());
  await seedSave(page,newGame(1,"inspection-camera-modal"));await page.goto("/");
  await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);
  // Take manual control before the exact blocking comparison. Rounded saved
  // framing values can otherwise sit unchanged before one final easing tick.
  const canvas=page.getByRole("main").locator("canvas"),box=(await canvas.boundingBox())!;
  const x=box.x+box.width*.25,y=box.y+box.height*.55;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+40,y+10,{steps:8});await page.mouse.up();
  const blocked=await settledCamera(page),popup=await inspectEquipment(page,"db");
  // An outside pointer-down deliberately dismisses the existing modal. Drag its
  // header instead, and verify it stays open throughout the blocking check.
  const header=(await popup.locator(".modal-head").boundingBox())!;
  await page.mouse.move(header.x+header.width/2,header.y+header.height/2);await page.mouse.down();
  await page.mouse.move(header.x+header.width/2+40,header.y+header.height/2,{steps:12});await page.mouse.up();
  await page.keyboard.press("q");const covered=await settledCamera(page);await expect(popup).toBeVisible();
  expect(covered.target).toEqual(blocked.target);expect(covered.offset).toEqual(blocked.offset);expect(covered.zoom).toBe(blocked.zoom);
  await closeInspection(page);
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+80,y+30,{steps:12});await page.mouse.up();
  const after=await settledCamera(page);
  expect(Math.hypot(after.target.x-blocked.target.x,after.target.z-blocked.target.z)).toBeGreaterThan(1);
  await openCameraControls(page);await page.getByRole("button",{name:"Reset view",exact:true}).click();
  await page.getByRole("main").getByRole("button",{name:"Database",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"Database inspected",exact:true})).toBeVisible();
});

for(const chapter of [4,5,6]) test(`inspection content: Chapter ${chapter} keeps live component diagnostics and actions without legacy lessons`,async({page})=>{
  const game=chapter===4?spikeCompany(false):chapter===5?reliabilityCompany():combinedCompany();
  await page.route("**/api/**",route=>route.abort());await seedSave(page,game);await page.goto("/");
  await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);
  const cue=page.getByRole("dialog",{name:/^Chapter [46]:/});
  if(await cue.isVisible())await cue.getByRole("button",{name:"Got it",exact:true}).click();
  const network=await inspectEquipment(page,"gateway");
  await expect(network).not.toContainText(/Stay online|Stable after restoration|Workload:|Normal demand|Opening campaign/);
  await expect(network.getByRole("button",{name:/Limit to|Remove traffic limit/})).toBeEnabled();
  await infrastructureAction(page,"All apps");await expect(network.getByText(/Configure routing/)).toBeVisible();
  await inspectEquipment(page,"gateway",true);await expect(network.getByRole("region",{name:"Network readings"})).toContainText("Admitted");
  if(chapter>=5)await expect(await infrastructureAction(page,"Deploy Automatic Failover")).toBeVisible();
  const cache=await inspectEquipment(page,"cache",true);
  await expect(cache).not.toContainText(/Workload:|Growth due|Waiting for workload growth/);
  await expect(cache.getByRole("region",{name:"Read Cache readings"})).toContainText("Effective hit rate used");
  await expect(cache.getByRole("button",{name:/Tune cache ceiling/})).toBeVisible();
  const app=await inspectEquipment(page,"app",true);
  await expect(app).not.toContainText(/Stay online|Stable after restoration|Normal demand|spike demand/);
  await expect(app.getByRole("button",{name:/Add server/})).toBeVisible();
  await expect(app.getByRole("region",{name:"Servers readings"})).toContainText("Routed capacity");
  await expect(await infrastructureAction(page,"Deploy autoscaling")).toBeVisible();
  const monitoring=await inspectEquipment(page,"monitoring",true);
  await expect(monitoring).not.toContainText("Opening campaign");
  await expect(monitoring.locator(".component-inspection-metric")).toContainText(`${game.campaign!.snapshot.latencyMs.toFixed(0)} ms`);
  await closeInspection(page);
  if(chapter>=5)await expect(page.locator('.campaign-panel').getByRole("region",{name:"Chapter Progress",exact:true})).toContainText(chapter===5?"Stay Online":"Grow the Company");
});

test.describe("touch inspection camera",()=>{
  test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true,edition:"desktop"});
  test("touch panning works before and immediately after closing shared inspection",async({page})=>{
    await page.route("**/api/**",route=>route.abort());await seedSave(page,newGame(1,"touch-inspection-camera"));
    await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).tap();await expectRoom(page);
    const camera=()=>page.evaluate(()=>JSON.parse(localStorage.getItem("nn.campaign.exploration.v1")??"null")?.camera);
    await expect.poll(camera).not.toBeNull();
    const canvas=page.getByRole("main").locator("canvas"),box=(await canvas.boundingBox())!;
    const x=box.x+box.width*.2,y=box.y+box.height*.2;
    const input=await page.context().newCDPSession(page);
    const pan=async(prior?:SavedCameraView)=>{
      const before=prior??await settledCamera(page);
      await input.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y,id:1}]});
      for(let step=1;step<=12;step++)await input.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:x+step*5,y:y+step*2,id:1}]});
      await input.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
      await expect.poll(async()=>{const now=await camera();return Math.hypot(now.target.x-before.target.x,now.target.z-before.target.z);}).toBeGreaterThan(.2);
    };
    await pan();await inspectEquipment(page,"db");const beforeClose=await settledCamera(page);
    await page.getByRole("dialog",{name:"Database inspected",exact:true}).getByRole("button",{name:"Close",exact:true}).tap();
    await pan(beforeClose);await input.detach();
  });
});
