import { test, expect, seedSave } from "./fixtures";
import { inspectEquipment } from "./componentInspection";
import { newGame } from "../src/sim";
import { advanceSteps } from "../src/sim/step";

// Written for CI. These surfaces use equipment shortcuts, so drawing the room adds no coverage.
for (const phone of [false, true]) test.describe(phone ? "phone focused workspaces" : "desktop focused workspaces", () => {
  test.use({ edition: phone ? "phone" : "desktop", viewport: { width: phone ? 390 : 1440, height: phone ? 844 : 900 }, isMobile: phone, hasTouch: phone });

  test.beforeEach(async ({ page, withoutRoom }) => {
    await withoutRoom();
    await page.route("**/api/**", route => route.abort());
    // A measured observation makes individual-server health available without entering overload.
    await seedSave(page, advanceSteps(newGame(1, "focused-workspaces"), 1).state);
    await page.goto("/");
    await page.getByRole("button", { name: "Continue company", exact: true }).click();
  });

  test("Tech and History cover the screen down to the live dock and return focus", async ({ page }, testInfo) => {
    const dock = page.locator(".controls-dock");
    for (const [label, title] of [["Tech", "Tech tree"], ["History", "History"]]) {
      const viewsMenu = dock.locator(".phone-views-menu > summary");
      const folded = await viewsMenu.isVisible();
      if (folded) await viewsMenu.click();
      const entry = dock.getByRole("button", { name: label, exact: true, includeHidden: true });
      await entry.click();
      const workspace = page.getByRole("region", { name: title, exact: true });
      await expect(workspace).toBeVisible();
      await expect(workspace.getByRole("heading", { name: title, exact: true })).toBeFocused();
      const area = (await workspace.boundingBox())!;
      const dockArea = (await dock.boundingBox())!;
      expect(area.x).toBe(0);
      expect(area.y).toBe(0);
      expect(area.width).toBe(page.viewportSize()!.width);
      expect(area.y + area.height).toBeCloseTo(dockArea.y, 0);
      await expect(workspace).toHaveCSS("background-color", "rgb(26, 22, 51)");
      await expect(workspace).toHaveCSS("border-radius", "0px");
      await expect(page.locator(phone ? ".phone-top" : ".topbar")).toBeHidden();
      await expect(dock.getByRole("group", { name: "Navigation", exact: true })).toBeHidden();
      const time = dock.getByRole("group", { name: "Time", exact: true });
      await expect(time).toBeInViewport({ ratio: 1 });
      await expect(time).toContainText("Week");
      await expect(time.getByRole("button", { name: /^(Run|Pause)$/ })).toBeInViewport({ ratio: 1 });
      // Wide docks show inline speeds; narrow docks open their speeds above the workspace.
      const speedMenu = dock.locator(".time-menu > summary");
      const foldedSpeeds = await speedMenu.isVisible();
      if (foldedSpeeds) await speedMenu.click();
      const doubleSpeed = dock.getByRole("group", { name: "Game speed" }).getByRole("button", { name: "2×", exact: true });
      await doubleSpeed.click();
      await expect(doubleSpeed).toHaveAttribute("aria-pressed", "true");
      if (foldedSpeeds) await speedMenu.click();
      await expect(entry).toHaveAttribute("aria-pressed", "true");
      await page.screenshot({ path: testInfo.outputPath(`${label.toLowerCase()}.png`) });
      await workspace.getByRole("button", { name: "Back to room", exact: true }).click();
      await expect(workspace).toBeHidden();
      await expect(folded ? viewsMenu : entry).toBeFocused();
      await expect(page.locator(phone ? ".phone-top" : ".topbar")).toBeVisible();
    }
  });

  test("machine health has a readable gap below its portrait", async ({ page }, testInfo) => {
    const inspector = await inspectEquipment(page, "app");
    const summary = inspector.locator(".component-inspection-summary");
    const portrait = (await summary.locator(".inspection-scanner").boundingBox())!;
    const health = (await summary.locator(".inspection-status").boundingBox())!;
    expect(health.y - (portrait.y + portrait.height)).toBeCloseTo(12, 1);
    await expect(summary.locator(".inspection-status")).toHaveText("Healthy");
    await inspector.getByRole("button", { name: "Server management", exact: true }).click();
    await inspector.locator('[data-guidance-app="app-1"]').click();
    await expect(inspector.getByRole("heading", { name: "App 1", exact: true })).toBeVisible();
    await expect(summary.locator(".inspection-status")).toHaveText("Healthy");
    const serverPortrait = (await summary.locator(".inspection-scanner").boundingBox())!;
    const serverHealth = (await summary.locator(".inspection-status").boundingBox())!;
    expect(serverHealth.y - (serverPortrait.y + serverPortrait.height)).toBeCloseTo(12, 1);
    await page.screenshot({ path: testInfo.outputPath("machine-health-spacing.png") });
  });
});
