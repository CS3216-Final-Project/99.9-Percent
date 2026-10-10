// @vitest-environment node
import { describe, it, expect } from "vitest";
import { newGame, applyAction } from "../index";
import { advanceSteps, step } from "../step";
function accepted(s: ReturnType<typeof newGame>, a: Parameters<typeof applyAction>[1]) {
  const r = applyAction(s, a); if (!r.ok) throw Error(r.message); return r.state;
}
describe("settlement accounting boundaries", () => {
  it("charges upgraded exposure for step 60 itself and keeps cent remainders", () => {
    let s = advanceSteps(newGame(), 6).state; s = advanceSteps(s, 51).state;
    s = accepted(s, { type: "start_db_upgrade" }); s = advanceSteps(s, 3).state;
    const c = s.campaign!, p = c.settlements[0];
    expect(p.dbCents).toBe(Math.floor((59 * 50000 + 150000) / 60));
    expect(c.remainders.db).toBe((59 * 50000 + 150000) % 60);
    expect(c.pending).toHaveLength(0); expect(c.actions[0].activatedStep).toBe(60);
    const remaindersBefore = structuredClone(s.campaign!.remainders);
    s = JSON.parse(JSON.stringify(s));
    expect(s.campaign!.remainders).toEqual(remaindersBefore);
    s = advanceSteps(s, 50).state; if (s.phase === "review") s = accepted(s, { type: "acknowledge_review" });
    while (s.campaign!.step < 120) s = step(s).state;
    expect(s.campaign!.settlements).toHaveLength(2);
    expect(s.campaign!.remainders.db).toBe(c.remainders.db);
  });
  it("earns queued requests only on later completion, not admission or app processing", () => {
    let s = advanceSteps(newGame(), 6).state; s = advanceSteps(s, 51).state;
    s = accepted(s, { type: "start_db_upgrade" }); s = advanceSteps(s, 3).state;
    expect(s.campaign!.dbBacklog).toBe(400);
    expect(s.campaign!.ledger.successes).toBe(0);
    s = step(s).state; expect(s.campaign!.ledger.successes).toBe(1000);
    s = step(s).state; expect(s.campaign!.ledger.successes).toBe(2000);
    expect(s.campaign!.dbBacklog).toBe(0);
  });
  it("prices idle installed infrastructure and keeps purchases exactly once", () => {
    let s = accepted(newGame(), { type: "add_server" }); const cash = s.campaign!.cashCents;
    s = advanceSteps(s, 6).state; s = advanceSteps(s, 54).state;
    expect(s.campaign!.settlements[0].appCents).toBe(Math.floor((1 + 59 * 2) * 70000 / 60));
    expect(s.campaign!.investedCents).toBe(100000);
    expect(s.campaign!.cashCents).toBe(cash + s.campaign!.settlements[0].netCents);
  });
});
