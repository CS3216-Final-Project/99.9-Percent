import { RoomControlsHost } from "@/components/RoomControlsHost";
import { Room } from "@/components/Game";
import { useAppClassName } from "@/components/useGameRuntime";
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
 */
export function PhoneGameLayout() {
  const className = useAppClassName();
  return <RoomControlsHost><div className={`${className} phone-app`} data-edition="phone">
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
