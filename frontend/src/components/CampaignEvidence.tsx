import type { ReactNode } from "react";
import type { Campaign } from "@/sim/campaignTypes";
import { num } from "@/game/format";
import { Icon, type IconName } from "./icons";
import { ratioOf, utilTone } from "./presentation";
import { tipProps } from "./tips";
import { Meter } from "./ui";

/*
 * Guided Mode's inspected evidence as short icon rows and load bars: the same authoritative snapshot values the
 * readings grid shows, laid out so a full or failing component stands out before any number is read.
 */

export type RowTone = "ok" | "warn" | "critical" | "muted";

const appName = (id: string) => `App ${id.slice(4)}`;

export function EvidenceRow({ icon, label, value, tone }: { icon: IconName; label: string; value: ReactNode; tone?: RowTone }) {
  return <div className="evidence-row" data-tone={tone}><dt><Icon name={icon} size={14} />{label}</dt><dd>{value}</dd></div>;
}

/** Demand against capacity as a bar that turns amber near capacity and red above it; the rows above carry the figures. */
export function LoadBar({ name, demand, capacity, unit }: { name: string; demand: number; capacity: number; unit: string }) {
  const tone = utilTone(ratioOf(demand, capacity));
  return <div className="evidence-load"><Meter value={ratioOf(demand, capacity)} tone={tone} label={`${name} load: ${num(demand)} of ${num(capacity)} ${unit}`} /></div>;
}

/** One card per installed App Server: whether it receives traffic, how full it is and what it got through. */
export function ApplicationInstances({ campaign: c, recipients, selectedAppId, onSelect }: {
  campaign: Campaign; recipients: string[]; selectedAppId: string | null; onSelect: (id: string) => void;
}) {
  const m = c.snapshot;
  return <section aria-label="Application instances">
    <dl className="evidence-rows">
      <EvidenceRow icon="shuffle" label="Load balancer" value={c.loadBalancer ? "Deployed" : "Not deployed"} tone={c.loadBalancer ? "ok" : "muted"} />
      <EvidenceRow icon="incoming" label="Receiving new traffic" value={recipients.map(appName).join(", ") || "None"} tone={recipients.length ? undefined : "warn"} />
    </dl>
    <div className="instance-cards">{c.apps.map(a => {
      const x = m.instances?.find(i => i.id === a.id), receiving = recipients.includes(a.id), pressed = selectedAppId === a.id;
      const status = receiving ? "Receiving traffic" : "Installed - not receiving traffic";
      const tone = x ? utilTone(ratioOf(x.demand, x.capacity)) : "ok";
      return <button type="button" key={a.id} data-guidance-app={a.id} className={`instance-card${pressed ? " is-selected" : ""}`} aria-pressed={pressed}
        aria-label={`${appName(a.id)}: ${status}${x ? `. ${x.demand} of ${x.capacity} req/s, processed ${x.processed}, backlog ${x.backlog}` : ""}`}
        {...tipProps(`Capacity ${a.capacity} req/s; backlog ${a.backlog}. ${status}`)} onClick={() => onSelect(a.id)}>
        <span className="instance-head"><Icon name="server" size={14} /><strong>{appName(a.id)}</strong>
          <span className="instance-status" data-receiving={receiving}><span className="instance-dot" />{receiving ? "Receiving" : "Not receiving"}</span></span>
        {x ? <>
          <span className="instance-bar" data-tone={tone}><span style={{ width: `${Math.min(1, ratioOf(x.demand, x.capacity)) * 100}%` }} /></span>
          <span className="instance-figures"><span><b>{num(x.demand)}</b>/{num(x.capacity)} req/s</span><span>processed <b>{num(x.processed)}</b></span><span>backlog <b>{num(x.backlog)}</b></span></span>
        </> : <span className="instance-figures"><span>capacity <b>{num(a.capacity)}</b> req/s</span><span>backlog <b>{num(a.backlog)}</b></span></span>}
      </button>;
    })}</div>
    {c.apps.filter(a => !a.routed).map(a => <p role="note" className="evidence-note" aria-label={`${appName(a.id)} routing status`} key={a.id}>Installed capacity does not receive traffic until routing includes this app.</p>)}
  </section>;
}
