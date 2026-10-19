import { useGame } from "@/game/store";
import { CampaignControls } from "@/components/CampaignUI";
import { BottomBar } from "@/components/Game";

/**
 * Region: dock. Time controls, the room's navigation and the Tech/History buttons along the bottom edge.
 * For now it renders the desktop dock; its owner replaces it with the phone's one-row dock.
 */
export function PhoneDock() {
  const campaign = useGame((s) => !!s.game.campaign);
  return campaign ? <CampaignControls /> : <BottomBar />;
}
