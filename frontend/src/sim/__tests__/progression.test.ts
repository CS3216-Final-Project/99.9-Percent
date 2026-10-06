// @vitest-environment node
import { describe, expect, it } from "vitest";
import { advanceTurn, applyAction, buildReport, dbLoadFactor, has, metrics, newGame, techStatus, type Action, type GameState } from "../index";

function decide(s: GameState, action: Action): GameState {
  const result = applyAction(s, action);
  if (!result.ok) throw new Error(result.message);
  return result.state;
}

function buildAndShip(s: GameState, id: "caching" | "cache_tuning"): GameState {
  s = decide(s, { type: "start_tech", tech: id });
  s = decide(s, { type: "assign_engineers", taskId: s.tasks[0].id, count: 3 });
  while (s.tasks.length) {
    s = advanceTurn(s);
    expect(s.phase).toBe("management");
  }
  const release = s.releases[0];
  // Isolate activation from deployment regression RNG, which has its own tests.
  s = { ...s, releases: [{ ...release, tested: true }], techDebt: 0 };
  return decide(s, { type: "deploy_release", releaseId: release.id });
}

describe("documented technology progression", () => {
  it("provides baseline metrics without research, cash or engineering work", () => {
    const s = newGame(1);
    expect(metrics(s).hasMonitoring).toBe(true);
    expect(has(s, "monitoring")).toBe(true);
    expect(s.techDone).toEqual([]);
    expect(applyAction(s, { type: "start_tech", tech: "monitoring" })).toMatchObject({ ok: false, reason: "invalid" });
    expect(applyAction(s, { type: "start_tech", tech: "replicas" })).toMatchObject({ ok: false, reason: "invalid" });
    expect(s.tasks).toEqual([]);
  });

  it("lets players choose scale out without buying scale up", () => {
    const s = newGame(1);
    const next = decide(s, { type: "start_tech", tech: "load_balancing" });
    expect(next.cash).toBeLessThan(s.cash);
    expect(next.tasks[0].techId).toBe("load_balancing");
    expect(has(next, "larger_servers")).toBe(false);
    expect(metrics(next).appCapacity).toBe(metrics(s).appCapacity);
    expect(s.tasks).toEqual([]);
  });

  it("uses the same pending database upgrade from the tree and inspector", () => {
    const s = newGame(1);
    const next = decide(s, { type: "start_tech", tech: "larger_database" });
    expect(next).toEqual(decide(s, { type: "start_db_upgrade" }));
    expect(techStatus(next, "larger_database")).toBe("in_progress");
    expect(applyAction(next, { type: "start_db_upgrade" })).toMatchObject({ ok: false, reason: "already_done" });
    const built = advanceTurn(advanceTurn(next));
    expect(techStatus(built, "larger_database")).toBe("ready");
    expect(built.infra.dbTier).toBe(0);
  });

  it("warms read cache over time and makes tuning improve hit rate and warm-up", () => {
    const s = { ...newGame(1), users: 100, upcomingSurge: null };
    const cached = buildAndShip(s, "caching");
    expect(cached.cacheWarmth).toBe(0);
    expect(dbLoadFactor(cached)).toBe(dbLoadFactor(s));
    const halfWarm = advanceTurn(cached);
    expect(halfWarm.cacheWarmth).toBe(0.5);
    expect(dbLoadFactor(halfWarm)).toBeCloseTo(0.82);
    const warm = advanceTurn(halfWarm);
    expect(dbLoadFactor(warm)).toBeCloseTo(0.64);
    const tuned = buildAndShip(warm, "cache_tuning");
    expect(dbLoadFactor(tuned)).toBeCloseTo(0.5);
    expect(metrics(tuned).costs.tooling).toBeGreaterThan(metrics(warm).costs.tooling);
    expect(dbLoadFactor(advanceTurn({ ...tuned, cacheWarmth: 0 }))).toBeCloseTo(0.5);
    // Cache tuning cannot remove writes or increase processing capacity.
    expect(metrics(tuned).dbCapacity).toBe(metrics(warm).dbCapacity);
    expect(metrics(tuned).appCapacity).toBe(metrics(warm).appCapacity);
  });

  it("rejects cache tuning without a deployed read cache", () => {
    const s = newGame(1);
    expect(applyAction(s, { type: "start_tech", tech: "cache_tuning" })).toMatchObject({ ok: false, reason: "prerequisites" });
    expect(s.tasks).toEqual([]);
  });

  it("preserves legacy completed upgrades and counts only the nine-node tree", () => {
    const s = { ...newGame(1), techDone: ["replicas", "monitoring", "larger_servers"] as GameState["techDone"], infra: { ...newGame(1).infra, dbTier: 1 } };
    expect(metrics(s).dbCapacity).toBeGreaterThan(metrics({ ...s, techDone: [] }).dbCapacity);
    const upgrading = decide(s, { type: "start_db_upgrade" });
    expect(buildReport(upgrading).techCount).toBe(2);
    expect(buildReport(upgrading).techTotal).toBe(9);
    expect(buildReport(upgrading).focus.map((b) => b.name).sort()).toEqual(["Capacity", "Data", "Reliability"]);
  });

  it("continues cache warm-up identically after save serialization", () => {
    const s = { ...newGame(1), techDone: ["caching"] as GameState["techDone"], cacheWarmth: 0 };
    expect(advanceTurn(JSON.parse(JSON.stringify(s)))).toEqual(advanceTurn(s));
    // Older saves do not contain cacheWarmth; their deployed cache stays warm.
    expect(dbLoadFactor({ ...s, cacheWarmth: undefined })).toBeCloseTo(0.64);
  });

  it("requires a spare, health checks and routing before automatic failover can be built", () => {
    const s = newGame(1);
    for (const missing of ["standby", "health_checks", "load_balancing"]) {
      const techDone = ["standby", "health_checks", "load_balancing"].filter((id) => id !== missing) as GameState["techDone"];
      expect(applyAction({ ...s, techDone }, { type: "start_tech", tech: "auto_failover" })).toMatchObject({ ok: false, reason: "prerequisites" });
    }
    expect(decide({ ...s, techDone: ["standby", "health_checks", "load_balancing"] }, { type: "start_tech", tech: "auto_failover" }).tasks[0].techId).toBe("auto_failover");
  });

  it("promotes the spare without increasing capacity or hiding a remaining overload", () => {
    let observed = false;
    for (let seed = 1; seed < 100 && !observed; seed++) {
      const s = newGame(seed);
      s.turn = 8;
      s.users = 10_000;
      s.upcomingSurge = null;
      s.infra.dbTier = 1;
      s.infra.appHosts[0].status = "degraded";
      s.infra.appHosts[0].degradedTurn = 7;
      s.techDone = ["standby", "health_checks", "load_balancing", "auto_failover"];
      const next = advanceTurn(s);
      if (!next.postmortems.some((pm) => pm.outcome === "auto_mitigated")) continue;
      observed = true;
      expect(next.infra.appHosts).toHaveLength(s.infra.appHosts.length);
      expect(metrics(next).appCapacity).toBe(metrics(s).appCapacity);
      expect(next.phase).toBe("incident");
      expect(next.incident?.type).toBe("app_overload");
      expect(next.infra.appHosts.every((host) => host.status === "healthy")).toBe(true);
      expect(s.infra.appHosts[0].status).toBe("degraded");
    }
    expect(observed).toBe(true);
  });
});
