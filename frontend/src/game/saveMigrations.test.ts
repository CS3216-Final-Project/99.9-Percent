import { describe, it, expect } from "vitest";
import { newGame, applyAction } from "../sim";
import { advanceSteps, step } from "../sim/step";
import { makeEnvelope, validateEnvelope } from "./saveMigrations";
describe("versioned envelope validation", () => {
  it("validates all live and review snapshots and pending actions", () => {
    let s = advanceSteps(newGame(1, "validation"), 6).state;
    const action = applyAction(s, { type: "start_db_upgrade" }); if (!action.ok) throw Error(action.message); s = action.state;
    for (let i = 0; i < 9; i++) {
      expect(validateEnvelope(makeEnvelope(s)).status).toBe("ok");
      s = step(s).state;
    }
  });
  it.each(["rate", "backlog", "counter", "trace", "period", "identity", "remainder"])("rejects inconsistent %s", kind => {
    const e = makeEnvelope(newGame()); const c = e.game.campaign!;
    if (kind === "rate") c.snapshot.serviceErrorRate = .5;
    if (kind === "backlog") c.snapshot.db.backlog = -1;
    if (kind === "counter") c.overloadSteps = -1;
    if (kind === "trace") c.trace[0].id = 12;
    if (kind === "period") c.lastSettledPeriod = 1;
    if (kind === "identity") c.runId = "wrong";
    if (kind === "remainder") e.runtime.remainderMs = 1000;
    expect(validateEnvelope(e).status).toBe("corrupt");
  });
  it("identifies unknown scenario versions without reinterpreting saves", () => {
    const e = makeEnvelope(newGame());
    expect(validateEnvelope({ ...e, scenarioVersion: 2 }).status).toBe("unsupported");
  });
});


it("rejects review without evidence and legacy victory outcomes",()=>{
  const e=makeEnvelope(newGame());
  e.game.phase="review";
  expect(validateEnvelope(e).status).toBe("corrupt");
  e.game.phase="ended";e.game.outcome="won";
  expect(validateEnvelope(e).status).toBe("corrupt");
});
