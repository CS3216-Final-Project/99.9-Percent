import { challengeAvailable, useGame } from "@/game/store";
import { AnalyticsConsentPanel, ModeCard, UptimeMark } from "@/components/HomeScreen";
import { MODES, useModeLauncher, useModeSummaries, type ModeInfo } from "@/components/homeModes";
import { BALANCE } from "@/sim";
import { phoneCampaignSummary } from "./phoneSummary";
import "@/components/HomeScreen.css";

const PHONE_MODES: Record<"campaign" | "classic", ModeInfo> = {
  campaign: {
    ...MODES.campaign,
    pace: "Continuous play · Launch Week and Scaling & Routing",
    about: "Run your company through Launch Week and its first incident, then add servers and route traffic in Scaling & Routing. Pause whenever you need.",
  },
  classic: { ...MODES.classic, pace: `Week by week · ${BALANCE.maxTurns}-week challenge` },
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
        <UptimeMark />
        <p className="title-tag">Grow a startup. Keep it online.</p>
      </header>
      <section className="mode-selection" aria-label="Choose how you want to play">
        <div className="mode-options">
          {(["campaign", "classic"] as const).map((m) => <ModeCard key={m} mode={m} info={PHONE_MODES[m]} summary={summary(m)} lastPlayed={m === mode && !!active.progress}
            locked={m === "classic" && !unlocked} lockedText={lockedText} lockedLabel="Finish Scaling & Routing to unlock" canExport={false}
            unsaved={unsaved === m} busy={busy} autoFocus={m === mode && !!active.progress}
            onPlay={() => playMode(m)} onNew={() => newGame(m)} onTutorial={() => replayTutorial(m)} />)}
        </div>
      </section>
      <AnalyticsConsentPanel />
    </div>
  </div>;
}
