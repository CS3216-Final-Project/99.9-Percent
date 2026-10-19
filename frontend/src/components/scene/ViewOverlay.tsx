"use client";

import { useEffect, useState } from "react";
import { useGame } from "@/game/store";
import { mouse, viewNow } from "./viewState";

/** Leave first person for the overview, ending the walk, as Escape does once the cursor is back. */
function leave() {
  useGame.getState().setWalking(false);
  document.querySelector<HTMLElement>(".stage-canvas")?.focus({ preventScroll: true });
}

/**
 * What a view from the avatar lays over the room: in first person a dot marking the middle of the view, where a
 * click lands, and a line on how to look round. With a mouse, first person looks round as the mouse moves; when
 * Escape gives the cursor back, a card offers to look round again or to leave. A touch screen drags to look round,
 * and its line has a way out. Keys are left out on a touch screen.
 */
export function ViewOverlay() {
  const viewpoint = useGame((s) => (s.started && s.walking ? s.viewpoint : "overview"));
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    const changed = () => setLocked(viewNow.locked);
    window.addEventListener("nn:look-lock", changed);
    return () => window.removeEventListener("nn:look-lock", changed);
  }, []);
  if (viewpoint === "overview") return null;
  const first = viewpoint === "first";
  return (
    <div className={`view-overlay is-${viewpoint}${locked ? " is-looking" : ""}`} data-viewpoint={viewpoint}>
      {first && <span className="view-dot" aria-hidden="true" />}
      <p className="view-hint">
        {first && locked ? (
          <>
            Move the mouse to look round · click to walk or inspect · <kbd>Esc</kbd> for the cursor
          </>
        ) : first ? (
          <>
            <span className="view-hint-keys">
              <kbd>←</kbd> <kbd>→</kbd> to turn · <kbd>V</kbd> to change view
            </span>
            <span className="view-hint-touch">
              Drag to look round
              <button type="button" className="view-exit" onClick={leave}>
                Exit first person
              </button>
            </span>
          </>
        ) : (
          <>
            Drag to swing round
            <span className="view-hint-keys">
              {" "}
              · scroll to come closer · <kbd>V</kbd> to change view
            </span>
          </>
        )}
      </p>
      {first && !locked && (
        <div className="view-paused" role="group" aria-label="Mouse look paused">
          <p>
            <strong>Mouse look is paused.</strong> Look round with the mouse again, or leave first person.
          </p>
          <div className="view-paused-actions">
            <button type="button" className="btn btn-primary" onClick={() => mouse.take()}>
              Look around
            </button>
            <button type="button" className="btn" onClick={leave}>
              Exit first person <kbd>Esc</kbd>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
