import "./CampaignUX.css";
import { CampaignAction as Act } from "./CampaignAction";
import CampaignScorecard from "./CampaignScorecard";
import { canPromote, combinedProfile, currentFault, pendingCombined } from "@/sim/combinedCampaign";
import { pendingSpikeAcknowledgement, spikeInput } from "@/sim/autoscaling";
import { TRAFFIC_SPIKES as T } from "@/sim/scenarios/trafficSpikes";
import { DATA_STRATEGY as D } from "@/sim/scenarios/dataStrategy";
import { canEnterData, databaseUpgrade, pendingStop } from "@/sim/step";
import { pendingReliability, effectiveTargets, researchBalance } from "@/sim/reliability";
import { pendingPreventionReview } from "@/sim/openingPrevention";
import { APPLICATION_RELIABILITY as R } from "@/sim/scenarios/applicationReliability";
import { campaignGuidance, type Requirement } from "@/game/campaignGuidance";
import TechTree from "./TechTree";
import { AccountSection } from "./Account";
import { HomeScreen } from "./HomeScreen";
import { CampaignChapters } from "./CampaignChapters";
import { isChapterEntry } from "@/game/campaignChapters";
import { APPLICATION_SCALING as P } from "@/sim/scenarios/applicationScaling";
import { exportPlaytest } from "@/game/persist";
import { money, num } from "@/game/format";
import { useState } from "react";
import { inspectOrSelect, useGame, type Speed } from "@/game/store";
import { GraphicsSettings } from "./GraphicsSettings";
import { AvatarSettings } from "./AvatarPicker";
import { MenuTabs, type MenuTab } from "./MenuTabs";
import { MenuRun, MenuTile } from "./MenuRun";
import { SaveFiles } from "./SaveFiles";
import { SoundButton } from "./SoundButton";
import { SoundSettings } from "./SoundSettings";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
import type { Campaign, CampaignPostmortem, Intervention, ScheduledAction } from "@/sim/campaignTypes";
import { completedTechIds, TECH_ORDER, type EventKind, type GameState } from "@/sim";
import { AnalyticsSettings } from "./AnalyticsSettings";
import { FeedbackButton } from "./FeedbackButton";
import { Icon } from "./icons";
import { tipProps } from "./tips";
import { CHART_COLORS, EQUIPMENT_ICON } from "./presentation";
import { ModeSwitch } from "./ModeSwitch";
import { EventFeed, HistoryTabs, LineChart, type HistoryTab } from "./Views";
import { ViewSheet, ViewTabs } from "./ViewSheet";
import { Callout, Concept, Meter, Modal, Row, Stat, Tip } from "./ui";

const dollars = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(c / 100);
const percent = (v: number | null) => v === null ? "No completed requests" : (v * 100).toFixed(2) + "%";
const PLACES = ["gateway", "app", "cache", "db", "monitoring"] as const;
const PLACE_NAMES = { gateway: "Network", app: "App Server", db: "Database", monitoring: "Monitoring", cache: "Read Cache" };
const ACTION_NAMES: Record<Intervention, string> = {
  "add-app": "Add server", "upgrade-db": "Database upgrade", limit: "Traffic limit", unlimit: "Remove traffic limit", "scale-up":"Application scale up", "deploy-lb":"Load balancer deployment", routing:"Routing change", cache:"Read Cache deployment", "cache-tuning":"Cache tuning",
  "deploy-autoscaler":"Autoscaling controller deployment", "retire-app":"Safe application retirement", "health-checks":"Health Checks deployment", "create-spare":"Spare application install", "reserve-spare":"Reserve spare", "release-spare":"Release spare", failover:"Automatic Failover deployment", "promote-spare":"Promote spare", "restore-app":"Restore application", promotion:"Promotion",
};
const appName = (id: string) => `App ${id.slice(4)}`;
function stageName(g: GameState) {
  const c=g.campaign!;
  return c.combinedStage?"Grow the Company":c.reliabilityStage?"Stay Online":c.spikeStage?"Traffic Spikes & Autoscaling":c.dataStage?"Data Strategy":c.openingMilestone?.acknowledged?"Scaling & Routing":"Opening";
}
function RequirementList({items}:{items:Requirement[]}) {
  return <ul className="progression-requirements">{items.map(r=><li key={r.id} data-requirement={r.id} data-met={r.met}><Icon name={r.met?"check":"close"} size={12} /> {r.label}</li>)}</ul>;
}

// Progress is derived from the engine; reading this panel never advances the run.
function CampaignGuidance() {
  const {game,act}=useGame(),c=game.campaign!;
  const model=campaignGuidance(game),action=model.pendingAction;
  const objective=game.phase==="ended"?(game.outcome==="won"?"Inspect the final architecture and scorecard before starting another company.":"Review the company's finances and recorded evidence.")
    :game.phase==="review"?"Read the postmortem before continuing the same company."
    :c.incident?"Restore stable service while weighing cost and rejected demand."
    :c.combinedStage?"Grow the company while serving full demand, managing cost and reviewing each outcome."
    :c.reliabilityStage?"Keep stable service through an application failure, then review the evidence."
    :c.spikeStage?"Maintain service through changing demand while managing capacity cost."
    :c.dataStage?"Compare logical work, cache hits and database pressure as demand grows."
    :model.openingDone?"Prepare the system for the next growth wave."
    :model.prevention?"Handle the traffic increase without an incident: inspect the Application and Database, then keep service healthy at full demand."
    :"Observe demand and compare component evidence.";

  return <section className="campaign-guidance" aria-label="Guided Mode guidance">
    <Callout compact tone="info" icon="monitor" kicker={`Current stage: ${stageName(game)}`}>{objective}</Callout>
    {c.combinedStage&&model.waiting&&<p role="status">{model.waiting}</p>}
    {model.requirements.length>0&&<section className="campaign-requirements" aria-label="Guided Mode requirements"><details className="more"><summary>{c.combinedStage?"Next growth requirements":"Chapter requirements"} · {model.completed.length}/{model.requirements.length}</summary>
      <RequirementList items={c.combinedStage?model.incomplete:model.requirements}/>
      {!c.combinedStage&&model.waiting&&<p role="status">{model.waiting}</p>}
      {model.notice&&<p role="note">{model.notice}</p>}
      {model.optional&&<p className="muted">{model.optional}</p>}
    </details></section>}
    {action?.action&&!isChapterEntry(action.action)&&<button className="btn btn-primary" disabled={game.phase==="ended"} onClick={()=>act(action.action!)}>{action.label}<Icon name="next" /></button>}
    {action&&!action.action&&<button className="btn btn-primary" onClick={()=>useGame.getState().openView(null)}>{action.label}<Icon name="next" /></button>}
    {c.openingMilestone?.acknowledged&&!c.dataStage&&!c.scaling?.consumed&&!c.scalingConsent&&<ScalingRiskConsent/>}
    {c.scorecard&&<button className="btn" onClick={()=>useGame.getState().openView("scorecard")}>View run scorecard</button>}
    {model.prevention&&!c.openingPrevention?.outcome&&<section className="prevention-guidance" aria-label="Opening prevention progress">
      <p role="status">Stable service: {c.openingPrevention?.stableSteps??0} / {Q.stableSteps} steps. Pausing adds no time; unhealthy service restarts the counter.</p>
      <div className="btn-row"><button className="btn btn-small" onClick={()=>inspectOrSelect("app","app-1")}>Inspect Application</button><button className="btn btn-small" onClick={()=>inspectOrSelect("db")}>Inspect Database</button></div>
    </section>}

  </section>;
}

export function CampaignHeader() {
  const { game, openView, started } = useGame(), c = game.campaign!;
  const incident = game.phase === "incident";
  const atRisk = c.snapshot.latencyMs >= Q.latencyThresholdMs;
  const word = incident ? "Incident" : game.phase === "ended" ? game.outcome === "won" ? "Campaign complete" : "Bankrupt" : game.phase === "review" ? "Recovered" : atRisk ? "At risk" : c.limit!==null ? "Traffic limited" : "Healthy";
  const tone = incident || (game.phase === "ended" && game.outcome !== "won") ? "critical" : atRisk ? "warn" : "health";
  return <><header className={`topbar${incident ? " is-incident" : ""}`}>
    <div className="brand"><span className="brand-mark">99.99%</span>
    </div>
    <div className="stats-strip">
      <Stat icon="cash" kind="cash" label="Cash" tip={`Available cash: ${dollars(c.cashCents)}. Revenue and running costs settle every ${Q.periodSteps} steps. Setup costs are paid immediately.`}>
        <strong className={c.cashCents <= 0 ? "text-critical" : ""}>{money(c.cashCents / 100)}</strong>
      </Stat>
      <Stat icon="users" kind="users" label="Users" tip="Registered users and incoming requests are different. Inspect incoming req/s to see current demand.">
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
  </header>{started && <CampaignChapters />}</>;
}

export function CampaignPanel() {
  const { game, act, selected, selectedAppId } = useGame(), c = game.campaign!, m = c.snapshot;
  const incident = game.phase === "incident";
  const busy = c.pending.some(a => !["limit","unlimit","routing"].includes(a.type));
  const unlocked = !!c.openingMilestone?.acknowledged;
  const dbUpgrade=databaseUpgrade(c);
  const selectedApp = c.apps.find(a=>a.id===selectedAppId)??c.apps[0];
  const recipients = c.reliabilityStage ? effectiveTargets(c) : c.routing.targets;
  const disabled = pendingStop(c) !== null || !!(c.openingMilestone && !c.openingMilestone.acknowledged) || game.phase === "review" || game.phase === "ended";
  const admissionPending = c.pending.some(a => a.type === "limit" || a.type === "unlimit");
  const place = PLACES.find(id => id === selected && (id!=="cache"||c.dataStage));
  const component = place === "app" ? m.app : place === "db" ? m.db : null;
  return <aside className="side campaign-panel" aria-label="System metrics">
    <section className={`panel-section${incident ? " incident" : ""}`} aria-label={incident ? "Incident" : "System overview"}>
      <header className="panel-head">
        <span className={`panel-icon${incident ? " state-critical" : ""}`}><Icon name={incident ? "incident" : "monitor"} /></span>
        <div><h2>{incident ? "Service slowdown" : "System overview"}</h2>
          {incident && <span className="state state-critical"><Icon name="alert" size={12} />Incident</span>}
        </div>
      </header>
      {!incident && <CampaignGuidance />}
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
        <h4 className="step-head"><span className="step-num" aria-hidden="true">1</span><Tip text="Click equipment in the room or here. Inspection is free, immediate and repeatable; it never advances time.">System evidence</Tip></h4>
        <div className="chips">{PLACES.filter(id=>id!=="cache"||c.dataStage).map(id => <button type="button" key={id} className={`chip${place === id ? " is-selected" : ""}`} aria-pressed={place === id} disabled={disabled} onClick={() => inspectOrSelect(id)}>
          <span className="chip-icon" aria-hidden="true"><Icon name={EQUIPMENT_ICON[id]} size={16} /></span>{PLACE_NAMES[id]}
        </button>)}</div>
        {place && <div className="campaign-evidence" role="status"><Callout compact tone="info" icon={EQUIPMENT_ICON[place]} kicker={`${PLACE_NAMES[place]} · step ${m.step}`}>
          {component ? <>Demand {num(component.demand)}/s · capacity {num(component.capacity)}/s · backlog {num(component.backlog)}.</> : place === "cache" ? <>Cache {c.readCache?"deployed":"not deployed"} · effective rate used {m.data?`${m.data.effectiveHitRateUsed/100}%`:"not yet observed"} · hits {m.data?.hits??"not yet observed"}. Misses and writes reach the database.</> : place === "gateway" ? <>Incoming {num(m.incoming)}/s · admitted {num(m.admitted)}/s · rejected {num(m.rejected)}/s.</> : <>Latency {m.latencyMs.toFixed(0)} ms · errors {percent(m.serviceErrorRate)} · backlog {num(m.app.backlog + m.db.backlog)}.</>}
        </Callout></div>}
        {unlocked && <details className="more" open={selected==="app"}><summary>Application instances · {c.routing.mode} routing</summary>
          <section aria-label="Application instances"><p className="muted">Load balancer: {c.loadBalancer?"Deployed":"Not deployed"}. Receiving new traffic: {recipients.map(appName).join(", ") || "None"}.</p>
            <div className="instance-choices">{c.apps.map(a=>{const x=m.instances?.find(x=>x.id===a.id),receiving=recipients.includes(a.id);return <button key={a.id} className={`chip${selected==="app"&&selectedAppId===a.id?" is-selected":""}`} aria-pressed={selected==="app"&&selectedAppId===a.id} {...tipProps(`Capacity ${a.capacity} req/s; backlog ${a.backlog}. ${receiving?"Receiving traffic":"Installed - not receiving traffic"}`)} onClick={()=>inspectOrSelect("app",a.id)}>{appName(a.id)}: {receiving?"Receiving traffic":"Installed - not receiving traffic"}{x&&<span>{x.demand}/{x.capacity} req/s · processed {x.processed} · backlog {x.backlog}</span>}</button>;})}</div>
            {c.apps.filter(a=>!a.routed).map(a=><p role="note" aria-label={`${appName(a.id)} routing status`} key={a.id}>Installed capacity does not receive traffic until routing includes this app.</p>)}
          </section></details>}
      </div>
      <h4 className="step-head"><span className="step-num" aria-hidden="true">2</span>Actions</h4>
      <ul className="actions">
        <li><Act label="Add server" price={Q.appCostCents / 100} note={`${Q.appDelay} steps`} disabled={disabled || busy || c.apps.length >= (c.spikeStage ? T.maximum : Q.maxApps) || c.cashCents <= Q.appCostCents} tip="Adds installed application capacity. Without routing, a new server does not receive traffic." onClick={() => act({ type: "add_server" })} /></li>
        <li><Act label="Upgrade database" price={dbUpgrade?dbUpgrade.costCents/100:undefined} note={dbUpgrade?`${dbUpgrade.delay} steps · ${num(dbUpgrade.capacity)} ops/s`:"Current stage tier reached"} disabled={disabled || busy || !dbUpgrade || c.cashCents <= dbUpgrade.costCents} tip={dbUpgrade?"Increases database capacity after activation. Running costs also increase.":c.dataStage?"The database is at the highest available tier.":"Further database capacity unlocks after explicitly entering the next Guided Mode stage."} onClick={() => act({ type: "start_db_upgrade" })} /></li>
        <li><Act label={c.limit === null ? "Limit to 500 requests/s" : "Remove traffic limit"} price={0} note={`${Q.admissionDelay} step`} disabled={disabled || admissionPending} tip="Changes admitted traffic at the next physical step. Rejected requests earn no revenue." onClick={() => act({ type: "set_traffic_limit", enabled: c.limit === null })} /></li>
      </ul>
      {c.reliabilityStage&&<ReliabilityControls disabled={disabled} busy={c.pending.some(a=>!["limit","unlimit","routing","promote-spare"].includes(a.type))} />}
      {unlocked && <section aria-label="Scaling controls" className="scaling-controls">
        <h4 className="step-head">Scale and route</h4>
        <ul className="actions">
          <li><Act label={`Scale up ${appName(selectedApp.id)}`} price={P.appCostCents/100} note={`${P.appDelay} steps`} disabled={disabled||busy||selectedApp.tier!=="base"||c.cashCents<=P.appCostCents} tip="Increases only the selected application's capacity. Database capacity stays unchanged." onClick={()=>act({type:"scale_up",appId:selectedApp.id})}/></li>
          <li><Act label="Deploy load balancing" price={P.lbCostCents/100} note={`${P.lbDelay} steps`} disabled={disabled||busy||c.loadBalancer||c.cashCents<=P.lbCostCents} tip="Installs a load balancer. Traffic changes only after you explicitly configure routing." onClick={()=>act({type:"deploy_load_balancer"})}/></li>
        </ul>
        <details className="more"><summary>Configure routing · {c.routing.mode}</summary>
        <fieldset disabled={disabled||!c.loadBalancer||c.pending.some(a=>a.type==="routing"||a.type==="retire-app")}><legend>Routing · activates next step</legend>
          <button className="btn btn-small" disabled={c.routing.mode==="balanced"&&c.routing.targets.length===c.apps.length} onClick={()=>act({type:"set_routing",mode:"balanced",targets:c.apps.map(a=>a.id)})}>Balance across installed apps</button>
          {c.apps.map(a=><button key={a.id} className="btn btn-small" disabled={c.routing.mode==="balanced"&&c.routing.targets.length===1&&c.routing.targets[0]===a.id} onClick={()=>act({type:"set_routing",mode:"balanced",targets:[a.id]})}>Balance to {appName(a.id)} only</button>)}
          <button className="btn btn-small" disabled={c.routing.mode==="single"} onClick={()=>act({type:"set_routing",mode:"single",targets:["app-1"]})}>Route only to App 1</button>
        </fieldset>{!c.loadBalancer&&<p role="note">Deploy load balancing before configuring routing.</p>}{c.pending.some(a=>a.type==="routing"||a.type==="retire-app")&&<p role="note">A routing or retirement change is pending; wait for activation.</p>}</details>
        <p className="muted">{c.scaling?.consumed?(c.dataStage?"Scaling growth recorded: 1,400 requests/s before data growth.":"Traffic growth applied: 1,400 requests/s."):c.dbCapacity<P.dbCapacity&&!c.scalingConsent?"Next growth waits for a paid database upgrade to 2,000 ops/s.":c.incident||c.dbBacklog||c.apps.some(a=>a.backlog)?"Growth waits until the incident and backlogs clear.":c.scaling?.dueStep?`Growth due at step ${c.scaling.dueStep} while ready.`:"Growth readiness is checked on the next step."}</p>
      </section>}
      {c.dataStage&&<section aria-label="Data strategy" className="scaling-controls">
        <h4 className="step-head"><Icon name={EQUIPMENT_ICON.cache} size={16} />Data strategy</h4>
        <p>Workload: {c.dataStage.consumed?(c.combinedStage?combinedProfile(c):c.dataStage.profile):"Waiting for workload growth"}. {c.dataStage.dueStep!==null&&!c.dataStage.consumed?`Growth due at step ${c.dataStage.dueStep} while ready.`:""}</p>
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
      {c.combinedStage&&<CombinedControls disabled={disabled}/>}
      {c.pending.map(a => <div className="working campaign-working" role="status" key={a.id}>
        <span>{ACTION_NAMES[a.type]}{a.targetId?` (${appName(a.targetId)})`:""}: activates in {a.activationStep - c.step} step(s)</span>
        <Meter value={(c.step - a.requestedStep) / (a.activationStep - a.requestedStep)} label={`${ACTION_NAMES[a.type]} activation`} />
      </div>)}
      {incident && <CampaignGuidance />}
      {c.apps.some(a=>!a.routed) && <p className="muted">{c.apps.filter(a=>!a.routed).map(a=>appName(a.id)).join(", ")}: Installed, not receiving traffic</p>}
      <details className="more campaign-details"><summary>Full system evidence</summary>
        <p>Incoming <b>{m.incoming}</b> / admitted <b>{m.admitted}</b> / rejected <b>{m.rejected}</b> requests/s</p>
        <table className="campaign-table"><caption>Component evidence, step {m.step}</caption><thead><tr><th>Metric</th><th>App Server</th><th>Database</th></tr></thead>
          <tbody>{[["Demand /s", m.app.demand, m.db.demand], ["Capacity /s", m.app.capacity, m.db.capacity], ["Demand/capacity", percent(m.app.demandRatio), percent(m.db.demandRatio)], ["Busy", percent(m.app.busyUtilisation), percent(m.db.busyUtilisation)], ["Backlog", m.app.backlog, m.db.backlog], ["Processed", m.app.processed, m.db.processed], ["Failed", m.app.failed, m.db.failed]].map(([label, a, b]) => <tr key={label}><th scope="row">{label}</th><td>{a}</td><td>{b}</td></tr>)}</tbody></table>
        <dl className="rows"><Row label="Installed server capacity" value={`${num(m.installedAppCapacity)} req/s`} /><Row label="Routed capacity" value={`${num(m.app.capacity)} req/s`} /><Row label="Latency" value={`${m.latencyMs.toFixed(0)} ms`} /><Row label="Service errors" value={percent(m.serviceErrorRate)} /></dl>
        <p className="muted">Busy is the share of capacity doing work. Demand/capacity also shows demand above capacity. Installed servers only help when traffic is routed to them.</p>
      </details>
      {c.limit!==null&&<Callout compact tone="warn" icon="network" kicker="Traffic limit active">{num(m.admitted)} admitted / {num(m.rejected)} rejected req/s. Rejected requests earn no revenue. <strong>Infrastructure and salaries still cost the same.</strong></Callout>}
    </section>
    {c.spikeStage&&<SpikeControls disabled={disabled} busy={busy}/>}
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
   <li><Act label="Unlock autoscaling" note="1 research point" noteIcon="bulb" disabled={disabled||!!d.researchSpent} tip="Spend the data-readiness point to unlock this capability. Deployment is a separate purchase." onClick={()=>act({type:"unlock_autoscaling"})}/></li>
   <li><Act label="Deploy autoscaling" price={T.controllerCostCents/100} note={`${T.controllerDelay} steps`} disabled={disabled||busy||!d.researchSpent||!!a||!c.loadBalancer||c.routing.mode!=="balanced"||c.routing.targets.length<2||c.cashCents<=T.controllerCostCents} tip="Requires balanced routing to at least two apps. Controller upkeep is $100 per operating week, including while disabled." onClick={()=>act({type:"deploy_autoscaler"})}/></li>
   {a&&<li><button className="btn" disabled={disabled} aria-pressed={a.enabled} onClick={()=>act({type:"set_autoscaling",enabled:!a.enabled})}>{a.enabled?"Disable autoscaling":"Enable autoscaling"}</button></li>}
  </ul>
  <details className="more"><summary>Controller evidence and costs</summary>
   <p>Research: {researchBalance(c)} point(s) available. Autoscaling {d.researchSpent?"unlocked":"locked"}. Normal demand {T.baseline}; spike demand {T.peak} req/s.</p>
   <p>Installed {c.apps.length} / maximum {T.maximum}; routed {c.routing.targets.length}. Automatic apps cost $1,000 setup and $700/week after installation. Controller upkeep: $100/week, including while disabled.</p>
   <p>Observed routed busy utilisation: {o?`${(o.routedBusyBasisPoints/100).toFixed(2)}%`:"No controller observation yet"}. High-utilization observations: {a?.highSteps??0} / 3; low-utilization observations: {a?.lowSteps??0} / 6.</p>
   <p>Scale out above 80% for 3 steps. Empty controller apps may retire below 60% for 6 safe steps; minimum 2. Cooldown remaining: {Math.max(0,(a?.cooldownUntil??0)-c.step)} steps.</p>
   <p>Automatic provisioning takes 3 steps, followed by 1 routing step. {a?.joiningAppId?`Joining ${a.joiningAppId.replace("app-","App ")}; installed capacity may still be unrouted.`:"No automatic app awaiting routing."}</p>
   <p>Application automation cannot increase DB capacity, cache effectiveness or admitted traffic. Manual investments and traffic limiting remain available.</p>
  </details>
 </section>;
}

export function CampaignControls() {
  const { game, running, setRunning, speed, setSpeed, advance } = useGame();
  const active = useGame(s=>s.started) && pendingStop(game.campaign) === null && !(game.campaign!.openingMilestone && !game.campaign!.openingMilestone.acknowledged) && (game.phase === "management" || game.phase === "incident");
  return <footer className={`bottombar campaign-clock${running?" is-running":" is-paused"}`}>
    <ViewTabs tabs={[
      { id: "tech", label: "Tech", icon: "tree", badge: `${completedTechIds(game).length}/${TECH_ORDER.length}` },
      { id: "history", label: "History", icon: "history", badge: game.campaign!.reports.length > 0 ? String(game.campaign!.reports.length) : null },
    ]} />
    <div className="time-controls">
      <div className={`week${game.phase === "incident" ? " is-incident" : ""}`}><span className="brand-week"><Icon name={game.phase === "incident" ? "incident" : "week"} size={16} />
        Week <strong>{game.turn}</strong> · Step <strong data-testid="physical-step">{game.campaign!.step}</strong>
      </span></div>
      <button type="button" className={`btn btn-primary campaign-play${running ? " is-on" : ""}`} aria-label={running ? "Pause" : "Run"} {...tipProps("Run or pause physical steps (P)")} disabled={!active} onClick={() => setRunning(!running)}><Icon name={running ? "pause" : "play"} /><span>{running?"Pause company":"Run company"}</span></button>
      <div className="speed" role="group" aria-label="Game speed">{([.5, 1, 2] as Speed[]).map(v => <button type="button" key={v} className={speed === v ? "is-active" : ""} aria-pressed={speed === v} onClick={() => setSpeed(v)} {...tipProps(`${v}× speed`)}>{v}×</button>)}</div>
      <span className="campaign-clock-state" role="status">{running?"Running":"Paused"}</span><details className="campaign-advanced"><summary>More controls</summary><div><p>Optional: advance exactly one modeled second. During an incident, use Run/Pause.</p><button type="button" className="btn btn-quiet advance campaign-step" aria-description="Optional precision control. One step is one modeled second; use Run company for continuous play." disabled={!active || game.phase !== "management"} onClick={advance} {...tipProps("Advance one physical step. One step models one second of requests; 60 steps settle an operating week.")}><span className="advance-label">{game.phase === "incident" ? "Incident" : game.phase === "ended" ? "Company closed" : game.phase === "review" ? "Review" : "Advance step"}</span><Icon name="next" /></button></div></details>
    </div>
  </footer>;
}

function Report({ report, meta = true }: { report: CampaignPostmortem; meta?: boolean }) {
  return <div>
    {meta && <p className="pm-meta"><span className="tag tag-ok"><Icon name="check" size={12} />Recovered{report.limited ? " under traffic limit" : " at full demand"}</span><span className="muted">Steps {report.openedStep}–{report.recoveredStep}</span></p>}
    <dl className="rows"><Row label="Setup spending" value={dollars(report.setupCents)} /></dl>
    <h3>What happened and what changed</h3><div className="pm-lines">{report.explanations.slice(0,1).map((text, i) => <Callout compact key={i} tone="info" icon="search" kicker="Recorded evidence">
      {text.replace(/\b\d+\.\d{3,}\b/g, value => Number(value).toFixed(2))}
    </Callout>)}</div>
    <details className="more"><summary>Causes, actions and trade-offs</summary>{report.explanations.slice(1).map((text,i)=><p key={i}>{text.replace(/\b\d+\.\d{3,}\b/g,value=>Number(value).toFixed(2))}</p>)}</details>
    <details className="more"><summary>Workload and cache evidence</summary>{report.snapshots.map(m=><p key={m.step}>Step {m.step}: {m.data?`${m.data.profile}; logical work ${m.data.logical}; hits ${m.data.hits}; eligible misses ${m.data.eligibleMisses}; writes ${m.data.writes}; non-cacheable reads ${m.data.nonCacheableReads}; used rate ${m.data.effectiveHitRateUsed/100}%; warmth used/after ${m.data.warmthUsed/100}%/${m.data.warmthAfterStep/100}%; target ${m.data.target/100}%; DB demand ${m.db.demand}/${m.db.capacity}; backlog ${m.db.backlog}`:"Workload detail not recorded in this historical snapshot"}</p>)}</details>
    <details className="more campaign-details"><summary>Recorded incident evidence</summary><table className="campaign-table"><caption>Recorded observations; older steps retain aggregate evidence.</caption><thead><tr><th>Step</th><th>Applications: demand/capacity · backlog</th><th>Routing</th><th>DB demand/capacity</th><th>DB backlog</th><th>Latency</th><th>Errors</th></tr></thead><tbody>{report.snapshots.map(m => <tr key={m.step}><td>{m.step}</td><td>{m.instances?m.instances.map(a=><div key={a.id}>{appName(a.id)}: {a.demand}/{a.capacity} · {a.backlog}</div>):`${m.app.demand}/${m.app.capacity} · ${m.app.backlog} (aggregate)`}</td><td>{m.routing?`${m.routing.mode}: ${m.routing.targets.map(appName).join(", ")}`:"Not recorded"}</td><td>{m.db.demand}/{m.db.capacity}</td><td>{m.db.backlog}</td><td>{m.latencyMs.toFixed(0)} ms</td><td>{percent(m.serviceErrorRate)}</td></tr>)}</tbody></table></details>
  </div>;
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
/** The campaign menu: the same run card, Resume, tabs and tiles as Classic's, with the company's own actions. */
function CampaignMenu({ initialTab }: { initialTab: MenuTab }) {
  const { game, openView, newRun, saveNow, saveBlocked, measurement } = useGame();
  const c = game.campaign!;
  const [tab, setTab] = useState<MenuTab>(initialTab);
  const [confirmReset, setConfirmReset] = useState(false);
  const [intervention, setIntervention] = useState("");
  const close = () => openView(null);
  // A confirmation belongs to the control that asked for it, so it does not wait on another tab.
  const goTo = (next: MenuTab) => {
    setConfirmReset(false);
    setTab(next);
  };
  // As in Classic, the first press only asks and the second, on the now red button, replaces the company.
  const reset = () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    newRun(); setConfirmReset(false);
  };
  return <Modal title="Menu" icon={{ kind: "go", name: "menu" }} onClose={close} className="modal-menu">
    <MenuRun title="This company" saved={!saveBlocked} onResume={close}
      stats={[
        { icon: "week", kind: "go", label: "Week · step", value: `${game.turn} · ${c.step}` },
        { icon: "users", kind: "users", label: "Users", value: num(game.users) },
        { icon: "cash", kind: "cash", label: "Cash", value: money(c.cashCents / 100) },
      ]}
      note={<><strong>Time is paused.</strong> One step models one second of requests; every 60 steps settles an operating week.</>} />
    {(c.scorecard||c.combinedStage?.finalReview)&&<button className="btn" onClick={()=>openView("scorecard")}>View run scorecard</button>}
    {saveBlocked && <Callout tone="warn" icon="save" kicker="Save preserved" live="alert">Your stored save is unreadable or unsupported and has been preserved. This run stays in memory until you explicitly reset.</Callout>}
    <MenuTabs value={tab} onChange={goTo}>
      {tab === "run" && <>
        <div className="menu-grid" role="group" aria-label="Run">
          <MenuTile icon="save" kind="ok" title="Save now" text="Write this company to the browser." onClick={() => saveNow()} />
          <MenuTile icon="info" kind="users" title="How to play" text="Replay the guided tour of your company." onClick={() => useGame.getState().startTour("campaign")} />
          <MenuTile icon="pause" kind="go" title="Save and exit" text="Stop here and return to the title screen." onClick={() => useGame.getState().endSession()} />
        </div>
        <ModeSwitch to="classic" />
      </>}
      {tab === "sound" && <SoundSettings />}
      {tab === "graphics" && <GraphicsSettings />}
      {tab === "avatar" && <AvatarSettings />}
      {tab === "saves" && <div className="menu-columns">
        <div className="menu-col"><SaveFiles /></div>
        <div className="menu-col">
          <AccountSection />
          <section className="menu-section menu-danger" aria-label="Start over"><h4><Icon name="refresh" size={20} />Start over</h4>
            <div className="menu-actions"><button type="button" className={`btn${confirmReset ? " btn-danger" : ""}`} onClick={reset}><Icon name="refresh" size={20} />{confirmReset ? "Lose this company? Press again" : "New company"}</button></div>
            {confirmReset && <Callout compact tone="warn" icon="alert" kicker="Are you sure?">This replaces only the current Guided Mode save. Export it first if you want to keep it. Press the red button again to confirm.</Callout>}
          </section>
        </div>
      </div>}
      {tab === "playtest" && <><AnalyticsSettings /><section className="menu-section" aria-label="Playtest records"><h4><Icon name="analytics" size={20} />Playtest records</h4>
        <FeedbackButton inline />
        <div className="menu-actions"><button type="button" className="btn" onClick={()=>{useGame.getState().measureTime();const s=useGame.getState();download("playtest-session.json",exportPlaytest(s.game,s.measurement));}}><Icon name="download" size={20} />Export playtest record</button></div>
        <details className="more"><summary>Playtest observer notes</summary>
          <p>Session: {measurement.session?.id??"Not started"} · Build: {import.meta.env.VITE_BUILD_ID||"dev/unrecorded"}</p>
          <label>Participant source <select value={measurement.session?.source??"unspecified"} onChange={e=>useGame.getState().observer(e.target.value as "organic"|"recruited"|"unspecified")}><option value="unspecified">Unspecified</option><option value="recruited">Recruited</option><option value="organic">Organic</option></select></label>
          <label>Exact facilitator intervention <textarea value={intervention} onChange={e=>setIntervention(e.target.value)} /></label>
          <button className="btn" disabled={!intervention.trim()} onClick={()=>{useGame.getState().observer(measurement.session?.source??"unspecified",intervention);setIntervention("");}}>Record intervention</button>
        </details>
      </section></>}
    </MenuTabs>
  </Modal>;
}
export function CampaignOverlays() {
  const { started, view } = useGame();
  if (!started) return <HomeScreen />;
  // Tech and History open over the room from the bottom bar, as in Classic; dialogs that need an answer sit above them.
  return <>
    {view === "tech" && <ViewSheet view="tech"><p className="campaign-tech-intro"><Icon name="tree" size={16} /> Technologies are capabilities. Select an icon to see its effect. <strong>Owned does not mean deployed.</strong> Deployments and their running costs appear in Actions.</p><TechTree /></ViewSheet>}
    {view === "history" && <ViewSheet view="history"><CampaignHistory /></ViewSheet>}
    <CampaignDialog />
  </>;
}

/** The one dialog that currently needs the player, if any. */
function CampaignDialog() {
  const { game, view, openView, act } = useGame();
  const c = game.campaign!;
  if(view==="scorecard"&&(c.scorecard||c.combinedStage?.finalReview))return <Modal title="Company scorecard" onClose={()=>openView("guidance")}><CampaignScorecard card={(c.scorecard??c.combinedStage!.finalReview)!} pendingReview={!c.scorecard}/></Modal>;
  if(pendingCombined(c)&&!["guidance","menu","history"].includes(view??"")){const d=c.combinedStage!,r=d.currentRound;return <Modal title={d.finalReview?"Final campaign review":"Growth outcome"} onClose={()=>openView("guidance")}>{d.finalReview?<><CampaignScorecard card={d.finalReview} pendingReview/><button className="btn btn-primary" onClick={()=>act({type:"complete_campaign"})}>Complete campaign</button></>:<><h3>What happened</h3><p>{r!.scenario.template}: registered users reached {r!.users.toLocaleString("en-US")}. Temporary pressure has ended.</p><h3>What the evidence showed</h3><p>All applications restored; five stable full-demand baseline steps; actual incident reports acknowledged.</p><h3>Trade-offs</h3><p>Rejected requests during this round: {c.cumulative.rejected-r!.rejectedBefore}; setup spending {dollars(c.investedCents-r!.setupBefore)}. Review actual actions and causal reports in History.</p><button className="btn btn-primary" onClick={()=>act({type:"acknowledge_growth"})}>Continue company</button></>}</Modal>;}
  if (pendingReliability(c)) return <Modal title="Reliability outcome" icon={{ kind: "ok", name: "health" }}>
    <ReliabilityOutcome campaign={c} />
    <ContinueFoot label="Continue operating" onClick={()=>act({type:"acknowledge_reliability"})} />
  </Modal>;
  if (pendingPreventionReview(c)) return <Modal title="Prevention review" wide icon={{ kind: "ok", name: "health" }}><PreventionOutcome campaign={c} /><ContinueFoot label="Continue company" onClick={()=>act({type:"acknowledge_prevention_review"})} /></Modal>;
  if (game.phase === "review") return <Modal title="Incident postmortem" wide icon={{ kind: "ok", name: "incident" }}><Report report={c.reports[c.reports.length - 1]} /><ContinueFoot label="Continue company" onClick={() => act({ type: "acknowledge_review" })} /></Modal>;
  if(c.openingMilestone&&!c.openingMilestone.acknowledged)return <Modal title="First growth challenge handled" icon={{ kind: "go", name: "goal" }}>
    <p>{c.openingMilestone.outcomeId?"You handled Opening growth without an incident.":"You recovered your first production incident."} Your company is still operating. Your architecture, cash and pending work are preserved.</p>
    <p>{c.limit!==null?"The traffic limit remains active: rejected demand still has a revenue trade-off.":"Your company is serving its current demand."} Next: application scaling and routing.</p>
    <ContinueFoot label="Continue operating" onClick={()=>act({type:"acknowledge_milestone"})} />
  </Modal>;
  if(pendingSpikeAcknowledgement(c) && view!=="menu" && view!=="history") return <Modal title="Spike response handled" icon={{ kind: "go", name: "goal" }} onClose={()=>openView("history")}><p>Both demand pulses ended and five baseline steps qualified for stable service. The same company continues with its investments and operating costs.</p><ContinueFoot label="Continue operating" onClick={()=>act({type:"acknowledge_spikes"})} /></Modal>;
  if(game.phase==="ended"&&game.outcome==="won"&&!["guidance","menu","history","tech"].includes(view??""))return <Modal title="Campaign complete" onClose={()=>openView("guidance")}><CampaignScorecard card={c.scorecard!}/><button className="btn" onClick={()=>openView("guidance")}>Inspect final company</button><button className="btn" onClick={()=>openView("menu")}>Export or start a new company</button></Modal>;
  if (game.phase === "ended" && game.outcome !== "won" && view === null) return <Modal title="Company bankrupt" tone="alert" icon={{ kind: "critical", name: "cash" }} onClose={() => openView("menu")}>
    <Callout tone="critical" icon="cash" kicker="Company closed">Cash reached {dollars(c.cashCents)} after settlement at step {c.step}. Final metrics and history remain available.</Callout>
    <p>Last period revenue: {dollars(c.settlements.at(-1)?.revenueCents??0)}. Infrastructure: {dollars(infrastructureCents(c.settlements.at(-1)))}. Salaries: {dollars(c.settlements.at(-1)?.salaryCents??0)}.</p>
    <p>Upfront investment: {dollars(c.investedCents)}. Rejected demand: {c.cumulative.rejected} requests (not an extra cash charge).</p>
    <div className="modal-foot"><button className="btn btn-quiet" onClick={() => openView("history")}><Icon name="history" size={16} />View history</button><button className="btn btn-primary" onClick={() => openView("menu")}><Icon name="refresh" size={16} />Export or start a new company</button></div>
  </Modal>;
  if (view === "menu") return <CampaignMenu initialTab={game.phase === "ended" ? "saves" : "run"} />;
  return null;
}

/** Every acknowledgement ends the same way: the company carries on, and one button says so. */
function ContinueFoot({ label, onClick }: { label: string; onClick: () => void }) {
  return <div className="modal-foot"><span className="muted">The same company continues.</span><button className="btn btn-primary" onClick={onClick}>{label}<Icon name="next" /></button></div>;
}

const eventKind = (type: string): EventKind =>
  type === "settlement" ? "finance"
  : /incident-opened|failure-started|bankruptcy/.test(type) ? "incident"
  : /rejected|blocked|cancelled|superseded/.test(type) ? "warning"
  : /recovered|restored|qualified|completed/.test(type) ? "success"
  : /milestone|awarded|stage-entered|unlocked/.test(type) ? "milestone"
  : /action-|acknowledged|enabled|reserved|decided/.test(type) ? "decision"
  : "info";
const eventText = (e: Campaign["trace"][number]) => {
  const text = `${e.type.replaceAll("-", " ")} ${e.data.reason ? String(e.data.reason) : e.data.type ? ACTION_NAMES[e.data.type as Intervention] ?? String(e.data.type).replaceAll("-", " ") : ""}`.trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** History uses Classic's tabs: charts, the event log and the incident reports, with the step as the time unit. */
function CampaignHistory() {
  const c = useGame(s => s.game.campaign!);
  const [tab, setTab] = useState<HistoryTab>("charts");
  const [open, setOpen] = useState<string | null>(null);
  const steps = c.recent.map(m => m.step);
  return <div className="history">
    <HistoryTabs tab={tab} onChange={setTab} incidents={c.reports.length} />
    {tab === "charts" && <>
      <div className="charts">
        <LineChart title="Latency" axisLabel="Step" series={[{ name: "Latency", color: CHART_COLORS.health, values: c.recent.map(m => m.latencyMs) }]} turns={steps} format={v => `${v.toFixed(0)} ms`} />
        <LineChart title="Traffic" axisLabel="Step" series={[{ name: "Incoming", color: CHART_COLORS.users, values: c.recent.map(m => m.incoming) }, { name: "Admitted", color: CHART_COLORS.revenue, values: c.recent.map(m => m.admitted) }]} turns={steps} format={v => `${num(v)}/s`} />
        <LineChart title="Revenue and costs" series={[{ name: "Revenue", color: CHART_COLORS.revenue, values: c.settlements.map(p => p.revenueCents / 100) }, { name: "Costs", color: CHART_COLORS.costs, values: c.settlements.map(p => (p.revenueCents - p.netCents) / 100) }]} turns={c.settlements.map(p => p.period)} format={money} />
      </div>
      <div className="history-notes">
        {c.spikeStage&&<details className="more"><summary>Traffic spike and controller history</summary>{c.recent.filter(m=>m.spikes).map(m=><p key={m.step}>Step {m.step}: incoming {m.incoming}; {m.spikes!.activePulse?`pulse ${m.spikes!.activePulse}`:"baseline"}; routed busy {m.spikes!.routedBusyBasisPoints/100}%; installed/routed {m.spikes!.installed}/{m.spikes!.routed}; {m.spikes!.blockedReason??"observing"}.</p>)}</details>}
        <details className="more"><summary>Financial settlements</summary>{c.settlements.length ? c.settlements.map(p => <p key={p.period}>Week {p.period}: revenue {dollars(p.revenueCents)}, net {dollars(p.netCents)}</p>) : <p>No operating week has settled yet.</p>}</details>
      </div>
    </>}
    {tab === "events" && <EventFeed className="campaign-feed" entries={c.trace.filter(e => e.type !== "metrics").reverse().map(e => ({ id: e.id, kind: eventKind(e.type), when: `Step ${e.step}`, text: eventText(e) }))} />}
    {tab === "postmortems" && <div className="history-incidents">
      {c.openingPrevention?.outcome&&<section className="history-card" aria-label="Historical Opening prevention outcome"><PreventionOutcome campaign={c} /></section>}
      {c.reliabilityStage?.completedStep!=null&&<section className="history-card" aria-label="Historical reliability outcome"><ReliabilityOutcome campaign={c} /></section>}
      {c.reports.length === 0 ? <p className="empty">No incidents yet.</p> : <ul className="pm-list">{[...c.reports].reverse().map(report => <li key={report.id}>
        <button type="button" className="pm-toggle" aria-expanded={open === report.id} onClick={() => setOpen(open === report.id ? null : report.id)}>
          <span><Icon name="incident" size={16} />Steps {report.openedStep}–{report.recoveredStep}: Service slowdown</span>
          <span className="tag tag-ok"><Icon name="check" size={12} />Recovered{report.limited ? " under traffic limit" : ""}</span>
        </button>
        {open === report.id && <div className="pm"><Report report={report} meta={false} /></div>}
      </li>)}</ul>}
    </div>}
  </div>;
}

type Settlement = Campaign["settlements"][number];
const infrastructureCents = (p: Settlement | undefined) => p ? p.appCents + p.dbCents + (p.lbCents??0) + (p.cacheCents??0) + (p.controllerCents??0) + (p.checksCents??0) + (p.failoverCents??0) : 0;

function ReliabilityOutcome({campaign:c}:{campaign:Campaign}) {
  const d=c.reliabilityStage!,f=d.fault!;
  const completion=c.trace.find(e=>e.type==="reliability-stage-completed");
  const detection=c.trace.find(e=>e.type==="health-change-detected"&&e.data.appId===f.targetId&&e.data.detectedHealth==="unhealthy"&&e.step>=f.startStep);
  const promotion=c.trace.find(e=>e.type==="failover-activated"&&e.data.eventId===f.id);
  return <div>
    <Callout compact tone="success" icon="health" kicker={completion?.data.limited?"Stable — traffic limited":"Stable service"}>
      {completion?.data.incidentOccurred?"A production incident occurred during the test and its measured recovery was reviewed.":"The test completed without opening a production incident."} Five stable management observations followed restoration.
    </Callout>
    <dl className="rows"><Row label="Application failure" value={`${appName(f.targetId)} · step ${f.startedStep}`} />
      <Row label="Failure detected" value={detection?`Step ${detection.step} · ${detection.data.source==="probe"?"Health Checks":"manual inspection"}`:"Not detected before restoration"} />
      <Row label="Spare promotion" value={promotion?`${appName(String(promotion.data.appId))} · step ${promotion.step}`:"No automatic promotion"} />
      <Row label="Restoration" value={`Step ${f.restoredStep} · ${f.restoreSource==="manual"?"requested restore":"fault expired"}`} />
      <Row label="Outcome recorded" value={`Step ${d.completedStep}`} />
      <Row label="Company rejected requests at completion" value={num(Number(completion?.data.rejected??0))} />
      <Row label="Company setup spending at completion" value={dollars(Number(completion?.data.setupCents??0))} /></dl>
    <p>Health Checks detect; spares and routing provide surviving capacity. Failover creates no capacity. Compare per-instance demand and capacity in recorded incident evidence.</p>
  </div>;
}

const PREPARATION_NAMES: Partial<Record<ScheduledAction["type"], string>> = {"upgrade-db":"Database upgrade","add-app":"Additional application",limit:"Traffic limit",unlimit:"Traffic limit removal"};
function PreventionOutcome({campaign}:{campaign:Campaign}) {
  const o=campaign.openingPrevention!.outcome!,m=o.snapshots.at(-1)!;
  const qualified=campaign.trace.find(t=>t.type==="opening-prevention-qualified"&&t.step===o.qualifiedStep);
  const requested=new Set(campaign.trace.filter(t=>t.type==="action-requested"&&qualified&&t.id<qualified.id).map(t=>t.data.actionId));
  const prepared=campaign.actions.filter(a=>requested.has(a.id)&&PREPARATION_NAMES[a.type]);
  return <div>
    <Callout tone="success" icon="health" kicker="First growth prevented">Traffic increased from {num(Q.startingTraffic)} to {num(Q.grownTraffic)} req/s and the Application and Database handled full demand with empty queues and healthy service for {Q.stableSteps} consecutive steps.</Callout>
    <p>Prevention is recorded separately. Scaling unlocks only after a real Opening incident is recovered and its postmortem and milestone are acknowledged. No incident is forced.</p>
    {prepared.length?<ul>{prepared.map(a=><li key={a.id}>{PREPARATION_NAMES[a.type]}: {a.activatedStep!==null&&a.activatedStep<=o.qualifiedStep?"active before completion":"still pending at completion"}{a.costCents>0?` · setup ${dollars(a.costCents)}`:" · no setup cost"}.</li>)}</ul>:<p>No infrastructure or admission changes were recorded before completion.</p>}
    <dl className="rows">
      <Row label="Application demand / capacity" value={`${num(m.app.demand)} / ${num(m.app.capacity)} req/s`} />
      <Row label="Database demand / capacity" value={`${num(m.db.demand)} / ${num(m.db.capacity)} ops/s`} />
      <Row label="Setup spending" value={dollars(o.setupCents)} />
      <Row label="Rejected before completion" value={`${num(o.rejectedDemand)} requests`} tip="Revenue forgone from rejected demand, not an extra cash charge." />
    </dl>
  </div>;
}

function ReliabilityControls({disabled,busy}:{disabled:boolean;busy:boolean}) {
  const {game,act}=useGame(),c=game.campaign!,d=c.reliabilityStage!,f=currentFault(c),r=c.snapshot.reliability;
  const recipients=effectiveTargets(c),spare=c.apps.find(a=>a.id===d.spareId);
  const checksUnavailable=disabled||busy||d.checksStep!==null||!d.owned.includes("health_checks")||c.cashCents<=R.checksCostCents;
  const spareUnavailable=disabled||busy||!!d.spareId||c.apps.length>=T.maximum||!d.owned.includes("standby")||c.cashCents<=R.spareCostCents;
  const failoverUnavailable=disabled||busy||!!d.failover||!d.owned.includes("auto_failover")||d.checksStep===null||!c.loadBalancer||!spare||spare.health==="failed"||c.cashCents<=R.failoverCostCents;
  return <section aria-label="Stay Online" className="scaling-controls">
    <h4 className="step-head"><Icon name="health" size={16} />Stay online</h4>
    <p role="status">{!f?"Prepare, then explicitly start the reliability test.":f.startedStep===null?"Reliability test scheduled. Run to observe it.":f.restoredStep===null?`${appName(f.targetId)} failed. Inspect health, surviving capacity and routing.`:"Application restored. Observe stable service."} Stable after restoration: {c.combinedStage?.currentRound?.stableSteps??d.stableSteps} / {Q.stableSteps}.</p>
    {c.spikeStage?.controller&&f&&!d.acknowledged&&<p className="muted">Autoscaling waits while the reliability test runs; its enabled state and upkeep are preserved.</p>}
    <ul className="actions">
      <li><Act label="Deploy Health Checks" price={R.checksCostCents/100} note="2 steps" disabled={checksUnavailable} tip="Requires its research unlock and available cash. Detects health changes; load balancing is required for routing exclusion." onClick={()=>act({type:"deploy_health_checks"})} /></li>
      <li><Act label="Install spare" price={R.spareCostCents/100} note="2 steps" disabled={spareUnavailable} tip="Requires Spare Application research, available cash and a free instance slot. A spare receives no traffic until promoted." onClick={()=>act({type:"install_spare"})} /></li>
      <li><Act label="Deploy Automatic Failover" price={R.failoverCostCents/100} note="2 steps" disabled={failoverUnavailable} tip="Requires its research unlock, deployed Health Checks and Load Balancing, a healthy reserved spare and available cash. Creates no capacity." onClick={()=>act({type:"deploy_failover"})} /></li>
      {d.failover&&<li><Act label={d.failover.enabled?"Disable failover":"Enable failover"} price={0} disabled={disabled} onClick={()=>act({type:"set_failover",enabled:!d.failover!.enabled})} /></li>}
    </ul>
    <div className="instance-choices">{c.apps.map(a=><div key={a.id} className="chip">
      <span>{appName(a.id)} · {a.health??"healthy"} · detected {a.detectedHealth??"unknown"} · {a.role??"serving"} · {recipients.includes(a.id)?"receiving traffic":"not receiving traffic"}</span>
      <button className="btn btn-small" disabled={disabled} onClick={()=>inspectOrSelect("app",a.id)}>Inspect {appName(a.id)} health · free</button>
      {a.health==="failed"&&<button className="btn btn-small" disabled={disabled||busy} onClick={()=>act({type:"restore_app",appId:a.id})}>Restore {appName(a.id)} · free · 3 steps</button>}
      {!a.routed&&a.role!=="spare"&&<button className="btn btn-small" disabled={disabled||busy||!d.owned.includes("standby")||!!d.spareId} onClick={()=>act({type:"reserve_spare",appId:a.id})}>Reserve {appName(a.id)} as spare · 1 step</button>}
      {a.role==="spare"&&<button className="btn btn-small" disabled={disabled||busy} onClick={()=>act({type:"release_spare"})}>Release spare · 1 step</button>}
    </div>)}</div>
    <dl className="rows">
      <Row label="Installed / healthy" value={`${num(c.snapshot.installedAppCapacity)} / ${num(r?.healthyCapacity??c.snapshot.installedAppCapacity)} req/s`} />
      <Row label="Healthy routed / spare" value={`${num(r?.healthyRoutedCapacity??c.snapshot.app.capacity)} / ${num(r?.spareCapacity??0)} req/s`} />
    </dl>
  </section>;
}

function ScalingRiskConsent(){const {act}=useGame();const [confirm,setConfirm]=useState(false);return <section aria-label="Scaling growth risk"><p>Next wave: 1,400 req/s. Prepare 2,000 ops/s database headroom, or choose to take the risk.</p><button className="btn" onClick={()=>setConfirm(true)}>Consider growth with current capacity</button>{confirm&&<><p>Accept growth risk? This waives only the database-headroom requirement. Existing timing, costs and service rules remain.</p><button className="btn" onClick={()=>{if(act({type:"accept_scaling_risk"}))setConfirm(false);}}>Accept growth risk</button><button className="btn" onClick={()=>setConfirm(false)}>Keep preparing</button></>}</section>;}
function CombinedControls({disabled}:{disabled:boolean}){const {game,act}=useGame(),c=game.campaign!,d=c.combinedStage!,r=d.currentRound;return <section aria-label="Grow the Company"><h3>Grow the Company</h3><p>Registered users: {d.users.toLocaleString("en-US")} / {d.finalUserTarget.toLocaleString("en-US")}. Growth outcomes acknowledged: {d.completedRounds.length} / 3.</p><p>{r?r.startedStep===null?"Growth wave announced. Prepare the architecture before pressure arrives.":`Current pressure: ${r.scenario.template}. Inspect actual workload and healthy routed capacity.`:"Between growth waves: operate full baseline demand and choose when to continue."}</p><p>Optional promotion: $500 setup · +400 req/s for 12 seconds.</p><details className="more"><summary>Promotion effect &amp; costs</summary><p>Activates next step; no registered-user award. Maximum additional gross revenue is $960 if every extra request succeeds. Existing operating costs still apply. Available between growth waves; cooldown 30 steps after it ends.</p></details><button className="btn" disabled={disabled||!canPromote(game)} onClick={()=>act({type:"run_promotion"})}>Run promotion · $500 · 1 step</button>{c.promotion&&<p>{c.promotion.activatedStep===null?"Promotion pending":c.step<c.promotion.endStep?"Promotion active":"Promotion ended"}; cooldown remaining {Math.max(0,c.promotion.cooldownUntil-c.step)} steps.</p>}</section>;}
