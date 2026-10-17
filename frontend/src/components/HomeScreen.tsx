import { useMemo, useState, useSyncExternalStore } from "react";
import { AvatarButton } from "./AvatarPicker";
import { BALANCE, type GameState } from "@/sim";
import { num } from "@/game/format";
import { campaignChapters } from "@/game/campaignChapters";
import { loadClassicGame, loadGame, loadMeta, type GameMode } from "@/game/persist";
import { loadAnalyticsConsent, saveAnalyticsConsent, subscribeAnalyticsConsent } from "@/lib/analytics";
import { isFreshRun, useGame } from "@/game/store";
import { AccountButton } from "./Account";
import { FeedbackButton } from "./FeedbackButton";
import { Icon, type IconName } from "./icons";
import { Callout } from "./ui";
import "./HomeScreen.css";

/** What a mode's card says about its saved game. Nothing here changes a save. */
interface Summary { progress: string | null; resumable: boolean; ended: boolean; tutorialDone: boolean; continueLabel: string }

function campaignSummary(game: GameState | null, tutorialDone: boolean): Summary {
  if (!game?.campaign) return { progress: null, resumable: false, ended: false, tutorialDone, continueLabel: "Start Guided Mode" };
  const chapters = campaignChapters(game);
  const chapter = chapters.find((c) => c.current) ?? chapters.filter((c) => c.completed).at(-1) ?? chapters[0];
  const ended = game.phase === "ended";
  return { progress: ended ? "Company closed" : `Chapter ${chapter.number} of ${chapters.length - 1}: ${chapter.name}`, resumable: true, ended, tutorialDone, continueLabel: "Continue company" };
}
function classicSummary(game: GameState | null, tutorialDone: boolean): Summary {
  if (!game || game.campaign || isFreshRun(game)) return { progress: null, resumable: false, ended: false, tutorialDone, continueLabel: "Start Challenge Mode" };
  const ended = game.phase === "ended";
  return { progress: ended ? "Last game finished" : `Week ${game.turn} of ${BALANCE.maxTurns}`, resumable: !ended, ended, tutorialDone,
    continueLabel: ended ? "Start Challenge Mode" : `Continue week ${game.turn}` };
}

const MODES: Record<GameMode, { name: string; icon: IconName; pace: string; about: string }> = {
  campaign: {
    name: "Guided Mode", icon: "server", pace: "Continuous play · Six guided chapters",
    about: "Begin with Chapter 0 to learn the controls, game time and finances, then tackle six infrastructure chapters. Inspect problems, upgrade servers and pause whenever you need.",
  },
  classic: {
    name: "Challenge Mode", icon: "week", pace: `Week by week · ${BALANCE.maxTurns}-week challenge`,
    about: `Apply what you learned on your own. Grow to ${num(BALANCE.targetUsers)} users in ${BALANCE.maxTurns} weeks while handling outages and keeping the business afloat.`,
  },
};

/** The analytics notice, shown only until the player confirms it or opts out. */
function AnalyticsConsentPanel() {
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
  const game = useGame((s) => s.game);
  const hasRun = useGame((s) => s.hasRun);
  const meta = useGame((s) => s.meta);
  const busy = useGame((s) => s.cloudBusy);
  const generation = useGame((s) => s.generation);
  const [unsaved, setUnsaved] = useState<GameMode | null>(null);
  // Challenge Mode unlocks when the Guided Mode company acknowledges its final chapter.
  const unlocked = useGame((s) => s.mode === "classic" || s.meta.challengeUnlocked || s.game.campaign?.reliabilityStage?.acknowledged === true);

  // The mode that is not loaded is read straight from storage, without loading or writing it.
  const other = useMemo(() => {
    if (mode === "campaign") {
      const loaded = loadClassicGame();
      return classicSummary(loaded.status === "ok" ? loaded.game : null, loadMeta("classic").tutorialDone);
    }
    const loaded = loadGame();
    return campaignSummary(loaded.status === "ok" ? loaded.game : null, loadMeta("campaign").tutorialDone);
    // A new generation means the active game was replaced, which can change the other mode's save too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, generation]);
  const active = mode === "campaign" ? campaignSummary(hasRun ? game : null, meta.tutorialDone) : classicSummary(game, meta.tutorialDone);
  const summary = (m: GameMode) => (m === mode ? active : other);

  /** Run `then` in mode `m`, switching first when it is not the loaded mode. */
  const inMode = (m: GameMode, then?: () => void) => {
    const s = useGame.getState();
    if (m !== s.mode && !s.switchMode(m, { discard: unsaved === m })) {
      if (!useGame.getState().cloudBusy) setUnsaved(m);
      return;
    }
    setUnsaved(null);
    then?.();
  };
  const fresh = () => {
    const s = useGame.getState();
    if (s.meta.tutorialDone) s.newRun({});
    else s.startTutorialRun();
  };
  const playMode = (m: GameMode) => {
    const info = summary(m);
    if (m === "classic" && info.ended) { inMode(m, fresh); return; }
    // Switching starts the other mode already; only the loaded mode needs Play.
    if (m !== useGame.getState().mode) { inMode(m); return; }
    useGame.getState().play();
  };
  // Challenge Mode's walkthrough is its first week, so it restarts the run; Guided Mode's runs on the company as it is.
  const replayTutorial = (m: GameMode) => inMode(m, () => {
    if (m === "classic") { useGame.getState().startTutorialRun("home"); return; }
    useGame.getState().play();
    useGame.getState().startTour("campaign", "home");
  });

  return <div className="title-screen home-screen">
    <div className="home-card">
      <header className="home-head">
        <span className="title-kicker"><Icon name="server" size={16} />A system design tycoon</span>
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
            onPlay={() => playMode(m)} onNew={() => inMode(m, fresh)} onTutorial={() => replayTutorial(m)} />)}
        </div>
        {unsaved && <Callout compact tone="warn" icon="alert" kicker="Not saved">
          This run could not be saved, so switching now loses it. Press the red button again to switch anyway.
        </Callout>}
        <p className="mode-note">Guided Mode comes first: finish the first five chapters to unlock Challenge Mode. Each mode keeps its own save.</p>
      </section>
      <AnalyticsConsentPanel />
      <footer className="home-foot">
        <FeedbackButton />
      </footer>
    </div>
  </div>;
}

function ModeCard({ mode, summary, lastPlayed, locked, unsaved, busy, autoFocus, onPlay, onNew, onTutorial }: {
  mode: GameMode; summary: Summary; lastPlayed: boolean; locked: boolean; unsaved: boolean; busy: boolean; autoFocus: boolean;
  onPlay: () => void; onNew: () => void; onTutorial: () => void;
}) {
  const info = MODES[mode];
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
        <span><span className="mode-progress-label">Locked</span>Complete the first five Guided Mode chapters to unlock.</span>
      </div>
      <div className="mode-actions">
        <button type="button" className="btn" disabled><Icon name="lock" />Complete Guided Mode to unlock</button>
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
      {summary.tutorialDone && !(mode === "campaign" && summary.ended) && <button type="button" className="text-btn mode-tutorial" disabled={busy} onClick={onTutorial}>Replay the tutorial</button>}
    </>}
  </section>;
}
