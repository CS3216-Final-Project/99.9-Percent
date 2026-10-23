import { outcomeSummary, scorecardSummary } from "@/game/campaignReport";
import { CampaignReport } from "./CampaignReport";
import { RecordedFields } from "./RecordedFields";
import { chapter6FinancialRisk } from "@/game/chapter6Finance";
import { reliabilityLesson } from "@/game/reliabilityLesson";
import { incidentTitle } from "@/game/campaignPostmortem";
import { saveTextFile as download } from "@/lib/download";
import { EquipmentPanel } from "./EquipmentPanel";
import { CampaignReadings } from "./CampaignReadings";
import { RoomControlsSlot } from "./RoomControlsHost";
import "./CampaignUX.css";
import { TimeMenu } from "./TimeMenu";
import { CampaignAction as Act } from "./CampaignAction";
import CampaignScorecard from "./CampaignScorecard";
import { canPromote, combinedProfile, currentFault, pendingCombined } from "@/sim/combinedCampaign";
import { pendingSpikeAcknowledgement, spikeInput } from "@/sim/autoscaling";
import { TRAFFIC_SPIKES as T } from "@/sim/scenarios/trafficSpikes";
import { DATA_STRATEGY as D } from "@/sim/scenarios/dataStrategy";
import { canEnterData, databaseUpgrade, pendingStop, routableApps } from "@/sim/step";
import { pendingReliability, effectiveTargets, researchBalance, installPending } from "@/sim/reliability";
import { pendingPreventionReview } from "@/sim/openingPrevention";
import { APPLICATION_RELIABILITY as R } from "@/sim/scenarios/applicationReliability";
import { campaignGuidance, type Requirement } from "@/game/campaignGuidance";
import { campaignChapters, finishedChapter } from "@/game/campaignChapters";
import TechTree from "./TechTree";
import { AccountSection, CloudSavesSection } from "./Account";
import { FinanceEntry } from "./CampaignFinance";
import { AppHealthEntry } from "./CampaignAppHealth";
import { ApplicationInstances } from "./CampaignEvidence";
import { CampaignUnavailable, CampaignDecisionButton } from "./CampaignInfrastructure";
import { INFRASTRUCTURE_TIPS } from "@/game/infrastructureHelp";
import { HomeScreen } from "./HomeScreen";
import { CampaignChapters } from "./CampaignChapters";
import { isChapterEntry } from "@/game/campaignChapters";
import { APPLICATION_SCALING as P } from "@/sim/scenarios/applicationScaling";
import { exportPlaytest, type ChapterCompletion } from "@/game/persist";
import { money, num } from "@/game/format";
import { useEffect, useState, type ReactNode } from "react";
import { useCampaignAttention } from "./useCampaignAttention";
import { CampaignHintButton } from "./CampaignAttention";
import { CampaignIncidentReport, CampaignRecoveryReview } from "./CampaignIncidentReport";
import { campaignClockAvailable, inspectOrSelect, useGame, walkthroughHoldsClock } from "@/game/store";
import { GraphicsSettings } from "./GraphicsSettings";
import { ControlSettings } from "./ControlSettings";
import { AvatarSettings } from "./AvatarPicker";
import { MenuMap } from "./MenuMap";
import { MenuTabs, type MenuTab } from "./MenuTabs";
import { MenuActions, MenuRun, MenuTile } from "./MenuRun";
import { useMenuExit } from "./MenuExit";
import { SaveFiles } from "./SaveFiles";
import { SoundButton } from "./SoundButton";
import { SoundSettings } from "./SoundSettings";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
import type { Campaign, CampaignPostmortem, Intervention, ScheduledAction } from "@/sim/campaignTypes";
import { completedTechIds, TECH_ORDER, type EventKind } from "@/sim";
import { AnalyticsSettings } from "./AnalyticsSettings";
import { FeedbackButton } from "./FeedbackButton";
import { Icon } from "./icons";
import { tipProps } from "./tips";
import { CHART_COLORS, EQUIPMENT_ICON } from "./presentation";
import { ModeSwitch } from "./ModeSwitch";
import { EventFeed, HistoryTabs, LineChart, type HistoryTab } from "./Views";
import { ViewSheet, ViewTabs } from "./ViewSheet";
import { Callout, Concept, Meter, Modal, Row, Stat } from "./ui";

const dollars = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(c / 100);
const PLACES = ["gateway", "app", "cache", "db", "monitoring"] as const;
const PLACE_NAMES = { gateway: "Network", app: "App Server", db: "Database", monitoring: "Monitoring", cache: "Read Cache" };
/** Inspecting the office rooms reports how the company works; they are room inspections, not measured components. */
const OFFICE_EVIDENCE = {
  team: { name: "Team", text: "Engineers operate the infrastructure and carry out scheduled changes." },
  deploy: { name: "Deploy", text: "Infrastructure changes activate after their listed delay." },
  growth: { name: "Growth", text: "Growth stages increase demand on the system." },
} as const;
const ACTION_NAMES: Record<Intervention, string> = {
  "add-app": "Add server", "upgrade-db": "Database upgrade", limit: "Traffic limit", unlimit: "Remove traffic limit", "scale-up":"Application scale up", "deploy-lb":"Load balancer deployment", routing:"Routing change", cache:"Read Cache deployment", "cache-tuning":"Cache tuning",
  "deploy-autoscaler":"Autoscaling controller deployment", "retire-app":"Safe application retirement", "health-checks":"Health Checks deployment", "create-spare":"Spare application install", "reserve-spare":"Reserve spare", "release-spare":"Release spare", failover:"Automatic Failover deployment", "promote-spare":"Promote spare", "restore-app":"Restore application", promotion:"Promotion",
};
const appName = (id: string) => `App ${id.slice(4)}`;
const sameTargets = (a: string[], b: string[]) => a.length === b.length && b.every(id => a.includes(id));
/** Where the load balancer can send traffic: every installed app, or one of them. A reserved spare is not a choice. */
function routeOptions(c: Campaign) {
  const apps = routableApps(c).map(a => a.id);
  const one = apps.map(id => ({ label: `${appName(id)} only`, targets: [id], tip: `Send every request to ${appName(id)}. The other apps stay installed and keep their running costs.` }));
  return apps.length > 1 ? [{ label: "All apps", targets: apps, tip: "The load balancer spreads requests across every installed app." }, ...one] : one;
}
function routeName(c: Campaign) {
  const t = c.routing.targets, apps = routableApps(c).map(a => a.id);
  return apps.length > 1 && sameTargets(t, apps) ? "all apps" : t.length === 1 ? `${appName(t[0])} only` : t.map(appName).join(", ");
}
const STEP_STATUS = { done: "Done", current: "Current step", upcoming: "Not yet" } as const;
/** The chapter's sequence: finished steps recede, the current one carries its hint and later ones stay neutral. */
function StepList({items,current,label}:{items:Requirement[];current:Requirement|null;label:string}) {
  return <ol className="progression-steps" aria-label={label}>{items.map((r,i)=>{
    const state=r.met?"done":r===current?"current":"upcoming";
    return <li key={r.id} data-requirement={r.id} data-met={r.met} data-state={state}>
      <span className="progression-marker" aria-hidden="true">{r.met?<Icon name="check" size={12} />:i+1}</span>
      <span className="progression-text"><span className="visually-hidden">{STEP_STATUS[state]}: </span>{r.label}{state==="current"&&r.hint&&<small>{r.hint}</small>}</span>
    </li>;})}</ol>;
}
/** Standing company checks fold into one line while they all pass and only list the ones that need attention. */
function CompanyChecks({items}:{items:Requirement[]}) {
  if(!items.length) return null;
  const failing=items.filter(r=>!r.met);
  if(!failing.length) return <p className="company-checks" data-requirement="company-checks" data-met="true"><Icon name="check" size={14} />All {items.length} company checks pass</p>;
  return <div className="company-checks" data-requirement="company-checks" data-met="false">
    <p><Icon name="alert" size={14} />{failing.length} of {items.length} company checks need attention</p>
    <ul>{failing.map(r=><li key={r.id} data-requirement={r.id} data-met="false"><span className="visually-hidden">Needs attention: </span>{r.label}{r.hint&&<small>{r.hint}</small>}</li>)}</ul>
  </div>;
}

// Progress is derived from the engine; reading this panel never advances the run.
function CampaignGuidance() {
  const {game,act}=useGame(),c=game.campaign!;
  const model=campaignGuidance(game),action=model.pendingAction;
  const financialRisk=chapter6FinancialRisk(game);
  // The next action sits directly under the steps it advances.
  const cta=<>
    {action?.action&&!isChapterEntry(action.action)&&<button className="btn btn-primary" data-guidance={action.action.type} disabled={game.phase==="ended"} onClick={()=>act(action.action!)}>{action.label}<Icon name="next" /></button>}
    {action&&!action.action&&<button className="btn btn-primary" onClick={()=>useGame.getState().openView(null)}>{action.label}<Icon name="next" /></button>}
  </>;

  return <section className="campaign-guidance" aria-label="Guided Mode guidance">
    {financialRisk&&<Callout compact tone="warn" icon="cash" kicker={financialRisk.kind==="blocked"?"Capacity funding blocked":"Money at risk"}><span role="note">{financialRisk.message}</span></Callout>}
    {c.combinedStage&&model.waiting&&<p role="status">{model.waiting}</p>}
    {model.requirements.length>0&&<section className="campaign-requirements" aria-label="Guided Mode requirements"><h3 className="campaign-requirements-heading">{c.combinedStage?"Current growth requirements":"Chapter requirements"}<span> · {model.steps.filter(r=>r.met).length}/{model.steps.length}<span className="visually-hidden"> steps done</span></span></h3>
      <CompanyChecks items={model.checks}/>
      <StepList items={model.steps} current={model.current} label="Chapter steps"/>
      {cta}
      {!c.combinedStage&&model.waiting&&<p role="status">{model.waiting}</p>}
      {model.notice&&<p role="note">{model.notice}</p>}
      {model.optional&&<p className="muted">{model.optional}</p>}
    </section>}
    {model.finalGoals.length>0&&<section className="campaign-requirements" aria-label="Final Campaign goals"><h3 className="campaign-requirements-heading">Final Campaign goals</h3><StepList items={model.finalGoals} current={null} label="Final Campaign goals"/></section>}
    {!model.requirements.length&&cta}
    {c.openingMilestone?.acknowledged&&!c.dataStage&&!c.scaling?.consumed&&!c.scalingConsent&&<ScalingRiskConsent/>}
    {c.scorecard&&<button className="btn" onClick={()=>useGame.getState().openView("scorecard")}>View run scorecard</button>}
    {model.prevention&&!c.openingPrevention?.outcome&&<section className="prevention-guidance" aria-label="Opening prevention progress">
      <p role="status">Stable service: {c.openingPrevention?.stableSteps??0} / {Q.stableSteps} game seconds. Pausing adds no time; unhealthy service restarts the counter.</p>
      <div className="btn-row"><button className="btn btn-small" onClick={()=>inspectOrSelect("app","app-1")}>Inspect Application</button><button className="btn btn-small" onClick={()=>inspectOrSelect("db")}>Inspect Database</button></div>
    </section>}

  </section>;
}

function IncidentRecovery({ campaign: c }: { campaign: Campaign }) {
  const fault = currentFault(c);
  const failedAppActive = fault && fault.startedStep !== null && fault.restoredStep === null;
  return <section className="incident-clock campaign-stability" aria-label="Incident recovery">
    <div className="clock-row"><h3><Icon name="health" size={20} />Recovery progress</h3><strong>{c.incident!.stableSteps}/{Q.stableSteps} s</strong></div>
    <Meter value={c.incident!.stableSteps / Q.stableSteps} tone="ok" label="Recovery progress" />
    <p>Meet every condition for <b>{Q.stableSteps} consecutive game seconds</b>:</p>
    <ul className="recovery-conditions">
      <li><Icon name="latency" size={16} /><span>Latency below <b>{Q.latencyThresholdMs} ms</b></span></li>
      <li><Icon name="error" size={16} /><span>Service errors below <b>{Q.errorThreshold * 100}%</b></span></li>
      <li><Icon name="revenue" size={16} /><span>Traffic is being accepted and requests are completing</span></li>
      {failedAppActive && <li><Icon name="server" size={16} /><span>Failed server restored, or removed from traffic with an empty queue</span></li>}
    </ul>
    <p className="recovery-note">An unhealthy second resets progress. Pausing freezes it.</p>
  </section>;
}

export function CampaignHeader() {
  const { game, openView, started } = useGame(), c = game.campaign!;
  const incident = game.phase === "incident";
  const guidance = useCampaignAttention();
  return <><header className={`topbar${incident ? " is-incident" : ""}${guidance.available ? " has-global-hint" : ""}`}>
    <div className="brand"><span className="brand-mark">99.99%</span>
    </div>
    <div className="stats-strip">
      <FinanceEntry />
      <Stat icon="users" kind="users" label="Users" tip="Registered users and incoming requests are different. Inspect incoming req/s to see current demand.">
        <strong>{num(game.users)}</strong>
      </Stat>
      <Stat icon="revenue" kind="revenue" label="Pending revenue" tip={`${dollars(c.ledger.successes * Q.revenueCents)} earned this operating week, not yet added to cash. Only successful requests earn revenue.`}>
        <strong>{money(c.ledger.successes * Q.revenueCents / 100)}</strong><span className="muted">unsettled</span>
      </Stat>
      <AppHealthEntry />
    </div>
    <CampaignHintButton />
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
  const office = selected === "team" || selected === "deploy" || selected === "growth" ? selected : null;
  return <EquipmentPanel className="campaign-panel" label="System metrics">
    <section className={`panel-section${incident ? " incident" : ""}`} aria-label={incident ? "Incident" : "System overview"}>
      {incident && <header className="panel-head">
        <span className={`panel-icon${incident ? " state-critical" : ""}`}><Icon name={incident ? "incident" : "monitor"} /></span>
        <div><h2>{incident ? "Service slowdown" : "System overview"}</h2>
          {incident && <span className="state state-critical"><Icon name="alert" size={12} />Incident</span>}
        </div>
      </header>}
      <CampaignGuidance />
      <div className="incident-symptoms">
        <dl className="impact">
          <div><Concept kind={m.latencyMs >= Q.latencyThresholdMs ? "critical" : "users"} icon="timer" /><dt>Latency · ms</dt><dd>{m.latencyMs.toFixed(0)}</dd></div>
          <div><Concept kind={m.serviceErrorRate !== null && m.serviceErrorRate >= Q.errorThreshold ? "critical" : "muted"} icon="error" /><dt>Errors · %</dt><dd>{m.serviceErrorRate === null ? "—" : (m.serviceErrorRate * 100).toFixed(2)}</dd></div>
          <div><Concept kind="tech" icon="backlog" /><dt>Backlog</dt><dd>{num(m.app.backlog + m.db.backlog)}</dd></div>
        </dl>
      </div>
      {c.incident && <IncidentRecovery campaign={c} />}
      <div className="incident-investigate">
        <h4 className="step-head">Inspect equipment</h4>
        <div className="chips">{PLACES.filter(id=>id!=="cache"||c.dataStage).map(id => <button type="button" key={id} data-tutorial={`inspect-${id}`} className={`chip${place === id ? " is-selected" : ""}`} aria-pressed={place === id} disabled={disabled} {...tipProps(INFRASTRUCTURE_TIPS[id])} onClick={() => place === id ? useGame.getState().select(null) : inspectOrSelect(id)}>
          <span className="chip-icon" aria-hidden="true"><Icon name={EQUIPMENT_ICON[id]} size={16} /></span>{PLACE_NAMES[id]}
        </button>)}</div>
        {place && <CampaignReadings place={place} campaign={c} />}
        {office && <div className="campaign-evidence" role="status"><Callout compact tone="info" icon={EQUIPMENT_ICON[office]} kicker={`${OFFICE_EVIDENCE[office].name} · Company operations`}>
          {OFFICE_EVIDENCE[office].text}
        </Callout></div>}
        {unlocked && selected === "app" && <details className="more" open><summary>Application instances · {c.routing.mode} routing</summary>
          <ApplicationInstances campaign={c} recipients={recipients} selectedAppId={selectedAppId} onSelect={id=>inspectOrSelect("app",id)} /></details>}
      </div>
      <h4 className="step-head">Actions</h4>
      <ul className="actions">
        <li><Act icon="server" label="Add server" price={Q.appCostCents / 100} note={`${Q.appDelay} game seconds`} disabled={disabled || busy || c.apps.length >= (c.spikeStage ? T.maximum : Q.maxApps) || c.cashCents <= Q.appCostCents} tip="Adds installed application capacity. Without routing, a new server does not receive traffic." decision={{ type: "add_server" }} onClick={() => act({ type: "add_server" })} /></li>
        <li><Act icon="database" label="Upgrade database" price={dbUpgrade?dbUpgrade.costCents/100:undefined} note={dbUpgrade?`${dbUpgrade.delay} game seconds · ${num(dbUpgrade.capacity)} ops/s`:"Current stage tier reached"} disabled={disabled || busy || !dbUpgrade || c.cashCents <= dbUpgrade.costCents} tip={dbUpgrade?"Increases database capacity after activation. Running costs also increase.":c.dataStage?"The database is at the highest available tier.":"Further database capacity unlocks after explicitly entering the next Guided Mode stage."} decision={{ type: "start_db_upgrade" }} onClick={() => act({ type: "start_db_upgrade" })} /></li>
        <li><Act icon="limit" label={c.limit === null ? "Limit to 500 requests/s" : "Remove traffic limit"} price={0} note={`${Q.admissionDelay} game second`} disabled={disabled || admissionPending} tip="Changes admitted traffic at the next game second. Rejected requests earn no revenue." decision={{ type: "set_traffic_limit", enabled: c.limit === null }} onClick={() => act({ type: "set_traffic_limit", enabled: c.limit === null })} /></li>
      </ul>
      {c.reliabilityStage&&<ReliabilityControls disabled={disabled} busy={installPending(c)} />}
      {unlocked && <section aria-label="Scaling controls" className="scaling-controls">
        <h4 className="step-head">Scale and route</h4>
        <ul className="actions">
          <li><Act icon="scaleUp" label={`Scale up ${appName(selectedApp.id)}`} price={P.appCostCents/100} note={`${P.appDelay} game seconds`} disabled={disabled||busy||selectedApp.tier!=="base"||c.cashCents<=P.appCostCents} tip="Increases only the selected application's capacity. Database capacity stays unchanged." decision={{type:"scale_up",appId:selectedApp.id}} onClick={()=>act({type:"scale_up",appId:selectedApp.id})}/></li>
          <li><Act icon="shuffle" label="Deploy load balancing" price={P.lbCostCents/100} note={`${P.lbDelay} game seconds`} disabled={disabled||busy||c.loadBalancer||c.cashCents<=P.lbCostCents} tip="Installs a load balancer. Traffic changes only after you explicitly configure routing." decision={{type:"deploy_load_balancer"}} onClick={()=>act({type:"deploy_load_balancer"})}/></li>
        </ul>
        <details className="more"><summary>Configure routing · {routeName(c)}</summary>
        <fieldset className="route-choice" disabled={disabled||!c.loadBalancer||c.pending.some(a=>a.type==="routing"||a.type==="retire-app")}><legend>Send traffic to · changes next game second</legend>
          {routeOptions(c).map(o=>{const on=sameTargets(c.routing.targets,o.targets);return <CampaignDecisionButton decision={{type:"set_routing",mode:"balanced",targets:o.targets}} key={o.label} type="button" className={on?"is-active":""} aria-pressed={on} onClick={()=>{if(!on)act({type:"set_routing",mode:"balanced",targets:o.targets});}} {...tipProps(o.tip)}>{o.label}</CampaignDecisionButton>;})}
        </fieldset><CampaignUnavailable action={{type:"set_routing",mode:"balanced",targets:routableApps(c).map(a=>a.id)}} disabled={disabled||!c.loadBalancer||c.pending.some(a=>a.type==="routing"||a.type==="retire-app")} />{!c.loadBalancer&&<p role="note">Deploy load balancing before configuring routing.</p>}{c.pending.some(a=>a.type==="routing"||a.type==="retire-app")&&<p role="note">A routing or retirement change is pending; wait for activation.</p>}</details>
        <p className="muted">{c.scaling?.consumed?(c.dataStage?"Scaling growth recorded: 1,400 requests/s before data growth.":"Traffic growth applied: 1,400 requests/s."):c.dbCapacity<P.dbCapacity&&!c.scalingConsent?"Next growth waits for a paid database upgrade to 2,000 ops/s.":c.incident||c.dbBacklog||c.apps.some(a=>a.backlog)?"Growth waits until the incident and backlogs clear.":c.scaling?.dueStep?`Growth due at game second ${c.scaling.dueStep} while ready.`:"Growth readiness is checked on the next game second."}</p>
      </section>}
      {c.dataStage&&<section aria-label="Data strategy" className="scaling-controls">
        <h4 className="step-head"><Icon name={EQUIPMENT_ICON.cache} size={16} />Data strategy</h4>
        <p>Workload: {c.dataStage.consumed?(c.combinedStage?combinedProfile(c):c.dataStage.profile):"Waiting for workload growth"}. {c.dataStage.dueStep!==null&&!c.dataStage.consumed?`Growth due at game second ${c.dataStage.dueStep} while ready.`:""}</p>
        <ul className="actions">
          <li><Act icon="bolt" label="Deploy Read Cache" price={D.cacheCostCents/100} note={`${D.cacheDelay} game seconds`} disabled={disabled||busy||!!c.readCache||c.cashCents<=D.cacheCostCents} tip="Activates cold. Only eligible reads can hit; misses and writes still reach the database." decision={{type:"deploy_cache"}} onClick={()=>act({type:"deploy_cache"})}/></li>
          <li><Act icon="sliders" label={`Tune cache ceiling to ${D.tunedTarget/100}%`} price={D.tuningCostCents/100} note={`${D.tuningDelay} game seconds`} disabled={disabled||busy||!c.readCache||c.readCache.tuned||c.cashCents<=D.tuningCostCents} tip="Raises only the hit-rate ceiling; preserves warmth, warm-up speed and upkeep. Requires a deployed, untuned cache." decision={{type:"tune_cache"}} onClick={()=>act({type:"tune_cache"})}/></li>
        </ul>
        <details className="more"><summary>Observe another workload</summary>
          <CampaignDecisionButton className="btn" disabled={disabled||!c.dataStage.consumed||c.dataStage.contrastConsumed||!!c.spikeStage||!canEnterData(game)} decision={{type:"contrast_workload"}} onClick={()=>act({type:"contrast_workload"})}>Observe contrasting workload</CampaignDecisionButton>
        </details>
      </section>}
      {c.combinedStage&&<CombinedControls disabled={disabled}/>}
      {c.pending.map(a => <div className="working campaign-working" role="status" key={a.id}>
        <span>{ACTION_NAMES[a.type]}{a.targetId?` (${appName(a.targetId)})`:""}: activates in {a.activationStep - c.step} game second(s)</span>
        <Meter value={(c.step - a.requestedStep) / (a.activationStep - a.requestedStep)} label={`${ACTION_NAMES[a.type]} activation`} />
      </div>)}
      {c.apps.some(a=>!a.routed) && <p className="muted">{c.apps.filter(a=>!a.routed).map(a=>appName(a.id)).join(", ")}: Installed, not receiving traffic</p>}
      {c.limit!==null&&<Callout compact tone="warn" icon="network" kicker="Traffic limit active">{num(m.admitted)} admitted / {num(m.rejected)} rejected req/s. Rejected requests earn no revenue. <strong>Infrastructure and salaries still cost the same.</strong></Callout>}
    </section>
    {c.spikeStage&&<SpikeControls disabled={disabled} busy={busy}/>}
  </EquipmentPanel>;
}

function SpikeControls({disabled,busy}:{disabled:boolean;busy:boolean}) {
 const {game,act}=useGame(),c=game.campaign!,d=c.spikeStage!,a=d.controller,o=c.snapshot.spikes;
 const pulse=spikeInput(c)===T.peak, next=d.deadlines.find(step=>step>c.step);
 return <section className="panel-section scaling-controls" aria-label="Traffic spikes and autoscaling">
  <h4 className="step-head"><Icon name="load" size={16}/>Traffic Spikes &amp; Autoscaling</h4>
  <Callout compact tone={pulse?"warn":"info"} icon="load" kicker={pulse?"TRAFFIC SPIKE ACTIVE":"Baseline demand"}>
   Incoming {num(c.snapshot.incoming)} req/s. {next!==undefined?`Next pulse boundary in ${next-c.step} game seconds (game second ${next}).`:"Both pulses ended. Stable baseline service completes the stage."}
  </Callout>
  <p role="status">Controller: {a?(a.enabled?"Enabled":"Disabled"):"Not deployed"}. {a?.blockedReason??""}</p>
  <ul className="actions">
   <li><Act icon="lock" label="Unlock autoscaling" note="1 research point" noteIcon="bulb" disabled={disabled||!!d.researchSpent} tip="Spend the data-readiness point to unlock this capability. Deployment is a separate purchase." decision={{type:"unlock_autoscaling"}} onClick={()=>act({type:"unlock_autoscaling"})}/></li>
   <li><Act icon="scale" label="Deploy autoscaling" price={T.controllerCostCents/100} note={`${T.controllerDelay} game seconds`} disabled={disabled||busy||!d.researchSpent||!!a||!c.loadBalancer||c.routing.mode!=="balanced"||c.routing.targets.length<2||c.cashCents<=T.controllerCostCents} tip="Requires balanced routing to at least two apps. Controller upkeep is $100 per operating week, including while disabled." decision={{type:"deploy_autoscaler"}} onClick={()=>act({type:"deploy_autoscaler"})}/></li>
   {a&&<li><button className="btn" disabled={disabled} aria-pressed={a.enabled} onClick={()=>act({type:"set_autoscaling",enabled:!a.enabled})}>{a.enabled?"Disable autoscaling":"Enable autoscaling"}</button></li>}
  </ul>
  <details className="more"><summary>Controller evidence and costs</summary>
   <p>Research: {researchBalance(c)} point(s) available. Autoscaling {d.researchSpent?"unlocked":"locked"}. Normal demand {T.baseline}; spike demand {T.peak} req/s.</p>
   <p>Installed {c.apps.length} / maximum {T.maximum}; routed {c.routing.targets.length}. Automatic apps cost $1,000 setup and $700/week after installation. Controller upkeep: $100/week, including while disabled.</p>
   <p>Observed routed busy utilisation: {o?`${(o.routedBusyBasisPoints/100).toFixed(2)}%`:"No controller observation yet"}. High-utilization observations: {a?.highSteps??0} / 3; low-utilization observations: {a?.lowSteps??0} / 6.</p>
   <p>Scale out above 80% for 3 game seconds. Empty controller apps may retire below 60% for 6 safe game seconds; minimum 2. Cooldown remaining: {Math.max(0,(a?.cooldownUntil??0)-c.step)} game seconds.</p>
   <p>Automatic provisioning takes 3 game seconds, followed by 1 routing game second. {a?.joiningAppId?`Joining ${a.joiningAppId.replace("app-","App ")}; installed capacity may still be unrouted.`:"No automatic app awaiting routing."}</p>
   <p>Application automation cannot increase DB capacity, cache effectiveness or admitted traffic. Manual investments and traffic limiting remain available.</p>
  </details>
 </section>;
}

/** Manual steps beside Run: one game second to watch a decision land, five to see a trend. */
const STEPS = [{ count: 1, icon: "step" }, { count: 5, icon: "stepMany" }] as const;

export function CampaignControls() {
  const { game, running, setRunning, stepSeconds } = useGame();
  const { runGold, pauseGold } = useCampaignAttention();
  const held = useGame(walkthroughHoldsClock);
  const steppable = useGame(campaignClockAvailable);
  const active = useGame(s=>s.started) && !held && pendingStop(game.campaign) === null && !(game.campaign!.openingMilestone && !game.campaign!.openingMilestone.acknowledged) && (game.phase === "management" || game.phase === "incident");
  return <footer className={`bottombar controls-dock campaign-clock${running?" is-running":" is-paused"}`}>
    <ViewTabs tabs={[
      { id: "tech", label: "Tech", icon: "tree", badge: `${completedTechIds(game).length}/${TECH_ORDER.length}` },
      { id: "history", label: "History", icon: "history", badge: game.campaign!.reports.length > 0 ? String(game.campaign!.reports.length) : null },
    ]} />
    <RoomControlsSlot />
    <div className="time-controls" role="group" aria-label="Time">
      <div className={`week${game.phase === "incident" ? " is-incident" : ""}`}>
        <span className="brand-week"><Icon name="week" size={16} /><span>Week <strong>{game.turn}</strong></span></span>
        <span className="dock-second"><Icon name="time" size={14} /><span>{game.campaign!.step % Q.periodSteps} / {Q.periodSteps} s</span></span>
        <Meter value={(game.campaign!.step % Q.periodSteps) / Q.periodSteps} label="Operating week progress" />
        <span className="visually-hidden" aria-hidden="true" data-testid="physical-step">{game.campaign!.step}</span>
      </div>
      <TimeMenu />
      <div className="dock-steps" role="group" aria-label="Step time">
        {STEPS.map(({ count, icon }) => <button type="button" key={count} className="dock-step" aria-label={`Step ${count} game ${count === 1 ? "second" : "seconds"}`}
          {...tipProps(held ? "Finish the walkthrough to run the company" : `Pause and advance exactly ${count} game ${count === 1 ? "second" : "seconds"}${count === 1 ? " (N)" : ""}`)}
          disabled={!steppable} onClick={() => stepSeconds(count)}><Icon name={icon} size={16} /><span>+{count}s</span></button>)}
      </div>
      <button type="button" className={`btn btn-primary campaign-play dock-primary${running ? " is-on" : ""}${runGold || pauseGold ? " campaign-gold-attention" : ""}`} aria-label={running ? "Pause" : "Run"} {...tipProps(held ? "Finish the walkthrough to run the company" : "Run or pause the company (P)")} disabled={!active} onClick={() => setRunning(!running)}><Icon name={running ? "pause" : "play"} /><span>{running ? "Pause" : "Run"}</span></button>
      <span className="visually-hidden" role="status">{running ? "Running" : "Paused"}</span>
    </div>
  </footer>;
}

function Report({ report }: { report: CampaignPostmortem }) {
  return <CampaignIncidentReport report={report}/>;
}

/** The campaign menu: the same run card, Resume, tabs and tiles as Classic's, with the company's own actions. */
function CampaignMenu({ initialTab }: { initialTab: MenuTab }) {
  const { game, openView, newRun, saveNow, saveBlocked, saveStatus, measurement, tutorialCompany } = useGame();
  const c = game.campaign!;
  const [tab, setTab] = useState<MenuTab>(initialTab);
  const [confirmReset, setConfirmReset] = useState(false);
  const [intervention, setIntervention] = useState("");
  const exit = useMenuExit();
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
  if (exit.dialog) return exit.dialog;
  return <Modal title="Menu" icon={{ kind: "go", name: "menu" }} onClose={close} className="modal-menu">
    <MenuRun title={tutorialCompany ? "Walkthrough practice" : "At a glance"} saved={saveStatus === "saved"}
      stats={[
        { icon: "week", kind: "go", label: "Week", value: game.turn },
        { icon: "time", kind: "muted", label: "Game second", value: c.step },
        { icon: "users", kind: "users", label: "Users", value: num(game.users) },
        { icon: "cash", kind: "cash", label: "Cash", value: money(c.cashCents / 100) },
      ]}
      />
    {tutorialCompany && <button className="btn btn-primary" onClick={() => useGame.getState().endTour(false)}><Icon name="next" size={18} />Return to game</button>}
    {(c.scorecard||c.combinedStage?.finalReview)&&<button className="btn" onClick={()=>openView("scorecard")}>View run scorecard</button>}
    {saveBlocked && <Callout tone="warn" icon="save" kicker="Save preserved" live="alert">Your stored save is unreadable or unsupported and has been preserved. This run stays in memory until you explicitly reset.</Callout>}
    <MenuTabs value={tab} onChange={goTo}>
      {tab === "run" && <>
        <MenuActions onResume={close}>
          <div data-tutorial="save-now"><MenuTile icon="save" kind="ok" title="Save now" text="Write this company to the browser." onClick={() => saveNow()} /></div>
          <MenuTile icon="info" kind="users" title="How to play" text="Replay the walkthrough: controls, game time, finances and the route through your company." onClick={() => useGame.getState().startTour("campaign")} />
          <MenuTile icon="logout" title="Exit" text="Return to the title screen." onClick={exit.exit} buttonRef={exit.exitButton} />
        </MenuActions>
        <ModeSwitch to="classic" />
      </>}
      {tab === "map" && <MenuMap />}
      {tab === "sound" && <SoundSettings />}
      {tab === "graphics" && <GraphicsSettings />}
      {tab === "controls" && <ControlSettings />}
      {tab === "avatar" && <AvatarSettings />}
      {tab === "saves" && <>
        <div className="menu-columns">
        <div className="menu-col"><SaveFiles /></div>
        <div className="menu-col">
          <section className="menu-section menu-danger" aria-label="Start over"><h4><Icon name="refresh" size={20} />Start over</h4>
            <div className="menu-actions"><button type="button" className={`btn${confirmReset ? " btn-danger" : ""}`} onClick={reset}><Icon name="refresh" size={20} />{confirmReset ? "Lose this company? Press again" : "New company"}</button></div>
            {confirmReset && <Callout compact tone="warn" icon="alert" kicker="Are you sure?">This replaces only the current Guided Mode save. Export it first if you want to keep it. Press the button again to confirm.</Callout>}
          </section>
        </div>
        </div>
        <CloudSavesSection onOpenAccount={() => goTo("account")} />
      </>}
      {tab === "account" && <AccountSection />}
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
/**
 * What another edition's shell can put in place of the desktop's own: the home screen, the menu, and the dialog
 * shown when a chapter without its own recognition is finished. Everything else is shared.
 */
export interface CampaignOverlaySlots {
  home?: ReactNode;
  menu?: (initialTab: MenuTab) => ReactNode;
  chapterComplete?: (chapter: ChapterCompletion) => ReactNode;
}

export function CampaignOverlays({ home, menu, chapterComplete }: CampaignOverlaySlots = {}) {
  const { started, view } = useGame();
  if (!started) return home ?? <HomeScreen />;
  // Tech and History open over the room from the bottom bar, as in Classic; dialogs that need an answer sit above them.
  return <>
    {view === "tech" && <ViewSheet view="tech"><p className="campaign-tech-intro"><Icon name="tree" size={16} /> Technologies are capabilities. Select an icon to see its effect. <strong>Owned does not mean deployed.</strong> Deployments and their running costs appear in Actions.</p><TechTree /></ViewSheet>}
    {view === "history" && <ViewSheet view="history"><p className="campaign-tech-intro"><Icon name="history" size={16} /> Check what changed after a decision. <strong>Charts</strong> show trends, <strong>Events</strong> list your decisions and <strong>Incidents</strong> hold the reports.</p><CampaignHistory /></ViewSheet>}
    <CampaignDialog menu={menu} chapterComplete={chapterComplete} />
  </>;
}

/** The one dialog that currently needs the player, if any. */
function CampaignDialog({ menu, chapterComplete: completeSlot }: Pick<CampaignOverlaySlots, "menu" | "chapterComplete">) {
  const { game, view, openView, act, chapterComplete, tour, tutorialCompany } = useGame();
  const c = game.campaign!;
  if(view==="scorecard"&&(c.scorecard||c.combinedStage?.finalReview))return <Modal title="Company scorecard" className="campaign-recovery-report" onClose={()=>openView("guidance")}><CampaignScorecard card={(c.scorecard??c.combinedStage!.finalReview)!} pendingReview={!c.scorecard}/></Modal>;
  if(pendingCombined(c)&&!["guidance","menu","history"].includes(view??"")){
    const d=c.combinedStage!,r=d.currentRound;
    return <Modal title={d.finalReview?"Final campaign review":"Growth outcome"} className="campaign-recovery-report" onClose={()=>openView("guidance")}>
      {d.finalReview?<><CampaignScorecard card={d.finalReview} pendingReview/><div className="modal-foot"><button className="btn btn-primary" onClick={()=>act({type:"complete_campaign"})}>Complete campaign</button></div></>:
        <><CampaignReport lesson={outcomeSummary(c,"growth",r!)}>
          <h4>Recorded growth outcome</h4><p>{r!.scenario.template}: registered users reached {r!.users.toLocaleString("en-US")}. Temporary pressure has ended.</p>
          <p>All applications restored; five stable full-demand baseline game seconds; actual incident reports acknowledged.</p>
          <p>Rejected requests during this round: {c.cumulative.rejected-r!.rejectedBefore}; setup spending {dollars(c.investedCents-r!.setupBefore)}. Review actual actions and causal reports in History.</p>
          <h4>Recorded growth round</h4><RecordedFields data={r!} />
        </CampaignReport><ContinueFoot label="Continue company" onClick={()=>act({type:"acknowledge_growth"})}/></>}
    </Modal>;
  }
  if (pendingReliability(c)) return <Modal title="Reliability outcome" className="campaign-recovery-report" icon={{ kind: "ok", name: "health" }}>
    <ReliabilityOutcome campaign={c} />
    <ContinueFoot label="Continue operating" onClick={()=>act({type:"acknowledge_reliability"})} />
  </Modal>;
  if (pendingPreventionReview(c)) return <Modal title="Prevention review" wide className="campaign-recovery-report" icon={{ kind: "ok", name: "health" }}><PreventionOutcome campaign={c} /><ContinueFoot label="Continue company" onClick={()=>act({type:"acknowledge_prevention_review"})} /></Modal>;
  if (game.phase === "review") {
    const report = c.reports[c.reports.length - 1];
    if (!tutorialCompany && tour?.track !== "campaign") return <CampaignRecoveryReview key={`${c.runId}:${report.id}:${report.recoveredStep}`} runId={c.runId} report={report} reliability={!c.combinedStage ? reliabilityLesson(c, report) : undefined} onContinue={() => act({ type: "acknowledge_review" })} />;
    return <Modal title="Incident postmortem" wide className="campaign-recovery-report" icon={{ kind: "ok", name: "incident" }}><Report report={report} /><ContinueFoot label="Continue company" onClick={() => act({ type: "acknowledge_review" })} /></Modal>;
  }
  if(c.openingMilestone&&!c.openingMilestone.acknowledged)return <Modal title="First growth challenge handled" className="campaign-recovery-report" icon={{ kind: "go", name: "goal" }}>
    <CampaignReport lesson={outcomeSummary(c,"opening")}><p>{c.openingMilestone.outcomeId?"You handled Opening growth without an incident.":"You recovered your first production incident."} Your company is still operating. Your architecture, cash and pending work are preserved.</p>
    <p>{c.limit!==null?"The traffic limit remains active: rejected demand still has a revenue trade-off.":"Your company is serving its current demand."} Next: application scaling and routing.</p><h4>Recorded milestone</h4><RecordedFields data={c.openingMilestone} /></CampaignReport>
    <ContinueFoot label="Continue operating" onClick={()=>act({type:"acknowledge_milestone"})} />
  </Modal>;
  if(pendingSpikeAcknowledgement(c) && view!=="menu" && view!=="history") return <Modal title="Spike response handled" className="campaign-recovery-report" icon={{ kind: "go", name: "goal" }} onClose={()=>openView("history")}><CampaignReport lesson={outcomeSummary(c,"spikes")}><p>Both demand pulses ended and five baseline game seconds qualified for stable service. The same company continues with its investments and operating costs.</p><h4>Recorded spike stage</h4><RecordedFields data={c.spikeStage!} /></CampaignReport><ContinueFoot label="Continue operating" onClick={()=>act({type:"acknowledge_spikes"})} /></Modal>;
  // It pauses the clock when it appears, so it shows over History and guidance rather than waiting behind them.
  if(chapterComplete&&chapterComplete===finishedChapter(game)&&view!=="menu")return completeSlot ? completeSlot(chapterComplete) : <ChapterComplete chapter={chapterComplete} />;
  if(game.phase==="ended"&&game.outcome==="won"&&!["guidance","menu","history","tech"].includes(view??""))return <Modal title="Campaign complete" className="campaign-recovery-report" onClose={()=>openView("guidance")}><CampaignScorecard card={c.scorecard!}/><div className="modal-foot"><button className="btn" onClick={()=>openView("guidance")}>Inspect final company</button><button className="btn" onClick={()=>openView("menu")}>Export or start a new company</button></div></Modal>;
  if (game.phase === "ended" && game.outcome !== "won" && view === null) return <Modal title="Company bankrupt" className="campaign-recovery-report" tone="alert" icon={{ kind: "critical", name: "cash" }} onClose={() => openView("menu")}>
    <CampaignReport lesson={c.scorecard?scorecardSummary(c.scorecard,false):{happened:"The company ran out of cash.",response:"No specific recovery is established by the retained record.",improve:"Compare operating costs with earned revenue before expanding.",takeaway:"Capacity must be affordable to operate."}}><Callout tone="critical" icon="cash" kicker="Company closed">Cash reached {dollars(c.cashCents)} after settlement at game second {c.step}. Final metrics and history remain available.</Callout>
    <p>Last period revenue: {dollars(c.settlements.at(-1)?.revenueCents??0)}. Infrastructure: {dollars(infrastructureCents(c.settlements.at(-1)))}. Salaries: {dollars(c.settlements.at(-1)?.salaryCents??0)}.</p>
    <p>Upfront investment: {dollars(c.investedCents)}. Rejected demand: {c.cumulative.rejected} requests (not an extra cash charge).</p>{c.scorecard&&<><h4>Recorded scorecard</h4><RecordedFields data={c.scorecard} /></>}</CampaignReport>
    <div className="modal-foot"><button className="btn btn-quiet" onClick={() => openView("history")}><Icon name="history" size={16} />View history</button><button className="btn btn-primary" onClick={() => openView("menu")}><Icon name="refresh" size={16} />Export or start a new company</button></div>
  </Modal>;
  if (view === "menu") { const tab: MenuTab = game.phase === "ended" ? "saves" : "run"; return menu ? menu(tab) : <CampaignMenu initialTab={tab} />; }
  return null;
}

const COMPLETIONS: Record<ChapterCompletion, { title: string; text: string; next: string }> = {
  scaling: { title: "Scaling & Routing complete", text: "Your added capacity and routing carried the growth wave.", next: "data" },
  data: { title: "Data Strategy complete", text: "Your Database kept up with the new workload.", next: "spikes" },
};

/** Scaling & Routing and Data Strategy have no recognition of their own, so finishing them stops here once. */
function ChapterComplete({ chapter }: { chapter: ChapterCompletion }) {
  const { game, act, dismissChapterComplete } = useGame();
  const done = COMPLETIONS[chapter];
  const next = campaignChapters(game).find(c => c.id === done.next)!;
  const action = campaignGuidance(game).pendingAction!;
  return <Modal title={done.title} className="campaign-recovery-report" icon={{ kind: "go", name: "goal" }} onClose={dismissChapterComplete}>
    <CampaignReport lesson={outcomeSummary(game.campaign!,chapter)}>
      <p>{done.text} Your architecture, cash and investments carry forward.</p><p>Next: {next.name}. {next.description}</p>
      <h4>Recorded chapter state</h4><RecordedFields data={(chapter==="scaling"?game.campaign!.scaling:game.campaign!.dataStage)??{}} /><h4>Latest observation</h4><RecordedFields data={game.campaign!.snapshot} />
    </CampaignReport>
    <div className="modal-foot">
      <button className="btn btn-quiet" onClick={dismissChapterComplete}>Stay in this chapter</button>
      <button className="btn btn-primary" onClick={() => { dismissChapterComplete(); act(action.action!); }}>{action.label}<Icon name="next" /></button>
    </div>
  </Modal>;
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
  const legacy = useGame(s => !!s.tutorialCompany || s.tour?.track === "campaign");
  const [tab, setTab] = useState<HistoryTab>("charts");
  const [open, setOpen] = useState<string | null>(null);
  const steps = c.recent.map(m => m.step);
  // Chapter outcomes are not incidents; they sit in their own list below the incident reports.
  const outcomes = [
    ...(c.reliabilityStage?.completedStep != null ? [{ id: "reliability-outcome", title: "Stay Online outcome", step: c.reliabilityStage.completedStep, label: "Historical reliability outcome", body: <ReliabilityOutcome campaign={c} /> }] : []),
    ...(c.openingPrevention?.outcome ? [{ id: "prevention-outcome", title: "Opening prevention outcome", step: c.openingPrevention.outcome.qualifiedStep, label: "Historical Opening prevention outcome", body: <PreventionOutcome campaign={c} /> }] : []),
  ];
  return <div className="history">
    <HistoryTabs tab={tab} onChange={setTab} incidents={c.reports.length}>
    {tab === "charts" && <>
      <div className="charts">
        <LineChart title="Latency" axisLabel="Game second" series={[{ name: "Latency", color: CHART_COLORS.health, values: c.recent.map(m => m.latencyMs) }]} turns={steps} format={v => `${v.toFixed(0)} ms`} />
        <LineChart title="Traffic" axisLabel="Game second" series={[{ name: "Incoming", color: CHART_COLORS.users, values: c.recent.map(m => m.incoming) }, { name: "Admitted", color: CHART_COLORS.revenue, values: c.recent.map(m => m.admitted) }]} turns={steps} format={v => `${num(v)}/s`} />
        <LineChart title="Revenue and costs" series={[{ name: "Revenue", color: CHART_COLORS.revenue, values: c.settlements.map(p => p.revenueCents / 100) }, { name: "Costs", color: CHART_COLORS.costs, values: c.settlements.map(p => (p.revenueCents - p.netCents) / 100) }]} turns={c.settlements.map(p => p.period)} format={money} />
      </div>
      <div className="history-notes">
        {c.spikeStage&&<details className="more"><summary>Traffic spike and controller history</summary>{c.recent.filter(m=>m.spikes).map(m=><p key={m.step}>Game second {m.step}: incoming {m.incoming}; {m.spikes!.activePulse?`pulse ${m.spikes!.activePulse}`:"baseline"}; routed busy {m.spikes!.routedBusyBasisPoints/100}%; installed/routed {m.spikes!.installed}/{m.spikes!.routed}; {m.spikes!.blockedReason??"observing"}.</p>)}</details>}
        <details className="more"><summary>Financial settlements</summary>{c.settlements.length ? c.settlements.map(p => <p key={p.period}>Week {p.period}: revenue {dollars(p.revenueCents)}, net {dollars(p.netCents)}</p>) : <p>No operating week has settled yet.</p>}</details>
      </div>
    </>}
    {tab === "events" && <EventFeed className="campaign-feed" entries={c.trace.filter(e => e.type !== "metrics").reverse().map(e => ({ id: e.id, kind: eventKind(e.type), when: `Game second ${e.step}`, text: eventText(e) }))} />}
    {tab === "postmortems" && <div className="history-incidents">
      {c.reports.length === 0 ? <p className="empty">No incidents yet.</p> : <ul className="pm-list" aria-label="Incident reports">{[...c.reports].reverse().map(report => <li key={report.id}>
        <button type="button" className="pm-toggle" aria-expanded={open === report.id} onClick={() => setOpen(open === report.id ? null : report.id)}>
          <span className="pm-title"><Icon name="incident" size={16} /><span>{incidentTitle(report)}<small>Game seconds {report.openedStep}-{report.recoveredStep}</small></span></span>
          {report.limited ? <span className="tag tag-warn"><Icon name="alert" size={12} />Recovered under traffic limit</span> : <span className="tag tag-ok"><Icon name="check" size={12} />Recovered</span>}
        </button>
        {open === report.id && <div className="pm">{legacy ? <Report report={report} /> : <CampaignIncidentReport report={report} />}</div>}
      </li>)}</ul>}
      {outcomes.length > 0 && <>
        <h3 className="history-subhead">Chapter outcomes</h3>
        <ul className="pm-list" aria-label="Chapter outcomes">{outcomes.map(o => <li key={o.id}>
          <button type="button" className="pm-toggle" aria-expanded={open === o.id} onClick={() => setOpen(open === o.id ? null : o.id)}>
            <span className="pm-title"><Icon name="goal" size={16} /><span>{o.title}<small>Game second {o.step}</small></span></span>
            <span className="tag tag-ok"><Icon name="check" size={12} />Completed</span>
          </button>
          {open === o.id && <section className="pm" aria-label={o.label}>{o.body}</section>}
        </li>)}</ul>
      </>}
    </div>}
    </HistoryTabs>
  </div>;
}

type Settlement = Campaign["settlements"][number];
const infrastructureCents = (p: Settlement | undefined) => p ? p.appCents + p.dbCents + (p.lbCents??0) + (p.cacheCents??0) + (p.controllerCents??0) + (p.checksCents??0) + (p.failoverCents??0) : 0;

function ReliabilityOutcome({campaign:c}:{campaign:Campaign}) {
  const d=c.reliabilityStage!,f=d.fault!;
  const completion=c.trace.find(e=>e.type==="reliability-stage-completed");
  const detection=c.trace.find(e=>e.type==="health-change-detected"&&e.data.appId===f.targetId&&e.data.detectedHealth==="unhealthy"&&e.step>=f.startStep);
  const promotion=c.trace.find(e=>e.type==="failover-activated"&&e.data.eventId===f.id);
  const lesson=reliabilityLesson(c);
  const related=c.reports.filter(r=>r.snapshots.some(m=>m.reliability?.faultId===f.id));
  // The first observation where the failed server was routed around shows whether the survivors could carry the load.
  const bypass=related.flatMap(r=>r.snapshots).find(m=>m.reliability&&m.step>=f.startedStep!&&!m.reliability.effective.includes(f.targetId));
  return <>
    <CampaignReport lesson={lesson?{happened:lesson.happened,response:lesson.recovered,improve:lesson.improve,takeaway:lesson.takeaway}: {happened:"The reliability test completed.",response:"The saved records do not show a specific repair.",takeaway:"Verify service after restoring a server."}}>
    <Callout compact tone="success" icon="health" kicker={completion?.data.limited?"Stable, with traffic limited":"Stable service"}>
      {completion?.data.incidentOccurred?"The failure opened an incident, and you reviewed its recovery.":"The test completed without opening an incident."} Service then stayed stable for five game seconds after the restore.
    </Callout>
    <dl className="rows"><Row label="Application failure" value={`${appName(f.targetId)} · game second ${f.startedStep}`} />
      <Row label="Failure detected" value={detection?`Game second ${detection.step} · ${detection.data.source==="probe"?"Health Checks":"manual inspection"}`:"Not detected before restoration"} />
      <Row label="Spare promotion" value={promotion?`${appName(String(promotion.data.appId))} · game second ${promotion.step}`:"No automatic promotion"} />
      <Row label="Restoration" value={`Game second ${f.restoredStep} · ${f.restoreSource==="manual"?"requested restore":"returned on its own"}`} />
      <Row label="Outcome recorded" value={`Game second ${d.completedStep}`} />
      <Row label="Company rejected requests at completion" value={num(Number(completion?.data.rejected??0))} />
      <Row label="Company setup spending at completion" value={dollars(Number(completion?.data.setupCents??0))} /></dl>
    {bypass&&<dl className="rows"><Row label="Traffic admitted after the failure" value={`${num(bypass.admitted)} req/s`} />
      <Row label="Capacity of the servers still routed" value={`${num(bypass.reliability!.healthyRoutedCapacity)} req/s`} /></dl>}
    <p>Health Checks only detect a failure, and failover only moves traffic; neither adds capacity. {bypass?bypass.admitted>bypass.reliability!.healthyRoutedCapacity?"Here the surviving servers had less capacity than the traffic admitted, so they stayed overloaded until the restore.":"Here the surviving servers had enough capacity for the traffic admitted.":"Compare demand with the capacity of the servers that still receive traffic."}</p>
    {related.map(r=><p key={r.id} className="muted">The full evidence is in the incident report for game seconds {r.openedStep}-{r.recoveredStep}.</p>)}
    </CampaignReport>
  </>;
}

const PREPARATION_NAMES: Partial<Record<ScheduledAction["type"], string>> = {"upgrade-db":"Database upgrade","add-app":"Additional application",limit:"Traffic limit",unlimit:"Traffic limit removal"};
function PreventionOutcome({campaign}:{campaign:Campaign}) {
  return <CampaignReport lesson={outcomeSummary(campaign,"prevention")}><PreventionEvidence campaign={campaign}/></CampaignReport>;
}
function PreventionEvidence({campaign}:{campaign:Campaign}) {
  const o=campaign.openingPrevention!.outcome!,m=o.snapshots.at(-1)!;
  const qualified=campaign.trace.find(t=>t.type==="opening-prevention-qualified"&&t.step===o.qualifiedStep);
  const requested=new Set(campaign.trace.filter(t=>t.type==="action-requested"&&qualified&&t.id<qualified.id).map(t=>t.data.actionId));
  const prepared=campaign.actions.filter(a=>requested.has(a.id)&&PREPARATION_NAMES[a.type]);
  return <div>
    <Callout tone="success" icon="health" kicker="First growth prevented">Traffic increased from {num(Q.startingTraffic)} to {num(Q.grownTraffic)} req/s and the Application and Database handled full demand with empty queues and healthy service for {Q.stableSteps} consecutive game seconds.</Callout>
    <p>Preventing the outage completes Opening just as recovering from one would. Continue past this review and the Opening recognition to unlock Scaling &amp; Routing.</p>
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
      <li><Act icon="checkbox" label="Deploy Health Checks" tour="deploy-checks" price={R.checksCostCents/100} note="2 game seconds" disabled={checksUnavailable} tip="Requires its research unlock and available cash. Detects health changes; load balancing is required for routing exclusion." decision={{type:"deploy_health_checks"}} onClick={()=>act({type:"deploy_health_checks"})} /></li>
      <li><Act icon="plug" label="Install spare" price={R.spareCostCents/100} note="2 game seconds" disabled={spareUnavailable} tip="Requires Spare Application research, available cash and a free instance slot. A spare receives no traffic until promoted." decision={{type:"install_spare"}} onClick={()=>act({type:"install_spare"})} /></li>
      <li><Act icon="switch" label="Deploy Automatic Failover" price={R.failoverCostCents/100} note="2 game seconds" disabled={failoverUnavailable} tip="Requires its research unlock, deployed Health Checks and Load Balancing, a healthy reserved spare and available cash. Creates no capacity." decision={{type:"deploy_failover"}} onClick={()=>act({type:"deploy_failover"})} /></li>
      {d.failover&&<li><Act icon="switch" label={d.failover.enabled?"Disable failover":"Enable failover"} price={0} disabled={disabled} decision={{type:"set_failover",enabled:!d.failover!.enabled}} onClick={()=>act({type:"set_failover",enabled:!d.failover!.enabled})} /></li>}
    </ul>
    <div className="instance-choices">{c.apps.map(a=><div key={a.id} className="chip">
      <span>{appName(a.id)} · {a.health??"healthy"} · detected {a.detectedHealth??"unknown"} · {a.role??"serving"} · {recipients.includes(a.id)?"receiving traffic":"not receiving traffic"}</span>
      <button className="btn btn-small" disabled={disabled} onClick={()=>inspectOrSelect("app",a.id)}>Inspect {appName(a.id)} health · free</button>
      {a.health==="failed"&&<CampaignDecisionButton className="btn btn-small" disabled={disabled||busy} decision={{type:"restore_app",appId:a.id}} onClick={()=>act({type:"restore_app",appId:a.id})}>Restore {appName(a.id)} · free · 3 game seconds</CampaignDecisionButton>}
      {!a.routed&&a.role!=="spare"&&<CampaignDecisionButton className="btn btn-small" disabled={disabled||busy||!d.owned.includes("standby")||!!d.spareId} decision={{type:"reserve_spare",appId:a.id}} onClick={()=>act({type:"reserve_spare",appId:a.id})}>Reserve {appName(a.id)} as spare · 1 game second</CampaignDecisionButton>}
      {a.role==="spare"&&<CampaignDecisionButton className="btn btn-small" disabled={disabled||busy} decision={{type:"release_spare"}} onClick={()=>act({type:"release_spare"})}>Release spare · 1 game second</CampaignDecisionButton>}
    </div>)}</div>
    <dl className="rows">
      <Row label="Installed / healthy" value={`${num(c.snapshot.installedAppCapacity)} / ${num(r?.healthyCapacity??c.snapshot.installedAppCapacity)} req/s`} />
      <Row label="Healthy routed / spare" value={`${num(r?.healthyRoutedCapacity??c.snapshot.app.capacity)} / ${num(r?.spareCapacity??0)} req/s`} />
    </dl>
  </section>;
}

function ScalingRiskConsent(){const {act}=useGame();const [confirm,setConfirm]=useState(false);const {riskOpen}=useCampaignAttention();useEffect(()=>{riskOpen(confirm);return ()=>riskOpen(false);},[confirm,riskOpen]);return <section aria-label="Scaling growth risk"><p>Next wave: 1,400 req/s. Prepare 2,000 ops/s database headroom, or choose to take the risk.</p><button className="btn" onClick={()=>setConfirm(true)}>Consider growth with current capacity</button>{confirm&&<><p>Accept growth risk? This waives only the database-headroom requirement. Existing timing, costs and service rules remain.</p><button className="btn" data-guidance="accept_scaling_risk" onClick={()=>{if(act({type:"accept_scaling_risk"}))setConfirm(false);}}>Accept growth risk</button><button className="btn" onClick={()=>setConfirm(false)}>Keep preparing</button></>}</section>;}
function CombinedControls({disabled}:{disabled:boolean}){const {game,act}=useGame(),c=game.campaign!,d=c.combinedStage!,r=d.currentRound;return <section aria-label="Grow the Company"><h3>Grow the Company</h3><p>Registered users: {d.users.toLocaleString("en-US")} / {d.finalUserTarget.toLocaleString("en-US")}. Growth outcomes acknowledged: {d.completedRounds.length} / 3.</p><p>{r?r.startedStep===null?"Growth wave announced. Prepare the architecture before pressure arrives.":`Current pressure: ${r.scenario.template}. Inspect actual workload and healthy routed capacity.`:"Between growth waves: operate full baseline demand and choose when to continue."}</p><p>Optional promotion: $500 setup · +400 req/s for 12 seconds.</p><details className="more"><summary>Promotion effect &amp; costs</summary><p>Activates next game second; no registered-user award. Maximum additional gross revenue is $960 if every extra request succeeds. Existing operating costs still apply. Available between growth waves; cooldown 30 game seconds after it ends.</p></details><CampaignDecisionButton className="btn" disabled={disabled||!canPromote(game)} decision={{type:"run_promotion"}} onClick={()=>act({type:"run_promotion"})}>Run promotion · $500 · 1 game second</CampaignDecisionButton>{c.promotion&&<p>{c.promotion.activatedStep===null?"Promotion pending":c.step<c.promotion.endStep?"Promotion active":"Promotion ended"}; cooldown remaining {Math.max(0,c.promotion.cooldownUntil-c.step)} game seconds.</p>}</section>;}
