// @vitest-environment node
import {it,expect} from "vitest";
import {act,tick,dataCompany,spikeCompany,untilOffset} from "./spikeFixtures";
import {canEnterSpikes,pendingSpikeAcknowledgement,canRetire} from "../autoscaling";
import {newGame,applyAction,has} from "../index";
import {makeEnvelope,validateEnvelope} from "../../game/saveEnvelope";
import {beginSession,emptyMeasurement,projectEvents} from "../../game/telemetry";
import {step} from "../step";

it("enters explicitly, preserves the whole company and grants forward research once",()=>{
 const old=dataCompany(),before=structuredClone(old.campaign!);expect(canEnterSpikes(old)).toBe(true);
 const g=act(old,{type:"enter_spikes"}),c=g.campaign!;expect(c.runId).toBe(before.runId);expect(c.apps).toEqual(before.apps);expect(c.pending).toEqual(before.pending);expect(c.cashCents).toBe(before.cashCents);expect(c.step).toBe(before.step);expect(c.ledger).toEqual(before.ledger);expect(c.snapshot).toEqual(before.snapshot);
 expect(applyAction(g,{type:"enter_spikes"}).ok).toBe(false);expect(has(g,"autoscaling")).toBe(false);
 const unlocked=act(g,{type:"unlock_autoscaling"});expect(has(unlocked,"autoscaling")).toBe(true);expect(applyAction(unlocked,{type:"unlock_autoscaling"}).ok).toBe(false);
 expect(applyAction(newGame(),{type:"enter_spikes"}).ok).toBe(false);expect(has(unlocked,"auto_failover")).toBe(false);
});
it.each([[7,2400],[8,4000],[27,4000],[28,2400],[47,2400],[48,4000],[67,4000],[68,2400]])("uses exact pulse boundary %i",(offset,traffic)=>{
 let g=spikeCompany(false);g=act(g,{type:"set_traffic_limit",enabled:true});g=untilOffset(g,offset);
 expect(g.campaign!.incomingRate).toBe(traffic);expect(validateEnvelope(makeEnvelope(g)).status).toBe("ok");
});
it("requires three high observations then three installation and one routing steps",()=>{
 let g=untilOffset(spikeCompany(),9);const c=g.campaign!,n=c.spikeStage!.enteredStep;expect(c.spikeStage!.controller!.highSteps).toBe(2);expect(c.apps).toHaveLength(2);
 g=tick(g);expect(g.campaign!.pending[0]).toMatchObject({type:"add-app",source:"autoscaler",requestedStep:n+10,activationStep:n+13});
 g=tick(g,2);expect(g.campaign!.apps).toHaveLength(2);g=tick(g);
 expect(g.campaign!.apps[2]).toMatchObject({id:"app-3",routed:false});expect(g.campaign!.snapshot.app.capacity).toBe(3200);expect(g.campaign!.pending[0]).toMatchObject({type:"routing",activationStep:n+14});
 g=tick(g);expect(g.campaign!.snapshot.app.capacity).toBe(4200);expect(g.campaign!.spikeStage!.controller!.cooldownUntil).toBe(n+18);
 g=tick(g,2);expect(g.campaign!.actions.filter(a=>a.source==="autoscaler"&&a.type==="add-app")).toHaveLength(1);
});
it("retirement needs six low safe observations, protects manual apps and never reuses IDs",()=>{
 let g=untilOffset(spikeCompany(),38);const c=g.campaign!,n=c.spikeStage!.enteredStep;expect(c.spikeStage!.controller!.lowSteps).toBe(5);expect(c.pending.some(a=>a.type==="retire-app")).toBe(false);
 expect(canRetire(c,"app-1")).toBe(false);g=tick(g);expect(g.campaign!.pending[0]).toMatchObject({type:"retire-app",targetId:"app-4",activationStep:n+40});
 const appCost=g.campaign!.ledger.appNumerator;g=tick(g);expect(g.campaign!.apps.map(a=>a.id)).toEqual(["app-1","app-2","app-3"]);expect(g.campaign!.ledger.appNumerator-appCost).toBe(290000);
 expect(validateEnvelope(makeEnvelope(g)).status).toBe("ok");g=untilOffset(g,54);expect(g.campaign!.apps.map(a=>a.id)).toContain("app-5");expect(g.campaign!.nextAppNumber).toBe(6);
});
it("refuses retirement with unfinished work and protects an accepted manual upgrade",()=>{
 let g=untilOffset(spikeCompany(),28);g.campaign!.apps[2].backlog=1;expect(canRetire(g.campaign!,"app-3")).toBe(false);
 g=untilOffset(spikeCompany(),28);g=act(g,{type:"scale_up",appId:"app-3"});expect(g.campaign!.spikeStage!.controller!.managedAppIds).not.toContain("app-3");
});
it("limits suppress triggers, and manual capacity can prevent incidents without buying automation",()=>{
 let g=spikeCompany();g=tick(act(g,{type:"set_traffic_limit",enabled:true}));g=untilOffset(g,20);expect(g.campaign!.actions.some(a=>a.source==="autoscaler"&&a.type==="add-app")).toBe(false);
 g=spikeCompany(false);g=tick(act(g,{type:"add_server"}),2);g=tick(act(g,{type:"set_routing",mode:"balanced",targets:["app-1","app-2","app-3"]}));g=tick(act(g,{type:"scale_up",appId:"app-3"}),3);
 g=untilOffset(g,27);expect(g.campaign!.incident).toBeNull();expect(g.campaign!.apps).toHaveLength(3);expect(g.campaign!.actions.some(a=>a.source==="autoscaler")).toBe(false);
});
it("autoscaling leaves write-heavy DB capacity and cache effectiveness unchanged",()=>{
 let g=untilOffset(spikeCompany(true,"write-heavy"),24);expect(g.campaign!.dbCapacity).toBe(3000);expect(g.campaign!.readCache!.target).toBe(6000);expect(g.campaign!.snapshot.data!.effectiveHitRateUsed).toBe(6000);
 expect(g.campaign!.snapshot.db.demand).toBeGreaterThan(3000);expect(g.campaign!.incident).not.toBeNull();
 g=act(g,{type:"set_traffic_limit",enabled:true});while(g.phase!=="review")g=tick(g);expect(g.campaign!.reports.at(-1)!.explanations.join(" ")).toContain("does not increase database capacity");
});
it("save/resume retains provisioning, routing, cooldown and deterministic continuation",()=>{
 let g=spikeCompany();for(let i=0;i<68;i++){
  if(pendingSpikeAcknowledgement(g.campaign!))break;
  if(g.phase==="review")g=act(g,{type:"acknowledge_review"});
  expect(validateEnvelope(makeEnvelope(g)).status).toBe("ok");const reloaded=JSON.parse(JSON.stringify(g));expect(step(reloaded)).toEqual(step(g));g=tick(g);
 }
});
it("spends setup exactly once and stops app upkeep at retirement",()=>{
 let g=spikeCompany();const baseline=g.campaign!.investedCents;
 g=untilOffset(g,14);expect(g.campaign!.investedCents-baseline).toBe(100000);expect(g.campaign!.ledger.controllerNumerator).toBe(13*10000);
 g=untilOffset(g,40);const c=g.campaign!;expect(c.apps).toHaveLength(3);expect(c.settlements.every(p=>p.netCents===p.revenueCents-p.appCents-p.dbCents-p.salaryCents-(p.lbCents??0)-(p.cacheCents??0)-(p.controllerCents??0))).toBe(true);
});
it("disable preserves accepted provisioning and prevents hidden routing",()=>{
 let g=untilOffset(spikeCompany(),10);const paid=g.campaign!.cashCents;g=act(g,{type:"set_autoscaling",enabled:false});g=tick(g,3);
 expect(g.campaign!.apps[2].routed).toBe(false);expect(g.campaign!.cashCents).toBe(paid);expect(g.campaign!.pending.some(a=>a.type==="routing")).toBe(false);expect(validateEnvelope(makeEnvelope(g)).status).toBe("ok");
});
it("completion and acknowledgement preserve identity and never re-award opening",()=>{
 let g=spikeCompany(false);g=tick(act(g,{type:"set_traffic_limit",enabled:true}));g=untilOffset(g,72);expect(pendingSpikeAcknowledgement(g.campaign!)).toBe(true);expect(step(g).state).toBe(g);
 const m=beginSession(emptyMeasurement(),g,"session","2026-10-10T00:00:00Z"),events=projectEvents(m,g,"2026-10-10T00:01:00Z");expect(events.pending.filter(e=>e.name==="run_completed_opening")).toHaveLength(1);expect(events.pending.filter(e=>e.name==="traffic_spike_stage_completed")).toHaveLength(1);
 const before=g.campaign!.cashCents,id=g.campaign!.runId;g=act(g,{type:"acknowledge_spikes"});expect(g.campaign!.cashCents).toBe(before);expect(g.campaign!.runId).toBe(id);expect(applyAction(g,{type:"acknowledge_spikes"}).ok).toBe(false);
});
it("automatic events never emit player decisions and projection retries deduplicate",()=>{
 const g=untilOffset(spikeCompany(),34),m=beginSession(emptyMeasurement(),g,"session","2026-10-10T00:00:00Z"),events=projectEvents(m,g,"2026-10-10T00:01:00Z");
 const ids=g.campaign!.actions.filter(a=>a.source==="autoscaler").map(a=>a.id);
 expect(events.pending.filter(e=>e.name==="gameplay_decision"&&ids.includes(String(e.payload.actionId)))).toHaveLength(0);
 expect(events.pending.find(e=>e.name==="autoscale_scale_out_decided")!.payload).toMatchObject({incoming:4000,highThresholdBasisPoints:8000,highSteps:3,stageId:"traffic-spikes",stageVersion:1});
 expect(events.pending.find(e=>e.name==="autoscale_provisioning_started")!.payload.actionSource).toBe("autoscaler");
 expect(events.pending.some(e=>e.name==="autoscale_routing_completed")).toBe(true);expect(projectEvents(events,g,"2026-10-10T00:01:01Z").pending).toEqual(events.pending);
});

it("strictly respects equality boundaries and the four-instance ceiling",async()=>{
 const {runAutoscaler}=await import("../autoscaling");
 let g=spikeCompany(),c=g.campaign!,a=c.spikeStage!.controller!;
 // Controlled completed observations isolate equality; no production scenario retuning.
 c.snapshot.instances!.forEach(x=>x.processed=x.capacity*0.8);
 for(let i=0;i<3;i++){c.step++;runAutoscaler(g);}expect(a.highSteps).toBe(0);expect(c.pending).toHaveLength(0);
 g=untilOffset(spikeCompany(),38);c=g.campaign!;a=c.spikeStage!.controller!;
 c.snapshot.instances!.forEach(x=>x.processed=x.capacity*0.6);
 for(let i=0;i<6;i++){c.step++;runAutoscaler(g);}expect(a.lowSteps).toBe(0);expect(c.pending.some(p=>p.type==="retire-app")).toBe(false);
 g=untilOffset(spikeCompany(),27);expect(g.campaign!.apps).toHaveLength(4);expect(g.campaign!.nextAppNumber).toBe(5);
 expect(applyAction(g,{type:"add_server"}).ok).toBe(false);
});
it("manual routing changes suspend automatic joining without hidden capacity",()=>{
 let g=untilOffset(spikeCompany(),10);g=act(g,{type:"set_routing",mode:"balanced",targets:["app-1"]});g=tick(g,3);
 expect(g.campaign!.apps.find(a=>a.id==="app-3")!.routed).toBe(false);expect(g.campaign!.pending.some(a=>a.type==="routing")).toBe(false);
 expect(g.campaign!.spikeStage!.controller!.blockedReason).toContain("Balanced routing");
});
it("retirement activation cancels if work appears or the next pulse would exceed headroom",()=>{
 let g=untilOffset(spikeCompany(),39);expect(g.campaign!.pending[0].type).toBe("retire-app");g.campaign!.apps.find(a=>a.id==="app-4")!.backlog=1;
 g=tick(g);expect(g.campaign!.apps).toHaveLength(4);expect(g.campaign!.actions.at(-1)!.cancelledStep).toBe(g.campaign!.step);expect(g.campaign!.spikeStage!.controller!.cooldownUntil).toBe(g.campaign!.step+4);
 g=untilOffset(spikeCompany(),39);g.campaign!.step=g.campaign!.spikeStage!.deadlines[2];
 expect(canRetire(g.campaign!,"app-4",false)).toBe(true);expect(canRetire(g.campaign!,"app-4",true)).toBe(false);
});
