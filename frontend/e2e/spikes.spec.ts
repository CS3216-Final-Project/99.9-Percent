import {test,expect,expectRoom,seedSave,savedGame} from "./fixtures";
import {dataCompany,spikeCompany,untilOffset} from "../src/sim/__tests__/spikeFixtures";
import type {Page} from "@playwright/test";
async function blockedGuest(page:Page,g:ReturnType<typeof dataCompany>){
 const api:string[]=[];page.on("request",r=>{if(new URL(r.url()).pathname.startsWith("/api/"))api.push(r.url());});await page.route("**/api/**",r=>r.abort());
 await seedSave(page,g);await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);return api;
}
async function runTo(page:Page,step:number){
 await page.getByRole("button",{name:"Resume company",exact:true}).click();
 await expect.poll(async()=>(await savedGame(page)).campaign!.step,{timeout:30000}).toBeGreaterThanOrEqual(step);
 const pause=page.getByRole("button",{name:"Pause company",exact:true});if(await pause.isVisible())await pause.click();
}
async function clockTo(page:Page,target:number){
 await page.getByRole("button",{name:"Resume company",exact:true}).click();
 for(let i=0;i<500&&(await savedGame(page)).campaign!.step<target;i++)await page.clock.runFor(200);
 expect((await savedGame(page)).campaign!.step).toBeGreaterThanOrEqual(target);
 const pause=page.getByRole("button",{name:"Pause company",exact:true});if(await pause.isVisible())await pause.click();
}
test("spikes: explicit continuation, delayed autoscaling, retirement and reload without API",async({page})=>{
 test.setTimeout(150000);await page.clock.install({time:new Date("2026-10-10T00:00:00Z")});const api=await blockedGuest(page,dataCompany());await page.clock.pauseAt(new Date("2026-10-10T00:01:00Z"));
 await expect(page.getByRole("navigation",{name:"Campaign progression"})).toContainText("Traffic Spikes & Autoscaling Available next");
 const before=(await savedGame(page)).campaign!;await page.getByRole("button",{name:"Continue to traffic spikes"}).click();
 const unlock=page.getByRole("button",{name:/Unlock autoscaling/});await unlock.focus();await expect(unlock).toBeFocused();await page.keyboard.press("Enter");await page.getByRole("button",{name:/Deploy autoscaling/}).click();
 const n=(await savedGame(page)).campaign!.spikeStage!.enteredStep;
 for(let i=0;i<9;i++)await page.getByRole("button",{name:"Advance 1 step",exact:true}).click();
 expect((await savedGame(page)).campaign!.spikeStage!.controller!.highSteps).toBe(2);
 await clockTo(page,n+10);await expect(page.getByRole("status").filter({hasText:"Application installation"})).toContainText("app-3");
 await clockTo(page,n+13);let c=(await savedGame(page)).campaign!;expect(c.apps.find(a=>a.id==="app-3")!.routed).toBe(false);expect(c.snapshot.app.capacity).toBe(3200);
 await expect(page.getByRole("note",{name:"App 3 routing status"})).toBeVisible();
 await page.screenshot({path:"test-results/phase5-desktop.png",fullPage:true});
 await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();expect((await savedGame(page)).campaign).toEqual(c);
 await clockTo(page,n+14);expect((await savedGame(page)).campaign!.snapshot.app.capacity).toBe(4200);
 await page.getByRole("button",{name:"Fast · 2×",exact:true}).click();await page.getByRole("button",{name:"Resume company",exact:true}).click();
 await page.clock.runFor(30000);await expect(page.getByRole("dialog",{name:"Incident postmortem"})).toBeVisible();
 await expect(page.getByRole("dialog")).toContainText("provisioning and routing");await page.getByRole("button",{name:"Continue company",exact:true}).click();
 await clockTo(page,n+40);c=(await savedGame(page)).campaign!;expect(c.apps.some(a=>a.id==="app-4")).toBe(false);expect(c.trace.some(t=>t.type==="autoscale-instance-retired")).toBe(true);
 await page.getByRole("button",{name:"Resume company",exact:true}).click();await page.clock.runFor(30000);await expect(page.getByRole("dialog",{name:"Incident postmortem"})).toBeVisible();await page.getByRole("button",{name:"Continue company",exact:true}).click();
 await page.getByRole("button",{name:"Resume company",exact:true}).click();await page.clock.runFor(10000);await expect(page.getByRole("dialog",{name:"Spike response handled"})).toBeVisible();
 await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();await expect(page.getByRole("dialog",{name:"Spike response handled"})).toBeVisible();
 await page.getByRole("button",{name:"Continue operating",exact:true}).click();expect((await savedGame(page)).campaign!.runId).toBe(before.runId);expect(api).toEqual([]);
});
test("spikes: manual planning prevents overload without an autoscaler",async({page})=>{
 test.setTimeout(90000);const api=await blockedGuest(page,spikeCompany(false));const n=(await savedGame(page)).campaign!.spikeStage!.enteredStep;
 await page.getByRole("button",{name:/Add application/}).click();for(let i=0;i<2;i++)await page.getByRole("button",{name:"Advance 1 step",exact:true}).click();
 await page.getByRole("region",{name:"Application instances"}).getByRole("button",{name:/App 3:/}).click();await page.getByRole("button",{name:/Scale up app-3/}).click();for(let i=0;i<3;i++)await page.getByRole("button",{name:"Advance 1 step",exact:true}).click();
 await page.getByRole("button",{name:"Balance across installed apps"}).click();await page.getByRole("button",{name:"Advance 1 step",exact:true}).click();
 await page.getByRole("button",{name:"Fast · 2×",exact:true}).click();await runTo(page,n+28);const c=(await savedGame(page)).campaign!;
 expect(c.apps).toHaveLength(3);expect(c.spikeStage!.controller).toBeNull();expect(c.incident).toBeNull();expect(c.snapshot.app.capacity).toBe(4800);expect(c.investedCents).toBeGreaterThan(0);expect(api).toEqual([]);
});
test("spikes: write-heavy DB constraint remains after automatic app routing",async({page})=>{
 test.setTimeout(90000);const api=await blockedGuest(page,untilOffset(spikeCompany(true,"write-heavy"),24));
 const control=page.getByRole("region",{name:"Traffic spikes and autoscaling"});await expect(control).toContainText("cannot increase DB capacity");
 expect((await savedGame(page)).campaign!.snapshot.db.demand).toBeGreaterThan(3000);
 await page.getByRole("button",{name:"Limit to 500 requests/s"}).click();await page.getByRole("button",{name:"Fast · 2×",exact:true}).click();await page.getByRole("button",{name:"Resume company",exact:true}).click();
 await expect(page.getByRole("dialog",{name:"Incident postmortem"})).toBeVisible({timeout:25000});await expect(page.getByRole("dialog")).toContainText("does not increase database capacity");
 const c=(await savedGame(page)).campaign!;expect(c.dbCapacity).toBe(3000);expect(c.readCache!.target).toBe(6000);expect(c.limit).toBe(500);expect(api).toEqual([]);
});

test("spikes: disabling keeps paid installation and allows an explicit manual route",async({page})=>{
 const api=await blockedGuest(page,untilOffset(spikeCompany(),10));const before=(await savedGame(page)).campaign!;
 await page.getByRole("button",{name:"Disable autoscaling",exact:true}).click();
 await runTo(page,before.step+3);
 const idle=(await savedGame(page)).campaign!;expect(idle.apps.find(a=>a.id==="app-3")!.routed).toBe(false);expect(idle.cashCents).toBe(before.cashCents);expect(idle.pending.some(a=>a.type==="routing")).toBe(false);
 await expect(page.getByRole("note",{name:"App 3 routing status"})).toBeVisible();
 await page.getByRole("button",{name:"Balance across installed apps"}).click();await runTo(page,(await savedGame(page)).campaign!.step+1);
 const routed=(await savedGame(page)).campaign!;expect(routed.apps.find(a=>a.id==="app-3")!.routed).toBe(true);expect(routed.spikeStage!.controller!.enabled).toBe(false);expect(api).toEqual([]);
});
