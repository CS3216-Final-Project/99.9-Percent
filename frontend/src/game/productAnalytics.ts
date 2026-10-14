import type { useGame } from "./store";
import { campaignChapters } from "./campaignChapters";

type State = ReturnType<typeof useGame.getState>;
type GameStore = Pick<typeof useGame, "getState" | "subscribe">;
export type AnalyticsProperties = Record<string, string | number | boolean | null>;
export type AnalyticsSink = (name: string, properties: AnalyticsProperties) => void;
export const ANALYTICS_STORAGE_KEY = "nn.product-analytics.v1";
export const CAMPAIGN_CONTENT_VERSION = "chapters-v1";
export const HEARTBEAT_MS = 15_000;
export const IDLE_MS = 120_000;

interface RunRecord {
  id: string;
  activeMs: number;
  started: boolean;
  terminal: "completed" | "failed" | null;
  chapters: string[];
  entered: string[];
}
interface Ledger { runs: Record<string, RunRecord>; }
interface ActiveSession {
  id: string;
  run: RunRecord;
  reportedMs: number;
  activeMs: number;
  state: State;
}
const CHAPTER_IDS = ["opening", "scaling", "data", "spikes", "reliability"];
const currentChapter = (state: State): string | null => {
  const c = state.game.campaign;
  return c ? c.reliabilityStage ? "reliability" : c.spikeStage ? "spikes" : c.dataStage ? "data" : c.scaling ? "scaling" : "opening" : null;
};
const completedChapters = (state: State) => state.game.campaign
  ? campaignChapters(state.game).filter(chapter => chapter.completed).map(chapter => chapter.id) : [];
const runKey = (state: State) => state.game.campaign
  ? `campaign:${state.game.campaign.runId}:${CAMPAIGN_CONTENT_VERSION}`
  : `classic:${state.game.seed}:${state.meta.runsStarted}`;

function readLedger(): Ledger {
  try {
    const value = JSON.parse(localStorage.getItem(ANALYTICS_STORAGE_KEY) ?? "null");
    if (!value || !value.runs || typeof value.runs !== "object" || Array.isArray(value.runs)) return { runs: {} };
    const runs: Record<string, RunRecord> = {};
    for (const [key, record] of Object.entries(value.runs).slice(-100)) {
      const r = record as RunRecord;
      if (!r || typeof r.id !== "string" || !Number.isFinite(r.activeMs) || r.activeMs < 0 ||
        typeof r.started !== "boolean" || ![null, "completed", "failed"].includes(r.terminal) ||
        !Array.isArray(r.chapters) || !r.chapters.every(id => CHAPTER_IDS.includes(id)) ||
        !Array.isArray(r.entered) || !r.entered.every(id => CHAPTER_IDS.includes(id))) continue;
      runs[key] = r;
    }
    return { runs };
  } catch { return { runs: {} }; }
}

/**
 * Observe user-visible play, without modifying the engine, saves or local playtest records.
 * One installation per page, outside React, also avoids StrictMode setup/cleanup duplicates.
 */
export function watchProductAnalytics(store: GameStore, sink: AnalyticsSink, buildId: string): (optedOut?: boolean) => void {
  const ledger = readLedger();
  let session: ActiveSession | null = null;
  let previous = store.getState();
  let lastSample = performance.now();
  let lastActivity = lastSample;
  let hidden = document.hidden;
  let stopped = false;
  // A walkthrough event already under way when the observer is installed mid-play is not a new observation.
  let reportedTour = previous.started ? previous.lastTour?.id ?? 0 : 0;
  const device = window.matchMedia?.("(pointer: coarse)").matches ? "touch" : "desktop";

  const save = () => {
    // Analytics must remain optional when browser storage is blocked/full.
    try {
      ledger.runs = Object.fromEntries(Object.entries(ledger.runs).slice(-100));
      localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(ledger));
    } catch { /* In-memory deduplication and timing still work. */ }
  };
  const sample = () => {
    const now = performance.now();
    if (session && !hidden && !session.run.terminal) {
      const elapsed = Math.max(0, Math.min(now, lastActivity + IDLE_MS) - lastSample);
      session.activeMs += elapsed;
      session.run.activeMs += elapsed;
    }
    lastSample = now;
  };
  const emit = (name: string, extra: AnalyticsProperties = {}) => {
    if (!session) return;
    const s = session.state;
    const properties: AnalyticsProperties = {
      event_version: 1, build_id: buildId, content_version: s.game.campaign ? CAMPAIGN_CONTENT_VERSION : "classic-v1",
      mode: s.mode, run_id: session.run.id, gameplay_session_id: session.id,
      device_category: device, chapter_id: currentChapter(s),
      progress_step: s.game.campaign?.step ?? s.game.turn,
      session_active_ms: Math.round(session.activeMs), run_active_ms: Math.round(session.run.activeMs),
      eligible_started_run: session.run.started, active_delta_ms: Math.round(session.activeMs - session.reportedMs), ...extra,
    };
    if (name === "gameplay_session_progress" || name === "gameplay_session_ended") session.reportedMs = session.activeMs;
    try { sink(name, { ...properties, $insert_id: crypto.randomUUID() }); } catch { /* A collector failure cannot interrupt a game action. */ }
  };
  const finish = (reason: string) => {
    if (!session) return;
    sample();
    emit("gameplay_session_ended", { reason });
    save();
    session = null;
  };
  const begin = (state: State, prev: State) => {
    sample();
    const key = runKey(state);
    const importedClassic = state.mode === "classic" && state.importGeneration !== prev.importGeneration;
    const existing = importedClassic ? undefined : ledger.runs[key];
    const fresh = !existing && state.lastIntro?.kind === "begin" &&
      state.lastIntro.id !== prev.lastIntro?.id;
    const complete = completedChapters(state);
    const terminal = state.game.outcome ? (state.game.outcome === "won" ? "completed" : "failed")
      : state.game.campaign && complete.length === CHAPTER_IDS.length ? "completed" : null;
    const run: RunRecord = existing ?? {
      id: state.game.campaign?.runId ?? crypto.randomUUID(), activeMs: 0, started: fresh,
      terminal, chapters: complete, entered: [],
    };
    // Historical/imported milestones are a baseline, never newly observed completions.
    run.chapters = [...new Set([...run.chapters, ...complete])];
    run.terminal ??= terminal;
    ledger.runs[key] = run;
    session = { id: crypto.randomUUID(), run, reportedMs: 0, activeMs: 0, state };
    lastActivity = lastSample;
    emit(fresh ? "gameplay_run_started" : "gameplay_run_resumed", {
      entry_type: fresh ? "new" : existing ? "resume" : "existing_save",
      replay: fresh && Object.values(ledger.runs).some(r => r !== run && r.started && r.terminal !== null),
    });
    emit("gameplay_session_started");
    const chapter = currentChapter(state);
    if (chapter && !run.entered.includes(chapter)) {
      run.entered.push(chapter);
      emit("gameplay_chapter_started", { chapter_id: chapter });
    }
    save();
    if (run.terminal) finish("already_finished");
  };
  const update = (state: State) => {
    const prev = previous;
    previous = state;
    sample();
    const changed = state.mode !== prev.mode || runKey(state) !== runKey(prev) || state.generation !== prev.generation;
    if (session && (!state.started || changed)) finish(!state.started ? "home" : "run_changed");
    if (state.started && (!prev.started || changed)) begin(state, prev);
    if (!session) return;
    session.state = state;
    // A walkthrough that starts behind the title screen (Challenge Mode offers it on boot) is reported once play begins.
    const tour = state.lastTour;
    if (tour && tour.id !== reportedTour) {
      reportedTour = tour.id;
      emit(`gameplay_tutorial_${tour.kind}`, {
        tutorial_track: tour.track, tutorial_step: tour.step,
        ...(tour.from ? { tutorial_from: tour.from } : {}), ...(tour.reason ? { reason: tour.reason } : {}),
      });
    }
    const chapter = currentChapter(state);
    if (chapter && !session.run.entered.includes(chapter)) {
      session.run.entered.push(chapter);
      emit("gameplay_chapter_started", { chapter_id: chapter });
      save();
    }
    const completed = completedChapters(state);
    for (const id of completed) {
      if (session.run.chapters.includes(id)) continue;
      session.run.chapters.push(id);
      emit("gameplay_chapter_completed", { chapter_id: id });
      save();
    }
    if (!session.run.terminal && (state.game.outcome || (state.game.campaign && completed.length === CHAPTER_IDS.length))) {
      const success = state.game.campaign ? completed.length === CHAPTER_IDS.length : state.game.outcome === "won";
      emit(success ? "gameplay_run_completed" : "gameplay_run_failed", {
        outcome: success ? "completed" : state.game.outcome ?? "failed",
      });
      session.run.terminal = success ? "completed" : "failed";
      finish(success ? "completed" : "failed");
    }
  };
  const safeUpdate = (state: State) => { try { update(state); } catch { /* Optional observer must never break Zustand's notifying action. */ } };
  const unsubscribe = store.subscribe(safeUpdate);
  // Supports installing the observer after the shell has already mounted.
  if (previous.started) begin(previous, { ...previous, started: false, lastIntro: null });
  const activity = () => { sample(); lastActivity = performance.now(); };
  const visibility = () => {
    sample();
    hidden = document.hidden;
    if (!hidden) lastActivity = performance.now();
    if (session) { emit("gameplay_session_progress", { reason: hidden ? "hidden" : "visible" }); save(); }
  };
  const pagehide = () => finish("pagehide");
  const pageshow = (e: PageTransitionEvent) => {
    if (e.persisted && !session && store.getState().started) begin(store.getState(), previous);
  };
  const inputEvents = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;
  for (const name of inputEvents) window.addEventListener(name, activity, { passive: true });
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("pagehide", pagehide);
  window.addEventListener("pageshow", pageshow);
  const timer = window.setInterval(() => {
    sample();
    if (session && !hidden && session.activeMs > session.reportedMs) { emit("gameplay_session_progress", { reason: "heartbeat" }); save(); }
  }, HEARTBEAT_MS);
  // An opt-out stops silently: no closing event and no ledger write.
  return (optedOut = false) => {
    if (stopped) return;
    stopped = true;
    unsubscribe();
    window.clearInterval(timer);
    for (const name of inputEvents) window.removeEventListener(name, activity);
    document.removeEventListener("visibilitychange", visibility);
    window.removeEventListener("pagehide", pagehide);
    window.removeEventListener("pageshow", pageshow);
    if (optedOut) session = null; else finish("unmount");
  };
}
