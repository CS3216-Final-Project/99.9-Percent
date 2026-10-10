import {it,expect} from "vitest";
import {campaignGuidance} from "./campaignGuidance";
import {newGame,applyAction,type GameState,type Action} from "../sim";
import {advanceSteps,canEnterData} from "../sim/step";
import {canEnterSpikes} from "../sim/autoscaling";
import {dataCompany,spikeCompany,untilOffset,act,tick} from "../sim/__tests__/spikeFixtures";
function decision(g:GameState,a:Action){const r=applyAction(g,a);if(!r.ok)throw Error(r.message);return r.state;}
function recovered(){return advanceSteps(decision(advanceSteps(newGame(),6).state,{type:"start_db_upgrade"}),30).state;}
function scaling(){return decision(decision(recovered(),{type:"acknowledge_review"}),{type:"acknowledge_milestone"});}
function prevented(){return advanceSteps(decision(decision(newGame(),{type:"set_traffic_limit",enabled:true}),{type:"start_db_upgrade"}),4).state;}
function row(g:GameState,id:string){return campaignGuidance(g).requirements.find(r=>r.id===id)!;}
it("initial growth waiting does not expose a scheduled deadline",()=>{
 const m=campaignGuidance(newGame());expect(m.waiting).toContain("Waiting for the next company growth event");expect(m.pendingAction).toBeNull();expect(m.incomplete.map(r=>r.id)).toContain("growth");
});
it("active Opening incident requires recovery and hides all prevention requirements",()=>{
 const g=advanceSteps(newGame(),6).state,m=campaignGuidance(g);expect(m.prevention).toBe(false);expect(row(g,"recovery").met).toBe(false);expect(m.pendingAction).toBeNull();expect(m.requirements.some(r=>r.id==="admission")).toBe(false);
});
it("reactive report then milestone actions require explicit acknowledgement",()=>{
 let g=recovered();expect(campaignGuidance(g).pendingAction?.label).toBe("Review postmortem");expect(row(g,"recovery").met).toBe(true);expect(row(g,"review").met).toBe(false);
 g=decision(g,{type:"acknowledge_review"});expect(campaignGuidance(g).pendingAction?.label).toBe("Complete Opening");expect(row(g,"review").met).toBe(true);expect(g.campaign!.scaling).toBeNull();
 g=decision(g,{type:"acknowledge_milestone"});expect(campaignGuidance(g).stage).toBe("Scaling & Routing");
});
it("preventive limit explains full-demand qualification and leaves removal actionable",()=>{
 const g=prevented(),m=campaignGuidance(g);expect(m.prevention).toBe(true);expect(m.notice).toBe("Traffic limiting prevents full-demand qualification. Remove the limit and serve the full 800 req/s to continue the prevention path.");expect(row(g,"admission").met).toBe(false);expect(row(g,"app-inspection").met).toBe(false);expect(applyAction(g,{type:"set_traffic_limit",enabled:false}).ok).toBe(true);
});
it("new inspections and observations update prevention without auto-completing it",()=>{
 let g=prevented();g=decision(g,{type:"incident_inspect",equipment:"app"});g=decision(g,{type:"incident_inspect",equipment:"db"});g=decision(g,{type:"set_traffic_limit",enabled:false});
 g=advanceSteps(g,2).state;expect(row(g,"observations").label).toBe("Stable observations: 2 / 5");expect(row(g,"db-inspection").met).toBe(true);expect(campaignGuidance(g).notice).toBeNull();
 g=advanceSteps(g,3).state;expect(campaignGuidance(g).pendingAction?.label).toBe("Review outcome");expect(g.campaign!.openingMilestone).toBeNull();expect(g.campaign!.openingRecovered).toBe(false);
 g=decision(g,{type:"acknowledge_prevention_review"});expect(campaignGuidance(g).pendingAction?.label).toBe("Complete Opening");
});
it("Scaling exposes purchased headroom readiness separately from consumed growth",()=>{
 const g=scaling();expect(row(g,"headroom").met).toBe(false);expect(row(g,"growth").met).toBe(false);expect(campaignGuidance(g).waiting).toBeNull();
 const ready=advanceSteps(decision(g,{type:"start_db_upgrade"}),3).state;expect(row(ready,"headroom").met).toBe(true);expect(campaignGuidance(ready).waiting).toContain("Waiting for the next company growth event");
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
it("Data waiting wording hides due step and explains readiness",()=>{
 const g=dataCompany();g.campaign!.dataStage!.consumed=false;g.campaign!.dataStage!.dueStep=999999;
 expect(campaignGuidance(g).waiting).toContain("Waiting for the next company growth event");expect(JSON.stringify(campaignGuidance(g))).not.toContain("999999");
 g.campaign!.dbBacklog=1;expect(campaignGuidance(g).waiting).toBeNull();expect(campaignGuidance(g).notice).toContain("empty queues");
});
it("Spikes observes completion and acknowledgement without requiring automation",()=>{
 let g=spikeCompany(false);g=act(g,{type:"set_traffic_limit",enabled:true});g=untilOffset(g,68);
 expect(row(g,"pulses").met).toBe(true);expect(row(g,"observations").label).toBe("Stable baseline observations: 1 / 5");expect(campaignGuidance(g).pendingAction).toBeNull();expect(campaignGuidance(g).optional).toContain("optional");
 g=tick(g,4);expect(campaignGuidance(g).pendingAction?.label).toBe("Review spike recognition");expect(g.campaign!.spikeStage!.acknowledged).toBe(false);
 g=act(g,{type:"acknowledge_spikes"});expect(row(g,"recognition").met).toBe(true);expect(campaignGuidance(g).notice).toContain("not implemented");
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
 const g=scaling();g.campaign!.scaling=null;expect(campaignGuidance(g).pendingAction?.action?.type).toBe("enter_scaling");expect(row(g,"stage").met).toBe(false);
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
