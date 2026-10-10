import {beforeEach,afterEach,it,expect,vi} from "vitest";
import {newGame,applyAction,type GameState,type Action} from "../sim";
import {advanceSteps} from "../sim/step";
import {makeEnvelope,decodeSave,CAMPAIGN_SAVE_KEY} from "./saveEnvelope";
import {loadGame,saveGame} from "./persist";
import {useGame,inspectOrSelect} from "./store";
import {emptyMeasurement} from "./telemetry";
function act(g:GameState,a:Action){const r=applyAction(g,a);if(!r.ok)throw Error(r.message);return r.state;}
/** Literal input-log shape deployed by main, with a pending purchase during its first incident. */
function oldEnvelope(version=2,acknowledged=false) {
 return JSON.stringify({schemaVersion:version,scenarioId:"opening-db",scenarioVersion:1,runId:"main-company",seed:3,
  step:acknowledged?14:6,inputs:[{step:6,action:{type:"start_db_upgrade"}},...(acknowledged?[
    {step:14,action:{type:"acknowledge_review"}},{step:14,action:{type:"acknowledge_milestone"}}
  ]:[])],runtime:{remainderMs:321,...(version===2?{measurement:{...emptyMeasurement(),origin:"phase1",runStarted:true}}:{})},savedAt:1});
}
beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);});
afterEach(()=>vi.restoreAllMocks());
it.each([1,2])("loads deployed schema %s and backs up exact bytes before replacing it",version=>{
 const raw=oldEnvelope(version);localStorage.setItem(CAMPAIGN_SAVE_KEY,raw);localStorage.setItem("nn.save.v1","legacy bytes");
 const loaded=loadGame();expect(loaded.status).toBe("ok");if(loaded.status!=="ok")throw Error("Migration failed");
 expect(loaded.game.campaign).toMatchObject({runId:"main-company",cashCents:1700000,dbBacklog:600,scaling:null});
 expect(loaded.game.campaign!.pending[0]).toMatchObject({activationStep:9,capacityAfter:1000});
 expect(loaded.game.campaign!.snapshot.instances).toBeUndefined();
 expect(loaded.game.campaign!.trace.find(e=>e.type==="action-requested")!.data).not.toHaveProperty("targetId");
 expect(localStorage.getItem(CAMPAIGN_SAVE_KEY)).toBe(raw);
 expect(saveGame(loaded.game,loaded.remainderMs,false,loaded.measurement)).toBe(true);
 expect(localStorage.getItem(`${CAMPAIGN_SAVE_KEY}.backup.v${version}.main-company.1`)).toBe(raw);
 expect(localStorage.getItem("nn.save.v1")).toBe("legacy bytes");
 const resumed=loadGame();expect(resumed.status).toBe("ok");if(resumed.status!=="ok")throw Error("load");
 expect(advanceSteps(resumed.game,3)).toEqual(advanceSteps(loaded.game,3));
 expect(advanceSteps(resumed.game,3).state.campaign!.snapshot.instances).toHaveLength(1);
});
it("loads acknowledged Phase 2 companies without entering the stage on boot or replay",()=>{
 const raw=oldEnvelope(2,true);localStorage.setItem(CAMPAIGN_SAVE_KEY,raw);useGame.getState().boot();
 expect(useGame.getState().game.campaign).toMatchObject({scaling:null,runId:"main-company",step:14});
 useGame.getState().play();expect(useGame.getState().game.campaign!.scaling).not.toBeNull();
 useGame.getState().onboardingMove("skip");inspectOrSelect("app","app-1");expect(useGame.getState().selectedAppId).toBe("app-1");
 const saved=loadGame();expect(saved.status).toBe("ok");if(saved.status!=="ok")throw Error("load");
 expect(saved.game.campaign!.scaling).toEqual(useGame.getState().game.campaign!.scaling);
 expect(saved.game.campaign!.trace.filter(t=>t.type==="scaling-stage-entered")).toHaveLength(1);
});
it.each([1,2])("retains schema %s historical settlement and aggregate observations after a save roundtrip",version=>{
 const source=JSON.parse(oldEnvelope(version,true));source.step=114;
 if(version===1)source.inputs=source.inputs.filter((i:{action:{type:string}})=>i.action.type!=="acknowledge_milestone");
 source.inputs.push({step:14,action:{type:"set_traffic_limit",enabled:true}});
 const loaded=decodeSave(JSON.stringify(source));if(loaded.status!=="ok")throw Error("load");
 // Recorded from the merged main engine, before per-instance observations existed.
 expect(loaded.game.campaign!.settlements).toEqual([{period:1,step:60,revenueCents:646000,appCents:70000,
  dbCents:136666,salaryCents:640000,netCents:-200666}]);
 expect(loaded.game.campaign!.reports[0].snapshots.every(m=>m.instances===undefined&&m.routing===undefined)).toBe(true);
 expect(loaded.game.campaign!.trace.filter(e=>e.type==="action-requested").every(e=>!("targetId" in e.data))).toBe(true);
 expect(decodeSave(JSON.stringify(makeEnvelope(loaded.game)))).toMatchObject({status:"ok",game:loaded.game});
});
it.each(["backup","replacement"])("preserves Phase 2 source and legacy bytes when %s writing fails",boundary=>{
 const raw=oldEnvelope();localStorage.setItem(CAMPAIGN_SAVE_KEY,raw);
 for(const key of ["nn.save.v1","nn.meta.v1","nn.analytics.v1"])localStorage.setItem(key,"legacy:"+key);
 const loaded=loadGame();if(loaded.status!=="ok")throw Error("load");
 const original=Storage.prototype.setItem;
 vi.spyOn(Storage.prototype,"setItem").mockImplementation(function(this:Storage,key:string,value:string){
  if(boundary==="backup"?key.includes(".backup.v2."):key===CAMPAIGN_SAVE_KEY)throw Error("quota");
  original.call(this,key,value);
 });
 expect(saveGame(loaded.game,0,false,loaded.measurement)).toBe(false);expect(localStorage.getItem(CAMPAIGN_SAVE_KEY)).toBe(raw);
 for(const key of ["nn.save.v1","nn.meta.v1","nn.analytics.v1"])expect(localStorage.getItem(key)).toBe("legacy:"+key);
});
it("resumes a targeted upgrade with exact scheduling, routing, money and evidence",()=>{
 let g=advanceSteps(newGame(3,"targeted"),6).state;g=act(g,{type:"start_db_upgrade"});g=advanceSteps(g,30).state;
 g=act(g,{type:"acknowledge_review"});g=act(g,{type:"acknowledge_milestone"});g=act(g,{type:"scale_up",appId:"app-1"});
 const decoded=decodeSave(JSON.stringify(makeEnvelope(g)));expect(decoded.status).toBe("ok");if(decoded.status!=="ok")throw Error("load");
 expect(decoded.game).toEqual(g);expect(advanceSteps(decoded.game,3)).toEqual(advanceSteps(g,3));
});
it("refuses future versions without overwriting the active company",()=>{
 const raw=JSON.stringify({...makeEnvelope(newGame()),schemaVersion:99});localStorage.setItem(CAMPAIGN_SAVE_KEY,raw);
 expect(loadGame().status).toBe("unsupported");expect(saveGame(newGame())).toBe(false);expect(localStorage.getItem(CAMPAIGN_SAVE_KEY)).toBe(raw);
});
