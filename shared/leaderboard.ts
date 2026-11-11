/**
 * Booth leaderboard for showcase play (`/steps`): a visitor's chosen name and the Challenge Mode report score.
 * Scores are reported by the browser, so the board is for fun at a booth, not proof of play.
 */
export const LEADERBOARD_NAME_MAX = 16;
/** Letters, digits, spaces and a little punctuation; trimmed, with no leading or trailing space. */
export const LEADERBOARD_NAME_PATTERN = /^[\p{L}\p{N}](?:[\p{L}\p{N} _.'-]*[\p{L}\p{N}_.])?$/u;
export const LEADERBOARD_GRADES = ['S', 'A', 'B', 'C', 'D'] as const;
export type LeaderboardGrade = (typeof LEADERBOARD_GRADES)[number];
/** How the run stood when it was posted: the Challenge Mode outcome, or `unfinished` when the visitor ended early. */
export const LEADERBOARD_OUTCOMES = ['won', 'bankrupt', 'deadline', 'unfinished'] as const;
export type LeaderboardOutcome = (typeof LEADERBOARD_OUTCOMES)[number];

export interface LeaderboardSubmission {
  /** A random UUID v4 chosen once per run, so a retried post never adds a second row. */
  id: string;
  name: string;
  /** The Challenge Mode report score, 0 to 100. */
  score: number;
  grade: LeaderboardGrade;
  /** Weeks played, 0 to 520. */
  weeks: number;
  /** Peak users, 0 to 1,000,000,000. */
  users: number;
  outcome: LeaderboardOutcome;
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  grade: LeaderboardGrade;
  weeks: number;
  users: number;
  outcome: LeaderboardOutcome;
  createdAt: string;
}

export interface LeaderboardSubmitResponse {
  id: string;
  /** 1-based place among visible entries: higher score first, then the earlier post. */
  rank: number;
  /** Visible entries on the board, including this one. */
  total: number;
}

export interface LeaderboardResponse {
  top: LeaderboardEntry[];
  /** The most recent posts, newest first. */
  recent: LeaderboardEntry[];
  total: number;
  generatedAt: string;
}
