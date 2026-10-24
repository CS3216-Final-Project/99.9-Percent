"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useGame } from "@/game/store";
import { Icon } from "../icons";
import { bindEyelids, mouse, viewNow } from "./viewState";

/** Leave the view from the avatar for the overview, ending the walk: the only way out, as Escape only frees the cursor. */
function leave() {
  useGame.getState().setWalking(false);
  document.querySelector<HTMLElement>(".stage-canvas")?.focus({ preventScroll: true });
}

const Key = ({ children }: { children: ReactNode }) => <kbd>{children}</kbd>;

/** The mouse drawn as a key: moved, or with its left button pressed. The words beside it say the same. */
const MouseKey = ({ click = false }: { click?: boolean }) => (
  <kbd className="view-mouse" aria-hidden="true">
    <Icon name={click ? "mouseLeft" : "mouse"} size={15} />
  </kbd>
);

/**
 * What a view from the avatar lays over the room: in first person a dot marking the middle of the view, where a
 * left click lands, and a line on how to look around. With a mouse, the view looks around as the mouse moves; when
 * Escape gives the cursor back, a card offers to look around again or to leave. Escape never leaves by itself: the
 * card's Exit does. Where the browser will not hand over the mouse, there is no card: the view turns towards where
 * the mouse is moved, and the line has the way out. A touch screen drags to look around, and its line has a way out
 * too. Keys are left out on a touch screen.
 */
export function ViewOverlay() {
  const viewpoint = useGame((s) => (s.started && s.walking ? s.viewpoint : "overview"));
  const reading = useGame((s) => s.roomInspection !== null);
  const [locked, setLocked] = useState(false);
  const [refused, setRefused] = useState(false);
  const [quietPause, setQuietPause] = useState(viewNow.quietPause);
  useEffect(() => {
    const changed = () => {
      setLocked(viewNow.locked);
      setRefused(viewNow.lockRefused);
      setQuietPause(viewNow.quietPause);
    };
    window.addEventListener("nn:look-lock", changed);
    return () => window.removeEventListener("nn:look-lock", changed);
  }, []);
  // The nap's eyelids sit over the room whatever the view: shut, first person looks into the dark of the pod.
  const eyelids = (
    <div className="view-eyelids" aria-hidden="true" data-eyes="open" ref={bindEyelids}>
      <i>z</i>
      <i>z</i>
      <i>z</i>
    </div>
  );
  if (viewpoint === "overview") return eyelids;
  const first = viewpoint === "first";
  const name = first ? "first person" : "follow";
  const exit = (
    <button type="button" className="view-exit" onClick={leave}>
      Exit {name}
    </button>
  );
  return (
    <>
      {eyelids}
      <div className={`view-overlay is-${viewpoint}${locked ? " is-looking" : ""}`} data-viewpoint={viewpoint}>
      {first && <span className="view-dot" aria-hidden="true" />}
      <p className="view-hint">
        {locked && reading ? (
          <>
            <MouseKey click /> Left click to put the reading away · <Key>Esc</Key> for the cursor
          </>
        ) : locked ? (
          first ? (
            <>
              <MouseKey /> Move the mouse to look around · <MouseKey click /> Left click to walk or inspect · <Key>Esc</Key> for the cursor
            </>
          ) : (
            <>
              <MouseKey /> Move the mouse to swing around · Scroll to come closer · <Key>Esc</Key> for the cursor
            </>
          )
        ) : refused ? (
          <>
            <span className="view-hint-keys">
              <MouseKey /> Move the mouse to {first ? "look" : "swing"} around · <MouseKey click /> Left click to walk{first ? " or inspect" : ""} {exit}
            </span>
            <span className="view-hint-touch">Drag to look around {exit}</span>
          </>
        ) : quietPause ? (
          <>
            <span className="view-hint-keys">
              <MouseKey click /> Left click to look around ·{" "}
              {first ? (
                <>
                  <Key>←</Key> <Key>→</Key> to turn
                </>
              ) : (
                <>Scroll to come closer</>
              )}{" "}
              · <Key>V</Key> to change view
            </span>
            <span className="view-hint-touch">Drag to look around {exit}</span>
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
            <span className="view-hint-touch">Drag to look around {exit}</span>
          </>
        )}
      </p>
      {!locked && !refused && !quietPause && (
        <div className="view-paused" role="group" aria-label="Mouse look paused">
          <p>
            <strong>Mouse look is paused.</strong> Look around with the mouse again, or leave {name}.
          </p>
          <div className="view-paused-actions">
            <button type="button" className="btn btn-primary" onClick={() => mouse.take()}>
              Look around
            </button>
            <button type="button" className="btn" onClick={leave}>
              Exit {name}
            </button>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
