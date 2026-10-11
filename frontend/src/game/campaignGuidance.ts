import { canEnterReliability, pendingReliability } from "@/sim/reliability";
import type { GameState, Action } from "@/sim";
import { canEnterData, qualifiesForRecovery } from "@/sim/step";
import { canEnterSpikes, pendingSpikeAcknowledgement } from "@/sim/autoscaling";
import { pendingPreventionReview, preventionAvailable, preventionRequirements } from "@/sim/openingPrevention";
import { APPLICATION_SCALING as P } from "@/sim/scenarios/applicationScaling";
import { TRAFFIC_SPIKES as T } from "@/sim/scenarios/trafficSpikes";

export interface Requirement { id: string; label: string; met: boolean }
export interface GuidanceAction { label: string; action?: Action }
/** Read-only presentation of existing gates. Never saved and never changes engine inputs. */
export function campaignGuidance(g: GameState) {
 const c=g.campaign!;
 const openingDone=!!c.openingMilestone?.acknowledged;
 const stage=c.reliabilityStage?"Stay Online":c.spikeStage?"Traffic Spikes & Autoscaling":c.dataStage?"Data Strategy":openingDone?"Scaling & Routing":"Opening";
 const dataAvailable=!c.dataStage&&canEnterData(g),spikesAvailable=canEnterSpikes(g);
 const prevention=preventionAvailable(c);
 const pendingMilestone=!!c.openingMilestone&&!openingDone;
 const reportsAcknowledged=c.reports.every(r=>c.trace.some(t=>t.type==="review-acknowledged"&&t.data.incidentId===r.id));
 const queuesEmpty=c.dbBacklog===0&&c.apps.every(a=>a.backlog===0);
 const requirements:Requirement[]=[];
 const add=(id:string,label:string,met:boolean)=>requirements.push({id,label,met});
 let waiting:string|null=null,notice:string|null=null,optional:string|null=null;
 let pendingAction:GuidanceAction|null=null;
 if(c.reliabilityStage){const d=c.reliabilityStage;add("cash","Positive company cash",c.cashCents>0);add("management","Management resumed after any report",g.phase==="management");add("incident","No active incident",!c.incident);add("queues","All retained Application and Database queues empty",queuesEmpty);add("healthy","Measured healthy latency and service errors",qualifiesForRecovery(c.snapshot));if(!d.fault)add("pending","Accepted actions finish before arming",c.pending.length===0);add("armed","Reliability test started",!!d.fault);add("observed","Application failure observed",d.fault?.startedStep!==null&&!!d.fault);add("restored","Failed application restored",d.fault?.restoredStep!==null&&!!d.fault);add("reports","Recovered reports acknowledged",reportsAcknowledged);add("observations",`Stable service: ${d.stableSteps} / 5`,d.completedStep!==null);add("recognition","Reliability outcome acknowledged",d.acknowledged);if(pendingReliability(c))pendingAction={label:"Review reliability outcome"};else if(!d.fault)pendingAction={label:"Start reliability test",action:{type:"arm_reliability"}};else waiting=d.fault.startedStep===null?"Reliability test scheduled. Run to observe it.":d.fault.restoredStep===null?"Inspect actual health and surviving capacity. Manual restoration, routing or admission relief remain available.":"Observe stable service after restoration and acknowledge actual reports.";if(d.acknowledged){waiting=null;notice="Stay Online completed. Combined campaign content is not implemented in this build; the same company can continue operating.";}optional="Reliability purchases are optional; natural and free manual restoration remain available.";} else if(c.spikeStage) {
  const d=c.spikeStage;
  add("pulses","Both traffic pulses completed",c.step>=d.deadlines[3]);
  add("management","Operating in management, not a pending review",g.phase==="management");
  add("incident","No active incident",!c.incident);
  add("queues","Application and Database queues empty",queuesEmpty);
  add("reports","All recovered incident reports acknowledged",reportsAcknowledged);
  add("baseline","Current traffic is back to baseline",c.incomingRate===T.baseline);
  add("healthy","Healthy latency and service errors with completed requests",qualifiesForRecovery(c.snapshot));
  add("observations",`Stable baseline observations: ${d.baselineStableSteps} / 5`,d.completedStep!==null);
  add("recognition","Spike response acknowledged",d.acknowledged);
  notice=canEnterReliability(g)?"Stay Online is available through Continue to reliability.":"Stay Online requires acknowledged spike completion, stable baseline management and empty queues.";
  optional="Autoscaling is optional. Manual capacity, admission relief and hybrid responses remain valid.";
  if(c.step<d.deadlines[3])waiting="Waiting for both announced traffic pulses to end.";
  else if(d.completedStep===null&&!c.incident&&queuesEmpty&&reportsAcknowledged&&g.phase==="management"&&qualifiesForRecovery(c.snapshot))waiting="Observe new stable baseline steps with Run or Advance step. Pausing adds no observations.";
  if(pendingSpikeAcknowledgement(c))pendingAction={label:"Review spike recognition"};
 } else if(c.dataStage) {
  add("growth","Data growth occurred",c.dataStage.consumed);
  add("cash","Positive company cash",c.cashCents>0);
  add("milestone","Opening milestone acknowledged",openingDone);
  add("management","Operating in management, not a pending review",g.phase==="management");
  add("incident","No active incident",!c.incident);
  add("queues","Application and Database queues empty",queuesEmpty);
  add("reports","All recovered incident reports acknowledged",reportsAcknowledged);
  add("healthy","Healthy latency and service errors with completed requests",qualifiesForRecovery(c.snapshot));
  optional="Workload contrast is optional; cache purchase and database upgrades are not required for continuation.";
  if(!c.dataStage.consumed&&canEnterData(g))waiting="Waiting for the next company growth event. Run or Advance step checks readiness.";
  else if(!c.dataStage.consumed)notice="Data growth waits for management, empty queues, no active incident and acknowledged reports.";
  if(spikesAvailable)pendingAction={label:"Continue to traffic spikes",action:{type:"enter_spikes"}};
 } else if(openingDone) {
  add("opening","Opening completed",openingDone);
  add("stage","Scaling stage active",!!c.scaling);
  if(!c.scaling?.consumed)add("headroom",`Database headroom: ${c.dbCapacity.toLocaleString("en-US")} / ${P.dbCapacity.toLocaleString("en-US")} ops/s`,c.dbCapacity>=P.dbCapacity);
  add("management","Operating in management, not a pending review",g.phase==="management");
  add("incident","No active incident",!c.incident);
  add("queues","Application and Database queues empty",queuesEmpty);
  add("growth","Scaling growth occurred",!!c.scaling?.consumed);
  add("reports","All recovered incident reports acknowledged",reportsAcknowledged);
  if(c.scaling&&!c.scaling.consumed&&c.dbCapacity>=P.dbCapacity&&g.phase==="management"&&!c.incident&&queuesEmpty)waiting="Waiting for the next company growth event. Run or Advance step checks readiness.";
  if(!c.scaling?.consumed&&c.dbCapacity<P.dbCapacity&&c.cashCents<=P.dbCostCents)notice="Next growth requires paid database headroom, but current cash cannot fund that investment. Pending revenue is available only after settlement; inspect finances and operating costs before advancing. Solvency alone does not guarantee an affordable growth investment.";
  if(!c.scaling&&g.phase!=="ended")pendingAction={label:"Continue to scaling and routing",action:{type:"enter_scaling"}};
  else if(dataAvailable)pendingAction={label:"Continue to data strategy",action:{type:"enter_data"}};
 } else if(prevention) {
  const r=preventionRequirements(c);
  add("growth","Opening growth occurred",r.growth);
  add("incident","No Opening incident opened",r.noIncident);
  add("cash","Positive company cash",r.positiveCash);
  add("admission","Full 800 req/s admitted; traffic limit inactive",r.fullDemand);
  add("queues","Application and Database queues empty",r.emptyQueues);
  add("healthy","Healthy latency and service errors",r.healthy);
  add("app-inspection","Application inspected after growth",r.applicationInspected);
  add("db-inspection","Database inspected after growth",r.databaseInspected);
  add("observations",`Stable observations: ${c.openingPrevention?.stableSteps??0} / 5`,!!c.openingPrevention?.outcome);
  add("review","Prevention outcome acknowledged",!!c.openingPrevention?.outcome?.acknowledged);
  add("milestone","Opening milestone acknowledged",openingDone);
  if(c.limit!==null)notice="Traffic limiting prevents full-demand qualification. Remove the limit and serve the full 800 req/s to continue the prevention path.";
  else if(Object.values(r).every(Boolean)&&!c.openingPrevention?.outcome)waiting="Observe five consecutive new physical steps. Pausing adds no observations; a failing step resets the streak.";
  if(pendingPreventionReview(c))pendingAction={label:"Review outcome"};
 } else if(c.incident||c.openingRecovered||c.reports.length||pendingMilestone) {
  add("recovery",c.openingMilestone?.outcomeId?"Opening prevention qualified":"Incident recovered",c.openingMilestone?.outcomeId?!!c.openingPrevention?.outcome:c.openingRecovered);
  add("review",c.openingMilestone?.outcomeId?"Prevention outcome acknowledged":"Postmortem reviewed",c.openingMilestone?.outcomeId?!!c.openingPrevention?.outcome?.acknowledged:reportsAcknowledged&&c.reports.length>0);
  add("milestone","Opening milestone acknowledged",openingDone);
  if(c.incident)waiting="Restore stable service and observe measured recovery. Use Run and Pause to inspect real changes.";
 } else {
  add("growth","Opening growth occurred",c.consumedEvents.includes("opening-growth"));
  add("outcome","Recovered incident or qualifying prevention outcome acknowledged",false);
  add("milestone","Opening milestone acknowledged",false);
  waiting="Waiting for the next company growth event. Run or Advance step to observe demand.";
 }
 // Required acknowledgements take priority over stage continuation in every stage.
 if(g.phase==="review"&&c.reports.length)pendingAction={label:"Review postmortem"};
 else if(pendingMilestone)pendingAction={label:"Complete Opening"};
 if(!reportsAcknowledged&&g.phase!=="review"&&!c.incident)notice="A recorded recovered report lacks an acknowledgement, but no review is active. Export company evidence for investigation; this guidance cannot safely repair the saved state.";
 if(g.phase==="ended") { pendingAction=null;waiting=null;notice="The company is bankrupt. Review final evidence and explicitly restart from the Menu."; }
 const incomplete=requirements.filter(r=>!r.met);
 return {stage,openingDone,dataAvailable,spikesAvailable,prevention,requirements,incomplete,pendingAction,waiting,notice,optional};
}
