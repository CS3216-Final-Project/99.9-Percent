import { spikeCompany, act, tick, replay } from "./spikeFixtures";
import { incidentAwaitingResponse } from "../step";
import { openingTuning } from "../launchWeek";
import { installPending } from "../reliability";
import { currentFault } from "../combinedCampaign";
import { TRAFFIC_SPIKES as T } from "../scenarios/trafficSpikes";
import type { Action, GameState } from "../types";
export { act, tick, replay };
export function readyReliability(auto=false):GameState {
 let s=spikeCompany(auto);
 if(!auto){s=tick(act(s,{type:"add_server"}),2);s=tick(act(s,{type:"scale_up",appId:"app-3"}),3);s=tick(act(s,{type:"set_routing",mode:"balanced",targets:["app-1","app-2","app-3"]}),1);}
 for(let i=0;i<400&&s.campaign!.spikeStage!.completedStep===null;i++){
  if(s.phase==="review")s=act(s,{type:"acknowledge_review"});
  else if(s.campaign!.incident&&incidentAwaitingResponse(s.campaign!)&&!installPending(s.campaign!))s=respondToIncident(s);else if(s.campaign!.limit!==null&&!s.campaign!.incident&&!s.campaign!.pending.some(a=>a.type==="unlimit"))s=act(s,{type:"set_traffic_limit",enabled:false});
  s=tick(s);if(s.phase==="ended")throw Error("Reliability fixture bankrupt");
 }
 s=act(s,{type:"acknowledge_spikes"});return s;
}
export function reliabilityCompany():GameState {return act(readyReliability(),{type:"enter_reliability"});}
export function preparedReliability():GameState {
 let s=reliabilityCompany();
 s=act(s,{type:"unlock_reliability",tech:"health_checks"});s=tick(act(s,{type:"deploy_health_checks"}),2);
 s=act(s,{type:"unlock_reliability",tech:"standby"});
 s=tick(act(s,{type:"set_routing",mode:"balanced",targets:["app-1","app-2"]}),1);
 s=tick(act(s,{type:"reserve_spare",appId:"app-3"}),1);
 s=act(s,{type:"unlock_reliability",tech:"auto_failover"});s=tick(act(s,{type:"deploy_failover"}),2);return s;
}
/** Accepted responses for an incident demanding one: restore the current failure, then generic
 * headroom or admission relief — never inventing actions the fixture's stage does not allow. */
export function respondToIncident(s:GameState):GameState {
 const c=s.campaign!, d=c.reliabilityStage, attempts:Action[]=[];
 const fault=currentFault(c);
 if(fault&&fault.restoredStep===null)attempts.push({type:"restore_app",appId:fault.targetId});
 if(d&&!d.owned.includes("health_checks")&&!d.owned.includes("standby")&&!d.owned.includes("auto_failover"))attempts.push({type:"unlock_reliability",tech:"health_checks"});
 if(d?.owned.includes("health_checks")&&d.checksStep===null)attempts.push({type:"deploy_health_checks"});
 attempts.push({type:"set_traffic_limit",enabled:c.limit===null});
 const base=c.apps.filter(a=>a.tier==="base"&&a.state==="active"&&a.role!=="spare").pop();
 if(base)attempts.push({type:"scale_up",appId:base.id});
 if(c.apps.length<(c.spikeStage?T.maximum:openingTuning(c).maxApps))attempts.push({type:"add_server"});
 for(const a of attempts){try{return act(s,a);}catch{/* try the next response */}}
 return s;
}
