import { BALANCE } from "./balance";
import { maxServers, selfHealingFleet } from "./derive";
import { newId } from "./state";
import { has } from "./tech";
import type { ActiveIncident, GameState, IncidentType, Postmortem } from "./types";

/**
 * Postmortems are written from recorded facts only: the incident's cause
 * snapshot, the evidence the player gathered and the actions they took.
 * No free-text generation, no external service. Sentences are kept short.
 */

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function money(v: number): string {
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

function clock(seconds: number): string {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export const INCIDENT_NAMES: Record<IncidentType, string> = {
  app_overload: "Server overload",
  db_saturation: "Database overload",
  deploy_regression: "Bad release",
  instance_failure: "Machine failure",
};

function whatFailed(inc: ActiveIncident): string {
  const c = inc.cause;
  switch (inc.type) {
    case "app_overload":
      return `Peak traffic hit ${Math.round(c.peakRps)} requests/s. Your servers could handle ${Math.round(c.appCapacity)} (${pct(c.appUtil)}).`;
    case "db_saturation":
      return `The database was asked for ${pct(c.dbUtil)} of what it can handle, so requests timed out.`;
    case "deploy_regression":
      return `Release '${c.releaseTitle ?? "unknown"}' had a bug. ${pct(inc.initialSeverity)} of requests failed.`;
    case "instance_failure":
      return c.target === "db" ? "The database machine died." : `Server ${c.hostId} died.`;
  }
}

function prevention(s: GameState, inc: ActiveIncident): string[] {
  const out: string[] = [];
  switch (inc.type) {
    case "app_overload":
      out.push("Add servers before load passes 85%, especially before promotions.");
      if (!has(s, "monitoring")) out.push("Monitoring shows exact load and a forecast.");
      if (!has(s, "load_balancing") && s.infra.appHosts.length >= maxServers(s)) out.push("Load Balancing lifts the 3-server limit.");
      if (!has(s, "autoscaling")) out.push("Autoscaling adds servers by itself.");
      break;
    case "db_saturation":
      if (!has(s, "caching")) out.push("Caching cuts database load by 36%.");
      if (s.infra.dbTier < BALANCE.db.tiers.length - 1) out.push("Upgrade the database before load passes 85%.");
      if (!has(s, "replicas")) out.push("A Database Replica adds 35% capacity.");
      if (!has(s, "monitoring")) out.push("Monitoring shows exact database load.");
      break;
    case "deploy_regression":
      if (!inc.cause.releaseTested) out.push("Test releases first: 85% less risk.");
      if (!has(s, "deploy_testing")) out.push("Automated Testing nearly halves deploy risk.");
      if (!has(s, "safer_rollouts")) out.push("Canary Rollouts roll bad releases back automatically.");
      if (inc.cause.techDebt >= 40) out.push("Pay down tech debt: it makes every deploy riskier.");
      break;
    case "instance_failure":
      out.push("Replace a machine as soon as it shows faults.");
      if (inc.cause.target === "db") {
        if (!has(s, "backups")) out.push("Backups prevent data loss.");
        if (!has(s, "replicas")) out.push("A Database Replica can take over in seconds.");
      } else {
        if (!has(s, "standby")) out.push("A Standby Server can take over in seconds.");
        if (!selfHealingFleet(s)) out.push("Load Balancing with Health Checks routes around dead servers.");
      }
      if (!has(s, "auto_failover")) out.push("Automatic Failover switches without you.");
      break;
  }
  return out;
}

function whyOutcome(inc: ActiveIncident): string {
  const failures = inc.attempts.filter((a) => a.outcome === "no_effect");
  const last = inc.attempts[inc.attempts.length - 1];
  let text = "";
  if (inc.status === "resolved" && last) {
    text = `${last.label}: ${last.note}`;
  } else if (inc.status === "mitigated" && last) {
    text = `${last.note} The overload will return unless you add capacity.`;
  } else {
    const forced =
      inc.type === "deploy_regression"
        ? "The release was finally rolled back by hand."
        : inc.type === "instance_failure"
          ? "The dead machine was finally rebuilt."
          : "It ended only when customers gave up.";
    text = `${inc.attempts.length === 0 ? "Nothing was tried in time." : "Nothing tried fixed the cause in time."} ${forced}`;
  }
  if (failures.length > 0) {
    text += ` Tried but did not help: ${failures.map((a) => `${a.label} (${a.note})`).join(" ")}`;
  }
  if (inc.dataLoss) text += " Recent customer data was permanently lost.";
  return text;
}

function responseTimeline(inc: ActiveIncident): string[] {
  type Line = { at: number; text: string };
  const lines: Line[] = [];
  for (const e of inc.evidence) lines.push({ at: e.at, text: `Checked ${e.title}.` });
  for (const a of inc.attempts) {
    const verdict =
      a.outcome === "fixed" ? "fixed it" : a.outcome === "mitigated" ? "contained it" : a.outcome === "partial" ? "helped partly" : "no effect";
    lines.push({ at: a.finishedAt, text: `${a.label}${a.cost > 0 ? ` (${money(a.cost)})` : ""}: ${verdict}.` });
  }
  lines.sort((a, b) => a.at - b.at);
  const out = lines.map((l) => `${clock(l.at)}  ${l.text}`);
  if (inc.hints.length > 0) out.push(`Used ${inc.hints.length} hint${inc.hints.length === 1 ? "" : "s"}.`);
  if (out.length === 0) out.push("Nothing was checked or tried.");
  return out;
}

export function buildPostmortem(s: GameState, inc: ActiveIncident): Postmortem {
  return {
    id: newId(s, "pm"),
    turn: inc.turn,
    type: inc.type,
    title: INCIDENT_NAMES[inc.type],
    outcome: inc.status === "resolved" ? "resolved" : inc.status === "mitigated" ? "mitigated" : "failed",
    whatFailed: whatFailed(inc),
    contributing: inc.cause.contributing.length > 0 ? inc.cause.contributing : ["No earlier decision stood out."],
    response: responseTimeline(inc),
    whyOutcome: whyOutcome(inc),
    prevention: prevention(s, inc),
    impact: { ...inc.damage, durationSeconds: inc.elapsed, hintsUsed: inc.hints.length },
  };
}

/** A short record for failures that automation absorbed without an incident. */
export function autoPostmortem(
  s: GameState,
  type: IncidentType,
  whatFailedText: string,
  contributing: string[],
  whyText: string,
  cost: number,
): Postmortem {
  return {
    id: newId(s, "pm"),
    turn: s.turn,
    type,
    title: `${INCIDENT_NAMES[type]} (automatic)`,
    outcome: "auto_mitigated",
    whatFailed: whatFailedText,
    contributing,
    response: ["Nobody was paged. Automation handled it."],
    whyOutcome: whyText,
    prevention: ["Nothing to do: your safeguards worked."],
    impact: {
      downtimeMinutes: BALANCE.incident.autoMitigatedMinutes,
      usersLost: 0,
      revenueLost: 0,
      satisfactionLost: 0,
      moneySpent: cost,
      durationSeconds: 0,
      hintsUsed: 0,
    },
  };
}
