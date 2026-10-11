import {beforeEach,afterEach,it,expect,vi} from "vitest";
import {applyAction,type Action,type GameState} from "../sim";
import {advanceSteps} from "../sim/step";
import {dataCompany} from "../sim/__tests__/dataFixture";
import {makeEnvelope,decodeSave,CAMPAIGN_SAVE_KEY} from "./saveEnvelope";
import {loadGame,saveGame} from "./persist";
import {useGame} from "./store";
const act=(g:GameState,a:Action)=>{const r=applyAction(g,a);if(!r.ok)throw Error(r.message);return r.state;};
beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);});
afterEach(()=>vi.restoreAllMocks());
it("loads schema 3 without data entry, preserves history and backs up exact bytes",()=>{
 const g=dataCompany("read-heavy",false),source={...makeEnvelope(g,321,1),schemaVersion:3},raw=JSON.stringify(source,null,2);
 localStorage.setItem(CAMPAIGN_SAVE_KEY,raw);
 const loaded=loadGame();if(loaded.status!=="ok")throw Error("load failed");
 expect(loaded.game).toEqual(g);expect(loaded.game.campaign!.dataStage).toBeNull();
 expect(localStorage.getItem(CAMPAIGN_SAVE_KEY)).toBe(raw);
 expect(saveGame(loaded.game,loaded.remainderMs,false,loaded.measurement)).toBe(true);
 expect(localStorage.getItem(`${CAMPAIGN_SAVE_KEY}.backup.v3.${source.runId}.1`)).toBe(raw);
 expect(JSON.parse(localStorage.getItem(CAMPAIGN_SAVE_KEY)!).schemaVersion).toBe(6);
});
it.each(["backup","replacement","conflicting backup"])("preserves schema 3 source on %s failure",boundary=>{
 const g=dataCompany("read-heavy",false),raw=JSON.stringify({...makeEnvelope(g,0,1),schemaVersion:3});
 localStorage.setItem(CAMPAIGN_SAVE_KEY,raw);
 const backup=`${CAMPAIGN_SAVE_KEY}.backup.v3.${g.campaign!.runId}.1`;
 if(boundary==="conflicting backup")localStorage.setItem(backup,"other source");
 else {const original=Storage.prototype.setItem;vi.spyOn(Storage.prototype,"setItem").mockImplementation(function(this:Storage,key,value){
   if(key===(boundary==="backup"?backup:CAMPAIGN_SAVE_KEY))throw Error("quota");original.call(this,key,value);
 });}
 expect(saveGame(g)).toBe(false);expect(localStorage.getItem(CAMPAIGN_SAVE_KEY)).toBe(raw);
});
it("exactly replays cold/warming cache, pending tuning and paid DB upgrade",()=>{
 let g=advanceSteps(dataCompany("write-heavy"),6).state;g=act(g,{type:"deploy_cache"});
 for(let i=0;i<12;i++){
  const loaded=decodeSave(JSON.stringify(makeEnvelope(g,250,1)));if(loaded.status!=="ok")throw Error("load failed");
  expect(loaded.game).toEqual(g);expect(advanceSteps(loaded.game,1)).toEqual(advanceSteps(g,1));
  if(i===3)g=act(g,{type:"tune_cache"});if(i===6)g=act(g,{type:"start_db_upgrade"});
  g=advanceSteps(g,1).state;
 }
});
it("rejects Phase 4 inputs disguised as schema 3 and corrupt draft snapshots without writing",()=>{
 const e=makeEnvelope(dataCompany());
 expect(decodeSave(JSON.stringify({...e,schemaVersion:3})).status).toBe("corrupt");
 const raw=JSON.stringify({schemaVersion:4,scenarioId:"opening-db",scenarioVersion:1,runId:e.runId,game:dataCompany()});
 localStorage.setItem(CAMPAIGN_SAVE_KEY,raw);expect(loadGame().status).toBe("corrupt");
 expect(saveGame(dataCompany())).toBe(false);expect(localStorage.getItem(CAMPAIGN_SAVE_KEY)).toBe(raw);
});
it("explicit data entry pauses a running company and reload does not advance it",()=>{
 const g=dataCompany("read-heavy",false);useGame.setState({game:g,ready:true,started:true,onboarding:false,running:true,hasRun:true});
 expect(useGame.getState().act({type:"enter_data"})).toBe(true);expect(useGame.getState().running).toBe(false);
 const before=useGame.getState().game;useGame.setState({ready:false});useGame.getState().boot();
 expect(useGame.getState().game).toEqual(before);expect(useGame.getState().running).toBe(false);
});
