import { test } from "./fixtures";
import { recoveryJourney } from "./incidentRecovery";

test.use({ reviewRecoveryNotice: false });
for (const limited of [false, true]) test(`recovery report: ordered acknowledgement, evidence, focus and reload (${limited ? "limited" : "database"})`, async ({ page, installClock , withoutRoom}, info) => {
  await withoutRoom();
  await installClock(); await recoveryJourney(page, info, false, limited);
});
