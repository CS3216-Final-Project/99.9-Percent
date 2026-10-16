import { test } from "./fixtures";
import { appHealthDuringTutorial, appHealthJourney, appHealthProblem } from "./appHealth";

for (const [width, height] of [[1440, 900], [1366, 768]]) {
    test(`App Health dashboard, keyboard and overlay interactions at ${width}x${height}`, async ({ page }) => {
        await appHealthJourney(page, width, height);
    });
}
test("App Health yields to and restores the spotlight without advancing it", async ({ page }) => {
    await appHealthDuringTutorial(page);
});

test("App Health explains a real overloaded snapshot without prescribing an upgrade", async ({page}) => { await appHealthProblem(page); });
