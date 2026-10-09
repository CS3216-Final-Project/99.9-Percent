import { decodeSave, makeEnvelope, replaceable } from "./saveEnvelope";
import { SAVE_VERSION, type GameState } from "@/sim";

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

/** Campaign is the step-based simulation; classic is the original week-by-week game. */
export type GameMode = "campaign" | "classic";

export interface Meta {
  onboarded: boolean;
  runsStarted: number;
  runsFinished: number;
  firstIncidentStarted: boolean;
  firstIncidentCompleted: boolean;
  /** The guided first-week walkthrough has been finished or skipped. */
  tutorialDone: boolean;
  /** The short guide shown on the first incident has been seen. */
  incidentGuideDone: boolean;
  /** Background music plays. */
  music: boolean;
}

export const DEFAULT_META: Meta = {
  onboarded: false,
  runsStarted: 0,
  runsFinished: 0,
  firstIncidentStarted: false,
  firstIncidentCompleted: false,
  tutorialDone: false,
  incidentGuideDone: false,
  music: true,
};

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


export type LoadResult = {status:"none"} | {status:"ok";game:GameState;savedAt:number;remainderMs:number} | {status:"corrupt"|"unsupported"|"unavailable"};
export function loadGame():LoadResult {
  let raw:string|null;
  try {raw=window.localStorage.getItem(SAVE_KEY);}catch{return {status:"unavailable"};}
  if(raw===null)return {status:"none"};
  const result=decodeSave(raw);
  if(result.status!=="ok")return result;
  return {status:"ok",game:result.game,savedAt:result.envelope.savedAt,remainderMs:result.envelope.runtime.remainderMs};
}
export function rawSave():string|null {return read(SAVE_KEY);}
export function saveGame(game:GameState,remainderMs=0,explicitReset=false):boolean {
  let current:string|null;
  try {current=window.localStorage.getItem(SAVE_KEY);}catch{return false;}
  if(!explicitReset && !replaceable(current))return false;
  return write(SAVE_KEY,JSON.stringify(makeEnvelope(game,remainderMs)));
}
export function clearSave(): void {
  remove(SAVE_KEY);
}

/** The mode last played. Anything else, including no choice yet, means campaign. */
export function loadMode(): GameMode {
  return read(MODE_KEY) === "classic" ? "classic" : "campaign";
}

export function saveMode(mode: GameMode): void {
  write(MODE_KEY, mode);
}

const PHASES = new Set(["management", "incident", "review", "ended"]);

function looksLikeClassicGame(g: unknown): g is GameState {
  if (!g || typeof g !== "object") return false;
  const s = g as Partial<GameState>;
  return (
    s.version === SAVE_VERSION &&
    s.campaign === undefined &&
    typeof s.turn === "number" &&
    typeof s.cash === "number" &&
    typeof s.users === "number" &&
    typeof s.rngState === "number" &&
    typeof s.phase === "string" &&
    PHASES.has(s.phase) &&
    !!s.infra &&
    Array.isArray(s.infra.appHosts) &&
    s.infra.appHosts.length > 0 &&
    Array.isArray(s.techDone) &&
    Array.isArray(s.tasks) &&
    Array.isArray(s.releases) &&
    Array.isArray(s.history) &&
    Array.isArray(s.log) &&
    Array.isArray(s.postmortems) &&
    !!s.live &&
    !!s.totals &&
    (s.phase !== "incident" || !!s.incident)
  );
}

export type ClassicLoadResult = { status: "none" } | { status: "ok"; game: GameState } | { status: "corrupt" };

/** An unreadable classic save is reported as corrupt, and the next run is written over it. */
export function loadClassicGame(): ClassicLoadResult {
  const raw = read(CLASSIC_SAVE_KEY);
  if (!raw) return { status: "none" };
  try {
    const parsed = JSON.parse(raw) as { game?: unknown };
    if (looksLikeClassicGame(parsed.game)) return { status: "ok", game: parsed.game };
  } catch {
    /* fall through to corrupt */
  }
  return { status: "corrupt" };
}

export function saveClassicGame(game: GameState): boolean {
  return write(CLASSIC_SAVE_KEY, JSON.stringify({ savedAt: Date.now(), game }));
}

/** Each mode keeps its own tutorial and run counters. */
export function loadMeta(mode: GameMode = "campaign"): Meta {
  const raw = read(mode === "classic" ? CLASSIC_META_KEY : META_KEY);
  if (!raw) return { ...DEFAULT_META };
  try {
    const meta = { ...DEFAULT_META, ...(JSON.parse(raw) as Partial<Meta>) };
    if (typeof meta.music !== "boolean") meta.music = DEFAULT_META.music;
    return meta;
  } catch {
    return { ...DEFAULT_META };
  }
}

export function saveMeta(meta: Meta, mode: GameMode = "campaign"): void {
  write(mode === "classic" ? CLASSIC_META_KEY : META_KEY, JSON.stringify(meta));
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
  | "mode_switched";

export interface AnalyticsEvent {
  t: string;
  name: AnalyticsName;
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
  write(ANALYTICS_KEY, JSON.stringify(events.slice(-500)));
}

export function clearAnalytics(): void {
  remove(ANALYTICS_KEY);
}
