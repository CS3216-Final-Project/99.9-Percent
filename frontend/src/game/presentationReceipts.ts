// Browser-local presentation receipts. Never part of a Campaign save or engine input.
const fallback = new Map<string, string[]>();
const unavailable = new Set<string>();
export function presentationReceipts(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return unavailable.has(key) ? fallback.get(key) ?? [] : [];
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(x => typeof x === "string") : [];
  } catch { return fallback.get(key) ?? []; }
}
export function recordPresentationReceipt(key: string, id: string): void {
  const seen = [...new Set([...presentationReceipts(key), id])];
  fallback.set(key, seen);
  try { localStorage.setItem(key, JSON.stringify(seen)); unavailable.delete(key); }
  catch { unavailable.add(key); }
}
