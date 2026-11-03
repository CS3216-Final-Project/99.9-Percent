// @vitest-environment node
import { describe, expect, it } from "vitest";
import { act, spikeCompany, tick, untilOffset } from "@/sim/__tests__/spikeFixtures";
import type { GameState } from "@/sim";
import { spikeDebrief, spikeScore } from "./spikeDebrief";
import { autoscaleSpot, SPOTLIGHT_SECONDS } from "./autoscaleSpotlight";
import { chapter4Stage } from "./chapter4Guidance";
import { campaignGuidance, campaignObjective } from "./campaignGuidance";
import { describeEvents } from "./reportEvents";

const graded = (auto = false) => spikeCompany(auto, "read-heavy", 2);
/** Installs and routes `apps` extra servers, reading any postmortem on the way. */
function install(g: GameState, actions: Parameters<typeof act>[1][], steps: number[]): GameState {
  actions.forEach((a, i) => { g = act(g, a); for (let s = 0; s < steps[i]; s++) { g = tick(g); if (g.phase === "review") g = act(g, { type: "acknowledge_review" }); } });
  return g;
}

describe("failed spike debrief", () => {
  it("names missing server capacity and when the next test starts", () => {
    const g = untilOffset(graded(), 68), d = spikeDebrief(g.campaign!)!;
    expect(d).toMatchObject({ pulse: 2, share: "80%", cause: "servers", next: { pulse: 3, inSeconds: 20 } });
    expect(d.finding).toContain("3,200 req/s");expect(d.finding).toContain("4,000 req/s");
    expect(spikeDebrief(act(g, { type: "acknowledge_spike_attempt" }).campaign!)).toBeNull();
  });
  it("blames the traffic limit when its rejections are most of what went unserved", () => {
    const g = untilOffset(tick(act(graded(), { type: "set_traffic_limit", enabled: true })), 68);
    expect(spikeDebrief(g.campaign!)!.cause).toBe("limit");
  });
  it("explains an even split overloading the one small server in a mixed pool", () => {
    let g = install(graded(), [{ type: "add_server" }, { type: "set_routing", mode: "balanced", targets: ["app-1", "app-2", "app-3"] }], [2, 1]);
    g = untilOffset(g, 68);
    const d = spikeDebrief(g.campaign!)!;
    expect(d.cause).toBe("uneven-servers");expect(d.finding).toContain("Server 3");expect(d.fix).toContain("Scale up Server 3");
  });
  it("blames the database when it caps the spike, even while the servers also overload", () => {
    // Without the optional read cache, the 3,000 ops/s database caps service at 3,000 req/s.
    const g = untilOffset(spikeCompany(false, "read-heavy", 2, { cache: false }), 68), p = g.campaign!.spikeStage!.pulses!.at(-1)!;
    expect(p).toMatchObject({ served: 60000, appOverloadSteps: 20, dbOverloadSteps: 20 });
    const d = spikeDebrief(g.campaign!)!;
    expect(d.cause).toBe("database");
    // The database is already at its largest, so the only way forward is the cache.
    expect(d.fix).toContain("Deploy the read cache");expect(d.fix).not.toMatch(/larger database/i);
    // A third large server only sends the database more work it cannot do.
    let more = install(act(g, { type: "acknowledge_spike_attempt" }), [{ type: "add_server" }, { type: "scale_up", appId: "app-3" }, { type: "set_routing", mode: "balanced", targets: ["app-1", "app-2", "app-3"] }], [2, 3, 1]);
    more = untilOffset(more, 108);
    expect(more.campaign!.spikeStage!.pulses!.at(-1)!.served).toBe(60000);
    expect(spikeDebrief(more.campaign!)!.cause).toBe("database");
  });
  it("blames the database rather than autoscaling's delay when the database caps the spike", () => {
    const g = untilOffset(spikeCompany(true, "write-heavy", 2, { cache: false }), 68);
    expect(g.campaign!.trace.some(t => t.type === "autoscale-scale-out-decided")).toBe(true);
    expect(spikeDebrief(g.campaign!)!.cause).toBe("database");
  });
  it("suggests a larger database only while one can be bought", () => {
    const g = untilOffset(spikeCompany(false, "read-heavy", 2, { cache: false }), 68);
    // Advice reads the purchase currently offered; a 2,000 ops/s database is one upgrade short of the largest.
    g.campaign!.dbCapacity = 2000;
    expect(spikeDebrief(g.campaign!)!.fix).toContain("upgrade the database to 3,000 ops/s");
    const cached = untilOffset(graded(), 68), d = cached.campaign!;
    const p = d.spikeStage!.pulses!.at(-1)!;p.dbOverloadSteps = 20;
    // With the cache deployed and the database at its largest, tuning is what remains.
    expect(spikeDebrief(d)!.fix).toContain("Tune the read cache");
  });
  it("names capacity that arrived during the spike instead of crediting it to the whole spike", () => {
    let g = untilOffset(graded(), 56, true);
    g = install(g, [{ type: "add_server" }, { type: "scale_up", appId: "app-3" }, { type: "set_routing", mode: "balanced", targets: ["app-1", "app-2", "app-3"] }], [2, 3, 1]);
    g = untilOffset(g, 68);
    const d = spikeDebrief(g.campaign!)!;
    expect(d.cause).toBe("servers");
    expect(d.finding).toBe("Your routed servers handled 3,200 req/s when the spike began and reached 4,800 req/s only 14 seconds in. The spike brought 4,000 req/s.");
    expect(d.fix).toContain("before the spike starts");
  });
  it("does not blame the small server when every server in a mixed pool overloaded", () => {
    let g = install(graded(), [{ type: "add_server" }, { type: "set_routing", mode: "balanced", targets: ["app-1", "app-3"] }], [2, 1]);
    g = untilOffset(g, 68);
    // 2,000 req/s each overloads both the 1,600 req/s large server and the 1,000 req/s base server.
    expect(spikeDebrief(g.campaign!)!.cause).toBe("servers");
  });
  it("explains autoscaling's reaction time with the seconds it took", () => {
    const g = untilOffset(graded(true), 68);
    expect(spikeDebrief(g.campaign!)).toBeNull();
    // Autoscaling passes this test; marking it failed isolates how its recorded delay is explained.
    const p = g.campaign!.spikeStage!.pulses!.at(-1)!;p.result = "failed";p.reviewed = false;
    const d = spikeDebrief(g.campaign!)!;
    expect(d.cause).toBe("autoscaler-delay");expect(d.finding).toMatch(/reacted \d+ seconds into the spike and Server \d began serving \d+ seconds in/);
  });
});

describe("passed spike score", () => {
  it("scores setup spending, idle capacity and who made the changes", () => {
    let g = install(graded(), [{ type: "add_server" }, { type: "scale_up", appId: "app-3" }, { type: "set_routing", mode: "balanced", targets: ["app-1", "app-2", "app-3"] }], [2, 3, 1]);
    g = untilOffset(g, 72);
    const score = spikeScore(g.campaign!)!;
    expect(score).toMatchObject({ pulse: 2, share: "100%", attempts: 1, setupCents: 300000, manual: 3, automatic: 0 });
    expect(score.idleShare).toMatch(/^\d+%$/);
    expect(spikeScore(untilOffset(graded(), 40).campaign!)).toBeNull();
    // The score is recorded as the chapter runs, so it survives readings leaving the retained window.
    g.campaign!.recent = [];
    expect(spikeScore(g.campaign!)!.idleShare).toBe(score.idleShare);
  });
});

describe("autoscaler spotlight", () => {
  it("follows each move of a scale-out, then fades after a few game seconds", () => {
    let g = untilOffset(graded(true), 10);
    expect(autoscaleSpot(g.campaign)).toMatchObject({ title: "Autoscaling is adding Server 3", appId: null });
    g = tick(g, 3);expect(autoscaleSpot(g.campaign)).toMatchObject({ title: "Server 3 installed", appId: "app-3" });
    g = tick(g);expect(autoscaleSpot(g.campaign)).toMatchObject({ title: "Server 3 is serving", appId: "app-3", message: "Routed capacity is now 4,200 req/s." });
    g = tick(g, SPOTLIGHT_SECONDS + 1);expect(autoscaleSpot(g.campaign)).toBeNull();
    expect(autoscaleSpot(untilOffset(graded(), 10).campaign)).toBeNull();
  });
});

describe("graded chapter guidance", () => {
  it("tells the player the target, then the failed result and the next test", () => {
    let g = graded();
    expect(chapter4Stage(g)!.cues[0]).toMatchObject({ id: "prepare-1", title: "Prepare" });
    expect(chapter4Stage(g)!.cues[0].message).toContain("serve at least 95%");
    expect(campaignObjective(g)).toContain("95%");
    g = untilOffset(g, 68);
    g = act(g, { type: "acknowledge_spike_attempt" });
    const stage = chapter4Stage(g)!;
    expect(stage).toMatchObject({ stage: "between", pulse: 2 });
    expect(stage.cues[0]).toMatchObject({ id: "between-2", title: "Spike 2 failed" });
    const test = campaignGuidance(g).requirements.find(r => r.id === "test")!;
    expect(test).toMatchObject({ met: false, label: "A graded spike served at least 95% of its requests (last test: 80%)" });
    g = untilOffset(g, 88, true);
    expect(chapter4Stage(g)!.cues[0]).toMatchObject({ id: "spike2-3", title: "Spike 3: the test" });
  });
  it("keeps the same requirement rows for the whole chapter", () => {
    let g = graded();const ids = () => campaignGuidance(g).requirements.map(r => r.id);
    const first = ids();
    for (const offset of [20, 68, 90]) { g = untilOffset(g, offset, true);expect(ids()).toEqual(first); }
  });
  it("describes grading events in the event log", () => {
    const g = untilOffset(graded(), 68), lines = describeEvents(g.campaign!.trace).map(e => [e.title, e.detail].join(" · "));
    expect(lines).toContain("Practice spike 1 ended · 80% of requests served");
    expect(lines).toContain("Spike 2 test failed · 80% of requests served");
    expect(lines.some(l => l.startsWith("Spike 3 scheduled · Starts at game second"))).toBe(true);
  });
});
