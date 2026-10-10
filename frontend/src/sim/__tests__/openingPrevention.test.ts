import {describe,it,expect} from "vitest";
import {newGame,applyAction,type GameState,type Action} from "../index";
import {advanceSteps,step,enterScaling} from "../step";
import {preventionAvailable,preventionRequirements} from "../openingPrevention";
function act(g:GameState,a:Action){const r=applyAction(g,a);if(!r.ok)throw Error(r.message);return r.state;}
function tick(g:GameState,n=1){return advanceSteps(g,n).state;}
export function prepared(inspect=true) {
 let g=newGame(0,"prevention-test");g=act(g,{type:"set_traffic_limit",enabled:true});g=act(g,{type:"start_db_upgrade"});g=tick(g,4);
 if(inspect){g=act(g,{type:"incident_inspect",equipment:"app"});g=act(g,{type:"incident_inspect",equipment:"db"});}
 return act(g,{type:"set_traffic_limit",enabled:false});
}
describe("Opening prevention",()=>{
 it("is unavailable before growth and credits no pre-growth inspections",()=>{
  let g=newGame();g=act(g,{type:"incident_inspect",equipment:"app"});g=act(g,{type:"incident_inspect",equipment:"db"});expect(preventionAvailable(g.campaign!)).toBe(false);
  g=act(g,{type:"set_traffic_limit",enabled:true});g=tick(g,4);
  expect(preventionAvailable(g.campaign!)).toBe(true);expect(g.campaign!.openingPrevention).toMatchObject({appInspectedStep:null,dbInspectedStep:null,stableSteps:0});
 });
 it("permanently selects the reactive route when an incident opens, including after recovery",()=>{
  let g=tick(newGame(),6);expect(g.phase).toBe("incident");expect(preventionAvailable(g.campaign!)).toBe(false);
  g=tick(act(g,{type:"start_db_upgrade"}),30);expect(g.phase).toBe("review");expect(preventionAvailable(g.campaign!)).toBe(false);expect(g.campaign!.openingPrevention?.outcome).toBeNull();
 });
 it("limiting blocks healthy qualification",()=>{
  let g=prepared();g=tick(g);g=act(g,{type:"set_traffic_limit",enabled:true});g=tick(g,12);
  expect(g.campaign!.openingPrevention!.stableSteps).toBe(0);expect(g.campaign!.openingPrevention!.outcome).toBeNull();expect(preventionRequirements(g.campaign!).fullDemand).toBe(false);
 });
 it.each(["app","db"] as const)("requires explicit %s inspection",missing=>{
  let g=prepared(false);g=act(g,{type:"incident_inspect",equipment:missing==="app"?"db":"app"});g=tick(g,10);
  expect(g.campaign!.openingPrevention!.stableSteps).toBe(0);expect(g.campaign!.openingPrevention!.outcome).toBeNull();
 });
 it("records exactly five NEW observations, then pauses without fabricating incident recovery",()=>{
  const start=prepared(),before=structuredClone(start);const four=tick(start,4);
  expect(start).toEqual(before);expect(four.campaign!.openingPrevention!.stableSteps).toBe(4);expect(four.campaign!.openingPrevention!.outcome).toBeNull();
  const r=advanceSteps(four,100),c=r.state.campaign!;
  expect(r.stepsConsumed).toBe(1);expect(r.stopReason).toBe("prevention-review");expect(c.step).toBe(9);expect(c.openingPrevention!.outcome!.snapshots.map(m=>m.step)).toEqual([5,6,7,8,9]);
  expect(c.openingRecovered).toBe(false);expect(c.incident).toBeNull();expect(c.reports).toEqual([]);expect(c.trace.some(t=>t.type==="incident-recovered")).toBe(false);
  expect(advanceSteps(r.state,100).stepsConsumed).toBe(0);expect(step(r.state).state).toBe(r.state);expect(c.openingMilestone).toBeNull();
 });
 it("acknowledges prevention then the same milestone/Scaling transition without time or cash reward",()=>{
  const g=tick(prepared(),5),c=g.campaign!,before=structuredClone(g);
  expect(applyAction(g,{type:"acknowledge_milestone"}).ok).toBe(false);expect(applyAction(g,{type:"enter_scaling"}).ok).toBe(false);
  const reviewed=act(g,{type:"acknowledge_prevention_review"});expect(g).toEqual(before);
  expect(reviewed.campaign!.openingPrevention!.outcome!.acknowledged).toBe(true);expect(reviewed.campaign!.openingMilestone).toMatchObject({id:"opening-stability",incidentId:null,outcomeId:"opening-prevention",acknowledged:false});
  expect(applyAction(reviewed,{type:"acknowledge_prevention_review"}).ok).toBe(false);expect(enterScaling(reviewed)).toBe(reviewed);
  const done=act(reviewed,{type:"acknowledge_milestone"});expect(done.campaign!.scaling?.id).toBe("application-scaling");
  expect(done.campaign!.cashCents).toBe(c.cashCents);expect(done.campaign!.step).toBe(c.step);expect(done.campaign!.runId).toBe(c.runId);expect(done.campaign!.openingRecovered).toBe(false);expect(done.campaign!.reports).toEqual([]);
  expect(done.campaign!.trace.filter(t=>t.type==="milestone-awarded")).toHaveLength(1);expect(applyAction(done,{type:"acknowledge_milestone"}).ok).toBe(false);
 });
 it("rejects premature or reactive prevention acknowledgement",()=>{
  expect(applyAction(prepared(),{type:"acknowledge_prevention_review"}).ok).toBe(false);
  expect(applyAction(tick(newGame(),6),{type:"acknowledge_prevention_review"}).ok).toBe(false);
 });
 it("an unhealthy NEW observation resets the streak",()=>{
  let g=tick(prepared(),2);expect(g.campaign!.openingPrevention!.stableSteps).toBe(2);
  // Boundary fixture: queued work already exists, just as after a constrained step.
  g=structuredClone(g);g.campaign!.apps[0].backlog=1000;g=tick(g);
  expect(g.campaign!.snapshot.app.backlog).toBeGreaterThan(0);expect(g.campaign!.openingPrevention!.stableSteps).toBe(0);
 });
 it("bankruptcy resets the streak and never qualifies",()=>{
  let g=tick(prepared(),2);g=structuredClone(g);g.campaign!.cashCents=0;g=tick(g);
  expect(g.phase).toBe("ended");expect(g.campaign!.openingPrevention!.stableSteps).toBe(0);expect(g.campaign!.openingPrevention!.outcome).toBeNull();
 });
 it("requires actual full Opening demand, not just a healthy smaller workload",()=>{
  // Boundary fixture isolates admission magnitude after consumed growth.
  let g=tick(prepared(),2);g=structuredClone(g);g.campaign!.incomingRate=300;g=tick(g);
  expect(g.campaign!.openingPrevention!.stableSteps).toBe(0);
 });
 it("never counts inspection or acknowledgement as a physical observation",()=>{
  let g=prepared();const n=g.campaign!.step;for(let i=0;i<6;i++)g=act(g,{type:"incident_inspect",equipment:"app"});
  expect(g.campaign!.step).toBe(n);expect(g.campaign!.openingPrevention!.stableSteps).toBe(0);
 });
 it("preserves the existing reactive report/milestone path",()=>{
  let g=tick(newGame(),6);g=tick(act(g,{type:"start_db_upgrade"}),30);expect(g.campaign!.openingRecovered).toBe(true);expect(g.campaign!.reports).toHaveLength(1);
  const incidentId=g.campaign!.reports[0].id;g=act(g,{type:"acknowledge_review"});expect(g.campaign!.openingMilestone!.incidentId).toBe(incidentId);
  expect(g.campaign!.openingMilestone!.outcomeId).toBeUndefined();g=act(g,{type:"acknowledge_milestone"});expect(g.campaign!.scaling?.id).toBe("application-scaling");
 });
});
