import { applyCampaignInput } from "./step";
import { BALANCE, PROMOS } from "./balance";
import {
  clamp,
  freeEngineers,
  maxServers,
  promoCooldownLeft,
  promoCost,
  releaseRisk,
  testEffort,
} from "./derive";
import { startInspect, startRecovery, requestHint } from "./incidents";
import { autoPostmortem } from "./postmortem";
import { applyRelease, releaseTitle, revertDeploy } from "./releases";
import { rand } from "./rng";
import { addAppHost, clone, logEvent, newId } from "./state";
import { has, isResearchTech, missingPrerequisites, TECH, techStatus } from "./tech";
import { acknowledgeReview } from "./turn";
import type { Action, ActionResult, DeployRecord, FailureReason, GameState } from "./types";

function money(v: number): string {
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

function fail(reason: FailureReason, message: string): ActionResult {
  return { ok: false, reason, message };
}

function ok(state: GameState, message?: string): ActionResult {
  return { ok: true, state, message };
}

function needCash(s: GameState, cost: number): ActionResult | null {
  if (s.cash >= cost) return null;
  return fail("insufficient_funds", `Not enough cash: this costs ${money(cost)} and you have ${money(Math.max(0, s.cash))}.`);
}

const MANAGEMENT_ONLY = new Set<Action["type"]>([
  "launch_promotion",
  "add_server",
  "remove_server",
  "replace_host",
  "start_tech",
  "start_db_upgrade",
  "start_debt_paydown",
  "assign_engineers",
  "cancel_task",
  "hire_engineer",
  "deploy_release",
  "test_release",
]);

/**
 * The single entry point for player decisions. It never throws: invalid
 * requests come back as `{ ok: false, reason, message }` and leave the state
 * untouched.
 */
export function applyAction(prev: GameState, action: Action): ActionResult {
  if (prev.campaign) {
    const { state, result } = applyCampaignInput(prev, action);
    return result.ok ? { ok: true, state } : result;
  }
  if (action.type === "start_tech" && action.tech === "larger_database") {
    return applyAction(prev, { type: "start_db_upgrade" });
  }
  if (MANAGEMENT_ONLY.has(action.type) && prev.phase !== "management") {
    return fail(
      "wrong_phase",
      prev.phase === "incident" ? "Deal with the incident first." : prev.phase === "ended" ? "This run is over." : "Finish the review first.",
    );
  }
  if (action.type.startsWith("incident_") && prev.phase !== "incident") {
    return fail("wrong_phase", "There is no active incident.");
  }

  const s = clone(prev);

  switch (action.type) {
    case "acknowledge_milestone":
    case "set_traffic_limit": return fail("invalid", "Campaign action only.");
    case "launch_promotion": {
      const def = PROMOS[action.promo];
      if (!def) return fail("invalid", "Unknown promotion.");
      if (def.minUsers && Math.max(s.users, s.totals.peakUsers) < def.minUsers) {
        return fail("prerequisites", `${def.name} becomes available at ${def.minUsers.toLocaleString("en-US")} users.`);
      }
      if (def.requires && !has(s, def.requires)) {
        return fail("prerequisites", `${def.name} needs ${TECH[def.requires].name} first.`);
      }
      if (s.activePromos.includes(def.id)) return fail("already_done", `${def.name} is already scheduled for this week.`);
      const left = promoCooldownLeft(s, def.id);
      if (left > 0) return fail("cooldown", `${def.name} can run again in ${left} week${left === 1 ? "" : "s"}.`);
      const cost = promoCost(s, def.id);
      const broke = needCash(s, cost);
      if (broke) return broke;
      s.cash -= cost;
      s.totals.invested += cost;
      s.totals.promosRun += 1;
      s.activePromos.push(def.id);
      s.promoCooldowns[def.id] = s.turn + def.cooldown;
      logEvent(s, "decision", `Launched ${def.name} for ${money(cost)}: about +${Math.round(def.spike * 100)}% peak traffic this week.`);
      return ok(s, `${def.name} will run this week.`);
    }

    case "add_server": {
      const limit = maxServers(s);
      if (s.infra.appHosts.length >= limit) {
        return fail(
          "limit_reached",
          has(s, "load_balancing")
            ? `The fleet is at its ${limit}-server limit.`
            : `Without a load balancer you can run at most ${limit} servers. Build Load Balancing to go further.`,
        );
      }
      const broke = needCash(s, BALANCE.server.setupCost);
      if (broke) return broke;
      s.cash -= BALANCE.server.setupCost;
      s.totals.invested += BALANCE.server.setupCost;
      s.totals.serversAdded += 1;
      s.lastCapacityTurn.app = s.turn;
      const host = addAppHost(s);
      logEvent(s, "decision", `Added app server ${host.id} (${money(BALANCE.server.setupCost)}).`);
      return ok(s, `${host.id} is in service.`);
    }

    case "remove_server": {
      if (s.infra.appHosts.length <= 1) return fail("limit_reached", "You need at least one app server.");
      const host = s.infra.appHosts[s.infra.appHosts.length - 1];
      s.infra.appHosts.pop();
      logEvent(s, "decision", `Decommissioned app server ${host.id} to save on running costs.`);
      return ok(s, `${host.id} decommissioned.`);
    }

    case "replace_host": {
      if (action.hostId === s.infra.dbHost.id) {
        if (s.infra.dbHost.status === "healthy") return fail("invalid", "The database machine is healthy.");
        const broke = needCash(s, BALANCE.db.replaceCost);
        if (broke) return broke;
        s.cash -= BALANCE.db.replaceCost;
        s.totals.invested += BALANCE.db.replaceCost;
        s.infra.dbHost = { id: "db-primary", status: "healthy", bornTurn: s.turn };
        logEvent(s, "decision", `Moved the database to a new machine during quiet hours (${money(BALANCE.db.replaceCost)}).`);
        return ok(s, "The database is on a fresh machine.");
      }
      const host = s.infra.appHosts.find((h) => h.id === action.hostId);
      if (!host) return fail("not_found", "That server no longer exists.");
      if (host.status === "healthy") return fail("invalid", `${host.id} is healthy.`);
      const broke = needCash(s, BALANCE.server.replaceCost);
      if (broke) return broke;
      s.cash -= BALANCE.server.replaceCost;
      s.totals.invested += BALANCE.server.replaceCost;
      s.infra.appHosts = s.infra.appHosts.filter((h) => h.id !== host.id);
      const fresh = addAppHost(s);
      logEvent(s, "decision", `Replaced ${host.id} with ${fresh.id} before it could fail (${money(BALANCE.server.replaceCost)}).`);
      return ok(s, `${host.id} replaced by ${fresh.id}.`);
    }

    case "start_tech": {
      const def = TECH[action.tech];
      if (!def) return fail("invalid", "Unknown technology.");
      if (!isResearchTech(action.tech)) return fail("invalid", "This upgrade is no longer part of the research tree.");
      const status = techStatus(s, def.id);
      if (status === "done") return fail("already_done", `${def.name} is already live.`);
      if (status === "in_progress" || status === "ready") return fail("already_done", `${def.name} is already under way.`);
      if (status === "locked") {
        const missing = missingPrerequisites(s, def.id).map((t) => TECH[t].name);
        return fail("prerequisites", `${def.name} needs ${missing.join(" and ")} first.`);
      }
      const broke = needCash(s, def.cost);
      if (broke) return broke;
      s.cash -= def.cost;
      s.totals.invested += def.cost;
      const assigned = Math.min(freeEngineers(s), 2, BALANCE.engineer.maxPerTask);
      s.tasks.push({
        id: newId(s, "task"),
        kind: "tech",
        title: def.name,
        effort: def.effort,
        progress: 0,
        assigned,
        startedTurn: s.turn,
        costPaid: def.cost,
        techId: def.id,
      });
      logEvent(s, "decision", `Started building ${def.name} (${money(def.cost)}, ${def.effort} engineer-weeks).`);
      return ok(
        s,
        assigned > 0
          ? `${def.name} started with ${assigned} engineer${assigned === 1 ? "" : "s"}.`
          : `${def.name} is queued, but no engineers are free to work on it.`,
      );
    }

    case "start_db_upgrade": {
      const tier = s.infra.dbTier + 1;
      const def = BALANCE.db.tiers[tier];
      if (!def) return fail("limit_reached", "The database is already on the largest tier.");
      if (s.tasks.some((t) => t.kind === "db_upgrade") || s.releases.some((r) => r.kind === "db_upgrade")) {
        return fail("already_done", "A database upgrade is already under way.");
      }
      const broke = needCash(s, def.cost);
      if (broke) return broke;
      s.cash -= def.cost;
      s.totals.invested += def.cost;
      const assigned = Math.min(freeEngineers(s), 2, BALANCE.engineer.maxPerTask);
      const title = releaseTitle("db_upgrade", { dbTier: tier });
      s.tasks.push({
        id: newId(s, "task"),
        kind: "db_upgrade",
        title,
        effort: def.effort,
        progress: 0,
        assigned,
        startedTurn: s.turn,
        costPaid: def.cost,
        dbTier: tier,
      });
      logEvent(s, "decision", `Started the ${title.toLowerCase()} (${money(def.cost)}, ${def.effort} engineer-weeks).`);
      return ok(s, assigned > 0 ? `${title} started.` : `${title} is queued, but no engineers are free.`);
    }

    case "start_debt_paydown": {
      if (s.tasks.some((t) => t.kind === "debt_paydown")) return fail("already_done", "A refactoring task is already in the queue.");
      if (s.techDebt <= 0) return fail("invalid", "There is no technical debt to pay down.");
      const assigned = Math.min(freeEngineers(s), 1);
      s.tasks.push({
        id: newId(s, "task"),
        kind: "debt_paydown",
        title: "Pay down technical debt",
        effort: BALANCE.debt.paydownEffort,
        progress: 0,
        assigned,
        startedTurn: s.turn,
        costPaid: 0,
      });
      logEvent(s, "decision", "Set aside engineering time to pay down technical debt.");
      return ok(s, assigned > 0 ? "Refactoring started." : "Refactoring is queued, but no engineers are free.");
    }

    case "assign_engineers": {
      const task = s.tasks.find((t) => t.id === action.taskId);
      if (!task) return fail("not_found", "That task no longer exists.");
      const count = Math.round(action.count);
      if (!Number.isFinite(count) || count < 0) return fail("invalid", "Engineer count must be zero or more.");
      if (count > BALANCE.engineer.maxPerTask) {
        return fail("limit_reached", `At most ${BALANCE.engineer.maxPerTask} engineers can work on one task.`);
      }
      const delta = count - task.assigned;
      if (delta > freeEngineers(s)) return fail("no_engineers", "No engineers are free. Take someone off another task or hire.");
      task.assigned = count;
      return ok(s);
    }

    case "cancel_task": {
      const task = s.tasks.find((t) => t.id === action.taskId);
      if (!task) return fail("not_found", "That task no longer exists.");
      if (task.kind === "fix_release" || task.kind === "repair") {
        return fail("invalid", "Repair work cannot be cancelled, but you can leave it unstaffed.");
      }
      const refund = Math.round(task.costPaid * 0.5);
      s.cash += refund;
      s.tasks = s.tasks.filter((t) => t.id !== task.id);
      logEvent(s, "decision", `Cancelled ${task.title}${refund > 0 ? ` and recovered ${money(refund)}` : ""}.`);
      return ok(s, refund > 0 ? `Cancelled. ${money(refund)} refunded.` : "Cancelled.");
    }

    case "hire_engineer": {
      if (s.engineers >= BALANCE.engineer.max) return fail("limit_reached", `The office seats ${BALANCE.engineer.max} engineers.`);
      const broke = needCash(s, BALANCE.engineer.hireCost);
      if (broke) return broke;
      s.cash -= BALANCE.engineer.hireCost;
      s.totals.invested += BALANCE.engineer.hireCost;
      s.engineers += 1;
      logEvent(s, "decision", `Hired an engineer (${money(BALANCE.engineer.hireCost)} plus ${money(BALANCE.engineer.salary)} a week).`);
      return ok(s, "A new engineer has joined.");
    }

    case "test_release": {
      const rel = s.releases.find((r) => r.id === action.releaseId);
      if (!rel) return fail("not_found", "That release no longer exists.");
      if (rel.needsFix) return fail("invalid", "This release needs its fix finished first.");
      if (rel.tested) return fail("already_done", "This release has already been tested.");
      if (s.tasks.some((t) => t.releaseId === rel.id)) return fail("already_done", "Testing is already under way.");
      const assigned = Math.min(freeEngineers(s), 1);
      s.tasks.push({
        id: newId(s, "task"),
        kind: "test_release",
        title: `Test: ${rel.title}`,
        effort: testEffort(s, rel),
        progress: 0,
        assigned,
        startedTurn: s.turn,
        costPaid: 0,
        releaseId: rel.id,
      });
      logEvent(s, "decision", `Chose to test '${rel.title}' before deploying it.`);
      return ok(s, assigned > 0 ? "Testing started." : "Testing is queued, but no engineers are free.");
    }

    case "deploy_release": {
      const rel = s.releases.find((r) => r.id === action.releaseId);
      if (!rel) return fail("not_found", "That release no longer exists.");
      if (rel.needsFix) return fail("invalid", "This release was rolled back and needs its fix finished first.");
      if (s.tasks.some((t) => t.kind === "test_release" && t.releaseId === rel.id)) {
        return fail("busy", "This release is being tested. Cancel the test to deploy it now.");
      }
      if (rel.kind === "tech" && rel.techId) {
        const missing = missingPrerequisites(s, rel.techId);
        if (missing.length > 0) {
          return fail("prerequisites", `Deploy ${missing.map((t) => TECH[t].name).join(" and ")} first.`);
        }
      }
      const risk = releaseRisk(s, rel);
      const regressed = rand(s) < risk;
      const rec: DeployRecord = {
        releaseId: rel.id,
        title: rel.title,
        kind: rel.kind,
        techId: rel.techId,
        dbTier: rel.dbTier,
        size: rel.size,
        turn: s.turn,
        tested: rel.tested,
        risk,
        techDebtAtDeploy: s.techDebt,
        regressed,
        rolledBack: false,
      };
      s.deploys.push(rec);
      s.releases = s.releases.filter((r) => r.id !== rel.id);
      applyRelease(s, rel);
      if (rel.tested) s.totals.releasesTested += 1;
      else {
        s.totals.releasesUntested += 1;
        s.techDebt = clamp(s.techDebt + BALANCE.debt.untestedDeploy, 0, 100);
      }
      logEvent(
        s,
        "decision",
        `Deployed '${rel.title}' ${rel.tested ? "after testing" : "without testing"} (regression risk ${Math.round(risk * 100)}%).`,
      );

      if (regressed && has(s, "safer_rollouts")) {
        revertDeploy(s, rec, true);
        s.totals.downtimeMinutes += BALANCE.incident.autoMitigatedMinutes;
        s.postmortems.push(
          autoPostmortem(
            s,
            "deploy_regression",
            `Release '${rel.title}' contained a defect.`,
            [
              `It was deployed ${rel.tested ? "after testing" : "without testing"} at an estimated ${Math.round(risk * 100)}% regression risk.`,
              "You had built Canary Rollouts.",
            ],
            "The canary saw the error rate rise on a small slice of traffic and rolled the release back before most customers were affected.",
            0,
          ),
        );
        logEvent(s, "success", `The canary caught a defect in '${rel.title}' and rolled it back automatically. It needs a fix.`);
        return ok(s, `The canary caught a defect in '${rel.title}' and rolled it back. A fix task has been added.`);
      }
      if (regressed && !s.latentRegression) s.latentRegression = { releaseId: rel.id };
      return ok(s, `'${rel.title}' is live.`);
    }

    case "incident_inspect": {
      const err = startInspect(s, action.equipment);
      return err ? fail("invalid", err) : ok(s);
    }

    case "incident_action": {
      const err = startRecovery(s, action.recovery);
      if (err) return fail(err.startsWith("Needs") ? "insufficient_funds" : "invalid", err);
      return ok(s);
    }

    case "incident_hint": {
      const err = requestHint(s);
      return err ? fail("invalid", err) : ok(s);
    }

    case "acknowledge_review": {
      if (prev.phase !== "review") return fail("wrong_phase", "There is nothing to review.");
      return ok(acknowledgeReview(prev));
    }
  }
}
