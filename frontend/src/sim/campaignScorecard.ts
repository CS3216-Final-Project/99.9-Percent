import type { Campaign, CampaignScorecard, ErrorBudget, ServiceMeasurement, Snapshot } from "./campaignTypes";
import type { GameState } from "./types";
import { openingTuning } from "./launchWeek";
import { clone } from "./state";
import { completedTechIds } from "./tech";
import { qualifiesForRecovery } from "./step";
import { budgetUsed, requestUptime, windowUptime } from "./errorBudget";
import { ERROR_BUDGET as B } from "./scenarios/errorBudget";
import { APPLICATION_SCALING as P } from "./scenarios/applicationScaling";
import { DATA_STRATEGY as D } from "./scenarios/dataStrategy";
import { TRAFFIC_SPIKES as T } from "./scenarios/trafficSpikes";
import { APPLICATION_RELIABILITY as R } from "./scenarios/applicationReliability";
export function emptyServiceMeasurement(fromStep=1,scope:ServiceMeasurement["scope"]="full-run"):ServiceMeasurement {
 return {scope,fromStep,lastStep:fromStep-1,eligibleSteps:0,healthySteps:0,degradedSteps:0,longestDegradedSteps:0};
}
export function observeService(m:ServiceMeasurement,s:Snapshot):void {
 if(s.step<=m.lastStep)return;
 m.lastStep=s.step;
 if(s.incoming<=0){m.degradedSteps=0;return;}
 m.eligibleSteps++;
 if(qualifiesForRecovery(s)){m.healthySteps++;m.degradedSteps=0;}
 else {m.degradedSteps++;m.longestDegradedSteps=Math.max(m.longestDegradedSteps,m.degradedSteps);}
}
/** Operating cost of the current architecture for one settlement period, at the rates settlement charges. */
export function recurringCost(c:Campaign):number {
 const t=openingTuning(c),db=c.dbCapacity===D.dbCapacity?D.dbWeeklyCents:c.dbCapacity>=P.dbCapacity?P.dbWeeklyCents:c.upgraded?t.upgradedDbWeeklyCents:t.dbWeeklyCents;
 return t.engineers*t.salaryWeeklyCents+c.apps.reduce((n,a)=>n+(a.tier==="large"?P.appWeeklyCents:t.appWeeklyCents),0)+db+
 (c.loadBalancer?P.lbWeeklyCents:0)+(c.readCache?D.cacheWeeklyCents:0)+(c.spikeStage?.controller?T.controllerWeeklyCents:0)+
 (c.reliabilityStage?.checksStep!=null?R.checksWeeklyCents:0)+(c.reliabilityStage?.failover?R.failoverWeeklyCents:0);
}
/** The final attempt of every judged scenario, with how many attempts it took. */
function judgedBudgets(c:Campaign):CampaignScorecard["budgets"] {
 const out:CampaignScorecard["budgets"]=[];
 const add=(b:ErrorBudget|null|undefined)=>{if(b)out.push({scenario:b.scenario,allowance:b.allowance,lost:budgetUsed(c,b),attempts:b.attempt});};
 add(c.spikeStage?.budget);add(c.reliabilityStage?.budget);
 for(const r of c.combinedStage?.completedRounds??[])add(r.budget);
 return out;
}
export function captureScorecard(s:GameState,outcome:"won"|"bankrupt"):CampaignScorecard {
 const c=s.campaign!,m=c.serviceMeasurement??emptyServiceMeasurement(c.step+1,"since-upgrade"),d=c.reliabilityStage;
 const promotions=c.actions.filter(a=>a.type==="promotion").reduce((n,a)=>n+a.costCents,0);
 const deployed:string[]=[];
 if(c.apps.some(a=>a.tier==="large"))deployed.push("larger_servers");
 if(c.loadBalancer)deployed.push("load_balancing");if(c.spikeStage?.controller)deployed.push("autoscaling");
 if(c.dbCapacity>=1000)deployed.push("larger_database");if(c.readCache)deployed.push("caching");
 if(c.readCache?.tuned)deployed.push("cache_tuning");if(d?.checksStep!=null)deployed.push("health_checks");
 if(c.apps.some(a=>a.role==="spare")||c.actions.some(a=>["create-spare","reserve-spare"].includes(a.type)&&a.activatedStep!==null))deployed.push("standby");
 if(d?.failover)deployed.push("auto_failover");
 return {runId:c.runId,seed:s.seed,outcome,capturedStep:c.step,users:c.combinedStage?.users??2000,
 finalUserTarget:c.combinedStage?.finalUserTarget??null,cashCents:c.cashCents,revenueCents:c.revenueCents,pendingRevenueCents:c.ledger.successes*openingTuning(c).revenueCents,
 infrastructureSetupCents:c.investedCents-promotions,promotionCents:promotions,
 infrastructureOperatingCents:c.settlements.reduce((n,x)=>n+x.appCents+x.dbCents+(x.lbCents??0)+(x.cacheCents??0)+(x.controllerCents??0)+(x.checksCents??0)+(x.failoverCents??0),0),
 salaryCents:c.settlements.reduce((n,x)=>n+x.salaryCents,0),rejectedDemand:c.cumulative.rejected,
 opportunityCents:c.cumulative.rejected*openingTuning(c).revenueCents,failedDemand:c.cumulative.failed,incidentCount:c.trace.filter(t=>t.type==="incident-opened").length,
 recurringCents:recurringCost(c),measurement:clone(m),combinedMeasurement:c.combinedStage?clone(c.combinedStage.service):null,
 wholeRunUptime:requestUptime(c.cumulative.successful,c.cumulative.failed,c.cumulative.rejected),
 finalWeekUptime:c.combinedStage?.finalWeekFromStep!=null&&c.step-c.combinedStage.finalWeekFromStep>=B.finalWeekSteps?windowUptime(c.recent,B.finalWeekSteps):null,
 budgets:judgedBudgets(c),
 wholeRunLargestOutage:m.scope==="full-run"?m.longestDegradedSteps:null,ownedTechIds:completedTechIds(s),deployedTechIds:deployed,
 architecture:clone({apps:c.apps,routing:c.routing,loadBalancer:c.loadBalancer,dbCapacity:c.dbCapacity,readCache:c.readCache,
 controller:c.spikeStage?.controller??null,checksStep:d?.checksStep??null,failover:d?.failover??null})};
}
