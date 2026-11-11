import { useEffect, useState } from "react";
import type { LeaderboardEntry, LeaderboardResponse } from "../../../../shared/leaderboard.ts";
import { fetchBoard } from "@/lib/leaderboard";
import "./booth.css";

const POLL_MS = 8000;
/** Posts newer than this glow on the board. */
const FRESH_MS = 90_000;
const OUTCOME: Record<LeaderboardEntry["outcome"], string> = {
  won: "Series A", bankrupt: "Bankrupt", deadline: "Week 26", unfinished: "Ended early",
};
const users = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${Math.round(n / 1000)}k` : n.toLocaleString("en-SG");

function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${Math.floor(s / 3600)} h ago`;
}

/** The big-screen leaderboard at `/steps/board`: the top ten and the latest posts, refreshed every few seconds. */
export default function BoothBoard() {
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let live = true;
    let controller: AbortController | null = null;
    const load = async () => {
      if (document.hidden) return;
      controller?.abort();
      const current = new AbortController();
      controller = current;
      try {
        const next = await fetchBoard(current.signal);
        if (!live) return;
        setBoard(next);
        setOffline(false);
      } catch {
        if (live && !current.signal.aborted) setOffline(true);
      }
      if (live) setNow(Date.now());
    };
    void load();
    const timer = window.setInterval(load, POLL_MS);
    const onVisible = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const playUrl = `${window.location.host}/steps`;
  return (
    <main className="booth-board" aria-labelledby="booth-board-title">
      <header className="booth-board-head">
        <div>
          <p className="booth-logo">99.99%</p>
          <h1 id="booth-board-title">Live leaderboard</h1>
        </div>
        <div className="booth-board-cta">
          <span>Think you can keep it online?</span>
          <strong>Play at {playUrl}</strong>
        </div>
      </header>

      <div className="booth-board-body">
        <section className="booth-board-top" aria-label="Top scores">
          {!board ? (
            <p className="booth-board-empty">{offline ? "Leaderboard unavailable. Retrying…" : "Loading…"}</p>
          ) : board.top.length === 0 ? (
            <p className="booth-board-empty">No scores yet. Be the first on the board!</p>
          ) : (
            <ol className="booth-board-list">
              {board.top.map((e, i) => (
                <li key={`${e.createdAt}-${e.name}`} className={`booth-row${i < 3 ? ` booth-row-${i + 1}` : ""}${now - Date.parse(e.createdAt) < FRESH_MS ? " is-fresh" : ""}`}>
                  <span className="booth-row-rank">{i + 1}</span>
                  <span className="booth-row-name">{e.name}</span>
                  <span className="booth-row-meta">{users(e.users)} users · {OUTCOME[e.outcome]}</span>
                  <span className={`booth-grade booth-grade-${e.grade}`}>{e.grade}</span>
                  <span className="booth-row-score">{e.score}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className="booth-board-side" aria-label="Latest players">
          <h2>Just played</h2>
          <ul className="booth-recent">
            {board?.recent.map((e) => (
              <li key={`${e.createdAt}-${e.name}`}>
                <span className="booth-recent-name">{e.name}</span>
                <span className="booth-recent-score">{e.score} pts · {e.grade}</span>
                <span className="booth-recent-ago">{ago(e.createdAt, now)}</span>
              </li>
            ))}
          </ul>
          {board && <p className="booth-board-total"><b>{board.total}</b> {board.total === 1 ? "company" : "companies"} launched</p>}
          {offline && board && <p className="booth-board-stale" role="status">Reconnecting…</p>}
        </aside>
      </div>
    </main>
  );
}
