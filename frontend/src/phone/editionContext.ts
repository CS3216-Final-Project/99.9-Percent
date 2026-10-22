import { createContext, useContext } from "react";
import { currentEdition, type Edition } from "./edition";

/** The edition a subtree renders for, when fixed by EditionProvider; otherwise the page's edition. */
export const EditionContext = createContext<Edition | null>(null);

/** The edition this component renders for. */
export function useEdition(): Edition {
  return useContext(EditionContext) ?? currentEdition();
}
