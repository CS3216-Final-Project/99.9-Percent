import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
import type { chapter4Stage } from "@/game/chapter4Guidance";

// Presentation receipts, like the recovery notice: never part of a Campaign save.
const fallback = new Map<string, string[]>();
const unavailable = new Set<string>();
function receipts(key: string): string[] {
  try { const raw = localStorage.getItem(key); if (!raw) return unavailable.has(key) ? fallback.get(key) ?? [] : []; const value: unknown = JSON.parse(raw); return Array.isArray(value) ? value.filter(x => typeof x === "string") : []; }
  catch { return fallback.get(key) ?? []; }
}
export function Chapter4StagePopup({ model }: { model: NonNullable<ReturnType<typeof chapter4Stage>> }) {
  const key = `99.99.chapter4-cues:${model.key}`;
  const [dismissed, setDismissed] = useState(() => receipts(key));
  const cue = model.cues.find(x => !dismissed.includes(x.id));
  const id = cue?.id;
  useEffect(() => {
    if (!id) return;
    const seen = [...new Set([...receipts(key), id])];
    fallback.set(key, seen);
    try { localStorage.setItem(key, JSON.stringify(seen)); unavailable.delete(key); } catch { unavailable.add(key); }
  }, [key, id]);
  if (!cue) return null;
  const close = () => setDismissed(previous => [...previous, cue.id]);
  return createPortal(<div className="campaign-hint-card chapter4-stage-popup" role="dialog" aria-modal="false" aria-label={`Chapter 4: ${cue.title}`} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
    <div className="campaign-hint-heading"><h3><Icon name="bulb" />{cue.title}</h3><button type="button" className="icon-btn" aria-label="Dismiss chapter guidance" onClick={close}><Icon name="close" /></button></div>
    <div className="campaign-hint-copy" aria-live="polite"><p>{cue.message}</p></div>
    <button type="button" className="btn" onClick={close}>Got it</button>
  </div>, document.body);
}
