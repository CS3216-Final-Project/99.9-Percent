import type { ComponentType, SVGProps } from "react";
// Pixel icons from pixelarticons (MIT). Per-icon imports keep the bundle small.
import { AlarmClock } from "pixelarticons/react/AlarmClock.js";
import { Analytics } from "pixelarticons/react/Analytics.js";
import { ArrowBigUp } from "pixelarticons/react/ArrowBigUp.js";
import { ArrowRight } from "pixelarticons/react/ArrowRight.js";
import { Bug } from "pixelarticons/react/Bug.js";
import { CalendarWeeks } from "pixelarticons/react/CalendarWeeks.js";
import { ChartLine } from "pixelarticons/react/ChartLine.js";
import { Check } from "pixelarticons/react/Check.js";
import { CheckboxOn } from "pixelarticons/react/CheckboxOn.js";
import { Close } from "pixelarticons/react/Close.js";
import { Coins } from "pixelarticons/react/Coins.js";
import { Copy } from "pixelarticons/react/Copy.js";
import { Database } from "pixelarticons/react/Database.js";
import { Fire } from "pixelarticons/react/Fire.js";
import { Flag } from "pixelarticons/react/Flag.js";
import { Frown } from "pixelarticons/react/Frown.js";
import { GitBranch } from "pixelarticons/react/GitBranch.js";
import { Globe } from "pixelarticons/react/Globe.js";
import { Heart } from "pixelarticons/react/Heart.js";
import { Hourglass } from "pixelarticons/react/Hourglass.js";
import { InfoBox } from "pixelarticons/react/InfoBox.js";
import { Laptop } from "pixelarticons/react/Laptop.js";
import { Lightbulb } from "pixelarticons/react/Lightbulb.js";
import { Lock } from "pixelarticons/react/Lock.js";
import { Megaphone } from "pixelarticons/react/Megaphone.js";
import { Meh } from "pixelarticons/react/Meh.js";
import { Menu } from "pixelarticons/react/Menu.js";
import { Minus } from "pixelarticons/react/Minus.js";
import { Monitor } from "pixelarticons/react/Monitor.js";
import { PartyPopper } from "pixelarticons/react/PartyPopper.js";
import { Pause } from "pixelarticons/react/Pause.js";
import { Play } from "pixelarticons/react/Play.js";
import { Plug } from "pixelarticons/react/Plug.js";
import { Plus } from "pixelarticons/react/Plus.js";
import { PlusBox } from "pixelarticons/react/PlusBox.js";
import { Redo } from "pixelarticons/react/Redo.js";
import { Refresh } from "pixelarticons/react/Refresh.js";
import { RobotFaceHappy } from "pixelarticons/react/RobotFaceHappy.js";
import { Save } from "pixelarticons/react/Save.js";
import { Scale } from "pixelarticons/react/Scale.js";
import { Search } from "pixelarticons/react/Search.js";
import { Server } from "pixelarticons/react/Server.js";
import { Ship } from "pixelarticons/react/Ship.js";
import { Shuffle } from "pixelarticons/react/Shuffle.js";
import { Siren } from "pixelarticons/react/Siren.js";
import { Skull } from "pixelarticons/react/Skull.js";
import { SlidersHorizontal } from "pixelarticons/react/SlidersHorizontal.js";
import { Smile } from "pixelarticons/react/Smile.js";
import { SpeedFast } from "pixelarticons/react/SpeedFast.js";
import { Switch } from "pixelarticons/react/Switch.js";
import { TestTube } from "pixelarticons/react/TestTube.js";
import { Tools } from "pixelarticons/react/Tools.js";
import { TrendingUp } from "pixelarticons/react/TrendingUp.js";
import { Trophy } from "pixelarticons/react/Trophy.js";
import { Undo } from "pixelarticons/react/Undo.js";
import { UserPlus } from "pixelarticons/react/UserPlus.js";
import { Users } from "pixelarticons/react/Users.js";
import { Volume3 } from "pixelarticons/react/Volume3.js";
import { VolumeX } from "pixelarticons/react/VolumeX.js";
import { WarningDiamond } from "pixelarticons/react/WarningDiamond.js";
import { Zap } from "pixelarticons/react/Zap.js";

/**
 * One icon per idea, used everywhere that idea appears: the top bar, the room,
 * the side panel, the tech tree and the reports. If cash is a stack of coins in
 * one place it is a stack of coins in every place.
 */
const ICONS = {
  // Run-level numbers
  cash: Coins,
  users: Users,
  revenue: TrendingUp,
  health: Heart,
  week: CalendarWeeks,
  goal: Trophy,
  // Equipment
  server: Server,
  database: Database,
  network: Globe,
  bolt: Zap,
  copy: Copy,
  save: Save,
  monitor: Monitor,
  plug: Plug,
  ship: Ship,
  megaphone: Megaphone,
  team: Laptop,
  // Pressures and signals
  load: SpeedFast,
  latency: Hourglass,
  debt: Bug,
  smile: Smile,
  meh: Meh,
  frown: Frown,
  incident: Siren,
  alarm: AlarmClock,
  alert: WarningDiamond,
  fire: Fire,
  skull: Skull,
  // Upgrades
  tree: GitBranch,
  scaleUp: ArrowBigUp,
  shuffle: Shuffle,
  scale: Scale,
  sliders: SlidersHorizontal,
  checkbox: CheckboxOn,
  switch: Switch,
  test: TestTube,
  analytics: Analytics,
  // Controls
  play: Play,
  pause: Pause,
  next: ArrowRight,
  plus: Plus,
  plusBox: PlusBox,
  minus: Minus,
  lock: Lock,
  check: Check,
  close: Close,
  menu: Menu,
  music: Volume3,
  muted: VolumeX,
  search: Search,
  bulb: Lightbulb,
  wrench: Tools,
  hire: UserPlus,
  refresh: Refresh,
  rotateLeft: Undo,
  rotateRight: Redo,
  history: ChartLine,
  info: InfoBox,
  flag: Flag,
  party: PartyPopper,
  robot: RobotFaceHappy,
} satisfies Record<string, ComponentType<SVGProps<SVGSVGElement>>>;

export type IconName = keyof typeof ICONS;

/** Pixel icons are drawn on a 24-unit grid; 12, 24 and 48px keep every pixel square. */
export function Icon({ name, size = 24, className }: { name: IconName; size?: number; className?: string }) {
  const Svg = ICONS[name];
  return (
    <Svg
      className={className ? `icon ${className}` : "icon"}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      shapeRendering="crispEdges"
    />
  );
}
