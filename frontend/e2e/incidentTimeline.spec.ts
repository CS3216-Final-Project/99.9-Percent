import type { Locator, Page } from "@playwright/test";
import { test, expect, seedSave, expectRoom } from "./fixtures";
import { applyAction, newGame, type Action, type GameState } from "../src/sim";
import { act, tick } from "../src/sim/__tests__/spikeFixtures";

/** An Opening incident answered late: the Database upgrade comes 40 game seconds in, so the window is long and its events crowd. */
function slowResponse() {
  let g = act(tick(newGame(1, "slow-response"), 46), { type: "start_db_upgrade" });
  for (let i = 0; i < 200 && g.phase !== "review"; i++) g = tick(g);
  expect(g.phase).toBe("review");
  return g;
}

/**
 * An Opening incident left alone for two game minutes, then a burst of a dozen decisions within a few seconds: the
 * burst's markers crowd one spot on a long axis.
 */
function crowdedResponse() {
  const tried = (g: GameState, a: Action) => { const r = applyAction(g, a); return r.ok ? r.state : g; };
  let g = newGame(1, "crowded");
  for (let i = 0; i < 300 && !g.campaign!.incident; i++) g = tick(g);
  g = tick(g, 120);
  for (let i = 0; i < 6; i++) g = tried(tried(g, { type: "set_traffic_limit", enabled: g.campaign!.limit === null }), { type: "add_server" });
  g = tick(g);
  for (let i = 0; i < 4; i++) g = tick(tried(g, { type: "set_traffic_limit", enabled: g.campaign!.limit === null }));
  g = tried(g, { type: "start_db_upgrade" });
  for (let i = 0; i < 300 && g.phase !== "review"; i++) g = tick(g);
  expect(g.phase).toBe("review");
  return g;
}

/** What the timeline draws, measured in the page: everything must sit inside its plot, apart and readable. */
function measure(slider: Locator) {
  return slider.evaluate(plot => {
    const box = plot.getBoundingClientRect(), svg = plot.querySelector("svg")!;
    const texts = [...svg.querySelectorAll("text")].map(t => { const { x, y, width, height } = t.getBBox(); return { text: t.textContent!, x, y, width, height }; });
    const markers = [...svg.querySelectorAll(".timeline-marker circle")].map(c => ({ x: +c.getAttribute("cx")!, y: +c.getAttribute("cy")!, r: +c.getAttribute("r")!, label: c.nextElementSibling!.textContent! }));
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
    return { left: box.left, right: box.right, width: svg.viewBox.baseVal.width, height: svg.viewBox.baseVal.height, drawn: svg.getBoundingClientRect().toJSON() as DOMRect, texts, markers, labelHits, axis: texts.filter(t => t.y > bottom) };
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

for (const [width, height] of [[1440, 900], [320, 640]]) test(`a burst of events folds into a cluster instead of stacking the track out of the report at ${width} px`, async ({ page, withoutRoom }, info) => {
  await withoutRoom();
  await page.setViewportSize({ width, height });
  const game = crowdedResponse();
  await page.route("**/api/**", route => route.abort()); await seedSave(page, game); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click(); await expectRoom(page);
  const report = page.getByRole("dialog", { name: "Incident postmortem", exact: true });
  const slider = await openTimeline(page, report);
  const plot = await expectTidy(slider);
  // Markers stack at most three high; the rest at that spot fold into one "+n" marker, and between them every
  // event is drawn once.
  expect(new Set(plot.markers.map(m => m.y)).size).toBeLessThanOrEqual(3);
  const folded = plot.markers.filter(m => m.label.startsWith("+")), key = report.getByRole("list", { name: "Recorded events", exact: true }).getByRole("listitem");
  expect(folded.length).toBeGreaterThan(0);
  expect(plot.markers.length - folded.length + folded.reduce((n, m) => n + Number(m.label.slice(1)), 0)).toBe(await key.count());
  // So the plot is never taller than three levels of markers make it, however many events crowd one spot.
  expect(plot.height).toBeLessThanOrEqual(425);
  await slider.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath(`crowded-${width}.png`) });
});

/**
 * Moves the selection through every second of the window by keyboard, from Home to End, and reports how far below
 * the top of the timeline the plot sits after each move. It is measured within the timeline, so the report scrolling
 * or settling around it does not count.
 */
async function plotPositions(page: Page, slider: Locator) {
  await slider.focus();
  await page.keyboard.press("Home");
  // Each move is measured as soon as it is drawn into the page: the slider's value changes in the same commit as the
  // readout, and reading the plot's box then lays the page out as it will be painted.
  await slider.evaluate(plot => {
    const where = () => ({ second: plot.getAttribute("aria-valuenow")!, offset: plot.getBoundingClientRect().top - plot.closest(".incident-timeline")!.getBoundingClientRect().top });
    const seen = [where()];
    (window as unknown as { seen: typeof seen }).seen = seen;
    new MutationObserver(() => seen.push(where())).observe(plot, { attributeFilter: ["aria-valuenow"] });
  });
  const [first, last] = await Promise.all([slider.getAttribute("aria-valuemin"), slider.getAttribute("aria-valuemax")]);
  for (let i = Number(first); i < Number(last); i++) await page.keyboard.press("ArrowRight");
  // And the two longest jumps, to the first second and back to the last.
  for (const key of ["Home", "End"]) await page.keyboard.press(key);
  await expect(slider).toHaveAttribute("aria-valuenow", last!);
  return page.evaluate(() => (window as unknown as { seen: { second: string; offset: number }[] }).seen);
}

for (const [width, height] of [[1440, 900], [390, 844], [320, 640]]) for (const [name, fixture] of [["a slow response", slowResponse], ["a burst of decisions under a traffic limit", crowdedResponse]] as const) {
  // A desktop only checks that the room kept is no empty gap, on the incident with the most readings.
  if (width > 900 && fixture === slowResponse) continue;
  test(`the plot holds still while the selected second changes after ${name} at ${width} px`, async ({ page, withoutRoom }, info) => {
    await withoutRoom();
    await page.setViewportSize({ width, height });
    await page.route("**/api/**", route => route.abort()); await seedSave(page, fixture()); await page.goto("/");
    await page.getByRole("button", { name: "Continue company", exact: true }).click(); await expectRoom(page);
    const report = page.getByRole("dialog", { name: "Incident postmortem", exact: true });
    const slider = await openTimeline(page, report);
    const seen = await plotPositions(page, slider);
    // Whatever second is selected, its readings wrap into the room the timeline keeps for its longest one, so the
    // plot under the pointer or finger never moves.
    const moved = seen.filter(p => Math.abs(p.offset - seen[0].offset) > 0.5);
    expect(moved.map(p => `second ${p.second}: ${(p.offset - seen[0].offset).toFixed(1)} px`)).toEqual([]);
    // The room is the longest readings' and no more: a desktop holds them in at most two lines.
    const readout = await report.locator(".timeline-readout").evaluate(el => ({ height: el.getBoundingClientRect().height, line: parseFloat(getComputedStyle(el).lineHeight) }));
    if (width >= 900) expect(readout.height).toBeLessThanOrEqual(2 * readout.line + 2 + 0.5);
    await slider.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`readout-${width}.png`) });
  });
}

/** WCAG contrast between two computed rgb() colours. */
function contrast(a: string, b: string) {
  const lum = (c: string) => {
    const [r, g, bl] = c.match(/[\d.]+/g)!.slice(0, 3).map(v => { const s = +v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

for (const scheme of ["dark", "light"] as const) test(`the incident timeline stays readable in ${scheme} forced colours`, async ({ page, withoutRoom }, info) => {
  await withoutRoom();
  // As a player's system setting, forced colours are on before the page loads: Chromium does not fully repaint a drawing
  // when they are turned on under it.
  await page.emulateMedia({ forcedColors: "active", colorScheme: scheme });
  await page.route("**/api/**", route => route.abort()); await seedSave(page, slowResponse()); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click(); await expectRoom(page);
  const report = page.getByRole("dialog", { name: "Incident postmortem", exact: true });
  const slider = await openTimeline(page, report);
  await slider.focus();
  await page.keyboard.press("Home");
  const seen = await report.locator(".incident-timeline").evaluate(root => {
    // Chromium paints a forced-colours page's elements as their attributes change but can report the computed colours
    // they had before, so each colour is read from a fresh copy of its element, beside it.
    const fresh = <T,>(el: Element, read: (copy: Element) => T) => { const copy = el.cloneNode(true) as Element; el.after(copy); const value = read(copy); copy.remove(); return value; };
    const all = <T,>(selector: string, read: (copy: Element) => T) => [...root.querySelectorAll(selector)].map(el => fresh(el, read));
    const fill = (copy: Element) => getComputedStyle(copy).fill, stroke = (copy: Element) => getComputedStyle(copy).stroke;
    const ring = (copy: Element) => getComputedStyle(copy.querySelector("circle")!).stroke;
    // The system's colours as forced colours resolve them in the drawing, which they do not repaint.
    const names = ["Canvas", "CanvasText", "Highlight"], sheet = document.createElement("style"), probe = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    sheet.textContent = names.map(name => `[data-probe="${name}"] { fill: ${name}; }`).join("\n");
    document.head.append(sheet); root.querySelector("svg")!.append(probe);
    const [canvas, text, highlight] = names.map(name => { probe.setAttribute("data-probe", name); return fresh(probe, fill); });
    probe.remove(); sheet.remove();
    const swatch = (name: string) => fresh([...root.querySelectorAll(".timeline-legend li")].find(li => li.textContent === name)!.querySelector("i")!, copy => getComputedStyle(copy).borderTopColor);
    return {
      colors: { canvas, text, highlight },
      lanes: all(".timeline-lane", fill), ticks: all(".chart-tick", fill), limits: all(".timeline-limit-label", fill), incidentLabel: all(".timeline-incident-label", fill),
      cursor: all(".timeline-cursor", stroke),
      swatches: { app: swatch("App Servers demand"), appCapacity: swatch("App Servers capacity"), db: swatch("Database demand"), dbCapacity: swatch("Database capacity") },
      lines: all(".timeline-line", stroke),
      badges: all(".timeline-badge", copy => { const s = getComputedStyle(copy), after = getComputedStyle(copy, "::after"); return { text: copy.textContent!, background: s.backgroundColor, color: s.color, ring: `${after.borderTopStyle} ${after.borderTopColor}` }; }),
      markerRings: all(".timeline-marker:not([data-current])", ring), selectedMarkerRings: all(".timeline-marker[data-current]", ring),
      selectedKey: all(".report-events li[data-current]", copy => { const s = getComputedStyle(copy); return `${s.outlineStyle} ${s.outlineColor}`; }),
    };
  });
  const { text, highlight } = seen.colors;
  // Every word drawn in the plot is in the system's text colour, so none is lost on the system's background.
  for (const fill of [...seen.lanes, ...seen.ticks, ...seen.limits, ...seen.incidentLabel]) expect(fill).toBe(text);
  // The selected second's line and markers stand out in the system's highlight, and its events in the key are ringed.
  expect(seen.cursor).toEqual([highlight]);
  expect(seen.selectedMarkerRings.length).toBeGreaterThan(0);
  for (const ring of seen.selectedMarkerRings) expect(ring).toBe(highlight);
  for (const ring of seen.markerRings) expect(ring).toBe(text);
  expect(seen.selectedKey.length).toBeGreaterThan(0);
  for (const key of seen.selectedKey) expect(key).toBe(`solid ${text}`);
  // The key's swatches keep the colours of the lines they name, so App Servers and Database still tell apart.
  expect(seen.swatches.app).not.toBe(seen.swatches.db);
  expect(seen.swatches.app).toBe(seen.swatches.appCapacity);
  expect(seen.swatches.db).toBe(seen.swatches.dbCapacity);
  expect(seen.lines).toContain(seen.swatches.app);
  expect(seen.lines).toContain(seen.swatches.db);
  // Each event's badge keeps its kind's colour, ringed in the text colour, with its number readable on it.
  expect(seen.badges.length).toBeGreaterThan(0);
  for (const badge of seen.badges) {
    expect(badge.background, badge.text).not.toBe(seen.colors.canvas);
    expect(badge.ring, badge.text).toBe(`solid ${text}`);
    expect(contrast(badge.color, badge.background), badge.text).toBeGreaterThanOrEqual(4.5);
  }
  await page.screenshot({ path: info.outputPath(`forced-${scheme}.png`) });
});

// On a desktop the closed details lay the plot out narrower than it opens; on a phone the widths match.
test("the first frame after the technical details open is drawn at the plot's width", async ({ page, withoutRoom }) => {
  await withoutRoom();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/**", route => route.abort()); await seedSave(page, slowResponse()); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click(); await expectRoom(page);
  const report = page.getByRole("dialog", { name: "Incident postmortem", exact: true });
  // Resize observers run after layout, just before a frame is painted, in the order they were made: one made after the
  // timeline's own reads the drawing each frame paints, from the frame the plot first has its open width.
  await report.locator(".timeline-plot svg").evaluate(svg => {
    const paints: { drawn: number; laid: number }[] = [];
    (window as unknown as { paints: typeof paints }).paints = paints;
    new ResizeObserver(() => paints.push({ drawn: (svg as SVGSVGElement).viewBox.baseVal.width, laid: svg.getBoundingClientRect().width })).observe(svg);
  });
  // The click lands just before a frame, so the frame is laid out and painted before the details' toggle event.
  await report.locator("summary", { hasText: "View Technical Details" }).evaluate(summary => requestAnimationFrame(() => (summary as HTMLElement).click()));
  await expect(report.getByRole("slider", { name: "Incident timeline, game second", exact: true })).toBeVisible();
  await report.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const paints = await page.evaluate(() => (window as unknown as { paints: { drawn: number; laid: number }[] }).paints);
  const open = paints.at(-1)!.laid;
  expect(open).toBeGreaterThan(200);
  for (const p of paints.filter(p => p.laid === open)) expect(p.drawn, JSON.stringify(paints)).toBe(Math.floor(open));
});
