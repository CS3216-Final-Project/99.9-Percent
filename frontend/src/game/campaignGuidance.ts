import { canEnterCombined, canStartGrowth, pendingCombined } from "@/sim/combinedCampaign";
import { canEnterReliability, pendingReliability } from "@/sim/reliability";
import type { GameState, Action } from "@/sim";
import { canEnterData, qualifiesForRecovery } from "@/sim/step";
import { canEnterSpikes, pendingSpikeAcknowledgement } from "@/sim/autoscaling";
import { pendingPreventionReview, preventionAvailable, preventionRequirements } from "@/sim/openingPrevention";
import { APPLICATION_SCALING as P } from "@/sim/scenarios/applicationScaling";
import { TRAFFIC_SPIKES as T } from "@/sim/scenarios/trafficSpikes";
import type { Campaign } from "@/sim/campaignTypes";

/** A "check" is a standing condition the company must keep; a step is one move in the chapter's sequence. */
export interface Requirement { id: string; label: string; met: boolean; kind?: "check" | "step"; hint?: string; /** A step the clock completes rather than a player action. */ wait?: boolean }
/** The opening milestone gates time only once it can be acknowledged: Launch Week defers it until completion. */
export const milestoneBlocks = (c: Campaign) =>
  !!c.openingMilestone && !c.openingMilestone.acknowledged && (!c.launchWeek || c.launchWeek.completedStep !== null);
export interface GuidanceAction { label: string; action?: Action }
/** One shared objective for the chapter bar; detailed actions and gates remain in the overview. */
export function campaignObjective(g: GameState) {
 const c=g.campaign!;
 if(g.phase==="ended") return g.outcome==="won"?"Inspect the final architecture and scorecard.":"Review the company's finances and recorded evidence.";
 if(g.phase==="review") return "Read the postmortem before continuing the same company.";
 if(c.incident) return "Restore stable service while weighing cost and rejected demand.";
 if(c.launchWeek&&!c.launchWeek.completedStep) return "Keep the service up through launch week.";
 if(c.combinedStage) return "Serve growing demand, manage costs and review each outcome.";
 if(c.reliabilityStage) return "Keep service stable through an application failure, then review the evidence.";
 if(c.spikeStage) return "Handle changing demand while managing capacity costs.";
 if(c.dataStage) return "Compare workload, cache hits and database pressure as demand grows.";
 if(c.openingMilestone?.acknowledged) return "Prepare the system for the next growth wave.";
 if(preventionAvailable(c)) return "Inspect the Application and Database; keep service healthy at full demand.";
 return "Observe demand and compare component evidence.";
}
/** Read-only presentation of existing gates. Never saved and never changes engine inputs. */
export function campaignGuidance(g: GameState) {
 const c=g.campaign!;
 const openingDone=!!c.openingMilestone?.acknowledged;
 const stage=c.combinedStage?"Grow the Company":c.reliabilityStage?"Stay Online":c.spikeStage?"Traffic Spikes & Autoscaling":c.dataStage?"Data Strategy":openingDone?"Scaling & Routing":c.launchWeek?"Launch Week":"Opening";
 const dataAvailable=!c.dataStage&&canEnterData(g),spikesAvailable=canEnterSpikes(g);
 const prevention=preventionAvailable(c);
 const pendingMilestone=!!c.openingMilestone&&!openingDone;
 const reportsAcknowledged=c.reports.every(r=>c.trace.some(t=>t.type==="review-acknowledged"&&t.data.incidentId===r.id));
 const queuesEmpty=c.dbBacklog===0&&c.apps.every(a=>a.backlog===0);
 const requirements:Requirement[]=[];
 const finalGoals:Requirement[]=[];
 const add=(id:string,label:string,met:boolean,hint?:string)=>requirements.push({id,label,met,kind:"step",hint});
 const check=(id:string,label:string,met:boolean,hint?:string)=>requirements.push({id,label,met,kind:"check",hint});
 const wait=(id:string,label:string,met:boolean,hint:string)=>requirements.push({id,label,met,kind:"step",hint,wait:true});
 // Checks pause while the chapter's own event (a planned failure or traffic spike) is meant to break them.
 let checksPaused:string|null=null;
 // Shared standing checks, worded as what the player sees rather than as engine gates.
 const cash=(met=c.cashCents>0)=>check("cash","Company cash is positive",met,"Cut running costs, or wait for weekly revenue to settle.");
 const management=()=>check("management","No report is waiting to be read",g.phase!=="review","Finish reading the open report.");
 const calm=(met=!c.incident)=>check("incident","No incident is open",met,"Follow Recovery progress until the incident closes.");
 const queues=(met=queuesEmpty)=>check("queues","Application and Database queues are empty",met,"Wait for queued requests to drain, or add capacity.");
 const reports=()=>check("reports","Every incident report has been read",reportsAcknowledged);
 const healthy=(met=qualifiesForRecovery(c.snapshot))=>check("healthy","Requests are fast and error-free",met,"Inspect the Application and Database for overload.");
 let waiting:string|null=null,notice:string|null=null,optional:string|null=null;
 let pendingAction:GuidanceAction|null=null;
 const nextStage=c.combinedStage?"Guided Mode complete":c.reliabilityStage?"Grow the Company":c.spikeStage?"Stay Online":c.dataStage?"Traffic Spikes & Autoscaling":openingDone?"Data Strategy":"Scaling & Routing";
 if(c.combinedStage){
  const d=c.combinedStage,r=d.currentRound;
  cash();check("admission","Serving full demand with no traffic limit",c.limit===null&&c.snapshot.admitted===c.snapshot.incoming,"Remove the traffic limit once capacity can handle every request.");
  calm();queues();reports();
  check("healthy","Servers are up and requests are fast and error-free",c.apps.every(a=>a.health!=="failed")&&qualifiesForRecovery(c.snapshot),"Inspect the servers and Database for failures or overload.");
  check("pending","Queued changes have finished",!c.pending.length,"Wait for scheduled deployments and routing changes to activate.");
  check("promotion","No promotion is running",!c.promotion||c.step>=c.promotion.endStep,"Wait for the promotion to end.");
  if(r?.fault)add("restored","Restore the failed server",r.fault.restoredStep!==null,"Inspect the servers to find it, then restore it from its panel.");
  const checks=r?r.stableSteps:d.nextRoundIndex===3?d.finalStableSteps:d.readinessSteps;
  wait("checks",`${r?"Keep the wave stable":d.nextRoundIndex===3?"Keep final service stable":"Serve full demand steadily"}: ${checks} / 5 s`,checks===5,"Press Run and keep service healthy. Pausing adds no time, and an unhealthy second restarts the count.");
  finalGoals.push({id:"rounds",label:`Growth outcomes acknowledged: ${d.completedRounds.length} / 3`,met:d.completedRounds.length===3},
   {id:"target",label:`Registered users: ${d.users.toLocaleString("en-US")} / ${d.finalUserTarget.toLocaleString("en-US")}`,met:d.users>=d.finalUserTarget},
   {id:"completion",label:"Final Campaign review completed",met:d.acknowledged});
  if(d.finalReview)pendingAction={label:"Review campaign scorecard"};
  else if(pendingCombined(c))pendingAction={label:"Review growth outcome"};
  else if(canStartGrowth(g))pendingAction={label:"Start next growth wave",action:{type:"start_growth_wave"}};
  else if(r)waiting=r.startedStep===null?"The next growth wave is announced. Prepare and resume when ready.":r.pressureEndedStep===null?"Watch the workload and the capacity of the healthy servers receiving traffic, and respond to what you see.":"The wave has passed. Restore any failed server, read any report and serve full demand.";
  else waiting=d.nextRoundIndex===3?"Keep serving full demand after reviewing the last outcome.":"Finish any promotion before starting the next wave.";
  optional="Promotion is optional and temporarily adds demand. Registration is growth opportunity; rejected requests do not earn revenue.";
 } else if(c.reliabilityStage){const d=c.reliabilityStage;
  cash();management();calm();queues();healthy();reports();
  if(!d.fault)check("pending","Queued changes have finished",c.pending.length===0,"Wait for scheduled deployments to activate before starting the test.");
  add("armed","Start the reliability test",!!d.fault,"One application server will fail on purpose, so you can practise recovering.");
  wait("observed","An application server fails",d.fault?.startedStep!==null&&!!d.fault,"Press Run; the failure starts within a few game seconds.");
  add("restored","The failed server is restored",d.fault?.restoredStep!==null&&!!d.fault,"Inspect the servers to find it, then restore it from its panel. Routing or a traffic limit can protect service meanwhile.");
  wait("observations",`Keep service stable: ${d.stableSteps} / 5 s`,d.completedStep!==null,"Press Run with healthy service and read any incident report. Pausing adds no time, and an unhealthy second restarts the count.");
  if(d.fault&&d.completedStep===null)checksPaused="Company checks pause while the reliability test runs.";
  add("recognition","Review the reliability outcome",d.acknowledged);
  if(pendingReliability(c))pendingAction={label:"Review reliability outcome"};else if(!d.fault)pendingAction={label:"Start reliability test",action:{type:"arm_reliability"}};
  if(d.acknowledged){notice="Stay Online completed. Continue the same company into Grow the Company once service is healthy and all changes have finished.";if(canEnterCombined(g))pendingAction={label:"Continue to Grow the Company",action:{type:"enter_combined"}};}
  optional="Health Checks, spares and failover are optional. A failed server also returns on its own, or you can restore it for free.";} else if(c.spikeStage) {
  const d=c.spikeStage;
  management();calm();queues();reports();healthy();
  check("baseline","Traffic is back to normal",c.incomingRate===T.baseline,"Traffic falls back after the second spike.");
  wait("pulses","Both traffic spikes end",c.step>=d.deadlines[3],"Press Run to play through both announced spikes.");
  wait("observations",`Keep normal traffic stable: ${d.baselineStableSteps} / 5 s`,d.completedStep!==null,"Press Run with healthy service. Pausing adds no time, and an unhealthy second restarts the count.");
  if(c.step<d.deadlines[3])checksPaused="Company checks pause while the traffic spikes run.";
  add("recognition","Review the spike response",d.acknowledged);
  notice=canEnterReliability(g)?"Stay Online is available through Next in the chapter bar.":"Stay Online opens after you review the spike response with healthy normal traffic and empty queues.";
  optional="Autoscaling is optional. Manual capacity, admission relief and hybrid responses remain valid.";
  if(pendingSpikeAcknowledgement(c))pendingAction={label:"Review spike recognition"};
 } else if(c.dataStage) {
  cash();check("milestone",c.launchWeek?"Launch Week completed":"Opening chapter completed",openingDone);management();calm();queues();reports();healthy();
  wait("growth","Database demand grows",c.dataStage.consumed,"Press Run until the new workload arrives.");
  add("continue","Continue to Traffic Spikes",false,"Compare cache hits with database demand in the Database panel, then continue.");
  optional="The read cache and database upgrades are optional; you can continue without them.";
  if(!c.dataStage.consumed&&!canEnterData(g))notice="Database growth waits until no report is open, no incident is open, queues are empty and every report has been read.";
  if(spikesAvailable)pendingAction={label:"Continue to traffic spikes",action:{type:"enter_spikes"}};
 } else if(openingDone) {
  management();calm();queues();reports();
  // Launch Week's score card enters Scaling & Routing itself; only an Opening company still has to choose it.
  if(!c.launchWeek)add("stage","Start Scaling & Routing",!!c.scaling,"Use Continue to scaling and routing.");
  if(!c.scaling?.consumed)add("headroom",`Database headroom: ${c.dbCapacity.toLocaleString("en-US")} / ${P.dbCapacity.toLocaleString("en-US")} ops/s`,c.dbCapacity>=P.dbCapacity||!!c.scalingConsent,"Upgrade the Database, or accept the growth risk.");
  wait("growth","The next growth wave arrives",!!c.scaling?.consumed,"Press Run until more users arrive.");
  if(c.scaling?.consumed)add("continue","Continue to Data Strategy",false,"Check that your new servers receive traffic, then continue.");
  if(!c.scaling?.consumed&&!c.scalingConsent&&c.dbCapacity<P.dbCapacity&&c.cashCents<=P.dbCostCents)notice="Next growth requires paid database headroom, but current cash cannot fund that investment. Pending revenue is available only after settlement; inspect finances and operating costs before advancing. Solvency alone does not guarantee an affordable growth investment.";
  if(!c.scaling&&g.phase!=="ended")pendingAction={label:"Continue to scaling and routing",action:{type:"enter_scaling"}};
  else if(dataAvailable)pendingAction={label:"Continue to data strategy",action:{type:"enter_data"}};
 } else if(prevention) {
  const r=preventionRequirements(c);
  calm(r.noIncident);cash(r.positiveCash);
  check("admission","Serving all 800 req/s with no traffic limit",r.fullDemand,c.limit!==null?"A traffic limit turns users away, so prevention can't count. Remove it once capacity can serve all 800 req/s.":"Add capacity until every request is served.");
  queues(r.emptyQueues);healthy(r.healthy);
  wait("growth","More users arrive",r.growth,"Press Run until traffic grows.");
  add("app-inspection","Inspect the Application",r.applicationInspected,"Use Inspect Application under the stable-service count.");
  add("db-inspection","Inspect the Database",r.databaseInspected,"Use Inspect Database under the stable-service count.");
  wait("observations",`Keep service stable: ${c.openingPrevention?.stableSteps??0} / 5 s`,!!c.openingPrevention?.outcome,"Press Run with healthy service. Pausing adds no time, and an unhealthy second restarts the count.");
  add("review","Read the prevention review",!!c.openingPrevention?.outcome?.acknowledged);
  add("milestone","Complete the Opening chapter",openingDone);
  optional="Preventing the outage and recovering from one are both valid paths through Opening.";
  if(pendingPreventionReview(c))pendingAction={label:"Review outcome"};
  else if(c.openingPrevention?.outcome?.acknowledged)waiting="Prevention recorded. Complete the Opening chapter to continue to Scaling & Routing.";
 } else if(c.launchWeek) {
  const lw=c.launchWeek,weekOver=lw.completedStep!==null;
  cash();
  // The week's script in order: the database overload and its postmortem, the free research point, then the score.
  add("recovery","Fix the database overload",c.reports.length>0||weekOver,"Press Run. When the database overloads, inspect it and upgrade it.");
  add("review","Read the postmortem",reportsAcknowledged&&c.reports.length>0||weekOver);
  (lw.researchEarned?add:wait)("research","Spend the research pick",!!lw.tech,lw.researchEarned?"Choose Caching or Autoscaling under Research pick.":"Press Run. A free research point arrives during the week.");
  wait("launch","The week ends",weekOver,"Press Run, or End week to skip ahead.");
  add("milestone","Review your uptime score",openingDone);
  optional="The research pick and the upgraded database carry into the later chapters.";
 } else if(c.incident||c.openingRecovered||c.reports.length||pendingMilestone) {
  const prevented=!!c.openingMilestone?.outcomeId;
  add("recovery",prevented?"Prevent the outage":"Recover from the incident",prevented?!!c.openingPrevention?.outcome:c.openingRecovered,"Find the overloaded component and add capacity or limit traffic until service is stable.");
  add("review",prevented?"Read the prevention review":"Read the postmortem",prevented?!!c.openingPrevention?.outcome?.acknowledged:reportsAcknowledged&&c.reports.length>0);
  add("milestone","Complete the Opening chapter",openingDone);
 } else {
  wait("growth","More users arrive",c.consumedEvents.includes("opening-growth"),"Press Run and watch demand grow.");
  add("outcome","Prevent an outage, or recover from one",false,"Inspect the Application and Database to see which will struggle first.");
  add("milestone","Complete the Opening chapter",false);
 }
 // Required acknowledgements take priority over stage continuation in every stage.
 if(g.phase==="review"&&c.reports.length)pendingAction={label:"Review postmortem"};
 else if(pendingMilestone)pendingAction={label:"Complete Opening"};
 if(!reportsAcknowledged&&g.phase!=="review"&&!c.incident)notice="A recorded recovered report lacks an acknowledgement, but no review is active. Export company evidence for investigation; this guidance cannot safely repair the saved state.";
 if(g.phase==="ended") { pendingAction=null;waiting=null;notice=""+(g.outcome==="won"?"Campaign complete. Inspect your scorecard and final architecture before explicitly starting a new company.":"The company is bankrupt. Review final evidence and explicitly restart from the Menu.")+""; }
 // "Continue to …" is the chapter's last step, never a reason the chapter is blocked.
 const incomplete=requirements.filter(r=>!r.met&&r.id!=="continue"),completed=requirements.filter(r=>r.met);
 const steps=requirements.filter(r=>r.kind!=="check"),checks=requirements.filter(r=>r.kind==="check");
 // Only the sequence is counted, so a standing check going red never makes progress run backwards.
 const current=steps.find(r=>!r.met)??null;
 const lockReason=c.spikeStage&&!c.combinedStage?notice:pendingAction?`Next action: ${pendingAction.label}.`:incomplete.length?incomplete[0].label:waiting;
 return {stage,nextStage,openingDone,dataAvailable,spikesAvailable,pendingMilestone,prevention,finalGoals,requirements,steps,checks,checksPaused,current,incomplete,completed,pendingAction,waiting,notice,optional,lockReason};
}
