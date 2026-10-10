import {it,expect,beforeEach} from "vitest";
import {makeEnvelope,validateEnvelope,CAMPAIGN_SAVE_KEY,migrateSave} from "./saveMigrations";
import {loadGame,saveGame} from "./persist";
import {useGame} from "./store";
import {readyReliability,preparedReliability,act,tick} from "../sim/__tests__/reliabilityFixture";
beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);});
it("migrates exact schema 5 source bytes preserving physics and historical observations",()=>{
 const g=readyReliability(),e={...makeEnvelope(g),schemaVersion:5},raw=JSON.stringify(e),before=JSON.stringify(g);
 localStorage.setItem(CAMPAIGN_SAVE_KEY,raw);localStorage.setItem("nn.save.v1","old legacy bytes");
 const loaded=loadGame();expect(loaded.status).toBe("ok");if(loaded.status!=="ok")throw Error("load");
 expect(localStorage.getItem(CAMPAIGN_SAVE_KEY+".backup.v5")).toBe(raw);expect(localStorage.getItem("nn.save.v1")).toBe("old legacy bytes");expect(JSON.stringify(g)).toBe(before);
 const c=loaded.game.campaign!;expect(c.reliabilityStage).toBeNull();expect(c.snapshot).toEqual(g.campaign!.snapshot);expect(c.recent).toEqual(g.campaign!.recent);expect(c.trace).toEqual(g.campaign!.trace);expect(c.reports).toEqual(g.campaign!.reports);expect(c.cashCents).toBe(g.campaign!.cashCents);expect(c.apps.every(a=>a.health==="healthy"&&a.detectedHealth==="unknown")).toBe(true);
});
it.each([0,7,8,9,10,27,28,29,32,35])("reloads paused at reliability boundary +%s without rebasing",offset=>{
 let g=act(preparedReliability(),{type:"arm_reliability"});
 for(let i=0;i<offset;i++){if(g.phase==="review")g=act(g,{type:"acknowledge_review"});g=tick(g);}
 expect(saveGame(g,200,true)).toBe(true);useGame.setState(useGame.getInitialState(),true);useGame.getState().boot();
 expect(useGame.getState().running).toBe(false);expect(useGame.getState().game).toEqual(g);expect(loadGame().status).toBe("ok");
});
it.each(["deadline","research","health","spare","capacity","configuration"])("protects inconsistent reliability %s",kind=>{
 const g=act(preparedReliability(),{type:"arm_reliability"}),e=makeEnvelope(g),c=e.game.campaign!,d=c.reliabilityStage!;
 if(kind==="deadline")d.fault!.startStep++;if(kind==="research")d.owned.push("standby");if(kind==="health")c.apps[0].health="failed";if(kind==="spare")d.spareId="app-1";if(kind==="capacity")c.apps[0].capacity++;if(kind==="configuration")d.configuration="wrong";
 const raw=JSON.stringify(e);localStorage.setItem(CAMPAIGN_SAVE_KEY,raw);expect(validateEnvelope(e).status).toBe("corrupt");expect(loadGame().status).toBe("corrupt");expect(saveGame(g)).toBe(false);expect(localStorage.getItem(CAMPAIGN_SAVE_KEY)).toBe(raw);
});

it.each(["backup","replacement"])("schema 5 migration %s failure preserves source bytes",failure=>{
 const raw=JSON.stringify({...makeEnvelope(readyReliability()),schemaVersion:5}),map=new Map([[CAMPAIGN_SAVE_KEY,raw]]);
 const storage={getItem:(key:string)=>map.get(key)??null,setItem:(key:string,value:string)=>{if(failure==="backup"&&key.endsWith(".backup.v5")||failure==="replacement"&&key===CAMPAIGN_SAVE_KEY)throw Error("storage blocked");map.set(key,value);}};
 expect(migrateSave(storage)).toBe(false);expect(map.get(CAMPAIGN_SAVE_KEY)).toBe(raw);
});

it("reliability trace projection deduplicates reload and separates automatic promotion from player decisions",async()=>{
 const {emptyMeasurement,beginSession,projectEvents}=await import("./telemetry");
 const {archiveEvents,readAnalytics}=await import("./persist");
 const start=act(preparedReliability(),{type:"arm_reliability"}),g=tick(start,10);
 const m=beginSession(emptyMeasurement(),start,"recorded-phase6","2026-10-11T00:00:00Z");
 const projected=projectEvents(m,g,"2026-10-11T00:00:10Z");
 const promotion=g.campaign!.actions.find(a=>a.type==="promote-spare")!;
 expect(projected.pending.filter(e=>e.name==="gameplay_decision"&&e.payload.actionId===promotion.id)).toEqual([]);
 expect(projected.pending.some(e=>e.name==="promote_spare_requested"&&e.payload.actionId===promotion.id)).toBe(true);
 expect(projected.pending.some(e=>e.name==="health_change_detected"&&e.payload.stageId==="application-reliability")).toBe(true);
 archiveEvents(projected.pending);const count=readAnalytics().length;archiveEvents(projectEvents(m,JSON.parse(JSON.stringify(g)),"2026-10-11T00:00:10Z").pending);
 expect(readAnalytics()).toHaveLength(count);expect(projectEvents(projected,g,"2026-10-11T00:00:10Z").pending).toEqual(projected.pending);
});

it("pending and acknowledged reliability outcome reload without repeating completion or rewards",()=>{
 let g=tick(act(preparedReliability(),{type:"arm_reliability"}),35);expect(g.campaign!.reliabilityStage!.completedStep).not.toBeNull();
 for(const acknowledged of [false,true]){
  if(acknowledged)g=act(g,{type:"acknowledge_reliability"});expect(saveGame(g,200,true)).toBe(true);
  const before=JSON.stringify(g);useGame.setState(useGame.getInitialState(),true);useGame.getState().boot();
  expect(JSON.stringify(useGame.getState().game)).toBe(before);expect(useGame.getState().running).toBe(false);
  expect(g.campaign!.trace.filter(t=>t.type==="reliability-stage-completed")).toHaveLength(1);
 }
});
