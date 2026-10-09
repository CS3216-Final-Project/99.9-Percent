"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  BALANCE,
  churnRate,
  equipmentInfo,
  has,
  isResearchTech,
  loadBand,
  metrics,
  organicRate,
  PROMO_ORDER,
  PROMOS,
  promoCooldownLeft,
  promoCost,
  promoUsers,
  serverUpkeep,
  TECH,
  techStatus,
  type EquipmentId,
  type GameState,
  type Metrics,
  type TechId,
} from "@/sim";
import { moneyFull, num, pct } from "@/game/format";
import { useGame } from "@/game/store";
import { Icon } from "./icons";
import { EQUIPMENT_ICON, moodIcon, STATE_META, TECH_ICON, utilTone } from "./presentation";
import IncidentPanel from "./IncidentPanel";
import { Act, Chip, Gauge, ReleaseRow, Row, TaskRow } from "./ui";

function loadGauge(label: string, util: number, m: Metrics, tip: string) {
  return <Gauge icon="load" label={label} value={util} text={m.hasMonitoring ? pct(util) : loadBand(util)} tone={utilTone(util)} tip={tip} />;
}

/** A small link to an upgrade, shown where that upgrade would help. */
function TechChip({ id }: { id: TechId }) {
  const game = useGame((s) => s.game);
  const focusTech = useGame((s) => s.focusTech);
  const status = techStatus(game, id);
  if (!isResearchTech(id)) return null;
  return (
    <button type="button" className={`tech-chip tech-${status}`} onClick={() => focusTech(id)} title={TECH[id].description}>
      <Icon name={status === "done" ? "check" : status === "locked" ? "lock" : (TECH_ICON[id] ?? "plus")} size={16} />
      {TECH[id].name}
    </button>
  );
}

/** Everything that is detail rather than decision goes behind this toggle. */
function More({ children }: { children: ReactNode }) {
  return (
    <details className="more">
      <summary>More</summary>
      {children}
    </details>
  );
}

function NotBuilt({ id, requires }: { id: EquipmentId; requires: TechId }) {
  const game = useGame((s) => s.game);
  const focusTech = useGame((s) => s.focusTech);
  const def = TECH[requires];
  const status = techStatus(game, requires);
  if (!isResearchTech(requires)) return <p className="muted">This equipment is retained for existing saves.</p>;
  return (
    <>
      <p>{equipmentInfo(game, id).about}</p>
      <ul className="effects">
        {def.effects.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
      <Act
        primary
        tour="primary"
        icon="tree"
        label={status === "in_progress" || status === "ready" ? "See progress" : status === "locked" ? "See requirements" : "Build it"}
        price={status === "available" ? def.cost : undefined}
        onClick={() => focusTech(requires)}
      />
    </>
  );
}

function Body({ id, game, m }: { id: EquipmentId; game: GameState; m: Metrics }) {
  const act = useGame((s) => s.act);
  const openView = useGame((s) => s.openView);
  const info = equipmentInfo(game, id);
  const locked = game.phase !== "management";

  if (!info.built && info.requires) return <NotBuilt id={id} requires={info.requires} />;

  switch (id) {
    case "app": {
      const atLimit = m.servers >= m.maxServers;
      const sick = game.infra.appHosts.filter((h) => h.status !== "healthy");
      return (
        <>
          {loadGauge("Load", m.appUtil, m, "Share of server capacity used at the busiest moment last week. Above 100% requests are refused.")}
          <div className="chips">
            <Chip icon="server" tip="Without a load balancer only 3 servers can share traffic.">
              {m.servers} of {m.maxServers}
            </Chip>
            <Chip icon="cash" tip="Running cost of each server.">
              {moneyFull(serverUpkeep(game))}/wk each
            </Chip>
          </div>
          {atLimit && !has(game, "load_balancing") ? (
            <Act primary tour="primary" icon="tree" label="Load Balancing lifts the limit" onClick={() => useGame.getState().focusTech("load_balancing")} />
          ) : (
            <Act primary tour="primary" icon="plus" label="Add server" price={BALANCE.server.setupCost} disabled={locked || atLimit} onClick={() => act({ type: "add_server" })} />
          )}
          {sick.map((h) => (
            <Act key={h.id} icon="refresh" label={`Replace ${h.id}`} price={BALANCE.server.replaceCost} disabled={locked} onClick={() => act({ type: "replace_host", hostId: h.id })} />
          ))}
          <More>
            <p className="muted">{info.about}</p>
            <dl className="rows">
              {m.hasMonitoring ? (
                <>
                  <Row label="Forecast this week" value={`${pct(m.forecast.appLow)} to ${pct(m.forecast.appHigh)}`} tip="Expected peak load, including promotions and known surges." />
                  <Row label="Capacity" value={`${num(m.appCapacity)} requests/s`} />
                </>
              ) : (
                <Row label="Exact numbers" value="Needs Monitoring" />
              )}
              {game.live.tempServers > 0 && <Row label="Autoscaled last week" value={`+${game.live.tempServers}`} />}
            </dl>
            <div className="chips">
              <TechChip id="larger_servers" />
              <TechChip id="load_balancing" />
              <TechChip id="autoscaling" />
            </div>
            <Act icon="minus" label="Remove a server" disabled={locked || m.servers <= 1} onClick={() => act({ type: "remove_server" })} />
          </More>
        </>
      );
    }

    case "db": {
      const tier = BALANCE.db.tiers[game.infra.dbTier];
      const next = BALANCE.db.tiers[game.infra.dbTier + 1];
      const upgrading = game.tasks.some((t) => t.kind === "db_upgrade");
      const ready = game.releases.some((r) => r.kind === "db_upgrade");
      const host = game.infra.dbHost;
      return (
        <>
          {loadGauge("Load", m.dbUtil, m, "Share of database capacity used at the busiest moment last week. Above 100% requests time out.")}
          <div className="chips">
            <Chip icon="database" tip="Bigger tiers handle more and cost more each week.">
              {tier.name} tier
            </Chip>
            <Chip icon="cash">{moneyFull(tier.upkeep)}/wk</Chip>
          </div>
          {upgrading ? (
            <Act primary tour="primary" icon="wrench" label="Upgrade in progress" onClick={() => openView("engineers")} />
          ) : ready ? (
            <Act primary tour="primary" icon="ship" label="Upgrade ready to ship" onClick={() => useGame.getState().select("deploy")} />
          ) : next ? (
            <Act
              primary
              tour="primary"
              icon="scaleUp"
              label={`Upgrade to ${next.name}`}
              price={next.cost}
              disabled={locked}
              onClick={() => act({ type: "start_db_upgrade" })}
              title={`${num(next.capacity)} queries/s, ${moneyFull(next.upkeep)} a week. Takes ${next.effort} engineer-weeks.`}
            />
          ) : (
            <p className="muted">Largest tier.</p>
          )}
          {host.status !== "healthy" && (
            <Act icon="refresh" label="Replace machine" price={BALANCE.db.replaceCost} disabled={locked} onClick={() => act({ type: "replace_host", hostId: host.id })} />
          )}
          <More>
            <p className="muted">{info.about}</p>
            <dl className="rows">
              {m.hasMonitoring ? (
                <>
                  <Row label="Forecast this week" value={`${pct(m.forecast.dbLow)} to ${pct(m.forecast.dbHigh)}`} />
                  <Row label="Capacity" value={`${num(m.dbCapacity)} queries/s`} />
                </>
              ) : (
                <Row label="Exact numbers" value="Needs Monitoring" />
              )}
            </dl>
            <div className="chips">
              <TechChip id="caching" />
            </div>
          </More>
        </>
      );
    }

    case "growth": {
      const analytics = has(game, "analytics");
      const sat = game.satisfaction;
      const promos = PROMO_ORDER.map((pid) => {
        const def = PROMOS[pid];
        const unlocked = (!def.requires || has(game, def.requires)) && (!def.minUsers || Math.max(game.users, game.totals.peakUsers) >= def.minUsers);
        const active = game.activePromos.includes(pid);
        const cooldown = promoCooldownLeft(game, pid);
        return { pid, def, unlocked, active, cooldown, usable: unlocked && !active && cooldown === 0 };
      });
      // The tutorial points at the first promotion that can be launched now.
      const firstUsable = promos.find((p) => p.usable)?.pid;
      return (
        <>
          <Gauge
            icon={moodIcon(sat)}
            label="Satisfaction"
            value={sat / 100}
            text={`${Math.round(sat)}`}
            tone={sat < 55 ? "critical" : sat < 70 ? "warn" : "ok"}
            tip="How happy customers are. Slow pages and outages lower it. It drives word of mouth, churn and how well promotions work."
          />
          {promos.map(({ pid, def, unlocked, active, cooldown, usable }) => {
            const tour = pid === firstUsable ? "primary" : undefined;
            return (
              <div className="promo" key={pid}>
                <div className="task-top">
                  <strong>
                    <Icon name="megaphone" size={16} />
                    {def.name}
                  </strong>
                  <span className="muted">
                    +{num(promoUsers(game, pid))} users, +{pct(def.spike)} traffic
                  </span>
                </div>
                {!unlocked ? (
                  <p className="muted">
                    <Icon name="lock" size={12} className="inline-icon" /> Available at {num(def.minUsers ?? 0)} users.
                  </p>
                ) : (
                  <Act
                    primary={usable}
                    tour={tour}
                    icon="megaphone"
                    label={active ? "Running this week" : cooldown > 0 ? `Ready in ${cooldown} wk` : "Launch"}
                    price={usable ? promoCost(game, pid) : undefined}
                    disabled={locked || !usable}
                    onClick={() => act({ type: "launch_promotion", promo: pid })}
                    title={def.description}
                  />
                )}
              </div>
            );
          })}
          <More>
            <p className="muted">{info.about}</p>
            <dl className="rows">
              {analytics ? (
                <>
                  <Row label="Word of mouth" value={`+${pct(organicRate(sat), 1)} a week`} />
                  <Row label="Churn" value={`-${pct(churnRate(sat), 1)} a week`} tip="Customers who leave each week. It rises when satisfaction drops below 70." />
                </>
              ) : (
                <Row label="Growth rates" value="Needs Customer Analytics" />
              )}
            </dl>
          </More>
        </>
      );
    }

    case "team": {
      const paying = game.tasks.some((t) => t.kind === "debt_paydown");
      const debt = game.techDebt;
      return (
        <>
          <Gauge
            icon="debt"
            label="Tech debt"
            value={debt / 100}
            text={`${Math.round(debt)}`}
            tone={debt >= 75 ? "critical" : debt >= 55 ? "warn" : "ok"}
            tip="Shortcuts that pile up as you ship. High debt makes deploys riskier, machines fail more, and engineers slower."
          />
          <div className="chips">
            <Chip icon="team" tip="Free engineers do upkeep, which slows debt growth.">
              {m.freeEngineers} of {game.engineers} free
            </Chip>
            <Chip icon="load" tip="Work per engineer each week. Drops as debt passes 40, 60 and 80.">
              {pct(m.velocity)} speed
            </Chip>
          </div>
          <Act primary tour="primary" icon="tree" label="Pick an upgrade" onClick={() => openView("tech")} />
          {game.tasks.map((t) => (
            <TaskRow key={t.id} game={game} task={t} />
          ))}
          <More>
            <p className="muted">{info.about}</p>
            <Act icon="debt" label={paying ? "Debt paydown queued" : "Pay down debt"} note={paying ? undefined : `${BALANCE.debt.paydownEffort} wk`} disabled={locked || paying} onClick={() => act({ type: "start_debt_paydown" })} />
            <Act
              icon="hire"
              label="Hire engineer"
              price={BALANCE.engineer.hireCost}
              disabled={locked || game.engineers >= BALANCE.engineer.max}
              onClick={() => act({ type: "hire_engineer" })}
              title={`Then ${moneyFull(BALANCE.engineer.salary)} a week.`}
            />
          </More>
        </>
      );
    }

    case "deploy": {
      const recent = [...game.deploys].reverse().slice(0, 4);
      return (
        <>
          {game.releases.length === 0 ? <p className="empty">Nothing to ship yet. Finished upgrades land here.</p> : game.releases.map((r) => <ReleaseRow key={r.id} game={game} release={r} />)}
          <More>
            <p className="muted">{info.about}</p>
            {recent.length > 0 && (
              <ul className="plain-list">
                {recent.map((d) => (
                  <li key={d.releaseId + d.turn}>
                    Week {d.turn}: {d.title} <span className="muted">({d.tested ? "tested" : "untested"}{d.rolledBack ? ", rolled back" : ""})</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="chips">
              <TechChip id="deploy_testing" />
              <TechChip id="safer_rollouts" />
            </div>
          </More>
        </>
      );
    }

    case "gateway":
      return (
        <>
          <div className="chips">
            <Chip icon="network" tip="Busiest moment last week. Capacity must cover the peak.">
              {m.hasMonitoring ? `${num(m.peakRps)} requests/s` : `Traffic ${m.peakRps > 600 ? "heavy" : m.peakRps > 200 ? "steady" : "light"}`}
            </Chip>
          </div>
          <p className="muted">{info.about}</p>
          <div className="chips">
            <TechChip id="load_balancing" />
            <TechChip id="health_checks" />
          </div>
        </>
      );

    case "monitoring":
      return (
        <>
          <dl className="rows">
            <Row label="Peak traffic" value={`${num(m.peakRps)} requests/s`} />
            <Row label="Servers" value={<span className={`text-${utilTone(m.appUtil)}`}>{pct(m.appUtil)}</span>} />
            <Row label="Database" value={<span className={`text-${utilTone(m.dbUtil)}`}>{pct(m.dbUtil)}</span>} />
            <Row label="Response time" value={`${game.live.latencyMs} ms`} tip="Climbs steeply as load nears 100%." />
            <Row label="Up last week" value={pct(game.live.availability, 2)} />
          </dl>
          <div className="chips">
            <TechChip id="health_checks" />
          </div>
        </>
      );

    default: {
      // Standby, cache, replica and backups: built, with nothing to operate.
      const cost =
        id === "standby"
          ? serverUpkeep(game)
          : id === "replica"
            ? BALANCE.db.tiers[game.infra.dbTier].upkeep * BALANCE.db.replicaUpkeepShare
            : id === "cache"
              ? TECH.caching.upkeep
              : TECH.backups.upkeep;
      return (
        <>
          <p>{info.about}</p>
          <div className="chips">
            <Chip icon="check">{info.summary}</Chip>
            <Chip icon="cash">{moneyFull(cost)}/wk</Chip>
          </div>
          {(id === "standby" || id === "replica") && <div className="chips"><TechChip id="auto_failover" /></div>}
        </>
      );
    }
  }
}

function Inspector({ id }: { id: EquipmentId }) {
  const game = useGame((s) => s.game);
  const select = useGame((s) => s.select);
  const info = equipmentInfo(game, id);
  return (
    <section className="panel-section" aria-label={info.name}>
      <header className="panel-head">
        <span className={`panel-icon state-${info.state}`}>
          <Icon name={EQUIPMENT_ICON[id]} />
        </span>
        <div>
          <h2>{info.name}</h2>
          <span className={`state state-${info.state}`}>
            <Icon name={STATE_META[info.state].icon} size={12} />
            {STATE_META[info.state].word}
          </span>
        </div>
        <button type="button" className="icon-btn" onClick={() => select(null)} aria-label="Close">
          <Icon name="close" />
        </button>
      </header>
      <Body id={id} game={game} m={metrics(game)} />
    </section>
  );
}

/** Closed until the player selects something or an incident starts. */
export default function SidePanel() {
  const phase = useGame((s) => s.game.phase);
  const selected = useGame((s) => s.selected);
  const el = useRef<HTMLElement>(null);
  useEffect(() => {
    el.current?.scrollTo({ top: 0 });
  }, [selected, phase]);

  if (phase !== "incident" && !selected) return null;
  return (
    <aside ref={el} className="side" aria-label="Details">
      {phase === "incident" ? <IncidentPanel /> : selected ? <Inspector id={selected} /> : null}
    </aside>
  );
}
