import {beforeEach,it,expect,vi} from "vitest";
import {newGame} from "../sim";
import {loadGame} from "./persist";
import {makeEnvelope,CAMPAIGN_SAVE_KEY,validateEnvelope} from "./saveMigrations";
beforeEach(()=>localStorage.clear());
it("migrates schema 3 with exact source backup, no stage entry or invented observations",()=>{
 const e=JSON.parse(JSON.stringify(makeEnvelope(newGame(7,"prior-company"))));e.schemaVersion=3;delete e.game.campaign.openingPrevention;
 delete e.game.campaign.dataStage;delete e.game.campaign.readCache;
 delete e.game.campaign.ledger.cacheNumerator;delete e.game.campaign.remainders.cache;
 const raw=JSON.stringify(e);localStorage.setItem(CAMPAIGN_SAVE_KEY,raw);
 for(const key of ["nn.save.v1","nn.meta.v1","nn.analytics.v1"])localStorage.setItem(key,"legacy:"+key);
 const r=loadGame();expect(r.status).toBe("ok");if(r.status!=="ok")throw Error("migration");
 expect(r.game.campaign!.dataStage).toBeNull();expect(r.game.campaign!.snapshot).toEqual(e.game.campaign.snapshot);
 expect(r.game.campaign!.trace).toEqual(e.game.campaign.trace);expect(localStorage.getItem(CAMPAIGN_SAVE_KEY+".backup.v3")).toBe(raw);
 for(const key of ["nn.save.v1","nn.meta.v1","nn.analytics.v1"])expect(localStorage.getItem(key)).toBe("legacy:"+key);
 expect(JSON.parse(localStorage.getItem(CAMPAIGN_SAVE_KEY)!).schemaVersion).toBe(5);
});
it.each(["backup","replacement"])("schema 3 %s write failure leaves original bytes intact",boundary=>{
 const e=JSON.parse(JSON.stringify(makeEnvelope(newGame())));e.schemaVersion=3;delete e.game.campaign.openingPrevention;
 const raw=JSON.stringify(e);localStorage.setItem(CAMPAIGN_SAVE_KEY,raw);const original=Storage.prototype.setItem;
 const spy=vi.spyOn(Storage.prototype,"setItem").mockImplementation(function(this:Storage,k:string,v:string){if(boundary==="backup"?k.endsWith(".backup.v3"):k===CAMPAIGN_SAVE_KEY)throw Error("quota");original.call(this,k,v);});
 try{expect(loadGame().status).toBe("unsupported");expect(localStorage.getItem(CAMPAIGN_SAVE_KEY)).toBe(raw);}finally{spy.mockRestore();}
});
it("rejects a cache or terminal DB tier without explicit data stage",()=>{
 const e=makeEnvelope(newGame());e.game.campaign!.readCache={activatedStep:0,warmth:0,target:6000,tuned:false};expect(validateEnvelope(e).status).toBe("corrupt");
});

it("schema 3 migration retains the Phase 3 reports, pending actions, cash and backlog",async()=>{
 const {dataCompany}=await import("../sim/__tests__/dataFixture");const {applyAction}=await import("../sim");
 let g=dataCompany("read-heavy",false);
 const requested=applyAction(g,{type:"set_traffic_limit",enabled:true});if(!requested.ok)throw Error(requested.message);g=requested.state;
 const e=JSON.parse(JSON.stringify(makeEnvelope(g)));e.schemaVersion=3;delete e.game.campaign.openingPrevention;delete e.game.campaign.dataStage;delete e.game.campaign.readCache;delete e.game.campaign.ledger.cacheNumerator;delete e.game.campaign.remainders.cache;
 const raw=JSON.stringify(e);localStorage.setItem(CAMPAIGN_SAVE_KEY,raw);const loaded=loadGame();expect(loaded.status).toBe("ok");if(loaded.status!=="ok")throw Error("migration");
 for(const k of ["cashCents","apps","dbBacklog","pending","trace","reports","openingMilestone","scaling"])expect((loaded.game.campaign as unknown as Record<string,unknown>)[k]).toEqual(e.game.campaign[k]);
 expect(localStorage.getItem(CAMPAIGN_SAVE_KEY+".backup.v3")).toBe(raw);
});
it("rejects forged workload observations and cache warmth",async()=>{
 const {dataCompany}=await import("../sim/__tests__/dataFixture");const {advanceSteps}=await import("../sim/step");
 const e=makeEnvelope(advanceSteps(dataCompany(),6).state);e.game.campaign!.snapshot.data!.hits=123;expect(validateEnvelope(e).status).toBe("corrupt");
});

it("explicit data entry pauses the shared clock and never spends time or money",async()=>{
 const {dataCompany}=await import("../sim/__tests__/dataFixture");const {useGame}=await import("./store");
 const g=dataCompany("read-heavy",false);const c=g.campaign!,before=c.step,cash=c.cashCents;
 useGame.setState(useGame.getInitialState(),true);useGame.setState({game:g,started:true,running:true,onboarding:false});
 expect(useGame.getState().act({type:"enter_data",profile:"read-heavy"})).toBe(true);
 expect(useGame.getState().running).toBe(false);expect(useGame.getState().game.campaign!.step).toBe(before);expect(useGame.getState().game.campaign!.cashCents).toBe(cash);
 useGame.getState().tick(10);expect(useGame.getState().game.campaign!.step).toBe(before);
 useGame.setState(useGame.getInitialState(),true);
});
it("local reload preserves exact partial warmth and pending tuning",async()=>{
 const {dataCompany}=await import("../sim/__tests__/dataFixture");const {applyAction}=await import("../sim");const {advanceSteps}=await import("../sim/step");const {saveGame}=await import("./persist");
 let g=advanceSteps(dataCompany("write-heavy"),6).state;let r=applyAction(g,{type:"deploy_cache"});if(!r.ok)throw Error(r.message);g=advanceSteps(r.state,2).state;
 expect(g.campaign!.readCache!.warmth).toBe(1200);r=applyAction(g,{type:"tune_cache"});if(!r.ok)throw Error(r.message);g=r.state;
 expect(saveGame(g)).toBe(true);const loaded=loadGame();expect(loaded.status).toBe("ok");if(loaded.status!=="ok")throw Error("resume");
 expect(loaded.game).toEqual(g);expect(advanceSteps(loaded.game,20)).toEqual(advanceSteps(g,20));
});
