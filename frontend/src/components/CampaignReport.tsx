import { Fragment, useState, type CSSProperties, type ReactNode } from "react";
import type { ReportLesson } from "@/game/campaignReport";
import { avatarPicture } from "@/game/avatars";
import { reportSpeaker } from "@/game/chapterCompanyMessage";
import { colleaguePortrait } from "@/game/colleagues";
import { useGame } from "@/game/store";
import { ReportTechnicalOpen } from "./useReportTechnicalOpen";
import "./CampaignIncidentReport.css";

/** A bubble's turn in the popup's chat-like entrance: each question, then its answer. */
const line = (turn: number) => ({ "--turn": turn }) as CSSProperties;

/** `summary` follows "What happened?", so the numbers that carry the lesson come before the advice. */
export function ReportSections({ lesson, summary }: { lesson: ReportLesson; summary?: ReactNode }) {
  const sections = [["What happened?", lesson.happened], ["How did you respond?", lesson.response], ["What could be improved?", lesson.improve], ["Key takeaway", lesson.takeaway]].filter(([, text]) => !!text);
  // The summary takes three turns (heading, readings, story) between the first answer and the next question.
  const turn = (i: number) => 2 * i + (i > 0 && summary ? 3 : 0);
  return <>{!sections.length && summary}{sections.map(([title, text], i) => <Fragment key={title}><section><h3 style={line(turn(i))}>{title}</h3><p style={line(turn(i) + 1)}>{text}</p></section>{i === 0 && summary && <div className="report-lesson-summary" style={line(2)}>{summary}</div>}</Fragment>)}</>;
}
/**
 * The colleague of the chapter the report is about asks the questions and the player's avatar answers them, so each
 * bubble carries a small picture of its speaker.
 */
function useReportSpeakers(at: number) {
  const colleague = useGame(s => s.game.campaign ? reportSpeaker(s.game.campaign, at) : null);
  const avatar = useGame(s => s.avatar);
  if (!colleague) return {};
  return { "data-speaker": colleague, style: { "--report-player": `url("${avatarPicture(avatar)}")`, "--report-colleague": `url("${colleaguePortrait(colleague).src}")` } as CSSProperties };
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
