import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { advanceTurn, applyAction, incidentTick, newGame, newLegacyGame, type Action, type ActionAttempt, type GameState } from "../sim";
import { advanceSteps, applyCampaignInput } from "../sim/step";
import { dataCompany } from "../sim/__tests__/dataFixture";
import { cuesBetween, CUE_PRIORITY, topCue, watchCues, type CueState } from "./cues";
import { DEFAULT_AUDIO, saveClassicGame, saveGame, saveMeta, saveMode, DEFAULT_META } from "./persist";
import { makeEnvelope } from "./saveEnvelope";
import { CUE_NAMES, type Cue } from "./sfx";
import { useGame } from "./store";

const state = (game: GameState, over: Partial<CueState> = {}): CueState => ({
  game,
  generation: 1,
  lastAction: null,
  toast: null,
  started: true,
  audio: { ...DEFAULT_AUDIO },
  ...over,
});
const between = (a: GameState, b: GameState) => cuesBetween(state(a), state(b));
const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function must(s: GameState, action: Action): GameState {
  const r = applyAction(s, action);
  if (!r.ok) throw new Error(r.message);
  return r.state;
}

/** Tick a classic incident until `done`, returning the last step's before and after. */
function tickUntil(s: GameState, done: (prev: GameState, next: GameState) => boolean): [GameState, GameState] {
  for (let i = 0; i < 500; i++) {
    const next = incidentTick(s, 1);
    if (done(s, next)) return [s, next];
    s = next;
  }
  throw new Error("never happened");
}

const overload = () => advanceTurn({ ...copy(newLegacyGame(1)), users: 4500 });

describe("classic cues", () => {
  it("sounds the alarm when an incident opens", () => {
    const calm = { ...copy(newLegacyGame(1)), users: 4500 };
    expect(between(calm, advanceTurn(calm))).toEqual(["alarm"]);
  });

  it("chimes when the right fix ends an incident, and stings when it fails", () => {
    const fixing = must(incidentTick(overload(), 10), { type: "incident_action", recovery: "scale_out" });
    const [before, fixed] = tickUntil(fixing, (_, next) => next.phase !== "incident");
    expect(fixed.phase).toBe("review");
    expect(between(before, fixed)).toEqual(["relief"]);
    const [late, failed] = tickUntil(overload(), (_, next) => next.phase !== "incident");
    expect(failed.postmortems.at(-1)?.outcome).toBe("failed");
    expect(between(late, failed)).toEqual(["review"]);
  });

  it("blips for new evidence and tells a recovery that worked from one that did not", () => {
    const inspecting = must(overload(), { type: "incident_inspect", equipment: "app" });
    const [a, b] = tickUntil(inspecting, (prev, next) => (next.incident?.evidence.length ?? 0) > (prev.incident?.evidence.length ?? 0));
    expect(between(a, b)).toEqual(["blip"]);
    const wrong = must(incidentTick(overload(), 10), { type: "incident_action", recovery: "db_upgrade" });
    const [c, d] = tickUntil(wrong, (prev, next) => (next.incident?.attempts.length ?? 0) > (prev.incident?.attempts.length ?? 0));
    expect(d.incident?.attempts.at(-1)?.outcome).toBe("no_effect");
    expect(between(c, d)).toEqual(["failure"]);
    const worked = copy(c);
    worked.incident!.attempts.push({ ...(d.incident!.attempts.at(-1) as ActionAttempt), outcome: "mitigated" });
    expect(between(c, worked)).toEqual(["success"]);
  });

  it("plays the week's takings, up or down", () => {
    const start = newLegacyGame(1);
    const week = advanceTurn(start);
    expect(week.phase).toBe("management");
    expect(between(start, week)).toEqual([week.lastReport!.net >= 0 ? "weekUp" : "weekDown"]);
    const loss = copy(week);
    loss.lastReport!.net = -500;
    expect(between(start, loss)).toEqual(["weekDown"]);
    // A clone of the same week is not a new week.
    expect(between(week, copy(week))).toEqual([]);
  });

  it("unlocks when engineering finishes a release, but not for one sent back for a fix", () => {
    const a = newLegacyGame(1);
    const built = copy(a);
    built.releases.push({ id: "rel-1", title: "Load balancing", kind: "tech", techId: "load_balancing", size: 2, tested: false, needsFix: false, readyTurn: 1 });
    expect(between(a, built)).toEqual(["unlock"]);
    const broken = copy(a);
    broken.releases.push({ ...built.releases[0], needsFix: true });
    expect(between(a, broken)).toEqual([]);
  });

  it("marks the end of a run, won or lost", () => {
    const a = newLegacyGame(1);
    expect(between(a, { ...copy(a), outcome: "won" })).toEqual(["won"]);
    expect(between(a, { ...copy(a), outcome: "bankrupt" })).toEqual(["lost"]);
  });
});

describe("campaign cues", () => {
  const opening = newGame(1, "cues");
  it("sounds the alarm at the opening incident, unlocks the upgrade and chimes on recovery", () => {
    const before = advanceSteps(opening, 5).state;
    const open = advanceSteps(before, 1).state;
    expect(open.phase).toBe("incident");
    expect(between(before, open)).toEqual(["alarm"]);
    let s = applyCampaignInput(open, { type: "start_db_upgrade" }).state;
    const heard: Cue[] = [];
    for (let i = 0; i < 40 && s.phase === "incident"; i++) {
      const next = advanceSteps(s, 1).state;
      heard.push(...between(s, next));
      s = next;
    }
    expect(s.phase).toBe("review");
    expect(heard).toEqual(["unlock", "relief"]);
  });

  it("confirms a server coming online and plays each settlement", () => {
    let s = applyCampaignInput(opening, { type: "add_server" }).state;
    const heard: Cue[] = [];
    for (let i = 0; i < 70; i++) {
      if (s.phase === "incident" || s.phase === "review") s = applyCampaignInput(s, { type: "acknowledge_review" }).state;
      const next = advanceSteps(s, 1).state;
      heard.push(...between(s, next).filter((c) => c !== "alarm" && c !== "relief"));
      s = next;
    }
    expect(heard).toContain("confirm");
    expect(heard.filter((c) => c === "weekUp" || c === "weekDown")).toHaveLength(1);
    expect(between(s, { ...copy(s), phase: "ended" })).toEqual(["lost"]);
  });
});

describe("campaign scaling cues", () => {
  /** Through the opening incident and milestone, where scaling up and load balancing open. */
  function scalingReady(): GameState {
    let s = advanceSteps(newGame(3, "scaling-cues"), 6).state;
    s = applyCampaignInput(s, { type: "start_db_upgrade" }).state;
    s = advanceSteps(s, 30).state;
    s = applyCampaignInput(s, { type: "acknowledge_review" }).state;
    return applyCampaignInput(s, { type: "acknowledge_milestone" }).state;
  }
  /** Step until nothing is pending, collecting what is heard. */
  function settle(s: GameState): [GameState, Cue[]] {
    const heard: Cue[] = [];
    for (let i = 0; i < 20 && s.campaign!.pending.length > 0; i++) {
      const next = advanceSteps(s, 1).state;
      heard.push(...between(s, next));
      s = next;
    }
    return [s, heard];
  }
  it("unlocks when a scale-up or the load balancer comes online", () => {
    const scaled = applyCampaignInput(scalingReady(), { type: "scale_up", appId: "app-1" });
    expect(scaled.result.ok).toBe(true);
    const [afterScale, heardScale] = settle(scaled.state);
    expect(heardScale).toContain("unlock");
    const balanced = applyCampaignInput(afterScale, { type: "deploy_load_balancer" });
    expect(balanced.result.ok).toBe(true);
    const [, heardLb] = settle(balanced.state);
    expect(heardLb).toContain("unlock");
  });
  it("unlocks when the read cache comes online", () => {
    const cached = applyCampaignInput(dataCompany(), { type: "deploy_cache" });
    expect(cached.result.ok).toBe(true);
    const [, heard] = settle(cached.state);
    expect(heard).toContain("unlock");
  });
});

describe("cues from the player and the settings", () => {
  const game = newLegacyGame(1);
  it("give each accepted decision its sound and buzz a rejected one", () => {
    const decided = (type: Action["type"], ok = true) => cuesBetween(state(game), state(game, { lastAction: { id: 1, type, ok } }));
    expect(decided("add_server")).toEqual(["clunk"]);
    expect(decided("replace_host")).toEqual(["clunk"]);
    expect(decided("hire_engineer")).toEqual(["hire"]);
    expect(decided("launch_promotion")).toEqual(["promo"]);
    expect(decided("deploy_release")).toEqual(["confirm"]);
    expect(decided("scale_up")).toEqual(["clunk"]);
    expect(decided("deploy_load_balancer")).toEqual(["clunk"]);
    expect(decided("set_routing")).toEqual(["confirm"]);
    expect(decided("deploy_cache")).toEqual(["clunk"]);
    expect(decided("tune_cache")).toEqual(["confirm"]);
    expect(decided("incident_action")).toEqual(["blip"]);
    expect(decided("acknowledge_review")).toEqual([]);
    expect(decided("add_server", false)).toEqual(["buzz"]);
    expect(cuesBetween(state(game), state(game, { toast: { id: 1, text: "No", kind: "error" } }))).toEqual(["buzz"]);
    expect(cuesBetween(state(game), state(game, { toast: { id: 1, text: "Saved", kind: "success" } }))).toEqual([]);
  });

  it("say nothing for a replaced game or behind the title screen", () => {
    const incident = overload();
    expect(cuesBetween(state(game), state(incident, { generation: 2 }))).toEqual([]);
    expect(cuesBetween(state(game, { started: false }), state(incident, { started: false }))).toEqual([]);
    expect(cuesBetween(state(game, { started: false }), state(incident))).toEqual([]);
  });

  it("play a sample when the effects volume moves or sound comes back, even after a load", () => {
    const at = (audio: Partial<CueState["audio"]>, over: Partial<CueState> = {}) => state(game, { audio: { ...DEFAULT_AUDIO, ...audio }, ...over });
    expect(cuesBetween(at({}), at({ effects: 40 }))).toEqual(["preview"]);
    expect(cuesBetween(at({ muted: true }), at({ muted: false }))).toEqual(["preview"]);
    expect(cuesBetween(at({}), at({ muted: true }))).toEqual([]);
    expect(cuesBetween(at({}), at({ music: 20 }))).toEqual([]);
    expect(cuesBetween(at({}), at({ effects: 10 }, { generation: 5 }))).toEqual(["preview"]);
  });

  it("rank every cue, so a burst keeps its most important sound", () => {
    expect([...CUE_PRIORITY].sort()).toEqual([...CUE_NAMES].sort());
    expect(topCue(["blip", "weekUp", "alarm", "clunk"])).toBe("alarm");
    expect(topCue(["relief", "won"])).toBe("won");
    expect(topCue([])).toBeNull();
  });
});

describe("watching the store", () => {
  const heard: Cue[] = [];
  let stop = () => {};
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  beforeEach(() => {
    localStorage.clear();
    useGame.setState(useGame.getInitialState(), true);
    heard.length = 0;
    stop = watchCues(useGame.subscribe, (cue) => heard.push(cue));
  });
  afterEach(() => {
    stop();
    vi.restoreAllMocks();
  });

  it("stays quiet through boot, loading, importing, new runs and mode switches", async () => {
    // A saved campaign that is mid-incident, a classic run mid-incident and a pre-update save with music off.
    saveGame(advanceSteps(newGame(1, "saved"), 6).state);
    saveMeta({ ...DEFAULT_META, tutorialDone: true, incidentGuideDone: true }, "classic");
    const classic = copy(overload());
    saveClassicGame(classic);
    localStorage.setItem("nn.save.v1", JSON.stringify({ savedAt: 1, game: copy(advanceTurn(newLegacyGame(7))) }));
    localStorage.setItem("nn.meta.v1", JSON.stringify({ tutorialDone: true, music: false }));
    const s = () => useGame.getState();
    s().boot();
    s().play();
    await settle();
    expect(s().game.phase).toBe("incident");
    // Each load below lands on a state that would sound if it had been played into.
    s().newRun({ seed: 3 });
    await settle();
    s().switchMode("classic");
    await settle();
    expect(s().game.phase).toBe("incident");
    s().switchMode("campaign");
    await settle();
    s().newRun({ seed: 4 });
    await settle();
    expect(s().importSave(JSON.stringify(makeEnvelope(advanceSteps(newGame(2, "imported"), 6).state)))).toBe(true);
    await settle();
    expect(s().importSave(JSON.stringify({ savedAt: 1, game: classic }))).toBe(true);
    await settle();
    s().newRun({ seed: 5 });
    await settle();
    expect(s().resumeLegacySave()).toBe(true);
    await settle();
    expect(s().audio.muted).toBe(true);
    expect(heard).toEqual([]);
  });

  it("plays one cue for a burst of steps, and one buzz for a rejected decision", async () => {
    const s = () => useGame.getState();
    s().boot();
    s().play();
    // In the game a click starts play, well after boot: anything in the same task as a load is dropped.
    await settle();
    s().onboardingMove("skip");
    s().setRunning(true);
    s().tick(30);
    await settle();
    expect(s().game.phase).toBe("incident");
    expect(heard).toEqual(["alarm"]);
    expect(s().act({ type: "acknowledge_review" })).toBe(false);
    await settle();
    expect(heard).toEqual(["alarm", "buzz"]);
    expect(s().act({ type: "add_server" })).toBe(true);
    await settle();
    expect(heard).toEqual(["alarm", "buzz", "clunk"]);
  });

  it("buzzes once for a save that keeps failing, not on every step", async () => {
    const s = () => useGame.getState();
    s().boot();
    s().play();
    await settle();
    s().onboardingMove("skip");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("quota"); });
    s().setRunning(true);
    for (let i = 0; i < 3; i++) {
      s().tick(1);
      await settle();
    }
    expect(s().game.campaign!.step).toBe(3);
    expect(s().toast?.kind).toBe("error");
    expect(heard).toEqual(["buzz"]);
  });

  it("plays the classic decisions and the slider sample, and stops when asked", async () => {
    saveMode("classic");
    saveMeta({ ...DEFAULT_META, tutorialDone: true }, "classic");
    const s = () => useGame.getState();
    s().boot();
    s().play();
    await settle();
    expect(s().act({ type: "hire_engineer" })).toBe(true);
    await settle();
    s().setAudio({ effects: 40 });
    await settle();
    expect(heard).toEqual(["hire", "preview"]);
    stop();
    s().act({ type: "add_server" });
    await settle();
    expect(heard).toEqual(["hire", "preview"]);
  });
});
