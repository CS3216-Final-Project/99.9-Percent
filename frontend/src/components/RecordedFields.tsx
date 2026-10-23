import { Fragment } from "react";

type Value = unknown;
const dollars = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

/** "dbAfter" reads as "Db after"; trailing units become words a student recognises. */
function label(key: string) {
  const words = key.replace(/Cents$/, "").replace(/Step$/, " game second").replace(/Ms$/, " ms").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
function format(key: string, value: Value): string {
  if (value === null || value === undefined) return "none";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return /Cents$/.test(key) ? dollars(value) : Number.isInteger(value) ? value.toLocaleString("en-US") : String(Math.round(value * 100) / 100);
  if (typeof value === "string") return value.replaceAll("-", " ");
  if (Array.isArray(value)) return value.every(v => typeof v !== "object" || v === null) ? value.map(v => format(key, v)).join(", ") || "none" : `${value.length} recorded ${value.length === 1 ? "entry" : "entries"}`;
  return "recorded";
}
/** Flatten one level of nesting so a record reads as label/value pairs, never as raw JSON. */
function entries(data: Record<string, Value>, prefix = ""): [string, string][] {
  return Object.entries(data).flatMap(([key, value]) =>
    value && typeof value === "object" && !Array.isArray(value) && !prefix
      ? entries(value as Record<string, Value>, label(key))
      : [[prefix ? `${prefix} · ${label(key).toLowerCase()}` : label(key), format(key, value)] as [string, string]]);
}

/** A recorded engine object shown as a compact definition list. */
export function RecordedFields({ data }: { data: object }) {
  const rows = entries(data as Record<string, Value>);
  if (!rows.length) return null;
  return <dl className="recorded-fields">{rows.map(([k, v], i) => <Fragment key={i}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>;
}
