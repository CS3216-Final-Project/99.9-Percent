/*
 * Who works in the building: a crew of friendly monsters, CC0 models from
 * Quaternius's Ultimate Monsters pack (see public/models/creatures). Each office
 * role is played by a species you can tell apart at a glance: a cat writes the
 * code, a yeti is on call, a monkey runs the meetings, a bee does marketing.
 *
 * Species come in three body plans with different animation sets: round
 * "blobs" on little feet, bigger two-legged "bigs" and a hovering "flyer".
 */

export type Role = "dev" | "sre" | "pm" | "designer" | "data" | "intern" | "founder" | "security" | "tech" | "frontdesk" | "marketer";

export type Kind = "blob" | "big" | "flyer";

export type Species =
  | "cat"
  | "birb"
  | "greenBlob"
  | "yeti"
  | "monkroose"
  | "pigeon"
  | "pinkSlime"
  | "mushnub"
  | "chick"
  | "mushnubKing"
  | "ninja"
  | "frog"
  | "bunny"
  | "bee";

export interface SpeciesInfo {
  /** File name under /models/creatures, without .glb. */
  file: string;
  kind: Kind;
  /** Standing height in metres. */
  height: number;
}

export const SPECIES: Record<Species, SpeciesInfo> = {
  cat: { file: "Cat", kind: "blob", height: 0.62 },
  birb: { file: "Birb", kind: "blob", height: 0.62 },
  greenBlob: { file: "GreenBlob", kind: "blob", height: 0.58 },
  pigeon: { file: "Pigeon", kind: "blob", height: 0.62 },
  pinkSlime: { file: "PinkSlime", kind: "blob", height: 0.6 },
  mushnub: { file: "Mushnub", kind: "blob", height: 0.7 },
  chick: { file: "Chicken", kind: "blob", height: 0.6 },
  mushnubKing: { file: "MushnubEvolved", kind: "blob", height: 0.78 },
  ninja: { file: "Ninja", kind: "blob", height: 0.64 },
  yeti: { file: "Yeti", kind: "big", height: 1.35 },
  monkroose: { file: "Monkroose", kind: "big", height: 1.25 },
  frog: { file: "Frog", kind: "big", height: 1.2 },
  bunny: { file: "Bunny", kind: "big", height: 1.3 },
  bee: { file: "Armabee", kind: "flyer", height: 0.6 },
};

export const ALL_SPECIES = Object.keys(SPECIES) as Species[];

/** The species that play each role; where there are several, people alternate between them. */
const CASTING: Record<Role, Species[]> = {
  dev: ["cat", "birb", "greenBlob"],
  sre: ["yeti"],
  pm: ["monkroose"],
  designer: ["pigeon", "pinkSlime"],
  data: ["mushnub"],
  intern: ["chick"],
  founder: ["mushnubKing"],
  security: ["ninja"],
  tech: ["frog"],
  frontdesk: ["bunny"],
  marketer: ["bee"],
};

export const ALL_ROLES = Object.keys(CASTING) as Role[];

/** The roles people at desks and in passing cycle through, so neighbours differ. */
const ROTATION: Role[] = ["dev", "data", "sre", "designer", "intern", "security", "dev", "marketer", "founder", "pm", "frontdesk"];

/** The species of the nth person in the office, optionally in a given role. The same number always gives the same answer. */
export function creature(n: number, role: Role = ROTATION[n % ROTATION.length]): Species {
  const options = CASTING[role];
  // Neighbouring numbers share a species, so developers at desks 0 and 6 come out different.
  return options[Math.floor(n / 3) % options.length];
}

/* ------------------------------------------------------------------ */
/* What each activity looks like                                       */
/* ------------------------------------------------------------------ */

export type Activity = "type" | "relax" | "mug" | "laptop" | "idle" | "chat" | "walk" | "listen" | "present" | "panic" | "play";

/** The animations each body plan comes with. */
export const CLIPS: Record<Kind, readonly string[]> = {
  blob: ["Bite_Front", "Dance", "Death", "HitRecieve", "Idle", "Jump", "No", "Walk", "Yes"],
  big: ["Death", "Duck", "HitReact", "Idle", "Jump", "Jump_Idle", "Jump_Land", "No", "Punch", "Run", "Walk", "Wave", "Weapon", "Yes"],
  flyer: ["Death", "Fast_Flying", "Flying_Idle", "Headbutt", "HitReact", "No", "Punch", "Yes"],
};

export interface Motion {
  clip: string;
  /** Playback speed. */
  speed: number;
}

/**
 * The animation for an activity. Working creatures bob quickly at their desks,
 * listeners nod, presenters wave, and during an incident everyone shakes their
 * head. Flyers hover through everything except walking, which they fly.
 */
export function motionFor(kind: Kind, activity: Activity): Motion {
  if (kind === "flyer") {
    if (activity === "walk") return { clip: "Fast_Flying", speed: 1 };
    if (activity === "play") return { clip: "Headbutt", speed: 1 };
    if (activity === "panic") return { clip: "No", speed: 1.3 };
    if (activity === "listen" || activity === "chat") return { clip: "Yes", speed: 0.8 };
    return { clip: "Flying_Idle", speed: 1 };
  }
  switch (activity) {
    case "walk":
      return { clip: "Walk", speed: 1 };
    case "type":
      return { clip: "Idle", speed: 1.5 };
    case "listen":
      return { clip: "Yes", speed: 0.6 };
    case "chat":
      return { clip: "Yes", speed: 0.9 };
    case "present":
      return kind === "big" ? { clip: "Wave", speed: 0.8 } : { clip: "Yes", speed: 0.9 };
    case "panic":
      return { clip: "No", speed: 1.3 };
    case "play":
      // A swing: the big species swing an arm, the small ones lunge.
      return kind === "big" ? { clip: "Weapon", speed: 1 } : { clip: "Bite_Front", speed: 1 };
    case "relax":
      return kind === "blob" ? { clip: "Dance", speed: 0.5 } : { clip: "Idle", speed: 0.8 };
    default:
      return { clip: "Idle", speed: 1 };
  }
}
