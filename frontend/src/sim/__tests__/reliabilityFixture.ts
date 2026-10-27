import { spikeCompany, act, tick, replay } from "./spikeFixtures";
import type { GameState } from "../types";
export { act, tick, replay };
export function readyReliability(auto=false):GameState {
 // Both research paths prepare a third app before the first pulse: two apps alone go over Traffic Spikes' error budget.
 let s=spikeCompany(auto);
 s=tick(act(s,{type:"add_server"}),2);s=tick(act(s,{type:"scale_up",appId:"app-3"}),3);s=tick(act(s,{type:"set_routing",mode:"balanced",targets:["app-1","app-2","app-3"]}),1);
 for(let i=0;i<250&&s.campaign!.spikeStage!.completedStep===null;i++){
  if(s.phase==="review")s=act(s,{type:"acknowledge_review"});
  s=tick(s);if(s.phase==="ended")throw Error("Reliability fixture bankrupt");
 }
 s=act(s,{type:"acknowledge_spikes"});return s;
}
export function reliabilityCompany():GameState {return act(readyReliability(),{type:"enter_reliability"});}
/** Health Checks alone: a failed app leaves routing and the other two carry baseline demand, keeping three apps installed. */
export function checkedReliability():GameState {
 let s=reliabilityCompany();
 s=act(s,{type:"unlock_reliability",tech:"health_checks"});return tick(act(s,{type:"deploy_health_checks"}),2);
}
/** Health Checks, a newly installed spare and Automatic Failover, keeping all three apps serving. */
export function resilientReliability():GameState {
 let s=reliabilityCompany();
 s=act(s,{type:"unlock_reliability",tech:"health_checks"});s=tick(act(s,{type:"deploy_health_checks"}),2);
 s=act(s,{type:"unlock_reliability",tech:"standby"});s=tick(act(s,{type:"install_spare"}),2);
 s=act(s,{type:"unlock_reliability",tech:"auto_failover"});s=tick(act(s,{type:"deploy_failover"}),2);return s;
}
export function preparedReliability():GameState {
 let s=reliabilityCompany();
 s=act(s,{type:"unlock_reliability",tech:"health_checks"});s=tick(act(s,{type:"deploy_health_checks"}),2);
 s=act(s,{type:"unlock_reliability",tech:"standby"});
 s=tick(act(s,{type:"set_routing",mode:"balanced",targets:["app-1","app-2"]}),1);
 s=tick(act(s,{type:"reserve_spare",appId:"app-3"}),1);
 s=act(s,{type:"unlock_reliability",tech:"auto_failover"});s=tick(act(s,{type:"deploy_failover"}),2);return s;
}
