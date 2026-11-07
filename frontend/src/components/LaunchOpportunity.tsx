import { useState } from "react";
import { scalingLaunchBlocker } from "@/sim/scalingLaunch";
import { APPLICATION_SCALING as P } from "@/sim/scenarios/applicationScaling";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
import { useGame } from "@/game/store";
import { num, money } from "@/game/format";
import { Modal } from "./ui";
import "./LaunchOpportunity.css";

export function LaunchOpportunity() {
  const { game, act, setRunning } = useGame();
  const [review, setReview] = useState(false);
  const c = game.campaign!, stage = c.scaling;
  if (stage?.version !== 2 || stage.consumed) return null;
  const blocker = scalingLaunchBlocker(game);
  const extraRevenue = Math.max(0, P.traffic - c.incomingRate) * Q.periodSteps * Q.revenueCents / 100;
  const routed = c.apps.filter(a => c.routing.targets.includes(a.id) && a.health !== "failed" && a.role !== "spare").reduce((total, a) => total + a.capacity, 0);
  const committed = stage.dueStep !== null;
  return <section className="launch-opportunity" aria-label="Growth launch opportunity">
    <h3>{committed ? "Campaign launched" : "Your next launch"}</h3>
    <p>{committed ? `Traffic rises to ${num(P.traffic)} req/s in ${Math.max(0, stage.dueStep! - c.step)} game seconds. Run to observe the result; Pause freezes the countdown.` : `Marketing is ready. You choose when traffic grows from ${num(c.incomingRate)} to ${num(P.traffic)} req/s.`}</p>
    {!committed && <><p>Up to <strong>{money(extraRevenue)} more revenue/week</strong> if every additional request succeeds. Revenue becomes spendable at settlement.</p>
      <p className="muted">Keep preparing while current traffic earns revenue and running costs continue.</p>
      <button type="button" className="btn btn-primary" data-guidance="review-launch" disabled={!!blocker} onClick={() => { setRunning(false); setReview(true); }}>Review launch</button>
      {blocker && <p>{blocker}</p>}
    </>}
    {review && !committed && <Modal title="Launch growth campaign?" onClose={() => setReview(false)}>
      <p>Traffic will rise to <strong>{num(P.traffic)} req/s</strong> after {P.observationSteps} game seconds. The launch cannot be cancelled after confirmation.</p>
      <dl className="launch-readings"><div><dt>Routed app capacity</dt><dd>{num(routed)} req/s</dd></div><div><dt>Database capacity</dt><dd>{num(c.dbCapacity)} ops/s</dd></div><div><dt>Deployments unfinished</dt><dd>{c.pending.length}</dd></div></dl>
      <p>Installed servers only help when routed. Balanced routing splits traffic equally; total capacity alone does not guarantee every server can cope.</p>
      {(routed < P.traffic || c.dbCapacity < P.traffic || c.limit !== null || c.pending.length > 0) && <p className="text-warn">Current capacity, traffic limits or unfinished deployments may leave demand unserved. Launching still uses the normal incident and bankruptcy rules.</p>}
      {blocker && <p role="status">{blocker}</p>}
      <div className="modal-actions"><button type="button" className="btn" onClick={() => setReview(false)}>Keep preparing</button><button type="button" className="btn btn-primary" disabled={!!blocker} onClick={() => { if (act({ type: "launch_scaling" })) setReview(false); }}>Launch campaign</button></div>
    </Modal>}
  </section>;
}
