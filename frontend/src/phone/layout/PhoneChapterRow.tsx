import { useId, useState } from "react";
import { useGame } from "@/game/store";
import { CampaignHintButton } from "@/components/CampaignAttention";
import { ChapterOverview } from "@/components/CampaignChapters";
import { useChapterBar } from "@/components/useChapterBar";
import { Icon } from "@/components/icons";
import { tipProps } from "@/components/tips";
import { Callout } from "@/components/ui";

/**
 * Guided Mode's chapter bar on a phone: one fixed-height row under the top strip with the chapter's number (a calendar
 * for Launch Week, which is unnumbered), its name and its goal on one line, Next when the progression gates offer it,
 * and the chapters overview. The whole row opens the overview, which repeats the full goal. A Next that is not ready yet stays
 * focusable and says why when pressed, so the row never changes height.
 */
export function PhoneChapterRow() {
  const { current, advance, reason, goal, label } = useChapterBar();
  const [open, setOpen] = useState(false);
  const [why, setWhy] = useState(false);
  const reasonId = useId();

  return <>
    <section className="phone-chapter-row" aria-label="Guided Mode chapters">
      <span className="phone-chapter-count" aria-hidden="true">{current.number === 0 ? <Icon name="week" size={14} /> : <><small>Ch</small>{current.number}</>}</span>
      <div className="phone-chapter-text">
        <p className="visually-hidden">{label}</p>
        <h2 aria-label="Current chapter"><span aria-label="Current Guided Mode stage">{current.name}</span></h2>
        <p className="phone-chapter-goal" aria-label="Current objective"><b>Goal:</b> {goal}</p>
      </div>
      {advance && <button type="button" className={`btn btn-primary chapter-advance${advance.ready ? "" : " is-waiting"}`}
        aria-disabled={!advance.ready} aria-label={`Next: ${advance.label}`} aria-describedby={reason ? reasonId : undefined} {...tipProps(advance.label)}
        onClick={() => advance.ready ? useGame.getState().act(advance.action) : setWhy(!why)}>Next<Icon name="next" size={16} /></button>}
      <CampaignHintButton />
      <button type="button" className="icon-btn phone-chapter-open" aria-haspopup="dialog" aria-label="View chapters" {...tipProps("View chapters")} onClick={() => {
        useGame.getState().setRunning(false);
        setOpen(true);
      }}><Icon name="goal" size={20} /></button>
      {reason && <p id={reasonId} className="phone-chapter-reason" hidden={!why} role="status">Next unavailable: {reason}</p>}
    </section>
    {open && <ChapterOverview onClose={() => setOpen(false)} lead={<Callout compact tone="info" icon="goal" kicker={`${label}: ${current.name}`}>{goal}</Callout>} />}
  </>;
}
