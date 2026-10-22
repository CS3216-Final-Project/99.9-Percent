import { useSyncExternalStore } from "react";
import { AvatarButton } from "./AvatarPicker";
import type { GameMode } from "@/game/persist";
import { loadAnalyticsConsent, saveAnalyticsConsent, subscribeAnalyticsConsent } from "@/lib/analytics";
import { useGame } from "@/game/store";
import { AccountButton } from "./Account";
import { FeedbackButton } from "./FeedbackButton";
import { Icon } from "./icons";
import { Callout } from "./ui";
import { MODES, useModeLauncher, useModeSummaries, type ModeInfo, type Summary } from "./homeModes";
import "./HomeScreen.css";


/** The analytics notice, shown only until the player confirms it or opts out. */
export function AnalyticsConsentPanel() {
  const consent = useSyncExternalStore(subscribeAnalyticsConsent, loadAnalyticsConsent, () => null);
  if (consent !== null) return null;
  return <section className="consent-panel" aria-labelledby="analytics-consent-heading">
    <h2 id="analytics-consent-heading">Help improve <span className="consent-logo">99.99%</span></h2>
    <p>We track anonymous gameplay events, like which chapters you finish and how long they take, to help make the game better. We never send account details, URLs, or saved games. Nothing is sent while your browser's Do Not Track or Global Privacy Control setting is on. If you would rather not share, press Opt out.</p>
    <div className="consent-actions">
      <button type="button" className="btn btn-small btn-primary" onClick={() => saveAnalyticsConsent("accepted")}><Icon name="check" />OK</button>
      <button type="button" className="btn btn-small btn-danger" onClick={() => saveAnalyticsConsent("declined")}>Opt out</button>
    </div>
  </section>;
}

/**
 * The one home screen for every visit: first time, a Guided Mode run or a Challenge Mode run in progress.
 * Both modes always have a card, so the player can continue either one or switch from here.
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
    <div className="home-card">
      <header className="home-head">
        <div className="home-chips">
          <AvatarButton />
          <AccountButton />
        </div>
        <h1>99.99%</h1>
        <p className="title-tag">Grow a startup. Keep it online.</p>
      </header>
      <section className="mode-selection" aria-labelledby="mode-heading">
        <h2 id="mode-heading">Choose how you want to play</h2>
        <div className="mode-options">
          {(["campaign", "classic"] as const).map((m) => <ModeCard key={m} mode={m} summary={summary(m)} lastPlayed={m === mode && !!active.progress}
            locked={m === "classic" && !unlocked}
            unsaved={unsaved === m} busy={busy} autoFocus={m === mode && !!active.progress}
            onPlay={() => playMode(m)} onNew={() => newGame(m)} onTutorial={() => replayTutorial(m)} />)}
        </div>
        {unsaved && <Callout compact tone="warn" icon="alert" kicker="Not saved">
          This run could not be saved, so switching now loses it. Press the red button again to switch anyway.
        </Callout>}
      </section>
      <AnalyticsConsentPanel />
      <footer className="home-foot">
        <FeedbackButton />
      </footer>
    </div>
  </div>;
}


/** One mode's card: its description, its saved game and its controls. Another edition can pass its own wording. */
export function ModeCard({ mode, summary, lastPlayed, locked, unsaved, busy, autoFocus, onPlay, onNew, onTutorial, info = MODES[mode],
  lockedText = "Complete the first five Guided Mode chapters to unlock.", lockedLabel = "Complete Guided Mode to unlock" }: {
  mode: GameMode; summary: Summary; lastPlayed: boolean; locked: boolean; unsaved: boolean; busy: boolean; autoFocus: boolean;
  onPlay: () => void; onNew: () => void; onTutorial: () => void; info?: ModeInfo; lockedText?: string; lockedLabel?: string;
}) {
  const heading = `${mode}-heading`;
  const label = unsaved ? "Switch and lose this run" : summary.continueLabel;
  return <section className={`mode-option${lastPlayed ? " is-last-played" : ""}${locked ? " is-locked" : ""}`} aria-labelledby={heading}>
    <div className="mode-option-head">
      <h3 id={heading}><Icon name={info.icon} />{info.name}</h3>
      {lastPlayed && <span className="mode-badge">Last played</span>}
    </div>
    <p className="mode-pace">{info.pace}</p>
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
        {mode === "classic" && summary.resumable && <button type="button" className="btn" disabled={busy} onClick={onNew}>New game</button>}
      </div>
      {/* A closed company has no Opening left to walk through. */}
      {summary.tutorialDone && !(mode === "campaign" && summary.ended) && <button type="button" className="text-btn mode-tutorial" disabled={busy} onClick={onTutorial}>{mode === "campaign" ? "Replay walkthrough" : "Replay the tutorial"}</button>}
    </>}
  </section>;
}
