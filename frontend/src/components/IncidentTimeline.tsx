import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { flushSync } from "react-dom";
import type { EventKind } from "@/sim";
import type { Snapshot, TraceEvent } from "@/sim/campaignTypes";
import type { ReportEvent } from "@/game/reportEvents";
import { CHART_COLORS, niceMax } from "./presentation";
import "./IncidentTimeline.css";

const num = (n: number) => n.toLocaleString("en-US");
const percent = (rate: number) => `${(rate * 100).toFixed(2)}%`;
const LATENCY_LIMIT_MS = 500, ERROR_LIMIT = 0.01;
// A character's rough width in the extra-small labels, to fit them before they are drawn; a marker's width plus a hairline;
// and how many markers the events track stacks before it folds the rest at a spot into one.
const CHAR = 6.8, MARKER = 15, LEVELS = 3;
const LONGEST_TITLE = "Demand and capacity per second";
const KIND_COLOR: Record<EventKind, string> = { incident: "var(--critical-ink)", success: "var(--ok-ink)", decision: "var(--ink)", warning: "var(--warn-ink)", milestone: "var(--tile-gold-ink)", finance: CHART_COLORS.cash, info: "var(--text-soft)" };

/**
 * What one game second's readings say, the same figures for screen readers and for the readout above the plot, which
 * capitalises each one.
 */
function readings(m: Snapshot) {
  return [`response time ${num(Math.round(m.latencyMs))} ms`, m.serviceErrorRate === null ? "no completed requests" : `service errors ${percent(m.serviceErrorRate)}`,
    `App Servers ${num(m.app.demand)} of ${num(m.app.capacity)} req/s`, `Database ${num(m.db.demand)} of ${num(m.db.capacity)} ops/s`,
    ...(m.rejected > 0 ? [`${num(m.rejected)} req/s turned away`] : [])];
}
const reading = (m: Snapshot) => `Game second ${m.step}: ${readings(m).join(", ")}`;
/**
 * A reading with its digits as zeros: the readout's figures are tabular, so readings of one shape are equally wide, and
 * the incident's few shapes stand for all its seconds.
 */
const shape = (text: string) => text.replace(/\d/g, "0");
/** How far a second is past the limit it misses most, so a failure that shows only in its errors still counts. */
const severity = (m: Snapshot) => Math.max(m.latencyMs / LATENCY_LIMIT_MS, (m.serviceErrorRate ?? 0) / ERROR_LIMIT);

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

/** Whether a line through these points passes through a box: each segment covers every height between its ends. */
function crosses(points: [number, number | null][], x0: number, x1: number, y0: number, y1: number) {
  return points.some(([ax, ay], i) => {
    const [bx, by] = points[i + 1] ?? [ax, ay];
    if (ay === null || by === null || bx < x0 || ax > x1) return false;
    const at = (x: number) => (bx === ax ? ay : ay + ((by - ay) * (x - ax)) / (bx - ax));
    const p = at(Math.max(ax, x0)), q = at(Math.min(bx, x1));
    return Math.max(p, q) >= y0 && Math.min(p, q) <= y1;
  });
}

/**
 * The window's first and last second at the plot's ends, and round seconds between them about one per 70 px, each
 * kept only where its label stays clear of its neighbours.
 */
function secondTicks(from: number, to: number, x: (step: number) => number): { t: number; anchor: "start" | "middle" | "end" }[] {
  const wide = (t: number) => String(t).length * CHAR, span = to - from;
  if (span <= 0) return [{ t: from, anchor: "start" }];
  const step = [1, 2, 5, 10, 20, 50, 100, 200, 500].find(s => span / s <= Math.max(2, Math.floor((x(to) - x(from)) / 70))) ?? 1000;
  const ticks: ReturnType<typeof secondTicks> = [{ t: from, anchor: "start" }];
  let right = x(from) + wide(from);
  for (let t = Math.floor(from / step) * step + step; t < to; t += step) {
    if (x(t) - wide(t) / 2 < right + 10 || x(t) + wide(t) / 2 > x(to) - wide(to) - 10) continue;
    ticks.push({ t, anchor: "middle" }); right = x(t) + wide(t) / 2;
  }
  return [...ticks, { t: to, anchor: "end" }];
}

/**
 * The incident second by second on one shared clock: demand against capacity, response time and service errors, each
 * against its limit, with the recorded events as numbered markers keyed in the list below. The selected second's
 * readings are written out above the plot; arrow keys, Home and End move it, and so does the pointer.
 */
export function IncidentTimeline({ snapshots, events, trace, openedStep, recoveredStep, focusable }: {
  snapshots: Snapshot[]; events: ReportEvent[]; trace: TraceEvent[]; openedStep: number; recoveredStep: number; focusable: boolean;
}) {
  const drawing = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(640);
  // Resize observers report after layout and before the frame is painted, and the new width is drawn right there, so
  // the frame that opens the technical details, or resizes the report, is drawn at the plot's width, not scaled to it.
  useLayoutEffect(() => {
    const el = drawing.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => { const fits = Math.floor(entry.contentRect.width); if (fits > 0) flushSync(() => setWidth(fits)); });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // The selection moves between seconds that have readings; it opens on the worst one.
  const [selected, setSelected] = useState(() => snapshots.reduce((worst, m, i) => (severity(m) > severity(snapshots[worst]) ? i : worst), 0));
  const current = snapshots[Math.min(selected, snapshots.length - 1)];
  const from = Math.min(snapshots[0].step, events[0]?.step ?? Infinity), to = Math.max(snapshots.at(-1)!.step, recoveredStep, events.at(-1)?.step ?? 0);
  const limited = snapshots.some(m => m.rejected > 0);
  // Each reading in the readout keeps a slot as wide as that reading's widest shape in any of the incident's seconds,
  // with an empty one for requests turned away when a second has none, so the readout wraps the same way whichever
  // second is selected and the plot under the pointer never moves. The slots follow the report's width as it changes.
  const slots = useMemo(() => [snapshots.map(m => `Game second ${m.step}`), ...Array.from({ length: limited ? 5 : 4 }, (_, i) => snapshots.flatMap(m => readings(m)[i] ?? []))]
    .map(texts => [...new Set(texts.map(shape))]), [snapshots, limited]);
  const shown = [`Game second ${current.step}`, ...readings(current)];

  const loadMax = niceMax(Math.max(...snapshots.flatMap(m => [m.app.demand, m.app.capacity, m.db.demand, m.db.capacity, limited ? m.incoming : 0])));
  const latencyMax = niceMax(Math.max(LATENCY_LIMIT_MS * 1.2, ...snapshots.map(m => m.latencyMs)));
  const errorMax = niceMax(Math.max(ERROR_LIMIT * 1.5, ...snapshots.map(m => m.serviceErrorRate ?? 0)));
  const loadTick = (v: number) => num(v), latencyTick = (v: number) => `${num(v)} ms`, errorTick = (v: number) => `${+(v * 100).toFixed(1)}%`;
  // The left margin fits the longest tick label, as the History charts do, and the drawing fills the plot's width.
  const L = Math.max(48, Math.ceil(Math.max(loadTick(loadMax).length, latencyTick(latencyMax).length, errorTick(errorMax).length) * CHAR) + 12), R = 14, W = width;
  // Lane titles move to the left edge where the longest would not fit beside the ticks.
  const titleX = L + LONGEST_TITLE.length * CHAR <= W ? L : 0;
  const x = (step: number) => L + ((W - L - R) * (step - from)) / Math.max(1, to - from);
  const lane = (top: number, height: number, max: number) => (v: number) => top + height - (height * Math.min(v, max)) / max;
  // A marker too close to an earlier one to sit beside it is lifted to the lowest level it clears. Where it clears
  // none, it folds into the top level's last marker, which then counts the events it stands for, so a burst of
  // decisions never stacks the track taller than the report.
  const keyed = events.map((e, i) => ({ ...e, n: i + 1 })), ends: number[] = [];
  const markers: { x: number; level: number; events: typeof keyed }[] = [];
  for (const e of keyed) {
    const cx = x(e.step), free = ends.findIndex(end => cx - end >= MARKER), level = free < 0 ? ends.length : free;
    if (level < LEVELS) { ends[level] = cx; markers.push({ x: cx, level, events: [e] }); }
    else markers.findLast(m => m.level === LEVELS - 1)!.events.push(e);
  }
  const deepest = Math.max(1, ends.length);
  // Each lane's title sits in the gap above it, clear of the previous lane's lowest tick and of the incident label.
  const GAP = 38, load = { top: 44, height: 96 }, latency = { top: load.top + load.height + GAP, height: 56 };
  const errors = { top: latency.top + latency.height + GAP, height: 40 }, track = { top: errors.top + errors.height + GAP, height: 8 + deepest * MARKER };
  const bottom = track.top + track.height, H = bottom + 22;
  const loadY = lane(load.top, load.height, loadMax), latencyY = lane(latency.top, latency.height, latencyMax), errorY = lane(errors.top, errors.height, errorMax);
  const series = (value: (m: Snapshot) => number | null, y: (v: number) => number) => snapshots.map((m): [number, number | null] => { const v = value(m); return [x(m.step), v === null ? null : y(v)]; });
  const line = (value: (m: Snapshot) => number | null, y: (v: number) => number) => path(series(value, y));
  const activations = [...new Set(trace.filter(e => e.type === "action-activated" && e.step >= from && e.step <= to).map(e => e.step))];

  const select = (index: number) => setSelected(Math.min(snapshots.length - 1, Math.max(0, index)));
  const onPointer = (event: PointerEvent<HTMLDivElement>) => {
    // The pointer is read in the drawing's own coordinates, so a position picks the second drawn under it.
    const rect = drawing.current!.getBoundingClientRect(), px = ((event.clientX - rect.left) * W) / rect.width;
    const step = from + ((px - L) / (W - L - R)) * (to - from);
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
  const laneTitle = (top: number, text: string) => <text x={titleX} y={top - 14} className="timeline-lane">{text}</text>;
  const axis = (y: (v: number) => number, ticks: number[], format: (v: number) => string) => ticks.map(t => <g key={t}>
    <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="chart-grid" />
    <text x={L - 6} y={y(t) + 3.5} textAnchor="end" className="chart-tick">{format(t)}</text>
  </g>);
  // A limit's label sits just above or below its line, as far right as the lane's own line leaves it clear, and
  // never so high that it meets the lane title or so low that it meets the next one. Its glyphs stand about 10 px
  // above the baseline and none descend.
  const limit = (y: number, text: string, { top, height }: { top: number; height: number }, points: [number, number | null][]) => {
    const wide = text.length * CHAR, spots: { x0: number; base: number }[] = [];
    for (let x0 = W - R - wide; x0 >= L + 4; x0 -= 4) for (const base of [y - 4, y + 13]) if (base >= top && base <= top + height + 11) spots.push({ x0, base });
    const spot = spots.find(({ x0, base }) => !crosses(points, x0 - 3, x0 + wide + 3, base - 12, base + 3)) ?? { x0: W - R - wide, base: y - 4 };
    return <g><line x1={L} x2={W - R} y1={y} y2={y} className="timeline-limit" /><text x={spot.x0} y={spot.base} className="timeline-limit-label">{text}</text></g>;
  };
  const dot = (cx: number, cy: number, color: string) => <circle cx={cx} cy={cy} r={3.5} fill={color} className="timeline-dot" />;

  return <section className="incident-timeline" aria-label="Incident timeline">
    <h4>Incident timeline</h4>
    <p className="timeline-readout" aria-hidden="true">{slots.map((room, i) => {
      const Text = i === 0 ? "b" : "span";
      return <span key={i} className="timeline-reading"><Text>{shown[i]}</Text>{room.map(s => <Text key={s} className="timeline-reading-room">{s}</Text>)}</span>;
    })}</p>
    <ul className="timeline-legend" aria-hidden="true">
      <li><i style={{ borderColor: CHART_COLORS.users }} />App Servers demand</li>
      <li><i className="is-dashed" style={{ borderColor: CHART_COLORS.users }} />App Servers capacity</li>
      <li><i style={{ borderColor: CHART_COLORS.db }} />Database demand</li>
      <li><i className="is-dashed" style={{ borderColor: CHART_COLORS.db }} />Database capacity</li>
      {limited && <li><i className="is-dotted" style={{ borderColor: "var(--text-soft)" }} />Incoming before the traffic limit</li>}
    </ul>
    <div className="timeline-plot" role="slider" tabIndex={focusable ? 0 : undefined} aria-label="Incident timeline, game second"
      aria-valuemin={snapshots[0].step} aria-valuemax={snapshots.at(-1)!.step} aria-valuenow={current.step} aria-valuetext={reading(current)}
      onPointerMove={onPointer} onPointerDown={onPointer} onKeyDown={onKey}>
      <svg ref={drawing} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
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
        {limit(latencyY(LATENCY_LIMIT_MS), `${LATENCY_LIMIT_MS} ms limit`, latency, series(m => m.latencyMs, latencyY))}
        <path d={line(m => m.latencyMs, latencyY)} className="timeline-line" stroke={CHART_COLORS.health} />

        {laneTitle(errors.top, "Service errors")}
        {axis(errorY, [0, errorMax], errorTick)}
        {limit(errorY(ERROR_LIMIT), "1% limit", errors, series(m => m.serviceErrorRate, errorY))}
        <path d={line(m => m.serviceErrorRate, errorY)} className="timeline-line" stroke={CHART_COLORS.costs} />

        {laneTitle(track.top, "Events")}
        <line x1={L} x2={W - R} y1={bottom} y2={bottom} className="timeline-axis" />
        {markers.map(({ x: cx, level, events: [first, ...more] }) => {
          const cy = bottom - 9 - level * MARKER, label = more.length ? `+${more.length + 1}` : String(first.n);
          return <g key={first.id} className={`timeline-marker${more.length ? " is-folded" : ""}`} data-current={[first, ...more].some(e => e.step === current.step) || undefined}>
            <circle cx={cx} cy={cy} r={7} fill={more.length ? undefined : KIND_COLOR[first.kind]} />
            {/* A count of ten or more is squeezed to stay inside its marker. */}
            <text x={cx} y={cy + 3} textAnchor="middle" {...label.length > 2 && { textLength: 12, lengthAdjust: "spacingAndGlyphs" }}>{label}</text>
          </g>;
        })}
        {secondTicks(from, to, x).map(({ t, anchor }) => <text key={t} x={x(t)} y={bottom + 15} textAnchor={anchor} className="chart-tick">{t}</text>)}
        <text x={L - 6} y={bottom + 15} textAnchor="end" className="chart-tick">Second</text>

        {dot(x(current.step), loadY(current.app.demand), CHART_COLORS.users)}
        {dot(x(current.step), loadY(current.db.demand), CHART_COLORS.db)}
        {dot(x(current.step), latencyY(current.latencyMs), CHART_COLORS.health)}
        {current.serviceErrorRate !== null && dot(x(current.step), errorY(current.serviceErrorRate), CHART_COLORS.costs)}
      </svg>
    </div>
    {events.length ? <ol className="report-events" aria-label="Recorded events">{keyed.map(e => <li key={e.id} data-current={e.step === current.step || undefined}>
      <span className="report-event-step"><b className="timeline-badge" style={{ background: KIND_COLOR[e.kind] }} aria-hidden="true">{e.n}</b>{e.step}</span>
      <span><b>{e.title}</b>{e.detail && <small>{e.detail}</small>}</span>
    </li>)}</ol> : <p>No event history was retained.</p>}
  </section>;
}
