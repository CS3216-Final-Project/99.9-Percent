import {newGame,applyAction,replayCampaign,type GameState,type Action} from "../index";
import {step} from "../step";
import {pendingSpikeAcknowledgement,pendingSpikeDebrief} from "../autoscaling";
export function act(g:GameState,a:Action):GameState {const r=applyAction(g,a);if(!r.ok)throw Error(r.message);return r.state;}
/** The state a save would reload: the run rebuilt from its recorded inputs. */
export function replay(g:GameState):GameState {const c=g.campaign!;return JSON.parse(JSON.stringify(replayCampaign(g.seed,c.runId,c.inputs,c.step,false,c.foundation)));}
export function tick(g:GameState,n=1):GameState {for(let i=0;i<n;i++)g=step(g).state;return g;}
/** Public decisions create a solvent, warm Data Strategy company; no Phase 5 state injection. `cache:false` skips the optional read cache. */
export function dataCompany(profile:"read-heavy"|"write-heavy"="read-heavy",{cache=true}:{cache?:boolean}={}):GameState {
 let g=tick(newGame(0,"spike-fixture"),6);g=act(g,{type:"start_db_upgrade"});
 while(g.phase!=="review")g=tick(g);g=act(g,{type:"acknowledge_review"});g=act(g,{type:"acknowledge_milestone"});
 const install=(a:Action,n:number)=>{g=tick(act(g,a),n);};
 install({type:"set_traffic_limit",enabled:true},1);install({type:"start_db_upgrade"},3);install({type:"add_server"},2);
 install({type:"scale_up",appId:"app-1"},3);install({type:"scale_up",appId:"app-2"},3);
 install({type:"deploy_load_balancer"},2);install({type:"set_routing",mode:"balanced",targets:["app-1","app-2"]},1);
 install({type:"set_traffic_limit",enabled:false},1);
 // Earn operating revenue at the completed scaling stage before investing in data capacity.
 while(g.campaign!.step<180){if(g.phase==="review")g=act(g,{type:"acknowledge_review"});if(g.phase==="ended")throw Error("Fixture became insolvent");g=tick(g);}
 install({type:"set_traffic_limit",enabled:true},1);
 g=act(g,{type:"enter_data",profile});install({type:"start_db_upgrade"},4);if(cache)install({type:"deploy_cache"},2);g=tick(g,6);
 install({type:"set_traffic_limit",enabled:false},1);return g;
}
/** Version 1 is the original timed chapter that recorded saves replay; version 2 is the graded chapter new companies enter. */
export function spikeCompany(auto=true,profile:"read-heavy"|"write-heavy"="read-heavy",version:1|2=1,options:{cache?:boolean}={}):GameState {
 let g=act(dataCompany(profile,options),version===2?{type:"enter_spikes",version}:{type:"enter_spikes"});if(auto){g=act(g,{type:"unlock_autoscaling"});g=tick(act(g,{type:"deploy_autoscaler"}),2);}return g;
}
/** Advances to a step offset from chapter entry, reading postmortems and, when `debriefs` is set, failed spike debriefs. */
export function untilOffset(g:GameState,offset:number,debriefs=false):GameState {
 const target=g.campaign!.spikeStage!.enteredStep+offset;
 while(g.campaign!.step<target){if(g.phase==="ended")throw Error("Company became insolvent before target step");if(pendingSpikeAcknowledgement(g.campaign!))throw Error("Recognition prevents target advancement");
  if(pendingSpikeDebrief(g.campaign!)){if(!debriefs)throw Error("A spike debrief prevents target advancement");g=act(g,{type:"acknowledge_spike_attempt"});}if(g.phase==="review")g=act(g,{type:"acknowledge_review"});g=tick(g);}return g;
}
