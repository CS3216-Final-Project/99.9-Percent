import { useState } from "react";
import { useGame } from "@/game/store";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
import { num, money } from "@/game/format";
import { Icon } from "./icons";
import { Modal } from "./ui";

/** Presentation of the existing three-prompt onboarding; no engine actions or new saved fields. */
export default function CampaignIntroduction({ overview }: { overview: readonly (readonly [string, string])[] }) {
  const { game, meta, onboardingMove, select, selected } = useGame();
  const c = game.campaign!;
  const step = meta.openingOnboarding.step;
  const [example, setExample] = useState<"successful" | "rejected">("successful");
  const [control, setControl] = useState<"clock" | "actions" | "tree">("clock");
  const metric = selected === "app" ? c.snapshot.app : selected === "db" ? c.snapshot.db : null;
  return <Modal title="Company introduction" icon={{ kind: "go", name: "info" }} className="campaign-introduction" onClose={() => onboardingMove("skip")}>
    <div className="tour-dots" aria-hidden="true">{overview.map((_, i) => <i key={i} className={i < step ? "is-done" : i === step ? "is-now" : ""} />)}</div>
    <p className="campaign-intro-meta">Getting started · Prompt {step + 1} of {overview.length} · Simulation paused</p>
    {step === 0 && <>
      <h3>Understand your system</h3>
      <p>You run a growing company. Customers send requests; your system must handle them.</p>
      <div className="campaign-intro-flow" aria-label="Explore the request path">
        <span><Icon name="users" />Users<small>{num(c.snapshot.incoming)} req/s</small></span><span aria-hidden="true">→</span>
        <button className="btn" aria-pressed={selected === "app"} onClick={() => select("app")}><Icon name="server" />App Server</button><span aria-hidden="true">→</span>
        <button className="btn" aria-pressed={selected === "db"} onClick={() => select("db")}><Icon name="database" />Database</button>
      </div>
      <div className="campaign-intro-example" role="status">{metric ? <>
        <strong>{selected === "app" ? "App Server runs your application and handles requests." : "Database stores and retrieves data."}</strong>
        <p>Demand {num(metric.demand)} / capacity {num(metric.capacity)} {selected === "app" ? "req/s" : "ops/s"}.</p>
        <p>Capacity is work per second. Unfinished work waits in a backlog.</p>
      </> : <p>Click App Server or Database to inspect its current capacity.</p>}</div>
      <small>This is free inspection practice. No purchase or simulation step is performed.</small>
    </>}
    {step === 1 && <>
      <h3>Know what earns money</h3>
      <p>Choose a request outcome to compare.</p>
      <div className="btn-row" role="group" aria-label="Compare request outcomes">
        <button className="btn" aria-pressed={example === "successful"} onClick={() => setExample("successful")}>Successful request</button>
        <button className="btn" aria-pressed={example === "rejected"} onClick={() => setExample("rejected")}>Rejected request</button>
      </div>
      <div className="campaign-intro-example" role="status"><strong>{example === "successful" ? `$${(Q.revenueCents/100).toFixed(2)} earned per successful request` : "$0 earned from a rejected request"}</strong>
        <p>{example === "successful" ? "Failed requests earn nothing. Revenue and costs settle every 60 modeled seconds." : "A traffic limit turns customers away. Installed infrastructure and salaries still cost the same."}</p></div>
      <dl className="rows"><div className="row"><dt>Available cash</dt><dd>{money(c.cashCents/100)}</dd></div><div className="row"><dt>Pending revenue</dt><dd>{money(c.ledger.successes*Q.revenueCents/100)} · not spendable yet</dd></div></dl>
    </>}
    {step === 2 && <>
      <h3>You control the clock</h3>
      <p>Finish here, then press Run company when you are ready.</p>
      <div className="btn-row" role="group" aria-label="Explore company controls">
        <button className="btn" aria-pressed={control === "clock"} onClick={() => setControl("clock")}><Icon name="play" />Play &amp; Pause</button>
        <button className="btn" aria-pressed={control === "actions"} onClick={() => setControl("actions")}><Icon name="server" />Actions</button>
        <button className="btn" aria-pressed={control === "tree"} onClick={() => setControl("tree")}><Icon name="tree" />Technology tree</button>
      </div>
      <div className="campaign-intro-example" role="status">{control === "clock" ? <><strong>Run to observe. Pause to think.</strong><p>Pause stops time; inspecting equipment is free. Advance step is an optional precision control; one step models one second.</p></> : control === "actions" ? <><strong>Compare before buying.</strong><p>Add server installs another App Server. Scale up makes one existing server larger. Setup is paid now; upkeep starts at activation.</p></> : <><strong>Icons represent capabilities.</strong><p>Capacity, Data and Reliability are the three branches. Select a node to read its effect. Owned does not mean deployed.</p></>}</div>
      <p className="muted">No purchase is required by this introduction. Traffic will change when you run the company.</p>
    </>}
    <details className="more"><summary>{overview[step][0]}</summary><p>{overview[step][1]}</p></details>
    <div className="modal-foot"><button className="btn btn-quiet" onClick={() => onboardingMove("skip")}>Skip introduction</button><div className="btn-row"><button className="btn" disabled={step === 0} onClick={() => onboardingMove("back")}>Back</button><button className="btn btn-primary" onClick={() => onboardingMove("next")}>{step === 2 ? "Finish introduction" : "Next"}<Icon name="next" /></button></div></div>
  </Modal>;
}
