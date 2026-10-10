// @vitest-environment node
import {it,expect} from "vitest";
import {newGame,applyAction} from "../index";
import {readyReliability,reliabilityCompany,preparedReliability,act,tick} from "./reliabilityFixture";
import {researchBalance,pendingReliability} from "../reliability";
import {makeEnvelope,validateEnvelope} from "../../game/saveMigrations";
import {has,completedTechIds,techStatus} from "../tech";
it("entry preserves company and grants the bounded research once",()=>{
 const before=readyReliability(),s=act(before,{type:"enter_reliability"}),c=s.campaign!;
 expect(c.runId).toBe(before.campaign!.runId);expect(c.cashCents).toBe(before.campaign!.cashCents);expect(c.snapshot).toEqual(before.campaign!.snapshot);expect(c.pending).toEqual(before.campaign!.pending);expect(c.reliabilityStage!.owned).toEqual([]);expect(researchBalance(c)).toBe(4);expect(applyAction(s,{type:"enter_reliability"}).ok).toBe(false);
});
it("locks reliability before entry and failover without real prerequisites",()=>{
 expect(applyAction(newGame(),{type:"unlock_reliability",tech:"health_checks"}).ok).toBe(false);
 const s=reliabilityCompany();expect(applyAction(s,{type:"unlock_reliability",tech:"auto_failover"}).ok).toBe(false);expect(applyAction(s,{type:"deploy_health_checks"}).ok).toBe(false);
});
it("unique unlocks cost one point, zero time/cash and leave previous ownership intact",()=>{
 const s=reliabilityCompany(),before=completedTechIds(s),n=act(s,{type:"unlock_reliability",tech:"health_checks"});
 expect(researchBalance(n.campaign!)).toBe(3);expect(n.campaign!.step).toBe(s.campaign!.step);expect(n.cash).toBe(s.cash);expect(completedTechIds(n)).toEqual([...before,"health_checks"]);expect(applyAction(n,{type:"unlock_reliability",tech:"health_checks"}).ok).toBe(false);expect(has(n,"larger_database")).toBe(true);expect(techStatus(n,"larger_database")).toBe("done");
});
it("arms greatest routed ID, starts at +8 and naturally restores at +28 without retargeting",()=>{
 let s=act(reliabilityCompany(),{type:"arm_reliability"});const f=s.campaign!.reliabilityStage!.fault!;expect(f.targetId).toBe("app-3");s=tick(s,7);expect(s.campaign!.apps[2].health).toBe("healthy");s=tick(s);expect(s.campaign!.apps[2].health).toBe("failed");expect(s.campaign!.snapshot.reliability!.failedDeliveries).toBe(800);
 for(let i=0;i<20;i++){if(s.phase==="review")s=act(s,{type:"acknowledge_review"});s=tick(s);}expect(s.campaign!.reliabilityStage!.fault!.restoredStep).toBe(f.naturalStep);expect(s.campaign!.apps[2].health).toBe("healthy");
});
it("health probes detect one step later and failover promotes one more step later without new capacity",()=>{
 let s=act(preparedReliability(),{type:"arm_reliability"});const installed=s.campaign!.apps.map(a=>a.id);s=tick(s,8);expect(s.campaign!.apps[1].health).toBe("failed");expect(s.campaign!.apps[1].detectedHealth).toBe("healthy");expect(s.campaign!.snapshot.reliability!.failedDeliveries).toBe(1200);
 s=tick(s);expect(s.campaign!.apps[1].detectedHealth).toBe("unhealthy");expect(s.campaign!.snapshot.reliability!.effective).toEqual(["app-1"]);expect(s.campaign!.pending.some(a=>a.type==="promote-spare")).toBe(true);
 s=tick(s);expect(s.campaign!.routing.targets).toEqual(["app-1","app-3"]);expect(s.campaign!.apps.map(a=>a.id)).toEqual(installed);expect(s.campaign!.reliabilityStage!.spareId).toBeNull();expect(s.campaign!.snapshot.reliability!.healthyRoutedCapacity).toBe(3200);
});
it("manual routing supersedes an accepted promotion without overriding the player",()=>{
 let s=tick(act(preparedReliability(),{type:"arm_reliability"}),9);s=act(s,{type:"set_routing",mode:"balanced",targets:["app-1"]});expect(s.campaign!.pending.some(a=>a.type==="promote-spare")).toBe(false);expect(s.campaign!.trace.some(t=>t.type==="failover-cancelled")).toBe(true);s=tick(s);expect(s.campaign!.routing.targets).toEqual(["app-1"]);
});
it("manual inspection detects only the selected actual app without time or hidden routing",()=>{
 const s=tick(act(reliabilityCompany(),{type:"arm_reliability"}),8),n=act(s,{type:"incident_inspect",equipment:"app",appId:"app-3"});expect(n.campaign!.step).toBe(s.campaign!.step);expect(n.campaign!.apps[2].detectedHealth).toBe("unhealthy");expect(n.campaign!.apps[1].detectedHealth).toBe("unknown");expect(n.campaign!.routing).toEqual(s.campaign!.routing);
});
it("manual restoration remains free and measured report/outcome acknowledgement is mandatory",()=>{
 let s=tick(act(reliabilityCompany(),{type:"arm_reliability"}),10);expect(s.phase).toBe("incident");const cash=s.campaign!.cashCents;s=act(s,{type:"restore_app",appId:"app-3"});expect(s.campaign!.cashCents).toBe(cash);s=tick(s,3);expect(s.phase).toBe("incident");expect(s.campaign!.apps[2].health).toBe("healthy");for(let i=0;i<10&&s.phase!=="review";i++)s=tick(s);expect(s.phase).toBe("review");expect(s.campaign!.reports.at(-1)!.explanations.join(" ")).toContain("creates no capacity");s=act(s,{type:"acknowledge_review"});s=tick(s,5);expect(pendingReliability(s.campaign)).toBe(true);expect(tick(s)).toEqual(s);s=act(s,{type:"acknowledge_reliability"});expect(s.campaign!.reliabilityStage!.acknowledged).toBe(true);
});
it("conserves failed deliveries and charges existing installed infrastructure",()=>{
 let s=act(reliabilityCompany(),{type:"arm_reliability"});for(let i=0;i<13;i++){s=tick(s);const c=s.campaign!;expect(c.cumulative.admitted).toBe(c.cumulative.successful+c.cumulative.failed+c.dbBacklog+c.apps.reduce((n,a)=>n+a.backlog,0));}expect(s.campaign!.ledger.appNumerator).toBeGreaterThan(0);
});
it("new spare is a real paid unrouted instance and keeps research ownership after release",()=>{
 let s=act(reliabilityCompany(),{type:"unlock_reliability",tech:"standby"});const cash=s.campaign!.cashCents;s=act(s,{type:"install_spare"});expect(s.campaign!.cashCents).toBe(cash-100000);s=tick(s,2);expect(s.campaign!.apps[3]).toMatchObject({role:"spare",routed:false,capacity:1000});s=tick(act(s,{type:"release_spare"}),1);expect(has(s,"standby")).toBe(true);expect(s.campaign!.reliabilityStage!.spareId).toBeNull();
});
it("schema 6 validates and deterministic serialization preserves every fault/probe/promotion boundary",()=>{
 let s=act(preparedReliability(),{type:"arm_reliability"});for(let i=0;i<40&&!pendingReliability(s.campaign);i++){expect(validateEnvelope(makeEnvelope(s)).status,`step ${s.campaign!.step}`).toBe("ok");expect(tick(JSON.parse(JSON.stringify(s)))).toEqual(tick(s));if(s.phase==="review")s=act(s,{type:"acknowledge_review"});s=tick(s);}
});

it("freezes retained failed queues and cannot recover by discarding unfinished work",()=>{
 let s=tick(act(reliabilityCompany(),{type:"arm_reliability"}),7);s.campaign!.apps[2].backlog=35;s.campaign!.cumulative.admitted+=35;s=tick(s,3);expect(s.campaign!.apps[2].backlog).toBe(35);expect(s.campaign!.snapshot.instances![2].processed).toBe(0);expect(s.campaign!.cumulative.admitted).toBe(s.campaign!.cumulative.successful+s.campaign!.cumulative.failed+s.campaign!.apps.reduce((n,a)=>n+a.backlog,0)+s.campaign!.dbBacklog);
});
it("checks with an empty effective route fail admitted requests once without NaN",()=>{
 let s=reliabilityCompany();s=act(s,{type:"unlock_reliability",tech:"health_checks"});s=tick(act(s,{type:"deploy_health_checks"}),2);s=tick(act(s,{type:"set_traffic_limit",enabled:true}),1);s=tick(act(s,{type:"set_routing",mode:"single",targets:["app-1"]}),1);s=tick(act(s,{type:"arm_reliability"}),9);expect(s.campaign!.snapshot.reliability!.effective).toEqual([]);expect(s.campaign!.snapshot.app.failed).toBe(500);expect(s.campaign!.snapshot.reliability!.unroutable).toBe(500);expect(validateEnvelope(makeEnvelope(s)).status).toBe("ok");
});
it("preserves deployed automation while suspending new decisions until acknowledgement",()=>{
 let s=act(readyReliability(true),{type:"enter_reliability"}),before=s.campaign!.spikeStage!.controller!;s=act(s,{type:"arm_reliability"});s=tick(s);const a=s.campaign!.spikeStage!.controller!;expect(a.enabled).toBe(before.enabled);expect(a.activatedStep).toBe(before.activatedStep);expect(a.blockedReason).toBe("Reliability test in progress");expect(a.highSteps).toBe(0);expect(s.campaign!.ledger.controllerNumerator).toBeGreaterThan(0);
});

it("natural restoration cancels an accepted promotion on the same physical step",()=>{
 let g=act(preparedReliability(),{type:"set_failover",enabled:false});g=tick(act(g,{type:"arm_reliability"}),26);
 g=act(g,{type:"set_failover",enabled:true});g=tick(g);
 expect(g.campaign!.pending.some(a=>a.type==="promote-spare")).toBe(true);
 g=tick(g);expect(g.campaign!.reliabilityStage!.fault!.restoreSource).toBe("natural");
 expect(g.campaign!.routing.targets).toEqual(["app-1","app-2"]);expect(g.campaign!.reliabilityStage!.spareId).toBe("app-3");
 expect(g.campaign!.trace.some(t=>t.type==="failover-cancelled")).toBe(true);expect(validateEnvelope(makeEnvelope(g)).status).toBe("ok");
});
it("disabling failover preserves an already accepted promotion",()=>{
 let g=tick(act(preparedReliability(),{type:"arm_reliability"}),9);g=act(g,{type:"set_failover",enabled:false});g=tick(g);
 expect(g.campaign!.routing.targets).toEqual(["app-1","app-3"]);expect(g.campaign!.reliabilityStage!.failover!.enabled).toBe(false);
});
it("late Health Checks deployment waits one more step for its first probe",()=>{
 let g=tick(act(reliabilityCompany(),{type:"arm_reliability"}),8);g=act(g,{type:"unlock_reliability",tech:"health_checks"});g=tick(act(g,{type:"deploy_health_checks"}),2);
 expect(g.campaign!.apps.find(a=>a.id==="app-3")!.detectedHealth).toBe("unknown");g=tick(g);
 expect(g.campaign!.apps.find(a=>a.id==="app-3")!.detectedHealth).toBe("unhealthy");
});

it("preserves an actual autoscaled target and transfers a reserved autoscaled spare out of retirement ownership",async()=>{
 const {spikeCompany,untilOffset}=await import("./spikeFixtures");const {canRetire}=await import("../autoscaling");
 let g=untilOffset(spikeCompany(true),18);expect(g.campaign!.actions.some(a=>a.type==="add-app"&&a.targetId==="app-3"&&a.source==="autoscaler")).toBe(true);
 g=tick(act(g,{type:"scale_up",appId:"app-3"}),3);
 for(let i=0;i<150&&g.campaign!.spikeStage!.completedStep===null;i++){if(g.phase==="review")g=act(g,{type:"acknowledge_review"});g=tick(g);}
 g=act(g,{type:"acknowledge_spikes"});g=act(g,{type:"enter_reliability"});
 const target=g.campaign!.routing.targets.at(-1)!;expect(g.campaign!.actions.some(a=>a.type==="add-app"&&a.targetId===target&&a.source==="autoscaler")).toBe(true);const armed=act(g,{type:"arm_reliability"});expect(armed.campaign!.reliabilityStage!.fault!.targetId).toBe(target);expect(canRetire(armed.campaign!,target)).toBe(false);
 g=tick(act(g,{type:"set_routing",mode:"balanced",targets:["app-1","app-2"]}),1);g=act(g,{type:"unlock_reliability",tech:"standby"});
 expect(g.campaign!.spikeStage!.controller!.managedAppIds).toContain(target);g=tick(act(g,{type:"reserve_spare",appId:target}),1);
 expect(g.campaign!.spikeStage!.controller!.managedAppIds).not.toContain(target);expect(g.campaign!.apps.find(a=>a.id===target)!.role).toBe("spare");expect(validateEnvelope(makeEnvelope(g)).status).toBe("ok");
});
it("settles exact partial checks/failover exposure including disabled failover without double charging",()=>{
 let g=act(preparedReliability(),{type:"set_failover",enabled:false});const c=g.campaign!,remaining=60-c.step%60;
 const checks=Math.floor(((c.ledger.checksNumerator??0)+(c.remainders.checks??0)+remaining*10000)/60);
 const failover=Math.floor(((c.ledger.failoverNumerator??0)+(c.remainders.failover??0)+remaining*10000)/60);
 g=tick(g,remaining);const settlement=g.campaign!.settlements.at(-1)!;expect(settlement.checksCents).toBe(checks);expect(settlement.failoverCents).toBe(failover);
 const count=g.campaign!.settlements.length;g=tick(g);expect(g.campaign!.settlements).toHaveLength(count);
});
