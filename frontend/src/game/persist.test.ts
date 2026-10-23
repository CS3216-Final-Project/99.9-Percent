import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { newGame, newLegacyGame } from "../sim";
import { step, advanceSteps } from "../sim/step";
import { loadGame, saveGame, clearSave, loadMeta, saveMeta, DEFAULT_META, WALKTHROUGH_VERSION, track, readAnalytics, clearAnalytics, saveClassicGame, loadClassicGame } from "./persist";
import { CAMPAIGN_SAVE_KEY as KEY, makeEnvelope } from "./saveEnvelope";
import { decodeClassicSave, rawLegacySave, exportGame } from "./persist";
import { DEFAULT_AUDIO, DEFAULT_GRAPHICS, challengeUnlocked, isSilent, legacyMusicOff, loadAudio, loadGraphics, loadMode, loadTimeOfDay, saveAudio, saveGraphics, saveMode, saveTimeOfDay } from "./persist";
import { preparedReliability, act, tick } from "../sim/__tests__/reliabilityFixture";
import { pendingReliability } from "../sim/reliability";
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
    expect(loadMeta()).toEqual({ ...DEFAULT_META, runsStarted: 4, onboarded: true, tutorialDone: true });
    saveMeta({ ...DEFAULT_META, tutorialDone: true });
    expect(loadMeta().tutorialDone).toBe(true);
  });

  it('reads a profile from before the walkthrough without its introduction state, keeping its progress', () => {
    localStorage.setItem('nn.campaign.meta.v1', JSON.stringify({
      openingOnboarding: { version: 1, step: 1, status: 'in-progress' }, runsStarted: 2, challengeUnlocked: true,
    }));
    expect(loadMeta()).toEqual({ ...DEFAULT_META, runsStarted: 2, challengeUnlocked: true, tutorialDone: true });
  });

  it('counts a finished or skipped former introduction as the walkthrough done, in Guided Mode only', () => {
    for (const status of ['completed', 'skipped']) {
      localStorage.setItem('nn.campaign.meta.v1', JSON.stringify({ openingOnboarding: { version: 1, step: 2, status }, tutorialDone: false }));
      expect(loadMeta()).toEqual({ ...DEFAULT_META, tutorialDone: true });
    }
    for (const introduction of [{ status: 'not-started' }, 'completed', null, { step: 2 }]) {
      localStorage.setItem('nn.campaign.meta.v1', JSON.stringify({ openingOnboarding: introduction }));
      expect(loadMeta().tutorialDone).toBe(true);
    }
    // Challenge Mode's walkthrough is its own: Guided Mode's introduction never stood for it.
    localStorage.setItem('nn.classic.meta.v1', JSON.stringify({ openingOnboarding: { version: 1, step: 2, status: 'completed' } }));
    expect(loadMeta('classic').tutorialDone).toBe(false);
  });

  it('keeps the traffic view choice only when it is a yes or a no', () => {
    expect(loadMeta().trafficView).toBeUndefined();
    saveMeta({ ...DEFAULT_META, trafficView: true });
    expect(loadMeta().trafficView).toBe(true);
    localStorage.setItem('nn.campaign.meta.v1', JSON.stringify({ trafficView: "yes" }));
    expect(loadMeta().trafficView).toBeUndefined();
  });
  it('keeps a practice flag only when it is the current flag', () => {
    localStorage.setItem('nn.campaign.meta.v1', JSON.stringify({ walkthroughStep: 0, walkthroughVersion: WALKTHROUGH_VERSION }));
    expect(loadMeta().walkthroughStep).toBe(0);
    for (const step of [-1, 1.5, '2', 3, null, {}]) {
      localStorage.setItem('nn.campaign.meta.v1', JSON.stringify({ walkthroughStep: step, walkthroughVersion: WALKTHROUGH_VERSION }));
      expect(loadMeta().walkthroughStep).toBeNull();
    }
  });

  it('keeps the announced chapters of one company, dropping anything malformed', () => {
    saveMeta({ ...DEFAULT_META, chapterCompletions: { runId: 'run-1', chapters: ['scaling', 'data'] } });
    expect(loadMeta().chapterCompletions).toEqual({ runId: 'run-1', chapters: ['scaling', 'data'] });
    localStorage.setItem('nn.campaign.meta.v1', JSON.stringify({ chapterCompletions: { runId: 'run-1', chapters: ['data', 'spikes', 'data'] } }));
    expect(loadMeta().chapterCompletions).toEqual({ runId: 'run-1', chapters: ['data'] });
    for (const record of [null, 'run-1', [], { runId: 1, chapters: [] }, { runId: 'run-1' }]) {
      localStorage.setItem('nn.campaign.meta.v1', JSON.stringify({ chapterCompletions: record }));
      expect(loadMeta().chapterCompletions).toBeNull();
    }
  });

  it('keeps only known chapter guides as seen, once each and in chapter order', () => {
    saveMeta({ ...DEFAULT_META, chapterTours: ['data', 'scaling'] });
    expect(loadMeta().chapterTours).toEqual(['scaling', 'data']);
    localStorage.setItem('nn.campaign.meta.v1', JSON.stringify({ chapterTours: ['spikes', 'opening', 7, 'spikes'] }));
    expect(loadMeta().chapterTours).toEqual(['spikes']);
    localStorage.setItem('nn.campaign.meta.v1', JSON.stringify({ chapterTours: 'scaling' }));
    expect(loadMeta().chapterTours).toEqual([]);
  });

  it('leaves the old music switch out of the metadata it reads back', () => {
    localStorage.setItem('nn.campaign.meta.v1', JSON.stringify({ music: 'loud', onboarded: true }));
    expect(loadMeta()).toEqual({ ...DEFAULT_META, onboarded: true, tutorialDone: true });
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

describe("challenge mode unlock", () => {
  it("stays locked for a new or unreadable profile and unlocks only through campaign metadata", () => {
    expect(challengeUnlocked()).toBe(false);
    localStorage.setItem("nn.campaign.meta.v1", "{");
    expect(challengeUnlocked()).toBe(false);
    saveMeta({ ...DEFAULT_META, challengeUnlocked: true }, "classic");
    expect(challengeUnlocked()).toBe(false);
    saveMeta({ ...DEFAULT_META, challengeUnlocked: true });
    expect(challengeUnlocked()).toBe(true);
  });
  it("counts an older completed campaign save even when its metadata predates the field", { timeout: 30_000 }, () => {
    let game = act(preparedReliability(), { type: "arm_reliability" });
    for (let i = 0; i < 60 && !pendingReliability(game.campaign); i++) {
      if (game.phase === "review") game = act(game, { type: "acknowledge_review" });
      game = tick(game);
    }
    game = act(game, { type: "acknowledge_reliability" });
    expect(game.campaign!.reliabilityStage?.acknowledged).toBe(true);
    saveGame(game);
    expect(loadMeta().challengeUnlocked).toBe(false);
    expect(challengeUnlocked()).toBe(true);
    saveMeta({ ...DEFAULT_META, challengeUnlocked: true });
    clearSave();
    expect(challengeUnlocked()).toBe(true);
  });
  it("refuses a stale classic last-mode while locked and honours it once unlocked", () => {
    saveMode("classic");
    expect(loadMode()).toBe("campaign");
    saveMeta({ ...DEFAULT_META, challengeUnlocked: true });
    expect(loadMode()).toBe("classic");
  });
});

describe("sound settings", () => {
  it("start at the defaults and round trip, shared by both modes", () => {
    expect(loadAudio()).toEqual(DEFAULT_AUDIO);
    expect(DEFAULT_AUDIO).toEqual({ music: 80, effects: 80, muted: false, captions: true });
    expect(saveAudio({ music: 35, effects: 0, muted: true, captions: true })).toBe(true);
    expect(loadAudio()).toEqual({ music: 35, effects: 0, muted: true, captions: true });
    saveMode("classic");
    expect(loadAudio()).toEqual({ music: 35, effects: 0, muted: true, captions: true });
  });

  it("load captions from before the setting existed as on, and a corrupt one the same", () => {
    localStorage.setItem("nn.audio.v1", JSON.stringify({ music: 35, effects: 60, muted: true }));
    expect(loadAudio()).toEqual({ music: 35, effects: 60, muted: true, captions: true });
    localStorage.setItem("nn.audio.v1", JSON.stringify({ music: 35, effects: 60, muted: false, captions: "no" }));
    expect(loadAudio()).toEqual({ music: 35, effects: 60, muted: false, captions: true });
  });

  it("remember captions turned off", () => {
    saveAudio({ music: 80, effects: 80, muted: false, captions: false });
    expect(loadAudio()).toEqual({ music: 80, effects: 80, muted: false, captions: false });
  });

  it("count as silent when muted or when both volumes are at 0, and not otherwise", () => {
    expect(isSilent(DEFAULT_AUDIO)).toBe(false);
    expect(isSilent({ ...DEFAULT_AUDIO, muted: true })).toBe(true);
    expect(isSilent({ music: 0, effects: 0, muted: false, captions: true })).toBe(true);
    // One audible channel is enough to be heard.
    expect(isSilent({ music: 0, effects: 5, muted: false, captions: true })).toBe(false);
    expect(isSilent({ music: 5, effects: 0, muted: false, captions: true })).toBe(false);
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
    saveMeta({ ...DEFAULT_META, challengeUnlocked: true });
    saveMode("classic");
    expect(loadAudio().muted).toBe(true);
    // The shared key wins over metadata, as it did before.
    localStorage.setItem("nn.music.v1", "true");
    expect(loadAudio().muted).toBe(false);
  });

  it("prefer the new settings over the old switch, and mirror the switch for older builds", () => {
    localStorage.setItem("nn.music.v1", "false");
    saveAudio({ music: 50, effects: 50, muted: false, captions: true });
    expect(loadAudio().muted).toBe(false);
    expect(localStorage.getItem("nn.music.v1")).toBe("true");
    saveAudio({ music: 0, effects: 50, muted: false, captions: true });
    expect(localStorage.getItem("nn.music.v1")).toBe("false");
  });

  it.each([
    ["{", { ...DEFAULT_AUDIO, muted: true }],
    ["null", { ...DEFAULT_AUDIO, muted: true }],
    [JSON.stringify({ music: "loud", effects: 250, muted: "yes" }), { music: 80, effects: 100, muted: false, captions: true }],
    [JSON.stringify({ music: -4, effects: 33.4 }), { music: 0, effects: 33, muted: false, captions: true }],
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
    saveAudio({ music: 0, effects: 80, muted: false, captions: true });
    expect(legacyMusicOff()).toBe(false);
  });
});

describe("graphics settings", () => {
  it("start at Auto and round trip, shared by both modes", () => {
    expect(DEFAULT_GRAPHICS).toEqual({ quality: "auto", fov: 75, skipElevator: false });
    expect(loadGraphics()).toEqual(DEFAULT_GRAPHICS);
    expect(saveGraphics({ quality: "low", fov: 75, skipElevator: true })).toBe(true);
    expect(loadGraphics()).toEqual({ quality: "low", fov: 75, skipElevator: true });
    saveMode("classic");
    expect(loadGraphics()).toEqual({ quality: "low", fov: 75, skipElevator: true });
  });

  it.each(["{", "null", "42", JSON.stringify({}), JSON.stringify({ quality: "ultra" }), JSON.stringify({ quality: 3 })])("fall back to Auto for a corrupt value %s", (raw) => {
    localStorage.setItem("nn.graphics.v1", raw);
    expect(loadGraphics()).toEqual(DEFAULT_GRAPHICS);
  });

  it.each([
    [JSON.stringify({ quality: "high" }), { quality: "high", fov: 75, skipElevator: false }],
    [JSON.stringify({ quality: "high", fov: 82 }), { quality: "high", fov: 82, skipElevator: false }],
    [JSON.stringify({ quality: "low", fov: 140 }), { quality: "low", fov: 90, skipElevator: false }],
    [JSON.stringify({ quality: "low", fov: "wide" }), { quality: "low", fov: 75, skipElevator: false }],
    [JSON.stringify({ quality: "ultra", fov: 72 }), { quality: "auto", fov: 72, skipElevator: false }],
    [JSON.stringify({ quality: "high", skipElevator: true }), { quality: "high", fov: 75, skipElevator: true }],
    [JSON.stringify({ quality: "high", skipElevator: "yes" }), { quality: "high", fov: 75, skipElevator: false }],
  ])("read a field of view and the elevator choice from %s, missing or invalid as the default", (raw, settings) => {
    localStorage.setItem("nn.graphics.v1", raw);
    expect(loadGraphics()).toEqual(settings);
  });
  it("fall back to Auto when storage is unavailable, and report a save that did not stick", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw Error("blocked"); });
    expect(loadGraphics()).toEqual(DEFAULT_GRAPHICS);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("quota"); });
    expect(saveGraphics({ quality: "medium", fov: 75, skipElevator: false })).toBe(false);
  });
});

describe("time of day", () => {
  it("round trips independently", () => {
    expect(saveTimeOfDay(0.8)).toBe(true);
    expect(loadTimeOfDay()).toBe(0.8);
  });

  it("returns null when no time is stored", () => {
    expect(loadTimeOfDay()).toBeNull();
  });

  it.each(["abc", '{"time":1}', '{"time":-0.1}', '{"time":"0.5"}'])("returns null for invalid stored value %s", raw => {
    localStorage.setItem("nn.timeOfDay.v1", raw);
    expect(loadTimeOfDay()).toBeNull();
  });

  it("handles storage failures", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw Error("unavailable"); });
    expect(loadTimeOfDay()).toBeNull();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("quota"); });
    expect(saveTimeOfDay(0.5)).toBe(false);
  });
});



it("marks lesson-era profiles done and drops their indices, in Guided Mode only", () => {
  for (const step of [0, 3, 7, 20, 50]) {
    localStorage.setItem("nn.campaign.meta.v1", JSON.stringify({ walkthroughStep: step, walkthroughFurthestStep: step }));
    expect(loadMeta()).toMatchObject({ walkthroughStep: null, walkthroughFurthestStep: 0, tutorialDone: true, walkthroughVersion: WALKTHROUGH_VERSION });
  }
  localStorage.setItem("nn.campaign.meta.v1", JSON.stringify({ walkthroughStep: 0, walkthroughVersion: 2, tutorialDone: false }));
  expect(loadMeta()).toMatchObject({ walkthroughStep: null, tutorialDone: true });
  // Challenge Mode never had the Guided Mode walkthrough; its profile is left as stored.
  localStorage.setItem("nn.classic.meta.v1", JSON.stringify({ walkthroughStep: null, tutorialDone: true }));
  expect(loadMeta("classic")).toMatchObject({ walkthroughStep: null, tutorialDone: true });
});

it("remembers each one-time Guided Mode tip and ignores unknown or corrupt entries", () => {
  localStorage.setItem("nn.campaign.meta.v1", JSON.stringify({ tipsSeen: ["settlement", "bogus", 3] }));
  expect(loadMeta().tipsSeen).toEqual(["settlement"]);
  localStorage.setItem("nn.campaign.meta.v1", JSON.stringify({ tipsSeen: "settlement" }));
  expect(loadMeta().tipsSeen).toEqual([]);
});
