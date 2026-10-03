"use client";

import { useState } from "react";
import { BALANCE, metrics, type GameState, type Postmortem } from "@/sim";
import { compact, money, moneyFull, num, pct } from "@/game/format";
import { useGame } from "@/game/store";
import { Act, Chip, Gauge, ReleaseRow, TaskRow } from "./ui";

/* ------------------------------------------------------------------ */
/* Engineer allocation                                                 */
/* ------------------------------------------------------------------ */

export function EngineersView() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const openView = useGame((s) => s.openView);
  const m = metrics(game);
  const locked = game.phase !== "management";
  const paying = game.tasks.some((t) => t.kind === "debt_paydown");
  const assigned = game.engineers - m.freeEngineers;
  const debt = game.techDebt;

  return (
    <div className="eng">
      <section className="eng-col">
        <h3>Team</h3>
        <div className="seats" aria-label={`${assigned} of ${game.engineers} engineers assigned`}>
          {Array.from({ length: game.engineers }, (_, i) => (
            <span key={i} className={`seat${i < assigned ? " is-busy" : ""}`} title={i < assigned ? "Assigned" : "Free"} />
          ))}
        </div>
        <div className="chips">
          <Chip icon="wrench" tip="Free engineers do upkeep, which slows debt growth.">
            {m.freeEngineers} of {game.engineers} free
          </Chip>
          <Chip tip="Work per engineer each week. Drops as debt passes 40, 60 and 80.">{pct(m.velocity)} speed</Chip>
          <Chip icon="cash">{moneyFull(m.costs.salaries)}/wk</Chip>
        </div>
        <Gauge
          label="Tech debt"
          value={debt / 100}
          text={`${Math.round(debt)}`}
          tone={debt >= 75 ? "critical" : debt >= 55 ? "warn" : "ok"}
          tip="Shortcuts that pile up as you ship. High debt makes deploys riskier, machines fail more, and engineers slower."
        />
        <Act icon="tree" primary label="Pick an upgrade" onClick={() => openView("tech")} />
        <Act icon="check" label={paying ? "Debt paydown queued" : "Pay down debt"} note={paying ? undefined : `${BALANCE.debt.paydownEffort} wk`} disabled={locked || paying} onClick={() => act({ type: "start_debt_paydown" })} />
        <Act
          icon="plus"
          label={game.engineers >= BALANCE.engineer.max ? "Office is full" : "Hire engineer"}
          price={game.engineers >= BALANCE.engineer.max ? undefined : BALANCE.engineer.hireCost}
          disabled={locked || game.engineers >= BALANCE.engineer.max}
          onClick={() => act({ type: "hire_engineer" })}
          title={`Then ${moneyFull(BALANCE.engineer.salary)} a week.`}
        />
      </section>

      <section className="eng-col">
        <h3>Tasks</h3>
        {game.tasks.length === 0 ? <p className="empty">No tasks. Pick an upgrade.</p> : game.tasks.map((t) => <TaskRow key={t.id} game={game} task={t} />)}
      </section>

      <section className="eng-col">
        <h3>Ready to ship</h3>
        {game.releases.length === 0 ? <p className="empty">Finished work lands here.</p> : game.releases.map((r) => <ReleaseRow key={r.id} game={game} release={r} />)}
        {game.deploys.length > 0 && (
          <details className="more">
            <summary>Past deploys ({game.deploys.length})</summary>
            <ul className="plain-list">
              {[...game.deploys].reverse().slice(0, 8).map((d) => (
                <li key={d.releaseId + d.turn}>
                  Week {d.turn}: {d.title}{" "}
                  <span className="muted">
                    ({d.tested ? "tested" : "untested"}, {pct(d.risk)}
                    {d.rolledBack ? ", rolled back" : ""})
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Charts                                                              */
/* ------------------------------------------------------------------ */

interface Series {
  name: string;
  color: string;
  values: number[];
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

export function LineChart({
  title,
  series,
  turns,
  format,
  target,
  targetLabel,
  max,
  min,
}: {
  title: string;
  series: Series[];
  turns: number[];
  format: (v: number) => string;
  target?: number;
  targetLabel?: string;
  max?: number;
  min?: number;
}) {
  const W = 340;
  const H = 170;
  const L = 44;
  const R = 12;
  const T = 10;
  const B = 22;
  const all = series.flatMap((s) => s.values);
  const lo = min ?? Math.min(0, ...all);
  const hi = max ?? niceMax(Math.max(target ?? 0, ...all, 1));
  const n = Math.max(1, turns.length - 1);
  const x = (i: number) => L + ((W - L - R) * i) / n;
  const y = (v: number) => T + (H - T - B) * (1 - (v - lo) / (hi - lo || 1));
  const ticks = [lo, lo + (hi - lo) / 2, hi];

  return (
    <figure className="chart">
      <figcaption>
        <strong>{title}</strong>
        <span className="chart-legend">
          {series.map((s) => (
            <span key={s.name}>
              <i style={{ background: s.color }} />
              {series.length > 1 && s.name}
              {s.values.length > 0 && <b>{format(s.values[s.values.length - 1])}</b>}
            </span>
          ))}
        </span>
      </figcaption>
      {turns.length < 2 ? (
        <p className="empty">Play two weeks to see a trend.</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title} by week`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="chart-grid" />
              <text x={L - 6} y={y(t) + 3.5} textAnchor="end" className="chart-tick">
                {format(t)}
              </text>
            </g>
          ))}
          {target !== undefined && (
            <g>
              <line x1={L} x2={W - R} y1={y(target)} y2={y(target)} className="chart-target" />
              <text x={W - R} y={y(target) - 4} textAnchor="end" className="chart-tick">
                {targetLabel}
              </text>
            </g>
          )}
          {series.map((s) => (
            <g key={s.name}>
              <polyline fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
              {s.values.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r={i === s.values.length - 1 ? 3 : 1.6} fill={s.color}>
                  <title>
                    Week {turns[i]}: {s.name} {format(v)}
                  </title>
                </circle>
              ))}
            </g>
          ))}
          <text x={L} y={H - 5} className="chart-tick">
            Week {turns[0]}
          </text>
          <text x={W - R} y={H - 5} textAnchor="end" className="chart-tick">
            Week {turns[turns.length - 1]}
          </text>
        </svg>
      )}
    </figure>
  );
}

const C = { blue: "#8cc7f2", green: "#62d39a", amber: "#f0b040", red: "#ff7a6e" };

export function RunCharts({ game, compactSet = false }: { game: GameState; compactSet?: boolean }) {
  const h = game.history;
  const turns = h.map((r) => r.turn);
  const monitored = game.techDone.includes("monitoring");
  return (
    <div className="charts">
      <LineChart title="Users" series={[{ name: "Users", color: C.blue, values: h.map((r) => r.users) }]} turns={turns} format={compact} target={BALANCE.targetUsers} targetLabel="Goal" />
      <LineChart title="Cash" series={[{ name: "Cash", color: C.green, values: h.map((r) => r.cash) }]} turns={turns} format={money} />
      {!compactSet && (
        <>
          <LineChart
            title="Revenue and costs"
            series={[
              { name: "Revenue", color: C.green, values: h.map((r) => r.revenue) },
              { name: "Costs", color: C.amber, values: h.map((r) => r.costs) },
            ]}
            turns={turns}
            format={money}
          />
          {monitored ? (
            <LineChart
              title="Peak load"
              series={[
                { name: "Servers", color: C.blue, values: h.map((r) => Math.min(1.5, r.appUtil)) },
                { name: "Database", color: C.amber, values: h.map((r) => Math.min(1.5, r.dbUtil)) },
              ]}
              turns={turns}
              format={(v) => pct(v)}
              target={1}
              targetLabel="Limit"
              max={1.5}
            />
          ) : (
            <figure className="chart">
              <figcaption>
                <strong>Peak load</strong>
              </figcaption>
              <p className="empty">Needs Monitoring.</p>
            </figure>
          )}
          <LineChart title="Uptime" series={[{ name: "Uptime", color: C.green, values: h.map((r) => Math.max(0.9, r.availability)) }]} turns={turns} format={(v) => pct(v, 1)} max={1} min={0.9} />
          <LineChart
            title="Satisfaction and tech debt"
            series={[
              { name: "Satisfaction", color: C.blue, values: h.map((r) => r.satisfaction) },
              { name: "Debt", color: C.red, values: h.map((r) => r.techDebt) },
            ]}
            turns={turns}
            format={(v) => String(Math.round(v))}
            max={100}
          />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Postmortems                                                         */
/* ------------------------------------------------------------------ */

export const OUTCOME_LABEL: Record<Postmortem["outcome"], string> = {
  resolved: "Fixed",
  mitigated: "Contained",
  failed: "Not fixed in time",
  auto_mitigated: "Handled automatically",
};

export function outcomeTone(pm: Postmortem): "ok" | "warn" | "critical" {
  return pm.outcome === "failed" ? "critical" : pm.outcome === "mitigated" ? "warn" : "ok";
}

/**
 * A postmortem is a one-screen summary first: what failed, what fixed it and
 * one tip. The full five-part report is one click away.
 */
export function PostmortemBody({ pm }: { pm: Postmortem }) {
  const fix = pm.whyOutcome.split(" Tried but did not help:")[0];
  const minutes = pm.impact.downtimeMinutes;
  return (
    <div className="pm">
      <dl className="impact">
        <div>
          <dt>Downtime</dt>
          <dd>{minutes < 10 ? minutes.toFixed(1) : Math.round(minutes)} min</dd>
        </div>
        <div>
          <dt>Users lost</dt>
          <dd>{num(pm.impact.usersLost)}</dd>
        </div>
        <div>
          <dt>Cost</dt>
          <dd>{moneyFull(pm.impact.revenueLost + pm.impact.moneySpent)}</dd>
        </div>
      </dl>
      <dl className="pm-lines">
        <div>
          <dt>What failed</dt>
          <dd>{pm.whatFailed}</dd>
        </div>
        <div>
          <dt>{pm.outcome === "failed" ? "What went wrong" : "What worked"}</dt>
          <dd>{fix}</dd>
        </div>
        {pm.prevention[0] && (
          <div>
            <dt>Next time</dt>
            <dd>{pm.prevention[0]}</dd>
          </div>
        )}
      </dl>
      <details className="more">
        <summary>Full report</summary>
        <h4>What led to it</h4>
        <ul className="plain-list">
          {pm.contributing.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <h4>What you did</h4>
        <ul className="plain-list timeline">
          {pm.response.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <h4>Why it turned out this way</h4>
        <p>{pm.whyOutcome}</p>
        <h4>Reducing the risk</h4>
        <ul className="plain-list">
          {pm.prevention.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* History: charts, event feed, postmortems                            */
/* ------------------------------------------------------------------ */

type Tab = "charts" | "events" | "postmortems";

export function HistoryView() {
  const game = useGame((s) => s.game);
  const [tab, setTab] = useState<Tab>("charts");
  const [open, setOpen] = useState<string | null>(null);
  const events = [...game.log].reverse();
  const pms = [...game.postmortems].reverse();

  return (
    <div className="history">
      <div className="tabs" role="tablist">
        {(
          [
            ["charts", "Charts"],
            ["events", "Events"],
            ["postmortems", `Incidents (${game.postmortems.length})`],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button type="button" key={id} role="tab" aria-selected={tab === id} className={tab === id ? "is-active" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "charts" && <RunCharts game={game} />}

      {tab === "events" && (
        <ol className="feed">
          {events.map((e) => (
            <li key={e.id} className={`feed-item feed-${e.kind}`}>
              <span className="feed-week">Week {e.turn}</span>
              <span>{e.text}</span>
            </li>
          ))}
        </ol>
      )}

      {tab === "postmortems" &&
        (pms.length === 0 ? (
          <p className="empty">No incidents yet.</p>
        ) : (
          <ul className="pm-list">
            {pms.map((pm) => (
              <li key={pm.id}>
                <button type="button" className="pm-toggle" aria-expanded={open === pm.id} onClick={() => setOpen(open === pm.id ? null : pm.id)}>
                  <span>
                    Week {pm.turn}: {pm.title}
                  </span>
                  <span className={`tag tag-${outcomeTone(pm)}`}>{OUTCOME_LABEL[pm.outcome]}</span>
                </button>
                {open === pm.id && <PostmortemBody pm={pm} />}
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
