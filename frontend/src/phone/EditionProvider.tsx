import type { ReactNode } from "react";
import type { Edition } from "./edition";
import { EditionContext } from "./editionContext";

/** Fix the edition for a subtree; without a provider, components get the page's edition. */
export function EditionProvider({ edition, children }: { edition: Edition; children: ReactNode }) {
  return <EditionContext.Provider value={edition}>{children}</EditionContext.Provider>;
}
