"use client";
import { CampaignHeader, CampaignPanel, CampaignControls, CampaignOverlays } from "./CampaignUI";

import { lazy, Suspense, useEffect, useRef } from "react";
import { BALANCE, completedTechIds, metrics, TECH_ORDER, type GameState } from "@/sim";
import { clock, compact, money, num, signedMoney, uptimePct } from "@/game/format";
import { watchCues } from "@/game/cues";
import { createAmbience } from "@/game/ambience";
import { createMusic, type Music } from "@/game/music";
import type { AudioSettings } from "@/game/persist";
import { createSfx } from "@/game/sfx";
import { useGame, type Speed } from "@/game/store";
import { Icon, type IconName } from "./icons";
import { daylightNow } from "./scene/dayClock";
import { SoundButton } from "./SoundButton";
import { tipProps } from "./tips";
import { EndReport, HowToPlay, Menu, PostmortemModal } from "./Modals";
import { HomeScreen } from "./HomeScreen";
import SidePanel from "./SidePanel";
import TechTree from "./TechTree";
import Tutorial from "./Tutorial";
import { Callout, Meter, Stat } from "./ui";
import { EngineersView, HistoryView } from "./Views";
import OperationsRail from "./OperationsRail";
import { ViewSheet, ViewTabs, type ViewTab } from "./ViewSheet";

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

function TopBar() {
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
          tip="Uptime is the share of requests served across the whole run. 99.99% allows about 26 minutes of downtime in this campaign."
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

const SPEEDS: Speed[] = [0.5, 1, 2];

/** Which week it is, or how long the incident has run: kept beside the controls that move it on. */
function WeekClock() {
  const game = useGame((s) => s.game);
  const inc = game.phase === "incident" ? game.incident : null;
  const week = Math.min(game.turn, BALANCE.maxTurns);
  return (
    <div className={`week${inc ? " is-incident" : ""}`}>
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
  );
}

function BottomBar() {
  const game = useGame((s) => s.game);
  const running = useGame((s) => s.running);
  const speed = useGame((s) => s.speed);
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

  return (
    <footer className="bottombar">
      <ViewTabs
        tabs={[
          { id: "tech", label: "Tech", icon: "tree", badge: `${completedTechIds(game).length}/${TECH_ORDER.length}`, disabled: incident },
          ...(hasWork ? [{ id: "engineers", label: "Team", icon: "team", badge: `${m.freeEngineers} free`, disabled: incident } satisfies ViewTab] : []),
          ...(hasPast ? [{ id: "history", label: "History", icon: "history", badge: game.postmortems.length > 0 ? String(game.postmortems.length) : null } satisfies ViewTab] : []),
        ]}
      />

      <div className="time-controls">
        <WeekClock />
        {showTime && (
          <>
            <button
              type="button"
              className={`icon-btn${running ? " is-on" : ""}`}
              onClick={() => setRunning(!running)}
              aria-label={incident ? (running ? "Pause the incident clock" : "Resume the incident clock") : running ? "Stop auto-advance" : "Auto-advance weeks"}
              {...tipProps(incident ? "Pause or resume the clock (P)" : "Advance weeks automatically (P)")}
            >
              <Icon name={running ? "pause" : "play"} />
            </button>
            <div className="speed" role="group" aria-label="Game speed">
              {SPEEDS.map((s) => (
                <button type="button" key={s} className={speed === s ? "is-active" : ""} aria-pressed={speed === s} onClick={() => setSpeed(s)} {...tipProps(`${s}× speed`)}>
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

function ClassicViewSheet() {
  const view = useGame((s) => s.view);
  if (!view || view === "menu") return null;
  return (
    <ViewSheet view={view}>
      {view === "tech" && <TechTree />}
      {view === "engineers" && <EngineersView />}
      {view === "history" && <HistoryView />}
    </ViewSheet>
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

const musicLevel = (a: AudioSettings) => (a.muted ? 0 : a.music);
const effectsLevel = (a: AudioSettings) => (a.muted ? 0 : a.effects);

/** Background music once a run is on screen: calm while building, tense during an incident. */
function useMusic(): void {
  const level = useGame((s) => musicLevel(s.audio));
  const started = useGame((s) => s.started);
  const incident = useGame((s) => s.game.phase === "incident");
  const music = useRef<Music | null>(null);
  useEffect(() => {
    const m = createMusic(() => musicLevel(useGame.getState().audio) > 0);
    music.current = m;
    return () => {
      m.dispose();
      music.current = null;
    };
  }, []);
  useEffect(() => music.current?.setVolume(level), [level]);
  useEffect(() => music.current?.setEnabled(started), [started]);
  useEffect(() => music.current?.setMood(incident ? "tense" : "calm"), [incident]);
}

/** How often the city's sound checks how dark it has got outside. */
const DUSK_CHECK_MS = 2000;

/**
 * The city outside, heard under the game while a run is on screen: birds by day, crickets at night, following the
 * same clock as the light (see scene/dayClock.ts). It goes with the sound-effects volume and mute.
 */
function useAmbience(): void {
  useEffect(() => {
    const a = createAmbience(() => effectsLevel(useGame.getState().audio) > 0);
    a.setVolume(effectsLevel(useGame.getState().audio));
    a.setDark(daylightNow().dark);
    const stopFollowing = useGame.subscribe((s, prev) => {
      if (s.audio !== prev.audio) a.setVolume(effectsLevel(s.audio));
      if (s.started !== prev.started) a.setEnabled(s.started);
    });
    a.setEnabled(useGame.getState().started);
    const id = window.setInterval(() => a.setDark(daylightNow().dark), DUSK_CHECK_MS);
    return () => {
      window.clearInterval(id);
      stopFollowing();
      a.dispose();
    };
  }, []);
}

/**
 * Sound effects for what just happened in the game. Driven by a store
 * subscription rather than renders, so the volume is already set when a cue
 * plays and nothing is heard twice under StrictMode.
 */
function useSoundEffects(): void {
  useEffect(() => {
    const sfx = createSfx(() => effectsLevel(useGame.getState().audio) > 0);
    sfx.setVolume(effectsLevel(useGame.getState().audio));
    const stopVolume = useGame.subscribe((s, prev) => {
      if (s.audio !== prev.audio) sfx.setVolume(effectsLevel(s.audio));
    });
    const stopCues = watchCues(useGame.subscribe, (cue) => sfx.play(cue));
    return () => {
      stopCues();
      stopVolume();
      sfx.dispose();
    };
  }, []);
}

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
  useMusic();
  useSoundEffects();
  useAmbience();

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
      if (!s.started || target?.closest('[role="dialog"]')) return;
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
  useEffect(() => {
    if(!campaign || !started)return;
    const record=()=>useGame.getState().measureTime();
    const id=window.setInterval(record,1000);
    const saveId=window.setInterval(()=>{const s=useGame.getState();if(s.started&&!document.hidden)s.saveNow(true);},10000);
    const boundary=()=>{record();useGame.getState().saveNow(true);};
    document.addEventListener("visibilitychange",boundary);
    window.addEventListener("pagehide",boundary);
    return ()=>{window.clearInterval(id);window.clearInterval(saveId);document.removeEventListener("visibilitychange",boundary);window.removeEventListener("pagehide",boundary);record();};
  },[campaign,started]);
  if (!ready) {
    return (
      <main className="boot">
        <span className="brand-mark">99.99%</span>
      </main>
    );
  }

  return (
    <div className={`app phase-${phase}${campaign && started ? " has-chapters" : ""}${touring ? ` is-touring tour-${touring}` : ""}${started ? "" : " is-title"}${started && !campaign ? " has-operations-rail" : ""}`}>
      {campaign ? <CampaignHeader /> : <TopBar />}
      {started && !campaign && <OperationsRail />}
      <main className="stage">
        <Suspense fallback={<div className="stage-loading">Loading…</div>}>
          <Facility />
        </Suspense>
      </main>
      {campaign ? <>{started && <CampaignPanel />}<CampaignControls /><CampaignOverlays /></> : <><SidePanel /><ClassicViewSheet /><BottomBar /></>}
      <ToastHost />
      {!campaign && !started && <HomeScreen />}
      {!campaign && started && view === "menu" && <Menu />}
      {!campaign && started && onboarding && <HowToPlay />}
      {!campaign && started && <Tutorial />}
      {!campaign && started && phase === "review" && <PostmortemModal />}
      {!campaign && started && phase === "ended" && <EndReport />}
    </div>
  );
}
