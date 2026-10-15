// @vitest-environment node
import { expect, it } from "vitest";
import { newGame, applyAction, type GameState, type Action } from "@/sim";
import { advanceSteps, step } from "@/sim/step";
import { accruedCharges, operatingCharges } from "@/sim/settlement";
import { preparedReliability } from "@/sim/__tests__/reliabilityFixture";
import { spikeCompany } from "@/sim/__tests__/spikeFixtures";
import { financeForecast, previewCampaignAction, totalCharges, financeMoney } from "./campaignFinance";

function act(g:GameState,a:Action) {const result=applyAction(g,a);if(!result.ok)throw Error(result.message);return result.state;}
function tick(g:GameState,n:number) {for(let i=0;i<n;i++)g=step(g).state;return g;}
it("accounts for activation exposure, settlement boundaries and carried fractions without mutating the run",()=>{
    let g=act(newGame(1,"finance"),{type:"add_server"});
    g=tick(g,59);
    const before=structuredClone(g),c=g.campaign!,charges=accruedCharges(c);
    expect(c.settlements).toHaveLength(0);
    expect(charges.app).toBe(Math.floor((1+58*2)*70000/60));
    expect(g).toEqual(before);
    const settledState=advanceSteps(g,1).state;
    const settled=settledState.campaign!.settlements[0];
    expect(settled.appCents).toBe(Math.floor((1+59*2)*70000/60));
    expect(settled.salaryCents).toBe(640000);
    expect(settled.revenueCents-settled.netCents).toBe(settled.appCents+settled.dbCents+settled.salaryCents);
    const next=step(settledState).state.campaign!;
    expect(accruedCharges(next).app).toBe(Math.floor((140000+settledState.campaign!.remainders.app)/60));
});
it("includes deployed reliability upkeep and charges idle spares and disabled controllers",()=>{
    const g=preparedReliability(),c=g.campaign!;
    const charges=operatingCharges(c);
    expect(charges.checks).toBe(10000);expect(charges.failover).toBe(10000);
    expect(charges.app).toBe(3*110000);
    const before=totalCharges(charges);
    c.reliabilityStage!.failover!.enabled=false;
    expect(totalCharges(operatingCharges(c))).toBe(before);
    expect(c.apps.some(a=>a.role==="spare")).toBe(true);
    const automatic=spikeCompany(true).campaign!;
    const controllerCost=operatingCharges(automatic).controller;
    automatic.spikeStage!.controller!.enabled=false;
    expect(controllerCost).toBe(10000);
    expect(operatingCharges(automatic).controller).toBe(controllerCost);
});
it("previews the real setup debit and rejects cash exhaustion without adding live inputs or trace",()=>{
    const g=newGame(1,"preview"),before=structuredClone(g);
    expect(previewCampaignAction(g,{type:"add_server"})).toMatchObject({ok:true,spentCents:100000,cashAfterCents:1900000,upkeepDelta:70000,delay:2});
    expect(g).toEqual(before);
    g.campaign!.cashCents=100000;
    expect(previewCampaignAction(g,{type:"add_server"})).toMatchObject({ok:false,reason:"This purchase would exhaust company cash."});
    expect(g.campaign!.inputs).toHaveLength(0);
});
it("reuses the engine's deployment and research rejection reasons",()=>{
    const g=act(newGame(),{type:"start_db_upgrade"});
    const decision={type:"add_server"} as const;
    const real=applyAction(g,decision);
    expect(real.ok).toBe(false);
    expect(previewCampaignAction(g,decision)).toMatchObject({ok:false,reason:!real.ok ? real.message : ""});
    const r=preparedReliability();
    expect(previewCampaignAction(r,{type:"deploy_health_checks"}).ok).toBe(false);
});
it("withholds forecasts before settlement and during pending deployment",()=>{
    let g=newGame();expect(financeForecast(g.campaign!)).toBeNull();
    g=tick(g,60);
    expect(financeForecast(g.campaign!)).not.toBeNull();
    g=act(g,{type:"add_server"});expect(financeForecast(g.campaign!)).toBeNull();
});
it("warns about negative observed margins without forbidding a permitted purchase",()=>{
    const g=tick(newGame(),60);
    // Explicit low-cash boundary: engine remains solvent but has a small operating budget.
    g.campaign!.cashCents=150000;
    const p=previewCampaignAction(g,{type:"add_server"});
    expect(p.ok).toBe(true);
    if(p.ok){expect(p.warning).toContain("less than three");expect(p.forecast?.burnCents).toBeGreaterThan(0);}
    expect(financeForecast(g.campaign!,150000,-10000000)?.runwayPeriods).toBeNull();
});
it("shows cents accurately for revenue and partial-period expenses",()=>{
    expect(financeMoney(20)).toBe("$0.20");expect(financeMoney(14166)).toBe("$141.66");
});
