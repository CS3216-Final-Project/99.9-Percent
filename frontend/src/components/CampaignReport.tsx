import { Fragment, useState, type ReactNode } from "react";
import type { ReportLesson } from "@/game/campaignReport";
import { ReportTechnicalOpen } from "./useReportTechnicalOpen";
import { chatTurn, useReportSpeakers } from "./reportChat";
import "./CampaignIncidentReport.css";

/** `summary` follows "What happened?", so the numbers that carry the lesson come before the advice. */
export function ReportSections({ lesson, summary }: { lesson: ReportLesson; summary?: ReactNode }) {
  const sections = [["What happened?", lesson.happened], ["How did you respond?", lesson.response], ["What could be improved?", lesson.improve], ["Key takeaway", lesson.takeaway]].filter(([, text]) => !!text);
  // The summary takes three turns (heading, readings, story) between the first answer and the next question.
  const turn = (i: number) => 2 * i + (i > 0 && summary ? 3 : 0);
  return <>{!sections.length && summary}{sections.map(([title, text], i) => <Fragment key={title}><section><h3 style={chatTurn(turn(i))}>{title}</h3><p style={chatTurn(turn(i) + 1)}>{text}</p></section>{i === 0 && summary && <div className="report-lesson-summary" style={chatTurn(2)}>{summary}</div>}</Fragment>)}</>;
}
/** One disclosure per report. Evidence children must not introduce nested accordions. */
/** `summary` holds the few numbers that carry the lesson; they stay visible outside the technical disclosure. */
/** `at` is the game second the report speaks for, which decides the colleague who asks. */
export function CampaignReport({ lesson, summary, at, children }: { lesson: ReportLesson; summary?: ReactNode; at: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const speakers = useReportSpeakers(at);
  return <div className="campaign-incident-report" {...speakers}><ReportSections lesson={lesson} summary={summary}/>
    <details className="more report-technical" onToggle={event => { if (event.target === event.currentTarget) setOpen(event.currentTarget.open); }}><summary>View Technical Details</summary><ReportTechnicalOpen.Provider value={open}>{children}</ReportTechnicalOpen.Provider></details>
  </div>;
}
