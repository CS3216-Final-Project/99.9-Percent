import {it,expect,beforeEach} from "vitest";
import {makeEnvelope,validateEnvelope} from "./saveEnvelope";
import {loadGame,saveGame} from "./persist";
import {useGame} from "./store";
import {preparedReliability,act,tick} from "../sim/__tests__/reliabilityFixture";
beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);});
it.each([0,7,8,9,10,27,28,29,32,35])("reloads paused at reliability boundary +%s without rebasing",offset=>{
 let g=act(preparedReliability(),{type:"arm_reliability"});
 for(let i=0;i<offset;i++){if(g.phase==="review")g=act(g,{type:"acknowledge_review"});g=tick(g);}
 expect(saveGame(g,200,true)).toBe(true);useGame.setState(useGame.getInitialState(),true);useGame.getState().boot();
 expect(useGame.getState().running).toBe(false);expect(useGame.getState().game).toEqual(g);expect(loadGame().status).toBe("ok");
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
it("rejects reliability decisions in replay contracts older than schema 6",()=>{
 const e=makeEnvelope(act(preparedReliability(),{type:"arm_reliability"}));
 expect(validateEnvelope(e).status).toBe("ok");
 for(const schemaVersion of [1,2,3,4,5])expect(validateEnvelope({...e,schemaVersion}).status).toBe("corrupt");
});
