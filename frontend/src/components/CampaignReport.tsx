import { Fragment, useState, type CSSProperties, type ReactNode } from "react";
import type { ReportLesson } from "@/game/campaignReport";
import { ReportTechnicalOpen } from "./useReportTechnicalOpen";
import "./CampaignIncidentReport.css";

/** A line's turn in the popup's chat-like entrance: each question, then its answer. */
const line = (turn: number) => ({ "--turn": turn }) as CSSProperties;

/** `summary` follows "What happened?", so the numbers that carry the lesson come before the advice. */
export function ReportSections({ lesson, summary }: { lesson: ReportLesson; summary?: ReactNode }) {
  const sections = [["What happened?", lesson.happened], ["How did you respond?", lesson.response], ["What could be improved?", lesson.improve], ["Key takeaway", lesson.takeaway]].filter(([, text]) => !!text);
  return <>{!sections.length && summary}{sections.map(([title, text], i) => <Fragment key={title}><section><h3 style={line(2 * i)}>{title}</h3><p style={line(2 * i + 1)}>{text}</p></section>{i === 0 && summary}</Fragment>)}</>;
}
/** One disclosure per report. Evidence children must not introduce nested accordions. */
/** `summary` holds the few numbers that carry the lesson; they stay visible outside the technical disclosure. */
export function CampaignReport({ lesson, summary, children }: { lesson: ReportLesson; summary?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <div className="campaign-incident-report"><ReportSections lesson={lesson} summary={summary}/>
    <details className="more report-technical" onToggle={event => { if (event.target === event.currentTarget) setOpen(event.currentTarget.open); }}><summary>View Technical Details</summary><ReportTechnicalOpen.Provider value={open}>{children}</ReportTechnicalOpen.Provider></details>
  </div>;
}
