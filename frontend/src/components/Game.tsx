"use client";
import { CampaignAttentionHost } from "./CampaignAttention";
import { RoomControlsHost, RoomControlsSlot } from "./RoomControlsHost";
import { CampaignHeader, CampaignPanel, CampaignControls, CampaignOverlays } from "./CampaignUI";
import "./ControlsDock.css";

import { lazy, Suspense, useEffect } from "react";
import { BALANCE, completedTechIds, metrics, TECH_ORDER } from "@/sim";
import { clock, compact, money, num, signedMoney, uptimePct } from "@/game/format";
import { useGame } from "@/game/store";
import { Icon } from "./icons";
import { healthOf } from "./health";
import { SoundButton } from "./SoundButton";
import { tipProps } from "./tips";
import { EndReport, HowToPlay, Menu, PostmortemModal } from "./Modals";
import { HomeScreen } from "./HomeScreen";
import InspectionReveal from "./InspectionReveal";
import SidePanel from "./SidePanel";
import TechTree from "./TechTree";
import Tutorial from "./Tutorial";
import { Callout, Meter, Stat } from "./ui";
import { EngineersView, HistoryView } from "./Views";
import OperationsRail from "./OperationsRail";
import { ViewSheet, ViewTabs, type ViewTab } from "./ViewSheet";
import { TimeMenu } from "./TimeMenu";
import { AUTO_SECONDS, useAppClassName, useGameRuntime } from "./useGameRuntime";

// Keep the WebGL scene in its own chunk; Vite renders this app in the browser.
const Facility = lazy(() => import("./scene/Facility"));

/** The 3D room, loaded in its own chunk. Every edition's shell shows it in its `main.stage`. */
export function Room() {
  return (
    <Suspense fallback={<div className="stage-loading">Loading…</div>}>
      <Facility />
    </Suspense>
  );
}

/* ------------------------------------------------------------------ */
/* Top bar: four numbers                                               */
/* ------------------------------------------------------------------ */

export function TopBar() {
  const game = useGame((s) => s.game);
  const openView = useGame((s) => s.openView);
  const m = metrics(game);
  const health = healthOf(game);
  const inc = game.phase === "incident" ? game.incident : null;

  return (
    <header className={`topbar${inc ? " is-incident" : ""}`}>
      <div className="brand">
        <span className="brand-mark">99.99%</span>
      </div>

      <div className="stats-strip">
        <Stat icon="cash" kind="cash" label="Cash" tip={`Revenue comes in and ${money(m.costs.total)} of costs go out each week. Below zero, you are bankrupt.`}>
          <strong className={game.cash < 10_000 ? "text-critical" : ""}>{money(game.cash)}</strong>
          <span className={m.net >= 0 ? "text-ok" : "text-warn"}>{signedMoney(m.net)}/wk</span>
        </Stat>
        <Stat icon="users" kind="users" label="Users" tip={`Your goal: ${num(BALANCE.targetUsers)} by week ${BALANCE.maxTurns}. Every user adds traffic.`}>
          <strong>{num(game.users)}</strong>
          <span className="stat-goal">
            <Meter value={game.users / BALANCE.targetUsers} label="Progress to the user goal" />
            <Icon name="goal" size={12} />
            <span className="muted">{compact(BALANCE.targetUsers)}</span>
          </span>
        </Stat>
        <Stat icon="revenue" kind="revenue" label="Revenue" tip="Earned from customers each week. It drops when the service is failing.">
          <strong>{money(m.revenue)}</strong>
          <span className="muted">/wk</span>
        </Stat>
        <Stat
          icon={health.icon}
          kind={health.tone === "ok" ? "health" : health.tone}
          label="Health"
          tip="Uptime is the share of requests served across the whole run. 99.99% allows about 26 minutes of downtime in this company."
        >
          <strong>{health.word}</strong>
          <span className="muted">{uptimePct(m.uptime)}</span>
        </Stat>
      </div>

      <SoundButton />
      <button type="button" className="icon-btn menu-btn" onClick={() => openView("menu")} aria-label="Menu" {...tipProps("Menu")}>
        <Icon name="menu" />
      </button>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Bottom controls                                                     */
/* ------------------------------------------------------------------ */

/** Which week it is, or how long the incident has run: kept beside the controls that move it on. */
function WeekClock() {
  const game = useGame((s) => s.game);
  const inc = game.phase === "incident" ? game.incident : null;
  const week = Math.min(game.turn, BALANCE.maxTurns);
  return (
    <div className={`week${inc ? " is-incident" : ""}`}>
      <span className="brand-week">
        <Icon name={inc ? "incident" : "week"} size={16} />
        <span>{inc ? (
          <>
            Incident <strong>{clock(inc.elapsed)}</strong>
          </>
        ) : (
          <>
            Week <strong>{week}</strong>/{BALANCE.maxTurns}
          </>
        )}</span>
      </span>
      <span className="week-track" aria-hidden="true">
        {Array.from({ length: BALANCE.maxTurns }, (_, i) => (
          <i key={i} className={i + 1 < week ? "is-past" : i + 1 === week ? "is-now" : ""} />
        ))}
      </span>
    </div>
  );
}

export function BottomBar() {
  const game = useGame((s) => s.game);
  const running = useGame((s) => s.running);
  const speed = useGame((s) => s.speed);
  const setRunning = useGame((s) => s.setRunning);
  const advance = useGame((s) => s.advance);
  const m = metrics(game);
  const management = game.phase === "management";
  const incident = game.phase === "incident";

  // Controls appear once they have something to control.
  const hasWork = game.tasks.length > 0 || game.releases.length > 0 || game.turn > 1;
  const hasPast = game.history.length > 0;

  return (
    <footer className="bottombar controls-dock">
      <ViewTabs
        tabs={[
          { id: "tech", label: "Tech", icon: "tree", badge: `${completedTechIds(game).length}/${TECH_ORDER.length}`, disabled: incident },
          ...(hasWork ? [{ id: "engineers", label: "Team", icon: "team", badge: `${m.freeEngineers} free`, disabled: incident } satisfies ViewTab] : []),
          ...(hasPast ? [{ id: "history", label: "History", icon: "history", badge: game.postmortems.length > 0 ? String(game.postmortems.length) : null } satisfies ViewTab] : []),
        ]}
      />

      <RoomControlsSlot />
      <div className="time-controls" role="group" aria-label="Time" data-label="Time">
        <WeekClock />
        <TimeMenu automatic={management} />
        <button type="button" className="btn btn-primary advance dock-primary" disabled={!management && !incident} onClick={incident ? () => setRunning(!running) : advance} aria-label={incident ? (running ? "Pause the incident clock" : "Resume the incident clock") : undefined}>
          {management && running && <span key={`${game.turn}-${speed}`} className="advance-timer" style={{ animationDuration: `${AUTO_SECONDS / speed}s` }} />}
          <Icon name={incident ? (running ? "pause" : "play") : "next"} />
          <span className="advance-label">{incident ? (running ? "Pause" : "Resume") : game.phase === "ended" ? "Run over" : "Next week"}</span>
        </button>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Overlay views                                                       */
/* ------------------------------------------------------------------ */

export function ClassicViewSheet() {
  const view = useGame((s) => s.view);
  if (!view || view === "menu" || view === "guidance" || view === "scorecard") return null;
  return (
    <ViewSheet view={view}>
      {view === "tech" && <TechTree />}
      {view === "engineers" && <EngineersView />}
      {view === "history" && <HistoryView />}
    </ViewSheet>
  );
}

export function ToastHost() {
  const toast = useGame((s) => s.toast);
  const dismiss = useGame((s) => s.dismissToast);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(dismiss, toast.kind === "error" ? 5200 : 2800);
    return () => window.clearTimeout(t);
  }, [toast, dismiss]);
  if (!toast) return null;
  return (
    <div className="toast" onClick={dismiss}>
      <Callout
        tone={toast.kind === "error" ? "critical" : toast.kind === "success" ? "success" : "info"}
        icon={toast.kind === "error" ? "alert" : toast.kind === "success" ? "check" : "info"}
        kicker={toast.kind === "error" ? "Problem" : toast.kind === "success" ? "Done" : "Note"}
        live={toast.kind === "error" ? "alert" : "status"}
      >
        {toast.text}
      </Callout>
    </div>
  );
}

/** The boot screen, shown until the store has loaded the saved settings and game. */
export function BootScreen() {
  return (
    <main className="boot">
      <span className="brand-mark">99.99%</span>
    </main>
  );
}

/** The desktop edition's shell. The phone edition has its own (see src/phone). */
export default function Game() {
  const campaign = useGame((s) => !!s.game.campaign);
  const ready = useGame((s) => s.ready);
  const started = useGame((s) => s.started);
  const phase = useGame((s) => s.game.phase);
  const view = useGame((s) => s.view);
  const onboarding = useGame((s) => s.onboarding);
  const className = useAppClassName();
  useGameRuntime();

  if (!ready) return <BootScreen />;

  return (
    <RoomControlsHost><CampaignAttentionHost><div className={className}>
      {campaign ? <CampaignHeader /> : <TopBar />}
      {started && !campaign && <OperationsRail />}
      <main className="stage">
        <Room />
      </main>
      {campaign ? <>{started && <CampaignPanel />}<CampaignControls /><CampaignOverlays /></> : <><SidePanel /><ClassicViewSheet /><BottomBar /></>}
      <ToastHost />
      {!campaign && !started && <HomeScreen />}
      {!campaign && started && view === "menu" && <Menu />}
      {!campaign && started && onboarding && <HowToPlay />}
      {started && <Tutorial />}
      {started && <InspectionReveal />}
      {!campaign && started && phase === "review" && <PostmortemModal />}
      {!campaign && started && phase === "ended" && <EndReport />}
    </div></CampaignAttentionHost></RoomControlsHost>
  );
}
