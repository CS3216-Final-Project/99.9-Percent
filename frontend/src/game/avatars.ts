/*
 * The player's avatars: the cube animals from Kenney's Cube Pets that the office crew do not already have, so the
 * player always stands out from the crew. The choice is a browser setting like the graphics quality: it is not part
 * of any saved game, and it can be changed at any time.
 */

export const AVATARS = [
  { id: "fox", name: "Fox" },
  { id: "panda", name: "Panda" },
  { id: "penguin", name: "Penguin" },
  { id: "tiger", name: "Tiger" },
  { id: "koala", name: "Koala" },
  { id: "dog", name: "Dog" },
  { id: "lion", name: "Lion" },
  { id: "polar", name: "Polar bear" },
  { id: "pig", name: "Pig" },
  { id: "cow", name: "Cow" },
  { id: "deer", name: "Deer" },
  { id: "elephant", name: "Elephant" },
  { id: "giraffe", name: "Giraffe" },
  { id: "beaver", name: "Beaver" },
  { id: "hog", name: "Hog" },
  { id: "crab", name: "Crab" },
  { id: "fish", name: "Fish" },
  { id: "caterpillar", name: "Caterpillar" },
] as const;

export type AvatarId = (typeof AVATARS)[number]["id"];

export const DEFAULT_AVATAR: AvatarId = "fox";

export function isAvatar(value: unknown): value is AvatarId {
  return AVATARS.some((a) => a.id === value);
}

export function avatarName(id: AvatarId): string {
  return AVATARS.find((a) => a.id === id)?.name ?? id;
}

/** Where an avatar's model and its picture in the picker are served from. */
export const avatarModel = (id: AvatarId) => `/models/avatars/${id}.glb`;
export const avatarPicture = (id: AvatarId) => `/models/avatars/previews/${id}.png`;
