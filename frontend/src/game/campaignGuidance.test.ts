import {it,expect} from "vitest";
import {campaignGuidance,campaignObjective} from "./campaignGuidance";
import {newGame,applyAction,type GameState,type Action} from "../sim";
import {advanceSteps,canEnterData} from "../sim/step";
import {canEnterSpikes} from "../sim/autoscaling";
import {dataCompany,preparedSpikes,spikeCompany,untilOffset,act,tick} from "../sim/__tests__/spikeFixtures";
import {reliabilityCompany} from "../sim/__tests__/reliabilityFixture";
import {combinedCompany,finishRound} from "../sim/__tests__/combinedFixture";
function decision(g:GameState,a:Action){const r=applyAction(g,a);if(!r.ok)throw Error(r.message);return r.state;}
function recovered(){return advanceSteps(decision(advanceSteps(newGame(),6).state,{type:"start_db_upgrade"}),30).state;}
function scaling(){return decision(decision(recovered(),{type:"acknowledge_review"}),{type:"acknowledge_milestone"});}
function prevented(){return advanceSteps(decision(decision(newGame(),{type:"set_traffic_limit",enabled:true}),{type:"start_db_upgrade"}),4).state;}
function row(g:GameState,id:string){const m=campaignGuidance(g);return [...m.requirements,...m.preventionChecks].find(r=>r.id===id)!;}
it("objectives follow actual phase before chapter without replacing required actions",()=>{
 const g=scaling();
 expect(campaignObjective(g)).toBe("Prepare the system for the next growth wave.");
 g.campaign!.incident=advanceSteps(newGame(),6).state.campaign!.incident;
 expect(campaignObjective(g)).toContain("Restore stable service");
 g.phase="review";
 expect(campaignObjective(g)).toContain("Read the postmortem");
 expect(campaignGuidance(g).pendingAction?.label).toBe("Review postmortem");
 g.phase="ended";g.outcome="won";
 expect(campaignObjective(g)).toContain("final architecture and scorecard");
 g.outcome="bankrupt";
 expect(campaignObjective(g)).toContain("finances and recorded evidence");
});
it("Opening requirements need no generic waiting message or scheduled deadline",()=>{
 const m=campaignGuidance(newGame());expect(m.waiting).toBeNull();expect(m.pendingAction).toBeNull();expect(m.incomplete.map(r=>r.id)).toContain("growth");
});
it("active Opening incident requires recovery and hides all prevention requirements",()=>{
 const g=advanceSteps(newGame(),6).state,m=campaignGuidance(g);expect(m.prevention).toBe(false);expect(row(g,"recovery").met).toBe(false);expect(m.pendingAction).toBeNull();expect(m.requirements.some(r=>r.id==="admission")).toBe(false);
});
it("reactive report then milestone actions require explicit acknowledgement",()=>{
 let g=recovered();expect(campaignGuidance(g).pendingAction?.label).toBe("Review postmortem");expect(row(g,"recovery").met).toBe(true);expect(row(g,"review").met).toBe(false);
 g=decision(g,{type:"acknowledge_review"});expect(campaignGuidance(g).pendingAction?.label).toBe("Complete Opening");expect(row(g,"review").met).toBe(true);expect(g.campaign!.scaling).toBeNull();
 g=decision(g,{type:"acknowledge_milestone"});expect(campaignGuidance(g).stage).toBe("Scaling & Routing");
});
it("keeps the Opening at three chapter requirements from launch through growth and the incident",()=>{
 let g=newGame();const seen=new Set<number>();
 for(let i=0;i<10;i++){seen.add(campaignGuidance(g).requirements.length);g=advanceSteps(g,1).state;}
 expect([...seen]).toEqual([3]);
});
/** The requirement counts a company shows over `steps` game seconds, acting on the way as a player would. */
function counts(g:GameState,steps:number,play:(g:GameState,i:number)=>GameState=g=>g){
 const seen=new Set<number>();
 for(let i=0;i<steps&&g.phase!=="ended";i++){g=play(g,i);if(g.phase==="review")g=decision(g,{type:"acknowledge_review"});seen.add(campaignGuidance(g).requirements.length);g=tick(g);}
 return [...seen];
}
it("keeps Scaling's headroom row, met, once its growth has arrived",()=>{
 expect(counts(scaling(),40,(g,i)=>i===2?decision(g,{type:"start_db_upgrade"}):g)).toEqual([8]);
 const grown=advanceSteps(decision(scaling(),{type:"start_db_upgrade"}),20).state;
 expect(grown.campaign!.scaling!.consumed).toBe(true);expect(row(grown,"headroom").met).toBe(true);
});
it("keeps Stay Online's arming row, met, once the test has started",()=>{
 expect(counts(reliabilityCompany(),20,(g,i)=>i===3?decision(g,{type:"arm_reliability"}):g)).toEqual([13]);
 expect(row(decision(reliabilityCompany(),{type:"arm_reliability"}),"pending").met).toBe(true);
});
it("keeps Grow the Company's restoration row whether or not a wave has failed a server",{timeout:30_000},()=>{
 let g=combinedCompany();const calm=campaignGuidance(g).requirements.length;expect(row(g,"restored").met).toBe(true);
 for(let i=0;i<2;i++){g=tick(g,5);g=decision(g,{type:"start_growth_wave"});g=finishRound(g);g=decision(g,{type:"acknowledge_growth"});}
 // The third wave fails a server under load.
 g=decision(tick(g,5),{type:"start_growth_wave"});
 expect(g.campaign!.combinedStage!.currentRound!.fault!.restoredStep).toBeNull();
 expect(campaignGuidance(g).requirements).toHaveLength(calm);expect(row(g,"restored").met).toBe(false);
});
it("nests the prevention path's checks under its single chapter requirement",()=>{
 const m=campaignGuidance(prevented());
 expect(m.requirements.map(r=>r.id)).toEqual(["growth","outcome","milestone"]);
 expect(m.preventionChecks.map(r=>r.id)).toEqual(["incident","cash","admission","queues","healthy","app-inspection","db-inspection","observations","review"]);
 expect(campaignGuidance(newGame()).preventionChecks).toEqual([]);
});
it("preventive limit explains full-demand qualification and leaves removal actionable",()=>{
 const g=prevented(),m=campaignGuidance(g);expect(m.prevention).toBe(true);expect(m.notice).toBe("Traffic limiting prevents full-demand qualification. Remove the limit and serve the full 800 req/s to continue the prevention path.");expect(row(g,"admission").met).toBe(false);expect(row(g,"app-inspection").met).toBe(false);expect(applyAction(g,{type:"set_traffic_limit",enabled:false}).ok).toBe(true);
});
it("new inspections and observations update prevention without auto-completing it",()=>{
 let g=prevented();g=decision(g,{type:"incident_inspect",equipment:"app"});g=decision(g,{type:"incident_inspect",equipment:"db"});g=decision(g,{type:"set_traffic_limit",enabled:false});
 g=advanceSteps(g,2).state;expect(row(g,"observations").label).toBe("Stable observations: 2 / 5");expect(row(g,"db-inspection").met).toBe(true);expect(campaignGuidance(g).notice).toBeNull();
 expect(campaignGuidance(g).requirements.some(r=>r.id==="recovery")).toBe(false);expect(campaignGuidance(g).optional).toContain("both valid paths");
 g=advanceSteps(g,3).state;expect(campaignGuidance(g).pendingAction?.label).toBe("Review outcome");expect(g.campaign!.openingMilestone).toBeNull();expect(g.campaign!.openingRecovered).toBe(false);
 g=decision(g,{type:"acknowledge_prevention_review"});expect(campaignGuidance(g).pendingAction?.label).toBe("Complete Opening");expect(campaignGuidance(g).stage).toBe("Opening");expect(row(g,"recovery").met).toBe(true);expect(row(g,"review").met).toBe(true);expect(row(g,"milestone").met).toBe(false);
});
it("Scaling exposes purchased headroom readiness separately from consumed growth",()=>{
 const g=scaling();expect(row(g,"headroom").met).toBe(false);expect(row(g,"growth").met).toBe(false);expect(campaignGuidance(g).waiting).toBeNull();
 const ready=advanceSteps(decision(g,{type:"start_db_upgrade"}),3).state;expect(row(ready,"headroom").met).toBe(true);expect(campaignGuidance(ready).waiting).toBeNull();
 const copy=structuredClone(ready);copy.campaign!.scaling!.dueStep=999999;expect(campaignGuidance(copy)).toEqual(campaignGuidance(ready));
});
it.each(["management","incident","queues","reports"])("Scaling explains missing %s readiness/continuation",id=>{
 const g=scaling();g.campaign!.scaling!.consumed=true;
 if(id==="management")g.phase="review";
 if(id==="incident")g.campaign!.incident=advanceSteps(newGame(),6).state.campaign!.incident;
 if(id==="queues")g.campaign!.apps[0].backlog=1;
 if(id==="reports")g.campaign!.trace=g.campaign!.trace.filter(t=>t.type!=="review-acknowledged");
 expect(row(g,id).met).toBe(false);expect(campaignGuidance(g).dataAvailable).toBe(canEnterData(g));expect(campaignGuidance(g).pendingAction?.action?.type).not.toBe("enter_data");
});
it.each(["growth","cash","milestone","management","incident","queues","reports","healthy"])("Data exposes its real missing %s gate",id=>{
 const g=dataCompany();
 if(id==="growth")g.campaign!.dataStage!.consumed=false;
 if(id==="cash")g.campaign!.cashCents=0;
 if(id==="milestone")g.campaign!.openingMilestone!.acknowledged=false;
 if(id==="management")g.phase="review";
 if(id==="incident")g.campaign!.incident=advanceSteps(newGame(),6).state.campaign!.incident;
 if(id==="queues")g.campaign!.dbBacklog=1;
 if(id==="reports")g.campaign!.trace=g.campaign!.trace.filter(t=>t.type!=="review-acknowledged");
 if(id==="healthy")g.campaign!.snapshot.latencyMs=500;
 expect(row(g,id).met).toBe(false);expect(campaignGuidance(g).spikesAvailable).toBe(canEnterSpikes(g));expect(campaignGuidance(g).pendingAction?.action?.type).not.toBe("enter_spikes");
});
it("Data optional investments and contrast are never mandatory",()=>{
 const g=dataCompany();g.campaign!.readCache=null;g.campaign!.dataStage!.contrastConsumed=false;
 expect(campaignGuidance(g).pendingAction?.action?.type).toBe("enter_spikes");expect(campaignGuidance(g).requirements.some(r=>/cache|contrast|upgrade/i.test(r.label))).toBe(false);expect(campaignGuidance(g).optional).toContain("optional");
});
it("Data omits generic waiting copy but explains blocked readiness",()=>{
 const g=dataCompany();g.campaign!.dataStage!.consumed=false;g.campaign!.dataStage!.dueStep=999999;
 expect(campaignGuidance(g).waiting).toBeNull();expect(JSON.stringify(campaignGuidance(g))).not.toContain("999999");
 g.campaign!.dbBacklog=1;expect(campaignGuidance(g).waiting).toBeNull();expect(campaignGuidance(g).notice).toContain("empty queues");
});
it("Spikes observes completion and acknowledgement without requiring automation",()=>{
 let g=untilOffset(preparedSpikes(),68);
 expect(row(g,"pulses").met).toBe(true);expect(row(g,"observations").label).toBe("Stable baseline observations: 1 / 5");expect(campaignGuidance(g).pendingAction).toBeNull();expect(campaignGuidance(g).optional).toContain("optional");
 g=tick(g,4);expect(campaignGuidance(g).pendingAction?.label).toBe("Review spike recognition");expect(g.campaign!.spikeStage!.acknowledged).toBe(false);
 g=act(g,{type:"acknowledge_spikes"});expect(row(g,"recognition").met).toBe(true);expect(campaignGuidance(g).notice).toContain("available through Next in the chapter bar");
});
it("Spikes future timing never enters guidance",()=>{
 const g=spikeCompany(false);g.campaign!.spikeStage!.deadlines=[991111,992222,993333,994444];expect(JSON.stringify(campaignGuidance(g))).not.toMatch(/991111|992222|993333|994444/);expect(row(g,"pulses").met).toBe(false);
});
it("missing inactive review is diagnosed rather than silently repaired",()=>{
 const g=recovered();g.phase="management";expect(campaignGuidance(g).notice).toContain("no review is active");expect(campaignGuidance(g).pendingAction).toBeNull();expect(g.campaign!.openingMilestone).toBeNull();
});
it("ended companies offer evidence/restart guidance without continuation",()=>{
 const g=scaling();g.phase="ended";expect(campaignGuidance(g).pendingAction).toBeNull();expect(campaignGuidance(g).notice).toContain("bankrupt");
});
it.each([newGame(),prevented(),recovered(),scaling(),dataCompany(),spikeCompany(false)])("guidance is pure, reload-equivalent and does not disable interventions",g=>{
 const before=JSON.stringify(g),availability=applyAction(g,{type:"set_traffic_limit",enabled:g.campaign!.limit===null}).ok;
 const m=campaignGuidance(g);expect(campaignGuidance(JSON.parse(before))).toEqual(m);expect(JSON.stringify(g)).toBe(before);expect(applyAction(g,{type:"set_traffic_limit",enabled:g.campaign!.limit===null}).ok).toBe(availability);
});

it.each(["management","incident","queues","reports","baseline","healthy"])("Spikes explains missing %s completion state",id=>{
 const g=untilOffset(act(spikeCompany(false),{type:"set_traffic_limit",enabled:true}),68);
 if(id==="management")g.phase="review";
 if(id==="incident")g.campaign!.incident=advanceSteps(newGame(),6).state.campaign!.incident;
 if(id==="queues")g.campaign!.dbBacklog=1;
 if(id==="reports")g.campaign!.trace=g.campaign!.trace.filter(t=>t.type!=="review-acknowledged");
 if(id==="baseline")g.campaign!.incomingRate=4000;
 if(id==="healthy")g.campaign!.snapshot.serviceErrorRate=0.01;
 expect(row(g,id).met).toBe(false);expect(campaignGuidance(g).pendingAction?.label).not.toBe("Review spike recognition");
});

it("cash-constrained headroom explains affordability without inventing a bailout or new gate",()=>{
 const g=scaling();g.campaign!.cashCents=1;const before=JSON.stringify(g);expect(campaignGuidance(g).notice).toContain("current cash cannot fund that investment");expect(row(g,"headroom").met).toBe(false);expect(JSON.stringify(g)).toBe(before);
});
it("acknowledged Opening with missing Scaling entry exposes the existing explicit continuation",()=>{
 const g=scaling();g.campaign!.scaling=null;const m=campaignGuidance(g);expect(m.pendingAction?.action?.type).toBe("enter_scaling");expect(m.stage).toBe("Opening");expect(row(g,"opening").met).toBe(true);expect(m.requirements.some(r=>r.id==="stage"||r.id==="headroom")).toBe(false);expect(m.notice).toContain("Continue to Scaling & Routing through Next");
});

it("explains a public-action solvent affordability trap without claiming a guaranteed rescue",()=>{
 let g=scaling();g=decision(g,{type:"set_traffic_limit",enabled:true});
 while(g.campaign!.step<300)g=advanceSteps(g,1).state;
 g=advanceSteps(decision(g,{type:"add_server"}),2).state;g=advanceSteps(decision(g,{type:"scale_up",appId:"app-1"}),3).state;
 expect(g.phase).toBe("management");expect(g.campaign!.cashCents).toBe(159334);expect(applyAction(g,{type:"start_db_upgrade"}).ok).toBe(false);
 expect(campaignGuidance(g).notice).toContain("Solvency alone does not guarantee");
 g=decision(g,{type:"set_traffic_limit",enabled:false});while(g.campaign!.step<420)g=advanceSteps(g,1).state;
 expect(g.campaign!.cashCents).toBeGreaterThan(0);expect(g.campaign!.snapshot.admitted).toBe(800);expect(g.campaign!.settlements.at(-1)!.netCents).toBe(-10000);expect(canEnterData(g)).toBe(false);
});
