/*
 * Who works in the building. Each role has a silhouette you can tell apart at
 * a glance, even when a person is a few pixels tall: the developer's hoodie
 * and headphones, the SRE's flannel and headset, the PM's blazer, the
 * designer's beret, the intern's backwards cap and backpack, the founder's
 * puffer vest, the datacentre technician's hi-vis. Within a role, skin, hair,
 * colours and accessories vary with the person's number, so the same number
 * always gives the same person.
 */

export type Role = "dev" | "sre" | "pm" | "designer" | "data" | "intern" | "founder" | "security" | "tech" | "frontdesk" | "marketer";

export type HairStyle =
  | "short"
  | "long"
  | "bun"
  | "curly"
  | "buzz"
  | "pony"
  | "bald"
  | "afro"
  | "mohawk"
  | "locs"
  | "bob"
  | "sidepart"
  | "spacebuns"
  | "spiky";

/** Open-front tops (blazer, cardigan, overshirt, puffer) show the `under` layer down the middle. */
export type TopStyle = "tee" | "hoodie" | "shirt" | "bomber" | "blazer" | "turtleneck" | "puffer" | "hivis" | "cardigan" | "overshirt";
export type Sleeves = "short" | "long" | "rolled";
export type Bottom = "trousers" | "shorts" | "skirt";
export type Hat = "beanie" | "cap" | "capBack" | "bucket" | "beret";
export type Glasses = "round" | "square" | "shades";
export type Headset = "phones" | "mic";
export type Facial = "beard" | "moustache" | "goatee";
export type Bag = "backpack" | "sling" | "toolbelt";
export type Mouth = "smile" | "grin" | "flat" | "o";
export type Brows = "soft" | "raised" | "focused";

export interface Look {
  role: Role;
  skin: string;
  eyes: string;
  hair: string;
  hairStyle: HairStyle;
  top: string;
  topStyle: TopStyle;
  /** The shirt under an open or sleeveless top, which also gives a vest its sleeves. */
  under: string;
  sleeves: Sleeves;
  /** Prints, zips, ribbing and other trims. */
  accent: string;
  bottom: Bottom;
  /** Trousers, shorts or skirt. */
  pants: string;
  /** Bare legs below shorts or a skirt, or tights. */
  legs: string;
  socks: string;
  shoes: string;
  soles: string;
  boots: boolean;
  hat: Hat | null;
  hatColor: string;
  glasses: Glasses | null;
  headset: Headset | null;
  facial: Facial | null;
  bag: Bag | null;
  bagColor: string;
  gloves: string | null;
  earrings: boolean;
  watch: boolean;
  badge: boolean;
  blush: boolean;
  freckles: boolean;
  mouth: Mouth;
  brows: Brows;
  /** Overall size, about 0.88 to 1. */
  height: number;
  /** Shoulder width, about 0.92 to 1.08. */
  build: number;
  /** Depth of the body, about 0.92 to 1.17. */
  girth: number;
}

const SKINS = ["#f3cba5", "#d9a07a", "#a86b4a", "#6e4630", "#e8b48f", "#c68863", "#f6d5b8", "#8d5a3b", "#4f3122", "#ebc09a"];
const HAIRS = ["#1d1834", "#4a2c1d", "#7a4a2a", "#d9a441", "#2b2b3a", "#8a3b2a", "#b8b2c8", "#5a3a22"];
const BOLD_HAIR = ["#ff7ad9", "#2dd4bf", "#a985ff", "#4c6cff", "#ff6b4a", "#f2ecd8"];
const EYES = ["#4a2c1d", "#2b5d8a", "#3f6b3a", "#6b4a2a", "#1d1834", "#5a3a22"];
const MOUTHS: Mouth[] = ["smile", "smile", "grin", "flat", "smile", "o"];

/** A stable choice from a list for person n; `k` and `o` decorrelate different choices. */
function pick<T>(list: readonly T[], n: number, k: number, o = 0): T {
  return list[(n * k + o) % list.length];
}

function base(role: Role, n: number): Look {
  const skin = pick(SKINS, n, 7, 3);
  return {
    role,
    skin,
    eyes: pick(EYES, n, 5, 1),
    hair: pick(HAIRS, n, 3, 1),
    hairStyle: "short",
    top: "#4cb8ff",
    topStyle: "tee",
    under: "#f4f1ea",
    sleeves: "short",
    accent: pick(["#fff7e8", "#ffd84a", "#ff4d5e", "#4cb8ff", "#3ddc84"], n, 3, 2),
    bottom: "trousers",
    pants: pick(["#2b3150", "#3b4a7a", "#24242c", "#4a5568"], n, 2, 1),
    legs: skin,
    socks: "#f4f1ea",
    shoes: pick(["#f4f1ea", "#1d1834", "#e8e2ff", "#c0392b"], n, 3),
    soles: "#f4f1ea",
    boots: false,
    hat: null,
    hatColor: "#1d1834",
    glasses: null,
    headset: null,
    facial: null,
    bag: null,
    bagColor: "#1d1834",
    gloves: null,
    earrings: false,
    watch: false,
    badge: n % 3 !== 1,
    blush: n % 2 === 0,
    freckles: false,
    mouth: pick(MOUTHS, n, 5, 1),
    brows: "soft",
    height: 0.88 + ((n * 37) % 13) / 100,
    build: 0.92 + ((n * 53) % 17) / 100,
    girth: 0.92 + ((n * 29) % 11) / 40,
  };
}

const ROLES: Record<Role, (l: Look, n: number) => Look> = {
  dev: (l, n) => {
    const beanie = n % 3 === 0;
    const hairStyle = beanie ? pick(["short", "long"] as const, n, 1) : pick(["curly", "locs", "spiky", "short", "afro"] as const, n, 3);
    return {
      ...l,
      hairStyle,
      topStyle: "hoodie",
      sleeves: "long",
      top: pick(["#4cb8ff", "#3ddc84", "#a985ff", "#ff7ad9", "#2f2a55", "#ff9f43"], n, 5, 1),
      pants: pick(["#24242c", "#3b4a7a", "#4a5568"], n, 1),
      hat: beanie ? "beanie" : null,
      hatColor: pick(["#ff4d5e", "#ffd84a", "#1d1834", "#2dd4bf"], n, 1),
      // Headphones would vanish into an afro.
      headset: n % 2 === 0 && hairStyle !== "afro" ? "phones" : null,
      glasses: n % 4 === 1 ? "square" : null,
      brows: "focused",
    };
  },
  sre: (l, n) => ({
    ...l,
    hairStyle: pick(["short", "buzz", "bun", "long"] as const, n, 3),
    topStyle: "overshirt",
    sleeves: "rolled",
    top: pick(["#c0392b", "#2f7a4a", "#2b4a8a", "#8a3b2a"], n, 3, 1),
    under: pick(["#1d1834", "#f4f1ea", "#30295a"], n, 1),
    pants: pick(["#5a5a3a", "#3e3570", "#4a5568"], n, 1),
    headset: "mic",
    facial: n % 2 === 0 ? "beard" : null,
    watch: true,
    shoes: "#5a3a22",
    soles: "#2b2016",
    boots: true,
  }),
  pm: (l, n) => ({
    ...l,
    hairStyle: pick(["sidepart", "pony", "long", "bob"] as const, n, 1),
    topStyle: "blazer",
    sleeves: "long",
    top: pick(["#2b3150", "#b0875a", "#5b5f73", "#6b3a5a"], n, 3),
    under: pick(["#f4f1ea", "#a8c8e8", "#1d1834"], n, 2),
    pants: pick(["#c9b48a", "#2b3150", "#3e3a4a"], n, 1),
    shoes: "#4a2c1d",
    soles: "#2b2016",
    glasses: n % 2 ? "square" : null,
    badge: true,
    watch: true,
    mouth: "grin",
    brows: "raised",
  }),
  designer: (l, n) => {
    const skirt = n % 2 === 0;
    return {
      ...l,
      hairStyle: pick(["bob", "curly", "short", "long"] as const, n, 1),
      hair: n % 3 === 0 ? pick(BOLD_HAIR, n, 1) : l.hair,
      topStyle: "turtleneck",
      sleeves: "long",
      top: pick(["#e0a526", "#c0583a", "#8fae8b", "#1d1834"], n, 3),
      bottom: skirt ? "skirt" : "trousers",
      pants: skirt ? pick(["#1d1834", "#6b3a5a", "#2f4a7a"], n, 1) : "#e8dfc8",
      legs: skirt ? pick(["#1d1834", l.skin], n, 1) : l.skin,
      hat: n % 3 === 2 ? "bucket" : "beret",
      hatColor: pick(["#c0392b", "#1d1834", "#2dd4bf"], n, 1),
      glasses: "round",
      earrings: true,
      shoes: "#f4f1ea",
    };
  },
  data: (l, n) => ({
    ...l,
    hairStyle: pick(["bun", "pony", "spacebuns", "curly"] as const, n, 1),
    topStyle: "cardigan",
    sleeves: "long",
    top: pick(["#d9c9a8", "#3b5a40", "#6b3a5a", "#7a8fb8"], n, 3),
    under: pick(["#e8f0ff", "#f4f1ea", "#ffd84a"], n, 1),
    glasses: "round",
    freckles: true,
    bag: "sling",
    bagColor: pick(["#5a3a22", "#1d1834", "#c0583a"], n, 1),
  }),
  intern: (l, n) => ({
    ...l,
    hairStyle: pick(["short", "curly", "pony"] as const, n, 1),
    topStyle: "tee",
    sleeves: "short",
    top: pick(["#ffc53d", "#ff6b6b", "#2dd4bf", "#a985ff"], n, 3),
    accent: pick(["#1d1834", "#fff7e8", "#4cb8ff"], n, 1),
    bottom: "shorts",
    pants: pick(["#3b4a7a", "#c9b48a", "#2b3150"], n, 1),
    socks: "#f4f1ea",
    shoes: pick(["#ff4d5e", "#4cb8ff", "#f4f1ea"], n, 1),
    hat: "capBack",
    hatColor: pick(["#4cb8ff", "#ff4d5e", "#3ddc84", "#1d1834"], n, 1),
    bag: "backpack",
    bagColor: pick(["#ff7ad9", "#4cb8ff", "#ffd84a", "#2f2a55"], n, 3),
    badge: true,
    mouth: "grin",
    brows: "raised",
    blush: true,
  }),
  founder: (l, n) => ({
    ...l,
    hairStyle: pick(["buzz", "sidepart", "bald", "short"] as const, n, 1),
    topStyle: "puffer",
    sleeves: "long",
    top: pick(["#1d1834", "#2f4a7a", "#3a3a3a", "#5a3a22"], n, 1),
    under: pick(["#f4f1ea", "#a8c8e8", "#d9d4f0"], n, 1),
    pants: "#2b3150",
    shoes: "#f4f1ea",
    facial: pick(["goatee", "beard", null, "moustache"] as const, n, 1),
    watch: true,
    badge: false,
    mouth: "smile",
  }),
  security: (l, n) => ({
    ...l,
    hairStyle: "mohawk",
    hair: pick(BOLD_HAIR, n, 1),
    topStyle: "hoodie",
    sleeves: "long",
    top: "#1f1d2b",
    accent: pick(["#3ddc84", "#ff4d5e", "#4cb8ff"], n, 1),
    pants: "#1f1d2b",
    shoes: "#1d1834",
    soles: "#3ddc84",
    glasses: "shades",
    bag: "sling",
    bagColor: "#2b2b3a",
    earrings: true,
    mouth: "flat",
    brows: "focused",
  }),
  tech: (l, n) => ({
    ...l,
    hairStyle: pick(["short", "pony", "buzz"] as const, n, 1),
    topStyle: "hivis",
    sleeves: "long",
    top: pick(["#d8ff3a", "#ff9f1a"], n, 1),
    under: "#2b3150",
    pants: "#3e3570",
    hat: "cap",
    hatColor: "#2b3150",
    bag: "toolbelt",
    bagColor: "#6b4a2a",
    gloves: "#30295a",
    shoes: "#1d1834",
    soles: "#ffd84a",
    boots: true,
    badge: true,
  }),
  frontdesk: (l, n) => ({
    ...l,
    hairStyle: pick(["long", "bob", "curly"] as const, n, 1),
    topStyle: "cardigan",
    sleeves: "long",
    top: pick(["#ff9be3", "#a8d8ff", "#c9f2d0"], n, 1),
    under: "#f4f1ea",
    bottom: n % 2 ? "skirt" : "trousers",
    pants: pick(["#2b3150", "#6b3a5a"], n, 1),
    headset: "mic",
    earrings: true,
    mouth: "grin",
    blush: true,
  }),
  marketer: (l, n) => {
    const afro = n % 2 === 0;
    return {
      ...l,
      hairStyle: afro ? "afro" : pick(["short", "pony", "sidepart"] as const, n, 1),
      topStyle: "bomber",
      sleeves: "long",
      top: pick(["#ff7ad9", "#ff9f43", "#3ddc84", "#a985ff"], n, 3),
      accent: pick(["#1d1834", "#fff7e8", "#ffd84a"], n, 1),
      under: "#f4f1ea",
      pants: pick(["#e8dfc8", "#2b3150", "#24242c"], n, 1),
      shoes: pick(["#ffd84a", "#4cb8ff", "#f4f1ea"], n, 1),
      hat: afro ? null : "bucket",
      hatColor: pick(["#fff7e8", "#1d1834", "#ffd84a"], n, 1),
      glasses: n % 3 === 0 ? "shades" : null,
      earrings: n % 2 === 1,
      mouth: "grin",
      brows: "raised",
    };
  },
};

/** The roles people at desks and in passing cycle through, so neighbours look different. */
const ROTATION: Role[] = ["dev", "data", "sre", "designer", "intern", "security", "dev", "marketer", "founder", "pm", "frontdesk"];

export const ALL_ROLES = Object.keys(ROLES) as Role[];

/** A stable, varied look for the nth person in the office, optionally in a given role. */
export function look(n: number, role: Role = ROTATION[n % ROTATION.length]): Look {
  return ROLES[role](base(role, n), n);
}
