import { useEffect, useState } from "react";
import type { CampaignPostmortem } from "@/sim/campaignTypes";
import { incidentLesson, survivingCapacity } from "@/game/campaignPostmortem";
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
/** The Stay Online lesson in two numbers: what was admitted, and what the healthy routed servers could serve. */
export function CapacityAfterFailure({ step, admitted, capacity }: { step: number; admitted: number; capacity: number }) {
  return <section className="report-capacity" aria-label="Capacity after the failure"><h3>Capacity after the failure</h3>
    <dl className="rows"><Row label={`Traffic admitted at game second ${step}`} value={`${num(admitted)} req/s`} />
      <Row label="Capacity of healthy servers receiving traffic" value={`${num(capacity)} req/s`} /></dl>
    <p>{admitted > capacity ? "The servers still receiving traffic could not serve everything admitted, so they stayed overloaded until capacity came back." : "The servers still receiving traffic had enough capacity for everything admitted."} Health Checks only detect a failure and failover only moves traffic; neither adds capacity.</p>
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
      {report.explanations.map((text, i) => <p key={i}>{text}</p>)}
      {workload.length > 0 && <h4>Workload and cache evidence</h4>}
      {snapshots.some(m => !m.data) && workload.length > 0 && <p>Some observations kept only totals; their workload and cache details were not recorded.</p>}
      {workload.map(m => <p key={m.step}>From game second {m.step}: {m.data!.profile.replaceAll("-", " ")} workload, {m.data!.logical} requests of work. Cache hits {m.data!.hits}, eligible misses {m.data!.eligibleMisses}, writes {m.data!.writes}, uncacheable reads {m.data!.nonCacheableReads}. Hit rate {m.data!.effectiveHitRateUsed / 100}% (target {m.data!.target / 100}%). Database {m.db.demand} / {m.db.capacity} ops/s, queue {m.db.backlog}.</p>)}
      {!report.snapshots.length && <p>No historical observations were retained.</p>}
      {snapshots.length > 0 && <div className="report-table-scroll" tabIndex={technicalOpen ? 0 : undefined} role="region" aria-label="Recorded incident evidence">
        <table className="campaign-table"><caption>Recorded incident evidence by game second</caption><thead><tr><th scope="col">Game second</th><th scope="col">Applications: demand / capacity req/s · queue</th><th scope="col">Routing</th><th scope="col">Database: demand / capacity ops/s · queue</th><th scope="col">Latency</th><th scope="col">Service errors</th></tr></thead>
          <tbody>{snapshots.map(m => <tr key={m.step}><th scope="row">{m.step}</th><td>{m.instances ? m.instances.map(a => <div key={a.id}>{a.id.replace("app-", "App ")}: {a.demand} / {a.capacity} · {a.backlog}{a.health === "failed" ? " (failed)" : ""}</div>) : `${m.app.demand} / ${m.app.capacity} · ${m.app.backlog} (all apps)`}</td><td>{m.routing ? `${m.routing.targets.map(t => t.replace("app-", "App ")).join(", ")} (${m.routing.mode})` : "Not recorded"}</td><td>{m.db.demand} / {m.db.capacity} · {m.db.backlog}</td><td>{Math.round(m.latencyMs)} ms</td><td>{m.serviceErrorRate === null ? "No completed requests" : `${(m.serviceErrorRate * 100).toFixed(2)}%`}</td></tr>)}</tbody></table>
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
