import { introductionActive } from "@/sim/introduction";
import { equipmentInfo } from "@/sim";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { inspectInRoom, useGame } from "@/game/store";
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
import { Meter, Modal, Row } from "./ui";
import { takeOrigin } from "./inspectionOrigin";

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
      title={investigating ? `${info.name} investigation started` : info.name}
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

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
const GENIE = { duration: 480, easing: "cubic-bezier(0.22, 1, 0.36, 1)" };

/**
 * Opens the card the way a window leaves the dock: it pours out of the icon that was pressed, narrow at first and
 * widening as it lands, while the machine's disc flies from that icon into its place. Opened from anywhere else
 * (another dialog, or after a reload) the card simply appears.
 */
function useGenie(anchor: RefObject<HTMLElement | null>, disc: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const origin = takeOrigin();
    const card = anchor.current?.closest<HTMLElement>(".modal");
    if (!origin || !card || reducedMotion() || typeof card.animate !== "function") return;
    const ox = origin.x + origin.width / 2, oy = origin.y + origin.height / 2;
    const box = card.getBoundingClientRect();
    const dx = ox - (box.x + box.width / 2), dy = oy - (box.y + box.height / 2);
    const sx = Math.max(origin.width / box.width, 0.04), sy = Math.max(origin.height / box.height, 0.04);
    const running = [card.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0 },
      { transform: `translate(${dx * 0.3}px, ${dy * 0.3}px) scale(${Math.max(sx, 0.32)}, 0.9)`, opacity: 1, offset: 0.45 },
      { transform: "none", opacity: 1 },
    ], GENIE)];
    const real = disc.current, target = real?.getBoundingClientRect();
    let ghost: HTMLElement | null = null;
    if (real && target && target.width > 0) {
      ghost = real.cloneNode(true) as HTMLElement;
      ghost.classList.add("inspection-disc-ghost");
      ghost.setAttribute("aria-hidden", "true");
      ghost.removeAttribute("data-inspection-details");
      ghost.inert = true;
      Object.assign(ghost.style, { left: `${target.x}px`, top: `${target.y}px`, width: `${target.width}px`, height: `${target.height}px` });
      document.body.append(ghost);
      // The real disc waits out the flight unseen, and shows again on its own when the flight lands.
      running.push(real.animate([{ opacity: 0 }, { opacity: 0 }], GENIE));
      const scale = Math.max(origin.width, origin.height) / target.width;
      const flight = ghost.animate([
        { transform: `translate(${ox - (target.x + target.width / 2)}px, ${oy - (target.y + target.height / 2)}px) scale(${scale})` },
        { transform: "none" },
      ], GENIE);
      running.push(flight);
      flight.finished.then(() => ghost?.remove(), () => undefined);
    }
    return () => {
      for (const a of running) a.cancel();
      ghost?.remove();
    };
  }, [anchor, disc]);
}

/** Both the room and keyboard-accessible shortcuts open this same live inspection. */
function ComponentInspection() {
  const {game,roomInspection:inspection,dismissRoomInspection:dismiss,selectedAppId,view,chapterComplete}=useGame();
  const [details,setDetails]=useState(false);
  const [page,setPage]=useState<"overview"|"management"|EquipmentActionView>(()=>inspection?.equipment==="app"&&inspection.appId?"server":"overview");
  const subview=useRef<HTMLDivElement>(null);
  const disc=useRef<HTMLButtonElement>(null);
  useGenie(subview,disc);
  const navigate=(next:typeof page)=>{setDetails(false);setPage(next);};
  const previousPage=useRef(page);
  useLayoutEffect(()=>{
    // Let Modal capture the opener before focusing its initial control. Only
    // internal navigation moves focus here; otherwise Escape restores a removed node.
    if(previousPage.current!==page)subview.current?.focus({preventScroll:true});
    previousPage.current=page;
    subview.current?.closest(".modal-body")?.scrollTo?.({top:0});
  },[page]);
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
  const instance=place==="app"&&page==="server"&&inspection.appId?m.instances?.find(a=>a.id===inspection.appId):undefined;
  const installed=place==="app"&&page==="server"&&inspection.appId?c.apps.find(a=>a.id===inspection.appId):undefined;
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
  const back=<button type="button" className="btn btn-small inspection-back" data-inspection-back disabled={!!confirming} onClick={()=>navigate(page!=="management"?"management":"overview")}>{place==="app"?(page==="management"?"Back to Servers":"Back to Server management"):page==="management"?"Back to Network":"Back to Network management"}</button>;
  const title=place==="app"?"App Servers":info.name;
  const lens=details?"zoomOut":"zoomIn";
  // The disc is the machine and the way into its readings: it turns over to a magnifier under the pointer, and pressing it
  // opens the readings below the actions, and again closes them.
  const summary=<div className="component-inspection-summary">
      <button type="button" ref={disc} className={`inspection-disc tone-${state.tone}`} data-inspection-details aria-expanded={details} aria-controls="inspection-details" aria-label="Inspect details" onClick={()=>setDetails(!details)}>
        <span className="inspection-disc-turn">
          <span className="inspection-disc-face"><Icon name={EQUIPMENT_ICON[place]} size={48}/></span>
          <span className="inspection-disc-face inspection-disc-back"><Icon name={lens} size={44}/></span>
        </span>
        <span className="inspection-disc-badge"><Icon name={lens} size={16}/></span>
      </button>
      <p className="inspection-status"><span className={`state state-${stateKey}`}><Icon name={state.icon} size={12}/>{word}</span>{server&&<span>App {selected.id.slice(4)}</span>}</p>
      <p className="component-inspection-metric">{metric}</p>
      {component&&component.capacity>0&&<Meter value={component.demand/component.capacity} tone={state.tone==="muted"?"accent":state.tone} label={`${place==="db"?"Database":"Server"} load`}/>}
      <p>{description}</p>
    </div>;
  const detailsArea=(content:ReactNode)=>details&&<div id="inspection-details" className="inspection-details">{content}</div>;
  const failedApps=c.apps.filter(a=>a.health==="failed"),unrouted=c.apps.filter(a=>!routes.includes(a.id)&&a.role!=="spare"&&a.health!=="failed");
  const overloaded=m.instances?.filter(a=>a.routed&&a.demand>a.capacity);
  const warning=failedApps.length?`${failedApps.map(a=>`App ${a.id.slice(4)}`).join(", ")} failed. Check surviving capacity and recovery options.`
    :unrouted.length?`${unrouted.map(a=>`App ${a.id.slice(4)}`).join(", ")}: installed capacity does not receive traffic until Network routing includes ${unrouted.length===1?"this app":"these apps"}.`
    :overloaded?.length?"A routed server is overloaded. Inspect its demand and available capacity.":null;
  return <Modal title={title} icon={{kind:state.tone,name:EQUIPMENT_ICON[place]}} onClose={confirming?undefined:dismiss} className={`component-inspection component-inspection-${place}`}>
    <div className="inspection-subview" data-inspection-view={page} ref={subview} tabIndex={-1}>
    {!overview&&place!=="gateway"&&back}
    {appManagement?<>
      <h3 className="inspection-management-heading"><Icon name="server" size={20}/>Server management</h3>
      <dl className="inspection-fleet-summary" aria-label="Server counts"><Row label="Installed" value={c.apps.length}/><Row label="Healthy" value={c.apps.filter(a=>a.health!=="failed").length}/><Row label="Currently routed" value={routes.length}/></dl>
      <section aria-label="Application instances" className="inspection-server-cards">{c.apps.map(a=><button type="button" key={a.id} data-guidance-app={a.id} className="inspection-server-card" data-health={a.health??"healthy"} aria-pressed={selectedAppId===a.id} aria-label={`App ${a.id.slice(4)}: ${a.health??"healthy"}; ${routes.includes(a.id)?"Receiving traffic":"Installed - not receiving traffic"}`} onClick={()=>inspectInRoom("app",a.id)}><strong><Icon name="server" size={16}/>App {a.id.slice(4)}</strong><span className="inspection-server-health">{a.health??"healthy"}</span><span className="inspection-server-route" data-routed={routes.includes(a.id)}>{a.role==="spare"?"Standby spare":routes.includes(a.id)?"Receiving traffic":"Not receiving traffic"}</span></button>)}</section>
      {warning&&<p role="note" className="inspection-warning">{warning}</p>}
      <div className="component-inspection-controls">{c.spikeStage?entry("autoscaling","Autoscaling"):<p className="inspection-autoscaling-info"><Icon name="info" size={16}/><span>Autoscaling becomes available in Traffic Spikes.</span></p>}</div>
      {technical()}
    </>:server?<>
      <h3 tabIndex={-1}>App {selected.id.slice(4)}</h3>{summary}
      <dl className="rows"><Row label="Installed capacity" value={`${num(selected.capacity)} requests/s`}/><Row label="Current demand" value={instance?`${num(instance.demand)} requests/s`:"Not yet observed"}/><Row label="Routing" value={routes.includes(selected.id)?"Receiving traffic":selected.role==="spare"?"Standby spare":"Not receiving traffic"}/></dl>
      {controls("server")}{detailsArea(reading(selected.id))}
    </>:place==="app"&&page==="autoscaling"?<>
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
      <div className="component-inspection-controls">{place!=="monitoring"&&controls(place==="gateway"?"network":place==="app"?"fleet":undefined)}{place==="app"&&entry("management","Server management")}{place==="gateway"&&entry("management","Network management")}</div>
      {detailsArea(<>{reading()}{place==="cache"&&<CampaignDataDetails disabled={mandatory}/>}{place==="monitoring"&&controls()}</>)}
    </>}
    {introductionActive(c)&&<button className="btn btn-primary" onClick={dismiss}>Got it</button>}
    {c.pending.length>0&&<p role="status">{c.pending.length} change(s) awaiting activation. Advance time when ready to observe deployment.</p>}
    </div>
  </Modal>;
}
