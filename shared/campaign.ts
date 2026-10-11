/** Portable compact campaign contract. Clients replay and validate before loading. */
export interface CampaignEnvelope {
  schemaVersion: 3 | 4;
  scenarioId: "opening-db";
  scenarioVersion: 1;
  runId: string;
  seed: number;
  step: number;
  inputs: { step: number; action: { type: string } }[];
  foundation?: { step: number; inputs: number };
  runtime: { remainderMs: number };
  savedAt: number;
}
export interface Account { id: string; displayName: string }
export interface AppSession { account: Account; csrfToken: string }
export interface CloudRun { runId: string; revision: number; envelope: CampaignEnvelope; updatedAt: string }
export type RunSummary = Pick<CloudRun, "runId" | "revision" | "updatedAt">;
export interface SaveRequest { expectedRevision: number; envelope: CampaignEnvelope }
export interface SaveConflict { error: string; current?: CloudRun }
