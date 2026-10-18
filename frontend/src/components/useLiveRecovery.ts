import { useEffect, useState } from "react";
import { useGame } from "@/game/store";

/** Observe live transitions, never initial/loading state. No save fields or extra sound. */
export function useLiveRecovery() {
  const [report, setReport] = useState<string | null>(null);
  useEffect(() => useGame.subscribe((next, previous) => {
    const a = previous.game, b = next.game;
    if (a.campaign?.runId !== b.campaign?.runId || previous.generation !== next.generation || !next.started) {
      setReport(null);
      return;
    }
    const latest = b.campaign?.reports.at(-1);
    if (previous.started && a.phase === "incident" && b.phase === "review" && latest &&
        latest.id !== a.campaign?.reports.at(-1)?.id && latest.recoveredStep === b.campaign?.step) setReport(latest.id);
  }), []);
  return { report, reviewed: () => setReport(null) };
}
