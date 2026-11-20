// @vitest-environment node
import { expect, it } from "vitest";
import { advanceSteps, step } from "@/sim/step";
import { applyAction, newLegacyGame, type GameState } from "@/sim";
import { launchAct, launchCompany } from "@/sim/__tests__/scalingLaunchFixture";
import { dataCompany } from "@/sim/__tests__/dataFixture";
import { preparedReliability, reliabilityCompany } from "@/sim/__tests__/reliabilityFixture";
import { machineCuesBetween, machineScale, MACHINE_POP_SECONDS } from "./machineCues";
const state = (game: GameState, generation = 1, started = true) => ({ game, generation, started });
const cues = (a: GameState, b: GameState) => machineCuesBetween(state(a), state(b));

it("waits for activation and finds every completed change in a multi-second batch", () => {
  const start = launchCompany();
  const database = launchAct(start, { type: "start_db_upgrade" });
  expect(cues(start, database)).toEqual([]);
  expect(cues(database, advanceSteps(database, 1).state)).toEqual([]);
  const pending = launchAct(database, { type: "set_traffic_limit", enabled: true });
  const after = advanceSteps(pending, 3).state;
  expect(cues(pending, after)).toEqual(expect.arrayContaining([
    expect.objectContaining({ targets: ["db"], kind: "grow", badge: "+1,000 ops/s" }),
    expect.objectContaining({ targets: ["gateway"], kind: "pulse", badge: "Limit on" }),
  ]));
  expect(cues(pending, after)).toHaveLength(2);
  expect(cues(after, advanceSteps(after, 1).state)).toEqual([]);
});

it("does not replay activations on load, company replacement, title screen or failed purchases", () => {
  const pending = launchAct(launchCompany(), { type: "start_db_upgrade" }), after = advanceSteps(pending, 3).state;
  expect(machineCuesBetween(state(pending), state(after, 2))).toEqual([]);
  expect(machineCuesBetween(state(pending, 1, false), state(after))).toEqual([]);
  expect(machineCuesBetween(state(pending), state(after, 1, false))).toEqual([]);
  expect(cues(after, after)).toEqual([]);
  const rejected = applyAction(pending, { type: "start_db_upgrade" });
  expect(rejected.ok).toBe(false);
  expect(cues(pending, rejected.ok ? rejected.state : pending)).toEqual([]);
});

it("targets the scaled server without implying database relief", () => {
  const pending = launchAct(launchCompany(), { type: "scale_up", appId: "app-1" });
  const [cue] = cues(pending, advanceSteps(pending, 3).state);
  expect(cue).toMatchObject({ targets: ["app-1"], label: "app-1", kind: "grow", badge: "+600 req/s" });
  expect(cue.announcement).toContain("Database capacity is unchanged");
});

it("gives the cache installation and tuning distinct cues without claiming a warm cache", () => {
  const pending = launchAct(advanceSteps(dataCompany(), 3).state, { type: "deploy_cache" });
  const installed = advanceSteps(pending, 2).state;
  expect(cues(pending, installed)[0]).toMatchObject({ targets: ["cache"], kind: "install", badge: "Warming up" });
  expect(installed.campaign!.snapshot.data!.hits).toBe(0);
  const tuning = launchAct(installed, { type: "tune_cache" });
  expect(cues(tuning, advanceSteps(tuning, 2).state)[0]).toMatchObject({ targets: ["cache"], kind: "grow", badge: "Tuned" });
});

it("pulses network and monitoring hardware for configuration changes", () => {
  const limited = launchAct(launchCompany(), { type: "set_traffic_limit", enabled: true });
  expect(cues(limited, advanceSteps(limited, 1).state)[0]).toMatchObject({ targets: ["gateway"], kind: "pulse", badge: "Limit on" });
  const company = launchAct(reliabilityCompany(), { type: "unlock_reliability", tech: "health_checks" });
  const checks = launchAct(company, { type: "deploy_health_checks" });
  expect(cues(checks, advanceSteps(checks, 2).state)[0]).toMatchObject({ targets: ["monitoring", ...company.campaign!.apps.map(a => a.id)], kind: "pulse" });
});

it("pops Challenge Mode hardware changes without replaying a replaced save", () => {
  const game = newLegacyGame(3), added = launchAct(game, { type: "add_server" });
  expect(cues(game, added)[0]).toMatchObject({ targets: ["app-2"], kind: "install" });
  expect(machineCuesBetween(state(game), state(added, 2))).toEqual([]);
});

it("stretches upwards, stays above the floor, and settles exactly; reduced motion stays still", () => {
  expect(machineScale("grow", 0.4, false)[1]).toBeGreaterThan(1.3);
  expect(machineScale("install", 0, false)[1]).toBeLessThan(0.3);
  for (const kind of ["grow", "install", "pulse"] as const) {
    for (const seconds of [0, 0.12, 0.4, 0.8, 1.2, MACHINE_POP_SECONDS, 8]) {
      expect(machineScale(kind, seconds, false).every(n => n > 0)).toBe(true);
      expect(machineScale(kind, seconds, true)).toEqual([1, 1, 1]);
    }
    expect(machineScale(kind, MACHINE_POP_SECONDS, false)).toEqual([1, 1, 1]);
  }
});

it("celebrates an installed server while retaining its unrouted state", () => {
  const pending = launchAct(launchCompany(), { type: "add_server" }), after = advanceSteps(pending, 2).state;
  expect(cues(pending, after)[0]).toMatchObject({ targets: ["app-2"], kind: "install", announcement: expect.stringContaining("Route traffic") });
  expect(after.campaign!.snapshot.instances!.find(a => a.id === "app-2")!.demand).toBe(0);
});

it("keeps the existing pulse when automatic failover promotes the spare", () => {
  let before = launchAct(preparedReliability(), { type: "arm_reliability" });
  const changes = [];
  for (let i = 0; i < 16; i++) {
    const after = step(before).state;
    changes.push(...cues(before, after));
    before = after;
  }
  expect(changes).toContainEqual(expect.objectContaining({ targets: ["gateway", "app-3"], label: "app-3", kind: "pulse", badge: "Promoted" }));
});
