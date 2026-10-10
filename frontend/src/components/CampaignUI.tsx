import { campaignGuidance, type Requirement } from "@/game/campaignGuidance";
import { pendingPreventionReview } from "@/sim/openingPrevention";
import { pendingSpikeAcknowledgement, spikeInput } from "@/sim/autoscaling";
import { TRAFFIC_SPIKES as T } from "@/sim/scenarios/trafficSpikes";
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
import { Modal, utilTone } from "./ui";
import type { GameState } from "@/sim";
const dollars = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(c / 100);
const percent = (v: number | null) => v === null ? "No completed requests" : (v * 100).toFixed(2) + "%";

// Labels and status are presentation of existing observations, never engine inputs.
function stageName(g: GameState) {
 const c=g.campaign!;
 return c.spikeStage?"Survive Traffic Spikes":c.dataStage?"Data Bottlenecks":c.openingMilestone?.acknowledged?"Scale Your App":"First Growth";
}
function serviceStatus(g: GameState) {
 const c=g.campaign!,m=c.snapshot;
 if(g.phase==="ended")return "Bankrupt";
 if(pendingPreventionReview(c)||g.phase==="review"||c.openingMilestone&&!c.openingMilestone.acknowledged||pendingSpikeAcknowledgement(c))return "Paused for review";
 if(c.incident)return c.incident.stableSteps>0?"Recovering":"Incident";
 if(m.latencyMs>=Q.latencyThresholdMs||(m.serviceErrorRate??0)>=Q.errorThreshold||m.app.demandRatio>1||m.db.demandRatio>1)return "Degraded";
 if(c.limit!==null)return "Stable — traffic limited";
 return [m.app,m.db].some(x=>utilTone(x.demandRatio)!=="ok")?"Near capacity":"Healthy";
}
function SystemStatus({onInvestigate}:{onInvestigate:()=>void}) {
 const {game,running}=useGame(),c=game.campaign!,status=serviceStatus(game);
 return <section className={`company-status ${c.incident?"has-incident":""}`} aria-label="System status">
  <div><h2>{status}</h2><p>Incoming <strong>{c.snapshot.incoming} req/s</strong> · Simulation: {running?"Running":"Paused"}</p></div>
  {c.incident&&<div role="alert"><strong>{status==="Recovering"?"SERVICE RECOVERING":"INCIDENT DETECTED"}</strong><p>{status==="Recovering"?"Service is improving. Keep it stable.":"Customers are experiencing slow or failed requests. Find the component that cannot keep up."}</p><p>Latency {c.snapshot.latencyMs.toFixed(0)} ms · Service errors {percent(c.snapshot.serviceErrorRate)} · Stable observations {c.incident.stableSteps}/5</p><button className="btn" onClick={onInvestigate}>Investigate system</button></div>}
 </section>;
}
function RequirementList({items}:{items:Requirement[]}) {
 return <ul className="progression-requirements">{items.map(r=><li key={r.id} data-requirement={r.id} data-met={r.met}>{r.met?"✓":"✗"} {r.label}</li>)}</ul>;
}
function ProgressionGuardrail({model}:{model:ReturnType<typeof campaignGuidance>}) {
 const {game,onboarding,openView,act}=useGame();
 const initial=game.campaign!.step===0&&!model.pendingAction;
 const action=model.pendingAction;
 const c=game.campaign!,preventionComplete=action?.label==="Review outcome";
 const preventionLabels:Record<string,string>={admission:"Serve the full 800 req/s", "app-inspection":"Inspect the Application", "db-inspection":"Inspect the Database",cash:"Keep company cash positive",queues:"Clear unfinished Application and Database work",healthy:"Keep latency and service errors healthy"};
 const preventionItems=model.requirements.filter(r=>["admission","app-inspection","db-inspection"].includes(r.id)||(!r.met&&["cash","queues","healthy"].includes(r.id))).map(r=>({...r,label:preventionLabels[r.id]??r.label}));
 const content=model.prevention?<>
  <h3 className={preventionComplete?"completion-banner":undefined}>{preventionComplete?"FIRST GROWTH PREVENTED":"FIRST GROWTH"}</h3>
  {preventionComplete?<p>Your system handled the growth without an incident. Review the outcome to complete this stage.</p>:<>
   <p>Handling the traffic increase without an incident is a valid way to complete First Growth.</p>
   <p>To complete this stage:</p><RequirementList items={preventionItems}/>
   <p role="status">Stable service: {c.openingPrevention?.stableSteps??0} / 5 seconds of simulated service.</p>
   <p>Keep service healthy for five consecutive seconds after inspecting both components. Pausing adds no time; unhealthy service restarts the counter.</p>
   {c.limit!==null&&<div role="note"><strong>Traffic limit active</strong><p>You are protecting the system by rejecting traffic.</p><p>To prove the architecture can handle current demand, remove the limit and serve the full 800 req/s.</p></div>}
   <div className="campaign-actions"><button className="btn" disabled={onboarding||game.phase==="ended"} onClick={()=>inspectOrSelect("app","app-1")}>Inspect Application evidence</button><button className="btn" disabled={onboarding||game.phase==="ended"} onClick={()=>inspectOrSelect("db")}>Inspect Database evidence</button></div>
  </>}
  {action&&<button className="btn btn-primary" disabled={onboarding||game.phase==="ended"} onClick={()=>openView(null)}>{action.label}</button>}
 </>:<>
  <h3>{action?"Progression action ready":"Why next stage is locked"}</h3>
  {model.notice&&<p role="note">{model.notice}</p>}
  {initial?<details><summary>{model.incomplete.length?"✗":"✓"} {model.lockReason}</summary><RequirementList items={model.requirements}/>{model.waiting&&<p>{model.waiting}</p>}</details>:<RequirementList items={model.requirements.map(r=>r.label==="Opening prevention qualified"?{...r,label:"Growth handled without an incident"}:r)}/> }
  {!initial&&model.waiting&&<p role="status">{model.waiting}</p>}
  {model.optional&&<p>{model.optional}</p>}
  {action&&<><p role="status">Pending action: {action.label}. Explicit acknowledgement or continuation is required; reading does not advance the company.</p><button className="btn btn-primary" disabled={onboarding||game.phase==="ended"} onClick={()=>action.action?act(action.action):openView(null)}>{action.label}</button></>}
 </>;
 return <section className="prevention-guidance" aria-label={model.prevention?"Opening prevention progress":"Progression requirements"}>{content}</section>;
}
function PreventionOutcome({campaign}:{campaign:import("@/sim/campaignTypes").Campaign}) {
 const p=campaign.openingPrevention!,o=p.outcome!,m=o.snapshots.at(-1)!;
 const preparationNames:Partial<Record<import("@/sim/campaignTypes").ScheduledAction["type"],string>>={"upgrade-db":"Database upgrade","add-app":"Additional application",limit:"Traffic limit",unlimit:"Traffic limit removal"};
 const completedEvent=campaign.trace.find(t=>t.type==="opening-prevention-qualified"&&t.step===o.qualifiedStep&&t.data.outcomeId===o.id);
 const preparationRequests=new Set(campaign.trace.filter(t=>t.type==="action-requested"&&completedEvent&&t.id<completedEvent.id).map(t=>t.data.actionId));
 const prepared=campaign.actions.filter(a=>preparationRequests.has(a.id)&&preparationNames[a.type]);
 return <div><h3>What happened</h3><p>Traffic increased from 300 to 800 req/s.</p>
  <h3>What you prepared</h3>
  {prepared.length?<ul>{prepared.map(a=><li key={a.id}>{preparationNames[a.type]}: {a.activatedStep!==null&&a.activatedStep<=o.qualifiedStep?"active before completion":"requested; still pending at completion"}{a.costCents>0?` · setup ${dollars(a.costCents)}`:" · no setup cost"}.</li>)}</ul>:<p>No infrastructure or admission changes were recorded before completion.</p>}
  <p>You inspected the Application and Database before completing this stage.</p>
  <h3>What the evidence showed</h3><p>The Application and Database handled full demand with empty queues, healthy latency and low service errors for five consecutive seconds of simulated service.</p>
  <p>Application demand/capacity: {m.app.demand} / {m.app.capacity} req/s. Database demand/capacity: {m.db.demand} / {m.db.capacity} ops/s.</p>
  <h3>Trade-offs</h3><p>Setup spending: {dollars(o.setupCents)}. Rejected traffic before completion: {o.rejectedDemand} requests; potential revenue not served {dollars(o.rejectedDemand*Q.revenueCents)} (not an extra charge).</p>
  {m.installedAppCapacity>m.app.capacity&&<p>Installed application capacity {m.installedAppCapacity} req/s exceeds routed capacity {m.app.capacity} req/s. Idle installed capacity still incurs upkeep.</p>}
  <h3>Outcome</h3><p>You prevented a production incident. Your system handled the growth without an incident.</p>
  <details><summary>Recorded prevention evidence</summary><table className="campaign-table"><thead><tr><th>Step</th><th>Admitted</th><th>App demand/capacity</th><th>DB demand/capacity</th><th>Backlog</th><th>Latency</th><th>Errors</th></tr></thead><tbody>{o.snapshots.map(x=><tr key={x.step}><td>{x.step}</td><td>{x.admitted}</td><td>{x.app.demand}/{x.app.capacity}</td><td>{x.db.demand}/{x.db.capacity}</td><td>{x.app.backlog}/{x.db.backlog}</td><td>{x.latencyMs} ms</td><td>{percent(x.serviceErrorRate)}</td></tr>)}</tbody></table></details>
 </div>;
}

// Presentation only: all gates and observations come from the existing campaign.
function CampaignGuidance() {
  const { game } = useGame(), c = game.campaign!;
  const model=campaignGuidance(game);
  const {openingDone,dataAvailable,spikesAvailable,stage,pendingMilestone}=model;
  const spikesPending=pendingSpikeAcknowledgement(c);
  const objective = game.phase === "ended" ? "Review why the company became insolvent before deciding whether to restart."
    : game.phase === "review" ? "Review what caused the incident."
    : pendingPreventionReview(c) ? "Review how the company handled Opening growth without an incident."
    : spikesPending ? "Acknowledge the spike response to continue this company."
    : pendingMilestone ? "Complete First Growth to continue."
    : c.incident ? c.incident.stableSteps>0?"Service is recovering. Keep it stable.":"Customers are experiencing slow or failed requests. Find the bottleneck."
    : c.spikeStage ? "Prepare for temporary demand spikes without wasting capacity."
    : c.dataStage ? "Reduce pressure on the database as workload grows."
    : dataAvailable ? "Review the scaling evidence, then continue to data strategy when ready."
    : openingDone ? "Prepare the application layer for the next traffic increase."
    : serviceStatus(game)==="Healthy"?"Watch how the system behaves as traffic increases.":"One component is approaching or exceeding capacity. Watch the evidence.";
  return <>
    <nav className="campaign-progression" aria-label="Campaign progression"><ol className="campaign-stages">
      <li aria-current={!openingDone ? "step" : undefined}>1. First Growth<small>Opening</small>{" "}<strong>{openingDone ? "Completed" : "Current"}</strong></li>
      <li aria-current={openingDone && !c.dataStage ? "step" : undefined}>2. Scale Your App<small>Scaling &amp; Routing</small>{" "}<strong>{c.dataStage ? "Completed" : openingDone ? "Current" : pendingMilestone ? "Available next · acknowledge milestone" : "Locked"}</strong></li>
      <li aria-current={c.dataStage&&!c.spikeStage ? "step" : undefined}>3. Data Bottlenecks<small>Data Strategy</small>{" "}<strong>{c.spikeStage?"Completed":c.dataStage ? "Current" : dataAvailable ? "Available next" : "Locked"}</strong></li>
      <li aria-current={c.spikeStage?"step":undefined}>4. Survive Traffic Spikes<small>Traffic Spikes &amp; Autoscaling</small>{" "}<strong>{c.spikeStage?(c.spikeStage.acknowledged?"Completed":"Current"):spikesAvailable?"Available next":"Locked"}</strong></li>
      <li>5. Stay Online<small>Later stages · Reliability</small>{" "}<strong>Locked · not implemented</strong></li>
    </ol></nav>
    <section className="campaign-guidance" aria-label="Campaign guidance"><h2>Campaign guidance</h2>
    <p className="current-stage">Current stage: <strong>{stageName(game)}</strong> <small>({stage})</small></p>
    <h3>Current objective</h3><p className="current-objective">{objective}</p>
    {openingDone&&!c.dataStage&&!c.scaling?.consumed&&<p className="stage-brief"><strong>FIRST GROWTH COMPLETE.</strong> STAGE 2 — SCALE YOUR APP. Installed servers do not automatically receive traffic. Next growth requirement: Database headroom: {c.dbCapacity.toLocaleString("en-US")} / 2,000 ops/s.</p>}
    {c.dataStage&&!c.dataStage.consumed&&<p className="stage-brief">STAGE 3 — DATA BOTTLENECKS. Reads may benefit from caching. Writes still reach the database.</p>}
    {c.spikeStage&&c.step<c.spikeStage.deadlines[0]&&<p className="stage-brief">STAGE 4 — SURVIVE TRAFFIC SPIKES. Traffic will not always grow smoothly. Automatic scaling can react, but new capacity takes time to become useful.</p>}
    <details className="stage-context"><summary>About this stage and next-stage requirements</summary>
    <p>{c.spikeStage?"Traffic will not always grow smoothly. Automatic scaling can react, but new capacity takes time to become useful.":c.dataStage?"Not every request creates the same database workload. Reads may benefit from caching; writes still reach the database.":openingDone?"Traffic will eventually exceed the useful capacity of one application server. Installed servers do not automatically receive traffic.":"You run the technical side of a growing software company. Compare incoming work with each component’s capacity."}</p>
    {!openingDone&&<p>Next stage requires acknowledgement of either a recovered incident’s postmortem or a prevention outcome, followed by the Opening milestone. Handling full demand without an incident is a valid success path. Inspect both components, keep service healthy, then review the outcome and complete the milestone. Healthy metrics alone do not complete Opening.</p>}
    <p>{model.lockReason}</p>
    </details>
    {game.phase==="review"&&<p role="status">Incident recovered. Recovery recorded. Pending acknowledgement: Incident postmortem. Review the report and acknowledge it with Continue company; simulation remains paused.</p>}
    {pendingMilestone&&<p role="status">{c.openingMilestone?.outcomeId?"Growth outcome reviewed.":"Incident recovered. Postmortem acknowledged."} Pending acknowledgement: First growth challenge handled. Complete Opening by acknowledging the milestone; your company continues into Scaling &amp; Routing.</p>}
    <ProgressionGuardrail model={model}/>
    {c.limit !== null && <div className="traffic-limit-notice" role="note" aria-label="Traffic limit trade-off"><strong>Traffic limit active</strong>
      <p>Incoming: {c.snapshot.incoming} req/s · Admitted: {c.snapshot.admitted} req/s · Rejected: {c.snapshot.rejected} req/s</p>
      <p>Rejected demand this period: {c.ledger.rejected}; potential revenue not served {dollars(c.ledger.rejected * 20)} — opportunity value (not an extra charge). Service can be stable while sacrificing growth.</p>
    </div>}
    {c.dataStage && <div aria-label="Data stage context"><p>Workload: {DATA_PROFILES[c.dataStage.profile].readShare / 100}% reads / {100 - DATA_PROFILES[c.dataStage.profile].readShare / 100}% writes.</p>
      <p>Cache: {!c.readCache ? "Not deployed" : c.readCache.warmth === 0 ? "Cold" : c.readCache.warmth < c.readCache.target ? "Warming" : "Warm"}. Effective hit rate used: {c.snapshot.data ? `${c.snapshot.data.effectiveHitRateUsed / 100}%` : "No completed workload observation yet"}.</p>
      <p>Database: {c.snapshot.db.demand} / {c.snapshot.db.capacity} ops/s.</p></div>}
  </section></>;
}

export function CampaignHeader() {
  const { game, openView } = useGame(), c = game.campaign!;
  return <header className="topbar campaign-header"><div className="brand"><span className="brand-mark">99.99%</span>
    <span>{stageName(game)} · Week {game.turn} · Step <strong data-testid="physical-step">{c.step}</strong></span></div>
    <div className="stats-strip"><div className="stat"><span>Cash</span><strong>{dollars(c.cashCents)}</strong></div>
      <div className="stat"><span>Users</span><strong>2,000</strong></div>
      <div className="stat"><span>Pending revenue</span><strong>{dollars(c.ledger.successes * Q.revenueCents)}</strong></div>
      <div className="stat"><span>Company role</span><strong>Keep service running</strong></div></div>
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
  const disabled = pendingPreventionReview(c) || pendingSpikeAcknowledgement(c) || onboarding || !!(c.openingMilestone&&!c.openingMilestone.acknowledged) || game.phase === "review" || game.phase === "ended";
  const [evidenceOpen,setEvidenceOpen]=useState(false);
  const investigate=()=>{ act({type:"incident_inspect",equipment:"monitoring"});setEvidenceOpen(true);document.getElementById("campaign-architecture")?.focus(); };
  const admissionPending = c.pending.some(a => a.type === "limit" || a.type === "unlimit");
  return <aside className="side campaign-panel" aria-label="System metrics">
    <CampaignGuidance />
    <SystemStatus onInvestigate={investigate}/>
<section className="panel-section architecture-overview" aria-label="Architecture" id="campaign-architecture" tabIndex={-1}><h2>Architecture</h2>
      <nav className={`dependency-strip${c.dataStage?" data-dependencies":""}`} aria-label="Request dependencies">
        <span>Users<br/>{m.incoming} req/s</span><span aria-hidden="true">&rarr;</span>
        <button className="btn tip tip-left" data-tip={`${m.app.demandRatio>1?"Demand exceeds capacity":"Demand within capacity"}. Backlog: ${m.app.backlog}. Busy: ${percent(m.app.busyUtilisation)}`} aria-pressed={selected==="app"} onClick={()=>inspectOrSelect("app","app-1")}>Application<br/>{m.app.demand} / {m.app.capacity} req/s<br/>{percent(m.app.demandRatio)} · {m.app.demandRatio>1?"Over capacity":utilTone(m.app.demandRatio)!=="ok"?"Near capacity":"Headroom available"}</button>
        {c.dataStage&&<><span aria-hidden="true">&rarr;</span><button className="btn" aria-pressed={selected==="cache"} onClick={()=>inspectOrSelect("cache")}>Read Cache<br/>{c.readCache?"Deployed":"Not deployed — all work reaches DB"}</button></>}
        <span aria-hidden="true">&rarr;</span><button className="btn tip tip-left" data-tip={`${m.db.demandRatio>1?"Demand exceeds capacity":"Demand within capacity"}. Backlog: ${m.db.backlog}. Busy: ${percent(m.db.busyUtilisation)}`} aria-pressed={selected==="db"} onClick={()=>inspectOrSelect("db")}>Database<br/>{m.db.demand} / {m.db.capacity} ops/s<br/>{percent(m.db.demandRatio)} · {m.db.demandRatio>1?"Over capacity":utilTone(m.db.demandRatio)!=="ok"?"Near capacity":"Headroom available"}</button>
      </nav>
      {c.apps.filter(a=>!a.routed).map(a=><div className="idle-app-notice" role="note" aria-label={`${`App ${a.id.slice(4)}`} routing status`} key={a.id}>
        <strong>{`App ${a.id.slice(4)}`}</strong><p>Installed ✓ · Receiving traffic ✗</p>
        <p>Installed capacity: {a.capacity} req/s · Routed capacity: 0 req/s.</p>
        <p>Installed capacity does not receive traffic until it is included in routing.</p>
        {!unlocked&&<p>Routing controls become available after acknowledging the opening postmortem and milestone.</p>}
      </div>)}
      {unlocked&&<section aria-label="Application instances"><p>Routing: <strong>{c.routing.mode}</strong>; targets: {c.routing.targets.join(", ")}. Load balancer: {c.loadBalancer?"Deployed":"Not deployed"}.</p>
        {c.apps.map(a=>{const x=m.instances?.find(x=>x.id===a.id);return <button key={a.id} className="btn tip tip-left" aria-pressed={selected==="app"&&selectedAppId===a.id} data-tip={`Backlog: ${a.backlog}; capacity: ${a.capacity} req/s`} onClick={()=>inspectOrSelect("app",a.id)}>{`App ${a.id.slice(4)}`}: {a.routed?"Receiving traffic":"Installed - not receiving traffic"}<br/>{x?`${x.demand} / ${x.capacity} req/s; processed ${x.processed}; busy ${percent(x.busyUtilisation)}`:`${a.capacity} req/s; no per-instance observation yet`}; backlog {a.backlog}</button>;})}
        {c.pending.filter(a=>a.type==="add-app").map(a=><p key={a.id}>{a.targetId}: Deploying - no installed capacity yet</p>)}
        <p>Selected app: {selectedApp.id}. Capacity {selectedApp.capacity} req/s; backlog {selectedApp.backlog} requests.</p>
      </section>}
      <p role="status">Selected component: <strong>{selected==="app"?(unlocked?selectedApp.id:"Application"):selected==="db"?"Database":selected==="cache"?"Read Cache":"System overview"}</strong></p>

      <button className="btn" disabled={disabled} onClick={() => {act({ type: "incident_inspect", equipment: selected === "app" ? "app" : selected === "db" ? "db" : selected === "cache" ? "cache" : "monitoring", ...(selected==="app"?{appId:selectedApp.id}:{}) });setEvidenceOpen(true);}}>Inspect metrics · free</button>

    </section>
    <section className="panel-section" aria-label="Actions"><h2>Actions</h2>
      <div className="campaign-actions">
        <div className="action-card"><button className="btn" disabled={disabled || busy || c.apps.length >= (c.spikeStage?4:2) || c.cashCents <= Q.appCostCents} onClick={() => act({ type: "add_server" })}>Add application · $1,000 · 2 steps</button><p>+1,000 req/s installed capacity; routing is separate. Ongoing: $700/week.</p></div>
        <div className="action-card"><button className="btn" disabled={disabled || busy || (unlocked?c.dbCapacity>=(c.dataStage?3000:2000):c.upgraded) || c.cashCents <= dbCost} onClick={() => act({ type: "start_db_upgrade" })}>{c.dataStage&&c.dbCapacity===3000?"Database at highest tier · 3,000 ops/s":<>Upgrade database · {dollars(dbCost)} · {dbDelay} steps{unlocked?` · next tier ${dbNext} ops/s`:""}</>}</button><p>{c.dbCapacity===3000?"Highest available database capacity.":`Effect: Database ${c.dbCapacity.toLocaleString("en-US")} → ${dbNext.toLocaleString("en-US")} ops/s. Ongoing: ${dollars(c.dbCapacity===600?150000:c.dbCapacity===1000?250000:350000)}/week after activation.`}</p></div>
        <div className="action-card"><button className="btn" disabled={disabled || admissionPending} onClick={() => act({ type: "set_traffic_limit", enabled: c.limit === null })}>{c.limit === null ? "Limit to 500 requests/s" : "Remove traffic limit"}</button><p>{c.limit===null?"Admit at most 500 req/s; other incoming demand is rejected.":"Admit full incoming demand again."} Free · applies after 1 step.</p></div>
      </div>
      {unlocked&&<section aria-label="Scaling controls"><h3>Scale Up / Scale Out + Load Balancing</h3>
        <div className="action-card"><button className="btn" disabled={disabled||busy||selectedApp.tier!=="base"||c.cashCents<=200000} onClick={()=>act({type:"scale_up",appId:selectedApp.id})}>Scale up {selectedApp.id} · $2,000 · 3 steps</button><p>Selected application {selectedApp.capacity} → 1,600 req/s. Ongoing: $1,100/week for this app.</p></div>
        <div className="action-card"><button className="btn" disabled={disabled||busy||c.loadBalancer||c.cashCents<=100000} onClick={()=>act({type:"deploy_load_balancer"})}>Deploy load balancing · $1,000 · 2 steps</button><p>Enables routing configuration; deployment alone changes no route. Ongoing: $300/week.</p></div>
        <fieldset disabled={disabled||!c.loadBalancer||c.pending.some(a=>a.type==="routing"||a.type==="retire-app")}><legend>Routing configuration · activates next step</legend>
          <button className="btn" disabled={c.routing.mode==="balanced"&&c.routing.targets.length===c.apps.length} onClick={()=>act({type:"set_routing",mode:"balanced",targets:c.apps.map(a=>a.id)})}>Balance across installed apps</button>
          {c.apps.map(a=><button key={a.id} className="btn" disabled={c.routing.mode==="balanced"&&c.routing.targets.length===1&&c.routing.targets[0]===a.id} onClick={()=>act({type:"set_routing",mode:"balanced",targets:[a.id]})}>Balance to {a.id} only</button>)}
          <button className="btn" disabled={c.routing.mode==="single"} onClick={()=>act({type:"set_routing",mode:"single",targets:["app-1"]})}>Route only to App 1</button>
        </fieldset>
        <p>Scaling growth: {c.scaling?.consumed?"1,400 req/s event applied":c.dbCapacity<2000?"Waiting for an explicitly purchased 2,000 ops/s database":c.incident||c.dbBacklog||c.apps.some(a=>a.backlog)?"Waiting for management and empty backlogs":c.scaling?.dueStep?"Waiting for the next company growth event":"Readiness will be checked on the next step"}.</p>
      </section>}
      {c.dataStage&&<section aria-label="Data strategy"><h3>Data strategy</h3>
        <p>Workload: {c.dataStage.consumed?c.dataStage.profile:"Waiting for workload growth"}. {c.dataStage.dueStep!==null&&!c.dataStage.consumed?"Waiting for the next company growth event.":""}</p>
        <p>Cache: {c.readCache?"Deployed":"Not deployed"}; warmth for next work {((c.readCache?.warmth??0)/100).toFixed(0)}%; target {(c.readCache?.target??0)/100}%.</p>
        {m.data?<div aria-label="Workload evidence"><p>Reads {m.data.readShare/100}% / writes {(10000-m.data.readShare)/100}%; cacheable reads {m.data.cacheableReadShare/100}%.</p>
          <p>Effective hit rate used: <b>{m.data.effectiveHitRateUsed/100}%</b>; hits <b>{m.data.hits}</b>; eligible misses <b>{m.data.eligibleMisses}</b>.</p>
          <p>Logical work {m.data.logical}; writes {m.data.writes}; non-cacheable reads {m.data.nonCacheableReads}. Misses and writes reach DB.</p>
          <p>DB demand {m.db.demand} / {m.db.capacity} ops/s; DB backlog {m.db.backlog}.</p></div>:<p>No completed workload observation yet.</p>}
        <div className="action-card"><button className="btn" disabled={disabled||busy||!!c.readCache||c.cashCents<=150000} onClick={()=>act({type:"deploy_cache"})}>Deploy Read Cache · $1,500 · 2 steps</button><p>Starts cold; eligible reads may be served without DB work as it warms. Ongoing: $400/week.</p></div>
        <div className="action-card"><button className="btn" disabled={disabled||busy||!c.readCache||c.readCache.tuned||c.cashCents<=100000} onClick={()=>act({type:"tune_cache"})}>Tune cache ceiling to 75% · $1,000 · 2 steps</button><p>Raises the cache ceiling from 60% to 75%; warm-up still applies. No additional upkeep.</p></div>
        <button className="btn" disabled={disabled||!c.dataStage.consumed||c.dataStage.contrastConsumed||!!c.spikeStage||!canEnterData(game)} onClick={()=>act({type:"contrast_workload"})}>Observe contrasting workload</button>
      </section>}
      {c.spikeStage&&<SpikeControls disabled={disabled} busy={busy}/>}
      {c.pending.map(a => <p role="status" key={a.id}>{{"add-app":"Application installation","upgrade-db":"Database upgrade",limit:"Traffic limit",unlimit:"Remove traffic limit","scale-up":"Application scale up","deploy-lb":"Load balancer deployment",routing:"Routing change",cache:"Read Cache deployment","cache-tuning":"Cache tuning","deploy-autoscaler":"Autoscaling controller deployment","retire-app":"Safe application retirement"}[a.type]}{a.targetId?` (${a.targetId})`:""}: activates in {a.activationStep - c.step} step(s)</p>)}
    </section>
    <details className="detailed-evidence" open={evidenceOpen} onToggle={e=>setEvidenceOpen(e.currentTarget.open)}><summary>Detailed system evidence</summary><section className="panel-section" aria-label="System evidence"><p>{nextMove(game).text}</p><p>Incoming {m.incoming} / admitted {m.admitted} / rejected {m.rejected} requests/s</p>
      <table className="campaign-table"><caption>Component evidence, step {c.step}</caption><thead><tr><th>Metric</th><th>Application</th><th>Database</th></tr></thead>
        <tbody>{[["Demand /s", m.app.demand, m.db.demand], ["Capacity /s", m.app.capacity, m.db.capacity], ["Demand/capacity", percent(m.app.demandRatio), percent(m.db.demandRatio)], ["Busy", percent(m.app.busyUtilisation), percent(m.db.busyUtilisation)], ["Backlog", m.app.backlog, m.db.backlog], ["Processed", m.app.processed, m.db.processed], ["Failed", m.app.failed, m.db.failed]].map(([label, a, b]) => <tr key={label}><th>{label}</th><td className={selected==="app"?"selected-evidence":""}>{a}</td><td className={selected==="db"?"selected-evidence":""}>{b}</td></tr>)}</tbody></table>
      <p>Application installed capacity: {m.installedAppCapacity} req/s. Routed capacity: {m.effectiveAppCapacity??m.app.capacity} req/s.</p>
      <p>Latency: <strong>{m.latencyMs.toFixed(0)} ms</strong> · Service errors: <strong>{percent(m.serviceErrorRate)}</strong></p>
      {c.incident && <p role="status">Stable steps: {c.incident.stableSteps}/5 · requires &lt;500 ms and &lt;1% service errors with traffic and completed outcomes.</p>}
</section></details>
    <details className="financial-evidence"><summary>Finances and settlement details</summary><p>Purchases deduct cash immediately. Successful requests earn revenue; operating costs and revenue settle every 60 physical steps. Rejected traffic earns no revenue.</p>      <p>Unsettled costs: {dollars(Math.floor((c.ledger.appNumerator + c.ledger.dbNumerator + c.ledger.salaryNumerator + (c.ledger.lbNumerator??0) + (c.ledger.cacheNumerator??0) + (c.ledger.controllerNumerator??0)) / 60))}. Settlement at step {(c.lastSettledPeriod + 1) * 60}.</p>
      <p>Rejected demand this period: {c.ledger.rejected}; opportunity value {dollars(c.ledger.rejected * 20)} (not an extra charge).</p>
</details></aside>;
}
function SpikeControls({disabled,busy}:{disabled:boolean;busy:boolean}) {
 const {game,act}=useGame(),c=game.campaign!,d=c.spikeStage!,a=d.controller;
 const o=c.snapshot.spikes;
 return <section aria-label="Traffic spikes and autoscaling"><h3>Traffic Spikes &amp; Autoscaling</h3>
  <p role="status">{spikeInput(c)===T.peak?"TRAFFIC SPIKE ACTIVE":"Baseline demand"}: {c.snapshot.incoming} req/s. Normal {T.baseline}; spike {T.peak} req/s.</p>
  <p>Two temporary demand pulses are part of this stage. New capacity takes time to become useful.</p>{c.step>=d.deadlines[3]&&<p>Both pulses ended.</p>}
  <p>Research: {d.researchEarned-d.researchSpent} point available. Autoscaling {d.researchSpent?"unlocked":"locked"}.</p>
  <button className="btn" disabled={disabled||!!d.researchSpent} onClick={()=>act({type:"unlock_autoscaling"})}>Unlock autoscaling · 1 research point</button>
  <button className="btn" disabled={disabled||busy||!d.researchSpent||!!a||!c.loadBalancer||c.routing.mode!=="balanced"||c.routing.targets.length<2||c.cashCents<=T.controllerCostCents} onClick={()=>act({type:"deploy_autoscaler"})}>Deploy autoscaling · $1,000 · 2 steps</button>
  <p>Deployment requires balanced routing to at least two apps. Controller upkeep: $100 per operating week, including while disabled.</p>
  <p>Installed {c.apps.length} / maximum 4; routed {c.routing.targets.length}. Automatic apps cost $1,000 setup and $700/week after installation.</p>
  {a&&<><p>Controller: {a.enabled?"Enabled":"Disabled"}. {a.blockedReason??"Observing service"}</p>
   <button className="btn" disabled={disabled} onClick={()=>act({type:"set_autoscaling",enabled:!a.enabled})}>{a.enabled?"Disable autoscaling":"Enable autoscaling"}</button>
   <p>Observed routed busy utilisation: {o?`${(o.routedBusyBasisPoints/100).toFixed(2)}%`:"No controller observation yet"}. High-utilization observations: {a.highSteps} / 3; low-utilization observations: {a.lowSteps} / 6.</p>
   <p>Scale out above 80% for 3 steps. Empty controller apps may retire below 60% for 6 safe steps; minimum 2. Cooldown remaining: {Math.max(0,a.cooldownUntil-c.step)} steps.</p>
   <p>Automatic provisioning takes 3 steps, followed by 1 routing step. {a.joiningAppId?`Joining ${a.joiningAppId}; installed capacity may still be unrouted.`:"No automatic app awaiting routing."}</p>
  </>}
  <p>Application automation cannot increase DB capacity, cache effectiveness or admitted traffic. Manual investments and traffic limiting remain available.</p>
 </section>;
}
export function CampaignControls() {
  const { game, running, setRunning, speed, setSpeed, advance, openView, started, onboarding } = useGame();
  const active = !pendingPreventionReview(game.campaign) && !pendingSpikeAcknowledgement(game.campaign!) && started && !onboarding && !(game.campaign!.openingMilestone&&!game.campaign!.openingMilestone!.acknowledged) && (game.phase === "management" || game.phase === "incident");
  return <footer className="bottombar"><button className="btn" onClick={() => openView("history")}>History</button>
    <div className="time-controls"><button className="btn" disabled={!active} onClick={() => setRunning(!running)}>{running ? "Pause company" : "Resume company"}</button>
      <div className="speed" role="group" aria-label="Game speed">{([.5, 1, 2] as Speed[]).map(v => <button key={v} aria-pressed={speed === v} onClick={() => setSpeed(v)}>{v===.5?"Slow":v===1?"Normal":"Fast"} · {v}×</button>)}</div>
      <button className="btn btn-primary" disabled={!active || game.phase !== "management"} onClick={advance}>Advance 1 step</button></div><div className="clock-explanation"><strong role="status">Simulation: {running?"Running":"Paused"}</strong><details><summary>Each simulation step represents one second of system activity.</summary><p>Speed changes real-time pacing, not modeled work. Purchases activate after their pending steps.</p></details>{game.phase==="incident"&&<span>Manual stepping is unavailable during an active incident. Use Resume/Pause to observe recovery.</span>}</div></footer>;
}
function Report({ report }: { report: CampaignPostmortem }) {
  return <div className="postmortem-summary"><h3>What happened</h3><p>Incident steps {report.openedStep}–{report.recoveredStep}. Setup spending: {dollars(report.setupCents)}.</p>
    <details><summary>Workload and cache evidence</summary>{report.snapshots.map(m=><p key={m.step}>Step {m.step}: {m.data?`${m.data.profile}; hits ${m.data.hits}, misses ${m.data.eligibleMisses}, writes ${m.data.writes}; effective rate ${m.data.effectiveHitRateUsed/100}%; DB ${m.db.demand}/${m.db.capacity}`:"Historical workload/cache detail unavailable"}</p>)}</details>
    <p>{report.explanations[0]}</p><h3>What you changed</h3><p>Setup spending during this report period: {dollars(report.setupCents)}.</p>{report.explanations.slice(1,-2).map((text,i)=><p key={i}>{text}</p>)}<h3>What happened next</h3><p>{report.explanations.at(-2)}</p><h3>Trade-off</h3><p>{report.explanations.at(-1)}</p>
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
    <p>You run the technical side of a growing software company. Inspect demand and capacity, invest or limit traffic, and observe the consequences.</p>
    <img className="gameplay-preview" src="/opening-gameplay.png" alt="The furnished server room and component evidence in the playable campaign" />
    <div className="campaign-actions"><button className="btn btn-primary btn-big" onClick={play}>{hasRun?"Continue company":"Try Prototype"}</button>
      {playtestUrl?<a className="btn" href={playtestUrl} target="_blank" rel="noopener noreferrer">Join Playtest</a>:<><button className="btn" disabled>Join Playtest</button><small>Playtest registration is not open yet.</small></>}
    </div><p>Play immediately as a guest. Progress stays in this browser.</p>
  </div></div>;
  if(useGame.getState().onboarding) {
    const {meta,onboardingMove}=useGame.getState();
    const prompts=[
      ["Your role","You are responsible for the technical side of a growing software company. Keep service running as traffic increases, while managing the cost."],
      ["Your architecture","Requests flow from Users → Application → Database. Select a component in the dependency strip or office to compare its demand with capacity."],
      ["The core idea","Compare demand with capacity. When demand exceeds capacity, queues, latency and failures can grow. Resume company to observe changes, or Advance 1 step while in management. Pause company to think; investments take time to activate."]
    ];
    return <Modal title="Company introduction" onClose={()=>onboardingMove("skip")}>
      <p>Prompt {meta.openingOnboarding.step+1} of 3 - Simulation paused</p>
      <h3>{prompts[meta.openingOnboarding.step][0]}</h3><p>{prompts[meta.openingOnboarding.step][1]}</p>
      <div className="campaign-actions"><button className="btn" onClick={()=>onboardingMove("skip")}>Skip introduction</button>
      <button className="btn" disabled={meta.openingOnboarding.step===0} onClick={()=>onboardingMove("back")}>Back</button>
      <button className="btn btn-primary" onClick={()=>onboardingMove("next")}>{meta.openingOnboarding.step===2?"Start company":"Next"}</button></div>
    </Modal>;
  }
  if(pendingPreventionReview(c)&&!["guidance","menu","history"].includes(view??""))return <Modal title="Prevention review" onClose={()=>openView("guidance")}><PreventionOutcome campaign={c}/><button className="btn btn-primary" onClick={()=>act({type:"acknowledge_prevention_review"})}>Continue company</button></Modal>;
  if (game.phase === "review" && !["guidance", "menu", "history"].includes(view ?? "")) return <Modal title="Incident postmortem" onClose={() => openView("guidance")}><p className="recovery-banner">SERVICE RECOVERED · Review the evidence before continuing.</p><Report report={c.reports[c.reports.length - 1]} /><button className="btn btn-primary" onClick={() => act({ type: "acknowledge_review" })}>Continue company</button></Modal>;
  if(c.openingMilestone&&!c.openingMilestone.acknowledged&&!["guidance", "menu", "history"].includes(view ?? ""))return <Modal title="First growth challenge handled" onClose={() => openView("guidance")}>
    <h3 className="completion-banner">{c.openingMilestone.outcomeId?"FIRST GROWTH PREVENTED":"FIRST GROWTH RECOVERED"}</h3><p>{c.openingMilestone.outcomeId?"You handled Opening growth without an incident.":"You recovered your first production incident."} Next: Scale Your App.</p><p>Complete Opening and enter Scaling &amp; Routing by selecting Continue operating. Your company is still operating. Your architecture, cash and pending work are preserved.</p>
    <p>{c.limit!==null?"The traffic limit remains active: rejected demand still has a revenue trade-off.":"Your company is serving its current demand."} Continue this company to explore application scaling and routing; compare the evidence before investing.</p>
    <button className="btn btn-primary" onClick={()=>act({type:"acknowledge_milestone"})}>Continue operating</button>
  </Modal>;
  if(pendingSpikeAcknowledgement(c)&&!["guidance","menu","history"].includes(view??""))return <Modal title="Spike response handled" onClose={()=>openView("guidance")}>
    <p>Both demand pulses ended and five baseline steps qualified for stable service. Your company, investments, reports and admission policy are preserved.</p>
    <p>No additional resource reward. Reliability remains locked; installed capacity and the deployed controller continue to incur cost.</p>
    <button className="btn btn-primary" onClick={()=>act({type:"acknowledge_spikes"})}>Continue operating</button>
  </Modal>;
  if (game.phase === "ended" && view !== "menu" && view !== "history") return <Modal title="Company bankrupt" onClose={() => openView("menu")}><p>Cash reached {dollars(c.cashCents)} after settlement at step {c.step}. Final metrics and history remain available.</p><p>Last period revenue: {dollars(c.settlements.at(-1)?.revenueCents??0)}. Infrastructure: {dollars((c.settlements.at(-1)?.appCents??0)+(c.settlements.at(-1)?.dbCents??0)+(c.settlements.at(-1)?.lbCents??0)+(c.settlements.at(-1)?.cacheCents??0)+(c.settlements.at(-1)?.controllerCents??0))}. Salaries: {dollars(c.settlements.at(-1)?.salaryCents??0)}.</p><p>Upfront investment: {dollars(c.investedCents)}. Rejected demand: {c.cumulative.rejected} requests (not an extra cash charge).</p><button className="btn" onClick={()=>openView("history")}>View final history</button><button className="btn" onClick={() => openView("menu")}>Export or start a new company</button></Modal>;
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
    {c.spikeStage&&<details><summary>Traffic spike and controller history</summary>{c.recent.filter(m=>m.spikes).map(m=><p key={m.step}>Step {m.step}: incoming {m.incoming}; {m.spikes!.activePulse?`pulse ${m.spikes!.activePulse}`:"baseline"}; routed busy {m.spikes!.routedBusyBasisPoints/100}%; installed/routed {m.spikes!.installed}/{m.spikes!.routed}; high/low {m.spikes!.highSteps}/{m.spikes!.lowSteps}; cooldown until {m.spikes!.cooldownUntil}; {m.spikes!.blockedReason??"observing"}.</p>)}</details>}
    {c.openingPrevention?.outcome&&<section aria-label="Historical Opening prevention outcome"><PreventionOutcome campaign={c}/></section>}
    {c.reports.map(p => <Report key={p.id} report={p} />)}
    <details><summary>Backlog and traffic history</summary><table className="campaign-table"><thead><tr><th>Step</th><th>App demand/capacity</th><th>Routing targets</th><th>DB demand / capacity (ops/s)</th><th>DB backlog (ops)</th><th>Rejected (req/s)</th></tr></thead><tbody>{c.recent.map(m=><tr key={m.step}><td>{m.step}</td><td>{m.app.demand}/{m.app.capacity}</td><td>{m.routing?.targets.join(", ")??"Historical aggregate observation"}</td><td>{m.db.demand}/{m.db.capacity}</td><td>{m.db.backlog}</td><td>{m.rejected}</td></tr>)}</tbody></table></details><details><summary>Financial settlements</summary>{c.settlements.map(p => <p key={p.period}>Week {p.period}: revenue {dollars(p.revenueCents)}, net {dollars(p.netCents)}</p>)}</details>
    <details><summary>Action and event history</summary>{c.trace.filter(e => e.type !== "metrics").map(e => <p key={e.id}>Step {e.step}: {e.type} {e.data.reason ? String(e.data.reason) : e.data.type ? String(e.data.type) : ""}</p>)}</details>
  </Modal>;
  return null;
}
