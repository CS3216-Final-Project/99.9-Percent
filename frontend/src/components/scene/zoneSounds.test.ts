import { describe, expect, it } from 'vitest';
import { ZONE_CUES } from '@/game/sfx';
import { nextGap, ZONE_PEAK, ZONE_REACH, ZONE_SOUNDS, ZONE_ZOOM, zoneLevel, type ZoneSound } from './zoneSounds';

const foosball = ZONE_SOUNDS.find((s) => s.cue === 'foosball') as ZoneSound;

describe('zone sounds', () => {
  it('give every zone voice a place in the office, and every place a voice', () => {
    expect(ZONE_SOUNDS.map((s) => s.cue).sort()).toEqual([...ZONE_CUES].sort());
  });

  it('play quietly at full strength only up close and zoomed in', () => {
    const level = zoneLevel(foosball, { x: foosball.x, z: foosball.z, zoom: ZONE_ZOOM[1] + 10 });
    expect(level).toBeCloseTo(ZONE_PEAK, 9);
    expect(ZONE_PEAK).toBeLessThan(1);
  });

  it('fade with distance from where the camera looks, and fall silent across the office', () => {
    const at = (d: number) => zoneLevel(foosball, { x: foosball.x + d, z: foosball.z, zoom: 60 });
    expect(at(ZONE_REACH[0])).toBeCloseTo(ZONE_PEAK, 9);
    expect(at(6)).toBeLessThan(at(4));
    expect(at(8)).toBeLessThan(at(6));
    expect(at(ZONE_REACH[1])).toBe(0);
    expect(at(30)).toBe(0);
  });

  it('fall silent when the camera pulls back, as at the opening zoom of 30 they are only faint', () => {
    const at = (zoom: number) => zoneLevel(foosball, { x: foosball.x, z: foosball.z, zoom });
    expect(at(ZONE_ZOOM[0])).toBe(0);
    expect(at(10)).toBe(0);
    expect(at(30)).toBeGreaterThan(0);
    expect(at(30)).toBeLessThan(ZONE_PEAK / 2);
  });

  it('wait between plays within each sound\'s range', () => {
    for (const s of ZONE_SOUNDS) {
      expect(nextGap(s, 0)).toBe(s.every[0]);
      expect(nextGap(s, 1)).toBe(s.every[1]);
      expect(s.every[0]).toBeGreaterThan(0);
      expect(s.every[1]).toBeGreaterThanOrEqual(s.every[0]);
    }
  });
});
