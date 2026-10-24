"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "@/game/store";
import { arcadeInput, arcadeStatus, bindArcadeCanvas, onArcade, serveArcade, type ArcadeStatus } from "./arcade";
import { avatar, onBusy, stopPlaying } from "./walk";

/** Whether the avatar is busy with the arcade right now, for the panel's first render. */
const avatarBusyArcade = () => avatar.busy?.prop === "arcade";

/*
 * The arcade's on-page panel while the avatar plays the brick breaker (see arcade.ts for the session and
 * breakout.ts for the game): a little canvas painted with the same frame as the cabinet's screen, the score and
 * lives, the keys that play it, and a way to leave. In first person the cabinet's own screen is the display, so
 * the canvas is hidden by CSS; on a touch screen the hold buttons move the paddle.
 */
export function ArcadePanel() {
  const viewpoint = useGame((s) => s.viewpoint);
  const coarse = useMemo(() => window.matchMedia?.("(pointer: coarse)").matches ?? false, []);
  const [playing, setPlaying] = useState(() => avatarBusyArcade());
  const [status, setStatus] = useState(arcadeStatus);
  const seen = useRef<ArcadeStatus["phase"]>("idle");
  const [note, setNote] = useState("");
  useEffect(() => onBusy((b) => setPlaying(b?.prop === "arcade")), []);
  useEffect(
    () =>
      onArcade((s) => {
        setStatus(s);
        if (s.phase !== seen.current) {
          seen.current = s.phase;
          // Only an ending is announced; the score's every step would nag a screen reader.
          if (s.phase === "over") setNote(`Game over, score ${s.score}`);
          else if (s.phase === "won") setNote("You cleared the bricks");
        }
      }),
    [],
  );
  if (!playing) return null;
  const hold = (dir: "left" | "right", down: boolean) => {
    arcadeInput[dir] = down;
  };
  return (
    <section className={`arcade-panel is-${viewpoint}`} role="group" aria-label="Arcade: brick breaker">
      <canvas ref={bindArcadeCanvas} width={64} height={52} className="arcade-screen" onPointerDown={() => serveArcade()} />
      <p className="arcade-status">
        Score {status.score} · Best {status.best} · {"●".repeat(status.lives)}
        {"○".repeat(Math.max(0, 3 - status.lives))}
      </p>
      <p className="arcade-hint">
        <span className="view-hint-keys">
          <kbd>←</kbd> <kbd>→</kbd> or <kbd>A</kbd> <kbd>D</kbd> move · <kbd>Space</kbd> serve · <kbd>Esc</kbd> leave
        </span>
        <span className="view-hint-touch">◀ ▶ move · tap the screen to serve · Leave to stop</span>
      </p>
      <div className="arcade-actions">
        {coarse && (
          <button
            type="button"
            className="arcade-hold"
            aria-label="Move paddle left"
            onPointerDown={() => hold("left", true)}
            onPointerUp={() => hold("left", false)}
            onPointerCancel={() => hold("left", false)}
            onPointerLeave={() => hold("left", false)}
          >
            ◀
          </button>
        )}
        <button type="button" className="btn" onClick={() => stopPlaying()}>
          Leave the arcade
        </button>
        {coarse && (
          <button
            type="button"
            className="arcade-hold"
            aria-label="Move paddle right"
            onPointerDown={() => hold("right", true)}
            onPointerUp={() => hold("right", false)}
            onPointerCancel={() => hold("right", false)}
            onPointerLeave={() => hold("right", false)}
          >
            ▶
          </button>
        )}
      </div>
      <span className="visually-hidden" role="status" aria-live="polite">
        {note}
      </span>
    </section>
  );
}
