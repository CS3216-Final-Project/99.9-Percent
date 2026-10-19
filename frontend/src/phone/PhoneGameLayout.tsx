import { RoomControlsHost } from "@/components/RoomControlsHost";
import { Room } from "@/components/Game";
import { useAppClassName } from "@/components/useGameRuntime";
import { useGame } from "@/game/store";
import { shownSheetState, useSheetState } from "./layout/sheetState";
import { PhoneOverlays } from "./PhoneOverlays";
import { PhoneCoach } from "./regions/PhoneCoach";
import { PhoneDock } from "./regions/PhoneDock";
import { PhoneSheet } from "./regions/PhoneSheet";
import { PhoneTopStrip } from "./regions/PhoneTopStrip";

/**
 * The phone edition's in-game layout, as named regions that can each be replaced on their own:
 *
 * - top strip (`PhoneTopStrip`): headline numbers, Menu and the chapter bar
 * - room: the 3D room in `main.stage`, shared with the desktop edition
 * - sheet (`PhoneSheet`): System metrics and other panels over or under the room
 * - dock (`PhoneDock`): time controls, room navigation and the view buttons
 * - coach (`PhoneCoach`): Chapter 0 and the other guides
 * - overlays (`PhoneOverlays`): home screen, menu, dialogs and toasts
 *
 * Regions render no wrapper of their own, so each region's top element is a direct child of the app root, as the
 * shared styles expect. Phone-only styles are scoped to `[data-edition="phone"]` (see phone.css).
 *
 * The room fills everything between the top strip and the dock and keeps that size: the sheet, the coach and the
 * menus open over it. The root publishes the layout as CSS custom properties (see layout/phone-layout.css):
 * `--phone-top`, `--phone-dock`, `--phone-sheet` (the sheet's current height) and `--phone-safe-bottom`; guides set
 * `--phone-coach` while their strip shows, and the sheet stands above it.
 */
export function PhoneGameLayout() {
  const className = useAppClassName();
  const chapters = useGame((s) => s.started && !!s.game.campaign);
  const sheet = shownSheetState(useSheetState(), useGame((s) => s.game.phase === "incident"));
  return <RoomControlsHost><div className={`${className} phone-app`} data-edition="phone" data-sheet={sheet} data-chapters={chapters || undefined}>
    <PhoneTopStrip />
    <main className="stage">
      <Room />
    </main>
    <PhoneSheet />
    <PhoneDock />
    <PhoneOverlays />
    <PhoneCoach />
  </div></RoomControlsHost>;
}
