import {beforeEach,afterEach,it,expect,vi} from "vitest";
import {newGame} from "@/sim";
import {makeEnvelope,validateEnvelope,decodeSave,CAMPAIGN_SAVE_KEY} from "./saveEnvelope";
import {saveGame,loadGame} from "./persist";
import {act,tick,completedReliability,wonCompany} from "@/sim/__tests__/completionFixture";
import {beginSession,emptyMeasurement,projectEvents} from "./telemetry";
beforeEach(()=>localStorage.clear());afterEach(()=>vi.restoreAllMocks());
it.each([6,7])("loads older schema %s input logs with unknown historical uptime and exact source-byte backup",schemaVersion=>{
 const g=tick(newGame(9),3),{serviceMeasurementStart:_,...e}=makeEnvelope(g,123,1),raw=JSON.stringify({...e,schemaVersion},null,2);
 localStorage.setItem(CAMPAIGN_SAVE_KEY,raw);
 const r=loadGame();if(r.status!=="ok")throw Error(r.status);
 expect(r.game.campaign!.snapshot).toEqual(g.campaign!.snapshot);expect(r.game.campaign!.cashCents).toBe(g.campaign!.cashCents);
 expect(r.game.campaign!.serviceMeasurement).toMatchObject({scope:"since-upgrade",fromStep:4,lastStep:3,eligibleSteps:0});
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
it("replays a company after Stay Online and its completed campaign exactly",()=>{
 let s=completedReliability();
 const roundtrip=()=>{expect(saveGame(s)).toBe(true);const r=loadGame();if(r.status!=="ok")throw Error(r.status);expect(r.game).toEqual(s);expect(JSON.stringify(makeEnvelope(s)).length).toBeLessThan(JSON.stringify(s).length);};
 roundtrip();s=act(s,{type:"complete_campaign"});roundtrip();
},30_000);
it("cannot load Phase 7 decisions disguised as a previous schema",()=>{
 const e=makeEnvelope(newGame(1));e.inputs=[{step:0,action:{type:"accept_scaling_risk"}}];
 expect(validateEnvelope({...e,schemaVersion:6}).status).toBe("corrupt");
});
it.each([{fromStep:0,scope:"full-run"},{fromStep:2,scope:"full-run"},{fromStep:1,scope:"combined-stage"}])("rejects invalid service coverage %j",serviceMeasurementStart=>{expect(validateEnvelope({...makeEnvelope(newGame(1)),serviceMeasurementStart}).status).toBe("corrupt");});
it("resumes prospective service counters without rebasing or inventing historical observations",()=>{const {serviceMeasurementStart:_,...e}=makeEnvelope(tick(newGame(2),3));const r=decodeSave(JSON.stringify(e));if(r.status!=="ok")throw Error(r.status);const next=tick(r.game,1);const again=decodeSave(JSON.stringify(makeEnvelope(next)));if(again.status!=="ok")throw Error(again.status);expect(again.game).toEqual(next);expect(again.game.campaign!.serviceMeasurement).toMatchObject({scope:"since-upgrade",fromStep:4,eligibleSteps:1});});
it("projects campaign completion once with stable trace identities and its scorecard",()=>{
 const s=wonCompany();let m=beginSession(emptyMeasurement(),s,"test","2026-10-11T00:00:00Z");m=projectEvents(m,s,"2026-10-11T00:01:00Z");
 const completed=m.pending.filter(e=>e.name==="campaign_completed");
 expect(completed).toHaveLength(1);expect(projectEvents(m,s,"2026-10-11T00:02:00Z").pending).toEqual(m.pending);
 expect(completed[0].payload).toMatchObject({stageId:"application-reliability",cashCents:s.campaign!.cashCents});
 expect(JSON.parse(String(completed[0].payload.scorecard))).toMatchObject({outcome:"won",runId:s.campaign!.runId});
},30_000);
