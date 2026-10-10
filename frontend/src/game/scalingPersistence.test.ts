import {beforeEach,it,expect,vi} from "vitest";
import {newGame,applyAction,type GameState,type Action} from "../sim";
import {advanceSteps,step} from "../sim/step";
import {makeEnvelope,validateEnvelope,CAMPAIGN_SAVE_KEY} from "./saveMigrations";
import {loadGame} from "./persist";
import {useGame,inspectOrSelect} from "./store";
function act(g:GameState,a:Action){const r=applyAction(g,a);if(!r.ok)throw Error(r.message);return r.state;}
/** Reconstruct the accepted schema-2 format, with original aggregate snapshots only. */
function oldEnvelope(g:GameState,version=2) {
 const e=JSON.parse(JSON.stringify(makeEnvelope(g))),c=e.game.campaign;
 e.schemaVersion=version;delete c.openingPrevention;
 for(const key of ["routing","loadBalancer","routingEnabledOnce","scaling","overload"])delete c[key];
 c.apps.forEach((a:Record<string,unknown>)=>{delete a.tier;delete a.state;});
 delete c.ledger.lbNumerator;delete c.remainders.lb;
 for(const m of [c.snapshot,...c.recent,...(c.incident?.snapshots??[]),...c.reports.flatMap((p:{snapshots:unknown[]})=>p.snapshots)])
  for(const key of ["version","instances","effectiveAppCapacity","appBusyBudget","routing"])delete m[key];
 for(const a of [...c.actions,...c.pending]){delete a.targetId;delete a.capacityAfter;}
 if(version===1){delete c.openingMilestone;delete e.runtime.measurement;}
 return JSON.stringify(e);
}
beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);});
it.each([1,2])("migrates real schema %s shape preserving source bytes, queues, trace and historical metrics",version=>{
 let g=advanceSteps(newGame(3,"migration"),6).state;g=act(g,{type:"start_db_upgrade"});
 const raw=oldEnvelope(g,version);localStorage.setItem(CAMPAIGN_SAVE_KEY,raw);localStorage.setItem("nn.save.v1","legacy bytes");
 const loaded=loadGame();expect(loaded.status).toBe("ok");if(loaded.status!=="ok")throw Error("Migration failed");
 const c=loaded.game.campaign!;
 expect(c.runId).toBe(g.campaign!.runId);expect(c.cashCents).toBe(g.campaign!.cashCents);expect(c.dbBacklog).toBe(600);
 expect(c.scaling).toBeNull();expect(c.snapshot.instances).toBeUndefined();expect(c.trace).toEqual(g.campaign!.trace);
 expect(c.pending[0]).toMatchObject({activationStep:9,capacityAfter:1000});
 expect(localStorage.getItem(`${CAMPAIGN_SAVE_KEY}.backup.v${version}`)).toBe(raw);expect(localStorage.getItem("nn.save.v1")).toBe("legacy bytes");
 expect(step(loaded.game).state.campaign!.snapshot.version).toBe(3);
});
it("migrates acknowledged Phase 2 companies without entering the stage on boot",()=>{
 let g=advanceSteps(newGame(),6).state;g=act(g,{type:"start_db_upgrade"});g=advanceSteps(g,30).state;g=act(g,{type:"acknowledge_review"});g=act(g,{type:"acknowledge_milestone"});
 const raw=oldEnvelope(g);localStorage.setItem(CAMPAIGN_SAVE_KEY,raw);useGame.getState().boot();
 expect(useGame.getState().game.campaign!.scaling).toBeNull();const id=useGame.getState().game.campaign!.runId;
 useGame.getState().play();expect(useGame.getState().game.campaign!.scaling).not.toBeNull();expect(useGame.getState().game.campaign!.runId).toBe(id);
 useGame.getState().onboardingMove("skip");inspectOrSelect("app","app-1");expect(useGame.getState().selectedAppId).toBe("app-1");
});
it.each(["targets","capacity","inactive","counter","snapshot","cash"])("rejects inconsistent schema 3 %s",kind=>{
 const e=makeEnvelope(newGame()),c=e.game.campaign!;
 if(kind==="targets")c.routing.targets=["app-2"];
 if(kind==="capacity")c.apps[0].capacity=1600;
 if(kind==="inactive")(c.apps[0] as unknown as {state:string}).state="inactive";
 if(kind==="counter")c.overload.db=-1;
 if(kind==="snapshot")c.snapshot.installedAppCapacity=2000;
 if(kind==="cash")e.game.cash++;
 expect(validateEnvelope(e).status).toBe("corrupt");
});

it.each(["capacityAfter","cost","delay"])("rejects corrupt pending schema 3 deployment %s",kind=>{
 const g=act(newGame(),{type:"start_db_upgrade"}),e=makeEnvelope(g);
 for(const a of [...e.game.campaign!.actions,...e.game.campaign!.pending]) {
  if(kind==="capacityAfter")a.capacityAfter=99999;
  if(kind==="cost")a.costCents=0;
  if(kind==="delay")a.activationStep++;
 }
 expect(validateEnvelope(e).status).toBe("corrupt");
});

it.each(["backup","replacement"])("preserves schema 2 source and legacy bytes when %s writing fails",boundary=>{
 const raw=oldEnvelope(newGame());localStorage.setItem(CAMPAIGN_SAVE_KEY,raw);
 for(const key of ["nn.save.v1","nn.meta.v1","nn.analytics.v1"])localStorage.setItem(key,"legacy:"+key);
 const original=Storage.prototype.setItem;
 const spy=vi.spyOn(Storage.prototype,"setItem").mockImplementation(function(this:Storage,key:string,value:string){
  if(boundary==="backup"?key.endsWith(".backup.v2"):key===CAMPAIGN_SAVE_KEY)throw Error("quota");
  original.call(this,key,value);
 });
 try {
  expect(loadGame().status).toBe("unsupported");expect(localStorage.getItem(CAMPAIGN_SAVE_KEY)).toBe(raw);
  for(const key of ["nn.save.v1","nn.meta.v1","nn.analytics.v1"])expect(localStorage.getItem(key)).toBe("legacy:"+key);
 }finally{spy.mockRestore();}
});
it("resumes a pending targeted upgrade with its exact local scheduling and evidence",()=>{
 let g=advanceSteps(newGame(),6).state;g=act(g,{type:"start_db_upgrade"});g=advanceSteps(g,30).state;
 g=act(g,{type:"acknowledge_review"});g=act(g,{type:"acknowledge_milestone"});g=act(g,{type:"scale_up",appId:"app-1"});
 localStorage.setItem(CAMPAIGN_SAVE_KEY,JSON.stringify(makeEnvelope(g)));
 const loaded=loadGame();expect(loaded.status).toBe("ok");if(loaded.status!=="ok")throw Error("load");
 expect(loaded.game).toEqual(g);expect(advanceSteps(loaded.game,3)).toEqual(advanceSteps(g,3));
});
