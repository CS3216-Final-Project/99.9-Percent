import { useLayoutEffect, useState, type ReactNode } from "react";
import type { ChapterCompanyMessage as Message } from "@/game/chapterCompanyMessage";
import { presentationReceipts, recordPresentationReceipt } from "@/game/presentationReceipts";
import { VisualNovelDialogue } from "./VisualNovelDialogue";

/** One optional narrative slot: introduction first, then the still-current stage cue. */
export function ChapterCompanyMessage({ model, enabled, children, onOpen }: { model: Message; enabled: boolean; children?: ReactNode; onOpen?: (open: boolean) => void }) {
  const [state, setState] = useState(() => ({ enabled, dismissed: presentationReceipts(model.key).includes("intro") }));
  // An already-shown optional message yields permanently when a higher priority
  // takes over; an unseen message stays pending. No effect-driven render cascade.
  const interrupted = state.enabled && !enabled && presentationReceipts(model.key).includes("intro");
  const dismissed = state.dismissed || interrupted;
  if (state.enabled !== enabled) setState({ enabled, dismissed });
  useLayoutEffect(() => {
    if (enabled && !dismissed && !document.querySelector(".modal-backdrop")) {
      recordPresentationReceipt(model.key, "intro");
    }
  }, [enabled, dismissed, model.key]);
  // Owners that must wait for the introduction learn when it is on screen.
  const open = enabled && !dismissed;
  useLayoutEffect(() => { onOpen?.(open); }, [open, onOpen]);
  useLayoutEffect(() => () => onOpen?.(false), [onOpen]);
  if (!enabled) return null;
  if (dismissed) return children;
  return <VisualNovelDialogue label="Company Message" lines={model.lines.map(text => ({ speaker: model.speaker, text }))}
    ending={<p className="dialogue-ending"><strong>Your mission:</strong> {model.mission}</p>}
    endLabel="Got it" dismissLabel="Dismiss company message" close={() => setState({ enabled, dismissed: true })}/>;
}
