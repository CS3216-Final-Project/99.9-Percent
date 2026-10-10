import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { newGame, newLegacyGame, advanceTurn } from "../sim";
import { advanceSteps } from "../sim/step";
import { loadClassicGame, loadGame, saveGame, readAnalytics } from "./persist";
import { makeEnvelope } from "./saveEnvelope";
import { useGame } from "./store";
beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(() => vi.restoreAllMocks());
function enter() {
  useGame.getState().boot(); useGame.getState().play();
  if (useGame.getState().onboarding) useGame.getState().onboardingMove("skip");
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
    useGame.getState().openView("tech"); expect(useGame.getState().view).toBe("history");
    useGame.getState().openView("menu"); expect(useGame.getState().running).toBe(false);
  });
});


it("reports quota failures on entry and reset while allowing in-memory play",()=>{
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
    expect(useGame.getState().toast).toMatchObject({ kind: "error", text: "Saved classic run was unreadable. Started a new one." });
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
