import { completeTutorialFixture } from "@/testing/tutorial";
import {beforeEach,afterEach,it,expect,vi} from "vitest";
import {newGame,applyAction,type GameState} from "../sim";
import {advanceSteps} from "../sim/step";
import {useGame,inspectOrSelect,WALKTHROUGH_STEPS} from "./store";
import {makeEnvelope,decodeSave,CAMPAIGN_SAVE_KEY} from "./saveEnvelope";
import {loadGame,saveGame,readAnalytics,archiveEvents,exportPlaytest,DEFAULT_META,saveMeta} from "./persist";
import {emptyMeasurement,beginSession,projectEvents} from "./telemetry";
beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);});
afterEach(()=>vi.restoreAllMocks());
function act(g:GameState,a:Parameters<typeof applyAction>[1]) {const r=applyAction(g,a);if(!r.ok)throw Error(r.message);return r.state;}
function recovered() {let g=advanceSteps(newGame(1,"phase2-test"),6).state;g=act(g,{type:"start_db_upgrade"});return advanceSteps(g,30).state;}
function enter(){useGame.getState().boot();useGame.getState().play();}
function v1(g:GameState) {
 const e=JSON.parse(JSON.stringify(makeEnvelope(g)));e.schemaVersion=1;
 delete e.runtime.measurement;
 e.inputs=e.inputs.filter((i:{action:{type:string}})=>i.action.type!=="acknowledge_milestone");
 return JSON.stringify(e);
}
/** The walkthrough's records among the playtest events, archived or still pending. */
function tutorialEvents() {
 const {events}=JSON.parse(exportPlaytest(useGame.getState().game,useGame.getState().measurement)) as {events:{name:string;payload:Record<string,unknown>}[]};
 return events.filter(e=>e.name.startsWith("tutorial_")).map(({name,payload:{track,step,from,reason}})=>({name,track,step,from,reason}));
}
function backup(raw:string) {const e=JSON.parse(raw);return CAMPAIGN_SAVE_KEY+".backup.v1."+e.runId+"."+e.savedAt;}
function aggregate(snapshot:NonNullable<GameState["campaign"]>["snapshot"]) {
 const {version: _version,instances: _instances,effectiveAppCapacity: _effective,appBusyBudget: _budget,routing: _routing,...recorded}=snapshot;
 return recorded;
}

it("landing boot creates neither durable company nor run event; explicit entry is idempotent",()=>{
 useGame.getState().boot();useGame.getState().boot();
 expect(localStorage.getItem(CAMPAIGN_SAVE_KEY)).toBeNull();expect(readAnalytics()).toEqual([]);
 useGame.getState().setRunning(false);useGame.getState().saveNow(true);
 expect(localStorage.getItem(CAMPAIGN_SAVE_KEY)).toBeNull();
 useGame.getState().advance();useGame.getState().setRunning(true);useGame.getState().tick(60);
 expect(useGame.getState().game.campaign!.step).toBe(0);
 useGame.getState().play();useGame.getState().play();
 expect(readAnalytics().filter(e=>e.name==="run_started")).toHaveLength(1);
});
it("offers the Opening walkthrough once, on a fresh company, holding its clock until Finish is pressed",()=>{
 enter();
 expect(useGame.getState().tour).toEqual({track:"campaign",step:0});
 expect(useGame.getState().onboarding).toBe(false);
 // The guide holds the clock, so the first incident cannot open while it is still teaching.
 useGame.getState().setRunning(true);useGame.getState().tick(10);useGame.getState().advance();
 expect(useGame.getState().running).toBe(false);
 expect(useGame.getState().game.campaign!.step).toBe(0);
 useGame.getState().endTour(false);
 expect(useGame.getState().tour?.track).toBe("campaign");
 completeTutorialFixture();
 useGame.getState().setRunning(true);useGame.getState().tick(1);
 expect(useGame.getState().game.campaign!.step).toBe(1);
 useGame.getState().setRunning(false);
 expect(useGame.getState().tour).toBeNull();
 expect(JSON.parse(localStorage.getItem("nn.campaign.meta.v1")!).tutorialDone).toBe(true);
 // Neither the same company after a reload nor a new company offers it again.
 useGame.setState(useGame.getInitialState(),true);enter();
 expect(useGame.getState().tour).toBeNull();
 useGame.getState().newRun();
 expect(useGame.getState().tour).toBeNull();
 // The menu replays it on the same company, which it leaves untouched.
 const before=structuredClone(useGame.getState().game);
 useGame.getState().showOnboarding();
 expect(useGame.getState().tour).toEqual({track:"campaign",step:0});
 expect(useGame.getState().game).toEqual(before);
});
it("keeps the final lesson unfinished and resumable until Finish is explicitly pressed",()=>{
 enter();
 for(let i=0;i<WALKTHROUGH_STEPS.campaign-1;i++)useGame.getState().tourNext();
 expect(useGame.getState().meta.tutorialDone).toBe(false);
 expect(JSON.parse(localStorage.getItem("nn.campaign.meta.v1")!)).toMatchObject({tutorialDone:false,walkthroughStep:20});
 useGame.getState().tourNext();useGame.getState().setRunning(true);
 expect(useGame.getState()).toMatchObject({running:false,tour:{step:20}});
 useGame.setState(useGame.getInitialState(),true);enter();
 expect(useGame.getState().tour).toEqual({track:"campaign",step:20});
 useGame.getState().endTour(true);
 expect(useGame.getState().meta.tutorialDone).toBe(true);
 useGame.setState(useGame.getInitialState(),true);enter();
 expect(useGame.getState().tour).toBeNull();
 expect(tutorialEvents().map(e=>e.name)).toEqual(["tutorial_started","tutorial_completed"]);
});
it("persists Back navigation and bounds it at the first lesson",()=>{
 enter();useGame.getState().tourBack();expect(useGame.getState().tour?.step).toBe(0);
 useGame.getState().tourNext();useGame.getState().tourNext();useGame.getState().tourBack();
 expect(useGame.getState().tour?.step).toBe(1);
 useGame.setState(useGame.getInitialState(),true);enter();
 expect(useGame.getState().tour).toEqual({track:"campaign",step:1});
});
it.each([false,true])("exits an optional replay paused without changing the company or recording completion, incident=%s",incident=>{
 const game=incident?advanceSteps(newGame(1,"exit-replay"),6).state:newGame(1,"exit-replay");
 saveGame(game);saveMeta({...DEFAULT_META,tutorialDone:true});enter();
 useGame.getState().startTour("campaign");
 useGame.getState().endTour(false);
 expect(useGame.getState()).toMatchObject({tour:null,running:false,meta:{tutorialDone:true,walkthroughStep:null,walkthroughFurthestStep:0}});
 expect(useGame.getState().game.campaign).toEqual(game.campaign);
 expect(tutorialEvents().map(e=>e.name)).toEqual(["tutorial_started","tutorial_skipped"]);
 useGame.setState(useGame.getInitialState(),true);enter();
 expect(useGame.getState().tour).toBeNull();
});
it("keeps first-time Chapter 0 mandatory even on the final lesson",()=>{
 enter();
 for(let step=0;step<WALKTHROUGH_STEPS.campaign;step++) {
  useGame.getState().endTour(false);
  expect(useGame.getState().tour?.step).toBe(step);
  useGame.getState().tourNext();
 }
 expect(useGame.getState().meta.tutorialDone).toBe(false);
});
it("pauses when leaving the replay's bounded Run exercise",()=>{
 saveMeta({...DEFAULT_META,tutorialDone:true});enter();useGame.getState().startTour("campaign");
 for(let step=0;step<5;step++)useGame.getState().tourNext();
 useGame.getState().setRunning(true);expect(useGame.getState().running).toBe(true);
 useGame.getState().endTour(false);useGame.getState().tick(10);
 expect(useGame.getState()).toMatchObject({tour:null,running:false,game:{campaign:{step:0}}});
});
it.each([false,true])("resumes an explicitly replayed walkthrough without clearing completion, later chapter=%s",later=>{
 const game=later?act(act(recovered(),{type:"acknowledge_review"}),{type:"acknowledge_milestone"}):newGame(1,"replay-resume");
 saveGame(game);saveMeta({...DEFAULT_META,tutorialDone:true});enter();
 expect(useGame.getState().tour).toBeNull();
 useGame.getState().startTour("campaign","home");
 for(let i=0;i<8;i++)useGame.getState().tourNext();
 useGame.getState().tourBack();useGame.getState().endSession();
 useGame.setState(useGame.getInitialState(),true);enter();
 expect(useGame.getState()).toMatchObject({tour:{track:"campaign",step:7},running:false,meta:{tutorialDone:true,walkthroughStep:7,walkthroughFurthestStep:8}});
 expect(useGame.getState().game.campaign).toEqual(game.campaign);
 expect(tutorialEvents().filter(e=>e.name==="tutorial_started")).toHaveLength(1);
 completeTutorialFixture();
 useGame.setState(useGame.getInitialState(),true);enter();
 expect(useGame.getState().tour).toBeNull();
 expect(useGame.getState().meta).toMatchObject({tutorialDone:true,walkthroughStep:null});
});
it("carries an unfinished walkthrough on where it was left, into a new company, as one start",()=>{
 enter();
 for(let i=0;i<5;i++)useGame.getState().tourNext();
 useGame.getState().endSession();useGame.getState().play();
 expect(useGame.getState().tour).toEqual({track:"campaign",step:5,clockUntil:1});
 useGame.setState(useGame.getInitialState(),true);enter();
 // The resumed Run lesson permits exactly one real second, then holds again.
 useGame.getState().setRunning(true);useGame.getState().tick(3);
 expect(useGame.getState().game.campaign!.step).toBe(1);
 expect(useGame.getState().tour).toEqual({track:"campaign",step:5,clockUntil:1});
 useGame.getState().newRun();
 expect(useGame.getState().tour).toEqual({track:"campaign",step:5,clockUntil:1});
 // Showing it again from the menu goes back to its start without starting another.
 useGame.getState().showOnboarding();
 expect(useGame.getState().tour).toEqual({track:"campaign",step:0});
 expect(tutorialEvents()).toEqual([{name:"tutorial_started",track:"campaign",step:0,from:"first_visit"}]);
});
it("offers the walkthrough on a company already under way in the Opening, but not in a later chapter",()=>{
 saveGame(advanceSteps(newGame(1,"walkthrough-test"),3).state);enter();
 expect(useGame.getState().tour).toEqual({track:"campaign",step:0});
 expect(tutorialEvents().at(-1)).toMatchObject({name:"tutorial_started",from:"resume"});
 useGame.setState(useGame.getInitialState(),true);localStorage.clear();
 saveGame(act(act(recovered(),{type:"acknowledge_review"}),{type:"acknowledge_milestone"}));enter();
 expect(useGame.getState().game.campaign!.scaling).toBeTruthy();
 expect(useGame.getState().tour).toBeNull();
});
it("keeps the walkthrough working in memory when its preference cannot be saved",()=>{
 enter();
 const setItem=Storage.prototype.setItem;
 vi.spyOn(Storage.prototype,"setItem").mockImplementation(function(this:Storage,key,value){if(key==="nn.campaign.meta.v1")throw Error("quota");setItem.call(this,key,value);});
 completeTutorialFixture();
 expect(useGame.getState().tour).toBeNull();
 expect(useGame.getState().meta.tutorialDone).toBe(true);
 expect(useGame.getState().toast).toMatchObject({kind:"error",text:"Onboarding preferences could not be saved."});
});
it("shows a chapter's guide once, paused, when the company first enters it",()=>{
 saveGame(act(recovered(),{type:"acknowledge_review"}));saveMeta({...DEFAULT_META,tutorialDone:true});enter();
 expect(useGame.getState().tour).toBeNull();
 // Acknowledging the Opening milestone continues the company into Scaling & Routing.
 expect(useGame.getState().act({type:"acknowledge_milestone"})).toBe(true);
 expect(useGame.getState().game.campaign!.scaling).toBeTruthy();
 expect(useGame.getState().tour).toEqual({track:"scaling",step:0});
 expect(useGame.getState().running).toBe(false);
 expect(JSON.parse(localStorage.getItem("nn.campaign.meta.v1")!).chapterTours).toEqual(["scaling"]);
 // Seen when shown: a reload in the middle of it, or ending it, does not bring it back.
 useGame.getState().endTour(true);
 expect(useGame.getState().meta.chapterTours).toEqual(["scaling"]);
 useGame.setState(useGame.getInitialState(),true);enter();
 expect(useGame.getState().tour).toBeNull();
});
it("continues a company whose Opening is acknowledged straight into scaling, without a guide",()=>{
 saveGame(act(act(recovered(),{type:"acknowledge_review"}),{type:"acknowledge_milestone"}));
 saveMeta({...DEFAULT_META,tutorialDone:true});
 enter();
 expect(useGame.getState().game.campaign!.scaling).toBeTruthy();
 expect(useGame.getState().tour).toBeNull();
});
it("closes an unfinished walkthrough when the company leaves the Opening, shows the chapter's guide and offers it again on the next company",()=>{
 saveGame(act(recovered(),{type:"acknowledge_review"}));
 enter();useGame.getState().tourNext();
 expect(useGame.getState().act({type:"acknowledge_milestone"})).toBe(true);
 expect(useGame.getState().tour).toEqual({track:"scaling",step:0});
 expect(useGame.getState().meta).toMatchObject({tutorialDone:false,walkthroughStep:null,chapterTours:["scaling"]});
 expect(JSON.parse(localStorage.getItem("nn.campaign.meta.v1")!)).toMatchObject({tutorialDone:false,walkthroughStep:null,chapterTours:["scaling"]});
 expect(tutorialEvents().at(-1)).toEqual({name:"tutorial_skipped",track:"campaign",step:1,reason:"chapter_entered"});
 useGame.getState().endTour(true);useGame.getState().newRun();
 expect(useGame.getState().tour).toEqual({track:"campaign",step:0});
 expect(tutorialEvents().at(-1)).toMatchObject({name:"tutorial_started",from:"new_company"});
});
it("records each completed walkthrough once and rejects a player skip in the playtest records, with the step reached",()=>{
 enter();
 useGame.getState().tourNext();useGame.getState().tourNext();useGame.getState().endTour(false);
 completeTutorialFixture();
 useGame.getState().showOnboarding();completeTutorialFixture();
 // A chapter's one-card guide is not the walkthrough, and a reload with the walkthrough done starts nothing.
 useGame.getState().startTour("scaling");useGame.getState().endTour(true);
 useGame.setState(useGame.getInitialState(),true);enter();
 expect(tutorialEvents()).toEqual([
  {name:"tutorial_started",track:"campaign",step:0,from:"first_visit"},
  {name:"tutorial_completed",track:"campaign",step:20},
  {name:"tutorial_started",track:"campaign",step:0,from:"menu"},
  {name:"tutorial_completed",track:"campaign",step:20},
 ]);
});
it("does not offer the walkthrough to a player who finished or skipped the former introduction, but replays it on request",()=>{
 localStorage.setItem("nn.campaign.meta.v1",JSON.stringify({openingOnboarding:{version:1,step:0,status:"skipped"},runsStarted:1}));
 enter();
 expect(useGame.getState().tour).toBeNull();
 useGame.getState().showOnboarding();
 expect(useGame.getState().tour).toEqual({track:"campaign",step:0});
});
it("milestone is awarded only on report acknowledgement and never changes physical or financial state",()=>{
 const g=recovered();expect(g.campaign!.openingMilestone).toBeNull();
 const next=act(g,{type:"acknowledge_review"}),c=next.campaign!;
 expect(c.openingMilestone).toMatchObject({acknowledged:false,incidentId:c.reports[0].id});
 expect(c.cashCents).toBe(g.campaign!.cashCents);expect(c.ledger).toEqual(g.campaign!.ledger);
 expect(c.step).toBe(g.campaign!.step);expect(c.pending).toEqual(g.campaign!.pending);
 expect(applyAction(next,{type:"acknowledge_review"}).ok).toBe(false);
 const ack=act(next,{type:"acknowledge_milestone"});
 expect(applyAction(ack,{type:"acknowledge_milestone"}).ok).toBe(false);
 expect(ack.campaign!.trace.filter(t=>t.type==="milestone-awarded")).toHaveLength(1);
});
it("pending milestone survives reload and blocks all clock controls",()=>{
 saveGame(act(recovered(),{type:"acknowledge_review"}));enter();
 const before=structuredClone(useGame.getState().game.campaign!);
 useGame.getState().advance();useGame.getState().setRunning(true);useGame.getState().tick(60);
 expect(useGame.getState().game.campaign).toEqual(before);
 useGame.getState().act({type:"acknowledge_milestone"});
 expect(loadGame()).toMatchObject({status:"ok",game:{campaign:{openingMilestone:{acknowledged:true}}}});
});
it.each(["healthy","review","acknowledged"] as const)("migrates Phase 1 %s without altering its physics or legacy bytes",kind=>{
 let g=kind==="healthy"?newGame():recovered();
 if(kind==="acknowledged")g=act(g,{type:"acknowledge_review"});
 const raw=v1(g);localStorage.setItem(CAMPAIGN_SAVE_KEY,raw);localStorage.setItem("nn.save.v1","legacy");
 const loaded=loadGame();expect(loaded.status).toBe("ok");if(loaded.status!=="ok")throw Error("load");
 expect(loaded.game.campaign!.snapshot).toEqual(aggregate(g.campaign!.snapshot));
 expect(loaded.game.campaign!.recent.every(m=>m.instances===undefined)).toBe(true);
 expect(loaded.game.campaign!.ledger).toEqual(g.campaign!.ledger);

 expect(loaded.game.campaign!.openingMilestone?.acknowledged??null).toBe(kind==="acknowledged"?true:null);
 expect(loaded.measurement).toMatchObject({origin:"phase1",openingStartedAt:null});
 expect(saveGame(loaded.game,loaded.remainderMs,false,loaded.measurement)).toBe(true);
 expect(localStorage.getItem(backup(raw))).toBe(raw);
 expect(localStorage.getItem("nn.save.v1")).toBe("legacy");expect(readAnalytics()).toEqual([]);
});
it.each([
 {failure:"backup",reset:false},{failure:"active",reset:false},
 {failure:"backup",reset:true},{failure:"active",reset:true}
])("preserves Phase 1 bytes after $failure write failure (explicit reset: $reset)",({failure,reset})=>{
 const raw=v1(recovered());localStorage.setItem(CAMPAIGN_SAVE_KEY,raw);
 const original=Storage.prototype.setItem;
 vi.spyOn(Storage.prototype,"setItem").mockImplementation(function(this:Storage,key,value){
  if(key===(failure==="backup"?backup(raw):CAMPAIGN_SAVE_KEY))throw Error("quota");
  original.call(this,key,value);
 });
 const loaded=loadGame();expect(loaded.status).toBe("ok");if(loaded.status!=="ok")throw Error("load");
 expect(saveGame(loaded.game,0,reset,loaded.measurement)).toBe(false);expect(localStorage.getItem(CAMPAIGN_SAVE_KEY)).toBe(raw);
 if(failure==="active")expect(localStorage.getItem(backup(raw))).toBe(raw);
});
it("loads main's input-log envelope with queued work, fractional clock credit and no snapshot",()=>{
 const raw=JSON.stringify({schemaVersion:1,scenarioId:"opening-db",scenarioVersion:1,
  runId:"main-save",seed:1,step:7,inputs:[{step:6,action:{type:"start_db_upgrade"}}],
  runtime:{remainderMs:350},savedAt:123});
 localStorage.setItem(CAMPAIGN_SAVE_KEY,raw);saveMeta({...DEFAULT_META,tutorialDone:true});
 const expected=advanceSteps(act(advanceSteps(newGame(1,"main-save"),6).state,{type:"start_db_upgrade"}),1).state;
 const loaded=loadGame();expect(loaded.status).toBe("ok");if(loaded.status!=="ok")throw Error("load");
 expect(loaded.game.campaign).toMatchObject({runId:"main-save",step:7,cashCents:expected.campaign!.cashCents,
  dbCapacity:600,dbBacklog:expected.campaign!.dbBacklog,pending:expected.campaign!.pending,
  ledger:expected.campaign!.ledger,cumulative:expected.campaign!.cumulative,scaling:null});
 expect(loaded.game.campaign!.snapshot).toEqual(aggregate(expected.campaign!.snapshot));
 expect(loaded.game.campaign!.trace.find(e=>e.type==="action-requested")!.data).toEqual({actionId:expected.campaign!.actions[0].id,type:"upgrade-db",costCents:300000,activationStep:9});
 expect(loaded.remainderMs).toBe(350);
 expect(localStorage.getItem(CAMPAIGN_SAVE_KEY)).toBe(raw);
 enter();expect(useGame.getState().running).toBe(false);
 expect(localStorage.getItem(backup(raw))).toBe(raw);
 useGame.getState().setRunning(true);useGame.getState().tick(1.65);
 expect(useGame.getState().game.campaign!.step).toBe(9);
 expect(useGame.getState().game.campaign!.dbCapacity).toBe(1000);
 expect(loadGame()).toMatchObject({status:"ok",game:useGame.getState().game,remainderMs:0});
});
it("normalizes a historical acknowledgement into a current replay save without re-awarding completion",()=>{
 let game=act(recovered(),{type:"acknowledge_review"});
 game=act(game,{type:"acknowledge_milestone"});game=advanceSteps(game,4).state;
 localStorage.setItem(CAMPAIGN_SAVE_KEY,v1(game));
 const loaded=loadGame();if(loaded.status!=="ok")throw Error("load");
 const upgraded=makeEnvelope(loaded.game,0,123,loaded.measurement);
 const roundtrip=decodeSave(JSON.stringify(upgraded));
 expect(roundtrip).toMatchObject({status:"ok",game:loaded.game});
 enter();useGame.getState().advance();
 expect(readAnalytics().filter(e=>e.name==="run_completed_opening")).toEqual([]);
 expect(useGame.getState().game.campaign!.openingMilestone?.acknowledged).toBe(true);
});
it("trace projection deduplicates retries and distinguishes request/activation steps",()=>{
 let g=advanceSteps(newGame(1,"events"),6).state;
 let m=beginSession(emptyMeasurement(),g,"session","2026-10-09T00:00:00Z");
 g=act(g,{type:"start_db_upgrade"});g=advanceSteps(g,3).state;
 m=projectEvents(m,g,"2026-10-09T00:00:05Z");
 const projected=projectEvents(m,g,"2026-10-09T00:00:06Z");expect(projected).toEqual(m);
 expect(m.pending.find(e=>e.name==="database_upgrade_requested")?.physicalStep).toBe(6);
 expect(m.pending.find(e=>e.name==="action_activated")?.physicalStep).toBe(9);
 archiveEvents(m.pending);archiveEvents(m.pending);
 expect(new Set(readAnalytics().map(e=>e.eventId)).size).toBe(readAnalytics().length);
});
it("archive failure retains pending events in saved envelope and reload retries once",()=>{
 enter();
 const original=Storage.prototype.setItem;
 const failure=vi.spyOn(Storage.prototype,"setItem").mockImplementation(function(this:Storage,k,v){
  if(k==="nn.campaign.analytics.v1")throw Error("quota");original.call(this,k,v);
 });
 inspectOrSelect("db");expect(useGame.getState().measurement.pending.some(e=>e.name==="component_inspected")).toBe(true);
 expect(JSON.parse(localStorage.getItem(CAMPAIGN_SAVE_KEY)!).runtime.measurement.pending.length).toBeGreaterThan(0);
 failure.mockRestore();useGame.setState(useGame.getInitialState(),true);useGame.getState().boot();useGame.getState().play();
 expect(readAnalytics().filter(e=>e.name==="component_inspected")).toHaveLength(1);
});
it("continuation retains run identity; reset retains old evidence and requires a decision for replay",()=>{
 enter();const id=useGame.getState().game.campaign!.runId;
 useGame.getState().endSession();useGame.getState().play();expect(useGame.getState().game.campaign!.runId).toBe(id);
 useGame.getState().newRun();expect(useGame.getState().game.campaign!.runId).not.toBe(id);
 expect(readAnalytics().filter(e=>e.name==="gameplay_decision")).toHaveLength(0);
 useGame.getState().act({type:"add_server"});
 expect(readAnalytics().filter(e=>e.name==="gameplay_decision")).toHaveLength(1);
 expect(readAnalytics().some(e=>e.name==="run_evidence")).toBe(true);
 const exported=JSON.parse(exportPlaytest(useGame.getState().game,useGame.getState().measurement));
 expect(exported.events.some((e:{name:string})=>e.name==="run_reset")).toBe(true);
});
it("active timing includes paused thinking but excludes hidden/offline intervals",()=>{
 let now=0;vi.spyOn(performance,"now").mockImplementation(()=>now);
 enter();now=1000;useGame.getState().measureTime();expect(useGame.getState().measurement.activeMs).toBe(1000);
 Object.defineProperty(document,"hidden",{configurable:true,value:true});useGame.getState().measureTime();
 now=9000;useGame.getState().measureTime();expect(useGame.getState().measurement.activeMs).toBe(1000);
 Object.defineProperty(document,"hidden",{configurable:true,value:false});useGame.getState().measureTime();
 now=9500;useGame.getState().measureTime();expect(useGame.getState().measurement.activeMs).toBe(1500);
});
it("bankruptcy telemetry survives explicit restart",()=>{
 let g=advanceSteps(newGame(),6).state;
 const ending=advanceSteps(g,100000).state;
 g=advanceSteps(g,ending.campaign!.step-g.campaign!.step-1).state;saveGame(g);
 saveMeta({...DEFAULT_META,tutorialDone:true});
 enter();useGame.getState().setRunning(true);useGame.getState().tick(1);
 expect(useGame.getState().game.phase).toBe("ended");
 expect(readAnalytics().filter(e=>e.name==="run_failed")).toHaveLength(1);
 useGame.getState().newRun();expect(readAnalytics().filter(e=>e.name==="run_failed")).toHaveLength(1);
});
it("proactive upgrade prevents the incident without manufacturing a milestone",()=>{
 let g=act(newGame(),{type:"start_db_upgrade"});g=advanceSteps(g,20).state;
 expect(g.campaign!.incident).toBeNull();expect(g.campaign!.openingMilestone).toBeNull();
 expect(g.campaign!.reports).toEqual([]);
});
it("later incident recovery cannot re-award the opening milestone",()=>{
 let g=advanceSteps(newGame(1,"repeat"),6).state;
 g=act(g,{type:"set_traffic_limit",enabled:true});g=advanceSteps(g,30).state;
 g=act(g,{type:"acknowledge_review"});g=act(g,{type:"acknowledge_milestone"});
 const milestone=structuredClone(g.campaign!.openingMilestone);
 g=act(g,{type:"set_traffic_limit",enabled:false});g=advanceSteps(g,10).state;
 expect(g.phase).toBe("incident");
 g=act(g,{type:"set_traffic_limit",enabled:true});g=advanceSteps(g,30).state;
 g=act(g,{type:"acknowledge_review"});
 expect(g.campaign!.openingMilestone).toEqual(milestone);
 expect(g.campaign!.trace.filter(t=>t.type==="milestone-awarded")).toHaveLength(1);
});
it("successful archive write followed by reload does not duplicate the staged occurrence",()=>{
 enter();inspectOrSelect("app");
 // The durable envelope intentionally retains the pending occurrence until the next save.
 const before=readAnalytics().filter(e=>e.name==="component_inspected");expect(before).toHaveLength(1);
 useGame.setState(useGame.getInitialState(),true);enter();
 expect(readAnalytics().filter(e=>e.name==="component_inspected")).toEqual(before);
});
