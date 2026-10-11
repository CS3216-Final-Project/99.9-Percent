import { describe, expect, it } from 'vitest';
import { compose, frequency, MOODS, PITCHED, secondsOf } from './score';
import { createMusic } from './music';

const KEYS = {
  // C major for the groove; A harmonic minor, with its G sharp, for the incident.
  calm: new Set([0, 2, 4, 5, 7, 9, 11]),
  tense: new Set([9, 11, 0, 2, 4, 5, 8]),
};

describe('background music score', () => {
  it.each(MOODS)('keeps every %s note inside the loop, so it repeats without a seam', (mood) => {
    const score = compose(mood);
    expect(score.notes.length).toBeGreaterThan(50);
    for (const n of score.notes) {
      expect(n.beat).toBeGreaterThanOrEqual(0);
      expect(n.beat + n.beats).toBeLessThanOrEqual(score.beats + 1e-9);
      expect(n.gain).toBeGreaterThan(0);
      expect(n.gain).toBeLessThanOrEqual(1);
    }
  });

  it.each(MOODS)('stays in key for the %s loop', (mood) => {
    for (const n of compose(mood).notes) if (PITCHED.includes(n.voice) && n.voice !== 'alarm') expect(KEYS[mood].has(n.midi % 12), `${n.voice} ${n.midi}`).toBe(true);
  });

  it('keeps each voice in its own register', () => {
    for (const mood of MOODS) {
      for (const n of compose(mood).notes) {
        if (n.voice === 'bass') expect(n.midi).toBeLessThan(48);
        if (n.voice === 'pad') expect(n.midi).toBeGreaterThanOrEqual(38);
        if (n.voice === 'pluck') expect(n.midi).toBeGreaterThanOrEqual(60);
      }
    }
  });

  it('makes the incident loop faster, with an alarm the calm one lacks', () => {
    const calm = compose('calm');
    const tense = compose('tense');
    expect(tense.bpm).toBeGreaterThan(calm.bpm);
    expect(tense.notes.some((n) => n.voice === 'alarm')).toBe(true);
    expect(calm.notes.some((n) => n.voice === 'alarm')).toBe(false);
    expect(secondsOf(calm)).toBeGreaterThan(10);
    expect(secondsOf(tense)).toBeGreaterThan(10);
  });

  it('writes the same score every time', () => {
    expect(compose('calm')).toEqual(compose('calm'));
  });

  it('tunes A above middle C to 440 Hz', () => {
    expect(frequency(69)).toBeCloseTo(440);
    expect(frequency(81)).toBeCloseTo(880);
  });
});

describe('music player', () => {
  it('stays silent and harmless where the browser has no Web Audio', () => {
    // jsdom has no AudioContext, like a browser with audio disabled.
    const music = createMusic();
    expect(() => {
      music.setEnabled(true);
      music.setMood('tense');
      music.setEnabled(false);
      music.dispose();
    }).not.toThrow();
  });
});
