import { introductionActive, INTRODUCTION_COMPONENTS } from "@/sim/introduction";
import { introductionInstruction, INTRODUCTION_COPY } from "./introduction";
import { canEnterCombined, canStartGrowth, combinedEntryGates, pendingCombined } from "@/sim/combinedCampaign";
import { canEnterReliability, pendingReliability, reliabilityEntryGates } from "@/sim/reliability";
import { entryBlockers, waitsFor } from "./entryGates";
import type { GameState, Action } from "@/sim";
import { canEnterData, qualifiesForRecovery } from "@/sim/step";
import { canEnterSpikes, pendingSpikeAcknowledgement } from "@/sim/autoscaling";
import { pendingPreventionReview, preventionAvailable, preventionRequirements } from "@/sim/openingPrevention";
import { APPLICATION_SCALING as P } from "@/sim/scenarios/applicationScaling";
import { TRAFFIC_SPIKES as T } from "@/sim/scenarios/trafficSpikes";

export interface Requirement { id: string; label: string; met: boolean }
/**
 * The opening milestone gates time only once it can be acknowledged: Launch Week defers it until completion, and an
 * incident or postmortem still open when the week ends comes first, since the engine accepts the milestone only then.
 */
export const milestoneBlocks = (g: GameState) => {
  const c = g.campaign;
  return !!c?.openingMilestone && !c.openingMilestone.acknowledged && g.phase === "management" && (!c.launchWeek || c.launchWeek.completedStep !== null);
};
/** Launch Week is over but its free research point is unspent: the pick comes before the score card and the milestone. */
export const launchResearchPending = (g: GameState) =>
  milestoneBlocks(g) && !!g.campaign!.launchWeek?.researchEarned && !g.campaign!.launchWeek.tech;
export interface GuidanceAction { label: string; action?: Action }
/** One shared objective for the chapter bar; detailed actions and gates remain in the overview. */
export function campaignObjective(g: GameState) {
 const c=g.campaign!;
 if(introductionActive(c))return "Explore Network, App Servers, Database and Monitoring, then complete the introduction.";
 if(g.phase==="ended") return g.outcome==="won"?"Inspect the final architecture and scorecard.":"Review the company's finances and recorded evidence.";
 if(g.phase==="review") return "Read the postmortem before continuing the same company.";
 if(c.incident) return "Restore stable service while weighing cost and rejected demand.";
 if(c.launchWeek&&c.launchWeek.completedStep===null) return "Keep the service up through launch week.";
 if(launchResearchPending(g)) return "Spend your free research pick to see your Launch Week score.";
 if(c.launchWeek&&milestoneBlocks(g)) return "Review your Launch Week score, then stay or continue to Scaling & Routing.";
 if(c.combinedStage) return "Serve growing demand, manage costs and review each outcome.";
 if(c.reliabilityStage) return "Keep service stable through an application failure, then review the evidence.";
 if(c.spikeStage) return "Handle changing demand while managing capacity costs.";
 if(c.dataStage) return "Compare workload, cache hits and database pressure as demand grows.";
 if(c.openingMilestone?.acknowledged) return c.scaling?"Prepare the system for the next growth wave.":"Keep operating, then continue to Scaling & Routing with Next.";
 if(preventionAvailable(c)) return "Inspect the Application and Database; keep service healthy at full demand.";
 return "Observe demand and compare component evidence.";
}
/** Read-only presentation of existing gates. Never saved and never changes engine inputs. */
export function campaignGuidance(g: GameState) {
 const c=g.campaign!;
 const openingDone=!!c.openingMilestone?.acknowledged;
 const stage=c.combinedStage?"Grow the Company":c.reliabilityStage?"Stay Online":c.spikeStage?"Traffic Spikes & Autoscaling":c.dataStage?"Data Strategy":openingDone&&c.scaling?"Scaling & Routing":c.launchWeek?"Launch Week":"Opening";
 const dataAvailable=!c.dataStage&&canEnterData(g),spikesAvailable=canEnterSpikes(g);
 const prevention=preventionAvailable(c);
 const pendingMilestone=!!c.openingMilestone&&!openingDone;
 const reportsAcknowledged=c.reports.every(r=>c.trace.some(t=>t.type==="review-acknowledged"&&t.data.incidentId===r.id));
 const queuesEmpty=c.dbBacklog===0&&c.apps.every(a=>a.backlog===0);
 const requirements:Requirement[]=[];
 const finalGoals:Requirement[]=[];
 /** The prevention path's own checks, nested under its one chapter requirement so the chapter's count stays put. */
 const preventionChecks:Requirement[]=[];
 const add=(id:string,label:string,met:boolean)=>requirements.push({id,label,met});
 let waiting:string|null=null,notice:string|null=null,optional:string|null=null;
 let pendingAction:GuidanceAction|null=null;
 const nextStage=c.combinedStage?"Campaign complete":c.reliabilityStage?"Combined campaign":c.spikeStage?"Stay Online":c.dataStage?"Survive Traffic Spikes":openingDone?"Data Bottlenecks":"Scale Your App";
 if(introductionActive(c)) {
  for(const id of INTRODUCTION_COMPONENTS)add(id,`${INTRODUCTION_COPY[id].name} explored`,c.launchWeek!.introduction!.explored.includes(id));
  notice=introductionInstruction(c).message;
 } else if(c.combinedStage){
  const d=c.combinedStage,r=d.currentRound;
  add("cash","Positive company cash",c.cashCents>0);add("admission","Serve full demand; traffic limit inactive",c.limit===null&&c.snapshot.admitted===c.snapshot.incoming);
  add("incident","No active incident",!c.incident);add("queues","All retained queues empty",queuesEmpty);add("reports","Incident reports acknowledged",reportsAcknowledged);
  add("healthy","Applications healthy and service stable",c.apps.every(a=>a.health!=="failed")&&qualifiesForRecovery(c.snapshot));
  add("pending","Accepted deployments and routing finished",!c.pending.length);
  add("promotion","Optional promotion ended",!c.promotion||c.step>=c.promotion.endStep);
  if(r?.fault)add("restored","Failed server restored",r.fault.restoredStep!==null);
  const checks=r?r.stableSteps:d.nextRoundIndex===3?d.finalStableSteps:d.readinessSteps;
  add("checks",`${r?"Wave stability":d.nextRoundIndex===3?"Final stability":"Full-demand readiness"}: ${checks} / 5`,checks===5);
  finalGoals.push({id:"rounds",label:`Growth outcomes acknowledged: ${d.completedRounds.length} / 3`,met:d.completedRounds.length===3},
   {id:"target",label:`Registered users: ${d.users.toLocaleString("en-US")} / ${d.finalUserTarget.toLocaleString("en-US")}`,met:d.users>=d.finalUserTarget},
   {id:"completion",label:"Final Campaign review completed",met:d.acknowledged});
  if(d.finalReview)pendingAction={label:"Review campaign scorecard"};
  else if(pendingCombined(c))pendingAction={label:"Review growth outcome"};
  else if(canStartGrowth(g))pendingAction={label:"Start next growth wave",action:{type:"start_growth_wave"}};
  else if(r)waiting=r.startedStep===null?"The next growth wave is announced. Prepare and resume when ready.":r.pressureEndedStep===null?"Observe the current workload and healthy routed capacity; use evidence to respond.":`Pressure ended. Restore all apps, acknowledge reports and serve full baseline demand. Stable service: ${r.stableSteps} / 5.`;
  else waiting=d.nextRoundIndex===3?`Final stable service: ${d.finalStableSteps} / 5. Keep serving full baseline demand after acknowledging the last outcome.`:`Readiness: ${d.readinessSteps} / 5 stable full-demand seconds. Finish any promotion before the next wave.`;
  optional="Promotion is optional and temporarily adds demand. Registration is growth opportunity; rejected requests do not earn revenue.";
 } else if(c.reliabilityStage){const d=c.reliabilityStage;add("cash","Positive company cash",c.cashCents>0);add("management","Management resumed after any report",g.phase==="management");add("incident","No active incident",!c.incident);add("queues","All retained Application and Database queues empty",queuesEmpty);add("healthy","Measured healthy latency and service errors",qualifiesForRecovery(c.snapshot));if(!d.fault)add("pending","Accepted actions finish before arming",c.pending.length===0);add("armed","Reliability test started",!!d.fault);add("observed","Application failure observed",d.fault?.startedStep!==null&&!!d.fault);add("restored","Failed application restored",d.fault?.restoredStep!==null&&!!d.fault);add("reports","Recovered reports acknowledged",reportsAcknowledged);add("observations",`Stable service: ${d.stableSteps} / 5`,d.completedStep!==null);add("recognition","Reliability outcome acknowledged",d.acknowledged);if(pendingReliability(c))pendingAction={label:"Review reliability outcome"};else if(!d.fault)pendingAction={label:"Start reliability test",action:{type:"arm_reliability"}};else waiting=d.fault.startedStep===null?"Reliability test scheduled. Run to observe it.":d.fault.restoredStep===null?"Inspect actual health and surviving capacity. Manual restoration, routing or admission relief remain available.":"Observe stable service after restoration and acknowledge actual reports.";if(d.acknowledged){waiting=null;if(canEnterCombined(g)){notice="Stay Online completed. Continue the same company into Grow the Company through Next in the chapter bar.";pendingAction={label:"Continue to Grow the Company",action:{type:"enter_combined"}};}else notice=waitsFor("Grow the Company",entryBlockers(false,combinedEntryGates(g),"Stay Online"));}optional="Reliability purchases are optional; natural and free manual restoration remain available.";} else if(c.spikeStage) {
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
  // Stay Online's entry also checks cash, so the requirements name it with the rest.
  add("cash","Positive company cash",c.cashCents>0);
  notice=canEnterReliability(g)?"Stay Online is available through Next in the chapter bar.":d.acknowledged?waitsFor("Stay Online",entryBlockers(false,reliabilityEntryGates(g),"Traffic Spikes")):d.completedStep!==null?"Stay Online opens after you review the spike response.":null;
  optional="Autoscaling is optional. Manual capacity, admission relief and hybrid responses remain valid.";
  if(c.step<d.deadlines[3])waiting="Waiting for both announced traffic pulses to end.";
  else if(d.completedStep===null&&!c.incident&&queuesEmpty&&reportsAcknowledged&&g.phase==="management"&&qualifiesForRecovery(c.snapshot))waiting="Observe new stable baseline game seconds with Run. Pausing adds no observations.";
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
  if(!c.dataStage.consumed&&!canEnterData(g))notice="Data growth waits for management, empty queues, no active incident and acknowledged reports.";
  if(spikesAvailable)pendingAction={label:"Continue to Traffic Spikes",action:{type:"enter_spikes"}};
 } else if(openingDone&&!c.scaling) {
  // The player stayed after the Opening: Scaling & Routing waits for Next, and none of its requirements apply yet.
  add("opening",c.launchWeek?"Launch Week completed":"Opening completed",true);
  if(g.phase!=="ended")notice=`${c.launchWeek?"Launch Week":"The Opening"} is complete. Continue to Scaling & Routing through Next in the chapter bar when you are ready.`;
  if(g.phase!=="ended")pendingAction={label:"Continue to Scaling & Routing",action:{type:"enter_scaling"}};
 } else if(openingDone) {
  add("opening","Opening completed",openingDone);
  add("stage","Scaling stage active",!!c.scaling);
  if(!c.scaling?.consumed)add("headroom",`Database headroom: ${c.dbCapacity.toLocaleString("en-US")} / ${P.dbCapacity.toLocaleString("en-US")} ops/s`,c.dbCapacity>=P.dbCapacity||!!c.scalingConsent);
  add("management","Operating in management, not a pending review",g.phase==="management");
  add("incident","No active incident",!c.incident);
  add("queues","Application and Database queues empty",queuesEmpty);
  add("growth","Scaling growth occurred",!!c.scaling?.consumed);
  add("reports","All recovered incident reports acknowledged",reportsAcknowledged);
  if(!c.scaling?.consumed&&!c.scalingConsent&&c.dbCapacity<P.dbCapacity&&c.cashCents<=P.dbCostCents)notice="Next growth requires paid database headroom, but current cash cannot fund that investment. Pending revenue is available only after settlement; inspect finances and operating costs before advancing. Solvency alone does not guarantee an affordable growth investment.";
  if(dataAvailable)pendingAction={label:"Continue to Data Strategy",action:{type:"enter_data"}};
 } else if(prevention) {
  const r=preventionRequirements(c);
  const check=(id:string,label:string,met:boolean)=>preventionChecks.push({id,label,met});
  add("growth","Opening growth occurred",r.growth);
  add("outcome","Verified prevention outcome or recovered incident acknowledged",!!c.openingPrevention?.outcome?.acknowledged);
  add("milestone","Opening milestone acknowledged",openingDone);
  check("incident","No Opening incident opened",r.noIncident);
  check("cash","Positive company cash",r.positiveCash);
  check("admission","Full 800 req/s admitted; traffic limit inactive",r.fullDemand);
  check("queues","Application and Database queues empty",r.emptyQueues);
  check("healthy","Healthy latency and service errors",r.healthy);
  check("app-inspection","Application inspected after growth",r.applicationInspected);
  check("db-inspection","Database inspected after growth",r.databaseInspected);
  check("observations",`Stable observations: ${c.openingPrevention?.stableSteps??0} / 5`,!!c.openingPrevention?.outcome);
  check("review","Prevention outcome acknowledged",!!c.openingPrevention?.outcome?.acknowledged);
  optional="Verified prevention and incident recovery are both valid paths. For prevention, meet every requirement, acknowledge the outcome, then complete the Opening recognition to continue.";
  if(c.limit!==null)notice="Traffic limiting prevents full-demand qualification. Remove the limit and serve the full 800 req/s to continue the prevention path.";
  else if(Object.values(r).every(Boolean)&&!c.openingPrevention?.outcome)waiting="Observe five consecutive new game seconds. Pausing adds no observations; a failing game second resets the streak.";
  if(pendingPreventionReview(c))pendingAction={label:"Review outcome"};
  else if(c.openingPrevention?.outcome?.acknowledged)waiting="Prevention recorded. Complete the verified Opening recognition to continue to Scaling & Routing.";
 } else if(c.launchWeek) {
  const lw=c.launchWeek;
  add("cash","Positive company cash",c.cashCents>0);
  add("research","Research pick spent",!!lw.tech);
  add("launch","Launch Week survived",lw.completedStep!==null);
  add("milestone","Opening milestone acknowledged",openingDone);
  optional="The research pick and the upgraded database carry into the later chapters.";
 } else if(c.incident||c.openingRecovered||c.reports.length||pendingMilestone) {
  add("recovery",c.openingMilestone?.outcomeId?"Opening prevention qualified":"Incident recovered",c.openingMilestone?.outcomeId?!!c.openingPrevention?.outcome:c.openingRecovered);
  add("review",c.openingMilestone?.outcomeId?"Prevention outcome acknowledged":"Postmortem reviewed",c.openingMilestone?.outcomeId?!!c.openingPrevention?.outcome?.acknowledged:reportsAcknowledged&&c.reports.length>0);
  add("milestone","Opening milestone acknowledged",openingDone);
  if(c.incident)waiting="Restore stable service and observe measured recovery. Use Run and Pause to inspect real changes.";
 } else {
  add("growth","Opening growth occurred",c.consumedEvents.includes("opening-growth"));
  add("outcome","Verified prevention outcome or recovered incident acknowledged",false);
  add("milestone","Opening milestone acknowledged",false);
 }
 // Required acknowledgements take priority over stage continuation in every stage.
 if(g.phase==="review"&&c.reports.length)pendingAction={label:"Review postmortem"};
 // Launch Week awards its milestone mid-week but only lets it be acknowledged once the week is over and the research pick is spent.
 else if(launchResearchPending(g))waiting="Launch Week is over. Spend your free research pick on Caching or Autoscaling to see your score.";
 else if(milestoneBlocks(g))pendingAction={label:"Complete Opening"};
 if(!reportsAcknowledged&&g.phase!=="review"&&!c.incident)notice="A recorded recovered report lacks an acknowledgement, but no review is active. Export company evidence for investigation; this guidance cannot safely repair the saved state.";
 if(g.phase==="ended") { pendingAction=null;waiting=null;notice=""+(g.outcome==="won"?"Campaign complete. Inspect your scorecard and final architecture before explicitly starting a new company.":"The company is bankrupt. Review final evidence and explicitly restart from the Menu.")+""; }
 const incomplete=requirements.filter(r=>!r.met),completed=requirements.filter(r=>r.met);
 const lockReason=c.spikeStage&&!c.combinedStage?notice:pendingAction?`Next action: ${pendingAction.label}.`:incomplete.length?incomplete[0].label:waiting;
 return {stage,nextStage,openingDone,dataAvailable,spikesAvailable,pendingMilestone,prevention,preventionChecks,finalGoals,requirements,incomplete,completed,pendingAction,waiting,notice,optional,lockReason};
}
