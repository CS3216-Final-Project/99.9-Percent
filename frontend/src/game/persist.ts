import { emptyMeasurement, type Measurement, type PlaytestEvent } from "./telemetry";
import { decodeSave, makeEnvelope, migrateSave } from "./saveMigrations";
import { type GameState } from "@/sim";

/**
 * Local browser persistence. Every read and write is wrapped because storage
 * can be unavailable (private windows, blocked site data) or hold a save from
 * an older build.
 */

const SAVE_KEY = "nn.campaign.save.v1";
const META_KEY = "nn.campaign.meta.v1";
const ANALYTICS_KEY = "nn.campaign.analytics.v1";

export interface Meta {
  openingOnboarding: {version: 1; step: number; status: "not-started" | "in-progress" | "completed" | "skipped"};
  onboarded: boolean;
  runsStarted: number;
  runsFinished: number;
  firstIncidentStarted: boolean;
  firstIncidentCompleted: boolean;
  /** The guided first-week walkthrough has been finished or skipped. */
  tutorialDone: boolean;
  /** The short guide shown on the first incident has been seen. */
  incidentGuideDone: boolean;
}

export const DEFAULT_META: Meta = {
  openingOnboarding: {version: 1, step: 0, status: "not-started"},
  onboarded: false,
  runsStarted: 0,
  runsFinished: 0,
  firstIncidentStarted: false,
  firstIncidentCompleted: false,
  tutorialDone: false,
  incidentGuideDone: false,
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


export type LoadResult = {status:"none"} | {status:"ok";game:GameState;savedAt:number;remainderMs:number;measurement:Measurement} | {status:"corrupt"|"unsupported"|"unavailable"};
export function loadGame():LoadResult {
  let raw:string|null;
  try {raw=window.localStorage.getItem(SAVE_KEY);}catch{return {status:"unavailable"};}
  if(raw===null)return {status:"none"};
  let result=decodeSave(raw);
  if(result.status==="unsupported") {
    try {
      if([1,2].includes(JSON.parse(raw).schemaVersion) && migrateSave(window.localStorage))result=decodeSave(window.localStorage.getItem(SAVE_KEY)!);
    } catch { return {status:"unavailable"}; }
  }
  if(result.status!=="ok")return result;
  return {status:"ok",game:result.envelope.game,savedAt:result.envelope.savedAt,remainderMs:result.envelope.runtime.remainderMs,measurement:result.envelope.runtime.measurement};
}
export function rawSave():string|null {return read(SAVE_KEY);}
export function exportLegacyData():string {
  return JSON.stringify(Object.fromEntries(["nn.save.v1","nn.meta.v1","nn.analytics.v1"].map(k=>[k,read(k)])),null,2);
}
export function saveGame(game:GameState,remainderMs=0,explicitReset=false,measurement:Measurement=emptyMeasurement()):boolean {
  const current=loadGame();
  if(!explicitReset && (current.status==="corrupt"||current.status==="unsupported"||current.status==="unavailable"))return false;
  try{return write(SAVE_KEY,JSON.stringify(makeEnvelope(game,remainderMs,Date.now(),measurement)));}catch{return false;}
}
export function clearSave(): void {
  remove(SAVE_KEY);
}

export function loadMeta(): Meta {
  const raw = read(META_KEY);
  if (!raw) return { ...DEFAULT_META };
  try {
    const parsed=JSON.parse(raw) as Partial<Meta>;
    const o=parsed.openingOnboarding;
    const valid=o?.version===1&&Number.isInteger(o.step)&&o.step>=0&&o.step<=2&&["not-started","in-progress","completed","skipped"].includes(o.status);
    return {...DEFAULT_META,...parsed,openingOnboarding:valid?o!:structuredClone(DEFAULT_META.openingOnboarding)};
  } catch {
    return { ...DEFAULT_META };
  }
}

export function saveMeta(meta: Meta): boolean {
  return write(META_KEY, JSON.stringify(meta));
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
  | "save_resumed";

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
