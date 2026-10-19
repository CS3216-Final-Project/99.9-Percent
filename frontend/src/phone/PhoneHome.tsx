import { challengeAvailable, useGame } from "@/game/store";
import { AnalyticsConsentPanel, ModeCard } from "@/components/HomeScreen";
import { MODES, useModeLauncher, useModeSummaries, type ModeInfo } from "@/components/homeModes";
import { Callout } from "@/components/ui";
import { PHONE_CHAPTERS, phoneCampaignSummary } from "./phoneSummary";
import "@/components/HomeScreen.css";

const PHONE_MODES: Record<"campaign" | "classic", ModeInfo> = {
  campaign: {
    ...MODES.campaign,
    pace: `Continuous play · Walkthrough and ${PHONE_CHAPTERS} guided chapters`,
    about: "Learn the controls, game time and finances in the walkthrough, then inspect problems, upgrade servers and route traffic in two guided chapters. Pause whenever you need.",
  },
  classic: MODES.classic,
};

/**
 * The phone edition's home screen: one card per mode and the analytics notice. Accounts, avatars and feedback stay
 * on the desktop edition.
 */
export function PhoneHome() {
  const mode = useGame((s) => s.mode);
  const busy = useGame((s) => s.cloudBusy);
  const unlocked = useGame(challengeAvailable);
  const lockedText = useGame((s) => s.scope.challengeLocked.replace(/ to unlock Challenge Mode\.$/, " to unlock."));
  const summary = useModeSummaries(phoneCampaignSummary);
  const active = summary(mode);
  const { unsaved, playMode, newGame, replayTutorial } = useModeLauncher(summary);

  return <div className="title-screen home-screen phone-home">
    <div className="home-card">
      <header className="home-head">
        <h1>99.99%</h1>
        <p className="title-tag">Grow a startup. Keep it online.</p>
      </header>
      <section className="mode-selection" aria-labelledby="mode-heading">
        <h2 id="mode-heading">Choose how you want to play</h2>
        <div className="mode-options">
          {(["campaign", "classic"] as const).map((m) => <ModeCard key={m} mode={m} info={PHONE_MODES[m]} summary={summary(m)} lastPlayed={m === mode && !!active.progress}
            locked={m === "classic" && !unlocked} lockedText={lockedText}
            unsaved={unsaved === m} busy={busy} autoFocus={m === mode && !!active.progress}
            onPlay={() => playMode(m)} onNew={() => newGame(m)} onTutorial={() => replayTutorial(m)} />)}
        </div>
        {unsaved && <Callout compact tone="warn" icon="alert" kicker="Not saved">
          This run could not be saved, so switching now loses it. Press the red button again to switch anyway.
        </Callout>}
      </section>
      <AnalyticsConsentPanel />
    </div>
  </div>;
}
