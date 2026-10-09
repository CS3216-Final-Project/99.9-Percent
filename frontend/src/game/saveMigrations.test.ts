import { describe, it, expect } from "vitest";
import { newGame } from "../sim";
import { advanceSteps, applyCampaignInput, step } from "../sim/step";
import { playedRun, v1Envelope } from "./testing/saves";
import { decodeSave, makeEnvelope, validateEnvelope, type SaveEnvelope } from "./saveMigrations";

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
    expect(validateEnvelope({ ...e, scenarioVersion: 2 }).status).toBe("unsupported");
    expect(decodeSave(JSON.stringify({ ...e, schemaVersion: 3 })).status).toBe("unsupported");
    expect(decodeSave(JSON.stringify({ ...e, schemaVersion: 0 })).status).toBe("unsupported");
  });
});

describe("schema 1 conversion", () => {
  it("recovers the inputs of a full-state save and replays it exactly", () => {
    const s = playedRun();
    const result = decodeSave(JSON.stringify(v1Envelope(s, 300)));
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(json(result.game)).toEqual(json(s));
    expect(result.envelope).toMatchObject({ schemaVersion: 2, seed: 4, runId: "played", step: s.campaign!.step, runtime: { remainderMs: 300 } });
  });
  it("refuses a full-state save that its own inputs do not reproduce", () => {
    const e = v1Envelope(playedRun());
    e.game.campaign.cashCents += 100; e.game.cash += 1;
    expect(decodeSave(JSON.stringify(e)).status).not.toBe("ok");
  });
});
