import type { Campaign, CampaignPostmortem } from "@/sim/campaignTypes";

export interface ReliabilityLesson { happened: string; recovered: string; improve: string; takeaway: string }
/** Read recorded evidence only, bounded to this outcome/report so later chapters cannot rewrite it. */
export function reliabilityLesson(c: Campaign, report?: CampaignPostmortem): ReliabilityLesson | undefined {
  const d = c.reliabilityStage, f = d?.fault;
  if (!d || !f || f.startedStep === null) return;
  const end = report?.recoveredStep ?? d.completedStep;
  if (end == null || report && (f.startedStep > report.recoveredStep || f.restoredStep !== null && f.restoredStep < report.openedStep || !report.snapshots.some(m => m.reliability?.faultId === f.id))) return;
  const completion = c.trace.find(t => t.type === "reliability-stage-completed" && t.data.eventId === f.id);
  const events = (report?.events ?? c.trace.filter(t => !completion || t.id <= completion.id)).filter(t => t.step >= f.startedStep! && t.step <= end);
  const restored = events.find(t => t.type === "instance-restored" && t.data.eventId === f.id);
  const promoted = events.find(t => t.type === "failover-activated" && t.data.eventId === f.id);
  const detected = events.find(t => t.type === "health-change-detected" && t.data.appId === f.targetId && t.data.detectedHealth === "unhealthy");
  const routed = events.some(t => t.type === "action-activated" && c.actions.some(a => a.id === t.data.actionId && a.type === "routing"));
  const samples = report?.snapshots ?? [...new Map([...c.reports.flatMap(r => r.snapshots), ...c.recent].filter(m => m.step >= f.startedStep! && m.step <= end).map(m => [m.step, m])).values()];
  const rejected = samples.reduce((n, m) => n + m.rejected, 0), incoming = samples.reduce((n, m) => n + m.incoming, 0);
  const significant = incoming > 0 && rejected / incoming >= .1;
  const hadIncident = !!report || c.trace.some(t => t.type === "incident-opened" && t.step >= f.armedStep && t.step <= end && (!completion || t.id <= completion.id));
  const recovery: string[] = [];
  if (promoted) recovery.push("Automatic failover brought a reserved spare into service");
  else if (routed) recovery.push("You changed routing to use available servers");
  if (restored) recovery.push(restored.data.source === "manual" ? "you requested a free server restore" : "the failed server returned automatically");
  if (!recovery.length) recovery.push("The recorded service checks confirmed recovery; the retained evidence does not identify a specific repair");
  const recoveryText = recovery.join("; ");
  const app = `App ${f.targetId.slice(4)}`;
  const rejection = significant ? " Many incoming requests were turned away by traffic limiting." : "";
  return {
    happened: hadIncident ? `${app} failed, and the requests it would have served were lost, so an incident opened.` : `${app} failed without opening an incident.`,
    recovered: `${recoveryText[0].toUpperCase()}${recoveryText.slice(1)}.${rejection}`,
    improve: significant ? "Add enough healthy, routed capacity to serve everyone without the traffic limit."
      : !detected ? "Deploy Health Checks so a failed server is detected sooner; with load balancing, traffic then skips it."
      : !promoted ? "Reserve a spare and deploy Automatic Failover, so a healthy server takes over when one fails."
      : "Make sure the surviving servers and the Database can carry the load; failover moves traffic but adds no capacity.",
    takeaway: "Restoring a server and recovering service are separate steps; verify both.",
  };
}
