import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newGame } from '../sim';
import { clearAnalytics, clearSave, DEFAULT_META, loadGame, loadMeta, readAnalytics, saveGame, saveMeta, track } from './persist';

beforeEach(() => localStorage.clear());
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('saved runs', () => {
  it('round-trips the complete seeded state and save timestamp', () => {
    const game = newGame('resume-me');
    vi.spyOn(Date, 'now').mockReturnValue(12345);
    expect(saveGame(game)).toBe(true);
    expect(loadGame()).toEqual({ status: 'ok', game, savedAt: 12345 });
    clearSave();
    expect(loadGame()).toEqual({ status: 'none' });
  });

  it.each([
    ['invalid JSON', '{'],
    ['old version', JSON.stringify({ game: { ...newGame(1), version: -1 } })],
    ['incident without incident state', JSON.stringify({ game: { ...newGame(1), phase: 'incident', incident: null } })],
    ['no servers', JSON.stringify({ game: { ...newGame(1), infra: { ...newGame(1).infra, appHosts: [] } } })],
  ])('discards %s and allows a fresh save', (_label, raw) => {
    localStorage.setItem('nn.save.v1', raw);
    expect(loadGame()).toEqual({ status: 'corrupt' });
    expect(loadGame()).toEqual({ status: 'none' });
    expect(saveGame(newGame(2))).toBe(true);
    expect(loadGame().status).toBe('ok');
  });

  it('handles unavailable storage without crashing startup', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(loadGame()).toEqual({ status: 'none' });
    expect(loadMeta()).toEqual(DEFAULT_META);
    expect(readAnalytics()).toEqual([]);
  });

  it('reports a failed save and tolerates failed cleanup', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(saveGame(newGame(1))).toBe(false);
    expect(() => clearSave()).not.toThrow();
    expect(() => track('run_started')).not.toThrow();
  });
});

describe('browser metadata and analytics', () => {
  it('fills new metadata fields when resuming an older browser profile', () => {
    localStorage.setItem('nn.meta.v1', JSON.stringify({ runsStarted: 4, onboarded: true }));
    expect(loadMeta()).toEqual({ ...DEFAULT_META, runsStarted: 4, onboarded: true });
    saveMeta({ ...DEFAULT_META, tutorialDone: true });
    expect(loadMeta().tutorialDone).toBe(true);
  });

  it('recovers from malformed metadata and analytics', () => {
    localStorage.setItem('nn.meta.v1', '{');
    localStorage.setItem('nn.analytics.v1', '{}');
    expect(loadMeta()).toEqual(DEFAULT_META);
    expect(readAnalytics()).toEqual([]);
    localStorage.setItem('nn.analytics.v1', '{');
    track('save_resumed', { week: 2 });
    expect(readAnalytics().map(e => e.name)).toEqual(['save_resumed']);
  });

  it('retains only the latest 500 events and can clear them', () => {
    const events = Array.from({ length: 500 }, (_, i) => ({ t: '2026-01-01', name: 'run_started', data: { run: i } }));
    localStorage.setItem('nn.analytics.v1', JSON.stringify(events));
    track('save_resumed', { week: 3 });
    const saved = readAnalytics();
    expect(saved).toHaveLength(500);
    expect(saved[0].data).toEqual({ run: 1 });
    expect(saved[499].name).toBe('save_resumed');
    clearAnalytics();
    expect(readAnalytics()).toEqual([]);
  });
});
