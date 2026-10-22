import { test } from "./fixtures";
import { campaignReportJourney } from "./campaignReports";
for (const kind of ["prevention", "spikes", "growth", "completion"] as const) {
  test(`Campaign report: ${kind} summary, single disclosure and acknowledgement`, async ({ page, installClock }, info) => {
    await installClock(); await campaignReportJourney(page, info, kind);
  });
}
