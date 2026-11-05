"use client";
import { CampaignAttentionHost } from "./CampaignAttention";
import { RoomControlsHost, RoomControlsSlot } from "./RoomControlsHost";
import { CampaignHeader, CampaignPanel, CampaignControls, CampaignOverlays } from "./CampaignUI";
import { PendingDeployments } from "./PendingDeployments";
import { AutoscaleCallout } from "./AutoscaleCallout";
import "./ControlsDock.css";

import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { completedTechIds, metrics, TECH_ORDER, userGoal, weekLimit } from "@/sim";
import { clock, compact, money, num, signedMoney, uptimePct } from "@/game/format";
import { useGame } from "@/game/store";
import { Icon } from "./icons";
import { healthOf } from "./health";
import { usersGoalTip } from "./presentation";
import { SoundButton } from "./SoundButton";
import { AppProfileButton, AppProfilePicker } from "./AppProfile";
import { tipProps } from "./tips";
import { EndReport, HowToPlay, Menu, PostmortemModal } from "./Modals";
import { HomeScreen } from "./HomeScreen";
import InspectionReveal from "./InspectionReveal";
import MachineAlerts from "./MachineAlerts";
import SidePanel from "./SidePanel";
import TechTree from "./TechTree";
import Tutorial from "./Tutorial";
import { Callout, Meter, Stat } from "./ui";
import { EngineersView, HistoryView } from "./Views";
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
  const goal = userGoal(game);

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
        <Stat icon="users" kind="users" label="Users" tip={usersGoalTip(game)}>
          <strong>{num(game.users)}</strong>
          {goal !== null && (
            <span className="stat-goal">
              <Meter value={game.users / goal} label={`Progress to ${num(goal)} users`} />
              <Icon name="goal" size={12} />
              <span className="muted">{compact(goal)}</span>
            </span>
          )}
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

      <AppProfileButton />
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
  // Past the Series A there is no last week: the count runs on and the strip of weeks left goes.
  const limit = weekLimit(game);
  const week = limit === null ? game.turn : Math.min(game.turn, limit);
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
            Week <strong>{week}</strong>{limit !== null && `/${limit}`}
          </>
        )}</span>
      </span>
      {limit !== null && (
        <span className="week-track" aria-hidden="true">
          {Array.from({ length: limit }, (_, i) => (
            <i key={i} className={i + 1 < week ? "is-past" : i + 1 === week ? "is-now" : ""} />
          ))}
        </span>
      )}
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
      <div className="time-controls" role="group" aria-label="Time">
        <WeekClock />
        <TimeMenu automatic={management} />
        <button type="button" className={`btn btn-primary advance dock-primary${incident ? (running ? " is-running" : " is-paused") : ""}`} disabled={!management && !incident} onClick={incident ? () => setRunning(!running) : advance} aria-label={incident ? (running ? "Pause the incident clock" : "Resume the incident clock") : undefined}>
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

/** The dialog open on top, watched only while `watching`. */
function useOpenModal(watching: boolean) {
  const [modal, setModal] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!watching) return;
    const find = () => setModal(Array.from(document.querySelectorAll<HTMLElement>(".modal")).at(-1) ?? null);
    find();
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); setModal(null); };
  }, [watching]);
  return watching ? modal : null;
}

export function ToastHost() {
  const toast = useGame((s) => s.toast);
  const dismiss = useGame((s) => s.dismissToast);
  // Over an open dialog the toast is in it, as screen readers hear nothing outside it. A dialog reaching down to where
  // the toast floats takes it as its last row instead, as compact as its own messages, so it covers none of the
  // dialog's actions; later toasts take the same row. The row stays until it is pressed, replaced or its dialog closes:
  // leaving on a timer would move the actions back under the pointer, and a repeated note, such as an autosave failing
  // every ten seconds, would move them each time.
  const modal = useOpenModal(!!toast), note = useRef<HTMLDivElement>(null);
  const [joined, setJoined] = useState<HTMLElement | null>(null);
  const inline = !!modal && joined === modal;
  useEffect(() => {
    if (!toast || inline) return;
    const t = window.setTimeout(dismiss, toast.kind === "error" ? 5200 : 2800);
    return () => window.clearTimeout(t);
  }, [toast, dismiss, inline]);
  // A row goes with its dialog rather than floating on over what is left.
  const host = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (inline) host.current = modal;
    else if (host.current) { host.current = null; if (toast) dismiss(); }
  }, [inline, modal, toast, dismiss]);
  useLayoutEffect(() => {
    const el = note.current;
    setJoined(modal && el && modal.getBoundingClientRect().bottom > innerHeight - parseFloat(getComputedStyle(el).bottom) - el.offsetHeight ? modal : null);
  }, [modal, toast]);
  useLayoutEffect(() => {
    // The row takes its room from the dialog's scrolling body, which must not hide the control just pressed.
    const active = document.activeElement;
    if (inline && active instanceof HTMLElement && modal?.contains(active)) active.scrollIntoView({ block: "nearest" });
  }, [inline, modal, toast]);
  if (!toast) return null;
  const body = (
    <div ref={note} className={`toast${inline ? " toast-inline" : ""}`} onClick={dismiss}>
      <Callout
        compact={inline}
        tone={toast.kind === "error" ? "critical" : toast.kind === "success" ? "success" : "info"}
        icon={toast.milestone ? "goal" : toast.kind === "error" ? "alert" : toast.kind === "success" ? "check" : "info"}
        kicker={toast.milestone ? "Milestone" : toast.kind === "error" ? "Problem" : toast.kind === "success" ? "Done" : "Note"}
        live={toast.kind === "error" ? "alert" : "status"}
      >
        {toast.text}
      </Callout>
    </div>
  );
  return modal ? createPortal(body, modal) : body;
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
      <main className="stage">
        <Room />
      </main>
      {campaign ? <>{started && <><CampaignPanel /><PendingDeployments /><AutoscaleCallout /></>}<CampaignControls /><CampaignOverlays /></> : <><MachineAlerts /><SidePanel /><ClassicViewSheet /><BottomBar /></>}
      <ToastHost />
      {!campaign && !started && <HomeScreen />}
      {!campaign && started && view === "menu" && <Menu />}
      {!campaign && started && onboarding && <HowToPlay />}
      {!campaign && <AppProfilePicker />}
      {started && <Tutorial />}
      {started && <InspectionReveal />}
      {!campaign && started && phase === "review" && <PostmortemModal />}
      {!campaign && started && phase === "ended" && <EndReport />}
    </div></CampaignAttentionHost></RoomControlsHost>
  );
}
