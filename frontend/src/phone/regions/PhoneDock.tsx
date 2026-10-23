import { useSyncExternalStore } from "react";
import { BALANCE, completedTechIds, metrics, TECH_ORDER } from "@/sim";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
import { pendingStop } from "@/sim/step";
import { clock } from "@/game/format";
import { campaignClockAvailable, useGame, walkthroughHoldsClock } from "@/game/store";
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
 * Guided Mode's +1s and +5s steps live in the speed menu with the speeds. Where the views do not fit beside the
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
  guided: { 2: 360 },
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

/** Manual steps beside the speeds: one game second to watch a decision land, five to see a trend. */
const STEPS = [{ count: 1, icon: "step" }, { count: 5, icon: "stepMany" }] as const;

function GuidedDock() {
  const game = useGame((s) => s.game);
  const running = useGame((s) => s.running);
  const setRunning = useGame((s) => s.setRunning);
  const stepSeconds = useGame((s) => s.stepSeconds);
  const held = useGame(walkthroughHoldsClock);
  const steppable = useGame(campaignClockAvailable);
  const started = useGame((s) => s.started);
  const c = game.campaign!;
  const incident = game.phase === "incident";
  const active = started && !held && pendingStop(c) === null && !(c.openingMilestone && !c.openingMilestone.acknowledged) && (game.phase === "management" || incident);
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
      <TimeMenu>
        <h3 className="phone-steps-title">Step time</h3>
        <div className="dock-steps" role="group" aria-label="Step time">
          {STEPS.map(({ count, icon }) => <button type="button" key={count} className="dock-step" aria-label={`Step ${count} game ${count === 1 ? "second" : "seconds"}`}
            {...tipProps(held ? "Finish the walkthrough to run the company" : `Pause and advance exactly ${count} game ${count === 1 ? "second" : "seconds"}${count === 1 ? " (N)" : ""}`)}
            disabled={!steppable} onClick={() => stepSeconds(count)}><Icon name={icon} size={18} /><span>+{count}s</span></button>)}
        </div>
      </TimeMenu>
      <button type="button" className={`btn btn-primary campaign-play dock-primary${running ? " is-on" : ""}`} aria-label={running ? "Pause" : "Run"}
        {...tipProps(held ? "Finish the walkthrough to run the company" : "Run or pause the company (P)")} disabled={!active} onClick={() => setRunning(!running)}>
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
