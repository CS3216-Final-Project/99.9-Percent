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
    version?: 3 | 4 | 5 | 6 | 7;
    reliability?: ReliabilityObservation;
    spikes?: SpikeObservation;
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
export interface SpikeObservation {
 activePulse: number | null; routedBusyBasisPoints: number; installed: number; routed: number;
 enabled: boolean; highSteps: number; lowSteps: number; cooldownUntil: number; blockedReason: string | null;
}
export interface Autoscaler {
 activatedStep: number; enabled: boolean; highSteps: number; lowSteps: number; cooldownUntil: number;
 managedAppIds: string[]; joiningAppId: string | null; expectedRouting: string; blockedReason: string | null;
}
export interface SpikeStage {
 id: "traffic-spikes"; version: 1; configuration: string; enteredStep: number;
 deadlines: number[]; consumed: string[]; researchEarned: 1; researchSpent: 0 | 1;
 controller: Autoscaler | null; baselineStableSteps: number; completedStep: number | null; acknowledged: boolean;
}
export interface ReadCache { activatedStep: number; warmth: number; target: number; tuned: boolean }
export interface Routing { mode: "single" | "balanced"; targets: string[] }
export interface AppInstance {
    id: string; capacity: number; backlog: number; routed: boolean;
    tier: "base" | "large"; state: "active";
    health?: "healthy" | "failed"; detectedHealth?: "unknown" | "healthy" | "unhealthy"; healthChangedStep?: number; detectedStep?: number | null; role?: "serving" | "spare";
}
export interface InstanceSnapshot extends ComponentSnapshot {
    id: string; tier: AppInstance["tier"]; state: "active"; routed: boolean;
    demandRate: number; demandCount: number; processingBudget: number;
    health?: AppInstance["health"]; detectedHealth?: AppInstance["detectedHealth"]; role?: AppInstance["role"]; configured?: boolean;
}
export type Intervention = "add-app" | "upgrade-db" | "limit" | "unlimit" | "scale-up" | "deploy-lb" | "routing" | "cache" | "cache-tuning" | "deploy-autoscaler" | "retire-app" | "health-checks" | "create-spare" | "reserve-spare" | "release-spare" | "failover" | "promote-spare" | "restore-app" | "promotion";
export interface ScheduledAction {
    id: string;
    type: Intervention;
    requestedStep: number;
    activationStep: number;
    costCents: number;
    activatedStep: number | null;
    source?: "player" | "autoscaler" | "failover";
    expectedRouting?: string; failureId?: string;
    cancelledStep?: number;
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
    controllerNumerator?: number;
    checksNumerator?: number; failoverNumerator?: number;
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
    controllerCents?: number;
    checksCents?: number; failoverCents?: number;
}
export interface CampaignIncident {
    kind?: "application-failure"; failureId?: string;
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
export interface OpeningPrevention {
    eligibleStep: number;
    appInspectedStep: number | null;
    dbInspectedStep: number | null;
    stableSteps: number;
    outcome: null | { id: "opening-prevention"; qualifiedStep: number; acknowledged: boolean;
        snapshots: Snapshot[]; rejectedDemand: number; setupCents: number };
}
export interface ServiceMeasurement {
 scope:"full-run"|"since-upgrade"|"combined-stage"; fromStep:number; lastStep:number;
 eligibleSteps:number; healthySteps:number; degradedSteps:number; longestDegradedSteps:number;
}
export interface CampaignScorecard {
 runId:string; seed:number; outcome:"won"|"bankrupt"; capturedStep:number;
 users:number; finalUserTarget:number|null; cashCents:number; revenueCents:number; pendingRevenueCents:number;
 infrastructureSetupCents:number; infrastructureOperatingCents:number; salaryCents:number; promotionCents:number;
 rejectedDemand:number; opportunityCents:number; failedDemand:number; incidentCount:number; recurringCents:number;
 measurement:ServiceMeasurement; combinedMeasurement:ServiceMeasurement|null;
 wholeRunUptime:number|null; wholeRunLargestOutage:number|null;
 ownedTechIds:string[]; deployedTechIds:string[];
 architecture:{apps:AppInstance[];routing:Routing;loadBalancer:boolean;dbCapacity:number;readCache:ReadCache|null;
  controller:Autoscaler|null;checksStep:number|null;failover:ReliabilityStage["failover"]};
}
export interface CombinedRound {
 id:string;index:number;scenario:import("./scenarios/combinedCampaign").CombinedScenario;
 scheduledStep:number;startStep:number;endStep:number;users:number;baseline:number;
 startedStep:number|null;pressureEndedStep:number|null;fault:ReliabilityFault|null;
 stableSteps:number;completedStep:number|null;acknowledged:boolean;
 rejectedBefore:number;setupBefore:number;observations:Snapshot[];
}
export interface CombinedStage {
 id:"combined-campaign";version:1;configuration:string;enteredStep:number;source:"seeded"|"evaluation";
 finalUserTarget:number;users:number;sequence:import("./scenarios/combinedCampaign").CombinedScenario[];
 nextRoundIndex:number;currentRound:CombinedRound|null;completedRounds:CombinedRound[];
 readinessSteps:number;finalStableSteps:number;targetReachedStep:number|null;
 finalReview:CampaignScorecard|null;acknowledged:boolean;service:ServiceMeasurement;
}
export interface CampaignPromotion {
 actionId:string;requestedStep:number;activationStep:number;activatedStep:number|null;
 endStep:number;endedStep:number|null;cooldownUntil:number;costCents:number;
}
export interface Campaign {
    combinedStage?:CombinedStage|null;
    scalingConsent?:{policyVersion:1;acceptedStep:number}|null;
    promotion?:CampaignPromotion|null;
    serviceMeasurement?:ServiceMeasurement;
    scorecard?:CampaignScorecard|null;
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
    spikeStage: SpikeStage | null;
    reliabilityStage?: ReliabilityStage | null;
    nextAppNumber: number;
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
        controller?: number;
        checks?: number; failover?: number;
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
    consumedEvents: string[];
    overloadSteps: number;
    incident: CampaignIncident | null;
    reports: CampaignPostmortem[];
    openingMilestone: null | {id:"opening-stability";incidentId:string|null;outcomeId?:"opening-prevention";awardedStep:number;acknowledged:boolean};
    openingPrevention?: OpeningPrevention;
    openingRecovered: boolean;
    firstPauseConsumed: boolean;
    snapshot: Snapshot;
    recent: Snapshot[];
    trace: TraceEvent[];
    nextEventId: number;
}

export type ReliabilityTech = "health_checks" | "standby" | "auto_failover";
export interface ReliabilityFault {
 id:string; targetId:string; armedStep:number; startStep:number; naturalStep:number;
 startedStep:number|null; restoredStep:number|null; restoreSource:"manual"|"natural"|null; promoted:boolean;
}
export interface ReliabilityStage {
 id:"application-reliability"; version:1; configuration:string; enteredStep:number;
 researchEarned:3; owned:ReliabilityTech[]; checksStep:number|null;
 failover:null|{activatedStep:number;enabled:boolean}; spareId:string|null; fault:ReliabilityFault|null;
 failureSteps:number; stableSteps:number; completedStep:number|null; acknowledged:boolean;
}
export interface ReliabilityObservation {
 configured:string[]; effective:string[]; healthyCapacity:number; healthyRoutedCapacity:number; spareCapacity:number;
 failedDeliveries:number; unroutable:number; faultId:string|null;
}
