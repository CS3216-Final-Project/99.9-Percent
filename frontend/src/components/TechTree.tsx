"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { databaseUpgrade, pendingStop } from "@/sim/step";
import { openingTuning } from "@/sim/launchWeek";
import { APPLICATION_SCALING } from "@/sim/scenarios/applicationScaling";
import { DATA_STRATEGY } from "@/sim/scenarios/dataStrategy";
import { TRAFFIC_SPIKES } from "@/sim/scenarios/trafficSpikes";
import { APPLICATION_RELIABILITY } from "@/sim/scenarios/applicationReliability";
import { researchBalance } from "@/sim/reliability";

import { BALANCE, BRANCHES, costs, missingPrerequisites, TECH, TECH_ORDER, techStatus, type EquipmentId, type GameState, type TechId, type TechStatus } from "@/sim";
import { moneyFull, num, pct } from "@/game/format";
import { canInspectEquipment, componentInspectionEnabled, inspectInRoom, inspectOrSelect, useGame } from "@/game/store";
import { Icon, type IconName } from "./icons";
import { tipProps } from "./tips";
import { TECH_ICON } from "./presentation";
import { CampaignUnavailable } from "./CampaignInfrastructure";
import { Act, Chip, Concept, ReleaseRow, TaskRow } from "./ui";

const NODE_W = 204;
const NODE_H = 60;
const COL_GAP = 252;
const ROW_GAP = 78;
const PAD_X = 128;
const PAD_Y = 12;
const LANE_GAP = 14;

/** Rows are grouped into one lane per branch. */
const LANES = [
  { branch: "capacity", rows: [0, 0] },
  { branch: "data", rows: [1, 1] },
  { branch: "reliability", rows: [2, 2] },
] as const;

function laneIndex(row: number): number {
  return LANES.findIndex((l) => row >= l.rows[0] && row <= l.rows[1]);
}

function nodePos(id: TechId): { x: number; y: number } {
  const t = TECH[id];
  return { x: PAD_X + t.col * COL_GAP, y: PAD_Y + t.row * ROW_GAP + laneIndex(t.row) * LANE_GAP };
}

const WIDTH = PAD_X + 2 * COL_GAP + NODE_W + 16;
const HEIGHT = PAD_Y + 3 * ROW_GAP + 2 * LANE_GAP;

const BRANCH_ICON: Record<string, IconName> = { capacity: "server", data: "database", reliability: "health" };

const STATUS_ICON: Record<TechStatus, IconName> = {
  locked: "lock",
  available: "plus",
  in_progress: "wrench",
  ready: "ship",
  done: "check",
};

const STATUS_WORD: Record<TechStatus, string> = {
  locked: "Locked",
  available: "Available",
  in_progress: "Building",
  ready: "Ready to ship",
  done: "Live",
};

function statusLine(game: GameState, id: TechId, status: TechStatus): string {
  if (status === "done") return game.campaign?"Owned":"Live";
  if (status === "ready") return "Ready to ship";
  if (status === "in_progress") {
    const task = game.tasks.find((t) => id === "larger_database" ? t.kind === "db_upgrade" : t.techId === id);
    return task ? `Building ${pct(task.progress / task.effort)}` : "Building";
  }
  if (status === "locked") return "Locked";
  if(game.campaign)return campaignAvailability(id);
  return moneyFull(id === "larger_database" ? BALANCE.db.tiers[game.infra.dbTier + 1]?.cost ?? 0 : TECH[id].cost);
}

function Detail({ game, id }: { game: GameState; id: TechId }) {
  const act = useGame((s) => s.act);
  const focusTech = useGame((s) => s.focusTech);
  if(game.campaign)return <CampaignDetail game={game} id={id}/>;
  const nextTier = id === "larger_database" ? BALANCE.db.tiers[game.infra.dbTier + 1] : undefined;
  const def = nextTier ? { ...TECH[id], cost: nextTier.cost, effort: nextTier.effort, upkeepNote: `${moneyFull(nextTier.upkeep)}/wk` } : TECH[id];
  const status = techStatus(game, id);
  const task = game.tasks.find((t) => id === "larger_database" ? t.kind === "db_upgrade" : t.kind === "tech" && t.techId === id);
  const release = game.releases.find((r) => id === "larger_database" ? r.kind === "db_upgrade" : r.techId === id);

  return (
    <div className="tree-detail">
      <span className={`tag tag-${status === "done" ? "ok" : status === "locked" ? "plain" : status === "available" ? "accent" : "warn"}`}>
        <Icon name={STATUS_ICON[status]} size={12} />
        {STATUS_WORD[status]}
      </span>
      <div className="tree-detail-head">
        <Concept kind={status === "locked" ? "muted" : "tech"} icon={TECH_ICON[id] ?? "tree"} />
        <h3>{def.name}</h3>
      </div>
      <p className="muted">{def.description}</p>
      <ul className="effects">
        {def.effects.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
      <div className="chips">
        <Chip icon="cash" tip="One-off cost to start building.">
          {moneyFull(def.cost)}
        </Chip>
        <Chip icon="team" tip="Engineer-weeks of work. Three engineers finish three engineer-weeks in one week.">
          {def.effort} engineer-weeks
        </Chip>
        {(def.upkeep > 0 || def.upkeepNote) && (
          <Chip icon="week" tip="Running cost once it is live.">
            {def.upkeepNote ?? `${moneyFull(def.upkeep)}/wk`}
          </Chip>
        )}
      </div>

      {def.requires.length > 0 && (
        <div className="chips">
          {def.requires.map((r) => {
            const met = techStatus(game, r) === "done";
            return (
              <button type="button" key={r} className={`tech-chip tech-${met ? "done" : "locked"}`} onClick={() => focusTech(r)}>
                <Icon name={met ? "check" : "lock"} size={16} />
                Needs {TECH[r].name}
              </button>
            );
          })}
        </div>
      )}

      {(status === "available" || (status === "done" && nextTier)) && (
        <Act primary tour="primary" icon="plus" label={nextTier ? `Upgrade to ${nextTier.name}` : "Start"} price={def.cost} disabled={game.phase !== "management"} onClick={() => act({ type: "start_tech", tech: id })} />
      )}
      {task && <TaskRow game={game} task={task} />}
      {release && <ReleaseRow game={game} release={release} />}
    </div>
  );
}

export default function TechTree() {
  const scroll = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = useState({ left: 0, atEnd: false });
  useLayoutEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const update = () => setScrollPosition(previous => {
      const left = element.scrollLeft;
      const atEnd = left + element.clientWidth >= element.scrollWidth - 1;
      return previous.left === left && previous.atEnd === atEnd ? previous : { left, atEnd };
    });
    update();
    element.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(element);
    return () => {
      element.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, []);
  const game = useGame((s) => s.game);
  const focus = useGame((s) => s.techFocus);
  const focusTech = useGame((s) => s.focusTech);
  const selected: TechId = focus && TECH_ORDER.includes(focus) ? focus : TECH_ORDER.find((t) => techStatus(game, t) === "available") ?? "larger_servers";

  return (
    <div className="tree">
      <div className="tree-navigation" aria-label="Technology map navigation">
        <span>Three branches. Swipe or use the arrows for later upgrades.</span>
        <div>
          <button type="button" className="icon-btn" aria-label="Earlier technologies" disabled={scrollPosition.left <= 0} onClick={() => scroll.current?.scrollBy({ left: -COL_GAP })}><Icon name="next" className="tree-arrow-back" /></button>
          <button type="button" className="icon-btn" aria-label="Later technologies" disabled={scrollPosition.atEnd} onClick={() => scroll.current?.scrollBy({ left: COL_GAP })}><Icon name="next" /></button>
        </div>
      </div>
      <div className="tree-scroll" ref={scroll} tabIndex={0} aria-label="Technology branches, scroll horizontally to explore">
        <div className="tree-map">
          <div className="tree-canvas">
            {LANES.map((lane, i) => {
              const b = BRANCHES.find((x) => x.id === lane.branch);
              const top = PAD_Y + lane.rows[0] * ROW_GAP + i * LANE_GAP - 7;
              const height = (lane.rows[1] - lane.rows[0] + 1) * ROW_GAP - 4;
              return (
                <div key={lane.branch} className={`lane lane-${lane.branch}`} style={{ top: `${top / HEIGHT * 100}%`, height: `${height / HEIGHT * 100}%` }}>
                  <div className="lane-label" style={{ width: `${(PAD_X - 12) / WIDTH * 100}%` }}>
                    <strong>
                      <Icon name={BRANCH_ICON[lane.branch]} />
                      {b?.name}
                    </strong>
                    <span>{b?.blurb}</span>
                  </div>
                </div>
              );
            })}

            <svg className="tree-edges" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
              {TECH_ORDER.flatMap((id) =>
                TECH[id].requires.map((r) => {
                  const a = nodePos(r);
                  const b = nodePos(id);
                  const x1 = a.x + NODE_W;
                  const y1 = a.y + NODE_H / 2;
                  const x2 = b.x;
                  const y2 = b.y + NODE_H / 2;
                  const bend = Math.max(40, (x2 - x1) * 0.5);
                  const met = techStatus(game, r) === "done";
                  const cross = TECH[r].branch !== TECH[id].branch;
                  return (
                    <path
                      key={`${r}-${id}`}
                      vectorEffect="non-scaling-stroke"
                      d={`M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`}
                      className={`edge${met ? " is-met" : ""}${cross ? " is-cross" : ""}${selected === id || selected === r ? " is-focus" : ""}`}
                    />
                  );
                }),
              )}
            </svg>

            {TECH_ORDER.map((id) => {
              const status = techStatus(game, id);
              const p = nodePos(id);
              const task = game.tasks.find((t) => id === "larger_database" ? t.kind === "db_upgrade" : t.techId === id);
              const missing = status === "locked" ? missingPrerequisites(game, id).map((r) => TECH[r].name).join(" and ") : "";
              return (
                <button
                  type="button"
                  key={id}
                  data-tech={id}
                  className={`node node-${status}${selected === id ? " is-selected" : ""}`}
                  style={{ left: `${p.x / WIDTH * 100}%`, top: `${p.y / HEIGHT * 100}%`, width: `${NODE_W / WIDTH * 100}%`, height: `${NODE_H / HEIGHT * 100}%` }}
                  onClick={() => focusTech(id)}
                  aria-pressed={selected === id}
                  aria-label={`${TECH[id].name}: ${game.campaign ? status === "done" ? "Owned" : status === "available" ? campaignAvailability(id) : STATUS_WORD[status] : STATUS_WORD[status]}`}
                  {...tipProps(missing ? `Needs ${missing}` : game.campaign ? campaignTechText(game,id) : TECH[id].description)}
                >
                  <span className="node-mark" aria-hidden="true">
                    <Icon name={TECH_ICON[id] ?? "tree"} />
                    <span className="node-badge">
                      <Icon name={STATUS_ICON[status]} size={12} />
                    </span>
                  </span>
                  <span className="node-name">{TECH[id].name}</span>
                  <span className="node-status">{statusLine(game, id, status)}</span>
                  {task && <span className="node-progress" style={{ width: `${(task.progress / task.effort) * 100}%` }} />}
                </button>
              );
            })}
          </div>
          <ul className="tree-legend" aria-label="Legend">
            <li><span className="swatch node-locked" />Locked</li>
            <li><span className="swatch node-available" />Available</li>
            <li><span className="swatch node-in_progress" />Building</li>
            <li><span className="swatch node-done" />{game.campaign?"Owned":"Live"}</li>
            <li><span className="swatch swatch-dash" />Needs another branch</li>
          </ul>
        </div>
      </div>
      <Detail game={game} id={selected} />
    </div>
  );
}

function campaignAvailability(id: TechId): string {
  return ["health_checks", "standby", "auto_failover", "autoscaling"].includes(id) ? "Research available" : "Equipment upgrade";
}

const CAMPAIGN_ACTION: Partial<Record<TechId, string>> = { larger_servers: "scale-up", larger_database: "upgrade-db", load_balancing: "deploy-lb", caching: "cache", cache_tuning: "cache-tuning", autoscaling: "deploy-autoscaler", health_checks: "health-checks", standby: "create-spare", auto_failover: "failover" };

/** What is installed for this node right now, where the campaign tracks it separately from ownership. */
function deployment(c: NonNullable<GameState["campaign"]>, id: TechId): string | null {
  const r = c.reliabilityStage;
  if (id === "health_checks") return r?.checksStep !== null && r?.checksStep !== undefined ? "Deployed" : "Not deployed";
  if (id === "standby") return r?.spareId ? `Standing by: App ${r.spareId.slice(4)}` : "No reserved spare";
  if (id === "auto_failover") return r?.failover ? (r.failover.enabled ? "Deployed and enabled" : "Deployed and disabled") : "Not deployed";
  if (id === "autoscaling") return c.spikeStage?.controller ? (c.spikeStage.controller.enabled ? "Deployed and enabled" : "Deployed and disabled") : "Not deployed";
  return null;
}

/** The Classic detail panel's layout, with the campaign's research points and physical-step costs. */
function CampaignDetail({game,id}:{game:GameState;id:TechId}) {
  const { act, openView, focusTech } = useGame();
  const c = game.campaign!, status = techStatus(game, id);
  const reliability = ["health_checks", "standby", "auto_failover"].includes(id);
  const blocked = researchBalance(c) < 1 || pendingStop(c) !== null || game.phase === "review" || game.phase === "ended";
  const equipment: EquipmentId = id === "larger_database" ? "db" : id === "load_balancing" || id === "auto_failover" ? "gateway" : id === "caching" || id === "cache_tuning" ? "cache" : id === "health_checks" ? "monitoring" : "app";
  const equipmentName = equipment === "db" ? "Database" : equipment === "gateway" ? "Network" : equipment === "cache" ? "Cache" : equipment === "monitoring" ? "Monitoring" : "App Servers";
  const choose = () => {
    if (!canInspectEquipment(game, equipment)) return;
    openView(null);
    if (componentInspectionEnabled(useGame.getState())) inspectInRoom(equipment);
    else inspectOrSelect(equipment);
  };
  const facts = campaignTechFacts(game, id);
  const pending = c.pending.filter((a) => CAMPAIGN_ACTION[id] === a.type);
  const installed = deployment(c, id);
  return (
    <div className="tree-detail">
      <span className={`tag tag-${status === "done" ? "ok" : status === "locked" ? "plain" : "accent"}`}>
        <Icon name={STATUS_ICON[status]} size={12} />
        {status === "done" ? "Owned" : status === "available" ? campaignAvailability(id) : STATUS_WORD[status]}
      </span>
      <div className="tree-detail-head">
        <Concept kind={status === "locked" ? "muted" : "tech"} icon={TECH_ICON[id] ?? "tree"} />
        <h3>{TECH[id].name}</h3>
      </div>
      <p>{facts.effect}</p>
      <dl className="tree-facts">
        {facts.rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        {(reliability || id === "autoscaling") && <div><dt>Research balance</dt><dd>{researchBalance(c)} points</dd></div>}
      </dl>
      {(reliability || id === "autoscaling") && <p className="tree-ownership-note">{status === "done" ? "Capability owned. Deployment is a separate equipment purchase." : "Research unlocks the capability. Deployment is a separate equipment purchase."}</p>}
      <div className="chips">
        {installed && <Chip icon={installed.startsWith("Not") || installed.startsWith("No ") ? "minus" : "check"}>{installed}</Chip>}
        {pending.map((a) => <Chip key={a.id} icon="latency">Pending activation: {a.activationStep - c.step} game seconds</Chip>)}
      </div>
      {TECH[id].requires.length > 0 && (
        <div className="chips">
          {TECH[id].requires.map((r) => {
            const met = techStatus(game, r) === "done";
            return (
              <button type="button" key={r} className={`tech-chip tech-${met ? "done" : "locked"}`} onClick={() => focusTech(r)}>
                <Icon name={met ? "check" : "lock"} size={16} />
                Needs {TECH[r].name}
              </button>
            );
          })}
        </div>
      )}
      {status === "locked" && <p className="muted">{reliability && !c.reliabilityStage ? "Enter Stay Online to unlock this capability." : "Meet the displayed prerequisite or Guided Mode stage first."}</p>}
      {reliability && status === "available" && <Act primary tour="primary" icon="plus" label={`Unlock ${TECH[id].name}`} note="1 research point" noteIcon="bulb" disabled={blocked} onClick={() => act({ type: "unlock_reliability", tech: id as "health_checks" | "standby" | "auto_failover" })} />}
      {id === "autoscaling" && status === "available" && <Act primary icon="plus" label="Unlock autoscaling" note="1 research point" noteIcon="bulb" disabled={blocked} onClick={() => act({ type: "unlock_autoscaling" })} />}
      {status === "available" && (reliability || id === "autoscaling") && <CampaignUnavailable disabled={blocked} action={reliability ? {type:"unlock_reliability",tech:id as "health_checks"|"standby"|"auto_failover"} : {type:"unlock_autoscaling"}} />}
      <Act icon="next" label={`Inspect ${equipmentName}`} tip="Open this equipment’s existing inspection and deployment actions." disabled={!canInspectEquipment(game, equipment) || game.phase === "review" || game.phase === "ended"} onClick={choose} />
    </div>
  );
}

/** Facts are presentation of the same scenario tuning and next-upgrade query used by the engine. */
function campaignTechFacts(game: GameState, id: TechId): { effect: string; rows: [string, string][] } {
  const c = game.campaign!;
  const scaling = APPLICATION_SCALING, data = DATA_STRATEGY, spikes = TRAFFIC_SPIKES, reliability = APPLICATION_RELIABILITY;
  const opening = openingTuning(c);
  const dollars = (cents: number) => moneyFull(cents / 100);
  const purchase = (cost: number, delay: number, upkeep?: number): [string, string][] => [
    ["Deployment cost", dollars(cost)], ["Activation time", `${delay} game seconds`],
    ...(upkeep === undefined ? [] : [["Weekly upkeep", `${dollars(upkeep)}/week`] as [string, string]]),
  ];
  switch (id) {
    case "larger_servers": return { effect: `Scale a selected base app to ${num(scaling.appCapacity)} requests/s.`, rows: purchase(scaling.appCostCents, scaling.appDelay, scaling.appWeeklyCents) };
    case "load_balancing": return { effect: "Spread traffic across routed apps. Installed apps still need routing.", rows: purchase(scaling.lbCostCents, scaling.lbDelay, scaling.lbWeeklyCents) };
    case "larger_database": {
      const next = databaseUpgrade(c);
      return { effect: "Increase the database’s processing capacity.", rows: [
        ["Current capacity", `${num(c.dbCapacity)} operations/s`],
        ["Current upkeep", `${moneyFull(costs(game).database)}/week`],
        ...(next ? [["Next capacity", `${num(next.capacity)} operations/s`], ["Upgrade cost", dollars(next.costCents)], ["Activation time", `${next.delay} game seconds`], ["Upkeep after upgrade", `${moneyFull(costs({ ...game, campaign: { ...c, dbCapacity: next.capacity, upgraded: true } }).database)}/week`]] as [string, string][] : [["Next upgrade", c.dbCapacity >= data.dbCapacity ? "Maximum capacity reached" : "Continue Guided Mode to unlock"]] as [string, string][]),
      ] };
    }
    case "caching": return { effect: `Eligible reads warm toward ${pct(data.baseTarget / 10000)} cache hits. Writes still reach the database.`, rows: purchase(data.cacheCostCents, data.cacheDelay, data.cacheWeeklyCents) };
    case "cache_tuning": return { effect: `Raise the cache-hit ceiling to ${pct(data.tunedTarget / 10000)}. Further warm-up is required.`, rows: [["Tuning cost", dollars(data.tuningCostCents)], ["Activation time", `${data.tuningDelay} game seconds`], ["Extra upkeep", "None"]] };
    case "autoscaling": return { effect: "Provision and route apps as demand changes. Each step takes time.", rows: [["Unlock cost", "1 research point"], ...purchase(spikes.controllerCostCents, spikes.controllerDelay, spikes.controllerWeeklyCents), ["Billing", "Controller upkeep continues while disabled"]] };
    case "health_checks": return { effect: "Detect changes in app health. Load balancing is required to exclude unhealthy apps; checks add no capacity.", rows: [["Unlock cost", "1 research point"], ...purchase(reliability.checksCostCents, reliability.checksDelay, reliability.checksWeeklyCents)] };
    case "standby": return { effect: "Keep a real spare ready for promotion. It receives no traffic until promoted.", rows: [["Unlock cost", "1 research point"], ...purchase(reliability.spareCostCents, reliability.spareDelay, opening.appWeeklyCents), ["Existing healthy unrouted app", "Reserve free in 1 game second"]] };
    case "auto_failover": return { effect: "Promote a real spare after failure detection. Requires Health Checks, a Spare Application and deployed Load Balancing; adds no new capacity.", rows: [["Unlock cost", "1 research point"], ...purchase(reliability.failoverCostCents, reliability.failoverDelay, reliability.failoverWeeklyCents), ["Promotion time", `${reliability.promotionDelay} game second`]] };
    default: return { effect: TECH[id].description, rows: [] };
  }
}

function campaignTechText(game: GameState, id: TechId): string {
  return campaignTechFacts(game, id).effect;
}
