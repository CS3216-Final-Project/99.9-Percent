import { setGameSpeed, openPanelTab } from "./fixtures";
import { advanceCampaignStep } from "./fixtures";
import {test,expect,expectRoom,seedSave,savedGame} from "./fixtures";
import {act,tick,dataCompany,spikeCompany,untilOffset} from "../src/sim/__tests__/spikeFixtures";
import type {Page} from "@playwright/test";
async function blockedGuest(page:Page,g:ReturnType<typeof dataCompany>,room=true){
 const api:string[]=[];page.on("request",r=>{if(new URL(r.url()).pathname.startsWith("/api/"))api.push(r.url());});await page.route("**/api/**",r=>r.abort());
 await seedSave(page,g);await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).click();if(room)await expectRoom(page);return api;
}
async function runTo(page:Page,step:number){
 await page.getByRole("button",{name:"Run",exact:true}).click();
 await expect.poll(async()=>(await savedGame(page)).campaign!.step,{timeout:30000}).toBeGreaterThanOrEqual(step);
 const pause=page.getByRole("button",{name:"Pause",exact:true});if(await pause.isVisible())await pause.click();
}
async function clockTo(page:Page,target:number){
 await page.getByRole("button",{name:"Run",exact:true}).click();
 for(let i=0;i<500&&(await savedGame(page)).campaign!.step<target;i++)await page.clock.runFor(200);
 expect((await savedGame(page)).campaign!.step).toBeGreaterThanOrEqual(target);
 const pause=page.getByRole("button",{name:"Pause",exact:true});if(await pause.isVisible())await pause.click();
}
async function clockUntilDialog(page:Page,name:string){
 const dialog=page.getByRole("dialog",{name,exact:true});
 // Stop at the real pause boundary instead of rendering tens of unused seconds.
 for(let i=0;i<200&&!await dialog.isVisible();i++)await page.clock.runFor(200);
 await expect(dialog).toBeVisible();
}

test("spikes: explicit continuation, delayed autoscaling, retirement and reload without API",async({page,withoutRoom, installClock})=>{
 await installClock({time:new Date("2026-10-10T00:00:00Z")});
 test.setTimeout(150000);const api=await blockedGuest(page,dataCompany());await page.clock.pauseAt(new Date("2026-10-10T00:01:00Z"));
 await page.getByRole("button",{name:"View chapters",exact:true}).click();
 const overview=page.getByRole("dialog",{name:"Guided Mode chapters"});
 await expect(overview.getByRole("listitem").filter({hasText:"Traffic Spikes"})).toContainText("Available next");
 await overview.getByRole("button",{name:"Back to company"}).click();
 await expect(page.getByRole("button",{name:"View chapters",exact:true})).toBeFocused();
 const before=(await savedGame(page)).campaign!;await page.getByRole("button",{name:"Next: Continue to Traffic Spikes"}).click();
 await openPanelTab(page, "Actions");
 const unlock=page.getByRole("button",{name:/Unlock autoscaling/});await unlock.focus();await expect(unlock).toBeFocused();await page.keyboard.press("Enter");await expect(page.getByRole("button",{name:"Confirm",exact:true})).toBeFocused();await page.keyboard.press("Enter");await openPanelTab(page,"Actions");await page.getByRole("button",{name:/Deploy autoscaling/}).click(); await page.getByRole("button", { name: "Confirm", exact: true }).click();
 const n=(await savedGame(page)).campaign!.spikeStage!.enteredStep;
 await advanceCampaignStep(page,{seconds:9, resumeClock:false});
 expect((await savedGame(page)).campaign!.spikeStage!.controller!.highSteps).toBe(2);
 await clockTo(page,n+10);await expect(page.getByRole("status").filter({hasText:"Add server (App 3)"})).toContainText("activates in 3 game second(s)");
 await clockTo(page,n+13);let c=(await savedGame(page)).campaign!;expect(c.apps.find(a=>a.id==="app-3")!.routed).toBe(false);expect(c.snapshot.app.capacity).toBe(3200);
 // Paint the new room label while the company stays paused.
 await page.clock.runFor(1000);
 await page.getByRole("main").getByRole("button",{name:"App 3",exact:true}).click();await expect(page.getByRole("note",{name:"App 3 routing status"})).toBeVisible();
 const app3Reveal=page.getByRole("dialog",{name:"Servers inspected"});await expect(app3Reveal).toBeVisible();await app3Reveal.getByRole("button",{name:"Return to room"}).click();
 await page.screenshot({path:"test-results/phase5-desktop.png",fullPage:true});
 c=(await savedGame(page)).campaign!;
 // Room selection is verified above; the remaining journey exercises clock and replay UI.
 await withoutRoom();
 await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();expect((await savedGame(page)).campaign).toEqual(c);
 await clockTo(page,n+14);expect((await savedGame(page)).campaign!.snapshot.app.capacity).toBe(4200);
 await setGameSpeed(page,2);await page.getByRole("button",{name:"Run",exact:true}).click();
 await clockUntilDialog(page,"Incident postmortem");
 await expect(page.getByRole("dialog")).toContainText("start a server and route traffic to it");await page.getByRole("button",{name:"Continue company",exact:true}).click();
 await clockTo(page,n+40);c=(await savedGame(page)).campaign!;expect(c.apps.some(a=>a.id==="app-4")).toBe(false);expect(c.trace.some(t=>t.type==="autoscale-instance-retired")).toBe(true);
 await page.getByRole("button",{name:"Run",exact:true}).click();await clockUntilDialog(page,"Incident postmortem");await page.getByRole("button",{name:"Continue company",exact:true}).click();
 await page.getByRole("button",{name:"Run",exact:true}).click();await clockUntilDialog(page,"Spike response handled");
 await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();await expect(page.getByRole("dialog",{name:"Spike response handled"})).toBeVisible();
 await page.getByRole("button",{name:"Stay in this chapter",exact:true}).click();expect((await savedGame(page)).campaign!.runId).toBe(before.runId);expect(api.every(url=>new URL(url).pathname==="/api/session")).toBe(true);
});
test("spikes: manual planning installs, scales and routes capacity through room controls",async({page, installClock})=>{
 await installClock();
 const api=await blockedGuest(page,spikeCompany(false));const n=(await savedGame(page)).campaign!.spikeStage!.enteredStep;
 await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+60_000));
 await setGameSpeed(page,2);
 await openPanelTab(page, "Actions");
 await page.getByRole("button",{name:/Add server/}).click(); await page.getByRole("button", { name: "Confirm", exact: true }).click();await advanceCampaignStep(page,{seconds:2,resumeClock:false});
 // Render the installed rack while physical game time stays paused.
 await page.clock.runFor(1000);
 await page.getByRole("main").getByRole("button",{name:"App 3",exact:true}).click();const scaleReveal=page.getByRole("dialog",{name:"Servers inspected"});await expect(scaleReveal).toBeVisible();await scaleReveal.getByRole("button",{name:"Return to room"}).click();await openPanelTab(page,"Actions");await page.getByRole("button",{name:/Scale up App 3/}).click(); await page.getByRole("button", { name: "Confirm", exact: true }).click();await advanceCampaignStep(page,{seconds:3,resumeClock:false});
 await page.getByRole("button",{name:"All apps",exact:true}).click();await advanceCampaignStep(page,{resumeClock:false});
 const c=(await savedGame(page)).campaign!,expected=manualSpikePlan().campaign!;
 expect(c.step).toBe(n+6);
 expect(c.apps.map(({id,tier,capacity,routed})=>({id,tier,capacity,routed}))).toEqual(expected.apps.map(({id,tier,capacity,routed})=>({id,tier,capacity,routed})));
 expect(c.routing).toEqual(expected.routing);expect(c.pending).toEqual([]);
 expect(c.cashCents).toBe(expected.cashCents);expect(c.investedCents).toBe(expected.investedCents);
 expect(c.spikeStage!.controller).toBeNull();expect(c.incident).toBeNull();
 expect(api.every(url=>new URL(url).pathname==="/api/session")).toBe(true);
});

/** Same configuration reached by the public controls above, built only through engine actions. */
function manualSpikePlan(){
 let g=spikeCompany(false);
 g=tick(act(g,{type:"add_server"}),2);
 g=tick(act(g,{type:"scale_up",appId:"app-3"}),3);
 return tick(act(g,{type:"set_routing",mode:"balanced",targets:["app-1","app-2","app-3"]}),1);
}

test("spikes: manually planned capacity survives the announced wave without an autoscaler",async({page,installClock,withoutRoom})=>{
 await withoutRoom();
 await installClock();
 test.setTimeout(90000);
 const api=await blockedGuest(page,manualSpikePlan(),false);
 await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+60_000));
 await setGameSpeed(page,2);
 const n=(await savedGame(page)).campaign!.spikeStage!.enteredStep;
 await advanceCampaignStep(page,{seconds:n+28-(await savedGame(page)).campaign!.step,resumeClock:false});
 const c=(await savedGame(page)).campaign!;
 expect(c.step).toBe(n+28);expect(c.apps).toHaveLength(3);expect(c.spikeStage!.controller).toBeNull();
 expect(c.incident).toBeNull();expect(c.snapshot.app.capacity).toBe(4800);expect(c.investedCents).toBeGreaterThan(0);
 expect(api.every(url=>new URL(url).pathname==="/api/session")).toBe(true);
});
test("spikes: write-heavy DB constraint remains after automatic app routing",async({page,withoutRoom})=>{
 await withoutRoom();
 test.setTimeout(90000);const api=await blockedGuest(page,untilOffset(spikeCompany(true,"write-heavy"),24),false);
 await openPanelTab(page, "Actions");
 const control=page.getByRole("region",{name:"Traffic spikes and autoscaling"});await expect(control).toContainText("cannot increase DB capacity");
 expect((await savedGame(page)).campaign!.snapshot.db.demand).toBeGreaterThan(3000);
 await openPanelTab(page, "Actions");
 await page.getByRole("button",{name:"Limit to 500 requests/s"}).click(); await page.getByRole("button", { name: "Confirm", exact: true }).click();await setGameSpeed(page,2);await page.getByRole("button",{name:"Run",exact:true}).click();
 await expect(page.getByRole("dialog",{name:"Incident postmortem"})).toBeVisible({timeout:25000});await expect(page.getByRole("dialog")).toContainText("adds no database capacity");
 const c=(await savedGame(page)).campaign!;expect(c.dbCapacity).toBe(3000);expect(c.readCache!.target).toBe(6000);expect(c.limit).toBe(500);expect(api.every(url=>new URL(url).pathname==="/api/session")).toBe(true);
});

test("spikes: disabling keeps paid installation and allows an explicit manual route",async({page})=>{
 const api=await blockedGuest(page,untilOffset(spikeCompany(),10));const before=(await savedGame(page)).campaign!;
 await openPanelTab(page, "Actions");
 await page.getByRole("button",{name:"Disable autoscaling",exact:true}).click();
 await runTo(page,before.step+3);
 const idle=(await savedGame(page)).campaign!;expect(idle.apps.find(a=>a.id==="app-3")!.routed).toBe(false);expect(idle.cashCents).toBe(before.cashCents);expect(idle.pending.some(a=>a.type==="routing")).toBe(false);
 await page.getByRole("main").getByRole("button",{name:"App 3",exact:true}).click();await expect(page.getByRole("note",{name:"App 3 routing status"})).toBeVisible();
 const idleReveal=page.getByRole("dialog",{name:"Servers inspected"});await expect(idleReveal).toBeVisible();await idleReveal.getByRole("button",{name:"Return to room"}).click();
  await openPanelTab(page, "Actions");
 await page.getByRole("button",{name:"All apps",exact:true}).click();await runTo(page,(await savedGame(page)).campaign!.step+1);
 const routed=(await savedGame(page)).campaign!;expect(routed.apps.find(a=>a.id==="app-3")!.routed).toBe(true);expect(routed.spikeStage!.controller!.enabled).toBe(false);expect(api.every(url=>new URL(url).pathname==="/api/session")).toBe(true);
});
