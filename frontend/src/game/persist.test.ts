import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { newGame } from "../sim";
import { step, advanceSteps } from "../sim/step";
import { loadGame, saveGame, clearSave, loadMeta, saveMeta, DEFAULT_META, track, readAnalytics, clearAnalytics } from "./persist";
import { makeEnvelope, validateEnvelope, migrateSave, CAMPAIGN_SAVE_KEY as KEY } from "./saveMigrations";
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
describe("campaign data preservation", () => {
  it("round trips clock, queued work, incident and financial state", () => {
    const game = advanceSteps(newGame(9, "save-company"), 6).state;
    expect(saveGame(game, 200)).toBe(true);
    expect(loadGame()).toMatchObject({ status: "ok", game, remainderMs: 200 });
  });
  it.each(["{", JSON.stringify({ schemaVersion: 99 })])("preserves unreadable save %s", raw => {
    localStorage.setItem(KEY, raw); expect(["corrupt", "unsupported"]).toContain(loadGame().status);
    expect(saveGame(newGame())).toBe(false); expect(localStorage.getItem(KEY)).toBe(raw);
    expect(saveGame(newGame(), 0, true)).toBe(true);
  });
  it("leaves legacy saves, metadata and analytics byte-for-byte unchanged", () => {
    const keys = ["nn.save.v1", "nn.meta.v1", "nn.analytics.v1"];
    keys.forEach(k => localStorage.setItem(k, "original-" + k));
    expect(loadGame().status).toBe("none"); expect(loadMeta()).toEqual(DEFAULT_META);
    saveGame(newGame()); saveMeta({ ...DEFAULT_META, tutorialDone: true }); track("run_started"); clearSave(); clearAnalytics();
    keys.forEach(k => expect(localStorage.getItem(k)).toBe("original-" + k));
  });
  it("handles storage failures without destroying in-memory state", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("quota"); });
    expect(saveGame(newGame())).toBe(false);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw Error("unavailable"); });
    expect(loadGame().status).toBe("unavailable");
  });
  it("keeps independent onboarding and bounded analytics", () => {
    saveMeta({ ...DEFAULT_META, tutorialDone: true }); expect(loadMeta().tutorialDone).toBe(true);
    for (let i = 0; i < 503; i++)track("run_started"); expect(readAnalytics()).toHaveLength(500);
  });
  it.each(["backlog", "schedule", "identity", "nonfinite", "nested"])("rejects invalid %s without deleting", kind => {
    const e = makeEnvelope(newGame());
    if (kind === "backlog") e.game.campaign!.dbBacklog = 601;
    if (kind === "identity") e.runId = "different";
    if (kind === "nonfinite") e.game.campaign!.cashCents = NaN;
    if (kind === "nested") delete (e.game as Partial<typeof e.game>).infra;
    if (kind === "schedule") e.game.campaign!.pending.push({ id: "bad", type: "limit", requestedStep: 0, activationStep: 0, costCents: 0, activatedStep: null });
    expect(validateEnvelope(e).status).toBe("corrupt");
  });
  it("resumes before and after settlement identically", () => {
    let s = advanceSteps(newGame(), 6).state;
    for (let i = 6; i < 59; i++)s = step(s).state;
    saveGame(s); const loaded = loadGame(); expect(loaded.status).toBe("ok");
    if (loaded.status !== "ok") throw Error("load");
    expect(step(loaded.game)).toEqual(step(s));
    s = step(s).state; saveGame(s); expect(loadGame()).toMatchObject({ status: "ok", game: s });
  });
  it("backs up old schema before migration and refuses unknown future versions", () => {
    const raw = JSON.stringify({ schemaVersion: 0 }); localStorage.setItem(KEY, raw);
    expect(migrateSave(localStorage, { 0: () => makeEnvelope(newGame()) })).toBe(true);
    expect(localStorage.getItem(KEY + ".backup.v0")).toBe(raw);
    localStorage.setItem(KEY, JSON.stringify({ schemaVersion: 8 }));
    expect(migrateSave(localStorage, { 0: () => makeEnvelope(newGame()) })).toBe(false);
  });
  it("never replaces original when migration backup fails", () => {
    localStorage.setItem(KEY, JSON.stringify({ schemaVersion: 0 }));
    const before = localStorage.getItem(KEY);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("quota"); });
    expect(migrateSave(localStorage, { 0: () => makeEnvelope(newGame()) })).toBe(false);
    expect(localStorage.getItem(KEY)).toBe(before);
  });
});
