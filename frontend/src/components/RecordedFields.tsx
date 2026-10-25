import { Fragment } from "react";

type Value = unknown;
const dollars = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

/**
 * Engine bookkeeping a player never needs: identifiers, versions and copied configuration. The acknowledgement flag
 * is the dialog's own state, so it would only ever read "no" while the dialog asks for it.
 */
const HIDDEN = /^(id|.*Id|.*Version|version|configuration|snapshot|snapshotStep|acknowledged)$/;
/** Shares and rates the engine stores in basis points (6,000 means 60%). */
const BASIS_POINTS = /(BasisPoints|[Hh]itRate|[Hh]itRateUsed|[Ww]armth|[Ww]armthUsed|[Ww]armthAfterStep|[Ss]hare)$/;

/** "dbAfter" reads as "Database after"; trailing units become words a student recognises. */
function label(key: string) {
  const words = key.replace(/BasisPoints$/, "").replace(/Cents$/, "").replace(/Step$/, " game second").replace(/Ms$/, " ms").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").toLowerCase().replace(/\bdb\b/g, "database").replace(/\bapp\b/g, "application").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
function format(key: string, value: Value): string {
  if (value === null || value === undefined) return "none";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return /Cents$/.test(key) ? dollars(value) : (BASIS_POINTS.test(key) || key === "target" || key === "cacheTarget") ? `${Math.round(value) / 100}%` : Number.isInteger(value) ? value.toLocaleString("en-US") : String(Math.round(value * 100) / 100);
  if (typeof value === "string") {
    // Routes and lists are stored as JSON text; read them back instead of printing braces.
    if (/^[[{]/.test(value)) {
      try { return format(key, JSON.parse(value) as Value); } catch { /* Not JSON after all: show it as text. */ }
    }
    return value.replace(/^app-(\d+)$/, "App $1").replaceAll("-", " ");
  }
  if (!Array.isArray(value) && typeof value === "object" && Array.isArray((value as { targets?: unknown }).targets)) {
    const r = value as { mode?: string; targets: string[] };
    return `${r.targets.map(t => t.replace("app-", "App ")).join(", ")}${r.mode ? ` (${r.mode})` : ""}`;
  }
  if (Array.isArray(value)) return value.every(v => typeof v !== "object" || v === null) ? value.map(v => format(key, v)).join(", ") || "none" : `${value.length} recorded ${value.length === 1 ? "entry" : "entries"}`;
  return "recorded";
}
/** Flatten one level of nesting so a record reads as label/value pairs, never as raw JSON. */
function entries(data: Record<string, Value>, prefix = ""): [string, string][] {
  return Object.entries(data).filter(([key]) => !HIDDEN.test(key)).flatMap(([key, value]) =>
    value && typeof value === "object" && !Array.isArray(value) && !Array.isArray((value as { targets?: unknown }).targets) && !prefix
      ? entries(value as Record<string, Value>, label(key))
      : [[prefix ? `${prefix} · ${label(key).toLowerCase()}` : label(key), format(key, value)] as [string, string]]);
}

/** A recorded engine object shown as a compact definition list. */
export function RecordedFields({ data }: { data: object }) {
  const rows = entries(data as Record<string, Value>);
  if (!rows.length) return null;
  return <dl className="recorded-fields">{rows.map(([k, v], i) => <Fragment key={i}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>;
}
