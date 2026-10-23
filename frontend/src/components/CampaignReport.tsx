import { useState, type ReactNode } from "react";
import type { ReportLesson } from "@/game/campaignReport";
import { ReportTechnicalOpen } from "./useReportTechnicalOpen";
import "./CampaignIncidentReport.css";

export function ReportSections({ lesson }: { lesson: ReportLesson }) {
  return <>{[["What happened?", lesson.happened], ["How did you respond?", lesson.response], ["What could be improved?", lesson.improve], ["Key takeaway", lesson.takeaway]].filter(([, text]) => !!text).map(([title, text]) => <section key={title}><h3>{title}</h3><p>{text}</p></section>)}</>;
}
/** One disclosure per report. Evidence children must not introduce nested accordions. */
/** `summary` holds the few numbers that carry the lesson; they stay visible above the technical disclosure. */
export function CampaignReport({ lesson, summary, children }: { lesson: ReportLesson; summary?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <div className="campaign-incident-report"><ReportSections lesson={lesson}/>{summary}
    <details className="more report-technical" onToggle={event => { if (event.target === event.currentTarget) setOpen(event.currentTarget.open); }}><summary>View technical details</summary><ReportTechnicalOpen.Provider value={open}>{children}</ReportTechnicalOpen.Provider></details>
  </div>;
}
