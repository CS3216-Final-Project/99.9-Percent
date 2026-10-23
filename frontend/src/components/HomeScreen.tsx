import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { AvatarButton } from "./AvatarPicker";
import { BALANCE } from "@/sim";
import { num } from "@/game/format";
import type { GameMode } from "@/game/persist";
import { loadAnalyticsConsent, saveAnalyticsConsent, subscribeAnalyticsConsent } from "@/lib/analytics";
import { NUMBERED_CHAPTERS, UNLOCK_CHAPTER } from "@/game/scope";
import { useGame } from "@/game/store";
import { AccountButton } from "./Account";
import { FeedbackButton } from "./FeedbackButton";
import { Icon } from "./icons";
import { Callout } from "./ui";
import { campaignAbout, MODES, useModeLauncher, useModeSummaries, type ModeInfo, type Summary } from "./homeModes";
import "./HomeScreen.css";

/**
 * Challenge Mode while it is locked: a short row under Guided Mode that names the goal and shows the way there.
 * It has no controls, so its text is read in place rather than hidden behind a disabled button.
 */
function ChallengeTeaser({ guided }: { guided: Summary }) {
  const reached = guided.resumable && !guided.ended ? guided.chapter ?? 0 : 0;
  const done = (n: number) => n < reached || (n === reached && !!guided.chapterDone);
  // A version-1 company still plays the Opening, so its chapters run one number higher than a Launch Week company's.
  const total = guided.resumable && guided.total ? guided.total : NUMBERED_CHAPTERS.length;
  const unlock = guided.resumable && guided.unlock ? guided.unlock : UNLOCK_CHAPTER;
  return <section className="mode-teaser" aria-labelledby="classic-heading">
    <Icon name="lock" size={20} />
    <div className="mode-teaser-text">
      <h2 id="classic-heading">{MODES.classic.name}</h2>
      <p>Grow to {num(BALANCE.targetUsers)} users in {BALANCE.maxTurns} weeks on your own.</p>
      <p className="mode-teaser-unlock">Unlocks after Chapter {unlock}: Stay Online.{reached > 0 && ` You are on Chapter ${reached} of ${total}.`}</p>
    </div>
    <ol className="mode-teaser-pips" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => <li key={n} className={done(n) ? "is-done" : n === reached ? "is-here" : n === unlock ? "is-goal" : undefined} />)}
    </ol>
  </section>;
}

/** The analytics notice, shown only until the player confirms it or opts out. One line, with the details on request. */
export function AnalyticsConsentPanel() {
  const consent = useSyncExternalStore(subscribeAnalyticsConsent, loadAnalyticsConsent, () => null);
  const [open, setOpen] = useState(false);
  if (consent !== null) return null;
  return <section className="consent-strip" aria-label="Help improve 99.99%">
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Anonymous gameplay stats help improve 99.99%. <span className="consent-more">{open ? "Hide details" : "Details"}</span></summary>
      <p>We track anonymous gameplay events, like which chapters you finish and how long they take, to help make the game better. We never send account details, URLs, or saved games. Nothing is sent while your browser's Do Not Track or Global Privacy Control setting is on. If you would rather not share, press Opt out.</p>
    </details>
    <div className="consent-actions">
      <button type="button" className="btn btn-small" onClick={() => saveAnalyticsConsent("accepted")}>OK</button>
      <button type="button" className="btn btn-small" onClick={() => saveAnalyticsConsent("declined")}>Opt out</button>
    </div>
  </section>;
}

/**
 * The wordmark climbs from 0.00% to 99.99% once on arrival, easing out like an uptime meter settling, so the game's
 * name lands as the number the player is about to defend. Screen readers and reduced motion get the name at once.
 */
export function UptimeMark() {
  const digits = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = digits.current;
    if (!el || typeof window.matchMedia !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const duration = 1400;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = t === 1 ? 1 : 1 - 2 ** (-10 * t);
      el.textContent = `${(99.99 * eased).toFixed(2)}%`;
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return <h1 aria-label="99.99%"><span ref={digits} aria-hidden="true">99.99%</span></h1>;
}

/** Touch screens show a focus ring on an autofocused button, so only keyboard-and-pointer devices get the head start. */
const autoFocusAllowed = () => typeof window.matchMedia !== "function" || !window.matchMedia("(pointer: coarse)").matches;

/**
 * The one home screen for every visit: first time, a Guided Mode run or a Challenge Mode run in progress.
 * Guided Mode always has a card. Challenge Mode is a short teaser until it unlocks, then a card of its own,
 * so the player can continue either mode or switch from here.
 */
export function HomeScreen() {
  const mode = useGame((s) => s.mode);
  const busy = useGame((s) => s.cloudBusy);
  // Challenge Mode unlocks when the Guided Mode company acknowledges its final chapter.
  const unlocked = useGame((s) => s.mode === "classic" || s.meta.challengeUnlocked || s.game.campaign?.reliabilityStage?.acknowledged === true);
  const summary = useModeSummaries();
  const active = summary(mode);
  const { unsaved, playMode, newGame, replayTutorial } = useModeLauncher(summary);

  return <div className="title-screen home-screen">
    <div className={`home-card${unlocked ? "" : " is-solo"}`}>
      <header className="home-head">
        <div className="home-chips">
          <FeedbackButton />
          <AvatarButton />
          <AccountButton />
        </div>
        <UptimeMark />
        <p className="title-tag">Grow a startup. Keep it online.</p>
      </header>
      <section className={`mode-selection${unlocked ? "" : " is-locked"}`} aria-label="Choose how you want to play">
        <div className="mode-options">
          {(unlocked ? ["campaign", "classic"] as const : ["campaign"] as const).map((m) => <ModeCard key={m} mode={m} summary={summary(m)} lastPlayed={m === mode && !!active.progress}
            info={m === "campaign" ? { ...MODES.campaign, about: campaignAbout(summary(m)) } : MODES[m]} locked={false}
            unsaved={unsaved === m} busy={busy} autoFocus={m === mode && !!active.progress && autoFocusAllowed()}
            onPlay={() => playMode(m)} onNew={() => newGame(m)} onTutorial={() => replayTutorial(m)} />)}
          {!unlocked && <ChallengeTeaser guided={summary("campaign")} />}
        </div>
      </section>
      <AnalyticsConsentPanel />
    </div>
  </div>;
}

/** One mode's card: its description, its saved game and its controls. Another edition can pass its own wording. */
export function ModeCard({ mode, summary, lastPlayed, locked, unsaved, busy, autoFocus, onPlay, onNew, onTutorial, info = MODES[mode],
  lockedText, lockedLabel, canExport = true }: {
  mode: GameMode; summary: Summary; lastPlayed: boolean; locked: boolean; unsaved: boolean; busy: boolean; autoFocus: boolean;
  onPlay: () => void; onNew: () => void; onTutorial: () => void; info?: ModeInfo; lockedText?: string; lockedLabel?: string;
  /** Whether this edition's menu can export a save, so the unsaved warning can point there. */
  canExport?: boolean;
}) {
  const heading = `${mode}-heading`;
  const label = unsaved ? "Switch and lose this run" : summary.continueLabel;
  // A Guided Mode company that has ended can start over from here; a Challenge Mode run can at any time.
  const canRestart = mode === "classic" ? summary.resumable : summary.ended;
  // Starting over replaces the save, so it asks for a second press, as the menu does.
  const [confirmNew, setConfirmNew] = useState(false);
  const restart = () => {
    if (!confirmNew) { setConfirmNew(true); return; }
    setConfirmNew(false);
    onNew();
  };
  const newLabel = mode === "classic" ? "New game" : "New company";
  return <section className={`mode-option${lastPlayed ? " is-last-played" : ""}${locked ? " is-locked" : ""}`} aria-labelledby={heading}>
    <div className="mode-option-head">
      <h2 id={heading}><Icon name={info.icon} />{info.name}</h2>
      {lastPlayed && <span className="mode-badge">Last played</span>}
    </div>
    {info.pace && <p className="mode-pace">{info.pace}</p>}
    <p>{info.about}</p>
    {locked ? <>
      <div className="mode-progress is-empty">
        <Icon name="lock" size={20} />
        <span><span className="mode-progress-label">Locked</span>{lockedText}</span>
      </div>
      <div className="mode-actions">
        <button type="button" className="btn" disabled><Icon name="lock" />{lockedLabel}</button>
      </div>
    </> : <>
      <div className={`mode-progress${summary.progress ? "" : " is-empty"}`}>
        <Icon name={summary.progress ? "save" : "plus"} size={20} />
        <span><span className="mode-progress-label">{summary.progress ? "Saved game" : "No saved game"}</span>{summary.progress ?? "Starts from the beginning"}</span>
      </div>
      <div className="mode-actions">
        <button type="button" className={`btn ${unsaved ? "btn-danger" : "btn-primary"}`} disabled={busy} autoFocus={autoFocus} onClick={onPlay}>
          <Icon name="play" />{label}
        </button>
        {canRestart && <button type="button" className={`btn${confirmNew ? " btn-danger is-confirming" : ""}`} disabled={busy} onClick={restart} onBlur={() => setConfirmNew(false)}>
          {confirmNew ? (mode === "classic" ? "Lose this run? Press again" : "Lose this company? Press again") : newLabel}
        </button>}
      </div>
      {confirmNew && <Callout compact tone="warn" icon="alert" kicker="Are you sure?">
        This replaces your {mode === "classic" ? "Challenge Mode run" : "finished Guided Mode company and its final report"}. Press the button again to confirm.
      </Callout>}
      {unsaved && <Callout compact tone="warn" icon="alert" kicker="Not saved" live="alert">
        Your other run could not be saved, so switching now loses it. Press "{label}" again to switch anyway{canExport ? ", or continue that run and export it from Menu, Saves first" : ""}.
      </Callout>}
      {/* A closed company has no Opening left to walk through. */}
      {summary.tutorialDone && !(mode === "campaign" && summary.ended) && <button type="button" className="text-btn mode-tutorial" disabled={busy} onClick={onTutorial}>{mode === "campaign" ? "Replay Launch Week" : "Replay tutorial"}</button>}
    </>}
  </section>;
}
