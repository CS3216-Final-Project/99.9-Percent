"use client";
import { RoomControlsHost, RoomControlsSlot } from "./RoomControlsHost";
import { CampaignHeader, CampaignPanel, CampaignControls, CampaignOverlays } from "./CampaignUI";
import "./ControlsDock.css";

import { lazy, Suspense, useEffect, useRef } from "react";
import { BALANCE, completedTechIds, metrics, TECH_ORDER, type GameState } from "@/sim";
import { clock, compact, money, num, signedMoney, uptimePct } from "@/game/format";
import { watchCues } from "@/game/cues";
import { createAmbience } from "@/game/ambience";
import { createMusic, type Music } from "@/game/music";
import type { AudioSettings } from "@/game/persist";
import { createSfx } from "@/game/sfx";
import { useGame } from "@/game/store";
import { fromAvatar } from "@/game/viewpoints";
import { Icon, type IconName } from "./icons";
import { daylightNow } from "./scene/dayClock";
import { entryGap, nextGap, viewFocus, ZONE_SOUNDS, zoneLevel, type ZoneSound } from "./scene/zoneSounds";
import { DOORS, FLOOR_Y, RIDE_SECONDS } from "./scene/levels";
import { onRide, ride } from "./scene/ride";
import { onSceneSound } from "./scene/sceneSounds";
import { buildModel } from "./scene/sceneModel";
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

function BottomBar() {
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

function ClassicViewSheet() {
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
/** How often the zones' sounds check whether they are due, in milliseconds. */
const ZONE_TICK_MS = 200;

/**
 * How loud the server hall's fans and hum are, 0 to 1: silent with the office in view, and on the server floor from
 * a steady hum when the servers idle to the full whir under load.
 */
function hallLevel(s: ReturnType<typeof useGame.getState>): number {
  if (s.floor !== "servers") return 0;
  const load = Math.min(1, Math.max(0, (buildModel(s.game).flow - 0.25) / 0.75));
  return 0.55 + 0.45 * load;
}

/**
 * The city outside, heard under the game while a run is on screen: birds by day, crickets at night, following the
 * same clock as the light (see scene/dayClock.ts). On the server floor the hall's fans take over. It goes with the
 * sound-effects volume and mute.
 */
function useAmbience(): void {
  useEffect(() => {
    const a = createAmbience(() => effectsLevel(useGame.getState().audio) > 0);
    a.setVolume(effectsLevel(useGame.getState().audio));
    a.setDark(daylightNow().dark);
    a.setHall(hallLevel(useGame.getState()), 0);
    const stopFollowing = useGame.subscribe((s, prev) => {
      if (s.audio !== prev.audio) a.setVolume(effectsLevel(s.audio));
      if (s.started !== prev.started) a.setEnabled(s.started);
      // Crossfade over the elevator's ride.
      if (s.floor !== prev.floor) a.setHall(hallLevel(s), RIDE_SECONDS);
    });
    a.setEnabled(useGame.getState().started);
    const id = window.setInterval(() => {
      a.setDark(daylightNow().dark);
      a.setHall(hallLevel(useGame.getState()), 2);
    }, DUSK_CHECK_MS);
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
    // The elevator: a click and the car's hum as it sets off, then the chime and the doors as it arrives.
    // Footsteps and doors, while the audio is already playing; a new avatar's pop answers the player's own choice.
    const stopScene = onSceneSound((cue, level) => sfx.playScene(cue, level));
    const stopAvatar = useGame.subscribe((s, prev) => {
      if (s.avatar !== prev.avatar) sfx.playScene("pop", 0.9, true);
    });
    const stopRide = onRide((event) => {
      const up = FLOOR_Y[ride.to] > FLOOR_Y[ride.from];
      if (event === "depart") sfx.liftDepart(up, RIDE_SECONDS / 2);
      else sfx.liftArrive(up, { close: DOORS.move + DOORS.hold, shut: 2 * DOORS.move + DOORS.hold });
    });
    // The zones' own sounds, near where the camera looks, while a run is on screen and nothing covers the room.
    const due = new Map<ZoneSound, number>();
    const zones = window.setInterval(() => {
      const s = useGame.getState();
      if (!s.started || s.view || document.hidden || !viewFocus.live || viewFocus.hush) {
        due.clear();
        return;
      }
      const now = performance.now() / 1000;
      for (const zone of ZONE_SOUNDS) {
        const level = zoneLevel(zone, viewFocus);
        if (level < 0.01) {
          due.delete(zone);
          continue;
        }
        // A zone coming into earshot answers promptly, but a short entry gap means a pan never sets off a burst.
        const at = due.get(zone) ?? now + entryGap(Math.random());
        if (now >= at) {
          sfx.playZone(zone.cue, level);
          due.set(zone, now + nextGap(zone, Math.random()));
        } else due.set(zone, at);
      }
    }, ZONE_TICK_MS);
    return () => {
      window.clearInterval(zones);
      stopScene();
      stopAvatar();
      stopRide();
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
      // The guide's card is labelled a dialog for assistive technology, but it is not modal: shortcuts still apply.
      if (!s.started || target?.closest('[role="dialog"]:not([aria-modal="false"]):not(.tour-card)')) return;
      if (e.key === "Escape") {
        // In a fixed order: a view sheet, then walk mode seen from above, then the selection. Dialogs close themselves
        // first. A view from the avatar is left by its Exit button: there Escape only ever gives the cursor back.
        if (s.view) s.openView(null);
        else if (s.walking && !fromAvatar(s.viewpoint)) s.setWalking(false);
        else if (s.walking) return;
        else if (s.selected && s.game.phase !== "incident") s.select(null);
      } else if (e.key === "p" || e.key === "P") {
        if (s.game.phase === "incident" || s.game.phase === "management") s.setRunning(!s.running);
      } else if ((e.key === "n" || e.key === "N") && s.game.campaign && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Guided Mode steps one game second; the store refuses wherever Run would.
        s.stepSeconds(1);
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
    <RoomControlsHost><div className={`app phase-${phase}${campaign && started ? " has-chapters" : ""}${touring ? ` is-touring tour-${touring}` : ""}${started ? "" : " is-title"}${started && !campaign ? " has-operations-rail" : ""}`}>
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
      {started && <Tutorial />}
      {started && <InspectionReveal />}
      {!campaign && started && phase === "review" && <PostmortemModal />}
      {!campaign && started && phase === "ended" && <EndReport />}
    </div></RoomControlsHost>
  );
}
