import { beforeEach, describe, expect, it } from 'vitest';
import { SCENE_CUES } from '@/game/sfx';
import { ALL_ROLES, ALL_SPECIES, creature, SPECIES, type Kind } from './cast';
import { MAX_LINE } from './conversations';
import {
  ASIDES,
  captionLine,
  EARSHOT,
  earshot,
  fresh,
  GLANCE_SECONDS,
  glance,
  GREET_AGAIN,
  GREET_SECONDS,
  GREET_SPACING,
  greetingLine,
  HELLOS,
  nearness,
  NOTICE_LEAVE,
  NOTICE_REACH,
  notices,
  PANIC_HELLOS,
  resetGreetings,
  timbreOf,
  voiceLevel,
  voiceOf,
  VOICE_PEAK,
} from './greetings';

describe('greeting lines', () => {
  it('keeps every line short enough for a bubble, in plain text', () => {
    for (const line of [...Object.values(HELLOS).flat(), ...PANIC_HELLOS, ...ASIDES]) {
      expect(line.length, line).toBeLessThanOrEqual(MAX_LINE);
      expect(line, line).toMatch(/^[\x20-\x7e]+$/);
    }
  });

  it('says a panic line during the outage, and steps through a role\'s lines otherwise', () => {
    expect(PANIC_HELLOS).toContain(greetingLine('cat', 'panic', 0));
    for (const role of ALL_ROLES) {
      const species = creature(0, role);
      const heard = new Set(Array.from({ length: HELLOS[role].length }, (_, n) => greetingLine(species, 'idle', n)));
      expect(heard.size, role).toBe(HELLOS[role].length);
      for (const line of heard) expect(HELLOS[role]).toContain(line);
    }
  });
});

describe('being noticed', () => {
  beforeEach(resetGreetings);

  it('fires once on coming within reach, not again while staying inside', () => {
    const state = fresh();
    expect(notices(state, NOTICE_REACH + 0.1, 0)).toBe(false);
    expect(notices(state, NOTICE_REACH - 0.1, 0.1)).toBe(true);
    expect(notices(state, NOTICE_REACH - 0.2, 0.2)).toBe(false);
    expect(notices(state, NOTICE_REACH - 0.2, GREET_AGAIN + 1)).toBe(false);
  });

  it('needs the avatar to leave and GREET_AGAIN to pass before it fires again', () => {
    const state = fresh();
    expect(notices(state, 1, 0)).toBe(true);
    // Leaving beyond NOTICE_LEAVE and coming back soon: remembered, so nothing, and no second hello while it lingers.
    expect(notices(state, NOTICE_LEAVE + 0.5, 1)).toBe(false);
    expect(notices(state, 1, 2)).toBe(false);
    expect(notices(state, 1, GREET_AGAIN + 0.5)).toBe(false);
    // Leaving and coming back after GREET_AGAIN is a fresh approach: a fresh greeting.
    expect(notices(state, NOTICE_LEAVE + 0.5, GREET_AGAIN + 1)).toBe(false);
    expect(notices(state, 1, GREET_AGAIN + 1.5)).toBe(true);
  });

  it('spaces hellos one after another rather than in a chorus', () => {
    const first = fresh();
    const second = fresh();
    expect(notices(first, 1, 0)).toBe(true);
    // Right after someone else: held back, but not marked inside, so it tries again next frame.
    expect(notices(second, 1, 0.1)).toBe(false);
    expect(notices(second, 1, 0.2)).toBe(false);
    expect(notices(second, 1, GREET_SPACING + 0.1)).toBe(true);
  });
});

describe('the shapes of a greeting', () => {
  it('glances in, holds and back out over the greeting', () => {
    expect(glance(-0.1)).toBe(0);
    expect(glance(0)).toBe(0);
    expect(glance(GREET_SECONDS)).toBe(0);
    expect(glance(GREET_SECONDS / 2)).toBe(1);
    expect(glance(GLANCE_SECONDS * 0.5)).toBeGreaterThan(0);
    expect(glance(GREET_SECONDS - GLANCE_SECONDS * 0.5)).toBeGreaterThan(0);
    expect(glance(GREET_SECONDS - 0.01)).toBeLessThan(0.2);
  });

  it('hears a group fully inside earshot and not at all beyond it', () => {
    expect(earshot(0)).toBe(1);
    expect(earshot(EARSHOT[0])).toBe(1);
    expect(earshot(EARSHOT[1])).toBe(0);
    expect(earshot(EARSHOT[1] + 2)).toBe(0);
    let last = 1;
    for (let d = EARSHOT[0]; d <= EARSHOT[1]; d += 0.25) {
      expect(earshot(d)).toBeLessThanOrEqual(last);
      last = earshot(d);
    }
    expect(earshot(4)).toBeGreaterThan(earshot(6));
  });

  it('captions the line being said, the last one through the pause, and nothing out of earshot', () => {
    expect(captionLine('Coffee run?', null, true)).toBe('Coffee run?');
    expect(captionLine(null, 'Coffee run?', true)).toBe('Coffee run?');
    expect(captionLine(null, 'Coffee run?', false)).toBeNull();
    expect(captionLine('Coffee run?', null, false)).toBeNull();
    expect(captionLine(null, null, true)).toBeNull();
  });

  it('plays a voice loudest up close and not at all beyond earshot', () => {
    expect(voiceLevel(0.5)).toBe(VOICE_PEAK);
    expect(voiceLevel(1)).toBe(VOICE_PEAK);
    expect(voiceLevel(EARSHOT[1])).toBe(0);
    expect(voiceLevel(3)).toBeLessThan(VOICE_PEAK);
    expect(voiceLevel(3)).toBeGreaterThan(0);
  });

  it('measures nearness as 1 within a metre falling to 0 at the edge of earshot', () => {
    expect(nearness(0.5)).toBe(1);
    expect(nearness(1)).toBe(1);
    expect(nearness(EARSHOT[1])).toBe(0);
    expect(nearness(EARSHOT[1] + 1)).toBe(0);
    let last = 1;
    for (let d = 1; d <= EARSHOT[1]; d += 0.25) {
      expect(nearness(d)).toBeLessThanOrEqual(last);
      last = nearness(d);
    }
    expect(nearness(2)).toBeGreaterThan(nearness(5));
    // The bark level is the same curve at voice peak.
    for (const d of [0.4, 1, 3, 5.5, EARSHOT[1]]) expect(voiceLevel(d)).toBeCloseTo(VOICE_PEAK * nearness(d));
  });

  it('gives every species a speakable timbre, the small ones higher than the big ones', () => {
    const blobs = ALL_SPECIES.filter((s) => SPECIES[s].kind === 'blob');
    const bigs = ALL_SPECIES.filter((s) => SPECIES[s].kind === 'big');
    const flyers = ALL_SPECIES.filter((s) => SPECIES[s].kind === 'flyer');
    for (const s of ALL_SPECIES) {
      const t = timbreOf(s);
      expect(t.pitch, s).toBeGreaterThanOrEqual(0.1);
      expect(t.pitch, s).toBeLessThanOrEqual(2);
      expect(t.rate, s).toBeGreaterThan(0);
    }
    for (const blob of blobs) for (const big of bigs) expect(timbreOf(blob).pitch).toBeGreaterThan(timbreOf(big).pitch);
    for (const flyer of flyers) for (const s of ALL_SPECIES) expect(timbreOf(flyer).rate).toBeGreaterThanOrEqual(timbreOf(s).rate);
    // Same species, same voice; two blobs differ in seed.
    expect(timbreOf('cat')).toEqual(timbreOf('cat'));
    expect(timbreOf('cat').seed).not.toBe(timbreOf('birb').seed);
  });

  it('gives every body plan a voice the effects player knows', () => {
    for (const kind of ['blob', 'big', 'flyer'] as Kind[]) expect(SCENE_CUES).toContain(voiceOf(kind));
  });
});
