// @vitest-environment node
import { expect,it } from "vitest";
import { applyAction,newGame,type Action,type GameState } from "../index";
import { advanceSteps } from "../step";
import { chapterCompanyMessage } from "../../game/chapterCompanyMessage";
import { campaignAttention } from "../../game/campaignAttention";
import { campaignChapters } from "../../game/campaignChapters";
import { dataCompany } from "./dataFixture";
import { spikeCompany } from "./spikeFixtures";
import { reliabilityCompany } from "./reliabilityFixture";
import { combinedCompany } from "./combinedFixture";
import { INTRODUCTION_COMPONENTS } from "../introduction";
import { decodeSave,makeEnvelope } from "../../game/saveEnvelope";
const act=(g:GameState,a:Action)=>{const r=applyAction(g,a);if(!r.ok)throw Error(r.message);return r.state;};
const fresh=()=>act(newGame(7,"introduction",2),{type:"begin_introduction"});
function explore(g:GameState,id:typeof INTRODUCTION_COMPONENTS[number]) {return act(act(g,{type:"incident_inspect",equipment:id}),{type:"acknowledge_introduction",equipment:id});}
function completed(){let g=fresh();for(const id of INTRODUCTION_COMPONENTS)g=explore(g,id);return act(g,{type:"complete_introduction",handoff:"opening"});}
it("freezes time, finances, workload and incidents throughout the introduction",()=>{
 const g=fresh(),before=structuredClone(g);const r=advanceSteps(g,10000);
 expect(r.stepsConsumed).toBe(0);expect(r.stopReason).toBe("introduction");expect(r.state).toEqual(before);expect(g).toEqual(before);
 expect(g.campaign!.incident).toBeNull();expect(g.campaign!.launchWeek!.researchEarned).toBe(0);
});
it("requires an inspected current component and rejects skipped, duplicate and purchase inputs",()=>{
 let g=fresh();const original=structuredClone(g);
 for(const a of [{type:"complete_introduction",handoff:"opening"},{type:"acknowledge_introduction",equipment:"gateway"},{type:"add_server"},{type:"pick_launch_tech",tech:"caching"}] as Action[])expect(applyAction(g,a).ok).toBe(false);
 expect(g).toEqual(original);
 g=act(g,{type:"incident_inspect",equipment:"monitoring"});expect(applyAction(g,{type:"acknowledge_introduction",equipment:"monitoring"}).ok).toBe(false);
 expect(g.campaign!.launchWeek!.introduction!.explored).toEqual([]);
 g=explore(g,"gateway");expect(applyAction(g,{type:"acknowledge_introduction",equipment:"gateway"}).ok).toBe(false);
 expect(g.campaign!.launchWeek!.introduction!.explored).toEqual(["gateway"]);
});
it("continues exactly after a halfway save and guards forged advancement",()=>{
 let g=explore(explore(fresh(),"gateway"),"app");
 const loaded=decodeSave(JSON.stringify(makeEnvelope(g)));expect(loaded.status).toBe("ok");if(loaded.status!=="ok")throw Error("save failed");
 expect(loaded.game).toEqual(g);
 for(const id of ["db","monitoring"] as const){g=explore(g,id);loaded.game=explore(loaded.game,id);}
 expect(act(loaded.game,{type:"complete_introduction",handoff:"opening"})).toEqual(act(g,{type:"complete_introduction",handoff:"opening"}));
 const forged={...makeEnvelope(fresh()),step:10};expect(decodeSave(JSON.stringify(forged)).status).toBe("corrupt");
});
it("hands off to the exact existing Opening initial state without completing its milestone",()=>{
 const before=fresh(),g=completed(),c=g.campaign!,original=newGame(7,"introduction",1).campaign!;
 expect(c.runId).toBe(before.campaign!.runId);expect(c.step).toBe(0);expect(c.cashCents).toBe(2000000);expect(c.dbCapacity).toBe(600);
 const {inputs,trace,nextEventId,completedIntroduction,replayScenarioVersion,...physics}=c;
 const {inputs:_inputs,trace:_trace,nextEventId:_next,...expected}=original;
 expect(physics).toEqual(expected);expect(completedIntroduction!.explored).toEqual([...INTRODUCTION_COMPONENTS]);expect(replayScenarioVersion).toBe(2);
 expect(inputs.at(-1)?.action).toEqual({type:"complete_introduction",handoff:"opening"});
 expect(trace.some(t=>t.type==="opening-stage-entered")).toBe(true);expect(nextEventId).toBeGreaterThan(1);
 expect(c.openingMilestone).toBeNull();expect(c.scaling).toBeNull();expect(c.launchWeek).toBeUndefined();
 expect(applyAction(g,{type:"complete_introduction",handoff:"opening"}).ok).toBe(false);
 const saved=makeEnvelope(g);expect(saved.scenarioVersion).toBe(2);
 // The same inputs under a different origin describe rejected tutorial attempts, not this completed introduction.
 const wrongOrigin=decodeSave(JSON.stringify({...saved,scenarioVersion:1}));expect(wrongOrigin.status).toBe("ok");
 if(wrongOrigin.status==="ok") {expect(wrongOrigin.game.campaign!.completedIntroduction).toBeUndefined();expect(wrongOrigin.game).not.toEqual(g);}
 const replay=decodeSave(JSON.stringify(saved));expect(replay.status).toBe("ok");if(replay.status==="ok")expect(replay.game).toEqual(g);
});
it("preserves reactive Opening recovery and explicit recognition before Chapter 2 Scaling",()=>{
 let g=advanceSteps(completed(),6).state;expect(g.phase).toBe("incident");expect(g.campaign!.incident!.primaryComponent).toBe("db");
 g=advanceSteps(act(g,{type:"start_db_upgrade"}),30).state;expect(g.phase).toBe("review");
 g=act(g,{type:"acknowledge_review"});expect(g.campaign!.scaling).toBeNull();expect(g.campaign!.openingRecovered).toBe(true);
 g=act(g,{type:"acknowledge_milestone"});expect(g.campaign!.scaling).toBeTruthy();expect(campaignChapters(g).find(c=>c.current)?.number).toBe(2);
 const loaded=decodeSave(JSON.stringify(makeEnvelope(g)));expect(loaded.status).toBe("ok");if(loaded.status==="ok")expect(loaded.game).toEqual(g);
});
it("preserves proactive Opening prevention with real inspections, observations and recognition",()=>{
 let g=advanceSteps(act(completed(),{type:"start_db_upgrade"}),4).state;
 for(const equipment of ["app","db"] as const)g=act(g,{type:"incident_inspect",equipment});
 g=advanceSteps(g,5).state;expect(g.campaign!.incident).toBeNull();expect(g.campaign!.openingPrevention!.outcome).toBeTruthy();
 expect(g.campaign!.openingMilestone).toBeNull();g=act(g,{type:"acknowledge_prevention_review"});expect(g.campaign!.scaling).toBeNull();
 g=act(g,{type:"acknowledge_milestone"});expect(g.campaign!.scaling).toBeTruthy();expect(g.campaign!.reports).toEqual([]);
 const loaded=decodeSave(JSON.stringify(makeEnvelope(g)));expect(loaded.status).toBe("ok");if(loaded.status==="ok")expect(loaded.game).toEqual(g);
});
it("retains historical unversioned introduction completion and permits explicit corrected completion after reload",()=>{
 let old=fresh();for(const id of INTRODUCTION_COMPONENTS)old=explore(old,id);
 const prefix=structuredClone(old.campaign!.inputs),raw=JSON.stringify(makeEnvelope(old,0,123)),loaded=decodeSave(raw);
 expect(loaded.status).toBe("ok");if(loaded.status!=="ok")throw Error("load failed");expect(loaded.game).toEqual(old);
 const historical=act(old,{type:"complete_introduction"});expect(historical.campaign!.scaling).toBeTruthy();expect(historical.campaign!.cashCents).toBe(1500000);
 const replay=decodeSave(JSON.stringify(makeEnvelope(historical)));expect(replay.status).toBe("ok");if(replay.status==="ok")expect(replay.game).toEqual(historical);
 const corrected=act(loaded.game,{type:"complete_introduction",handoff:"opening"});expect(corrected.campaign!.inputs.slice(0,prefix.length)).toEqual(prefix);
 expect(corrected.campaign!.cashCents).toBe(2000000);expect(corrected.campaign!.scaling).toBeNull();expect(JSON.stringify(makeEnvelope(old,0,123))).toBe(raw);
});
it("keeps canonical chapter identities through Chapter 6, including legacy Launch Week saves",()=>{
 const games=[completed(),act(advanceSteps(act(advanceSteps(completed(),6).state,{type:"start_db_upgrade"}),30).state,{type:"acknowledge_review"}),dataCompany(),spikeCompany(),reliabilityCompany(),combinedCompany()];
 games[1]=act(games[1],{type:"acknowledge_milestone"});
 expect(games.map(g=>campaignChapters(g).find(c=>c.current)?.name)).toEqual(["Opening","Scaling & Routing","Data Strategy","Traffic Spikes & Autoscaling","Stay Online","Grow the Company"]);
 expect(games.map(g=>campaignChapters(g).find(c=>c.current)?.number)).toEqual([1,2,3,4,5,6]);
 expect(games.map(g=>campaignAttention(g).chapter)).toEqual([1,2,3,4,5,6]);
 expect(games.map(g=>chapterCompanyMessage(g)?.chapter)).toEqual([1,2,3,4,5,6]);
 expect(chapterCompanyMessage(fresh())).toBeNull();
 let legacy=fresh();for(const id of INTRODUCTION_COMPONENTS)legacy=explore(legacy,id);legacy=act(legacy,{type:"complete_introduction"});
 expect(campaignChapters(legacy).find(c=>c.current)?.number).toBe(2);
});
it("keeps previously recorded Launch Week runs on their original incident rules",()=>{
 const g=advanceSteps(newGame(7,"legacy-launch",2),20).state;
 expect(g.campaign!.launchWeek!.introduction).toBeUndefined();expect(g.campaign!.incident).not.toBeNull();
 const loaded=decodeSave(JSON.stringify(makeEnvelope(g)));expect(loaded.status).toBe("ok");if(loaded.status==="ok")expect(loaded.game).toEqual(g);
});
