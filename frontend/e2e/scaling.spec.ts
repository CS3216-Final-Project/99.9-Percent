import type { Page } from "@playwright/test";
import { test, expect, seedSave, savedGame, expectRoom, advanceCampaignStep, openPanelTab } from "./fixtures";
import { newGame, applyAction, type GameState, type Action } from "../src/sim";
import { advanceSteps } from "../src/sim/step";

type ScalingPath = "vertical" | "horizontal";
function act(game: GameState, action: Action) {
  const result = applyAction(game, action);
  if (!result.ok) throw Error(result.message);
  return result.state;
}
function company() {
  let game = advanceSteps(newGame(3, "browser-scaling"), 6).state;
  game = advanceSteps(act(game, { type: "start_db_upgrade" }), 30).state;
  return act(act(game, { type: "acknowledge_review" }), { type: "acknowledge_milestone" });
}
function appIncident() {
  return advanceSteps(act(company(), { type: "start_db_upgrade" }), 9).state;
}
/** The exact pending configuration reached by each installation journey below. */
function pendingRecovery(path: ScalingPath) {
  let game = appIncident();
  if (path === "vertical") return act(game, { type: "scale_up", appId: "app-1" });
  game = advanceSteps(act(game, { type: "add_server" }), 2).state;
  game = act(game, { type: "incident_inspect", equipment: "app", appId: "app-2" });
  game = advanceSteps(act(game, { type: "deploy_load_balancer" }), 2).state;
  return act(game, { type: "set_routing", mode: "balanced", targets: ["app-1", "app-2"] });
}
async function boot(page: Page, game: GameState) {
  const api: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/")) api.push(request.url()); });
  await page.route("**/api/**", route => route.abort());
  await seedSave(page, game);
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  return api;
}
async function confirm(page: Page, name: RegExp) {
  await openPanelTab(page, "Actions");
  await page.getByRole("button", { name }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
}

test("scaling: database headroom activates before the application growth incident", async ({ page, withoutRoom, installClock }) => {
  await withoutRoom(); await installClock();
  const api = await boot(page, company());
  await confirm(page, /Upgrade database/);
  await advanceCampaignStep(page, { seconds: 9, resumeClock: false });
  expect((await savedGame(page)).campaign).toEqual(appIncident().campaign);
  expect(api.every(url => new URL(url).pathname === "/api/session")).toBe(true);
});

for (const path of ["vertical", "horizontal"] as const) {
  test(`scaling installation: ${path}`, async ({ page, withoutRoom, installClock }) => {
    // The horizontal path draws the room through each installation; SwiftShader can spend over a minute on it.
    if (path === "horizontal") test.setTimeout(120_000);
    await installClock();
    if (path === "vertical") await withoutRoom();
    const api = await boot(page, appIncident());
    expect((await savedGame(page)).campaign!.incident!.primaryComponent).toBe("app-1");
    if (path === "horizontal") {
      await expectRoom(page);
      await confirm(page, /Add server/);
      await advanceCampaignStep(page, { seconds: 2, resumeClock: false });
      const installed = (await savedGame(page)).campaign!;
      expect(installed.snapshot.instances!.map(app => app.demand)).toEqual([1400, 0]);
      expect(installed.incident).not.toBeNull();
      // Paint the installed rack with the physical game still paused.
      await page.clock.runFor(200);
      await page.getByRole("main").getByRole("button", { name: "App 2", exact: true }).click();
      const reveal = page.getByRole("dialog", { name: "Servers inspected" });
      await expect(reveal).toContainText("App 2");
      await reveal.getByRole("button", { name: "Return to room" }).click();
      await expect(page.getByRole("region", { name: "Application instances" }).getByRole("button", { name: /App 2:/ })).toHaveAttribute("aria-pressed", "true");
      await confirm(page, /Deploy load balancing/);
      await advanceCampaignStep(page, { seconds: 2, resumeClock: false });
      expect((await savedGame(page)).campaign!.routing.mode).toBe("single");
      await page.getByText("Configure routing · App 1 only", { exact: true }).click();
      await page.getByRole("button", { name: "All apps", exact: true }).click();
    } else await confirm(page, /Scale up App 1/);
    // Validate the handoff as well as the controls: recovery seeds this very configuration.
    expect((await savedGame(page)).campaign).toEqual(pendingRecovery(path).campaign);
    expect(api.every(url => new URL(url).pathname === "/api/session")).toBe(true);
  });

  test(`scaling recovery: ${path}, measured report and paused reload`, async ({ page, withoutRoom, installClock }) => {
    await withoutRoom(); await installClock();
    const api = await boot(page, pendingRecovery(path));
    const report = page.getByRole("dialog", { name: "Incident postmortem" });
    await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 60_000));
    await page.getByRole("button", { name: "Run", exact: true }).click();
    for (let tick = 0; tick < 150 && !(await report.isVisible()); tick++) await page.clock.runFor(200);
    await expect(report).toBeVisible({ timeout: 30_000 });
    if (path === "horizontal") expect((await savedGame(page)).campaign!.snapshot.instances!.map(app => app.demand)).toEqual([700, 700]);
    await report.getByRole("button", { name: "Continue company", exact: true }).click();
    await page.screenshot({ path: `test-results/phase3-${path}.png` });
    const before = (await savedGame(page)).campaign!;
    expect(before.runId).toBe("browser-scaling"); expect(before.dbCapacity).toBe(2000);
    await page.reload(); await page.getByRole("button", { name: "Continue company", exact: true }).click();
    expect((await savedGame(page)).campaign).toEqual(before);
    expect(api.every(url => new URL(url).pathname === "/api/session")).toBe(true);
  });
}
