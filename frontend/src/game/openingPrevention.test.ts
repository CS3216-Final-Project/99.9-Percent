import {beforeEach,it,expect} from "vitest";
import {newGame,applyAction,type GameState,type Action} from "../sim";
import {advanceSteps} from "../sim/step";
import {makeEnvelope,decodeSave,CAMPAIGN_SAVE_KEY} from "./saveEnvelope";
import {saveGame,loadGame} from "./persist";
import {useGame} from "./store";
import {beginSession,emptyMeasurement,projectEvents} from "./telemetry";
function act(g:GameState,a:Action){const r=applyAction(g,a);if(!r.ok)throw Error(r.message);return r.state;}
/** A company that avoided the Opening incident by limiting traffic and stalled there: it never inspected, so it never qualified. */
function deadEnd() {
 let g=newGame(0,"dead-end-company");g=act(g,{type:"set_traffic_limit",enabled:true});g=act(g,{type:"start_db_upgrade"});return advanceSteps(g,405).state;
}
function inspecting(g:GameState){g=act(g,{type:"incident_inspect",equipment:"app"});return act(g,{type:"incident_inspect",equipment:"db"});}
beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);});
it("reloads a stalled Opening company and lets it progress with the same run",()=>{
 let g=deadEnd();const raw=JSON.stringify(makeEnvelope(g));localStorage.setItem(CAMPAIGN_SAVE_KEY,raw);
 const loaded=loadGame();if(loaded.status!=="ok")throw Error("load");
 expect(loaded.game).toEqual(g);expect(loaded.game.campaign!.openingPrevention).toMatchObject({stableSteps:0,appInspectedStep:null,dbInspectedStep:null,outcome:null});
 g=inspecting(loaded.game);g=act(g,{type:"set_traffic_limit",enabled:false});g=advanceSteps(g,5).state;
 expect(g.campaign!.openingPrevention!.outcome!.qualifiedStep).toBe(410);
 g=act(g,{type:"acknowledge_prevention_review"});g=act(g,{type:"acknowledge_milestone"});expect(saveGame(g)).toBe(true);
 const again=loadGame();if(again.status!=="ok")throw Error("load");
 expect(again.game.campaign!.runId).toBe("dead-end-company");expect(again.game.campaign!.scaling?.id).toBe("application-scaling");expect(again.game.campaign!.openingRecovered).toBe(false);
});
it("acknowledges the prevention review for a run recorded before it existed, instead of refusing the save",()=>{
 // Upgrading at once and inspecting after growth qualifies at step 9 on today's engine; the older build kept running.
 const raw=JSON.stringify({schemaVersion:4,scenarioId:"opening-db",scenarioVersion:1,runId:"pre-prevention",seed:0,step:40,
  inputs:[{step:0,action:{type:"start_db_upgrade"}},{step:4,action:{type:"incident_inspect",equipment:"app"}},{step:4,action:{type:"incident_inspect",equipment:"db"}},{step:20,action:{type:"add_server"}}],
  runtime:{remainderMs:0,measurement:emptyMeasurement()},savedAt:1});
 const loaded=decodeSave(raw);if(loaded.status!=="ok")throw Error(loaded.status);
 const c=loaded.game.campaign!;
 expect(c.step).toBe(40);expect(c.openingPrevention!.outcome).toMatchObject({qualifiedStep:9,acknowledged:true});
 expect(c.openingMilestone).toMatchObject({outcomeId:"opening-prevention",acknowledged:false});expect(c.apps).toHaveLength(2);
 // The added acknowledgement is recorded, so the next save replays to the same state.
 const resaved=decodeSave(JSON.stringify(makeEnvelope(loaded.game)));if(resaved.status!=="ok")throw Error(resaved.status);
 expect(resaved.game).toEqual(loaded.game);
});
it("leaves a replayed prevention milestone for the player in a legacy save instead of acknowledging it",()=>{
 // Schema 1 acknowledged incident milestones implicitly; a milestone earned by prevention was never shown, so it must stay pending.
 const raw=JSON.stringify({schemaVersion:1,scenarioId:"opening-db",scenarioVersion:1,runId:"legacy-prevention",seed:0,step:40,
  inputs:[{step:0,action:{type:"start_db_upgrade"}},{step:4,action:{type:"incident_inspect",equipment:"app"}},{step:4,action:{type:"incident_inspect",equipment:"db"}},{step:20,action:{type:"start_db_upgrade"}}],
  runtime:{remainderMs:0,measurement:emptyMeasurement()},savedAt:1});
 const loaded=decodeSave(raw);if(loaded.status!=="ok")throw Error(loaded.status);
 const c=loaded.game.campaign!;
 expect(c.openingMilestone).toMatchObject({outcomeId:"opening-prevention",acknowledged:false});
 expect(c.dbCapacity).toBe(1000);expect(c.trace.filter(t=>t.type==="action-rejected"&&t.data.action==="start_db_upgrade")).toHaveLength(1);
});
it("preserves a partial streak, inspections and a pending review through reload",()=>{
 let g=inspecting(deadEnd());g=act(g,{type:"set_traffic_limit",enabled:false});g=advanceSteps(g,2).state;
 expect(saveGame(g)).toBe(true);let loaded=loadGame();if(loaded.status!=="ok")throw Error("load");expect(loaded.game.campaign).toEqual(g.campaign);
 g=advanceSteps(loaded.game,3).state;expect(saveGame(g)).toBe(true);loaded=loadGame();if(loaded.status!=="ok")throw Error("load");expect(loaded.game.campaign).toEqual(g.campaign);
 expect(advanceSteps(loaded.game,20).stepsConsumed).toBe(0);
});
it("does not count paused ticks, review reading or repeated acknowledgement",()=>{
 let g=inspecting(deadEnd());g=act(g,{type:"set_traffic_limit",enabled:false});g=advanceSteps(g,2).state;
 useGame.setState({game:g,ready:true,started:true,onboarding:false,running:false});useGame.getState().tick(1000);expect(useGame.getState().game).toEqual(g);
 useGame.getState().setRunning(true);useGame.getState().tick(3);expect(useGame.getState().running).toBe(false);
 const n=useGame.getState().game.campaign!.step;useGame.getState().tick(100);useGame.getState().advance();expect(useGame.getState().game.campaign!.step).toBe(n);
 expect(useGame.getState().act({type:"acknowledge_prevention_review"})).toBe(true);expect(useGame.getState().act({type:"acknowledge_prevention_review"})).toBe(false);
 expect(useGame.getState().act({type:"acknowledge_milestone"})).toBe(true);expect(useGame.getState().game.campaign!.step).toBe(n);
});
it("projects stable attributed prevention events once and never counts qualification as a purchase",()=>{
 let g=inspecting(deadEnd());g=act(g,{type:"set_traffic_limit",enabled:false});
 const m=beginSession(emptyMeasurement(),g,"prevention-session","2026-10-10T00:00:00Z");m.cursor=g.campaign!.trace.find(t=>t.type==="opening-prevention-eligible")!.id-1;
 g=advanceSteps(g,5).state;g=act(g,{type:"acknowledge_prevention_review"});
 const out=projectEvents(m,g,"2026-10-10T00:01:00Z"),again=projectEvents(out,g,"2026-10-10T00:02:00Z");expect(again).toEqual(out);
 for(const name of ["opening_prevention_eligible","opening_prevention_application_inspected","opening_prevention_database_inspected","opening_prevention_qualified","opening_prevention_review_acknowledged","run_completed_opening"])expect(out.pending.filter(e=>e.name===name)).toHaveLength(1);
 expect(out.pending.filter(e=>e.name==="gameplay_decision")).toHaveLength(1); // only the accepted removal request
 expect(out.pending.find(e=>e.name==="run_completed_opening")!.payload.outcome).toBe("prevention");
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
