import { createContext, useEffect, useMemo, useState } from "react";
import { useGame } from "@/game/store";
import { useMediaQuery } from "../useMediaQuery";
import { machineCuesBetween, type MachineCue } from "./machineCues";

type ActiveCue = MachineCue & { born: number | null };
export interface Feedback { active: Map<string, ActiveCue>; latest: MachineCue[]; reduced: boolean }
export const MachineFeedbackContext = createContext<Feedback>({ active: new Map(), latest: [], reduced: false });

/** Observe actual activations once; a loaded snapshot never queues old celebrations. */
export function useMachineFeedback(): Feedback {
  const [active] = useState(() => new Map<string, ActiveCue>());
  const [latest, setLatest] = useState<MachineCue[]>([]);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  useEffect(() => {
    const unsubscribe = useGame.subscribe((next, prev) => {
      if (next.generation !== prev.generation || !next.started) {
        active.clear();
        setLatest([]);
        return;
      }
      const cues = machineCuesBetween(prev, next);
      if (!cues.length) return;
      for (const cue of cues) {
        const live = { ...cue, born: null };
        for (const target of cue.targets) active.set(target, live);
      }
      setLatest(cues);
    });
    return () => { unsubscribe(); active.clear(); };
  }, [active]);
  return useMemo(() => ({ active, latest, reduced }), [active, latest, reduced]);
}

