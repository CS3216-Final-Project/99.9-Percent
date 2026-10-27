import { introductionActive } from "@/sim/introduction";
import { equipmentInfo } from "@/sim";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { inspectOrSelect, useGame } from "@/game/store";
import { Icon } from "./icons";
import { EQUIPMENT_ICON, STATE_META } from "./presentation";
import { InspectionPurchaseContext } from "./useCampaignAttention";
import { CampaignDataDetails, CampaignEquipmentActions, type EquipmentActionView } from "./CampaignUI";
import { CampaignReadings } from "./CampaignReadings";
import { milestoneBlocks } from "@/game/campaignGuidance";
import { pendingStop } from "@/sim/step";
import { effectiveTargets } from "@/sim/reliability";
import { num } from "@/game/format";
import { campaignAppHealth } from "@/game/campaignAppHealth";
import { confirmingAction, subscribeConfirming } from "./actionConfirmation";
import { Modal, Row } from "./ui";
import { useMediaQuery } from "./useMediaQuery";
import "./ServerInspection.css";

/**
 * The diagnostic card an inspection started in the 3D room opens: the equipment's scanner on the left, the
 * reading on the right. It changes nothing about the selection — closing it returns to the same inspector.
 */
export default function InspectionReveal() {
  const inspection = useGame((s) => s.roomInspection);
  const game = useGame((s) => s.game);
  const dismiss = useGame((s) => s.dismissRoomInspection);
  if (!inspection) return null;
  if (game.campaign && ["db","app","gateway","cache","monitoring"].includes(inspection.equipment))
    return <ComponentInspection key={inspection.seq} />;
  const info = equipmentInfo(game, inspection.equipment);
  const state = STATE_META[info.state];
  // A Challenge Mode incident turns this click into a timed investigation, so the card says that instead.
  const investigating = !game.campaign && game.phase === "incident" && game.incident?.inspecting?.equipment === inspection.equipment;
  return (
    <Modal
      title={investigating ? `${info.name} investigation started` : `${info.name} inspected`}
      icon={{ kind: state.tone, name: EQUIPMENT_ICON[info.id] }}
      onClose={dismiss}
      className="inspection-reveal"
    >
      <div className="inspection-scan-layout">
        <div className="inspection-scanner" aria-hidden="true">
          <span className="inspection-scanner-rings" />
          <span className="inspection-sweep" />
          <Icon name={EQUIPMENT_ICON[info.id]} size={40} />
        </div>
        <div className="inspection-reading">
          <p className="inspection-status">
            <span className={`state state-${info.state}`}>
              <Icon name={state.icon} size={12} />
              {state.word}
            </span>
            {inspection.appId && <span className="inspection-instance">App {inspection.appId.slice(4)}</span>}
          </p>
          <p className="muted">{info.summary}</p>
          <p>{investigating ? "Evidence arrives here when the timed investigation completes; the inspector below tracks it." : info.about}</p>
        </div>
      </div>
      <div className="modal-foot">
        <span className="muted">The inspector keeps the details.</span>
        <button type="button" className="btn btn-primary" onClick={dismiss}>
          Return to room
        </button>
      </div>
    </Modal>
  );
}

/** Both the room and keyboard-accessible shortcuts open this same live inspection. */
function ComponentInspection() {
  const {game,roomInspection:inspection,dismissRoomInspection:dismiss,selectedAppId,view,chapterComplete}=useGame();
  const desktop=useMediaQuery("(min-width: 901px)");
  const [details,setDetails]=useState(false);
  const [page,setPage]=useState<"overview"|"management"|EquipmentActionView>(()=>inspection?.equipment==="app"&&inspection.appId?"server":"overview");
  const subview=useRef<HTMLDivElement>(null);
  const navigate=(next:typeof page)=>{setDetails(false);setPage(next);};
  const previousPage=useRef(page);
  const previousApp=useRef(selectedAppId);
  useLayoutEffect(()=>{
    // Let Modal capture the opener before focusing its initial control. Only
    // internal navigation moves focus here; otherwise Escape restores a removed node.
    if(previousPage.current!==page||page==="server"&&previousApp.current!==selectedAppId)subview.current?.focus({preventScroll:true});
    previousPage.current=page;
    previousApp.current=selectedAppId;
    subview.current?.closest(".modal-body")?.scrollTo?.({top:0});
  },[page,selectedAppId]);
  const confirming=useSyncExternalStore(subscribeConfirming,confirmingAction);
  const c=game.campaign!;
  const mandatory=pendingStop(c)!==null||milestoneBlocks(game)||!!chapterComplete;
  const previousPending=useRef(c.pending.map(a=>a.id));
  useEffect(()=>{
    const added=c.pending.some(a=>!previousPending.current.includes(a.id));
    previousPending.current=c.pending.map(a=>a.id);
    if (added || mandatory || view || game.phase==="review" || game.phase==="ended") dismiss();
  },[c.pending,mandatory,view,game.phase,dismiss]);
  if (!inspection || mandatory || view || game.phase==="review" || game.phase==="ended") return null;
  const place=inspection.equipment as "db"|"app"|"gateway"|"cache"|"monitoring";
  const info=equipmentInfo(game,place),m=c.snapshot;
  const appId=selectedAppId??inspection.appId;
  const instance=place==="app"&&page==="server"&&appId?m.instances?.find(a=>a.id===appId):undefined;
  const installed=place==="app"&&page==="server"&&appId?c.apps.find(a=>a.id===appId):undefined;
  const component=place==="db"?m.db:place==="app"?instance??m.app:null;
  const failed=instance?.health==="failed"||installed?.health==="failed";
  const noCapacity=!!component&&component.capacity<=0;
  const full=!!component&&component.capacity>0&&component.demand===component.capacity;
  const health=campaignAppHealth(game);
  const unit=place==="db"?"operations/s":"requests/s";
  let stateKey: keyof typeof STATE_META=info.state;
  let word=STATE_META[stateKey].word, metric=info.summary, description=info.about;
  if (failed) {
    stateKey="down";word="Down";
    metric=`0 available / ${num(installed?.capacity??0)} installed requests/s`;
    description="This server has failed. Inspect its health and available recovery actions.";
  } else if (installed&&!instance) {
    stateKey="warn";word="Awaiting observation";metric=`${num(installed.capacity)} requests/s installed`;
    description="This server has no individual workload observation yet.";
  } else if (noCapacity) {
    stateKey="warn";
    word=place==="db"?"No database capacity":installed?.role==="spare"?"Standby spare":installed&&!installed.routed?"Not receiving traffic":"No routed capacity";
    metric=place==="db"?"0 operations/s available":`${num(installed?.capacity??m.installedAppCapacity)} requests/s installed; no active routed capacity`;
    description=installed?.role==="spare"?"This spare stays off the serving route until promoted.":"There is no active capacity here. Inspect health, routing, pending deployments and waiting work.";
  } else if (component) {
    stateKey=component.demand>component.capacity?"critical":full||component.backlog>0||component.demandRatio>=0.85?"warn":"ok";
    word=full?"At capacity":STATE_META[stateKey].word;
    metric=`${num(component.demand)} / ${num(component.capacity)} ${unit}`;
    const name=place==="db"?"database":"server";
    description=component.demand>component.capacity?`Your ${name} is receiving more work than it can process.`:full?`Your ${name} is using all available capacity.`:component.backlog>0?"Requests are waiting. Compare demand, processing and backlog in Inspect details.":`Your ${name} has capacity available.`;
  } else if (place==="monitoring") {
    stateKey=health.tone==="critical"?"critical":health.tone==="warn"?"warn":"ok";
    word=health.word;
    metric=`${m.latencyMs.toFixed(0)} ms latency; ${m.serviceErrorRate===null?"no completed requests":`${(m.serviceErrorRate*100).toFixed(2)}% errors`}`;
    description=health.interpretation;
  } else if (place==="gateway") {
    stateKey=c.limit===null?"ok":"warn";word=c.limit===null?"Healthy":"Traffic limited";
    metric=`${num(m.incoming)} incoming / ${num(m.admitted)} accepted / ${num(m.rejected)} rejected requests/s`;
    description=c.limit===null?"All incoming traffic is admitted.":"Traffic limiting protects capacity but rejects customers; rejected requests earn no revenue.";
  }
  const routes=c.reliabilityStage?effectiveTargets(c):c.routing.targets;
  if (place==="app" && page!=="server") {
    const healthy=c.apps.filter(a=>a.health!=="failed").length;
    if (healthy<c.apps.length) {
      stateKey=healthy===0?"down":"warn";
      word=healthy===0?"Failed":"Warning";
    }
    metric=`${c.apps.length} installed / ${healthy} healthy / ${routes.length} currently routed`;
    description=healthy<c.apps.length?"Failed servers reduce available capacity; check recovery and routing in Server management.":routes.length<healthy?"Healthy servers are available; check Server management for spares and Network for routing.":m.app.demand>m.app.capacity?"Routed servers are receiving more work than they can process.":m.app.backlog>0?"Requests are waiting for the routed servers to process them.":"Healthy servers are receiving traffic and processing incoming requests.";
  }
  const state=STATE_META[stateKey];
  const selected=installed??c.apps.find(a=>a.id===selectedAppId)??c.apps[0];
  const entry=(destination:typeof page,label:string)=> <button type="button" className="btn" data-inspection-entry={destination} disabled={!!confirming} onClick={()=>navigate(destination)}>{label}<Icon name="next" size={14}/></button>;
  const controls=(actionView?:EquipmentActionView)=><InspectionPurchaseContext.Provider value={true}><CampaignEquipmentActions equipment={place} actionView={actionView}/></InspectionPurchaseContext.Provider>;
  const reading=(appId?:string)=><CampaignReadings place={place} campaign={c} appId={appId}/>;
  const technical=(appId?:string)=><details className="more"><summary>Technical Details</summary>{reading(appId)}</details>;
  const overview=page==="overview";
  const appManagement=place==="app"&&page==="management";
  const server=place==="app"&&page==="server";
  const appWorkspace=appManagement||server;
  const back=<button type="button" className="btn btn-small inspection-back" data-inspection-back disabled={!!confirming} onClick={()=>navigate(page==="management"||server&&desktop?"overview":"management")}>{place==="app"?(page==="management"||server&&desktop?"Back to Servers":"Back to Server management"):page==="management"?"Back to Network":"Back to Network management"}</button>;
  const selectServer=(id:string)=>{
    // Keep the modal and its original focus-return target mounted while the
    // shared inspection action records evidence for this particular server.
    inspectOrSelect("app",id);
    navigate("server");
  };
  const title=place==="app"?"App Servers":`${info.name} inspected`;
  const summary=<div className="component-inspection-summary">
      <div className="inspection-scanner" aria-hidden="true"><Icon name={EQUIPMENT_ICON[place]} size={56}/></div>
      <p className="inspection-status"><span className={`state state-${stateKey}`}><Icon name={state.icon} size={12}/>{word}</span></p>
      <p className="component-inspection-metric">{metric}</p><p>{description}</p>
    </div>;
  const failedApps=c.apps.filter(a=>a.health==="failed"),unrouted=c.apps.filter(a=>!routes.includes(a.id)&&a.role!=="spare"&&a.health!=="failed");
  const overloaded=m.instances?.filter(a=>a.routed&&a.demand>a.capacity);
  const warning=failedApps.length?`${failedApps.map(a=>`App ${a.id.slice(4)}`).join(", ")} failed. Check surviving capacity and recovery options.`
    :unrouted.length?`${unrouted.map(a=>`App ${a.id.slice(4)}`).join(", ")}: installed capacity does not receive traffic until Network routing includes ${unrouted.length===1?"this app":"these apps"}.`
    :overloaded?.length?"A routed server is overloaded. Inspect its demand and available capacity.":null;
  return <Modal title={title} icon={{kind:state.tone,name:EQUIPMENT_ICON[place]}} onClose={confirming?undefined:dismiss} className={`component-inspection component-inspection-${place}${appWorkspace?" inspection-app-workspace":""}`}>
    <div className="inspection-subview" data-inspection-view={page} ref={subview} tabIndex={-1}>
    {!overview&&place!=="gateway"&&back}
    {appWorkspace?<div className="inspection-app-layout">
      <section className="inspection-fleet-pane" aria-label="Server management" hidden={server&&!desktop}>
      <h3 className="inspection-management-heading"><Icon name="server" size={20}/>Server management</h3>
      <dl className="inspection-fleet-summary" aria-label="Server counts"><Row label="Installed" value={c.apps.length}/><Row label="Healthy" value={c.apps.filter(a=>a.health!=="failed").length}/><Row label="Currently routed" value={routes.length}/></dl>
      <section aria-label="Application instances" className="inspection-server-cards">{c.apps.map(a=><button type="button" key={a.id} data-guidance-app={a.id} className="inspection-server-card" data-health={a.health??"healthy"} disabled={!!confirming} aria-pressed={selectedAppId===a.id} aria-label={`App ${a.id.slice(4)}: ${a.health??"healthy"}; ${a.role==="spare"?"Standby spare":routes.includes(a.id)?"Receiving traffic":"Installed - not receiving traffic"}`} onClick={()=>selectServer(a.id)}><strong><Icon name="server" size={16}/>App {a.id.slice(4)}</strong><span className="inspection-server-health">{a.health??"healthy"}</span><span className="inspection-server-route" data-routed={routes.includes(a.id)}>{a.role==="spare"?"Standby spare":routes.includes(a.id)?"Receiving traffic":"Not receiving traffic"}</span></button>)}</section>
      {warning&&<p role="note" className="inspection-warning">{warning}</p>}
      <div className="component-inspection-controls">{c.spikeStage?entry("autoscaling","Autoscaling"):<p className="inspection-autoscaling-info"><Icon name="info" size={16}/><span>Autoscaling becomes available in Traffic Spikes.</span></p>}</div>
      <details className="more"><summary>Fleet Technical Details</summary>{reading()}</details>
      </section>
      <section className={`inspection-server-pane${server?"":" is-empty"}`} aria-label={server?`App ${selected.id.slice(4)} details`:"Server details"} hidden={!server&&!desktop}>
      {server?<>
      <h3 tabIndex={-1}>App {selected.id.slice(4)}</h3>{summary}
      <dl className="rows"><Row label="Installed capacity" value={`${num(selected.capacity)} requests/s`}/><Row label="Current demand" value={instance?`${num(instance.demand)} requests/s`:"Not yet observed"}/><Row label="Routing" value={routes.includes(selected.id)?"Receiving traffic":selected.role==="spare"?"Standby spare":"Not receiving traffic"}/></dl>
      {controls("server")}{technical(selected.id)}
      </>:<><Icon name="server" size={32}/><h3>Select a server</h3><p>Compare its health, traffic and capacity, then choose an action.</p></>}
      </section>
    </div>:place==="app"&&page==="autoscaling"?<>
      <h3>Autoscaling</h3><p>Controller: {c.spikeStage?.controller?"Deployed":c.spikeStage?.researchSpent?"Available":"Locked"}. Automatically adjusts application capacity when sustained utilisation crosses its thresholds.</p>
      {controls("autoscaling")}
    </>:place==="gateway"&&!overview?<>
      <div className="inspection-management-header">
        <h3 className="inspection-management-heading"><Icon name="network" size={20}/>Network management</h3>
        {back}
      </div>
      {!c.openingMilestone?.acknowledged&&!c.launchWeek?<p>Complete Opening recognition to manage load balancing and routing.</p>:<>
        <section aria-label="Load balancing"><h4>Load balancing</h4>{controls("balancing")}</section>
        <section aria-label="Routing"><h4>Routing</h4>{controls("routing")}</section>
      </>}
      <section aria-label="Automatic failover"><h4>Automatic failover</h4>
        {!c.reliabilityStage?<p>Automatic failover becomes available in Stay Online.</p>:controls("failover")}</section>
    </>:<>
      {summary}
      <div className="component-inspection-controls"><button className="btn" data-inspection-details aria-expanded={details} onClick={()=>setDetails(!details)}><Icon name="search" size={14} />Inspect details</button>{place!=="monitoring"&&controls(place==="gateway"?"network":place==="app"?"fleet":undefined)}{place==="app"&&entry("management","Server management")}{place==="gateway"&&entry("management","Network management")}</div>
      {details&&<>{reading()}{place==="cache"&&<CampaignDataDetails disabled={mandatory}/>}{place==="monitoring"&&controls()}</>}
    </>}
    {introductionActive(c)&&<button className="btn btn-primary" onClick={dismiss}>Got it</button>}
    {c.pending.length>0&&<p role="status">{c.pending.length} change(s) awaiting activation. Advance time when ready to observe deployment.</p>}
    </div>
  </Modal>;
}
