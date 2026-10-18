import { useEffect, useState } from "react";

/** Transient emphasis: never changes focus, clock state or the underlying decision. */
export function useGuidanceCue(instruction: string | null, eligible: boolean, delay: number, kind: "run" | "offer" | "hint" | "decision" | "confirm" | "pause" = "run") {
  const [visible, setVisible] = useState<string | null>(null);
  useEffect(() => {
    if (!instruction || !eligible) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const blocked = () => document.hidden || !!document.querySelector(".chapter-zero-modal") || !!document.querySelector(kind !== "run" ? ".modal-backdrop, .tour, .sheet" : ".modal-backdrop");
    let covered = blocked();
    const stop = () => { clearTimeout(timer); setVisible(null); };
    const start = () => {
      clearTimeout(timer);
      if (covered) return;
      timer = setTimeout(() => {
        if (blocked()) return;
        setVisible(instruction);
      }, delay);
    };
    const activity = () => { if (kind === "run" || kind === "offer" || kind === "hint" || kind === "decision") { stop(); start(); } };
    const dragging = (event: Event) => { if ("buttons" in event && Number(event.buttons) > 0) activity(); };
    const exploring = (event: Event) => {
      if ("pointerType" in event && event.pointerType === "touch") return;
      // Revealing an idle decision may move it under a stationary pointer.
      // Only Run guidance treats hover alone as a fresh interaction.
      if (kind === "run" && event.target instanceof Element && event.target.closest(".eq-label, .campaign-panel button, .campaign-action-card")) activity();
    };
    const visibility = () => {
      const next = blocked();
      if (next === covered) return;
      covered = next; stop(); start();
    };
    const observer = new MutationObserver(records => {
      visibility();
      if (records.some(record => record.type === "attributes" && record.target instanceof HTMLDetailsElement)) activity();
    });
    observer.observe(document.body, { childList: true, subtree: true,
      ...(kind === "offer" || kind === "hint" ? {attributes:true, attributeFilter:["open"]} : {}) });
    // A disclosure is evidence to read, not an indefinite modal. Opening/closing
    // it starts a fresh interval, including keyboard and programmatic toggles.
    for (const event of ["pointerdown", "keydown", "wheel", "focusin"]) document.addEventListener(event, activity, true);
    document.addEventListener("pointerover", exploring, true);
    document.addEventListener("pointermove", dragging, true);
    document.addEventListener("visibilitychange", visibility);
    start();
    return () => {
      setVisible(null);
      clearTimeout(timer); observer.disconnect();
      for (const event of ["pointerdown", "keydown", "wheel", "focusin"]) document.removeEventListener(event, activity, true);
      document.removeEventListener("pointerover", exploring, true);
      document.removeEventListener("pointermove", dragging, true);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [instruction, eligible, delay, kind]);
  return instruction !== null && visible === instruction && eligible;
}
