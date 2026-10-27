import { Fragment, useRef, useState, type ReactNode } from "react";
import type { ReportLesson } from "@/game/campaignReport";
import { ReportTechnicalOpen } from "./useReportTechnicalOpen";
import { Callout } from "./ui";
import "./CampaignIncidentReport.css";

/**
 * `summary` follows "What happened?", so the numbers that carry the lesson come before the advice. The takeaway closes
 * the summary as a hint, so the one sentence to remember is never just a fourth heading.
 */
export function ReportSections({ lesson, summary }: { lesson: ReportLesson; summary?: ReactNode }) {
  const sections = [["What happened?", lesson.happened], [lesson.responseTitle ?? "How did you respond?", lesson.response], ["What to improve next", lesson.improve]].filter(([, text]) => !!text);
  return <>{!sections.length && summary}{sections.map(([title, text], i) => <Fragment key={title}><section><h3>{title}</h3><p>{text}</p></section>{i === 0 && summary}</Fragment>)}
    {lesson.takeaway && <Callout tone="hint" icon="bulb" kicker="Key takeaway" className="report-takeaway">{lesson.takeaway}</Callout>}</>;
}
/** One disclosure per report. Evidence children must not introduce nested accordions. */
/** `lead` opens the report above its sections; `summary` holds the few numbers that carry the lesson. Both stay outside the evidence disclosure. */
export function CampaignReport({ lesson, lead, summary, children }: { lesson: ReportLesson; lead?: ReactNode; summary?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLElement>(null);
  return <div className="campaign-incident-report">{lead}<ReportSections lesson={lesson} summary={summary}/>
    <details className="more report-technical" onToggle={event => {
      if (event.target !== event.currentTarget) return;
      setOpen(event.currentTarget.open);
      // The evidence opens below the fold of a scrolling report; bring its start into view so opening it visibly does something.
      if (event.currentTarget.open) toggle.current?.scrollIntoView?.({ block: "start", behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }}><summary ref={toggle}>Show the evidence</summary><ReportTechnicalOpen.Provider value={open}><h3 className="visually-hidden">Evidence</h3>{children}</ReportTechnicalOpen.Provider></details>
  </div>;
}
