"use client";
import { beginSession, emptyMeasurement, event, projectEvents, type Measurement } from "./telemetry";
import { archiveEvents } from "./persist";
import { clone } from "@/sim/state";
import { trace } from "@/sim/trace";
import { advanceSteps, enterScaling } from "@/sim/step";

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
  hasRun: boolean;
  measurement: Measurement;
  activeMark: number | null;
  measureTime: () => void;
  endSession: () => void;
  observer: (source:"recruited"|"organic"|"unspecified", intervention?:string) => void;
  remainderMs: number;
  saveBlocked: boolean;
  /** False until the saved game (if any) has been read from the browser. */
  ready: boolean;
  /** False while the title screen is showing. */
  started: boolean;
  game: GameState;
  meta: Meta;
  selected: EquipmentId | null;
  selectedAppId: string | null;
  selectApp: (id:string) => void;
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

  onboardingMove: (direction: "next" | "back" | "skip") => void;
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
  saveNow: (quiet?:boolean) => void;
  finishOnboarding: () => void;
  showOnboarding: () => void;
  startTour: (track: TourTrack) => void;
  tourNext: () => void;
  endTour: (completed: boolean) => void;
  /** Begin the walkthrough, restarting the intro run first if this one is already under way. */
  startTutorialRun: () => void;
  rate: (rating: number) => void;
  notify: (text: string, kind?: Toast["kind"]) => void;
  dismissToast: () => void;
}

let toastId = 1;
let lastIncidentSave = 0;

export const useGame = create<Store>()((set, get) => {
  function persistCurrent(explicitReset=false):boolean {
    const s=get();
    if(s.saveBlocked)return false;
    const saved=saveGame(s.game,s.remainderMs,explicitReset,s.measurement);
    if(saved && archiveEvents(s.measurement.pending)) {
      set({measurement:{...s.measurement,pending:[]}});
      return true;
    }
    s.notify("Storage could not preserve all progress or playtest records. Keep this tab open and export from the menu.","error");
    return false;
  }
  function uiEvent(name:string,data:Record<string,string|number|boolean|null>={}) {
    get().measureTime();
    const m=structuredClone(get().measurement);
    event(m,get().game,name,data);set({measurement:m});
  }
  /** Apply a new game state, record analytics for phase changes and save. */
  function commit(next: GameState, opts: { save?: boolean } = {}): void {
    const prev = get().game;
    if(next.campaign) {
      const was=prev.campaign, c=next.campaign;
      const patch:Partial<Store>={game:next};
      if(!was?.firstPauseConsumed && c.firstPauseConsumed)patch.running=false;
      if(next.phase==="review"||next.phase==="ended"||(c.openingMilestone&&!c.openingMilestone.acknowledged))patch.running=false;
      get().measureTime();
      patch.measurement=projectEvents(get().measurement,next,new Date().toISOString());
      set(patch);
      if(opts.save!==false)persistCurrent();
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
      saveMeta(meta);
    }
    set(patch);
    if (opts.save !== false) saveGame(next);
  }

  return {
    hasRun:false,
    measurement:emptyMeasurement(),
    activeMark:null,
    remainderMs: 0,
    saveBlocked: false,
    ready: false,
    started: false,
    game: newGame(BALANCE.introSeed),
    meta: loadMetaSafe(),
    selected: null,
    selectedAppId: null,
    selectApp: (id) => {if(get().game.campaign?.apps.some(a=>a.id===id))set({selected:"app",selectedAppId:id});},
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
      if(get().ready)return;
      const meta=loadMeta(),loaded=loadGame();
      if(loaded.status==="ok") {
        set({ready:true,hasRun:true,meta,game:loaded.game,measurement:loaded.measurement,running:false,
          remainderMs:loaded.remainderMs,tour:null,saveBlocked:false,activeMark:null});
        return;
      }
      const blocked=loaded.status!=="none";
      set({ready:true,hasRun:false,meta,running:false,tour:null,saveBlocked:blocked,remainderMs:0});
      if(blocked)get().notify("Existing save could not be loaded. It has been preserved. Export it before explicitly starting a new company.","error");
    },
    play: () => {
      if(get().started)return;
      const state=get();
      const game=enterScaling(state.hasRun?state.game:newGame(BALANCE.introSeed,crypto.randomUUID()));
      const meta=state.hasRun?state.meta:{...state.meta,runsStarted:state.meta.runsStarted+1};
      const status=meta.openingOnboarding.status;
      const measurement=projectEvents(beginSession(state.measurement,game,crypto.randomUUID(),new Date().toISOString()),game,new Date().toISOString());
      set({game,hasRun:true,meta,measurement,started:true,running:false,
        onboarding:status==="not-started"||status==="in-progress",activeMark:document.hidden?null:performance.now()});
      if(!saveMeta(meta))get().notify("Onboarding preferences could not be saved.","error");
      persistCurrent();
    },
    measureTime: () => {
      const s=get(),now=performance.now();
      const m=structuredClone(s.measurement);
      if(s.activeMark!==null&&s.started&&m.session&&!m.session.endedAt) {
        const elapsed=Math.max(0,now-s.activeMark);
        m.activeMs+=elapsed;m.session.activeMs+=elapsed;
      }
      set({measurement:m,activeMark:s.started&&!document.hidden&&m.session&&!m.session.endedAt?now:null});
    },
    endSession: () => {
      if(!get().started)return;
      uiEvent("early_exit",{outcome:get().game.phase});
      if(get().game.campaign!.incident)uiEvent("incident_abandoned",{incidentId:get().game.campaign!.incident!.id});
      const m=structuredClone(get().measurement);if(m.session)m.session.endedAt=new Date().toISOString();
      set({measurement:m,running:false,activeMark:null});persistCurrent();
      set({started:false,onboarding:false,view:null});
    },
    observer: (source,intervention) => {
      const m=structuredClone(get().measurement);
      if(!m.session)return;
      m.session.source=source;
      if(intervention?.trim())m.session.facilitatorInterventions++;
      set({measurement:m});
      if(intervention?.trim())uiEvent("facilitator_intervention",{note:intervention.trim()});
      else uiEvent("session_context",{source});
      persistCurrent();
    },
    onboardingMove: (direction) => {
      const current=get().meta.openingOnboarding;
      const done=direction==="skip" || (direction==="next"&&current.step===2);
      const status=direction==="skip"?"skipped":done?"completed":"in-progress";
      const step=done?current.step:Math.max(0,Math.min(2,current.step+(direction==="back"?-1:1)));
      const meta={...get().meta,openingOnboarding:{version:1 as const,step,status:status as Meta["openingOnboarding"]["status"]}};
      const saved=saveMeta(meta); set({meta,onboarding:!done,running:false});
      if(!saved)get().notify("Onboarding preferences could not be saved.","error");
      persistCurrent();
    },

    act: (action) => {
      if(!get().started || get().onboarding || (get().game.campaign?.openingMilestone&&!get().game.campaign!.openingMilestone!.acknowledged&&action.type!=="acknowledge_milestone"))return false;
      const result = applyAction(get().game, action);
      if (!result.ok) {
        if(get().game.campaign) {
          const next=clone(get().game);
          trace(next.campaign!,"action-rejected",{action:action.type,reason:result.message});
          commit(next);
        }
        get().notify(result.message, "error");
        return false;
      }
      if(action.type==="enter_data")set({running:false});
      commit(result.state);
      return true;
    },

    advance: () => {
      const { game } = get();
      if (!get().started || get().onboarding || (game.campaign?.openingMilestone&&!game.campaign.openingMilestone.acknowledged) || game.phase !== "management") return;
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
        if(!get().started||(game.campaign.openingMilestone&&!game.campaign.openingMilestone.acknowledged)||get().onboarding||!running||!Number.isFinite(dt)||dt<=0||game.phase==="review"||game.phase==="ended")return;
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

    select: (id) => set({ selected: id, selectedAppId:id==="app"?(get().selectedAppId??"app-1"):null }),
    hover: (id) => {
      if (get().hovered !== id) set({ hovered: id });
    },
    openView: (view) => { if(get().game.campaign && view && !["menu","history"].includes(view))return; set({view,running:view==="menu"?false:get().running}); },
    focusTech: (id) => set({ techFocus: id, view: id ? "tech" : get().view }),
    setRunning: (running) => {
      set({ running: running && get().started && !(get().game.campaign?.openingMilestone&&!get().game.campaign!.openingMilestone!.acknowledged) && !get().onboarding && get().view!=="menu" && !document.hidden && !["review","ended"].includes(get().game.phase) });
      get().measureTime();
      if(!running&&get().started)persistCurrent();
    },
    setSpeed: (speed) => set({ speed }),

    newRun: (opts = {}) => {
      const replacementRunId=crypto.randomUUID();
      const old=get();
      if(old.started) {
        uiEvent("run_reset",{previousRunId:old.game.campaign!.runId,replacementRunId});
        if(old.game.campaign!.incident)uiEvent("incident_abandoned",{incidentId:old.game.campaign!.incident!.id});
        uiEvent("run_evidence",{campaign:JSON.stringify(old.game)});
      }
      const pending=get().measurement.pending;
      const game=newGame(opts.seed??BALANCE.introSeed,replacementRunId);
      const m=emptyMeasurement();m.replayOf=old.hasRun?old.game.campaign!.runId:null;
      // Preserve unsaved old-run records in the same archive. Refuse reset if it cannot retain them.
      if(pending.length&&!archiveEvents(pending)) {
        get().notify("Export playtest records before resetting: the archive could not retain this run.","error");return;
      }
      const nextMeta={...old.meta,runsStarted:old.meta.runsStarted+1};
      const measurement=beginSession(m,game,crypto.randomUUID(),new Date().toISOString());
      set({game,measurement,hasRun:true,remainderMs:0,saveBlocked:false,meta:nextMeta,
        selected:null,selectedAppId:null,hovered:null,view:null,techFocus:null,running:false,rating:null,
        onboarding:["not-started","in-progress"].includes(nextMeta.openingOnboarding.status),tour:null,
        started:true,toast:null,activeMark:document.hidden?null:performance.now()});
      saveMeta(nextMeta);persistCurrent(true);
    },
    saveNow: (quiet=false) => {
      get().measureTime();
      const saved=persistCurrent();
      if(saved&&!quiet)get().notify("Saved","success");
    },

    finishOnboarding: () => {
      const meta = { ...get().meta, onboarded: true };
      saveMeta(meta);
      if (!get().meta.onboarded) track("onboarding_completed");
      set({ meta, onboarding: false });
    },
    showOnboarding: () => {
      const meta={...get().meta,openingOnboarding:{version:1 as const,step:0,status:"in-progress" as const}};
      saveMeta(meta);set({meta,onboarding:true,view:null,running:false});
    },

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
export function inspectOrSelect(id: EquipmentId, appId?:string): void {
  const { game, select, act } = useGame.getState();
  if(game.campaign && !["app","db","monitoring","gateway",...(game.campaign.dataStage?["cache"]:[])].includes(id))return;
  select(id);
  if(appId)useGame.getState().selectApp(appId);
  if(game.campaign) { if(["app","db","monitoring","gateway",...(game.campaign.dataStage?["cache"]:[])].includes(id))act({type:"incident_inspect",equipment:id,...(id==="app"?{appId:useGame.getState().selectedAppId??"app-1"}:{})}); return; }
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
