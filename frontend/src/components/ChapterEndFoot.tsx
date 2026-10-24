import { useId, type ReactNode } from "react";
import type { ChapterEnd } from "@/game/chapterCompletion";
import { waitsFor } from "@/game/entryGates";
import { useGame } from "@/game/store";
import { Icon } from "./icons";
import { Callout } from "./ui";

/**
 * How every finished chapter ends: Stay in this chapter, or Continue into the next one. When the next chapter is not
 * open yet, Continue is disabled and every unmet requirement is named; Next in the chapter bar offers it later.
 */
export function ChapterEndFoot({ end, extra }: { end: ChapterEnd; extra?: ReactNode }) {
  const finish = useGame(s => s.finishChapter);
  const reason = useId();
  const blocked = !!end.proceed && end.blockers.length > 0;
  return <>
    {blocked && <Callout compact tone="warn" icon="alert" kicker="Not yet"><span id={reason} role="note">{waitsFor(end.next.name, end.blockers)} Stay in this chapter and continue later with Next in the chapter bar.</span></Callout>}
    <div className="modal-foot chapter-end-foot">
      {extra && <span className="chapter-end-extra">{extra}</span>}
      {/* The dialog opens on Continue when it is possible, so Enter keeps meaning "carry on" as before, and otherwise on Stay. */}
      <button className="btn btn-quiet" data-autofocus={end.proceed && !blocked ? undefined : true} onClick={() => finish("stay")}>Stay in this chapter</button>
      {end.proceed && <button className="btn btn-primary" data-autofocus={blocked ? undefined : true} disabled={blocked} aria-describedby={blocked ? reason : undefined} onClick={() => finish("continue")}>{end.label}<Icon name="next" /></button>}
    </div>
  </>;
}
