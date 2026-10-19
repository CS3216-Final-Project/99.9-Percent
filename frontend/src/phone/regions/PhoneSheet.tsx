import { useGame } from "@/game/store";
import { CampaignPanel } from "@/components/CampaignUI";
import { ClassicViewSheet } from "@/components/Game";
import OperationsRail from "@/components/OperationsRail";
import SidePanel from "@/components/SidePanel";

/**
 * Region: sheet. Everything that slides over or under the room: Guided Mode's System metrics, and Challenge Mode's
 * weekly work, equipment panel and Tech/Team/History views.
 * For now it renders the desktop panels; its owner replaces them with a bottom sheet.
 */
export function PhoneSheet() {
  const campaign = useGame((s) => !!s.game.campaign);
  const started = useGame((s) => s.started);
  if (campaign) return started ? <CampaignPanel /> : null;
  return <>{started && <OperationsRail />}<SidePanel /><ClassicViewSheet /></>;
}
