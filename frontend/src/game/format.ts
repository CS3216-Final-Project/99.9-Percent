/** A unit for large numbers: its size, its suffix and how many decimals a value of it keeps. */
type Unit = readonly [size: number, suffix: string, decimals: (scaled: number) => number];

/**
 * A magnitude in the largest unit it reaches. Rounding can carry it into the next unit, so 999,999 reads 1.0M rather
 * than 1000k.
 */
function scaled(a: number, units: readonly Unit[]): string {
  let i = units.findLastIndex(([size]) => a >= size);
  for (;;) {
    const [size, suffix, decimals] = units[i];
    const text = (a / size).toFixed(decimals(a / size));
    const next = units[i + 1];
    if (next && Number(text) * size >= next[0]) { i++; continue; }
    return `${text}${suffix}`;
  }
}

/** One decimal below 100 of a unit (12.5k), none from there (125k). */
const tenths = (x: number) => (x >= 99.95 ? 0 : 1);

// Thousands keep one decimal below $100k and none above; millions and billions keep two.
const MONEY_UNITS: Unit[] = [[1_000, "k", tenths], [1_000_000, "M", () => 2], [1_000_000_000, "B", () => 2]];

export function money(v: number): string {
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  if (a < 10_000) return `${sign}$${Math.round(a).toLocaleString("en-US")}`;
  return `${sign}$${scaled(a, MONEY_UNITS)}`;
}

export function moneyFull(v: number): string {
  return `${v < 0 ? "-" : ""}$${Math.round(Math.abs(v)).toLocaleString("en-US")}`;
}

export function signedMoney(v: number): string {
  return `${v >= 0 ? "+" : "-"}${money(Math.abs(v))}`;
}

export function num(v: number): string {
  return Math.round(v).toLocaleString("en-US");
}

const COUNT_UNITS: Unit[] = [[1_000, "k", tenths], [1_000_000, "M", tenths], [1_000_000_000, "B", tenths]];

/** A count in a few characters: exact below 10,000, then k, M and B with one decimal below 100 of the unit. */
export function compact(v: number): string {
  if (Math.abs(v) < 10_000) return num(v);
  return `${v < 0 ? "-" : ""}${scaled(Math.abs(v), COUNT_UNITS)}`;
}

export function pct(v: number, digits = 0): string {
  return `${(v * 100).toFixed(digits)}%`;
}

/** Uptime with enough digits to tell 99.9 from 99.99. */
/** How many nines an uptime figure holds: 0.95 is one, 0.999 is three, perfect service counts as five. */
export function ninesOf(uptime: number): number {
  if (uptime >= 1) return 5;
  return Math.max(0, Math.floor(-Math.log10(1 - uptime)));
}

export function uptimePct(v: number): string {
  if (v >= 0.99995) return "100%";
  return `${(v * 100).toFixed(v >= 0.999 ? 3 : 2)}%`;
}

export function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function plural(n: number, word: string, many = `${word}s`): string {
  return `${n} ${n === 1 ? word : many}`;
}
