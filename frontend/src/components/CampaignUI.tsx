import { DATA_PROFILES } from "@/sim/scenarios/dataStrategy";
import { canEnterData } from "@/sim/step";
import { nextMove } from "@/game/advisor";
import { useState } from "react";
import { inspectOrSelect, useGame, type Speed } from "@/game/store";
import { rawSave, exportLegacyData, exportPlaytest } from "@/game/persist";
import { makeEnvelope } from "@/game/saveMigrations";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
import type { CampaignPostmortem } from "@/sim/campaignTypes";
import { Icon } from "./icons";
import { Modal } from "./ui";
const dollars = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(c / 100);
const percent = (v: number | null) => v === null ? "No completed requests" : (v * 100).toFixed(2) + "%";

// Presentation only: all gates and observations come from the existing campaign.
function CampaignGuidance() {
  const { game, act, onboarding } = useGame(), c = game.campaign!;
  const openingDone = !!c.openingMilestone?.acknowledged;
  const dataAvailable = !c.dataStage && canEnterData(game);
  const stage = c.dataStage ? "Data Strategy" : openingDone ? "Scaling & Routing" : "Opening";
  const pendingMilestone = !!c.openingMilestone && !openingDone;
  const objective = game.phase === "ended" ? "Review why the company became insolvent before deciding whether to restart."
    : game.phase === "review" ? "Understand the recovered incident and acknowledge its postmortem."
    : pendingMilestone ? "Acknowledge the opening milestone to continue the same company."
    : c.incident ? "Restore stable service while weighing cost and rejected demand."
    : c.dataStage ? "Prepare the data layer for increased demand and compare workload trade-offs."
    : dataAvailable ? "Review the scaling evidence, then continue to data strategy when ready."
    : openingDone ? "Prepare the system for the next growth wave."
    : "Observe the system as demand grows and compare component evidence.";
  return <>
    <nav className="campaign-progression" aria-label="Campaign progression"><ol className="campaign-stages">
      <li aria-current={!openingDone ? "step" : undefined}>Opening <strong>{openingDone ? "Completed" : "Current"}</strong></li>
      <li aria-current={openingDone && !c.dataStage ? "step" : undefined}>Scaling &amp; Routing <strong>{c.dataStage ? "Completed" : openingDone ? "Current" : pendingMilestone ? "Available next · acknowledge milestone" : "Locked"}</strong></li>
      <li aria-current={c.dataStage ? "step" : undefined}>Data Strategy <strong>{c.dataStage ? "Current" : dataAvailable ? "Available next" : "Locked"}</strong></li>
      <li>Later stages <strong>Locked · not implemented</strong></li>
    </ol></nav>
    <section className="campaign-guidance" aria-label="Campaign guidance"><h2>Campaign guidance</h2>
    <p>Current stage: <strong>{stage}</strong></p>
    <h3>Current objective</h3><p>{objective}</p>
    {game.phase === "review" ? <p role="status">Recovery recorded. Pending acknowledgement: Incident postmortem. Read the open report, then select Continue company; simulation remains paused.</p>
      : pendingMilestone ? <p role="status">Pending acknowledgement: First growth challenge handled. Select Continue operating in the milestone to enter Scaling &amp; Routing.</p>
      : !openingDone ? <p>Next stage requires acknowledgement of the first recovered incident’s postmortem and milestone. Stable operation alone does not complete the opening.</p>
      : !c.scaling ? <button className="btn btn-primary" disabled={onboarding || game.phase === "ended"} onClick={() => act({type:"enter_scaling"})}>Continue to scaling and routing</button>
      : !c.dataStage && !c.scaling.consumed ? <><p>Next growth requirement: Database headroom: {c.dbCapacity.toLocaleString("en-US")} / 2,000 ops/s.</p><p>Growth also requires management with no active incident and empty application/database backlogs. Run or Advance step checks readiness; existing action delays still apply.</p></>
      : !c.dataStage && !dataAvailable ? <p>Next stage requires completed scaling growth, drained backlogs, stable management and acknowledged incident reports.</p>
      : c.dataStage && !c.dataStage.consumed ? <p>Next growth requires stable management, empty backlogs and acknowledged reports. Run or Advance step checks readiness.</p>
      : c.dataStage ? <p>Compare the workload evidence and available responses. Later campaign stages remain locked.</p> : null}
    {dataAvailable && <button className="btn btn-primary" disabled={onboarding || game.phase === "ended"} onClick={() => act({type:"enter_data"})}>Continue to data strategy</button>}
    {c.limit !== null && <div className="traffic-limit-notice" role="note" aria-label="Traffic limit trade-off"><strong>Traffic limit active</strong>
      <p>Incoming: {c.snapshot.incoming} req/s · Admitted: {c.snapshot.admitted} req/s · Rejected: {c.snapshot.rejected} req/s</p>
      <p>Rejected demand this period: {c.ledger.rejected}; opportunity value {dollars(c.ledger.rejected * 20)} (not an extra charge). Service can be stable while sacrificing growth.</p>
    </div>}
    {c.dataStage && <div aria-label="Data stage context"><p>Workload: {DATA_PROFILES[c.dataStage.profile].readShare / 100}% reads / {100 - DATA_PROFILES[c.dataStage.profile].readShare / 100}% writes.</p>
      <p>Cache: {!c.readCache ? "Not deployed" : c.readCache.warmth === 0 ? "Cold" : c.readCache.warmth < c.readCache.target ? "Warming" : "Warm"}. Effective hit rate used: {c.snapshot.data ? `${c.snapshot.data.effectiveHitRateUsed / 100}%` : "No completed workload observation yet"}.</p>
      <p>Database: {c.snapshot.db.demand} / {c.snapshot.db.capacity} ops/s.</p></div>}
  </section></>;
}

export function CampaignHeader() {
  const { game, openView } = useGame(), c = game.campaign!;
  return <header className="topbar campaign-header"><div className="brand"><span className="brand-mark">99.99%</span>
    <span>Operating week {game.turn} · Step <strong data-testid="physical-step">{c.step}</strong></span></div>
    <div className="stats-strip"><div className="stat"><span>Cash</span><strong>{dollars(c.cashCents)}</strong></div>
      <div className="stat"><span>Users</span><strong>2,000</strong></div>
      <div className="stat"><span>Pending revenue</span><strong>{dollars(c.ledger.successes * Q.revenueCents)}</strong></div>
      <div className="stat"><span>Status</span><strong>{game.phase === "incident" ? "Service degraded" : game.phase === "ended" ? "Bankrupt" : game.phase === "review" ? "Recovered" : c.snapshot.latencyMs >= 500 ? "At risk" : c.limit !== null ? "Stable — traffic limited" : "Operating"}</strong></div></div>
    <button className="icon-btn" aria-label="Menu" onClick={() => openView("menu")}><Icon name="menu" /></button></header>;
}
export function CampaignPanel() {
  const { game, act, selected, selectedAppId } = useGame(), c = game.campaign!, m = c.snapshot;
  const busy = c.pending.some(a => !["limit","unlimit","routing"].includes(a.type));
  const unlocked=!!c.openingMilestone?.acknowledged;
  const dbNext=c.dbCapacity===600?1000:c.dbCapacity===1000?2000:3000;
  const dbCost=c.dbCapacity===2000?400000:Q.dbCostCents;
  const dbDelay=c.dbCapacity===2000?4:3;
  const selectedApp=c.apps.find(a=>a.id===selectedAppId)??c.apps[0];
  const onboarding = useGame(s=>s.onboarding);
  const disabled = onboarding || !!(c.openingMilestone&&!c.openingMilestone.acknowledged) || game.phase === "review" || game.phase === "ended";
  const admissionPending = c.pending.some(a => a.type === "limit" || a.type === "unlimit");
  return <aside className="side campaign-panel" aria-label="System metrics">
    <CampaignGuidance />
    <section className="panel-section" aria-label="System evidence"><header className="panel-head"><Icon name="monitor" /><h2>{game.phase === "incident" ? "Service slowdown" : "System evidence"}</h2></header>
      <nav className={`dependency-strip${c.dataStage?" data-dependencies":""}`} aria-label="Request dependencies">
        <span>Users<br/>{m.incoming} req/s</span><span aria-hidden="true">&rarr;</span>
        <button className="btn tip tip-left" data-tip={`${m.app.demandRatio>1?"Demand exceeds capacity":"Demand within capacity"}. Backlog: ${m.app.backlog}. Busy: ${percent(m.app.busyUtilisation)}`} aria-pressed={selected==="app"} onClick={()=>inspectOrSelect("app","app-1")}>Application<br/>{m.app.demand} / {m.app.capacity} req/s</button>
        {c.dataStage&&<><span aria-hidden="true">&rarr;</span><button className="btn" aria-pressed={selected==="cache"} onClick={()=>inspectOrSelect("cache")}>Read Cache<br/>{c.readCache?"Deployed":"Not deployed — all work reaches DB"}</button></>}
        <span aria-hidden="true">&rarr;</span><button className="btn tip tip-left" data-tip={`${m.db.demandRatio>1?"Demand exceeds capacity":"Demand within capacity"}. Backlog: ${m.db.backlog}. Busy: ${percent(m.db.busyUtilisation)}`} aria-pressed={selected==="db"} onClick={()=>inspectOrSelect("db")}>Database<br/>{m.db.demand} / {m.db.capacity} ops/s</button>
      </nav>
      {c.apps.filter(a=>!a.routed).map(a=><div className="idle-app-notice" role="note" aria-label={`${a.id === "app-2" ? "App 2" : "App 1"} routing status`} key={a.id}>
        <strong>{a.id === "app-2" ? "App 2" : "App 1"}</strong><p>Installed ✓ · Receiving traffic ✗</p>
        <p>Installed capacity: {a.capacity} req/s · Routed capacity: 0 req/s.</p>
        <p>Installed capacity does not receive traffic until it is included in routing.</p>
        {!unlocked&&<p>Routing controls become available after acknowledging the opening postmortem and milestone.</p>}
      </div>)}
      {unlocked&&<section aria-label="Application instances"><p>Routing: <strong>{c.routing.mode}</strong>; targets: {c.routing.targets.join(", ")}. Load balancer: {c.loadBalancer?"Deployed":"Not deployed"}.</p>
        {c.apps.map(a=>{const x=m.instances?.find(x=>x.id===a.id);return <button key={a.id} className="btn tip tip-left" aria-pressed={selected==="app"&&selectedAppId===a.id} data-tip={`Backlog: ${a.backlog}; capacity: ${a.capacity} req/s`} onClick={()=>inspectOrSelect("app",a.id)}>{a.id==="app-1"?"App 1":"App 2"}: {a.routed?"Receiving traffic":"Installed - not receiving traffic"}<br/>{x?`${x.demand} / ${x.capacity} req/s; processed ${x.processed}; busy ${percent(x.busyUtilisation)}`:`${a.capacity} req/s; no per-instance observation yet`}; backlog {a.backlog}</button>;})}
        {c.pending.filter(a=>a.type==="add-app").map(a=><p key={a.id}>App 2: Deploying - no installed capacity yet</p>)}
        <p>Selected app: {selectedApp.id}. Capacity {selectedApp.capacity} req/s; backlog {selectedApp.backlog} requests.</p>
      </section>}
      <p role="status">Selected component: <strong>{selected==="app"?(unlocked?selectedApp.id:"Application"):selected==="db"?"Database":selected==="cache"?"Read Cache":"System overview"}</strong></p>
      <p>{nextMove(game).text}</p>
      <button className="btn" disabled={disabled} onClick={() => act({ type: "incident_inspect", equipment: selected === "app" ? "app" : selected === "db" ? "db" : selected === "cache" ? "cache" : "monitoring", ...(selected==="app"?{appId:selectedApp.id}:{}) })}>Inspect metrics · free</button>
      <p>Incoming <b>{m.incoming}</b> / admitted <b>{m.admitted}</b> / rejected <b>{m.rejected}</b> requests/s</p>
      <table className="campaign-table"><caption>Component evidence, step {c.step}</caption><thead><tr><th>Metric</th><th>Application</th><th>Database</th></tr></thead>
        <tbody>{[["Demand /s", m.app.demand, m.db.demand], ["Capacity /s", m.app.capacity, m.db.capacity], ["Demand/capacity", percent(m.app.demandRatio), percent(m.db.demandRatio)], ["Busy", percent(m.app.busyUtilisation), percent(m.db.busyUtilisation)], ["Backlog", m.app.backlog, m.db.backlog], ["Processed", m.app.processed, m.db.processed], ["Failed", m.app.failed, m.db.failed]].map(([label, a, b]) => <tr key={label}><th>{label}</th><td className={selected==="app"?"selected-evidence":""}>{a}</td><td className={selected==="db"?"selected-evidence":""}>{b}</td></tr>)}</tbody></table>
      <p>Application installed capacity: {m.installedAppCapacity} req/s. Routed capacity: {m.effectiveAppCapacity??m.app.capacity} req/s.</p>
      <p>Latency: <strong>{m.latencyMs.toFixed(0)} ms</strong> · Service errors: <strong>{percent(m.serviceErrorRate)}</strong></p>
      {c.incident && <p role="status">Stable steps: {c.incident.stableSteps}/5 · requires &lt;500 ms and &lt;1% service errors with traffic and completed outcomes.</p>}
    </section>
    <section className="panel-section" aria-label="Actions"><h2>Actions</h2>
      <div className="campaign-actions">
        <button className="btn" disabled={disabled || busy || c.apps.length >= 2 || c.cashCents <= Q.appCostCents} onClick={() => act({ type: "add_server" })}>Add application · $1,000 · 2 steps</button>
        <button className="btn" disabled={disabled || busy || (unlocked?c.dbCapacity>=(c.dataStage?3000:2000):c.upgraded) || c.cashCents <= dbCost} onClick={() => act({ type: "start_db_upgrade" })}>{c.dataStage&&c.dbCapacity===3000?"Database at highest tier · 3,000 ops/s":<>Upgrade database · {dollars(dbCost)} · {dbDelay} steps{unlocked?` · next tier ${dbNext} ops/s`:""}</>}</button>
        <button className="btn" disabled={disabled || admissionPending} onClick={() => act({ type: "set_traffic_limit", enabled: c.limit === null })}>{c.limit === null ? "Limit to 500 requests/s" : "Remove traffic limit"}</button>
      </div>
      {unlocked&&<section aria-label="Scaling controls"><h3>Scale Up / Scale Out + Load Balancing</h3>
        <button className="btn" disabled={disabled||busy||selectedApp.tier!=="base"||c.cashCents<=200000} onClick={()=>act({type:"scale_up",appId:selectedApp.id})}>Scale up {selectedApp.id} · $2,000 · 3 steps</button>
        <button className="btn" disabled={disabled||busy||c.loadBalancer||c.cashCents<=100000} onClick={()=>act({type:"deploy_load_balancer"})}>Deploy load balancing · $1,000 · 2 steps</button>
        <fieldset disabled={disabled||!c.loadBalancer||c.pending.some(a=>a.type==="routing")}><legend>Routing configuration · activates next step</legend>
          <button className="btn" disabled={c.routing.mode==="balanced"&&c.routing.targets.length===c.apps.length} onClick={()=>act({type:"set_routing",mode:"balanced",targets:c.apps.map(a=>a.id)})}>Balance across installed apps</button>
          {c.apps.map(a=><button key={a.id} className="btn" disabled={c.routing.mode==="balanced"&&c.routing.targets.length===1&&c.routing.targets[0]===a.id} onClick={()=>act({type:"set_routing",mode:"balanced",targets:[a.id]})}>Balance to {a.id} only</button>)}
          <button className="btn" disabled={c.routing.mode==="single"} onClick={()=>act({type:"set_routing",mode:"single",targets:["app-1"]})}>Route only to App 1</button>
        </fieldset>
        <p>Scaling growth: {c.scaling?.consumed?"1,400 req/s event applied":c.dbCapacity<2000?"Waiting for an explicitly purchased 2,000 ops/s database":c.incident||c.dbBacklog||c.apps.some(a=>a.backlog)?"Waiting for management and empty backlogs":c.scaling?.dueStep?`Due at step ${c.scaling.dueStep} while ready`:"Readiness will be checked on the next step"}.</p>
      </section>}
      {c.dataStage&&<section aria-label="Data strategy"><h3>Data strategy</h3>
        <p>Workload: {c.dataStage.consumed?c.dataStage.profile:"Waiting for workload growth"}. {c.dataStage.dueStep!==null&&!c.dataStage.consumed?`Growth due at step ${c.dataStage.dueStep} while ready`:""}</p>
        <p>Cache: {c.readCache?"Deployed":"Not deployed"}; warmth for next work {((c.readCache?.warmth??0)/100).toFixed(0)}%; target {(c.readCache?.target??0)/100}%.</p>
        {m.data?<div aria-label="Workload evidence"><p>Reads {m.data.readShare/100}% / writes {(10000-m.data.readShare)/100}%; cacheable reads {m.data.cacheableReadShare/100}%.</p>
          <p>Effective hit rate used: <b>{m.data.effectiveHitRateUsed/100}%</b>; hits <b>{m.data.hits}</b>; eligible misses <b>{m.data.eligibleMisses}</b>.</p>
          <p>Logical work {m.data.logical}; writes {m.data.writes}; non-cacheable reads {m.data.nonCacheableReads}. Misses and writes reach DB.</p>
          <p>DB demand {m.db.demand} / {m.db.capacity} ops/s; DB backlog {m.db.backlog}.</p></div>:<p>No completed workload observation yet.</p>}
        <button className="btn" disabled={disabled||busy||!!c.readCache||c.cashCents<=150000} onClick={()=>act({type:"deploy_cache"})}>Deploy Read Cache · $1,500 · 2 steps</button>
        <button className="btn" disabled={disabled||busy||!c.readCache||c.readCache.tuned||c.cashCents<=100000} onClick={()=>act({type:"tune_cache"})}>Tune cache ceiling to 75% · $1,000 · 2 steps</button>
        <button className="btn" disabled={disabled||!c.dataStage.consumed||c.dataStage.contrastConsumed||!canEnterData(game)} onClick={()=>act({type:"contrast_workload"})}>Observe contrasting workload</button>
      </section>}
      {c.pending.map(a => <p role="status" key={a.id}>{{"add-app":"Application installation","upgrade-db":"Database upgrade",limit:"Traffic limit",unlimit:"Remove traffic limit","scale-up":"Application scale up","deploy-lb":"Load balancer deployment",routing:"Routing change",cache:"Read Cache deployment","cache-tuning":"Cache tuning"}[a.type]}{a.targetId?` (${a.targetId})`:""}: activates in {a.activationStep - c.step} step(s)</p>)}
      <p>Unsettled costs: {dollars(Math.floor((c.ledger.appNumerator + c.ledger.dbNumerator + c.ledger.salaryNumerator + (c.ledger.lbNumerator??0) + (c.ledger.cacheNumerator??0)) / 60))}. Settlement at step {(c.lastSettledPeriod + 1) * 60}.</p>
      <p>Rejected demand this period: {c.ledger.rejected}; opportunity value {dollars(c.ledger.rejected * 20)} (not an extra charge).</p>
    </section></aside>;
}
export function CampaignControls() {
  const { game, running, setRunning, speed, setSpeed, advance, openView, started, onboarding } = useGame();
  const active = started && !onboarding && !(game.campaign!.openingMilestone&&!game.campaign!.openingMilestone!.acknowledged) && (game.phase === "management" || game.phase === "incident");
  return <footer className="bottombar"><button className="btn" onClick={() => openView("history")}>History</button>
    <div className="time-controls"><button className="btn" disabled={!active} onClick={() => setRunning(!running)}>{running ? "Pause" : "Run"}</button>
      <div className="speed" role="group" aria-label="Game speed">{([.5, 1, 2] as Speed[]).map(v => <button key={v} aria-pressed={speed === v} onClick={() => setSpeed(v)}>{v}×</button>)}</div>
      <button className="btn btn-primary" disabled={!active || game.phase !== "management"} onClick={advance}>Advance step</button></div></footer>;
}
function Report({ report }: { report: CampaignPostmortem }) {
  return <div><p>Incident steps {report.openedStep}–{report.recoveredStep}. Setup spending: {dollars(report.setupCents)}.</p>
    <details><summary>Workload and cache evidence</summary>{report.snapshots.map(m=><p key={m.step}>Step {m.step}: {m.data?`${m.data.profile}; hits ${m.data.hits}, misses ${m.data.eligibleMisses}, writes ${m.data.writes}; effective rate ${m.data.effectiveHitRateUsed/100}%; DB ${m.db.demand}/${m.db.capacity}`:"Historical workload/cache detail unavailable"}</p>)}</details>
    {report.explanations.map((text, i) => <p key={i}>{text}</p>)}
    <details><summary>Recorded incident evidence</summary><table className="campaign-table"><thead><tr><th>Step</th><th>App demand/capacity</th><th>Routing targets</th><th>DB demand/capacity</th><th>Backlog</th><th>Latency</th><th>Errors</th></tr></thead><tbody>{report.snapshots.map(m => <tr key={m.step}><td>{m.step}</td><td>{m.app.demand}/{m.app.capacity}</td><td>{m.routing?.targets.join(", ")??"Historical aggregate observation"}</td><td>{m.db.demand}/{m.db.capacity}</td><td>{m.db.backlog}</td><td>{m.latencyMs.toFixed(0)} ms</td><td>{percent(m.serviceErrorRate)}</td></tr>)}</tbody></table></details></div>;
}
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
export function CampaignOverlays() {
  const { game, started, play, view, openView, act, newRun, saveNow, saveBlocked, remainderMs } = useGame();
  const c = game.campaign!;
  const [confirmReset, setConfirmReset] = useState(false);
  const [intervention,setIntervention]=useState("");
  const {measurement,hasRun}=useGame();
  const configured=import.meta.env.VITE_PLAYTEST_URL as string|undefined;
  const playtestUrl=configured&&/^https?:\/\//.test(configured)?configured:null;
  if (!started) return <div className="title-screen"><div className="title-card campaign-entry">
    <h1>99.99% - System Design Tycoon</h1>
    <p className="title-tag">Grow a startup. Keep it online.</p>
    <p>Build a software company, diagnose growing pains and weigh the cost of keeping your service running.</p>
    <img className="gameplay-preview" src="/opening-gameplay.png" alt="The furnished server room and component evidence in the playable campaign" />
    <div className="campaign-actions"><button className="btn btn-primary btn-big" onClick={play}>{hasRun?"Continue company":"Try Prototype"}</button>
      {playtestUrl?<a className="btn" href={playtestUrl} target="_blank" rel="noopener noreferrer">Join Playtest</a>:<><button className="btn" disabled>Join Playtest</button><small>Playtest registration is not open yet.</small></>}
    </div><p>Play immediately as a guest. Progress stays in this browser.</p>
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
  if (game.phase === "review") return <Modal title="Incident postmortem" onClose={() => act({ type: "acknowledge_review" })}><Report report={c.reports[c.reports.length - 1]} /><button className="btn btn-primary" onClick={() => act({ type: "acknowledge_review" })}>Continue company</button></Modal>;
  if(c.openingMilestone&&!c.openingMilestone.acknowledged)return <Modal title="First growth challenge handled">
    <p>Your company is still operating. Your architecture, cash and pending work are preserved.</p>
    <p>{c.limit!==null?"The traffic limit remains active: rejected demand still has a revenue trade-off.":"Your company is serving its current demand."} Continue this company to explore application scaling and routing; compare the evidence before investing.</p>
    <button className="btn btn-primary" onClick={()=>act({type:"acknowledge_milestone"})}>Continue operating</button>
  </Modal>;
  if (game.phase === "ended" && view !== "menu" && view !== "history") return <Modal title="Company bankrupt" onClose={() => openView("menu")}><p>Cash reached {dollars(c.cashCents)} after settlement at step {c.step}. Final metrics and history remain available.</p><p>Last period revenue: {dollars(c.settlements.at(-1)?.revenueCents??0)}. Infrastructure: {dollars((c.settlements.at(-1)?.appCents??0)+(c.settlements.at(-1)?.dbCents??0)+(c.settlements.at(-1)?.lbCents??0)+(c.settlements.at(-1)?.cacheCents??0))}. Salaries: {dollars(c.settlements.at(-1)?.salaryCents??0)}.</p><p>Upfront investment: {dollars(c.investedCents)}. Rejected demand: {c.cumulative.rejected} requests (not an extra cash charge).</p><button className="btn" onClick={()=>openView("history")}>View final history</button><button className="btn" onClick={() => openView("menu")}>Export or start a new company</button></Modal>;
  if (view === "menu") return <Modal title="Menu" onClose={() => { openView(null); setConfirmReset(false); }}>
    <p>One step models one second of requests. Every 60 steps settles an operating week. Pausing freezes everything.</p>
    <p>Use the room controls to inspect equipment. Compare demand, capacity, backlog and response time before choosing an action.</p>

    <details><summary>Playtest observer notes</summary>
      <p>Session: {measurement.session?.id??"Not started"} - Build: {import.meta.env.VITE_BUILD_ID||"dev/unrecorded"}</p>
      <label>Participant source <select value={measurement.session?.source??"unspecified"} onChange={e=>useGame.getState().observer(e.target.value as "organic"|"recruited"|"unspecified")}><option value="unspecified">Unspecified</option><option value="recruited">Recruited</option><option value="organic">Organic</option></select></label>
      <label>Exact facilitator intervention <textarea value={intervention} onChange={e=>setIntervention(e.target.value)} /></label>
      <button className="btn" disabled={!intervention.trim()} onClick={()=>{useGame.getState().observer(measurement.session?.source??"unspecified",intervention);setIntervention("");}}>Record intervention</button>
    </details>
    {saveBlocked && <p role="alert">Your stored save is unreadable or unsupported and has been preserved. This run stays in memory until you explicitly reset.</p>}
    <div className="campaign-actions"><button className="btn" onClick={()=>useGame.getState().showOnboarding()}>Replay introduction</button><button className="btn" onClick={()=>saveNow()}>Save now</button>
      <button className="btn" onClick={()=>{useGame.getState().measureTime();const s=useGame.getState();download("playtest-session.json",exportPlaytest(s.game,s.measurement));}}>Export playtest record</button>
      <button className="btn" onClick={()=>useGame.getState().endSession()}>Save and exit to title</button>
      <button className="btn" onClick={() => download("campaign.json", JSON.stringify(makeEnvelope(game, remainderMs, Date.now(), measurement)))}>Export current company</button>
      <button className="btn" onClick={() => download("stored-campaign.json", rawSave() ?? "null")}>Export original stored save</button>
      <button className="btn" onClick={() => download("legacy-browser-data.json", exportLegacyData())}>Export legacy data</button>
      <button className="btn" onClick={() => setConfirmReset(true)}>New company</button>
      {confirmReset && <><p>This replaces only the current campaign save. Export it first if you want to keep it.</p><button className="btn" onClick={() => { newRun(); setConfirmReset(false); }}>Confirm new company</button></>}</div>
  </Modal>;
  if (view === "history") return <Modal title="Campaign history" onClose={() => openView(null)}>
    <p>Latency in the last {c.recent.length} steps (milliseconds). Horizontal axis: physical steps {c.recent[0]?.step??0} to {c.step}. Vertical axis: 0 to 1,100 ms; higher values are clipped.</p>
    <svg viewBox="0 0 600 120" role="img" aria-label="Latency history" style={{ width: "100%", height: 120 }}><polyline fill="none" stroke="currentColor" strokeWidth="2" points={c.recent.map((m, i) => `${i * 600 / Math.max(1, c.recent.length - 1)},${115 - Math.min(110, m.latencyMs / 10)}`).join(" ")} /></svg>
    {c.dataStage&&<details><summary>Workload and cache history</summary>{c.recent.map(m=><p key={m.step}>Step {m.step}: {m.data?`${m.data.profile}; hits ${m.data.hits}; misses ${m.data.eligibleMisses}; used ${m.data.effectiveHitRateUsed/100}%`:"Historical workload/cache detail unavailable"}</p>)}</details>}
    {c.reports.map(p => <Report key={p.id} report={p} />)}
    <details><summary>Backlog and traffic history</summary><table className="campaign-table"><thead><tr><th>Step</th><th>App demand/capacity</th><th>Routing targets</th><th>DB demand / capacity (ops/s)</th><th>DB backlog (ops)</th><th>Rejected (req/s)</th></tr></thead><tbody>{c.recent.map(m=><tr key={m.step}><td>{m.step}</td><td>{m.app.demand}/{m.app.capacity}</td><td>{m.routing?.targets.join(", ")??"Historical aggregate observation"}</td><td>{m.db.demand}/{m.db.capacity}</td><td>{m.db.backlog}</td><td>{m.rejected}</td></tr>)}</tbody></table></details><details><summary>Financial settlements</summary>{c.settlements.map(p => <p key={p.period}>Week {p.period}: revenue {dollars(p.revenueCents)}, net {dollars(p.netCents)}</p>)}</details>
    <details><summary>Action and event history</summary>{c.trace.filter(e => e.type !== "metrics").map(e => <p key={e.id}>Step {e.step}: {e.type} {e.data.reason ? String(e.data.reason) : e.data.type ? String(e.data.type) : ""}</p>)}</details>
  </Modal>;
  return null;
}
