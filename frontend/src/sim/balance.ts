import type { PromoDef, PromoId } from "./types";

/**
 * Every tunable number in the simulation lives here so the model stays easy to
 * read and to rebalance.
 */
export const BALANCE = {
  /** Campaign length in weeks. Miss the target by then and the run ends. */
  maxTurns: 26,
  targetUsers: 50_000,
  /** The intro uses this seed so every first run opens the same way. */
  introSeed: 9999,

  start: {
    cash: 80_000,
    users: 2_000,
    satisfaction: 78,
    techDebt: 28,
    engineers: 4,
  },

  /** Investor tranche released when the user base passes each milestone. */
  milestones: [
    { users: 5_000, cash: 15_000, label: "5,000 users" },
    { users: 10_000, cash: 30_000, label: "10,000 users" },
    { users: 25_000, cash: 50_000, label: "25,000 users" },
  ],

  /** Peak requests per second generated per active user. */
  rpsPerUser: 0.04,
  /** Weekly revenue per user. */
  arpu: 1.6,
  analyticsArpuBonus: 1.15,
  /** Week-to-week randomness in peak traffic (0.12 = up to +12%). */
  trafficNoise: 0.12,
  /** Share of the week spent at peak load, used for sustained error accounting. */
  peakShare: 0.1,

  server: {
    setupCost: 2_000,
    upkeep: 700,
    capacity: 150,
    largeCapacityMult: 1.6,
    largeUpkeepMult: 1.3,
    /** Without a load balancer traffic is spread unevenly across servers. */
    unbalancedPenalty: 0.88,
    maxWithoutLb: 3,
    maxWithLb: 12,
    replaceCost: 1_500,
    /** Weekly price of one on-demand server added by autoscaling. */
    autoscaleUpkeep: 950,
  },

  db: {
    queriesPerRequest: 1,
    /** Share of database load removed by the caching layer. */
    cacheReduction: 0.36,
    cacheEligibleShare: 0.6,
    tunedCacheReduction: 0.5,
    cacheWarmupPerWeek: 0.5,
    tunedWarmupPerWeek: 1,
    replicaCapacityMult: 1.35,
    replicaUpkeepShare: 0.5,
    replaceCost: 3_500,
    tiers: [
      { name: "Starter", capacity: 320, upkeep: 500, cost: 0, effort: 0 },
      { name: "Standard", capacity: 750, upkeep: 1_500, cost: 10_000, effort: 3 },
      { name: "Performance", capacity: 1_700, upkeep: 4_000, cost: 24_000, effort: 4 },
      { name: "Enterprise", capacity: 3_600, upkeep: 8_500, cost: 48_000, effort: 5 },
    ],
  },

  engineer: {
    salary: 1_600,
    hireCost: 5_000,
    max: 8,
    maxPerTask: 3,
  },

  debt: {
    perTurn: 1.0,
    perTurnWithCodeHealth: 0.4,
    perShippedTask: 2,
    perShippedTaskWithCodeHealth: 1,
    untestedDeploy: 3,
    emergencyChange: 3,
    idleEngineerRelief: 0.6,
    paydownEffort: 3,
    paydownAmount: 14,
    paydownAmountWithCodeHealth: 20,
    cleanupPenaltyPerTurn: 1.5,
    /** Engineers slow down in steps as debt builds (checked from the top). */
    velocitySteps: [
      { debt: 80, speed: 0.55 },
      { debt: 60, speed: 0.7 },
      { debt: 40, speed: 0.85 },
    ],
  },

  deploy: {
    riskSmall: 0.14,
    riskMedium: 0.2,
    riskLarge: 0.26,
    testedMult: 0.15,
    ciMult: 0.55,
    maxRisk: 0.75,
    testEffortShare: 0.4,
    testEffortShareWithCi: 0.2,
    fixEffortShare: 0.35,
    /** How many weeks back a rollback can still reach. */
    rollbackWindow: 2,
  },

  growth: {
    organicRate: 0.06,
    baseChurn: 0.012,
    churnPerSatPoint: 0.0012,
    satisfactionCeiling: 88,
    latencyPenaltyMax: 18,
    errorPenaltyMult: 300,
    errorPenaltyMax: 40,
    satisfactionInertia: 0.35,
    dataRepairPenalty: 6,
  },

  hosts: {
    /** Weekly chance that one machine in the app fleet starts to degrade. */
    appHazard: 0.05,
    dbHazard: 0.03,
    debtHazardDivisor: 60,
    hotMultiplier: 1.6,
    failChance: 0.6,
    /** No hardware trouble during the opening weeks. */
    safeUntilTurn: 6,
  },

  surge: {
    scriptedTurn: 4,
    scriptedMult: 1.5,
    scriptedUsers: 0.12,
    randomChance: 0.11,
    randomFromTurn: 7,
  },

  incident: {
    /** Seconds on the crisis clock; each second stands for a minute of outage. */
    maxDuration: 120,
    userLossPerHour: 0.05,
    refundPerHour: 0.05,
    satLossPerHour: 10,
    failureExtraMinutes: 240,
    failureExtraSeverity: 0.6,
    dataLossUsers: 0.05,
    dataLossSatisfaction: 8,
    autoMitigatedMinutes: 1.5,
    emergencyCostMult: 1.5,
    inspectSeconds: { none: 8, monitoring: 3, tracing: 1.5 },
    actionSeconds: {
      scale_out: 14,
      db_upgrade: 22,
      rollback: 10,
      rollbackSafe: 4,
      failover: 8,
      rate_limit: 5,
      replace_app: 24,
      replace_db: 45,
      replace_db_backup: 30,
      replace_none: 6,
      restart: 6,
    },
  },

  minutesPerWeek: 10_080,
} as const;

export const PROMOS: Record<PromoId, PromoDef> = {
  social: {
    id: "social",
    name: "Social push",
    description: "Small, cheap, gentle on servers.",
    userGain: 0.1,
    spike: 0.12,
    minCost: 1_200,
    costPerUser: 2.2,
    cooldown: 2,
  },
  launch: {
    id: "launch",
    name: "Launch campaign",
    description: "Big growth, big traffic spike.",
    userGain: 0.26,
    spike: 0.38,
    minCost: 3_500,
    costPerUser: 2.6,
    cooldown: 3,
    minUsers: 5_000,
  },
  targeted: {
    id: "targeted",
    name: "Targeted campaign",
    description: "Efficient, with a small spike.",
    userGain: 0.2,
    spike: 0.1,
    minCost: 3_000,
    costPerUser: 1.6,
    cooldown: 2,
    minUsers: 10_000,
  },
};

export const PROMO_ORDER: PromoId[] = ["social", "launch", "targeted"];
