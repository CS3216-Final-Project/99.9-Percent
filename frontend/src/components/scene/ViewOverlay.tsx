"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useGame } from "@/game/store";
import { mouse, viewNow } from "./viewState";

/** Leave the view from the avatar for the overview, ending the walk, as Escape does once the cursor is back. */
function leave() {
  useGame.getState().setWalking(false);
  document.querySelector<HTMLElement>(".stage-canvas")?.focus({ preventScroll: true });
}

const Key = ({ children }: { children: ReactNode }) => <kbd>{children}</kbd>;

/**
 * What a view from the avatar lays over the room: in first person a dot marking the middle of the view, where a
 * click lands, and a line on how to look round. With a mouse, the view looks round as the mouse moves; when Escape
 * gives the cursor back, a card offers to look round again or to leave. Where the browser will not hand over the
 * mouse, there is no card: the view turns towards where the mouse points. A touch screen drags to look round, and
 * its line has a way out. Keys are left out on a touch screen.
 */
export function ViewOverlay() {
  const viewpoint = useGame((s) => (s.started && s.walking ? s.viewpoint : "overview"));
  const [locked, setLocked] = useState(false);
  const [refused, setRefused] = useState(false);
  useEffect(() => {
    const changed = () => {
      setLocked(viewNow.locked);
      setRefused(viewNow.lockRefused);
    };
    window.addEventListener("nn:look-lock", changed);
    return () => window.removeEventListener("nn:look-lock", changed);
  }, []);
  if (viewpoint === "overview") return null;
  const first = viewpoint === "first";
  const name = first ? "first person" : "follow";
  const exit = (
    <button type="button" className="view-exit" onClick={leave}>
      Exit {name}
    </button>
  );
  return (
    <div className={`view-overlay is-${viewpoint}${locked ? " is-looking" : ""}`} data-viewpoint={viewpoint}>
      {first && <span className="view-dot" aria-hidden="true" />}
      <p className="view-hint">
        {locked ? (
          first ? (
            <>
              Move the mouse to look round · click to walk or inspect · <Key>Esc</Key> for the cursor
            </>
          ) : (
            <>
              Move the mouse to swing round · scroll to come closer · <Key>Esc</Key> for the cursor
            </>
          )
        ) : refused ? (
          <>
            <span className="view-hint-keys">
              Point towards an edge to {first ? "look" : "swing"} round · click to walk{first ? " or inspect" : ""} · <Key>Esc</Key> to exit
            </span>
            <span className="view-hint-touch">Drag to look round {exit}</span>
          </>
        ) : (
          <>
            <span className="view-hint-keys">
              {first ? (
                <>
                  <Key>←</Key> <Key>→</Key> to turn
                </>
              ) : (
                <>Scroll to come closer</>
              )}{" "}
              · <Key>V</Key> to change view
            </span>
            <span className="view-hint-touch">Drag to look round {exit}</span>
          </>
        )}
      </p>
      {!locked && !refused && (
        <div className="view-paused" role="group" aria-label="Mouse look paused">
          <p>
            <strong>Mouse look is paused.</strong> Look round with the mouse again, or leave {name}.
          </p>
          <div className="view-paused-actions">
            <button type="button" className="btn btn-primary" onClick={() => mouse.take()}>
              Look around
            </button>
            <button type="button" className="btn" onClick={leave}>
              Exit {name} <Key>Esc</Key>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
