import {beforeEach,afterEach,it,expect,vi} from "vitest";
import {newGame} from "@/sim";
import {makeEnvelope,validateEnvelope,decodeSave,CAMPAIGN_SAVE_KEY} from "./saveEnvelope";
import {saveGame,loadGame} from "./persist";
import {act,tick,combinedCompany,finishRound,finishedCompany} from "@/sim/__tests__/combinedFixture";
import {beginSession,emptyMeasurement,projectEvents} from "./telemetry";
beforeEach(()=>localStorage.clear());afterEach(()=>vi.restoreAllMocks());
it.each([6,7])("loads older schema %s input logs with unknown historical uptime and exact source-byte backup",schemaVersion=>{
 const g=tick(newGame(9),3),{serviceMeasurementStart:_,...e}=makeEnvelope(g,123,1),raw=JSON.stringify({...e,schemaVersion},null,2);
 localStorage.setItem(CAMPAIGN_SAVE_KEY,raw);
 const r=loadGame();if(r.status!=="ok")throw Error(r.status);
 expect(r.game.campaign!.snapshot).toEqual(g.campaign!.snapshot);expect(r.game.campaign!.cashCents).toBe(g.campaign!.cashCents);
 expect(r.game.campaign!.combinedStage).toBeNull();expect(r.game.campaign!.serviceMeasurement).toMatchObject({scope:"since-upgrade",fromStep:4,lastStep:3,eligibleSteps:0});
 expect(localStorage.getItem(CAMPAIGN_SAVE_KEY)).toBe(raw);
 expect(saveGame(r.game,r.remainderMs,false,r.measurement)).toBe(true);
 expect(localStorage.getItem(`${CAMPAIGN_SAVE_KEY}.backup.v${schemaVersion}.${e.runId}.1`)).toBe(raw);
 expect(loadGame()).toMatchObject({status:"ok",game:r.game});
});
it.each(["backup","replacement"])("preserves source bytes when older replay save %s write fails",kind=>{
 const {serviceMeasurementStart:_,...e}=makeEnvelope(newGame(9),0,1),raw=JSON.stringify({...e,schemaVersion:6});localStorage.setItem(CAMPAIGN_SAVE_KEY,raw);
 const original=Storage.prototype.setItem;
 vi.spyOn(Storage.prototype,"setItem").mockImplementation(function(this:Storage,k,v){if(kind==="backup"?k.includes("backup"):k===CAMPAIGN_SAVE_KEY)throw Error("full");original.call(this,k,v);});
 const r=loadGame();if(r.status!=="ok")throw Error(r.status);expect(saveGame(r.game)).toBe(false);expect(localStorage.getItem(CAMPAIGN_SAVE_KEY)).toBe(raw);
});
it("rejects unknown future versions without replacement",()=>{const raw=JSON.stringify({...makeEnvelope(newGame(1)),schemaVersion:99});localStorage.setItem(CAMPAIGN_SAVE_KEY,raw);expect(loadGame().status).toBe("unsupported");expect(localStorage.getItem(CAMPAIGN_SAVE_KEY)).toBe(raw);});
it("replays announced deadlines, pending promotion, growth review and final acknowledgement exactly",()=>{
 let s=act(combinedCompany(),{type:"run_promotion"});
 const roundtrip=()=>{expect(saveGame(s)).toBe(true);const r=loadGame();if(r.status!=="ok")throw Error(r.status);expect(r.game).toEqual(s);expect(JSON.stringify(makeEnvelope(s)).length).toBeLessThan(JSON.stringify(s).length);};
 roundtrip();s=tick(s,18);s=act(s,{type:"start_growth_wave"});roundtrip();s=finishRound(s);roundtrip();s=finishedCompany();roundtrip();s=act(s,{type:"complete_campaign"});roundtrip();
});
it("cannot load Phase7 decisions disguised as a previous schema",()=>{const e=makeEnvelope(combinedCompany());expect(validateEnvelope({...e,schemaVersion:6}).status).toBe("corrupt");});
it.each([{fromStep:0,scope:"full-run"},{fromStep:2,scope:"full-run"},{fromStep:1,scope:"combined-stage"}])("rejects invalid service coverage %j",serviceMeasurementStart=>{expect(validateEnvelope({...makeEnvelope(newGame(1)),serviceMeasurementStart}).status).toBe("corrupt");});
it("rejected target configuration cannot fabricate a combined stage through edited inputs",()=>{const g=combinedCompany(),e=makeEnvelope(g);e.inputs=structuredClone(e.inputs);const entry=e.inputs.find(i=>i.action.type==="enter_combined")!;entry.action={type:"enter_combined",finalUserTarget:2001};const r=validateEnvelope(e);expect(r.status).toBe("ok");if(r.status!=="ok")return;expect(r.game.campaign!.combinedStage).toBeNull();expect(r.game.campaign!.trace.at(-1)?.type).toBe("action-rejected");});
it("resumes prospective service counters without rebasing or inventing historical observations",()=>{const {serviceMeasurementStart:_,...e}=makeEnvelope(tick(newGame(2),3));const r=decodeSave(JSON.stringify(e));if(r.status!=="ok")throw Error(r.status);const next=tick(r.game,1);const again=decodeSave(JSON.stringify(makeEnvelope(next)));if(again.status!=="ok")throw Error(again.status);expect(again.game).toEqual(next);expect(again.game.campaign!.serviceMeasurement).toMatchObject({scope:"since-upgrade",fromStep:4,eligibleSteps:1});});
it("projects combined completion and promotion once with stable trace identities",()=>{const s=act(finishedCompany(),{type:"complete_campaign"});let m=beginSession(emptyMeasurement(),s,"test","2026-10-11T00:00:00Z");m=projectEvents(m,s,"2026-10-11T00:01:00Z");expect(m.pending.filter(e=>e.name==="late_game_entered")).toHaveLength(1);expect(m.pending.filter(e=>e.name==="campaign_completed")).toHaveLength(1);expect(projectEvents(m,s,"2026-10-11T00:02:00Z").pending).toEqual(m.pending);expect(m.pending.find(e=>e.name==="campaign_completed")!.payload.stageId).toBe("combined-campaign");expect(m.pending.find(e=>e.name==="late_game_entered")!.payload).toMatchObject({users:2000,profile:"read-heavy"});expect(m.pending.filter(e=>e.name==="scenario_started").map(e=>e.payload.users)).toEqual([20000,35000,50000]);});
