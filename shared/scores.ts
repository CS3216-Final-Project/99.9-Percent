// Post-mission feedback format (Zi Yao -> Qi Jun).
// Returned once a mission ends; shown on the feedback screen.

export interface GrammarIssue {
  /** Exact line the player said. */
  said: string;
  fix: string;
  why: string;
}

export interface MissionReport {
  missionId: string;
  /** 0-100, weighted by proficiency level. */
  overall: number;
  taskCompletion: {
    /** Objective id -> done? */
    objectives: Record<string, boolean>;
    percent: number;
  };
  /** 0-100. Null until pronunciation scoring is added. */
  pronunciation: number | null;
  grammar: { score: number; issues: GrammarIssue[] };
  vocab: { score: number; used: string[]; missed: string[] };
  tip?: string;
  xpEarned: number;
}
