import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { advanceTurn, newLegacyGame as newGame } from '../sim';
import { DEFAULT_META, loadClassicGame as loadGame, readAnalytics, saveClassicGame as saveGame, saveMeta, saveMode } from './persist';
import { useGame } from './store';

beforeEach(() => {
  localStorage.clear();
  saveMeta({ ...DEFAULT_META, challengeUnlocked: true });
  saveMode('classic');
  useGame.setState(useGame.getInitialState(), true);
});
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

function resumeIncident() {
  const game = advanceTurn({ ...newGame(1), users: 4500 });
  expect(game.phase).toBe('incident');
  saveGame(game);
  saveMeta({ ...DEFAULT_META, tutorialDone: true, incidentGuideDone: true, runsStarted: 1 }, 'classic');
  useGame.getState().boot();
  return game;
}

describe('sound settings', () => {
  it('mutes and unmutes, and remembers it for the next visit', () => {
    useGame.getState().boot();
    expect(useGame.getState().audio.muted).toBe(false);
    useGame.getState().toggleMute();
    expect(useGame.getState().audio.muted).toBe(true);
    useGame.setState(useGame.getInitialState(), true);
    useGame.getState().boot();
    expect(useGame.getState().audio.muted).toBe(true);
    useGame.getState().toggleMute();
    expect(useGame.getState().audio.muted).toBe(false);
  });
});

describe('the floor in view', () => {
  it('goes to the floor of whatever is chosen, records the switch, and stays put when nothing is', () => {
    useGame.getState().boot();
    expect(useGame.getState().floor).toBe('servers');
    useGame.getState().select('growth');
    expect(useGame.getState().floor).toBe('office');
    useGame.getState().select(null);
    expect(useGame.getState().floor).toBe('office');
    useGame.getState().select('db');
    expect(useGame.getState().floor).toBe('servers');
    useGame.getState().goToFloor('servers', 'menu');
    expect(readAnalytics().filter(e => e.name === 'floor_switched').map(e => e.data)).toEqual([
      { to: 'office', how: 'select', mode: 'classic' },
      { to: 'servers', how: 'select', mode: 'classic' },
    ]);
  });

  it('is never moved by an incident starting, nor saved with the game', () => {
    saveGame({ ...newGame(1), users: 4500 });
    saveMeta({ ...DEFAULT_META, tutorialDone: true, incidentGuideDone: true, runsStarted: 1 }, 'classic');
    useGame.getState().boot();
    useGame.getState().goToFloor('office', 'key');
    useGame.getState().advance();
    expect(useGame.getState().game.phase).toBe('incident');
    expect(useGame.getState().floor).toBe('office');
    expect(localStorage.getItem('nn.classic.save.v1')).not.toContain('"floor"');
    // A new run keeps the floor the player last looked at.
    useGame.getState().newRun();
    expect(useGame.getState().floor).toBe('office');
  });
});

describe('game lifecycle', () => {
  it('boots idempotently without duplicating runs or analytics', () => {
    useGame.getState().boot();
    const state = useGame.getState();
    useGame.getState().boot();
    expect(useGame.getState()).toBe(state);
    expect(readAnalytics().filter(e => e.name === 'run_started')).toHaveLength(1);
    expect(state.meta.runsStarted).toBe(1);
  });

  it('starts a playable new run after a corrupt save and explains recovery', () => {
    localStorage.setItem('nn.classic.save.v1', '{');
    useGame.getState().boot();
    expect(useGame.getState().toast?.kind).toBe('error');
    expect(useGame.getState().game.phase).toBe('management');
    expect(loadGame().status).toBe('ok');
  });

  it('resumes an incident paused, then applies the selected speed', () => {
    const game = resumeIncident();
    useGame.getState().tick(1);
    expect(useGame.getState().game).toEqual(game);
    expect(useGame.getState().meta.runsStarted).toBe(1);
    useGame.getState().setSpeed(2);
    useGame.getState().setRunning(true);
    useGame.getState().tick(1);
    expect(useGame.getState().game.incident?.elapsed).toBeCloseTo(2);
    useGame.getState().setRunning(false);
    const paused = useGame.getState().game;
    useGame.getState().tick(5);
    expect(useGame.getState().game).toBe(paused);
    expect(loadGame()).toMatchObject({ status: 'ok', game: paused });
  });

  it('stops at an incident outcome and records its completion once', () => {
    resumeIncident();
    useGame.getState().setRunning(true);
    for (let i = 0; i < 140 && useGame.getState().game.phase === 'incident'; i++) useGame.getState().tick(1);
    expect(useGame.getState().game.phase).not.toBe('incident');
    expect(useGame.getState().running).toBe(false);
    useGame.getState().tick(1);
    expect(readAnalytics().filter(e => e.name === 'incident_completed')).toHaveLength(1);
    expect(useGame.getState().meta.firstIncidentCompleted).toBe(true);
    expect(loadGame()).toMatchObject({ status: 'ok', game: useGame.getState().game });
  });

  it('resets transient UI and saves the requested seed when replaying', () => {
    resumeIncident();
    useGame.setState({ selected: 'app', view: 'history', running: true, speed: 2, tour: { track: 'incident', step: 1 }, rating: 4 });
    useGame.getState().newRun({ seed: 'repeatable', voluntary: true });
    expect(useGame.getState()).toMatchObject({
      game: newGame('repeatable'), started: true, selected: null, view: null, running: false, tour: null, rating: null,
    });
    expect(readAnalytics().filter(e => e.name === 'voluntary_replay')).toHaveLength(1);
    expect(loadGame()).toMatchObject({ status: 'ok', game: newGame('repeatable') });
  });
});
