import { useEffect, useState } from "react";
import type { CampaignPostmortem } from "@/sim/campaignTypes";
import { incidentLesson, survivingCapacity, type SurvivingCapacity } from "@/game/campaignPostmortem";
import { incidentSummary } from "@/game/campaignReport";
import { CampaignReport } from "./CampaignReport";
import { useReportTechnicalOpen } from "./useReportTechnicalOpen";
import type { ReliabilityLesson } from "@/game/reliabilityLesson";
import { Modal, Row } from "./ui";
import { describeEvents, reportWindowStart, windowSpending } from "@/game/reportEvents";
import "./CampaignIncidentReport.css";

const dollars = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);

export function CampaignIncidentReport({ report, reliability }: { report: CampaignPostmortem; reliability?: ReliabilityLesson }) {
  const lesson = reliability ? { happened: reliability.happened, response: reliability.recovered, improve: reliability.improve, takeaway: reliability.takeaway } : incidentSummary(report);
  const capacity = survivingCapacity(report.snapshots);
  return <CampaignReport lesson={lesson} summary={capacity && <CapacityAfterFailure {...capacity} />}><IncidentEvidence report={report}/></CampaignReport>;
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
      : ` The healthy servers could serve their own ${num(healthy)} req/s; the errors came from the failed server staying in the route.`;
    if (stopped?.by === "rerouted" && stopped.admitted > stopped.capacity) story += ` Once it was out of the route, the healthy servers could serve ${num(stopped.capacity)} of the ${num(stopped.admitted)} req/s admitted, so they stayed overloaded.`;
  } else story = admitted > capacity ? "The servers still receiving traffic could not serve everything admitted, so they stayed overloaded until capacity came back."
    : "No traffic reached the failed server, and the servers still receiving traffic had enough capacity for everything admitted.";
  return <section className="report-capacity" aria-label="Capacity after the failure"><h3>Capacity after the failure</h3>
    <dl className="rows"><Row label={`Traffic admitted at game second ${step}`} value={`${num(admitted)} req/s`} />
      {toFailed > 0 && <Row label={`Sent to the failed ${name}`} value={`${num(toFailed)} req/s, all failed`} />}
      <Row label="Capacity of healthy servers receiving traffic" value={`${num(capacity)} req/s`} /></dl>
    <p>{story}{overloaded && " Health Checks only detect a failure and failover only moves traffic; neither adds capacity."}</p>
  </section>;
}
export function IncidentEvidence({ report }: { report: CampaignPostmortem }) {
  const technicalOpen = useReportTechnicalOpen();
  const lesson = incidentLesson(report);
  // Evidence starts a few game seconds before the incident, not at the previous report.
  const from = reportWindowStart(report), spent = windowSpending(report, from);
  const snapshots = report.snapshots.filter(m => m.step >= from);
  // Workload readings repeat every second; show one only when the reading changes.
  const workload = snapshots.filter((m, i) => m.data && JSON.stringify(m.data) !== JSON.stringify(snapshots[i - 1]?.data ?? null));
  const events = describeEvents(report.events.filter(e => e.step >= from));
  return <>
    <dl className="rows report-metrics" aria-label="Recovery summary">
      <Row label="Incident window" value={`Game seconds ${report.openedStep}-${report.recoveredStep}`} />
      {lesson.latencyMs !== undefined && <Row label="Final response time" value={`${Math.round(lesson.latencyMs)} ms`} />}
      <Row label="Traffic status" value={lesson.traffic} />
      {spent > 0 && <Row label="Spending during this incident" value={dollars(spent)} />}
    </dl>
      <h4>Causes, actions and trade-offs</h4>
      {/* One finding per bullet, so the reasoning scans instead of reading as a wall of prose. */}
      <ul className="report-explanations">{report.explanations.map((text, i) => <li key={i}>{text}</li>)}</ul>
      {workload.length > 0 && <h4>Workload and cache evidence</h4>}
      {snapshots.some(m => !m.data) && workload.length > 0 && <p>Some observations kept only totals; their workload and cache details were not recorded.</p>}
      {workload.length > 0 && <div className="report-table-scroll" tabIndex={technicalOpen ? 0 : undefined} role="region" aria-label="Workload and cache evidence">
        <table className="campaign-table"><caption>Workload and cache readings, shown when they change</caption><thead><tr><th scope="col">From game second</th><th scope="col">Workload</th><th scope="col">Requests of work</th><th scope="col">Cache hits / misses</th><th scope="col">Writes</th><th scope="col">Uncacheable reads</th><th scope="col">Hit rate (target)</th><th scope="col">Database: demand / capacity ops/s · queue</th></tr></thead>
          <tbody>{workload.map(m => <tr key={m.step}><th scope="row">{m.step}</th><td>{m.data!.profile.replaceAll("-", " ")}</td><td>{num(m.data!.logical)}</td><td>{num(m.data!.hits)} / {num(m.data!.eligibleMisses)}</td><td>{num(m.data!.writes)}</td><td>{num(m.data!.nonCacheableReads)}</td><td>{m.data!.effectiveHitRateUsed / 100}% ({m.data!.target / 100}%)</td><td>{num(m.db.demand)} / {num(m.db.capacity)} · {num(m.db.backlog)}</td></tr>)}</tbody></table>
      </div>}
      {!report.snapshots.length && <p>No historical observations were retained.</p>}
      {snapshots.length > 0 && <div className="report-table-scroll" tabIndex={technicalOpen ? 0 : undefined} role="region" aria-label="Recorded incident evidence">
        <table className="campaign-table"><caption>Recorded incident evidence by game second</caption><thead><tr><th scope="col">Game second</th><th scope="col">Applications: demand / capacity req/s · queue</th><th scope="col">Routing</th><th scope="col">Database: demand / capacity ops/s · queue</th><th scope="col">Latency</th><th scope="col">Service errors</th></tr></thead>
          <tbody>{snapshots.map(m => <tr key={m.step}><th scope="row">{m.step}</th><td>{m.instances ? m.instances.map(a => <div key={a.id}>{a.id.replace("app-", "App ")}: {num(a.demand)} / {a.health === "failed" ? "0" : num(a.capacity)} · {num(a.backlog)}{a.health === "failed" ? " (failed)" : ""}</div>) : `${num(m.app.demand)} / ${num(m.app.capacity)} · ${num(m.app.backlog)} (all apps)`}</td><td>{m.routing ? `${m.routing.targets.map(t => t.replace("app-", "App ")).join(", ")} (${m.routing.mode})` : "Not recorded"}</td><td>{num(m.db.demand)} / {num(m.db.capacity)} · {num(m.db.backlog)}</td><td>{num(Math.round(m.latencyMs))} ms</td><td>{m.serviceErrorRate === null ? "No completed requests" : `${(m.serviceErrorRate * 100).toFixed(2)}%`}</td></tr>)}</tbody></table>
      </div>}
      <h4>What happened, second by second</h4>
      {events.length ? <ol className="report-events">{events.map(e => <li key={e.id}><span className="report-event-step">{e.step}</span><span><b>{e.title}</b>{e.detail && <small>{e.detail}</small>}</span></li>)}</ol> : <p>No event history was retained.</p>}
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
export function CampaignRecoveryReview({ report, runId, onContinue, reliability }: { report: CampaignPostmortem; runId: string; onContinue: () => void; reliability?: ReliabilityLesson }) {
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
  return <Modal title="Incident postmortem" wide className="campaign-recovery-report" icon={{ kind: "ok", name: "incident" }}>
    <CampaignIncidentReport report={report} reliability={reliability} />
    <div className="modal-foot"><button className="btn btn-primary" onClick={onContinue}>Continue company</button></div>
  </Modal>;
}
