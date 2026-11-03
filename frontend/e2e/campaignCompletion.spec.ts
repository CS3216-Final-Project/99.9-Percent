import { infrastructureAction, closeInspection, routeAllApps } from "./componentInspection";
import { completeTutorial, advanceCampaignStep, setGameSpeed } from "./fixtures";
import {test,expect,seedSave,savedGame} from "./fixtures";
import {completedReliability,act,scalingTrap} from "../src/sim/__tests__/completionFixture";
import {reliabilityOutcome} from "../src/game/__fixtures__/reliabilityOutcome";
import {canCompleteCampaign} from "../src/sim/campaignCompletion";
import type {Page} from "@playwright/test";
// These public-control journeys never select equipment in the 3D room; the Opening suite covers the real renderer.
test.beforeEach(async ({withoutRoom}) => { await withoutRoom(); });
async function boot(page:Page,g=completedReliability()){await page.route("**/api/**",r=>r.abort());await seedSave(page,g);await page.goto("/");await page.getByRole("button",{name:g.phase==="ended"?"See how it ended":"Continue company",exact:true}).click();}
async function move(page:Page,n:number){await pause(page);await advanceCampaignStep(page,{seconds:n});}
async function operateUntil(page:Page,predicate:(g:Awaited<ReturnType<typeof savedGame>>)=>boolean,budget=160,stopAtReport=false){let limitToggled=false;for(let i=0;i<budget;i++){const s=await savedGame(page);if(predicate(s))return;if(s.phase==="ended")throw Error("Unexpected bankruptcy");const notice=page.getByRole("dialog",{name:"System Recovered!",exact:true});if(await notice.isVisible()){await expect(page.getByRole("dialog",{name:"Incident postmortem",exact:true})).toBeVisible();continue;}const report=page.getByRole("dialog",{name:"Incident postmortem"});if(await report.isVisible()){if(stopAtReport)return;await report.getByRole("button",{name:"Continue company",exact:true}).click();continue;}
   // Incidents now hold out for a recorded capacity/routing/admission/restoration decision made after
   // their cause began. Answer with an admission toggle, then undo it on the next pass - both requests
   // count as the response and a set cap would keep rejected requests blocking recovery.
   const c=s.campaign,due=c?.incident?.responseDueFrom;
   if(c&&due!==undefined&&!c.actions.some(a=>a.cancelledStep===undefined&&(a.activatedStep??a.requestedStep)>=due)){
    const pick=await infrastructureAction(page,c.limit===null?/^Limit to /:/^Remove traffic limit/).catch(()=>null);
    if(pick&&await pick.isVisible().catch(()=>false)){await pick.click();await page.getByRole("button",{name:"Confirm",exact:true}).click();if(c.limit===null)limitToggled=true;}
   }else if(limitToggled&&c&&c.limit!==null){
    const rm=await infrastructureAction(page,/^Remove traffic limit/).catch(()=>null);
    if(rm&&await rm.isVisible().catch(()=>false)){await rm.click();await page.getByRole("button",{name:"Confirm",exact:true}).click();limitToggled=false;}
   }
   const resume=page.getByRole("button",{name:"Run",exact:true});if(await resume.isVisible()&&await resume.isEnabled())await resume.click();await page.clock.runFor(1000);}throw Error("Public journey did not reach its expected state");}
/** Each chapter's guide appears once as the company enters it; read its first card, skip any walk-through after it and carry on. */
async function chapterGuide(page:Page,title:string,steps=1){const guide=page.getByRole("dialog",{name:`Chapter guide, step 1 of ${steps}`});await expect(guide).toContainText(title);await guide.getByRole("button",{name:"Got it",exact:true}).click();await expect(guide).toBeHidden();if(steps>1){const rest=page.getByRole("dialog",{name:`Chapter guide, step 2 of ${steps}`});await rest.getByRole("button",{name:"Skip",exact:true}).click();await expect(rest).toBeHidden();}}
async function pause(page:Page){const b=page.getByRole("button",{name:"Pause",exact:true});if(await b.isVisible())await b.click();}
test("campaign: Stay Online's outcome completes the campaign after a reload; replay preserves evidence",async({page, installClock, withoutRoom})=>{
  await withoutRoom();
 await installClock();test.setTimeout(120000);await boot(page,reliabilityOutcome());const outcome=page.getByRole("dialog",{name:"Reliability outcome",exact:true});await expect(outcome).toBeVisible();expect((await savedGame(page)).outcome).toBeNull();await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();await outcome.getByRole("button",{name:"Complete campaign",exact:true}).click();const old=await savedGame(page);expect(old.outcome).toBe("won");await page.getByRole("button",{name:"Inspect final company",exact:true}).click();await page.getByRole("button",{name:"View chapters",exact:true}).click();await expect(page.getByRole("dialog",{name:"Guided Mode chapters"}).getByRole("listitem").filter({hasText:"Stay Online"})).toContainText("Completed");await page.getByRole("button",{name:"Back to company",exact:true}).click();await page.getByRole("button",{name:"View run scorecard",exact:true}).click();await page.getByRole("region",{name:"Run scorecard"}).getByText("View Technical Details",{exact:true}).click();await expect(page.getByRole("region",{name:"Run scorecard"})).toContainText("Campaign complete");await page.getByRole("button",{name:"Close",exact:true}).click();await page.getByRole("banner").getByRole("button",{name:"Menu",exact:true}).click();await page.getByRole("tab",{name:"Saves"}).click();await page.getByRole("button",{name:"New company",exact:true}).click();await page.getByRole("button",{name:"Lose this company? Press again",exact:true}).click();const next=await savedGame(page);expect(next.campaign!.runId).not.toBe(old.campaign!.runId);expect(next.seed).not.toBe(old.seed);const archive=await page.evaluate(()=>localStorage.getItem("nn.campaign.analytics.v1"));expect(archive).toContain("run_scorecard");expect(archive).toContain("replay_started");});
test("campaign: a fresh guest completes every chapter and the campaign through public controls with no API",async({page, installClock, withoutRoom})=>{
  await withoutRoom();
 await installClock();test.setTimeout(600000);await page.route("**/api/**",r=>r.abort());await page.goto("/");await page.getByRole("button",{name:"Start Guided Mode",exact:true}).click();await completeTutorial(page,{keepChapterGuide:true});await setGameSpeed(page,2);const original=(await savedGame(page)).campaign!.runId;
 // Pause the virtual clock once and deliver small ticks without skipping an incident boundary.
 // Resume explicitly after Chapter 1's first automatic incident pause.
 await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1000));
 const advance=async(n:number)=>{
  await closeInspection(page);await pause(page);const target=(await savedGame(page)).campaign!.step+n;
  for(let i=0;i<n*10&&(await savedGame(page)).campaign!.step<target;i++) {
   const report=page.getByRole("dialog",{name:"Incident postmortem",exact:true});
   if(await report.isVisible())await report.getByRole("button",{name:"Continue company",exact:true}).click();
   const run=page.getByRole("button",{name:"Run",exact:true});if(await run.isVisible()&&await run.isEnabled())await run.click();
   await page.clock.runFor(100);
  }
  expect((await savedGame(page)).campaign!.step).toBe(target);await pause(page);
 };
 const install=async(name:RegExp,n:number,confirm=true)=>{await (await infrastructureAction(page,name)).click();if(confirm)await page.getByRole("button",{name:"Confirm",exact:true}).click();await advance(n);};
 const removeLimit=async(n:number)=>{if((await savedGame(page)).campaign!.limit===null){await advance(n);return;}const rm=await infrastructureAction(page,/^Remove traffic limit/);if(!(await rm.isVisible().catch(()=>false))){await advance(n);return;}await rm.click();await page.getByRole("button",{name:"Confirm",exact:true}).click();await advance(n);};
 // Chapter 0 enters Opening, whose database incident and explicit recognition gate Scaling.
 await expect(page.getByLabel("Current chapter",{exact:true})).toHaveText("Opening");
 expect((await savedGame(page)).campaign!.step).toBe(0);
 expect((await savedGame(page)).campaign!.cashCents).toBe(2000000);
 await operateUntil(page,s=>s.phase==="incident",40);await install(/^Upgrade database/,3);
 await operateUntil(page,s=>s.phase==="review",160,true);
 await page.getByRole("dialog",{name:"Incident postmortem",exact:true}).getByRole("button",{name:"Continue company",exact:true}).click();
 await page.getByRole("dialog",{name:"First growth challenge handled",exact:true}).getByRole("button",{name:"Continue to Scaling & Routing",exact:true}).click();
 await expect(page.getByLabel("Current chapter",{exact:true})).toHaveText("Scaling & Routing");
 await chapterGuide(page,"Scale and route");
 // The existing Scaling stage requires its own database investment.
 await install(/^Upgrade database/,3);
 // Route a second server, then scale both as revenue allows; preserve the remaining full-campaign journey.
 await install(/^Limit to /,1);await install(/^Add server/,2);await install(/^Deploy load balancing/,2);await await routeAllApps(page,undefined,()=>advance(1));await removeLimit(1);const afford=(cents:number)=>operateUntil(page,s=>s.campaign!.cashCents>cents&&s.phase==="management",400);await afford(250000);await install(/^Scale up Server 1/,3);await operateUntil(page,s=>s.campaign!.cashCents>250000,400);await install(/^Scale up Server 2/,3);await operateUntil(page,s=>{const c=s.campaign!;return !!c.scaling?.consumed&&s.phase==="management"&&!c.incident&&c.dbBacklog===0&&c.apps.every(a=>a.backlog===0)&&c.reports.every(r=>c.trace.some(t=>t.type==="review-acknowledged"&&t.data.incidentId===r.id));},400);await pause(page);await page.getByRole("button",{name:"Next: Continue to Data Strategy",exact:true}).click();await chapterGuide(page,"Data strategy");await install(/^Deploy Read Cache/,2);await advance(6);await removeLimit(1);await page.getByRole("button",{name:"Next: Continue to Traffic Spikes",exact:true}).click();await chapterGuide(page,"Traffic spikes");await install(/^Add server/,2);await operateUntil(page,s=>s.campaign!.cashCents>250000,400);await install(/^Scale up Server 3/,3);await await routeAllApps(page,undefined,()=>advance(1));await operateUntil(page,s=>s.campaign!.spikeStage!.completedStep!==null);await page.getByRole("button",{name:"Stay in this chapter",exact:true}).click();await page.getByRole("button",{name:"Next: Continue to Stay Online",exact:true}).click();await chapterGuide(page,"Stay online",3);await page.getByRole("button",{name:"Start reliability test",exact:true}).click();await operateUntil(page,s=>s.campaign!.reliabilityStage!.completedStep!==null);await page.getByRole("button",{name:"Stay in this chapter",exact:true}).click();
 // Stay Online is the last chapter; Next completes the campaign once the company is settled.
 await operateUntil(page,canCompleteCampaign);await pause(page);
 await page.getByRole("button",{name:"Next: Complete campaign",exact:true}).click();await expect(page.getByRole("dialog",{name:"Campaign complete"})).toBeVisible();const final=await savedGame(page);expect(final.outcome).toBe("won");expect(final.campaign!.runId).toBe(original);expect(final.campaign!.scorecard!.wholeRunUptime).not.toBeNull();await page.reload();await page.getByRole("button",{name:"See how it ended",exact:true}).click();await expect(page.getByRole("dialog",{name:"Campaign complete"})).toBeVisible();});
test("campaign: bankruptcy has an inspectable scorecard without awarding success",async({page, installClock, withoutRoom})=>{
  await withoutRoom();
 await installClock();let s=completedReliability();s=act(s,{type:"set_traffic_limit",enabled:true}); // real ongoing settlements exhaust the company
 const {step}=await import("../src/sim/step");for(let i=0;i<2500&&s.phase!=="ended";i++)s=step(s).state;expect(s.outcome).toBe("bankrupt");await boot(page,s);await expect(page.getByRole("dialog",{name:"Company bankrupt"})).toBeVisible();await page.getByRole("button",{name:"Export or start a new company",exact:true}).click();await page.getByRole("dialog",{name:"Menu"}).getByRole("button",{name:"View run scorecard",exact:true}).click();await page.getByRole("region",{name:"Run scorecard"}).getByText("View Technical Details",{exact:true}).click();await expect(page.getByRole("region",{name:"Run scorecard"})).toContainText("Company bankrupt");expect((await savedGame(page)).outcome).toBe("bankrupt");});

test("campaign: explicit Scaling consent recovers the historical cash trap through actual revenue",async({page, installClock, withoutRoom})=>{
  await withoutRoom();
 await installClock();test.setTimeout(240000);await boot(page,scalingTrap());const before=(await savedGame(page)).campaign!;expect(before.cashCents).toBe(159334);await page.getByRole("button",{name:"Consider growth with current capacity",exact:true}).click();expect((await savedGame(page)).campaign!.scalingConsent).toBeNull();await page.getByRole("button",{name:"Accept growth risk",exact:true}).click();const consent=(await savedGame(page)).campaign!;expect(consent.cashCents).toBe(before.cashCents);expect(consent.step).toBe(before.step);expect(consent.dbCapacity).toBe(1000);await move(page,4);expect((await savedGame(page)).campaign!.scaling!.consumed).toBe(true);await (await infrastructureAction(page,/^Remove traffic limit/)).click(); await page.getByRole("button", { name: "Confirm", exact: true }).click();await move(page,1);await operateUntil(page,s=>s.campaign!.cashCents>300000);await pause(page);await (await infrastructureAction(page,/^Upgrade database/)).click(); await page.getByRole("button", { name: "Confirm", exact: true }).click();await operateUntil(page,s=>s.phase==="management"&&s.campaign!.dbCapacity===2000&&!s.campaign!.incident);await pause(page);await page.getByRole("button",{name:"Next: Continue to Data Strategy",exact:true}).click();expect((await savedGame(page)).campaign!.dataStage).not.toBeNull();expect((await savedGame(page)).campaign!.runId).toBe(before.runId);await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();expect((await savedGame(page)).campaign!.scalingConsent!.policyVersion).toBe(1);});
