import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { LEADERBOARD_NAME_MAX } from "../../../../shared/leaderboard.ts";
import { loadVisitor, saveVisitor, submissionFor, tidyName, type BoothVisitor } from "@/game/booth";
import { useGame } from "@/game/store";
import { postScore } from "@/lib/leaderboard";
import { buildReport } from "@/sim/report";
import "./booth.css";

/**
 * Booth play on `/steps`: the name screen before a visitor's run, and a small chip during it that shows the score
 * so far and posts the Challenge Mode report score to the leaderboard. A finished run posts itself.
 */
export default function BoothLayer() {
  const [visitor, setVisitorState] = useState<BoothVisitor | null>(() => loadVisitor());
  const [status, setStatus] = useState<"idle" | "posting" | "error">("idle");
  const inflight = useRef(false);
  const game = useGame((s) => s.game);
  const mode = useGame((s) => s.mode);
  const startBoothRun = useGame((s) => s.startBoothRun);
  const setRunning = useGame((s) => s.setRunning);

  const setVisitor = useCallback((v: BoothVisitor | null) => { saveVisitor(v); setVisitorState(v); }, []);
  const theirRun = !!visitor && mode === "classic" && !game.campaign && visitor.runSeed === game.seed;
  const report = useMemo(() => (theirRun ? buildReport(game) : null), [theirRun, game]);
  const finished = theirRun && !!game.outcome;

  const post = useCallback(async (v: BoothVisitor, ended: boolean) => {
    // Read the game now, not from the last render: the run may have ended a moment ago.
    const { game: now, mode: nowMode } = useGame.getState();
    if (inflight.current || v.posted || (!v.pending && (nowMode !== "classic" || now.campaign || now.seed !== v.runSeed))) return;
    inflight.current = true;
    const submission = v.pending ?? submissionFor(v, buildReport(now), ended);
    const withPending = { ...v, pending: submission };
    setVisitor(withPending);
    setStatus("posting");
    try {
      const r = await postScore(submission);
      setVisitor({ ...withPending, pending: null,
        posted: { rank: r.rank, total: r.total, score: submission.score, grade: submission.grade } });
      setStatus("idle");
    } catch {
      setStatus("error");
    } finally {
      inflight.current = false;
    }
  }, [setVisitor]);

  // A run that reaches its Series A, goes bankrupt or runs out of weeks posts once, without a click.
  const autoPost = useRef<() => void>(() => {});
  useEffect(() => {
    autoPost.current = () => { if (visitor && !visitor.posted && !visitor.pending) void post(visitor, true); };
  });
  useEffect(() => useGame.subscribe((s, prev) => {
    if (s.game.outcome && !prev.game.outcome) queueMicrotask(() => autoPost.current());
  }), []);

  const start = (name: string) => {
    if (!startBoothRun()) return;
    setStatus("idle");
    setVisitor({ name, submissionId: crypto.randomUUID(), runSeed: useGame.getState().game.seed, posted: null, pending: null });
  };
  // A reload can boot a locked device back into Guided Mode: continue the visitor's saved company, never replace it.
  const resume = (v: BoothVisitor) => {
    if (v.runSeed === null || !startBoothRun(v.runSeed)) return;
    const seed = useGame.getState().game.seed;
    // The save was lost and a fresh company started: it is a new run with its own submission.
    if (seed !== v.runSeed) setVisitor({ ...v, runSeed: seed, submissionId: crypto.randomUUID(), pending: null });
  };

  if (!visitor) return <BoothEntry onStart={start} />;

  const finishEarly = () => { setRunning(false); void post(visitor, false); };
  const nextPlayer = () => { setStatus("idle"); setVisitor(null); };

  return (
    <aside className="booth-hud" aria-label="Leaderboard">
      <span className="booth-hud-name" title="Playing as">{visitor.name}</span>
      {visitor.posted ? (
        <>
          <span className="booth-hud-score" role="status">
            <b>#{visitor.posted.rank}</b> of {visitor.posted.total} · {visitor.posted.score} pts
          </span>
          <button type="button" className="booth-btn booth-btn-go" onClick={nextPlayer}>Next player</button>
        </>
      ) : !theirRun ? (
        visitor.runSeed === null
          ? <button type="button" className="booth-btn booth-btn-go" onClick={() => start(visitor.name)}>Start my run</button>
          : <button type="button" className="booth-btn booth-btn-go" onClick={() => resume(visitor)}>Continue my run</button>
      ) : (
        <>
          <span className="booth-hud-score" aria-live="polite">
            <span className={`booth-grade booth-grade-${report!.grade}`}>{report!.grade}</span>
            {report!.score} pts
          </span>
          {status === "error" ? (
            <button type="button" className="booth-btn" onClick={() => post(visitor, finished)}>Couldn&apos;t post. Retry</button>
          ) : (
            <button type="button" className="booth-btn" disabled={status === "posting"} onClick={finished ? () => post(visitor, true) : finishEarly}>
              {status === "posting" ? "Posting…" : finished ? "Post score" : "Finish & post"}
            </button>
          )}
          <button type="button" className="booth-btn booth-btn-quiet" onClick={nextPlayer} title="Leave without posting">Skip</button>
        </>
      )}
    </aside>
  );
}

function BoothEntry({ onStart }: { onStart: (name: string) => void }) {
  const [raw, setRaw] = useState("");
  const [tried, setTried] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const name = tidyName(raw);
  useEffect(() => { input.current?.focus(); }, []);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (name) onStart(name);
  };
  return (
    <div className="booth-entry" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
      <form className="booth-entry-card" onSubmit={submit} noValidate>
        <p className="booth-logo">99.99%</p>
        <h1 id={`${id}-title`}>Can you keep the startup online?</h1>
        <p className="booth-entry-lede">
          Reach 50,000 users in 26 weeks without going broke or going down. Your score goes on the live leaderboard.
        </p>
        <label htmlFor={`${id}-name`}>Your name on the leaderboard</label>
        <input
          ref={input}
          id={`${id}-name`}
          value={raw}
          maxLength={LEADERBOARD_NAME_MAX + 8}
          autoComplete="nickname"
          spellCheck={false}
          aria-invalid={tried && !name}
          aria-describedby={`${id}-hint`}
          onChange={(e) => setRaw(e.target.value)}
        />
        <p id={`${id}-hint`} className={tried && !name ? "booth-entry-hint is-error" : "booth-entry-hint"}>
          {tried && !name ? `Use 1–${LEADERBOARD_NAME_MAX} letters, numbers, spaces or _ . ' -` : "Shown publicly. Starts a fresh Challenge Mode company on this device."}
        </p>
        <button type="submit" className="booth-btn booth-btn-go booth-btn-big">Start playing</button>
      </form>
    </div>
  );
}
