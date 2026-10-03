import type { EquipmentId } from "@/sim";

/** Small line icons, drawn on a 20x20 grid so they sit cleanly beside text. */
const PATHS = {
  cash: (
    <>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M12.4 7.7c-.5-.7-1.3-1.1-2.4-1.1-1.3 0-2.2.7-2.2 1.7 0 2.3 4.7 1.1 4.7 3.5 0 1-.9 1.7-2.4 1.7-1.2 0-2.1-.4-2.6-1.2M10 5v1.6M10 13.5V15" />
    </>
  ),
  users: (
    <>
      <circle cx="7.5" cy="7" r="2.6" />
      <path d="M2.5 16c.4-2.8 2.4-4.4 5-4.4s4.6 1.6 5 4.4M13 4.8a2.4 2.4 0 0 1 0 4.6M15 11.9c1.4.6 2.3 1.9 2.6 4.1" />
    </>
  ),
  revenue: <path d="M3 14l4.5-4.5 3 3L17 6M12.5 6H17v4.5" />,
  health: <path d="M2 10.5h3.5l2-5 3.5 9 2.2-5.5H18" />,
  server: (
    <>
      <rect x="3.5" y="3" width="13" height="5.5" rx="1" />
      <rect x="3.5" y="11.5" width="13" height="5.5" rx="1" />
      <path d="M6.5 5.8h.01M6.5 14.3h.01" />
    </>
  ),
  database: (
    <>
      <ellipse cx="10" cy="5" rx="6" ry="2.4" />
      <path d="M4 5v10c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4V5M4 10c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4" />
    </>
  ),
  megaphone: <path d="M3.5 8.5v3l8.5 3.5V5L3.5 8.5zM14.5 8a2.6 2.6 0 0 1 0 4M5.8 12.4l.8 3.6h2l-.7-2.7" />,
  wrench: <path d="M12.6 3.4a4 4 0 0 0-4.7 5.3L3 13.6 6.4 17l4.9-4.9a4 4 0 0 0 5.3-4.7l-2.4 2.4-2.3-.6-.6-2.3 2.4-2.4z" />,
  tree: (
    <>
      <circle cx="5" cy="10" r="2" />
      <circle cx="15" cy="5" r="2" />
      <circle cx="15" cy="15" r="2" />
      <path d="M7 10h2.5M9.5 10c0-3 1.6-5 3.5-5M9.5 10c0 3 1.6 5 3.5 5" />
    </>
  ),
  history: (
    <>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 5.5V10l3 2" />
    </>
  ),
  play: <path d="M6.5 4.5v11l9-5.5-9-5.5z" />,
  pause: <path d="M7 4.5v11M13 4.5v11" />,
  next: <path d="M4 10h11M11 5.5l4.5 4.5-4.5 4.5" />,
  plus: <path d="M10 4v12M4 10h12" />,
  lock: (
    <>
      <rect x="4.5" y="9" width="11" height="8" rx="1.5" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
    </>
  ),
  check: <path d="M4 10.5l4 4 8-9" />,
  alert: <path d="M10 3.2l7.5 13H2.5L10 3.2zM10 8v4M10 14.3h.01" />,
  ship: <path d="M10 14V4M6 8l4-4 4 4M4 16.5h12" />,
  eye: (
    <>
      <path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z" />
      <circle cx="10" cy="10" r="2.3" />
    </>
  ),
  menu: <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" />,
  close: <path d="M5 5l10 10M15 5L5 15" />,
  bulb: <path d="M7.5 14.5h5M8.5 17h3M10 3a5 5 0 0 0-3 9c.5.5.8 1.2.8 2h4.4c0-.8.3-1.5.8-2a5 5 0 0 0-3-9z" />,
  network: (
    <>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M2.5 10h15M10 2.5c2.3 2.2 3.3 4.7 3.3 7.5s-1 5.3-3.3 7.5c-2.3-2.2-3.3-4.7-3.3-7.5S7.7 4.7 10 2.5z" />
    </>
  ),
  bolt: <path d="M11 2.5L4.5 11.5H10l-1 6 6.5-9H10l1-6z" />,
  copy: (
    <>
      <rect x="6.5" y="6.5" width="10" height="10" rx="1.5" />
      <path d="M13.5 6.5v-2a1 1 0 0 0-1-1h-8a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2" />
    </>
  ),
  search: (
    <>
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13.2 13.2L17 17" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

export const EQUIPMENT_ICON: Record<EquipmentId, IconName> = {
  gateway: "network",
  app: "server",
  standby: "server",
  cache: "bolt",
  db: "database",
  replica: "copy",
  backup: "copy",
  monitoring: "eye",
  deploy: "ship",
  team: "wrench",
  growth: "megaphone",
};
