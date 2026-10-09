// @vitest-environment node
import { describe, it, expect } from "vitest";
import { newGame, applyAction, type GameState, type Action } from "../index";
import { step, advanceSteps, allocateTraffic } from "../step";
import { makeEnvelope, validateEnvelope } from "../../game/saveMigrations";
import { beginSession, emptyMeasurement, projectEvents } from "../../game/telemetry";
function act(g:GameState,a:Action) {const r=applyAction(g,a);if(!r.ok)throw Error(r.message);return r.state;}
function ticks(g:GameState,n:number) {for(let i=0;i<n;i++)g=step(g).state;return g;}
function continuation() {
 let g=advanceSteps(newGame(3,"scaling"),6).state;
 g=act(g,{type:"start_db_upgrade"});g=advanceSteps(g,30).state;
 g=act(g,{type:"acknowledge_review"});return act(g,{type:"acknowledge_milestone"});
}
function headroom() {return ticks(act(continuation(),{type:"start_db_upgrade"}),3);}
/** 600-capacity examples are isolated engine fixtures, never production saves. */
function fixture(demand=900,two=false) {
 const g=newGame(),c=g.campaign!;c.incomingRate=demand;c.apps[0].capacity=600;c.dbCapacity=2000;
 if(two)c.apps.push({id:"app-2",tier:"base",state:"active",capacity:600,backlog:0,routed:false});
 return g;
}
describe("per-instance processing and routing",()=>{
 it("overloads a 600 app and installed idle capacity does not help",()=>{
  const one=step(fixture()).state.campaign!,two=step(fixture(900,true)).state.campaign!;
  expect(one.snapshot.app).toMatchObject({demand:900,processed:600,backlog:300});
  expect(two.snapshot.instances!.map(a=>a.demand)).toEqual([900,0]);
  expect(two.snapshot.installedAppCapacity).toBe(1200);expect(two.snapshot.effectiveAppCapacity).toBe(600);
  expect(two.snapshot.latencyMs).toBe(one.snapshot.latencyMs);
 });
 it.each([900,901,0])("allocates %s exactly in stable instance order",d=>{
  const g=fixture(d,true),c=g.campaign!;c.loadBalancer=true;c.routing={mode:"balanced",targets:["app-2","app-1"]};c.apps.forEach(a=>a.routed=true);c.apps.reverse();
  const m=step(g).state.campaign!.snapshot;
  expect(Object.fromEntries(m.instances!.map(a=>[a.id,a.demand]))).toEqual(allocateTraffic(d,["app-1","app-2"]));
  expect(m.instances!.reduce((n,a)=>n+a.demand,0)).toBe(d);
  expect(m.db.demand).toBe(d);
  expect(Number.isFinite(m.latencyMs)).toBe(true);expect(m.app.busyUtilisation).toBeLessThanOrEqual(1);
 });
 it("retains and drains backlog on its original now-unrouted instance",()=>{
  const g=fixture(300,true),c=g.campaign!;c.apps[0].backlog=1000;c.loadBalancer=true;c.routing={mode:"balanced",targets:["app-2"]};c.apps[0].routed=false;c.apps[1].routed=true;
  const next=step(g).state.campaign!;
  expect(next.apps.map(a=>a.backlog)).toEqual([400,0]);expect(next.snapshot.instances!.map(a=>a.processed)).toEqual([600,300]);
  expect(next.snapshot.db.demand).toBe(900);expect(next.snapshot.appBusyBudget).toBe(1200);expect(next.snapshot.effectiveAppCapacity).toBe(600);
 });
 it("conserves simultaneous overflow and DB drainage without dropping routing excess",()=>{
  const g=fixture(4000,true),c=g.campaign!;c.dbCapacity=600;c.dbBacklog=600;c.apps[0].backlog=1000;c.apps[1].backlog=1000;
  c.loadBalancer=true;c.routing={mode:"balanced",targets:c.apps.map(a=>a.id)};c.apps.forEach(a=>a.routed=true);
  const m=step(g).state.campaign!.snapshot;
  expect(2600+m.admitted).toBe(m.successful+m.failed+m.app.backlog+m.db.backlog);
  expect(m.db.demand).toBe(1200);expect(m.app.failed).toBe(2800);
 });
 it("keeps independent overload streaks and deterministically chooses simultaneous triggers",()=>{
  let g=fixture(),c=g.campaign!;
  c.overload={"app-1":2,db:0};c.dbCapacity=300;g=step(g).state;
  expect(g.campaign!.incident?.primaryComponent).toBe("app-1");
  g=fixture();c=g.campaign!;c.overload={"app-1":2,db:2};c.dbCapacity=300;g=step(g).state;
  expect(g.campaign!.incident?.components).toEqual(["app-1","db"]);
  g=fixture();c=g.campaign!;c.overload={"app-1":1,db:2};c.dbCapacity=1000;g=step(g).state;
  expect(g.campaign!.incident).toBeNull();expect(g.campaign!.overload).toEqual({"app-1":2,db:0});
 });
 it("detects per-instance overload despite sufficient aggregate capacity",()=>{
  const g=fixture(1400,true),c=g.campaign!;c.apps[0].capacity=1600;c.apps[1].capacity=600;c.loadBalancer=true;c.routing={mode:"balanced",targets:["app-1","app-2"]};c.apps.forEach(a=>a.routed=true);
  const next=ticks(g,3).campaign!;expect(next.snapshot.app.demandRatio).toBeLessThan(1);expect(next.incident?.primaryComponent).toBe("app-2");
 });
});
describe("continuous scaling campaign",()=>{
 it("enters after acknowledgement without resetting identity, money, limits or evidence",()=>{
  const g=continuation(),c=g.campaign!;expect(c.runId).toBe("scaling");expect(c.scaling).toMatchObject({version:1,enteredStep:c.step,dueStep:null,consumed:false});
  expect(c.dbCapacity).toBe(1000);expect(c.reports).toHaveLength(1);expect(c.investedCents).toBe(300000);
  expect(applyAction(g,{type:"enter_scaling"}).ok).toBe(false);
 });
 it("requires explicit sequential paid database headroom and fires growth exactly n+3",()=>{
  let g=continuation();g=ticks(g,4);expect(g.campaign!.incomingRate).toBe(800);expect(g.campaign!.scaling!.dueStep).toBeNull();
  const old=g.campaign!.cashCents;g=act(g,{type:"start_db_upgrade"});expect(g.campaign!.cashCents).toBe(old-300000);
  g=ticks(g,2);expect(g.campaign!.dbCapacity).toBe(1000);g=step(g).state;
  const due=g.campaign!.step+3;expect(g.campaign!.scaling!.dueStep).toBe(due);g=ticks(g,2);expect(g.campaign!.incomingRate).toBe(800);
  g=step(g).state;expect(g.campaign!.incomingRate).toBe(1400);g=ticks(g,6);
  expect(g.campaign!.trace.filter(t=>t.type==="traffic-change"&&t.data.eventId==="scaling-growth")).toHaveLength(1);
 });
 it("vertical upgrade changes only the selected instance at activation and recovers by measurement",()=>{
  let g=ticks(headroom(),6);expect(g.campaign!.incident?.primaryComponent).toBe("app-1");
  const before=g.campaign!.cashCents,db=g.campaign!.dbCapacity;
  g=act(g,{type:"scale_up",appId:"app-1"});expect(g.campaign!.cashCents).toBe(before-200000);
  expect(applyAction(g,{type:"scale_up",appId:"app-1"}).ok).toBe(false);g=ticks(g,2);expect(g.campaign!.apps[0].capacity).toBe(1000);
  g=step(g).state;expect(g.campaign!.apps[0].capacity).toBe(1600);expect(g.campaign!.dbCapacity).toBe(db);
  g=advanceSteps(g,40).state;expect(g.phase).toBe("review");expect(g.campaign!.reports.at(-1)!.explanations.join(" ")).toContain("app-1");
  expect(g.campaign!.reports.at(-1)!.explanations.join(" ")).toContain("contributed");expect(validateEnvelope(makeEnvelope(g)).status).toBe("ok");
 });
 it("horizontal installation and LB deployment do not balance until configuration activates",()=>{
  let g=ticks(headroom(),6);g=ticks(act(g,{type:"add_server"}),2);
  expect(g.campaign!.snapshot.instances!.map(a=>a.demand)).toEqual([1400,0]);expect(g.phase).toBe("incident");
  g=ticks(act(g,{type:"deploy_load_balancer"}),2);expect(g.campaign!.routing.mode).toBe("single");
  const backlog=g.campaign!.apps[0].backlog;g=act(g,{type:"set_routing",mode:"balanced",targets:["app-2","app-1"]});
  expect(g.campaign!.apps[0].backlog).toBe(backlog);g=step(g).state;
  expect(g.campaign!.snapshot.instances!.map(a=>a.demand)).toEqual([700,700]);expect(g.campaign!.apps[1].backlog).toBe(0);
  const copy=JSON.parse(JSON.stringify(g));expect(advanceSteps(copy,40)).toEqual(advanceSteps(g,40));
  g=advanceSteps(g,40).state;expect(g.phase).toBe("review");expect(validateEnvelope(makeEnvelope(g)).status).toBe("ok");
  const report=g.campaign!.reports.at(-1)!.explanations.join(" ");expect(report).toContain("remained unrouted");expect(report).toContain("Routing changed");
 });
 it("retains a traffic limit and reports prevention without manufacturing an incident",()=>{
  let g=headroom();g=act(g,{type:"set_traffic_limit",enabled:true});g=ticks(g,8);
  expect(g.campaign!.incomingRate).toBe(1400);expect(g.campaign!.snapshot.admitted).toBe(500);expect(g.campaign!.incident).toBeNull();expect(g.campaign!.reports).toHaveLength(1);
 });
 it("rejects invalid/pending targets, routing without LB, duplicate deployment and conflicting infrastructure",()=>{
  let g=headroom();expect(applyAction(g,{type:"set_routing",mode:"balanced",targets:["app-1"]}).ok).toBe(false);
  g=act(g,{type:"deploy_load_balancer"});expect(applyAction(g,{type:"add_server"}).ok).toBe(false);g=ticks(g,2);
  expect(applyAction(g,{type:"deploy_load_balancer"}).ok).toBe(false);
  for(const targets of [[],["app-2"],["app-1","app-1"]])expect(applyAction(g,{type:"set_routing",mode:"balanced",targets}).ok).toBe(false);
 });
 it("charges LB and upgraded app exposure from activation at step 60 exactly once",()=>{
  let g=headroom();g=act(g,{type:"set_traffic_limit",enabled:true});g=ticks(g,40-g.campaign!.step);
  g=ticks(act(g,{type:"scale_up",appId:"app-1"}),3);const upgrade=g.campaign!.step;
  g=ticks(g,58-g.campaign!.step);g=ticks(act(g,{type:"deploy_load_balancer"}),2);
  const c=g.campaign!,p=c.settlements[0];expect(p.lbCents).toBe(500);expect(p.appCents).toBe(Math.floor(((upgrade-1)*70000+(61-upgrade)*110000)/60));
  expect(p.netCents).toBe(p.revenueCents-p.appCents-p.dbCents-p.salaryCents-p.lbCents!);
  expect(validateEnvelope(makeEnvelope(g)).status).toBe("ok");
 });
 it("projects specialized telemetry once with target, request/activation timing and continuation",()=>{
  let g=headroom(),m=beginSession(emptyMeasurement(),g,"session","2026-10-10T00:00:00Z");
  g=ticks(act(g,{type:"scale_up",appId:"app-1"}),3);m=projectEvents(m,g,"2026-10-10T00:00:04Z");
  expect(m.pending.filter(e=>e.name==="vertical_scale_requested")).toHaveLength(1);expect(m.pending.filter(e=>e.name==="vertical_scale_activated")).toHaveLength(1);
  expect(m.pending.find(e=>e.name==="vertical_scale_activated")!.payload.targetId).toBe("app-1");
  expect(projectEvents(m,g,"2026-10-10T00:00:05Z")).toEqual(m);
 });
});

it("keeps a database bottleneck observable when app capacity increases",()=>{
 let g=continuation();g=ticks(act(g,{type:"scale_up",appId:"app-1"}),3);
 const c=g.campaign!;c.incomingRate=1400;g=ticks(g,3);
 expect(g.campaign!.incident?.primaryComponent).toBe("db");
 expect(g.campaign!.snapshot.db).toMatchObject({capacity:1000,demand:1400});
 expect(g.campaign!.snapshot.instances![0].demandRatio).toBeLessThan(1);
});
it("retains a scheduled growth deadline while queues prevent readiness across serialization",()=>{
 let g=headroom();const due=g.campaign!.scaling!.dueStep;
 g.campaign!.apps[0].backlog=1000;g=ticks(g,3);
 expect(g.campaign!.scaling).toMatchObject({dueStep:due,consumed:false});
 g=JSON.parse(JSON.stringify(g));g=ticks(g,3);
 expect(g.campaign!.incomingRate).toBe(1400);
 expect(g.campaign!.trace.filter(t=>t.data.eventId==="scaling-growth"&&t.type==="traffic-change")).toHaveLength(1);
});
