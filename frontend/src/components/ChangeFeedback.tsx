import { useState } from "react";
import { changeFeedback } from "@/game/changeFeedback";
import { useGame } from "@/game/store";
import { num } from "@/game/format";
import { Icon } from "./icons";
import { ChangeGraphic, ConnectionGraphic } from "./ChangeGraphic";
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
    <span className="visually-hidden" role="status" key={key}>{feedback.heading}. {feedback.note} {feedback.warning}</span>
    {feedback.capacity ? <ChangeGraphic {...feedback.capacity}/>
      : feedback.connection !== undefined ? <ConnectionGraphic routed={feedback.connection}/>
      : feedback.cache ? <div className="change-cache">
        <div className="change-graphic-values"><span><Icon name="bolt" size={15}/>Cache hits</span><strong>{Math.round(feedback.cache.effectiveHitRateUsed / 100)}%</strong></div>
        <div className="change-cache-track" role="meter" aria-label="Eligible reads served from cache" aria-valuemin={0} aria-valuemax={100} aria-valuenow={feedback.cache.effectiveHitRateUsed / 100}>
          <span style={{ width: `${feedback.cache.effectiveHitRateUsed / 100}%` }}/>
        </div>
      </div> : feedback.admission ? <div className="change-admission" role="img" aria-label={`Traffic: ${num(feedback.admission.admitted)} admitted, ${num(feedback.admission.rejected)} rejected requests per second`}>
        <div className="change-graphic-values"><span>{num(feedback.admission.admitted)} admitted</span><span>{num(feedback.admission.rejected)} rejected /s</span></div>
        <div className="change-admission-track" aria-hidden="true"><span style={{ width: `${feedback.admission.admitted / Math.max(1, feedback.admission.incoming) * 100}%` }}/><span style={{ width: `${feedback.admission.rejected / Math.max(1, feedback.admission.incoming) * 100}%` }}/></div>
      </div> : <span className="change-active"><Icon name="check" size={15}/>Active</span>}
    {feedback.warning && <span className="change-warning"><Icon name="alert" size={14}/>{feedback.warning.startsWith("Database") ? "DB overloaded" : "App overloaded"} at {feedback.step}s</span>}
    <details className="change-details"><summary>Details<Icon name="down" size={12}/></summary>
      <p>{feedback.note}</p>{feedback.warning && <p className="text-warn">{feedback.warning}</p>}
      {before && after && <><p className="muted">Observed at {before.step}s → {after.step}s</p><dl className="launch-readings"><div><dt>Latency</dt><dd>{before.latencyMs.toFixed(0)} → {after.latencyMs.toFixed(0)} ms</dd></div>
        <div><dt>Queued requests</dt><dd>{num(before.app.backlog + before.db.backlog)} → {num(after.app.backlog + after.db.backlog)}</dd></div>
        <div><dt>Successful requests</dt><dd>{num(before.successful)} → {num(after.successful)} /s</dd></div></dl>
      <p className="muted">Traffic and other changes in the same second can also affect these readings.</p></>}
      {feedback.cache && <p>Cache now: {num(feedback.cache.hits)} hits/s · {(feedback.cache.effectiveHitRateUsed / 100).toFixed(0)}% of eligible reads served from cache.</p>}
    </details>
  </section>;
}
