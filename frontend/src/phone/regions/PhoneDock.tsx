import { useSyncExternalStore } from "react";
import { BALANCE, completedTechIds, metrics, TECH_ORDER } from "@/sim";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
import { pendingStop } from "@/sim/step";
import { clock } from "@/game/format";
import { milestoneBlocks } from "@/game/campaignGuidance";
import { useGame } from "@/game/store";
import { DockMenu } from "@/components/DockMenu";
import { Icon } from "@/components/icons";
import { RoomControlsSlot } from "@/components/RoomControlsHost";
import { TimeMenu } from "@/components/TimeMenu";
import { tipProps } from "@/components/tips";
import { Meter } from "@/components/ui";
import { AUTO_SECONDS } from "@/components/useGameRuntime";
import { ViewTabs, type ViewTab } from "@/components/ViewSheet";
import "../layout/phone-layout.css";

/**
 * Region: dock. One row along the bottom edge: the views (Tech, History and, in Challenge Mode, Team) and Navigation
 * on the left, then the clock, the speed menu and the one primary time control on the right, under the thumb.
 * Guided Mode adds End week beside the speed menu: a 20x rush to the week boundary that slows back down when an
 * incident happens. Where the views do not fit beside the
 * time controls they fold into one Views menu. Every menu opens above the dock.
 */
export function PhoneDock() {
  const campaign = useGame((s) => !!s.game.campaign);
  return campaign ? <GuidedDock /> : <ChallengeDock />;
}

/**
 * The narrowest dock that still shows each view as its own button, by how many views there are. The sums follow
 * the fixed control widths in phone-layout.css: the clock, speed and primary action, Navigation, the view buttons,
 * the gaps between them and the dock's side padding.
 */
const DIRECT_VIEWS_MIN: Record<"guided" | "challenge", Record<number, number>> = {
  guided: { 2: 408 },
  challenge: { 1: 360, 2: 408, 3: 456 },
};

function subscribeWidth(listener: () => void) {
  window.addEventListener("resize", listener);
  return () => window.removeEventListener("resize", listener);
}
const viewportWidth = () => window.innerWidth;

function DockViews({ tabs, mode }: { tabs: ViewTab[]; mode: "guided" | "challenge" }) {
  const width = useSyncExternalStore(subscribeWidth, viewportWidth, viewportWidth);
  const active = useGame((s) => tabs.some((tab) => tab.id === s.view));
  if (width >= (DIRECT_VIEWS_MIN[mode][tabs.length] ?? Infinity)) return <ViewTabs tabs={tabs} />;
  return <DockMenu className={`phone-views-menu${active ? " is-active" : ""}`} name="Views" label={<><span className="tab-icon" aria-hidden="true"><Icon name="overview" size={17} /></span><span className="tab-label">Views</span></>}>
    <h3>Views</h3>
    {/* Choosing a view closes the menu, as the view opens over the room. */}
    <div onClick={(event) => { if ((event.target as Element).closest("button")) event.currentTarget.closest("details")?.removeAttribute("open"); }}>
      <ViewTabs tabs={tabs} />
    </div>
  </DockMenu>;
}

function GuidedDock() {
  const game = useGame((s) => s.game);
  const running = useGame((s) => s.running);
  const setRunning = useGame((s) => s.setRunning);
  const weekRush = useGame((s) => s.weekRush);
  const endWeek = useGame((s) => s.endWeek);
  const cancelWeekRush = useGame((s) => s.cancelWeekRush);
  const started = useGame((s) => s.started);
  const c = game.campaign!;
  const incident = game.phase === "incident";
  const active = started && pendingStop(c) === null && !milestoneBlocks(c) && (game.phase === "management" || incident);
  const second = c.step % Q.periodSteps;
  const tabs: ViewTab[] = [
    { id: "tech", label: "Tech", icon: "tree", badge: `${completedTechIds(game).length}/${TECH_ORDER.length}` },
    { id: "history", label: "History", icon: "history", badge: c.reports.length > 0 ? String(c.reports.length) : null },
  ];
  return <footer className={`bottombar controls-dock campaign-clock phone-dock${running ? " is-running" : " is-paused"}`}>
    <DockViews tabs={tabs} mode="guided" />
    <RoomControlsSlot />
    <div className="time-controls" role="group" aria-label="Time">
      <div className={`week phone-clock${incident ? " is-incident" : ""}`}>
        <span className="brand-week"><Icon name="week" size={14} /><span>Week <strong>{game.turn}</strong></span></span>
        <span className="dock-second"><span>{second}</span>/{Q.periodSteps} s</span>
        <Meter value={second / Q.periodSteps} label="Operating week progress" />
        <span className="visually-hidden" aria-hidden="true" data-testid="physical-step">{c.step}</span>
      </div>
      <TimeMenu />
      <button type="button" className={`dock-speed dock-rush phone-rush${weekRush ? " is-on" : ""}`} aria-pressed={weekRush} aria-label="End the week at 20 times speed"
        {...tipProps("Fast-forward to the end of the week (20×). Slows back down if an incident happens.")}
        disabled={!active} onClick={() => weekRush ? cancelWeekRush() : endWeek()}><Icon name="stepMany" size={18} /><span>End week</span></button>
      <button type="button" className={`btn btn-primary campaign-play dock-primary${running ? " is-on" : ""}`} aria-label={running ? "Pause" : "Run"}
        {...tipProps("Run or pause the company (P)")} disabled={!active} onClick={() => setRunning(!running)}>
        <Icon name={running ? "pause" : "play"} /><span>{running ? "Pause" : "Run"}</span>
      </button>
      <span className="visually-hidden" role="status">{running ? "Running" : "Paused"}</span>
    </div>
  </footer>;
}

function ChallengeDock() {
  const game = useGame((s) => s.game);
  const running = useGame((s) => s.running);
  const speed = useGame((s) => s.speed);
  const setRunning = useGame((s) => s.setRunning);
  const advance = useGame((s) => s.advance);
  const m = metrics(game);
  const management = game.phase === "management";
  const inc = game.phase === "incident" ? game.incident : null;
  const week = Math.min(game.turn, BALANCE.maxTurns);
  // Views appear once they have something to show, as on the desktop.
  const hasWork = game.tasks.length > 0 || game.releases.length > 0 || game.turn > 1;
  const tabs: ViewTab[] = [
    { id: "tech", label: "Tech", icon: "tree", badge: `${completedTechIds(game).length}/${TECH_ORDER.length}`, disabled: !!inc },
    ...(hasWork ? [{ id: "engineers", label: "Team", icon: "team", badge: `${m.freeEngineers} free`, disabled: !!inc } satisfies ViewTab] : []),
    ...(game.history.length > 0 ? [{ id: "history", label: "History", icon: "history", badge: game.postmortems.length > 0 ? String(game.postmortems.length) : null } satisfies ViewTab] : []),
  ];
  return <footer className="bottombar controls-dock phone-dock">
    <DockViews tabs={tabs} mode="challenge" />
    <RoomControlsSlot />
    <div className="time-controls" role="group" aria-label="Time">
      <div className={`week phone-clock${inc ? " is-incident" : ""}`}>
        {inc ? <>
          <span className="brand-week"><Icon name="incident" size={14} /><span>Incident</span></span>
          <span className="dock-second"><strong>{clock(inc.elapsed)}</strong></span>
        </> : <>
          <span className="brand-week"><Icon name="week" size={14} /><span>Week <strong>{week}</strong></span></span>
          <span className="dock-second">of {BALANCE.maxTurns}</span>
          <Meter value={week / BALANCE.maxTurns} label="Weeks played" />
        </>}
      </div>
      <TimeMenu automatic={management} />
      <button type="button" className="btn btn-primary advance dock-primary" disabled={!management && !inc} onClick={inc ? () => setRunning(!running) : advance}
        aria-label={inc ? (running ? "Pause the incident clock" : "Resume the incident clock") : undefined}>
        {management && running && <span key={`${game.turn}-${speed}`} className="advance-timer" style={{ animationDuration: `${AUTO_SECONDS / speed}s` }} />}
        <Icon name={inc ? (running ? "pause" : "play") : "next"} />
        <span className="advance-label">{inc ? (running ? "Pause" : "Resume") : game.phase === "ended" ? "Run over" : "Next week"}</span>
      </button>
    </div>
  </footer>;
}
