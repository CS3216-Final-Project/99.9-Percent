import { gunzipSync } from "node:zlib";
import { completeTutorial, test, expect, CHAPTER_ZERO_LESSONS } from "./fixtures";

test("optional product analytics observes Play and survives reload with no title-screen start", async ({ page, withoutRoom , installClock}) => {
 await installClock();
  await withoutRoom();
  const enabled = process.env.ANALYTICS_SMOKE === "1";
  const captured: { event: string; properties: Record<string, unknown> }[] = [];
  await page.route("https://us.i.posthog.com/**", async route => {
    const request = route.request();
    if (request.method() === "POST") {
      const raw = request.postDataBuffer();
      if (raw) {
        let text = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw).toString() : raw.toString();
        if (text.startsWith("data=")) text = Buffer.from(new URLSearchParams(text).get("data")!, "base64").toString();
        const payload = JSON.parse(text);
        captured.push(...(Array.isArray(payload) ? payload : Array.isArray(payload.batch) ? payload.batch : [payload]));
      }
    }
    await route.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" }, body: '{"status":1}' });
  });
  await page.route("**/api/**", route => route.abort());
  // PostHog filters webdriver browsers as bots; this synthetic journey represents a human player.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "userAgentData", { get: () => ({ brands: [{ brand: "Chromium", version: "153" }], mobile: false, platform: "Windows" }) });
  });

  await page.goto("/?test_secret=not-for-analytics");
  await expect(page.getByRole("button", { name: "Start Guided Mode" })).toBeVisible();
  // Analytics is on by default: PostHog starts before the player answers the notice.
  await expect(page.getByRole("region", { name: "Help improve 99.99%" })).toBeVisible();
  if (enabled) await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith("ph_phc_test")))).toBe(true);
  expect(captured.filter(e => e.event === "gameplay_run_started")).toHaveLength(0);
  await page.getByRole("button", { name: "OK", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("nn.analytics-consent.v1"))).toBe("accepted");
  await page.getByRole("button", { name: "Start Guided Mode" }).click();
  await completeTutorial(page);
  await page.clock.runFor(20_000);
  if (enabled) {
    await expect.poll(async () => { await page.clock.runFor(3000); return captured.filter(e => e.event === "gameplay_run_started").length; }).toBe(1);
    const run = captured.find(e => e.event === "gameplay_run_started")!.properties;
    expect(captured.filter(e => e.event === "gameplay_session_started")).toHaveLength(1);
    expect(JSON.stringify(captured)).not.toContain("not-for-analytics");
    expect(captured.every(e => e.event.startsWith("gameplay_"))).toBe(true);
    expect(captured.some(e => e.event === "gameplay_session_progress" && Number(e.properties.session_active_ms) > 0)).toBe(true);
    // The walkthrough the player completed is reported once each way, with only its track, step and start.
    const tutorial = () => captured.filter(e => e.event.startsWith("gameplay_tutorial_")).map(e => [e.event, e.properties.tutorial_track, e.properties.tutorial_step, e.properties.tutorial_from ?? e.properties.reason]);
    expect(tutorial()).toEqual([["gameplay_tutorial_started", "campaign", 0, "first_visit"], ["gameplay_tutorial_completed", "campaign", CHAPTER_ZERO_LESSONS - 1, undefined]]);
    await page.reload();
    await page.getByRole("button", { name: "Continue company", exact: true }).click();
    await page.clock.runFor(20_000);
    await expect.poll(async () => { await page.clock.runFor(3000); return captured.filter(e => e.event === "gameplay_run_resumed").length; }).toBe(1);
    expect(captured.filter(e => e.event === "gameplay_run_started")).toHaveLength(1);
    const resumed = captured.find(e => e.event === "gameplay_run_resumed")!.properties;
    expect(resumed.run_id).toBe(run.run_id);
    expect(resumed.gameplay_session_id).not.toBe(run.gameplay_session_id);
    expect(tutorial()).toHaveLength(2);
  } else {
    expect(captured).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem("nn.product-analytics.v1"))).toBeNull();
  }
});
