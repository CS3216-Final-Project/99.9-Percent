// @vitest-environment node
import { expect, it } from "vitest";
import { wonCompany } from "@/sim/__tests__/completionFixture";
import { phoneCampaignSummary } from "./phoneSummary";

it("tells a completed campaign from a closed company, as the desktop home screen does", () => {
  // A phone can open a desktop company through a cloud save or an import, including an old Grow the Company save.
  const won = wonCompany();
  expect(phoneCampaignSummary(won, true)).toMatchObject({ progress: "All chapters complete", ended: true, continueLabel: "See how it ended" });
  expect(phoneCampaignSummary({ ...won, outcome: "bankrupt" }, true).progress).toBe("Company closed");
});
