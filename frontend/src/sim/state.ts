import { BALANCE } from "./balance";
import { normaliseSeed } from "./rng";
import { SAVE_VERSION } from "./types";
import type { EventKind, GameState, Host, Surge } from "./types";

export function clone<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

export function logEvent(s: GameState, kind: EventKind, text: string): void {
  s.log.push({ id: s.nextId++, turn: s.turn, kind, text });
}

export function newId(s: GameState, prefix: string): string {
  return `${prefix}-${s.nextId++}`;
}

export function addAppHost(s: GameState): Host {
  const host: Host = { id: `app-${s.infra.nextHostNum++}`, status: "healthy", bornTurn: s.turn };
  s.infra.appHosts.push(host);
  return host;
}

/** The newsletter feature that opens every run, so the first weeks always play the same way. */
export function scriptedSurge(): Surge {
  return {
    turn: BALANCE.surge.scriptedTurn,
    mult: BALANCE.surge.scriptedMult,
    users: BALANCE.surge.scriptedUsers,
    label: "A popular tech newsletter features you",
    scripted: true,
  };
}

export function newGame(seedInput: number | string = BALANCE.introSeed): GameState {
  const seed = normaliseSeed(seedInput);
  const s: GameState = {
    version: SAVE_VERSION,
    seed,
    rngState: seed,
    turn: 1,
    phase: "management",
    outcome: null,

    cash: BALANCE.start.cash,
    users: BALANCE.start.users,
    satisfaction: BALANCE.start.satisfaction,
    techDebt: BALANCE.start.techDebt,
    engineers: BALANCE.start.engineers,

    infra: {
      appHosts: [{ id: "app-1", status: "healthy", bornTurn: 1 }],
      nextHostNum: 2,
      dbTier: 0,
      dbHost: { id: "db-primary", status: "healthy", bornTurn: 1 },
    },
    techDone: [],
    tasks: [],
    releases: [],
    deploys: [],
    latentRegression: null,
    lastCapacityTurn: { app: 1, db: 1 },

    activePromos: [],
    promoCooldowns: {},
    upcomingSurge: scriptedSurge(),
    milestonesHit: [],

    incident: null,
    pendingTurn: null,
    reviewId: null,
    postmortems: [],

    live: {
      peakRps: BALANCE.start.users * BALANCE.rpsPerUser * 1.05,
      tempServers: 0,
      latencyMs: 110,
      errorRate: 0,
      availability: 1,
      shed: 0,
    },
    lastReport: null,
    history: [],
    log: [],
    nextId: 1,
    totals: {
      revenue: 0,
      costs: 0,
      invested: 0,
      downtimeMinutes: 0,
      weeks: 0,
      peakUsers: BALANCE.start.users,
      hintsUsed: 0,
      incidents: 0,
      promosRun: 0,
      serversAdded: 0,
      releasesTested: 0,
      releasesUntested: 0,
    },
  };
  logEvent(
    s,
    "info",
    `You are the technical lead. Reach ${BALANCE.targetUsers.toLocaleString("en-US")} users by week ${BALANCE.maxTurns} without running out of cash.`,
  );
  return s;
}
