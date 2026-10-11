import type { Action, ActionResult, GameState } from "./types";
import type { Campaign, ScheduledAction, SpikeObservation } from "./campaignTypes";
import { TRAFFIC_SPIKES as T } from "./scenarios/trafficSpikes";
import { OPENING_DB as Q } from "./scenarios/openingDatabaseIncident";
import { allocateTraffic, qualifiesForRecovery } from "./step";
import { clone } from "./state";
import { trace } from "./trace";

export function pendingSpikeAcknowledgement(c:Campaign|undefined):boolean {
 return !!c?.spikeStage && c.spikeStage.completedStep!==null && !c.spikeStage.acknowledged;
}
export function canEnterSpikes(s:GameState):boolean {
 const c=s.campaign;
 return !!c?.dataStage?.consumed && !c.spikeStage && s.phase==="management" && c.cashCents>0 &&
 !!c.openingMilestone?.acknowledged && !c.incident && c.dbBacklog===0 && c.apps.every(a=>a.backlog===0) &&
 qualifiesForRecovery(c.snapshot) && c.reports.every(r=>c.trace.some(t=>t.type==="review-acknowledged"&&t.data.incidentId===r.id));
}
export function spikeInput(c:Campaign, at=c.step):number {
 const d=c.spikeStage;if(!d)return c.incomingRate;
 return (at>=d.deadlines[0]&&at<d.deadlines[1])||(at>=d.deadlines[2]&&at<d.deadlines[3])?T.peak:T.baseline;
}
export function advanceSpikeTraffic(c:Campaign):void {
 const d=c.spikeStage;if(!d)return;
 for(let i=0;i<4;i++) {
  const id=`spike-${Math.floor(i/2)+1}-${i%2?"end":"start"}`;
  if(c.step>=d.deadlines[i]&&!d.consumed.includes(id)) {
   d.consumed.push(id);c.consumedEvents.push(id);const from=c.incomingRate;
   c.incomingRate=i%2?T.baseline:T.peak;
   trace(c,i%2?"traffic-spike-ended":"traffic-spike-started",{eventId:id,from,to:c.incomingRate,scheduledStep:d.deadlines[i],pulse:Math.floor(i/2)+1});
  }
 }
}
export function spikeObservation(c:Campaign):SpikeObservation {
 const a=c.spikeStage?.controller, xs=c.snapshot.instances?.filter(x=>x.routed)??[];
 const capacity=xs.reduce((n,x)=>n+x.capacity,0),work=xs.reduce((n,x)=>n+x.processed,0);
 return {activePulse:spikeInput(c)===T.peak?(c.step<c.spikeStage!.deadlines[1]?1:2):null,
 routedBusyBasisPoints:capacity?Math.floor(work*10000/capacity):0, installed:c.apps.length,routed:c.routing.targets.length,
 enabled:a?.enabled??false,highSteps:a?.highSteps??0,lowSteps:a?.lowSteps??0,cooldownUntil:a?.cooldownUntil??0,blockedReason:a?.blockedReason??null};
}
function infraBusy(c:Campaign):boolean {return c.pending.some(a=>!["limit","unlimit","routing"].includes(a.type));}
function schedule(c:Campaign, type:ScheduledAction["type"], delay:number, costCents:number, extra:Partial<ScheduledAction>={}):ScheduledAction {
 const action:ScheduledAction={id:`action-${c.nextEventId}`,type,requestedStep:c.step,activationStep:c.step+delay,costCents,activatedStep:null,source:"autoscaler",...extra};
 c.cashCents-=costCents;c.investedCents+=costCents;c.pending.push(action);c.actions.push(clone(action));
 trace(c,"action-requested",{actionId:action.id,type,source:action.source!,costCents,activationStep:action.activationStep,targetId:action.targetId??null,routing:action.routing?JSON.stringify(action.routing):null});
 return action;
}
function blocked(c:Campaign,reason:string|null):void {
 const a=c.spikeStage!.controller!;
 if(a.blockedReason!==reason){a.blockedReason=reason;trace(c,"autoscaler-blocked",{reason});}
 if(reason){a.highSteps=0;a.lowSteps=0;}
}
export function canRetire(c:Campaign,id:string,preview=false):boolean {
 const a=c.spikeStage?.controller, target=c.apps.find(x=>x.id===id);
 if(!a || !target || !a.managedAppIds.includes(id)||target.tier!=="base"||target.backlog || c.incident || c.dbBacklog || c.apps.some(x=>x.backlog) ||
 !qualifiesForRecovery(c.snapshot)||c.routing.mode!=="balanced"||c.apps.length-1<T.minimum)return false;
 const targets=c.routing.targets.filter(x=>x!==id);if(targets.length<T.minimum||targets.length===c.routing.targets.length)return false;
 let limit=c.limit;
 if(preview)for(const p of c.pending.filter(x=>x.activationStep===c.step)){if(p.type==="limit")limit=Q.admissionLimit;if(p.type==="unlimit")limit=null;}
 const demand=Math.min(preview?spikeInput(c):c.incomingRate,limit??Infinity),allocation=allocateTraffic(demand,targets);
 return targets.every(id=>allocation[id]*10000<=c.apps.find(x=>x.id===id)!.capacity*T.high);
}
export function activateRetirement(c:Campaign,action:ScheduledAction):boolean {
 const a=c.spikeStage!.controller!;
 const safe=canRetire(c,action.targetId!,true)&&JSON.stringify(c.routing)===a.expectedRouting;
 a.cooldownUntil=c.step+T.cooldown;a.highSteps=0;a.lowSteps=0;
 if(!safe){c.actions.find(x=>x.id===action.id)!.cancelledStep=c.step;trace(c,"autoscale-retirement-cancelled",{actionId:action.id,targetId:action.targetId!,reason:"Retirement safety changed"});return false;}
 c.apps=c.apps.filter(x=>x.id!==action.targetId);c.routing.targets=c.routing.targets.filter(x=>x!==action.targetId);
 delete c.overload[action.targetId!];a.managedAppIds=a.managedAppIds.filter(x=>x!==action.targetId);a.expectedRouting=JSON.stringify(c.routing);
 trace(c,"autoscale-instance-retired",{actionId:action.id,targetId:action.targetId!,installed:c.apps.length});return true;
}
export function runAutoscaler(s:GameState):void {
 const c=s.campaign!,d=c.spikeStage,a=d?.controller;if(!d)return;
 if(s.phase!=="review"&&s.phase!=="ended"&&a){
  if(!a.enabled)blocked(c,"Controller disabled");
  else if(!c.loadBalancer||c.routing.mode!=="balanced"||c.routing.targets.length<T.minimum)blocked(c,"Balanced routing to two apps required");
  else if(a.joiningAppId) {
   a.highSteps=0;a.lowSteps=0;
   const joining=c.apps.find(x=>x.id===a.joiningAppId);
   if(!joining)blocked(c,"Provisioning");
   else if(c.pending.some(x=>x.type==="routing"))blocked(c,"Routing pending");
   else if(JSON.stringify(c.routing)!==a.expectedRouting)blocked(c,"Routing pool changed; inspect installed capacity");
   else {blocked(c,null);schedule(c,"routing",T.routingDelay,0,{routing:{mode:"balanced",targets:[...c.routing.targets,joining.id]}});}
  } else if(c.step<a.cooldownUntil)blocked(c,"Cooldown");
  else if(infraBusy(c)||c.pending.some(x=>x.type==="routing"))blocked(c,"Deployment or routing channel busy");
  else {
   const o=spikeObservation(c);
   // Integer cross products preserve strict threshold boundaries without rounding.
   const xs=c.snapshot.instances!.filter(x=>x.routed),capacity=xs.reduce((n,x)=>n+x.capacity,0),work=xs.reduce((n,x)=>n+x.processed,0);
   if(work*10000>capacity*T.high&&(c.apps.length>=T.maximum||c.cashCents<=Q.appCostCents))blocked(c,c.apps.length>=T.maximum?"Maximum four instances reached":"Insufficient cash for provisioning");
   else {blocked(c,null);
   a.highSteps=work*10000>capacity*T.high?a.highSteps+1:0;
   const candidates=a.managedAppIds.filter(id=>canRetire(c,id)).sort((x,y)=>Number(y.slice(4))-Number(x.slice(4)));
   a.lowSteps=work*10000<capacity*T.low&&candidates.length?a.lowSteps+1:0;
   if(a.highSteps>=T.highSteps){
    if(c.apps.length>=T.maximum)blocked(c,"Maximum four instances reached");
    else if(c.cashCents<=Q.appCostCents)blocked(c,"Insufficient cash for provisioning");
    else {const id=`app-${c.nextAppNumber++}`;trace(c,"autoscale-scale-out-decided",{...o,incoming:c.incomingRate,highThresholdBasisPoints:T.high,highSteps:a.highSteps,targetId:id});
     a.joiningAppId=id;a.expectedRouting=JSON.stringify(c.routing);a.highSteps=0;a.lowSteps=0;
     schedule(c,"add-app",T.provisionDelay,Q.appCostCents,{targetId:id});}
   } else if(a.lowSteps>=T.lowSteps){
    trace(c,"autoscale-scale-in-eligible",{...o,incoming:c.incomingRate,lowThresholdBasisPoints:T.low,lowSteps:a.lowSteps,targetId:candidates[0]});a.expectedRouting=JSON.stringify(c.routing);a.highSteps=0;a.lowSteps=0;
    schedule(c,"retire-app",1,0,{targetId:candidates[0]});
   }
   }
  }
 }
 if(s.phase==="management"&&!pendingSpikeAcknowledgement(c)&&d.completedStep===null&&c.step>=d.deadlines[3]) {
  const ready=c.incomingRate===T.baseline&&!c.incident&&!c.dbBacklog&&c.apps.every(x=>!x.backlog)&&qualifiesForRecovery(c.snapshot)&&c.reports.every(r=>c.trace.some(t=>t.type==="review-acknowledged"&&t.data.incidentId===r.id));
  d.baselineStableSteps=ready?d.baselineStableSteps+1:0;
  if(d.baselineStableSteps>=5){d.completedStep=c.step;trace(c,"traffic-spike-stage-completed",{recognitionId:"spike-response",physicalDuration:c.step-d.enteredStep,cashCents:c.cashCents,investedCents:c.investedCents,settledCostCents:c.costsCents,controllerExposure:c.ledger.controllerNumerator??0,controllerRemainder:c.remainders.controller??0,limitActive:c.limit!==null,rejected:c.cumulative.rejected,installed:c.apps.length,routed:c.routing.targets.length,manualRequests:c.actions.filter(x=>x.requestedStep>=d.enteredStep&&x.source!=="autoscaler").length,automaticRequests:c.actions.filter(x=>x.requestedStep>=d.enteredStep&&x.source==="autoscaler").length});}
 }
 c.snapshot.spikes=spikeObservation(c);
}
export function spikeAction(prev:GameState,action:Action):ActionResult|null {
 if(!["enter_spikes","unlock_autoscaling","deploy_autoscaler","set_autoscaling","acknowledge_spikes"].includes(action.type))return null;
 const fail=(message:string):ActionResult=>({ok:false,reason:"invalid",message});
 if(prev.phase==="review"||prev.phase==="ended")return fail("Finish review before changing progression.");
 const s=clone(prev),c=s.campaign!,d=c.spikeStage;
 if(action.type==="enter_spikes"){
  if(!canEnterSpikes(prev))return fail("Requires consumed data growth, stable service, drained work and acknowledged reports.");
  c.spikeStage={id:T.id,version:T.version,configuration:JSON.stringify(T),enteredStep:c.step,deadlines:T.offsets.map(x=>c.step+x),consumed:[],researchEarned:1,researchSpent:0,controller:null,baselineStableSteps:0,completedStep:null,acknowledged:false};
  trace(c,"spike-stage-entered",{stageId:T.id,stageVersion:T.version,configuration:JSON.stringify(T),cashCents:c.cashCents,investedCents:c.investedCents,settledCostCents:c.costsCents,rejected:c.cumulative.rejected});
  trace(c,"progression-awarded",{recognitionId:"data-readiness",research:1});trace(c,"traffic-spikes-announced",{deadlines:JSON.stringify(c.spikeStage.deadlines),baseline:T.baseline,peak:T.peak});
 } else if(!d)return fail("Enter Traffic Spikes & Autoscaling first.");
 else if(action.type==="acknowledge_spikes"){
  if(!pendingSpikeAcknowledgement(c))return fail("No spike recognition awaits acknowledgement.");d.acknowledged=true;trace(c,"spike-stage-acknowledged");
 } else if(pendingSpikeAcknowledgement(c))return fail("Acknowledge spike completion first.");
 else if(action.type==="unlock_autoscaling"){
  if(d.researchSpent)return fail("Autoscaling already unlocked.");d.researchSpent=1;trace(c,"autoscaling-unlocked",{researchSpent:1});
 } else if(action.type==="deploy_autoscaler"){
  if(!d.researchSpent||d.controller||infraBusy(c)||!c.loadBalancer||c.routing.mode!=="balanced"||c.routing.targets.length<T.minimum||c.cashCents<=T.controllerCostCents)return fail("Requires unlock, balanced routing to two apps, free infrastructure slot and cash.");
  schedule(c,"deploy-autoscaler",T.controllerDelay,T.controllerCostCents,{source:"player"});
 } else if(action.type==="set_autoscaling"){
  if(typeof action.enabled!=="boolean"||!d.controller||d.controller.enabled===action.enabled)return fail("Controller is unavailable or already set.");
  d.controller.enabled=action.enabled;d.controller.highSteps=0;d.controller.lowSteps=0;d.controller.cooldownUntil=c.step+T.cooldown;
  trace(c,action.enabled?"autoscaling-enabled":"autoscaling-disabled");
 }
 return {ok:true,state:s};
}
