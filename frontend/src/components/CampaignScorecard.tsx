import { CampaignReport } from "./CampaignReport";
import { scorecardSummary } from "@/game/campaignReport";
import type { CampaignScorecard as Scorecard } from "@/sim/campaignTypes";
import { Fragment } from "react";
import { BUDGET_NAMES } from "@/sim/errorBudget";
import { ERROR_BUDGET } from "@/sim/scenarios/errorBudget";
import { uptimePct } from "@/game/format";
const money=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n/100);
function ScorecardEvidence({card,pendingReview=false}:{card:Scorecard;pendingReview?:boolean}) {
 const m=card.measurement,scope=m.scope==="full-run"?"Whole run":"Since save upgrade";
 return <section><h2>Run scorecard</h2><p>{pendingReview?"Ready to complete campaign":card.outcome==="won"?"Campaign complete":"Company bankrupt"} · Registered users {card.users.toLocaleString("en-US")} {card.finalUserTarget?`/ ${card.finalUserTarget.toLocaleString("en-US")}`:""}</p>
 <p>Registration represents growth opportunity; rejected or failed requests earn no revenue.</p>
 <dl><dt>Cash remaining</dt><dd>{money(card.cashCents)}</dd><dt>Settled revenue</dt><dd>{money(card.revenueCents)}</dd><dt>Unsettled revenue (not spendable)</dt><dd>{money(card.pendingRevenueCents)}</dd>
 <dt>Infrastructure setup</dt><dd>{money(card.infrastructureSetupCents)}</dd><dt>Settled infrastructure operations</dt><dd>{money(card.infrastructureOperatingCents)}</dd><dt>Settled salaries</dt><dd>{money(card.salaryCents)}</dd><dt>Promotion spending</dt><dd>{money(card.promotionCents)}</dd>
 <dt>Rejected demand</dt><dd>{card.rejectedDemand.toLocaleString("en-US")} requests; potential revenue not served {money(card.opportunityCents)} (not an extra charge)</dd><dt>Failed requests</dt><dd>{card.failedDemand.toLocaleString("en-US")}</dd>
 <dt>Final operating week uptime</dt><dd>{card.finalWeekUptime===null?"Not yet measured":`${uptimePct(card.finalWeekUptime)} (objective 99.99%: ${card.finalWeekUptime>=ERROR_BUDGET.objective?"met":"missed"})`}</dd>
 <dt>Whole-run uptime</dt><dd>{card.wholeRunUptime===null?"No decided requests yet":uptimePct(card.wholeRunUptime)}</dd><dt>Whole-run largest outage</dt><dd>{card.wholeRunLargestOutage===null?"Unknown: this save began recording later":`${card.wholeRunLargestOutage} modeled seconds`}</dd>
 {card.budgets.map((b,i)=><Fragment key={i}><dt>Error budget: {BUDGET_NAMES[b.scenario]}</dt><dd>{b.lost.toLocaleString("en-US")} / {b.allowance.toLocaleString("en-US")} requests lost; {b.attempts} {b.attempts===1?"attempt":"attempts"}</dd></Fragment>)}
 <dt>{scope} observed service</dt><dd>{m.healthySteps} healthy / {m.eligibleSteps} eligible modeled seconds; longest degraded span {m.longestDegradedSteps} seconds, starting step {m.fromStep}</dd>
 <dt>Incidents</dt><dd>{card.incidentCount}</dd><dt>Final recurring cost</dt><dd>{money(card.recurringCents)} per 60-game-second operating period</dd></dl>
 <p>Uptime is the share of decided requests that were served: failed and turned-away requests count against it. Healthy service seconds have latency below 500 ms, service errors below 1%, positive admissions and completed outcomes.</p>
 {card.combinedMeasurement&&<p>Grow the Company: {card.combinedMeasurement.healthySteps} / {card.combinedMeasurement.eligibleSteps} healthy modeled seconds; longest degraded span {card.combinedMeasurement.longestDegradedSteps} seconds.</p>}
 <h3>Final architecture</h3><ul>{card.architecture.apps.map(a=><li key={a.id}>{a.id}: {a.capacity} req/s, {a.health}, {a.role}, {a.routed?"configured for traffic":"unrouted"}</li>)}</ul>
 <p>Database {card.architecture.dbCapacity} ops/s; routing {card.architecture.routing.mode}: {card.architecture.routing.targets.join(", ")}. Load balancer {card.architecture.loadBalancer?"deployed":"absent"}; cache {card.architecture.readCache?`${card.architecture.readCache.warmth/100}% warm` :"absent"}.</p>
 <p>Owned technologies: {card.ownedTechIds.join(", ")||"None"}. Deployed technologies: {card.deployedTechIds.join(", ")||"None"}.</p><p>Run {card.runId}; seed {card.seed}; captured at physical step {card.capturedStep}.</p></section>;
}

export default function CampaignScorecard({card,pendingReview=false}:{card:Scorecard;pendingReview?:boolean}) {
 return <section className="campaign-report-shell" aria-label="Run scorecard"><CampaignReport key={`${card.runId}:${card.capturedStep}:${pendingReview}`} lesson={scorecardSummary(card,pendingReview)}><ScorecardEvidence card={card} pendingReview={pendingReview}/></CampaignReport></section>;
}
