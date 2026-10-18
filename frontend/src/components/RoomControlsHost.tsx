import { useContext, useState, type ReactNode } from "react";

import { Host, Register } from "./roomControlsContext";

/** The renderer owns its callbacks, while the shell owns their DOM placement. */
export function RoomControlsHost({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  return <Register.Provider value={setHost}><Host.Provider value={host}>{children}</Host.Provider></Register.Provider>;
}
export function RoomControlsSlot() {
  const register = useContext(Register);
  return <div ref={register} className="room-controls" role="group" aria-label="Navigation" data-label="Navigation" />;
}
