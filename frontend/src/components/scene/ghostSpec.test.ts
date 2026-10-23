// @vitest-environment node
import { describe, expect, it } from "vitest";
import { newGame } from "@/sim";
import type { Action } from "@/sim/types";
import type { Intervention } from "@/sim/campaignTypes";
import { appSlot, dbSlot, POS } from "./layout";
import { changeOf, changeOfScheduled, ghostParts, installing } from "./ghostSpec";

const INTERVENTIONS: Intervention[] = ["add-app", "upgrade-db", "limit", "unlimit", "scale-up", "deploy-lb", "routing", "cache", "cache-tuning", "deploy-autoscaler", "retire-app", "health-checks", "create-spare", "reserve-spare", "release-spare", "failover", "promote-spare", "restore-app", "promotion"];

function company() {
  const s = newGame(1), c = s.campaign!;
  c.apps.push({ id: "app-2", capacity: 1000, backlog: 0, routed: true, tier: "base", state: "active" });
  c.loadBalancer = true;
  c.routing = { mode: "balanced", targets: ["app-1", "app-2"] };
  c.apps[0].routed = true;
  return c;
}
const layoutOf = (c: ReturnType<typeof company>) => ({ apps: c.apps.map(a => a.id), dbCabinets: 1 });

describe("ghost previews", () => {
  it("draws something for every campaign intervention", () => {
    const c = company(), layout = layoutOf(c);
    for (const kind of INTERVENTIONS) {
      const parts = ghostParts({ kind, targetId: "app-2", routing: { mode: "balanced", targets: ["app-1", "app-2"] } }, c, layout);
      expect(parts.length, kind).toBeGreaterThan(0);
    }
  });

  it("maps each previewable action to the intervention it schedules", () => {
    const c = company();
    const cases: [Action, Intervention][] = [
      [{ type: "add_server" }, "add-app"], [{ type: "start_db_upgrade" }, "upgrade-db"],
      [{ type: "set_traffic_limit", enabled: true }, "limit"], [{ type: "set_traffic_limit", enabled: false }, "unlimit"],
      [{ type: "deploy_load_balancer" }, "deploy-lb"], [{ type: "set_routing", mode: "balanced", targets: ["app-1"] }, "routing"],
      [{ type: "deploy_cache" }, "cache"], [{ type: "tune_cache" }, "cache-tuning"], [{ type: "scale_up", appId: "app-1" }, "scale-up"],
      [{ type: "deploy_autoscaler" }, "deploy-autoscaler"], [{ type: "deploy_health_checks" }, "health-checks"],
      [{ type: "install_spare" }, "create-spare"], [{ type: "reserve_spare", appId: "app-2" }, "reserve-spare"],
      [{ type: "release_spare" }, "release-spare"], [{ type: "deploy_failover" }, "failover"],
      [{ type: "restore_app", appId: "app-1" }, "restore-app"], [{ type: "run_promotion" }, "promotion"],
    ];
    for (const [action, kind] of cases) expect(changeOf(action, c)?.kind, action.type).toBe(kind);
    expect(changeOf({ type: "acknowledge_review" }, c)).toBeNull();
  });

  it("places a new server in the next free slot, after any already installing", () => {
    const c = company(), layout = layoutOf(c);
    expect(ghostParts({ kind: "add-app" }, c, layout)[0]).toMatchObject({ type: "rack", ...appSlot(2) });
    expect(ghostParts({ kind: "add-app" }, c, layout, 1)[0]).toMatchObject({ type: "rack", ...appSlot(3) });
  });

  it("previews the database upgrade as a cabinet beside the current one", () => {
    const c = company();
    expect(ghostParts({ kind: "upgrade-db" }, c, layoutOf(c))).toEqual([expect.objectContaining({ type: "rack", ...dbSlot(1) })]);
  });

  it("shows a routing change's added routes in gold and its removed ones in red", () => {
    const c = company();
    const parts = ghostParts({ kind: "routing", routing: { mode: "single", targets: ["app-1"] } }, c, layoutOf(c));
    expect(parts.filter(p => p.type === "cable").map(p => p.tone)).toEqual(["add", "remove"]);
  });

  it("raises the traffic limit as a wall between In and the gateway", () => {
    const c = company();
    const [wall] = ghostParts({ kind: "limit" }, c, layoutOf(c));
    expect(wall).toMatchObject({ type: "wall", tone: "add" });
    if (wall.type === "wall") expect(wall.x).toBeLessThan(POS.gateway.x);
    expect(ghostParts({ kind: "unlimit" }, c, layoutOf(c))[0]).toMatchObject({ tone: "remove" });
  });

  it("reports installation progress for paid-for changes", () => {
    const c = company();
    c.step = 11;
    c.pending.push({ id: "a1", type: "add-app", requestedStep: 10, activationStep: 12, costCents: 0, activatedStep: null });
    c.pending.push({ id: "a2", type: "add-app", requestedStep: 10, activationStep: 12, costCents: 0, activatedStep: null });
    const [first, second] = installing(c);
    expect(first).toMatchObject({ progress: 0.5, extraApps: 0 });
    expect(second.extraApps).toBe(1);
    expect(changeOfScheduled(first.action)).toEqual({ kind: "add-app" });
  });
});
