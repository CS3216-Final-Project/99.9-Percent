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
  const rejection = significant ? " Many incoming requests were turned away by traffic limiting." : "";
  return {
    happened: hadIncident ? "A server failed and a service incident was recorded." : "A server failed without opening a production incident.",
    recovered: `${recoveryText[0].toUpperCase()}${recoveryText.slice(1)}.${rejection}`,
    improve: significant ? "Prepare enough healthy, connected capacity to serve more users without relying on the traffic limit."
      : !detected ? "Health Checks can help detect failures sooner; detection still needs healthy capacity and safe routing."
      : !promoted ? "Consider a connected recovery plan or a reserved spare with automatic failover; extra servers also cost money."
      : "Check that surviving servers and the database can handle the workload; a spare alone is not a capacity guarantee.",
    takeaway: "Restoring a server and recovering service are separate steps; verify both.",
  };
}
