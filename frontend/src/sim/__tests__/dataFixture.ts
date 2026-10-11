import {newGame,applyAction,type GameState,type Action} from "../index";
import {step,advanceSteps,canEnterData} from "../step";
function act(g:GameState,a:Action){const r=applyAction(g,a);if(!r.ok)throw Error(r.message);return r.state;}
function ticks(g:GameState,n:number){for(let i=0;i<n;i++)g=step(g).state;return g;}
function install(g:GameState,a:Action,n:number){return ticks(act(g,a),n);}
export function dataCompany(profile:"read-heavy"|"write-heavy"="read-heavy",enter=true) {
 let g=advanceSteps(newGame(3,"data-company"),6).state;
 g=advanceSteps(act(g,{type:"start_db_upgrade"}),30).state;g=act(g,{type:"acknowledge_review"});g=act(g,{type:"acknowledge_milestone"});
 g=install(g,{type:"set_traffic_limit",enabled:true},1);
 g=install(g,{type:"start_db_upgrade"},3);g=install(g,{type:"add_server"},2);
 g=install(g,{type:"scale_up",appId:"app-1"},3);g=install(g,{type:"scale_up",appId:"app-2"},3);
 g=install(g,{type:"deploy_load_balancer"},2);g=install(g,{type:"set_routing",mode:"balanced",targets:["app-1","app-2"]},1);
 g=install(g,{type:"set_traffic_limit",enabled:false},1);
 if(!canEnterData(g))throw Error("data stage not ready");
 return enter?act(g,{type:"enter_data",profile}):g;
}
