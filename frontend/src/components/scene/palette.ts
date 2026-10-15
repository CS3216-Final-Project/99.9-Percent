/*
 * The office's colours, in one place: a bright modern office of off-white walls, light concrete and raised-floor
 * tiles, grey carpet tiles and muted carpets, so the room sits in the daylit city round it. Surfaces are mid tones rather than
 * pure white, so the office's lights and the glow pass do not blow them out. The equipment's state colours (see
 * Facility.tsx) and the neon sign are the only strong colours; everything here leaves room for them.
 */

export const ROOM_PALETTE = {
  /** The walls facing the camera at the start, and the two at the sides, a shade apart so the corners read. */
  wall: "#d6d2c9",
  wallSide: "#c7c3ba",
  /** The floor slab's edge, and the skirting along the foot of the walls. */
  slab: "#5c5e63",
  skirting: "#3a3d43",
  floor: {
    /** Polished concrete for the corridors and the network room. */
    concrete: "#9c988f",
    /** The server floor's raised tiles. */
    server: "#a9adb4",
    /** Grey carpet tiles where the crew work, a shade cooler and darker than the concrete so the two read apart. */
    work: "#686c73",
    /** Carpet in the monitoring room and the meeting room. */
    monitoring: "#3d4756",
    meeting: "#5f7a70",
    /** The kitchen's tiles. */
    kitchen: "#ebe8e2",
    /** The events space's deep blue carpet, under the townhall steps and the stage. */
    events: "#3c4a68",
    /** The library's warm carpet. */
    library: "#7d6b58",
    /** Reception's light stone, in big tiles. */
    reception: "#c4beb3",
    /** Warm stone where the crew eat. */
    dining: "#d8c2a2",
    /** The lounge's sand-coloured carpet. */
    lounge: "#8f8676",
    /** The teal carpet of the games room and the foosball corner. */
    games: "#3f6e72",
    /** The nap room's dark carpet. */
    nap: "#2e3344",
    /** The quiet room's slate carpet, upstairs from the network room. */
    quiet: "#56606e",
  },
  /** The server floor's perforated vent tiles, and the holes in them. */
  vent: "#8d9299",
  ventHoles: "#3a3d43",
  /** Lines round equipment on the floor: built, and space for it. */
  footprint: { built: "#3a4150", empty: "#7c828b" },
  /** The light bounced up from the floor onto the room. */
  bounce: "#55524d",
} as const;

/**
 * Furniture and fittings: charcoal and grey metal, white and light grey panels, oak, and a few colour accents (the
 * phone booths, the beanbags, mugs and books) kept from the old office.
 */
export const FURNITURE = {
  ink: "#23262b",
  trim: "#3a3d43",
  steel: "#5a5f68",
  light: "#e5e6e9",
  pale: "#d5d7db",
  alu: "#bcc1c8",
  woodDark: "#7a5a40",
  /** Shelf boards and the legs of stands. */
  frame: "#6b7078",
  /** The two phone booths. */
  booths: ["#3d4a5c", "#6f8f86"],
  /** The lounge's rug and the townhall's round one: outer and inner. */
  rug: ["#8a8276", "#978f83"],
  /** The server room's cooling units: shell, door, base, louvres, display, buttons, label and top. */
  crac: { shell: "#d9dbde", door: "#cdd0d4", base: "#2c2f34", louvre: "#8c9198", display: "#1b1d21", button: "#9da2a9", label: "#5a5f68", top: "#3a3d43" },
} as const;

/**
 * The equipment: racks in charcoal, each kind a shade of its own so they stay apart, and their faces. The blue of a
 * temporary server is kept, since it says the server is temporary.
 */
export const EQUIPMENT = {
  rack: "#3f434b",
  trim: "#2e3136",
  bezel: "#1d1f23",
  loadBalancer: "#3b4352",
  standby: "#4a4d55",
  cache: "#2f4856",
  database: "#383c48",
  backup: "#42454c",
  temporary: "#2f4a7a",
  face: { back: "#1a1c20", unit: "#2d3036", vent: "#22252a", edge: "#3c4048", bay: "#30343a", slot: "#212328", bayEdge: "#454a52", panel: "#2b2e34", port: "#131417", ledOff: "#2a2c31" },
  /** What screens show when idle or switched off, and the panels of a dashboard. */
  screen: { code: "#151b26", idle: "#0f121a", dash: "#131a26", chart: "#131a26", off: "#0a0b0f", game: "#0d0f17", idleBar: "#2a2e36", tile: "#1f2430", grid: "#2f343d" },
} as const;

/** Walk-mode wayfinding: the avatar's ring and the target marking a click-planned destination. */
export const WALK_MARKER = {
  primary: "#ffd84a",
  contrast: "#3a3218",
} as const;

/** The low-quality look's pixel floors: each a base, a lighter and a darker speck, and its grout or seams. */
export const PIXEL_FLOORS = {
  concrete: { base: "#9a968d", light: "#a29e95", dark: "#928e86", seam: "#86827a" },
  server: { base: "#a6aab1", light: "#aeb2b9", dark: "#9fa3aa", edge: "#b8bcc3", grout: "#7f838a" },
  work: { base: "#757980", fleck: "#6b6f77" },
  monitoring: { base: "#3d4756", fleck: "#343d4a" },
  meeting: { base: "#5f7a70", fleck: "#536b62" },
  kitchen: { base: "#ebe8e2", alternate: "#dfdbd3", grout: "#a8a49c" },
  events: { base: "#3c4a68", fleck: "#344059" },
  library: { base: "#7d6b58", fleck: "#6f5e4d" },
  reception: { base: "#c4beb3", alternate: "#bab4a9", grout: "#9a958c" },
  dining: { base: "#d8c2a2", alternate: "#cdb695", grout: "#a8957a" },
  lounge: { base: "#8f8676", fleck: "#817869" },
  games: { base: "#3f6e72", fleck: "#376064" },
  nap: { base: "#2e3344", fleck: "#282c3b" },
  quiet: { base: "#56606e", fleck: "#4c5562" },
} as const;

/** A tiled floor's colours at the low-quality look: two alternating tiles and the grout between them. */
export interface TileColours {
  base: string;
  alternate: string;
  grout: string;
}
