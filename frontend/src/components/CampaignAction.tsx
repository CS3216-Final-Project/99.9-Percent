import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Action, EquipmentId } from "@/sim";
import { previewCampaignAction } from "@/game/campaignFinance";
import { PurchaseFinance, PurchaseTile, PurchaseWarning } from "./PurchaseFinance";
import { useGame } from "@/game/store";
import { floorOf } from "@/game/floors";
import { lessonAt } from "@/game/walkthrough";
import { moneyFull as money } from "@/game/format";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
import { APPLICATION_SCALING as P } from "@/sim/scenarios/applicationScaling";
import { DATA_STRATEGY as D } from "@/sim/scenarios/dataStrategy";
import { TRAFFIC_SPIKES as T } from "@/sim/scenarios/trafficSpikes";
import { pendingStop } from "@/sim/step";
import { APPLICATION_RELIABILITY as R } from "@/sim/scenarios/applicationReliability";
import { Act } from "./ui";
import { Icon } from "./icons";
import { confirmationRoomArea } from "./roomArea";
import { confirmingAction, setConfirming, subscribeConfirming } from "./actionConfirmation";

/** Equipment roles shown in the quote's supporting facts. */
const MACHINES: Partial<Record<EquipmentId, { name: string; does: string }>> = {
  gateway: { name: "Network", does: "Admits requests and sends them to App Servers." },
  app: { name: "App Servers", does: "Processes requests and accesses the Database." },
  db: { name: "Database", does: "Stores data and handles application reads and writes." },
  cache: { name: "Read Cache", does: "Serves repeated reads from memory." },
  monitoring: { name: "Monitoring", does: "Detects and reports equipment failures." },
};

const PURCHASE_DESCRIPTIONS: Record<string,string> = {
  "Add server":"Handle more traffic with another server.",
  "Upgrade database":"Lets your database handle more requests at the same time.",
  "Deploy load balancing":"Adds a load balancer to share traffic between your servers.",
  "Deploy Read Cache":"Remembers repeated reads to reduce work for your database.",
  "Deploy Health Checks":"Detects failed servers so you can respond sooner.",
  "Install spare":"Adds a spare server you can use when another server fails.",
  "Deploy Automatic Failover":"Switches traffic to a healthy spare after a server failure.",
  "Unlock autoscaling":"Unlocks automatic server scaling. Installing it is a separate purchase.",
  "Deploy autoscaling":"Adds a controller that adjusts servers as demand changes.",
  "Remove traffic limit":"Lets all incoming customer requests reach your servers again.",
};


/** Asks before dispatching; the parent's disabled predicate and dispatcher stay authoritative. */
export function CampaignAction(props: ComponentProps<typeof Act> & { decision?: Action }) {
  const { game, selectedAppId } = useGame();
  const c = game.campaign!, id = useId(), card = useRef<HTMLDivElement>(null);
  const confirming = useSyncExternalStore(subscribeConfirming, confirmingAction);
  const quoteLesson = useGame(s => s.started && !s.onboarding && s.game.phase === "management" && s.tour?.track === "campaign" ? lessonAt(s.tour.step) : undefined);
  const practiceQuote = quoteLesson === "quote" || quoteLesson === "cancel";
  const open = confirming === props.label;
  const restoreFocus = useRef(false);
  useLayoutEffect(()=>{
    if (!open && restoreFocus.current) {
      restoreFocus.current=false;
      let frame=0;
      const focus = ()=>{
        const target=card.current?.querySelector<HTMLElement>("button.act:not(:disabled), .campaign-action-reason");
        if (!target) return;
        // A mobile inspector can still inherit its hidden state during the closing style update.
        if (getComputedStyle(target).visibility==="hidden") {
          frame=requestAnimationFrame(focus);
          return;
        }
        target.focus();
      };
      focus();
      return ()=>cancelAnimationFrame(frame);
    }
  },[open]);
  const [pointing, setPointing] = useState(false);
  useEffect(() => () => { if (confirmingAction() === props.label) setConfirming(null); }, [props.label]);
  const app = c.apps.find(a => a.id === selectedAppId) ?? c.apps[0];
  const busy = c.pending.some(a => !["limit", "unlimit", "routing"].includes(a.type));
  const label = props.label;
  const isAdd = label === "Add server", isScale = label.startsWith("Scale up ");
  const upkeep = isAdd || label === "Install spare" ? Q.appWeeklyCents
    : isScale ? P.appWeeklyCents
    : label === "Upgrade database" ? c.dbCapacity === Q.dbCapacity ? Q.upgradedDbWeeklyCents : c.dbCapacity === Q.upgradedDbCapacity ? P.dbWeeklyCents : D.dbWeeklyCents
    : label === "Deploy load balancing" ? P.lbWeeklyCents
    : label === "Deploy Read Cache" ? D.cacheWeeklyCents
    : label === "Deploy Health Checks" ? R.checksWeeklyCents
    : label === "Deploy Automatic Failover" ? R.failoverWeeklyCents
    : label === "Deploy autoscaling" ? T.controllerWeeklyCents : null;
  // The machines this action changes, lit up in the room while the player points at or confirms it.
  const affected: EquipmentId[] = label === "Upgrade database" ? ["db"]
    : label.startsWith("Limit to") || label === "Remove traffic limit" || label === "Deploy load balancing" ? ["gateway"]
    : label === "Deploy Read Cache" || label.startsWith("Tune cache") ? ["cache"]
    : label === "Deploy Health Checks" ? ["monitoring"]
    : ["app"];
  const currentDbUpkeep = c.dbCapacity === Q.dbCapacity ? Q.dbWeeklyCents : c.dbCapacity === Q.upgradedDbCapacity ? Q.upgradedDbWeeklyCents : c.dbCapacity === P.dbCapacity ? P.dbWeeklyCents : D.dbWeeklyCents;
  const increase = upkeep === null ? null : isScale ? upkeep - Q.appWeeklyCents : label === "Upgrade database" ? upkeep - currentDbUpkeep : upkeep;
  let reason = "See this action's requirements for details.";
  if (game.phase === "ended") reason = "This company has ended.";
  else if (game.phase === "review" || pendingStop(c) !== null || c.openingMilestone && !c.openingMilestone.acknowledged) reason = "Acknowledge the pending review or milestone first.";
  else if (props.price && c.cashCents <= props.price * 100) reason = "Not enough available cash. Pending revenue cannot fund purchases.";
  else if (isAdd && c.apps.length >= (c.spikeStage ? T.maximum : Q.maxApps)) reason = "All instance slots are occupied.";
  else if (isScale && app.tier !== "base") reason = "This App Server is already at its largest tier.";
  else if (label === "Upgrade database" && !props.price) reason = "Current stage tier reached. Continue the campaign for later tiers.";
  else if (label === "Deploy load balancing" && c.loadBalancer) reason = "Load balancing is already deployed.";
  else if (label === "Deploy Read Cache" && c.readCache) reason = "Read Cache is already deployed.";
  else if (label.startsWith("Tune cache") && (!c.readCache || c.readCache.tuned)) reason = !c.readCache ? "Deploy a Read Cache before tuning it." : "This cache is already tuned.";
  else if (label.includes("traffic limit") || label.startsWith("Limit to")) reason = "A traffic-limit change is already pending.";
  else if (label === "Unlock autoscaling" && c.spikeStage?.researchSpent) reason = "Autoscaling is already unlocked.";
  else if (label === "Deploy autoscaling" && !c.spikeStage?.researchSpent) reason = "Unlock Autoscaling in the Technology tree first.";
  else if (label === "Deploy autoscaling" && c.spikeStage?.controller) reason = "The autoscaling controller is already deployed.";
  else if (label === "Deploy autoscaling" && !c.loadBalancer) reason = "Deploy load balancing first.";
  else if (label === "Deploy autoscaling" && (c.routing.mode !== "balanced" || c.routing.targets.length < 2)) reason = "Requires balanced routing to at least two App Servers.";
  else if (label === "Deploy Health Checks" && !c.reliabilityStage?.owned.includes("health_checks")) reason = "Unlock Health Checks in the Technology tree first.";
  else if (label === "Deploy Health Checks" && c.reliabilityStage?.checksStep !== null) reason = "Health Checks are already deployed.";
  else if (label === "Install spare" && !c.reliabilityStage?.owned.includes("standby")) reason = "Unlock Spare Application in the Technology tree first.";
  else if (label === "Install spare" && c.reliabilityStage?.spareId) reason = "A spare is already reserved.";
  else if (label === "Install spare" && c.apps.length >= T.maximum) reason = "All instance slots are occupied.";
  else if (label === "Deploy Automatic Failover" && !c.reliabilityStage?.owned.includes("auto_failover")) reason = "Unlock Automatic Failover in the Technology tree first.";
  else if (label === "Deploy Automatic Failover" && c.reliabilityStage?.failover) reason = "Automatic Failover is already deployed.";
  else if (label === "Deploy Automatic Failover" && c.reliabilityStage?.checksStep === null) reason = "Deploy Health Checks first.";
  else if (label === "Deploy Automatic Failover" && !c.loadBalancer) reason = "Deploy load balancing first.";
  else if (label === "Deploy Automatic Failover" && !c.apps.some(a => a.id === c.reliabilityStage?.spareId && a.health !== "failed")) reason = "Reserve a healthy spare first.";
  else if (busy) reason = "An infrastructure deployment is pending. Wait for activation.";
  const reviewed = useRef("");
  const dispatched = useRef(false);
  const [changed,setChanged] = useState(false);
  const introductionActive = useGame(s=>s.onboarding);
  const preview = props.decision ? previewCampaignAction(game,props.decision) : null;
  const signature = (p: typeof preview) => JSON.stringify(p);
  useEffect(()=>()=>setConfirming(null),[c.runId]);
  // A decision belongs beside its machine: leaving that machine's floor closes it.
  const floor = useGame(s=>s.floor), home = floorOf(affected[0]);
  useEffect(()=>{
    if (!open || floor === home) return;
    if (practiceQuote) { useGame.getState().goToFloor(home, "action"); return; }
    // Focus inside the closing card goes back to its action, as Cancel does; focus elsewhere stays put.
    restoreFocus.current = !!document.activeElement?.closest(".campaign-action-popover");
    setConfirming(null);
  },[open, floor, home, practiceQuote]);
  if (props.decision && preview && !preview.ok && !introductionActive) reason = preview.reason;
  const highlight = open || pointing && confirming === null, affectedKey = affected.join();
  useEffect(() => {
    if (!highlight) return;
    useGame.getState().setAffected(affectedKey.split(",") as EquipmentId[]);
    return () => {
      // Focus leaving another action must not erase the currently open decision's highlight.
      const active = confirmingAction();
      if (active === null || active === props.label) useGame.getState().setAffected([]);
    };
  // Reapply on opening even if this action was already highlighted by hover before the click.
  }, [highlight, affectedKey, props.label, open]);
  const cancel = () => { if (quoteLesson === "quote") return; restoreFocus.current=true; setConfirming(null, true); };
  const costs = <>
    {preview?.ok ? <PurchaseFinance preview={preview} /> : <dl className="purchase-tiles">
      {props.price !== undefined && <PurchaseTile icon="cost" label="Setup" value={money(props.price)} tone={props.price > 0 ? "cost" : "ok"} />}
      {props.price !== undefined && <PurchaseTile icon="cashLeft" label="Cash after" value={money((c.cashCents - props.price * 100) / 100)} tone={c.cashCents > props.price * 100 ? "ok" : "warn"} />}
      {upkeep !== null && <PurchaseTile icon="upkeep" label={isScale || label === "Upgrade database" ? "Total upkeep" : "Upkeep"} value={`${money(upkeep / 100)} / ${Q.periodSteps}s${increase !== null && increase !== upkeep ? ` (${increase >= 0 ? "+" : ""}${money(increase / 100)})` : ""}`} tone="warn" />}
      {props.note && <PurchaseTile icon={props.noteIcon ?? "latency"} label={props.noteIcon === "bulb" ? "Needs" : "Ready in"} value={props.note} tone="info" />}
    </dl>}
  </>;
  const machine = MACHINES[affected[0]];
  const description = isScale ? "Makes this server more powerful without adding another server."
    : label.startsWith("Tune cache") ? "Lets your cache answer a larger share of repeated reads."
    : label.startsWith("Limit to") ? "Reduces incoming traffic to give your servers room to recover."
    : PURCHASE_DESCRIPTIONS[label] ?? props.tip;
  // A per-app action sits next to that app's marker; anything else next to the machine's own.
  const anchor = isScale ? c.apps.find(a => `Scale up App ${a.id.slice(4)}` === label)?.id ?? "app" : affected[0];
  const toggle = () => {
    if (open) { if (!practiceQuote) setConfirming(null); return; }
    setConfirming(label);
    reviewed.current = signature(preview);
    dispatched.current = false;
    setChanged(false);
    const s = useGame.getState(), floor = floorOf(affected[0]);
    if (s.floor !== floor) s.goToFloor(floor, "action");
    s.focusCamera(anchor);
  };
  return <div className={`campaign-action-card${open ? " is-confirming" : ""}`} ref={card} data-affects={affectedKey} data-campaign-action={label}
    onPointerEnter={() => setPointing(true)} onPointerLeave={() => setPointing(false)}
    onFocus={() => setPointing(true)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setPointing(false); }}>
    <Act {...props} disabled={props.disabled || preview?.ok === false} onClick={toggle} />
    {!open && (props.disabled || preview?.ok === false) && <p className="campaign-action-reason" id={id} tabIndex={0}>{reason}{reason.startsWith("See") && props.tip ? ` ${props.tip}` : ""}</p>}
    {open && <ActionPopover anchor={anchor}>
      <section className="campaign-action-confirm" aria-label={`Confirm ${label}`} onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); if (!practiceQuote) cancel(); } }}>
        <div className="campaign-purchase-body" role="region" aria-label="Purchase preview" tabIndex={0}>
          <div className="campaign-purchase-essential">
            <p className="campaign-action-confirm-title">{isAdd ? "Add App Server" : label}</p>
            {description && <p>{description}</p>}
            {costs}
            {isAdd && <p className="campaign-purchase-note"><Icon name="shuffle" size={16}/><span><strong>Routing required</strong><span>Route traffic to this server after activation.</span></span></p>}
            {label==="Deploy load balancing" && <p className="campaign-purchase-note">Choose which servers receive traffic after installation.</p>}
          </div>
          <details className="campaign-purchase-details" onToggle={e => {
            if (e.currentTarget.open) e.currentTarget.querySelector<HTMLElement>(".campaign-purchase-details-content")?.scrollIntoView?.({ block: "nearest" });
          }}>
            <summary>How it works</summary>
            <div className="campaign-purchase-details-content" tabIndex={0} role="region" aria-label="Purchase details" onKeyDown={e => {
              if (e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
              if (e.key === "End" || e.key === "Home") {
                // Keep endpoint navigation in this region instead of relying on platform scroll routing.
                e.preventDefault();
                e.currentTarget.scrollTop = e.key === "End" ? e.currentTarget.scrollHeight : 0;
              }
            }}>
              <dl className="purchase-facts">
                {machine && <div className="campaign-action-machine"><dt>{machine.name}</dt><dd>{machine.does}</dd></div>}
                {!isAdd && props.tip && props.tip !== description && <div><dt>Effect</dt><dd>{props.tip}</dd></div>}
                <div><dt>Timing</dt><dd>Time advances while running. Upkeep starts on activation.</dd></div>
                {preview?.ok && preview.forecast && <div><dt>Forecast</dt><dd>Based on recent earnings; future traffic and costs may change.</dd></div>}
              </dl>
            </div>
          </details>
        </div>
        <footer className="campaign-purchase-footer">
        {preview?.ok && <PurchaseWarning preview={preview}/>}
        {props.price !== undefined && props.price > 0 && <p className="campaign-purchase-refund">No refunds.</p>}
        {(props.disabled || preview?.ok===false) && <p role="status">{reason}</p>}
        {changed && <p role="status">The purchase preview changed. Review the current figures, then confirm again.</p>}
        <div className="btn-row">
          <button type="button" className="btn btn-primary btn-small" autoFocus={!practiceQuote} disabled={practiceQuote || props.disabled || preview?.ok === false} onClick={() => {
            if (practiceQuote || !open || dispatched.current) return;
            if (props.decision) {
              const latest = previewCampaignAction(useGame.getState().game,props.decision);
              if (!latest.ok) { useGame.getState().notify(latest.reason,"error"); return; }
              if (signature(latest) !== reviewed.current) { reviewed.current=signature(latest);setChanged(true);return; }
            }
            dispatched.current = true;
            setConfirming(null); props.onClick();
          }}>Confirm</button>
          <button type="button" className="btn btn-small" disabled={quoteLesson === "quote"} onClick={cancel}>Cancel</button>
        </div>
        </footer>
      </section>
    </ActionPopover>}
  </div>;
}

/** Keep desktop decisions on the room's left, following the selected marker vertically. */
function ActionPopover({ anchor, children }: { anchor: string; children: ReactNode }) {
  const pop = useRef<HTMLDivElement>(null);
  const stage = document.querySelector<HTMLElement>("main.stage");
  useLayoutEffect(() => {
    const el = pop.current;
    if (!el || !stage) return;
    let frame = 0;
    const place = () => {
      const s = stage.getBoundingClientRect();
      const sheet = window.innerWidth <= 900;
      el.dataset.layout = sheet ? "sheet" : "anchored";
      const area = confirmationRoomArea(s,sheet);
      // Size the complete border box before measuring or clamping its position.
      el.style.width = `${Math.max(1,Math.min(sheet ? 420 : 320,area.right-area.left))}px`;
      el.style.maxHeight = `${Math.max(1,area.bottom-area.top)}px`;
      const essential = el.querySelector<HTMLElement>(".campaign-purchase-essential");
      const footer = el.querySelector<HTMLElement>(".campaign-purchase-footer");
      const summary = el.querySelector<HTMLElement>(".campaign-purchase-details > summary");
      const section = el.querySelector<HTMLElement>(".campaign-action-confirm");
      if (essential && footer && summary && section) {
        const style = getComputedStyle(section);
        const insets = parseFloat(style.paddingTop)+parseFloat(style.paddingBottom)+4+4; // footer margin and card borders
        const bodyRoom = Math.max(0,area.bottom-area.top-footer.offsetHeight-insets);
        const remaining = bodyRoom-essential.offsetHeight-summary.offsetHeight;
        // Short sheets scroll the preview body instead of reducing the expanded text to a few pixels.
        const readable = Math.min(96,Math.max(0,bodyRoom-summary.offsetHeight));
        el.style.setProperty("--purchase-details-room",`${Math.max(readable,remaining)}px`);
      }
      const w = el.offsetWidth, h = el.offsetHeight;
      const marker = document.querySelector<HTMLElement>(`.eq-label[data-eq="${anchor}"]`);
      const a = marker?.style.visibility === "visible" ? marker.getBoundingClientRect() : null;
      const clampX = (x:number)=>Math.max(area.left,Math.min(area.right-w,x));
      const clampY = (y:number)=>Math.max(area.top,Math.min(area.bottom-h,y));
      const x = sheet ? clampX((area.left+area.right-w)/2) : area.left;
      let y = sheet ? area.bottom-h : clampY((area.top+area.bottom-h)/2), side = "none";
      if (a && !sheet) {
        const mid = a.top+a.height/2-s.top;
        y = clampY(mid-h/2);
        if (a.left-s.left>=x+w) side="right";
        el.style.setProperty("--notch",`${Math.max(16,Math.min(h-16,mid-y))}px`);
      }
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.dataset.side = side;
      el.classList.add("is-placed");
    };
    const animate = () => { place(); frame = requestAnimationFrame(animate); };
    place();
    frame = requestAnimationFrame(animate);
    // Resizing can suspend WebGL frames; keep the quote inside the new room immediately.
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    resize?.observe(stage);
    const dock = document.querySelector(".bottombar");
    if (dock) resize?.observe(dock);
    window.addEventListener("resize", place);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
      window.removeEventListener("resize", place);
      viewport?.removeEventListener("resize", place);
    };
  }, [anchor, stage]);
  const body = <div className="campaign-action-popover" ref={pop}>{children}</div>;
  return stage ? createPortal(body, stage) : body;
}
