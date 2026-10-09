"use client";
import { CampaignHeader, CampaignPanel, CampaignControls, CampaignOverlays } from "./CampaignUI";

import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { BALANCE, completedTechIds, currentWarnings, metrics, TECH_ORDER, type GameState } from "@/sim";
import { nextMove } from "@/game/advisor";
import { clock, compact, money, moneyFull, num, signedMoney, uptimePct } from "@/game/format";
import { useGame, type Speed, type View } from "@/game/store";
import { Icon, type IconName } from "./icons";
import { EndReport, HowToPlay, Menu, PostmortemModal, TitleScreen } from "./Modals";
import SidePanel from "./SidePanel";
import TechTree from "./TechTree";
import Tutorial, { BASICS_STEPS } from "./Tutorial";
import { Callout, Concept, Meter, Tip, type ConceptKind } from "./ui";
import { EngineersView, HistoryView } from "./Views";

// Keep the WebGL scene in its own chunk; Vite renders this app in the browser.
const Facility = lazy(() => import("./scene/Facility"));

const AUTO_SECONDS = 6;
const TICK_MS = 200;

/* ------------------------------------------------------------------ */
/* Top bar: four numbers                                               */
/* ------------------------------------------------------------------ */

function healthOf(game: GameState): { word: string; tone: "ok" | "warn" | "critical"; icon: IconName } {
  if (game.phase === "incident") return { word: "Incident", tone: "critical", icon: "incident" };
  const m = metrics(game);
  const worst = Math.max(m.appUtil, m.dbUtil);
  const faults = game.infra.dbHost.status !== "healthy" || game.infra.appHosts.some((h) => h.status !== "healthy");
  if (worst >= 1 || game.live.shed > 0) return { word: "Degraded", tone: "critical", icon: "fire" };
  if (worst >= 0.85 || faults) return { word: "At risk", tone: "warn", icon: "alert" };
  return { word: "Healthy", tone: "ok", icon: "health" };
}

function Stat({ icon, kind, label, tip, children, side }: { icon: IconName; kind: ConceptKind; label: string; tip: string; children: ReactNode; side?: "left" }) {
  return (
    <div className={`stat stat-${kind}`}>
      <span className="stat-icon">
        <Concept kind={kind} icon={icon} />
      </span>
      <div className="stat-body">
        <Tip text={tip} side={side}>
          {label}
        </Tip>
        {children}
      </div>
    </div>
  );
}

function TopBar() {
  const game = useGame((s) => s.game);
  const openView = useGame((s) => s.openView);
  const m = metrics(game);
  const health = healthOf(game);
  const inc = game.phase === "incident" ? game.incident : null;
  const week = Math.min(game.turn, BALANCE.maxTurns);

  return (
    <header className={`topbar${inc ? " is-incident" : ""}`}>
      <div className="brand">
        <span className="brand-mark">99.99%</span>
        <div className="week">
          <span className="brand-week">
            <Icon name={inc ? "incident" : "week"} size={16} />
            {inc ? (
              <>
                Incident <strong>{clock(inc.elapsed)}</strong>
              </>
            ) : (
              <>
                Week <strong>{week}</strong>/{BALANCE.maxTurns}
              </>
            )}
          </span>
          <span className="week-track" aria-hidden="true">
            {Array.from({ length: BALANCE.maxTurns }, (_, i) => (
              <i key={i} className={i + 1 < week ? "is-past" : i + 1 === week ? "is-now" : ""} />
            ))}
          </span>
        </div>
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
          side="left"
          tip="Uptime is the share of requests served across the whole run. 99.99% allows about 26 minutes of downtime in this campaign."
        >
          <strong>{health.word}</strong>
          <span className="muted">{uptimePct(m.uptime)}</span>
        </Stat>
      </div>

      <button type="button" className="icon-btn menu-btn" onClick={() => openView("menu")} aria-label="Menu" title="Menu">
        <Icon name="menu" />
      </button>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Stage prompts: one suggested move, and at most two warnings         */
/* ------------------------------------------------------------------ */

/** Each warning wears the icon of the thing it is about. */
const WARNING_ICON: Record<string, IconName> = {
  surge_incoming: "revenue",
  app_hot: "server",
  db_hot: "database",
  host_degraded: "skull",
  debt_high: "debt",
  runway_low: "cash",
  release_waiting: "ship",
  unassigned_work: "wrench",
  idle_engineers: "team",
};

function StageHud() {
  const game = useGame((s) => s.game);
  const tour = useGame((s) => s.tour);
  const select = useGame((s) => s.select);
  const openView = useGame((s) => s.openView);
  if (game.phase !== "management") return null;
  // The walkthrough introduces this prompt in its last step; before that it would compete with it.
  if (tour?.track === "basics" && tour.step < BASICS_STEPS - 1) return null;

  const move = nextMove(game);
  const alerts = currentWarnings(game)
    .filter((w) => w.level !== "notice" && w.text !== move.text)
    .slice(0, 2);

  return (
    <div className="hud">
      <Callout
        className="next-chip"
        tone={move.tone === "go" ? "info" : move.tone}
        icon="robot"
        kicker="Next move"
        action={
          move.cta && (
            <button type="button" className="btn btn-primary btn-small" onClick={move.cta.run}>
              {move.cta.label}
              {move.cta.price !== undefined && (
                <span className="price">
                  <Icon name="cash" size={12} />
                  {moneyFull(move.cta.price)}
                </span>
              )}
            </button>
          )
        }
      >
        {move.text}
      </Callout>
      {alerts.map((w, i) => (
        <Callout
          key={w.code + i}
          className="alert-chip"
          tone={w.level === "critical" ? "critical" : "warn"}
          icon={WARNING_ICON[w.code] ?? "alert"}
          kicker={w.level === "critical" ? "Critical" : "Warning"}
          title={w.detail}
          onClick={() => (w.equipment ? select(w.equipment) : openView("history"))}
        >
          {w.text}
        </Callout>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bottom controls                                                     */
/* ------------------------------------------------------------------ */

const SPEEDS: Speed[] = [0.5, 1, 2];

function BottomBar() {
  const game = useGame((s) => s.game);
  const view = useGame((s) => s.view);
  const running = useGame((s) => s.running);
  const speed = useGame((s) => s.speed);
  const openView = useGame((s) => s.openView);
  const setRunning = useGame((s) => s.setRunning);
  const setSpeed = useGame((s) => s.setSpeed);
  const advance = useGame((s) => s.advance);
  const m = metrics(game);
  const management = game.phase === "management";
  const incident = game.phase === "incident";

  // Controls appear once they have something to control.
  const hasWork = game.tasks.length > 0 || game.releases.length > 0 || game.turn > 1;
  const hasPast = game.history.length > 0;
  const showTime = incident || game.turn > 1;

  const toggle = (v: Exclude<View, null>) => openView(view === v ? null : v);
  const tabs: [Exclude<View, null>, string, IconName, string | null, boolean][] = [
    ["tech", "Tech", "tree", `${completedTechIds(game).length}/${TECH_ORDER.length}`, true],
    ["engineers", "Team", "team", `${m.freeEngineers} free`, hasWork],
    ["history", "History", "history", game.postmortems.length > 0 ? String(game.postmortems.length) : null, hasPast],
  ];

  return (
    <footer className="bottombar">
      <nav className="view-tabs" aria-label="Views">
        {tabs
          .filter((t) => t[4])
          .map(([id, label, icon, badge]) => (
            <button type="button" key={id} data-view={id} className={view === id ? "is-active" : ""} aria-pressed={view === id} aria-label={label} title={label} disabled={incident && id !== "history"} onClick={() => toggle(id)}>
              <span className="tab-icon" aria-hidden="true">
                <Icon name={icon} />
              </span>
              <span className="tab-label">{label}</span>
              {badge && <span className="badge">{badge}</span>}
            </button>
          ))}
      </nav>

      <div className="time-controls">
        {showTime && (
          <>
            <button
              type="button"
              className={`icon-btn${running ? " is-on" : ""}`}
              onClick={() => setRunning(!running)}
              aria-label={incident ? (running ? "Pause the incident clock" : "Resume the incident clock") : running ? "Stop auto-advance" : "Auto-advance weeks"}
              title={incident ? "Pause or resume the clock (P)" : "Advance weeks automatically (P)"}
            >
              <Icon name={running ? "pause" : "play"} />
            </button>
            <div className="speed" role="group" aria-label="Game speed">
              {SPEEDS.map((s) => (
                <button type="button" key={s} className={speed === s ? "is-active" : ""} aria-pressed={speed === s} onClick={() => setSpeed(s)} title={`${s}× speed`}>
                  {s}×
                </button>
              ))}
            </div>
          </>
        )}
        <button type="button" className="btn btn-primary advance" disabled={!management} onClick={advance}>
          {management && running && <span key={`${game.turn}-${speed}`} className="advance-timer" style={{ animationDuration: `${AUTO_SECONDS / speed}s` }} />}
          <span className="advance-label">{incident ? "Incident" : game.phase === "ended" ? "Run over" : "Next week"}</span>
          <Icon name="next" />
        </button>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Overlay views                                                       */
/* ------------------------------------------------------------------ */

const VIEW_TITLES: Record<Exclude<View, null | "menu">, string> = { tech: "Tech tree", engineers: "Team", history: "History" };
const VIEW_ICONS: Record<Exclude<View, null | "menu">, [ConceptKind, IconName]> = {
  tech: ["tech", "tree"],
  engineers: ["team", "team"],
  history: ["users", "history"],
};

function ViewSheet() {
  const view = useGame((s) => s.view);
  const openView = useGame((s) => s.openView);
  if (!view || view === "menu") return null;
  return (
    <section className={`sheet sheet-${view}`} aria-label={VIEW_TITLES[view]}>
      <header className="sheet-head">
        <h2>
          <Concept kind={VIEW_ICONS[view][0]} icon={VIEW_ICONS[view][1]} />
          {VIEW_TITLES[view]}
        </h2>
        <button type="button" className="icon-btn" onClick={() => openView(null)} aria-label="Close">
          <Icon name="close" />
        </button>
      </header>
      <div className="sheet-body">
        {view === "tech" && <TechTree />}
        {view === "engineers" && <EngineersView />}
        {view === "history" && <HistoryView />}
      </div>
    </section>
  );
}

function ToastHost() {
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

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

export default function Game() {
  const campaign = useGame((s) => !!s.game.campaign);
  const ready = useGame((s) => s.ready);
  const started = useGame((s) => s.started);
  const phase = useGame((s) => s.game.phase);
  const turn = useGame((s) => s.game.turn);
  const running = useGame((s) => s.running);
  const speed = useGame((s) => s.speed);
  const view = useGame((s) => s.view);
  const onboarding = useGame((s) => s.onboarding);
  const touring = useGame((s) => s.tour?.track ?? null);

  useEffect(() => {
    useGame.getState().boot();
  }, []);

  // Crisis clock.
  useEffect(() => {
    if ((!campaign && phase !== "incident") || !running || !started) return;
    const id = window.setInterval(() => useGame.getState().tick(TICK_MS / 1000), TICK_MS);
    return () => window.clearInterval(id);
  }, [campaign, phase, running, started]);

  // Auto-advance during management.
  useEffect(() => {
    if (campaign || phase !== "management" || !running || onboarding || view || touring || !started) return;
    const id = window.setTimeout(() => useGame.getState().advance(), (AUTO_SECONDS * 1000) / speed);
    return () => window.clearTimeout(id);
  }, [campaign, phase, running, speed, turn, onboarding, view, touring, started]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const s = useGame.getState();
      if (!s.started) return;
      if (e.key === "Escape") {
        if (s.view) s.openView(null);
        else if (s.selected && s.game.phase !== "incident") s.select(null);
      } else if (e.key === "p" || e.key === "P") {
        if (s.game.phase === "incident" || s.game.phase === "management") s.setRunning(!s.running);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const hidden=()=>{if(document.hidden)useGame.getState().setRunning(false);};
    document.addEventListener("visibilitychange",hidden);
    return ()=>document.removeEventListener("visibilitychange",hidden);
  }, []);
  if (!ready) {
    return (
      <main className="boot">
        <span className="brand-mark">99.99%</span>
      </main>
    );
  }

  return (
    <div className={`app phase-${phase}${touring ? ` is-touring tour-${touring}` : ""}${started ? "" : " is-title"}`}>
      {campaign ? <CampaignHeader /> : <TopBar />}
      <main className="stage">
        <Suspense fallback={<div className="stage-loading">Loading…</div>}>
          <Facility />
        </Suspense>
        {started && !campaign && <StageHud />}
      </main>
      {campaign ? <>{started && <CampaignPanel />}<CampaignControls /><CampaignOverlays /></> : <><SidePanel /><ViewSheet /><BottomBar /></>}
      <ToastHost />
      {!campaign && !started && <TitleScreen />}
      {!campaign && started && view === "menu" && <Menu />}
      {!campaign && started && onboarding && <HowToPlay />}
      {!campaign && started && <Tutorial />}
      {!campaign && started && phase === "review" && <PostmortemModal />}
      {!campaign && started && phase === "ended" && <EndReport />}
    </div>
  );
}
