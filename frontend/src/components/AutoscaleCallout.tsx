import { useEffect, useMemo, useRef, useState } from "react";
import { autoscaleSpot } from "@/game/autoscaleSpotlight";
import { useGame } from "@/game/store";
import { Icon } from "./icons";
import "./AutoscaleCallout.css";

const GAP = 14, MARGIN = 8;

/**
 * A small note beside the server the autoscaler just changed, so its moves are seen where they happen in the room.
 * It follows the server's label as the camera moves, never pauses the game, and steps aside for dialogs and sheets;
 * the event toast still reports the move when the label is out of view.
 */
export function AutoscaleCallout() {
  const campaign = useGame(s => s.game.campaign);
  const hidden = useGame(s => !s.started || s.view !== null);
  const spot = useMemo(() => autoscaleSpot(campaign), [campaign]);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const show = !!spot && !hidden && dismissed !== spot.key;
  const anchor = spot?.appId ?? "app";

  useEffect(() => {
    if (!show) return;
    let frame = 0;
    const place = () => {
      const node = card.current;
      const label = document.querySelector<HTMLElement>(`.eq-label[data-eq="${anchor}"]`);
      // The scene shows a label only once it has been projected onto the screen.
      const visible = !!label && label.style.visibility === "visible" && !document.querySelector(".modal-backdrop");
      if (node) {
        node.dataset.anchored = String(visible);
        if (visible) {
          const r = label.getBoundingClientRect(), w = node.offsetWidth, h = node.offsetHeight;
          const x = Math.max(MARGIN, Math.min(innerWidth - w - MARGIN, r.left + r.width / 2 - w / 2));
          const above = r.top - GAP - h;
          node.dataset.side = above >= MARGIN ? "above" : "below";
          node.style.transform = `translate(${Math.round(x)}px, ${Math.round(above >= MARGIN ? above : r.bottom + GAP)}px)`;
          node.style.setProperty("--tail-x", `${Math.round(r.left + r.width / 2 - x)}px`);
        }
      }
      frame = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(frame);
  }, [show, anchor]);

  if (!show) return null;
  return <div ref={card} className="autoscale-callout" data-anchored="false" role="status" aria-live="polite" aria-label="Autoscaling">
    <div className="autoscale-callout-head"><Icon name="robot" size={18} /><strong>{spot.title}</strong>
      <button type="button" className="icon-btn" aria-label="Dismiss autoscaling note" onClick={() => setDismissed(spot.key)}><Icon name="close" size={16} /></button></div>
    <p>{spot.message}</p>
  </div>;
}
