import { SAVE_VERSION, type GameState } from "@/sim";

/**
 * Local browser persistence. Every read and write is wrapped because storage
 * can be unavailable (private windows, blocked site data) or hold a save from
 * an older build.
 */

const SAVE_KEY = "nn.save.v1";
const META_KEY = "nn.meta.v1";
const ANALYTICS_KEY = "nn.analytics.v1";

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

const PHASES = new Set(["management", "incident", "review", "ended"]);

function looksLikeGame(g: unknown): g is GameState {
  if (!g || typeof g !== "object") return false;
  const s = g as Partial<GameState>;
  return (
    s.version === SAVE_VERSION &&
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

export type LoadResult = { status: "none" } | { status: "ok"; game: GameState; savedAt: number } | { status: "corrupt" };

export function loadGame(): LoadResult {
  const raw = read(SAVE_KEY);
  if (!raw) return { status: "none" };
  try {
    const parsed = JSON.parse(raw) as { game?: unknown; savedAt?: number };
    if (looksLikeGame(parsed.game)) return { status: "ok", game: parsed.game, savedAt: parsed.savedAt ?? 0 };
  } catch {
    /* fall through to corrupt */
  }
  remove(SAVE_KEY);
  return { status: "corrupt" };
}

export function saveGame(game: GameState): boolean {
  return write(SAVE_KEY, JSON.stringify({ savedAt: Date.now(), game }));
}

export function clearSave(): void {
  remove(SAVE_KEY);
}

export function loadMeta(): Meta {
  const raw = read(META_KEY);
  if (!raw) return { ...DEFAULT_META };
  try {
    const meta = { ...DEFAULT_META, ...(JSON.parse(raw) as Partial<Meta>) };
    if (typeof meta.music !== "boolean") meta.music = DEFAULT_META.music;
    return meta;
  } catch {
    return { ...DEFAULT_META };
  }
}

export function saveMeta(meta: Meta): void {
  write(META_KEY, JSON.stringify(meta));
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
