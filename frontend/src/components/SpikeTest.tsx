import type { Campaign } from "@/sim/campaignTypes";
import { PASS_SHARE } from "@/game/chapter4Guidance";
import type { SpikeDebrief, SpikeScore } from "@/game/spikeDebrief";
import { Callout, Modal, Row } from "./ui";
import { Icon } from "./icons";
import { RecordedFields } from "./RecordedFields";
import "./CampaignIncidentReport.css";

const num = (n: number) => n.toLocaleString("en-US");
const dollars = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
const CAUSE_TITLE: Record<SpikeDebrief["cause"], string> = {
  limit: "The traffic limit rejected requests",
  database: "The database was the bottleneck",
  "autoscaler-delay": "Autoscaling arrived late",
  "uneven-servers": "A small server overloaded",
  servers: "Not enough server capacity",
};

/** A failed spike test: what it served, what held it back, and what to change before the next spike starts. */
export function SpikeDebriefDialog({ campaign, debrief, onContinue }: { campaign: Campaign; debrief: SpikeDebrief; onContinue: () => void }) {
  const d = debrief;
  return <Modal title={`Spike ${d.pulse} test failed`} className="campaign-recovery-report spike-test-report" icon={{ kind: "warn", name: "alert" }}>
    <div className="campaign-incident-report">
      <Callout tone="warn" icon="load" kicker={`${d.share} served - the test needs ${PASS_SHARE}`}>
        Spike {d.pulse} sent {num(d.incoming)} requests: {num(d.served)} were served, {num(d.rejected)} rejected{d.queued ? `, ${num(d.failed)} failed and ${num(d.queued)} were still queued when it ended` : ` and ${num(d.failed)} failed`}.
      </Callout>
      <section><h3>{CAUSE_TITLE[d.cause]}</h3><p>{d.finding}</p></section>
      <section><h3>What to change</h3><p>{d.fix}</p></section>
      <section><h3>Next test</h3><p>Spike {d.next.pulse} starts in {d.next.inSeconds} game seconds, at game second {d.next.startStep}. The clock stays paused until you press Run, so you can make changes first.</p></section>
      <details className="more report-technical"><summary>View Technical Details</summary><RecordedFields data={campaign.spikeStage!.pulses!.find(p => p.pulse === d.pulse)!} /></details>
    </div>
    <div className="modal-foot"><span className="muted">The same company continues.</span><button className="btn btn-primary" data-autofocus onClick={onContinue}>Prepare for Spike {d.next.pulse}<Icon name="next" /></button></div>
  </Modal>;
}

/** The scored cost of a passed spike test; it never decides whether the chapter is complete. */
export function SpikeScoreSummary({ score }: { score: SpikeScore }) {
  return <section className="report-capacity" aria-label="Spike test score">
    <h3>Spike test score</h3>
    <dl className="rows">
      <Row label={`Spike ${score.pulse} served`} value={`${score.share} of requests`} />
      <Row label="Graded spikes taken" value={score.attempts === 1 ? "1, passed first time" : `${score.attempts}`} />
      <Row label="Setup spending this chapter" value={dollars(score.setupCents)} />
      {score.idleShare && <Row label="Capacity idle outside spikes" value={score.idleShare} />}
      <Row label="Changes made by you / by autoscaling" value={`${score.manual} / ${score.automatic}`} />
    </dl>
    <p>Idle capacity still costs money every week. Autoscaling removes the servers it added once demand falls; servers you add by hand stay until you change them.</p>
  </section>;
}
