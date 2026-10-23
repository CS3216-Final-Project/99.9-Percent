/** The five colleagues who speak in Guided Mode, with what each portrait shows for its alt text. */
export const COLLEAGUES = {
  maya: { name: "Maya", role: "Customer Support", character: "a purple eyeball creature with a headset and a green visor", celebrating: "the purple eyeball creature cheering, its eye sparkling" },
  alex: { name: "Alex", role: "CEO", character: "a black and gold dragon in a pinstripe suit", celebrating: "the dragon in a pinstripe suit raising a glass" },
  jordan: { name: "Jordan", role: "Software Engineer", character: "a stone golem in a navy hoodie and glasses", celebrating: "the stone golem pumping both fists in the air" },
  sam: { name: "Sam", role: "Marketing", character: "a fire imp in a backwards cap, holding a phone", celebrating: "the fire imp cheering with both fists up" },
  taylor: { name: "Taylor", role: "Operations Engineer", character: "a hooded skeleton holding a coffee cup, with a pager clipped on", celebrating: "the hooded skeleton cheering with both arms raised" },
} as const;
export type ColleagueId = keyof typeof COLLEAGUES;
export type Mood = "working" | "celebrating";

/** One spoken line in a visual novel scene. */
export interface DialogueLine { speaker: ColleagueId; text: string; mood?: Mood }

export function colleaguePortrait(speaker: ColleagueId, mood: Mood = "working") {
  const c = COLLEAGUES[speaker];
  return { src: `/characters/${speaker}${mood === "celebrating" ? "-celebrating" : ""}.webp`, alt: `${c.name}, ${mood === "celebrating" ? c.celebrating : c.character}` };
}
