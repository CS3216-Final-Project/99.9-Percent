import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { applyAction, newGame } from "@/sim";
import { advanceSteps } from "@/sim/step";
import { num } from "@/game/format";
import { GateCounts } from "./Facility";

afterEach(cleanup);

describe("GateCounts", () => {
  // While a limit turns demand away, the In tag must show the effective admitted
  // rate — the same figure the management surfaces report — not the raw demand.
  it("shows the admitted in-rate the management view reports, not the raw demand", () => {
    const applied = applyAction(newGame(1, "gate-limit"), { type: "set_traffic_limit", enabled: true });
    if (!applied.ok) throw Error(applied.message);
    const c = advanceSteps(applied.state, 4).state.campaign!;
    const m = c.snapshot;
    expect(c.limit).not.toBeNull();
    expect(m.incoming).toBeGreaterThan(m.admitted);
    expect(m.admitted).toBe(c.limit);
    expect(m.rejected).toBeGreaterThan(0);
    render(<GateCounts c={c} />);
    const inTag = screen.getByLabelText(/^In:/);
    expect(inTag.textContent).toContain(`In ${num(m.admitted)}/s`);
    expect(inTag.textContent).not.toContain(`${num(m.incoming)}/s`);
    expect(inTag.textContent).toContain(`${num(m.rejected)}/s turned away`);
    expect(screen.getByLabelText(/^Out:/).textContent).toContain(`Out ${num(m.successful)}/s`);
  });
});
