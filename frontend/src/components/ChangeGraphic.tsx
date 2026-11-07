import { num } from "@/game/format";
import { Icon } from "./icons";

/** Two lengths share a scale; the numbers remain available without interpreting colour. */
export function ChangeGraphic({ label, before, after, unit }: { label: string; before: number; after: number; unit: string }) {
  const scale = Math.max(before, after, 1);
  return <div className="change-graphic" role="img" aria-label={`${label}: ${num(before)} to ${num(after)} ${unit}`}>
    <div className="change-graphic-values"><span>{label}</span><strong><span className="change-before">{num(before)}</span><Icon name="next" size={14}/>{num(after)}<small>{unit}</small></strong></div>
    <div className="change-graphic-bars" aria-hidden="true"><span style={{ width: `${before / scale * 100}%` }}/><span style={{ width: `${after / scale * 100}%` }}/></div>
  </div>;
}

/** Installed hardware and connected traffic are separate, observable states. */
export function ConnectionGraphic({ routed }: { routed: boolean }) {
  return <div className="change-connection" role="img" aria-label={routed ? "Installed and receiving traffic" : "Installed; routing needed"}>
    <span><Icon name="server" size={18}/><Icon name="check" size={12}/><small>Installed</small></span>
    <span className="change-connection-line" data-connected={routed} aria-hidden="true"/>
    <span className={routed ? "" : "connection-needed"}><Icon name="tree" size={18}/><small>{routed ? "Routed" : "Routing needed"}</small></span>
  </div>;
}
