import { currentStep, WALKTHROUGH_VERSION } from "./walkthrough";
import { emptyMeasurement, type Measurement, type PlaytestEvent } from "./telemetry";
import { DEFAULT_AVATAR, isAvatar, type AvatarId } from "./avatars";
import { clampFov, FOV } from "./viewpoints";
import { controlsOf, DEFAULT_CONTROLS, type ControlSettings } from "./controls";
import { decodeSave, makeEnvelope, replaceable } from "./saveEnvelope";
import { BALANCE, PROMOS, TECH, SAVE_VERSION, type GameState } from "@/sim";

/**
 * Local browser persistence. Every read and write is wrapped because storage
 * can be unavailable (private windows, blocked site data) or hold a save from
 * an older build.
 */

const SAVE_KEY = "nn.campaign.save.v1";
const META_KEY = "nn.campaign.meta.v1";
const ANALYTICS_KEY = "nn.campaign.analytics.v1";
const CLASSIC_SAVE_KEY = "nn.classic.save.v1";
const CLASSIC_META_KEY = "nn.classic.meta.v1";
const MODE_KEY = "nn.mode.v1";
const AUDIO_KEY = "nn.audio.v1";
const GRAPHICS_KEY = "nn.graphics.v1";
const TIME_OF_DAY_KEY = "nn.timeOfDay.v1";
const AVATAR_KEY = "nn.avatar.v1";
const MAP_KEY = "nn.map.v1";
const CONTROLS_KEY = "nn.controls.v1";
/** Music on or off, from before the volume settings. Still written, so an older build keeps the player's choice. */
const MUSIC_KEY = "nn.music.v1";
const LEGACY_SAVE_KEY = "nn.save.v1";
const LEGACY_META_KEY = "nn.meta.v1";
// Only bytes successfully written by this session are trusted without replay.
// Any external change to the slot must pass full validation before replacement.
let lastWrittenCampaign: string | null = null;

/** Campaign is the step-based simulation; classic is the original week-by-week game. */
export type GameMode = "campaign" | "classic";

/** The Guided Mode chapters after the Opening, each with a short guide shown when the company first enters it. */
export const CHAPTER_TOURS = ["scaling", "data", "spikes", "reliability", "combined"] as const;
export type ChapterTour = (typeof CHAPTER_TOURS)[number];
/** Chapters that end without a recognition of their own, so the company stops once to say so. */
export const CHAPTER_COMPLETIONS = ["scaling", "data"] as const;
export type ChapterCompletion = (typeof CHAPTER_COMPLETIONS)[number];

export interface Meta {
  onboarded: boolean;
  runsStarted: number;
  runsFinished: number;
  firstIncidentStarted: boolean;
  firstIncidentCompleted: boolean;
  /** Chapter 0 was explicitly finished (or completed under the older rules); Challenge Mode may also skip its guide. */
  tutorialDone: boolean;
  /** The step Guided Mode's walkthrough is on while it is under way, so a reload or a new company carries on from it. */
  walkthroughStep: number | null;
  /** Furthest lesson reached, so Back and reload do not repeat completed exercises. Absent in older profiles. */
  walkthroughFurthestStep?: number;
  /** The lesson list the two steps above index; absent before the 10-lesson walkthrough. */
  walkthroughVersion?: number;
  /** One-time Guided Mode tips already shown, such as the first weekly settlement. */
  tipsSeen?: GuidedTip[];
  /** The short guide shown on the first incident has been seen. */
  incidentGuideDone: boolean;
  /** Guided Mode chapters whose guide has been shown, so it appears once. */
  chapterTours: ChapterTour[];
  /** The company whose finished chapters have been announced, and which, so each is announced only the first time. */
  chapterCompletions: { runId: string; chapters: ChapterCompletion[] } | null;
  /** Challenge Mode stays unlocked once earned; completing Guided Mode cannot be taken back. */
  challengeUnlocked: boolean;
}

export const GUIDED_TIPS = ["settlement"] as const;
export type GuidedTip = (typeof GUIDED_TIPS)[number];

export const DEFAULT_META: Meta = {
  onboarded: false,
  runsStarted: 0,
  runsFinished: 0,
  firstIncidentStarted: false,
  firstIncidentCompleted: false,
  tutorialDone: false,
  walkthroughStep: null,
  walkthroughFurthestStep: 0,
  walkthroughVersion: WALKTHROUGH_VERSION,
  tipsSeen: [],
  incidentGuideDone: false,
  chapterTours: [],
  chapterCompletions: null,
  challengeUnlocked: false,
};

/** Sound settings, shared by both modes. Volumes are whole percents. */
export interface AudioSettings {
  music: number;
  effects: number;
  /** Silences music and effects without losing either volume. */
  muted: boolean;
}

export const DEFAULT_AUDIO: AudioSettings = { music: 80, effects: 80, muted: false };

/** Nothing would be heard: muted, or both volumes at 0. What the header button and the menu's Mute all show. */
export const isSilent = (audio: AudioSettings): boolean => audio.muted || (audio.music === 0 && audio.effects === 0);

/** How much the room is drawn with. Auto picks by what draws the canvas; the others are the player's choice. */
export const GRAPHICS_QUALITIES = ["auto", "high", "medium", "low"] as const;
export type GraphicsQuality = (typeof GRAPHICS_QUALITIES)[number];

/** Graphics settings, shared by both modes. */
export interface GraphicsSettings {
  quality: GraphicsQuality;
  /** The first-person view's field of view, in degrees (see game/viewpoints.ts). */
  fov: number;
  /** Change floor at once instead of riding the elevator's cutscene, as reduced motion does. */
  skipElevator: boolean;
}

export const DEFAULT_GRAPHICS: GraphicsSettings = { quality: "auto", fov: FOV.initial, skipElevator: false };

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* nothing to clean up */
  }
}


export type LoadResult = {status:"none"} | {status:"ok";game:GameState;savedAt:number;remainderMs:number;measurement:Measurement} | {status:"corrupt"|"unsupported"|"unavailable"};
export function loadGame():LoadResult {
  let raw:string|null;
  try {raw=window.localStorage.getItem(SAVE_KEY);}catch{return {status:"unavailable"};}
  if(raw===null)return {status:"none"};
  const result=decodeSave(raw);
  if(result.status!=="ok")return result;
  return {status:"ok",game:result.game,savedAt:result.envelope.savedAt,remainderMs:result.envelope.runtime.remainderMs,measurement:result.envelope.runtime.measurement};
}
export function rawSave(mode: GameMode = "campaign"): string | null {
  return read(mode === "classic" ? CLASSIC_SAVE_KEY : SAVE_KEY);
}
/** Originals are read-only; recovery and imports write a copy into the Classic slot. */
export function rawLegacySave(): string | null { return read(LEGACY_SAVE_KEY); }
export function exportGame(game: GameState, remainderMs = 0, measurement: Measurement = emptyMeasurement()): string {
  return JSON.stringify(game.campaign ? makeEnvelope(game, remainderMs, Date.now(), measurement) : { savedAt: Date.now(), game });
}
export function saveGame(game:GameState,remainderMs=0,explicitReset=false,measurement:Measurement=emptyMeasurement()):boolean {
  let current:string|null;
  try {current=window.localStorage.getItem(SAVE_KEY);}catch{return false;}
  if(!explicitReset && current !== lastWrittenCampaign && !replaceable(current))return false;
  // Back up the actual main-format bytes before upgrading the active slot.
  if (current !== null) {
    let source;
    try {source=JSON.parse(current);} catch {if(!explicitReset)return false;}
    try {
      if(([1,2,3,4,5,6].includes(source?.schemaVersion) || (source?.schemaVersion === 7 && !source.serviceMeasurementStart)) && Array.isArray(source.inputs)) {
        const backup=SAVE_KEY+".backup.v"+source.schemaVersion+"."+source.runId+"."+source.savedAt;
        const prior=window.localStorage.getItem(backup);
        if(prior!==null && prior!==current)return false;
        if(prior===null)window.localStorage.setItem(backup,current);
      }
    } catch { return false; }
  }
  const raw = JSON.stringify(makeEnvelope(game,remainderMs,Date.now(),measurement));
  const saved = write(SAVE_KEY, raw);
  if (saved) lastWrittenCampaign = raw;
  return saved;
}
export function clearSave(): void {
  remove(SAVE_KEY);
}

/**
 * Challenge Mode is locked until the Guided Mode company acknowledges its final
 * reliability chapter. The unlock is permanent: once the metadata records it, or
 * an older completed save already has it, it cannot be lost.
 */
export function challengeUnlocked(): boolean {
  if (loadMeta("campaign").challengeUnlocked) return true;
  const loaded = loadGame();
  return loaded.status === "ok" && loaded.game.campaign?.reliabilityStage?.acknowledged === true;
}

/** The mode last played. Anything else, including no choice yet, means campaign. */
export function loadMode(): GameMode {
  return read(MODE_KEY) === "classic" && challengeUnlocked() ? "classic" : "campaign";
}

export function saveMode(mode: GameMode): void {
  write(MODE_KEY, mode);
}

const PHASES = new Set(["management", "incident", "review", "ended"]);

const strings = (value: unknown): boolean => Array.isArray(value) && value.every(v => typeof v === "string");
function finiteFields(value: unknown, keys: readonly string[]): boolean {
  if (!value || typeof value !== "object") return false;
  const fields = value as Record<string, unknown>;
  return keys.every(key => Number.isFinite(fields[key]));
}

function looksLikeClassicGame(g: unknown): g is GameState {
  if (!g || typeof g !== "object") return false;
  const s = g as Partial<GameState>;
  return (
    s.version === SAVE_VERSION &&
    s.campaign === undefined &&
    Number.isSafeInteger(s.turn) && s.turn! >= 1 &&
    [s.seed, s.rngState, s.cash, s.users, s.satisfaction, s.techDebt, s.engineers, s.nextId].every(Number.isFinite) &&
    typeof s.phase === "string" &&
    PHASES.has(s.phase) &&
    !!s.infra &&
    Array.isArray(s.infra.appHosts) &&
    s.infra.appHosts.length > 0 &&
    [...s.infra.appHosts, s.infra.dbHost].every(h => h && typeof h.id === "string" && ["healthy", "degraded", "failed"].includes(h.status)) &&
    Number.isSafeInteger(s.infra.dbTier) && s.infra.dbTier >= 0 && s.infra.dbTier < BALANCE.db.tiers.length &&
    Number.isSafeInteger(s.infra.nextHostNum) &&
    Array.isArray(s.deploys) && s.deploys.every(d => d && typeof d.title === "string") &&
    Array.isArray(s.activePromos) && s.activePromos.every(id => typeof id === "string" && Object.hasOwn(PROMOS, id)) &&
    Array.isArray(s.milestonesHit) &&
    !!s.promoCooldowns && typeof s.promoCooldowns === "object" &&
    !!s.lastCapacityTurn && Number.isFinite(s.lastCapacityTurn.app) && Number.isFinite(s.lastCapacityTurn.db) &&
    Array.isArray(s.techDone) && s.techDone.every(id => typeof id === "string" && Object.hasOwn(TECH, id)) &&
    Array.isArray(s.tasks) && s.tasks.every(t => t && typeof t.id === "string" && Number.isFinite(t.progress) && Number.isFinite(t.assigned)) &&
    Array.isArray(s.releases) && s.releases.every(r => r && typeof r.id === "string" && typeof r.title === "string") &&
    Array.isArray(s.history) && s.history.every(r => r && Number.isFinite(r.turn) && strings(r.warnings)) &&
    Array.isArray(s.log) && s.log.every(e => e && typeof e.text === "string") &&
    Array.isArray(s.postmortems) && s.postmortems.every(r => r && typeof r.title === "string" && typeof r.whyOutcome === "string" &&
      strings(r.contributing) && strings(r.response) && strings(r.prevention) && finiteFields(r.impact, ["downtimeMinutes", "usersLost", "revenueLost", "moneySpent"])) &&
    finiteFields(s.live, ["peakRps", "tempServers", "latencyMs", "errorRate", "availability", "shed"]) &&
    finiteFields(s.totals, ["revenue", "costs", "invested", "downtimeMinutes", "weeks", "peakUsers", "hintsUsed", "incidents", "promosRun", "serversAdded", "releasesTested", "releasesUntested"]) &&
    (s.phase !== "review" || s.postmortems.length > 0) &&
    (s.phase !== "incident" || (!!s.incident && !!s.pendingTurn &&
      ["app_overload", "db_saturation", "deploy_regression", "instance_failure"].includes(s.incident.type) &&
      Number.isFinite(s.incident.elapsed) && strings(s.incident.symptoms) && strings(s.incident.hints) &&
      Array.isArray(s.incident.evidence) && s.incident.evidence.every(e => e && typeof e.text === "string") &&
      Array.isArray(s.incident.attempts) && s.incident.attempts.every(a => a && typeof a.label === "string") &&
      finiteFields(s.incident.damage, ["downtimeMinutes", "usersLost", "revenueLost", "moneySpent"]) &&
      finiteFields(s.incident.cause, ["peakRps", "appCapacity", "dbCapacity"]) &&
      strings(s.pendingTurn.notes) && strings(s.pendingTurn.planningWarnings)))
  );
}

export type ClassicLoadResult = { status: "none" } | { status: "ok"; game: GameState } | { status: "corrupt" };

/** Decode a copy of an exported Classic or pre-update save without touching storage. */
export function decodeClassicSave(raw: string): ClassicLoadResult {
  try {
    const parsed = JSON.parse(raw) as { game?: unknown };
    if (looksLikeClassicGame(parsed.game)) return { status: "ok", game: parsed.game };
  } catch {
    /* fall through to corrupt */
  }
  return { status: "corrupt" };
}

/** An unreadable classic save is reported as corrupt, and the next run is written over it. */
export function loadClassicGame(): ClassicLoadResult {
  const raw = read(CLASSIC_SAVE_KEY);
  return raw === null ? { status: "none" } : decodeClassicSave(raw);
}

export function saveClassicGame(game: GameState): boolean {
  return write(CLASSIC_SAVE_KEY, exportGame(game));
}

/**
 * Older metadata also held the music switch, which now lives in the sound settings, and the state of Guided Mode's
 * former three-prompt introduction, which the spotlight walkthrough replaced.
 */
type StoredMeta = Omit<Partial<Meta>, "chapterTours" | "chapterCompletions" | "walkthroughStep" | "walkthroughFurthestStep" | "walkthroughVersion" | "tipsSeen"> & {
  music?: unknown;
  openingOnboarding?: unknown;
  chapterTours?: unknown;
  chapterCompletions?: unknown;
  walkthroughStep?: unknown;
  walkthroughFurthestStep?: unknown;
  walkthroughVersion?: unknown;
  tipsSeen?: unknown;
};

function parseMeta(raw: string | null): StoredMeta | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as StoredMeta) : null;
  } catch {
    return null;
  }
}

/** Whether Guided Mode's former introduction was finished or skipped, in a profile from before the walkthrough. */
function introductionDone(introduction: unknown): boolean {
  const status = introduction && typeof introduction === "object" ? (introduction as { status?: unknown }).status : null;
  return status === "completed" || status === "skipped";
}

function decodeCompletions(raw: unknown): Meta["chapterCompletions"] {
  if (!raw || typeof raw !== "object") return null;
  const { runId, chapters } = raw as { runId?: unknown; chapters?: unknown };
  if (typeof runId !== "string" || !Array.isArray(chapters)) return null;
  return { runId, chapters: CHAPTER_COMPLETIONS.filter((id) => chapters.includes(id)) };
}

/** `campaign` reads Guided Mode's profile, where a player done with the former introduction is done with the walkthrough. */
function decodeMeta(raw: string | null, campaign = false): Meta {
  const { music: _music, openingOnboarding, chapterTours, chapterCompletions, walkthroughStep, walkthroughFurthestStep, walkthroughVersion, tipsSeen, ...stored } = parseMeta(raw) ?? {};
  const seen = Array.isArray(chapterTours) ? CHAPTER_TOURS.filter((id) => chapterTours.includes(id)) : [];
  const tips = Array.isArray(tipsSeen) ? GUIDED_TIPS.filter((id) => tipsSeen.includes(id)) : [];
  let step = Number.isInteger(walkthroughStep) && (walkthroughStep as number) >= 0 ? (walkthroughStep as number) : null;
  let furthest = Number.isSafeInteger(walkthroughFurthestStep) && (walkthroughFurthestStep as number) >= 0 ? walkthroughFurthestStep as number : 0;
  // Guided Mode's lesson indices from an earlier walkthrough are mapped to the lesson now teaching the same thing.
  if (campaign) {
    step = step === null ? null : currentStep(step, walkthroughVersion);
    furthest = currentStep(furthest, walkthroughVersion);
  }
  const meta: Meta = { ...DEFAULT_META, ...stored, chapterTours: seen, chapterCompletions: decodeCompletions(chapterCompletions), walkthroughStep: step, walkthroughFurthestStep: Math.max(step ?? 0, furthest),
    walkthroughVersion: WALKTHROUGH_VERSION, tipsSeen: tips };
  if (campaign && introductionDone(openingOnboarding)) meta.tutorialDone = true;
  return meta;
}

/** Each mode keeps its own tutorial/counters; sound is a shared player preference (see loadAudio). */
export function loadMeta(mode: GameMode = "campaign"): Meta {
  return decodeMeta(read(mode === "classic" ? CLASSIC_META_KEY : META_KEY), mode === "campaign");
}
export function loadLegacyMeta(): Meta {
  return decodeMeta(read(LEGACY_META_KEY));
}

/** The old music switch: the shared key wins, then the switch in that metadata, then on. */
function musicWasOn(metaKey: string): boolean {
  const music = read(MUSIC_KEY);
  if (music === "true" || music === "false") return music === "true";
  return parseMeta(read(metaKey))?.music !== false;
}

/** True when the pre-update profile had music off and the player has not chosen sound settings since. */
export function legacyMusicOff(): boolean {
  return read(AUDIO_KEY) === null && !musicWasOn(LEGACY_META_KEY);
}

const percent = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.round(Math.min(100, Math.max(0, value))) : fallback;

/**
 * The sound settings. A browser from before the volume sliders keeps its music
 * choice: music turned off there becomes muted here. Missing or corrupt fields
 * fall back to the defaults.
 */
export function loadAudio(): AudioSettings {
  const stored = read(AUDIO_KEY);
  if (stored !== null) {
    try {
      const s = JSON.parse(stored) as Partial<Record<keyof AudioSettings, unknown>> | null;
      if (s && typeof s === "object")
        return {
          music: percent(s.music, DEFAULT_AUDIO.music),
          effects: percent(s.effects, DEFAULT_AUDIO.effects),
          muted: typeof s.muted === "boolean" ? s.muted : DEFAULT_AUDIO.muted,
        };
    } catch {
      /* unreadable: fall back to the older setting */
    }
  }
  return { ...DEFAULT_AUDIO, muted: !musicWasOn(loadMode() === "classic" ? CLASSIC_META_KEY : META_KEY) };
}

export function saveAudio(settings: AudioSettings): boolean {
  write(MUSIC_KEY, String(!settings.muted && settings.music > 0));
  return write(AUDIO_KEY, JSON.stringify(settings));
}

/**
 * The graphics settings. Missing, corrupt or unknown values fall back to Auto, and a field of view that is missing,
 * as in settings from before it could be chosen, or out of range to the default or the nearest allowed. Anything but
 * a stored `true` keeps the elevator's cutscene.
 */
export function loadGraphics(): GraphicsSettings {
  const stored = read(GRAPHICS_KEY);
  if (stored !== null) {
    try {
      const s = JSON.parse(stored) as { quality?: unknown; fov?: unknown; skipElevator?: unknown } | null;
      const quality = GRAPHICS_QUALITIES.find((q) => q === s?.quality) ?? DEFAULT_GRAPHICS.quality;
      return { quality, fov: clampFov(s?.fov), skipElevator: s?.skipElevator === true };
    } catch {
      /* unreadable: use the default */
    }
  }
  return { ...DEFAULT_GRAPHICS };
}

export function saveGraphics(settings: GraphicsSettings): boolean {
  return write(GRAPHICS_KEY, JSON.stringify(settings));
}

export function loadTimeOfDay(): number | null {
  const stored = read(TIME_OF_DAY_KEY);
  if (stored === null) return null;
  try {
    const time = (JSON.parse(stored) as { time?: unknown } | null)?.time;
    return typeof time === "number" && Number.isFinite(time) && time >= 0 && time < 1 ? time : null;
  } catch {
    return null;
  }
}

export function saveTimeOfDay(time: number): boolean {
  return write(TIME_OF_DAY_KEY, JSON.stringify({ time }));
}

/** The player's avatar, or the default when none was chosen, storage fails or what is stored is not an avatar. */
export function loadAvatar(): AvatarId {
  const stored = read(AVATAR_KEY);
  return isAvatar(stored) ? stored : DEFAULT_AVATAR;
}

export function saveAvatar(id: AvatarId): boolean {
  return write(AVATAR_KEY, id);
}

/** The look controls, or their defaults when none were stored, storage fails or what is stored is unreadable. */
export function loadControls(): ControlSettings {
  const stored = read(CONTROLS_KEY);
  if (stored === null) return { ...DEFAULT_CONTROLS };
  try {
    return controlsOf(JSON.parse(stored));
  } catch {
    return { ...DEFAULT_CONTROLS };
  }
}

export function saveControls(settings: ControlSettings): boolean {
  return write(CONTROLS_KEY, JSON.stringify(settings));
}

/** Whether the map was left open, or null when it never was chosen or storage cannot say. */
export function loadMapOpen(): boolean | null {
  const stored = read(MAP_KEY);
  return stored === "open" ? true : stored === "closed" ? false : null;
}

export function saveMapOpen(open: boolean): boolean {
  return write(MAP_KEY, open ? "open" : "closed");
}

export function saveMeta(meta: Meta, mode: GameMode = "campaign"): boolean {
  return write(mode === "classic" ? CLASSIC_META_KEY : META_KEY, JSON.stringify(meta));
}

/* ------------------------------------------------------------------ */
/* Prototype analytics: stays in this browser, nothing is sent anywhere */
/* ------------------------------------------------------------------ */

export type AnalyticsName =
  | "run_started"
  | "onboarding_completed"
  | "tutorial_started"
  | "tutorial_completed"
  | "tutorial_skipped"
  | "incident_guide_shown"
  | "first_incident_started"
  | "first_incident_completed"
  | "incident_started"
  | "incident_completed"
  | "hint_used"
  | "run_finished"
  | "voluntary_replay"
  | "rating_submitted"
  | "save_resumed"
  | "save_imported"
  | "mode_switched"
  | "floor_switched"
  | "walk_started"
  | "walk_ended"
  | "avatar_changed"
  | "view_changed"
  | "map_toggled"
  | "map_walked";

export interface AnalyticsEvent {
  t: string;
  name: string;
  eventId?: string;
  data?: Record<string, string | number | boolean | null>;
}

export function readAnalytics(): AnalyticsEvent[] {
  const raw = read(ANALYTICS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as AnalyticsEvent[]) : [];
  } catch {
    return [];
  }
}

export function track(name: AnalyticsName, data?: AnalyticsEvent["data"]): void {
  const events = readAnalytics();
  events.push({ t: new Date().toISOString(), name, data });
  write(ANALYTICS_KEY, JSON.stringify(events));
}

/** Replaces the data of the most recent `name` event, or tracks a new one when there is none. */
export function retrack(name: AnalyticsName, data?: AnalyticsEvent["data"]): void {
  const events = readAnalytics();
  const index = events.findLastIndex((e) => e.name === name);
  if (index === -1) return track(name, data);
  events[index] = { ...events[index], t: new Date().toISOString(), data };
  write(ANALYTICS_KEY, JSON.stringify(events));
}

export function clearAnalytics(): void {
  remove(ANALYTICS_KEY);
}

/** One archive for historical events and attributed PR1 events; never truncate unexported data. */
export function archiveEvents(events:PlaytestEvent[]):boolean {
  try {
    const raw=window.localStorage.getItem(ANALYTICS_KEY);
    const prior=raw===null?[]:JSON.parse(raw);
    if(!Array.isArray(prior))return false;
    const ids=new Set(prior.map(e=>e.eventId).filter(Boolean));
    for(const e of events)if(!ids.has(e.eventId)){prior.push(e);ids.add(e.eventId);}
    return write(ANALYTICS_KEY,JSON.stringify(prior));
  }catch{return false;}
}
export function exportPlaytest(game:GameState,measurement:Measurement):string {
  const archived=readAnalytics();
  const ids=new Set(archived.map(e=>e.eventId));
  return JSON.stringify({exportVersion:1,measurement,game,
    events:[...archived,...measurement.pending.filter(e=>!ids.has(e.eventId))],
    rawArchive:read(ANALYTICS_KEY)},null,2);
}
