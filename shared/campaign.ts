/** Portable compact campaign contract. Clients replay and validate before loading. */
export interface CampaignEnvelope {
  schemaVersion: 3 | 4 | 5 | 6 | 7;
  scenarioId: "opening-db";
  scenarioVersion: 1;
  runId: string;
  seed: number;
  step: number;
  inputs: { step: number; action: { type: string } }[];
  foundation?: { step: number; inputs: number };
  legacyPreventionInputs?: number;
  serviceMeasurementStart?: { fromStep: number; scope: "full-run" | "since-upgrade" };
  runtime: { remainderMs: number };
  savedAt: number;
}
export interface Account { id: string; displayName: string }
/**
 * `newAccount` is true while this session is the one that created the account and the account has no cloud saves,
 * so the client may save the browser's company there unasked. Absent from older servers; treat that as false.
 */
export interface AppSession { account: Account; csrfToken: string; newAccount?: boolean }
export interface CloudRun { runId: string; revision: number; envelope: CampaignEnvelope; updatedAt: string }
export type RunSummary = Pick<CloudRun, "runId" | "revision" | "updatedAt">;
export interface SaveRequest { expectedRevision: number; envelope: CampaignEnvelope }
export interface SaveConflict { error: string; current?: CloudRun }
