"use client";

import { useEffect, useState } from "react";
import { useGame } from "@/game/store";
import { viewNow } from "./viewState";

/**
 * What a view from the avatar lays over the room: in first person a dot marking the middle of the view, where a
 * click lands while the pointer is locked, and a line on how to look round. The keys are left out on a touch screen.
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
  return (
    <div className={`view-overlay is-${viewpoint}`} data-viewpoint={viewpoint}>
      {viewpoint === "first" && <span className="view-dot" aria-hidden="true" />}
      <p className="view-hint">
        {viewpoint === "first" && locked ? (
          <>
            <kbd>Esc</kbd> to let go of the mouse
          </>
        ) : viewpoint === "first" ? (
          <>
            <span className="view-hint-keys">Click the room to look round with the mouse, or drag · </span>
            <span className="view-hint-touch">Drag to look round</span>
            <span className="view-hint-keys">
              <kbd>←</kbd> <kbd>→</kbd> to turn · <kbd>V</kbd> to change view
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
    </div>
  );
}
