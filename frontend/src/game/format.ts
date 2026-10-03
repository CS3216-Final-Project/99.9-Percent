export function money(v: number): string {
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 10_000) return `${sign}$${(a / 1000).toFixed(a >= 100_000 ? 0 : 1)}k`;
  return `${sign}$${Math.round(a).toLocaleString("en-US")}`;
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

export function compact(v: number): string {
  if (v >= 10_000) return `${(v / 1000).toFixed(v >= 100_000 ? 0 : 1)}k`;
  return num(v);
}

export function pct(v: number, digits = 0): string {
  return `${(v * 100).toFixed(digits)}%`;
}

/** Uptime with enough digits to tell 99.9 from 99.99. */
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
