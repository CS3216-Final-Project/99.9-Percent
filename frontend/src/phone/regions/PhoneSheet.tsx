import { useEffect, useId, useRef, type ReactNode } from "react";
import { equipmentInfo, metrics, type EquipmentId } from "@/sim";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
import { clock, num } from "@/game/format";
import { selectedInView } from "@/game/floors";
import { useGame } from "@/game/store";
import { CampaignPanel } from "@/components/CampaignUI";
import { ClassicViewSheet } from "@/components/Game";
import { Icon, type IconName } from "@/components/icons";
import OperationsRail from "@/components/OperationsRail";
import { EQUIPMENT_ICON } from "@/components/presentation";
import SidePanel from "@/components/SidePanel";
import { getSheetState, setSheetState, SHEET_STATES, shownSheetState, useSheetState, type SheetState } from "../layout/sheetState";
import "../layout/phone-layout.css";

/**
 * Region: sheet. A bottom sheet over the room with Guided Mode's System metrics, or Challenge Mode's equipment panel
 * and weekly operations. Its handle shows the headline readings and opens it to peek, half or full; the room's canvas
 * keeps its size whatever the sheet does. Challenge Mode's Tech, Team and History views open over the room as well.
 */
export function PhoneSheet() {
  const campaign = useGame((s) => !!s.game.campaign);
  const started = useGame((s) => s.started);
  if (!started) return null;
  return <>
    <MetricsSheet campaign={campaign} />
    {!campaign && <ClassicViewSheet />}
  </>;
}

const SHEET_WORDS: Record<SheetState, string> = { peek: "Collapsed", half: "Half open", full: "Fully open" };
/** How far a drag on the handle must travel before it counts as a swipe rather than a tap. */
const SWIPE = 24;

function MetricsSheet({ campaign }: { campaign: boolean }) {
  const state = useSheetState();
  const incident = useGame((s) => s.game.phase === "incident");
  const shown = shownSheetState(state, incident);
  const selected = useGame((s) => s.selected);
  const selectedAppId = useGame((s) => s.selectedAppId);
  const panelOpen = useGame((s) => s.panelOpen);
  const setPanelOpen = useGame((s) => s.setPanelOpen);
  const body = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; swiped: boolean } | null>(null);
  const summaryId = useId(), bodyId = useId();

  // The sheet replaces the desktop panel's hide and show; its contents are always there to open.
  useEffect(() => { if (!panelOpen) setPanelOpen(true); }, [panelOpen, setPanelOpen]);

  // Choosing equipment, in the room or in the sheet, opens the sheet far enough to read it, from its top.
  const lastSelection = useRef(`${selected}:${selectedAppId}`);
  useEffect(() => {
    const key = `${selected}:${selectedAppId}`;
    if (key === lastSelection.current) return;
    lastSelection.current = key;
    if (selected && getSheetState() === "peek") setSheetState("half");
  }, [selected, selectedAppId]);
  // Guided Mode opens equipment in its inspection popup and keeps the sheet's place, so only Challenge Mode starts again at the top.
  useEffect(() => { if (!campaign) body.current?.scrollTo?.({ top: 0 }); }, [selected, selectedAppId, campaign]);
  useEffect(() => { body.current?.scrollTo?.({ top: 0 }); }, [incident]);

  const index = SHEET_STATES.indexOf(shown);
  const lowest = incident ? 1 : 0;
  const move = (by: number) => setSheetState(SHEET_STATES[Math.max(lowest, Math.min(SHEET_STATES.length - 1, index + by))]);
  const cycle = () => index === SHEET_STATES.length - 1 ? setSheetState(SHEET_STATES[lowest]) : move(1);
  const hint = index === SHEET_STATES.length - 1 ? (lowest ? "Tap to show less." : "Tap to collapse.") : index === 0 ? "Tap to open." : "Tap to open fully.";

  return <div className="phone-sheet" data-state={shown}>
    <div className="phone-sheet-head">
      <button type="button" className="phone-sheet-handle" aria-label="System metrics" aria-expanded={shown !== "peek"} aria-controls={bodyId}
        aria-describedby={summaryId} data-state={shown}
        onPointerDown={(event) => { drag.current = { y: event.clientY, swiped: false }; }}
        onPointerUp={(event) => {
          const start = drag.current;
          if (!start) return;
          const dy = event.clientY - start.y;
          if (Math.abs(dy) >= SWIPE) { start.swiped = true; move(dy < 0 ? 1 : -1); }
        }}
        onClick={() => {
          const swiped = drag.current?.swiped;
          drag.current = null;
          if (!swiped) cycle();
        }}
        onKeyDown={(event) => {
          const by = event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : event.key === "End" ? 2 : event.key === "Home" ? -2 : 0;
          if (!by) return;
          event.preventDefault();
          move(by);
        }}>
        <span className="phone-sheet-grabber" aria-hidden="true" />
      </button>
      <div id={summaryId} className="phone-sheet-summary">
        {campaign ? <GuidedPeek /> : <ClassicPeek />}
        <span className="visually-hidden">{SHEET_WORDS[shown]}. {hint}</span>
        <Icon name="down" size={18} className="phone-sheet-chevron" />
      </div>
    </div>
    <div ref={body} id={bodyId} className="phone-sheet-body">
      {campaign ? <CampaignPanel /> : <><SidePanel /><OperationsRail /></>}
    </div>
  </div>;
}

const GUIDED_NAMES: Partial<Record<EquipmentId, string>> = { gateway: "Network", app: "App Server", db: "Database", monitoring: "Monitoring", cache: "Read Cache", team: "Team", deploy: "Deploy", growth: "Growth" };

/** What the sheet is about: the selected equipment, the incident, or System metrics. */
function PeekTitle({ icon, children, short, tone }: { icon: IconName; children: ReactNode; short?: ReactNode; tone?: "critical" }) {
  // On a narrow phone the readings keep their room and the title shortens to `short` (or its icon alone).
  return <span className={`phone-peek-title${tone ? ` tone-${tone}` : ""}${short === undefined ? "" : " has-short"}`}>
    <Icon name={icon} size={16} /><span className="phone-peek-full">{children}</span>
    {short !== undefined && <span className="phone-peek-short" aria-hidden="true">{short}</span>}
  </span>;
}

function PeekReading({ icon, value, unit, label, alert }: { icon: IconName; value: string; unit?: string; label: string; alert?: boolean }) {
  return <span className={`phone-peek-reading${alert ? " is-alert" : ""}`}>
    <Icon name={icon} size={14} />
    <span className="visually-hidden">{label} </span><strong>{value}</strong>{unit && <small>{unit}</small>}
  </span>;
}

/** Guided Mode at a glance: latency, errors and backlog, with the selected equipment or the incident's recovery. */
function GuidedPeek() {
  const c = useGame((s) => s.game.campaign!);
  const shown = useGame((s) => selectedInView(s.selected, s.floor));
  const appId = useGame((s) => s.selectedAppId);
  const m = c.snapshot;
  const slow = m.latencyMs >= Q.latencyThresholdMs;
  const failing = m.serviceErrorRate !== null && m.serviceErrorRate >= Q.errorThreshold;
  const name = shown ? GUIDED_NAMES[shown] : undefined;
  const app = shown === "app" && c.apps.length > 1 && appId ? ` · App ${appId.slice(4)}` : "";
  return <>
    {c.incident ? <PeekTitle icon="incident" tone="critical" short={`${c.incident.stableSteps}/${Q.stableSteps} s`}>Incident · {c.incident.stableSteps}/{Q.stableSteps} s<span className="visually-hidden"> stable</span></PeekTitle>
      : name && shown ? <PeekTitle icon={EQUIPMENT_ICON[shown]}>{name}{app}</PeekTitle>
      : <PeekTitle icon="monitor" short="">System metrics</PeekTitle>}
    <span className="phone-peek-readings">
      <PeekReading icon="timer" label="Latency" value={m.latencyMs.toFixed(0)} unit="ms" alert={slow} />
      <PeekReading icon="error" label="Errors" value={m.serviceErrorRate === null ? "-" : (m.serviceErrorRate * 100).toFixed(m.serviceErrorRate >= 0.1 ? 0 : 1)} unit="%" alert={failing} />
      <PeekReading icon="backlog" label="Backlog" value={num(m.app.backlog + m.db.backlog)} />
    </span>
  </>;
}

/** Challenge Mode at a glance: server and database load at the weekly peak, with the selection or the incident clock. */
function ClassicPeek() {
  const game = useGame((s) => s.game);
  const shown = useGame((s) => selectedInView(s.selected, s.floor));
  const m = metrics(game);
  const inc = game.phase === "incident" ? game.incident : null;
  const pct = (v: number) => `${Math.round(v * 100)}`;
  return <>
    {inc ? <PeekTitle icon="incident" tone="critical" short={clock(inc.elapsed)}>Incident · {clock(inc.elapsed)}</PeekTitle>
      : shown ? <PeekTitle icon={EQUIPMENT_ICON[shown]}>{equipmentInfo(game, shown).name}</PeekTitle>
      : <PeekTitle icon="monitor" short="">Equipment</PeekTitle>}
    <span className="phone-peek-readings">
      <PeekReading icon="server" label="Server load" value={pct(m.appUtil)} unit="%" alert={m.appUtil >= 1} />
      <PeekReading icon="database" label="Database load" value={pct(m.dbUtil)} unit="%" alert={m.dbUtil >= 1} />
      <PeekReading icon="incoming" label="Peak requests per second" value={num(m.peakRps)} unit="/s" />
    </span>
  </>;
}
