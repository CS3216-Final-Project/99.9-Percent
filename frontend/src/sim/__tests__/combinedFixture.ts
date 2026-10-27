import {resilientReliability,checkedReliability,preparedReliability,act,tick} from "./reliabilityFixture";
import {newGame} from "../index";
import type {GameState} from "../types";
import {canEnterCombined,pendingCombined} from "../combinedCampaign";
import {pendingRetry} from "../errorBudget";
export {act,tick};
/** Three serving apps with Health Checks only, leaving the autoscaler a free slot in Grow the Company. */
export function checkedCombined(seq=sequence){let s=act(checkedReliability(),{type:"arm_reliability"});for(let i=0;i<150&&!s.campaign!.reliabilityStage!.completedStep;i++){if(s.phase==="review")s=act(s,{type:"acknowledge_review"});s=tick(s);}s=act(s,{type:"acknowledge_reliability"});if(!canEnterCombined(s))throw Error("Entry not ready");return act(s,{type:"enter_combined",sequence:seq});}
export function completedReliability(){let s=act(resilientReliability(),{type:"arm_reliability"});for(let i=0;i<150&&!s.campaign!.reliabilityStage!.completedStep;i++){if(s.phase==="review")s=act(s,{type:"acknowledge_review"});s=tick(s);if(s.phase==="ended")throw Error("Fixture bankrupt");}s=act(s,{type:"acknowledge_reliability"});
 // Failover promoted the spare; route the restored app back so all four serve the growth waves.
 s=tick(act(s,{type:"set_routing",mode:"balanced",targets:["app-1","app-2","app-3","app-4"]}),1);if(!canEnterCombined(s))throw Error("Entry not ready");return s;}
export const sequence=[{template:"read-growth-pulse" as const,peak:4000,duration:16 as const},{template:"write-pressure" as const,peak:3000,duration:12 as const},{template:"failure-under-load" as const,peak:3600,duration:16 as const}];
export function combinedCompany(){return act(completedReliability(),{type:"enter_combined",sequence});}
export function finishRound(s:GameState){for(let i=0;i<200&&!pendingCombined(s.campaign);i++){if(s.phase==="review")s=act(s,{type:"acknowledge_review"});s=tick(s);if(s.phase==="ended")throw Error("Round bankrupt");}if(!pendingCombined(s.campaign))throw Error("Round never finished");return s;}
export function finishedCompany(){let s=combinedCompany();for(let i=0;i<3;i++){s=tick(s,5);s=act(s,{type:"start_growth_wave"});s=finishRound(s);s=act(s,{type:"acknowledge_growth"});}return finishFinalWeek(s);}
/** Run Grow the Company's final operating week until the final review qualifies. */
export function finishFinalWeek(s:GameState){for(let i=0;i<120&&!s.campaign!.combinedStage!.finalReview;i++){if(s.phase==="review")s=act(s,{type:"acknowledge_review"});s=tick(s);}if(!s.campaign!.combinedStage!.finalReview)throw Error("Final review never qualified");return s;}

/** Two full-company strategies built solely from accepted actions and settlements. */
export function strategyPredecessor(horizontal=false){
 let s=tick(newGame(0,horizontal?"horizontal-strategy":"vertical-strategy"),6);s=act(s,{type:"start_db_upgrade"});while(s.phase!=="review")s=tick(s);s=act(act(s,{type:"acknowledge_review"}),{type:"acknowledge_milestone"});
 const buy=(a:Parameters<typeof act>[1],delay:number)=>{s=tick(act(s,a),delay);};
 buy({type:"set_traffic_limit",enabled:true},1);buy({type:"start_db_upgrade"},3);buy({type:"add_server"},2);
 if(!horizontal){buy({type:"scale_up",appId:"app-1"},3);buy({type:"scale_up",appId:"app-2"},3);}
 buy({type:"deploy_load_balancer"},2);buy({type:"set_routing",mode:"balanced",targets:["app-1","app-2"]},1);buy({type:"set_traffic_limit",enabled:false},1);
 while(s.campaign!.step<180){if(s.phase==="review")s=act(s,{type:"acknowledge_review"});s=tick(s);}
 buy({type:"set_traffic_limit",enabled:true},1);s=act(s,{type:"enter_data",profile:"read-heavy"});
 if(horizontal){buy({type:"deploy_cache"},2);buy({type:"tune_cache"},2);s=tick(s,7);}
 // A 3,000 ops/s database alone drops reads above 3,000 req/s, which Traffic Spikes' error budget cannot absorb.
 else {buy({type:"start_db_upgrade"},4);buy({type:"deploy_cache"},2);}
 if(!horizontal)buy({type:"set_traffic_limit",enabled:false},1);s=act(s,{type:"enter_spikes"});
 // Four base apps serve the 4,000 req/s pulses exactly, installed before the first pulse.
 if(horizontal){buy({type:"add_server"},2);buy({type:"add_server"},2);buy({type:"set_routing",mode:"balanced",targets:["app-1","app-2","app-3","app-4"]},1);buy({type:"set_traffic_limit",enabled:false},1);}
 if(!horizontal){buy({type:"add_server"},2);buy({type:"scale_up",appId:"app-3"},3);buy({type:"set_routing",mode:"balanced",targets:["app-1","app-2","app-3"]},1);}
 // The base-app strategy turns traffic away until its new apps are routed, so its first attempt goes over budget and is retried.
 for(let i=0;i<300&&s.campaign!.spikeStage!.completedStep===null;i++){if(s.phase==="review")s=act(s,{type:"acknowledge_review"});if(pendingRetry(s.campaign))s=act(s,{type:"retry_scenario"});s=tick(s);if(s.phase==="ended")throw Error("Strategy insolvent in spikes");}
 s=act(act(s,{type:"acknowledge_spikes"}),{type:"enter_reliability"});
 // Stay Online's error budget needs failed apps out of routing. Three large apps also keep a spare for failover;
 // four base apps have no free slot, and the other three carry baseline demand alone.
 s=act(s,{type:"unlock_reliability",tech:"health_checks"});buy({type:"deploy_health_checks"},2);
 if(!horizontal){s=act(s,{type:"unlock_reliability",tech:"standby"});buy({type:"install_spare"},2);s=act(s,{type:"unlock_reliability",tech:"auto_failover"});buy({type:"deploy_failover"},2);}
 s=act(s,{type:"arm_reliability"});
 for(let i=0;i<150&&s.campaign!.reliabilityStage!.completedStep===null;i++){if(s.phase==="review")s=act(s,{type:"acknowledge_review"});s=tick(s);if(s.phase==="ended")throw Error("Strategy insolvent in reliability");}
 s=act(s,{type:"acknowledge_reliability"});
 // Fail back: route the restored app beside the promoted spare.
 const all=s.campaign!.apps.map(a=>a.id);
 return all.length===s.campaign!.routing.targets.length?s:tick(act(s,{type:"set_routing",mode:"balanced",targets:all}),1);
}

/**
 * The base-app company Chapter 6 guidance is tested against: three base apps, a tuned cache and a 2,000 ops/s
 * database, reaching Grow the Company without Health Checks. Error budgets now close that route at Traffic Spikes
 * and Stay Online, so this fixture lifts only those two budget gates to keep the guidance cases' company shape.
 */
export function baseAppPredecessor(){
 let s=tick(newGame(0,"horizontal-strategy"),6);s=act(s,{type:"start_db_upgrade"});while(s.phase!=="review")s=tick(s);s=act(act(s,{type:"acknowledge_review"}),{type:"acknowledge_milestone"});
 const buy=(a:Parameters<typeof act>[1],delay:number)=>{s=tick(act(s,a),delay);};
 buy({type:"set_traffic_limit",enabled:true},1);buy({type:"start_db_upgrade"},3);buy({type:"add_server"},2);
 buy({type:"deploy_load_balancer"},2);buy({type:"set_routing",mode:"balanced",targets:["app-1","app-2"]},1);buy({type:"set_traffic_limit",enabled:false},1);
 while(s.campaign!.step<180){if(s.phase==="review")s=act(s,{type:"acknowledge_review"});s=tick(s);}
 buy({type:"set_traffic_limit",enabled:true},1);s=act(s,{type:"enter_data",profile:"read-heavy"});
 buy({type:"deploy_cache"},2);buy({type:"tune_cache"},2);s=tick(s,7);
 s=act(s,{type:"enter_spikes"});s.campaign!.spikeStage!.budget=null;
 buy({type:"add_server"},2);buy({type:"set_routing",mode:"balanced",targets:["app-1","app-2","app-3"]},1);buy({type:"set_traffic_limit",enabled:false},1);
 for(let i=0;i<200&&s.campaign!.spikeStage!.completedStep===null;i++){if(s.phase==="review")s=act(s,{type:"acknowledge_review"});s=tick(s);}
 s=act(act(s,{type:"acknowledge_spikes"}),{type:"enter_reliability"});s=act(s,{type:"arm_reliability"});s.campaign!.reliabilityStage!.budget=null;
 for(let i=0;i<150&&s.campaign!.reliabilityStage!.completedStep===null;i++){if(s.phase==="review")s=act(s,{type:"acknowledge_review"});s=tick(s);}
 return act(s,{type:"acknowledge_reliability"});
}
export function protectedCombined(){let s=act(preparedReliability(),{type:"arm_reliability"});for(let i=0;i<150&&s.campaign!.reliabilityStage!.completedStep===null;i++){if(s.phase==="review")s=act(s,{type:"acknowledge_review"});s=tick(s);}s=act(s,{type:"acknowledge_reliability"});s=tick(act(s,{type:"reserve_spare",appId:"app-2"}),1);return act(s,{type:"enter_combined",sequence:[sequence[2],sequence[0],sequence[1]]});}
export function promotionRiskCompany(){let s=act(strategyPredecessor(false),{type:"enter_combined",sequence});for(let i=0;i<3;i++){s=tick(s,5);s=act(s,{type:"start_growth_wave"});s=finishRound(s);s=act(s,{type:"acknowledge_growth"});}return s;}

export function scalingTrap(){let s=tick(newGame(9999,"scaling-affordability"),6);s=act(s,{type:"start_db_upgrade"});while(s.phase!=="review")s=tick(s);s=act(act(s,{type:"acknowledge_review"}),{type:"acknowledge_milestone"});s=tick(act(s,{type:"set_traffic_limit",enabled:true}),1);s=tick(s,300-s.campaign!.step);s=tick(act(s,{type:"add_server"}),2);return tick(act(s,{type:"scale_up",appId:"app-1"}),3);}
