import type { Action, ActionResult, GameState } from "./types";
type Rejection = Extract<ActionResult, { ok: false }>;
import { trace } from "./trace";
import { healthy, reportsAcknowledged } from "./reliability";
import { qualifiesForRecovery } from "./step";
import { captureScorecard } from "./campaignScorecard";
/** The operating conditions Complete campaign checks, each named so the interface can say which one is unmet. */
export function completionGates(s:GameState) {
 const c=s.campaign!;
 return {management:s.phase==="management",cash:c.cashCents>0,incident:!c.incident,pending:!c.pending.length,
  queues:!c.dbBacklog&&c.apps.every(a=>!a.backlog),apps:c.apps.every(healthy),reports:reportsAcknowledged(c),
  healthy:qualifiesForRecovery(c.snapshot),baseline:c.incomingRate===2400};
}
/** Stay Online is Guided Mode's last chapter: once it is acknowledged, a stable company can complete the campaign. */
export function canCompleteCampaign(s:GameState):boolean {
 const c=s.campaign,d=c?.reliabilityStage;
 return !!c&&!!d?.acknowledged&&d.completedStep!==null&&!!c.openingMilestone?.acknowledged&&!!c.spikeStage?.acknowledged&&
 Object.values(completionGates(s)).every(Boolean);
}
/** Every check runs before the first mutation, so a rejection leaves `s` untouched. */
export function completionAction(s:GameState,action:Action):Rejection|null|undefined {
 if(action.type!=="complete_campaign"&&action.type!=="accept_scaling_risk")return undefined;
 const fail=(message:string):Rejection=>({ok:false,reason:"invalid",message});
 if(s.phase==="ended"||s.phase==="review")return fail("Finish the report or start a new company first.");
 const c=s.campaign!;
 if(action.type==="accept_scaling_risk"){
  if(!c.scaling||c.scaling.consumed||c.scalingConsent||!c.openingMilestone?.acknowledged||s.phase!=="management")return fail("Risk consent is unavailable or already recorded.");
  c.scalingConsent={policyVersion:1,acceptedStep:c.step};trace(c,"scaling-growth-risk-accepted",{policyVersion:1,dbCapacity:c.dbCapacity,incoming:c.incomingRate,nextDemand:1400,cashCents:c.cashCents});return null;
 }
 if(!canCompleteCampaign(s))return fail("Requires acknowledged Stay Online, stable baseline management, empty queues, healthy apps and finished actions/reports.");
 c.scorecard=captureScorecard(s,"won");s.phase="ended";s.outcome="won";
 trace(c,"campaign-completed",{cashCents:c.cashCents});return null;
}
