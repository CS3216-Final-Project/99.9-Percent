import {beforeEach,it,expect} from "vitest";
import {newGame,applyAction,type GameState,type Action} from "../sim";
import {advanceSteps} from "../sim/step";
import {makeEnvelope,decodeSave} from "./saveMigrations";
import {saveGame,loadGame} from "./persist";
import {useGame} from "./store";
import {beginSession,emptyMeasurement,projectEvents} from "./telemetry";
function act(g:GameState,a:Action){const r=applyAction(g,a);if(!r.ok)throw Error(r.message);return r.state;}
function oldDeadEnd() {
 let g=newGame(0,"old-schema5-company");g=act(g,{type:"set_traffic_limit",enabled:true});g=act(g,{type:"start_db_upgrade"});g=advanceSteps(g,405).state;
 delete g.campaign!.openingPrevention;
 g.campaign!.trace=g.campaign!.trace.filter(t=>!t.type.startsWith("opening-prevention")).map((t,i)=>({...t,id:i+1}));g.campaign!.nextEventId=g.campaign!.trace.length+1;
 return g;
}
function inspecting(g:GameState){g=act(g,{type:"incident_inspect",equipment:"app"});return act(g,{type:"incident_inspect",equipment:"db"});}
beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);});
it("loads an unchanged old schema 5 save without fabricating inspections, streaks or completion",()=>{
 const g=oldDeadEnd(),raw=JSON.stringify(makeEnvelope(g));localStorage.setItem("nn.campaign.save.v1",raw);
 const loaded=loadGame();expect(loaded.status).toBe("ok");expect(localStorage.getItem("nn.campaign.save.v1")).toBe(raw);
 if(loaded.status!=="ok")throw Error("load");expect(loaded.game).toEqual(g);expect(loaded.game.campaign!.openingPrevention).toBeUndefined();
 const next=advanceSteps(loaded.game,1).state;expect(next.campaign!.openingPrevention).toMatchObject({eligibleStep:406,stableSteps:0,appInspectedStep:null,dbInspectedStep:null,outcome:null});
});
it("lets the dead-ended company progress forward with the same run and schema, no restart",()=>{
 let g=oldDeadEnd();const id=g.campaign!.runId;
 g=inspecting(g);g=act(g,{type:"set_traffic_limit",enabled:false});g=advanceSteps(g,5).state;
 expect(g.campaign!.openingPrevention!.outcome).not.toBeNull();expect(g.campaign!.openingPrevention!.outcome!.qualifiedStep).toBe(410);
 expect(saveGame(g)).toBe(true);expect(JSON.parse(localStorage.getItem("nn.campaign.save.v1")!).schemaVersion).toBe(7);
 g=act(g,{type:"acknowledge_prevention_review"});expect(saveGame(g)).toBe(true);g=act(g,{type:"acknowledge_milestone"});expect(saveGame(g)).toBe(true);
 const loaded=loadGame();expect(loaded.status).toBe("ok");if(loaded.status!=="ok")throw Error("load");
 expect(loaded.game.campaign!.runId).toBe(id);expect(loaded.game.campaign!.scaling?.id).toBe("application-scaling");expect(loaded.game.campaign!.openingRecovered).toBe(false);
});
it("preserves partial streak, inspections and pending review through reload and repeated export",()=>{
 let g=inspecting(oldDeadEnd());g=act(g,{type:"set_traffic_limit",enabled:false});g=advanceSteps(g,2).state;
 expect(saveGame(g)).toBe(true);let loaded=loadGame();if(loaded.status!=="ok")throw Error("load");expect(loaded.game.campaign).toEqual(g.campaign);
 g=advanceSteps(loaded.game,3).state;expect(saveGame(g)).toBe(true);loaded=loadGame();if(loaded.status!=="ok")throw Error("load");expect(loaded.game.campaign).toEqual(g.campaign);
 expect(advanceSteps(loaded.game,20).stepsConsumed).toBe(0);expect(decodeSave(JSON.stringify(makeEnvelope(g))).status).toBe("ok");
});
it("does not count paused ticks, review reading or repeated acknowledgement",()=>{
 let g=inspecting(oldDeadEnd());g=act(g,{type:"set_traffic_limit",enabled:false});g=advanceSteps(g,2).state;
 useGame.setState({game:g,ready:true,started:true,onboarding:false,running:false});useGame.getState().tick(1000);expect(useGame.getState().game).toEqual(g);
 useGame.getState().setRunning(true);useGame.getState().tick(3);expect(useGame.getState().running).toBe(false);
 const n=useGame.getState().game.campaign!.step;useGame.getState().tick(100);useGame.getState().advance();expect(useGame.getState().game.campaign!.step).toBe(n);
 expect(useGame.getState().act({type:"acknowledge_prevention_review"})).toBe(true);expect(useGame.getState().act({type:"acknowledge_prevention_review"})).toBe(false);
 expect(useGame.getState().act({type:"acknowledge_milestone"})).toBe(true);expect(useGame.getState().game.campaign!.step).toBe(n);
});
it("projects stable attributed prevention events once and never counts qualification as a purchase",()=>{
 let g=inspecting(oldDeadEnd());g=act(g,{type:"set_traffic_limit",enabled:false});
 const m=beginSession(emptyMeasurement(),g,"prevention-session","2026-10-10T00:00:00Z");m.cursor=g.campaign!.trace.find(t=>t.type==="opening-prevention-eligible")!.id-1;
 g=advanceSteps(g,5).state;g=act(g,{type:"acknowledge_prevention_review"});
 const out=projectEvents(m,g,"2026-10-10T00:01:00Z"),again=projectEvents(out,g,"2026-10-10T00:02:00Z");expect(again).toEqual(out);
 for(const name of ["opening_prevention_eligible","opening_prevention_application_inspected","opening_prevention_database_inspected","opening_prevention_qualified","opening_prevention_review_acknowledged","run_completed_opening"])expect(out.pending.filter(e=>e.name===name)).toHaveLength(1);
 expect(out.pending.filter(e=>e.name==="gameplay_decision")).toHaveLength(1); // only the accepted removal request
 expect(out.pending.find(e=>e.name==="run_completed_opening")!.payload.outcome).toBe("prevention");
});
it.each(["streak","inspection","outcome","milestone"])("rejects corrupted %s extension without overwriting source or legacy keys",kind=>{
 let g=inspecting(oldDeadEnd());g=act(g,{type:"set_traffic_limit",enabled:false});g=advanceSteps(g,5).state;
 const e=structuredClone(makeEnvelope(g)),c=e.game.campaign!;
 if(kind==="streak")c.openingPrevention!.stableSteps=99;
 if(kind==="inspection")c.openingPrevention!.appInspectedStep=0;
 if(kind==="outcome")c.openingPrevention!.outcome!.snapshots[0].admitted=500;
 if(kind==="milestone")c.openingMilestone={id:"opening-stability",incidentId:null,outcomeId:"opening-prevention",awardedStep:c.step,acknowledged:false};
 const raw=JSON.stringify(e);localStorage.setItem("nn.campaign.save.v1",raw);
 for(const key of ["nn.save.v1","nn.meta.v1","nn.analytics.v1"])localStorage.setItem(key,"legacy-original");
 expect(loadGame().status).toBe("corrupt");expect(saveGame(newGame())).toBe(false);expect(localStorage.getItem("nn.campaign.save.v1")).toBe(raw);
 for(const key of ["nn.save.v1","nn.meta.v1","nn.analytics.v1"])expect(localStorage.getItem(key)).toBe("legacy-original");
});
it("preserves prevention recognition through a later real incident and Data continuation",()=>{
 let g=newGame(0,"prevention-later");g=act(g,{type:"set_traffic_limit",enabled:true});g=act(g,{type:"start_db_upgrade"});g=advanceSteps(g,4).state;g=inspecting(g);g=act(g,{type:"set_traffic_limit",enabled:false});g=advanceSteps(g,5).state;
 g=act(g,{type:"acknowledge_prevention_review"});g=act(g,{type:"acknowledge_milestone"});
 const milestone=structuredClone(g.campaign!.openingMilestone);g=act(g,{type:"start_db_upgrade"});g=advanceSteps(g,100).state;
 expect(g.phase).toBe("incident");expect(g.campaign!.incident!.primaryComponent).toBe("app-1");
 g=act(g,{type:"scale_up",appId:"app-1"});g=advanceSteps(g,30).state;expect(g.phase).toBe("review");expect(saveGame(g)).toBe(true);
 g=act(g,{type:"acknowledge_review"});expect(g.campaign!.openingMilestone).toEqual(milestone);
 g=act(g,{type:"enter_data",profile:"read-heavy"});expect(saveGame(g)).toBe(true);expect(loadGame().status).toBe("ok");
 expect(g.campaign!.trace.filter(t=>t.type==="milestone-awarded")).toHaveLength(1);expect(g.campaign!.openingPrevention!.outcome!.qualifiedStep).toBe(9);
});
