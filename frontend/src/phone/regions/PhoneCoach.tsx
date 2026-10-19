import { useGame } from "@/game/store";
import Tutorial from "@/components/Tutorial";

/**
 * Region: coach. The guide that teaches the game: Chapter 0's lessons, chapter guides and Challenge Mode's first week.
 * For now it renders the desktop guide card; its owner replaces it with the phone's compact coach strip.
 */
export function PhoneCoach() {
  const started = useGame((s) => s.started);
  return started ? <Tutorial /> : null;
}
