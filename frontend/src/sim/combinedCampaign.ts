import type { Campaign, CombinedRound } from "./campaignTypes";
import type { Action, ActionResult, GameState } from "./types";
import { clone } from "./state";
import { rand } from "./rng";
import { trace } from "./trace";
import { healthy, reportsAcknowledged } from "./reliability";
import { qualifiesForRecovery } from "./step";
import { captureScorecard, emptyServiceMeasurement } from "./campaignScorecard";
import { COMBINED_CAMPAIGN as C, baselineDemand, growthUsers, targetValid, sequenceValid, type CombinedScenario, type CombinedTemplate } from "./scenarios/combinedCampaign";
export function pendingCombined(c:Campaign|undefined):boolean {
 const d=c?.combinedStage;return !!d&&!d.acknowledged&&(!!d.finalReview||d.currentRound?.completedStep!=null);
}
export function stableManagement(s:GameState,full=false):boolean {
 const c=s.campaign!;return s.phase==="management"&&c.cashCents>0&&!c.incident&&!c.pending.length&&!c.dbBacklog&&
 c.apps.every(a=>!a.backlog&&healthy(a))&&reportsAcknowledged(c)&&qualifiesForRecovery(c.snapshot)&&
 (!full||(c.limit===null&&c.snapshot.admitted===c.snapshot.incoming&&c.snapshot.rejected===0));
}
export function canEnterCombined(s:GameState):boolean {
 const c=s.campaign,d=c?.reliabilityStage;
 return !!c&&!!d?.acknowledged&&d.completedStep!==null&&!c.combinedStage&&!!c.openingMilestone?.acknowledged&&
 !!c.spikeStage?.acknowledged&&stableManagement(s)&&c.incomingRate===2400;
}
export function promotionActive(c:Campaign,at=c.step):boolean {
 const p=c.promotion;return !!p&&at>=p.activationStep&&at<p.endStep;
}
export function combinedInput(c:Campaign,at=c.step):number {
 const d=c.combinedStage;if(!d)return c.incomingRate;
 const r=d.currentRound;
 const base=r&&at>=r.startStep?r.baseline:baselineDemand(d.users,d.finalUserTarget);
 const rate=r&&at>=r.startStep&&at<r.endStep?r.scenario.peak:base;
 return rate+(promotionActive(c,at)?C.promotionIncrement:0);
}
export function combinedProfile(c:Campaign,at=c.step):"read-heavy"|"write-heavy" {
 const r=c.combinedStage?.currentRound;
 return r&&r.scenario.template==="write-pressure"&&at>=r.startStep&&at<r.endStep?"write-heavy":"read-heavy";
}
export function currentFault(c:Campaign) {return c.combinedStage?.currentRound?.fault??c.reliabilityStage?.fault??null;}
export function canStartGrowth(s:GameState):boolean {
 const c=s.campaign!,d=c.combinedStage;
 return !!d&&!d.currentRound&&d.nextRoundIndex<3&&!d.finalReview&&!d.acknowledged&&d.readinessSteps===5&&
 stableManagement(s,true)&&(!c.promotion||c.step>=c.promotion.endStep);
}
export function canPromote(s:GameState):boolean {
 const c=s.campaign!,d=c.combinedStage;
 return !!d&&!d.currentRound&&!d.finalReview&&!d.acknowledged&&stableManagement(s)&&c.cashCents>C.promotionCostCents&&
 (!c.promotion||c.step>=c.promotion.cooldownUntil);
}
export function selectSequence(s:GameState):CombinedScenario[] {
 const ids:CombinedTemplate[]=["read-growth-pulse","write-pressure","failure-under-load"];
 for(let i=ids.length-1;i>0;i--){const j=Math.floor(rand(s)*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
 return ids.map(template=>({template,peak:template==="write-pressure"?3000:template==="read-growth-pulse"?(rand(s)<.5?3800:4000):(rand(s)<.5?3400:3600),duration:rand(s)<.5?12:16}));
}
export function advanceCombinedTraffic(c:Campaign):void {
 const d=c.combinedStage;if(!d)return;const r=d.currentRound;
 if(r&&r.startedStep===null&&c.step>=r.startStep){
  r.startedStep=c.step;d.users=r.users;trace(c,"scenario-started",{roundId:r.id,index:r.index,template:r.scenario.template,users:d.users,peak:r.scenario.peak});
  if(d.users>=d.finalUserTarget&&d.targetReachedStep===null){d.targetReachedStep=c.step;trace(c,"final-target-reached",{users:d.users,finalUserTarget:d.finalUserTarget});}
 }
 if(r&&r.pressureEndedStep===null&&c.step>=r.endStep){r.pressureEndedStep=c.step;trace(c,"scenario-pressure-ended",{roundId:r.id,baseline:r.baseline});}
 const p=c.promotion;if(p&&p.endedStep===null&&c.step>=p.endStep){p.endedStep=c.step;trace(c,"promotion-ended",{actionId:p.actionId,baseline:baselineDemand(d.users,d.finalUserTarget)});}
 const from=c.incomingRate;c.incomingRate=combinedInput(c);
 if(from!==c.incomingRate)trace(c,"workload-changed",{from,to:c.incomingRate,profile:combinedProfile(c),eventId:r?.id??p?.actionId??"combined-baseline"});
}
export function finalRequirements(s:GameState):boolean {
 const c=s.campaign!,d=c.combinedStage;
 return !!d&&d.users>=d.finalUserTarget&&d.completedRounds.length===3&&d.completedRounds.every(r=>r.acknowledged)&&
 !d.currentRound&&!d.acknowledged&&stableManagement(s,true)&&!promotionActive(c)&&
 (!c.promotion||c.step>=c.promotion.endStep)&&c.incomingRate===baselineDemand(d.users,d.finalUserTarget);
}
export function observeCombined(s:GameState):void {
 const c=s.campaign!,d=c.combinedStage;if(!d||s.phase==="ended"||d.finalReview||pendingCombined(c))return;
 const r=d.currentRound,ready=stableManagement(s,true);
 if(r){
  if(r.startedStep!==null)r.observations.push(clone(c.snapshot));
  const finished=r.pressureEndedStep!==null&&(!r.fault||r.fault.restoredStep!==null);
  r.stableSteps=finished&&ready?Math.min(5,r.stableSteps+1):0;
  if(r.stableSteps===5){r.completedStep=c.step;trace(c,"scenario-completed",{roundId:r.id,template:r.scenario.template,rejected:c.cumulative.rejected-r.rejectedBefore,setupCents:c.investedCents-r.setupBefore});}
 } else if(d.nextRoundIndex<3){d.readinessSteps=ready&&!promotionActive(c)?Math.min(5,d.readinessSteps+1):0;}
 else {
  d.finalStableSteps=finalRequirements(s)?Math.min(5,d.finalStableSteps+1):0;
  if(d.finalStableSteps===5){d.finalReview=captureScorecard(s,"won");trace(c,"campaign-completion-qualified",{users:d.users,finalUserTarget:d.finalUserTarget});}
 }
}
export function combinedAction(prev:GameState,action:Action):ActionResult|null {
 if(!["enter_combined","start_growth_wave","acknowledge_growth","complete_campaign","accept_scaling_risk","run_promotion"].includes(action.type))return null;
 const fail=(message:string):ActionResult=>({ok:false,reason:"invalid",message});
 if(prev.phase==="ended"||prev.phase==="review")return fail("Finish the report or start a new company first.");
 const s=clone(prev),c=s.campaign!,d=c.combinedStage;
 if(action.type==="accept_scaling_risk"){
  if(!c.scaling||c.scaling.consumed||c.scalingConsent||d||!c.openingMilestone?.acknowledged||prev.phase!=="management")return fail("Risk consent is unavailable or already recorded.");
  c.scalingConsent={policyVersion:1,acceptedStep:c.step};trace(c,"scaling-growth-risk-accepted",{policyVersion:1,dbCapacity:c.dbCapacity,incoming:c.incomingRate,nextDemand:1400,cashCents:c.cashCents});return {ok:true,state:s};
 }
 if(action.type==="enter_combined"){
  if(!canEnterCombined(prev))return fail("Requires acknowledged Stay Online, stable baseline management, empty queues, healthy apps and finished actions/reports.");
  const target=action.finalUserTarget??C.finalUserTarget;
  if(!targetValid(target)||(action.sequence&&!sequenceValid(action.sequence)))return fail("Invalid combined configuration.");
  c.combinedStage={id:C.id,version:1,configuration:JSON.stringify(C),enteredStep:c.step,source:action.sequence||action.finalUserTarget!==undefined?"evaluation":"seeded",
   finalUserTarget:target,users:2000,sequence:action.sequence?clone(action.sequence):selectSequence(s),nextRoundIndex:0,currentRound:null,completedRounds:[],readinessSteps:0,finalStableSteps:0,
   targetReachedStep:null,finalReview:null,acknowledged:false,service:emptyServiceMeasurement(c.step+1,"combined-stage")};
  trace(c,"late-game-entered",{stageId:C.id,stageVersion:1,poolId:C.poolId,poolVersion:1,users:2000,profile:"read-heavy",finalUserTarget:target,sequence:JSON.stringify(c.combinedStage.sequence)});
  return {ok:true,state:s};
 }
 if(!d)return fail("Enter Grow the Company first.");
 if(action.type==="acknowledge_growth"){
  const r=d.currentRound;if(!r||r.completedStep===null||r.acknowledged)return fail("No growth outcome awaits acknowledgement.");
  r.acknowledged=true;d.completedRounds.push(clone(r));d.currentRound=null;d.nextRoundIndex++;d.readinessSteps=0;d.finalStableSteps=0;
  trace(c,"scenario-acknowledged",{roundId:r.id});return {ok:true,state:s};
 }
 if(action.type==="complete_campaign"){
  if(!d.finalReview||d.acknowledged||!finalRequirements(prev))return fail("The full-demand final review is not ready.");
  d.acknowledged=true;c.scorecard=clone(d.finalReview);s.phase="ended";s.outcome="won";
  trace(c,"campaign-completed",{users:d.users,finalUserTarget:d.finalUserTarget,cashCents:c.cashCents});return {ok:true,state:s};
 }
 if(pendingCombined(c))return fail("Review the company outcome first.");
 if(action.type==="start_growth_wave"){
  if(!canStartGrowth(prev))return fail("Observe five fresh healthy full-demand steps, finish reports and actions, and end any promotion first.");
  const index=d.nextRoundIndex,scenario=d.sequence[index],start=c.step+C.warningSteps;
  const r:CombinedRound={id:`growth-${c.nextEventId}`,index,scenario:clone(scenario),scheduledStep:c.step,startStep:start,endStep:start+scenario.duration,users:growthUsers(d.finalUserTarget,index),baseline:baselineDemand(growthUsers(d.finalUserTarget,index),d.finalUserTarget),startedStep:null,pressureEndedStep:null,fault:null,stableSteps:0,completedStep:null,acknowledged:false,rejectedBefore:c.cumulative.rejected,setupBefore:c.investedCents,observations:[]};
  if(scenario.template==="failure-under-load"){
   const target=c.apps.filter(a=>c.routing.targets.includes(a.id)&&healthy(a)&&a.role!=="spare").sort((a,b)=>Number(b.id.slice(4))-Number(a.id.slice(4)))[0];
   if(!target)return fail("A healthy serving application is required.");
   r.fault={id:`combined-failure-${c.nextEventId}`,targetId:target.id,armedStep:c.step,startStep:start,naturalStep:start+20,startedStep:null,restoredStep:null,restoreSource:null,promoted:false};
  }
  d.currentRound=r;d.readinessSteps=0;trace(c,"scenario-scheduled",{roundId:r.id,index,template:scenario.template,startStep:start,endStep:r.endStep});return {ok:true,state:s};
 }
 if(action.type==="run_promotion"){
  if(!canPromote(prev))return fail("Promotion requires stable baseline management between growth rounds, available cash and no pending work or cooldown.");
  const a={id:`action-${c.nextEventId}`,type:"promotion" as const,requestedStep:c.step,activationStep:c.step+1,costCents:C.promotionCostCents,activatedStep:null,source:"player" as const};
  c.cashCents-=a.costCents;c.investedCents+=a.costCents;c.pending.push(a);c.actions.push(clone(a));
  c.promotion={actionId:a.id,requestedStep:c.step,activationStep:a.activationStep,activatedStep:null,endStep:a.activationStep+12,endedStep:null,cooldownUntil:a.activationStep+42,costCents:a.costCents};d.readinessSteps=0;d.finalStableSteps=0;
  trace(c,"action-requested",{actionId:a.id,type:a.type,costCents:a.costCents,activationStep:a.activationStep});return {ok:true,state:s};
 }
 return fail("Unknown company action.");
}
