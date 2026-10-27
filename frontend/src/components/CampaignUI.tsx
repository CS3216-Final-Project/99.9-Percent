import { introductionActive } from "@/sim/introduction";
import { introductionInstruction } from "@/game/introduction";
import { outcomeSummary, scorecardSummary } from "@/game/campaignReport";
import { CampaignReport } from "./CampaignReport";
import { RecordedFields } from "./RecordedFields";
import { useMediaQuery } from "./useMediaQuery";
import { incidentTitle, survivingCapacity } from "@/game/campaignPostmortem";
import { ACTION_NAMES, describeEvents } from "@/game/reportEvents";
import { chapter6FinancialRisk } from "@/game/chapter6Finance";
import { reliabilityLesson } from "@/game/reliabilityLesson";
import { saveTextFile as download } from "@/lib/download";
import { EquipmentPanel } from "./EquipmentPanel";
import { RoomControlsSlot } from "./RoomControlsHost";
import "./CampaignUX.css";
import { CampaignAction as Act } from "./CampaignAction";
import CampaignScorecard from "./CampaignScorecard";
import LaunchIntro from "./LaunchIntro";
import LaunchScore from "./LaunchScore";
import { CampaignFinale } from "./CampaignFinale";
import { campaignFinale } from "@/game/campaignFinale";
import { combinedProfile, currentFault, pendingCombined } from "@/sim/combinedCampaign";
import { pendingSpikeAcknowledgement } from "@/sim/autoscaling";
import { TRAFFIC_SPIKES as T } from "@/sim/scenarios/trafficSpikes";
import { DATA_STRATEGY as D } from "@/sim/scenarios/dataStrategy";
import { admissionCeiling, canEnterData, databaseUpgrade, pendingStop, routableApps } from "@/sim/step";
import { pendingReliability, effectiveTargets, researchBalance, installPending } from "@/sim/reliability";
import { pendingPreventionReview } from "@/sim/openingPrevention";
import { APPLICATION_RELIABILITY as R } from "@/sim/scenarios/applicationReliability";
import { campaignAttention, incidentNeedsPause } from "@/game/campaignAttention";
import { chapter4Stage } from "@/game/chapter4Guidance";
import { previewCampaignAction } from "@/game/campaignFinance";
import { campaignGuidance, milestoneBlocks, type Requirement } from "@/game/campaignGuidance";
import { launchWeekScalingOpen, openingTuning } from "@/sim/launchWeek";
import { LAUNCH_WEEK as LW } from "@/sim/scenarios/launchWeek";
import { finishedChapter } from "@/game/campaignChapters";
import TechTree from "./TechTree";
import { AccountSection, CloudSavesSection } from "./Account";
import { FinanceEntry } from "./CampaignFinance";
import { AppHealthEntry } from "./CampaignAppHealth";
import { CampaignUnavailable, CampaignDecisionButton } from "./CampaignInfrastructure";
import { INFRASTRUCTURE_TIPS } from "@/game/infrastructureHelp";
import { HomeScreen } from "./HomeScreen";
import { CampaignChapters } from "./CampaignChapters";
import { isChapterEntry } from "@/game/campaignChapters";
import { APPLICATION_SCALING as P } from "@/sim/scenarios/applicationScaling";
import { exportPlaytest, type AnnouncedChapter } from "@/game/persist";
import { chapterEnd, type ChapterEnd } from "@/game/chapterCompletion";
import { ChapterEndFoot } from "./ChapterEndFoot";
import { money, num } from "@/game/format";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { TimeMenu } from "./TimeMenu";
import { useCampaignAttention } from "./useCampaignAttention";
import { CampaignHintButton } from "./CampaignAttention";
import { CampaignIncidentReport, CampaignRecoveryReview, CapacityAfterFailure } from "./CampaignIncidentReport";
import { inspectInRoom, useGame } from "@/game/store";
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
import type { Campaign, CampaignPostmortem, ScheduledAction } from "@/sim/campaignTypes";
import { completedTechIds, TECH_ORDER, type EventKind, type EquipmentId } from "@/sim";
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
function RequirementList({items}:{items:Requirement[]}) {
  return <ul className="progression-requirements">{items.map(r=><li key={r.id} data-requirement={r.id} data-met={r.met}><Icon name={r.met?"check":"close"} size={12} /> {r.label}</li>)}</ul>;
}
/** Number the actual sequence, keeping clock-driven steps distinct from player actions. */
function StepList({items,label="Chapter steps"}:{items:Requirement[];label?:string}) {
  const running=useGame(s=>s.running),current=items.find(r=>!r.met);
  return <ol className="progression-steps" aria-label={label}>{items.map((r,i)=>{
    const state=r.met?"done":r===current?"current":"upcoming";
    return <li key={r.id} data-requirement={r.id} data-met={r.met} data-state={state} aria-current={state==="current"?"step":undefined}>
      <span className="progression-marker" aria-hidden="true">{r.met?<Icon name="check" size={12}/>:i+1}</span>
      <span className="progression-text"><span className="visually-hidden">Step {i+1}, {state==="done"?"done":state==="current"?"current step":"not yet"}: </span>{r.label}
        {r.wait&&state==="current"&&<span className="progression-wait"><Icon name="time" size={12}/>{running?"Running":"Press Run"}</span>}
        {state==="current"&&r.hint&&<small>{r.hint}</small>}
      </span>
    </li>;
  })}</ol>;
}
/** All standing conditions remain accessible, while only failing checks need immediate space. */
function CompanyChecks({items}:{items:Requirement[]}) {
  if(!items.length)return null;
  const failing=items.filter(r=>!r.met),passing=items.filter(r=>r.met);
  return <section className="company-checks" aria-label="Company checks">
    <p><Icon name={failing.length?"alert":"check"} size={14}/>{failing.length?`${failing.length} of ${items.length} company checks need attention`:`All ${items.length} company checks pass`}</p>
    {!!failing.length&&<ul className="progression-requirements">{failing.map(r=><li key={r.id} data-requirement={r.id} data-met="false"><Icon name="close" size={12}/><span>{r.label}{r.hint&&<small>{r.hint}</small>}</span></li>)}</ul>}
    {!!passing.length&&<details className="company-passing"><summary>View {passing.length} passing {passing.length===1?"check":"checks"}</summary><RequirementList items={passing}/></details>}
  </section>;
}
function RequirementChecklist({items}:{items:Requirement[]}) {
  const steps=items.filter(r=>r.kind!=="check"),checks=items.filter(r=>r.kind==="check");
  return <>{steps.length>0&&<StepList items={steps}/>}<CompanyChecks items={checks}/></>;
}

// Progress is derived from the engine; reading this panel never advances the run.
function CampaignGuidance() {
  const {game,act}=useGame(),c=game.campaign!;
  const model=campaignGuidance(game),action=model.pendingAction;
  const financialRisk=chapter6FinancialRisk(game);

  return <section className="campaign-guidance" aria-label="Guided Mode guidance">
    {financialRisk&&<Callout compact tone="warn" icon="cash" kicker={financialRisk.kind==="blocked"?"Capacity funding blocked":"Money at risk"}><span role="note">{financialRisk.message}</span></Callout>}
    {c.combinedStage&&model.waiting&&<p role="status">{model.waiting}</p>}
    {model.requirements.length>0&&<section className="campaign-requirements" aria-label="Guided Mode requirements"><h3 className="campaign-requirements-heading">{c.combinedStage?"Current growth requirements":"Chapter requirements"}<span> · {model.completed.length}/{model.requirements.length}</span></h3>
      <RequirementChecklist items={model.requirements}/>
      {!c.combinedStage&&model.waiting&&<p role="status">{model.waiting}</p>}
      {model.notice&&<p role="note">{model.notice}</p>}
      {model.optional&&<p className="muted">{model.optional}</p>}
    </section>}
    {model.finalGoals.length>0&&<section className="campaign-requirements" aria-label="Final Campaign goals"><h3 className="campaign-requirements-heading">Final Campaign goals</h3><RequirementList items={model.finalGoals}/></section>}
    {action?.action&&!isChapterEntry(action.action)&&<button className="btn btn-primary" data-guidance={action.action.type} disabled={game.phase==="ended"} onClick={()=>act(action.action!)}>{action.label}<Icon name="next" /></button>}
    {action&&!action.action&&<button className="btn btn-primary" onClick={()=>useGame.getState().openView(null)}>{action.label}<Icon name="next" /></button>}
    {c.scaling&&!c.dataStage&&!c.scaling.consumed&&!c.scalingConsent&&<ScalingRiskConsent/>}
    {c.scorecard&&<button className="btn" onClick={()=>useGame.getState().openView("scorecard")}><Icon name="goal" size={16} />View run scorecard</button>}
    {model.prevention&&!c.openingPrevention?.outcome&&<section className="prevention-guidance" aria-label="Opening prevention progress">
      <p role="status">Stable service: {c.openingPrevention?.stableSteps??0} / {Q.stableSteps} game seconds. Pausing adds no time; unhealthy service restarts the counter.</p>
      <RequirementChecklist items={model.preventionChecks}/>
      <div className="btn-row"><button className="btn btn-small" onClick={()=>inspectInRoom("app","app-1")}><Icon name="server" size={16} />Inspect Application</button><button className="btn btn-small" onClick={()=>inspectInRoom("db")}><Icon name="database" size={16} />Inspect Database</button></div>
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
  const { game } = useGame(), c = game.campaign!, m = c.snapshot;
  const incident = game.phase === "incident";
  const unlocked = !!c.openingMilestone?.acknowledged || !!c.launchWeek;
  const disabled = pendingStop(c) !== null || milestoneBlocks(game) || game.phase === "review" || game.phase === "ended";
  if(introductionActive(c))return <IntroductionPanel/>;
  if(c.spikeStage) return <CampaignMissionDashboard disabled={disabled}/>;
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
      <EquipmentShortcuts disabled={disabled}/>
      <LaunchResearch/>
      {unlocked&&!c.launchWeek&&!c.scaling?.consumed&&<p className="muted">{c.dbCapacity<P.dbCapacity&&!c.scalingConsent?"Next growth waits for a paid database upgrade to 2,000 ops/s.":c.incident||c.dbBacklog||c.apps.some(a=>a.backlog)?"Growth waits until the incident and backlogs clear.":c.scaling?.dueStep?`Growth due at game second ${c.scaling.dueStep} while ready.`:"Growth readiness is checked on the next game second."}</p>}
      {c.pending.map(a => <div className="working campaign-working" role="status" key={a.id}>
        <span>{ACTION_NAMES[a.type]}{a.targetId?` (${appName(a.targetId)})`:""}: activates in {a.activationStep - c.step} game second(s)</span>
        <Meter value={(c.step - a.requestedStep) / (a.activationStep - a.requestedStep)} label={`${ACTION_NAMES[a.type]} activation`} />
      </div>)}
      {c.apps.some(a=>!a.routed) && <p className="muted">{c.apps.filter(a=>!a.routed).map(a=>appName(a.id)).join(", ")}: Installed, not receiving traffic</p>}
      {c.limit!==null&&<Callout compact tone={m.rejected*5>m.incoming?"critical":"warn"} icon="network" kicker="Traffic limit active">{num(m.admitted)} admitted / {num(m.rejected)} turned away req/s. Turned-away requests earn no revenue and count against uptime. <strong>Infrastructure and salaries still cost the same.</strong></Callout>}
    </section>
  </EquipmentPanel>;
}

function LaunchResearch() {
 const {game,act}=useGame(),c=game.campaign!;
 return <>      {!!c.launchWeek?.researchEarned&&!c.launchWeek.tech&&<section className="panel-section" aria-label="Launch Week research">
        <h4 className="step-head"><Icon name="bulb" size={16} />Research pick</h4>
        <p>One free research point, billed at the next Sunday settlement. Your pick carries into the later chapters.</p>
        <ul className="actions">
          <li><Act icon="bolt" label="Caching" price={LW.researchCostCents / 100} note="Answers repeated requests" tip="Answers forty percent of arriving requests during the surge; a read cache carries into the data stage." decision={{ type: "pick_launch_tech", tech: "caching" }} onClick={() => act({ type: "pick_launch_tech", tech: "caching" })} /></li>
          <li><Act icon="scale" label="Autoscaling" price={LW.researchCostCents / 100} note="Adds capacity under load" tip="Adds application capacity while the surge runs; the unlock carries into Traffic Spikes." decision={{ type: "pick_launch_tech", tech: "autoscaling" }} onClick={() => act({ type: "pick_launch_tech", tech: "autoscaling" })} /></li>
        </ul>
      </section>}
</>;
}
function IntroductionPanel() {
 const {game,act}=useGame(),c=game.campaign!,intro=c.launchWeek!.introduction!,step=introductionInstruction(c);
 return <EquipmentPanel className="campaign-panel mission-dashboard" label="System metrics">
  <section className="panel-section" aria-label="Infrastructure introduction">
   <section className="mission-progress" aria-label="Introduction Progress">
    <h3>Introduction Progress — {intro.explored.length}/4 components explored</h3>
    <Meter value={intro.explored.length/4} label="Components explored" tone="ok"/>
   </section>
   <section className="mission-next" aria-label="Next step"><h4>{step.equipment?`Inspect ${step.name}`:"Request flow"}</h4><p>{step.description}</p><p>{step.message}</p></section>
   <p className="muted">Time is paused while you explore; no purchases are needed.</p>
   <EquipmentShortcuts disabled={false}/>
   <button className="btn btn-primary" data-introduction-complete disabled={intro.explored.length!==4} onClick={()=>act({type:"complete_introduction"})}>Complete Introduction<Icon name="next"/></button>
  </section>
 </EquipmentPanel>;
}

function EquipmentShortcuts({disabled}:{disabled:boolean}) {
  const {game,selected}=useGame(),c=game.campaign!;
  const place=PLACES.find(id=>id===selected&&(id!=="cache"||c.dataStage));
  const office=selected==="team"||selected==="deploy"||selected==="growth"?selected:null;
  return (<div className="incident-investigate">
        <h4 className="step-head">Inspect equipment</h4>
        <div className="chips">{PLACES.filter(id=>id!=="cache"||c.dataStage).map(id => <button type="button" key={id} data-tutorial={`inspect-${id}`} className={`chip${place === id ? " is-selected" : ""}`} aria-pressed={place === id} disabled={disabled} {...tipProps(INFRASTRUCTURE_TIPS[id])} onClick={() => inspectInRoom(id)}>
          <span className="chip-icon" aria-hidden="true"><Icon name={EQUIPMENT_ICON[id]} size={16} /></span>{PLACE_NAMES[id]}
        </button>)}</div>
        {office && <div className="campaign-evidence" role="status"><Callout compact tone="info" icon={EQUIPMENT_ICON[office]} kicker={`${OFFICE_EVIDENCE[office].name} · Company operations`}>
          {OFFICE_EVIDENCE[office].text}
        </Callout></div>}
      </div>);
}

/** A compact projection of existing gates and advice. No new progression or saved state. */
function CampaignMissionDashboard({disabled}:{disabled:boolean}) {
  const {game,act,running}=useGame(),c=game.campaign!,m=c.snapshot;
  const model=campaignGuidance(game),decision=campaignAttention(game),hint=useCampaignAttention();
  const action=model.pendingAction,combined=c.combinedStage,reliability=c.reliabilityStage;
  const fault=currentFault(c),financialRisk=chapter6FinancialRisk(game);
  const spike=chapter4Stage(game);
  const reviewing=!!action&&!action.action;
  const actionReady=!!action?.action&&!disabled&&previewCampaignAction(game,action.action).ok;
  const priority=c.incident?"incident":c.pending.length?"pending":fault?.startedStep!=null&&fault.restoredStep===null?"restored":combined&&c.limit!==null?"admission":m.app.backlog+m.db.backlog>0?"queues":null;
  const unmet=model.incomplete.find(r=>r.id===priority)??model.incomplete[0];
  const condition=game.phase==="ended"&&game.outcome!=="won"?model.notice:unmet?`Still needed: ${unmet.label}`:null;
  const accomplishment=combined?(combined.acknowledged?"Campaign completed.":pendingCombined(c)?"Growth wave stabilized.":combined.finalReview?"Final service stability verified.":"Full-demand readiness verified."):reliability?"Reliability test completed and outcome acknowledged.":"Both traffic spikes handled and outcome acknowledged.";
  const stage=combined?(combined.acknowledged?"Campaign complete":combined.finalReview?"Final review":pendingCombined(c)?"Growth outcome review":combined.currentRound?`Growth wave ${combined.currentRound.index+1} ${combined.currentRound.startedStep===null?"scheduled":combined.currentRound.pressureEndedStep===null?"active":"recovery"}`:combined.nextRoundIndex===3?"Final checks":"Prepare for full demand")
    :reliability?(reliability.acknowledged?"Outcome acknowledged":pendingReliability(c)?"Outcome review":!reliability.fault?"Preparation":reliability.fault.startedStep===null?"Failure scheduled":reliability.fault.restoredStep===null?"Failure / recovery":"Stability verification")
    :c.spikeStage!.acknowledged?"Outcome acknowledged":pendingSpikeAcknowledgement(c)?"Spike outcome review":({prepare:"Preparing",spike1:"Spike 1 active",between:"Between spikes",spike2:"Spike 2 active",recover:"Review / stability verification"}[spike?.stage??"recover"]);
  const objectiveIds=combined?["checks"]:reliability?["armed","observed","restored","observations","recognition"]:["pulses","observations","recognition"];
  const objectives=[...model.requirements.filter(r=>objectiveIds.includes(r.id)),...(combined?model.finalGoals.filter(r=>r.id==="completion"):[])];
  const nextAdvice=decision.attention==="run"?decision.message:decision.reason==="spike-plan"?decision.recommendation:decision.action?`Suggested action: ${decision.action.label}.`:decision.recommendation;
  const showMetrics=!!c.incident||m.app.backlog+m.db.backlog>0||spike?.stage==="spike1"||spike?.stage==="spike2"||!!combined?.currentRound;
  return <EquipmentPanel className="campaign-panel mission-dashboard" label="System metrics">
    <section className="panel-section" aria-label="Campaign mission dashboard">
      <section aria-label="Chapter Progress" className="mission-progress">
        <h3>{combined?"Grow the Company":reliability?"Stay Online":"Chapter Progress"}</h3>
        <p className="mission-stage">{stage}</p>
        {combined&&<><p>Registered users: {num(combined.users)} / {num(combined.finalUserTarget)}</p><Meter value={combined.users/combined.finalUserTarget} label="Registered users progress" tone="ok"/><p>Growth outcomes acknowledged: {combined.completedRounds.length} / 3</p></>}
        <Meter value={model.completed.length/Math.max(1,model.requirements.length)} label="Chapter requirements progress" tone="ok"/>
        <p className="mission-complete">{model.completed.length} / {model.requirements.length} current requirements met</p>
        {unmet&&<StepList items={objectives}/>}
      </section>
      {condition?<section aria-label="Current unmet condition" className={`mission-condition${c.incident||game.phase==="ended"&&game.outcome!=="won"?" is-failure":""}`}><h4>Current unmet condition</h4><p>{condition}</p></section>:<section aria-label="Chapter accomplished" className="mission-accomplished"><h4>Chapter accomplished</h4><p>{accomplishment}</p></section>}
      <section aria-label="Next step" className="mission-next"><h4>Next step</h4>
        <p>{game.phase==="ended"&&game.outcome==="won"?"Inspect the scorecard and final company, or start a new company from the Menu.":running&&incidentNeedsPause(game,decision)?"Pause the company to inspect the incident.":reviewing?"Open the recorded review to continue.":actionReady&&action?.action&&!isChapterEntry(action.action)?"The company is ready for the next action.":actionReady&&action?.action?`${action.label} using Next in the chapter bar.`:nextAdvice}</p>
        {action?.action&&!isChapterEntry(action.action)&&<button className="btn btn-primary" data-guidance={action.action.type} disabled={disabled||!previewCampaignAction(game,action.action).ok} onClick={()=>act(action.action!)}>{action.label}<Icon name="next"/></button>}
        {reviewing&&<button className="btn btn-primary" onClick={()=>useGame.getState().openView(null)}>{action.label}<Icon name="next"/></button>}
        {!reviewing&&!actionReady&&hint.available&&<button className="btn" onClick={hint.openHint}>Show next action<Icon name="bulb"/></button>}
        {c.scorecard&&<button className="btn" onClick={()=>useGame.getState().openView("scorecard")}><Icon name="goal" size={16} />View run scorecard</button>}
      </section>
      <section aria-label="Essential live status" className="mission-status">
        {financialRisk&&<Callout compact tone="warn" icon="cash" kicker={financialRisk.kind==="blocked"?"Capacity funding blocked":"Money at risk"}><span role="note">{financialRisk.message}</span></Callout>}
        {c.limit!==null&&<Callout compact tone="warn" icon="network" kicker="Traffic limit active">{num(m.admitted)} admitted / {num(m.rejected)} rejected req/s. Rejected requests earn no revenue; operating costs remain.</Callout>}
        {fault?.startedStep!=null&&fault.restoredStep===null&&<p role="status">{appName(fault.targetId)} failed and is not restored. Service recovery and server restoration are separate requirements.</p>}
        {showMetrics&&<dl className="rows"><Row label="Latency" value={`${m.latencyMs.toFixed(0)} ms`}/><Row label="Service errors" value={m.serviceErrorRate===null?"Not yet measured":`${(m.serviceErrorRate*100).toFixed(2)}%`}/><Row label="Queued requests" value={num(m.app.backlog+m.db.backlog)}/></dl>}
        {c.incident&&<p role="status">Recovery progress: {c.incident.stableSteps} / {Q.stableSteps} consecutive game seconds. Needs latency below {Q.latencyThresholdMs} ms, errors below {Q.errorThreshold*100}% and successful requests. Unhealthy service resets this counter.</p>}
        {c.pending.map(a=><p role="status" key={a.id}>{ACTION_NAMES[a.type]}{a.targetId?` (${appName(a.targetId)})`:""}: activates in {a.activationStep-c.step} game second(s)</p>)}
      </section>
      <EquipmentShortcuts disabled={disabled}/>
      <details className="more mission-requirements"><summary>View all requirements</summary>
        <section className="campaign-requirements" aria-label="Guided Mode requirements"><h4>{combined?"Current growth requirements":"Chapter requirements"}</h4><RequirementList items={model.requirements}/></section>
        {model.finalGoals.length>0&&<section aria-label="Final Campaign goals"><h4>Final Campaign goals</h4><RequirementList items={model.finalGoals}/></section>}
        {model.waiting&&<p>{model.waiting}</p>}{model.notice&&<p role="note">{model.notice}</p>}{model.optional&&<p className="muted">{model.optional}</p>}
      </details>
    </section>
  </EquipmentPanel>;
}

/** Workload evidence and the optional contrast belong with Read Cache inspection. */
export function CampaignDataDetails({disabled}:{disabled:boolean}) {
 const c=useGame(s=>s.game.campaign)!;
 if(!c.dataStage) return null;
 return <section aria-label="Data strategy" className="scaling-controls">
   <p>Workload: {c.dataStage.consumed?(c.combinedStage?combinedProfile(c):c.dataStage.profile):"Waiting for workload growth"}. {c.dataStage.dueStep!==null&&!c.dataStage.consumed?`Growth due at game second ${c.dataStage.dueStep} while ready.`:""}</p>
   <ContrastWorkload disabled={disabled}/>
 </section>;
}

function ContrastWorkload({disabled}:{disabled:boolean}) {
 const {game,act}=useGame(),c=game.campaign!;
 if(!c.dataStage) return null;
 return (
        <details className="more"><summary>Observe another workload</summary>
          <CampaignDecisionButton className="btn" disabled={disabled||!c.dataStage.consumed||c.dataStage.contrastConsumed||!!c.spikeStage||!canEnterData(game)} decision={{type:"contrast_workload"}} onClick={()=>act({type:"contrast_workload"})}><Icon name="eyes" size={16} />Observe contrasting workload</CampaignDecisionButton>
        </details>
 );
}

/** The original purchase/decision controls, shared by the walkthrough panel and equipment dialogs. */
export type EquipmentActionView="fleet"|"server"|"autoscaling"|"network"|"balancing"|"routing"|"failover";
export function CampaignEquipmentActions({equipment,actionView}:{equipment:EquipmentId;actionView?:EquipmentActionView}) {
  const {game,act,selectedAppId}=useGame(),c=game.campaign!;
  const busy=c.pending.some(a=>!["limit","unlimit","routing"].includes(a.type));
  const unlocked=!!c.openingMilestone?.acknowledged||!!c.launchWeek;
  const dbLocked=!!c.launchWeek&&c.launchWeek.completedStep===null&&c.step<LW.growthStep;
  const scaleLocked=!launchWeekScalingOpen(c);
  const launchLive=!!c.launchWeek&&c.launchWeek.completedStep===null;
  const limitShown=!launchLive||!!c.incident||c.reports.length>0||c.limit!==null;
  const dbUpgrade=databaseUpgrade(c);
  const selectedApp=c.apps.find(a=>a.id===selectedAppId)??c.apps[0];
  const disabled=pendingStop(c)!==null||milestoneBlocks(game)||game.phase==="review"||game.phase==="ended";
  const admissionPending=c.pending.some(a=>a.type==="limit"||a.type==="unlimit");
  const at=(...places:EquipmentId[])=>places.includes(equipment);
  const show=(section:EquipmentActionView)=>!actionView||section===actionView;
  if(introductionActive(c))return null;
  return <div className="component-actions">
      <ul className="actions">
        {at("app")&&show("fleet")&&<li><Act icon="server" label="Add server" price={openingTuning(c).appCostCents / 100} note={`${openingTuning(c).appDelay} game seconds`} disabled={disabled || busy || c.apps.length >= (c.spikeStage ? T.maximum : openingTuning(c).maxApps) || c.cashCents <= openingTuning(c).appCostCents} tip="Adds installed application capacity. Without routing, a new server does not receive traffic." decision={{ type: "add_server" }} onClick={() => act({ type: "add_server" })} /></li>}
        {at("db")&&<li><Act icon={dbLocked?"lock":"database"} label="Upgrade database" price={dbUpgrade?dbUpgrade.costCents/100:undefined} note={dbLocked?"Week 2":dbUpgrade?`${dbUpgrade.delay} game seconds · ${num(dbUpgrade.capacity)} ops/s`:"Current stage tier reached"} disabled={disabled || busy || dbLocked || !dbUpgrade || c.cashCents <= dbUpgrade.costCents} tip={dbLocked?"Locked while your app servers are the bottleneck. Unlocks in week 2 as demand grows into the database.":dbUpgrade?"Increases database capacity after activation. Running costs also increase.":c.dataStage?"The database is at the highest available tier.":"Further database capacity unlocks after explicitly entering the next Guided Mode stage."} decision={{ type: "start_db_upgrade" }} onClick={() => act({ type: "start_db_upgrade" })} /></li>}
        {limitShown&&at("gateway")&&show("network")&&<li><Act icon="limit" label={c.limit === null ? `Limit to ~${num(admissionCeiling(c))} requests/s` : "Remove traffic limit"} price={0} note={`${openingTuning(c).admissionDelay} game second`} disabled={disabled || admissionPending} tip={launchLive?"Admits 90% of what your servers can sustain. Every rejected request earns nothing and hurts your uptime and reputation; scale up your apps to keep up instead.":"Admits 90% of what your current infrastructure can sustain; the cap follows your upgrades. Rejected requests earn no revenue and count against uptime."} decision={{ type: "set_traffic_limit", enabled: c.limit === null }} onClick={() => act({ type: "set_traffic_limit", enabled: c.limit === null })} /></li>}
      </ul>
      {c.reliabilityStage&&at("app","gateway","monitoring")&&(!actionView||actionView==="server"||actionView==="failover")&&<ReliabilityControls disabled={disabled} busy={installPending(c)} equipment={equipment} appId={actionView==="server"?selectedApp.id:undefined}/>}
      {unlocked && at("app","gateway") && (!actionView||["server","balancing","routing"].includes(actionView)) && <section aria-label="Scaling controls" className="scaling-controls">
        <ul className="actions">
          {at("app")&&show("server")&&<li><Act icon={scaleLocked?"lock":"scaleUp"} label={`Scale up ${appName(selectedApp.id)}`} price={P.appCostCents/100} note={scaleLocked?"After load balancing":`${P.appDelay} game seconds`} disabled={disabled||busy||scaleLocked||selectedApp.tier!=="base"||c.cashCents<=P.appCostCents} tip={scaleLocked?"Locked until a load balancer shares traffic across two app servers. Launch Week teaches spreading load first.":"Increases only the selected application's capacity. Database capacity stays unchanged."} decision={{type:"scale_up",appId:selectedApp.id}} onClick={()=>act({type:"scale_up",appId:selectedApp.id})}/></li>}
          {at("gateway")&&show("balancing")&&<li><Act icon="shuffle" label="Deploy load balancing" price={P.lbCostCents/100} note={`${P.lbDelay} game seconds`} disabled={disabled||busy||c.loadBalancer||c.cashCents<=P.lbCostCents} tip="Installs a load balancer. Traffic changes only after you explicitly configure routing." decision={{type:"deploy_load_balancer"}} onClick={()=>act({type:"deploy_load_balancer"})}/></li>}
        </ul>
        {at("gateway")&&show("routing")&&<details className="more"><summary>Configure routing · {routeName(c)}</summary>
        <fieldset className="route-choice" disabled={disabled||!c.loadBalancer||c.pending.some(a=>a.type==="routing"||a.type==="retire-app")}><legend>Send traffic to · changes next game second</legend>
          {routeOptions(c).map(o=>{const on=sameTargets(c.routing.targets,o.targets);return <CampaignDecisionButton decision={{type:"set_routing",mode:"balanced",targets:o.targets}} key={o.label} type="button" className={on?"is-active":""} aria-pressed={on} onClick={()=>{if(!on)act({type:"set_routing",mode:"balanced",targets:o.targets});}} {...tipProps(o.tip)}>{o.label}</CampaignDecisionButton>;})}
        </fieldset><CampaignUnavailable action={{type:"set_routing",mode:"balanced",targets:routableApps(c).map(a=>a.id)}} disabled={disabled||!c.loadBalancer||c.pending.some(a=>a.type==="routing"||a.type==="retire-app")} />{!c.loadBalancer&&<p role="note">Deploy load balancing before configuring routing.</p>}{c.pending.some(a=>a.type==="routing"||a.type==="retire-app")&&<p role="note">A routing or retirement change is pending; wait for activation.</p>}</details>}
      </section>}
      {c.dataStage&&at("cache")&&<section aria-label="Read Cache actions" className="scaling-controls">
        <ul className="actions">
          {at("cache")&&<li><Act icon="bolt" label="Deploy Read Cache" price={D.cacheCostCents/100} note={`${D.cacheDelay} game seconds`} disabled={disabled||busy||!!c.readCache||c.cashCents<=D.cacheCostCents} tip="Activates cold. Only eligible reads can hit; misses and writes still reach the database." decision={{type:"deploy_cache"}} onClick={()=>act({type:"deploy_cache"})}/></li>}
          {at("cache")&&<li><Act icon="sliders" label={`Tune cache ceiling to ${D.tunedTarget/100}%`} price={D.tuningCostCents/100} note={`${D.tuningDelay} game seconds`} disabled={disabled||busy||!c.readCache||c.readCache.tuned||c.cashCents<=D.tuningCostCents} tip="Raises only the hit-rate ceiling; preserves warmth, warm-up speed and upkeep. Requires a deployed, untuned cache." decision={{type:"tune_cache"}} onClick={()=>act({type:"tune_cache"})}/></li>}
        </ul>
      </section>}
    {equipment==="app"&&show("autoscaling")&&c.spikeStage&&<SpikeControls disabled={disabled} busy={busy}/>}
  </div>;
}

function SpikeControls({disabled,busy}:{disabled:boolean;busy:boolean}) {
 const {game,act}=useGame(),c=game.campaign!,d=c.spikeStage!,a=d.controller,o=c.snapshot.spikes;
 const missing=[!d.researchSpent?"Unlock autoscaling":"",!c.loadBalancer?"Deploy load balancing":"",c.routing.mode!=="balanced"||c.routing.targets.length<T.minimum?`Balance traffic across at least ${T.minimum} apps`:"",busy?"Finish the pending deployment":"",c.cashCents<=T.controllerCostCents?"Keep enough available cash for deployment":""].filter(Boolean);
 return <section className="panel-section scaling-controls" aria-label="Autoscaling">
  {!a&&missing.length>0&&<p role="note">Before deployment: {missing.join("; ")}.</p>}
  <p role="status">Controller: {a?(a.enabled?"Enabled":"Disabled"):"Not deployed"}. {a?.blockedReason??""}</p>
  <ul className="actions">
   {!d.researchSpent&&<li><Act icon="lock" label="Unlock autoscaling" note="1 research point" noteIcon="bulb" disabled={disabled} tip="Spend the data-readiness point to unlock this capability. Deployment is a separate purchase." decision={{type:"unlock_autoscaling"}} onClick={()=>act({type:"unlock_autoscaling"})}/></li>}
   {!a&&<li><Act icon="scale" label="Deploy autoscaling" price={T.controllerCostCents/100} note={`${T.controllerDelay} game seconds`} disabled={disabled||busy||!d.researchSpent||!c.loadBalancer||c.routing.mode!=="balanced"||c.routing.targets.length<2||c.cashCents<=T.controllerCostCents} tip="Requires balanced routing to at least two apps. Controller upkeep is $100 per operating week, including while disabled." decision={{type:"deploy_autoscaler"}} onClick={()=>act({type:"deploy_autoscaler"})}/></li>}
   {a&&<li><button className="btn" disabled={disabled} aria-pressed={a.enabled} onClick={()=>act({type:"set_autoscaling",enabled:!a.enabled})}><Icon name="switch" size={16} />{a.enabled?"Disable autoscaling":"Enable autoscaling"}</button></li>}
  </ul>
  <details className="more"><summary>Technical Details</summary>
   <p>Research: {researchBalance(c)} point(s) available. Autoscaling {d.researchSpent?"unlocked":"locked"}.</p>
   <p>Installed {c.apps.length} / maximum {T.maximum}; routed {c.routing.targets.length}. Automatic apps cost {dollars(Q.appCostCents)} setup and {dollars(Q.appWeeklyCents)}/week after installation. Controller upkeep: {dollars(T.controllerWeeklyCents)}/week, including while disabled.</p>
   <p>Observed routed busy utilisation: {o?`${(o.routedBusyBasisPoints/100).toFixed(2)}%`:"No controller observation yet"}. High-utilization observations: {a?.highSteps??0} / 3; low-utilization observations: {a?.lowSteps??0} / 6.</p>
   <p>Scale out above {T.high/100}% for {T.highSteps} game seconds. Empty controller apps may retire below {T.low/100}% for {T.lowSteps} safe game seconds; minimum {T.minimum}. Cooldown remaining: {Math.max(0,(a?.cooldownUntil??0)-c.step)} game seconds.</p>
   <p>Automatic provisioning takes {T.provisionDelay} game seconds, followed by {T.routingDelay} routing game second. {a?.joiningAppId?`Joining ${a.joiningAppId.replace("app-","App ")}; installed capacity may still be unrouted.`:"No automatic app awaiting routing."}</p>
   <p>Application automation cannot increase DB capacity, cache effectiveness or admitted traffic. Manual investments and traffic limiting remain available.</p>
  </details>
 </section>;
}

/** The three visible game speeds beside Run: the end-week rush is a separate 20x toggle, not a speed. */
const SPEEDS = [{ v: 0.5, label: "0.5×" }, { v: 1, label: "1×" }, { v: 2, label: "2×" }] as const;

const NARROW_DOCK = "(max-width: 640px)";
const watchNarrowDock = (change: () => void) => {
  const query = window.matchMedia?.(NARROW_DOCK);
  query?.addEventListener("change", change);
  return () => query?.removeEventListener("change", change);
};
/** Below 640px three speed buttons crowd out the week readout, so the speeds fold into the dock's speed menu. */
const useNarrowDock = () => useSyncExternalStore(watchNarrowDock, () => window.matchMedia?.(NARROW_DOCK).matches ?? false, () => false);

export function CampaignControls() {
  const { game, running, setRunning, speed, setSpeed, weekRush, endWeek, cancelWeekRush } = useGame();
  const narrow = useNarrowDock();
  const { runGold, pauseGold } = useCampaignAttention();
  const active = useGame(s=>s.started) && !introductionActive(game.campaign) && pendingStop(game.campaign) === null && !milestoneBlocks(game) && (game.phase === "management" || game.phase === "incident");
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
      <div className="dock-speeds" {...(narrow ? {} : { role: "group", "aria-label": "Game speed" })}>
        {narrow ? <TimeMenu /> : SPEEDS.map(({ v, label }) => <button type="button" key={v} className={`dock-speed${speed === v && !weekRush ? " is-on" : ""}`} aria-pressed={speed === v && !weekRush}
          {...tipProps(`Run at ${label} speed`)} onClick={() => setSpeed(v)}>{label}</button>)}
        <button type="button" className={`dock-speed dock-rush${weekRush ? " is-on" : ""}`} aria-pressed={weekRush} aria-label="End the week at 20 times speed"
          {...tipProps("Fast-forward to the end of the week (20×). Stops at the week boundary and slows back down if an incident happens.")}
          disabled={!active} onClick={() => weekRush ? cancelWeekRush() : endWeek()}><Icon name="stepMany" size={16} /><span>End week</span></button>
      </div>
      <button type="button" className={`btn btn-primary campaign-play dock-primary${running ? " is-on" : ""}${runGold || pauseGold ? " campaign-gold-attention" : ""}`} aria-label={running ? "Pause" : "Run"} {...tipProps("Run or pause the company (P)")} disabled={!active} onClick={() => setRunning(!running)}><Icon name={running ? "pause" : "play"} /><span>{running ? "Pause" : "Run"}</span></button>
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
    {(c.scorecard||c.combinedStage?.finalReview)&&<button className="btn" onClick={()=>openView("scorecard")}><Icon name="goal" size={16} />View run scorecard</button>}
    {saveBlocked && <Callout tone="warn" icon="save" kicker="Save preserved" live="alert">Your stored save is unreadable or unsupported and has been preserved. This run stays in memory until you explicitly reset.</Callout>}
    <MenuTabs value={tab} onChange={goTo}>
      {tab === "run" && <>
        <MenuActions onResume={close}>
          <div data-tutorial="save-now"><MenuTile icon="save" kind="ok" title="Save now" text="Write this company to the browser." onClick={() => saveNow()} /></div>
          <MenuTile icon="info" kind="users" title="How to play" text="Replay Launch Week: the same opening week on a practice company, your company kept as it is." onClick={() => useGame.getState().startTour("campaign")} />
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
  chapterComplete?: (chapter: AnnouncedChapter) => ReactNode;
}

export function CampaignOverlays({ home, menu, chapterComplete }: CampaignOverlaySlots = {}) {
  const { started, view } = useGame();
  if (!started) return home ?? <HomeScreen />;
  // Tech and History open over the room from the bottom bar, as in Classic; dialogs that need an answer sit above them.
  return <>
    {view === "tech" && <ViewSheet view="tech"><p className="campaign-tech-intro"><Icon name="tree" size={16} /> Technologies are capabilities. Select an icon to see its effect. <strong>Owned does not mean deployed.</strong> Inspect equipment to find deployments and their running costs.</p><TechTree /></ViewSheet>}
    {view === "history" && <ViewSheet view="history"><p className="campaign-tech-intro"><Icon name="history" size={16} /> Check what changed after a decision. <strong>Charts</strong> show trends, <strong>Events</strong> list your decisions and <strong>Incidents</strong> hold the reports.</p><CampaignHistory /></ViewSheet>}
    <LaunchIntro />
    <CampaignDialog menu={menu} chapterComplete={chapterComplete} />
  </>;
}

/** The one dialog that currently needs the player, if any. */
function CampaignDialog({ menu, chapterComplete: completeSlot }: Pick<CampaignOverlaySlots, "menu" | "chapterComplete">) {
  const { game, view, openView, act, chapterComplete, tutorialCompany, scope, finishChapter } = useGame();
  const c = game.campaign!;
  // Escape, Close and the backdrop answer every completion menu the way Stay in this chapter does.
  const stay = () => finishChapter("stay");
  // A finished chapter's recognition doubles as its completion menu: Stay or Continue. Judging what the next chapter
  // waits for copies the company, so it is worked out once per game state rather than on every store update.
  const end = useMemo(() => chapterEnd(game, scope), [game, scope]);
  if(view==="scorecard"&&(c.scorecard||c.combinedStage?.finalReview))return <Modal title="Company scorecard" className="campaign-recovery-report" onClose={()=>openView("guidance")}><CampaignScorecard card={(c.scorecard??c.combinedStage!.finalReview)!} pendingReview={!c.scorecard}/></Modal>;
  if(pendingCombined(c)&&!["guidance","menu","history"].includes(view??"")){
    const d=c.combinedStage!,r=d.currentRound;
    return <Modal title={d.finalReview?"Final campaign review":"Growth outcome"} className="campaign-recovery-report" onClose={()=>openView("guidance")}>
      {d.finalReview?<><CampaignScorecard card={d.finalReview} pendingReview/><div className="modal-foot"><button className="btn btn-primary" onClick={()=>act({type:"complete_campaign"})}><Icon name="goal" size={16} />Complete campaign</button></div></>:
        <><CampaignReport lesson={outcomeSummary(c,"growth",r!)}>
          <h4>Recorded growth outcome</h4><p>{r!.scenario.template}: registered users reached {r!.users.toLocaleString("en-US")}. Temporary pressure has ended.</p>
          <p>All applications restored; five stable full-demand baseline game seconds; actual incident reports acknowledged.</p>
          <p>Rejected requests during this round: {c.cumulative.rejected-r!.rejectedBefore}; setup spending {dollars(c.investedCents-r!.setupBefore)}. Review actual actions and causal reports in History.</p>
          {r&&<RecordedFields data={r}/>}
        </CampaignReport><ContinueFoot label="Continue company" onClick={()=>act({type:"acknowledge_growth"})}/></>}
    </Modal>;
  }
  if (pendingReliability(c) && end) return <Modal title="Reliability outcome" className="campaign-recovery-report" icon={{ kind: "ok", name: "health" }} onClose={stay}>
    <ReliabilityOutcome campaign={c} />
    <ChapterEndFoot end={end} />
  </Modal>;
  if (pendingPreventionReview(c)) return <Modal title="Prevention review" wide className="campaign-recovery-report" icon={{ kind: "ok", name: "health" }}><PreventionOutcome campaign={c} /><ContinueFoot label="Continue company" onClick={()=>act({type:"acknowledge_prevention_review"})} /></Modal>;
  if (game.phase === "review") {
    const report = c.reports[c.reports.length - 1];
    if (!tutorialCompany) return <CampaignRecoveryReview key={`${c.runId}:${report.id}:${report.recoveredStep}`} runId={c.runId} report={report} reliability={!c.combinedStage ? reliabilityLesson(c, report) : undefined} onContinue={() => act({ type: "acknowledge_review" })} />;
    return <Modal title="Incident postmortem" wide className="campaign-recovery-report" icon={{ kind: "ok", name: "incident" }}><Report report={report} /><ContinueFoot label="Continue company" onClick={() => act({ type: "acknowledge_review" })} /></Modal>;
  }
  if(milestoneBlocks(game)&&c.launchWeek&&end?.chapter==="opening")return <LaunchScore campaign={c} end={end} onClose={stay} />;
  if(c.openingMilestone&&!c.openingMilestone.acknowledged&&!c.launchWeek&&end)return <Modal title="First growth challenge handled" className="campaign-recovery-report" icon={{ kind: "go", name: "goal" }} onClose={stay}>
    <CampaignReport lesson={outcomeSummary(c,"opening")}><p>{c.openingMilestone.outcomeId?"You handled Opening growth without an incident.":"You recovered your first production incident."} Your company is still operating. Your architecture, cash and pending work are preserved.</p>
    <p>{c.limit!==null?"The traffic limit remains active: rejected demand still has a revenue trade-off.":"Your company is serving its current demand."} Next: application scaling and routing.</p><RecordedFields data={c.openingMilestone}/></CampaignReport>
    <ChapterEndFoot end={end} />
  </Modal>;
  if(pendingSpikeAcknowledgement(c) && end && view!=="menu" && view!=="history") return <Modal title="Spike response handled" className="campaign-recovery-report" icon={{ kind: "go", name: "goal" }} onClose={stay}><CampaignReport lesson={outcomeSummary(c,"spikes")}><p>Both demand pulses ended and five baseline game seconds qualified for stable service. The same company continues with its investments and operating costs.</p><RecordedFields data={{stage:c.spikeStage,observations:c.recent.filter(m=>m.spikes)}}/></CampaignReport><ChapterEndFoot end={end} /></Modal>;
  // It pauses the clock when it appears, so it shows over History and guidance rather than waiting behind them.
  if(chapterComplete&&chapterComplete===finishedChapter(game)&&view!=="menu"&&end)return completeSlot ? completeSlot(chapterComplete) : <ChapterComplete chapter={chapterComplete} end={end} onClose={stay} />;
  const finale = campaignFinale(game);
  if(finale&&!["guidance","menu","history","tech"].includes(view??""))return <CampaignFinale key={finale.key} finale={finale}><Modal title="Campaign complete" className="campaign-recovery-report" onClose={()=>openView("guidance")}><CampaignScorecard card={c.scorecard!}/><div className="modal-foot"><button className="btn" onClick={()=>openView("guidance")}><Icon name="eyes" size={16} />Inspect final company</button><button className="btn" onClick={()=>openView("menu")}><Icon name="refresh" size={16} />Export or start a new company</button></div></Modal></CampaignFinale>;
  if (game.phase === "ended" && game.outcome !== "won" && view === null) return <Modal title="Company bankrupt" className="campaign-recovery-report" tone="alert" icon={{ kind: "critical", name: "cash" }} onClose={() => openView("menu")}>
    <CampaignReport lesson={c.scorecard?scorecardSummary(c.scorecard,false):{happened:"The company ran out of cash.",response:"No specific recovery is established by the retained record.",improve:"Compare operating costs with earned revenue before expanding.",takeaway:"Capacity must be affordable to operate."}}><Callout tone="critical" icon="cash" kicker="Company closed">Cash reached {dollars(c.cashCents)} after settlement at game second {c.step}. Final metrics and history remain available.</Callout>
    <p>Last period revenue: {dollars(c.settlements.at(-1)?.revenueCents??0)}. Infrastructure: {dollars(infrastructureCents(c.settlements.at(-1)))}. Salaries: {dollars(c.settlements.at(-1)?.salaryCents??0)}.</p>
    <p>Upfront investment: {dollars(c.investedCents)}. Rejected demand: {c.cumulative.rejected} requests (not an extra cash charge).</p>{c.scorecard&&<RecordedFields data={c.scorecard}/>}</CampaignReport>
    <div className="modal-foot"><button className="btn btn-quiet" onClick={() => openView("history")}><Icon name="history" size={16} />View history</button><button className="btn btn-primary" onClick={() => openView("menu")}><Icon name="refresh" size={16} />Export or start a new company</button></div>
  </Modal>;
  if (view === "menu") { const tab: MenuTab = game.phase === "ended" ? "saves" : "run"; return menu ? menu(tab) : <CampaignMenu initialTab={tab} />; }
  return null;
}

const COMPLETIONS: Record<AnnouncedChapter, { title: string; text: string }> = {
  scaling: { title: "Scaling & Routing complete", text: "Your added capacity and routing carried the growth wave." },
  data: { title: "Data Strategy complete", text: "Your Database kept up with the new workload." },
};

/** Scaling & Routing and Data Strategy have no recognition of their own, so finishing them stops here once. */
function ChapterComplete({ chapter, end, onClose }: { chapter: AnnouncedChapter; end: ChapterEnd; onClose: () => void }) {
  const { game } = useGame();
  const done = COMPLETIONS[chapter];
  return <Modal title={done.title} className="campaign-recovery-report" icon={{ kind: "go", name: "goal" }} onClose={onClose}>
    <CampaignReport lesson={outcomeSummary(game.campaign!,chapter)}>
      <p>{done.text} Your architecture, cash and investments carry forward.</p><p>Next: {end.next.name}. {end.next.description}</p>
      <RecordedFields data={{stage:chapter==="scaling"?game.campaign!.scaling:game.campaign!.dataStage,snapshot:game.campaign!.snapshot}}/>
    </CampaignReport>
    <ChapterEndFoot end={end} />
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
/** History uses Classic's tabs: charts, the event log and the incident reports, with the step as the time unit. */
function CampaignHistory() {
  const c = useGame(s => s.game.campaign!);
  const legacy = useGame(s => !!s.tutorialCompany);
  const [tab, setTab] = useState<HistoryTab>("charts");
  const [open, setOpen] = useState<string | null>(null);
  const steps = c.recent.map(m => m.step);
  const eventTypes = new Map(c.trace.map(e => [e.id, e.type]));
  // Chapter outcomes are not incidents; they are listed after the incident reports, newest report first.
  const done = <span className="tag tag-ok"><Icon name="check" size={12} />Completed</span>;
  const entries: ReportEntry[] = [
    ...[...c.reports].reverse().map((report): ReportEntry => ({ id: report.id, group: "incident", title: incidentTitle(report), when: `Game seconds ${report.openedStep}-${report.recoveredStep}`, label: "Incident report",
      tag: report.limited ? <span className="tag tag-warn"><Icon name="alert" size={12} />Recovered under traffic limit</span> : <span className="tag tag-ok"><Icon name="check" size={12} />Recovered</span>,
      body: legacy ? <Report report={report} /> : <CampaignIncidentReport report={report} /> })),
    ...(c.reliabilityStage?.completedStep != null ? [{ id: "reliability-outcome", group: "outcome" as const, title: "Stay Online outcome", when: `Game second ${c.reliabilityStage.completedStep}`, label: "Historical reliability outcome", tag: done, body: <ReliabilityOutcome campaign={c} /> }] : []),
    ...(c.openingPrevention?.outcome ? [{ id: "prevention-outcome", group: "outcome" as const, title: "Opening prevention outcome", when: `Game second ${c.openingPrevention.outcome.qualifiedStep}`, label: "Historical Opening prevention outcome", tag: done, body: <PreventionOutcome campaign={c} /> }] : []),
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
    {tab === "events" && <EventFeed className="campaign-feed" entries={describeEvents(c.trace).reverse().map(e => ({ id: e.id, kind: eventKind(eventTypes.get(e.id) ?? "info"), when: `Game second ${e.step}`, text: [e.title, e.detail].filter(Boolean).join(" · ") }))} />}
    {tab === "postmortems" && <ReportIndex entries={entries} incidents={c.reports.length} open={open} onOpen={setOpen} />}
    </HistoryTabs>
  </div>;
}

interface ReportEntry { id: string; group: "incident" | "outcome"; title: string; when: string; label: string; tag: ReactNode; body: ReactNode }
/**
 * Wide sheets show the reports as a list beside the selected report, so the sheet's width carries the reading.
 * Narrow sheets keep each report expanding in place under its row.
 */
function ReportIndex({ entries, incidents, open, onOpen }: { entries: ReportEntry[]; incidents: number; open: string | null; onOpen: (id: string | null) => void }) {
  const wide = useMediaQuery("(min-width: 901px)");
  const reportHeading = useRef<HTMLHeadingElement>(null);
  const focusReport = useRef(false);
  const selected = wide ? entries.find(e => e.id === open) ?? entries[0] : entries.find(e => e.id === open) ?? null;
  // Choosing a report in the wide list moves focus to it, so keyboard and screen reader users land on what they chose.
  useEffect(() => {
    if (!focusReport.current) return;
    focusReport.current = false;
    reportHeading.current?.focus();
  }, [selected?.id]);
  if (!entries.length) return <div className="history-incidents"><p className="empty">No incidents yet.</p></div>;
  const row = (e: ReportEntry) => <li key={e.id} className={wide && e === selected ? "is-selected" : undefined}>
    <button type="button" className="pm-toggle" {...(wide ? { "aria-current": e === selected ? "true" as const : undefined } : { "aria-expanded": e === selected })} onClick={() => {
      if (!wide) return onOpen(e === selected ? null : e.id);
      if (e === selected) return reportHeading.current?.focus();
      focusReport.current = true;
      onOpen(e.id);
    }}>
      <Icon name={e.group === "incident" ? "incident" : "goal"} size={16} />
      {/* The tag sits under the title, so a long outcome never pushes the chevron past a phone-width row. */}
      <span className="pm-title">{e.title}<small>{e.when}</small>{e.tag}</span>
      {!wide && <Icon name="down" size={16} className="pm-chevron" />}
    </button>
    {!wide && e === selected && <section className="pm" aria-label={e.label}>{e.body}</section>}
  </li>;
  const groups = <>
    <h3 className="history-subhead">Incidents</h3>
    {incidents === 0 ? <p className="empty">No incidents yet.</p> : <ul className="pm-list" aria-label="Incident reports">{entries.filter(e => e.group === "incident").map(row)}</ul>}
    {entries.some(e => e.group === "outcome") && <><h3 className="history-subhead">Chapter outcomes</h3><ul className="pm-list" aria-label="Chapter outcomes">{entries.filter(e => e.group === "outcome").map(row)}</ul></>}
  </>;
  if (!wide) return <div className="history-incidents">{groups}</div>;
  return <div className="history-incidents history-split">
    <nav className="history-index" aria-label="Reports">{groups}</nav>
    {selected && <section key={selected.id} className="history-report" aria-label={selected.label}>
      <header><h3 ref={reportHeading} tabIndex={-1}>{selected.title}</h3><p>{selected.when}{selected.tag}</p></header>
      {selected.body}
    </section>}
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
  const capacity=survivingCapacity(related.flatMap(r=>r.snapshots).filter(m=>m.step>=f.startedStep!));
  return <>
    <CampaignReport summary={capacity&&<CapacityAfterFailure {...capacity}/>} lesson={lesson?{happened:lesson.happened,response:lesson.recovered,improve:lesson.improve,takeaway:lesson.takeaway}: {happened:"The reliability test completed.",response:"The saved records do not show a specific repair.",takeaway:"Verify service after restoring a server."}}>
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
    <p>Verified prevention is a valid Opening completion path. Acknowledge this outcome, then the Opening recognition, to unlock Scaling &amp; Routing. No incident or postmortem is required for prevention.</p>
    {prepared.length?<ul>{prepared.map(a=><li key={a.id}>{PREPARATION_NAMES[a.type]}: {a.activatedStep!==null&&a.activatedStep<=o.qualifiedStep?"active before completion":"still pending at completion"}{a.costCents>0?` · setup ${dollars(a.costCents)}`:" · no setup cost"}.</li>)}</ul>:<p>No infrastructure or admission changes were recorded before completion.</p>}
    <dl className="rows">
      <Row label="Application demand / capacity" value={`${num(m.app.demand)} / ${num(m.app.capacity)} req/s`} />
      <Row label="Database demand / capacity" value={`${num(m.db.demand)} / ${num(m.db.capacity)} ops/s`} />
      <Row label="Setup spending" value={dollars(o.setupCents)} />
      <Row label="Rejected before completion" value={`${num(o.rejectedDemand)} requests`} tip="Revenue forgone from rejected demand, not an extra cash charge." />
    </dl>
  </div>;
}

function ReliabilityControls({disabled,busy,equipment,appId}:{disabled:boolean;busy:boolean;equipment:EquipmentId;appId?:string}) {
  const {game,act}=useGame(),c=game.campaign!,d=c.reliabilityStage!;
  const recipients=effectiveTargets(c),spare=c.apps.find(a=>a.id===d.spareId);
  const at=(...places:EquipmentId[])=>places.includes(equipment);
  const checksUnavailable=disabled||busy||d.checksStep!==null||!d.owned.includes("health_checks")||c.cashCents<=R.checksCostCents;
  const spareUnavailable=disabled||busy||!!d.spareId||c.apps.length>=T.maximum||!d.owned.includes("standby")||c.cashCents<=R.spareCostCents;
  const failoverUnavailable=disabled||busy||!!d.failover||!d.owned.includes("auto_failover")||d.checksStep===null||!c.loadBalancer||!spare||spare.health==="failed"||c.cashCents<=R.failoverCostCents;
  return <section aria-label="Reliability actions" className="scaling-controls">
    <ul className="actions">
      {at("monitoring")&&<li><Act icon="checkbox" label="Deploy Health Checks" tour="deploy-checks" price={R.checksCostCents/100} note="2 game seconds" disabled={checksUnavailable} tip="Requires its research unlock and available cash. Detects health changes; load balancing is required for routing exclusion." decision={{type:"deploy_health_checks"}} onClick={()=>act({type:"deploy_health_checks"})} /></li>}
      {at("app")&&<li><Act icon="plug" label="Install spare" price={R.spareCostCents/100} note="2 game seconds" disabled={spareUnavailable} tip="Requires Spare Application research, available cash and a free instance slot. A spare receives no traffic until promoted." decision={{type:"install_spare"}} onClick={()=>act({type:"install_spare"})} /></li>}
      {at("gateway")&&<li><Act icon="switch" label="Deploy Automatic Failover" price={R.failoverCostCents/100} note="2 game seconds" disabled={failoverUnavailable} tip="Requires its research unlock, deployed Health Checks and Load Balancing, a healthy reserved spare and available cash. Creates no capacity." decision={{type:"deploy_failover"}} onClick={()=>act({type:"deploy_failover"})} /></li>}
      {at("gateway")&&d.failover&&<li><Act icon="switch" label={d.failover.enabled?"Disable failover":"Enable failover"} price={0} disabled={disabled} decision={{type:"set_failover",enabled:!d.failover!.enabled}} onClick={()=>act({type:"set_failover",enabled:!d.failover!.enabled})} /></li>}
    </ul>
    {at("app")&&<div className="instance-choices">{c.apps.filter(a=>!appId||a.id===appId).map(a=><div key={a.id} className="chip">
      <span>{appName(a.id)} · {a.health??"healthy"} · detected {a.detectedHealth??"unknown"} · {a.role??"serving"} · {recipients.includes(a.id)?"receiving traffic":"not receiving traffic"}</span>
{!appId&&<button className="btn btn-small" disabled={disabled} onClick={()=>inspectInRoom("app",a.id)}>Inspect {appName(a.id)} health · free</button>}
      {a.health==="failed"&&(appId?<Act icon="health" label={`Restore ${appName(a.id)} · free · 3 game seconds`} price={0} note="3 game seconds" disabled={disabled||busy} tip="Restore this failed server for free. Restoration takes three game seconds; service recovery still needs healthy observations." decision={{type:"restore_app",appId:a.id}} onClick={()=>act({type:"restore_app",appId:a.id})}/>:<CampaignDecisionButton className="btn btn-small" disabled={disabled||busy} decision={{type:"restore_app",appId:a.id}} onClick={()=>act({type:"restore_app",appId:a.id})}><Icon name="health" size={16} />Restore {appName(a.id)} · free · 3 game seconds</CampaignDecisionButton>)}
      {!a.routed&&a.role!=="spare"&&<CampaignDecisionButton className="btn btn-small" disabled={disabled||busy||!d.owned.includes("standby")||!!d.spareId} decision={{type:"reserve_spare",appId:a.id}} onClick={()=>act({type:"reserve_spare",appId:a.id})}><Icon name="plug" size={16} />Reserve {appName(a.id)} as spare · 1 game second</CampaignDecisionButton>}
      {a.role==="spare"&&<CampaignDecisionButton className="btn btn-small" disabled={disabled||busy} decision={{type:"release_spare"}} onClick={()=>act({type:"release_spare"})}><Icon name="switch" size={16} />Release spare · 1 game second</CampaignDecisionButton>}
    </div>)}</div>}

  </section>;
}
function ScalingRiskConsent(){const {act}=useGame();const [confirm,setConfirm]=useState(false);const {riskOpen}=useCampaignAttention();useEffect(()=>{riskOpen(confirm);return ()=>riskOpen(false);},[confirm,riskOpen]);return <section aria-label="Scaling growth risk"><p>Next wave: 1,400 req/s. Prepare 2,000 ops/s database headroom, or choose to take the risk.</p><button className="btn" onClick={()=>setConfirm(true)}>Consider growth with current capacity</button>{confirm&&<><p>Accept growth risk? This waives only the database-headroom requirement. Existing timing, costs and service rules remain.</p><button className="btn" data-guidance="accept_scaling_risk" onClick={()=>{if(act({type:"accept_scaling_risk"}))setConfirm(false);}}>Accept growth risk</button><button className="btn" onClick={()=>setConfirm(false)}>Keep preparing</button></>}</section>;}

