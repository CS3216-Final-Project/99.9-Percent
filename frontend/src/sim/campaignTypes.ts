import type { Action } from "./types";
/** One player decision, recorded at the step it was made. */
export interface CampaignInput {
    step: number;
    action: Action;
}
export interface ComponentSnapshot {
    demand: number;
    capacity: number;
    processed: number;
    backlog: number;
    failed: number;
    busyUtilisation: number;
    demandRatio: number;
}
export interface Snapshot {
    step: number;
    incoming: number;
    admitted: number;
    rejected: number;
    app: ComponentSnapshot;
    db: ComponentSnapshot;
    installedAppCapacity: number;
    successful: number;
    failed: number;
    latencyMs: number;
    serviceErrorRate: number | null;
}
export type Intervention = "add-app" | "upgrade-db" | "limit" | "unlimit";
export interface ScheduledAction {
    id: string;
    type: Intervention;
    requestedStep: number;
    activationStep: number;
    costCents: number;
    activatedStep: number | null;
}
export interface TraceEvent {
    id: number;
    step: number;
    type: string;
    data: Record<string, string | number | boolean | null>;
}
export interface Ledger {
    successes: number;
    failures: number;
    rejected: number;
    appNumerator: number;
    dbNumerator: number;
    salaryNumerator: number;
}
export interface Settlement {
    period: number;
    step: number;
    revenueCents: number;
    appCents: number;
    dbCents: number;
    salaryCents: number;
    netCents: number;
}
export interface CampaignIncident {
    id: string;
    openedStep: number;
    stableSteps: number;
    snapshots: Snapshot[];
}
export interface CampaignPostmortem {
    id: string;
    openedStep: number;
    recoveredStep: number;
    snapshots: Snapshot[];
    events: TraceEvent[];
    explanations: string[];
    limited: boolean;
    setupCents: number;
}
export interface Campaign {
    scenarioId: "opening-db";
    scenarioVersion: 1;
    runId: string;
    step: number;
    incomingRate: number;
    limit: number | null;
    apps: {
        id: string;
        capacity: number;
        backlog: number;
        routed: boolean;
    }[];
    dbCapacity: number;
    dbBacklog: number;
    upgraded: boolean;
    cashCents: number;
    ledger: Ledger;
    remainders: {
        app: number;
        db: number;
        salary: number;
    };
    settlements: Settlement[];
    lastSettledPeriod: number;
    revenueCents: number;
    costsCents: number;
    investedCents: number;
    cumulative: {
        admitted: number;
        rejected: number;
        successful: number;
        failed: number;
    };
    pending: ScheduledAction[];
    actions: ScheduledAction[];
    /** Every player decision, accepted or rejected, in order. Replaying them from a new run rebuilds this one. */
    inputs: CampaignInput[];
    consumedEvents: string[];
    overloadSteps: number;
    incident: CampaignIncident | null;
    reports: CampaignPostmortem[];
    openingRecovered: boolean;
    firstPauseConsumed: boolean;
    snapshot: Snapshot;
    recent: Snapshot[];
    trace: TraceEvent[];
    nextEventId: number;
}
