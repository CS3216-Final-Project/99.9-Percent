import { useEffect, useState } from "react";
import type { CampaignPostmortem } from "@/sim/campaignTypes";
import { errorsLed, incidentCause, incidentImpact, incidentTitle, survivingCapacity, type SurvivingCapacity } from "@/game/campaignPostmortem";
import { incidentSummary, responseTitle } from "@/game/campaignReport";
import { CampaignReport } from "./CampaignReport";
import { useReportTechnicalOpen } from "./useReportTechnicalOpen";
import type { ReliabilityLesson } from "@/game/reliabilityLesson";
import { Concept, Modal, Row } from "./ui";
import { Icon } from "./icons";
import { describeEvents, keyMoments, reportWindowStart, windowSpending } from "@/game/reportEvents";
import "./CampaignIncidentReport.css";

const dollars = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: c % 100 ? 2 : 0 }).format(c / 100);

/** `first` marks the company's first incident; it opens the report with the outcome, which History already shows in its own header. */
export function CampaignIncidentReport({ report, reliability, outcome }: { report: CampaignPostmortem; reliability?: ReliabilityLesson; outcome?: { first: boolean } }) {
  const lesson = reliability ? { happened: incidentCause(report), response: reliability.recovered, responseTitle: responseTitle(report.events, report.openedStep, report.recoveredStep), improve: reliability.improve, takeaway: reliability.takeaway } : incidentSummary(report);
  const capacity = survivingCapacity(report.snapshots);
  return <CampaignReport lesson={lesson} lead={<>{outcome && <IncidentOutcome report={report} first={outcome.first} />}<IncidentImpact report={report} /></>}
    summary={<>{capacity && <CapacityAfterFailure {...capacity} />}<KeyMoments report={report} /></>}><IncidentEvidence report={report}/></CampaignReport>;
}

/** The payoff: the service is back, said first and warmly, with what broke and for how long. */
function IncidentOutcome({ report, first }: { report: CampaignPostmortem; first: boolean }) {
  const yours = !responseTitle(report.events, report.openedStep, report.recoveredStep);
  const headline = report.limited ? "Service restored, with traffic still limited"
    : yours ? first ? "You resolved your first incident" : "You restored the service" : "Service restored";
  return <div className={`report-outcome${report.limited ? " is-limited" : ""}`}>
    <Concept kind={report.limited ? "warn" : "ok"} icon={report.limited ? "limit" : "check"} size={22} />
    <p><strong>{headline}</strong><span>{incidentTitle(report)}. Incident open from game second {report.openedStep} to {report.recoveredStep}.</span></p>
  </div>;
}

/** The three readings a player can quote afterwards: how long it lasted, how bad it got and what it cost to fix. */
function IncidentImpact({ report }: { report: CampaignPostmortem }) {
  const impact = incidentImpact(report), spent = windowSpending(report, reportWindowStart(report));
  return <dl className="impact report-impact" aria-label="Incident impact">
    <div><Concept kind="ok" icon="time" /><dt>Recovery time</dt><dd>{impact.seconds} s</dd></div>
    {errorsLed(impact)
      ? <div><Concept kind="health" icon="alert" /><dt>Peak failed requests</dt><dd>{Math.round(impact.peakErrorRate * 100)}%</dd></div>
      : impact.peakLatencyMs !== undefined && <div><Concept kind="health" icon="latency" /><dt>Peak response time</dt><dd>{num(Math.round(impact.peakLatencyMs))} ms</dd></div>}
    <div><Concept kind="cash" icon="cash" /><dt>Spent on fixes</dt><dd>{dollars(spent)}</dd></div>
  </dl>;
}

const MOMENT_TONE: Record<string, string> = { "incident-opened": "critical", "reliability-failure-started": "critical", "incident-recovered": "ok", "instance-restored": "ok", "action-activated": "done", "failover-activated": "done" };
/** The incident in a few beats, so the cause and the fix read as one sequence before any table. */
function KeyMoments({ report }: { report: CampaignPostmortem }) {
  const moments = keyMoments(report);
  if (moments.length < 2) return null;
  const types = new Map(report.events.map(e => [e.id, e.type]));
  return <section className="report-moments-section"><h3>How it unfolded</h3>
    <ol className="report-moments">{moments.map(m => <li key={m.id} data-tone={MOMENT_TONE[types.get(m.id) ?? ""] ?? "step"}>
      <span className="report-event-step"><span className="visually-hidden">Game second </span>{m.step}</span><span>{m.title}</span>
    </li>)}</ol>
  </section>;
}

const num = (n: number) => n.toLocaleString("en-US");
const appNames = (ids: string[]) => ids.map(id => id.replace("app-", "App ")).join(" and ");
/**
 * The Stay Online lesson in numbers: what was admitted, what the route still sent to the failed server, and what the
 * healthy routed servers could serve. "Enough capacity" is said only when no traffic reached a failed server.
 */
export function CapacityAfterFailure({ step, admitted, capacity, failed, toFailed, stopped }: SurvivingCapacity) {
  const name = appNames(failed), healthy = admitted - toFailed;
  // Only overloaded healthy servers need more capacity; a routing problem is fixed by routing, not purchases.
  const overloaded = healthy > capacity || !!stopped && stopped.admitted > stopped.capacity || toFailed === 0 && admitted > capacity;
  let story: string;
  if (toFailed > 0) {
    const until = !stopped ? "until it was taken out of the route or restored"
      : stopped.by === "restored" ? `until it was restored at game second ${stopped.step}`
      : `until it was taken out of the route at game second ${stopped.step}`;
    story = `A failed server does no work, so every request the load balancer sent to ${name} failed ${until}.`;
    story += healthy > capacity ? " The healthy servers were overloaded by their own share as well."
      : ` The ${num(healthy)} req/s sent to the healthy servers was within their ${num(capacity)} req/s capacity; the errors came from the failed server staying in the route.`;
    if (stopped?.by === "rerouted" && stopped.admitted > stopped.capacity) story += ` Once it was out of the route, the healthy servers could serve ${num(stopped.capacity)} of the ${num(stopped.admitted)} req/s admitted, so they stayed overloaded.`;
  } else story = admitted > capacity ? "The servers still receiving traffic could not serve everything admitted, so they stayed overloaded until capacity came back."
    : "No traffic reached the failed server, and the servers still receiving traffic had enough capacity for everything admitted.";
  return <section className="report-capacity" aria-label="Capacity after the failure"><h3>Capacity after the failure</h3>
    <dl className="rows"><Row label={`Traffic admitted at game second ${step}`} value={`${num(admitted)} req/s`} />
      {toFailed > 0 && <Row label={`Sent to the failed ${name}`} value={`${num(toFailed)} req/s, all failed`} />}
      <Row label="Capacity of healthy servers in the route" value={`${num(capacity)} req/s`} /></dl>
    <p>{story}{overloaded && " Health Checks only detect a failure and failover only moves traffic; neither adds capacity."}</p>
  </section>;
}

const load = (demand: number, capacity: number, backlog: number) => `${num(demand)} / ${num(capacity)}, queue ${num(backlog)}`;
const seconds = (from: number, to: number) => from === to ? String(from) : `${from}-${to}`;
/** Consecutive readings that would print identically share one row, so a steady stretch reads as one line. */
function collapse<T>(rows: T[], key: (row: T) => string, step: (row: T) => number) {
  const groups: { first: T; from: number; to: number }[] = [];
  for (const row of rows) {
    const last = groups.at(-1);
    if (last && key(last.first) === key(row)) last.to = step(row);
    else groups.push({ first: row, from: step(row), to: step(row) });
  }
  return groups;
}
export function IncidentEvidence({ report }: { report: CampaignPostmortem }) {
  const technicalOpen = useReportTechnicalOpen();
  // Evidence starts a few game seconds before the incident, not at the previous report.
  const from = reportWindowStart(report);
  const snapshots = report.snapshots.filter(m => m.step >= from);
  // Workload readings repeat every second; show one only when the reading changes.
  const workload = snapshots.filter((m, i) => m.data && JSON.stringify(m.data) !== JSON.stringify(snapshots[i - 1]?.data ?? null));
  const events = describeEvents(report.events).filter(e => e.step >= from && e.step <= report.recoveredStep);
  const rows = collapse(snapshots.map(m => ({
    step: m.step,
    apps: m.instances ? m.instances.map(a => `${a.id.replace("app-", "App ")}: ${load(a.demand, a.health === "failed" ? 0 : a.capacity, a.backlog)}${a.health === "failed" ? " (failed)" : ""}`) : [`${load(m.app.demand, m.app.capacity, m.app.backlog)} (all apps)`],
    routing: m.routing ? `${m.routing.targets.map(t => t.replace("app-", "App ")).join(", ")} (${m.routing.mode})` : "Not recorded",
    db: load(m.db.demand, m.db.capacity, m.db.backlog),
    latency: `${num(Math.round(m.latencyMs))} ms`,
    errors: m.serviceErrorRate === null ? "No completed requests" : `${(m.serviceErrorRate * 100).toFixed(2)}%`,
  })), r => JSON.stringify({ ...r, step: 0 }), r => r.step);
  return <>
      <h4>Causes, actions and trade-offs</h4>
      {/* One finding per bullet, so the reasoning scans instead of reading as a wall of prose. */}
      <ul className="report-explanations">{report.explanations.map((text, i) => <li key={i}>{text}</li>)}</ul>
      {workload.length > 0 && <h4>Workload and cache readings</h4>}
      {snapshots.some(m => !m.data) && <p>Older readings kept only totals, so some seconds have no workload or cache details.</p>}
      {workload.length > 0 && <div className="report-table-scroll" tabIndex={technicalOpen ? 0 : undefined} role="region" aria-label="Workload and cache readings">
        <table className="campaign-table"><caption>Workload and cache readings, shown when they change</caption><thead><tr><th scope="col">From game second</th><th scope="col">Workload</th><th scope="col">Requests of work</th><th scope="col">Cache hits / misses</th><th scope="col">Writes</th><th scope="col">Reads the cache cannot serve</th><th scope="col">Cache warmth used / after</th><th scope="col">Hit rate (target)</th><th scope="col">Database reads / writes per second</th><th scope="col">Database: demand / capacity ops/s, queue</th></tr></thead>
          <tbody>{workload.map(m => <tr key={m.step}><th scope="row">{m.step}</th><td>{m.data!.profile.replaceAll("-", " ")}</td><td>{num(m.data!.logical)}</td><td>{num(m.data!.hits)} / {num(m.data!.eligibleMisses)}</td><td>{num(m.data!.writes)}</td><td>{num(m.data!.nonCacheableReads)}</td><td>{m.data!.warmthUsed / 100}% / {m.data!.warmthAfterStep / 100}%</td><td>{m.data!.effectiveHitRateUsed / 100}% ({m.data!.target / 100}%)</td><td>{num(m.data!.databaseReadDemand)} / {num(m.data!.databaseWriteDemand)}</td><td>{load(m.db.demand, m.db.capacity, m.db.backlog)}</td></tr>)}</tbody></table>
      </div>}
      {!report.snapshots.length && <p>No historical observations were retained.</p>}
      {snapshots.length > 0 && <div className="report-table-scroll" tabIndex={technicalOpen ? 0 : undefined} role="region" aria-label="Recorded incident evidence">
        <table className="campaign-table"><caption>Recorded incident evidence by game second; identical seconds share a row</caption><thead><tr><th scope="col">Game second</th><th scope="col">Applications: demand / capacity req/s, queue</th><th scope="col">Routing</th><th scope="col">Database: demand / capacity ops/s, queue</th><th scope="col">Latency</th><th scope="col">Service errors</th></tr></thead>
          <tbody>{rows.map(({ first: r, from: a, to: b }) => <tr key={a}><th scope="row">{seconds(a, b)}</th><td>{r.apps.map(line => <div key={line}>{line}</div>)}</td><td>{r.routing}</td><td>{r.db}</td><td>{r.latency}</td><td>{r.errors}</td></tr>)}</tbody></table>
      </div>}
      <h4>Every recorded event</h4>
      {events.length ? <ol className="report-events">{events.map(e => <li key={e.id}><span className="report-event-step"><span className="visually-hidden">Game second </span>{e.step}</span><span><b>{e.title}</b>{e.detail && <small>{e.detail}</small>}</span></li>)}</ol> : <p>No event history was retained.</p>}
  </>;
}

// Presentation-only receipt, separate from saves and the engine's review acknowledgement.
// Remember only the latest report per company; review cannot return to a preceding incident.
const receipts = new Map<string, string>();
const receiptKey = (runId: string) => `99.99.recovery-notice:${runId}`;
function wasPresented(runId: string, token: string) {
  try { return localStorage.getItem(receiptKey(runId)) === token || receipts.get(runId) === token; }
  catch { return receipts.get(runId) === token; }
}
export function CampaignRecoveryReview({ report, runId, first, onContinue, reliability }: { report: CampaignPostmortem; runId: string; first: boolean; onContinue: () => void; reliability?: ReliabilityLesson }) {
  const token = `${report.id}:${report.recoveredStep}`;
  const [notice, setNotice] = useState(() => !wasPresented(runId, token));
  useEffect(() => {
    if (!notice) return;
    receipts.set(runId, token);
    try { localStorage.setItem(receiptKey(runId), token); } catch { /* In-memory receipt still prevents repeats during this visit. */ }
  }, [notice, runId, token]);
  if (notice) return <Modal title="System Recovered!" className="campaign-recovery-notice" icon={{ kind: "ok", name: "health" }}>
    <p>Great work! Your app is running smoothly again.</p>
    {report.limited && <p className="muted">Your traffic limit is still active; some incoming requests are rejected.</p>}
    <div className="modal-foot"><button className="btn btn-primary" onClick={() => setNotice(false)}>View Incident Report</button></div>
  </Modal>;
  return <IncidentPostmortemModal report={report} reliability={reliability} first={first} onContinue={onContinue} />;
}
/** The postmortem dialog itself, shared by a live company and a practice replay so both end the same way. */
export function IncidentPostmortemModal({ report, reliability, first, onContinue }: { report: CampaignPostmortem; reliability?: ReliabilityLesson; first: boolean; onContinue: () => void }) {
  return <Modal title="Incident postmortem" wide className="campaign-recovery-report" icon={{ kind: "users", name: "history" }}>
    <CampaignIncidentReport report={report} reliability={reliability} outcome={{ first }} />
    <div className="modal-foot"><span className="muted">The same company continues.</span><button className="btn btn-primary" onClick={onContinue}>Continue company<Icon name="next" /></button></div>
  </Modal>;
}
