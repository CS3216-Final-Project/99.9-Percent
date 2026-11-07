import { useState } from "react";
import { changeFeedback } from "@/game/changeFeedback";
import { useGame } from "@/game/store";
import { num } from "@/game/format";
import { Icon } from "./icons";
import "./LaunchOpportunity.css";

export function ChangeFeedback() {
  const c = useGame(s => s.game.campaign);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const feedback = c ? changeFeedback(c) : null;
  const key = c && feedback ? `${c.runId}:${feedback.id}` : null;
  if (!feedback || key === dismissed) return null;
  const { before, after } = feedback;
  return <section className="change-feedback" aria-label="Latest infrastructure change">
    <div className="change-feedback-heading"><h3>{feedback.heading}</h3><button type="button" className="icon-btn" aria-label="Dismiss change feedback" onClick={() => setDismissed(key)}><Icon name="close" size={16}/></button></div>
    <div role="status" key={key}><p>{feedback.note}</p>{feedback.warning && <p className="text-warn">{feedback.warning}</p>}</div>
    {before && after && <details className="more"><summary>Observed across activation · {before.step}s → {after.step}s</summary>
      <dl className="launch-readings"><div><dt>Latency</dt><dd>{before.latencyMs.toFixed(0)} → {after.latencyMs.toFixed(0)} ms</dd></div>
        <div><dt>Queued requests</dt><dd>{num(before.app.backlog + before.db.backlog)} → {num(after.app.backlog + after.db.backlog)}</dd></div>
        <div><dt>Successful requests</dt><dd>{num(before.successful)} → {num(after.successful)} /s</dd></div></dl>
      <p className="muted">Traffic and other changes in the same second can also affect these readings.</p>
    </details>}
    {feedback.cache && <p>Cache now: {num(feedback.cache.hits)} hits/s · {(feedback.cache.effectiveHitRateUsed / 100).toFixed(0)}% of eligible reads served from cache.</p>}
  </section>;
}
