// @vitest-environment node
import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "@/sim";
import { campaignAppHealth } from "./campaignAppHealth";

function fixture(phase: GameState["phase"], latency: number, limited: boolean, outcome: GameState["outcome"] = null) {
    const g = newGame(); g.phase = phase; g.outcome = outcome;
    g.campaign!.snapshot.latencyMs = latency; g.campaign!.limit = limited ? 500 : null;
    return g;
}
describe("existing Campaign status precedence", () => {
    it.each([
        ["management",100,false,null,"Healthy","health","health"],
        ["management",499.999,true,null,"Traffic limited","health","health"],
        ["management",500,false,null,"At risk","warn","alert"],
        ["management",500,true,null,"At risk","warn","alert"],
        ["management",900,false,null,"At risk","warn","alert"],
        ["incident",100,true,null,"Incident","critical","incident"],
        ["incident",900,false,"won","Incident","critical","incident"],
        ["review",100,true,null,"Recovered","health","health"],
        ["review",900,true,null,"Recovered","warn","alert"],
        ["ended",100,false,"won","Campaign complete","health","health"],
        ["ended",900,true,"won","Campaign complete","warn","alert"],
        ["ended",100,true,"bankrupt","Bankrupt","critical","health"],
        ["ended",900,false,null,"Bankrupt","critical","alert"],
    ] as const)("%s at %s ms, limit=%s, outcome=%s shows %s", (phase,latency,limited,outcome,word,tone,icon) => {
        const g = fixture(phase,latency,limited,outcome), before = structuredClone(g);
        expect(campaignAppHealth(g)).toMatchObject({word,tone,icon});
        expect(g).toEqual(before);
    });
    it("does not promote errors, waiting work or infrastructure faults into new status rules", () => {
        const g = newGame(), m = g.campaign!.snapshot;
        m.serviceErrorRate = 0.2; m.app.backlog = 12; m.db.backlog = 8;
        g.infra.dbHost.status = "failed";
        const result = campaignAppHealth(g);
        expect(result.word).toBe("Healthy"); expect(result.waiting).toBe(20);
        expect(result.interpretation).toContain("failed"); expect(result.interpretation).toContain("not been processed yet");
    });
    it("distinguishes rejected traffic, unavailable outcomes and true zero errors", () => {
        const g = newGame(), m = g.campaign!.snapshot;
        m.serviceErrorRate = null; m.rejected = 50;
        expect(campaignAppHealth(g)).toMatchObject({ failedRate: null, rejected: 50, waiting: 0 });
        expect(campaignAppHealth(g).interpretation).toContain("rejected");
        m.serviceErrorRate = 0; m.rejected = 0;
        expect(campaignAppHealth(g).failedRate).toBe(0);
        expect(campaignAppHealth(g).interpretation).toBe("No failed requests or waiting work in this snapshot.");
    });
    it("keeps non-finite measurements unavailable rather than showing zero", () => {
        const g = newGame(); g.campaign!.snapshot.latencyMs = NaN; g.campaign!.snapshot.app.backlog = Infinity;
        expect(campaignAppHealth(g)).toMatchObject({ responseMs: null, waiting: null });
        expect(campaignAppHealth(g).interpretation).toContain("unavailable");
    });
});

it.each([
    [0.2,0,"Some requests failed."],
    [0,5,"Some requests have not been processed yet."],
    [null,0,"Some measurements are unavailable; check the readings shown."],
] as const)("keeps Healthy interpretation accurate for errors=%s, waiting=%s", (rate,waiting,interpretation) => {
    const g=newGame();g.campaign!.snapshot.serviceErrorRate=rate;g.campaign!.snapshot.app.backlog=waiting;
    expect(campaignAppHealth(g)).toMatchObject({word:"Healthy",interpretation});
});
it("uses the approved recovery explanation without changing review status",()=>{
    const g=fixture("review",900,true);
    expect(campaignAppHealth(g)).toMatchObject({word:"Recovered",reason:"Service recovered. The incident outcome is ready for review."});
});

it("explains At risk at the unchanged 500 ms boundary without implying failed requests",()=>{
    const g=fixture("management",499.999,false);
    expect(campaignAppHealth(g).word).toBe("Healthy");
    g.campaign!.snapshot.latencyMs=500;
    expect(campaignAppHealth(g)).toMatchObject({word:"At risk",failedRate:0,reason:"Your app is responding too slowly. Keep response time below 500 ms."});
    g.phase="incident";
    expect(campaignAppHealth(g).reason).toBe("An incident is still open, even if the latest measurements have improved.");
});
