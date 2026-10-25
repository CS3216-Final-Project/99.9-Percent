import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { RecordedFields } from "./RecordedFields";

afterEach(cleanup);
it("reads money, routes and cache percentages without turning a user target into a percentage", () => {
  const { container } = render(<RecordedFields data={{ finalUserTarget: 50000, cacheTarget: 6000, costCents: 250000, routing: JSON.stringify({ mode: "balanced", targets: ["app-1", "app-2"] }), acknowledged: false, runId: "internal" }}/>);
  expect(screen.getByText("Final user target").nextElementSibling?.textContent).toBe("50,000");
  expect(screen.getByText("Cache target").nextElementSibling?.textContent).toBe("60%");
  expect(screen.getByText("Cost").nextElementSibling?.textContent).toBe("$2,500.00");
  expect(screen.getByText("Routing").nextElementSibling?.textContent).toBe("App 1, App 2 (balanced)");
  expect(container.textContent).not.toContain("internal");
  expect(container.querySelector("pre")).toBeNull();
});
