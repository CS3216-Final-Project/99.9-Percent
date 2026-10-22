import { useGame } from "@/game/store";
import { CampaignOverlays } from "@/components/CampaignUI";
import { ToastHost } from "@/components/Game";
import InspectionReveal from "@/components/InspectionReveal";
import { EndReport, HowToPlay, PostmortemModal } from "@/components/Modals";
import { PhoneCampaignComplete } from "./PhoneCampaignComplete";
import { PhoneHome } from "./PhoneHome";
import { PhoneMenu } from "./PhoneMenu";

/**
 * Everything shown over the game: the home screen, the menu, the run's dialogs and toasts. The phone edition uses
 * the desktop's dialogs except where its scope differs: its own home screen, its own menu, and the end of its
 * Guided Mode in place of the offer to enter the next chapter.
 */
export function PhoneOverlays() {
  const campaign = useGame((s) => !!s.game.campaign);
  const started = useGame((s) => s.started);
  const view = useGame((s) => s.view);
  const onboarding = useGame((s) => s.onboarding);
  const phase = useGame((s) => s.game.phase);
  return <>
    {campaign
      ? <CampaignOverlays home={<PhoneHome />} menu={(tab) => <PhoneMenu initialTab={tab} />} chapterComplete={() => <PhoneCampaignComplete />} />
      : <>
        {!started && <PhoneHome />}
        {started && view === "menu" && <PhoneMenu />}
        {started && onboarding && <HowToPlay />}
        {started && phase === "review" && <PostmortemModal />}
        {started && phase === "ended" && <EndReport />}
      </>}
    <ToastHost />
    {started && <InspectionReveal />}
  </>;
}
