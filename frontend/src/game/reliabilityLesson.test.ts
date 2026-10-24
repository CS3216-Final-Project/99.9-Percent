import { expect, it } from "vitest";
import { reliabilityLesson } from "./reliabilityLesson";
import { reliabilityOutcome } from "./__fixtures__/reliabilityOutcome";


it("distinguishes requested restoration from natural return using recorded events", () => {
  const manual = reliabilityOutcome(true).campaign!, natural = reliabilityOutcome().campaign!;
  expect(reliabilityLesson(manual)?.recovered).toContain("requested a free server restore");
  expect(reliabilityLesson(natural)?.recovered).toContain("returned automatically");
  expect(reliabilityLesson(natural)?.happened).toContain("so an incident opened");
  expect(reliabilityLesson(natural)?.recovered).not.toContain("Automatic failover");
  const before = JSON.stringify(natural); reliabilityLesson(natural); expect(JSON.stringify(natural)).toBe(before);
});

it("records actual spare promotion and substantial rejection without claiming it prevented an incident", () => {
  const c = reliabilityOutcome(false, true).campaign!;
  const lesson = reliabilityLesson(c)!;
  expect(lesson.recovered).toContain("Automatic failover brought a reserved spare");
  expect(lesson.recovered).toContain("Many incoming requests were turned away");
  expect(lesson.improve).toContain("without the traffic limit");
  expect(lesson.happened).toContain("without opening an incident");
});

it("keeps historical explanations bounded and refuses unrelated older incident reports", () => {
  const c = reliabilityOutcome().campaign!, before = reliabilityLesson(c);
  expect(reliabilityLesson(c, c.reports[0])).toBeUndefined();
  c.trace.push({ id: c.nextEventId++, step: c.step, type: "failover-activated", data: { eventId: c.reliabilityStage!.fault!.id, appId: "app-99" } });
  expect(reliabilityLesson(c)).toEqual(before);
  const report = c.reports.find(r => r.snapshots.some(m => m.reliability?.faultId === c.reliabilityStage!.fault!.id))!;
  expect(reliabilityLesson(c, report)?.happened).toContain("failed");
  const later = { ...report, openedStep: c.reliabilityStage!.fault!.restoredStep! + 1, recoveredStep: c.step + 10 };
  expect(reliabilityLesson(c, later)).toBeUndefined();
});
