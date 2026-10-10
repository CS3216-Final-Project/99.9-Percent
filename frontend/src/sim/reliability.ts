import type { Action, ActionResult, GameState } from "./types";
import type { Campaign, AppInstance, ScheduledAction } from "./campaignTypes";
import { APPLICATION_RELIABILITY as R } from "./scenarios/applicationReliability";
import { clone } from "./state";
import { trace } from "./trace";
import { qualifiesForRecovery } from "./step";
export const reportsAcknowledged=(c:Campaign)=>c.reports.every(r=>c.trace.some(t=>t.type==="review-acknowledged"&&t.data.incidentId===r.id));
export const healthy=(a:AppInstance)=>a.health!=="failed";
export const serving=(a:AppInstance)=>a.role!=="spare";
export function researchBalance(c:Campaign):number {return (c.spikeStage?.researchEarned??0)+(c.reliabilityStage?.researchEarned??0)-(c.spikeStage?.researchSpent??0)-(c.reliabilityStage?.owned.length??0);}
export function pendingReliability(c:Campaign|undefined):boolean {return !!c?.reliabilityStage&&c.reliabilityStage.completedStep!==null&&!c.reliabilityStage.acknowledged;}
export function canEnterReliability(s:GameState):boolean {
 const c=s.campaign;return !!c?.spikeStage?.acknowledged&&c.spikeStage.completedStep!==null&&!c.reliabilityStage&&s.phase==="management"&&c.cashCents>0&&!c.incident&&!!c.openingMilestone?.acknowledged&&reportsAcknowledged(c)&&!c.dbBacklog&&c.apps.every(a=>!a.backlog)&&c.incomingRate===2400&&qualifiesForRecovery(c.snapshot);
}
export function effectiveTargets(c:Campaign):string[] {return c.routing.targets.filter(id=>{
 const a=c.apps.find(a=>a.id===id)!;return serving(a)&&!(c.reliabilityStage?.checksStep!==null&&c.reliabilityStage?.checksStep!==undefined&&c.loadBalancer&&a.detectedHealth==="unhealthy");
});}
export function initializeHealth(a:AppInstance,step:number):void {a.health="healthy";a.detectedHealth="unknown";a.healthChangedStep=step;a.detectedStep=null;a.role="serving";}
export function detect(c:Campaign,a:AppInstance,source:"manual"|"probe"):void {
 const health=healthy(a)?"healthy":"unhealthy";
 if(a.detectedHealth!==health){a.detectedHealth=health;a.detectedStep=c.step;trace(c,"health-change-detected",{appId:a.id,actualHealth:a.health??"healthy",detectedHealth:health,source,changedStep:a.healthChangedStep??0,delay:c.step-(a.healthChangedStep??0)});}
}
function restore(c:Campaign,source:"manual"|"natural"):void {
 const f=c.reliabilityStage!.fault!,a=c.apps.find(a=>a.id===f.targetId)!;
 if(f.restoredStep!==null)return;
 a.health="healthy";a.healthChangedStep=c.step;f.restoredStep=c.step;f.restoreSource=source;
 trace(c,"instance-restored",{appId:a.id,eventId:f.id,source,backlog:a.backlog});
}
export function advanceHealth(c:Campaign):void {
 const d=c.reliabilityStage;if(!d)return;const f=d.fault;
 if(f&&f.startedStep===null&&c.step>=f.startStep){const a=c.apps.find(a=>a.id===f.targetId)!;a.health="failed";a.healthChangedStep=c.step;f.startedStep=c.step;if(c.incident){c.incident.failureId=f.id;c.incident.components=[...new Set([...(c.incident.components??[]),a.id])];}trace(c,"reliability-failure-started",{eventId:f.id,appId:a.id});}
 if(f&&f.startedStep!==null&&f.restoredStep===null&&c.step>=f.naturalStep)restore(c,"natural");
 if(d.checksStep!==null&&c.step>d.checksStep)for(const a of c.apps)if(c.step>(a.healthChangedStep??0))detect(c,a,"probe");
}
function schedule(c:Campaign,type:ScheduledAction["type"],delay:number,costCents:number,extra:Partial<ScheduledAction>={}):void {
 const a:ScheduledAction={id:`action-${c.nextEventId}`,type,requestedStep:c.step,activationStep:c.step+delay,costCents,activatedStep:null,source:"player",...extra};
 c.cashCents-=costCents;c.investedCents+=costCents;c.pending.push(a);c.actions.push(clone(a));
 trace(c,"action-requested",{actionId:a.id,type,source:a.source!,costCents,activationStep:a.activationStep,targetId:a.targetId??null});
}
export function activateReliability(c:Campaign,a:ScheduledAction):boolean {
 const d=c.reliabilityStage!;
 if(a.type==="health-checks"){d.checksStep=c.step;c.apps.forEach(x=>{x.detectedHealth="unknown";x.detectedStep=null;});}
 if(a.type==="create-spare"){const app:AppInstance={id:a.targetId!,capacity:1000,backlog:0,routed:false,tier:"base",state:"active"};initializeHealth(app,c.step);app.role="spare";c.apps.push(app);c.overload[app.id]=0;d.spareId=app.id;}
 if(a.type==="reserve-spare"){
  const app=c.apps.find(x=>x.id===a.targetId)!;app.role="spare";d.spareId=app.id;
  const controller=c.spikeStage?.controller;if(controller){controller.managedAppIds=controller.managedAppIds.filter(id=>id!==app.id);if(controller.joiningAppId===app.id)controller.joiningAppId=null;}
  trace(c,"spare-reserved",{appId:app.id,source:"player",capacity:app.capacity});
 }
 if(a.type==="release-spare"){c.apps.find(x=>x.id===a.targetId)!.role="serving";d.spareId=null;}
 if(a.type==="failover")d.failover={activatedStep:c.step,enabled:true};
 if(a.type==="restore-app"){if(d.fault?.restoredStep===null)restore(c,"manual");else trace(c,"restoration-superseded",{actionId:a.id,targetId:a.targetId!});}
 if(a.type==="promote-spare"){
  const f=d.fault!,spare=c.apps.find(x=>x.id===a.targetId);
  const restoring=c.pending.some(x=>x.type==="restore-app"&&x.activationStep===c.step);
  if(f.restoredStep!==null||c.step>=f.naturalStep||restoring||!spare||!healthy(spare)||spare.backlog||spare.role!=="spare"||d.spareId!==spare.id||JSON.stringify(c.routing)!==a.expectedRouting||c.apps.find(x=>x.id===f.targetId)?.detectedHealth!=="unhealthy"){
   c.actions.find(x=>x.id===a.id)!.cancelledStep=c.step;trace(c,"failover-cancelled",{actionId:a.id,reason:"Restoration, spare or configured route changed"});return false;
  }
  spare.role="serving";d.spareId=null;c.routing={mode:"balanced",targets:[...c.routing.targets.filter(id=>c.apps.find(x=>x.id===id)!.detectedHealth!=="unhealthy"),spare.id].sort((x,y)=>Number(x.slice(4))-Number(y.slice(4)))};
  c.apps.forEach(x=>x.routed=c.routing.targets.includes(x.id));f.promoted=true;
  trace(c,"failover-activated",{actionId:a.id,eventId:f.id,appId:spare.id,configured:JSON.stringify(c.routing.targets),capacityCreated:0});
 }
 return true;
}
export function recoverySafe(c:Campaign):boolean {
 const f=c.reliabilityStage?.fault;if(!f||f.startedStep===null||f.restoredStep!==null)return true;
 return !effectiveTargets(c).includes(f.targetId)&&c.apps.find(a=>a.id===f.targetId)!.backlog===0;
}
export function observeReliability(s:GameState):void {
 const c=s.campaign!,d=c.reliabilityStage;if(!d||s.phase==="ended"||s.phase==="review")return;const f=d.fault;
 if(d.failover?.enabled&&d.checksStep!==null&&c.loadBalancer&&f?.startedStep!==null&&f&&f.restoredStep===null&&!f.promoted&&c.routing.targets.includes(f.targetId)&&c.apps.find(a=>a.id===f.targetId)!.detectedHealth==="unhealthy"&&!c.pending.some(a=>["routing","retire-app","promote-spare"].includes(a.type))){
  const spare=c.apps.find(a=>a.id===d.spareId);
  if(spare&&healthy(spare)&&!spare.backlog)schedule(c,"promote-spare",1,0,{source:"failover",targetId:spare.id,expectedRouting:JSON.stringify(c.routing),failureId:f.id});
 }
 if(f?.restoredStep!==null&&f&&d.completedStep===null){
  const ready=s.phase==="management"&&c.cashCents>0&&!c.incident&&!c.dbBacklog&&c.apps.every(a=>!a.backlog)&&reportsAcknowledged(c)&&qualifiesForRecovery(c.snapshot);
  d.stableSteps=ready?d.stableSteps+1:0;
  if(d.stableSteps===5){d.completedStep=c.step;trace(c,"reliability-stage-completed",{eventId:f.id,restoredStep:f.restoredStep!,limited:c.limit!==null,rejected:c.cumulative.rejected,setupCents:c.investedCents,incidentOccurred:c.trace.some(t=>t.type==="incident-opened"&&t.step>=f.startStep)});}
 }
}
export function reliabilityAction(prev:GameState,action:Action):ActionResult|null {
 if(!["enter_reliability","unlock_reliability","deploy_health_checks","install_spare","reserve_spare","release_spare","deploy_failover","set_failover","restore_app","arm_reliability","acknowledge_reliability"].includes(action.type))return null;
 const fail=(message:string):ActionResult=>({ok:false,reason:"invalid",message});
 if(prev.phase==="review"||prev.phase==="ended")return fail("Finish review before changing reliability.");
 const s=clone(prev),c=s.campaign!,d=c.reliabilityStage;
 if(action.type==="enter_reliability"){
  if(!canEnterReliability(prev))return fail("Requires acknowledged spike completion, stable baseline, empty queues and acknowledged reports.");
  c.apps.forEach(a=>{if(!a.health)initializeHealth(a,c.step);});
  c.reliabilityStage={id:R.id,version:R.version,configuration:JSON.stringify(R),enteredStep:c.step,researchEarned:3,owned:[],checksStep:null,failover:null,spareId:null,fault:null,failureSteps:0,stableSteps:0,completedStep:null,acknowledged:false};
  trace(c,"reliability-stage-entered",{stageId:R.id,stageVersion:1});trace(c,"reliability-research-awarded",{recognitionId:"reliability-readiness",research:3,balance:researchBalance(c)});return {ok:true,state:s};
 }
 if(!d)return fail("Enter Stay Online first.");
 if(action.type==="acknowledge_reliability"){
  if(!pendingReliability(c))return fail("No reliability outcome awaits acknowledgement.");d.acknowledged=true;const a=c.spikeStage?.controller;if(a){a.highSteps=0;a.lowSteps=0;a.cooldownUntil=c.step+4;}trace(c,"reliability-stage-acknowledged");return {ok:true,state:s};
 }
 if(pendingReliability(c))return fail("Review the reliability outcome first.");
 if(action.type==="unlock_reliability"){
  if(!["health_checks","standby","auto_failover"].includes(action.tech)||d.owned.includes(action.tech)||researchBalance(c)<1)return fail("Already owned or no research point available.");
  if(action.tech==="auto_failover"&&(!d.owned.includes("health_checks")||!d.owned.includes("standby")||!c.loadBalancer))return fail("Requires Health Checks, Spare Application and deployed Load Balancing.");
  const balance=researchBalance(c);d.owned.push(action.tech);trace(c,"reliability-tech-unlocked",{techId:action.tech,cost:1,balanceBefore:balance,balanceAfter:researchBalance(c)});return {ok:true,state:s};
 }
 if(action.type==="arm_reliability"){
  if(d.fault||prev.phase!=="management"||c.incident||c.cashCents<=0||c.pending.length||c.dbBacklog||c.apps.some(a=>a.backlog)||!reportsAcknowledged(c)||!qualifiesForRecovery(c.snapshot))return fail("The test requires stable management, empty queues and finished pending actions.");
  const target=c.apps.filter(a=>c.routing.targets.includes(a.id)&&healthy(a)&&serving(a)).sort((a,b)=>Number(b.id.slice(4))-Number(a.id.slice(4)))[0];if(!target)return fail("A healthy serving routing target is required.");
  d.fault={id:`failure-${c.nextEventId}`,targetId:target.id,armedStep:c.step,startStep:c.step+8,naturalStep:c.step+28,startedStep:null,restoredStep:null,restoreSource:null,promoted:false};trace(c,"reliability-failure-armed",{eventId:d.fault.id,appId:target.id,startStep:d.fault.startStep,naturalStep:d.fault.naturalStep});return {ok:true,state:s};
 }
 if(action.type==="set_failover"){if(!d.failover||d.failover.enabled===action.enabled)return fail("Failover is unavailable or already set.");d.failover.enabled=action.enabled;trace(c,action.enabled?"failover-enabled":"failover-disabled");return {ok:true,state:s};}
 const type=action.type==="deploy_health_checks"?"health-checks":action.type==="install_spare"?"create-spare":action.type==="reserve_spare"?"reserve-spare":action.type==="release_spare"?"release-spare":action.type==="deploy_failover"?"failover":"restore-app";
 if(c.pending.some(a=>!["limit","unlimit","routing","promote-spare"].includes(a.type)))return fail("An infrastructure action is pending.");
 const target=(action.type==="reserve_spare"||action.type==="restore_app")?c.apps.find(a=>a.id===action.appId):type==="release-spare"?c.apps.find(a=>a.id===d.spareId):undefined;
 if(type==="health-checks"&&(!d.owned.includes("health_checks")||d.checksStep!==null))return fail("Unlock Health Checks before deployment.");
 if(["create-spare","reserve-spare"].includes(type)&&(!d.owned.includes("standby")||d.spareId))return fail("Unlock Spare Application; only one spare may be reserved.");
 if(type==="create-spare"&&c.apps.length>=4)return fail("Four instances are already installed. Reserve a healthy unrouted app instead.");
 if(type==="reserve-spare"&&(!target||!healthy(target)||target.routed||target.backlog||c.pending.some(a=>a.targetId===target.id||a.routing?.targets.includes(target.id))))return fail("Reserve a healthy, unrouted, empty application without pending work.");
 if(type==="release-spare"&&(!target||c.pending.some(a=>a.type==="promote-spare"||a.targetId===target.id)))return fail("A free reserved spare is required.");
 if(type==="failover"&&(!d.owned.includes("auto_failover")||d.failover||d.checksStep===null||!c.loadBalancer||!d.spareId||!healthy(c.apps.find(a=>a.id===d.spareId)!)))return fail("Requires owned Failover, deployed checks/load balancer and a healthy real spare.");
 if(type==="restore-app"&&(!target||healthy(target)||target.id!==d.fault?.targetId))return fail("Select the actually failed application to restore.");
 const cost=type==="health-checks"?R.checksCostCents:type==="create-spare"?R.spareCostCents:type==="failover"?R.failoverCostCents:0;
 if(c.cashCents<=cost)return fail("This purchase would exhaust company cash.");
 schedule(c,type,type==="restore-app"?3:["reserve-spare","release-spare"].includes(type)?1:2,cost,{...(target?{targetId:target.id}:{}),...(type==="create-spare"?{targetId:`app-${c.nextAppNumber++}`}:{})});return {ok:true,state:s};
}
