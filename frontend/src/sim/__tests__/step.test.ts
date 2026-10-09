// @vitest-environment node
import { describe, it, expect } from "vitest";
import { newGame, applyAction, metrics, has } from "../index";
import { step, advanceSteps } from "../step";
describe("authoritative snapshot and invariants", () => {
  it("conserves simultaneous application overflow and database work", () => {
    let s = newGame(); s.campaign!.incomingRate = 3000;
    const c = step(s).state.campaign!, m = c.snapshot;
    expect(m.app).toMatchObject({ processed: 1000, backlog: 1000, failed: 1000 });
    expect(m.db).toMatchObject({ processed: 600, backlog: 400, failed: 0 });
    expect(m.admitted).toBe(m.successful + m.failed + m.app.backlog + m.db.backlog);
  });
  it("ignores stored later technology and legacy cash/traffic as physical inputs", () => {
    const original = newGame(); const altered = structuredClone(original);
    altered.techDone = ["caching", "autoscaling", "replicas"]; altered.users = 50000; altered.cash = 900000;
    expect(has(altered, "caching")).toBe(false);
    expect(step(altered).state.campaign).toEqual(step(original).state.campaign);
  });
  it("projects the completed snapshot rather than forecasting independent physics", () => {
    const s = advanceSteps(newGame(), 6).state, m = metrics(s), c = s.campaign!;
    expect(m.appCapacity).toBe(c.snapshot.app.capacity); expect(m.dbLoad).toBe(c.snapshot.db.demand);
    expect(m.dbUtil).toBe(800 / 600); expect(c.snapshot.db.busyUtilisation).toBe(1);
  });
  it("rejects duplicates, exhausted-cash purchases and no-op limits immutably", () => {
    const s = newGame(); s.campaign!.cashCents = 100000;
    expect(applyAction(s, { type: "add_server" }).ok).toBe(false);
    expect(applyAction(s, { type: "set_traffic_limit", enabled: false }).ok).toBe(false);
    const r = applyAction(s, { type: "set_traffic_limit", enabled: true }); if (!r.ok) throw Error(r.message);
    const before = JSON.stringify(r.state);
    expect(applyAction(r.state, { type: "set_traffic_limit", enabled: true }).ok).toBe(false);
    expect(JSON.stringify(r.state)).toBe(before);
  });
  it("continues after admission relief and retains a delayed upgrade", () => {
    let s = advanceSteps(newGame(), 6).state;
    const limit = applyAction(s, { type: "set_traffic_limit", enabled: true }); if (!limit.ok) throw Error(limit.message);
    s = limit.state; while (s.campaign!.incident!.stableSteps < 4) s = step(s).state;
    const db = applyAction(s, { type: "start_db_upgrade" }); if (!db.ok) throw Error(db.message);
    s = step(db.state).state;
    const pending = structuredClone(s.campaign!.pending);
    const ack = applyAction(s, { type: "acknowledge_review" }); if (!ack.ok) throw Error(ack.message);
    expect(ack.state.campaign!.pending).toEqual(pending);
    s = advanceSteps(ack.state, 2).state; expect(s.campaign!.dbCapacity).toBe(1000);
    expect(s.campaign!.limit).toBe(500); expect(s.campaign!.snapshot.rejected).toBe(300);
  });
});
