import { useId, useState } from "react";
import { campaignChapters, chapterAdvance } from "@/game/campaignChapters";
import { campaignGuidance, campaignObjective } from "@/game/campaignGuidance";
import { useGame } from "@/game/store";
import { Icon } from "./icons";
import { Modal } from "./ui";
import { tipProps } from "./tips";
import "./CampaignChapters.css";

export function CampaignChapters() {
  const game = useGame((s) => s.game);
  const tutorialDone = useGame(s => s.meta.tutorialDone);
  const learning = useGame(s => s.tour?.track === "campaign");
  const replaying = learning && tutorialDone;
  const [open, setOpen] = useState(false);
  const chapters = campaignChapters(game, learning, tutorialDone);
  const current = chapters.find((chapter) => chapter.current)!;
  const advance = learning ? null : chapterAdvance(game);
  const reasonId = useId();
  const guidance = campaignGuidance(game);
  const reason = advance && !advance.ready ? guidance.notice ?? guidance.lockReason : null;

  return <>
    <section className="chapter-bar" aria-label="Guided Mode chapters">
      <div className="chapter-current">
        <p>{learning ? "Chapter 0" : `Chapter ${current.number} of 6`}</p>
        <h2 aria-label="Current chapter"><span aria-label="Current Guided Mode stage">{current.name}</span></h2>
      </div>
      <p className="chapter-objective" aria-label="Current objective"><b>Goal:</b> {learning ? "Learn the controls, game time and finances before running your company." : campaignObjective(game)}</p>
      <div className="chapter-actions">
        {advance && <button type="button" className="btn btn-primary chapter-advance" disabled={!advance.ready} aria-label={`Next: ${advance.label}`} aria-describedby={reason ? reasonId : undefined} {...tipProps(advance.label)} onClick={() => useGame.getState().act(advance.action)}>Next<Icon name="next" /></button>}
        <button type="button" className="btn" aria-haspopup="dialog" onClick={() => {
          useGame.getState().setRunning(false);
          setOpen(true);
        }}><Icon name="goal" size={18} />View chapters</button>
      </div>
      {reason && <p id={reasonId} className="chapter-next-reason" tabIndex={0}>Next unavailable: {reason}</p>}
    </section>
    {open && <Modal title="Guided Mode chapters" icon={{ kind: "tech", name: "goal" }} onClose={() => setOpen(false)}>
      <p>Start with the walkthrough, then play six chapters with the same company. Your servers, investments and progress carry forward.</p>
      <ol className="chapter-overview">
        {chapters.map((chapter) => <li key={chapter.id} aria-current={chapter.current ? "step" : undefined}>
          <span className="chapter-number" aria-hidden="true">{chapter.completed ? <Icon name="check" size={18} /> : chapter.number}</span>
          <div><h3>{chapter.name}</h3><span className="chapter-status">{chapter.status}{chapter.current && chapter.completed ? " · You are here" : ""}</span><p>{chapter.description}</p>{chapter.number === 0 && (replaying ? <>
            <p>Practice is in progress. Finish or exit the walkthrough to return to your paused company.</p>
            <button className="btn btn-primary" onClick={() => { useGame.getState().endTour(false); setOpen(false); }}>Exit walkthrough</button>
          </> : <button className="btn" disabled={!tutorialDone && game.phase !== "management"} onClick={() => { setOpen(false); useGame.getState().startTour("campaign"); }}>Replay walkthrough</button>)}</div>
        </li>)}
      </ol>
      <p className="muted">Complete each chapter’s requirements and choose Next when it becomes available. Time is paused while you look around.</p>
      <div className="modal-foot">
        <span />
        <button className="btn btn-primary" onClick={() => setOpen(false)}>Back to company</button>
      </div>
    </Modal>}
  </>;
}
