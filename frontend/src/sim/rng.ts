/**
 * Seeded randomness (mulberry32). The generator state lives inside GameState,
 * so a saved run continues with exactly the same sequence after a refresh.
 */
export interface RngHolder {
  rngState: number;
}

export function rand(s: RngHolder): number {
  s.rngState = (s.rngState + 0x6d2b79f5) | 0;
  let t = s.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randRange(s: RngHolder, min: number, max: number): number {
  return min + rand(s) * (max - min);
}

export function pick<T>(s: RngHolder, items: readonly T[]): T {
  return items[Math.min(items.length - 1, Math.floor(rand(s) * items.length))];
}

/** Turn any integer or string into a usable 32-bit seed. */
export function normaliseSeed(input: number | string): number {
  if (typeof input === "number" && Number.isFinite(input)) return Math.floor(input) | 0;
  let h = 2166136261;
  const str = String(input);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}
