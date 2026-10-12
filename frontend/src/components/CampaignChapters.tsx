import { useState } from "react";
import { campaignChapters } from "@/game/campaignChapters";
import { useGame } from "@/game/store";
import { Icon } from "./icons";
import { Modal } from "./ui";
import "./CampaignChapters.css";

export function CampaignChapters() {
  const game = useGame((s) => s.game);
  const [open, setOpen] = useState(false);
  const chapters = campaignChapters(game);
  const current = chapters.find((chapter) => chapter.current)!;

  return <>
    <section className="chapter-bar" aria-label="Campaign chapters">
      <div className="chapter-current">
        <p>Campaign · Chapter {current.number} of {chapters.length}</p>
        <h2 aria-label="Current chapter"><span aria-label="Current campaign stage">{current.name}</span></h2>
      </div>
      <ol className="chapter-trail" aria-label="Chapter progress">
        {chapters.map((chapter) => <li key={chapter.id} aria-current={chapter.current ? "step" : undefined} className={chapter.completed ? "is-complete" : ""}>
          <span className="chapter-number" aria-hidden="true">{chapter.completed ? <Icon name="check" size={16} /> : chapter.number}</span>
          <span>{chapter.shortName}<small>{chapter.status}</small></span>
        </li>)}
      </ol>
      <button type="button" className="btn" aria-haspopup="dialog" onClick={() => {
        useGame.getState().setRunning(false);
        setOpen(true);
      }}><Icon name="goal" size={18} />View chapters</button>
    </section>
    {open && <Modal title="Campaign chapters" icon={{ kind: "tech", name: "goal" }} onClose={() => setOpen(false)}>
      <p>One company, five chapters. Your servers, investments and progress carry forward.</p>
      <ol className="chapter-overview">
        {chapters.map((chapter) => <li key={chapter.id} aria-current={chapter.current ? "step" : undefined}>
          <span className="chapter-number" aria-hidden="true">{chapter.completed ? <Icon name="check" size={18} /> : chapter.number}</span>
          <div><h3>{chapter.name}</h3><span className="chapter-status">{chapter.status}{chapter.current && chapter.completed ? " · You are here" : ""}</span><p>{chapter.description}</p></div>
        </li>)}
      </ol>
      <p className="muted">Complete each chapter’s requirements and choose Continue when it becomes available. Time is paused while you look around.</p>
      <div className="modal-foot">
        <span />
        <button className="btn btn-primary" onClick={() => setOpen(false)}>Back to company</button>
      </div>
    </Modal>}
  </>;
}
