// @vitest-environment node
import { describe, expect, it } from "vitest";
import { BALANCE, buildReport, uptime } from "../index";
import { balanced, idle, promoOnly, runBot, type IncidentSkill, type Strategy } from "./bots";

const SEEDS = [9999, 1, 2, 3, 4, 5, 6, 7, 8, 42, 1234, 2026];

function summarise(name: string, strategy: Strategy, skill: IncidentSkill) {
  const rows = SEEDS.map((seed) => {
    const { state } = runBot(seed, strategy, skill);
    const r = buildReport(state);
    return { seed, outcome: r.outcome, weeks: r.weeks, users: r.users, cash: Math.round(r.cash), incidents: r.incidents.total, uptime: uptime(state), grade: r.grade, tech: r.techCount };
  });
  const line = rows
    .map(
      (r) =>
        `  seed ${String(r.seed).padStart(5)}: ${r.outcome.padEnd(8)} wk ${String(r.weeks).padStart(2)} users ${String(r.users).padStart(6)} cash ${String(r.cash).padStart(8)} inc ${r.incidents} up ${(r.uptime * 100).toFixed(3)}% tech ${r.tech} grade ${r.grade}`,
    )
    .join("\n");
  console.log(`${name}\n${line}`);
  return rows;
}

describe("balance", () => {
  it("doing nothing never wins", () => {
    const rows = summarise("idle", idle, "ignore");
    expect(rows.every((r) => r.outcome !== "won")).toBe(true);
  });

  it("growth without infrastructure runs into repeated incidents and does not win", () => {
    const rows = summarise("promo only", promoOnly, "rate_limit");
    expect(rows.every((r) => r.incidents >= 2)).toBe(true);
    expect(rows.filter((r) => r.outcome === "won").length).toBeLessThanOrEqual(1);
  });

  it("balanced play wins on most seeds, inside the campaign length", () => {
    const rows = summarise("balanced", balanced, "expert");
    const wins = rows.filter((r) => r.outcome === "won");
    expect(wins.length).toBeGreaterThanOrEqual(Math.ceil(SEEDS.length * 0.75));
    for (const w of wins) {
      expect(w.weeks).toBeLessThanOrEqual(BALANCE.maxTurns);
      expect(w.weeks).toBeGreaterThanOrEqual(14);
    }
  });

  it("balanced play that ignores incidents does worse than expert response", () => {
    const expert = SEEDS.map((seed) => buildReport(runBot(seed, balanced, "expert").state).score);
    const ignore = SEEDS.map((seed) => buildReport(runBot(seed, balanced, "ignore").state).score);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    console.log(`avg score expert ${avg(expert).toFixed(1)} vs ignore ${avg(ignore).toFixed(1)}`);
    expect(avg(expert)).toBeGreaterThan(avg(ignore));
  });
});


describe("opening-db financial trade-offs", () => {
  it("supports profitable capacity recovery and costly admission relief", async () => {
    const { newGame, applyAction } = await import("../index");
    const { step, advanceSteps } = await import("../step");
    for (const limiting of [false,true]) {
      let s=advanceSteps(newGame(),6).state;
      const result=applyAction(s,limiting?{type:"set_traffic_limit",enabled:true}:{type:"start_db_upgrade"});
      if(!result.ok)throw Error(result.message);
      s=result.state;
      while(s.campaign!.step<120) {
        if(s.phase==="review") {const ack=applyAction(s,{type:"acknowledge_review"});if(!ack.ok)throw Error(ack.message);s=ack.state;}
        s=step(s).state;
      }
      expect(s.campaign!.reports).toHaveLength(1);
      const net=s.campaign!.settlements[1].netCents;
      expect(limiting?net<0:net>0).toBe(true);
    }
  });
});

describe("data-strategy financial alternatives",()=>{
 it("preserves approved prices and measures cache versus DB upkeep and rejection",async()=>{
  const {dataCompany}=await import("./dataFixture");const {applyAction}=await import("../index");const {step,advanceSteps}=await import("../step");
  const nets:number[]=[];
  for(const choice of ["cache","database","limit"] as const){
   let g=advanceSteps(dataCompany(),6).state;const cash=g.campaign!.cashCents;
   const r=applyAction(g,choice==="cache"?{type:"deploy_cache"}:choice==="database"?{type:"start_db_upgrade"}:{type:"set_traffic_limit",enabled:true});
   if(!r.ok)throw Error(r.message);g=r.state;
   expect(cash-g.campaign!.cashCents).toBe(choice==="cache"?150000:choice==="database"?400000:0);
   while(g.campaign!.step<180){if(g.phase==="review"){const a=applyAction(g,{type:"acknowledge_review"});if(!a.ok)throw Error(a.message);g=a.state;}g=step(g).state;}
   const period=g.campaign!.settlements.at(-1)!;nets.push(period.netCents);
   expect(period.cacheCents).toBe(choice==="cache"?40000:0);expect(period.dbCents).toBe(choice==="database"?350000:250000);
   expect(g.campaign!.snapshot.rejected>0).toBe(choice==="limit");
  }
  expect(nets[0]).toBeGreaterThan(nets[1]);expect(nets[1]).toBeGreaterThan(nets[2]);
 });
});
