import {reliabilityCompany,preparedReliability,respondToIncident,act,tick} from "./reliabilityFixture";
import {incidentAwaitingResponse} from "../step";
import {installPending} from "../reliability";
import {canCompleteCampaign} from "../campaignCompletion";
import type {GameState} from "../types";
import {newGame} from "../index";
export {act,tick};
/** Stay Online's outcome, awaiting the player's choice between staying and completing the campaign. */
export function reliabilityReview(){let s=act(reliabilityCompany(),{type:"arm_reliability"});for(let i=0;i<400&&!s.campaign!.reliabilityStage!.completedStep;i++){if(s.phase==="review")s=act(s,{type:"acknowledge_review"});else if(s.campaign!.incident&&incidentAwaitingResponse(s.campaign!)&&!installPending(s.campaign!))s=respondToIncident(s);else if(s.campaign!.dbBacklog&&s.campaign!.limit===null&&!s.campaign!.pending.some(a=>a.type==="limit"))s=act(s,{type:"set_traffic_limit",enabled:true});else if(s.campaign!.limit!==null&&!s.campaign!.incident&&!s.campaign!.dbBacklog&&!s.campaign!.pending.some(a=>a.type==="unlimit"))s=act(s,{type:"set_traffic_limit",enabled:false});s=tick(s);if(s.phase==="ended")throw Error("Fixture bankrupt");}return s;}
/** A company that stayed after Stay Online and can complete the campaign. */
export function completedReliability(){const s=act(reliabilityReview(),{type:"acknowledge_reliability"});if(!canCompleteCampaign(s))throw Error("Completion not ready");return s;}
/** A company that completed Guided Mode. */
export function wonCompany():GameState{return act(completedReliability(),{type:"complete_campaign"});}
/** A protected company after Stay Online, with app-2 then reserved as the spare. */
export function protectedCompany(){let s=act(preparedReliability(),{type:"arm_reliability"});for(let i=0;i<400&&s.campaign!.reliabilityStage!.completedStep===null;i++){if(s.phase==="review")s=act(s,{type:"acknowledge_review"});else if(s.campaign!.incident&&incidentAwaitingResponse(s.campaign!)&&!installPending(s.campaign!))s=respondToIncident(s);else if(s.campaign!.dbBacklog&&s.campaign!.limit===null&&!s.campaign!.pending.some(a=>a.type==="limit"))s=act(s,{type:"set_traffic_limit",enabled:true});else if(s.campaign!.limit!==null&&!s.campaign!.incident&&!s.campaign!.dbBacklog&&!s.campaign!.pending.some(a=>a.type==="unlimit"))s=act(s,{type:"set_traffic_limit",enabled:false});s=tick(s);}s=act(s,{type:"acknowledge_reliability"});return tick(act(s,{type:"reserve_spare",appId:"app-2"}),1);}

/** Two full-company strategies built solely from accepted actions and settlements. */
export function strategyPredecessor(horizontal=false){
 let s=tick(newGame(0,horizontal?"horizontal-strategy":"vertical-strategy"),6);s=act(s,{type:"start_db_upgrade"});while(s.phase!=="review")s=tick(s);s=act(act(s,{type:"acknowledge_review"}),{type:"acknowledge_milestone"});
 const buy=(a:Parameters<typeof act>[1],delay:number)=>{s=tick(act(s,a),delay);};
 buy({type:"set_traffic_limit",enabled:true},1);buy({type:"start_db_upgrade"},3);buy({type:"add_server"},2);
 if(!horizontal){buy({type:"scale_up",appId:"app-1"},3);buy({type:"scale_up",appId:"app-2"},3);}
 buy({type:"deploy_load_balancer"},2);buy({type:"set_routing",mode:"balanced",targets:["app-1","app-2"]},1);buy({type:"set_traffic_limit",enabled:false},1);
 while(s.campaign!.step<180){if(s.phase==="review")s=act(s,{type:"acknowledge_review"});else if(s.campaign!.incident&&incidentAwaitingResponse(s.campaign!)&&!installPending(s.campaign!))s=respondToIncident(s);else if(s.campaign!.dbBacklog&&s.campaign!.limit===null&&!s.campaign!.pending.some(a=>a.type==="limit"))s=act(s,{type:"set_traffic_limit",enabled:true});else if(s.campaign!.limit!==null&&!s.campaign!.incident&&!s.campaign!.dbBacklog&&!s.campaign!.pending.some(a=>a.type==="unlimit"))s=act(s,{type:"set_traffic_limit",enabled:false});s=tick(s);}
 buy({type:"set_traffic_limit",enabled:true},1);s=act(s,{type:"enter_data",profile:"read-heavy"});
 if(horizontal){buy({type:"deploy_cache"},2);buy({type:"tune_cache"},2);s=tick(s,7);}
 else {buy({type:"start_db_upgrade"},4);}
 if(!horizontal)buy({type:"set_traffic_limit",enabled:false},1);s=act(s,{type:"enter_spikes"});
 if(horizontal){buy({type:"add_server"},2);buy({type:"set_routing",mode:"balanced",targets:["app-1","app-2","app-3"]},1);buy({type:"set_traffic_limit",enabled:false},1);}
 if(!horizontal){buy({type:"add_server"},2);buy({type:"scale_up",appId:"app-3"},3);buy({type:"set_routing",mode:"balanced",targets:["app-1","app-2","app-3"]},1);}
 for(let i=0;i<400&&s.campaign!.spikeStage!.completedStep===null;i++){if(s.phase==="review")s=act(s,{type:"acknowledge_review"});else if(s.campaign!.incident&&incidentAwaitingResponse(s.campaign!)&&!installPending(s.campaign!))s=respondToIncident(s);else if(s.campaign!.dbBacklog&&s.campaign!.limit===null&&!s.campaign!.pending.some(a=>a.type==="limit"))s=act(s,{type:"set_traffic_limit",enabled:true});else if(s.campaign!.limit!==null&&!s.campaign!.incident&&!s.campaign!.dbBacklog&&!s.campaign!.pending.some(a=>a.type==="unlimit"))s=act(s,{type:"set_traffic_limit",enabled:false});s=tick(s);if(s.phase==="ended")throw Error("Strategy insolvent in spikes");}
 s=act(act(s,{type:"acknowledge_spikes"}),{type:"enter_reliability"});s=act(s,{type:"arm_reliability"});
 for(let i=0;i<400&&s.campaign!.reliabilityStage!.completedStep===null;i++){if(s.phase==="review")s=act(s,{type:"acknowledge_review"});else if(s.campaign!.incident&&incidentAwaitingResponse(s.campaign!)&&!installPending(s.campaign!))s=respondToIncident(s);else if(s.campaign!.dbBacklog&&s.campaign!.limit===null&&!s.campaign!.pending.some(a=>a.type==="limit"))s=act(s,{type:"set_traffic_limit",enabled:true});else if(s.campaign!.limit!==null&&!s.campaign!.incident&&!s.campaign!.dbBacklog&&!s.campaign!.pending.some(a=>a.type==="unlimit"))s=act(s,{type:"set_traffic_limit",enabled:false});s=tick(s);if(s.phase==="ended")throw Error("Strategy insolvent in reliability");}
 return act(s,{type:"acknowledge_reliability"});
}
export function scalingTrap(){let s=tick(newGame(9999,"scaling-affordability"),6);s=act(s,{type:"start_db_upgrade"});while(s.phase!=="review")s=tick(s);s=act(act(s,{type:"acknowledge_review"}),{type:"acknowledge_milestone"});s=tick(act(s,{type:"set_traffic_limit",enabled:true}),1);s=tick(s,300-s.campaign!.step);s=tick(act(s,{type:"add_server"}),2);return tick(act(s,{type:"scale_up",appId:"app-1"}),3);}
