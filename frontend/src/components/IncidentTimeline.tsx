import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { EventKind } from "@/sim";
import type { Snapshot, TraceEvent } from "@/sim/campaignTypes";
import type { ReportEvent } from "@/game/reportEvents";
import { CHART_COLORS, niceMax } from "./presentation";
import "./IncidentTimeline.css";

const num = (n: number) => n.toLocaleString("en-US");
const percent = (rate: number) => `${(rate * 100).toFixed(2)}%`;
const LATENCY_LIMIT_MS = 500, ERROR_LIMIT = 0.01;
const KIND_COLOR: Record<EventKind, string> = { incident: "var(--critical-ink)", success: "var(--ok-ink)", decision: "var(--ink)", warning: "var(--warn-ink)", milestone: "var(--tile-gold-ink)", finance: CHART_COLORS.cash, info: "var(--text-soft)" };

/** What one game second's readings say, the same figures for the readout above the plot and for screen readers. */
function readings(m: Snapshot) {
  return [`Response time ${num(Math.round(m.latencyMs))} ms`, m.serviceErrorRate === null ? "No completed requests" : `Service errors ${percent(m.serviceErrorRate)}`,
    `App Servers ${num(m.app.demand)} of ${num(m.app.capacity)} req/s`, `Database ${num(m.db.demand)} of ${num(m.db.capacity)} ops/s`,
    ...(m.rejected > 0 ? [`${num(m.rejected)} req/s turned away`] : [])];
}
const reading = (m: Snapshot) => `Game second ${m.step}: ${readings(m).map((r, i) => i ? r.charAt(0).toLowerCase() + r.slice(1) : r.toLowerCase()).join(", ")}`;

/** A line through the readings that have a value, broken where a second has none. */
function path(points: [number, number | null][]) {
  let d = "", pen = false;
  for (const [x, y] of points) {
    if (y === null) { pen = false; continue; }
    d += `${pen ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    pen = true;
  }
  return d;
}

/** Ticks at a round number of game seconds, about one per 90 px. */
function secondTicks(from: number, to: number, width: number) {
  const span = Math.max(1, to - from), wanted = Math.max(2, Math.floor(width / 90));
  const step = [1, 2, 5, 10, 20, 50, 100, 200, 500].find(s => span / s <= wanted) ?? 1000;
  const ticks: number[] = [];
  for (let t = Math.ceil(from / step) * step; t <= to; t += step) ticks.push(t);
  return ticks;
}

/**
 * The incident second by second on one shared clock: demand against capacity, response time and service errors, each
 * against its limit, with the recorded events as numbered markers keyed in the list below. The selected second's
 * readings are written out above the plot; arrow keys, Home and End move it, and so does the pointer.
 */
export function IncidentTimeline({ snapshots, events, trace, openedStep, recoveredStep, focusable }: {
  snapshots: Snapshot[]; events: ReportEvent[]; trace: TraceEvent[]; openedStep: number; recoveredStep: number; focusable: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => { if (entry.contentRect.width > 0) setWidth(Math.round(entry.contentRect.width)); });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // The selection moves between seconds that have readings; it opens on the slowest one.
  const [selected, setSelected] = useState(() => snapshots.reduce((worst, m, i) => (m.latencyMs > snapshots[worst].latencyMs ? i : worst), 0));
  const current = snapshots[Math.min(selected, snapshots.length - 1)];
  const from = Math.min(snapshots[0].step, events[0]?.step ?? Infinity), to = Math.max(snapshots.at(-1)!.step, recoveredStep, events.at(-1)?.step ?? 0);
  const limited = snapshots.some(m => m.rejected > 0);

  const loadMax = niceMax(Math.max(...snapshots.flatMap(m => [m.app.demand, m.app.capacity, m.db.demand, m.db.capacity, limited ? m.incoming : 0])));
  const latencyMax = niceMax(Math.max(LATENCY_LIMIT_MS * 1.2, ...snapshots.map(m => m.latencyMs)));
  const errorMax = niceMax(Math.max(ERROR_LIMIT * 1.5, ...snapshots.map(m => m.serviceErrorRate ?? 0)));
  const loadTick = (v: number) => num(v), latencyTick = (v: number) => `${num(v)} ms`, errorTick = (v: number) => `${+(v * 100).toFixed(1)}%`;
  // The left margin fits the longest tick label, as the History charts do.
  const L = Math.max(48, Math.ceil(Math.max(loadTick(loadMax).length, latencyTick(latencyMax).length, errorTick(errorMax).length) * 6.8) + 12), R = 14, W = Math.max(280, width);
  const x = (step: number) => L + ((W - L - R) * (step - from)) / Math.max(1, to - from);
  const lane = (top: number, height: number, max: number) => (v: number) => top + height - (height * Math.min(v, max)) / max;
  const stacks = new Map<number, number>();
  const markers = events.map((e, i) => { const level = stacks.get(e.step) ?? 0; stacks.set(e.step, level + 1); return { ...e, n: i + 1, level }; });
  const deepest = Math.max(1, ...stacks.values());
  // Each lane's title sits in the gap above it, clear of the previous lane's lowest tick and of the incident label.
  const GAP = 38, load = { top: 44, height: 96 }, latency = { top: load.top + load.height + GAP, height: 56 };
  const errors = { top: latency.top + latency.height + GAP, height: 40 }, track = { top: errors.top + errors.height + GAP, height: 8 + deepest * 15 };
  const bottom = track.top + track.height, H = bottom + 22;
  const loadY = lane(load.top, load.height, loadMax), latencyY = lane(latency.top, latency.height, latencyMax), errorY = lane(errors.top, errors.height, errorMax);
  const line = (value: (m: Snapshot) => number | null, y: (v: number) => number) => path(snapshots.map(m => { const v = value(m); return [x(m.step), v === null ? null : y(v)]; }));
  const activations = [...new Set(trace.filter(e => e.type === "action-activated" && e.step >= from && e.step <= to).map(e => e.step))];

  const select = (index: number) => setSelected(Math.min(snapshots.length - 1, Math.max(0, index)));
  const onPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const step = from + ((event.clientX - rect.left - L) / (rect.width - L - R)) * (to - from);
    select(snapshots.reduce((near, m, i) => (Math.abs(m.step - step) < Math.abs(snapshots[near].step - step) ? i : near), 0));
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const move = ({ ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -5, PageUp: 5 } as Record<string, number>)[event.key];
    if (move !== undefined) select(selected + move);
    else if (event.key === "Home") select(0);
    else if (event.key === "End") select(snapshots.length - 1);
    else return;
    event.preventDefault();
  };
  const laneTitle = (top: number, text: string) => <text x={L} y={top - 14} className="timeline-lane">{text}</text>;
  const axis = (y: (v: number) => number, ticks: number[], format: (v: number) => string) => ticks.map(t => <g key={t}>
    <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="chart-grid" />
    <text x={L - 6} y={y(t) + 3.5} textAnchor="end" className="chart-tick">{format(t)}</text>
  </g>);
  const limit = (y: number, text: string) => <g><line x1={L} x2={W - R} y1={y} y2={y} className="timeline-limit" /><text x={W - R} y={y - 4} textAnchor="end" className="timeline-limit-label">{text}</text></g>;
  const dot = (cx: number, cy: number, color: string) => <circle cx={cx} cy={cy} r={3.5} fill={color} className="timeline-dot" />;

  return <section className="incident-timeline" aria-label="Incident timeline">
    <h4>Incident timeline</h4>
    <p className="timeline-readout" aria-hidden="true"><b>Game second {current.step}</b>{readings(current).map(r => <span key={r}>{r}</span>)}</p>
    <ul className="timeline-legend" aria-hidden="true">
      <li><i style={{ borderColor: CHART_COLORS.users }} />App Servers demand</li>
      <li><i className="is-dashed" style={{ borderColor: CHART_COLORS.users }} />App Servers capacity</li>
      <li><i style={{ borderColor: CHART_COLORS.db }} />Database demand</li>
      <li><i className="is-dashed" style={{ borderColor: CHART_COLORS.db }} />Database capacity</li>
      {limited && <li><i className="is-dotted" style={{ borderColor: "var(--text-soft)" }} />Incoming before the traffic limit</li>}
    </ul>
    <div ref={box} className="timeline-plot" role="slider" tabIndex={focusable ? 0 : undefined} aria-label="Incident timeline, game second"
      aria-valuemin={snapshots[0].step} aria-valuemax={snapshots.at(-1)!.step} aria-valuenow={current.step} aria-valuetext={reading(current)}
      onPointerMove={onPointer} onPointerDown={onPointer} onKeyDown={onKey}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <rect x={x(openedStep)} y={0} width={Math.max(2, x(recoveredStep) - x(openedStep))} height={bottom} className="timeline-incident" />
        <text x={x(openedStep) + 5} y={13} className="timeline-incident-label">Incident</text>
        {activations.map(step => <line key={step} x1={x(step)} x2={x(step)} y1={load.top} y2={bottom} className="timeline-activation" />)}
        <line x1={x(current.step)} x2={x(current.step)} y1={load.top} y2={bottom} className="timeline-cursor" />

        {laneTitle(load.top, "Demand and capacity per second")}
        {axis(loadY, [0, loadMax / 2, loadMax], loadTick)}
        {limited && <path d={line(m => m.incoming, loadY)} className="timeline-line is-dotted" stroke="var(--text-soft)" />}
        <path d={line(m => m.app.capacity, loadY)} className="timeline-line is-dashed" stroke={CHART_COLORS.users} />
        <path d={line(m => m.db.capacity, loadY)} className="timeline-line is-dashed" stroke={CHART_COLORS.db} />
        <path d={line(m => m.app.demand, loadY)} className="timeline-line" stroke={CHART_COLORS.users} />
        <path d={line(m => m.db.demand, loadY)} className="timeline-line" stroke={CHART_COLORS.db} />

        {laneTitle(latency.top, "Response time")}
        {axis(latencyY, [0, latencyMax], latencyTick)}
        {limit(latencyY(LATENCY_LIMIT_MS), `${LATENCY_LIMIT_MS} ms limit`)}
        <path d={line(m => m.latencyMs, latencyY)} className="timeline-line" stroke={CHART_COLORS.health} />

        {laneTitle(errors.top, "Service errors")}
        {axis(errorY, [0, errorMax], errorTick)}
        {limit(errorY(ERROR_LIMIT), "1% limit")}
        <path d={line(m => m.serviceErrorRate, errorY)} className="timeline-line" stroke={CHART_COLORS.costs} />

        {laneTitle(track.top, "Events")}
        <line x1={L} x2={W - R} y1={bottom} y2={bottom} className="timeline-axis" />
        {markers.map(e => <g key={e.id} className="timeline-marker" data-current={e.step === current.step || undefined}>
          <circle cx={x(e.step)} cy={bottom - 9 - e.level * 15} r={7} fill={KIND_COLOR[e.kind]} />
          <text x={x(e.step)} y={bottom - 9 - e.level * 15 + 3} textAnchor="middle">{e.n}</text>
        </g>)}
        {secondTicks(from, to, W - L - R).map(t => <text key={t} x={x(t)} y={bottom + 15} textAnchor="middle" className="chart-tick">{t}</text>)}
        <text x={L - 6} y={bottom + 15} textAnchor="end" className="chart-tick">Second</text>

        {dot(x(current.step), loadY(current.app.demand), CHART_COLORS.users)}
        {dot(x(current.step), loadY(current.db.demand), CHART_COLORS.db)}
        {dot(x(current.step), latencyY(current.latencyMs), CHART_COLORS.health)}
        {current.serviceErrorRate !== null && dot(x(current.step), errorY(current.serviceErrorRate), CHART_COLORS.costs)}
      </svg>
    </div>
    {events.length ? <ol className="report-events" aria-label="Recorded events">{markers.map(e => <li key={e.id} data-current={e.step === current.step || undefined}>
      <span className="report-event-step"><b className="timeline-badge" style={{ background: KIND_COLOR[e.kind] }} aria-hidden="true">{e.n}</b>{e.step}</span>
      <span><b>{e.title}</b>{e.detail && <small>{e.detail}</small>}</span>
    </li>)}</ol> : <p>No event history was retained.</p>}
  </section>;
}
