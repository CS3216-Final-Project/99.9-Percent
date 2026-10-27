import {beforeEach,it,expect} from "vitest";
import {newGame,applyAction,replayCampaign,type GameState,type Action} from "../sim";
import {advanceSteps} from "../sim/step";
import {makeEnvelope,decodeSave,CAMPAIGN_SAVE_KEY} from "./saveEnvelope";
import {saveGame,loadGame} from "./persist";
import {useGame} from "./store";
import {beginSession,emptyMeasurement,projectEvents} from "./telemetry";
function act(g:GameState,a:Action){const r=applyAction(g,a);if(!r.ok)throw Error(r.message);return r.state;}
function deadEnd(steps=405) {
 let g=newGame(0,"dead-end-company");g=act(g,{type:"set_traffic_limit",enabled:true});g=act(g,{type:"start_db_upgrade"});return advanceSteps(g,steps).state;
}
function inspecting(g:GameState){g=act(g,{type:"incident_inspect",equipment:"app"});return act(g,{type:"incident_inspect",equipment:"db"});}
function qualified(steps=405){let g=inspecting(deadEnd(steps));g=act(g,{type:"set_traffic_limit",enabled:false});return advanceSteps(g,5).state;}
/** Historical schema-6 history, before prevention was separated from progression. */
function oldEnvelope(entered:boolean) {
 const g=qualified(4),c=g.campaign!,inputs=[...c.inputs,{step:c.step,action:{type:"acknowledge_prevention_review"} as Action},
  ...(entered?[{step:c.step,action:{type:"acknowledge_milestone"} as Action}]:[])];
 return {...makeEnvelope(g),schemaVersion:6,inputs};
}
beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);});
it("reloads verified prevention and unlocks Scaling only after recognition",()=>{
 let g=deadEnd();localStorage.setItem(CAMPAIGN_SAVE_KEY,JSON.stringify(makeEnvelope(g)));
 const loaded=loadGame();if(loaded.status!=="ok")throw Error("load");expect(loaded.game).toEqual(g);
 g=inspecting(loaded.game);g=act(g,{type:"set_traffic_limit",enabled:false});g=advanceSteps(g,5).state;
 expect(g.campaign!.openingPrevention!.outcome!.qualifiedStep).toBe(410);
 g=act(g,{type:"acknowledge_prevention_review"});expect(g.campaign!.openingMilestone!.acknowledged).toBe(false);
 expect(applyAction(g,{type:"enter_scaling"}).ok).toBe(false);expect(saveGame(g)).toBe(true);
 const again=loadGame();if(again.status!=="ok")throw Error("load");
 expect(again.game).toEqual(g);expect(g.campaign!.scaling).toBeNull();expect(g.campaign!.openingRecovered).toBe(false);
 expect(act(again.game,{type:"acknowledge_milestone"}).campaign!.scaling).toBeTruthy();
});
it.each([1,4])("preserves schema %s history and offers verified prevention recognition at load time",schemaVersion=>{
 const raw=JSON.stringify({schemaVersion,scenarioId:"opening-db",scenarioVersion:1,runId:"pre-prevention",seed:0,step:40,
  inputs:[{step:0,action:{type:"start_db_upgrade"}},{step:4,action:{type:"incident_inspect",equipment:"app"}},{step:4,action:{type:"incident_inspect",equipment:"db"}},{step:20,action:{type:"add_server"}}],
  runtime:{remainderMs:0,measurement:emptyMeasurement()},savedAt:1});
 const loaded=decodeSave(raw);if(loaded.status!=="ok")throw Error(loaded.status);
 const c=loaded.game.campaign!;
 expect(c.step).toBe(40);expect(c.openingPrevention!.outcome).toMatchObject({qualifiedStep:9,acknowledged:true});
 expect(c.openingMilestone).toMatchObject({outcomeId:"opening-prevention",awardedStep:40,acknowledged:false});expect(c.scaling).toBeNull();expect(c.apps).toHaveLength(2);
 const resaved=decodeSave(JSON.stringify(makeEnvelope(loaded.game)));if(resaved.status!=="ok")throw Error(resaved.status);
 expect(resaved.game).toEqual(loaded.game);
});
it("preserves partial observations and a pending review through paused reload",()=>{
 let g=inspecting(deadEnd());g=act(g,{type:"set_traffic_limit",enabled:false});g=advanceSteps(g,2).state;
 expect(saveGame(g)).toBe(true);let loaded=loadGame();if(loaded.status!=="ok")throw Error("load");expect(loaded.game.campaign).toEqual(g.campaign);
 g=advanceSteps(loaded.game,3).state;expect(saveGame(g)).toBe(true);loaded=loadGame();if(loaded.status!=="ok")throw Error("load");
 expect(loaded.game.campaign).toEqual(g.campaign);expect(advanceSteps(loaded.game,20).stepsConsumed).toBe(0);
});
it("rejects a current save that advances past an unacknowledged prevention review",()=>{
 const g=qualified(),e=makeEnvelope(g);expect(decodeSave(JSON.stringify(e)).status).toBe("ok");
 expect(decodeSave(JSON.stringify({...e,step:e.step+1})).status).toBe("corrupt");
 const acknowledged=makeEnvelope(act(g,{type:"acknowledge_prevention_review"}));
 const missing=decodeSave(JSON.stringify({...acknowledged,inputs:acknowledged.inputs.filter(i=>i.action.type!=="acknowledge_prevention_review")}));
 expect(missing.status).toBe("ok");if(missing.status==="ok")expect(missing.game.campaign!.openingPrevention!.outcome!.acknowledged).toBe(false);
});
it("does not count paused ticks, review reading or repeated acknowledgement",()=>{
 let g=inspecting(deadEnd());g=act(g,{type:"set_traffic_limit",enabled:false});g=advanceSteps(g,2).state;
 useGame.setState({game:g,ready:true,started:true,onboarding:false,running:false});useGame.getState().tick(1000);expect(useGame.getState().game).toEqual(g);
 useGame.getState().setRunning(true);useGame.getState().tick(3);expect(useGame.getState().running).toBe(false);
 const n=useGame.getState().game.campaign!.step;useGame.getState().tick(100);useGame.getState().advance();expect(useGame.getState().game.campaign!.step).toBe(n);
 expect(useGame.getState().act({type:"acknowledge_prevention_review"})).toBe(true);expect(useGame.getState().act({type:"acknowledge_prevention_review"})).toBe(false);
 expect(useGame.getState().act({type:"acknowledge_milestone"})).toBe(true);expect(useGame.getState().act({type:"acknowledge_milestone"})).toBe(false);expect(useGame.getState().game.campaign!.step).toBe(n);
});
it("projects verified prevention and Opening recognition once, separately from purchases",()=>{
 let g=inspecting(deadEnd());g=act(g,{type:"set_traffic_limit",enabled:false});
 const m=beginSession(emptyMeasurement(),g,"prevention-session","2026-10-10T00:00:00Z");m.cursor=g.campaign!.trace.find(t=>t.type==="opening-prevention-eligible")!.id-1;
 g=advanceSteps(g,5).state;g=act(g,{type:"acknowledge_prevention_review"});
 const out=projectEvents(m,g,"2026-10-10T00:01:00Z");expect(projectEvents(out,g,"2026-10-10T00:02:00Z")).toEqual(out);
 for(const name of ["opening_prevention_eligible","opening_prevention_application_inspected","opening_prevention_database_inspected","opening_prevention_qualified","opening_prevention_review_acknowledged"])expect(out.pending.filter(e=>e.name===name)).toHaveLength(1);
 expect(out.pending.filter(e=>e.name==="gameplay_decision")).toHaveLength(1);
 expect(out.pending.filter(e=>e.name==="run_completed_opening")).toHaveLength(1);
 expect(g.campaign!.reports).toEqual([]);expect(g.campaign!.openingRecovered).toBe(false);
});
it("backs up schema-6 bytes and preserves an already-entered company's architecture and continuation",()=>{
 const e=oldEnvelope(true),raw=JSON.stringify(e);localStorage.setItem(CAMPAIGN_SAVE_KEY,raw);
 const loaded=loadGame();if(loaded.status!=="ok")throw Error(loaded.status);
 const c=loaded.game.campaign!;expect(c.scaling?.id).toBe("application-scaling");expect(c.runId).toBe(e.runId);expect(c.openingRecovered).toBe(false);
 expect(c.legacyPreventionInputs).toBe(e.inputs.length);
 const historical=replayCampaign(e.seed,e.runId,e.inputs,e.step,false,undefined,false,e.inputs.length,undefined,e.scenarioVersion,e.step);
 expect(loaded.game).toEqual(historical);
 let g=act(loaded.game,{type:"start_db_upgrade"});g=advanceSteps(g,3).state;expect(g.campaign!.dbCapacity).toBe(2000);
 expect(saveGame(g)).toBe(true);expect(localStorage.getItem(CAMPAIGN_SAVE_KEY+".backup.v6."+e.runId+"."+e.savedAt)).toBe(raw);
 const again=loadGame();if(again.status!=="ok")throw Error(again.status);expect(again.game).toEqual(g);
 expect(again.game.campaign!.legacyPreventionInputs).toBe(e.inputs.length);
});
it("requires explicit acknowledgement of a restored schema-6 prevention recognition",()=>{
 const e=oldEnvelope(false),loaded=decodeSave(JSON.stringify(e));if(loaded.status!=="ok")throw Error(loaded.status);
 const g=loaded.game;expect(g.campaign!.openingPrevention!.outcome!.acknowledged).toBe(true);expect(g.campaign!.openingMilestone!.acknowledged).toBe(false);
 expect(applyAction(g,{type:"enter_scaling"}).ok).toBe(false);
 const again=decodeSave(JSON.stringify(makeEnvelope(g)));if(again.status!=="ok")throw Error(again.status);expect(again.game).toEqual(g);
 expect(act(again.game,{type:"acknowledge_milestone"}).campaign!.scaling).toBeTruthy();
});
it.each([-1,1.5,1000001])("rejects an invalid historical input prefix %s",legacyPreventionInputs=>{
 expect(decodeSave(JSON.stringify({...makeEnvelope(qualified()),legacyPreventionInputs})).status).toBe("corrupt");
});
