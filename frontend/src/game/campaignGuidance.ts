import { introductionActive, INTRODUCTION_COMPONENTS } from "@/sim/introduction";
import { introductionInstruction, INTRODUCTION_COPY } from "./introduction";
import { canCompleteCampaign, completionGates } from "@/sim/campaignCompletion";
import { canEnterReliability, pendingReliability, reliabilityEntryGates } from "@/sim/reliability";
import { entryBlockers, waitsFor } from "./entryGates";
import type { GameState, Action } from "@/sim";
import { canEnterData, qualifiesForRecovery } from "@/sim/step";
import { canEnterSpikes, gradedSpikes, pendingSpikeAcknowledgement, pendingSpikeDebrief, spikeTestPassed } from "@/sim/autoscaling";
import { PASS_SHARE, servedShare } from "./chapter4Guidance";
import { pendingPreventionReview, preventionAvailable, preventionRequirements } from "@/sim/openingPrevention";
import { APPLICATION_SCALING as P } from "@/sim/scenarios/applicationScaling";

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
 if(c.reliabilityStage?.acknowledged) return "Stay Online is complete. Complete the campaign with Next when you are ready.";
 if(c.reliabilityStage) return "Keep service stable through an application failure, then review the evidence.";
 if(c.spikeStage) return gradedSpikes(c.spikeStage)&&!spikeTestPassed(c.spikeStage)?`Pass the spike test: serve at least ${PASS_SHARE} of a graded spike's requests.`:"Handle changing demand while managing capacity costs.";
 if(c.dataStage) return "Compare workload, cache hits and database pressure as demand grows.";
 if(c.openingMilestone?.acknowledged) return c.scaling?"Prepare the system for the next growth wave.":"Keep operating, then continue to Scaling & Routing with Next.";
 if(preventionAvailable(c)) return "Inspect the Application and Database; keep service healthy at full demand.";
 return "Observe demand and compare component evidence.";
}
/** Read-only presentation of existing gates. Never saved and never changes engine inputs. */
export function campaignGuidance(g: GameState) {
 const c=g.campaign!;
 const openingDone=!!c.openingMilestone?.acknowledged;
 const stage=c.reliabilityStage?"Stay Online":c.spikeStage?"Traffic Spikes & Autoscaling":c.dataStage?"Data Strategy":openingDone&&c.scaling?"Scaling & Routing":c.launchWeek?"Launch Week":"Opening";
 const dataAvailable=!c.dataStage&&canEnterData(g),spikesAvailable=canEnterSpikes(g);
 const prevention=preventionAvailable(c);
 const pendingMilestone=!!c.openingMilestone&&!openingDone;
 const reportsAcknowledged=c.reports.every(r=>c.trace.some(t=>t.type==="review-acknowledged"&&t.data.incidentId===r.id));
 const queuesEmpty=c.dbBacklog===0&&c.apps.every(a=>a.backlog===0);
 const requirements:Requirement[]=[];
 const add=(id:string,label:string,met:boolean)=>requirements.push({id,label,met});
 let waiting:string|null=null,notice:string|null=null,optional:string|null=null;
 let pendingAction:GuidanceAction|null=null;
 const nextStage=c.reliabilityStage?"Campaign complete":c.spikeStage?"Stay Online":c.dataStage?"Survive Traffic Spikes":openingDone?"Data Bottlenecks":"Scale Your App";
 if(introductionActive(c)) {
  for(const id of INTRODUCTION_COMPONENTS)add(id,`${INTRODUCTION_COPY[id].name} explored`,c.launchWeek!.introduction!.explored.includes(id));
  notice=introductionInstruction(c).message;
 } else if(c.reliabilityStage){const d=c.reliabilityStage;add("pending","Accepted actions finish before arming",!!d.fault||c.pending.length===0);add("queues","Application and Database queues empty",queuesEmpty);add("healthy","Healthy latency and service errors with completed requests",qualifiesForRecovery(c.snapshot));add("armed","Reliability test started",!!d.fault);add("restored","Failed application restored",d.fault?.restoredStep!==null&&!!d.fault);add("observations",`Stable service: ${d.stableSteps} / 5`,d.completedStep!==null);add("recognition","Reliability outcome acknowledged",d.acknowledged);if(pendingReliability(c))pendingAction={label:"Review reliability outcome"};else if(!d.fault)pendingAction={label:"Start reliability test",action:{type:"arm_reliability"}};else waiting=d.fault.startedStep===null?"Reliability test scheduled. Run to observe it.":d.fault.restoredStep===null?"Inspect actual health and surviving capacity. Manual restoration, routing or admission relief remain available.":"Observe stable service after restoration and acknowledge actual reports.";if(d.acknowledged){waiting=null;if(canCompleteCampaign(g)){notice="Stay Online completed. Complete the campaign through Next in the chapter bar when you are ready.";pendingAction={label:"Complete campaign",action:{type:"complete_campaign"}};}else notice=waitsFor("The campaign",entryBlockers(false,completionGates(g),"Stay Online"),"can be completed");}optional="Reliability purchases are optional; natural and free manual restoration remain available.";} else if(c.spikeStage) {
  const d=c.spikeStage,graded=gradedSpikes(d),last=d.pulses?.filter(p=>p.graded&&p.result!==null).at(-1);
  if(graded)add("test",`A graded spike served at least ${PASS_SHARE} of its requests${last?` (last test: ${servedShare(last)})`:""}`,spikeTestPassed(d));
  else add("pulses","Both traffic pulses completed",c.step>=d.deadlines[3]);
  add("queues","Application and Database queues empty",queuesEmpty);
  add("healthy","Healthy latency and service errors with completed requests",qualifiesForRecovery(c.snapshot));
  add("observations",`Stable baseline observations: ${d.baselineStableSteps} / 5`,d.completedStep!==null);
  add("recognition","Spike response acknowledged",d.acknowledged);
  notice=canEnterReliability(g)?"Stay Online is available through Next in the chapter bar.":d.acknowledged?waitsFor("Stay Online",entryBlockers(false,reliabilityEntryGates(g),"Traffic Spikes")):d.completedStep!==null?"Stay Online opens after you review the spike response.":null;
  const responses=graded?"Manual capacity, autoscaling or both can pass the test; a traffic limit protects service, but its rejected requests count against the test."
    :"Manual capacity, admission relief and hybrid responses remain valid.";
  optional=d.controller?.enabled
    ?`Autoscaling is enabled; Server management shows what it provisions and retires. ${responses}`
    :d.controller
    ?`Autoscaling is deployed but disabled; Server management holds its switch. ${responses}`
    :d.researchSpent
    ?`Autoscaling is unlocked; deployment is a separate optional purchase in Server management. ${responses}`
    :`Autoscaling is optional; it lives in Server management under App Server. ${responses}`;
  if(c.step<d.deadlines.at(-1)!)waiting=graded?"Waiting for the next traffic spike to start or end.":"Waiting for both announced traffic pulses to end.";
  else if(d.completedStep===null&&!c.incident&&queuesEmpty&&reportsAcknowledged&&g.phase==="management"&&qualifiesForRecovery(c.snapshot))waiting="Observe new stable baseline game seconds with Run. Pausing adds no observations.";
  if(pendingSpikeAcknowledgement(c))pendingAction={label:"Review spike recognition"};
  else if(pendingSpikeDebrief(c))pendingAction={label:"Review spike test result"};
 } else if(c.dataStage) {
  add("growth","Data growth occurred",c.dataStage.consumed);
  add("queues","Application and Database queues empty",queuesEmpty);
  add("healthy","Healthy latency and service errors with completed requests",qualifiesForRecovery(c.snapshot));
  if(!c.dataStage.consumed&&!canEnterData(g))notice="Data growth waits for management, empty queues, no active incident and acknowledged reports.";
  if(spikesAvailable)pendingAction={label:"Continue to Traffic Spikes",action:{type:"enter_spikes"}};
 } else if(openingDone&&!c.scaling) {
  // The player stayed after the Opening: Scaling & Routing waits for Next, and none of its requirements apply yet.
  add("opening",c.launchWeek?"Launch Week completed":"Opening completed",true);
  if(g.phase!=="ended")notice=`${c.launchWeek?"Launch Week":"The Opening"} is complete. Continue to Scaling & Routing through Next in the chapter bar when you are ready.`;
  if(g.phase!=="ended")pendingAction={label:"Continue to Scaling & Routing",action:{type:"enter_scaling"}};
 } else if(openingDone) {
  add("headroom",`Database headroom: ${c.dbCapacity.toLocaleString("en-US")} / ${P.dbCapacity.toLocaleString("en-US")} ops/s`,!!c.scaling?.consumed||c.dbCapacity>=P.dbCapacity||!!c.scalingConsent);
  add("growth","Scaling growth occurred",!!c.scaling?.consumed);
  add("queues","Application and Database queues empty",queuesEmpty);
  if(!c.scaling?.consumed&&!c.scalingConsent&&c.dbCapacity<P.dbCapacity&&c.cashCents<=P.dbCostCents)notice="Next growth requires paid database headroom, but current cash cannot fund that investment. Pending revenue is available only after settlement; inspect finances and operating costs before advancing. Solvency alone does not guarantee an affordable growth investment.";
  if(dataAvailable)pendingAction={label:"Continue to Data Strategy",action:{type:"enter_data"}};
 } else if(prevention) {
  // Prevention stays a valid path, but its checks are not listed: they appear only seconds before the incident is due,
  // when they can rarely still be met, so the panel keeps the chapter's three requirements.
  add("growth","Opening growth occurred",preventionRequirements(c).growth);
  add("outcome","First growth handled and reviewed",!!c.openingPrevention?.outcome?.acknowledged);
  add("milestone","Opening milestone acknowledged",openingDone);
  if(pendingPreventionReview(c))pendingAction={label:"Review outcome"};
  else if(c.openingPrevention?.outcome?.acknowledged)waiting="Prevention recorded. Complete the verified Opening recognition to continue to Scaling & Routing.";
 } else if(c.launchWeek) {
  const lw=c.launchWeek;
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
  add("outcome","First growth handled and reviewed",false);
  add("milestone","Opening milestone acknowledged",false);
 }
 // Required acknowledgements take priority over stage continuation in every stage.
 if(g.phase==="review"&&c.reports.length)pendingAction={label:"Review postmortem"};
 // Launch Week awards its milestone mid-week but only lets it be acknowledged once the week is over and the research pick is spent.
 else if(launchResearchPending(g))waiting="Launch Week is over. Spend your free research pick on Caching or Autoscaling to see your score.";
 else if(milestoneBlocks(g))pendingAction={label:"Complete Opening"};
 if(!reportsAcknowledged&&g.phase!=="review"&&!c.incident)notice="A recorded recovered report lacks an acknowledgement, but no review is active. Export company evidence for investigation; this guidance cannot safely repair the saved state.";
 if(g.phase==="ended") { pendingAction=null;waiting=null;optional=null;notice=""+(g.outcome==="won"?"Campaign complete. Inspect your scorecard and final architecture before explicitly starting a new company.":"The company is bankrupt. Review final evidence and explicitly restart from the Menu.")+""; }
 const incomplete=requirements.filter(r=>!r.met),completed=requirements.filter(r=>r.met);
 const lockReason=c.spikeStage?notice:pendingAction?`Next action: ${pendingAction.label}.`:incomplete.length?incomplete[0].label:waiting;
 return {stage,nextStage,openingDone,dataAvailable,spikesAvailable,pendingMilestone,prevention,requirements,incomplete,completed,pendingAction,waiting,notice,optional,lockReason};
}
