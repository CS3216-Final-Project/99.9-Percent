// @vitest-environment node
import {expect,it} from "vitest";
import {act,dataCompany,spikeCompany,tick,untilOffset} from "./spikeFixtures";
import {pendingSpikeAcknowledgement,pendingSpikeDebrief,spikeIncidentsSelfResolve} from "../autoscaling";
import {applyAction,type GameState} from "../index";
import {step} from "../step";
import {makeEnvelope,validateEnvelope} from "../../game/saveEnvelope";

/** Two 1,600 req/s servers serve 80% of a 4,000 req/s spike: a company that changes nothing fails every test. */
const graded=(auto=false,profile:"read-heavy"|"write-heavy"="read-heavy")=>spikeCompany(auto,profile,2);
/** A third large server before the practice spike: 4,800 req/s of routed capacity serves the whole spike. */
function prepared(g:GameState):GameState {
 const install=(action:Parameters<typeof act>[1],steps:number)=>{g=act(g,action);for(let i=0;i<steps;i++){g=tick(g);if(g.phase==="review")g=act(g,{type:"acknowledge_review"});}};
 install({type:"add_server"},2);install({type:"scale_up",appId:"app-3"},3);
 install({type:"set_routing",mode:"balanced",targets:["app-1","app-2","app-3"]},1);return g;
}
/** Plays until the chapter's recognition, reading every report and debrief on the way. */
function finish(g:GameState):GameState {
 for(let i=0;i<400&&!pendingSpikeAcknowledgement(g.campaign!);i++){
  expect(g.phase).not.toBe("ended");
  if(pendingSpikeDebrief(g.campaign!))g=act(g,{type:"acknowledge_spike_attempt"});
  if(g.phase==="review")g=act(g,{type:"acknowledge_review"});
  g=tick(g);
 }
 expect(pendingSpikeAcknowledgement(g.campaign!)).toBe(true);return g;
}

it("enters the graded chapter only when the input asks for it, with a spike sized for the workload",()=>{
 const original=spikeCompany(false).campaign!.spikeStage!;
 expect(original.version).toBe(1);expect(original).not.toHaveProperty("pulses");expect(original).not.toHaveProperty("peak");
 expect(graded().campaign!.spikeStage).toMatchObject({version:2,peak:4000,pulses:[]});
 const write=graded(false,"write-heavy");expect(write.campaign!.spikeStage!.peak).toBe(3400);
 expect(untilOffset(write,8).campaign!.incomingRate).toBe(3400);
});

it("grades the second spike, pauses on a failed test and schedules an identical retry",()=>{
 let g=untilOffset(graded(),47);
 expect(g.campaign!.spikeStage!.pulses).toEqual([expect.objectContaining({pulse:1,graded:false,result:"practice",reviewed:true})]);
 expect(pendingSpikeDebrief(g.campaign!)).toBeNull();
 g=untilOffset(g,68);
 const c=g.campaign!,n=c.spikeStage!.enteredStep,failed=pendingSpikeDebrief(c)!;
 expect(failed).toMatchObject({pulse:2,graded:true,result:"failed",reviewed:false,startStep:n+48,endStep:n+68,incoming:80000,rejected:0});
 expect(failed.served*10000).toBeLessThan(failed.incoming*9500);
 expect(failed.appOverloadSteps).toBe(20);expect(failed.dbOverloadSteps).toBe(0);
 expect(c.spikeStage!.deadlines.slice(4)).toEqual([n+88,n+108]);
 // The clock waits for the debrief; nothing else unblocks it.
 expect(step(g)).toEqual({state:g,stopReason:"spike-debrief"});
 g=act(g,{type:"acknowledge_spike_attempt"});
 expect(pendingSpikeDebrief(g.campaign!)).toBeNull();expect(applyAction(g,{type:"acknowledge_spike_attempt"}).ok).toBe(false);
 g=untilOffset(g,87);expect(g.campaign!.incomingRate).toBe(2400);
 g=untilOffset(g,88);expect(g.campaign!.incomingRate).toBe(4000);
 g=untilOffset(g,108);expect(pendingSpikeDebrief(g.campaign!)).toMatchObject({pulse:3,result:"failed"});
 expect(g.campaign!.spikeStage!.completedStep).toBeNull();
});

it("counts a traffic limit's rejected requests against the test, so limiting and waiting never passes",()=>{
 let g=tick(act(graded(),{type:"set_traffic_limit",enabled:true}));
 g=untilOffset(g,68);
 const p=pendingSpikeDebrief(g.campaign!)!;
 expect(p.failed).toBe(0);expect(p.rejected).toBeGreaterThan(p.incoming/2);
 // Retries run during [88, 108) and [128, 148).
 g=untilOffset(g,148,true);
 expect(g.campaign!.spikeStage!.pulses!.filter(x=>x.result==="failed")).toHaveLength(3);
 expect(pendingSpikeAcknowledgement(g.campaign!)).toBe(false);
});

it("finishes after a passed test and five stable baseline seconds",()=>{
 let g=prepared(graded());
 g=untilOffset(g,72);
 const c=g.campaign!,d=c.spikeStage!;
 expect(pendingSpikeAcknowledgement(c)).toBe(true);expect(d.completedStep).toBe(d.enteredStep+72);
 expect(d.pulses!.map(p=>p.result)).toEqual(["practice","passed"]);
 expect(c.trace.find(t=>t.type==="traffic-spike-stage-completed")!.data).toMatchObject({stageVersion:2,spikes:2,attempts:1});
 g=act(g,{type:"acknowledge_spikes"});expect(g.campaign!.spikeStage!.acknowledged).toBe(true);
});

it("passes a retry once the player fixes the bottleneck the failed test exposed",()=>{
 let g=untilOffset(graded(),68);
 g=prepared(act(g,{type:"acknowledge_spike_attempt"}));
 g=finish(g);
 const d=g.campaign!.spikeStage!;
 expect(d.pulses!.map(p=>p.result)).toEqual(["practice","failed","passed"]);
 expect(d.completedStep).toBe(d.enteredStep+112);
});

it.each(["read-heavy","write-heavy"] as const)("autoscaling alone passes the %s test",profile=>{
 const g=finish(graded(true,profile)),d=g.campaign!.spikeStage!;
 expect(d.pulses!.map(p=>p.result)).toEqual(["practice","passed"]);
 expect(g.campaign!.actions.some(a=>a.source==="autoscaler"&&a.type==="add-app")).toBe(true);
});

it("ends a company that goes bankrupt as a test fails, without a debrief that could never be read",()=>{
 // Cash settles every 60 seconds and spikes end every 40: entering at step 212 makes a settlement land on a spike's last second.
 let g=act(tick(dataCompany(),18),{type:"enter_spikes",version:2});
 expect(g.campaign!.spikeStage!.enteredStep).toBe(212);
 // An unrouted server keeps costing money while the limit turns the spikes away, so every test fails.
 g=tick(act(act(g,{type:"add_server"}),{type:"set_traffic_limit",enabled:true}));
 for(let i=0;i<400&&g.phase!=="ended";i++){
  if(pendingSpikeDebrief(g.campaign!))g=act(g,{type:"acknowledge_spike_attempt"});
  if(g.phase==="review")g=act(g,{type:"acknowledge_review"});
  g=tick(g);
 }
 const c=g.campaign!,d=c.spikeStage!;
 expect(g.outcome).toBe("bankrupt");
 expect(d.deadlines.filter((_,i)=>i%2)).toContain(c.step);
 expect(pendingSpikeDebrief(c)).toBeNull();
 expect(c.trace.filter(t=>t.step===c.step).map(t=>t.type)).not.toContain("traffic-spike-scheduled");
 expect(applyAction(g,{type:"acknowledge_spike_attempt"}).ok).toBe(false);
});

it("closes chapter incidents on stable service alone, without a recorded response",()=>{
 let g=untilOffset(graded(),12);
 expect(spikeIncidentsSelfResolve(g.campaign!)).toBe(true);
 expect(g.campaign!.incident).toMatchObject({responseDueFrom:undefined});
 const inputs=g.campaign!.inputs.length;
 for(let i=0;i<40&&g.phase!=="review";i++)g=tick(g);
 expect(g.phase).toBe("review");expect(g.campaign!.inputs).toHaveLength(inputs);
 // The original chapter keeps its rule: the same overload waits for a response.
 const original=untilOffset(spikeCompany(false),12);
 expect(original.campaign!.incident!.responseDueFrom).toBe(original.campaign!.incident!.openedStep);
});

it("asks for a recorded response again once the chapter is complete",()=>{
 let g=act(finish(prepared(graded())),{type:"acknowledge_spikes"});
 expect(spikeIncidentsSelfResolve(g.campaign!)).toBe(false);
 // Routing the 2,400 req/s baseline to one 1,600 req/s server overloads it.
 g=act(g,{type:"set_routing",mode:"single",targets:["app-1"]});
 for(let i=0;i<20&&!g.campaign!.incident;i++)g=tick(g);
 const incident=g.campaign!.incident!;
 expect(incident).not.toBeNull();expect(incident.responseDueFrom).toBe(incident.openedStep);
});

it("accepts the debrief while a postmortem from the same second waits",()=>{
 const g=untilOffset(graded(),68),c=g.campaign!;
 // An incident can recover on the very second a test ends; model that phase directly.
 const both:GameState={...structuredClone(g),phase:"review"};
 expect(c.reports.length).toBeGreaterThan(0);
 const read=act(both,{type:"acknowledge_spike_attempt"});
 expect(read.phase).toBe("review");expect(pendingSpikeDebrief(read.campaign!)).toBeNull();
});

it("save and replay preserve a retry's schedule, debrief and continuation",()=>{
 let g=untilOffset(graded(),68);
 const check=(x:GameState)=>{const loaded=validateEnvelope(makeEnvelope(x));expect(loaded.status).toBe("ok");if(loaded.status!=="ok")return;expect(loaded.game).toEqual(x);expect(step(loaded.game)).toEqual(step(x));};
 check(g);
 g=act(g,{type:"acknowledge_spike_attempt"});check(g);
 g=untilOffset(g,95);check(g);
 expect(g.campaign!.inputs.find(i=>i.action.type==="enter_spikes")!.action).toEqual({type:"enter_spikes",version:2});
},20_000);

it("rejects a debrief acknowledgement with nothing to review and leaves the company untouched",()=>{
 const g=act(dataCompany(),{type:"enter_spikes",version:2}),r=applyAction(g,{type:"acknowledge_spike_attempt"});
 expect(r.ok).toBe(false);
});
