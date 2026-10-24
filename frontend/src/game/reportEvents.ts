import type { CampaignPostmortem, Intervention, TraceEvent } from "@/sim/campaignTypes";
import { ACTION_NAMES, REPORT_LEAD_SECONDS } from "@/sim/trace";

export { ACTION_NAMES };


const num = (v: unknown) => Number(v).toLocaleString("en-US");
const dollars = (cents: unknown) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(cents) / 100);
const app = (id: unknown) => String(id).replace("app-", "App ");
const component = (id: unknown) => id === "db" ? "Database" : app(id);
const actionName = (type: unknown) => ACTION_NAMES[type as Intervention] ?? String(type).replaceAll("-", " ");
function routing(json: unknown) {
  try {
    const r = JSON.parse(String(json)) as { mode?: string; targets?: string[] };
    return r.targets ? `${r.targets.map(app).join(", ")}${r.mode ? ` (${r.mode})` : ""}` : null;
  } catch { return null; }
}
/** "1,000 to 2,000 ops/s" only when the value actually changed. */
function change(label: string, before: unknown, after: unknown, unit = "") {
  if (typeof before !== "number" || typeof after !== "number" || before === after) return null;
  return `${label} ${num(before)} to ${num(after)}${unit}`;
}

export interface ReportEvent { id: number; step: number; title: string; detail: string | null }

/**
 * One readable line per recorded event, never raw engine fields. Per-second metrics are dropped because the
 * evidence table already shows them.
 */
export function describeEvents(events: TraceEvent[]): ReportEvent[] {
  const requested = new Map(events.filter(e => e.type === "action-requested").map(e => [e.data.actionId, e.data.type]));
  return events.flatMap(e => {
    const d = e.data;
    const line = (title: string, ...parts: (string | null | false | undefined)[]) => [{ id: e.id, step: e.step, title, detail: parts.filter(Boolean).join(" · ") || null }];
    switch (e.type) {
      case "metrics": return [];
      case "action-requested": return line(`${actionName(d.type)} requested`, Number(d.costCents) > 0 && `Setup ${dollars(d.costCents)}`, d.targetId ? app(d.targetId) : null, d.routing ? `Route to ${routing(d.routing)}` : null, d.activationStep != null && `Activates at game second ${d.activationStep}`);
      case "action-activated": return line(`${actionName(requested.get(d.actionId))} activated`,
        change("Database capacity", d.dbBefore, d.dbAfter, " ops/s"), change("Application capacity", d.appBefore, d.appAfter, " req/s"),
        change("Admitted traffic", d.admittedBefore, d.admittedAfter, " req/s"), change("Routed capacity", d.effectiveBefore, d.effectiveAfter, " req/s"),
        d.routingAfter && routing(d.routingAfter) !== routing(d.routingBefore) ? `Route now ${routing(d.routingAfter)}` : null,
        typeof d.cacheTarget === "number" ? `Cache target ${Number(d.cacheTarget) / 100}%` : null);
      case "action-rejected": return line(`${actionName(d.action)} rejected`, d.reason ? String(d.reason) : null);
      case "incident-opened": return line("Incident opened", d.component ? `Bottleneck: ${component(d.component)}` : null);
      case "incident-recovered": return line("Incident recovered");
      case "recovery-streak": return line("Recovery progress", `Stable seconds ${num(d.from)} to ${num(d.to)}`);
      case "reliability-failure-armed": return line("Reliability test started", `${app(d.appId)} fails at game second ${d.startStep}`);
      case "reliability-failure-started": return line(`${app(d.appId)} failed`);
      case "instance-restored": return line(`${app(d.appId)} restored`, d.source === "manual" ? "Requested restore" : "Returned on its own", Number(d.backlog) > 0 && `Queue ${num(d.backlog)}`);
      case "health-change-detected": return line(`${app(d.appId)} detected ${d.detectedHealth}`, d.source === "probe" ? "By Health Checks" : "By inspection", `${num(d.delay)} s after the change`);
      case "failover-activated": return line(`Failover moved traffic to ${app(d.appId)}`, "No capacity added");
      case "failover-cancelled": return line("Failover cancelled", d.reason ? String(d.reason) : null);
      case "settlement": return line(`Week ${d.period} settled`, `Revenue ${dollars(d.revenueCents)}`, `Net ${dollars(d.netCents)}`);
      case "traffic-change": return line("Traffic changed", `${num(d.from)} to ${num(d.to)} req/s`);
      case "traffic-scheduled": return line("More traffic scheduled", `Arrives at game second ${d.dueStep}`);
      case "traffic-spike-started": return line("Traffic spike started", `Incoming ${num(d.to)} req/s`);
      case "traffic-spike-ended": return line("Traffic spike ended", `Incoming ${num(d.to)} req/s`);
      case "workload-changed": return line("Workload changed", d.profile ? `${String(d.profile).replaceAll("-", " ")} workload` : null, typeof d.to === "number" && `${num(d.to)} req/s`);
      case "autoscale-scale-out-decided": return line("Autoscaling added a server", d.targetId ? app(d.targetId) : null);
      case "autoscaler-blocked": return line("Autoscaling blocked", d.reason ? String(d.reason) : null);
      case "scenario-started": return line(`Growth wave ${Number(d.index) + 1} started`, d.template ? `${String(d.template).replaceAll("-", " ")}` : null, `Peak ${num(d.peak)} req/s`);
      case "scenario-pressure-ended": return line("Growth wave eased", `Back to ${num(d.baseline)} req/s`);
      case "promotion-started": return line("Promotion started", d.increment ? `+${num(d.increment)} req/s` : null, `Until game second ${d.endStep}`);
      case "promotion-ended": return line("Promotion ended", `Back to ${num(d.baseline)} req/s`);
      default: { const text = e.type.replaceAll("-", " "); return line(text.charAt(0).toUpperCase() + text.slice(1)); }
    }
  });
}

/** The game second a report's evidence starts: a short lead-in before the incident, never before the previous report. */
export function reportWindowStart(report: CampaignPostmortem) {
  const first = Math.min(report.openedStep, report.snapshots[0]?.step ?? report.openedStep);
  const previous = report.events[0]?.step ?? 0;
  return Math.max(previous, first - REPORT_LEAD_SECONDS);
}

/** Purchases requested inside the report's window. */
export function windowSpending(report: CampaignPostmortem, from: number) {
  return report.events.filter(e => e.type === "action-requested" && e.step >= from).reduce((n, e) => n + (Number(e.data.costCents) || 0), 0);
}
