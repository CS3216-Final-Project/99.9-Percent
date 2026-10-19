import { useGame } from "@/game/store";
import { CampaignHeader } from "@/components/CampaignUI";
import { TopBar } from "@/components/Game";

/**
 * Region: top strip. The run's headline numbers, the Menu button and, in Guided Mode, the chapter bar.
 * For now it renders the desktop header; its owner replaces it with the phone's compact strip.
 */
export function PhoneTopStrip() {
  const campaign = useGame((s) => !!s.game.campaign);
  return campaign ? <CampaignHeader /> : <TopBar />;
}
