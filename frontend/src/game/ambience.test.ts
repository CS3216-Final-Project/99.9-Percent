import { describe, expect, it } from 'vitest';
import { blend, CITY_INDOOR_LEVEL, createAmbience, dayEvents, LOOP_SECONDS, mix, nightEvents, type Event } from './ambience';

const kinds = (events: Event[]) => new Set(events.map((e) => e.kind));

describe('the city at day and at night', () => {
  it('sings birds by day and chirps crickets by night, with cars going by in both', () => {
    expect(kinds(dayEvents())).toEqual(new Set(['chirp', 'trill', 'car']));
    expect(kinds(nightEvents())).toEqual(new Set(['cricket', 'car']));
    expect(dayEvents().filter((e) => e.kind === 'chirp').length).toBeGreaterThan(20);
    expect(nightEvents().filter((e) => e.kind === 'cricket').length).toBeGreaterThan(40);
  });

  it('fits every sound inside its loop, so the loop repeats without a seam', () => {
    for (const e of [...dayEvents(), ...nightEvents()]) {
      expect(e.at).toBeGreaterThanOrEqual(0);
      expect(e.at + e.length).toBeLessThan(LOOP_SECONDS);
      expect(e.length).toBeGreaterThan(0);
    }
  });

  it('keeps the birds in a songbird range and the crickets high, and fewer, quieter cars at night', () => {
    for (const e of dayEvents()) {
      if (e.kind !== 'chirp') continue;
      for (const hz of [e.from, e.to]) {
        expect(hz).toBeGreaterThan(1500);
        expect(hz).toBeLessThan(6000);
      }
    }
    for (const e of nightEvents()) if (e.kind === 'cricket') expect(e.hz).toBeGreaterThan(3500);
    const cars = (events: Event[]) => events.filter((e): e is Extract<Event, { kind: 'car' }> => e.kind === 'car');
    expect(cars(nightEvents()).length).toBeLessThan(cars(dayEvents()).length);
    expect(Math.max(...cars(nightEvents()).map((c) => c.gain))).toBeLessThan(Math.min(...cars(dayEvents()).map((c) => c.gain)));
  });

  it('is the same every time', () => {
    expect(dayEvents()).toEqual(dayEvents());
    expect(nightEvents()).toEqual(nightEvents());
    expect(dayEvents(1)).not.toEqual(dayEvents());
  });
});

describe('crossfading with the dark', () => {
  it('plays day alone in daylight and night alone in the dark, at an even loudness in between', () => {
    expect(mix(0)).toEqual({ day: 1, night: 0 });
    expect(mix(1).day).toBeCloseTo(0, 9);
    expect(mix(1).night).toBeCloseTo(1, 9);
    let last = mix(0);
    for (let d = 0; d <= 1.0001; d += 0.05) {
      const m = mix(d);
      expect(m.day * m.day + m.night * m.night).toBeCloseTo(1, 9);
      expect(m.day).toBeLessThanOrEqual(last.day + 1e-9);
      expect(m.night).toBeGreaterThanOrEqual(last.night - 1e-9);
      last = m;
    }
    expect(mix(-1)).toEqual(mix(0));
    expect(mix(2)).toEqual(mix(1));
  });
});

describe('the server floor', () => {
  it('takes over from the city as the hall is heard, and in the office the city is only faint through the walls', () => {
    for (const dark of [0, 0.4, 1]) {
      expect(blend(dark, 0)).toEqual({ day: mix(dark).day * CITY_INDOOR_LEVEL, night: mix(dark).night * CITY_INDOOR_LEVEL, hall: 0 });
      const indoors = blend(dark, 1);
      expect(indoors.hall).toBe(1);
      expect(indoors.day).toBeCloseTo(0, 9);
      expect(indoors.night).toBeCloseTo(0, 9);
    }
    const half = blend(0, 0.5);
    expect(half.day).toBeCloseTo(CITY_INDOOR_LEVEL * 0.5, 9);
    expect(half.hall).toBe(0.5);
    expect(blend(0, 3)).toEqual(blend(0, 1));
    expect(blend(0, -1)).toEqual(blend(0, 0));
  });

  it('keeps the hall louder than the faint city heard indoors, and the city never fully silent in the office', () => {
    const full = blend(0.3, 1);
    expect(full.hall).toBeGreaterThan(CITY_INDOOR_LEVEL);
    const office = blend(0.3, 0);
    expect(office.day + office.night).toBeGreaterThan(0);
  });
});

describe('without Web Audio', () => {
  it('stays silent and never throws, as in tests', () => {
    const a = createAmbience(() => true);
    expect(() => {
      a.setEnabled(true);
      a.setVolume(80);
      a.setDark(0.5);
      a.setHall(1);
      a.dispose();
    }).not.toThrow();
  });
});
