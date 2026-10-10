import { exportPlaytest } from "@/game/persist";
import { nextMove } from "@/game/advisor";
import { money, num } from "@/game/format";
import { useState } from "react";
import { inspectOrSelect, useGame, type Speed } from "@/game/store";
import { SaveFiles } from "./SaveFiles";
import { MusicButton } from "./MusicButton";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
import type { CampaignPostmortem, Intervention } from "@/sim/campaignTypes";
import { Icon } from "./icons";
import { tipProps } from "./tips";
import { EQUIPMENT_ICON } from "./presentation";
import { ModeSwitch } from "./ModeSwitch";
import { LineChart } from "./Views";
import { Act, Callout, Concept, Meter, Modal, Row, Stat, Tip } from "./ui";

const dollars = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(c / 100);
const percent = (v: number | null) => v === null ? "No completed requests" : (v * 100).toFixed(2) + "%";
const PLACES = ["gateway", "app", "db", "monitoring"] as const;
const PLACE_NAMES = { gateway: "Network", app: "Servers", db: "Database", monitoring: "Monitoring" };
const ACTION_NAMES: Record<Intervention, string> = {
  "add-app": "Add server", "upgrade-db": "Database upgrade", limit: "Traffic limit", unlimit: "Remove traffic limit",
};

export function CampaignHeader() {
  const { game, openView } = useGame(), c = game.campaign!;
  const incident = game.phase === "incident";
  const atRisk = c.snapshot.latencyMs >= Q.latencyThresholdMs;
  const word = incident ? "Incident" : game.phase === "ended" ? "Bankrupt" : game.phase === "review" ? "Recovered" : atRisk ? "At risk" : "Healthy";
  const tone = incident || game.phase === "ended" ? "critical" : atRisk ? "warn" : "health";
  return <header className={`topbar${incident ? " is-incident" : ""}`}>
    <div className="brand"><span className="brand-mark">99.99%</span><div className="week">
      <span className="brand-week"><Icon name={incident ? "incident" : "week"} size={16} />
        Week <strong>{game.turn}</strong> · Step <strong data-testid="physical-step">{c.step}</strong>
      </span>
    </div></div>
    <div className="stats-strip">
      <Stat icon="cash" kind="cash" label="Cash" tip={`Available cash: ${dollars(c.cashCents)}. Revenue and running costs settle every ${Q.periodSteps} steps. Setup costs are paid immediately.`}>
        <strong className={c.cashCents <= 0 ? "text-critical" : ""}>{money(c.cashCents / 100)}</strong>
      </Stat>
      <Stat icon="users" kind="users" label="Users" tip="Each user adds demand. Compare incoming traffic with the capacity of each component.">
        <strong>{num(game.users)}</strong>
      </Stat>
      <Stat icon="revenue" kind="revenue" label="Pending revenue" tip={`${dollars(c.ledger.successes * Q.revenueCents)} earned this operating week, not yet added to cash. Only successful requests earn revenue.`}>
        <strong>{money(c.ledger.successes * Q.revenueCents / 100)}</strong><span className="muted">unsettled</span>
      </Stat>
      <Stat icon={incident ? "incident" : atRisk ? "alert" : "health"} kind={tone} label="Health" tip="Recovery needs five consecutive steps below 500 ms latency and 1% service errors, with admitted traffic and completed requests. There is no incident timeout.">
        <strong>{word}</strong>
      </Stat>
    </div>
    <MusicButton />
    <button type="button" className="icon-btn menu-btn" aria-label="Menu" {...tipProps("Menu")} onClick={() => openView("menu")}><Icon name="menu" /></button>
  </header>;
}

export function CampaignPanel() {
  const { game, act, selected } = useGame(), c = game.campaign!, m = c.snapshot;
  const incident = game.phase === "incident";
  const busy = c.pending.some(a => a.type === "add-app" || a.type === "upgrade-db");
  const disabled = useGame(s=>s.onboarding) || !!(c.openingMilestone && !c.openingMilestone.acknowledged) || game.phase === "review" || game.phase === "ended";
  const admissionPending = c.pending.some(a => a.type === "limit" || a.type === "unlimit");
  const place = PLACES.find(id => id === selected);
  const component = place === "app" ? m.app : place === "db" ? m.db : null;
  return <aside className="side campaign-panel" aria-label="System metrics">
    <section className={`panel-section${incident ? " incident" : ""}`} aria-label={incident ? "Incident" : "System overview"}>
      <header className="panel-head">
        <span className={`panel-icon${incident ? " state-critical" : ""}`}><Icon name={incident ? "incident" : "monitor"} /></span>
        <div><h2>{incident ? "Service slowdown" : "System overview"}</h2>
          <span className={`state${incident ? " state-critical" : ""}`}><Icon name={incident ? "alert" : "health"} size={12} />{incident ? "Incident" : "Live metrics"}</span>
        </div>
      </header>
      {c.incident && <div className="incident-clock campaign-stability">
        <div className="clock-row"><Icon name="health" /><Tip text="Recovery requires five consecutive physical steps below 500 ms and 1% service errors, with traffic and completed requests. A failing step resets this counter.">
          <strong>Stable steps: {c.incident.stableSteps}/{Q.stableSteps}</strong>
        </Tip></div>
        <Meter value={c.incident.stableSteps / Q.stableSteps} tone="ok" label="Recovery stability" />
      </div>}
      <div className="incident-symptoms">
        <dl className="impact">
          <div><Concept kind={m.latencyMs >= Q.latencyThresholdMs ? "critical" : "ok"} icon="latency" /><dt>Latency · ms</dt><dd>{m.latencyMs.toFixed(0)}</dd></div>
          <div><Concept kind={m.serviceErrorRate !== null && m.serviceErrorRate >= Q.errorThreshold ? "critical" : "ok"} icon="fire" /><dt>Errors · %</dt><dd>{m.serviceErrorRate === null ? "—" : (m.serviceErrorRate * 100).toFixed(2)}</dd></div>
          <div><Concept kind="tech" icon="load" /><dt>Backlog</dt><dd>{num(m.app.backlog + m.db.backlog)}</dd></div>
        </dl>
      </div>
      <div className="incident-investigate">
        <h4 className="step-head"><span className="step-num" aria-hidden="true">1</span><Tip text="Click equipment in the room or here. Inspection is free, immediate and repeatable; it never advances time.">Inspect the evidence</Tip></h4>
        <p className="request-path" aria-label="Request dependencies">Users → Servers → Database</p>
        <div className="chips">{PLACES.map(id => <button type="button" key={id} className={`chip${place === id ? " is-selected" : ""}`} aria-pressed={place === id} disabled={disabled} onClick={() => inspectOrSelect(id)}>
          <span className="chip-icon" aria-hidden="true"><Icon name={EQUIPMENT_ICON[id]} size={16} /></span>{PLACE_NAMES[id]}
        </button>)}</div>
        <button type="button" className="btn btn-small campaign-inspect" disabled={disabled} onClick={() => inspectOrSelect(place ?? "monitoring")}><Icon name="search" size={16} />Inspect metrics · free</button>
        {place && <div className="campaign-evidence" role="status"><Callout compact tone="info" icon={EQUIPMENT_ICON[place]} kicker={`${PLACE_NAMES[place]} · step ${m.step}`}>
          {component ? <>Demand {num(component.demand)}/s · capacity {num(component.capacity)}/s · backlog {num(component.backlog)}.</> : place === "gateway" ? <>Incoming {num(m.incoming)}/s · admitted {num(m.admitted)}/s · rejected {num(m.rejected)}/s.</> : <>Latency {m.latencyMs.toFixed(0)} ms · errors {percent(m.serviceErrorRate)} · backlog {num(m.app.backlog + m.db.backlog)}.</>}
        </Callout></div>}
      </div>
      <h4 className="step-head"><span className="step-num" aria-hidden="true">2</span>Choose a response</h4>
      <ul className="actions">
        <li><Act label="Add server" price={Q.appCostCents / 100} note={`${Q.appDelay} steps`} disabled={disabled || busy || c.apps.length >= Q.maxApps || c.cashCents <= Q.appCostCents} tip="Adds installed application capacity. Without routing, a new server does not receive traffic." onClick={() => act({ type: "add_server" })} /></li>
        <li><Act label="Upgrade database" price={Q.dbCostCents / 100} note={`${Q.dbDelay} steps`} disabled={disabled || busy || c.upgraded || c.cashCents <= Q.dbCostCents} tip="Increases database capacity after activation. Running costs also increase." onClick={() => act({ type: "start_db_upgrade" })} /></li>
        <li><Act label={c.limit === null ? "Limit to 500 requests/s" : "Remove traffic limit"} price={0} note={`${Q.admissionDelay} step`} disabled={disabled || admissionPending} tip="Changes admitted traffic at the next physical step. Rejected requests earn no revenue." onClick={() => act({ type: "set_traffic_limit", enabled: c.limit === null })} /></li>
      </ul>
      {c.pending.map(a => <div className="working campaign-working" role="status" key={a.id}>
        <span>{ACTION_NAMES[a.type]}: activates in {a.activationStep - c.step} step(s)</span>
        <Meter value={(c.step - a.requestedStep) / (a.activationStep - a.requestedStep)} label={`${ACTION_NAMES[a.type]} activation`} />
      </div>)}
      {c.apps.length>1 && <p className="muted">Added application: Installed, not receiving traffic</p>}
      <details className="more campaign-details"><summary>Full system evidence</summary>
        <p>Incoming <b>{m.incoming}</b> / admitted <b>{m.admitted}</b> / rejected <b>{m.rejected}</b> requests/s</p>
        <table className="campaign-table"><caption>Component evidence, step {m.step}</caption><thead><tr><th>Metric</th><th>Servers</th><th>Database</th></tr></thead>
          <tbody>{[["Demand /s", m.app.demand, m.db.demand], ["Capacity /s", m.app.capacity, m.db.capacity], ["Demand/capacity", percent(m.app.demandRatio), percent(m.db.demandRatio)], ["Busy", percent(m.app.busyUtilisation), percent(m.db.busyUtilisation)], ["Backlog", m.app.backlog, m.db.backlog], ["Processed", m.app.processed, m.db.processed], ["Failed", m.app.failed, m.db.failed]].map(([label, a, b]) => <tr key={label}><th scope="row">{label}</th><td>{a}</td><td>{b}</td></tr>)}</tbody></table>
        <dl className="rows"><Row label="Installed server capacity" value={`${num(m.installedAppCapacity)} req/s`} /><Row label="Routed capacity" value={`${num(m.app.capacity)} req/s`} /><Row label="Latency" value={`${m.latencyMs.toFixed(0)} ms`} /><Row label="Service errors" value={percent(m.serviceErrorRate)} /></dl>
        <p className="muted">Busy is the share of capacity doing work. Demand/capacity also shows demand above capacity. Installed servers only help when traffic is routed to them.</p>
      </details>
      <details className="more"><summary>Operating finances</summary><dl className="rows">
        <Row label="Available cash" value={dollars(c.cashCents)} />
        <Row label="Pending revenue" value={dollars(c.ledger.successes * Q.revenueCents)} />
        <Row label="Unsettled costs" value={dollars(Math.floor((c.ledger.appNumerator + c.ledger.dbNumerator + c.ledger.salaryNumerator) / Q.periodSteps))} />
        <Row label="Next settlement" value={`Step ${(c.lastSettledPeriod + 1) * Q.periodSteps}`} />
        <Row label="Rejected this period" value={num(c.ledger.rejected)} />
        <Row label="Opportunity value" value={dollars(c.ledger.rejected * Q.revenueCents)} tip="Revenue forgone from rejected demand, not an extra cash charge." />
      </dl></details>
    </section>
  </aside>;
}

export function CampaignControls() {
  const { game, view, running, setRunning, speed, setSpeed, advance, openView } = useGame();
  const active = useGame(s=>s.started && !s.onboarding) && !(game.campaign!.openingMilestone && !game.campaign!.openingMilestone.acknowledged) && (game.phase === "management" || game.phase === "incident");
  return <footer className="bottombar">
    <nav className="view-tabs" aria-label="Views"><button type="button" className={view === "history" ? "is-active" : ""} aria-pressed={view === "history"} aria-label="History" {...tipProps("History")} onClick={() => openView(view === "history" ? null : "history")}>
      <span className="tab-icon" aria-hidden="true"><Icon name="history" /></span><span className="tab-label">History</span>
    </button></nav>
    <div className="time-controls"><button type="button" className={`icon-btn${running ? " is-on" : ""}`} aria-label={running ? "Pause" : "Run"} {...tipProps("Run or pause physical steps (P)")} disabled={!active} onClick={() => setRunning(!running)}><Icon name={running ? "pause" : "play"} /></button>
      <div className="speed" role="group" aria-label="Game speed">{([.5, 1, 2] as Speed[]).map(v => <button type="button" key={v} className={speed === v ? "is-active" : ""} aria-pressed={speed === v} onClick={() => setSpeed(v)} {...tipProps(`${v}× speed`)}>{v}×</button>)}</div>
      <button type="button" className="btn btn-primary advance" disabled={!active || game.phase !== "management"} onClick={advance} {...tipProps("Advance one physical step. One step models one second of requests; 60 steps settle an operating week.")}><span className="advance-label">{game.phase === "incident" ? "Incident" : game.phase === "ended" ? "Company closed" : game.phase === "review" ? "Review" : "Advance step"}</span><Icon name="next" /></button>
    </div>
  </footer>;
}

function Report({ report }: { report: CampaignPostmortem }) {
  return <div>
    <p className="pm-meta"><span className="tag tag-ok"><Icon name="check" size={12} />Recovered{report.limited ? " under traffic limit" : " at full demand"}</span><span className="muted">Steps {report.openedStep}–{report.recoveredStep}</span></p>
    <dl className="rows"><Row label="Setup spending" value={dollars(report.setupCents)} /></dl>
    <div className="pm-lines">{report.explanations.map((text, i) => <Callout compact key={i} tone="info" icon="search" kicker="Recorded evidence">
      {text.replace(/\b\d+\.\d{3,}\b/g, value => Number(value).toFixed(2))}
    </Callout>)}</div>
    <details className="more campaign-details"><summary>Recorded incident evidence</summary><table className="campaign-table"><thead><tr><th>Step</th><th>DB demand/capacity</th><th>Backlog</th><th>Latency</th><th>Errors</th></tr></thead><tbody>{report.snapshots.map(m => <tr key={m.step}><td>{m.step}</td><td>{m.db.demand}/{m.db.capacity}</td><td>{m.db.backlog}</td><td>{m.latencyMs.toFixed(0)} ms</td><td>{percent(m.serviceErrorRate)}</td></tr>)}</tbody></table></details>
  </div>;
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
export function CampaignOverlays() {
  const { game, started, play, view, openView, act, newRun, saveNow, saveBlocked } = useGame();
  const c = game.campaign!;
  const {measurement,hasRun}=useGame();
  const [intervention,setIntervention]=useState("");
  const configured=import.meta.env.VITE_PLAYTEST_URL as string|undefined;
  const playtestUrl=configured&&/^https?:\/\//.test(configured)?configured:null;
  const [confirmReset, setConfirmReset] = useState(false);
  const closeMenu = () => { openView(null); setConfirmReset(false); };
  if (!started) return <div className="title-screen"><div className="title-card campaign-entry">
    <span className="title-kicker"><Icon name="server" size={16} />A system design tycoon</span>
    <h1>99.99%</h1><p className="title-tag">Grow a startup. Keep it online.</p>
    <p className="title-goal">Keep your company online as traffic grows, without running out of cash.</p>
    <ul className="title-loop" aria-label="How a run works"><li><Concept kind="users" icon="search" />Inspect evidence</li><li><Concept kind="tech" icon="server" />Choose a response</li><li><Concept kind="critical" icon="incident" />Run and observe</li></ul>
    <p className="title-goal">Click room equipment to inspect it for free. One step models one second of traffic; 60 steps settle an operating week. Run advances time, and P pauses. The first incident pauses for your response.</p>
    <img className="gameplay-preview" src="/opening-gameplay.png" alt="The furnished office and component evidence in the playable campaign" />
    <div className="title-actions"><button type="button" className="btn btn-primary btn-big" autoFocus onClick={play}><Icon name="play" />{hasRun ? "Continue company" : "Try Prototype"}</button></div>
    {playtestUrl?<a className="btn" href={playtestUrl} target="_blank" rel="noopener noreferrer">Join Playtest</a>:<><button className="btn" disabled>Join Playtest</button><p className="muted">Playtest registration is not open yet.</p></>}
    <p className="muted">Play immediately as a guest. Progress stays in this browser.</p>
  </div></div>;
  if(useGame.getState().onboarding) {
    const {meta,onboardingMove}=useGame.getState();
    const prompts=[
      ["Your architecture","Requests travel from Users through the Application to the Database. Select equipment in the office or dependency strip to inspect the same component."],
      ["Your evidence","Compare demand with capacity and unfinished work (backlog). Latency describes response time; service errors count failed completed requests. Deliberate rejections are shown separately."],
      ["Your controls","Inspection is free. Run or Advance step to observe traffic changes, and Pause to think. Investments cost money and take time to activate. Watch what changes after a decision."]
    ];
    return <Modal title="Company introduction" onClose={()=>onboardingMove("skip")}>
      <p>Prompt {meta.openingOnboarding.step+1} of 3 - Simulation paused</p>
      <h3>{prompts[meta.openingOnboarding.step][0]}</h3><p>{prompts[meta.openingOnboarding.step][1]}</p>
      <div className="campaign-actions"><button className="btn" onClick={()=>onboardingMove("skip")}>Skip introduction</button>
      <button className="btn" disabled={meta.openingOnboarding.step===0} onClick={()=>onboardingMove("back")}>Back</button>
      <button className="btn btn-primary" onClick={()=>onboardingMove("next")}>{meta.openingOnboarding.step===2?"Finish introduction":"Next"}</button></div>
    </Modal>;
  }
  if (game.phase === "review") return <Modal title="Incident postmortem" wide icon={{ kind: "ok", name: "incident" }}><Report report={c.reports[c.reports.length - 1]} /><div className="modal-foot"><span className="muted">The same company continues.</span><button className="btn btn-primary" onClick={() => act({ type: "acknowledge_review" })}>Continue company<Icon name="next" /></button></div></Modal>;
  if(c.openingMilestone&&!c.openingMilestone.acknowledged)return <Modal title="First growth challenge handled">
    <p>Your company is still operating. Your architecture, cash and pending work are preserved.</p>
    <p>{c.limit!==null?"The traffic limit remains active: rejected demand still has a revenue trade-off.":"Your company is serving its current demand."} Future releases will introduce more opportunities.</p>
    <button className="btn btn-primary" onClick={()=>act({type:"acknowledge_milestone"})}>Continue operating</button>
  </Modal>;
  if (game.phase === "ended" && view === null) return <Modal title="Company bankrupt" tone="alert" icon={{ kind: "critical", name: "cash" }} onClose={() => openView("menu")}>
    <Callout tone="critical" icon="cash" kicker="Company closed">Cash reached {dollars(c.cashCents)} after settlement at step {c.step}. Final metrics and history remain available.</Callout>
    <p>Last period revenue: {dollars(c.settlements.at(-1)?.revenueCents??0)}. Infrastructure: {dollars((c.settlements.at(-1)?.appCents??0)+(c.settlements.at(-1)?.dbCents??0))}. Salaries: {dollars(c.settlements.at(-1)?.salaryCents??0)}.</p>
    <p>Upfront investment: {dollars(c.investedCents)}. Rejected demand: {c.cumulative.rejected} requests (not an extra cash charge).</p>
    <div className="btn-row"><button className="btn" onClick={() => openView("history")}>View history</button><button className="btn" onClick={() => openView("menu")}>Export or start a new company</button></div>
  </Modal>;
  if (view === "menu") return <Modal title="Menu" icon={{ kind: "muted", name: "menu" }} onClose={closeMenu}>
    <Callout tone="info" icon="pause" kicker="Time is paused">One step models one second of requests. Every 60 steps settles an operating week. Pausing freezes everything.</Callout>
    <section className="menu-section"><h4>How to play</h4><p>{nextMove(game).text} Click equipment in the room or the investigation controls to inspect it for free. Choose a response, then Run to observe the change. P pauses and Esc closes a view.</p></section>
    {saveBlocked && <Callout tone="warn" icon="save" kicker="Save preserved" live="alert">Your stored save is unreadable or unsupported and has been preserved. This run stays in memory until you explicitly reset.</Callout>}
    <section className="menu-section"><h4>Company</h4><div className="btn-row"><button className="btn" onClick={()=>saveNow()}><Icon name="save" />Save now</button><button className="btn" onClick={() => setConfirmReset(true)}>New company</button></div>
      {confirmReset && <><p>This replaces only the current campaign save. Export it first if you want to keep it.</p><button className="btn" onClick={() => { newRun(); setConfirmReset(false); }}>Confirm new company</button></>}
    </section>
    <section className="menu-section"><h4>Introduction and playtest records</h4>
      <div className="btn-row"><button className="btn" onClick={()=>useGame.getState().showOnboarding()}>Replay introduction</button>
      <button className="btn" onClick={()=>{useGame.getState().measureTime();const s=useGame.getState();download("playtest-session.json",exportPlaytest(s.game,s.measurement));}}>Export playtest record</button>
      <button className="btn" onClick={()=>useGame.getState().endSession()}>Save and exit to title</button></div>
      <details className="more"><summary>Playtest observer notes</summary>
        <p>Session: {measurement.session?.id??"Not started"} · Build: {import.meta.env.VITE_BUILD_ID||"dev/unrecorded"}</p>
        <label>Participant source <select value={measurement.session?.source??"unspecified"} onChange={e=>useGame.getState().observer(e.target.value as "organic"|"recruited"|"unspecified")}><option value="unspecified">Unspecified</option><option value="recruited">Recruited</option><option value="organic">Organic</option></select></label>
        <label>Exact facilitator intervention <textarea value={intervention} onChange={e=>setIntervention(e.target.value)} /></label>
        <button className="btn" disabled={!intervention.trim()} onClick={()=>{useGame.getState().observer(measurement.session?.source??"unspecified",intervention);setIntervention("");}}>Record intervention</button>
      </details>
    </section>
    <SaveFiles /><ModeSwitch to="classic" />
  </Modal>;
  if (view === "history") return <Modal title="Campaign history" wide icon={{ kind: "users", name: "history" }} onClose={() => openView(null)}>
    <LineChart title="Latency" axisLabel="Step" series={[{ name: "Latency", color: "var(--c-health)", values: c.recent.map(m => m.latencyMs) }]} turns={c.recent.map(m => m.step)} format={v => `${v.toFixed(0)} ms`} />
    {c.reports.map(p => <Report key={p.id} report={p} />)}
    <details className="more"><summary>Financial settlements</summary>{c.settlements.map(p => <p key={p.period}>Week {p.period}: revenue {dollars(p.revenueCents)}, net {dollars(p.netCents)}</p>)}</details>
    <details className="more"><summary>Action and event history</summary>{c.trace.filter(e => e.type !== "metrics").map(e => <p key={e.id}>Step {e.step}: {e.type.replaceAll("-", " ")} {e.data.reason ? String(e.data.reason) : e.data.type ? ACTION_NAMES[e.data.type as Intervention] ?? String(e.data.type).replaceAll("-", " ") : ""}</p>)}</details>
  </Modal>;
  return null;
}
