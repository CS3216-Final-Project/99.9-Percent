import { describe, it, expect } from "vitest";
import { newGame } from "../sim";
import { advanceSteps, applyCampaignInput, step } from "../sim/step";
import { playedRun } from "./testing/saves";
import { decodeSave, makeEnvelope, validateEnvelope, type SaveEnvelope } from "./saveEnvelope";

const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as unknown;

describe("input-log saves", () => {
  it("replays live, incident and review states exactly", () => {
    let s = applyCampaignInput(advanceSteps(newGame(1, "validation"), 6).state, { type: "start_db_upgrade" }).state;
    for (let i = 0; i < 9; i++) {
      const result = decodeSave(JSON.stringify(makeEnvelope(s)));
      expect(result.status).toBe("ok");
      if (result.status === "ok") expect(json(result.game)).toEqual(json(s));
      s = step(s).state;
    }
    expect(s.phase).toBe("review");
  });
  it("stays small however long the run", () => {
    const s = playedRun();
    expect(JSON.stringify(makeEnvelope(s)).length).toBeLessThan(1000);
    expect(JSON.stringify(s).length).toBeGreaterThan(20000);
  });
  it.each<[string, (e: SaveEnvelope) => void]>([
    ["identity", e => { e.runId = ""; }],
    ["seed", e => { e.seed = 1.5; }],
    ["step", e => { e.step = -1; }],
    ["input order", e => { e.inputs.reverse(); }],
    ["input action", e => { (e.inputs[0] as { action: unknown }).action = null; }],
    ["review", e => { e.step += 200; }],
    ["remainder", e => { e.runtime.remainderMs = 1000; }],
    ["timestamp", e => { e.savedAt = NaN; }],
  ])("rejects an impossible %s", (_, spoil) => {
    const e = json(makeEnvelope(applyCampaignInput(playedRun(), { type: "add_server" }).state)) as SaveEnvelope;
    e.inputs.splice(0, 0, { step: 7, action: { type: "start_db_upgrade" } });
    spoil(e);
    expect(validateEnvelope(e).status).toBe("corrupt");
  });
  it("identifies unknown scenario and schema versions without reinterpreting saves", () => {
    const e = makeEnvelope(newGame());
    expect(validateEnvelope({ ...e, scenarioVersion: 3 as 1 }).status).toBe("unsupported");
    expect(decodeSave(JSON.stringify({ ...e, schemaVersion: 99 })).status).toBe("unsupported");
    expect(decodeSave(JSON.stringify({ ...e, schemaVersion: 0 })).status).toBe("unsupported");
  });
  it("self-resolves incidents replayed from older saves but gates new ones", () => {
    const s = advanceSteps(newGame(4, "legacy-incident"), 6).state;
    expect(s.campaign!.incident).not.toBeNull();
    const prior = validateEnvelope(json({ ...makeEnvelope(s), schemaVersion: 8 }) as SaveEnvelope);
    expect(prior.status).toBe("ok");
    if (prior.status === "ok") expect(prior.game.campaign!.incident!.responseDueFrom).toBeUndefined();
    const current = validateEnvelope(makeEnvelope(s));
    expect(current.status).toBe("ok");
    if (current.status === "ok") {
      expect(current.game.campaign!.incident!.responseDueFrom).toBe(6);
      expect(current.envelope.legacyIncidentStep).toBeUndefined();
    }
  });
  it("replays a prior-schema version-1 save byte-identically", () => {
    const s = applyCampaignInput(playedRun(), { type: "add_server" }).state;
    const e = makeEnvelope(s);
    const prior = json({ ...e, schemaVersion: 7 }) as SaveEnvelope;
    const result = validateEnvelope(prior);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      // Replayed history stays byte-identical; the compat marker that preserves the
      // pre-response-rule boundary only exists on the replayed campaign.
      const g = json(result.game) as { campaign: { legacyIncidentStep?: number; legacyScalingStep?: number } };
      delete g.campaign.legacyIncidentStep;
      delete g.campaign.legacyScalingStep;
      expect(g).toEqual(json(s));
    }
  });
  it("accepts version-2 envelopes and replays them on their own rule set", () => {
    const v2 = newGame(4, "launch-week", 2);
    expect(v2.campaign!.scenarioVersion).toBe(2);
    const roundTrip = validateEnvelope(json(makeEnvelope(v2)) as SaveEnvelope);
    expect(roundTrip.status).toBe("ok");
    if (roundTrip.status === "ok") {
      expect(json(roundTrip.game)).toEqual(json(v2));
      expect(roundTrip.envelope.scenarioVersion).toBe(2);
    }
  });
});
