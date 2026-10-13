import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { EquipmentId } from "@/sim";
import { useGame } from "@/game/store";
import { floorOf } from "@/game/floors";
import { moneyFull as money } from "@/game/format";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
import { APPLICATION_SCALING as P } from "@/sim/scenarios/applicationScaling";
import { DATA_STRATEGY as D } from "@/sim/scenarios/dataStrategy";
import { TRAFFIC_SPIKES as T } from "@/sim/scenarios/trafficSpikes";
import { pendingStop } from "@/sim/step";
import { APPLICATION_RELIABILITY as R } from "@/sim/scenarios/applicationReliability";
import { Act, Row } from "./ui";

// One action confirmation is open at a time across the panel, keyed by the action label.
let confirming: string | null = null;
const listeners = new Set<() => void>();
function setConfirming(label: string | null) { confirming = label; listeners.forEach(l => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

/** What each machine an action can change does, shown above the action's effect and costs. */
const MACHINES: Partial<Record<EquipmentId, { name: string; does: string }>> = {
  gateway: { name: "Network", does: "The network gateway takes in every user request and passes the admitted ones on to the App Servers." },
  app: { name: "App Servers", does: "App Servers run the product and handle each admitted request, calling the database for its data." },
  db: { name: "Database", does: "The database stores the company's data and serves every read and write the App Servers make." },
  cache: { name: "Read Cache", does: "The Read Cache answers repeated reads from memory, so they never reach the database." },
  monitoring: { name: "Monitoring", does: "Monitoring watches each machine's health and reports failures it detects." },
};


/** Asks before dispatching; the parent's disabled predicate and dispatcher stay authoritative. */
export function CampaignAction(props: ComponentProps<typeof Act>) {
  const { game, onboarding, selectedAppId } = useGame();
  const c = game.campaign!, id = useId(), card = useRef<HTMLDivElement>(null);
  const open = useSyncExternalStore(subscribe, () => confirming === props.label);
  const [pointing, setPointing] = useState(false);
  useEffect(() => () => { if (confirming === props.label) setConfirming(null); }, [props.label]);
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
  if (onboarding) reason = "Finish or skip the introduction first.";
  else if (game.phase === "ended") reason = "This company has ended.";
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
  const highlight = pointing || open, affectedKey = affected.join();
  useEffect(() => {
    if (!highlight) return;
    useGame.getState().setAffected(affectedKey.split(",") as EquipmentId[]);
    return () => useGame.getState().setAffected([]);
  }, [highlight, affectedKey]);
  const cancel = () => { setConfirming(null); card.current?.querySelector<HTMLButtonElement>("button.act")?.focus(); };
  const costs = <>
    {props.tip && <p>{props.tip}</p>}
    <dl className="rows">
      {props.price !== undefined && <Row label="Setup" value={`${money(props.price)} now`} />}
      {props.price !== undefined && <Row label="Cash after" value={money((c.cashCents - props.price * 100) / 100)} />}
      {upkeep !== null && <Row label={isScale || label === "Upgrade database" ? "Total upkeep" : "Added upkeep"} value={`${money(upkeep / 100)} / ${Q.periodSteps}s${increase !== null && increase !== upkeep ? ` (${increase >= 0 ? "+" : ""}${money(increase / 100)})` : ""}`} />}
      {props.note && <Row label="Activation" value={props.note} />}
    </dl>
    {props.price !== undefined && props.price > 0 && <p className="muted">No refund or undo. Upkeep starts at activation.</p>}
  </>;
  const machine = MACHINES[affected[0]];
  // A per-app action sits next to that app's marker; anything else next to the machine's own.
  const anchor = isScale ? c.apps.find(a => `Scale up App ${a.id.slice(4)}` === label)?.id ?? "app" : affected[0];
  const toggle = () => {
    if (open) { setConfirming(null); return; }
    setConfirming(label);
    const s = useGame.getState(), floor = floorOf(affected[0]);
    if (s.floor !== floor) s.goToFloor(floor, "action");
  };
  return <div className={`campaign-action-card${open ? " is-confirming" : ""}`} ref={card} data-affects={affectedKey}
    onPointerEnter={() => setPointing(true)} onPointerLeave={() => setPointing(false)}
    onFocus={() => setPointing(true)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setPointing(false); }}>
    <Act {...props} onClick={toggle} />
    {props.disabled && <p className="campaign-action-reason" id={id}>{reason}{reason.startsWith("See") && props.tip ? ` ${props.tip}` : ""}</p>}
    {open && <ActionPopover anchor={anchor}>
      <section className="campaign-action-confirm" aria-label={`Confirm ${label}`} onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); cancel(); } }}>
        {machine && <p className="campaign-action-machine"><b>{machine.name}</b> {machine.does}</p>}
        <p className="campaign-action-confirm-title">{label}?</p>
        {costs}
        <div className="btn-row">
          <button type="button" className="btn btn-primary btn-small" autoFocus disabled={props.disabled} onClick={() => { setConfirming(null); props.onClick(); }}>Confirm</button>
          <button type="button" className="btn btn-small" onClick={cancel}>Cancel</button>
        </div>
      </section>
    </ActionPopover>}
  </div>;
}

const GAP = 14, EDGE = 12;

/**
 * Floats its content over the room beside the marker of the machine an action changes, on its left where it fits,
 * following the marker as the camera moves and staying clear of the side panel. Without a room, or before the
 * elevator lands, it waits briefly and then settles in the open part of the room so the decision is never blocked.
 */
function ActionPopover({ anchor, children }: { anchor: string; children: ReactNode }) {
  const pop = useRef<HTMLDivElement>(null);
  const stage = document.querySelector<HTMLElement>("main.stage");
  useLayoutEffect(() => {
    const el = pop.current;
    if (!el || !stage) return;
    const opened = performance.now();
    let frame = 0;
    const place = () => {
      frame = requestAnimationFrame(place);
      const s = stage.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
      let right = s.width - EDGE, bottom = s.height - EDGE;
      // The campaign panel floats over the room: beside it on a wide screen, below it on a narrow one.
      const panel = document.querySelector(".campaign-panel")?.getBoundingClientRect();
      if (panel && panel.width > 0) {
        if (panel.left - s.left > s.width * 0.4) right = Math.min(right, panel.left - s.left - EDGE);
        else if (panel.top - s.top > s.height * 0.2) bottom = Math.min(bottom, panel.top - s.top - EDGE);
      }
      (el.firstElementChild as HTMLElement).style.maxHeight = `${Math.max(160, bottom - EDGE)}px`;
      const marker = document.querySelector<HTMLElement>(`.eq-label[data-eq="${anchor}"]`);
      const a = marker && marker.style.visibility === "visible" ? marker.getBoundingClientRect() : null;
      if (!a && document.querySelector(".stage-canvas") && performance.now() - opened < 1500) return;
      let x: number, y: number, side = "none";
      if (a) {
        const mid = a.top + a.height / 2 - s.top;
        // Prefer the marker's left, away from the panel; take its right only when the left runs off the room.
        x = a.left - s.left - GAP - w; side = "right";
        if (x < EDGE) { x = a.right - s.left + GAP; side = "left"; }
        y = mid - h / 2;
        if (side === "left" && x + w > right) { x = a.left + a.width / 2 - s.left - w / 2; y = a.bottom - s.top + GAP; side = "none"; }
        y = Math.max(EDGE, Math.min(bottom - h, y));
        el.style.setProperty("--notch", `${Math.max(16, Math.min(h - 16, mid - y))}px`);
      } else {
        x = (right - w) / 2; y = Math.max(EDGE, (bottom - h) / 2);
      }
      x = Math.max(EDGE, Math.min(right - w, x));
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.dataset.side = side;
      el.classList.add("is-placed");
    };
    place();
    return () => cancelAnimationFrame(frame);
  }, [anchor, stage]);
  const body = <div className="campaign-action-popover" ref={pop}><div className="campaign-action-popover-body">{children}</div></div>;
  return stage ? createPortal(body, stage) : body;
}
