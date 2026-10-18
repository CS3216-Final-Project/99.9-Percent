import {
  AlarmClock, Clock, Timer, CircleAlert, LayoutDashboard, PanelRightClose, PanelRightOpen, ChartNoAxesCombined, ArrowBigUp, ArrowRight, Bug, CalendarDays,
  ChartLine, Check, ChevronDown, SquareCheck, X, Cloud, Wallet, Copy, Database,
  Download, Eye, EyeOff, Flame, Flag, Frown, Network, Globe, HeartPulse,
  Hourglass, Info, Laptop, Lightbulb, LockKeyhole, LogIn, LogOut, Mail,
  Megaphone, Meh, Menu, Minus, Monitor, PartyPopper, Pause, Play, Plug, Plus,
  SquarePlus, RotateCw, RefreshCw, Bot, Save, Scale, Search, Server, Ship,
  Shuffle, Siren, Skull, SlidersHorizontal, Smile, Gauge, ArrowRightLeft,
  FlaskConical, Wrench, TrendingUp, Trophy, RotateCcw, Upload, UserRound,
  UserRoundPlus, Users, Volume2, VolumeX, TriangleAlert, Zap, Layers, Compass,
  Footprints, Camera, Funnel, Ban, StepForward, FastForward, CreditCard,
  PiggyBank, Repeat, ArrowDownToLine, type LucideIcon,
} from "lucide-react";

/** Stable concept names shared by the HUD, room, panels and reports. */
const ICONS = {
  cash: Wallet, users: Users, revenue: TrendingUp, health: HeartPulse,
  overview: LayoutDashboard, panelClose: PanelRightClose, panelOpen: PanelRightOpen, error: CircleAlert, backlog: Layers, timer: Timer, week: CalendarDays, time: Clock, goal: Trophy,
  server: Server, database: Database, network: Globe, bolt: Zap, copy: Copy,
  save: Save, download: Download, upload: Upload, monitor: Monitor, plug: Plug,
  ship: Ship, megaphone: Megaphone, team: Laptop,
  load: Gauge, latency: Hourglass, debt: Bug, smile: Smile, meh: Meh, frown: Frown,
  incident: Siren, alarm: AlarmClock, alert: TriangleAlert, fire: Flame, skull: Skull,
  tree: Network, scaleUp: ArrowBigUp, shuffle: Shuffle, scale: Scale,
  sliders: SlidersHorizontal, checkbox: SquareCheck, switch: ArrowRightLeft,
  test: FlaskConical, analytics: ChartNoAxesCombined,
  play: Play, pause: Pause, next: ArrowRight, down: ChevronDown,
  plus: Plus, plusBox: SquarePlus, minus: Minus, lock: LockKeyhole, check: Check,
  close: X, menu: Menu, music: Volume2, muted: VolumeX, search: Search,
  bulb: Lightbulb, wrench: Wrench, hire: UserRoundPlus, refresh: RefreshCw,
  rotateLeft: RotateCcw, rotateRight: RotateCw, history: ChartLine,
  info: Info, flag: Flag, party: PartyPopper, robot: Bot, user: UserRound,
  cloud: Cloud, mail: Mail, login: LogIn, logout: LogOut, eye: Eye, eyeOff: EyeOff,
  floor: Layers, explore: Compass, walk: Footprints, camera: Camera,
  limit: Funnel, rejected: Ban, step: StepForward, stepMany: FastForward,
  cost: CreditCard, cashLeft: PiggyBank, upkeep: Repeat, incoming: ArrowDownToLine,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 24, className }: { name: IconName; size?: number; className?: string }) {
  const Svg = ICONS[name];
  return <Svg className={className ? `icon ${className}` : "icon"} width={size} height={size}
    strokeWidth={1.8} aria-hidden="true" focusable="false" />;
}
