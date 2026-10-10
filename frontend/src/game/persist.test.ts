import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { newGame, newLegacyGame } from "../sim";
import { step, advanceSteps } from "../sim/step";
import { loadGame, saveGame, clearSave, loadMeta, saveMeta, DEFAULT_META, track, readAnalytics, clearAnalytics, saveClassicGame, loadClassicGame } from "./persist";
import { CAMPAIGN_SAVE_KEY as KEY } from "./saveEnvelope";
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
  it("keeps the classic save and meta apart from the campaign's", () => {
    const classic = newLegacyGame(3);
    saveClassicGame(classic); saveMeta({ ...DEFAULT_META, tutorialDone: true }, "classic");
    expect(loadGame().status).toBe("none"); expect(loadMeta()).toEqual(DEFAULT_META);
    saveGame(newGame()); saveMeta({ ...DEFAULT_META, runsStarted: 4 }); track("run_started"); clearSave(); clearAnalytics();
    expect(loadClassicGame()).toEqual({ status: "ok", game: JSON.parse(JSON.stringify(classic)) });
    expect(loadMeta("classic").tutorialDone).toBe(true);
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
  it("resumes before and after settlement identically", () => {
    let s = advanceSteps(newGame(), 6).state;
    for (let i = 6; i < 59; i++)s = step(s).state;
    saveGame(s); const loaded = loadGame(); expect(loaded.status).toBe("ok");
    if (loaded.status !== "ok") throw Error("load");
    expect(step(loaded.game)).toEqual(step(s));
    s = step(s).state; saveGame(s); expect(loadGame()).toMatchObject({ status: "ok", game: s });
  });
});

describe('browser metadata and analytics', () => {
  it('fills new metadata fields when resuming an older browser profile', () => {
    localStorage.setItem('nn.campaign.meta.v1', JSON.stringify({ runsStarted: 4, onboarded: true }));
    expect(loadMeta()).toEqual({ ...DEFAULT_META, runsStarted: 4, onboarded: true });
    saveMeta({ ...DEFAULT_META, tutorialDone: true });
    expect(loadMeta().tutorialDone).toBe(true);
  });

  it('plays music unless the player turned it off, and ignores a corrupt setting', () => {
    expect(loadMeta().music).toBe(true);
    saveMeta({ ...DEFAULT_META, music: false });
    expect(loadMeta().music).toBe(false);
    localStorage.setItem('nn.campaign.meta.v1', JSON.stringify({ music: 'loud', onboarded: true }));
    expect(loadMeta()).toEqual({ ...DEFAULT_META, onboarded: true });
  });

  it('recovers from malformed metadata and analytics', () => {
    localStorage.setItem('nn.campaign.meta.v1', '{');
    localStorage.setItem('nn.campaign.analytics.v1', '{}');
    expect(loadMeta()).toEqual(DEFAULT_META);
    expect(readAnalytics()).toEqual([]);
    localStorage.setItem('nn.campaign.analytics.v1', '{');
    track('save_resumed', { week: 2 });
    expect(readAnalytics().map(e => e.name)).toEqual(['save_resumed']);
  });

  it('retains only the latest 500 events and can clear them', () => {
    const events = Array.from({ length: 500 }, (_, i) => ({ t: '2026-01-01', name: 'run_started', data: { run: i } }));
    localStorage.setItem('nn.campaign.analytics.v1', JSON.stringify(events));
    track('save_resumed', { week: 3 });
    const saved = readAnalytics();
    expect(saved).toHaveLength(500);
    expect(saved[0].data).toEqual({ run: 1 });
    expect(saved[499].name).toBe('save_resumed');
    clearAnalytics();
    expect(readAnalytics()).toEqual([]);
  });
});
