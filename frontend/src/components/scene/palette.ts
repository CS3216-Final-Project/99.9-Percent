/*
 * The office's colours, in one place: a bright modern office of off-white walls, light concrete and raised-floor
 * tiles, oak, and muted carpets, so the room sits in the daylit city round it. Surfaces are mid tones rather than
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
    /** Oak where the crew work. */
    wood: "#c9a37d",
    /** Carpet in the monitoring room and the meeting room. */
    monitoring: "#3d4756",
    meeting: "#5f7a70",
    /** The kitchen's tiles. */
    kitchen: "#ebe8e2",
  },
  /** The server floor's perforated vent tiles, and the holes in them. */
  vent: "#8d9299",
  ventHoles: "#3a3d43",
  /** Lines round equipment on the floor: built, and space for it. */
  footprint: { built: "#3a4150", empty: "#7c828b" },
  /** The light bounced up from the floor onto the room. */
  bounce: "#55524d",
} as const;

/** The low-quality look's pixel floors: each a base, a lighter and a darker speck, and its grout or seams. */
export const PIXEL_FLOORS = {
  concrete: { base: "#9a968d", light: "#a29e95", dark: "#928e86", seam: "#86827a" },
  server: { base: "#a6aab1", light: "#aeb2b9", dark: "#9fa3aa", edge: "#b8bcc3", grout: "#7f838a" },
  wood: { tones: ["#b8875c", "#c08f63", "#ad7f55", "#bb8a5f"], seam: "#8f6542", grain: "#cf9f73" },
  monitoring: { base: "#3d4756", fleck: "#343d4a" },
  meeting: { base: "#5f7a70", fleck: "#536b62" },
  kitchen: { base: "#ebe8e2", alternate: "#dfdbd3", grout: "#a8a49c" },
} as const;
