import { pendingSpikeAcknowledgement, canEnterSpikes, spikeInput } from "@/sim/autoscaling";
import { TRAFFIC_SPIKES as T } from "@/sim/scenarios/trafficSpikes";
import { DATA_STRATEGY as D } from "@/sim/scenarios/dataStrategy";
import { canEnterData, databaseUpgrade } from "@/sim/step";
import { AccountPanel } from "./AccountPanel";
import { APPLICATION_SCALING as P } from "@/sim/scenarios/applicationScaling";
import { exportPlaytest } from "@/game/persist";
import { nextMove } from "@/game/advisor";
import { money, num } from "@/game/format";
import { useState } from "react";
import { inspectOrSelect, useGame, type Speed } from "@/game/store";
import { SaveFiles } from "./SaveFiles";
import { SoundButton } from "./SoundButton";
import { SoundSettings } from "./SoundSettings";
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
const PLACES = ["gateway", "app", "cache", "db", "monitoring"] as const;
const PLACE_NAMES = { gateway: "Network", app: "Servers", db: "Database", monitoring: "Monitoring", cache: "Read Cache" };
const ACTION_NAMES: Record<Intervention, string> = {
  "add-app": "Add server", "upgrade-db": "Database upgrade", limit: "Traffic limit", unlimit: "Remove traffic limit", "scale-up":"Application scale up", "deploy-lb":"Load balancer deployment", routing:"Routing change", cache:"Read Cache deployment", "cache-tuning":"Cache tuning", "deploy-autoscaler":"Autoscaling controller deployment", "retire-app":"Safe application retirement",
};

// Progress is derived from the engine; reading this panel never advances the run.
function CampaignGuidance() {
  const {game,act,onboarding}=useGame(),c=game.campaign!;
  const openingDone=!!c.openingMilestone?.acknowledged,available=!c.dataStage&&canEnterData(game);
  const stage=c.spikeStage?"Traffic Spikes & Autoscaling":c.dataStage?"Data Strategy":openingDone?"Scaling & Routing":"Opening";
  const objective=game.phase==="ended"?"Review the company's finances and recorded evidence."
    :game.phase==="review"?"Read the postmortem before continuing the same company."
    :c.spikeStage?"Maintain service through changing demand while managing capacity cost."
    :c.incident?"Restore stable service while weighing cost and rejected demand."
    :c.dataStage?"Compare logical work, cache hits and database pressure as demand grows."
    :openingDone?"Prepare the system for the next growth wave.":"Observe demand and compare component evidence.";
  return <section className="panel-section campaign-guidance" aria-label="Campaign guidance">
    <Callout compact tone="info" icon="monitor" kicker={`Current stage: ${stage}`}>{objective}</Callout>
    {canEnterSpikes(game)&&<button className="btn btn-primary" disabled={onboarding} onClick={()=>act({type:"enter_spikes"})}>Continue to traffic spikes</button>}
    {available&&<button className="btn btn-primary" disabled={onboarding} onClick={()=>act({type:"enter_data"})}>Continue to data strategy<Icon name="next" /></button>}
    <details className="more"><summary>Campaign progression and next requirements</summary>
      <nav aria-label="Campaign progression"><ol className="campaign-stages">
        <li aria-current={!openingDone?"step":undefined}>Opening <strong>{openingDone?"Completed":"Current"}</strong></li>
        <li aria-current={openingDone&&!c.dataStage?"step":undefined}>Scaling &amp; Routing <strong>{c.dataStage?"Completed":openingDone?"Current":"Locked · acknowledge opening milestone"}</strong></li>
        <li aria-current={c.dataStage&&!c.spikeStage?"step":undefined}>Data Strategy <strong>{c.spikeStage?"Completed":c.dataStage?"Current":available?"Available next":"Locked"}</strong></li>
        <li aria-current={c.spikeStage?"step":undefined}>Traffic Spikes &amp; Autoscaling <strong>{c.spikeStage?(c.spikeStage.acknowledged?"Completed":"Current"):canEnterSpikes(game)?"Available next":"Locked · complete data growth and restore stable service"}</strong></li>
        <li>Later stages <strong>Locked · not implemented</strong></li>
      </ol></nav>
      {game.phase==="review"?<p role="status">Pending acknowledgement: Incident postmortem. Simulation remains paused.</p>
        :c.openingMilestone&&!openingDone?<p role="status">Pending acknowledgement: First growth challenge handled.</p>
        :!openingDone?<p>Next stage requires acknowledgement of the opening postmortem and milestone.</p>
        :!c.scaling?<button className="btn" disabled={onboarding||game.phase==="ended"} onClick={()=>act({type:"enter_scaling"})}>Continue to scaling and routing</button>
        :!c.scaling.consumed?<p>Database headroom: {num(c.dbCapacity)} / {num(P.dbCapacity)} ops/s. Growth waits for management and drained backlogs.</p>
        :!c.dataStage&&!available?<p>Data strategy requires completed scaling growth, management, drained backlogs and acknowledged reports.</p>
        :c.dataStage&&!c.dataStage.consumed?<p>Workload: Waiting for workload growth. Management, drained backlogs and acknowledged reports are required.</p>:null}
      {c.limit!==null&&<Callout compact tone="warn" icon="network" kicker="Traffic limit active">Incoming {num(c.snapshot.incoming)} / admitted {num(c.snapshot.admitted)} / rejected {num(c.snapshot.rejected)} req/s. Rejected demand earns no revenue; its opportunity value is not an extra charge.</Callout>}
    </details>
  </section>;
}

export function CampaignHeader() {
  const { game, openView } = useGame(), c = game.campaign!;
  const incident = game.phase === "incident";
  const atRisk = c.snapshot.latencyMs >= Q.latencyThresholdMs;
  const word = incident ? "Incident" : game.phase === "ended" ? "Bankrupt" : game.phase === "review" ? "Recovered" : atRisk ? "At risk" : c.limit!==null ? "Traffic limited" : "Healthy";
  const tone = incident || game.phase === "ended" ? "critical" : atRisk ? "warn" : "health";
  return <header className={`topbar${incident ? " is-incident" : ""}`}>
    <div className="brand"><span className="brand-mark">99.99%</span><div className="week">
      <span className="brand-week"><Icon name={incident ? "incident" : "week"} size={16} />
        Week <strong>{game.turn}</strong> · Step <strong data-testid="physical-step">{c.step}</strong>
      </span>
      <span className="campaign-stage" aria-label="Current campaign stage">{c.spikeStage?"Traffic Spikes & Autoscaling":c.dataStage?"Data Strategy":c.openingMilestone?.acknowledged?"Scaling & Routing":"Opening"}</span>
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
    <SoundButton />
    <button type="button" className="icon-btn menu-btn" aria-label="Menu" {...tipProps("Menu")} onClick={() => openView("menu")}><Icon name="menu" /></button>
  </header>;
}

export function CampaignPanel() {
  const { game, act, selected, selectedAppId } = useGame(), c = game.campaign!, m = c.snapshot;
  const incident = game.phase === "incident";
  const busy = c.pending.some(a => !["limit","unlimit","routing"].includes(a.type));
  const unlocked = !!c.openingMilestone?.acknowledged;
  const dbUpgrade=databaseUpgrade(c);
  const selectedApp = c.apps.find(a=>a.id===selectedAppId)??c.apps[0];
  const onboarding = useGame(s=>s.onboarding);
  const disabled = pendingSpikeAcknowledgement(c) || onboarding || !!(c.openingMilestone && !c.openingMilestone.acknowledged) || game.phase === "review" || game.phase === "ended";
  const admissionPending = c.pending.some(a => a.type === "limit" || a.type === "unlimit");
  const place = PLACES.find(id => id === selected && (id!=="cache"||c.dataStage));
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
        <p className="request-path" aria-label="Request dependencies">{c.dataStage?"Users → Servers → optional Read Cache → Database":"Users → Servers → Database"}</p>
        <div className="chips">{PLACES.filter(id=>id!=="cache"||c.dataStage).map(id => <button type="button" key={id} className={`chip${place === id ? " is-selected" : ""}`} aria-pressed={place === id} disabled={disabled} onClick={() => inspectOrSelect(id)}>
          <span className="chip-icon" aria-hidden="true"><Icon name={EQUIPMENT_ICON[id]} size={16} /></span>{PLACE_NAMES[id]}
        </button>)}</div>
        <button type="button" className="btn btn-small campaign-inspect" disabled={disabled} onClick={() => inspectOrSelect(place ?? "monitoring")}><Icon name="search" size={16} />Inspect metrics · free</button>
        {place && <div className="campaign-evidence" role="status"><Callout compact tone="info" icon={EQUIPMENT_ICON[place]} kicker={`${PLACE_NAMES[place]} · step ${m.step}`}>
          {component ? <>Demand {num(component.demand)}/s · capacity {num(component.capacity)}/s · backlog {num(component.backlog)}.</> : place === "cache" ? <>Cache {c.readCache?"deployed":"not deployed"} · effective rate used {m.data?`${m.data.effectiveHitRateUsed/100}%`:"not yet observed"} · hits {m.data?.hits??"not yet observed"}. Misses and writes reach the database.</> : place === "gateway" ? <>Incoming {num(m.incoming)}/s · admitted {num(m.admitted)}/s · rejected {num(m.rejected)}/s.</> : <>Latency {m.latencyMs.toFixed(0)} ms · errors {percent(m.serviceErrorRate)} · backlog {num(m.app.backlog + m.db.backlog)}.</>}
        </Callout></div>}
        {unlocked && <details className="more" open={selected==="app"}><summary>Application instances · {c.routing.mode} routing</summary>
          <section aria-label="Application instances"><p className="muted">Load balancer: {c.loadBalancer?"Deployed":"Not deployed"}. Receiving new traffic: {c.routing.targets.map(id=>id.replace("app-","App ")).join(", ")}.</p>
            <div className="instance-choices">{c.apps.map(a=>{const x=m.instances?.find(x=>x.id===a.id);return <button key={a.id} className={`chip${selected==="app"&&selectedAppId===a.id?" is-selected":""}`} aria-pressed={selected==="app"&&selectedAppId===a.id} {...tipProps(`Capacity ${a.capacity} req/s; backlog ${a.backlog}. ${a.routed?"Receiving traffic":"Installed - not receiving traffic"}`)} onClick={()=>inspectOrSelect("app",a.id)}>{a.id.replace("app-","App ")}: {a.routed?"Receiving traffic":"Installed - not receiving traffic"}{x&&<span>{x.demand}/{x.capacity} req/s · processed {x.processed} · backlog {x.backlog}</span>}</button>;})}</div>
            {c.apps.filter(a=>!a.routed).map(a=><p role="note" aria-label={`${a.id.replace("app-","App ")} routing status`} key={a.id}>Installed capacity does not receive traffic until routing includes this app.</p>)}
          </section></details>}
      </div>
      <h4 className="step-head"><span className="step-num" aria-hidden="true">2</span>Choose a response</h4>
      <ul className="actions">
        <li><Act label="Add server" price={Q.appCostCents / 100} note={`${Q.appDelay} steps`} disabled={disabled || busy || c.apps.length >= (c.spikeStage?T.maximum:Q.maxApps) || c.cashCents <= Q.appCostCents} tip="Adds installed application capacity. Without routing, a new server does not receive traffic." onClick={() => act({ type: "add_server" })} /></li>
        <li><Act label="Upgrade database" price={dbUpgrade?dbUpgrade.costCents/100:undefined} note={dbUpgrade?`${dbUpgrade.delay} steps · ${num(dbUpgrade.capacity)} ops/s`:"Current stage tier reached"} disabled={disabled || busy || !dbUpgrade || c.cashCents <= dbUpgrade.costCents} tip={dbUpgrade?"Increases database capacity after activation. Running costs also increase.":c.dataStage?"The database is at the highest available tier.":"Further database capacity unlocks after explicitly entering the next campaign stage."} onClick={() => act({ type: "start_db_upgrade" })} /></li>
        <li><Act label={c.limit === null ? "Limit to 500 requests/s" : "Remove traffic limit"} price={0} note={`${Q.admissionDelay} step`} disabled={disabled || admissionPending} tip="Changes admitted traffic at the next physical step. Rejected requests earn no revenue." onClick={() => act({ type: "set_traffic_limit", enabled: c.limit === null })} /></li>
      </ul>
      {unlocked && <section aria-label="Scaling controls" className="scaling-controls">
        <h4 className="step-head">Scale and route</h4>
        <ul className="actions">
          <li><Act label={`Scale up ${selectedApp.id.replace("app-","App ")}`} price={P.appCostCents/100} note={`${P.appDelay} steps`} disabled={disabled||busy||selectedApp.tier!=="base"||c.cashCents<=P.appCostCents} tip="Increases only the selected application's capacity. Database capacity stays unchanged." onClick={()=>act({type:"scale_up",appId:selectedApp.id})}/></li>
          <li><Act label="Deploy load balancing" price={P.lbCostCents/100} note={`${P.lbDelay} steps`} disabled={disabled||busy||c.loadBalancer||c.cashCents<=P.lbCostCents} tip="Installs a load balancer. Traffic changes only after you explicitly configure routing." onClick={()=>act({type:"deploy_load_balancer"})}/></li>
        </ul>
        <details className="more"><summary>Configure routing · {c.routing.mode}</summary>
        <fieldset disabled={disabled||!c.loadBalancer||c.pending.some(a=>a.type==="routing"||a.type==="retire-app")}><legend>Routing · activates next step</legend>
          <button className="btn btn-small" disabled={c.routing.mode==="balanced"&&c.routing.targets.length===c.apps.length} onClick={()=>act({type:"set_routing",mode:"balanced",targets:c.apps.map(a=>a.id)})}>Balance across installed apps</button>
          {c.apps.map(a=><button key={a.id} className="btn btn-small" disabled={c.routing.mode==="balanced"&&c.routing.targets.length===1&&c.routing.targets[0]===a.id} onClick={()=>act({type:"set_routing",mode:"balanced",targets:[a.id]})}>Balance to {a.id.replace("app-","App ")} only</button>)}
          <button className="btn btn-small" disabled={c.routing.mode==="single"} onClick={()=>act({type:"set_routing",mode:"single",targets:["app-1"]})}>Route only to App 1</button>
        </fieldset></details>
        <p className="muted">{c.scaling?.consumed?(c.dataStage?"Scaling growth recorded: 1,400 requests/s before data growth.":"Traffic growth applied: 1,400 requests/s."):c.dbCapacity<P.dbCapacity?"Next growth waits for a paid database upgrade to 2,000 ops/s.":c.incident||c.dbBacklog||c.apps.some(a=>a.backlog)?"Growth waits until the incident and backlogs clear.":c.scaling?.dueStep?`Growth due at step ${c.scaling.dueStep} while ready.`:"Growth readiness is checked on the next step."}</p>
      </section>}
      {c.dataStage&&<section aria-label="Data strategy" className="scaling-controls">
        <h4 className="step-head"><Icon name={EQUIPMENT_ICON.cache} size={16} />Data strategy</h4>
        <p>Workload: {c.dataStage.consumed?c.dataStage.profile:"Waiting for workload growth"}. {c.dataStage.dueStep!==null&&!c.dataStage.consumed?`Growth due at step ${c.dataStage.dueStep} while ready.`:""}</p>
        <p>Cache: {c.readCache?"Deployed":"Not deployed"} · next-work warmth {(c.readCache?.warmth??0)/100}% / target {(c.readCache?.target??0)/100}%.</p>
        {m.data?<Callout compact tone="info" icon={EQUIPMENT_ICON.cache} kicker={`Workload evidence · step ${m.step} · ${m.data.profile}`}>
          Reads {m.data.readShare/100}% / writes {(10000-m.data.readShare)/100}% · effective hit rate used {m.data.effectiveHitRateUsed/100}%. Hits {m.data.hits} · eligible misses {m.data.eligibleMisses}. DB demand {num(m.db.demand)} / {num(m.db.capacity)} ops/s · backlog {num(m.db.backlog)}.
        </Callout>:<p className="muted">No completed workload observation yet.</p>}
        <ul className="actions">
          <li><Act label="Deploy Read Cache" price={D.cacheCostCents/100} note={`${D.cacheDelay} steps`} disabled={disabled||busy||!!c.readCache||c.cashCents<=D.cacheCostCents} tip="Activates cold. Only eligible reads can hit; misses and writes still reach the database." onClick={()=>act({type:"deploy_cache"})}/></li>
          <li><Act label={`Tune cache ceiling to ${D.tunedTarget/100}%`} price={D.tuningCostCents/100} note={`${D.tuningDelay} steps`} disabled={disabled||busy||!c.readCache||c.readCache.tuned||c.cashCents<=D.tuningCostCents} tip="Raises only the hit-rate ceiling; preserves warmth, warm-up speed and upkeep. Requires a deployed, untuned cache." onClick={()=>act({type:"tune_cache"})}/></li>
        </ul>
        <details className="more"><summary>Detailed workload and cache evidence</summary>
          {m.data?<dl className="rows">
            <Row label="Logical operations" value={num(m.data.logical)}/><Row label="Reads / writes" value={`${m.data.reads} / ${m.data.writes}`}/>
            <Row label="Cacheable reads" value={`${m.data.cacheableReadShare/100}% · ${m.data.eligibleReads} operations`}/>
            <Row label="Non-cacheable reads" value={num(m.data.nonCacheableReads)}/><Row label="Warmth used / after work" value={`${m.data.warmthUsed/100}% / ${m.data.warmthAfterStep/100}%`}/>
            <Row label="DB read / write demand" value={`${m.data.databaseReadDemand} / ${m.data.databaseWriteDemand}`}/>
          </dl>:<p>Workload evidence is not yet available.</p>}
          <p>Misses, non-cacheable reads and writes reach DB. Cache reduces new demand and never erases old backlog. Latency estimates dependency queues.</p>
          <button className="btn" disabled={disabled||!c.dataStage.consumed||c.dataStage.contrastConsumed||!!c.spikeStage||!canEnterData(game)} onClick={()=>act({type:"contrast_workload"})}>Observe contrasting workload</button>
        </details>
      </section>}
      {c.pending.map(a => <div className="working campaign-working" role="status" key={a.id}>
        <span>{ACTION_NAMES[a.type]}{a.targetId ? ` (${a.targetId.replace("app-", "App ")})` : ""}: activates in {a.activationStep - c.step} step(s)</span>
        <Meter value={(c.step - a.requestedStep) / (a.activationStep - a.requestedStep)} label={`${ACTION_NAMES[a.type]} activation`} />
      </div>)}
      {c.apps.some(a=>!a.routed) && <p className="muted">{c.apps.filter(a=>!a.routed).map(a=>a.id.replace("app-","App ")).join(", ")}: Installed, not receiving traffic</p>}
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
        <Row label="Unsettled costs" value={dollars(Math.floor((c.ledger.appNumerator + c.ledger.dbNumerator + c.ledger.salaryNumerator + (c.ledger.lbNumerator??0) + (c.ledger.cacheNumerator??0) + (c.ledger.controllerNumerator??0)) / Q.periodSteps))} />
        <Row label="Next settlement" value={`Step ${(c.lastSettledPeriod + 1) * Q.periodSteps}`} />
        <Row label="Rejected this period" value={num(c.ledger.rejected)} />
        <Row label="Opportunity value" value={dollars(c.ledger.rejected * Q.revenueCents)} tip="Revenue forgone from rejected demand, not an extra cash charge." />
      </dl></details>
    </section>
    {c.spikeStage&&<SpikeControls disabled={disabled} busy={busy}/>}
    <CampaignGuidance />
  </aside>;
}

function SpikeControls({disabled,busy}:{disabled:boolean;busy:boolean}) {
 const {game,act}=useGame(),c=game.campaign!,d=c.spikeStage!,a=d.controller,o=c.snapshot.spikes;
 const pulse=spikeInput(c)===T.peak, next=d.deadlines.find(step=>step>c.step);
 return <section className="panel-section scaling-controls" aria-label="Traffic spikes and autoscaling">
  <h4 className="step-head"><Icon name="load" size={16}/>Traffic Spikes &amp; Autoscaling</h4>
  <Callout compact tone={pulse?"warn":"info"} icon="load" kicker={pulse?"TRAFFIC SPIKE ACTIVE":"Baseline demand"}>
   Incoming {num(c.snapshot.incoming)} req/s. {next!==undefined?`Next pulse boundary in ${next-c.step} steps (step ${next}).`:"Both pulses ended. Stable baseline service completes the stage."}
  </Callout>
  <p role="status">Controller: {a?(a.enabled?"Enabled":"Disabled"):"Not deployed"}. {a?.blockedReason??""}</p>
  <ul className="actions">
   <li><Act label="Unlock autoscaling" note="1 research point" disabled={disabled||!!d.researchSpent} tip="Spend the data-readiness point to unlock this capability. Deployment is a separate purchase." onClick={()=>act({type:"unlock_autoscaling"})}/></li>
   <li><Act label="Deploy autoscaling" price={T.controllerCostCents/100} note={`${T.controllerDelay} steps`} disabled={disabled||busy||!d.researchSpent||!!a||!c.loadBalancer||c.routing.mode!=="balanced"||c.routing.targets.length<2||c.cashCents<=T.controllerCostCents} tip="Requires balanced routing to at least two apps. Controller upkeep is $100 per operating week, including while disabled." onClick={()=>act({type:"deploy_autoscaler"})}/></li>
   {a&&<li><button className="btn" disabled={disabled} aria-pressed={a.enabled} onClick={()=>act({type:"set_autoscaling",enabled:!a.enabled})}>{a.enabled?"Disable autoscaling":"Enable autoscaling"}</button></li>}
  </ul>
  <details className="more"><summary>Controller evidence and costs</summary>
   <p>Research: {d.researchEarned-d.researchSpent} point available. Autoscaling {d.researchSpent?"unlocked":"locked"}. Normal demand {T.baseline}; spike demand {T.peak} req/s.</p>
   <p>Installed {c.apps.length} / maximum {T.maximum}; routed {c.routing.targets.length}. Automatic apps cost $1,000 setup and $700/week after installation. Controller upkeep: $100/week, including while disabled.</p>
   <p>Observed routed busy utilisation: {o?`${(o.routedBusyBasisPoints/100).toFixed(2)}%`:"No controller observation yet"}. High-utilization observations: {a?.highSteps??0} / 3; low-utilization observations: {a?.lowSteps??0} / 6.</p>
   <p>Scale out above 80% for 3 steps. Empty controller apps may retire below 60% for 6 safe steps; minimum 2. Cooldown remaining: {Math.max(0,(a?.cooldownUntil??0)-c.step)} steps.</p>
   <p>Automatic provisioning takes 3 steps, followed by 1 routing step. {a?.joiningAppId?`Joining ${a.joiningAppId.replace("app-","App ")}; installed capacity may still be unrouted.`:"No automatic app awaiting routing."}</p>
   <p>Application automation cannot increase DB capacity, cache effectiveness or admitted traffic. Manual investments and traffic limiting remain available.</p>
  </details>
 </section>;
}

export function CampaignControls() {
  const { game, view, running, setRunning, speed, setSpeed, advance, openView } = useGame();
  const active = useGame(s=>s.started && !s.onboarding) && !pendingSpikeAcknowledgement(game.campaign) && !(game.campaign!.openingMilestone && !game.campaign!.openingMilestone.acknowledged) && (game.phase === "management" || game.phase === "incident");
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
    <details className="more"><summary>Workload and cache evidence</summary>{report.snapshots.map(m=><p key={m.step}>Step {m.step}: {m.data?`${m.data.profile}; logical work ${m.data.logical}; hits ${m.data.hits}; eligible misses ${m.data.eligibleMisses}; writes ${m.data.writes}; non-cacheable reads ${m.data.nonCacheableReads}; used rate ${m.data.effectiveHitRateUsed/100}%; warmth used/after ${m.data.warmthUsed/100}%/${m.data.warmthAfterStep/100}%; target ${m.data.target/100}%; DB demand ${m.db.demand}/${m.db.capacity}; backlog ${m.db.backlog}`:"Workload detail not recorded in this historical snapshot"}</p>)}</details>
    <details className="more campaign-details"><summary>Recorded incident evidence</summary><table className="campaign-table"><caption>Recorded observations; older steps retain aggregate evidence.</caption><thead><tr><th>Step</th><th>Applications: demand/capacity · backlog</th><th>Routing</th><th>DB demand/capacity</th><th>DB backlog</th><th>Latency</th><th>Errors</th></tr></thead><tbody>{report.snapshots.map(m => <tr key={m.step}><td>{m.step}</td><td>{m.instances?m.instances.map(a=><div key={a.id}>{a.id.replace("app-","App ")}: {a.demand}/{a.capacity} · {a.backlog}</div>):`${m.app.demand}/${m.app.capacity} · ${m.app.backlog} (aggregate)`}</td><td>{m.routing?`${m.routing.mode}: ${m.routing.targets.map(id=>id.replace("app-","App ")).join(", ")}`:"Not recorded"}</td><td>{m.db.demand}/{m.db.capacity}</td><td>{m.db.backlog}</td><td>{m.latencyMs.toFixed(0)} ms</td><td>{percent(m.serviceErrorRate)}</td></tr>)}</tbody></table></details>
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
    <p className="muted">Play immediately as a guest. Progress stays in this browser until you explicitly attach it to an account.</p><AccountPanel />
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
  if(pendingSpikeAcknowledgement(c) && view!=="menu" && view!=="history") return <Modal title="Spike response handled" onClose={()=>openView("history")}><p>Both demand pulses ended and five baseline steps qualified for stable service. The same company continues with its investments and operating costs.</p><button className="btn btn-primary" onClick={()=>act({type:"acknowledge_spikes"})}>Continue operating</button></Modal>;
  if (game.phase === "ended" && view === null) return <Modal title="Company bankrupt" tone="alert" icon={{ kind: "critical", name: "cash" }} onClose={() => openView("menu")}>
    <Callout tone="critical" icon="cash" kicker="Company closed">Cash reached {dollars(c.cashCents)} after settlement at step {c.step}. Final metrics and history remain available.</Callout>
    <p>Last period revenue: {dollars(c.settlements.at(-1)?.revenueCents??0)}. Infrastructure: {dollars((c.settlements.at(-1)?.appCents??0)+(c.settlements.at(-1)?.dbCents??0))}. Salaries: {dollars(c.settlements.at(-1)?.salaryCents??0)}.</p>
    <p>Upfront investment: {dollars(c.investedCents)}. Rejected demand: {c.cumulative.rejected} requests (not an extra cash charge).</p>
    <div className="btn-row"><button className="btn" onClick={() => openView("history")}>View history</button><button className="btn" onClick={() => openView("menu")}>Export or start a new company</button></div>
  </Modal>;
  if (view === "menu") return <Modal title="Menu" icon={{ kind: "muted", name: "menu" }} onClose={closeMenu} className="modal-menu">
    <Callout tone="info" icon="pause" kicker="Time is paused">One step models one second of requests. Every 60 steps settles an operating week. Pausing freezes everything.</Callout>
    {saveBlocked && <Callout tone="warn" icon="save" kicker="Save preserved" live="alert">Your stored save is unreadable or unsupported and has been preserved. This run stays in memory until you explicitly reset.</Callout>}
    <section className="menu-section" aria-label="How to play"><h4><Icon name="info" size={16} />How to play</h4>
      <p>{nextMove(game).text} Click equipment in the room or the investigation controls to inspect it for free. Choose a response, then Run to observe the change. P pauses and Esc closes a view.</p>
    </section>
    <div className="menu-columns">
      <div className="menu-col">
        <section className="menu-section" aria-label="Company"><h4><Icon name="save" size={16} />Company</h4>
          <div className="menu-actions"><button type="button" className="btn" onClick={() => saveNow()}><Icon name="save" size={16} />Save now</button></div>
        </section>
        <SoundSettings />
        {/* The account panel names itself; the wrapper only gives it the menu's section spacing. */}
        <div className="menu-section menu-account"><AccountPanel /></div>
        <SaveFiles />
      </div>
      <div className="menu-col"><ModeSwitch to="classic" />
        <section className="menu-section menu-danger" aria-label="Start over"><h4><Icon name="refresh" size={16} />Start over</h4>
          <div className="menu-actions"><button type="button" className={`btn${confirmReset ? " btn-quiet" : ""}`} aria-expanded={confirmReset} onClick={() => setConfirmReset(true)}><Icon name="refresh" size={16} />New company</button></div>
          {confirmReset && <div className="menu-confirm"><p>This replaces only the current campaign save. Export it first if you want to keep it.</p>
            <div className="btn-row"><button type="button" className="btn btn-danger" onClick={() => { newRun(); setConfirmReset(false); }}>Confirm new company</button>
              <button type="button" className="btn btn-quiet" onClick={() => setConfirmReset(false)}>Cancel</button></div></div>}
        </section>
      </div>
    </div>
    <section className="menu-section" aria-label="Introduction and playtest records"><h4><Icon name="analytics" size={16} />Introduction and playtest records</h4>
      <div className="menu-actions menu-actions-row"><button type="button" className="btn" onClick={()=>useGame.getState().showOnboarding()}><Icon name="info" size={16} />Replay introduction</button>
      <button type="button" className="btn" onClick={()=>{useGame.getState().measureTime();const s=useGame.getState();download("playtest-session.json",exportPlaytest(s.game,s.measurement));}}><Icon name="download" size={16} />Export playtest record</button>
      <button type="button" className="btn" onClick={()=>useGame.getState().endSession()}><Icon name="pause" size={16} />Save and exit to title</button></div>
      <details className="more"><summary>Playtest observer notes</summary>
        <p>Session: {measurement.session?.id??"Not started"} · Build: {import.meta.env.VITE_BUILD_ID||"dev/unrecorded"}</p>
        <label>Participant source <select value={measurement.session?.source??"unspecified"} onChange={e=>useGame.getState().observer(e.target.value as "organic"|"recruited"|"unspecified")}><option value="unspecified">Unspecified</option><option value="recruited">Recruited</option><option value="organic">Organic</option></select></label>
        <label>Exact facilitator intervention <textarea value={intervention} onChange={e=>setIntervention(e.target.value)} /></label>
        <button className="btn" disabled={!intervention.trim()} onClick={()=>{useGame.getState().observer(measurement.session?.source??"unspecified",intervention);setIntervention("");}}>Record intervention</button>
      </details>
    </section>
  </Modal>;
  if (view === "history") return <Modal title="Campaign history" wide icon={{ kind: "users", name: "history" }} onClose={() => openView(null)}>
    <LineChart title="Latency" axisLabel="Step" series={[{ name: "Latency", color: "var(--c-health)", values: c.recent.map(m => m.latencyMs) }]} turns={c.recent.map(m => m.step)} format={v => `${v.toFixed(0)} ms`} />
    {c.reports.map(p => <Report key={p.id} report={p} />)}
    <details className="more"><summary>Financial settlements</summary>{c.settlements.map(p => <p key={p.period}>Week {p.period}: revenue {dollars(p.revenueCents)}, net {dollars(p.netCents)}</p>)}</details>
    <details className="more"><summary>Action and event history</summary>{c.trace.filter(e => e.type !== "metrics").map(e => <p key={e.id}>Step {e.step}: {e.type.replaceAll("-", " ")} {e.data.reason ? String(e.data.reason) : e.data.type ? ACTION_NAMES[e.data.type as Intervention] ?? String(e.data.type).replaceAll("-", " ") : ""}</p>)}</details>
  </Modal>;
  return null;
}
