import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { scalingLaunchBlocker } from "@/sim/scalingLaunch";
import { APPLICATION_SCALING as P } from "@/sim/scenarios/applicationScaling";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
import { useGame } from "@/game/store";
import { num, money } from "@/game/format";
import { Modal } from "./ui";
import { Icon } from "./icons";
import "./LaunchOpportunity.css";

export function LaunchOpportunity() {
  const game = useGame(s => s.game);
  const act = useGame(s => s.act);
  const setRunning = useGame(s => s.setRunning);
  const running = useGame(s => s.running);
  const [review, setReview] = useState(false);
  const [focusCountdown, setFocusCountdown] = useState(false);
  const countdown = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusCountdown) countdown.current?.focus();
  }, [focusCountdown]);
  const c = game.campaign!, stage = c.scaling;
  if (stage?.version !== 2 || stage.consumed) return null;
  const blocker = scalingLaunchBlocker(game);
  const extraRevenue = Math.max(0, P.traffic - c.incomingRate) * Q.periodSteps * Q.revenueCents / 100;
  const routed = c.apps.filter(a => c.routing.targets.includes(a.id) && a.health !== "failed" && a.role !== "spare").reduce((total, a) => total + a.capacity, 0);
  const committed = stage.dueStep !== null;
  const remaining = committed ? Math.max(0, stage.dueStep! - c.step) : P.observationSteps;
  const scale = Math.max(P.traffic, routed, c.dbCapacity, 1);
  const hasGap = routed < P.traffic || c.dbCapacity < P.traffic;
  return <section className="launch-opportunity" aria-label="Growth launch opportunity">
    <h3>{committed ? "Campaign launched" : "Your next launch"}</h3>
    <div className="launch-traffic" role="img" aria-label={`Incoming traffic: ${num(c.incomingRate)} to ${num(P.traffic)} requests per second`}>
      <span>{num(c.incomingRate)}</span><Icon name="next" size={18}/><strong>{num(P.traffic)}</strong><small>req/s</small>
    </div>
    {committed ? <div ref={countdown} tabIndex={-1} className="launch-countdown" role="progressbar" aria-label="Launch countdown" aria-valuemin={0} aria-valuemax={P.observationSteps} aria-valuenow={P.observationSteps - remaining} aria-valuetext={`Launch in ${remaining} game seconds. ${running ? "Running." : "Paused. Run to advance."}`}>
      <span className="launch-countdown-steps" aria-hidden="true">{Array.from({ length: P.observationSteps }, (_, i) => <i key={i} data-elapsed={i < P.observationSteps - remaining}/>)}</span><span><Icon name={running ? "play" : "pause"} size={14}/>{running ? `${remaining}s to launch` : `Paused · ${remaining}s left`}</span>
    </div> : <>
      <div className="launch-capacities" role="img" aria-label={`Launch demand ${num(P.traffic)} per second. Routed apps ${num(routed)} requests per second${routed < P.traffic ? `, capacity gap ${num(P.traffic - routed)}` : ""}. Database ${num(c.dbCapacity)} operations per second${c.dbCapacity < P.traffic ? `, capacity gap ${num(P.traffic - c.dbCapacity)}` : ""}.`}>
        {[{ label: "Apps", icon: "server", value: routed, unit: "req/s" }, { label: "DB", icon: "database", value: c.dbCapacity, unit: "ops/s" }].map(row => <div className="launch-capacity" key={row.label}>
          <span><Icon name={row.icon === "server" ? "server" : "database"} size={14}/>{row.label}</span><span className="launch-capacity-value">{num(row.value)}<small>{row.unit}</small></span>
          <span className="launch-capacity-track" data-short={row.value < P.traffic}>
            <span style={{ width: `${row.value / scale * 100}%` }}/>
            {row.value < P.traffic && <span className="launch-capacity-gap" style={{ left: `${row.value / scale * 100}%`, width: `${(P.traffic - row.value) / scale * 100}%` }}/>}
            <i style={{ left: `${P.traffic / scale * 100}%` }}/>
          </span>
        </div>)}
        <div className="launch-capacity-key" aria-hidden="true">{hasGap && <span><i className="launch-gap-key"/>Capacity gap</span>}<span><i className="launch-target-key"/>Launch demand</span></div>
      </div>
      <div className="launch-offer"><span>Up to <strong>+{money(extraRevenue)}/wk</strong></span><button type="button" className="btn btn-primary" data-guidance="review-launch" disabled={!!blocker} onClick={() => { setRunning(false); setReview(true); }}>Review launch</button></div>
      {blocker && <p>{blocker}</p>}
    </>}
    {review && !committed && createPortal(<Modal title="Launch growth?" className="launch-review" onClose={() => setReview(false)}>
      <div className="launch-review-content" role="region" aria-label="Launch details" tabIndex={0} onKeyDown={e => {
        if (e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        if (e.key === "Home" || e.key === "End") {
          // Match purchase details: keep endpoint navigation inside the focused reading region.
          e.preventDefault();
          e.currentTarget.scrollTop = e.key === "End" ? e.currentTarget.scrollHeight : 0;
        }
      }}>
        <p>Traffic will rise to <strong>{num(P.traffic)} req/s</strong> after {P.observationSteps} game seconds. The launch cannot be cancelled after confirmation.</p>
        <p>Up to {money(extraRevenue)} more revenue/week if every additional request succeeds, paid at settlement. Waiting keeps current traffic, revenue and running costs going.</p>
        <dl className="launch-readings"><div><dt>Routed app capacity</dt><dd>{num(routed)} req/s</dd></div><div><dt>Database capacity</dt><dd>{num(c.dbCapacity)} ops/s</dd></div><div><dt>Deployments unfinished</dt><dd>{c.pending.length}</dd></div></dl>
        <p>Installed servers only help when routed. Balanced routing splits traffic equally; total capacity alone does not guarantee every server can cope.</p>
        {(routed < P.traffic || c.dbCapacity < P.traffic || c.limit !== null || c.pending.length > 0) && <p className="text-warn">Current capacity, traffic limits or unfinished deployments may leave demand unserved. Launching still uses the normal incident and bankruptcy rules.</p>}
        {blocker && <p role="status">{blocker}</p>}
      </div>
      <div className="modal-actions"><button type="button" className="btn" data-autofocus onClick={() => setReview(false)}>Keep preparing</button><button type="button" className="btn btn-primary" disabled={!!blocker} onClick={() => { if (act({ type: "launch_scaling" })) { setReview(false); setFocusCountdown(true); } }}>Launch campaign</button></div>
    </Modal>, document.body)}
  </section>;
}
