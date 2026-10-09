"use client";
import { advanceSteps, applyCampaignInput } from "@/sim/step";

import { create } from "zustand";
import {
  advanceTurn,
  applyAction,
  BALANCE,
  buildReport,
  incidentTick,
  inspectable,
  newGame,
  newLegacyGame,
  type Action,
  type EquipmentId,
  type GameState,
  type TechId,
} from "@/sim";
import {
  clearSave,
  DEFAULT_META,
  loadClassicGame,
  loadGame,
  loadMeta,
  loadMode,
  saveClassicGame,
  saveGame,
  saveMeta,
  saveMode,
  track,
  type GameMode,
  type Meta,
} from "./persist";
import { decodeSave } from "./saveEnvelope";

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
  if(g.campaign)return g.campaign.step===0 && g.campaign.actions.length===0;
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
  /** Which game is being played. The active game and meta always belong to this mode. */
  mode: GameMode;
  remainderMs: number;
  saveBlocked: boolean;
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
  /**
   * Save the current run and continue the other mode's saved run, or start one.
   * Refuses (returning false) when the current run cannot be saved, unless `discard` accepts losing it.
   */
  switchMode: (mode: GameMode, opts?: { discard?: boolean }) => boolean;
  saveNow: () => void;
  /** Replace the current company with an exported save. Returns false if the file is not a usable save. */
  importSave: (raw: string) => boolean;
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
    if(next.campaign) {
      const was=prev.campaign, c=next.campaign;
      const patch:Partial<Store>={game:next};
      if(!was?.firstPauseConsumed && c.firstPauseConsumed)patch.running=false;
      if(next.phase==="review"||next.phase==="ended")patch.running=false;
      if(prev.phase!=="incident"&&next.phase==="incident")track("incident_started",{step:c.step});
      if(prev.phase==="incident"&&next.phase==="review")track("incident_completed",{step:c.step});
      if(prev.phase!=="ended"&&next.phase==="ended")track("run_finished",{outcome:"bankrupt",step:c.step});
      set(patch);
      if(opts.save!==false&&!get().saveBlocked&&!saveGame(next,get().remainderMs))
        get().notify("Could not save. Play continues in memory; export your campaign from the menu.","error");
      return;
    }
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
      saveMeta(meta, "classic");
    }
    set(patch);
    if (opts.save !== false) saveClassicGame(next);
  }

  /** Write the active run to its mode's save slot. */
  function persist(): boolean {
    const { mode, game, saveBlocked, remainderMs } = get();
    if (mode === "classic") return saveClassicGame(game);
    return !saveBlocked && saveGame(game, remainderMs);
  }

  /** Make a mode's saved run (or a fresh one) the active game, with every view closed. */
  function enter(mode: GameMode, started: boolean): void {
    const meta = loadMeta(mode);
    const fresh: Partial<Store> = {
      ready: true,
      mode,
      started,
      meta,
      running: false,
      remainderMs: 0,
      saveBlocked: false,
      selected: null,
      hovered: null,
      view: null,
      techFocus: null,
      onboarding: false,
      tour: null,
      rating: null,
      toast: null,
    };
    if (mode === "classic") {
      const loaded = loadClassicGame();
      if (loaded.status === "ok") {
        track("save_resumed", { mode, week: loaded.game.turn, phase: loaded.game.phase });
        const offerTour = !meta.tutorialDone && isFreshRun(loaded.game);
        if (offerTour) track("tutorial_started", { from: "resume" });
        // A run resumed mid-incident starts paused so nothing burns while the player reorients.
        set({ ...fresh, game: loaded.game, tour: offerTour ? { track: "basics", step: 0 } : null });
        return;
      }
      const game = newLegacyGame(BALANCE.introSeed);
      const nextMeta = { ...meta, runsStarted: meta.runsStarted + 1 };
      saveMeta(nextMeta, mode);
      const saved = saveClassicGame(game);
      track("run_started", { mode, seed: game.seed, run: nextMeta.runsStarted });
      if (!meta.tutorialDone) track("tutorial_started", { from: "first_visit" });
      set({ ...fresh, game, meta: nextMeta, tour: meta.tutorialDone ? null : { track: "basics", step: 0 } });
      if (!saved) get().notify("Could not save. Play continues in memory.", "error");
      else if (loaded.status === "corrupt") get().notify("Saved classic run was unreadable. Started a new one.", "error");
      return;
    }
    const loaded = loadGame();
    if (loaded.status === "ok") {
      set({ ...fresh, game: loaded.game, remainderMs: loaded.remainderMs });
      track("save_resumed", { mode, step: loaded.game.campaign!.step });
      return;
    }
    const game = newGame(BALANCE.introSeed, crypto.randomUUID());
    const blocked = loaded.status !== "none";
    const nextMeta = blocked ? meta : { ...meta, runsStarted: meta.runsStarted + 1 };
    set({ ...fresh, game, meta: nextMeta, saveBlocked: blocked });
    if (!blocked) {
      saveMeta(nextMeta, mode);
      if (!saveGame(game)) get().notify("Could not save. Play continues in memory; export your company from the menu.", "error");
      track("run_started", { mode, seed: game.seed });
    } else get().notify("Existing save could not be loaded. It has been preserved. Export it from the menu before explicitly starting a new company.", "error");
  }

  return {
    mode: "campaign",
    remainderMs: 0,
    saveBlocked: false,
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
      enter(loadMode(), false);
    },

    play: () => set({ started: true }),

    act: (action) => {
      if (get().game.campaign) {
        // Rejections are recorded too: they are part of the campaign's history and its replay.
        const { state, result } = applyCampaignInput(get().game, action);
        commit(state);
        if (!result.ok) get().notify(result.message, "error");
        return result.ok;
      }
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
      if(game.campaign) {
        if(!running||!Number.isFinite(dt)||dt<=0||game.phase==="review"||game.phase==="ended")return;
        const credit=get().remainderMs+Math.round(dt*1000*speed);
        const whole=Math.floor(credit/1000);
        set({remainderMs:credit%1000});
        if(whole===0)return;
        const result=advanceSteps(game,whole);
        if(result.stopReason)set({running:false});
        commit(result.state);
        return;
      }
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
    openView: (view) => { if(get().game.campaign && view && !["menu","history"].includes(view))return; set({view,running:view==="menu"?false:get().running}); },
    focusTech: (id) => set({ techFocus: id, view: id ? "tech" : get().view }),
    setRunning: (running) => {
      set({ running: running && get().view!=="menu" && !document.hidden && !["review","ended"].includes(get().game.phase) });
      if (!running && !persist() && !get().saveBlocked) get().notify("Could not save. Play continues in memory.", "error");
    },
    setSpeed: (speed) => set({ speed }),

    newRun: (opts = {}) => {
      const { meta, mode, game: old } = get();
      const seed = opts.seed !== undefined && opts.seed !== "" ? opts.seed : Math.floor(Math.random() * 1_000_000_000);
      const game = mode === "classic" ? newLegacyGame(seed) : newGame(seed, crypto.randomUUID());
      const nextMeta = { ...meta, runsStarted: meta.runsStarted + 1 };
      saveMeta(nextMeta, mode);
      const saved = mode === "classic" ? saveClassicGame(game) : saveGame(game, 0, true);
      if (opts.voluntary) track("voluntary_replay", { previousOutcome: old.outcome, previousWeeks: old.totals.weeks });
      track("run_started", { mode, seed: game.seed, run: nextMeta.runsStarted });
      set({
        game,
        remainderMs:0,
        saveBlocked:false,
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
      if(!saved)get().notify("Could not save. Play continues in memory; export your company from the menu.","error");
    },

    switchMode: (mode, opts = {}) => {
      if (mode === get().mode) return true;
      if (!persist() && !opts.discard) return false;
      saveMode(mode);
      track("mode_switched", { to: mode });
      enter(mode, true);
      return true;
    },

    saveNow: () => {
      const okSave = persist();
      get().notify(okSave ? "Saved" : "Could not save: browser storage is unavailable.", okSave ? "success" : "error");
    },

    importSave: (raw) => {
      const result = decodeSave(raw);
      if (result.status !== "ok") {
        get().notify(result.status === "unsupported" ? "That save is from a different version of the game." : "That file is not a readable save.", "error");
        return false;
      }
      const { game, envelope: { runtime } } = result;
      const saved = saveGame(game, runtime.remainderMs, true);
      set({ game, remainderMs: runtime.remainderMs, saveBlocked: false, running: false, view: null, selected: null, hovered: null, started: true });
      track("save_imported", { step: game.campaign!.step });
      get().notify(saved ? "Save imported" : "Imported. Could not save; play continues in memory.", saved ? "success" : "error");
      return true;
    },

    finishOnboarding: () => {
      const meta = { ...get().meta, onboarded: true };
      saveMeta(meta, get().mode);
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
      saveMeta(next, get().mode);
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
  if(game.campaign && !["app","db","monitoring","gateway"].includes(id))return;
  select(id);
  if(game.campaign) { if(["app","db","monitoring","gateway"].includes(id))act({type:"incident_inspect",equipment:id}); return; }
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
