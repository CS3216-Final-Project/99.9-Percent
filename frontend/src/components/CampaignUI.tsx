import { nextMove } from "@/game/advisor";
import { useState } from "react";
import { useGame, type Speed } from "@/game/store";
import { rawSave, exportLegacyData } from "@/game/persist";
import { makeEnvelope } from "@/game/saveMigrations";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
import type { CampaignPostmortem } from "@/sim/campaignTypes";
import { Icon } from "./icons";
import { Modal } from "./ui";
const dollars = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(c / 100);
const percent = (v: number | null) => v === null ? "No completed requests" : (v * 100).toFixed(2) + "%";

export function CampaignHeader() {
  const { game, openView } = useGame(), c = game.campaign!;
  return <header className="topbar campaign-header"><div className="brand"><span className="brand-mark">99.99%</span>
    <span>Operating week {game.turn} · Step <strong data-testid="physical-step">{c.step}</strong></span></div>
    <div className="stats-strip"><div className="stat"><span>Cash</span><strong>{dollars(c.cashCents)}</strong></div>
      <div className="stat"><span>Users</span><strong>2,000</strong></div>
      <div className="stat"><span>Pending revenue</span><strong>{dollars(c.ledger.successes * Q.revenueCents)}</strong></div>
      <div className="stat"><span>Status</span><strong>{game.phase === "incident" ? "Service degraded" : game.phase === "ended" ? "Bankrupt" : game.phase === "review" ? "Recovered" : c.snapshot.latencyMs >= 500 ? "At risk" : "Operating"}</strong></div></div>
    <button className="icon-btn" aria-label="Menu" onClick={() => openView("menu")}><Icon name="menu" /></button></header>;
}
export function CampaignPanel() {
  const { game, act, selected } = useGame(), c = game.campaign!, m = c.snapshot;
  const busy = c.pending.some(a => a.type === "add-app" || a.type === "upgrade-db");
  const disabled = game.phase === "review" || game.phase === "ended";
  const admissionPending = c.pending.some(a => a.type === "limit" || a.type === "unlimit");
  return <aside className="side campaign-panel" aria-label="System metrics">
    <section className="panel-section"><header className="panel-head"><Icon name="monitor" /><h2>{game.phase === "incident" ? "Service slowdown" : "System evidence"}</h2></header>
      <p>{nextMove(game).text}</p>
      <button className="btn" disabled={disabled} onClick={() => act({ type: "incident_inspect", equipment: selected === "app" ? "app" : selected === "db" ? "db" : "monitoring" })}>Inspect metrics · free</button>
      <p>Incoming <b>{m.incoming}</b> / admitted <b>{m.admitted}</b> / rejected <b>{m.rejected}</b> requests/s</p>
      <table className="campaign-table"><caption>Component evidence, step {c.step}</caption><thead><tr><th>Metric</th><th>Application</th><th>Database</th></tr></thead>
        <tbody>{[["Demand /s", m.app.demand, m.db.demand], ["Capacity /s", m.app.capacity, m.db.capacity], ["Demand/capacity", percent(m.app.demandRatio), percent(m.db.demandRatio)], ["Busy", percent(m.app.busyUtilisation), percent(m.db.busyUtilisation)], ["Backlog", m.app.backlog, m.db.backlog], ["Processed", m.app.processed, m.db.processed], ["Failed", m.app.failed, m.db.failed]].map(([label, a, b]) => <tr key={label}><th>{label}</th><td>{a}</td><td>{b}</td></tr>)}</tbody></table>
      <p>Application installed capacity: {m.installedAppCapacity} req/s. Routed capacity: {m.app.capacity} req/s.</p>
      <p>Latency: <strong>{m.latencyMs.toFixed(0)} ms</strong> · Service errors: <strong>{percent(m.serviceErrorRate)}</strong></p>
      {c.incident && <p role="status">Stable steps: {c.incident.stableSteps}/5 · requires &lt;500 ms and &lt;1% service errors with traffic and completed outcomes.</p>}
      <div className="campaign-actions">
        <button className="btn" disabled={disabled || busy || c.apps.length >= 2 || c.cashCents <= Q.appCostCents} onClick={() => act({ type: "add_server" })}>Add application · $1,000 · 2 steps</button>
        <button className="btn" disabled={disabled || busy || c.upgraded || c.cashCents <= Q.dbCostCents} onClick={() => act({ type: "start_db_upgrade" })}>Upgrade database · $3,000 · 3 steps</button>
        <button className="btn" disabled={disabled || admissionPending} onClick={() => act({ type: "set_traffic_limit", enabled: c.limit === null })}>{c.limit === null ? "Limit to 500 requests/s" : "Remove traffic limit"}</button>
      </div>
      {c.pending.map(a => <p role="status" key={a.id}>{a.type}: activates in {a.activationStep - c.step} step(s)</p>)}
      <p>Unsettled costs: {dollars(Math.floor((c.ledger.appNumerator + c.ledger.dbNumerator + c.ledger.salaryNumerator) / 60))}. Settlement at step {(c.lastSettledPeriod + 1) * 60}.</p>
      <p>Rejected demand this period: {c.ledger.rejected}; opportunity value {dollars(c.ledger.rejected * 20)} (not an extra charge).</p>
    </section></aside>;
}
export function CampaignControls() {
  const { game, running, setRunning, speed, setSpeed, advance, openView } = useGame();
  const active = game.phase === "management" || game.phase === "incident";
  return <footer className="bottombar"><button className="btn" onClick={() => openView("history")}>History</button>
    <div className="time-controls"><button className="btn" disabled={!active} onClick={() => setRunning(!running)}>{running ? "Pause" : "Run"}</button>
      <div className="speed" role="group" aria-label="Game speed">{([.5, 1, 2] as Speed[]).map(v => <button key={v} aria-pressed={speed === v} onClick={() => setSpeed(v)}>{v}×</button>)}</div>
      <button className="btn btn-primary" disabled={game.phase !== "management"} onClick={advance}>Advance step</button></div></footer>;
}
function Report({ report }: { report: CampaignPostmortem }) {
  return <div><p>Incident steps {report.openedStep}–{report.recoveredStep}. Setup spending: {dollars(report.setupCents)}.</p>
    {report.explanations.map((text, i) => <p key={i}>{text}</p>)}
    <details><summary>Recorded incident evidence</summary><table className="campaign-table"><thead><tr><th>Step</th><th>DB demand/capacity</th><th>Backlog</th><th>Latency</th><th>Errors</th></tr></thead><tbody>{report.snapshots.map(m => <tr key={m.step}><td>{m.step}</td><td>{m.db.demand}/{m.db.capacity}</td><td>{m.db.backlog}</td><td>{m.latencyMs.toFixed(0)} ms</td><td>{percent(m.serviceErrorRate)}</td></tr>)}</tbody></table></details></div>;
}
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
export function CampaignOverlays() {
  const { game, started, play, view, openView, act, newRun, saveNow, saveBlocked, remainderMs } = useGame();
  const c = game.campaign!;
  const [confirmReset, setConfirmReset] = useState(false);
  if (!started) return <div className="title-screen"><div className="title-card"><h1>99.99%</h1><p className="title-tag">Grow a startup. Keep it online.</p><p>Keep your company operating as traffic grows. Inspect evidence, choose a response and observe what changes.</p><button className="btn btn-primary btn-big" onClick={play}>{c.step ? "Continue company" : "Play"}</button></div></div>;
  if (game.phase === "review") return <Modal title="Incident postmortem" onClose={() => act({ type: "acknowledge_review" })}><Report report={c.reports[c.reports.length - 1]} /><button className="btn btn-primary" onClick={() => act({ type: "acknowledge_review" })}>Continue company</button></Modal>;
  if (game.phase === "ended" && view === null) return <Modal title="Company bankrupt" onClose={() => openView("menu")}><p>Cash reached {dollars(c.cashCents)} after settlement at step {c.step}. Final metrics and history remain available.</p>
    <div className="campaign-actions"><button className="btn" onClick={() => openView("history")}>View history</button><button className="btn" onClick={() => openView("menu")}>Export or start a new company</button></div></Modal>;
  if (view === "menu") return <Modal title="Menu" onClose={() => { openView(null); setConfirmReset(false); }}>
    <p>One step models one second of requests. Every 60 steps settles an operating week. Pausing freezes everything.</p>
    <p>Use the room controls to inspect equipment. Compare demand, capacity, backlog and response time before choosing an action.</p>
    {saveBlocked && <p role="alert">Your stored save is unreadable or unsupported and has been preserved. This run stays in memory until you explicitly reset.</p>}
    <div className="campaign-actions"><button className="btn" onClick={saveNow}>Save now</button>
      <button className="btn" onClick={() => download("campaign.json", JSON.stringify(makeEnvelope(game, remainderMs)))}>Export current company</button>
      <button className="btn" onClick={() => download("stored-campaign.json", rawSave() ?? "null")}>Export original stored save</button>
      <button className="btn" onClick={() => download("legacy-browser-data.json", exportLegacyData())}>Export legacy data</button>
      <button className="btn" onClick={() => setConfirmReset(true)}>New company</button>
      {confirmReset && <><p>This replaces only the current campaign save. Export it first if you want to keep it.</p><button className="btn" onClick={() => { newRun(); setConfirmReset(false); }}>Confirm new company</button></>}</div>
  </Modal>;
  if (view === "history") return <Modal title="Campaign history" onClose={() => openView(null)}>
    <p>Latency in the last {c.recent.length} steps (milliseconds)</p>
    <svg viewBox="0 0 600 120" role="img" aria-label="Latency history" style={{ width: "100%", height: 120 }}><polyline fill="none" stroke="currentColor" strokeWidth="2" points={c.recent.map((m, i) => `${i * 600 / Math.max(1, c.recent.length - 1)},${115 - Math.min(110, m.latencyMs / 10)}`).join(" ")} /></svg>
    {c.reports.map(p => <Report key={p.id} report={p} />)}
    <details><summary>Financial settlements</summary>{c.settlements.map(p => <p key={p.period}>Week {p.period}: revenue {dollars(p.revenueCents)}, net {dollars(p.netCents)}</p>)}</details>
    <details><summary>Action and event history</summary>{c.trace.filter(e => e.type !== "metrics").map(e => <p key={e.id}>Step {e.step}: {e.type} {e.data.reason ? String(e.data.reason) : e.data.type ? String(e.data.type) : ""}</p>)}</details>
  </Modal>;
  return null;
}
