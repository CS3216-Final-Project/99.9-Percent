import {
  LEADERBOARD_NAME_MAX, LEADERBOARD_NAME_PATTERN, type LeaderboardSubmission,
} from "../../../shared/leaderboard.ts";
import type { EndReport } from "@/sim/report";

/**
 * Booth play for showcases. `/steps` asks for a name, starts a fresh Challenge Mode company and posts its report
 * score to the public leaderboard; `/steps/board` is the big-screen board. `?steps` and `?steps=board` do the same
 * on any path, for hosts that cannot rewrite paths.
 */
export type BoothPage = "play" | "board";

export function boothPage(pathname: string, search: string): BoothPage | null {
  const path = pathname.replace(/\/+$/, "").toLowerCase();
  if (path === "/steps/board" || path === "/leaderboard") return "board";
  if (path === "/steps") return "play";
  let param: string | null = null;
  try { param = new URLSearchParams(search).get("steps"); } catch { /* unreadable address */ }
  if (param === null) return null;
  return param.toLowerCase() === "board" ? "board" : "play";
}

/** This page's booth role, read once from the address. */
export function currentBoothPage(): BoothPage | null {
  if (typeof window === "undefined") return null;
  return boothPage(window.location.pathname, window.location.search);
}

/** The name as it will be stored, or null when it cannot go on the board. */
export function tidyName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, " ");
  return name.length >= 1 && name.length <= LEADERBOARD_NAME_MAX && LEADERBOARD_NAME_PATTERN.test(name) ? name : null;
}

export interface BoothPosted { rank: number; total: number; score: number; grade: EndReport["grade"] }

/** The visitor at this device: their name, the run they are playing and, once posted, where it placed. */
export interface BoothVisitor {
  name: string;
  /** One submission ID per run, so a retried post never adds a second row. */
  submissionId: string;
  /** Seed of the Challenge Mode company started for this visitor; null until it starts. */
  runSeed: number | null;
  posted: BoothPosted | null;
  /** The result being posted, kept so a retry resends exactly the same submission. */
  pending: LeaderboardSubmission | null;
}

const KEY = "nn.booth.v1";

export function loadVisitor(): BoothVisitor | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object") return null;
    const { name, submissionId, runSeed, posted, pending } = v as Record<string, unknown>;
    if (typeof name !== "string" || tidyName(name) !== name || typeof submissionId !== "string") return null;
    if (runSeed !== null && !Number.isSafeInteger(runSeed)) return null;
    const p = (posted ?? null) as BoothPosted | null;
    if (p !== null && (typeof p !== "object" || typeof p.rank !== "number" || typeof p.total !== "number" ||
        typeof p.score !== "number" || typeof p.grade !== "string")) return null;
    const q = (pending ?? null) as LeaderboardSubmission | null;
    if (q !== null && (typeof q !== "object" || q.id !== submissionId || q.name !== name || typeof q.score !== "number")) return null;
    return { name, submissionId, runSeed: runSeed as number | null, posted: p, pending: q };
  } catch {
    return null;
  }
}

export function saveVisitor(visitor: BoothVisitor | null): void {
  try {
    if (visitor) localStorage.setItem(KEY, JSON.stringify(visitor));
    else localStorage.removeItem(KEY);
  } catch { /* storage unavailable: the visitor lasts for this page only */ }
}

/** What the board receives for a report: a finished run's outcome, or `unfinished` for one ended early. */
export function submissionFor(visitor: BoothVisitor, report: EndReport, finished: boolean): LeaderboardSubmission {
  const whole = (n: number, max: number) => Math.min(max, Math.max(0, Math.round(Number.isFinite(n) ? n : 0)));
  return {
    id: visitor.submissionId,
    name: visitor.name,
    score: whole(report.score, 100),
    grade: report.grade,
    weeks: whole(report.weeks, 520),
    users: whole(report.peakUsers, 1_000_000_000),
    outcome: finished ? report.outcome : "unfinished",
  };
}
