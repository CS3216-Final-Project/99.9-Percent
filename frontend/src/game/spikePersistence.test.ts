import {it,expect,beforeEach,afterEach,vi} from "vitest";
import {makeEnvelope,validateEnvelope,CAMPAIGN_SAVE_KEY} from "./saveEnvelope";
import {loadGame,saveGame} from "./persist";
import {dataCompany,spikeCompany,untilOffset,act,tick} from "../sim/__tests__/spikeFixtures";
import {useGame} from "./store";
beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);});
afterEach(()=>vi.restoreAllMocks());
it("upgrades schema 4 replay saves without entering spikes and backs up exact source bytes",()=>{
 const g=dataCompany(),old={...makeEnvelope(g,321,1),schemaVersion:4},raw=JSON.stringify(old,null,2);
 localStorage.setItem(CAMPAIGN_SAVE_KEY,raw);
 for(const key of ["nn.save.v1","nn.meta.v1","nn.analytics.v1"])localStorage.setItem(key,"legacy bytes");
 const loaded=loadGame();if(loaded.status!=="ok")throw Error("load");
 expect(loaded.game).toEqual(g);expect(loaded.game.campaign!.spikeStage).toBeNull();
 expect(localStorage.getItem(CAMPAIGN_SAVE_KEY)).toBe(raw);
 expect(saveGame(loaded.game,loaded.remainderMs,false,loaded.measurement)).toBe(true);
 expect(localStorage.getItem(`${CAMPAIGN_SAVE_KEY}.backup.v4.${old.runId}.1`)).toBe(raw);
 expect(JSON.parse(localStorage.getItem(CAMPAIGN_SAVE_KEY)!).schemaVersion).toBe(5);
 for(const key of ["nn.save.v1","nn.meta.v1","nn.analytics.v1"])expect(localStorage.getItem(key)).toBe("legacy bytes");
});
it.each(["backup","replacement"])("preserves schema 4 source when %s fails",failure=>{
 const g=dataCompany(),e={...makeEnvelope(g,0,1),schemaVersion:4},raw=JSON.stringify(e);
 localStorage.setItem(CAMPAIGN_SAVE_KEY,raw);const original=Storage.prototype.setItem;
 vi.spyOn(Storage.prototype,"setItem").mockImplementation(function(this:Storage,k,v){
  if(failure==="backup"?k.includes(".backup.v4."):k===CAMPAIGN_SAVE_KEY)throw Error("quota");original.call(this,k,v);
 });
 expect(saveGame(g)).toBe(false);expect(localStorage.getItem(CAMPAIGN_SAVE_KEY)).toBe(raw);
});
it("rejects Phase 5 decisions in old replay contracts and unsupported future versions",()=>{
 const e=makeEnvelope(spikeCompany());
 for(const schemaVersion of [1,2,3,4,6])expect(validateEnvelope({...e,schemaVersion}).status).not.toBe("ok");
});
it("replays pending provisioning, disabled policy and protected upgrades exactly",()=>{
 let g=act(untilOffset(spikeCompany(),13),{type:"scale_up",appId:"app-3"});
 expect(g.campaign!.spikeStage!.controller!.managedAppIds).not.toContain("app-3");
 for(let i=0;i<4;i++){
  const result=validateEnvelope(makeEnvelope(g));if(result.status!=="ok")throw Error("replay");
  expect(result.game).toEqual(g);g=tick(g);
 }
 g=act(g,{type:"set_autoscaling",enabled:false});expect(saveGame(g)).toBe(true);
 const loaded=loadGame();if(loaded.status!=="ok")throw Error("load");expect(loaded.game).toEqual(g);
});
it("pending completion blocks the shared clock after reload until explicit acknowledgement",()=>{
 let g=act(spikeCompany(false),{type:"set_traffic_limit",enabled:true});g=untilOffset(g,72);expect(saveGame(g)).toBe(true);
 useGame.getState().boot();useGame.getState().play();useGame.getState().onboardingMove("skip");
 const step=useGame.getState().game.campaign!.step;useGame.getState().setRunning(true);useGame.getState().tick(10);useGame.getState().advance();
 expect(useGame.getState().game.campaign!.step).toBe(step);
 expect(useGame.getState().act({type:"acknowledge_spikes"})).toBe(true);expect(useGame.getState().running).toBe(false);
 expect(useGame.getState().game.campaign!.spikeStage!.acknowledged).toBe(true);
});

it("rejects a replay that advances past unacknowledged spike completion",()=>{
 const g=untilOffset(act(spikeCompany(false),{type:"set_traffic_limit",enabled:true}),72);
 const e=makeEnvelope(g);expect(validateEnvelope({...e,step:e.step+1}).status).toBe("corrupt");
 const acknowledged=act(g,{type:"acknowledge_spikes"});const next=tick(acknowledged);
 const result=validateEnvelope(makeEnvelope(next));expect(result.status).toBe("ok");
 if(result.status==="ok")expect(result.game).toEqual(next);
});
