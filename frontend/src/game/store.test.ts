import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { newGame, newLegacyGame, advanceTurn } from "../sim";
import { advanceSteps } from "../sim/step";
import { preparedReliability, act, tick } from "../sim/__tests__/reliabilityFixture";
import { pendingReliability } from "../sim/reliability";
import { DEFAULT_AUDIO, DEFAULT_META, isSilent, loadAudio, loadClassicGame, loadGame, loadMeta, loadMode, saveGame, saveMeta, saveMode, readAnalytics } from "./persist";
import { makeEnvelope } from "./saveEnvelope";
import { useGame } from "./store";
beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(() => vi.restoreAllMocks());
function enter() {
  // These tests drive the clock, which the Opening walkthrough holds until it is done.
  saveMeta({ ...loadMeta(), tutorialDone: true });
  useGame.getState().boot(); useGame.getState().play();
}
describe("shared campaign runtime", () => {
  it("boots once", () => {
    useGame.getState().boot(); const s = useGame.getState(); s.boot();
    expect(useGame.getState()).toBe(s); expect(readAnalytics().filter(e => e.name === "run_started")).toHaveLength(0);
    expect(s.running).toBe(false);
  });
  it("protects corrupt saves from boot and autosave, with explicit reset", () => {
    localStorage.setItem("nn.campaign.save.v1", "{"); useGame.getState().boot();
    useGame.getState().advance(); useGame.getState().saveNow();
    expect(localStorage.getItem("nn.campaign.save.v1")).toBe("{");
    useGame.getState().newRun({ seed: 1 }); expect(loadGame().status).toBe("ok");
  });
  it("uses same fixed steps at every speed, retains fractional pause credit", () => {
    enter(); useGame.getState().setRunning(true);
    useGame.getState().tick(.4); expect(useGame.getState().remainderMs).toBe(400);
    useGame.getState().setRunning(false); useGame.getState().tick(20);
    expect(useGame.getState().remainderMs).toBe(400);
    useGame.getState().setRunning(true); useGame.getState().setSpeed(2); useGame.getState().tick(.3);
    expect(useGame.getState().game.campaign!.step).toBe(1);
  });
  it("stops batch at first incident and drops whole-step credit", () => {
    enter(); useGame.getState().setRunning(true); useGame.getState().tick(20.2);
    expect(useGame.getState()).toMatchObject({ running: false, remainderMs: 200 });
    expect(useGame.getState().game.campaign!.step).toBe(6);
    useGame.getState().setRunning(true); useGame.getState().tick(.8); expect(useGame.getState().game.campaign!.step).toBe(7);
  });
  it("resumes incident paused, preserves timer remainder and action schedule", () => {
    saveGame(advanceSteps(newGame(), 6).state, 300); enter();
    expect(useGame.getState().running).toBe(false); expect(useGame.getState().remainderMs).toBe(300);
    useGame.getState().act({ type: "start_db_upgrade" }); useGame.getState().setRunning(true);
    useGame.getState().tick(30); expect(useGame.getState().game.phase).toBe("review"); expect(useGame.getState().running).toBe(false);
    const before = useGame.getState().game.campaign!;
    useGame.getState().act({ type: "acknowledge_review" });
    expect(useGame.getState().game.campaign!.cashCents).toBe(before.cashCents);
    expect(useGame.getState().game.campaign!.step).toBe(before.step);
  });
  it("menu pauses, history does not, and later views are inaccessible", () => {
    enter(); useGame.getState().setRunning(true);
    useGame.getState().openView("history"); expect(useGame.getState().running).toBe(true);
    useGame.getState().openView("tech"); expect(useGame.getState().view).toBe("tech");expect(useGame.getState().running).toBe(false);
    useGame.getState().openView("menu"); expect(useGame.getState().running).toBe(false);
  });
});


it("reports quota failures on entry and reset while allowing in-memory play",()=>{
  saveMeta({ ...DEFAULT_META, tutorialDone: true });
  vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw Error("quota");});
  enter();
  expect(useGame.getState().toast?.kind).toBe("error");
  useGame.getState().newRun();
  expect(useGame.getState().toast?.kind).toBe("error");
  useGame.getState().advance();
  expect(useGame.getState().game.campaign!.step).toBe(1);
});

describe("importing a save", () => {
  it("replaces the current company with an exported one", () => {
    useGame.getState().boot();
    const exported = advanceSteps(newGame(1, "imported-run"), 3).state;
    expect(useGame.getState().importSave(JSON.stringify(makeEnvelope(exported, 250)))).toBe(true);
    expect(useGame.getState()).toMatchObject({ game: exported, remainderMs: 250, running: false, started: true });
    expect(loadGame()).toMatchObject({ status: "ok", game: exported, remainderMs: 250 });
  });
  it("rejects unreadable and unsupported files without touching the current company", () => {
    useGame.getState().boot(); useGame.getState().advance();
    const before = localStorage.getItem("nn.campaign.save.v1");
    expect(useGame.getState().importSave("not json")).toBe(false);
    expect(useGame.getState().toast?.text).toBe("That file is not a readable save.");
    const future = { ...makeEnvelope(newGame()), schemaVersion: 99 };
    expect(useGame.getState().importSave(JSON.stringify(future))).toBe(false);
    expect(useGame.getState().toast?.text).toBe("That save is from a different version of the game.");
    expect(localStorage.getItem("nn.campaign.save.v1")).toBe(before);
  });
  it("replaces a preserved unreadable save and turns saving back on", () => {
    localStorage.setItem("nn.campaign.save.v1", "{"); useGame.getState().boot();
    expect(useGame.getState().saveBlocked).toBe(true);
    expect(useGame.getState().importSave(JSON.stringify(makeEnvelope(newGame())))).toBe(true);
    expect(useGame.getState().saveBlocked).toBe(false); expect(loadGame().status).toBe("ok");
  });
});

it("saves every decision so a reload replays to the same company", () => {
  enter(); useGame.getState().setRunning(true); useGame.getState().tick(6);
  for (const action of [{ type: "incident_inspect", equipment: "db" }, { type: "add_server" }, { type: "add_server" }, { type: "start_db_upgrade" }] as const) {
    useGame.getState().act(action); useGame.getState().advance();
  }
  const live = useGame.getState().game;
  expect(live.campaign!.trace.filter(t => t.type === "action-rejected")).toHaveLength(2);
  useGame.setState(useGame.getInitialState(), true); useGame.getState().boot();
  expect(JSON.parse(JSON.stringify(useGame.getState().game))).toEqual(JSON.parse(JSON.stringify(live)));
});

describe("game modes", () => {
  // These journeys play Challenge Mode, which an already-unlocked profile allows.
  beforeEach(() => saveMeta({ ...DEFAULT_META, challengeUnlocked: true }));
  it("defaults to campaign and remembers the last mode played", () => {
    useGame.getState().boot();
    expect(useGame.getState().mode).toBe("campaign");
    expect(useGame.getState().game.campaign).toBeDefined();
    useGame.getState().switchMode("classic");
    useGame.setState(useGame.getInitialState(), true); useGame.getState().boot();
    expect(useGame.getState()).toMatchObject({ mode: "classic", started: false });
    expect(useGame.getState().game.campaign).toBeUndefined();
  });
  it("keeps each mode's run when switching back and forth", () => {
    enter(); useGame.getState().advance(); useGame.getState().advance();
    const campaign = useGame.getState().game;
    useGame.getState().switchMode("classic");
    expect(useGame.getState()).toMatchObject({ mode: "classic", started: true, view: null, running: false });
    useGame.getState().advance();
    const classic = useGame.getState().game;
    expect(classic.turn).toBe(2);
    useGame.getState().switchMode("campaign");
    expect(useGame.getState().game).toEqual(campaign);
    useGame.getState().switchMode("classic");
    expect(useGame.getState().game).toEqual(classic);
    expect(loadGame()).toMatchObject({ status: "ok", game: campaign });
  });
  it("starting a new classic run leaves the campaign save alone", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);
    enter(); useGame.getState().advance();
    now.mockReturnValue(2000);
    useGame.getState().switchMode("classic");
    // Switching modes saves the departing campaign; the Classic reset must not rewrite it.
    const campaign = localStorage.getItem("nn.campaign.save.v1");
    now.mockReturnValue(3000);
    useGame.getState().newRun({ seed: 7 });
    expect(useGame.getState().game).toMatchObject({ seed: 7, turn: 1 });
    expect(localStorage.getItem("nn.campaign.save.v1")).toBe(campaign);
    expect(loadClassicGame()).toMatchObject({ status: "ok", game: { seed: 7 } });
  });
  it("replaces an unreadable classic save with a new run", () => {
    localStorage.setItem("nn.classic.save.v1", "{");
    useGame.getState().boot(); useGame.getState().switchMode("classic");
    expect(useGame.getState().toast).toMatchObject({ kind: "error", text: "Saved Challenge Mode run was unreadable. Started a new one." });
    expect(loadClassicGame().status).toBe("ok");
  });
  it("refuses to switch away from a run it cannot save unless told to discard it", () => {
    enter();
    for (let i = 0; i < 6; i++) useGame.getState().advance();
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === "nn.campaign.save.v1") throw Error("quota");
      original.call(this, key, value);
    });
    expect(useGame.getState().switchMode("classic")).toBe(false);
    expect(useGame.getState()).toMatchObject({ mode: "campaign", game: { campaign: { step: 6 } } });
    expect(useGame.getState().switchMode("classic", { discard: true })).toBe(true);
    expect(useGame.getState().mode).toBe("classic");
  });
  it("refuses to switch away from a run kept in memory beside a preserved save", () => {
    localStorage.setItem("nn.campaign.save.v1", "{"); useGame.getState().boot();
    expect(useGame.getState().switchMode("classic")).toBe(false);
    expect(localStorage.getItem("nn.campaign.save.v1")).toBe("{");
  });
  it("loads the other mode's saved run behind the title screen when asked not to start it", () => {
    enter(); useGame.getState().advance();
    const company = useGame.getState().game;
    useGame.getState().switchMode("classic");
    expect(useGame.getState().switchMode("campaign", { start: false })).toBe(true);
    expect(useGame.getState()).toMatchObject({ mode: "campaign", started: false, hasRun: true, game: company });
  });
  it("archives a company replaced from the home screen, but not a preserved unreadable save", () => {
    enter(); useGame.getState().advance();
    const runId = useGame.getState().game.campaign!.runId;
    useGame.getState().endSession();
    useGame.getState().newRun();
    const next = useGame.getState().game.campaign!.runId;
    expect(readAnalytics().filter(e => e.name === "run_reset")).toMatchObject([{ runId, payload: { previousRunId: runId, replacementRunId: next } }]);
    expect(readAnalytics()).toContainEqual(expect.objectContaining({ name: "run_evidence", runId }));
    expect(readAnalytics()).toContainEqual(expect.objectContaining({ name: "replay_started", runId: next }));
    localStorage.clear(); useGame.setState(useGame.getInitialState(), true);
    localStorage.setItem("nn.campaign.save.v1", "{"); useGame.getState().boot();
    useGame.getState().newRun();
    expect(readAnalytics().some(e => e.name === "run_reset")).toBe(false);
  });
  it("says whether it replaced the company, so a refused replacement can be asked again", () => {
    enter();
    const runId = useGame.getState().game.campaign!.runId;
    useGame.setState({ cloudBusy: true });
    expect(useGame.getState().newRun()).toBe(false);
    expect(useGame.getState().game.campaign!.runId).toBe(runId);
    useGame.setState({ cloudBusy: false });
    expect(useGame.getState().newRun()).toBe(true);
    expect(useGame.getState().game.campaign!.runId).not.toBe(runId);
  });
  it("clears the previous mode's toast", () => {
    useGame.getState().boot(); useGame.getState().notify("Campaign news");
    useGame.getState().switchMode("classic");
    expect(useGame.getState().toast).toBeNull();
  });
});


it("persists fractional credit when the menu pauses, then resumes identically after reload", () => {
  enter(); useGame.getState().setRunning(true);
  useGame.getState().tick(.4); useGame.getState().openView("menu");
  expect(loadGame()).toMatchObject({ status: "ok", remainderMs: 400 });
  useGame.setState(useGame.getInitialState(), true); useGame.getState().boot();
  expect(useGame.getState()).toMatchObject({ running: false, remainderMs: 400 });
  useGame.getState().play(); useGame.getState().setRunning(true); useGame.getState().tick(.6);
  expect(useGame.getState().game.campaign!.step).toBe(1);
});

describe("old saves and imports across modes", () => {
  // These journeys import or resume Challenge Mode saves, which an already-unlocked profile allows.
  beforeEach(() => saveMeta({ ...DEFAULT_META, challengeUnlocked: true }));
  it("resumes a copy of an existing run and metadata, leaving every legacy key intact", () => {
    const game = JSON.parse(JSON.stringify(advanceTurn(newLegacyGame(777)))) as ReturnType<typeof newGame>;
    const originals = { "nn.save.v1": JSON.stringify({ game, savedAt: 1 }), "nn.meta.v1": JSON.stringify({ tutorialDone: true, music: false }), "nn.analytics.v1": "[legacy]" };
    for (const [key, value] of Object.entries(originals)) localStorage.setItem(key, value);
    enter(); useGame.getState().advance();
    const campaign = useGame.getState().game;
    expect(useGame.getState().resumeLegacySave()).toBe(true);
    expect(useGame.getState()).toMatchObject({ mode: "classic", game, running: false, meta: { tutorialDone: true }, audio: { muted: true } });
    useGame.getState().advance();
    const classic = useGame.getState().game;
    useGame.getState().switchMode("campaign"); expect(useGame.getState().game).toEqual(campaign);
    expect(useGame.getState().audio.muted).toBe(true);
    useGame.getState().switchMode("classic"); expect(useGame.getState().game).toEqual(classic);
    for (const [key, value] of Object.entries(originals)) expect(localStorage.getItem(key)).toBe(value);
  });
  it("keeps sound settings chosen since the update when resuming the pre-update save", () => {
    const game = JSON.parse(JSON.stringify(advanceTurn(newLegacyGame(777)))) as ReturnType<typeof newGame>;
    localStorage.setItem("nn.save.v1", JSON.stringify({ game, savedAt: 1 }));
    localStorage.setItem("nn.meta.v1", JSON.stringify({ tutorialDone: true, music: false }));
    useGame.getState().boot();
    useGame.getState().setAudio({ music: 0, muted: false });
    expect(useGame.getState().resumeLegacySave()).toBe(true);
    expect(useGame.getState().audio).toEqual({ music: 0, effects: 80, muted: false });
  });
  it("leaves a malformed legacy save available for export without replacing either run", () => {
    localStorage.setItem("nn.save.v1", "{"); useGame.getState().boot();
    const before = useGame.getState().game, stored = localStorage.getItem("nn.campaign.save.v1");
    expect(useGame.getState().resumeLegacySave()).toBe(false);
    expect(useGame.getState().game).toBe(before);
    expect(localStorage.getItem("nn.campaign.save.v1")).toBe(stored);
    expect(localStorage.getItem("nn.save.v1")).toBe("{");
  });
  it("imports files in their matching mode, preserving the other mode's progress", () => {
    enter(); useGame.getState().advance(); const campaign = useGame.getState().game;
    const classic = JSON.parse(JSON.stringify(advanceTurn(newLegacyGame(77)))) as ReturnType<typeof newGame>;
    expect(useGame.getState().importSave(JSON.stringify({ game: classic, savedAt: 1 }))).toBe(true);
    expect(useGame.getState()).toMatchObject({ mode: "classic", game: classic, tour: null, running: false });
    expect(loadGame()).toMatchObject({ status: "ok", game: campaign });
    const imported = newGame(5, "different-company");
    expect(useGame.getState().importSave(JSON.stringify(makeEnvelope(imported)))).toBe(true);
    expect(useGame.getState()).toMatchObject({ mode: "campaign", game: imported });
    expect(loadClassicGame()).toMatchObject({ status: "ok", game: classic });
    useGame.setState(useGame.getInitialState(), true); useGame.getState().boot();
    expect(useGame.getState()).toMatchObject({ mode: "campaign", game: imported, started: false });
  });
  it("refuses cross-mode import when the current run cannot be saved", () => {
    enter(); const before = useGame.getState().game;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("quota"); });
    expect(useGame.getState().importSave(JSON.stringify({ game: newLegacyGame() }))).toBe(false);
    expect(useGame.getState()).toMatchObject({ mode: "campaign", game: before });
  });
  it("rejects broken Classic files without changing mode or either slot", () => {
    useGame.getState().boot(); const before = useGame.getState().game;
    expect(useGame.getState().importSave(JSON.stringify({ game: { ...newLegacyGame(), tasks: [null] } }))).toBe(false);
    expect(useGame.getState()).toMatchObject({ mode: "campaign", game: before });
    expect(localStorage.getItem("nn.classic.save.v1")).toBeNull();
  });
  it("keeps the sound settings across mode switches and reloads", () => {
    useGame.getState().boot();
    useGame.getState().setAudio({ music: 35, effects: 60 }); useGame.getState().toggleMute();
    const settings = { music: 35, effects: 60, muted: true };
    useGame.getState().switchMode("classic"); expect(useGame.getState().audio).toEqual(settings);
    useGame.getState().switchMode("campaign"); expect(useGame.getState().audio).toEqual(settings);
    useGame.setState(useGame.getInitialState(), true); useGame.getState().boot();
    expect(useGame.getState().audio).toEqual(settings);
    useGame.getState().toggleMute(); expect(useGame.getState().audio).toEqual({ ...settings, muted: false });
  });
  it("keeps sound settings in memory when storage fails, through a mode switch", () => {
    useGame.getState().boot();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("quota"); });
    useGame.getState().setAudio({ effects: 20, muted: true });
    useGame.getState().switchMode("classic", { discard: true });
    expect(useGame.getState().audio).toMatchObject({ effects: 20, muted: true });
  });
  it("keeps the graphics quality across mode switches and reloads", () => {
    useGame.getState().boot();
    expect(useGame.getState().graphics).toEqual({ quality: "auto" });
    useGame.getState().setGraphics({ quality: "low" });
    useGame.getState().switchMode("classic"); expect(useGame.getState().graphics).toEqual({ quality: "low" });
    useGame.getState().switchMode("campaign"); expect(useGame.getState().graphics).toEqual({ quality: "low" });
    useGame.setState(useGame.getInitialState(), true); useGame.getState().boot();
    expect(useGame.getState().graphics).toEqual({ quality: "low" });
  });
  it("applies a graphics quality for this visit even when storage fails, and ignores an unknown one", () => {
    useGame.getState().boot();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("quota"); });
    useGame.getState().setGraphics({ quality: "medium" });
    expect(useGame.getState().graphics).toEqual({ quality: "medium" });
    const before = useGame.getState().graphics;
    useGame.getState().setGraphics({ quality: "ultra" as never });
    useGame.getState().setGraphics({});
    useGame.getState().setGraphics({ quality: "medium" });
    expect(useGame.getState().graphics).toBe(before);
  });
  it("toggles mute at the saved volumes, and only unmutes a channel that has volume", () => {
    useGame.getState().boot();
    useGame.getState().setAudio({ music: 0, effects: 60 });
    useGame.getState().toggleMute();
    expect(useGame.getState().audio).toEqual({ music: 0, effects: 60, muted: true });
    // Coming back leaves the music at the 0 the player chose.
    useGame.getState().toggleMute();
    expect(useGame.getState().audio).toEqual({ music: 0, effects: 60, muted: false });
  });
  it("brings the default volumes back when sound is turned on with both at 0, muted or not", () => {
    useGame.getState().boot();
    useGame.getState().setAudio({ music: 0, effects: 0 });
    expect(isSilent(useGame.getState().audio)).toBe(true);
    // Silent without the mute flag: one click must make sound, not just flip a flag nothing reads.
    useGame.getState().toggleMute();
    expect(useGame.getState().audio).toEqual(DEFAULT_AUDIO);
    expect(loadAudio()).toEqual(DEFAULT_AUDIO);
    useGame.getState().setAudio({ music: 0, effects: 0, muted: true });
    useGame.getState().toggleMute();
    expect(useGame.getState().audio).toEqual(DEFAULT_AUDIO);
  });
  it("clamps volumes to whole percents and ignores a change that changes nothing", () => {
    useGame.getState().boot();
    useGame.getState().setAudio({ music: 140, effects: -3 });
    expect(useGame.getState().audio).toMatchObject({ music: 100, effects: 0 });
    const before = useGame.getState().audio;
    useGame.getState().setAudio({ music: Number.NaN, effects: 0 });
    expect(useGame.getState().audio).toBe(before);
  });
});


it("imports a pre-update incident paused and preserves its recovery state", () => {
  saveMeta({ ...DEFAULT_META, challengeUnlocked: true });
  const game = JSON.parse(JSON.stringify(advanceTurn({ ...newLegacyGame(1), users: 4500 }))) as ReturnType<typeof newGame>;
  expect(game.phase).toBe("incident");
  const raw = JSON.stringify({ savedAt: 1, game });
  localStorage.setItem("nn.save.v1", raw); useGame.getState().boot();
  expect(useGame.getState().resumeLegacySave()).toBe(true);
  expect(useGame.getState()).toMatchObject({ mode: "classic", game, running: false });
  useGame.getState().tick(10); expect(useGame.getState().game).toEqual(game);
  useGame.getState().setRunning(true); useGame.getState().tick(.2);
  expect(useGame.getState().game.incident!.elapsed).toBeCloseTo(game.incident!.elapsed + .2);
  expect(localStorage.getItem("nn.save.v1")).toBe(raw);
});

describe("challenge mode lock", () => {
  const LOCKED = "Complete the first five Guided Mode chapters to unlock Challenge Mode.";
  it("forces a stale classic last-mode back to campaign while locked", () => {
    saveMode("classic");
    expect(loadMode()).toBe("campaign");
    useGame.getState().boot();
    expect(useGame.getState().mode).toBe("campaign");
    saveMeta({ ...DEFAULT_META, challengeUnlocked: true });
    expect(loadMode()).toBe("classic");
    useGame.setState(useGame.getInitialState(), true); useGame.getState().boot();
    expect(useGame.getState().mode).toBe("classic");
  });
  it("refuses switching to Challenge Mode before the first five chapters are complete", () => {
    enter(); useGame.getState().advance();
    const campaign = useGame.getState().game;
    expect(useGame.getState().switchMode("classic")).toBe(false);
    expect(useGame.getState()).toMatchObject({ mode: "campaign", game: campaign, started: true });
    expect(useGame.getState().toast?.text).toBe(LOCKED);
    expect(localStorage.getItem("nn.classic.save.v1")).toBeNull();
  });
  it("refuses a Classic import while locked, keeping both modes untouched", () => {
    enter(); const before = useGame.getState().game;
    expect(useGame.getState().importSave(JSON.stringify({ savedAt: 1, game: advanceTurn(newLegacyGame(5)) }))).toBe(false);
    expect(useGame.getState()).toMatchObject({ mode: "campaign", game: before });
    expect(useGame.getState().toast?.text).toBe(LOCKED);
    expect(localStorage.getItem("nn.classic.save.v1")).toBeNull();
  });
  it("unlocks Challenge Mode permanently when the reliability chapter is acknowledged", () => {
    let game = act(preparedReliability(), { type: "arm_reliability" });
    for (let i = 0; i < 60 && !pendingReliability(game.campaign); i++) {
      if (game.phase === "review") game = act(game, { type: "acknowledge_review" });
      game = tick(game);
    }
    expect(pendingReliability(game.campaign)).toBe(true);
    useGame.setState({ game, started: true, ready: true, hasRun: true, onboarding: false });
    expect(useGame.getState().act({ type: "acknowledge_reliability" })).toBe(true);
    expect(useGame.getState().meta.challengeUnlocked).toBe(true);
    expect(loadMeta().challengeUnlocked).toBe(true);
    // The unlock is durable: a later visit can play Challenge Mode right away.
    useGame.setState(useGame.getInitialState(), true); useGame.getState().boot();
    expect(useGame.getState().switchMode("classic")).toBe(true);
    expect(useGame.getState().mode).toBe("classic");
    useGame.getState().advance();
    const classic = useGame.getState().game;
    useGame.getState().switchMode("campaign");
    expect(useGame.getState().game.campaign!.reliabilityStage?.acknowledged).toBe(true);
    useGame.getState().switchMode("classic");
    expect(useGame.getState().game).toEqual(classic);
  });
  it("treats an older completed campaign save as unlocked even without the new metadata", () => {
    let game = act(preparedReliability(), { type: "arm_reliability" });
    for (let i = 0; i < 60 && !pendingReliability(game.campaign); i++) {
      if (game.phase === "review") game = act(game, { type: "acknowledge_review" });
      game = tick(game);
    }
    game = act(game, { type: "acknowledge_reliability" });
    expect(game.campaign!.reliabilityStage?.acknowledged).toBe(true);
    saveGame(game);
    saveMode("classic");
    expect(loadMeta().challengeUnlocked).toBe(false);
    expect(loadMode()).toBe("classic");
    useGame.getState().boot();
    expect(useGame.getState().mode).toBe("classic");
  });
  it("keeps an unlock that only the replaced company recorded when starting a new company", () => {
    let game = act(preparedReliability(), { type: "arm_reliability" });
    for (let i = 0; i < 60 && !pendingReliability(game.campaign); i++) {
      if (game.phase === "review") game = act(game, { type: "acknowledge_review" });
      game = tick(game);
    }
    saveGame(act(game, { type: "acknowledge_reliability" }));
    useGame.getState().boot();
    expect(useGame.getState().meta.challengeUnlocked).toBe(false);
    useGame.getState().newRun();
    expect(useGame.getState().game.campaign!.reliabilityStage).toBeFalsy();
    expect(loadMeta().challengeUnlocked).toBe(true);
    expect(useGame.getState().switchMode("classic")).toBe(true);
  });
});

describe("exploration state", () => {
  const seed = (mode: "campaign" | "classic", state: object) =>
    localStorage.setItem(`nn.${mode}.exploration.v1`, JSON.stringify({ version: 1, avatar: null, camera: null, ...state }));

  it("restores the floor at boot and walk mode on play", () => {
    seed("campaign", { floor: "office", walking: true });
    useGame.getState().boot();
    expect(useGame.getState()).toMatchObject({ floor: "office", walking: false, started: false });
    useGame.getState().play();
    expect(useGame.getState()).toMatchObject({ floor: "office", walking: true });
  });

  it("lets a ?floor= address win and stops walk mode resuming", () => {
    window.history.pushState({}, "", "/?floor=office");
    try {
      seed("campaign", { floor: "servers", walking: true });
      useGame.getState().boot();
      useGame.getState().play();
      expect(useGame.getState()).toMatchObject({ floor: "office", walking: false });
    } finally {
      window.history.pushState({}, "", "/");
    }
  });

  it("remembers each mode's floor and walk state separately", () => {
    saveMeta({ ...DEFAULT_META, challengeUnlocked: true });
    seed("campaign", { floor: "office", walking: true });
    seed("classic", { floor: "servers", walking: false });
    useGame.getState().boot();
    useGame.getState().play();
    expect(useGame.getState()).toMatchObject({ mode: "campaign", floor: "office", walking: true });
    expect(useGame.getState().switchMode("classic")).toBe(true);
    expect(useGame.getState()).toMatchObject({ mode: "classic", floor: "servers", walking: false });
    expect(useGame.getState().switchMode("campaign")).toBe(true);
    expect(useGame.getState()).toMatchObject({ mode: "campaign", floor: "office", walking: true });
  });

  it("keeps the remembered walk choice when the title screen ends the walk", () => {
    seed("campaign", { floor: "office", walking: true });
    enter();
    expect(useGame.getState().walking).toBe(true);
    useGame.getState().endSession();
    expect(useGame.getState().walking).toBe(false);
    // The session's end still sounds, but the player's choice to walk is not unmade.
    expect(useGame.getState().measurement.pending.some((e) => e.name === "walk_ended")).toBe(true);
    expect(JSON.parse(localStorage.getItem("nn.campaign.exploration.v1")!)).toMatchObject({ walking: true });
    useGame.getState().play();
    expect(useGame.getState().walking).toBe(true);
  });

  it("persists an explicit Walk or floor choice, without toasting on failure", () => {
    seed("campaign", { floor: "servers", walking: false });
    enter();
    useGame.getState().goToFloor("office", "menu");
    useGame.getState().setWalking(true);
    expect(JSON.parse(localStorage.getItem("nn.campaign.exploration.v1")!)).toMatchObject({ floor: "office", walking: true });
    useGame.getState().setWalking(false);
    expect(JSON.parse(localStorage.getItem("nn.campaign.exploration.v1")!)).toMatchObject({ walking: false });
    expect(useGame.getState().toast).toBeNull();
  });
});
