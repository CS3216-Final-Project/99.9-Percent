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
    /** Missing on retained historical opening snapshots. */
    version?: 3 | 4;
    data?: DataSnapshot;
    instances?: InstanceSnapshot[];
    effectiveAppCapacity?: number;
    appBusyBudget?: number;
    routing?: Routing;
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
export interface DataSnapshot {
 profile: "read-heavy" | "write-heavy"; readShare: number; cacheableReadShare: number;
 logical: number; reads: number; writes: number; eligibleReads: number; nonCacheableReads: number;
 hits: number; eligibleMisses: number; databaseReadDemand: number; databaseWriteDemand: number; databaseNewDemand: number;
 effectiveHitRateUsed: number; warmthUsed: number; warmthAfterStep: number; target: number; deployed: boolean;
}
export interface DataStage {
 id: "data-strategy"; version: 1; enteredStep: number; dueStep: number | null; consumed: boolean;
 profile: "read-heavy" | "write-heavy"; source: "seeded" | "evaluation"; configuration: string; contrastConsumed: boolean;
}
export interface ReadCache { activatedStep: number; warmth: number; target: number; tuned: boolean }
export interface Routing { mode: "single" | "balanced"; targets: string[] }
export interface AppInstance {
    id: string; capacity: number; backlog: number; routed: boolean;
    tier: "base" | "large"; state: "active";
}
export interface InstanceSnapshot extends ComponentSnapshot {
    id: string; tier: AppInstance["tier"]; state: "active"; routed: boolean;
    demandRate: number; demandCount: number; processingBudget: number;
}
export type Intervention = "add-app" | "upgrade-db" | "limit" | "unlimit" | "scale-up" | "deploy-lb" | "routing" | "cache" | "cache-tuning";
export interface ScheduledAction {
    id: string;
    type: Intervention;
    requestedStep: number;
    activationStep: number;
    costCents: number;
    activatedStep: number | null;
    targetId?: string;
    capacityAfter?: number;
    routing?: Routing;
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
    lbNumerator?: number;
    cacheNumerator?: number;
}
export interface Settlement {
    period: number;
    step: number;
    revenueCents: number;
    appCents: number;
    dbCents: number;
    salaryCents: number;
    netCents: number;
    lbCents?: number;
    cacheCents?: number;
}
export interface CampaignIncident {
    id: string;
    openedStep: number;
    stableSteps: number;
    snapshots: Snapshot[];
    components?: string[];
    primaryComponent?: string;
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
    /** Boundary of observations made by the deployed Phase 1/2 engine. */
    foundation?: { step: number; inputs: number };
    scenarioId: "opening-db";
    scenarioVersion: 1;
    runId: string;
    step: number;
    incomingRate: number;
    limit: number | null;
    apps: AppInstance[];
    routing: Routing;
    loadBalancer: boolean;
    routingEnabledOnce: boolean;
    scaling: null | { id: "application-scaling"; version: 1; enteredStep: number; dueStep: number | null; consumed: boolean };
    dataStage: DataStage | null;
    readCache: ReadCache | null;
    overload: Record<string, number>;
    dbCapacity: number;
    dbBacklog: number;
    upgraded: boolean;
    cashCents: number;
    ledger: Ledger;
    remainders: {
        app: number;
        db: number;
        salary: number;
        lb?: number;
        cache?: number;
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
    openingMilestone: null | { id: "opening-stability"; incidentId: string; awardedStep: number; acknowledged: boolean };
    openingRecovered: boolean;
    firstPauseConsumed: boolean;
    snapshot: Snapshot;
    recent: Snapshot[];
    trace: TraceEvent[];
    nextEventId: number;
}
