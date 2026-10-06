// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  advanceTurn,
  applyAction,
  BALANCE,
  buildReport,
  currentWarnings,
  forecast,
  incidentTick,
  metrics,
  newGame,
  recoveryOptions,
  releaseRisk,
  symptomaticEquipment,
  taskEta,
  TECH,
  TECH_ORDER,
  techStatus,
  type Action,
  type GameState,
  type RecoveryId,
  type TechId,
} from "../index";
import { balanced, runBot } from "./bots";

function must(s: GameState, action: Action): GameState {
  const r = applyAction(s, action);
  if (!r.ok) throw new Error(`${action.type} failed: ${r.message}`);
  return r.state;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Skip the engineering and deployment steps: used to set up scenarios quickly. */
function grant(s: GameState, ...ids: TechId[]): GameState {
  const next = clone(s);
  for (const id of ids) if (!next.techDone.includes(id)) next.techDone.push(id);
  return next;
}

function withServers(s: GameState, n: number): GameState {
  const next = clone(s);
  while (next.infra.appHosts.length < n) {
    next.infra.appHosts.push({ id: `app-${next.infra.nextHostNum++}`, status: "healthy", bornTurn: next.turn });
  }
  return next;
}

function runIncident(start: GameState, id: RecoveryId, diagnose = 10): GameState {
  let s = incidentTick(start, diagnose);
  s = must(s, { type: "incident_action", recovery: id });
  let guard = 0;
  while (s.phase === "incident" && s.incident?.pending && guard++ < 200) s = incidentTick(s, 1);
  return s;
}

describe("tech tree", () => {
  it("has nine research nodes across capacity, data and reliability", () => {
    expect(TECH_ORDER).toHaveLength(9);
    for (const branch of ["capacity", "data", "reliability"]) {
      expect(TECH_ORDER.filter((id) => TECH[id].branch === branch)).toHaveLength(3);
    }
    for (const id of TECH_ORDER) {
      const t = TECH[id];
      expect(t.cost).toBeGreaterThan(0);
      expect(t.effort).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(8);
      expect(t.effects.length).toBeGreaterThan(0);
      for (const r of t.requires) expect(TECH[r]).toBeDefined();
    }
  });

  it("encodes the cross-branch dependencies", () => {
    expect(TECH.autoscaling.requires).toEqual(["load_balancing"]);
    expect(TECH.auto_failover.requires).toEqual(expect.arrayContaining(["standby", "health_checks", "load_balancing"]));
    expect(TECH.cache_tuning.requires).toEqual(["caching"]);
    expect(techStatus(newGame(1), "larger_servers")).toBe("available");
    expect(techStatus(newGame(1), "load_balancing")).toBe("available");
  });

  it("locks nodes until prerequisites are deployed", () => {
    const s = newGame(1);
    expect(techStatus(s, "autoscaling")).toBe("locked");
    const r = applyAction(s, { type: "start_tech", tech: "autoscaling" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("prerequisites");
    expect(techStatus(grant(s, "load_balancing", "monitoring"), "autoscaling")).toBe("available");
  });

  it("moves a node through in-progress, ready and done", () => {
    let s = newGame(1);
    s = must(s, { type: "start_tech", tech: "larger_servers" });
    const before = metrics(s).appCapacity;
    expect(techStatus(s, "larger_servers")).toBe("in_progress");
    s = must(s, { type: "assign_engineers", taskId: s.tasks[0].id, count: 3 });
    s = advanceTurn(s);
    expect(techStatus(s, "larger_servers")).toBe("ready");
    expect(metrics(s).appCapacity).toBe(before);
    s = must(s, { type: "deploy_release", releaseId: s.releases[0].id });
    expect(techStatus(s, "larger_servers")).toBe("done");
    expect(metrics(s).appCapacity).toBeGreaterThan(before);
  });
});

describe("actions", () => {
  it("rejects invalid requests without changing state", () => {
    const s = newGame(1);
    const poor = { ...clone(s), cash: 100 };
    const cases: [GameState, Action, string][] = [
      [poor, { type: "add_server" }, "insufficient_funds"],
      [poor, { type: "start_tech", tech: "larger_servers" }, "insufficient_funds"],
      [s, { type: "launch_promotion", promo: "launch" }, "prerequisites"],
      [s, { type: "remove_server" }, "limit_reached"],
      [s, { type: "assign_engineers", taskId: "nope", count: 1 }, "not_found"],
      [s, { type: "deploy_release", releaseId: "nope" }, "not_found"],
      [s, { type: "incident_action", recovery: "restart" }, "wrong_phase"],
      [s, { type: "acknowledge_review" }, "wrong_phase"],
    ];
    for (const [state, action, reason] of cases) {
      const before = JSON.stringify(state);
      const r = applyAction(state, action);
      expect(r.ok, action.type).toBe(false);
      if (!r.ok) {
        expect(r.reason).toBe(reason);
        expect(r.message.length).toBeGreaterThan(5);
      }
      expect(JSON.stringify(state)).toBe(before);
    }
  });

  it("enforces the server limit until load balancing exists", () => {
    let s = newGame(1);
    s = must(s, { type: "add_server" });
    s = must(s, { type: "add_server" });
    const r = applyAction(s, { type: "add_server" });
    expect(r.ok).toBe(false);
    expect(applyAction(grant(s, "load_balancing"), { type: "add_server" }).ok).toBe(true);
  });

  it("promotions cost money, add traffic and go on cooldown", () => {
    let s = newGame(1);
    const before = forecast(s).peakLow;
    s = must(s, { type: "launch_promotion", promo: "social" });
    expect(s.cash).toBeLessThan(BALANCE.start.cash);
    expect(forecast(s).peakLow).toBeGreaterThan(before * 1.15);
    expect(applyAction(s, { type: "launch_promotion", promo: "social" }).ok).toBe(false);
    s = advanceTurn(s);
    expect(s.users).toBeGreaterThan(BALANCE.start.users * 1.08);
    const again = applyAction(s, { type: "launch_promotion", promo: "social" });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe("cooldown");
  });

  it("more engineers finish work sooner", () => {
    let s = newGame(1);
    s = must(s, { type: "start_tech", tech: "caching" });
    const id = s.tasks[0].id;
    const one = must(s, { type: "assign_engineers", taskId: id, count: 1 });
    const three = must(s, { type: "assign_engineers", taskId: id, count: 3 });
    expect(taskEta(one, one.tasks[0])!).toBeGreaterThan(taskEta(three, three.tasks[0])!);
    const none = must(s, { type: "assign_engineers", taskId: id, count: 0 });
    expect(taskEta(none, none.tasks[0])).toBeNull();
    expect(advanceTurn(none).tasks[0].progress).toBe(0);
  });

  it("cannot assign more engineers than the company has", () => {
    let s = newGame(1);
    s = must(s, { type: "start_tech", tech: "caching" });
    s = must(s, { type: "start_tech", tech: "larger_servers" });
    s = must(s, { type: "assign_engineers", taskId: s.tasks[1].id, count: 1 });
    s = must(s, { type: "assign_engineers", taskId: s.tasks[0].id, count: 3 });
    expect(metrics(s).freeEngineers).toBe(0);
    const r = applyAction(s, { type: "assign_engineers", taskId: s.tasks[1].id, count: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_engineers");
  });

  it("testing a release takes engineer time and cuts regression risk", () => {
    let s = newGame(1);
    s = must(s, { type: "start_tech", tech: "caching" });
    s = must(s, { type: "assign_engineers", taskId: s.tasks[0].id, count: 3 });
    s = advanceTurn(advanceTurn(s));
    const rel = s.releases[0];
    expect(rel.tested).toBe(false);
    const untested = releaseRisk(s, rel);
    s = must(s, { type: "test_release", releaseId: rel.id });
    expect(s.tasks.some((t) => t.kind === "test_release")).toBe(true);
    expect(applyAction(s, { type: "deploy_release", releaseId: rel.id }).ok).toBe(false);
    s = must(s, { type: "assign_engineers", taskId: s.tasks[0].id, count: 2 });
    s = advanceTurn(s);
    expect(s.releases[0].tested).toBe(true);
    expect(releaseRisk(s, s.releases[0])).toBeLessThan(untested * 0.3);
  });

  it("technical debt raises deployment risk and slows engineers", () => {
    const s = newGame(1);
    const low = { ...clone(s), techDebt: 5 };
    const high = { ...clone(s), techDebt: 80 };
    const rel = { size: 4, tested: false };
    expect(releaseRisk(high, rel)).toBeGreaterThan(releaseRisk(low, rel) * 2);
    expect(metrics(high).velocity).toBeLessThan(metrics(low).velocity);
  });

  it("upgrades change capacity", () => {
    const s = newGame(1);
    const base = metrics(s);
    expect(metrics(grant(s, "larger_servers")).appCapacity).toBeGreaterThan(base.appCapacity * 1.5);
    expect(metrics(grant(s, "caching")).dbUtil).toBeLessThan(base.dbUtil * 0.7);
    expect(metrics(grant(s, "replicas")).dbCapacity).toBeGreaterThan(base.dbCapacity * 1.3);
    expect(metrics(grant(s, "analytics")).revenue).toBeGreaterThan(base.revenue * 1.1);
    const three = withServers(s, 3);
    expect(metrics(grant(three, "load_balancing")).appCapacity).toBeGreaterThan(metrics(three).appCapacity);
  });
});

describe("determinism and persistence", () => {
  it("the same seed replays identically", () => {
    const a = runBot(4242, balanced, "expert").state;
    const b = runBot(4242, balanced, "expert").state;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("different seeds diverge", () => {
    const a = runBot(1, balanced, "expert").state;
    const b = runBot(2, balanced, "expert").state;
    expect(JSON.stringify(a.history)).not.toBe(JSON.stringify(b.history));
  });

  it("every run opens with the same scripted surge", () => {
    for (const seed of [1, 2, 3]) {
      const s = newGame(seed);
      expect(s.users).toBe(BALANCE.start.users);
      expect(s.upcomingSurge?.turn).toBe(BALANCE.surge.scriptedTurn);
      expect(currentWarnings(s).some((w) => w.code === "surge_incoming")).toBe(true);
    }
  });

  it("a save restored from JSON continues exactly like the original", () => {
    let s = newGame(77);
    s = must(s, { type: "start_tech", tech: "larger_servers" });
    s = advanceTurn(advanceTurn(s));
    const restored = JSON.parse(JSON.stringify(s)) as GameState;
    expect(JSON.stringify(advanceTurn(advanceTurn(restored)))).toBe(JSON.stringify(advanceTurn(advanceTurn(s))));
  });

  it("a mid-incident save resumes with the same clock and damage", () => {
    let s = newGame(1);
    s = { ...clone(s), users: 9000 };
    s = advanceTurn(s);
    expect(s.phase).toBe("incident");
    s = incidentTick(s, 17);
    const restored = JSON.parse(JSON.stringify(s)) as GameState;
    expect(restored.incident?.elapsed).toBeCloseTo(17, 5);
    expect(JSON.stringify(incidentTick(restored, 5))).toBe(JSON.stringify(incidentTick(s, 5)));
  });
});

describe("incidents", () => {
  it("warns before an overload and then fires an application overload", () => {
    let s = grant(newGame(1), "monitoring");
    s = { ...s, users: 3600 };
    expect(currentWarnings(s).some((w) => w.code === "app_hot")).toBe(true);
    s = advanceTurn(s);
    expect(s.phase).toBe("incident");
    expect(s.incident?.type).toBe("app_overload");
    expect(s.incident?.cause.contributing.join(" ")).toMatch(/capacity warning/i);
    expect(symptomaticEquipment(s)).toContain("app");
  });

  it("scaling out fixes an overload; the postmortem records it", () => {
    let s = advanceTurn({ ...clone(newGame(1)), users: 4500 });
    expect(s.incident?.type).toBe("app_overload");
    const servers = s.infra.appHosts.length;
    s = runIncident(s, "scale_out");
    expect(s.phase).toBe("review");
    expect(s.infra.appHosts.length).toBeGreaterThan(servers);
    const pm = s.postmortems[s.postmortems.length - 1];
    expect(pm.outcome).toBe("resolved");
    expect(pm.type).toBe("app_overload");
    expect(pm.whatFailed).toMatch(/requests\/s/);
    expect(pm.response.join(" ")).toMatch(/Scaled out/);
    expect(pm.prevention.length).toBeGreaterThan(0);
    s = must(s, { type: "acknowledge_review" });
    expect(s.phase).toBe("management");
    expect(s.turn).toBe(2);
  });

  it("the wrong fix wastes time and money and leaves the incident active", () => {
    let s = advanceTurn({ ...clone(newGame(1)), users: 4500 });
    const cash = s.cash;
    s = runIncident(s, "db_upgrade");
    expect(s.phase).toBe("incident");
    expect(s.incident?.attempts[0].outcome).toBe("no_effect");
    expect(s.cash).toBeLessThan(cash);
    s = runIncident(s, "restart", 0);
    expect(s.incident?.attempts[1].outcome).toBe("no_effect");
    s = runIncident(s, "rate_limit", 0);
    expect(s.phase).toBe("review");
    expect(s.postmortems[s.postmortems.length - 1].outcome).toBe("mitigated");
    expect(s.postmortems[s.postmortems.length - 1].whyOutcome).toMatch(/did not help/);
  });

  it("an ignored incident fails after two hours and does lasting damage", () => {
    const start = advanceTurn({ ...clone(newGame(1)), users: 4500 });
    const quick = runIncident(start, "scale_out");
    let slow = start;
    let guard = 0;
    while (slow.phase === "incident" && guard++ < 500) slow = incidentTick(slow, 1);
    expect(slow.phase).toBe("review");
    const pm = slow.postmortems[slow.postmortems.length - 1];
    expect(pm.outcome).toBe("failed");
    expect(slow.users).toBeLessThan(quick.users);
    expect(slow.satisfaction).toBeLessThan(quick.satisfaction);
    expect(slow.tasks.some((t) => t.kind === "repair")).toBe(true);
  });

  it("database saturation is not fixed by more app servers", () => {
    let s = withServers(grant(newGame(1), "load_balancing"), 8);
    s = advanceTurn({ ...s, users: 9500 });
    expect(s.incident?.type).toBe("db_saturation");
    s = runIncident(s, "scale_out");
    expect(s.phase).toBe("incident");
    expect(s.incident?.attempts[0].outcome).toBe("no_effect");
    s = runIncident(s, "db_upgrade", 0);
    expect(s.phase).toBe("review");
    expect(s.infra.dbTier).toBe(1);
    expect(s.postmortems[s.postmortems.length - 1].contributing.join(" ")).toMatch(/caching/i);
  });

  it("caching keeps the same load off the database", () => {
    const base = withServers(grant(newGame(1), "load_balancing"), 8);
    const cached = advanceTurn({ ...grant(base, "caching"), users: 9500 });
    expect(cached.phase).toBe("management");
  });

  function regressedState(): GameState {
    // Find a seed where an untested deploy at high debt regresses.
    for (let seed = 1; seed < 200; seed++) {
      let s = newGame(seed);
      s = must(s, { type: "start_tech", tech: "caching" });
      s = must(s, { type: "assign_engineers", taskId: s.tasks[0].id, count: 3 });
      s = advanceTurn(advanceTurn(s));
      if (s.phase !== "management" || s.releases.length === 0) continue;
      s = { ...clone(s), techDebt: 90 };
      s = must(s, { type: "deploy_release", releaseId: s.releases[0].id });
      if (s.latentRegression) return s;
    }
    throw new Error("no regression found");
  }

  it("an untested deploy can regress; rollback fixes it and queues a fix", () => {
    let s = regressedState();
    expect(s.techDone).toContain("caching");
    s = advanceTurn(s);
    expect(s.incident?.type).toBe("deploy_regression");
    expect(s.incident?.cause.contributing.join(" ")).toMatch(/untested/);

    const wrong = runIncident(s, "scale_out");
    expect(wrong.incident?.attempts[0].outcome).toBe("no_effect");

    s = runIncident(s, "rollback");
    expect(s.phase).toBe("review");
    expect(s.techDone).not.toContain("caching");
    expect(s.releases[0].needsFix).toBe(true);
    expect(s.tasks.some((t) => t.kind === "fix_release")).toBe(true);
    expect(applyAction(must(s, { type: "acknowledge_review" }), { type: "deploy_release", releaseId: s.releases[0].id }).ok).toBe(false);
  });

  it("canary rollouts catch a regression before it becomes an incident", () => {
    for (let seed = 1; seed < 200; seed++) {
      let s = newGame(seed);
      s = must(s, { type: "start_tech", tech: "caching" });
      s = must(s, { type: "assign_engineers", taskId: s.tasks[0].id, count: 3 });
      s = advanceTurn(advanceTurn(s));
      if (s.phase !== "management" || s.releases.length === 0) continue;
      s = { ...grant(s, "safer_rollouts"), techDebt: 90 };
      const after = must(s, { type: "deploy_release", releaseId: s.releases[0].id });
      if (after.techDone.includes("caching")) continue;
      expect(after.latentRegression).toBeNull();
      expect(after.releases[0].needsFix).toBe(true);
      expect(after.postmortems[after.postmortems.length - 1].outcome).toBe("auto_mitigated");
      expect(advanceTurn(after).phase).toBe("management");
      return;
    }
    throw new Error("no regression found");
  });

  function failingHost(setup: (s: GameState) => GameState, target: "app" | "db"): GameState {
    for (let seed = 1; seed < 100; seed++) {
      let s = setup(newGame(seed));
      s = clone(s);
      s.turn = 8;
      s.upcomingSurge = null;
      if (target === "app") {
        s.infra.appHosts[0].status = "degraded";
        s.infra.appHosts[0].degradedTurn = 7;
      } else {
        s.infra.dbHost.status = "degraded";
        s.infra.dbHost.degradedTurn = 7;
      }
      expect(currentWarnings(s).some((w) => w.code === "host_degraded")).toBe(true);
      const next = advanceTurn(s);
      const failed = next.phase === "incident" || next.log.some((e) => /died/.test(e.text));
      if (failed) return next;
    }
    throw new Error("host never failed");
  }

  it("a degraded server that is not replaced fails; failover needs a standby", () => {
    let s = failingHost((g) => withServers(g, 2), "app");
    expect(s.incident?.type).toBe("instance_failure");
    expect(recoveryOptions(s).find((o) => o.id === "failover")?.enabled).toBe(false);
    s = runIncident(s, "replace_instance");
    expect(s.phase).toBe("review");
    expect(s.infra.appHosts.every((h) => h.status === "healthy")).toBe(true);

    let spare = failingHost((g) => withServers(grant(g, "standby"), 2), "app");
    spare = runIncident(spare, "failover");
    expect(spare.phase).toBe("review");
    expect(spare.incident).toBeNull();
    const impactSpare = spare.postmortems[spare.postmortems.length - 1].impact.durationSeconds;
    const impactNone = s.postmortems[s.postmortems.length - 1].impact.durationSeconds;
    expect(impactSpare).toBeLessThan(impactNone);
  });

  it("replacing a degraded server in time prevents the failure", () => {
    let s = withServers(newGame(3), 2);
    s = clone(s);
    s.turn = 8;
    s.upcomingSurge = null;
    s.infra.appHosts[0].status = "degraded";
    s.infra.appHosts[0].degradedTurn = 7;
    s = must(s, { type: "replace_host", hostId: s.infra.appHosts[0].id });
    expect(currentWarnings(s).some((w) => w.code === "host_degraded")).toBe(false);
    expect(advanceTurn(s).phase).toBe("management");
  });

  it("automatic failover absorbs instance failures with no incident", () => {
    const app = failingHost((g) => withServers(grant(g, "standby", "auto_failover", "health_checks", "load_balancing"), 2), "app");
    expect(app.phase).toBe("management");
    expect(app.postmortems[app.postmortems.length - 1].outcome).toBe("auto_mitigated");

    const db = failingHost((g) => grant(g, "replicas", "auto_failover"), "db");
    expect(db.phase).toBe("management");
    expect(db.infra.dbHost.status).toBe("healthy");
  });

  it("a database failure without backups loses data; with backups it does not", () => {
    let bare = failingHost((g) => g, "db");
    expect(bare.incident?.cause.target).toBe("db");
    bare = runIncident(bare, "replace_instance");
    expect(bare.postmortems[bare.postmortems.length - 1].whyOutcome).toMatch(/permanently lost/);
    expect(bare.tasks.some((t) => t.repairCode === "data_repair")).toBe(true);

    let safe = failingHost((g) => grant(g, "backups"), "db");
    safe = runIncident(safe, "replace_instance");
    expect(safe.tasks.some((t) => t.repairCode === "data_repair")).toBe(false);
    expect(safe.users).toBeGreaterThan(bare.users);
  });

  it("baseline monitoring provides fast investigation and legacy tracing still works", () => {
    const base = { ...clone(newGame(1)), users: 4500 };
    const inspect = (s: GameState) => {
      let cur = must(advanceTurn(s), { type: "incident_inspect", equipment: "app" });
      let t = 0;
      while (cur.incident?.inspecting && t < 60) {
        cur = incidentTick(cur, 0.5);
        t += 0.5;
      }
      return { t, evidence: cur.incident!.evidence[0] };
    };
    const blind = inspect(base);
    const monitored = inspect(grant(base, "monitoring"));
    const traced = inspect(grant(base, "monitoring", "tracing"));
    expect(monitored.t).toBe(blind.t);
    expect(traced.t).toBeLessThan(monitored.t);
    expect(monitored.evidence.text).toMatch(/%/);
    expect(blind.evidence.text).toMatch(/%/);
    expect(blind.evidence.anomalous).toBe(false);
    expect(traced.evidence.anomalous).toBe(true);
  });

  it("hints are counted", () => {
    let s = advanceTurn({ ...clone(newGame(1)), users: 4500 });
    s = must(s, { type: "incident_hint" });
    s = must(s, { type: "incident_hint" });
    expect(s.incident?.hints.length).toBe(2);
    expect(s.totals.hintsUsed).toBe(2);
    expect(applyAction(s, { type: "incident_hint" }).ok).toBe(false);
  });
});

describe("campaign", () => {
  it("going bankrupt ends the run", () => {
    let s = { ...clone(newGame(1)), cash: 2000 };
    s = advanceTurn(s);
    expect(s.outcome).toBe("bankrupt");
    expect(s.phase).toBe("ended");
    expect(applyAction(s, { type: "add_server" }).ok).toBe(false);
    expect(buildReport(s).outcome).toBe("bankrupt");
  });

  it("reaching the target wins and produces a report", () => {
    const { state } = runBot(BALANCE.introSeed, balanced, "expert");
    expect(state.outcome).toBe("won");
    const report = buildReport(state);
    expect(report.users).toBeGreaterThanOrEqual(BALANCE.targetUsers);
    expect(report.uptime).toBeGreaterThan(0.9);
    expect(report.takeaways.length).toBeGreaterThan(0);
    expect(state.postmortems.length).toBe(report.incidents.total);
  });

  it("the deadline ends a run that grows too slowly", () => {
    let s = newGame(5);
    s = { ...clone(s), cash: 5_000_000 };
    let guard = 0;
    while (s.phase !== "ended" && guard++ < 400) {
      if (s.phase === "management") s = advanceTurn(s);
      else if (s.phase === "incident") s = incidentTick(s, 10);
      else s = must(s, { type: "acknowledge_review" });
    }
    expect(s.outcome).toBe("deadline");
    expect(s.totals.weeks).toBe(BALANCE.maxTurns);
  });
});
