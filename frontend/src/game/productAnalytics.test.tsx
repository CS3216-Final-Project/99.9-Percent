import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { act as reactAct, cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "@/App";
import { useGame } from "./store";
import { newGame, newLegacyGame } from "@/sim";
import { DEFAULT_META, saveClassicGame, saveMeta, saveMode } from "./persist";
import { preparedReliability, act, tick } from "@/sim/__tests__/reliabilityFixture";
import { pendingReliability } from "@/sim/reliability";
import { ANALYTICS_STORAGE_KEY, HEARTBEAT_MS, IDLE_MS, watchProductAnalytics, type AnalyticsProperties } from "./productAnalytics";

vi.mock("@/components/scene/Facility", () => ({ default: () => null }));
let stop: () => void;
let events: { name: string; properties: AnalyticsProperties }[];
const named = (name: string) => events.filter(e => e.name === name);
function watch() {
  stop = watchProductAnalytics(useGame, (name, properties) => events.push({ name, properties }), "test-build");
}
function play() { useGame.getState().boot(); useGame.getState().play(); }
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  localStorage.clear();
  useGame.setState(useGame.getInitialState(), true);
  events = [];
  stop = () => {};
});
afterEach(() => { cleanup(); stop(); vi.restoreAllMocks(); vi.useRealTimers(); localStorage.clear(); });

it("counts actual Campaign play once under StrictMode, never the title screen", () => {
  watch();
  render(<StrictMode><App /></StrictMode>);
  reactAct(() => vi.advanceTimersByTime(HEARTBEAT_MS));
  expect(events).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Start Guided Mode" }));
  useGame.getState().play();
  expect(named("gameplay_run_started")).toHaveLength(1);
  expect(named("gameplay_session_started")).toHaveLength(1);
  expect(named("gameplay_chapter_started")[0].properties.chapter_id).toBe("opening");
  expect(named("gameplay_run_started")[0].properties).toMatchObject({
    mode: "campaign", build_id: "test-build", content_version: "chapters-v1", eligible_started_run: true,
  });
});

const tutorial = () => events.filter(e => e.name.startsWith("gameplay_tutorial_")).map(({ name, properties: p }) =>
  [name, p.tutorial_track, p.tutorial_step, p.tutorial_from ?? p.reason ?? null]);

it("reports Guided Mode's walkthrough starting, skipped at its step and finished once each, under StrictMode and across a reload", () => {
  watch();
  render(<StrictMode><App /></StrictMode>);
  fireEvent.click(screen.getByRole("button", { name: "Start Guided Mode" }));
  useGame.getState().play();
  reactAct(() => { useGame.getState().tourNext(); useGame.getState().tourNext(); useGame.getState().endTour(false); });
  reactAct(() => { useGame.getState().startTour("campaign", "home"); useGame.getState().endTour(true); });
  // A chapter's one-card guide is not the walkthrough.
  reactAct(() => { useGame.getState().startTour("scaling"); useGame.getState().endTour(true); });
  cleanup(); stop();
  useGame.setState(useGame.getInitialState(), true);
  watch(); play();
  expect(tutorial()).toEqual([
    ["gameplay_tutorial_started", "campaign", 0, "first_visit"],
    ["gameplay_tutorial_skipped", "campaign", 2, "player"],
    ["gameplay_tutorial_started", "campaign", 0, "home"],
    ["gameplay_tutorial_completed", "campaign", 0, null],
  ]);
  expect(named("gameplay_tutorial_started")[0].properties).toMatchObject({ mode: "campaign", chapter_id: "opening", progress_step: 0 });
});

it("reports Challenge Mode's walkthrough, offered behind the title screen, once play begins", () => {
  saveMeta({ ...DEFAULT_META, challengeUnlocked: true });
  saveMode("classic"); watch();
  useGame.getState().boot();
  expect(tutorial()).toEqual([]);
  useGame.getState().play();
  useGame.getState().endTour(false);
  expect(tutorial()).toEqual([
    ["gameplay_tutorial_started", "basics", 0, "first_visit"],
    ["gameplay_tutorial_skipped", "basics", 0, "player"],
  ]);
  expect(named("gameplay_tutorial_started")[0].properties.mode).toBe("classic");
});

it("does not report a walkthrough already under way when it starts observing, only how it ends", () => {
  play(); watch();
  useGame.getState().endTour(true);
  expect(tutorial()).toEqual([["gameplay_tutorial_completed", "campaign", 0, null]]);
});

it("includes paused planning time, caps idle time, and resumes timing on input", () => {
  watch(); play();
  expect(useGame.getState().running).toBe(false);
  vi.advanceTimersByTime(HEARTBEAT_MS);
  expect(named("gameplay_session_progress").at(-1)?.properties.session_active_ms).toBe(HEARTBEAT_MS);
  vi.advanceTimersByTime(IDLE_MS * 2);
  expect(named("gameplay_session_progress").at(-1)?.properties.session_active_ms).toBe(IDLE_MS);
  window.dispatchEvent(new Event("pointerdown"));
  vi.advanceTimersByTime(HEARTBEAT_MS);
  expect(named("gameplay_session_progress").at(-1)?.properties.session_active_ms).toBe(IDLE_MS + HEARTBEAT_MS);
  expect(useGame.getState().game.campaign!.step).toBe(0);
});

it("excludes hidden time, checkpoints on hiding and closes a session only once", () => {
  watch(); play();
  vi.advanceTimersByTime(5000);
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  document.dispatchEvent(new Event("visibilitychange"));
  expect(named("gameplay_session_progress").at(-1)?.properties.session_active_ms).toBe(5000);
  vi.advanceTimersByTime(60_000);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  document.dispatchEvent(new Event("visibilitychange"));
  vi.advanceTimersByTime(5000);
  window.dispatchEvent(new Event("pagehide"));
  window.dispatchEvent(new Event("pagehide"));
  expect(named("gameplay_session_ended")).toHaveLength(1);
  expect(named("gameplay_session_ended")[0].properties.session_active_ms).toBe(10_000);
  stop(); stop();
  vi.advanceTimersByTime(60_000);
  expect(named("gameplay_session_ended")).toHaveLength(1);
});

it("keeps the run ID and total across reload but starts a new gameplay session", () => {
  watch(); play();
  vi.advanceTimersByTime(HEARTBEAT_MS);
  const first = named("gameplay_run_started")[0].properties;
  stop();
  useGame.setState(useGame.getInitialState(), true);
  watch(); play();
  expect(named("gameplay_run_started")).toHaveLength(1);
  const resumed = named("gameplay_run_resumed").at(-1)!.properties;
  expect(resumed.run_id).toBe(first.run_id);
  expect(resumed.gameplay_session_id).not.toBe(first.gameplay_session_id);
  expect(resumed.run_active_ms).toBe(HEARTBEAT_MS);
  expect(resumed.session_active_ms).toBe(0);
});

it("gives Classic stable run identity across reloads and distinct IDs for replays", () => {
  saveMeta({ ...DEFAULT_META, challengeUnlocked: true });
  saveMode("classic"); watch(); play();
  const first = named("gameplay_run_started")[0].properties.run_id;
  stop(); useGame.setState(useGame.getInitialState(), true); watch(); play();
  expect(named("gameplay_run_started")).toHaveLength(1);
  expect(named("gameplay_run_resumed").at(-1)?.properties.run_id).toBe(first);
  useGame.getState().newRun({ seed: 3 });
  expect(named("gameplay_run_started")).toHaveLength(2);
  expect(named("gameplay_run_started").at(-1)?.properties.run_id).not.toBe(first);
});

it("tracks the end of Classic independently from Campaign chapters and marks a subsequent replay", () => {
  saveMeta({ ...DEFAULT_META, challengeUnlocked: true });
  saveMode("classic"); watch(); play();
  const game = { ...useGame.getState().game, outcome: "won" as const, phase: "ended" as const };
  useGame.setState({ game });
  useGame.setState({ game: { ...game } });
  expect(named("gameplay_run_completed")).toHaveLength(1);
  expect(named("gameplay_run_completed")[0].properties.mode).toBe("classic");
  useGame.getState().newRun({ seed: 2 });
  expect(named("gameplay_run_started").at(-1)?.properties.replay).toBe(true);
});

function pendingFinalChapter() {
  let game = act(preparedReliability(), { type: "arm_reliability" });
  for (let i = 0; i < 60 && !pendingReliability(game.campaign); i++) {
    if (game.phase === "review") game = act(game, { type: "acknowledge_review" });
    game = tick(game);
  }
  expect(pendingReliability(game.campaign)).toBe(true);
  return game;
}
it("completes Campaign only when all chapters are completed, once per run", () => {
  const game = pendingFinalChapter();
  watch();
  useGame.setState({ game, started: true, ready: true, hasRun: true, onboarding: false });
  expect(named("gameplay_run_completed")).toHaveLength(0);
  expect(useGame.getState().act({ type: "acknowledge_reliability" })).toBe(true);
  expect(named("gameplay_chapter_completed").map(e => e.properties.chapter_id)).toEqual(["reliability"]);
  expect(named("gameplay_run_completed")).toHaveLength(1);
  useGame.getState().saveNow(true);
  useGame.setState({ game: { ...useGame.getState().game } });
  expect(named("gameplay_run_completed")).toHaveLength(1);
});

it("does not mistake a partial or imported completed Campaign for a new completion", () => {
  const game = act(pendingFinalChapter(), { type: "acknowledge_reliability" });
  watch();
  useGame.setState({ game, started: true, ready: true, hasRun: true });
  expect(named("gameplay_run_completed")).toHaveLength(0);
  expect(named("gameplay_chapter_completed")).toHaveLength(0);
  expect(named("gameplay_run_resumed")[0].properties.eligible_started_run).toBe(false);
  useGame.getState().newRun({ seed: 1 });
  const partial = structuredClone(game);
  partial.campaign!.runId = useGame.getState().game.campaign!.runId;
  partial.campaign!.spikeStage!.acknowledged = false;
  useGame.setState({ game: partial });
  expect(named("gameplay_run_completed")).toHaveLength(0);
});

it("records chapter progress and a failure once with the last reached chapter", () => {
  watch(); play();
  const next = structuredClone(useGame.getState().game);
  next.campaign!.openingMilestone = { ...next.campaign!.openingMilestone!, acknowledged: true };
  useGame.setState({ game: next });
  expect(named("gameplay_chapter_completed").map(e => e.properties.chapter_id)).toEqual(["opening"]);
  useGame.setState({ game: { ...next, phase: "ended", outcome: "bankrupt" } });
  useGame.setState({ game: { ...useGame.getState().game } });
  expect(named("gameplay_run_failed")).toHaveLength(1);
  expect(named("gameplay_run_failed")[0].properties.chapter_id).toBe("opening");
});

it("restarts a session on back/forward cache restoration without starting another run", () => {
  watch(); play();
  window.dispatchEvent(new Event("pagehide"));
  window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  expect(named("gameplay_session_started")).toHaveLength(2);
  expect(named("gameplay_run_started")).toHaveLength(1);
});

it("handles switching modes and keeps Classic imports out of the new-run cohort", () => {
  saveMeta({ ...DEFAULT_META, challengeUnlocked: true });
  watch(); play();
  useGame.getState().switchMode("classic");
  expect(named("gameplay_session_ended")[0].properties.mode).toBe("campaign");
  expect(named("gameplay_session_started").at(-1)?.properties.mode).toBe("classic");
  const oldId = named("gameplay_run_started").at(-1)?.properties.run_id;
  useGame.getState().switchMode('campaign');
  useGame.getState().switchMode('classic');
  expect(named('gameplay_run_resumed').at(-1)?.properties.run_id).toBe(oldId);
  const imported = { ...newLegacyGame(1), turn: 3 };
  expect(useGame.getState().importSave(JSON.stringify({ savedAt: 1, game: imported }))).toBe(true);
  const resumed = named("gameplay_run_resumed").at(-1)!.properties;
  expect(resumed.run_id).not.toBe(oldId);
  expect(resumed.eligible_started_run).toBe(false);
});

it("does not replay milestones from an existing save or leak saves and observer notes", () => {
  const game = preparedReliability();
  watch();
  useGame.setState({ game, started: true, ready: true, hasRun: true });
  useGame.getState().observer("recruited", "private participant note");
  expect(named("gameplay_chapter_completed")).toHaveLength(0);
  expect(JSON.stringify(events)).not.toContain("private participant note");
  expect(JSON.stringify(events)).not.toContain('"campaign":');
});

it("ignores malformed analytics storage, storage failures and a throwing collector", () => {
  localStorage.setItem(ANALYTICS_STORAGE_KEY, '{"runs":{"bad":{"activeMs":-1}}}');
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("quota"); });
  stop = watchProductAnalytics(useGame, () => { throw Error("collector blocked"); }, "test");
  expect(() => play()).not.toThrow();
  
  expect(() => useGame.getState().advance()).not.toThrow();
  expect(useGame.getState().game.campaign!.step).toBe(1);
  expect(() => stop()).not.toThrow();
});

it("does not treat opening a previously finished Classic save as a completion", () => {
  saveMeta({ ...DEFAULT_META, challengeUnlocked: true });
  saveMode("classic");
  saveClassicGame({ ...newLegacyGame(2), outcome: "won", phase: "ended" });
  saveMeta({ ...DEFAULT_META, runsStarted: 1 }, "classic");
  watch(); play();
  expect(named("gameplay_run_completed")).toHaveLength(0);
  expect(named("gameplay_run_started")).toHaveLength(0);
});

it("does not touch a game save when analytics storage is unavailable", () => {
  const game = newGame();
  const original = JSON.stringify(game);
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw Error("blocked"); });
  watch();
  useGame.setState({ game, started: true });
  vi.advanceTimersByTime(HEARTBEAT_MS);
  expect(JSON.stringify(game)).toBe(original);
  expect(named("gameplay_session_started")).toHaveLength(1);
});
