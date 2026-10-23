import { useEffect, useState } from "react";
import type { CampaignPostmortem } from "@/sim/campaignTypes";
import { incidentLesson } from "@/game/campaignPostmortem";
import { incidentSummary } from "@/game/campaignReport";
import { CampaignReport } from "./CampaignReport";
import { useReportTechnicalOpen } from "./useReportTechnicalOpen";
import type { ReliabilityLesson } from "@/game/reliabilityLesson";
import { Modal, Row } from "./ui";
import { RecordedFields } from "./RecordedFields";
import "./CampaignIncidentReport.css";

/** "failure-started" reads as "Failure started". */
const eventTitle = (type: string) => { const text = type.replaceAll("-", " "); return text.charAt(0).toUpperCase() + text.slice(1); };
const dollars = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);

export function CampaignIncidentReport({ report, reliability }: { report: CampaignPostmortem; reliability?: ReliabilityLesson }) {
  const lesson = reliability ? { happened: reliability.happened, response: reliability.recovered, improve: reliability.improve, takeaway: reliability.takeaway } : incidentSummary(report);
  return <CampaignReport lesson={lesson}><IncidentEvidence report={report}/></CampaignReport>;
}
export function IncidentEvidence({ report }: { report: CampaignPostmortem }) {
  const technicalOpen = useReportTechnicalOpen();
  const lesson = incidentLesson(report), workload = report.snapshots.filter(s => s.data);
  return <>
    <dl className="rows report-metrics" aria-label="Recovery summary">
      <Row label="Incident window" value={`Game seconds ${report.openedStep}-${report.recoveredStep}`} />
      {lesson.latencyMs !== undefined && <Row label="Final response time" value={`${Math.round(lesson.latencyMs)} ms`} />}
      <Row label="Traffic status" value={lesson.traffic} />
      {report.setupCents > 0 && <Row label="Spending since the previous report" value={dollars(report.setupCents)} />}
    </dl>
      <h4>Causes, actions and trade-offs since the previous report</h4>
      {report.explanations.map((text, i) => <p key={i}>{text}</p>)}
      <h4>Workload and cache evidence</h4>
      {workload.length < report.snapshots.length && <p>Some historical observations retain aggregate evidence only; workload and cache details were not recorded.</p>}
      {!report.snapshots.length && <p>No historical observations were retained.</p>}
      {workload.map(m => <p key={m.step}>Game second {m.step}: {m.data!.profile} workload, {m.data!.logical} requests of work. Cache hits {m.data!.hits}, eligible misses {m.data!.eligibleMisses}, writes {m.data!.writes}, uncacheable reads {m.data!.nonCacheableReads}. Hit rate {m.data!.effectiveHitRateUsed / 100}% (target {m.data!.target / 100}%), warmth {m.data!.warmthUsed / 100}% to {m.data!.warmthAfterStep / 100}%. Database {m.db.demand} / {m.db.capacity} ops/s, queue {m.db.backlog}.</p>)}
      {report.snapshots.length > 0 && <div className="report-table-scroll" tabIndex={technicalOpen ? 0 : undefined} role="region" aria-label="Recorded incident evidence">
        <table className="campaign-table"><caption>Recorded incident evidence by game second</caption><thead><tr><th>Game second</th><th>Applications: demand / capacity req/s · queue</th><th>Routing</th><th>Database: demand / capacity ops/s · queue</th><th>Latency</th><th>Service errors</th></tr></thead>
          <tbody>{report.snapshots.map(m => <tr key={m.step}><td>{m.step}</td><td>{m.instances ? m.instances.map(a => <div key={a.id}>{a.id.replace("app-", "App ")}: {a.demand} / {a.capacity} · {a.backlog}</div>) : `${m.app.demand} / ${m.app.capacity} · ${m.app.backlog} (all apps)`}</td><td>{m.routing ? `${m.routing.mode}: ${m.routing.targets.map(t => t.replace("app-", "App ")).join(", ")}` : "Not recorded"}</td><td>{m.db.demand} / {m.db.capacity} · {m.db.backlog}</td><td>{Math.round(m.latencyMs)} ms</td><td>{m.serviceErrorRate === null ? "No completed requests" : `${(m.serviceErrorRate * 100).toFixed(2)}%`}</td></tr>)}</tbody></table>
      </div>}
      <h4>What happened, second by second</h4>
      {report.events.length ? <ol className="report-events">{report.events.map(e => <li key={e.id}><span className="report-event-title">Game second {e.step} · {eventTitle(e.type)}</span><RecordedFields data={e.data} /></li>)}</ol> : <p>No event history was retained.</p>}
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
