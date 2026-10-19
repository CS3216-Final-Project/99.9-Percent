import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, daylight, OFFICE_MIN_ELEVATION, START, SUN_REST, SUN_STEP, sunAt, sunSteps, timeOfDay, timeOverride, type Daylight, type Vec3 } from './sky';

const samples = Array.from({ length: 1001 }, (_, i) => i / 1000);
const brightness = (d: Daylight) => d.keyLight.reduce((a, b) => a + b, 0) + d.skyLight.reduce((a, b) => a + b, 0);
const elevation = (v: number[]) => Math.asin(v[1]);
const angle = (a: Vec3, b: Vec3) => Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
const blend = ({ from, to, fade }: ReturnType<typeof sunSteps>): Vec3 => {
  const v: Vec3 = [from[0] + (to[0] - from[0]) * fade, from[1] + (to[1] - from[1]) * fade, from[2] + (to[2] - from[2]) * fade];
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};

describe('the time of day', () => {
  it('raises the sun in the east, carries it through the south at noon and sets it in the west', () => {
    expect(sunAt(0.25)[1]).toBeCloseTo(0, 6);
    expect(sunAt(0.75)[1]).toBeCloseTo(0, 6);
    expect(sunAt(0.3)[0]).toBeGreaterThan(0);
    expect(sunAt(0.7)[0]).toBeLessThan(0);
    expect(sunAt(0.5)[2]).toBeGreaterThan(0);
    expect(elevation(sunAt(0.5))).toBeGreaterThan(1);
    for (const t of samples) if (t !== 0.25 && t !== 0.75) expect(sunAt(t)[1] > 0, `at ${t}`).toBe(t > 0.25 && t < 0.75);
  });

  it('is darkest at midnight and brightest about noon', () => {
    expect(daylight(0).dark).toBe(1);
    expect(daylight(0.5).dark).toBe(0);
    const darkest = Math.min(...samples.map((t) => brightness(daylight(t))));
    const brightest = Math.max(...samples.map((t) => brightness(daylight(t))));
    expect(brightness(daylight(0))).toBeCloseTo(darkest, 6);
    expect(brightness(daylight(0.5))).toBeCloseTo(brightest, 1);
    expect(brightest).toBeGreaterThan(2 * darkest);
  });

  it('changes smoothly all day and round midnight, with no jump where the cycle wraps', () => {
    const fields = (d: Daylight) => [...d.sun, ...d.key, ...d.keyLight, ...d.skyLight, ...d.groundLight, ...d.horizon, d.dark, ...d.office.dir, ...d.office.colour, d.office.sun, d.office.sky];
    for (let i = 0; i < samples.length; i++) {
      const a = fields(daylight(samples[i]));
      const b = fields(daylight(samples[i] + 0.001));
      for (let k = 0; k < a.length; k++) expect(Math.abs(a[k] - b[k]), `field ${k} at ${samples[i]}`).toBeLessThan(0.05);
    }
    const before = fields(daylight(1 - 1e-9));
    fields(daylight(0)).forEach((v, k) => expect(before[k], `field ${k} across midnight`).toBeCloseTo(v, 5));
  });

  it('keeps the office lit from above and within a narrow range of brightness at every hour', () => {
    for (const t of samples) {
      const { office } = daylight(t);
      expect(elevation(office.dir), `at ${t}`).toBeGreaterThanOrEqual(OFFICE_MIN_ELEVATION - 1e-9);
      expect(office.sun).toBeGreaterThanOrEqual(1.7);
      expect(office.sun).toBeLessThanOrEqual(2.3);
      expect(office.sky).toBeGreaterThanOrEqual(0.8);
      expect(Math.min(...office.colour)).toBeGreaterThan(0.75);
    }
  });

  it('never lights the city from below the horizon', () => {
    for (const t of samples) expect(daylight(t).key[1], `at ${t}`).toBeGreaterThan(0.1);
  });

  describe("the office's sun's steps", () => {
    it('stand a small, bounded step apart along its path, so a fade between them is never a double shadow', () => {
      for (const t of samples) {
        const s = sunSteps(t);
        expect(s.fade, `fade at ${t}`).toBeGreaterThanOrEqual(0);
        expect(s.fade, `fade at ${t}`).toBeLessThan(1);
        // The day is walked a twentieth of a second at a time, so a step can overshoot by at most that much of the path
        // (the sun swings fastest, about 0.04 radians a second, as it takes over from the moon at dawn).
        expect(angle(s.from, s.to), `step at ${t}`).toBeLessThanOrEqual(SUN_STEP + 0.0025);
      }
    });

    it('fade through where the sun really is, all day and through the dawn and dusk swing', () => {
      for (let i = 0; i < 20000; i++) {
        const t = i / 20000;
        expect(angle(blend(sunSteps(t)), daylight(t).office.dir), `at ${t}`).toBeLessThan(SUN_STEP / 2);
      }
    });

    it('draw a sun standing still at night from one direction, and never rest longer than SUN_REST', () => {
      const night = sunSteps(0.05);
      expect(night.from).toEqual(night.to);
      // How long a step lasts follows from how fast the fade runs through it; the day is walked in twentieths of a second.
      const tick = 1e-6;
      for (const t of samples) {
        const run = sunSteps(t + tick).fade - sunSteps(t).fade;
        if (run > 0) expect(tick / run, `step at ${t}`).toBeLessThanOrEqual(SUN_REST + 0.05 / DAY_SECONDS + 1e-9);
      }
    });

    it('join up: one step ends where the next begins', () => {
      let t = 0.3;
      let s = sunSteps(t);
      while (t < 0.5) {
        t += 0.00005;
        const next = sunSteps(t);
        if (next.from.some((v, k) => v !== s.from[k])) expect(next.from, `at ${t}`).toEqual(s.to);
        s = next;
      }
    });
  });

  it('starts mid-morning, passes a whole day in DAY_SECONDS, and can be fixed from the address', () => {
    expect(timeOfDay(0)).toBeCloseTo(START, 9);
    expect(timeOfDay(DAY_SECONDS)).toBeCloseTo(START, 9);
    expect(timeOfDay(DAY_SECONDS / 2)).toBeCloseTo((START + 0.5) % 1, 9);
    expect(timeOfDay(123, 0.5)).toBe(0.5);
    expect(daylight(START).dark).toBeLessThan(0.05);
    expect(timeOverride('?time=0.5')).toBe(0.5);
    expect(timeOverride('?graphics=hd&time=0.8')).toBe(0.8);
    for (const bad of ['', '?time=', '?time=noon', '?time=1.5', '?time=-0.2']) expect(timeOverride(bad), bad).toBeNull();
  });
});
