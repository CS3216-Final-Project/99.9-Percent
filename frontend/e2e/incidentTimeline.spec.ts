import type { Locator, Page } from "@playwright/test";
import { test, expect, seedSave, expectRoom } from "./fixtures";
import { newGame } from "../src/sim";
import { act, tick } from "../src/sim/__tests__/spikeFixtures";

/** An Opening incident answered late: the Database upgrade comes 40 game seconds in, so the window is long and its events crowd. */
function slowResponse() {
  let g = act(tick(newGame(1, "slow-response"), 46), { type: "start_db_upgrade" });
  for (let i = 0; i < 200 && g.phase !== "review"; i++) g = tick(g);
  expect(g.phase).toBe("review");
  return g;
}

/** What the timeline draws, measured in the page: everything must sit inside its plot, apart and readable. */
function measure(slider: Locator) {
  return slider.evaluate(plot => {
    const box = plot.getBoundingClientRect(), svg = plot.querySelector("svg")!;
    const texts = [...svg.querySelectorAll("text")].map(t => { const { x, y, width, height } = t.getBBox(); return { text: t.textContent!, x, y, width, height }; });
    const markers = [...svg.querySelectorAll(".timeline-marker circle")].map(c => ({ x: +c.getAttribute("cx")!, y: +c.getAttribute("cy")!, r: +c.getAttribute("r")! }));
    const bottom = Math.max(...markers.map(m => m.y)) + 9;
    // Each limit label's glyphs must stay clear of the stroke of the line plotted in its own lane.
    const ink = document.createElement("canvas").getContext("2d")!;
    const labelHits = [...svg.querySelectorAll(".timeline-limit-label")].map(label => {
      const b = (label as SVGTextElement).getBBox(), line = label.parentElement!.nextElementSibling as SVGPathElement;
      ink.font = getComputedStyle(label).font;
      const glyphs = ink.measureText(label.textContent!), base = +label.getAttribute("y")!, pad = parseFloat(getComputedStyle(line).strokeWidth) / 2;
      const high = base - glyphs.actualBoundingBoxAscent - pad, low = base + glyphs.actualBoundingBoxDescent + pad;
      let hits = 0;
      for (let s = 0; s <= line.getTotalLength(); s += 0.5) {
        const p = line.getPointAtLength(s);
        if (p.x >= b.x - pad && p.x <= b.x + b.width + pad && p.y >= high && p.y <= low) hits++;
      }
      return { text: label.textContent!, hits };
    });
    return { left: box.left, right: box.right, width: svg.viewBox.baseVal.width, drawn: svg.getBoundingClientRect().toJSON() as DOMRect, texts, markers, labelHits, axis: texts.filter(t => t.y > bottom) };
  });
}
const overlaps = (a: { x: number; width: number }, b: { x: number; width: number }) => a.x < b.x + b.width && b.x < a.x + a.width;

async function openTimeline(page: Page, scope: Locator) {
  // The disclosure slides open on a CSS transition; reduced motion opens it at once.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await scope.getByText("View Technical Details", { exact: true }).click();
  const slider = scope.getByRole("slider", { name: "Incident timeline, game second", exact: true });
  await expect(slider).toBeVisible();
  return slider;
}

async function expectTidy(slider: Locator) {
  // What the player sees is the painted frame, after the plot has measured its width.
  await slider.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const m = await measure(slider);
  // The plot is drawn at the width it has, one to one, so nothing is cut off on the right or scaled down.
  expect(m.drawn.right).toBeLessThanOrEqual(m.right + 0.5);
  expect(Math.abs(m.drawn.width - m.width)).toBeLessThan(1);
  for (const t of m.texts) { expect(t.x, t.text).toBeGreaterThanOrEqual(-0.5); expect(t.x + t.width, t.text).toBeLessThanOrEqual(m.width + 0.5); }
  // No two event markers cover each other, however close their seconds.
  for (const [i, a] of m.markers.entries()) for (const b of m.markers.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r);
  // The axis shows at least two second ticks, none touching another or the "Second" label.
  expect(m.axis.filter(t => /^\d+$/.test(t.text)).length).toBeGreaterThanOrEqual(2);
  for (const [i, a] of m.axis.entries()) for (const b of m.axis.slice(i + 1)) expect(overlaps(a, b), `${a.text} / ${b.text}`).toBe(false);
  for (const label of m.labelHits) expect(label.hits, label.text).toBe(0);
  return m;
}

/** The focus ring shows on all four sides: no ancestor that clips its content cuts into it. */
async function expectWholeFocusRing(page: Page, slider: Locator) {
  await page.keyboard.press("Tab");
  await expect(slider).toBeFocused();
  // Reduced motion still runs a 1 ms transition into the ring.
  await slider.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const clipped = await slider.evaluate(plot => {
    const style = getComputedStyle(plot), grow = parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth), box = plot.getBoundingClientRect();
    if (!plot.matches(":focus-visible") || style.outlineStyle === "none") return ["no ring"];
    const ring = { left: box.left - grow, right: box.right + grow, top: box.top - grow, bottom: box.bottom + grow };
    const cuts: string[] = [];
    for (let el = plot.parentElement; el; el = el.parentElement) {
      const s = getComputedStyle(el);
      if (s.overflowX === "visible" && s.overflowY === "visible") continue;
      const clip = el.getBoundingClientRect(), left = clip.left + el.clientLeft, top = clip.top + el.clientTop;
      if (ring.left < left - 0.5 || ring.right > left + el.clientWidth + 0.5) cuts.push(`${el.className} cuts the sides`);
      if (s.overflowY !== "visible" && el.scrollHeight <= el.clientHeight && (ring.top < top - 0.5 || ring.bottom > top + el.clientHeight + 0.5)) cuts.push(`${el.className} cuts the ends`);
    }
    return cuts;
  });
  expect(clipped).toEqual([]);
}

for (const [width, height] of [[1440, 900], [390, 844], [320, 640]]) test(`incident timeline fits, spaces its markers and shows its focus at ${width} px`, async ({ page, withoutRoom }, info) => {
  await withoutRoom();
  await page.setViewportSize({ width, height });
  await page.route("**/api/**", route => route.abort()); await seedSave(page, slowResponse()); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click(); await expectRoom(page);
  const report = page.getByRole("dialog", { name: "Incident postmortem", exact: true });
  const slider = await openTimeline(page, report);
  const plot = await expectTidy(slider);
  // The pointer picks the second drawn under it: the drawing's right end is the window's last second.
  await slider.hover({ position: { x: plot.drawn.left - plot.left + plot.width - 15, y: 60 } });
  await expect(slider).toHaveAttribute("aria-valuenow", "54");
  await expect(slider).toHaveAttribute("aria-valuetext", /^Game second 54: response time [\d,]+ ms, service errors [\d.]+%, App Servers [\d,]+ of [\d,]+ req\/s, Database [\d,]+ of [\d,]+ ops\/s$/);
  await report.getByText("View Technical Details", { exact: true }).focus();
  await expectWholeFocusRing(page, slider);
  await slider.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath(`postmortem-${width}.png`) });

  // The same report read later from History.
  await report.getByRole("button", { name: "Continue company", exact: true }).click();
  await page.getByRole("button", { name: "Continue to Scaling & Routing", exact: true }).click();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.getByRole("tab", { name: "Incidents (1)", exact: true }).click();
  // A wide History shows the newest report beside the list; a narrow one expands it under its row.
  if (width < 901) await page.getByRole("button", { name: /Database overloaded.*Game seconds/ }).click();
  const history = page.getByRole("region", { name: "Incident report", exact: true });
  const read = await openTimeline(page, history);
  await expectTidy(read);
  await read.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath(`history-${width}.png`) });
});
