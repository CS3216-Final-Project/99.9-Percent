"use client";

import { create } from "zustand";
import {
  advanceTurn,
  applyAction,
  BALANCE,
  buildReport,
  incidentTick,
  inspectable,
  newGame,
  type Action,
  type EquipmentId,
  type GameState,
  type TechId,
} from "@/sim";
import { clearSave, DEFAULT_META, loadGame, loadMeta, saveGame, saveMeta, track, type Meta } from "./persist";

export type View = "tech" | "engineers" | "history" | "menu" | null;
export type Speed = 0.5 | 1 | 2;

/** The first-week walkthrough ("basics") and the first-incident guide ("incident"). */
export type TourTrack = "basics" | "incident";

export interface Tour {
  track: TourTrack;
  step: number;
}

/** True while nothing has been decided yet, so the walkthrough's steps still line up. */
export function isFreshRun(g: GameState): boolean {
  return (
    g.phase === "management" &&
    g.turn === 1 &&
    g.history.length === 0 &&
    g.tasks.length === 0 &&
    g.releases.length === 0 &&
    g.techDone.length === 0 &&
    g.totals.promosRun === 0 &&
    g.infra.appHosts.length === 1
  );
}

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "error" | "success";
}

interface Store {
  /** False until the saved game (if any) has been read from the browser. */
  ready: boolean;
  /** False while the title screen is showing. */
  started: boolean;
  game: GameState;
  meta: Meta;
  selected: EquipmentId | null;
  hovered: EquipmentId | null;
  view: View;
  techFocus: TechId | null;
  /** Management: auto-advance is on. Incident: the crisis clock is running. */
  running: boolean;
  speed: Speed;
  toast: Toast | null;
  onboarding: boolean;
  tour: Tour | null;
  rating: number | null;

  boot: () => void;
  /** Leave the title screen and start (or continue) playing. */
  play: () => void;
  act: (action: Action) => boolean;
  advance: () => void;
  tick: (dt: number) => void;
  select: (id: EquipmentId | null) => void;
  hover: (id: EquipmentId | null) => void;
  openView: (view: View) => void;
  focusTech: (id: TechId | null) => void;
  setRunning: (running: boolean) => void;
  setSpeed: (speed: Speed) => void;
  newRun: (opts?: { seed?: string | number; voluntary?: boolean }) => void;
  saveNow: () => void;
  finishOnboarding: () => void;
  showOnboarding: () => void;
  startTour: (track: TourTrack) => void;
  tourNext: () => void;
  endTour: (completed: boolean) => void;
  /** Begin the walkthrough, restarting the intro run first if this one is already under way. */
  startTutorialRun: () => void;
  rate: (rating: number) => void;
  /** Turn the background music on or off, remembered for next time. */
  toggleMusic: () => void;
  notify: (text: string, kind?: Toast["kind"]) => void;
  dismissToast: () => void;
}

let toastId = 1;
let lastIncidentSave = 0;

export const useGame = create<Store>()((set, get) => {
  /** Apply a new game state, record analytics for phase changes and save. */
  function commit(next: GameState, opts: { save?: boolean } = {}): void {
    const prev = get().game;
    let meta = get().meta;
    const patch: Partial<Store> = { game: next };

    if (prev.phase !== "incident" && next.phase === "incident" && next.incident) {
      track("incident_started", { type: next.incident.type, week: next.turn });
      if (!meta.firstIncidentStarted) {
        track("first_incident_started", { type: next.incident.type, week: next.turn });
        meta = { ...meta, firstIncidentStarted: true };
      }
      patch.view = null;
      patch.selected = null;
      if (meta.incidentGuideDone) {
        patch.running = true;
        patch.tour = null;
      } else {
        // First incident ever: hold the clock and walk the player through the workspace.
        patch.running = false;
        patch.tour = { track: "incident", step: 0 };
        track("incident_guide_shown", { type: next.incident.type, week: next.turn });
      }
    }

    if (prev.phase === "incident" && next.phase !== "incident") {
      const pm = next.postmortems[next.postmortems.length - 1];
      const data = pm
        ? { type: pm.type, outcome: pm.outcome, seconds: Math.round(pm.impact.durationSeconds), hints: pm.impact.hintsUsed }
        : undefined;
      track("incident_completed", data);
      if (!meta.firstIncidentCompleted) {
        track("first_incident_completed", data);
        meta = { ...meta, firstIncidentCompleted: true };
      }
      patch.running = false;
      patch.selected = null;
      if (get().tour?.track === "incident") {
        patch.tour = null;
        meta = { ...meta, incidentGuideDone: true };
      }
    }

    if (next.totals.hintsUsed > prev.totals.hintsUsed) {
      track("hint_used", { week: next.turn, type: next.incident?.type ?? null });
    }

    if (!prev.outcome && next.outcome) {
      const report = buildReport(next);
      track("run_finished", {
        outcome: report.outcome,
        weeks: report.weeks,
        users: report.users,
        grade: report.grade,
        uptime: Number((report.uptime * 100).toFixed(3)),
        incidents: report.incidents.total,
        seed: next.seed,
      });
      meta = { ...meta, runsFinished: meta.runsFinished + 1 };
      patch.running = false;
    }

    if (next.phase === "ended") {
      patch.view = null;
      patch.tour = null;
      patch.selected = null;
    }

    if (meta !== get().meta) {
      patch.meta = meta;
      saveMeta(meta);
    }
    set(patch);
    if (opts.save !== false) saveGame(next);
  }

  return {
    ready: false,
    started: false,
    game: newGame(BALANCE.introSeed),
    meta: loadMetaSafe(),
    selected: null,
    hovered: null,
    view: null,
    techFocus: null,
    running: false,
    speed: 1,
    toast: null,
    onboarding: false,
    tour: null,
    rating: null,

    boot: () => {
      if (get().ready) return;
      const meta = loadMeta();
      const loaded = loadGame();
      if (loaded.status === "ok") {
        track("save_resumed", { week: loaded.game.turn, phase: loaded.game.phase });
        const offerTour = !meta.tutorialDone && isFreshRun(loaded.game);
        if (offerTour) track("tutorial_started", { from: "resume" });
        set({
          tour: offerTour ? { track: "basics", step: 0 } : null,
          ready: true,
          meta,
          game: loaded.game,
          // A run resumed mid-incident starts paused so nothing burns while the player reorients.
          running: false,
          onboarding: false,
          toast: null,
        });
        return;
      }
      const game = newGame(BALANCE.introSeed);
      const nextMeta = { ...meta, runsStarted: meta.runsStarted + 1 };
      saveMeta(nextMeta);
      saveGame(game);
      track("run_started", { seed: game.seed, run: nextMeta.runsStarted });
      if (!meta.tutorialDone) track("tutorial_started", { from: "first_visit" });
      set({
        ready: true,
        meta: nextMeta,
        game,
        onboarding: false,
        tour: meta.tutorialDone ? null : { track: "basics", step: 0 },
        toast:
          loaded.status === "corrupt"
            ? { id: toastId++, kind: "error", text: "Saved run was unreadable. Started a new one." }
            : null,
      });
    },

    play: () => set({ started: true }),

    act: (action) => {
      const result = applyAction(get().game, action);
      if (!result.ok) {
        get().notify(result.message, "error");
        return false;
      }
      commit(result.state);
      return true;
    },

    advance: () => {
      const { game } = get();
      if (game.phase !== "management") return;
      const next = advanceTurn(game);
      commit(next);
      const r = next.lastReport;
      if (next.phase === "management" && r && r.turn === game.turn) {
        const gained = r.usersAfter - r.usersBefore;
        get().notify(
          `Week ${r.turn}: ${gained >= 0 ? "+" : ""}${Math.round(gained).toLocaleString("en-US")} users, ${r.net >= 0 ? "+" : "-"}$${Math.abs(Math.round(r.net)).toLocaleString("en-US")}`,
          r.net >= 0 ? "success" : "info",
        );
      }
    },

    tick: (dt) => {
      const { game, running, speed } = get();
      if (game.phase !== "incident" || !running) return;
      const next = incidentTick(game, dt * speed);
      const now = Date.now();
      const ended = next.phase !== "incident";
      const due = now - lastIncidentSave > 2000;
      if (due) lastIncidentSave = now;
      commit(next, { save: ended || due });
    },

    select: (id) => set({ selected: id }),
    hover: (id) => {
      if (get().hovered !== id) set({ hovered: id });
    },
    openView: (view) => set({ view, running: view && get().game.phase === "management" ? false : get().running }),
    focusTech: (id) => set({ techFocus: id, view: id ? "tech" : get().view }),
    setRunning: (running) => {
      set({ running });
      if (!running) saveGame(get().game);
    },
    setSpeed: (speed) => set({ speed }),

    newRun: (opts = {}) => {
      const { meta, game: old } = get();
      const seed = opts.seed !== undefined && opts.seed !== "" ? opts.seed : Math.floor(Math.random() * 1_000_000_000);
      const game = newGame(seed);
      const nextMeta = { ...meta, runsStarted: meta.runsStarted + 1 };
      saveMeta(nextMeta);
      saveGame(game);
      if (opts.voluntary) track("voluntary_replay", { previousOutcome: old.outcome, previousWeeks: old.totals.weeks });
      track("run_started", { seed: game.seed, run: nextMeta.runsStarted });
      set({
        game,
        meta: nextMeta,
        selected: null,
        hovered: null,
        view: null,
        techFocus: null,
        running: false,
        rating: null,
        onboarding: false,
        tour: null,
        started: true,
        toast: null,
      });
    },

    saveNow: () => {
      const okSave = saveGame(get().game);
      get().notify(okSave ? "Saved" : "Could not save: browser storage is unavailable.", okSave ? "success" : "error");
    },

    finishOnboarding: () => {
      const meta = { ...get().meta, onboarded: true };
      saveMeta(meta);
      if (!get().meta.onboarded) track("onboarding_completed");
      set({ meta, onboarding: false });
    },
    showOnboarding: () => set({ onboarding: true, view: null }),

    startTour: (track_) => {
      if (track_ === "basics") track("tutorial_started", { from: "menu" });
      set({ tour: { track: track_, step: 0 }, view: null, selected: null, running: false, onboarding: false, started: true });
    },
    tourNext: () => {
      const tour = get().tour;
      if (tour) set({ tour: { ...tour, step: tour.step + 1 } });
    },
    endTour: (completed) => {
      const { tour, meta, game } = get();
      if (!tour) return;
      let next = meta;
      if (tour.track === "basics") {
        track(completed ? "tutorial_completed" : "tutorial_skipped", { step: tour.step });
        next = { ...meta, tutorialDone: true, onboarded: true };
      } else {
        next = { ...meta, incidentGuideDone: true };
      }
      saveMeta(next);
      // The incident guide holds the clock; closing it lets the incident run.
      set({ tour: null, meta: next, running: tour.track === "incident" && game.phase === "incident" ? true : get().running });
    },
    startTutorialRun: () => {
      if (!isFreshRun(get().game)) get().newRun({ seed: BALANCE.introSeed });
      get().startTour("basics");
    },

    toggleMusic: () => {
      const meta = { ...get().meta, music: !get().meta.music };
      saveMeta(meta);
      set({ meta });
    },

    rate: (rating) => {
      const { game } = get();
      track("rating_submitted", { rating, outcome: game.outcome, weeks: game.totals.weeks, seed: game.seed });
      set({ rating });
    },

    notify: (text, kind = "info") => set({ toast: { id: toastId++, text, kind } }),
    dismissToast: () => set({ toast: null }),
  };
});

/**
 * Clicking or tapping a piece of equipment. Normally it opens the inspector;
 * during an incident it also sends the team to investigate that equipment.
 */
export function inspectOrSelect(id: EquipmentId): void {
  const { game, select, act } = useGame.getState();
  select(id);
  const inc = game.incident;
  if (game.phase !== "incident" || !inc || inc.status !== "active") return;
  if (!inspectable(game).includes(id)) return;
  if (inc.inspecting || inc.evidence.some((e) => e.equipment === id)) return;
  act({ type: "incident_inspect", equipment: id });
}

function loadMetaSafe(): Meta {
  if (typeof window === "undefined") {
    return { ...DEFAULT_META };
  }
  return loadMeta();
}

export { clearSave };
