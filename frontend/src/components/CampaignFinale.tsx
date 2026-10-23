import { useLayoutEffect, useState, type ReactNode } from "react";
import type { CampaignFinale as Finale } from "@/game/campaignFinale";
import { presentationReceipts, recordPresentationReceipt } from "@/game/presentationReceipts";
import { VisualNovelDialogue } from "./VisualNovelDialogue";

/** Plays the colleagues' celebration once per run, then yields to the scorecard it introduces. */
export function CampaignFinale({ finale, children }: { finale: Finale; children: ReactNode }) {
  const [seen, setSeen] = useState(() => presentationReceipts(finale.key).includes("shown"));
  useLayoutEffect(() => { if (!seen) recordPresentationReceipt(finale.key, "shown"); }, [finale.key, seen]);
  if (seen) return children;
  return <VisualNovelDialogue label="Campaign finale" lines={finale.lines}
    ending={<dl className="dialogue-stats" aria-label="Campaign results">{finale.stats.map(s => <div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}</dl>}
    endLabel="See the scorecard" dismissLabel="Skip to the scorecard" close={() => setSeen(true)}/>;
}
