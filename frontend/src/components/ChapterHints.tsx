import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useGame } from "@/game/store";
import { confirmingAction, subscribeConfirming } from "./actionConfirmation";
import { useGuidanceCue } from "./useGuidanceCue";
import { Modal } from "./ui";
import { campaignNextView as campaignNextStep, setTrafficHint, useTrafficHint, rememberHintOffer, useHintOffers } from "./chapterHintAttention";

export function ChapterHints() {
  const { game, running, started, view, tour, roomInspection, chapterComplete, generation } = useGame();
  const model = useMemo(() => campaignNextStep(game, running), [game, running]);
  const key = `${generation}:${model?.key}`;
  const accepted = useTrafficHint();
  const confirmation = useSyncExternalStore(subscribeConfirming, confirmingAction);
  const [dialog, setDialog] = useState<{ key: string; page: "offer" | "hint" } | null>(null);
  const offered = useHintOffers();
  const revealed = useRef<string | null>(null);
  const decisionRevealed = useRef<string | null>(null);
  const hintButton = useRef<HTMLButtonElement>(null);
  // Chapter 0 is hidden during incidents; its saved lesson must not suppress incident help.
  const tutorialVisible = !!tour && !(tour.track === "campaign" && game.phase === "incident");
  const eligible = !!model?.eligible && started && !view && !tutorialVisible && !roomInspection && !chapterComplete && !confirmation;
  const manual = !!model?.manualEligible && started &&
    !view && !tutorialVisible && !roomInspection && !chapterComplete && !confirmation;
  const offer = useGuidanceCue(key, eligible && !dialog && !accepted && !offered.has(key), 15_000, "offer");
  const hintCue = useGuidanceCue(key, eligible && (!model.decision || model.target === "risk") && !dialog && !accepted && !offered.has(key), 10_000, "hint");
  const decisionCue = useGuidanceCue(key, manual && !running && model.decision && model.target !== "risk" && !dialog, 12_000, "decision");
  useEffect(() => {
    if (hintCue) hintButton.current?.scrollIntoView?.({block:"nearest"});
  }, [hintCue]);
  // One owner for contextual attention. Resolve to a visible entry control (for example
  // the routing disclosure), never open a panel or execute an action on the player's behalf.
  useEffect(() => {
    if ((!accepted && !decisionCue) || !manual || dialog || running || model.target === "run" || model.target === "traffic") return;
    let lit: HTMLElement | null = null;
    const update = () => {
      lit?.classList.remove("campaign-context-cue"); lit = null;
      if (document.hidden || document.querySelector(".modal-backdrop, .tour, .chapter-zero-modal, .sheet, .campaign-guidance-cue")) return;
      const candidate = document.querySelector<HTMLElement>(`[data-guidance="${model.target}"]`);
      if (!candidate || candidate.matches(":disabled") || candidate.closest("fieldset:disabled")) return;
      const style = getComputedStyle(candidate);
      if (style.display === "none" || style.visibility === "hidden") return;
      lit = candidate; lit.classList.add("campaign-context-cue");
      if (decisionCue && !accepted && decisionRevealed.current !== key) {
        decisionRevealed.current = key;
        candidate.scrollIntoView?.({block:"nearest"});
      }
      if (accepted && revealed.current !== key) {
        revealed.current = key;
        candidate.scrollIntoView?.({block:"center"});
        candidate.focus({preventScroll:true});
      }
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "hidden", "open"] });
    document.addEventListener("visibilitychange", update);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", update); lit?.classList.remove("campaign-context-cue"); };
  }, [accepted, decisionCue, manual, dialog, running, model.target, key]);
  useEffect(() => { setTrafficHint(null); }, [key]);
  useEffect(() => () => setTrafficHint(null), []);
  // Automatic offers never change the clock. Record the offer after commit, so
  // shared visit-only suppression also survives this entry control remounting.
  if (offer && !dialog && !offered.has(key)) setDialog({ key, page: "offer" });
  useEffect(() => {
    if (dialog?.page === "offer") rememberHintOffer(dialog.key);
  }, [dialog]);
  if (dialog && (dialog.key !== key || !manual)) setDialog(null);
  const close = () => { rememberHintOffer(key); setDialog(null); };
  const visible = manual && dialog?.key === key;
  if (!model) return null;
  return <>
    <button ref={hintButton} type="button" className={`btn btn-small${hintCue && !visible ? " campaign-context-cue" : ""}`} disabled={!manual} aria-haspopup="dialog" onClick={() => {
      if (document.querySelector(".modal-backdrop, .tour, .chapter-zero-modal, .sheet")) return;
      setTrafficHint(null);
      useGame.getState().setRunning(false); setDialog({ key, page: "hint" });
    }}>Hint</button>
    {visible && createPortal(<Modal title={dialog.page === "offer" ? "Need a little help?" : "Here's a hint"} onClose={close}>
      <p>{dialog.page === "offer" ? "Would you like a hint about what to do next?" : model.message}</p>
      <div className="modal-foot">{dialog.page === "offer" ? <>
        <button className="btn btn-primary" onClick={() => setDialog({ key, page: "hint" })}>Yes, show hint</button>
        <button className="btn" onClick={close}>No, thanks</button>
      </> : <button className="btn btn-primary" onClick={() => {
        if (model.target) setTrafficHint(key);
        close();
      }}>Got it</button>}</div>
    </Modal>, document.body)}
  </>;
}
