"use client";
import { beginSession, emptyMeasurement, event, projectEvents, type Measurement } from "./telemetry";
import { archiveEvents } from "./persist";
import { finishedChapter } from "./campaignChapters";
import { FULL_SCOPE, scopeAllows, scopeComplete, type PlayScope } from "./scope";
import { clearTutorialPractice, loadTutorialPractice, saveTutorialPractice, type TutorialCompany } from "./tutorialPractice";
import { advanceSteps, applyCampaignInput, pendingStop } from "@/sim/step";
import type { Campaign } from "@/sim/campaignTypes";

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
  legacyMusicOff,
  loadAudio,
  loadGraphics,
  loadLegacyMeta,
  saveAudio,
  saveGraphics,
  loadAvatar,
  saveAvatar,
  DEFAULT_AUDIO,
  DEFAULT_GRAPHICS,
  DEFAULT_META,
  isSilent,
  loadClassicGame,
  loadGame,
  loadMeta,
  loadMode,
  challengeUnlocked,
  saveClassicGame,
  saveGame,
  saveMeta,
  saveMode,
  loadMapOpen,
  saveMapOpen,
  loadControls,
  saveControls,
  retrack,
  track,
  GRAPHICS_QUALITIES,
  type AudioSettings,
  type ChapterCompletion,
  type ChapterTour,
  type GuidedTip,
  type GameMode,
  type GraphicsSettings,
  type Meta,
} from "./persist";
import { decodeSave } from "./saveEnvelope";
import { makeEnvelope, validateEnvelope, type SaveEnvelope } from "./saveEnvelope";
import { AccountApiError, getSession, logout, listRuns, putRun, getRun, emailLogin, emailRegister } from "@/lib/api";
import type { AppSession, CloudRun, RunSummary } from "../../../shared/campaign.ts";
import { checkpointCloud, localCloudCopy, rememberCloud } from "./cloud";
import { loadExploration, saveExploration } from "./exploration";
import { floorFromSearch, floorOf, type Floor, type FloorSwitch } from "./floors";
import { DEFAULT_AVATAR, type AvatarId } from "./avatars";
import { clampFov, fromAvatar, offeredViewpoint, type Viewpoint, type ViewSwitch } from "./viewpoints";
import { isPhoneEdition } from "@/phone/edition";
import { clampLookSpeed, DEFAULT_CONTROLS, type ControlSettings } from "./controls";

export type View = "tech" | "engineers" | "history" | "menu" | "guidance" | "scorecard" | null;
export type Speed = 0.5 | 1 | 2;
/** The Guided Mode panel's two halves: readings of the system, and the controls that change it. */
export type PanelTab = "analysis" | "actions";

/**
 * Challenge Mode's first-week walkthrough ("basics") and first-incident guide ("incident"); Guided Mode's Opening
 * walkthrough ("campaign") and the short guide for each later chapter, named after it.
 */
/** A one-card Guided Mode tip shown the first time something happens; see Meta.tipsSeen. */
export type TipTour = GuidedTip;
export type TourTrack = "basics" | "incident" | "campaign" | ChapterTour | TipTour;

/** The chapter a Guided Mode company has entered, if it is past the Opening. */
function chapterTourOf(c: Campaign): ChapterTour | null {
  return c.combinedStage ? "combined" : c.reliabilityStage ? "reliability" : c.spikeStage ? "spikes" : c.dataStage ? "data" : c.scaling ? "scaling" : null;
}

export interface Tour {
  track: TourTrack;
  step: number;
}

/** The walkthroughs, one per mode, whose start and end are measured. The other guides are a single card. */
export type Walkthrough = "basics";
const isWalkthrough = (track: TourTrack): track is Walkthrough => track === "basics";
/** How many lessons the remaining walkthrough has. */
export const WALKTHROUGH_STEPS: Record<Walkthrough, number> = { basics: 5 };
const lastStep = (track: Walkthrough) => WALKTHROUGH_STEPS[track] - 1;

/** What started a walkthrough: the first visit, resuming a fresh run, a new company, the menu or the home screen. */
export type TourStart = "first_visit" | "resume" | "new_company" | "menu" | "home";

/**
 * A walkthrough starting, being finished or being skipped, with an id so two in a row can be told apart. A skipped
 * one was closed by the player, or by the company moving on to a new chapter. Never saved.
 */
export interface TourEvent {
  id: number;
  track: Walkthrough;
  kind: "started" | "completed" | "skipped";
  /** The step showing, counted from 0. */
  step: number;
  from?: TourStart;
  reason?: "player" | "chapter_entered";
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

/** The player's latest decision and whether the game accepted it. */
export interface LastAction {
  id: number;
  type: Action["type"];
  ok: boolean;
}

/**
 * How a run begins, so a sound can mark it: "begin" is a company starting,
 * "step" the introduction's prompts moving on, "finish" the introduction done.
 */
export type IntroKind = "begin" | "step" | "finish";

/** The latest of those, with an id so two in a row can be told apart. */
export interface LastIntro {
  id: number;
  kind: IntroKind;
}

/**
 * An inspection started in the 3D room itself — a model or label clicked, or the avatar's prompt — waiting for
 * its diagnostic card. Panels keep calling `inspectOrSelect`, which never sets this. Never saved.
 */
export interface RoomInspection {
  seq: number;
  equipment: EquipmentId;
  appId?: string;
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
  /** Resolve to an error to show beside the form, or null once signed in. */
  signInWithEmail: (email:string, password:string) => Promise<string|null>;
  registerWithEmail: (name:string, email:string, password:string) => Promise<string|null>;
  signOut: () => Promise<void>;
  /** Resolves true once the list reflects the account. */
  refreshCloudRuns: () => Promise<boolean>;
  saveCloud: (attach?:boolean) => Promise<void>;
  /** Resolves true once the cloud save is the local Campaign save. */
  resumeCloud: (runId:string) => Promise<boolean>;
  keepLocalConflict: () => Promise<void>;

  hasRun: boolean;
  measurement: Measurement;
  activeMark: number | null;
  /** Transient import marker: analytics distinguishes an imported Classic save from a mode switch. */
  importGeneration: number;
  measureTime: () => void;
  endSession: () => void;
  observer: (source:"recruited"|"organic"|"unspecified", intervention?:string) => void;

  /** Which game is being played. The active game and meta always belong to this mode. */
  mode: GameMode;
  remainderMs: number;
  saveBlocked: boolean;
  /** Result of the latest attempt to preserve the active run in this browser. */
  saveStatus: "saved" | "unsaved";
  /** False until the saved game (if any) has been read from the browser. */
  ready: boolean;
  /** False while the title screen is showing. */
  started: boolean;
  game: GameState;
  /**
   * Counts the times the game was replaced wholesale (boot, new run, import,
   * mode switch), so a watcher can tell a loaded game from one being played.
   */
  generation: number;
  /** Explicit tutorial restarts reset exercise acknowledgements without replacing the company. */
  tutorialAttempt: number;
  /** The paused company to return to after an optional Chapter 0 practice session. */
  tutorialCompany: TutorialCompany | null;
  lastAction: LastAction | null;
  /** Only the player's own starts and introduction steps: loading, importing and resuming leave it empty. */
  lastIntro: LastIntro | null;
  meta: Meta;
  /** Sound settings, shared by both modes and kept across mode switches. */
  audio: AudioSettings;
  /** Graphics settings, shared by both modes and kept across mode switches. */
  graphics: GraphicsSettings;
  selected: EquipmentId | null;
  selectedAppId: string | null;
  /** Temporary workspace visibility; never serialized into a save. */
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  /** Which half of the Guided Mode panel is shown. Workspace state; never serialized into a save. */
  panelTab: PanelTab;
  setPanelTab: (tab: PanelTab) => void;
  selectApp: (id: string) => void;
  /** The room-originated inspection asking for its reveal, or none. */
  roomInspection: RoomInspection | null;
  dismissRoomInspection: () => void;
  /**
   * The floor of the building in view. Choosing a piece of equipment takes the view to its floor; an incident never
   * moves it on its own. Remembered in this browser per mode (see game/exploration.ts), never in a run's save.
   */
  floor: Floor;
  /** Take the view to a floor; `how` says what asked, for the analytics. */
  goToFloor: (floor: Floor, how: FloorSwitch) => void;
  /**
   * Walk mode: the player steers their avatar round the building. Remembered in this browser per mode like the
   * floor, never in a run's save.
   */
  walking: boolean;
  setWalking: (on: boolean, remember?: boolean) => void;
  /**
   * Where the room is seen from (see game/viewpoints.ts). Follow and first person turn walk mode on, and ending walk
   * mode returns to the overview. Remembered with walk mode, per mode, in this browser.
   */
  viewpoint: Viewpoint;
  setViewpoint: (v: Viewpoint, how: ViewSwitch) => void;
  /** The map in the room's corner is open, a browser setting kept across runs and modes. */
  mapOpen: boolean;
  setMapOpen: (open: boolean) => void;
  /** Guided Mode's traffic view on or off, kept in the profile. See `trafficViewOn` for when it shows. */
  setTrafficView: (on: boolean) => void;
  /** Mark the launch letter read so the cold open stays away across reloads. */
  openLaunchDoors: () => void;
  /** Record, for the analytics, that a click on the map sent the avatar walking. */
  noteMapWalk: () => void;
  /** How the views from the avatar answer the mouse, a browser setting kept across runs and modes. */
  controls: ControlSettings;
  /** Change the look controls, remembered for next time. The look speed is kept in range. */
  setControls: (patch: Partial<ControlSettings>) => void;
  /** The player's avatar, a browser setting kept across runs and modes. */
  avatar: AvatarId;
  setAvatar: (id: AvatarId) => void;
  hovered: EquipmentId | null;
  /** The machines a campaign action the player is considering would change, lit up in the room. Never saved. */
  affected: EquipmentId[];
  /** The decision behind `affected`, which the room previews as a ghost of what it would build or change. Never saved. */
  previewAction: Action | null;
  /** The machines the guidance spotlight lights in the room (equipment or App Server ids); the rest dim. Never saved. */
  spotlight: string[];
  /** The latest request to centre the camera on a machine's marker (an equipment or App Server id). Never saved. */
  cameraFocus: { anchor: string; seq: number } | null;
  view: View;
  techFocus: TechId | null;
  /** Management: auto-advance is on. Incident: the crisis clock is running. */
  running: boolean;
  speed: Speed;
  /** Fast-forward to the end of the current operating week (20x). Clears on incident or the week boundary. */
  weekRush: boolean;
  endWeek: () => void;
  cancelWeekRush: () => void;
  toast: Toast | null;
  onboarding: boolean;
  tour: Tour | null;
  /** A chapter the company has just finished, announced once until the player continues or stays. */
  chapterComplete: ChapterCompletion | null;
  /** The latest walkthrough start or end, for product analytics. */
  lastTour: TourEvent | null;
  rating: number | null;
  /** How much of the game this edition offers (see game/scope.ts). Set once by `boot`. */
  scope: PlayScope;

  /** Load settings and the last-played mode, once. `scope` is the edition's reach; the desktop edition plays everything. */
  boot: (scope?: PlayScope) => void;
  /** Leave the title screen and start (or continue) playing. */
  play: () => void;
  act: (action: Action) => boolean;
  advance: () => void;
  tick: (dt: number) => void;
  /** Guided Mode: pause the clock and advance exactly `count` game seconds, stopping early where running would. */
  stepSeconds: (count: number) => void;
  select: (id: EquipmentId | null) => void;
  hover: (id: EquipmentId | null) => void;
  setAffected: (ids: EquipmentId[], action?: Action | null) => void;
  setSpotlight: (ids: string[]) => void;
  focusCamera: (anchor: string) => void;
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
  saveNow: (quiet?: boolean) => boolean;
  /** Replace the current company with an exported save. Returns false if the file is not a usable save. */
  importSave: (raw: string) => boolean;
  /** Resume a validated copy of the pre-update save in Classic, retaining original bytes. */
  resumeLegacySave: () => boolean;
  finishOnboarding: () => void;
  showOnboarding: () => void;
  /** Show a guide from its first step; `from` says what asked, for the analytics (the menu unless told otherwise). */
  startTour: (track: TourTrack | "campaign", from?: TourStart) => void;
  tourNext: () => void;
  tourBack: () => void;
  endTour: (completed: boolean) => void;
  dismissChapterComplete: () => void;
  /** Begin the walkthrough, restarting the intro run first if this one is already under way. */
  startTutorialRun: (from?: TourStart) => void;
  rate: (rating: number) => void;
  /** Change the sound settings, remembered for next time. Volumes are clamped to 0–100. */
  setAudio: (patch: Partial<AudioSettings>) => void;
  /** Silence music and effects, or bring them back at their volumes. With both volumes at 0 there is nothing to bring back, so they return to the defaults. */
  toggleMute: () => void;
  /** Change the graphics settings, remembered for next time. An unknown quality is ignored; the field of view is kept in range. */
  setGraphics: (patch: Partial<GraphicsSettings>) => void;
  notify: (text: string, kind?: Toast["kind"]) => void;
  dismissToast: () => void;
}

let toastId = 1;
let actionId = 1;
let introId = 1;
const intro = (kind: IntroKind): LastIntro => ({ id: introId++, kind });
let tourEventId = 1;
let lastIncidentSave = 0;


const ACKNOWLEDGEMENTS = {
  "reliability-review": "acknowledge_reliability",
  "prevention-review": "acknowledge_prevention_review",
  "spike-acknowledgement": "acknowledge_spikes",
} as const;
/** The only action accepted while a recognition or milestone awaits the player; time stays paused meanwhile. */
function requiredAcknowledgement(c: Campaign): Action["type"] | null {
  const stop = pendingStop(c);
  if (stop === "combined-review") return c.combinedStage?.finalReview ? "complete_campaign" : "acknowledge_growth";
  if (stop) return ACKNOWLEDGEMENTS[stop];
  return c.openingMilestone && !c.openingMilestone.acknowledged && (!c.launchWeek || c.launchWeek.completedStep !== null) ? "acknowledge_milestone" : null;
}
const awaitingAcknowledgement = (c: Campaign) => requiredAcknowledgement(c) !== null;
/** Whether Guided Mode's clock may move now, by Run or by a manual step: never behind a guide, a pause-only view or an acknowledgement. */
/**
 * Whether the server floor shows only the request path. It is Guided Mode's alone, and the player's choice.
 */
export function trafficViewOn(s: { game: GameState; meta: Meta }): boolean {
  const c = s.game.campaign;
  return !!c && !!s.meta.trafficView;
}

export function campaignClockAvailable(s: { game: GameState; started: boolean; tour: Tour | null; view: View }): boolean {
  const c = s.game.campaign;
  return !!c && s.started && !awaitingAcknowledgement(c) && !["menu", "tech", "scorecard"].includes(s.view ?? "")
    && (s.game.phase === "management" || s.game.phase === "incident");
}
/** The run in a stored Campaign save, for naming its backup when that save is not the active game. */
function storedRunId(raw: string): string {
  try { const runId = (JSON.parse(raw) as { runId?: unknown }).runId; return typeof runId === "string" ? runId : "unreadable"; }
  catch { return "unreadable"; }
}

export const useGame = create<Store>()((set, get) => {
  let accountRequest = 0;
  /** When walk mode last began, for how long it lasted. */
  let walkStart = 0;
  function persist(explicitReset=false):boolean {
    const finish = (saved: boolean) => {
      const saveStatus = saved ? "saved" : "unsaved";
      if (get().saveStatus !== saveStatus) set({ saveStatus });
      return saved;
    };
    const s=get();
    if(s.mode === "classic") return finish(saveClassicGame(s.game));
    if(s.saveBlocked)return finish(false);
    if(!s.hasRun)return finish(true);
    if (s.tutorialCompany) {
      const saved = saveTutorialPractice(s.tutorialCompany.game.campaign!.runId, s);
      if (!saved) s.notify("Practice progress could not be saved. Your company save is unchanged.", "error");
      if (saved && archiveEvents(s.measurement.pending)) set({measurement:{...s.measurement,pending:[]}});
      return finish(saved);
    }
    const saved=saveGame(s.game,s.remainderMs,explicitReset,s.measurement);
    try { if (saved) checkpointCloud(makeEnvelope(s.game,s.remainderMs,Date.now(),s.measurement)); }
    catch { s.notify("Saved in this browser, but its cloud copy could not be kept. Download a backup from Menu, Saves before replacing this company.","error"); return finish(false); }
    if(saved && archiveEvents(s.measurement.pending)) {
      set({measurement:{...s.measurement,pending:[]}});
      return finish(true);
    }
    s.notify("Storage could not preserve all progress or playtest records. Keep this tab open and export from the menu.","error");
    return finish(false);
  }
  function uiEvent(name:string,data:Record<string,string|number|boolean|null>={}) {
    get().measureTime();
    const m=structuredClone(get().measurement);
    event(m,get().game,name,data);set({measurement:m});
  }
  /**
   * Record a walkthrough starting or ending in its mode's local records (Guided Mode's playtest events, Challenge
   * Mode's prototype analytics) and hand it to product analytics. Call once its game is the active one.
   */
  function recordTour(kind: TourEvent["kind"], tour: Tour, detail: Pick<TourEvent, "from" | "reason"> = {}): void {
    if (!isWalkthrough(tour.track)) return;
    const { from, reason } = detail;
    const ev: TourEvent = { id: tourEventId++, track: tour.track, kind, step: tour.step, ...(from ? { from } : {}), ...(reason ? { reason } : {}) };
    track(`tutorial_${kind}`, kind === "started" ? { from: from ?? null } : { step: ev.step });
    set({ lastTour: ev });
  }
  /** The profile with the walkthrough done, saved; a failed save is reported and the walkthrough stays done for the visit. */
  function walkthroughDone(meta: Meta): Meta {
    const next = { ...meta, tutorialDone: true, onboarded: true, walkthroughStep: null, walkthroughFurthestStep: 0 };
    if (!saveMeta(next, get().mode)) get().notify("Onboarding preferences could not be saved.", "error");
    return next;
  }
  function chapterAnnounced(meta: Meta, runId: string, chapter: ChapterCompletion): boolean {
    return meta.chapterCompletions?.runId === runId && meta.chapterCompletions.chapters.includes(chapter);
  }
  /** Each company keeps its own record; a new company replaces the last one's. */
  function announceChapter(meta: Meta, runId: string, chapter: ChapterCompletion): Meta {
    const chapters = meta.chapterCompletions?.runId === runId ? meta.chapterCompletions.chapters : [];
    return { ...meta, chapterCompletions: { runId, chapters: [...chapters, chapter] } };
  }
  /** The profile flag marking a Launch Week practice company, saved. A failed save only loses the flag. */
  function practiceAt(meta: Meta, practicing: boolean): Meta {
    const next = { ...meta, walkthroughStep: practicing ? 0 : null, walkthroughFurthestStep: 0 };
    saveMeta(next, get().mode);
    return next;
  }
  /** The change that takes the view to `floor`, recorded for the analytics; nothing if it is there already. */
  function floorPatch(floor: Floor, how: FloorSwitch): Partial<Store> {
    if (get().floor === floor) return {};
    if (get().game.campaign) uiEvent("floor_switched", { to: floor, how });
    else track("floor_switched", { to: floor, how, mode: get().mode });
    // Unsaved, the choice still applies for this visit.
    saveExploration(get().mode, { floor });
    return { floor };
  }
  /**
   * How the room is seen as the title screen gives way to a mode's run on `floor`. A `?floor=` address shows that
   * floor from above. A player who has never chosen how to see the room starts in third person, unless a guide is
   * about to point things out, which it does from above. Otherwise walk mode comes back as the last visit left it,
   * with its view, when it was on this floor.
   */
  function openingView(mode: GameMode, floor: Floor, guided: boolean): { walking: boolean; viewpoint: Viewpoint } {
    const overview = { walking: false, viewpoint: "overview" as const };
    if (typeof window !== "undefined" && floorFromSearch(window.location.search) !== null) return overview;
    const exploration = loadExploration(mode);
    // A phone opens from above, where its layout is made to be read, and has no first person to come back to.
    const phone = isPhoneEdition();
    const opened = !exploration.viewChosen
      ? (guided || phone ? overview : { walking: true, viewpoint: "follow" as const })
      : exploration.walking && exploration.floor === floor ? { walking: true, viewpoint: offeredViewpoint(exploration.viewpoint, phone) } : overview;
    // The walk is timed from here, like one the player starts.
    if (opened.walking) walkStart = performance.now();
    return opened;
  }
  /** Guides point at the room from above: a walk the player never chose gives way to one, and is not remembered as left. */
  function makeWayForGuide(): void {
    if (get().walking && !loadExploration(get().mode).viewChosen) get().setWalking(false, false);
  }
  /** An event for the analytics, wherever this mode keeps them. */
  function record(name: "view_changed" | "map_toggled" | "map_walked", data: Record<string, string | number | boolean>) {
    if (get().game.campaign) uiEvent(name, data);
    else track(name, { ...data, mode: get().mode });
  }
  /** The unlock already earned in memory, or the one durable in the campaign profile/save. */
  function challengeUnlockedNow():boolean {
    return challengeAvailable(get()) || challengeUnlocked();
  }
  /** Apply a new game state, record analytics for phase changes and save. */
  function commit(next: GameState, opts: { save?: boolean } = {}): void {
    const prev = get().game;
    if(next.campaign) {
      const was=prev.campaign, c=next.campaign;
      const patch:Partial<Store>={game:next};
      if(!was?.firstPauseConsumed && c.firstPauseConsumed)patch.running=false;
      if(get().selectedAppId&&!c.apps.some(a=>a.id===get().selectedAppId))patch.selectedAppId=c.apps[0].id;
      if(awaitingAcknowledgement(c)||next.phase==="review"||next.phase==="ended")patch.running=false;
      // Finishing Scaling & Routing or Data Strategy pauses to say so the first time only; the chapter bar keeps the
      // way forward. A chapter already finished when the company loaded is remembered without being announced.
      const sameRun=was?.runId===c.runId, before=sameRun?finishedChapter(prev):null, finished=finishedChapter(next);
      let meta=get().meta;
      if(before&&!chapterAnnounced(meta,c.runId,before))meta=announceChapter(meta,c.runId,before);
      if(finished&&!chapterAnnounced(meta,c.runId,finished)) {
        meta=announceChapter(meta,c.runId,finished);
        if(sameRun)Object.assign(patch,{chapterComplete:finished,running:false});
      }
      else if(!finished&&get().chapterComplete)patch.chapterComplete=null;
      if(meta!==get().meta) {
        saveMeta(meta);
        patch.meta=meta;
      }
      // The first acknowledged reliability outcome permanently unlocks Challenge Mode, as does finishing a smaller
      // edition's Guided Mode (the phone edition's ends with Scaling & Routing).
      const scopeDone=scopeComplete(get().scope,next);
      if(((!was?.reliabilityStage?.acknowledged && c.reliabilityStage?.acknowledged) || scopeDone) && !(patch.meta??get().meta).challengeUnlocked) {
        const meta={...(patch.meta??get().meta),challengeUnlocked:true};
        saveMeta(meta);
        patch.meta=meta;
      }
      // Entering a chapter closes any guide still open from before, and shows the chapter's own guide once, paused.
      // A walkthrough left open through the Opening ends there; short of its last step it is not done, so the next
      // company offers it again.
      const chapter=chapterTourOf(c);
      if(chapter && was && chapter!==chapterTourOf(was)) {
        const open=get().tour;
        if(open) patch.tour=null;
        const seen=(patch.meta??get().meta).chapterTours;
        if(!seen.includes(chapter)) {
          makeWayForGuide();
          const meta={...(patch.meta??get().meta),chapterTours:[...seen,chapter]};
          saveMeta(meta);
          Object.assign(patch,{meta,tour:{track:chapter,step:0},running:false});
        }
      }
      // The first settled operating week explains itself once, paused, at the first calm moment in the Opening
      // (its incident can still be running when the week settles), unless another guide is already showing.
      const tips=(patch.meta??get().meta).tipsSeen??[];
      if(was?.runId===c.runId&&c.settlements.length>0&&!tips.includes("settlement")&&!chapterTourOf(c)&&!get().tutorialCompany
        &&!get().tour&&!patch.tour&&next.phase==="management"&&!awaitingAcknowledgement(c)) {
        const meta={...(patch.meta??get().meta),tipsSeen:[...tips,"settlement" as const]};
        saveMeta(meta);
        Object.assign(patch,{meta,tour:{track:"settlement",step:0},running:false});
      }
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
    // Where this mode was last left: a `?floor=` address wins, and walk mode only resumes when it applies.
    const exploration = loadExploration(mode);
    const urlFloor = typeof window === "undefined" ? null : floorFromSearch(window.location.search);
    const fresh: Partial<Store> = {
      hasRun: false, measurement: emptyMeasurement(), activeMark: null, tutorialCompany: null,
      ready: true,
      mode,
      started,
      generation: get().generation + 1,
      lastAction: null,
      lastIntro: null,
      meta,
      running: false,
      weekRush: false,
      floor: urlFloor ?? exploration.floor,
      // Only a Challenge Mode run opens here: Guided Mode's starts at the title screen, and Play picks the view.
      walking: false,
      viewpoint: "overview",
      remainderMs: 0,
      saveBlocked: false,
      saveStatus: "unsaved",
      panelOpen: true,
      selected: null,
      selectedAppId: null,
      roomInspection: null,
      hovered: null,
      affected: [], previewAction: null, spotlight: [],
      cameraFocus: null,
      view: null,
      techFocus: null,
      onboarding: false,
      tour: null,
      chapterComplete: null,
      lastTour: null,
      rating: null,
      toast: null,
    };
    if (mode === "classic") {
      const loaded = loadClassicGame();
      if (loaded.status === "ok") {
        track("save_resumed", { mode, week: loaded.game.turn, phase: loaded.game.phase });
        const tour: Tour | null = !meta.tutorialDone && isFreshRun(loaded.game) ? { track: "basics", step: 0 } : null;
        // A run resumed mid-incident starts paused so nothing burns while the player reorients.
        set({ ...fresh, game: loaded.game, tour, ...(started ? openingView(mode, urlFloor ?? exploration.floor, !!tour) : {}) });
        if (tour) recordTour("started", tour, { from: "resume" });
        return;
      }
      const game = newLegacyGame(BALANCE.introSeed);
      const nextMeta = { ...meta, runsStarted: meta.runsStarted + 1 };
      saveMeta(nextMeta, mode);
      const saved = saveClassicGame(game);
      track("run_started", { mode, seed: game.seed, run: nextMeta.runsStarted });
      const tour: Tour | null = meta.tutorialDone ? null : { track: "basics", step: 0 };
      // Switching into an empty classic mode starts a company; boot, which only shows the title, does not.
      set({ ...fresh, game, meta: nextMeta, tour, lastIntro: started ? intro("begin") : null, ...(started ? openingView(mode, urlFloor ?? exploration.floor, !!tour) : {}) });
      if (tour) recordTour("started", tour, { from: "first_visit" });
      if (!saved) get().notify("Could not save. Play continues in memory.", "error");
      else if (loaded.status === "corrupt") get().notify("Saved Challenge Mode run was unreadable. Started a new one.", "error");
      return;
    }
    const loaded = loadGame();
    if (loaded.status === "ok") {
      const practice = meta.walkthroughStep !== null ? loadTutorialPractice(loaded.game.campaign!.runId) : null;
      set({ ...fresh, started: false, hasRun: true, game: loaded.game, remainderMs: loaded.remainderMs, measurement: loaded.measurement,
        ...(practice ? { game: practice.game, remainderMs: practice.remainderMs, measurement: practice.measurement,
          tutorialCompany: { game: loaded.game, remainderMs: loaded.remainderMs, measurement: loaded.measurement }, meta: { ...meta, walkthroughStep: 0, walkthroughFurthestStep: 0 } } : {}) });
    } else {
      set({ ...fresh, started: false, game: newGame(BALANCE.introSeed, "headless-run", 2), saveBlocked: loaded.status !== "none" });
      if (loaded.status !== "none") get().notify("Existing save could not be loaded. It has been preserved. Export it from the menu before explicitly starting a new company.", "error");
    }
    if (started) get().play();
  }

  const SIGNED_IN='Signed in. Nothing is uploaded until you choose Save to cloud.';
  function accountFailure(error:unknown) {
    if(error instanceof AccountApiError && error.status===401)set({accountSession:null,accountStatus:'guest'});
    // fetch failures (TypeError) and unreadable responses (SyntaxError) carry browser wording, not ours.
    const ours=error instanceof Error&&!(error instanceof TypeError)&&!(error instanceof SyntaxError);
    set({cloudStatus:ours?error.message:'Cloud saves are unavailable right now. Your local save is unchanged.'});
  }
  /** Email sign-in answers in place, so the session is set here instead of after a page reload. */
  async function emailSession(request:()=>Promise<AppSession>):Promise<string|null> {
    if(get().cloudBusy)return 'Wait for the current cloud action to finish.';
    ++accountRequest;set({cloudBusy:true});
    try {const session=await request();set({accountSession:session,accountStatus:'signed-in',cloudRuns:[],cloudConflict:null,cloudStatus:SIGNED_IN});return null;}
    catch(error){return error instanceof AccountApiError?error.message:'Accounts are unavailable right now. You can keep playing; progress saves in this browser.';}
    finally{set({cloudBusy:false});}
  }
  function currentEnvelope() { const s=get().tutorialCompany ?? get();if (!s.game.campaign) throw Error("Cloud saves are for Guided Mode. Challenge Mode progress stays in this browser.");return makeEnvelope(s.game,s.remainderMs,Date.now(),s.measurement); }
  function ownSession() {const session=get().accountSession;if(!session)throw Error('Sign in first. Your local save is unchanged.');return session;}
  return {
    prepareSignIn:()=>{set({running:false});return !get().hasRun||persist();},
    accountSession:null, accountStatus:'unchecked', cloudStatus:'Local progress stays in this browser.', cloudBusy:false, cloudRuns:[], cloudConflict:null,
    restoreAccount: async()=>{
        if(get().accountStatus==='checking'||get().cloudBusy)return;
        const request=++accountRequest;
        set({accountStatus:'checking'});
        try {const session=await getSession();if(request!==accountRequest)return;set({accountSession:session,accountStatus:'signed-in',cloudRuns:[],cloudStatus:SIGNED_IN});}
        catch(error){if(request!==accountRequest)return;const outcome=new URLSearchParams(window.location.search).get('auth'),guest=error instanceof AccountApiError&&error.status===401;
          set({accountSession:null,accountStatus:guest?'guest':'unavailable',cloudStatus:outcome==='cancelled'?'Google sign-in was cancelled. Your local save is unchanged.':outcome==='failed'?'Google sign-in failed. Your local save is unchanged.':guest?'Playing as a guest. Progress saves in this browser.':'Accounts are unavailable right now. You can keep playing; progress saves in this browser.'});}
    },
    signInWithEmail:(email,password)=>emailSession(()=>emailLogin(email,password)),
    registerWithEmail:(name,email,password)=>emailSession(()=>emailRegister(email,password,name)),
    signOut: async()=>{
        if(get().cloudBusy)return;
        ++accountRequest;
      set({cloudBusy:true,accountStatus:get().accountSession?'signed-in':get().accountStatus});
      try {const session=ownSession();await logout(session.csrfToken);set({accountSession:null,accountStatus:'guest',cloudRuns:[],cloudConflict:null,cloudStatus:'Signed out. Your local save stays in this browser.'});}
      catch(error){accountFailure(error);}
      finally{set({cloudBusy:false});}
    },
    refreshCloudRuns: async()=>{
      if(get().cloudBusy)return false;set({cloudBusy:true});
      try {const session=ownSession();const runs=await listRuns();if(get().accountSession!==session)return false;set({cloudRuns:runs});return true;}
      catch(error){accountFailure(error);return false;}finally{set({cloudBusy:false});}
    },
    saveCloud: async(attach=false)=>{
      if(get().cloudBusy)return;set({cloudBusy:true});
      let envelope:SaveEnvelope|undefined;
      try {
        const session=ownSession();if(!get().hasRun||get().saveBlocked)throw Error('Start a Guided Mode game before saving it to the cloud.');
        get().measureTime();envelope=currentEnvelope();
        if(validateEnvelope(envelope).status!=='ok')throw Error('This save could not be checked. Download a backup before replacing it.');
        const copy=localCloudCopy(envelope.runId);
        if(copy&&copy.ownerId!==session.account.id)throw Error('This local save belongs to another account. It stays in this browser.');
        if(!copy&&!attach)throw Error('Save this game to the cloud first.');
        if(copy?.remote)throw Error('Choose which version to keep first. Both are kept.');
        rememberCloud({ownerId:session.account.id,revision:copy?.revision??0,local:envelope});
        const game=get().game;
        const saved=await putRun(envelope,copy?.revision??0,session.csrfToken);
        if(get().accountSession!==session)return;
        if(saved.runId!==envelope.runId || !Number.isSafeInteger(saved.revision) || saved.revision<1)throw Error('The cloud did not confirm the save. Your local save is unchanged.');
        rememberCloud({ownerId:session.account.id,revision:saved.revision,local:currentEnvelope()});
        set({cloudConflict:null,cloudStatus:get().game===game?'Saved to the cloud.':'Saved to the cloud. Progress made since then is only in this browser.'});
      } catch(error) {
        if(error instanceof AccountApiError&&error.status===409&&error.detail.current&&envelope) {
          set({cloudConflict:error.detail.current});
          try {
            const copy=localCloudCopy(envelope.runId)!;rememberCloud({...copy,local:currentEnvelope(),remote:error.detail.current});
            set({cloudStatus:'The cloud has a different version of this save. Both are kept: choose which to continue.'});
          } catch {set({cloudStatus:'Both versions could not be stored. Keep this tab open and download a backup before continuing.'});}
        } else accountFailure(error);
      } finally{set({cloudBusy:false});}
    },
    keepLocalConflict: async()=>{
      if(get().cloudBusy)return;
      try {
        const session=ownSession(),e=currentEnvelope(),copy=localCloudCopy(e.runId);
        if(!copy||copy.ownerId!==session.account.id||!copy.remote)throw Error('There is no conflict for this save.');
        const remote=copy.remote as CloudRun;
        // Preserve both exact versions before an explicit revision-conditional overwrite.
        localStorage.setItem(`nn.campaign.conflict.${e.runId}.${remote.revision}`,JSON.stringify({local:e,remote}));
        rememberCloud({...copy,local:e,revision:remote.revision,remote:undefined});set({cloudConflict:null});
        await get().saveCloud();
      }catch(error){accountFailure(error);}
    },
    resumeCloud: async(runId)=>{
      if(get().cloudBusy)return false;set({cloudBusy:true,running:false});
      try {
        const session=ownSession(),before=get().game,run=await getRun(runId);
        if(get().accountSession!==session||get().game!==before)throw Error('Your local game changed while loading. Pause and try again.');
        const validated=validateEnvelope(run.envelope);
        if(validated.status!=='ok')throw Error('This cloud save is from a different version of the game. Your local save is unchanged.');
        const s=get(),e=validated.envelope,game=validated.game;
        if(e.runId!==runId)throw Error('This cloud save does not match the one requested.');
        // The home screen can load a cloud save while Classic is active: keep that run before leaving it.
        if(s.mode==='classic'&&!saveClassicGame(s.game))throw Error('Your Challenge Mode game could not be saved first. Your local saves are unchanged.');
        // Refuse replacement unless current bytes and all account copies are durably retained.
        const original=localStorage.getItem('nn.campaign.save.v1');
        if(original!==null)localStorage.setItem(`nn.campaign.before-cloud.${s.game.campaign?.runId??storedRunId(original)}`,original);
        if(s.mode==='campaign'&&s.hasRun)localStorage.setItem(`nn.campaign.before-cloud.${s.game.campaign!.runId}.pending`,JSON.stringify(currentEnvelope()));
        const previous=localCloudCopy(runId);
        if(previous&&previous.ownerId!==session.account.id)throw Error('This save belongs to another account in this browser.');
        if(previous)localStorage.setItem(`nn.campaign.before-cloud.${runId}.owner-copy`,JSON.stringify(previous));
        localStorage.setItem(`nn.campaign.before-cloud.${runId}.cloud.${run.revision}`,JSON.stringify(run));
        rememberCloud({ownerId:session.account.id,revision:run.revision,local:e});
        if(!saveGame(game,e.runtime.remainderMs,true,e.runtime.measurement))throw Error('This browser could not store the cloud save. Your local save is unchanged.');
        saveMode("campaign");
        set({tutorialCompany:null,mode:"campaign",...(s.mode==='classic'?{meta:loadMeta("campaign"),tour:null}:{}),chapterComplete:null,game,generation:get().generation+1,lastAction:null,lastIntro:null,measurement:e.runtime.measurement,remainderMs:e.runtime.remainderMs,hasRun:true,saveBlocked:false,
          running:false,started:false,onboarding:false,view:null,selected:null,selectedAppId:null,activeMark:null,cloudConflict:null,cloudStatus:'Cloud save loaded. Continue when ready.'});
        return true;
      }catch(error){accountFailure(error);return false;}finally{set({cloudBusy:false});}
    },
    hasRun: false, measurement: emptyMeasurement(), activeMark: null, importGeneration: 0,
    mode: "campaign",
    remainderMs: 0,
    saveBlocked: false,
    saveStatus: "unsaved",
    ready: false,
    started: false,
    game: newGame(BALANCE.introSeed, "headless-run", 2),
    generation: 0,
    tutorialAttempt: 0,
    tutorialCompany: null,
    lastAction: null,
    lastIntro: null,
    meta: loadMetaSafe(),
    audio: loadAudioSafe(),
    graphics: loadGraphicsSafe(),
    selected: null,
    selectedAppId: null,
    panelOpen: true,
    setPanelOpen: open => set({panelOpen: open}),
    panelTab: "analysis",
    setPanelTab: tab => set({panelTab: tab}),
    selectApp: id => { if (get().game.campaign?.apps.some(a => a.id === id)) set({panelOpen:true,panelTab:"analysis",selected:"app",selectedAppId:id,...floorPatch("servers","select")}); },
    roomInspection: null,
    dismissRoomInspection: () => set({ roomInspection: null }),
    // The server floor first: the machines are what the opening, the tutorial's first step and every incident are about.
    floor: (typeof window === "undefined" ? null : floorFromSearch(window.location.search)) ?? "servers",
    goToFloor: (floor, how) => set(floorPatch(floor, how)),
    walking: false,
    setWalking: (on, remember = true) => {
      if (on === get().walking) return;
      const now = performance.now();
      const data: Record<string, string | number> = on ? { floor: get().floor } : { seconds: Math.round((now - walkStart) / 1000) };
      if (get().game.campaign) uiEvent(on ? "walk_started" : "walk_ended", data);
      else track(on ? "walk_started" : "walk_ended", { ...data, mode: get().mode });
      if (on) walkStart = now;
      // The views from the avatar end with the walk.
      const from = get().viewpoint;
      if (!on && from !== "overview") record("view_changed", { from, to: "overview", how: "walk_ended" });
      set(on ? { walking: true } : { walking: false, viewpoint: "overview" });
      // Remembering is skipped by the title screen's automatic stop: that is not the player's choice to leave.
      if (remember) saveExploration(get().mode, { floor: get().floor, walking: on, viewChosen: true, ...(on ? {} : { viewpoint: "overview" as const }) });
    },
    viewpoint: "overview",
    setViewpoint: (asked, how) => {
      const s = get();
      const v = offeredViewpoint(asked, isPhoneEdition());
      if (!s.started) return;
      if (fromAvatar(v) && !s.walking) s.setWalking(true);
      const from = get().viewpoint;
      if (v === from) return;
      record("view_changed", { from, to: v, how });
      set({ viewpoint: v });
      // The whole choice: a walk the run opened in by default was never stored.
      saveExploration(get().mode, { floor: get().floor, walking: get().walking, viewpoint: v, viewChosen: true });
    },
    mapOpen: false,
    setTrafficView: (on) => {
      const meta = get().meta;
      if (!!meta.trafficView === on) return;
      const next = { ...meta, trafficView: on };
      saveMeta(next, get().mode);
      set({ meta: next });
    },
    openLaunchDoors: () => {
      const game = get().game, c = game.campaign;
      if (!c?.launchWeek || c.launchWeek.doorsOpened) return;
      // The save replays inputs, not this flag: the receipt survives reloads the way the recovery notice does.
      try { localStorage.setItem(`99.99.launch-doors:${c.runId}`, "1"); } catch { /* storage may be unavailable; the letter simply replays */ }
      set({ game: { ...game, campaign: { ...c, launchWeek: { ...c.launchWeek, doorsOpened: true } } } });
    },
    setMapOpen: (open) => {
      if (open === get().mapOpen) return;
      record("map_toggled", { open });
      set({ mapOpen: open });
      // Unsaved, the choice still applies for this visit.
      saveMapOpen(open);
    },
    noteMapWalk: () => record("map_walked", { floor: get().floor }),
    controls: { ...DEFAULT_CONTROLS },
    setControls: (patch) => {
      const now = get().controls;
      const controls: ControlSettings = {
        lookSpeed: patch.lookSpeed === undefined ? now.lookSpeed : clampLookSpeed(patch.lookSpeed),
        invertY: typeof patch.invertY === "boolean" ? patch.invertY : now.invertY,
      };
      if (controls.lookSpeed === now.lookSpeed && controls.invertY === now.invertY) return;
      set({ controls });
      // Unsaved settings still apply for this visit.
      saveControls(controls);
    },
    avatar: DEFAULT_AVATAR,
    setAvatar: (id) => {
      if (id === get().avatar) return;
      if (get().game.campaign) uiEvent("avatar_changed", { avatar: id });
      else track("avatar_changed", { avatar: id, mode: get().mode });
      set({ avatar: id });
      // Unsaved, the choice still applies for this visit.
      saveAvatar(id);
    },
    hovered: null,
    affected: [], previewAction: null, spotlight: [],
    cameraFocus: null,
    view: null,
    techFocus: null,
    running: false,
    speed: 1,
    weekRush: false,
    toast: null,
    onboarding: false,
    tour: null,
    chapterComplete: null,
    lastTour: null,
    rating: null,
    scope: FULL_SCOPE,

    boot: (scope = FULL_SCOPE) => {
      if (get().ready) return;
      set({ scope });
      // Read once here, not on every mode switch: if storage fails, the in-memory settings are the ones to keep.
      // The map starts folded away until the player opens it, so the room has its corner to itself.
      set({ audio: loadAudio(), graphics: loadGraphics(), avatar: loadAvatar(), controls: loadControls(), mapOpen: loadMapOpen() ?? false });
      enter(loadMode(), false);
    },

    play: () => {
      if(get().started)return;
      // A fresh classic run says "Play" on the title screen and a resumed one "Continue", so only the first is a start.
      if(get().mode === "classic") { set({started:true,...openingView("classic",get().floor,!!get().tour),...(isFreshRun(get().game)?{lastIntro:intro("begin")}:{})}); return; }
      const state=get();
      // Practice resume is offered by the saved flag; a fresh visit plays the company itself.
      if (state.hasRun && state.meta.walkthroughStep !== null && !state.tutorialCompany) { get().startTour("campaign", "resume"); return; }
      let game=state.hasRun?state.game:newGame(BALANCE.introSeed,crypto.randomUUID(),2);
      if (game.campaign!.openingMilestone?.acknowledged && !game.campaign!.scaling && game.phase!=="ended") game=applyCampaignInput(game,{type:"enter_scaling"}).state;
      const meta=state.hasRun?state.meta:{...state.meta,runsStarted:state.meta.runsStarted+1};
      const measurement=projectEvents(beginSession(state.measurement,game,crypto.randomUUID(),new Date().toISOString()),game,new Date().toISOString());
      set({game,hasRun:true,meta,measurement,started:true,running:false,...openingView("campaign",state.floor,!state.hasRun && !meta.tutorialDone),
        // Starting a fresh company replaces the game, like a new run.
        ...(state.hasRun?{}:{generation:state.generation+1,lastAction:null,lastIntro:intro("begin")}),
        tour:null,activeMark:document.hidden?null:performance.now()});
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
    act: (action) => {
      const c = get().game.campaign;
      const acknowledgement = c && requiredAcknowledgement(c);
      if(c && (!get().started || (acknowledgement && action.type !== acknowledgement))) return false;
      // A smaller edition stops at its last chapter; the company carries on operating there.
      if(c && !scopeAllows(get().scope, action)) { get().notify(get().scope.endOfGuided, "info"); return false; }
      const record = (ok: boolean) => set({ lastAction: { id: actionId++, type: action.type, ok } });
      if (c) {
        // Rejections are recorded too: they are part of the campaign's history and its replay.
        const { state, result } = applyCampaignInput(get().game, action);
        if (result.ok && ["enter_data","enter_spikes","acknowledge_spikes","enter_reliability","acknowledge_reliability","enter_combined","start_growth_wave","acknowledge_growth","complete_campaign","accept_scaling_risk"].includes(action.type)) set({running:false});
        record(result.ok);
        commit(state);
        if (!result.ok) get().notify(result.message, "error");
        return result.ok;
      }
      const result = applyAction(get().game, action);
      record(result.ok);
      if (!result.ok) {
        get().notify(result.message, "error");
        return false;
      }
      commit(result.state);
      return true;
    },

    advance: () => {
      const { game } = get();
      if (game.phase !== "management" || (game.campaign && (!get().started || awaitingAcknowledgement(game.campaign)))) return;
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
        if(!get().started || awaitingAcknowledgement(game.campaign) || !running||!Number.isFinite(dt)||dt<=0||game.phase==="review"||game.phase==="ended")return;
        const credit=get().remainderMs+Math.round(dt*1000*(get().weekRush?20:speed));
        const whole=Math.floor(credit/1000);
        set({remainderMs:credit%1000});
        if(whole===0)return;
        const result=advanceSteps(game,whole);
        if(result.stopReason)set({running:false});
        // A rush reverts to the chosen speed the moment a new incident opens or the week boundary lands;
        // an incident already open when the rush started does not block re-engaging it.
        const newIncident = result.state.campaign?.incident && result.state.campaign.incident.id !== game.campaign?.incident?.id;
        if(get().weekRush&&(result.stopReason||newIncident||result.state.turn!==game.turn)) {
          const patch:{weekRush:boolean;running?:boolean}={weekRush:false};
          if(!result.stopReason&&result.state.turn!==game.turn)patch.running=false;
          set(patch);
        }
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

    stepSeconds: (count) => {
      const s = get(), { game } = s;
      if (!game.campaign || !campaignClockAvailable(s) || !Number.isSafeInteger(count) || count <= 0) return;
      // A manual step replaces auto-run, and any part-second credit belongs to the run it came from.
      if (s.running) set({ running: false, weekRush: false });
      set({ remainderMs: 0 });
      commit(advanceSteps(game, count).state);
    },

    // Choosing equipment asks to read it, so the panel brings its readings forward.
    select: id => set({...(id ? {panelOpen:true,panelTab:"analysis" as const} : {}),selected:id,selectedAppId:id==="app"?(get().selectedAppId??"app-1"):null,...(id?floorPatch(floorOf(id),"select"):{})}),
    hover: (id) => {
      if (get().hovered !== id) set({ hovered: id });
    },
    setAffected: (ids, action = null) => {
      const was = get().affected;
      if (was.length !== ids.length || was.some((id, i) => id !== ids[i])) set({ affected: ids });
      if (JSON.stringify(get().previewAction) !== JSON.stringify(action)) set({ previewAction: action });
    },
    setSpotlight: (ids) => {
      const was = get().spotlight;
      if (was.length !== ids.length || was.some((id, i) => id !== ids[i])) set({ spotlight: ids });
    },
    focusCamera: (anchor) => set({ cameraFocus: { anchor, seq: (get().cameraFocus?.seq ?? 0) + 1 } }),
    openView: (view) => {
      const campaign = !!get().game.campaign;
      if (campaign && view === "tech" && get().view !== "tech") uiEvent("technology_tree_opened");
      if (campaign && view === "scorecard" && get().view !== "scorecard") uiEvent("scorecard_viewed");
      if (campaign && view && !["menu", "history", "tech", "guidance", "scorecard"].includes(view)) return;
      set({ view });
      if (view === "menu" || (campaign && (view === "tech" || view === "scorecard"))) get().setRunning(false);
    },
    focusTech: (id) => {
      if (id && get().game.campaign) uiEvent("technology_node_selected", { techId: id });
      set({ techFocus: id, view: id ? "tech" : get().view });
      if (id && get().game.campaign) get().setRunning(false);
    },
    setRunning: (running) => {
      set({ running: running && (!get().game.campaign || (get().started && !awaitingAcknowledgement(get().game.campaign!))) && get().view!=="menu" && !(get().game.campaign && ["tech","scorecard"].includes(get().view??"")) && !document.hidden && !["review","ended"].includes(get().game.phase), ...(running ? {} : { weekRush: false }) });
      if (!running && !persist() && !get().saveBlocked) get().notify("Could not save. Play continues in memory.", "error");
    },
    setSpeed: (speed) => set({ speed, weekRush: false }),
    endWeek: () => { set({ weekRush: true }); get().setRunning(true); },
    cancelWeekRush: () => set({ weekRush: false }),

    newRun: (opts = {}) => {
      if(get().cloudBusy){get().notify("Wait for the cloud operation before replacing this company.","info");return;}
      if (get().tutorialCompany) get().endTour(false);
      try {if(get().hasRun && get().game.campaign)checkpointCloud(currentEnvelope());}
      catch {get().notify("Download a backup from Menu, Saves before replacing this company: its cloud copy could not be kept.","error");return;}
      if (get().mode === "campaign") {
      const replacementRunId=crypto.randomUUID();
      const old=get();
      if(old.started) {
        uiEvent("run_reset",{previousRunId:old.game.campaign!.runId,replacementRunId});
        if(old.game.campaign!.incident)uiEvent("incident_abandoned",{incidentId:old.game.campaign!.incident!.id});
        uiEvent("run_evidence",{campaign:JSON.stringify(old.game)});
        if(old.game.campaign?.scorecard)uiEvent("run_scorecard",{scorecard:JSON.stringify(old.game.campaign.scorecard)});
      }
      const pending=get().measurement.pending;
      let replaySeed=crypto.getRandomValues(new Uint32Array(1))[0]|0;
      if(replaySeed===old.game.seed)replaySeed=(replaySeed+1)|0;
      const game=newGame(opts.seed??replaySeed,replacementRunId,2);
      const m=emptyMeasurement();m.replayOf=old.hasRun?old.game.campaign!.runId:null;
      // Preserve unsaved old-run records in the same archive. Refuse reset if it cannot retain them.
      if(pending.length&&!archiveEvents(pending)) {
        get().notify("Export playtest records before resetting: the archive could not retain this run.","error");return;
      }
      const counted={...old.meta,runsStarted:old.meta.runsStarted+1};
      const measurement=beginSession(m,game,crypto.randomUUID(),new Date().toISOString());
      if(m.replayOf)event(measurement,game,"replay_started",{previousRunId:m.replayOf,seed:game.seed});
      clearTutorialPractice();
      set({game,tutorialCompany:null,generation:get().generation+1,lastAction:null,lastIntro:intro("begin"),measurement,hasRun:true,remainderMs:0,saveBlocked:false,meta:counted,
        selected:null,selectedAppId:null,hovered:null,affected:[],spotlight:[],view:null,techFocus:null,running:false,rating:null,
        onboarding:false,tour:null,started:true,toast:null,activeMark:document.hidden?null:performance.now()});
      saveMeta(counted);persist(true);
      return;
      }

      const { meta, mode, game: old } = get();
      const seed = opts.seed !== undefined && opts.seed !== "" ? opts.seed : Math.floor(Math.random() * 1_000_000_000);
      const game = mode === "classic" ? newLegacyGame(seed) : newGame(seed, crypto.randomUUID(), 2);
      const nextMeta = { ...meta, runsStarted: meta.runsStarted + 1 };
      saveMeta(nextMeta, mode);
      const saved = mode === "classic" ? saveClassicGame(game) : saveGame(game, 0, true);
      if (opts.voluntary) track("voluntary_replay", { previousOutcome: old.outcome, previousWeeks: old.totals.weeks });
      track("run_started", { mode, seed: game.seed, run: nextMeta.runsStarted });
      set({
        game,
        generation: get().generation + 1,
        lastAction: null,
        lastIntro: intro("begin"),
        remainderMs:0,
        saveBlocked:false,
        meta: nextMeta,
        selected: null,
        hovered: null,
        affected: [], previewAction: null, spotlight: [],
        view: null,
        techFocus: null,
        running: false,
        weekRush: false,
        rating: null,
        onboarding: false,
        tour: null,
        chapterComplete: null,
        started: true,
        toast: null,
      });
      if(!saved)get().notify("Could not save. Play continues in memory; export your company from the menu.","error");
    },

    switchMode: (mode, opts = {}) => {
      if(get().cloudBusy){get().notify("Wait for the cloud operation before replacing this company.","info");return false;}
      if (mode === get().mode) return true;
      if (mode === "classic" && !challengeUnlockedNow()) { get().notify(get().scope.challengeLocked, "info"); return false; }
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
      return saved;
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
      if (mode === "classic" && !challengeUnlockedNow()) { get().notify(get().scope.challengeLocked, "info"); return false; }
        // Preserve current progress and any owner-bound pending copy before replacement.
        if ((mode !== get().mode || get().hasRun) && !persist()) {
          get().notify("Could not save the current run. Export it before importing a replacement.", "error");
        return false;
      }
      const remainderMs = campaign.status === "ok" ? campaign.envelope.runtime.remainderMs : 0;
      const measurement = campaign.status === "ok" ? beginSession(campaign.envelope.runtime.measurement, game, crypto.randomUUID(), new Date().toISOString()) : emptyMeasurement();
      const saved = mode === "campaign" ? saveGame(game, remainderMs, true, measurement) && archiveEvents(measurement.pending) : saveClassicGame(game);
      saveMode(mode);
      set({ tutorialCompany: null, mode, importGeneration: get().importGeneration + 1, hasRun: mode === "campaign", measurement, activeMark: mode === "campaign" && !document.hidden ? performance.now() : null, meta: loadMeta(mode), game, generation: get().generation + 1, lastAction: null, lastIntro: null, remainderMs, saveBlocked: false, running: false, weekRush: false, view: null,
        selected: null, hovered: null, affected: [], previewAction: null, spotlight: [], started: true, tour: null, chapterComplete: null, onboarding: false, techFocus: null, rating: null });
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
      const musicOff = legacyMusicOff();
      if (!get().importSave(raw)) return false;
      const meta = loadLegacyMeta();
      saveMeta(meta, "classic");
      set({ meta });
      // The pre-update profile's music switch carries over; the volumes stay as they are.
      if (musicOff) get().setAudio({ muted: true });
      return true;
    },

    finishOnboarding: () => {
      const meta = { ...get().meta, onboarded: true };
      saveMeta(meta, get().mode);
      if (!get().meta.onboarded) track("onboarding_completed");
      set({ meta, onboarding: false });
    },
    showOnboarding: () => {
      // Guided Mode's rules are taught by its walkthrough, on the company itself.
      if (get().game.campaign) get().startTour("campaign");
      else set({ onboarding: true, view: null, lastIntro: intro("step") });
    },

    startTour: (track_, from = "menu") => {
      // Replaying Launch Week happens on a fresh practice company; the paused original keeps its own save and measurement.
      if (track_ === "campaign" && get().game.campaign) {
        get().measureTime();
        if (!persist()) return;
        const s = get();
        const company = s.tutorialCompany ?? { game: s.game, remainderMs: s.remainderMs, measurement: s.measurement };
        const game = newGame(BALANCE.introSeed, crypto.randomUUID(), 2);
        const measurement = beginSession(emptyMeasurement(), game, crypto.randomUUID(), new Date().toISOString());
        if (!saveTutorialPractice(company.game.campaign!.runId, { game, remainderMs: 0, measurement })) {
          s.notify("Could not start practice: browser storage is unavailable. Your company is unchanged.", "error");
          return;
        }
        const meta = practiceAt(s.meta, true);
        set({ game, measurement, tutorialCompany: company, meta, activeMark: document.hidden ? null : performance.now(), generation: s.generation + 1, remainderMs: 0,
          tour: null, view: null, started: true, running: false, weekRush: false, onboarding: false, tutorialAttempt: s.tutorialAttempt + 1,
          lastAction: null, lastIntro: null, chapterComplete: null, selectedAppId: null, roomInspection: null,
          affected: [], previewAction: null, spotlight: [], hovered: null, cameraFocus: null, techFocus: null, rating: null, toast: null });
        persist();
        return;
      }
      if (track_ === "campaign") return;
      makeWayForGuide();
      const campaign = !!get().game.campaign;
      const tour: Tour = { track: track_, step: 0 };
      const begins = get().tour?.track !== track_;
      set({ tour, tutorialAttempt: get().tutorialAttempt + 1, view: null, selected: null, running: false, onboarding: false, started: true, ...(campaign ? {} : { lastIntro: intro("begin") }) });
      if (begins) recordTour("started", tour, { from });
      // Guided Mode's playtest records are kept with the company.
      if (campaign && isWalkthrough(track_)) persist();
    },
    tourNext: () => {
      const tour = get().tour;
      if (!tour) return;
      const step = tour.step + 1;
      const next: Tour = { track: tour.track, step };
      set({ tour: next });
      if (!isWalkthrough(tour.track)) return;
      // Challenge Mode retains its short spotlight guide and records reaching the last step.
      if (tour.track === "basics" && next.step === lastStep(tour.track)) {
        recordTour("completed", next);
        set({ meta: walkthroughDone(get().meta) });
      }
      if (get().game.campaign) persist();
    },
    tourBack: () => {
      const tour = get().tour;
      if (tour) set({ tour: { ...tour, step: Math.max(0, tour.step - 1) } });
    },
    dismissChapterComplete: () => set({ chapterComplete: null }),
    endTour: (completed) => {
      const { tour, meta, game } = get();
      // A practice company exits by restoring the paused original, whatever the player did in it.
      const company = get().tutorialCompany;
      if (company) {
        persist(); clearTutorialPractice();
        set({ ...company, tutorialCompany: null, meta: practiceAt(meta, false), generation: get().generation + 1, selected: null, selectedAppId: null,
          roomInspection: null, affected: [], previewAction: null, spotlight: [], hovered: null, cameraFocus: null, view: null, techFocus: null,
          tour: null, running: false, weekRush: false, lastAction: null, toast: null, activeMark: document.hidden ? null : performance.now() });
        return;
      }
      if (!tour) return;
      let next = meta;
      const walkthrough = isWalkthrough(tour.track);
      // Challenge Mode records completion on reaching its last step; skipping only marks unfinished lessons done.
      if (isWalkthrough(tour.track) && (tour.step < lastStep(tour.track) || !meta.tutorialDone)) {
        recordTour(completed ? "completed" : "skipped", tour, completed ? {} : { reason: "player" });
        next = walkthroughDone(meta);
      } else if (tour.track === "incident") {
        next = { ...meta, incidentGuideDone: true };
        if (!saveMeta(next, get().mode)) get().notify("Onboarding preferences could not be saved.", "error");
      }
      // A chapter's guide was recorded as seen when it appeared.
      // The incident guide holds the clock; closing it lets the incident run.
      // Only finishing a walkthrough is marked; skipping it, like its steps, stays quiet (the steps' own decisions already sound).
      set({ tour: null, meta: next, running: tour.track === "incident" && game.phase === "incident" ? true : get().running, ...(completed && walkthrough ? { lastIntro: intro("finish") } : {}) });
      if (game.campaign && walkthrough) persist();
    },
    startTutorialRun: (from) => {
      if (!isFreshRun(get().game)) get().newRun({ seed: BALANCE.introSeed });
      get().startTour("basics", from);
    },

    setAudio: (patch) => {
      const now = get().audio;
      const level = (v: number | undefined, was: number) => (v === undefined || !Number.isFinite(v) ? was : Math.round(Math.min(100, Math.max(0, v))));
      const audio: AudioSettings = {
        music: level(patch.music, now.music),
        effects: level(patch.effects, now.effects),
        muted: patch.muted ?? now.muted,
        captions: patch.captions ?? now.captions,
      };
      if (audio.music === now.music && audio.effects === now.effects && audio.muted === now.muted && audio.captions === now.captions) return;
      set({ audio });
      // Unsaved settings still apply for this visit.
      saveAudio(audio);
    },
    toggleMute: () => {
      const { audio } = get();
      if (!isSilent(audio)) return get().setAudio({ muted: true });
      // A mute only unmutes; volumes dragged to 0 are brought back too, or the click would change nothing you can hear.
      get().setAudio(audio.music === 0 && audio.effects === 0 ? { music: DEFAULT_AUDIO.music, effects: DEFAULT_AUDIO.effects, muted: false } : { muted: false });
    },

    setGraphics: (patch) => {
      const now = get().graphics;
      const quality = GRAPHICS_QUALITIES.find((q) => q === patch.quality) ?? now.quality;
      const fov = patch.fov === undefined ? now.fov : clampFov(patch.fov);
      const skipElevator = typeof patch.skipElevator === "boolean" ? patch.skipElevator : now.skipElevator;
      if (quality === now.quality && fov === now.fov && skipElevator === now.skipElevator) return;
      const graphics: GraphicsSettings = { quality, fov, skipElevator };
      set({ graphics });
      // Unsaved settings still apply for this visit.
      saveGraphics(graphics);
    },

    rate: (rating) => {
      const { game, rating: previous } = get();
      // A run has one rating: changing it replaces the earlier choice rather than counting again.
      (previous === null ? track : retrack)("rating_submitted", { rating, outcome: game.outcome, weeks: game.totals.weeks, seed: game.seed });
      set({ rating });
    },

    notify: (text, kind = "info") => set({ toast: { id: toastId++, text, kind } }),
    dismissToast: () => set({ toast: null }),
  };
});

// Walk mode belongs to a run on screen: going back to the title screen ends it for now, but the player's choice
// to be walking is remembered, so the next visit picks it up again.
useGame.subscribe((s, prev) => {
  if (prev.started && !s.started && s.walking) s.setWalking(false, false);
});

// Every new, loaded or practice company opens its panel on Analysis, whichever action replaced the last one.
useGame.subscribe((s, prev) => {
  if (s.generation !== prev.generation && s.panelTab !== "analysis") useGame.setState({ panelTab: "analysis" });
});

/**
 * Whether Challenge Mode is open to this player without reading storage: already playing it, unlocked for good, the
 * loaded company past its final reliability review, or finished with everything this edition's Guided Mode offers.
 */
export function challengeAvailable(s: Pick<Store, "mode" | "meta" | "game" | "scope">): boolean {
  return s.mode === "classic" || s.meta.challengeUnlocked || s.game.campaign?.reliabilityStage?.acknowledged === true || scopeComplete(s.scope, s.game);
}

/** Whether the loaded company has finished everything this edition's Guided Mode offers (never, on the desktop). */
export const guidedScopeComplete = (s: Pick<Store, "scope" | "game">): boolean => scopeComplete(s.scope, s.game);

/** Equipment whose inspection records component evidence in Guided Mode. */
const CAMPAIGN_EVIDENCE: EquipmentId[] = ["app", "db", "monitoring", "gateway"];
/** Office equipment a campaign game lets the player look at without logging a component inspection. */
const CAMPAIGN_OFFICE: EquipmentId[] = ["team", "deploy", "growth"];

/** Whether this run answers an inspection of `id`: everything in Challenge Mode, only evidence and office rooms in Guided Mode. */
export function canInspectEquipment(game: GameState, id: EquipmentId): boolean {
  if (!game.campaign) return true;
  return CAMPAIGN_EVIDENCE.includes(id) || CAMPAIGN_OFFICE.includes(id) || (id === "cache" && !!game.campaign.dataStage);
}

/** Whether inspecting `id` in this campaign is a measured component inspection rather than a room inspection. */
function isCampaignEvidence(game: GameState, id: EquipmentId): boolean {
  return !!game.campaign && (CAMPAIGN_EVIDENCE.includes(id) || (id === "cache" && !!game.campaign.dataStage));
}

/**
 * Clicking or tapping a piece of equipment. Normally it opens the inspector;
 * during an incident it also sends the team to investigate that equipment.
 */
export function inspectOrSelect(id: EquipmentId, appId?: string): void {
  const { game, select, act } = useGame.getState();
  if (!canInspectEquipment(game, id)) return;
  select(id);
  if (appId) useGame.getState().selectApp(appId);
  if (game.campaign) {
    if (isCampaignEvidence(game, id)) {
      act({ type: "incident_inspect", equipment: id, ...(id === "app" ? { appId: useGame.getState().selectedAppId ?? "app-1" } : {}) });
    }
    return;
  }
  const inc = game.incident;
  if (game.phase !== "incident" || !inc || inc.status !== "active") return;
  if (!inspectable(game).includes(id)) return;
  if (inc.inspecting || inc.evidence.some((e) => e.equipment === id)) return;
  act({ type: "incident_inspect", equipment: id });
}

let roomInspectionSeq = 0;
/**
 * An inspection the player starts in the 3D room — clicking a model or label, or the avatar's prompt: the shared
 * gameplay action runs, then the diagnostic reveal opens. Panels and the Campaign UI call `inspectOrSelect`
 * directly, so their inspections stay with the inspector alone.
 */
export function inspectInRoom(id: EquipmentId, appId?: string): void {
  if (!canInspectEquipment(useGame.getState().game, id)) return;
  inspectOrSelect(id, appId);
  useGame.setState({ roomInspection: { seq: ++roomInspectionSeq, equipment: id, ...(appId ? { appId } : {}) } });
}

function loadMetaSafe(): Meta {
  if (typeof window === "undefined") {
    return { ...DEFAULT_META };
  }
  return loadMeta();
}

function loadAudioSafe(): AudioSettings {
  return typeof window === "undefined" ? { ...DEFAULT_AUDIO } : loadAudio();
}

function loadGraphicsSafe(): GraphicsSettings {
  return typeof window === "undefined" ? { ...DEFAULT_GRAPHICS } : loadGraphics();
}

export { clearSave };
