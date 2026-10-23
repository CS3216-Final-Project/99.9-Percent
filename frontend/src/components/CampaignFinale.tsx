import { useState, type ReactNode } from "react";
import type { CampaignFinaleScene } from "@/game/campaignFinale";
import { presentationReceipts, recordPresentationReceipt } from "@/game/presentationReceipts";
import { VisualNovelDialogue } from "./VisualNovelDialogue";

/** Plays the colleagues' celebration once per run, then yields to the scorecard it introduces. */
export function CampaignFinale({ finale, children }: { finale: CampaignFinaleScene; children: ReactNode }) {
  const [seen, setSeen] = useState(() => presentationReceipts(finale.key).includes("shown"));
  if (seen) return children;
  // Only reaching the end or skipping counts as seen, so a scene that is unmounted early plays again.
  const close = () => { recordPresentationReceipt(finale.key, "shown"); setSeen(true); };
  return <VisualNovelDialogue label="Campaign finale" lines={finale.lines}
    ending={<dl className="dialogue-stats" aria-label="Campaign results">{finale.stats.map(s => <div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}</dl>}
    endLabel="See the scorecard" dismissLabel="Skip to the scorecard" close={close}/>;
}
