import { describe, expect, it } from 'vitest';
import { ZONE_CUES } from '@/game/sfx';
import { GROUPS } from './conversations';
import { RALLY } from './rally';
import { entryGap, nextGap, ZONE_ENTRY_GAP, ZONE_PEAK, ZONE_REACH, ZONE_SOUNDS, ZONE_ZOOM, zoneLevel, type ZoneSound } from './zoneSounds';

const foosball = ZONE_SOUNDS.find((s) => s.cue === 'foosball') as ZoneSound;

describe('zone sounds', () => {
  it('give every zone voice a place in the office, and every place a voice', () => {
    expect([...new Set(ZONE_SOUNDS.map((s) => s.cue))].sort()).toEqual([...ZONE_CUES].sort());
  });

  it('sound where the activity is: the rally at its table and a murmur at every chatting group', () => {
    const pingPong = ZONE_SOUNDS.find((s) => s.cue === 'pingPong') as ZoneSound;
    expect(pingPong.x).toBe(RALLY.x);
    expect(pingPong.z).toBe(RALLY.z);
    const murmurs = ZONE_SOUNDS.filter((s) => s.cue === 'murmur');
    for (const { centre } of GROUPS) {
      expect(murmurs.some((s) => s.x === centre[0] && s.z === centre[1])).toBe(true);
    }
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

  it('in walk mode are heard from the avatar at full strength, however far out the camera is zoomed', () => {
    const at = zoneLevel(foosball, { x: foosball.x, z: foosball.z, zoom: 0, walking: true });
    expect(at).toBeCloseTo(ZONE_PEAK, 9);
    // The same spot through the camera at that zoom is silent.
    expect(zoneLevel(foosball, { x: foosball.x, z: foosball.z, zoom: 0 })).toBe(0);
  });

  it('answer promptly on first coming into earshot, sooner than any recurring cadence', () => {
    expect(entryGap(0)).toBe(ZONE_ENTRY_GAP[0]);
    expect(entryGap(1)).toBe(ZONE_ENTRY_GAP[1]);
    for (const s of ZONE_SOUNDS) {
      expect(ZONE_ENTRY_GAP[1]).toBeLessThan(s.every[1]);
    }
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
