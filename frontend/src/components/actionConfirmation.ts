// One action confirmation is open at a time across the panel, keyed by the action label.
let confirming: string | null = null;
const listeners = new Set<() => void>();

export function setConfirming(label: string | null) {
  confirming = label;
  listeners.forEach((l) => l());
}
/** Follow which action's confirmation is open, for the actions themselves and for a guide pointing at one. */
export function subscribeConfirming(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
/** The label of the action whose confirmation is open, if any. */
export const confirmingAction = () => confirming;
