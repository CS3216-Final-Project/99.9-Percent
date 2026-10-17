import { test, expect, expectRoom, seedSave, seedClassicSave, unlockChallenge, savedGame, openRoomControls, openCameraControls, setGameSpeed } from "./fixtures";
import { advanceTurn, newGame, newLegacyGame } from "../src/sim";

for (const width of [1440, 390, 320]) {
  test(`bottom dock stays usable and stable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await seedSave(page, newGame(1, "dock"));
    await page.goto("/");
    await page.getByRole("button", { name: "Continue company", exact: true }).click();
    await expectRoom(page);
    const dock = page.locator(".controls-dock");
    const run = dock.getByRole("button", { name: "Run", exact: true });
    const before = (await run.boundingBox())!;
    await run.click();
    const pause = dock.getByRole("button", { name: "Pause", exact: true });
    const after = (await pause.boundingBox())!;
    expect([after.width, after.height]).toEqual([before.width, before.height]);
    await pause.click();
    const second = (await savedGame(page)).campaign!.step;
    await page.clock.runFor(1000);
    expect((await savedGame(page)).campaign!.step).toBe(second);
    await expect(page.getByRole("button", { name: /Advance step|Advance game second/ })).toHaveCount(0);

    const speedSize = (await dock.locator(".time-menu > summary").boundingBox())!;
    await setGameSpeed(page, 0.5);
    const changedSize = (await dock.locator(".time-menu > summary").boundingBox())!;
    expect([changedSize.width, changedSize.height]).toEqual([speedSize.width, speedSize.height]);
    await openCameraControls(page);
    const cameraPanel = dock.locator(".dock-menu[open] > .dock-panel");
    await expect(cameraPanel.getByRole("button", { name: "Zoom in", exact: true })).toBeInViewport({ ratio: 1 });
    await cameraPanel.getByRole("button", { name: "Zoom in", exact: true }).click();
    const panelBox = (await cameraPanel.boundingBox())!, dockBox = (await dock.boundingBox())!;
    expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(dockBox.y);
    await cameraPanel.locator(".dock-shortcuts > summary").click();
    await expect(cameraPanel.locator(".dock-shortcuts p")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(cameraPanel).toBeHidden();
    await expect(dock.locator(width > 640 ? ".camera-menu > summary" : ".room-menu > summary")).toBeFocused();

    await openRoomControls(page);
    await dock.getByRole("group", { name: "Floors" }).getByRole("button", { name: /^Office floor/ }).click();
    await expect(dock.locator(".room-menu > summary .floor-number")).toHaveText("7");
    await page.keyboard.press("Escape");
    for (const label of ["Tech", "History"]) await expect(dock.getByRole("button", { name: label, exact: true })).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/controls-${width}.png` });
  });
}

for (const width of [1440, 320]) {
  test(`Challenge incident transport keeps its footprint at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await unlockChallenge(page);
    await page.addInitScript(() => localStorage.setItem("nn.mode.v1", "classic"));
    await seedClassicSave(page, advanceTurn({ ...newLegacyGame(1), users: 4500 }));
    await page.goto("/");
    await page.getByRole("button", { name: /^Continue week/ }).click();
    await expectRoom(page);
    const dock = page.locator(".controls-dock");
    const resume = dock.getByRole("button", { name: "Resume the incident clock", exact: true });
    const before = (await resume.boundingBox())!;
    await resume.click();
    const pause = dock.getByRole("button", { name: "Pause the incident clock", exact: true });
    const after = (await pause.boundingBox())!;
    expect([after.width, after.height]).toEqual([before.width, before.height]);
    await pause.click();
    await expect(dock.getByRole("button", { name: "Tech", exact: true })).toBeDisabled();
    const clock = await dock.locator(".brand-week").textContent();
    await page.clock.runFor(1000);
    await expect(dock.locator(".brand-week")).toHaveText(clock!);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(resume).toBeInViewport({ ratio: 1 });
    const readout = (await dock.locator(".brand-week").boundingBox())!;
    const speed = (await dock.locator(".time-menu > summary").boundingBox())!;
    expect(readout.x + readout.width).toBeLessThanOrEqual(speed.x - 4);
    await page.screenshot({ path: `test-results/controls-challenge-${width}.png` });
  });
}
