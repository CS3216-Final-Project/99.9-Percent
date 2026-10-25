import type { Campaign } from "@/sim/campaignTypes";
import { num } from "@/game/format";
import { campaignAppHealth } from "@/game/campaignAppHealth";
import { useGame } from "@/game/store";
import { INFRASTRUCTURE_HELP } from "@/game/infrastructureHelp";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
import { EQUIPMENT_ICON, ratioOf, utilTone } from "./presentation";
import { EvidenceRow, LoadBar } from "./CampaignEvidence";
import { Icon } from "./icons";
import { Row } from "./ui";

const NAMES = { gateway: "Network", app: "Servers", db: "Database", monitoring: "Monitoring", cache: "Read Cache" };
type Place = keyof typeof NAMES;
const percent = (n: number | null) => n === null ? "No completed requests" : `${(n * 100).toFixed(2)}%`;
const toneOf = (demand: number, capacity: number) => { const t = utilTone(ratioOf(demand, capacity)); return t === "ok" ? undefined : t; };

export function CampaignReadings({ place, campaign: c, appId }: { place: Place; campaign: Campaign; appId?: string }) {
  const game = useGame(s => s.game), m = c.snapshot;
  const component = place === "app" ? (appId ? m.instances?.find(a=>a.id===appId) : null) ?? m.app : place === "db" ? m.db : null, unit = place === "app" ? "requests/s" : "operations/s";
  const health = campaignAppHealth(game);
  const slow = m.latencyMs >= Q.latencyThresholdMs, failing = m.serviceErrorRate !== null && m.serviceErrorRate >= Q.errorThreshold, backlog = m.app.backlog + m.db.backlog;
  return <section className="campaign-evidence equipment-readings" aria-label={`${NAMES[place]} readings`}>
    <header className="readings-head"><h3><span className="chip-icon"><Icon name={EQUIPMENT_ICON[place]} size={18} /></span>{NAMES[place]}</h3><span className="live-tag"><span aria-hidden="true" />Live</span></header>
    {component ? <>
      {/* The same Demand and Capacity readings, in the same units, that the walkthrough teaches; the bar turns amber from 85% and red at capacity. */}
      <dl className="evidence-rows"><EvidenceRow icon="incoming" label="Demand" value={`${num(component.demand)} ${unit}`} tone={toneOf(component.demand, component.capacity)} /><EvidenceRow icon="load" label="Capacity" value={`${num(component.capacity)} ${unit}`} /><EvidenceRow icon="backlog" label="Backlog" value={num(component.backlog)} tone={component.backlog > 0 ? "warn" : "ok"} /></dl>
      <LoadBar name={place === "app" ? "App Server" : "Database"} demand={component.demand} capacity={component.capacity} unit={unit} />
      <dl className="readings-grid"><Row label="Demand/capacity" value={percent(component.demandRatio)} /><Row label="Busy" value={percent(component.busyUtilisation)} /><Row label="Processed" value={num(component.processed)} /><Row label="Failed" value={num(component.failed)} />
        {place === "app" && <><Row label="Installed server capacity" value={`${num(m.installedAppCapacity)} req/s`} /><Row label="Routed capacity" value={`${num(m.app.capacity)} req/s`} />{m.reliability&&<><Row label="Healthy installed capacity" value={`${num(m.reliability.healthyCapacity)} req/s`}/><Row label="Spare capacity" value={`${num(m.reliability.spareCapacity)} req/s`}/></>}</>}
      </dl>
    </> : place === "gateway" ? <><dl className="evidence-rows"><EvidenceRow icon="incoming" label="Incoming" value={`${num(m.incoming)} requests/s`} /><EvidenceRow icon="check" label="Admitted" value={`${num(m.admitted)} requests/s`} tone="ok" /><EvidenceRow icon="rejected" label="Rejected" value={`${num(m.rejected)} requests/s`} tone={m.rejected > 0 ? "warn" : "muted"} /></dl>
        <dl className="readings-grid"><Row label="Load balancer" value={c.loadBalancer ? "Deployed" : "Not deployed"} /><Row label="Completed successfully" value={num(m.successful)} /><Row label="Failed" value={num(m.failed)} />{c.reliabilityStage&&<><Row label="Health Checks" value={c.reliabilityStage.checksStep!==null?"Deployed":"Not deployed"}/><Row label="Automatic Failover" value={c.reliabilityStage.failover?c.reliabilityStage.failover.enabled?"Enabled":"Disabled":"Not deployed"}/>{m.reliability&&<><Row label="Healthy routed capacity" value={`${num(m.reliability.healthyRoutedCapacity)} req/s`}/><Row label="Spare capacity" value={`${num(m.reliability.spareCapacity)} req/s`}/></>}</>}</dl></>
      : place === "monitoring" ? <><dl className="evidence-rows"><EvidenceRow icon="latency" label="Latency" value={`${m.latencyMs.toFixed(0)} ms`} tone={slow ? "critical" : "ok"} /><EvidenceRow icon="fire" label="Error rate" value={percent(m.serviceErrorRate)} tone={m.serviceErrorRate === null ? "muted" : failing ? "critical" : "ok"} /><EvidenceRow icon="backlog" label="Backlog" value={`${num(backlog)} requests`} tone={backlog > 0 ? "warn" : "ok"} /></dl>
        <dl className="readings-grid"><Row label="App health" value={health.word} /><Row label="Health Checks" value={c.reliabilityStage?.checksStep != null ? "Deployed" : "Not deployed"} /><Row label="Automatic Failover" value={c.reliabilityStage?.failover ? c.reliabilityStage.failover.enabled ? "Enabled" : "Disabled" : "Not deployed"} /></dl></>
      : <><dl className="evidence-rows"><EvidenceRow icon="bolt" label="Read Cache" value={c.readCache ? "Deployed" : "Not deployed"} tone={c.readCache ? "ok" : "muted"} /><EvidenceRow icon="load" label="Effective hit rate used" value={m.data ? `${m.data.effectiveHitRateUsed / 100}%` : "Not yet observed"} tone={m.data ? undefined : "muted"} /><EvidenceRow icon="check" label="Cache hits" value={m.data ? num(m.data.hits) : "Not yet observed"} tone={m.data ? undefined : "muted"} /></dl>
        <dl className="readings-grid"><Row label="Eligible misses" value={m.data ? num(m.data.eligibleMisses) : "Not yet observed"} /><Row label="Warmth used / after work" value={m.data ? `${m.data.warmthUsed / 100}% / ${m.data.warmthAfterStep / 100}%` : "Not yet observed"} /><Row label="Configured target" value={c.readCache ? `${c.readCache.target / 100}%` : "Not deployed"} />{m.data && <><Row label="Workload" value={m.data.profile} /><Row label="Read / write share" value={`${m.data.readShare / 100}% / ${(10000 - m.data.readShare) / 100}%`} /><Row label="Logical operations" value={num(m.data.logical)} /><Row label="Reads / writes" value={`${num(m.data.reads)} / ${num(m.data.writes)}`} /><Row label="Cacheable reads" value={`${m.data.cacheableReadShare / 100}% · ${num(m.data.eligibleReads)} operations`} /><Row label="Non-cacheable reads" value={num(m.data.nonCacheableReads)} /><Row label="DB read / write demand" value={`${num(m.data.databaseReadDemand)} / ${num(m.data.databaseWriteDemand)} ops/s`} /></>}</dl></>}
    {place === "cache" && <p className="readings-note">Misses, non-cacheable reads and writes reach the database. Cache reduces new demand; it never erases an existing backlog. Latency estimates dependency queues.</p>}
    <details className="more"><summary>About {NAMES[place]}</summary><p>{INFRASTRUCTURE_HELP[place]}</p></details>
  </section>;
}
