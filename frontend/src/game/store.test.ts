import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { newGame } from "../sim";
import { advanceSteps } from "../sim/step";
import { loadClassicGame, loadGame, saveGame, readAnalytics } from "./persist";
import { makeEnvelope } from "./saveEnvelope";
import { useGame } from "./store";
beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(() => vi.restoreAllMocks());
describe("shared campaign runtime", () => {
  it("boots once", () => {
    useGame.getState().boot(); const s = useGame.getState(); s.boot();
    expect(useGame.getState()).toBe(s); expect(readAnalytics().filter(e => e.name === "run_started")).toHaveLength(1);
    expect(s.running).toBe(false);
  });
  it("protects corrupt saves from boot and autosave, with explicit reset", () => {
    localStorage.setItem("nn.campaign.save.v1", "{"); useGame.getState().boot();
    useGame.getState().advance(); useGame.getState().saveNow();
    expect(localStorage.getItem("nn.campaign.save.v1")).toBe("{");
    useGame.getState().newRun({ seed: 1 }); expect(loadGame().status).toBe("ok");
  });
  it("uses same fixed steps at every speed, retains fractional pause credit", () => {
    useGame.getState().boot(); useGame.getState().setRunning(true);
    useGame.getState().tick(.4); expect(useGame.getState().remainderMs).toBe(400);
    useGame.getState().setRunning(false); useGame.getState().tick(20);
    expect(useGame.getState().remainderMs).toBe(400);
    useGame.getState().setRunning(true); useGame.getState().setSpeed(2); useGame.getState().tick(.3);
    expect(useGame.getState().game.campaign!.step).toBe(1);
  });
  it("stops batch at first incident and drops whole-step credit", () => {
    useGame.getState().boot(); useGame.getState().setRunning(true); useGame.getState().tick(20.2);
    expect(useGame.getState()).toMatchObject({ running: false, remainderMs: 200 });
    expect(useGame.getState().game.campaign!.step).toBe(6);
    useGame.getState().setRunning(true); useGame.getState().tick(.8); expect(useGame.getState().game.campaign!.step).toBe(7);
  });
  it("resumes incident paused, preserves timer remainder and action schedule", () => {
    saveGame(advanceSteps(newGame(), 6).state, 300); useGame.getState().boot();
    expect(useGame.getState().running).toBe(false); expect(useGame.getState().remainderMs).toBe(300);
    useGame.getState().act({ type: "start_db_upgrade" }); useGame.getState().setRunning(true);
    useGame.getState().tick(30); expect(useGame.getState().game.phase).toBe("review"); expect(useGame.getState().running).toBe(false);
    const before = useGame.getState().game.campaign!;
    useGame.getState().act({ type: "acknowledge_review" });
    expect(useGame.getState().game.campaign!.cashCents).toBe(before.cashCents);
    expect(useGame.getState().game.campaign!.step).toBe(before.step);
  });
  it("menu pauses, history does not, and later views are inaccessible", () => {
    useGame.getState().boot(); useGame.getState().setRunning(true);
    useGame.getState().openView("history"); expect(useGame.getState().running).toBe(true);
    useGame.getState().openView("tech"); expect(useGame.getState().view).toBe("history");
    useGame.getState().openView("menu"); expect(useGame.getState().running).toBe(false);
  });
});


it("reports quota failures on boot and reset while allowing in-memory play",()=>{
  vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw Error("quota");});
  useGame.getState().boot();
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
    const future = { ...makeEnvelope(newGame()), schemaVersion: 2 };
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
  useGame.getState().boot(); useGame.getState().setRunning(true); useGame.getState().tick(6);
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
    useGame.getState().boot(); useGame.getState().advance(); useGame.getState().advance();
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
    useGame.getState().boot(); useGame.getState().advance();
    const campaign = localStorage.getItem("nn.campaign.save.v1");
    useGame.getState().switchMode("classic"); useGame.getState().newRun({ seed: 7 });
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
    useGame.getState().boot();
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
