import { useEffect, useId, useRef, useSyncExternalStore, type ComponentProps } from "react";
import { useGame } from "@/game/store";
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


/** Asks before dispatching; the parent's disabled predicate and dispatcher stay authoritative. */
export function CampaignAction(props: ComponentProps<typeof Act>) {
  const { game, onboarding, selectedAppId } = useGame();
  const c = game.campaign!, id = useId(), card = useRef<HTMLDivElement>(null);
  const open = useSyncExternalStore(subscribe, () => confirming === props.label);
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
  const effect = isAdd ? "Another App Server · needs routing."
    : isScale ? "Makes this App Server larger."
    : label === "Upgrade database" ? "More Database capacity."
    : label === "Deploy load balancing" ? "Shares traffic after routing is configured."
    : label === "Deploy Read Cache" ? "Reuses read results · starts cold."
    : label.startsWith("Tune cache") ? "Higher hit-rate ceiling · warming still needed."
    : label.startsWith("Limit to") ? "Rejects above 500 req/s · same upkeep."
    : label === "Remove traffic limit" ? "Full demand returns · check capacity."
    : null;
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
  return <div className={`campaign-action-card${open ? " is-confirming" : ""}`} ref={card}>
    <Act {...props} onClick={() => setConfirming(open ? null : label)} />
    {effect && <p className="campaign-action-effect">{effect}</p>}
    {props.disabled && <p className="campaign-action-reason" id={id}>{reason}{reason.startsWith("See") && props.tip ? ` ${props.tip}` : ""}</p>}
    {open ? <section className="campaign-action-box campaign-action-confirm" aria-label={`Confirm ${label}`} onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); cancel(); } }}>
      <p className="campaign-action-confirm-title">{label}?</p>
      {costs}
      <div className="btn-row">
        <button type="button" className="btn btn-primary btn-small" autoFocus disabled={props.disabled} onClick={() => { setConfirming(null); props.onClick(); }}>Confirm</button>
        <button type="button" className="btn btn-small" onClick={cancel}>Cancel</button>
      </div>
    </section> : (props.price !== undefined || props.tip) && <details className="campaign-action-detail"><summary>Effect &amp; costs</summary>
      <div className="campaign-action-box">{costs}</div>
    </details>}
  </div>;
}
