// @vitest-environment node
import { describe, it, expect } from "vitest";
import { newGame, applyAction } from "../index";
import { step, advanceSteps } from "../step";
import { replayCampaign } from "../replay";
import { LAUNCH_WEEK as L } from "../scenarios/launchWeek";
import type { Action, GameState } from "../types";

const act = (s: GameState, a: Action) => { const r = applyAction(s, a); if (!r.ok) throw Error(r.message); return r.state; };
const json = (v: unknown) => JSON.parse(JSON.stringify(v));
const until = (s: GameState, condition: (s: GameState) => boolean, cap = 200): GameState => {
  for (let i = 0; i < cap && !condition(s) && s.phase !== "ended"; i++) s = step(s).state;
  return s;
};
/** Steps until the service is quiet: no incident, empty queues and every postmortem acknowledged. */
const stabilize = (s: GameState, cap = 200): GameState => until(s, x => {
  const c = x.campaign!;
  return x.phase === "management" && !c.incident && !c.dbBacklog && c.apps.every(a => !a.backlog) &&
    c.reports.every(r => c.trace.some(t => t.type === "review-acknowledged" && t.data.incidentId === r.id));
}, cap);

describe("launch week (opening-db v2)", () => {
  const opened = () => advanceSteps(newGame(7, "lw", 2), 20);
  it("outgrows the small database while the single app server keeps room", () => {
    const stopped = opened();
    expect(stopped.stopReason).toBe("first-incident");
    const c = stopped.state.campaign!;
    expect(c.incident?.components).toEqual(["db"]);
    expect(c.snapshot.app.demand).toBeLessThanOrEqual(c.snapshot.app.capacity);
    expect(c.incomingRate).toBe(L.spikeTraffic);
  });
  it("is fixed by the database upgrade, grants the research point and completes after one week", () => {
    expect(applyAction(newGame(7, "lw", 2), { type: "start_db_upgrade" }).ok).toBe(false);
    let s = act(opened().state, { type: "start_db_upgrade" });
    s = until(s, x => x.phase === "review", 60);
    expect(s.phase).toBe("review");
    s = act(s, { type: "acknowledge_review" });
    s = stabilize(s);
    expect(s.campaign!.dbCapacity).toBe(L.upgradedDbCapacity);
    s = until(s, x => !!x.campaign!.launchWeek!.researchEarned, 60);
    expect(s.campaign!.step).toBe(L.researchStep);
    s = act(s, { type: "pick_launch_tech", tech: "caching" });
    s = until(s, x => x.campaign!.launchWeek!.completedStep !== null, 60);
    expect(s.campaign!.launchWeek!.completedStep).toBe(L.endStep);
    expect(s.campaign!.reports).toHaveLength(1);
    expect(s.campaign!.openingMilestone).toBeTruthy();
    expect(s.campaign!.cashCents).toBeGreaterThan(0);
  });
  it("rejects an early or duplicate research pick", () => {
    expect(applyAction(newGame(7, "lw", 2), { type: "pick_launch_tech", tech: "caching" }).ok).toBe(false);
    let s = until(act(opened().state, { type: "start_db_upgrade" }), x => x.phase === "review", 60);
    s = until(act(s, { type: "acknowledge_review" }), x => !!x.campaign!.launchWeek!.researchEarned, 60);
    s = act(s, { type: "pick_launch_tech", tech: "autoscaling" });
    expect(applyAction(s, { type: "pick_launch_tech", tech: "caching" }).ok).toBe(false);
  });
  it("replays a version-2 run deterministically and byte-identically", () => {
    let s = until(act(opened().state, { type: "start_db_upgrade" }), x => x.phase === "review", 60);
    s = until(act(s, { type: "acknowledge_review" }), x => x.campaign!.launchWeek!.completedStep !== null, 80);
    const c = s.campaign!;
    expect(json(replayCampaign(s.seed, c.runId, c.inputs, c.step, false, undefined, false, 0, undefined, 2))).toEqual(json(s));
  });
});
