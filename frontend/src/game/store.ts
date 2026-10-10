"use client";
import { beginSession, emptyMeasurement, event, projectEvents, type Measurement } from "./telemetry";
import { archiveEvents } from "./persist";
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
  decodeClassicSave,
  rawLegacySave,
  loadLegacyMeta,
  saveMusic,
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
import { makeEnvelope, validateEnvelope, type SaveEnvelope } from "./saveEnvelope";
import { AccountApiError, getSession, logout, listRuns, putRun, getRun } from "@/lib/api";
import type { AppSession, CloudRun, RunSummary } from "../../../shared/campaign.ts";
import { checkpointCloud, localCloudCopy, rememberCloud } from "./cloud";


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
  prepareSignIn: () => boolean;
  accountSession: AppSession | null;
  accountStatus: 'unchecked' | 'checking' | 'guest' | 'signed-in' | 'unavailable';
  cloudStatus: string;
  cloudBusy: boolean;
  cloudRuns: RunSummary[];
  cloudConflict: CloudRun | null;
  restoreAccount: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshCloudRuns: () => Promise<void>;
  saveCloud: (attach?:boolean) => Promise<void>;
  resumeCloud: (runId:string) => Promise<void>;
  keepLocalConflict: () => Promise<void>;

  hasRun: boolean;
  measurement: Measurement;
  activeMark: number | null;
  measureTime: () => void;
  endSession: () => void;
  observer: (source:"recruited"|"organic"|"unspecified", intervention?:string) => void;

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
  selectedAppId: string | null;
  selectApp: (id: string) => void;
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
  saveNow: (quiet?: boolean) => void;
  onboardingMove: (direction: "next" | "back" | "skip") => void;
  /** Replace the current company with an exported save. Returns false if the file is not a usable save. */
  importSave: (raw: string) => boolean;
  /** Resume a validated copy of the pre-update save in Classic, retaining original bytes. */
  resumeLegacySave: () => boolean;
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
  let accountRequest = 0;
  function persist(explicitReset=false):boolean {
    const s=get();
    if(s.mode === "classic") return saveClassicGame(s.game);
    if(s.saveBlocked)return false;
    if(!s.hasRun)return true;
    const saved=saveGame(s.game,s.remainderMs,explicitReset,s.measurement);
    try { if (saved) checkpointCloud(makeEnvelope(s.game,s.remainderMs,Date.now(),s.measurement)); }
    catch { s.notify("Local progress is saved, but its account backup could not be retained. Export account copies before replacing this company.","error"); return false; }
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
      if(opts.save!==false)persist();
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

  /** Make a mode's saved run (or a fresh one) the active game, with every view closed. */
  function enter(mode: GameMode, started: boolean): void {
    const meta = loadMeta(mode);
    const fresh: Partial<Store> = {
      hasRun: false, measurement: emptyMeasurement(), activeMark: null,
      ready: true,
      mode,
      started,
      meta,
      running: false,
      remainderMs: 0,
      saveBlocked: false,
      selected: null,
      selectedAppId: null,
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
      set({ ...fresh, started: false, hasRun: true, game: loaded.game, remainderMs: loaded.remainderMs, measurement: loaded.measurement });
    } else {
      set({ ...fresh, started: false, game: newGame(BALANCE.introSeed), saveBlocked: loaded.status !== "none" });
      if (loaded.status !== "none") get().notify("Existing save could not be loaded. It has been preserved. Export it from the menu before explicitly starting a new company.", "error");
    }
    if (started) get().play();
  }

  function accountFailure(error:unknown) {
    if(error instanceof AccountApiError && error.status===401)set({accountSession:null,accountStatus:'guest'});
    set({cloudStatus:error instanceof Error?error.message:'Cloud service unavailable. Local progress is retained.'});
  }
  function currentEnvelope() { const s=get();if (!s.game.campaign) throw Error("Cloud saves are available for Campaign companies. Classic progress stays local.");return makeEnvelope(s.game,s.remainderMs,Date.now(),s.measurement); }
  function ownSession() {const session=get().accountSession;if(!session)throw Error('Sign in first. Local progress is retained.');return session;}
  return {
    prepareSignIn:()=>{set({running:false});return !get().hasRun||persist();},
    accountSession:null, accountStatus:'unchecked', cloudStatus:'Local progress stays in this browser.', cloudBusy:false, cloudRuns:[], cloudConflict:null,
    restoreAccount: async()=>{
        if(get().accountStatus==='checking'||get().cloudBusy)return;
        const request=++accountRequest;
        set({accountStatus:'checking'});
        try {const session=await getSession();if(request!==accountRequest)return;set({accountSession:session,accountStatus:'signed-in',cloudRuns:[],cloudStatus:'Signed in. Guest runs are attached only when you choose.'});}
        catch(error){if(request!==accountRequest)return;const outcome=new URLSearchParams(window.location.search).get('auth');set({accountSession:null,accountStatus:error instanceof AccountApiError&&error.status===401?'guest':'unavailable',cloudStatus:outcome==='cancelled'?'Google sign-in cancelled. Your local company is retained.':outcome==='failed'?'Google sign-in failed. Your local company is retained.':'Local play is available. Sign in or retry when accounts are available.'});}
    },
    signOut: async()=>{
        if(get().cloudBusy)return;
        ++accountRequest;
      set({cloudBusy:true,accountStatus:get().accountSession?'signed-in':get().accountStatus});
      try {const session=ownSession();await logout(session.csrfToken);set({accountSession:null,accountStatus:'guest',cloudRuns:[],cloudConflict:null,cloudStatus:'Signed out. Local progress and owner bindings are retained.'});}
      catch(error){accountFailure(error);}
      finally{set({cloudBusy:false});}
    },
    refreshCloudRuns: async()=>{
      if(get().cloudBusy)return;set({cloudBusy:true});
      try {const session=ownSession();const runs=await listRuns();if(get().accountSession===session)set({cloudRuns:runs,cloudStatus:runs.length?'Choose a cloud company to resume. Your current local company will be retained.':'No cloud companies yet.'});}
      catch(error){accountFailure(error);}finally{set({cloudBusy:false});}
    },
    saveCloud: async(attach=false)=>{
      if(get().cloudBusy)return;set({cloudBusy:true});
      let envelope:SaveEnvelope|undefined;
      try {
        const session=ownSession();if(!get().hasRun||get().saveBlocked)throw Error('Start or load a valid company before attaching it.');
        get().measureTime();envelope=currentEnvelope();
        if(validateEnvelope(envelope).status!=='ok')throw Error('This campaign snapshot is invalid. Export it before replacing it.');
        const copy=localCloudCopy(envelope.runId);
        if(copy&&copy.ownerId!==session.account.id)throw Error('This local company belongs to another account. Its pending progress is retained.');
        if(!copy&&!attach)throw Error('Choose Attach current guest company first.');
        if(copy?.remote)throw Error('Resolve the cloud conflict before retrying. Both copies are retained.');
        rememberCloud({ownerId:session.account.id,revision:copy?.revision??0,local:envelope});
        const game=get().game;
        const saved=await putRun(envelope,copy?.revision??0,session.csrfToken);
        if(get().accountSession!==session)return;
        if(saved.runId!==envelope.runId || !Number.isSafeInteger(saved.revision) || saved.revision<1)throw Error('Invalid cloud acknowledgement. Local progress is retained.');
        rememberCloud({ownerId:session.account.id,revision:saved.revision,local:currentEnvelope()});
        set({cloudConflict:null,cloudStatus:get().game===game?'Cloud save complete.':'Cloud snapshot saved. Newer local changes are pending.'});
      } catch(error) {
        if(error instanceof AccountApiError&&error.status===409&&error.detail.current&&envelope) {
          set({cloudConflict:error.detail.current});
          try {
            const copy=localCloudCopy(envelope.runId)!;rememberCloud({...copy,local:currentEnvelope(),remote:error.detail.current});
            set({cloudStatus:'Cloud conflict: both copies are retained. Choose which to continue.'});
          } catch {set({cloudStatus:'Conflict copies could not be stored. Keep this tab open and export account copies before continuing.'});}
        } else accountFailure(error);
      } finally{set({cloudBusy:false});}
    },
    keepLocalConflict: async()=>{
      if(get().cloudBusy)return;
      try {
        const session=ownSession(),e=currentEnvelope(),copy=localCloudCopy(e.runId);
        if(!copy||copy.ownerId!==session.account.id||!copy.remote)throw Error('No conflict for this company.');
        const remote=copy.remote as CloudRun;
        // Preserve both exact versions before an explicit revision-conditional overwrite.
        localStorage.setItem(`nn.campaign.conflict.${e.runId}.${remote.revision}`,JSON.stringify({local:e,remote}));
        rememberCloud({...copy,local:e,revision:remote.revision,remote:undefined});set({cloudConflict:null});
        await get().saveCloud();
      }catch(error){accountFailure(error);}
    },
    resumeCloud: async(runId)=>{
      if(get().cloudBusy)return;set({cloudBusy:true,running:false});
      try {
        const session=ownSession(),before=get().game,run=await getRun(runId);
        if(get().accountSession!==session||get().game!==before)throw Error('Local company changed while loading. Retry when paused.');
        const validated=validateEnvelope(run.envelope);
        if(validated.status!=='ok')throw Error('This cloud save needs a compatible game version. Local progress is retained.');
        const s=get(),e=validated.envelope,game=validated.game;
        if(e.runId!==runId)throw Error('Cloud run identity does not match.');
        // Refuse replacement unless current bytes and all account copies are durably retained.
        const original=localStorage.getItem('nn.campaign.save.v1');
        if(original!==null)localStorage.setItem(`nn.campaign.before-cloud.${s.game.campaign!.runId}`,original);
        if(s.hasRun)localStorage.setItem(`nn.campaign.before-cloud.${s.game.campaign!.runId}.pending`,JSON.stringify(currentEnvelope()));
        const previous=localCloudCopy(runId);
        if(previous&&previous.ownerId!==session.account.id)throw Error('This run is bound to another local owner.');
        if(previous)localStorage.setItem(`nn.campaign.before-cloud.${runId}.owner-copy`,JSON.stringify(previous));
        rememberCloud({ownerId:session.account.id,revision:run.revision,local:e});
        if(!saveGame(game,e.runtime.remainderMs,true,e.runtime.measurement))throw Error('Storage could not retain the cloud copy. Local progress is retained.');
        saveMode("campaign");
        set({mode:"campaign",game,measurement:e.runtime.measurement,remainderMs:e.runtime.remainderMs,hasRun:true,saveBlocked:false,
          running:false,started:false,onboarding:false,view:null,selected:null,selectedAppId:null,activeMark:null,cloudConflict:null,cloudStatus:'Cloud company loaded and paused. Continue when ready.'});
      }catch(error){accountFailure(error);}finally{set({cloudBusy:false});}
    },
    hasRun: false, measurement: emptyMeasurement(), activeMark: null,
    mode: "campaign",
    remainderMs: 0,
    saveBlocked: false,
    ready: false,
    started: false,
    game: newGame(BALANCE.introSeed),
    meta: loadMetaSafe(),
    selected: null,
    selectedAppId: null,
    selectApp: id => { if (get().game.campaign?.apps.some(a => a.id === id)) set({selected:"app",selectedAppId:id}); },
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

    play: () => {
      if(get().started)return;
      if(get().mode === "classic") { set({started:true}); return; }
      const state=get();
      let game=state.hasRun?state.game:newGame(BALANCE.introSeed,crypto.randomUUID());
      if (game.campaign!.openingMilestone?.acknowledged && !game.campaign!.scaling && game.phase!=="ended") game=applyCampaignInput(game,{type:"enter_scaling"}).state;
      const meta=state.hasRun?state.meta:{...state.meta,runsStarted:state.meta.runsStarted+1};
      const status=meta.openingOnboarding.status;
      const measurement=projectEvents(beginSession(state.measurement,game,crypto.randomUUID(),new Date().toISOString()),game,new Date().toISOString());
      set({game,hasRun:true,meta,measurement,started:true,running:false,
        onboarding:status==="not-started"||status==="in-progress",activeMark:document.hidden?null:performance.now()});
      if(!saveMeta(meta))get().notify("Onboarding preferences could not be saved.","error");
      persist();
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
      set({measurement:m,running:false,activeMark:null});persist();
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
      persist();
    },
    onboardingMove: (direction) => {
      const current=get().meta.openingOnboarding;
      const done=direction==="skip" || (direction==="next"&&current.step===2);
      const status=direction==="skip"?"skipped":done?"completed":"in-progress";
      const step=done?current.step:Math.max(0,Math.min(2,current.step+(direction==="back"?-1:1)));
      const meta={...get().meta,openingOnboarding:{version:1 as const,step,status:status as Meta["openingOnboarding"]["status"]}};
      const saved=saveMeta(meta); set({meta,onboarding:!done,running:false});
      if(!saved)get().notify("Onboarding preferences could not be saved.","error");
      persist();
    },


    act: (action) => {
      if(get().game.campaign && (!get().started || get().onboarding || (get().game.campaign!.openingMilestone && !get().game.campaign!.openingMilestone!.acknowledged && action.type !== "acknowledge_milestone"))) return false;
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
      if (game.phase !== "management" || (game.campaign && (!get().started || get().onboarding || (game.campaign.openingMilestone && !game.campaign.openingMilestone.acknowledged)))) return;
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
        if(!get().started || get().onboarding || (game.campaign.openingMilestone && !game.campaign.openingMilestone.acknowledged) || !running||!Number.isFinite(dt)||dt<=0||game.phase==="review"||game.phase==="ended")return;
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

    select: id => set({selected:id,selectedAppId:id==="app"?(get().selectedAppId??"app-1"):null}),
    hover: (id) => {
      if (get().hovered !== id) set({ hovered: id });
    },
    openView: (view) => {
      if (get().game.campaign && view && !["menu", "history"].includes(view)) return;
      set({ view });
      if (view === "menu") get().setRunning(false);
    },
    focusTech: (id) => set({ techFocus: id, view: id ? "tech" : get().view }),
    setRunning: (running) => {
      set({ running: running && (!get().game.campaign || (get().started && !get().onboarding && !(get().game.campaign!.openingMilestone && !get().game.campaign!.openingMilestone!.acknowledged))) && get().view!=="menu" && !document.hidden && !["review","ended"].includes(get().game.phase) });
      if (!running && !persist() && !get().saveBlocked) get().notify("Could not save. Play continues in memory.", "error");
    },
    setSpeed: (speed) => set({ speed }),

    newRun: (opts = {}) => {
      if(get().cloudBusy){get().notify("Wait for the cloud operation before replacing this company.","info");return;}
      try {if(get().hasRun && get().game.campaign)checkpointCloud(currentEnvelope());}
      catch {get().notify("Export account copies before replacing this company: its pending backup could not be saved.","error");return;}
      if (get().mode === "campaign") {
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
        selected:null,hovered:null,view:null,techFocus:null,running:false,rating:null,
        onboarding:["not-started","in-progress"].includes(nextMeta.openingOnboarding.status),tour:null,
        started:true,toast:null,activeMark:document.hidden?null:performance.now()});
      saveMeta(nextMeta);persist(true);
      return;
      }

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
      if(get().cloudBusy){get().notify("Wait for the cloud operation before replacing this company.","info");return false;}
      if (mode === get().mode) return true;
      if (!persist() && !opts.discard) return false;
      saveMode(mode);
      track("mode_switched", { to: mode });
      enter(mode, true);
      return true;
    },

    saveNow: (quiet = false) => {
      if(get().game.campaign) get().measureTime();
      const saved=persist();
      if(!quiet || !saved) get().notify(saved ? "Saved" : "Could not save: browser storage is unavailable.", saved ? "success" : "error");
    },

    importSave: (raw) => {
      if(get().cloudBusy){get().notify("Wait for the cloud operation before replacing this company.","info");return false;}
      const campaign = decodeSave(raw);
      const classic = campaign.status === "ok" ? null : decodeClassicSave(raw);
      if (campaign.status !== "ok" && classic?.status !== "ok") {
        get().notify(campaign.status === "unsupported" ? "That save is from a different version of the game." : "That file is not a readable save.", "error");
        return false;
      }
      const game = campaign.status === "ok" ? campaign.game : (classic as Extract<ReturnType<typeof decodeClassicSave>, { status: "ok" }>).game;
      const mode: GameMode = game.campaign ? "campaign" : "classic";
        // Preserve current progress and any owner-bound pending copy before replacement.
        if ((mode !== get().mode || get().hasRun) && !persist()) {
          get().notify("Could not save the current run. Export it before importing a replacement.", "error");
        return false;
      }
      const remainderMs = campaign.status === "ok" ? campaign.envelope.runtime.remainderMs : 0;
      const measurement = campaign.status === "ok" ? beginSession(campaign.envelope.runtime.measurement, game, crypto.randomUUID(), new Date().toISOString()) : emptyMeasurement();
      const saved = mode === "campaign" ? saveGame(game, remainderMs, true, measurement) && archiveEvents(measurement.pending) : saveClassicGame(game);
      saveMode(mode);
      set({ mode, hasRun: mode === "campaign", measurement, activeMark: mode === "campaign" && !document.hidden ? performance.now() : null, meta: loadMeta(mode), game, remainderMs, saveBlocked: false, running: false, view: null,
        selected: null, hovered: null, started: true, tour: null, onboarding: false, techFocus: null, rating: null });
      track("save_imported", { mode, step: game.campaign?.step ?? game.turn });
      get().notify(saved ? "Save imported" : "Imported. Could not save; play continues in memory.", saved ? "success" : "error");
      return true;
    },

    resumeLegacySave: () => {
      const raw = rawLegacySave();
      if (raw === null || decodeClassicSave(raw).status !== "ok") {
        get().notify("The pre-update save cannot be resumed. Export the original file to keep a copy.", "error");
        return false;
      }
      if (!get().importSave(raw)) return false;
      const meta = loadLegacyMeta();
      saveMusic(meta.music);
      saveMeta(meta, "classic");
      set({ meta });
      return true;
    },

    finishOnboarding: () => {
      const meta = { ...get().meta, onboarded: true };
      saveMeta(meta, get().mode);
      if (!get().meta.onboarded) track("onboarding_completed");
      set({ meta, onboarding: false });
    },
    showOnboarding: () => {
      if(!get().game.campaign) { set({onboarding:true,view:null}); return; }
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
      saveMusic(meta.music);
      saveMeta(meta, get().mode);
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
export function inspectOrSelect(id: EquipmentId, appId?: string): void {
  const { game, select, act } = useGame.getState();
  if(game.campaign && !["app","db","monitoring","gateway"].includes(id))return;
  select(id);
  if (appId) useGame.getState().selectApp(appId);
  if(game.campaign) { if(["app","db","monitoring","gateway"].includes(id))act({type:"incident_inspect",equipment:id,...(id==="app"?{appId:useGame.getState().selectedAppId??"app-1"}:{})}); return; }
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
