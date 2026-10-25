import { useState } from "react";
import { createPortal } from "react-dom";
import { useGame } from "@/game/store";
import { num, uptimePct } from "@/game/format";
import { campaignUptime } from "@/game/campaignUptime";
import { campaignAppHealth } from "@/game/campaignAppHealth";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
import { Modal, Row, Stat } from "./ui";
import "./CampaignAppHealth.css";

export function AppHealthEntry() {
    const runId = useGame(s => s.game.campaign!.runId);
    return <HealthEntry key={runId} />;
}
function HealthEntry() {
    const [open, setOpen] = useState(false);
    const game = useGame(s => s.game);
    const health = campaignAppHealth(game);
    return <><Stat icon="health" kind={health.tone} label="App Health" actionLabel="View app health"
        tip={`${health.word}. See estimated response time, failed requests and requests waiting. Uptime is the share of settled requests your company served. Requests still waiting in a queue don't count until they resolve; requests lost or turned away by a limit do.`}
        onClick={() => { useGame.getState().setRunning(false); setOpen(true); }}>
        <strong>{health.word}</strong>
    </Stat>{open && <CampaignAppHealth onClose={() => setOpen(false)} />}</>;
}
export function CampaignAppHealth({ onClose }: { onClose: () => void }) {
    const game = useGame(s => s.game);
    const health = campaignAppHealth(game);
    const uptime = game.campaign ? campaignUptime(game.campaign) : null;
    return createPortal(<Modal title="App Health" icon={{ kind: health.tone, name: health.icon }} onClose={onClose} className="app-health-dashboard">
        <section aria-label="Current app health">
            <h3>{health.word}</h3>
            <p>{health.reason}</p>
            <p className="muted app-health-snapshot">{health.step === 0 ? "Starting readings" : `Latest readings · Step ${health.step}`}</p>
        </section>
        <dl className="app-health-measurements" aria-label="App measurements">
            <Row label="Uptime" value={uptime === null ? "\u2014 / Not enough data" : uptimePct(uptime)} />
            <Row label="Response time" value={health.responseMs === null ? "Unavailable" : `${health.responseMs.toFixed(0)} ms (estimated)`} />
            <Row label="Failed requests (%)" value={health.failedRate === null ? "Unavailable" : `${(health.failedRate * 100).toFixed(2)}%`} />
            <Row label="Requests waiting" value={health.waiting === null ? "Unavailable" : num(health.waiting)} />
        </dl>
        <p className="app-health-interpretation">{health.interpretation}</p>
        <details className="app-health-details"><summary>More details</summary>
            <p><b>Uptime:</b> The share of settled requests served across this company's recorded run. Failed and rejected requests count against it; requests still waiting are excluded.</p>
            <p><b>Response time (latency)</b> estimates how long requests take, including time waiting for processing.</p>
            <p>{Q.latencyThresholdMs} ms is a target for this game, not a rule for every real app.</p>
            <p><b>Failed requests (error rate)</b>: Of requests that succeeded or failed, this is the percentage that failed. Waiting and rejected requests are excluded. With no outcomes, the percentage is unavailable.</p>
            <p><b>Requests waiting (backlog)</b> counts work not processed yet. These requests may still finish later.</p>
            <p><b>Rejected requests:</b> {health.rejected === null ? "Unavailable" : num(health.rejected)} in this snapshot. Rejected requests were not admitted for processing; they are separate from failed requests.</p>
            <p>These readings describe the latest game measurements, not a prediction of future performance.</p>
            <p><b>How status works:</b> incident, completion and review states take priority. Otherwise, response time of {Q.latencyThresholdMs} ms or more means At risk; a configured traffic limit means Traffic limited; otherwise the label is Healthy. Errors and queues are separate evidence, not extra status rules.</p>
            <p>Incident recovery needs {Q.stableSteps} consecutive qualifying game seconds below {Q.latencyThresholdMs} ms and {Q.errorThreshold * 100}% failed outcomes, with admitted traffic and completed outcomes. Reliability safety checks also apply. There is no incident timeout.</p>
        </details>
    </Modal>, document.body);
}
