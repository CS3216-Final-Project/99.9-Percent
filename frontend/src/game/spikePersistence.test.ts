import {it,expect,beforeEach} from "vitest";
import {makeEnvelope,validateEnvelope,PHASE5_MIGRATIONS,migrateSave,CAMPAIGN_SAVE_KEY} from "./saveMigrations";
import {loadGame,saveGame} from "./persist";
import {dataCompany,spikeCompany,untilOffset,act} from "../sim/__tests__/spikeFixtures";
import {useGame} from "./store";
beforeEach(()=>{localStorage.clear();});
it("migrates schema 4 with original-byte backup and no automatic spike entry or observation",()=>{
 const e=makeEnvelope(dataCompany()),old=JSON.parse(JSON.stringify(e));old.schemaVersion=4;delete old.game.campaign.openingPrevention;
 delete old.game.campaign.spikeStage;delete old.game.campaign.nextAppNumber;delete old.game.campaign.ledger.controllerNumerator;delete old.game.campaign.remainders.controller;
 const raw=JSON.stringify(old,null,2);localStorage.setItem(CAMPAIGN_SAVE_KEY,raw);
 for(const key of ["nn.save.v1","nn.meta.v1","nn.analytics.v1"])localStorage.setItem(key,"legacy bytes");
 const loaded=loadGame();expect(loaded.status).toBe("ok");if(loaded.status!=="ok")throw Error("load");
 expect(loaded.game.campaign!.spikeStage).toBeNull();expect(loaded.game.campaign!.snapshot).toEqual(old.game.campaign.snapshot);expect(loaded.game.campaign!.trace).toEqual(old.game.campaign.trace);expect(loaded.game.campaign!.cashCents).toBe(old.game.campaign.cashCents);expect(loaded.game.campaign!.nextAppNumber).toBe(3);
 expect(localStorage.getItem(`${CAMPAIGN_SAVE_KEY}.backup.v4`)).toBe(raw);expect(JSON.parse(localStorage.getItem(CAMPAIGN_SAVE_KEY)!).schemaVersion).toBe(6);
 for(const key of ["nn.save.v1","nn.meta.v1","nn.analytics.v1"])expect(localStorage.getItem(key)).toBe("legacy bytes");
});
it.each(["backup","replacement"])("preserves schema 4 source when %s fails",failure=>{
 const e=JSON.parse(JSON.stringify(makeEnvelope(dataCompany())));e.schemaVersion=4;const raw=JSON.stringify(e);const data=new Map([[CAMPAIGN_SAVE_KEY,raw]]);
 const storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{if(failure==="backup"?k.endsWith("backup.v4"):k===CAMPAIGN_SAVE_KEY)throw Error("quota");data.set(k,v);}};
 expect(migrateSave(storage)).toBe(false);expect(data.get(CAMPAIGN_SAVE_KEY)).toBe(raw);
});
it.each(["deadline","research","ownership","joining","next-id","source","snapshot","historical-snapshot"])("rejects forged controller %s",bad=>{
 const e=makeEnvelope(untilOffset(spikeCompany(),14)),c=e.game.campaign!;
 if(bad==="deadline")c.spikeStage!.deadlines[0]++;
 if(bad==="research")c.spikeStage!.researchSpent=0;
 if(bad==="ownership")c.spikeStage!.controller!.managedAppIds.push("app-1");
 if(bad==="joining")c.spikeStage!.controller!.joiningAppId="app-1";
 if(bad==="next-id")c.nextAppNumber=3;
 if(bad==="source")c.actions.find(a=>a.source==="autoscaler")!.source="invalid" as "player";
 if(bad==="snapshot")c.snapshot.instances![0].processed++;
 if(bad==="historical-snapshot")c.recent.find(m=>m.version===5)!.spikes!.routedBusyBasisPoints++;
 expect(validateEnvelope(e).status).toBe("corrupt");
});
it("schema 4 validator prevents new-state smuggling before migration",()=>{
 const e=makeEnvelope(spikeCompany());const old={...e,schemaVersion:4};expect(()=>PHASE5_MIGRATIONS[4](old)).toThrow();
});
it("reload preserves zero-step disabled policy and pending actions",()=>{
 const g=act(untilOffset(spikeCompany(),10),{type:"set_autoscaling",enabled:false});expect(saveGame(g)).toBe(true);
 const r=loadGame();expect(r.status).toBe("ok");if(r.status==="ok")expect(r.game.campaign).toEqual(g.campaign);
});
it("pending completion blocks the shared clock after reload until explicit acknowledgement",()=>{
 let g=spikeCompany(false);g=act(g,{type:"set_traffic_limit",enabled:true});g=untilOffset(g,72);saveGame(g);
 useGame.setState({ready:false,started:false,onboarding:false});useGame.getState().boot();useGame.getState().play();useGame.getState().onboardingMove("skip");
 const step=useGame.getState().game.campaign!.step;useGame.getState().setRunning(true);useGame.getState().tick(10);useGame.getState().advance();expect(useGame.getState().game.campaign!.step).toBe(step);
 expect(useGame.getState().act({type:"acknowledge_spikes"})).toBe(true);expect(useGame.getState().running).toBe(false);expect(useGame.getState().game.campaign!.spikeStage!.acknowledged).toBe(true);
});

it("rejects a pending controller deployment without its forward unlock",()=>{
 let g=act(dataCompany(),{type:"enter_spikes"});g=act(g,{type:"unlock_autoscaling"});g=act(g,{type:"deploy_autoscaler"});
 expect(validateEnvelope(makeEnvelope(g)).status).toBe("ok");const e=makeEnvelope(g);e.game.campaign!.spikeStage!.researchSpent=0;
 expect(validateEnvelope(e).status).toBe("corrupt");
});

it("preserves manual upgrade protection while an automatic app awaits routing",async()=>{
 const {tick}=await import("../sim/__tests__/spikeFixtures");
 let g=act(untilOffset(spikeCompany(),13),{type:"scale_up",appId:"app-3"});
 expect(g.campaign!.spikeStage!.controller!.managedAppIds).not.toContain("app-3");expect(validateEnvelope(makeEnvelope(g)).status).toBe("ok");
 g=tick(g,3);expect(g.campaign!.apps.find(a=>a.id==="app-3")).toMatchObject({tier:"large",routed:true});
 expect(g.campaign!.spikeStage!.controller!.managedAppIds).not.toContain("app-3");expect(validateEnvelope(makeEnvelope(g)).status).toBe("ok");
});
