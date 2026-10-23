import { test } from "./fixtures";
import { appHealthDuringOpening, appHealthJourney, appHealthProblem } from "./appHealth";

for (const [width, height] of [[1440, 900], [1366, 768]]) {
    test(`App Health dashboard, keyboard and overlay interactions at ${width}x${height}`, async ({ page }) => {
        await appHealthJourney(page, width, height);
    });
}
test("the Launch Week letter gives way to the App Health dialog", async ({ page }) => {
    await appHealthDuringOpening(page);
});

test("App Health explains a real overloaded snapshot without prescribing an upgrade", async ({page}) => { await appHealthProblem(page); });
