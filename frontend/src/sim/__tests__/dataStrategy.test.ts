// @vitest-environment node
import {it,expect} from "vitest";
import {newGame,applyAction,type GameState,type Action} from "../index";
import {step,advanceSteps,classifyData} from "../step";
import {makeEnvelope,validateEnvelope} from "../../game/saveEnvelope";
import {beginSession,emptyMeasurement,projectEvents} from "../../game/telemetry";
import {dataCompany} from "./dataFixture";
function act(g:GameState,a:Action){const r=applyAction(g,a);if(!r.ok)throw Error(r.message);return r.state;}
function ticks(g:GameState,n:number){for(let i=0;i<n;i++)g=step(g).state;return g;}
function install(g:GameState,a:Action,n:number){return ticks(act(g,a),n);}
function incident(profile:"read-heavy"|"write-heavy"="read-heavy"){return ticks(dataCompany(profile),6);}
it.each([[2400,8000,10000,6000,1248],[2400,2000,10000,6000,2112],[900,8000,10000,6000,468],[900,3000,10000,6000,738],[7,8000,5000,6000,6],[0,8000,10000,6000,0]])("classifies integer workload %s/%s/%s/%s",(p,r,e,h,db)=>{
 const w=classifyData(p,r,e,h);expect(w.databaseNewDemand).toBe(db);
 expect(w.reads+w.writes).toBe(p);expect(w.hits+w.databaseNewDemand).toBe(p);
 expect(w.databaseReadDemand+w.databaseWriteDemand).toBe(db);expect(w.eligibleMisses+w.hits).toBe(w.eligibleReads);
});
it("preserves exact architecture/finances on explicit entry and rejects duplicate or premature entry",()=>{
 expect(applyAction(newGame(),{type:"enter_data"}).ok).toBe(false);
 const g=dataCompany(),c=g.campaign!;expect(c.runId).toBe("data-company");expect(c.dbCapacity).toBe(2000);
 expect(c.apps.map(a=>a.capacity)).toEqual([1600,1600]);expect(c.dataStage?.consumed).toBe(false);
 expect(applyAction(g,{type:"enter_data"}).ok).toBe(false);expect(validateEnvelope(makeEnvelope(g)).status).toBe("ok");
});
it("sufficient app capacity exposes DB overload and leaves app capacity unconstrained",()=>{
 const g=incident(),c=g.campaign!;expect(c.incident?.primaryComponent).toBe("db");expect(c.snapshot.app.demandRatio).toBe(.75);
 expect(c.snapshot.db.demand).toBe(2400);expect(c.snapshot.data?.hits).toBe(0);
});
it("retains admission limits, consumes growth once and permits prevention",()=>{
 let g=dataCompany();g=install(g,{type:"set_traffic_limit",enabled:true},1);g=ticks(g,12);
 expect(g.campaign!.snapshot.admitted).toBe(500);expect(g.campaign!.incident).toBeNull();
 expect(g.campaign!.trace.filter(t=>t.type==="workload-changed")).toHaveLength(1);
});
it("deployment is delayed/cold and stored warmth differs from used rate",()=>{
 let g=act(incident(),{type:"deploy_cache"});g=ticks(g,1);expect(g.campaign!.readCache).toBeNull();
 g=step(g).state;expect(g.campaign!.snapshot.data).toMatchObject({hits:0,effectiveHitRateUsed:0,warmthAfterStep:1200});
 const rates=[0];for(let i=0;i<5;i++){g=step(g).state;rates.push(g.campaign!.snapshot.data!.effectiveHitRateUsed);}
 expect(rates).toEqual([0,1200,2400,3600,4800,6000]);expect(g.campaign!.readCache!.warmth).toBe(6000);
});
it("tuning is scheduled, ceiling-only and leaves base warmth/ramp/upkeep intact",()=>{
 let g=install(incident(),{type:"deploy_cache"},2);g=advanceSteps(g,30).state;
 expect(g.phase).toBe("review");g=act(g,{type:"acknowledge_review"});const cash=g.campaign!.cashCents;
 g=act(g,{type:"tune_cache"});expect(g.campaign!.cashCents).toBe(cash-100000);g=ticks(g,1);expect(g.campaign!.readCache!.target).toBe(6000);
 g=ticks(g,1);expect(g.campaign!.snapshot.data).toMatchObject({effectiveHitRateUsed:6000,warmthAfterStep:7200,target:7500});
 g=ticks(g,2);expect(g.campaign!.snapshot.data!.effectiveHitRateUsed).toBe(7500);expect(applyAction(g,{type:"tune_cache"}).ok).toBe(false);
});
it("write-heavy cache remains constrained until paid sequential DB activation",()=>{
 let g=install(incident("write-heavy"),{type:"deploy_cache"},2);g=ticks(g,8);
 expect(g.campaign!.snapshot.db.demand).toBe(2112);expect(g.campaign!.incident).not.toBeNull();
 const before=g.campaign!.cashCents;g=act(g,{type:"start_db_upgrade"});expect(g.campaign!.cashCents).toBe(before-400000);
 g=ticks(g,3);expect(g.campaign!.dbCapacity).toBe(2000);g=ticks(g,1);expect(g.campaign!.dbCapacity).toBe(3000);
 g=advanceSteps(g,20).state;expect(g.phase).toBe("review");expect(g.campaign!.reports.at(-1)!.explanations.join(" ")).toContain("writes");
});
it("DB-only strategy changes capacity rather than logical demand and recovers",()=>{
 let g=install(incident(),{type:"start_db_upgrade"},4);expect(g.campaign!.snapshot.data?.databaseNewDemand).toBe(2400);
 g=advanceSteps(g,20).state;expect(g.phase).toBe("review");expect(validateEnvelope(makeEnvelope(g)).status).toBe("ok");
});
it("zero eligible work cannot warm cache; review/acknowledgement has no warmth side effects",()=>{
 let g=install(incident(),{type:"deploy_cache"},2);g.campaign!.incomingRate=0;g=ticks(g,1);
 expect(g.campaign!.snapshot.data?.eligibleReads).toBe(0);expect(g.campaign!.readCache!.warmth).toBe(1200);
 g=install(incident(),{type:"deploy_cache"},2);g=advanceSteps(g,30).state;
 const w=g.campaign!.readCache!.warmth;expect(step(g).state).toEqual(g);g=act(g,{type:"acknowledge_review"});expect(g.campaign!.readCache!.warmth).toBe(w);
});
it("conserves every outcome and counts old backlog as DB work, not cache hits",()=>{
 let g=install(incident(),{type:"deploy_cache"},2);
 for(let i=0;i<25;i++) {
  if(g.phase==="review")g=act(g,{type:"acknowledge_review"});
  const c=g.campaign!,old=c.apps.reduce((n,a)=>n+a.backlog,0)+c.dbBacklog;
  g=step(g).state;const m=g.campaign!.snapshot;
  expect(old+m.admitted).toBe(m.successful+m.failed+m.app.backlog+m.db.backlog);
  expect(m.successful).toBe(m.db.processed+m.data!.hits);
  expect(validateEnvelope(makeEnvelope(g)).status).toBe("ok");
 }
});
it("hits earn request revenue exactly once and cache exposure starts at activation",()=>{
 let g=install(incident(),{type:"deploy_cache"},2), successes=g.campaign!.ledger.successes;
 for(let i=0;i<70&&g.campaign!.lastSettledPeriod===0;i++) {
  if(g.phase==="review")g=act(g,{type:"acknowledge_review"});
  g=step(g).state;successes+=g.campaign!.snapshot.successful;
 }
 const c=g.campaign!,p=c.settlements[0];expect(p.revenueCents).toBe(successes*20);
 const activeSteps=61-c.readCache!.activatedStep;expect(p.cacheCents).toBe(Math.floor(activeSteps*40000/60));
 expect(p.netCents).toBe(p.revenueCents-p.appCents-p.dbCents-p.salaryCents-(p.lbCents??0)-(p.cacheCents??0));
});
it("save serialization retains deterministic warm-up, pending tuning and DB upgrade",()=>{
 let g=install(incident("write-heavy"),{type:"deploy_cache"},2);g=act(g,{type:"tune_cache"});
 expect(advanceSteps(JSON.parse(JSON.stringify(g)),20)).toEqual(advanceSteps(g,20));
 g=ticks(g,4);g=act(g,{type:"start_db_upgrade"});expect(advanceSteps(JSON.parse(JSON.stringify(g)),20)).toEqual(advanceSteps(g,20));
});
it("contrast preserves same company/cache and can open another measured incident",()=>{
 let g=advanceSteps(install(incident(),{type:"deploy_cache"},2),30).state;g=act(g,{type:"acknowledge_review"});
 const w=g.campaign!.readCache!.warmth;g=act(g,{type:"contrast_workload"});expect(g.campaign!.readCache!.warmth).toBe(w);
 g=ticks(g,3);expect(g.campaign!.incident?.primaryComponent).toBe("db");expect(g.campaign!.snapshot.db.demand).toBe(2112);
 expect(applyAction(g,{type:"contrast_workload"}).ok).toBe(false);
});
it("local telemetry distinguishes request/activation and deduplicates data events",()=>{
 let g=incident(),m=beginSession(emptyMeasurement(),g,"data-session","2026-10-10T00:00:00Z");
 g=install(g,{type:"deploy_cache"},2);m=projectEvents(m,g,"2026-10-10T00:00:01Z");
 for(const n of ["data_stage_entered","workload_changed","cache_requested","cache_activated"])expect(m.pending.filter(e=>e.name===n)).toHaveLength(1);
 expect(projectEvents(m,g,"2026-10-10T00:00:02Z")).toEqual(m);
});
it("app upgrades change throughput but not DB capacity or cache effectiveness",()=>{
 let g=dataCompany();g.campaign!.apps[1].tier="base";g.campaign!.apps[1].capacity=1000;
 g=install(g,{type:"deploy_cache"},2);const db=g.campaign!.dbCapacity;g=install(g,{type:"scale_up",appId:"app-2"},3);
 expect(g.campaign!.dbCapacity).toBe(db);expect(g.campaign!.readCache!.target).toBe(6000);
});

it("a contrast can be saved before the next physical observation",()=>{
 let g=advanceSteps(install(incident(),{type:"deploy_cache"},2),30).state;g=act(g,{type:"acknowledge_review"});
 g=act(g,{type:"contrast_workload"});expect(validateEnvelope(makeEnvelope(g)).status).toBe("ok");
});
it("seeded selection is bounded/repeatable and evaluation does not consume RNG",()=>{
 const g=dataCompany("read-heavy",false),base=JSON.parse(JSON.stringify(g));
 const a=act(base,{type:"enter_data"}),b=act(JSON.parse(JSON.stringify(base)),{type:"enter_data"});expect(a).toEqual(b);
 expect(["read-heavy","write-heavy"]).toContain(a.campaign!.dataStage!.profile);
 const fixed=act(base,{type:"enter_data",profile:"write-heavy"});expect(fixed.rngState).toBe(base.rngState);
 expect(fixed.campaign!.dataStage!.source).toBe("evaluation");
});

it("retains a scheduled deadline while routing loses readiness, then fires once ready",()=>{
 let g=dataCompany();g.campaign!.apps[0].tier="base";g.campaign!.apps[0].capacity=1000;g=step(g).state;const due=g.campaign!.dataStage!.dueStep;
 g=install(g,{type:"set_routing",mode:"single",targets:["app-1"]},1);g=ticks(g,5);
 expect(g.campaign!.dataStage!.dueStep).toBe(due);expect(g.campaign!.dataStage!.consumed).toBe(false);
 g=install(g,{type:"set_routing",mode:"balanced",targets:["app-1","app-2"]},1);g=ticks(g,10);if(g.phase==="review")g=act(g,{type:"acknowledge_review"});g=ticks(g,6);
 expect(g.campaign!.dataStage!.consumed).toBe(true);expect(g.campaign!.trace.filter(t=>t.type==="workload-changed"&&t.data.eventId==="data-growth")).toHaveLength(1);
});
it("simultaneous app and DB constraints remain component-specific and conserve outcomes",()=>{
 let g=dataCompany();g.campaign!.dataStage!.consumed=true;g.campaign!.incomingRate=2400;g.campaign!.consumedEvents.push("data-growth");
 g.campaign!.apps[0].capacity=1000;g.campaign!.apps[0].tier="base";
 g=ticks(g,3);expect(g.campaign!.overload["app-1"]).toBe(3);expect(g.campaign!.overload.db).toBe(3);
 const m=g.campaign!.snapshot;expect(m.data!.logical).toBe(2200);expect(m.db.demand).toBe(2200);expect(g.campaign!.incident).not.toBeNull();
});
it("historical telemetry retains the profile used before contrasting workload",()=>{
 let g=advanceSteps(install(incident(),{type:"deploy_cache"},2),30).state;g=act(g,{type:"acknowledge_review"});g=act(g,{type:"contrast_workload"});
 const m=projectEvents(beginSession(emptyMeasurement(),g,"history","2026-10-10T00:00:00Z"),g,"2026-10-10T00:00:00Z");
 expect(m.pending.find(e=>e.name==="cache_requested")!.payload.profile).toBe("read-heavy");
 expect(m.pending.filter(e=>e.name==="workload_changed").at(-1)!.payload.profile).toBe("write-heavy");
});

it("reports the actual data workload change instead of attributing it to old opening growth",()=>{
 const g=advanceSteps(install(incident(),{type:"start_db_upgrade"},4),20).state;
 expect(g.campaign!.reports.at(-1)!.explanations.join(" ")).toContain("Workload changed to read-heavy");
});

it("does not attribute a same-step pre-entry request to the data stage",()=>{
 let g=dataCompany("read-heavy",false);g=act(g,{type:"set_traffic_limit",enabled:true});const actionId=g.campaign!.actions.at(-1)!.id;
 g=act(g,{type:"enter_data",profile:"read-heavy"});const m=projectEvents(beginSession(emptyMeasurement(),g,"boundary","2026-10-10T00:00:00Z"),g,"2026-10-10T00:00:00Z");
 expect(m.pending.find(e=>e.name==="traffic_limit_requested"&&e.payload.actionId===actionId)!.payload.dataStageId).toBeUndefined();
 expect(m.pending.find(e=>e.name==="data_stage_entered")!.payload.dataStageId).toBe("data-strategy");
});

it("does not credit a late app upgrade for drainage supplied by an already warm cache",()=>{
 // Controlled same-step comparison: both app tiers already serve this admitted load;
 // existing DB backlog drains because of read hits, independently of the app purchase.
 let g=install(incident(),{type:"deploy_cache"},2);g=advanceSteps(g,30).state;g=act(g,{type:"acknowledge_review"});
 g.campaign!.apps[1].tier="base";g.campaign!.apps[1].capacity=1000;g.campaign!.incomingRate=1400;
 g=act(g,{type:"scale_up",appId:"app-2"});g=ticks(g,2);g.campaign!.dbBacklog=1500;
 g=step(g).state;const effect=g.campaign!.trace.findLast(t=>t.type==="action-activated");
 expect(g.campaign!.snapshot.data!.hits).toBe(672);expect(g.campaign!.dbBacklog).toBe(228);
 expect(effect!.data.withoutChangeDbBacklog).toBe(228);expect(effect!.data.measuredRelief).toBe(false);
});

it("rejects an unknown evaluation profile before consuming RNG or entering data",()=>{
 const g=dataCompany("read-heavy",false),before=structuredClone(g);
 expect(applyAction(g,{type:"enter_data",profile:"unknown"} as unknown as Action).ok).toBe(false);
 expect(g).toEqual(before);expect(g.campaign!.dataStage).toBeNull();
});
