// @vitest-environment node
import { describe, it, expect } from "vitest";
import { newGame, applyAction, type GameState } from "../index";
import { step } from "../step";
import { has, completedTechIds, techStatus, TECH_ORDER } from "../tech";

function upgrade(): GameState {
 const g=newGame(0,"ownership");
 const result=applyAction(g,{type:"start_db_upgrade"});
 if(!result.ok) throw Error(result.message);
 let s=result.state;
 for(let i=0;i<3;i++)s=step(s).state;
 return s;
}
describe("campaign technology ownership projection",()=>{
 it("owns Larger Database at its first actually activated paid upgrade",()=>{
  const s=upgrade();
  expect(s.campaign!.dbCapacity).toBe(1000);
  expect(has(s,"larger_database")).toBe(true);
  expect(completedTechIds(s)).toContain("larger_database");
  expect(techStatus(s,"larger_database")).toBe("done");
 });
 it("does not own an unupgraded DB or a merely requested upgrade",()=>{
  const g=newGame(0,"ownership");
  const result=applyAction(g,{type:"start_db_upgrade"});
  if(!result.ok)throw Error(result.message);
  for(const s of [g,result.state]){
   expect(has(s,"larger_database")).toBe(false);
   expect(completedTechIds(s)).not.toContain("larger_database");
   expect(techStatus(s,"larger_database")).toBe("available");
  }
 });
 it("reads saved physical capacity instead of a stale legacy tier and mutates no bytes",()=>{
  const s=upgrade();s.infra.dbTier=0;
  const before=JSON.stringify(s);
  for(const id of TECH_ORDER){has(s,id);techStatus(s,id);}
  expect(completedTechIds(s)).toEqual(["larger_database"]);
  expect(JSON.stringify(s)).toBe(before);
  expect(JSON.stringify(JSON.parse(before))).toBe(before);
  expect(s.techDone).toEqual([]);
 });
 it("does not infer other owned technologies from a database investment",()=>{
  const before=newGame(0,"ownership"),after=upgrade();
  for(const id of TECH_ORDER.filter(id=>id!=="larger_database"))
   expect(has(after,id)).toBe(has(before,id));
 });
});

it("retains every earlier purchased capability in both normal Phase 5 research paths without changing saved state",async()=>{
 const {readyReliability}=await import("./reliabilityFixture");
 for(const spent of [false,true]){
  const g=readyReliability(spent),before=JSON.stringify(g);
  expect(completedTechIds(g)).toEqual(["larger_servers","load_balancing",...(spent?["autoscaling"] as const:[]),"larger_database","caching"]);
  for(const id of TECH_ORDER)expect(techStatus(g,id)==="done").toBe(has(g,id));
  expect(JSON.stringify(g)).toBe(before);
 }
});
it("ignores inactive legacy techDone entries in a physical campaign without granting ownership",()=>{
 const g=newGame();g.techDone=[...TECH_ORDER];const before=JSON.stringify(g);
 expect(completedTechIds(g)).toEqual([]);expect(has(g,"larger_database")).toBe(false);expect(JSON.stringify(g)).toBe(before);
});
