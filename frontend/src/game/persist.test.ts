import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { newGame, newLegacyGame } from "../sim";
import { step, advanceSteps } from "../sim/step";
import { loadGame, saveGame, clearSave, loadMeta, saveMeta, DEFAULT_META, track, readAnalytics, clearAnalytics, saveClassicGame, loadClassicGame } from "./persist";
import { CAMPAIGN_SAVE_KEY as KEY, makeEnvelope } from "./saveEnvelope";
import { decodeClassicSave, rawLegacySave, exportGame } from "./persist";
import { DEFAULT_AUDIO, legacyMusicOff, loadAudio, saveAudio, saveMode } from "./persist";
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
  it("keeps independent onboarding and every unexported analytics record", () => {
    saveMeta({ ...DEFAULT_META, tutorialDone: true }); expect(loadMeta().tutorialDone).toBe(true);
    for (let i = 0; i < 503; i++)track("run_started"); expect(readAnalytics()).toHaveLength(503);
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

  it('leaves the old music switch out of the metadata it reads back', () => {
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

  it('retains older unexported events and can explicitly clear them', () => {
    const events = Array.from({ length: 500 }, (_, i) => ({ t: '2026-01-01', name: 'run_started', data: { run: i } }));
    localStorage.setItem('nn.campaign.analytics.v1', JSON.stringify(events));
    track('save_resumed', { week: 3 });
    const saved = readAnalytics();
    expect(saved).toHaveLength(501);
    expect(saved[0].data).toEqual({ run: 0 });
    expect(saved[500].name).toBe('save_resumed');
    clearAnalytics();
    expect(readAnalytics()).toEqual([]);
  });
});


describe("validated replacement and legacy files", () => {
  it.each([
    { inputs: null }, { runtime: { remainderMs: -1 } }, { runId: "" },
    { inputs: [{ step: 2, action: { type: "add_server" } }], step: 1 },
  ])("preserves a current-format save with an invalid payload: %j", patch => {
    const raw = JSON.stringify({ ...makeEnvelope(newGame()), ...patch });
    localStorage.setItem(KEY, raw);
    expect(loadGame().status).toBe("corrupt");
    expect(saveGame(newGame())).toBe(false);
    expect(localStorage.getItem(KEY)).toBe(raw);
    expect(saveGame(newGame(), 0, true)).toBe(true);
  });
  it("revalidates external changes after a successful autosave", () => {
    saveGame(newGame());
    const raw = JSON.stringify({ ...makeEnvelope(newGame()), inputs: null });
    localStorage.setItem(KEY, raw);
    expect(saveGame(step(newGame()).state)).toBe(false);
    expect(localStorage.getItem(KEY)).toBe(raw);
  });
  it("exports and decodes Classic without rewriting the original legacy bytes", () => {
    const game = newLegacyGame(777), raw = JSON.stringify({ game, savedAt: 5 });
    localStorage.setItem("nn.save.v1", raw);
    expect(rawLegacySave()).toBe(raw);
    expect(decodeClassicSave(exportGame(game))).toEqual({ status: "ok", game });
    saveClassicGame(game); clearSave();
    expect(rawLegacySave()).toBe(raw);
  });
  it.each([{ cash: null }, { infra: null }, { tasks: [null] }, { phase: "other" }, { techDone: ["unknown"] }, { infra: { ...newLegacyGame().infra, dbTier: 999 } }, { history: [null] }, { postmortems: [null] }, { totals: {} }])("rejects a broken Classic payload without writing it: %j", patch => {
    const game = { ...newLegacyGame(), ...patch };
    expect(decodeClassicSave(JSON.stringify({ game }))).toEqual({ status: "corrupt" });
  });
});

describe("sound settings", () => {
  it("start at the defaults and round trip, shared by both modes", () => {
    expect(loadAudio()).toEqual(DEFAULT_AUDIO);
    expect(DEFAULT_AUDIO).toEqual({ music: 80, effects: 80, muted: false });
    expect(saveAudio({ music: 35, effects: 0, muted: true })).toBe(true);
    expect(loadAudio()).toEqual({ music: 35, effects: 0, muted: true });
    saveMode("classic");
    expect(loadAudio()).toEqual({ music: 35, effects: 0, muted: true });
  });

  it("keep a player who turned the music off muted, at the default volumes", () => {
    localStorage.setItem("nn.music.v1", "false");
    expect(loadAudio()).toEqual({ ...DEFAULT_AUDIO, muted: true });
    localStorage.setItem("nn.music.v1", "true");
    expect(loadAudio()).toEqual(DEFAULT_AUDIO);
  });

  it("read the music switch from older metadata when the shared key is missing", () => {
    localStorage.setItem("nn.classic.meta.v1", JSON.stringify({ music: false }));
    expect(loadAudio().muted).toBe(false);
    saveMode("classic");
    expect(loadAudio().muted).toBe(true);
    // The shared key wins over metadata, as it did before.
    localStorage.setItem("nn.music.v1", "true");
    expect(loadAudio().muted).toBe(false);
  });

  it("prefer the new settings over the old switch, and mirror the switch for older builds", () => {
    localStorage.setItem("nn.music.v1", "false");
    saveAudio({ music: 50, effects: 50, muted: false });
    expect(loadAudio().muted).toBe(false);
    expect(localStorage.getItem("nn.music.v1")).toBe("true");
    saveAudio({ music: 0, effects: 50, muted: false });
    expect(localStorage.getItem("nn.music.v1")).toBe("false");
  });

  it.each([
    ["{", { ...DEFAULT_AUDIO, muted: true }],
    ["null", { ...DEFAULT_AUDIO, muted: true }],
    [JSON.stringify({ music: "loud", effects: 250, muted: "yes" }), { music: 80, effects: 100, muted: false }],
    [JSON.stringify({ music: -4, effects: 33.4 }), { music: 0, effects: 33, muted: false }],
  ])("tolerate a corrupt value %s", (raw, expected) => {
    // An unreadable record falls back to the older switch, here off.
    localStorage.setItem("nn.music.v1", "false");
    localStorage.setItem("nn.audio.v1", raw);
    expect(loadAudio()).toEqual(expected);
  });

  it("fall back to the defaults when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw Error("blocked"); });
    expect(loadAudio()).toEqual(DEFAULT_AUDIO);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("quota"); });
    expect(saveAudio(DEFAULT_AUDIO)).toBe(false);
  });

  it("know when the pre-update profile had music off", () => {
    expect(legacyMusicOff()).toBe(false);
    localStorage.setItem("nn.meta.v1", JSON.stringify({ tutorialDone: true, music: false }));
    expect(legacyMusicOff()).toBe(true);
    localStorage.setItem("nn.music.v1", "true");
    expect(legacyMusicOff()).toBe(false);
  });

  it("never let the pre-update switch override settings chosen since", () => {
    localStorage.setItem("nn.meta.v1", JSON.stringify({ tutorialDone: true, music: false }));
    // Music at zero mirrors the old switch as off, but that is the player's new choice, not the old one.
    saveAudio({ music: 0, effects: 80, muted: false });
    expect(legacyMusicOff()).toBe(false);
  });
});
