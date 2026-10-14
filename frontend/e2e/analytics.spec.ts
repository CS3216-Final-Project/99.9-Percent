import { gunzipSync } from "node:zlib";
import { test, expect } from "./fixtures";

test("optional product analytics observes Play and survives reload with no title-screen start", async ({ page, withoutRoom }) => {
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
  await page.clock.install();
  await page.goto("/?test_secret=not-for-analytics");
  await expect(page.getByRole("button", { name: "Start Guided Mode" })).toBeVisible();
  // Nothing reaches PostHog before the player explicitly opts in.
  expect(captured).toEqual([]);
  expect(await page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith("ph_")))).toBe(false);
  await page.getByRole("button", { name: "Allow anonymous analytics" }).click();
  expect(await page.evaluate(() => localStorage.getItem("nn.analytics-consent.v1"))).toBe("accepted");
  expect(captured.filter(e => e.event === "gameplay_run_started")).toHaveLength(0);
  if (enabled) await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith("ph_phc_test")))).toBe(true);
  await page.getByRole("button", { name: "Start Guided Mode" }).click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.clock.runFor(20_000);
  if (enabled) {
    await expect.poll(async () => { await page.clock.runFor(3000); return captured.filter(e => e.event === "gameplay_run_started").length; }).toBe(1);
    const run = captured.find(e => e.event === "gameplay_run_started")!.properties;
    expect(captured.filter(e => e.event === "gameplay_session_started")).toHaveLength(1);
    expect(JSON.stringify(captured)).not.toContain("not-for-analytics");
    expect(captured.every(e => e.event.startsWith("gameplay_"))).toBe(true);
    expect(captured.some(e => e.event === "gameplay_session_progress" && Number(e.properties.session_active_ms) > 0)).toBe(true);
    await page.reload();
    await page.getByRole("button", { name: "Continue company", exact: true }).click();
    await page.clock.runFor(20_000);
    await expect.poll(async () => { await page.clock.runFor(3000); return captured.filter(e => e.event === "gameplay_run_resumed").length; }).toBe(1);
    expect(captured.filter(e => e.event === "gameplay_run_started")).toHaveLength(1);
    const resumed = captured.find(e => e.event === "gameplay_run_resumed")!.properties;
    expect(resumed.run_id).toBe(run.run_id);
    expect(resumed.gameplay_session_id).not.toBe(run.gameplay_session_id);
  } else {
    expect(captured).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem("nn.product-analytics.v1"))).toBeNull();
  }
});

test("the analytics choice is asked once and remembered", async ({ page, withoutRoom }) => {
  await withoutRoom();
  const posthog: string[] = [];
  await page.route("https://us.i.posthog.com/**", route => { posthog.push(route.request().url()); return route.abort(); });
  await page.goto("/");
  const panel = page.getByRole("region", { name: "Help improve 99.99%" });
  await expect(panel).toContainText("We never send account details, URLs, or saved games.");
  await page.getByRole("button", { name: "No thanks" }).click();
  await expect(panel).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("nn.analytics-consent.v1"))).toBe("declined");
  await page.reload();
  await expect(page.getByRole("region", { name: "Help improve 99.99%" })).toHaveCount(0);
  await page.getByRole("button", { name: "Start Guided Mode" }).click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  expect(posthog).toEqual([]);
});
